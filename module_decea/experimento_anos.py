"""Experimento: quanto histórico de treino vale a pena? (precisa de ~20 GB de RAM com 2011–2025)

Uso (na raiz do projeto):
    uv run python -m module_decea.experimento_anos            # experimento completo (horizonte 1 h)
    uv run python -m module_decea.experimento_anos --rapido   # teste rápido do código (modelos pequenos)

O que faz:
    1. Baixa da Release "dados-vra" do GitHub os zips de METAR que faltarem em data/raw/metar/.
       (O VRA precisa estar em data/raw/vra/: zips anuais VRA_2011.zip ... e/ou CSVs mensais.)
    2. Monta as features de 2011 a 2025 de uma vez. Cada voo só usa o próprio passado.
    3. Parte A, divisão por anos inteiros: valida em 2023 (hiperparâmetros e pesos do alerta) e testa em
       2024–2025. Compara treinar desde 2011, desde 2016 e só no ano anterior. Métricas mês a mês.
    4. Parte B, comparação com o modelo do site: testa em out–dez/2025 treinando até set/2025, desde 2011,
       desde 2016 e só jan–set/2025.

Resultados em reports/experimento_anos/ (JSON + CSV mensal) e no terminal.
"""

import argparse
import json
from pathlib import Path
import time
import urllib.request
import zipfile

import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, log_loss

from module_decea import features as F
from module_decea import modelagem as M
from module_decea.config import RAW_DATA_DIR, REPORTS_DIR

RELEASE = "https://github.com/Leofrancaa/FlightDelayPredictor/releases/download/dados-vra"
SAIDA = REPORTS_DIR / "experimento_anos"


def baixar_metar(anos):
    """Baixa e extrai os zips de METAR (um por ano) que ainda não estão em data/raw/metar/."""
    pasta = RAW_DATA_DIR / "metar"
    pasta.mkdir(parents=True, exist_ok=True)
    for ano in anos:
        if any(pasta.glob(f"*_{ano}.csv")) or (ano == 2025 and (pasta / "SBGR.csv").exists()):
            continue
        destino = pasta / f"METAR_{ano}.zip"
        print(f"baixando METAR {ano}...", flush=True)
        urllib.request.urlretrieve(f"{RELEASE}/METAR_{ano}.zip", destino)
        with zipfile.ZipFile(destino) as z:
            for nome in z.namelist():
                if nome.endswith(".csv"):
                    (pasta / Path(nome).name).write_bytes(z.read(nome))
        destino.unlink()


def treinar_avaliar(X, y, tr, te, params, pesos):
    p = M.hgb(**params).fit(X[tr], y[tr]).predict_proba(X[te])
    return p, M.metricas(y[te].to_numpy(), p, pesos)


