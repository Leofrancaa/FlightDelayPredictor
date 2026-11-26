"""Grid search dos hiperparâmetros do HistGradientBoosting, por horizonte (EUA, atraso de partida > 30 min).

Mesmo protocolo do modelo do site, sem tocar no teste para escolher:
    - cada combinação treina em 2022 e é avaliada em 2023 (validação);
    - o nº de árvores não entra na grade: cada combinação vai até MAX_ITER e é avaliada em vários pontos
      (staged_predict_proba), de graça;
    - critério de escolha: PR-AUC na validação (qualidade da curva precisão × recall inteira, sem depender de limiar).
No fim, a melhor combinação e a atual (B.PARAMS) seguem o caminho do site: limiar de F1 máximo em 2023, retreino em
2022–2023 e uma única avaliação em 2024. Salva reports/busca/<horizonte>.json a cada combinação (resultado parcial
não se perde se o job estourar o tempo).

    uv run python -m module_decea.busca_eua --horizonte h1
"""

import argparse
import gc
from itertools import product
import json
import os

import airportsdata
import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, log_loss, precision_recall_curve

from module_decea import experimento_bts as B
from module_decea import exportar_web_eua as E
from module_decea import modelagem as M
from module_decea.config import RAW_DATA_DIR, REPORTS_DIR

MAX_ITER = int(os.environ.get("BUSCA_MAX_ITER", "1000"))
PONTOS = [n for n in (100, 200, 300, 400, 600, 800, 1000, 1500) if n <= MAX_ITER]
GRADE = {
    "learning_rate": [0.1],
    "max_leaf_nodes": [31, 63, 127, 255],
    "min_samples_leaf": [100, 1000],
    "max_features": [1.0, 0.5],
    "l2_regularization": [1.0],
}
ATUAL = B.PARAMS | {"max_features": 1.0}
SAIDA = REPORTS_DIR / "busca"
log = B.log


def combinacoes():
    """Configuração atual (lr 0,05, até MAX_ITER árvores) + a grade."""
    yield {k: v for k, v in ATUAL.items() if k != "max_iter"}
    chaves = list(GRADE)
    for valores in product(*GRADE.values()):
        yield dict(zip(chaves, valores))


def avaliar(y, p):
    """Métricas de validação sem limiar fixo: PR-AUC, log loss, F1 máximo e precisão com recall ≥ 50%."""
    prec, rec, lim = precision_recall_curve(y, p)
    prec, rec = prec[:-1], rec[:-1]
    f1 = np.divide(2 * prec * rec, prec + rec, out=np.zeros_like(prec), where=(prec + rec) > 0)
    k = int(np.argmax(f1))
    ok = np.flatnonzero(rec >= 0.5)
    return {
        "PR-AUC": float(average_precision_score(y, p)),
        "log_loss": float(log_loss(y, np.c_[1 - p, p], labels=[0, 1])),
        "F1_max": float(f1[k]),
        "precisao_F1": float(prec[k]),
        "recall_F1": float(rec[k]),
        "limiar_F1": float(lim[k]),
        "precisao_recall50": float(prec[ok].max()) if ok.size else None,
    }


def no_teste(X, y, tr0, val, tr, te, params):
    """Caminho do site: treino 2022 → limiar em 2023 → retreino 2022–2023 → teste 2024."""
    p_val = M.hgb(**params).fit(X[tr0], y[tr0]).predict_proba(X[val])
    limiar, _ = M.ajustar_limiar(p_val, y[val])
    p = M.hgb(**params).fit(X[tr], y[tr]).predict_proba(X[te])
    yt = y[te].to_numpy()
    return {
        "params": params,
        "limiar": limiar,
        **{k: float(v) for k, v in M.metricas(yt, p, limiar).items()},
        "pontos_operacao": M.pontos_operacao(yt, p),
    }


def _py(x):
    return x.item() if hasattr(x, "item") else x


