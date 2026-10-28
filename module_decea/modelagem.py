"""Treino, validação temporal e avaliação do modelo de atraso (> 30 min)."""

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import (
    average_precision_score,
    balanced_accuracy_score,
    confusion_matrix,
    fbeta_score,
    log_loss,
    precision_recall_curve,
    precision_recall_fscore_support,
    roc_auc_score,
)

FAIXAS = ["não", "sim"]  # cada pergunta do modelo é binária: vai atrasar? / se atrasar, passa de 30 min?
CLASSES3 = ["< 15 min", "15–30 min", "> 30 min"]  # alvo do modelo: atraso de partida em 3 classes
LIMIARES = np.round(np.arange(0.05, 0.71, 0.01), 2)  # limiares testados na calibração do alerta
LIMIARES_COND = np.round(np.arange(0.05, 0.96, 0.01), 2)  # idem para "passa de 30 min?" (prevalência ~62%)


def hgb(**params):
    base = {"categorical_features": "from_dtype", "early_stopping": False, "random_state": 0}
    return HistGradientBoostingClassifier(**(base | params))


def folds_temporais(meses, validacoes=(7, 8, 9)):
    """Janela crescente: treina com todos os meses anteriores e valida no mês seguinte (nunca no passado)."""
    for m in validacoes:
        yield np.flatnonzero(meses < m), np.flatnonzero(meses == m)


def busca_hiperparametros(X, y, meses, grade, validacoes=(7, 8, 9)):
    """Log loss médio de cada combinação nos folds temporais (métrica de probabilidade, não de limiar)."""
    linhas = []
    for params in grade:
        perdas = []
        for tr, va in folds_temporais(meses, validacoes):
            p = hgb(**params).fit(X.iloc[tr], y.iloc[tr]).predict_proba(X.iloc[va])
            perdas.append(log_loss(y.iloc[va], p, labels=range(len(FAIXAS))))
        linhas.append(params | {"log_loss": np.mean(perdas), "log_loss_dp": np.std(perdas)})
    return pd.DataFrame(linhas).sort_values("log_loss").reset_index(drop=True)


def decidir(proba, limiar):
    """Alerta de atraso (> 30 min) quando a probabilidade passa do limiar."""
    return (proba[:, 1] >= limiar).astype(int)


def ajustar_limiar(proba, y, grade=LIMIARES):
    """Limiar que maximiza o F1 da classe "atraso > 30 min" (equilíbrio entre precisão e recall)."""
    y = np.asarray(y)
    melhor = max(grade, key=lambda t: fbeta_score(y, decidir(proba, t), beta=1, zero_division=0))
    return round(float(melhor), 2), float(fbeta_score(y, decidir(proba, melhor), beta=1, zero_division=0))


def ajustar_limiar_balanceado(proba, y, grade=LIMIARES_COND):
    """Limiar que maximiza a acurácia balanceada (média do recall de "sim" e de "não"). Usado em "se atrasar, passa de
    30 min?": como ~62% dos atrasos passam de 30 min, o F1 da classe "sim" levaria a dizer "sim" para quase todos."""
    y = np.asarray(y)
    melhor = max(grade, key=lambda t: balanced_accuracy_score(y, decidir(proba, t)))
    return round(float(melhor), 2), float(balanced_accuracy_score(y, decidir(proba, melhor)))


def binaria(p):
    """Probabilidade da classe positiva (vetor) -> matriz (n, 2), o formato que as funções deste módulo esperam."""
    p = np.clip(np.asarray(p, dtype=float), 0, 1)
    return np.column_stack([1 - p, p])


def p_atraso(p3):
    """P(atraso >= 15 min) a partir das 3 classes (< 15, 15–30, > 30)."""
    return p3[:, 1] + p3[:, 2]


def p_mais_30(p3):
    """P(> 30 min | atraso >= 15 min)."""
    pa = p_atraso(p3)
    return np.divide(p3[:, 2], pa, out=np.zeros_like(pa), where=pa > 0)


def decidir3(p3, limiar15, limiar30):
    """0 = sem alerta, 1 = atraso provável (até 30 min), 2 = atraso de mais de 30 min provável."""
    return np.where(p_atraso(p3) < limiar15, 0, np.where(p_mais_30(p3) >= limiar30, 2, 1))


def matriz_confusao3(y3, pred3):
    """Linhas = classe real (< 15, 15–30, > 30), colunas = alerta (0, 1, 2), em % da linha."""
    return confusion_matrix(y3, pred3, labels=[0, 1, 2], normalize="true") * 100


def metricas(y, proba, limiar=0.5):
    """Métricas de ranking (não dependem de limiar) + métricas da decisão no limiar escolhido."""
    y = np.asarray(y)
    p = proba[:, 1]
    alerta = p >= limiar
    return {
        "log_loss": log_loss(y, proba, labels=[0, 1]),
        "ROC-AUC": roc_auc_score(y, p),
        "PR-AUC": average_precision_score(y, p),
        "prevalência": y.mean(),
        "precisão": y[alerta].mean() if alerta.any() else np.nan,
        "recall": alerta[y == 1].mean(),
        "F1": fbeta_score(y, alerta.astype(int), beta=1, zero_division=0),
        "% voos com alerta": alerta.mean(),
    }


def pontos_operacao(y, proba, recalls=(0.2, 0.3, 0.4, 0.5, 0.6)):
    """Para cada recall desejado: melhor precisão possível e o limiar que a dá. Ajuda a escolher o equilíbrio."""
    prec, rec, lim = precision_recall_curve(np.asarray(y), proba[:, 1])
    linhas = []
    for r in recalls:
        ok = np.flatnonzero(rec[:-1] >= r)
        k = ok[np.argmax(prec[ok])]
        linhas.append({"recall": r, "precisão": float(prec[k]), "limiar": float(lim[k])})
    return linhas


def tabela_por_faixa(y, pred):
    p, r, f, s = precision_recall_fscore_support(y, pred, labels=range(len(FAIXAS)), zero_division=0)
    return pd.DataFrame({"precisão": p, "recall": r, "F1": f, "voos": s}, index=FAIXAS)


def matriz_confusao(y, pred):
    """Linhas = faixa real, colunas = faixa prevista, em % da linha."""
    cm = confusion_matrix(y, pred, labels=range(len(FAIXAS)), normalize="true") * 100
    return pd.DataFrame(cm, index=[f"real {f}" for f in FAIXAS], columns=[f"prev {f}" for f in FAIXAS])