def _limpo(d):
    return {k: (round(float(v), 4) if isinstance(v, (int, float, np.floating)) else v) for k, v in d.items()}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--rapido", action="store_true", help="modelos pequenos, só para testar o código")
    ap.add_argument("--horizonte", default="1h", choices=list(F.HORIZONTES))
    ap.add_argument("--desde", type=int, default=2011, help="primeiro ano carregado (padrão 2011)")
    a = ap.parse_args()
    SAIDA.mkdir(parents=True, exist_ok=True)
    t0 = time.time()

    inicios = sorted({a.desde, max(a.desde, 2016)})  # janelas de treino comparadas
    baixar_metar(range(a.desde, 2026))
    base = F.carregar_vra_rede(range(a.desde, 2026))
    v, c = F.carregar_voos(vra=base), F.carregar_chegadas(vra=base)
    del base
    metar = F.carregar_metar_horario()
    print(f"dados: {len(v):,} voos | {time.time() - t0:.0f}s", flush=True)
    X, y, info = F.montar(a.horizonte, v, metar, c)
    del v, c, metar
    print(f"features {a.horizonte}: {X.shape} | {time.time() - t0:.0f}s", flush=True)

    data = info["partida_prev"]
    ano = data.dt.year.to_numpy()
    LIVRE = {"max_leaf_nodes": 31, "min_samples_leaf": 100, "l2_regularization": 1.0}
    REG = {"max_leaf_nodes": 15, "min_samples_leaf": 1000, "l2_regularization": 5.0, "max_features": 0.5}
    if a.rapido:
        grade = [{"learning_rate": 0.2, "max_iter": 20} | REG]
    else:
        grade = [{"learning_rate": 0.05, "max_iter": it} | fam for it in (150, 400) for fam in (LIVRE, REG)]
    resultado = {"horizonte": a.horizonte, "voos": len(y), "parte_A": {}, "parte_B": {}}

    # ---------------- Parte A: validação 2023, teste 2024–2025 ----------------
    val, teste = ano == 2023, ano >= 2024
    yt = y[teste].to_numpy()
    mensal = data[teste].reset_index(drop=True)
    meses = mensal.dt.year * 100 + mensal.dt.month
    tabela_mensal = pd.DataFrame({"ano_mes": sorted(meses.unique())})
    for inicio in inicios:
        tr_val = (ano >= inicio) & (ano <= 2022)
        perdas = []
        for g in grade:
            p = M.hgb(**g).fit(X[tr_val], y[tr_val]).predict_proba(X[val])
            perdas.append((log_loss(y[val], p, labels=range(len(F.FAIXAS))), g, p))
            print(f"  [A desde {inicio}] {g} -> log loss 2023 = {perdas[-1][0]:.4f}", flush=True)
        perdas.sort(key=lambda t: t[0])
        params, p_val = perdas[0][1], perdas[0][2]
        pesos, _ = M.ajustar_pesos(p_val, y[val].to_numpy())
        tr = (ano >= inicio) & (ano <= 2023)
        p, r = treinar_avaliar(X, y, tr, teste, params, pesos)
        pf = M.tabela_por_faixa(yt, M.decidir(p, pesos))
        resultado["parte_A"][f"desde {inicio}"] = {
            "voos_treino": int(tr.sum()),
            "params": params,
            "pesos": list(pesos),
            **_limpo(r),
            "por_faixa": pf.round(4).reset_index(names="faixa").to_dict("records"),
        }
        pred, atr = M.decidir(p, pesos), yt >= 1
        tabela_mensal[f"PR-AUC desde {inicio}"] = [
            average_precision_score(atr[(meses == m).to_numpy()], p[(meses == m).to_numpy(), 1:].sum(1))
            for m in tabela_mensal["ano_mes"]
        ]
        tabela_mensal[f"precisão desde {inicio}"] = [
            atr[(meses == m).to_numpy() & (pred >= 1)].mean() for m in tabela_mensal["ano_mes"]
        ]
        tabela_mensal[f"recall desde {inicio}"] = [
            (pred[(meses == m).to_numpy() & atr] >= 1).mean() for m in tabela_mensal["ano_mes"]
        ]
        print(f"A desde {inicio}: {_limpo(r)} | {time.time() - t0:.0f}s", flush=True)
        print(pf.round(3).to_string(), flush=True)

    # referência: treinar só no ano anterior ao teste (2023), com os parâmetros do último início
    p23, r23 = treinar_avaliar(X, y, val, teste, params, pesos)
    resultado["parte_A"]["só 2023"] = {"voos_treino": int(val.sum()), **_limpo(r23)}
    tabela_mensal["PR-AUC só 2023"] = [
        average_precision_score((yt >= 1)[(meses == m).to_numpy()], p23[(meses == m).to_numpy(), 1:].sum(1))
        for m in tabela_mensal["ano_mes"]
    ]
    tabela_mensal["% atraso>30"] = [(yt >= 1)[(meses == m).to_numpy()].mean() for m in tabela_mensal["ano_mes"]]
    print(tabela_mensal.round(3).to_string(index=False), flush=True)
    tabela_mensal.round(4).to_csv(SAIDA / f"mensal_{a.horizonte}.csv", index=False)

    # ---------------- Parte B: teste out–dez/2025 (mesmo período do site) ----------------
    teste_b = (data >= "2025-10-01").to_numpy()
    cal = ((data >= "2025-09-01") & (data < "2025-10-01")).to_numpy()
    ate_ago, ate_set = (data < "2025-09-01").to_numpy(), (data < "2025-10-01").to_numpy()
    params_b = resultado["parte_A"][f"desde {inicios[0]}"]["params"]
    for nome, inicio in [(f"desde {i}", i) for i in inicios] + [("só jan–set/2025", 2025)]:
        janela = ano >= inicio
        pc = M.hgb(**params_b).fit(X[janela & ate_ago], y[janela & ate_ago]).predict_proba(X[cal])
        pesos_b, _ = M.ajustar_pesos(pc, y[cal].to_numpy())
        p, r = treinar_avaliar(X, y, janela & ate_set, teste_b, params_b, pesos_b)
        pf = M.tabela_por_faixa(y[teste_b].to_numpy(), M.decidir(p, pesos_b))
        resultado["parte_B"][nome] = {
            "voos_treino": int((janela & ate_set).sum()),
            "pesos": list(pesos_b),
            **_limpo(r),
            "por_faixa": pf.round(4).reset_index(names="faixa").to_dict("records"),
        }
        print(f"B {nome}: {_limpo(r)} | {time.time() - t0:.0f}s", flush=True)

    (SAIDA / f"resultado_{a.horizonte}.json").write_text(
        json.dumps(resultado, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"pronto em {time.time() - t0:.0f}s. Resultados em {SAIDA}", flush=True)


if __name__ == "__main__":
    main()
