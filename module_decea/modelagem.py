"""Treino, validação temporal e avaliação do modelo de faixas de atraso."""

from itertools import product

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    fbeta_score,
    log_loss,
    precision_recall_fscore_support,
    roc_auc_score,
)

from module_decea.features import FAIXAS

MESES_TREINO = range(1, 10)  # jan–set; out–dez fica reservado para o teste final


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


def decidir(proba, pesos):
    """Faixa prevista = argmax(prob x peso). Peso > 1 numa faixa de atraso = aceitar mais alarmes falsos nela."""
    return np.argmax(proba * np.asarray(pesos)[None, :], axis=1)


def ajustar_pesos(proba, y, beta=2, opcoes=(1, 1.5, 2, 3, 4, 6, 8, 12)):
    """Escolhe os pesos das faixas 1–3 que maximizam o F-beta macro (beta=2: recall vale 2x a precisão)."""
    melhor = (-1, None)
    for w in product(opcoes, repeat=3):
        pesos = (1, *w)
        s = fbeta_score(y, decidir(proba, pesos), beta=beta, average="macro", zero_division=0)
        if s > melhor[0]:
            melhor = (s, pesos)
    return melhor[1], melhor[0]


def metricas(y, proba, pesos=(1, 1, 1, 1)):
    """Métricas de ranking (não dependem de limiar) + métricas da decisão final."""
    pred = decidir(proba, pesos)
    atraso30 = np.asarray(y) >= 2
    p30 = proba[:, 2] + proba[:, 3]
    return {
        "log_loss": log_loss(y, proba, labels=range(len(FAIXAS))),
        "ROC-AUC macro (4 faixas)": roc_auc_score(y, proba, multi_class="ovr", average="macro"),
        "ROC-AUC atraso>30": roc_auc_score(atraso30, p30),
        "PR-AUC atraso>30": average_precision_score(atraso30, p30),
        "F2 macro": fbeta_score(y, pred, beta=2, average="macro", zero_division=0),
        "recall atraso>30": (pred[atraso30] >= 2).mean(),
        "precisão atraso>30": atraso30[pred >= 2].mean() if (pred >= 2).any() else np.nan,
        "erro de no máx. 1 faixa": (np.abs(pred - np.asarray(y)) <= 1).mean(),
    }


def tabela_por_faixa(y, pred):
    p, r, f, s = precision_recall_fscore_support(y, pred, labels=range(len(FAIXAS)), zero_division=0)
    return pd.DataFrame({"precisão": p, "recall": r, "F1": f, "voos": s}, index=FAIXAS)


def matriz_confusao(y, pred):
    """Linhas = faixa real, colunas = faixa prevista, em % da linha."""
    cm = confusion_matrix(y, pred, labels=range(len(FAIXAS)), normalize="true") * 100
    return pd.DataFrame(cm, index=[f"real {f}" for f in FAIXAS], columns=[f"prev {f}" for f in FAIXAS])