def gravar(horizonte, out):
    SAIDA.mkdir(parents=True, exist_ok=True)
    (SAIDA / f"{horizonte}.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2, default=_py), encoding="utf-8"
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--horizonte", choices=list(E.HORIZ), required=True)
    ap.add_argument("--pasta", default=str(RAW_DATA_DIR / "bts"))
    ap.add_argument("--metar", default=str(RAW_DATA_DIR / "metar_eua"))
    ap.add_argument("--sem-teste", action="store_true", help="só a grade, sem o retreino e a avaliação em 2024")
    a = ap.parse_args()
    h, nome = E.HORIZ[a.horizonte]
    fusos = airportsdata.load("IATA")

    todos = B.carregar(a.pasta)
    metar = E.carregar_metar(a.metar)
    v = todos[todos["Origin"].isin(B.AEROPORTOS)]
    ok = v["realizado"].to_numpy()
    ano = v["dep_local"].dt.year.to_numpy()[ok]
    y = v["atr30"].astype(int)[ok].reset_index(drop=True)
    tr0, val, tr, te = ano == 2022, ano == 2023, ano <= 2023, ano == 2024
    X = pd.concat([B.programacao(v), B.historico(v), *E.variaveis_horizonte(v, todos, metar, fusos, h)], axis=1)[
        ok
    ].reset_index(drop=True)
    del todos, metar, v
    gc.collect()
    X = E._float32(X.loc[:, X[tr0].notna().any().to_numpy()])
    log(f"{nome}: {X.shape[1]} variáveis | treino {tr0.sum():,} | validação {val.sum():,} | teste {te.sum():,}")

    Xtr, ytr, Xva, yva = X[tr0], y[tr0], X[val], y[val].to_numpy()
    out = {"horizonte": a.horizonte, "nome": nome, "max_iter": MAX_ITER, "grade": GRADE, "linhas": []}
    for i, params in enumerate(combinacoes()):
        modelo = M.hgb(**params, max_iter=MAX_ITER).fit(Xtr, ytr)
        for n, p in enumerate(modelo.staged_predict_proba(Xva), start=1):
            if n in PONTOS:
                out["linhas"].append({**params, "max_iter": n, **avaliar(yva, p[:, 1])})
        ult = out["linhas"][-1]
        log(f"[{i}] {params} | PR-AUC {ult['PR-AUC']:.4f} @ {MAX_ITER} | F1 {ult['F1_max']:.4f}")
        gravar(a.horizonte, out)
        del modelo
        gc.collect()

    grade = pd.DataFrame(out["linhas"]).sort_values("PR-AUC", ascending=False)
    melhor = {k: _py(x) for k, x in grade.iloc[0].items()}
    params = {k: melhor[k] for k in [*GRADE, "max_iter"]}
    for k in ("max_iter", "max_leaf_nodes", "min_samples_leaf"):
        params[k] = int(params[k])
    eh_atual = np.logical_and.reduce([grade[k] == ATUAL[k] for k in [*GRADE, "max_iter"]])
    out["melhor"] = {"params": params, **{k: x for k, x in melhor.items() if k not in params}}
    out["atual_validacao"] = {k: _py(x) for k, x in grade[eh_atual].iloc[0].items()} if eh_atual.any() else None
    log(f"melhor na validação: {params} | PR-AUC {melhor['PR-AUC']:.4f}")
    gravar(a.horizonte, out)

    if not a.sem_teste:
        out["teste"] = {
            "atual": no_teste(X, y, tr0, val, tr, te, ATUAL),
            "melhor": no_teste(X, y, tr0, val, tr, te, params),
        }
        for k, r in out["teste"].items():
            log(f"teste 2024 {k}: PR-AUC {r['PR-AUC']:.4f} | precisão {r['precisão']:.3f} | recall {r['recall']:.3f}")
        gravar(a.horizonte, out)
    log("pronto")


if __name__ == "__main__":
    main()
