"""Treino, validação temporal e avaliação do modelo de atraso (> 30 min)."""

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    fbeta_score,
    log_loss,
    precision_recall_curve,
    precision_recall_fscore_support,
    roc_auc_score,
)

FAIXAS = ["até 30 min", "> 30 min"]  # alvo binário: a partida atrasou mais de 30 min?
LIMIARES = np.round(np.arange(0.05, 0.71, 0.01), 2)  # limiares testados na calibração do alerta


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
