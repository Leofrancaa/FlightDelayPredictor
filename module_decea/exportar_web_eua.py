"""Modelo dos EUA (BTS + METAR + matrícula do avião) e JSON do site em web/public/data/eua/.

Mesmo alvo e mesmos horizontes do Brasil (atraso de partida > 30 min, na véspera, 3 h e 1 h antes), nos 10 maiores
aeroportos dos EUA. Diferenças em relação ao Brasil, todas porque a BTS tem mais informação:
    - voo de chegada pela matrícula (o voo anterior do mesmo avião) e a cadeia do avião no dia;
    - causa de cada atraso (informada depois do voo): usada só para medir o recall por causa no teste.
Treino 2022, validação 2023 (limiar do alerta), teste 2024. Também treina, no horizonte de 1 h, a versão sem
matrícula (como no Brasil) para mostrar quanto a matrícula vale.

    uv run python -m module_decea.exportar_web_eua    # precisa de data/raw/bts/BTS_*.parquet e data/raw/metar_eua/
"""

import argparse
from datetime import UTC, datetime
import gc
import json
from pathlib import Path

import airportsdata
import numpy as np
import pandas as pd
from sklearn.inspection import permutation_importance
from sklearn.metrics import average_precision_score, log_loss

from module_decea import experimento_bts as B
from module_decea import modelagem as M
from module_decea.config import PROJ_ROOT, RAW_DATA_DIR, REPORTS_DIR
from module_decea.exportar_web import _mensal, _r, _taxa
from module_decea.metar import carregar_iem

SAIDA = PROJ_ROOT / "web" / "public" / "data" / "eua"
INICIO_DEMO = __import__("os").environ.get(
    "BTS_DEMO", "2024-12-15"
)  # voos mostrados no painel de partidas (as festas de fim de ano)
HORIZ = {"h1": (1, "1 h antes"), "h3": (3, "3 h antes"), "vespera": (None, "Véspera")}
CLIMA = [
    "vis_m",
    "teto_ft",
    "vento_kt",
    "rajada_kt",
    "imc",
    "abaixo_minimos",
    "trovoada",
    "nevoeiro",
    "chuva",
    "spread",
    "qnh",
]
TEND = ["vis_m", "teto_ft", "vento_kt", "spread", "qnh"]
EMPRESAS = {
    "AA": "American",
    "AS": "Alaska",
    "B6": "JetBlue",
    "DL": "Delta",
    "F9": "Frontier",
    "G4": "Allegiant",
    "HA": "Hawaiian",
    "MQ": "Envoy (American Eagle)",
    "NK": "Spirit",
    "OH": "PSA (American Eagle)",
    "OO": "SkyWest",
    "UA": "United",
    "WN": "Southwest",
    "YX": "Republic",
    "9E": "Endeavor (Delta Connection)",
    "QX": "Horizon (Alaska)",
    "ZW": "Air Wisconsin",
    "C5": "CommuteAir",
    "G7": "GoJet",
    "PT": "Piedmont",
}
DESCRICOES = {
    "chegada_atraso_conhecido": "Atraso do voo anterior do avião",
    "chegada_atraso_chegada": "Atraso de chegada do avião",
    "chegada_folga": "Folga entre chegada e partida",
    "chegada_giro_min": "Tempo de solo programado",
    "chegada_ainda_nao_partiu": "Avião ainda não saiu da origem anterior",
    "chegada_cancelada": "Voo anterior do avião cancelado",
    "aviao_atraso_2_voos_antes": "Atraso do avião 2 voos antes",
    "aviao_voos_antes_no_dia": "Voos que o avião já fez no dia",
    "recente_origem": "Atraso recente na origem",
    "recente_cia_origem": "Atraso recente da cia na origem",
    "recente_cia_rede": "Atraso recente da cia na rede",
    "hist_rota_cia": "Histórico da rota e companhia",
    "voo_7dias": "Atraso do voo (7 dias)",
    "ontem_origem": "Atraso na origem no dia anterior",
    "ontem_rede": "Atraso na rede no dia anterior",
    "ontem_trovoada": "Trovoada na origem no dia anterior",
    "hora": "Hora da partida",
    "empresa": "Companhia",
    "origem": "Aeroporto de origem",
    "destino": "Aeroporto de destino",
    "partidas_hora_origem": "Partidas na hora",
    "partidas_hora_cia": "Partidas da cia na hora",
    "mes": "Mês",
    "dia_semana": "Dia da semana",
    "distancia": "Distância",
    "duracao_prev": "Duração prevista",
}
NOME_CLIMA = {
    "vis_m": "Visibilidade", "teto_ft": "Teto de nuvens", "vento_kt": "Vento", "rajada_kt": "Rajada", "imc": "IMC",
    "abaixo_minimos": "Abaixo dos mínimos", "trovoada": "Trovoada", "nevoeiro": "Nevoeiro", "chuva": "Chuva",
    "spread": "Temperatura − orvalho", "qnh": "Pressão",
}
for c, n in NOME_CLIMA.items():
    DESCRICOES[f"o_{c}"] = f"{n} na origem"
    DESCRICOES[f"d_{c}"] = f"{n} no destino"
    DESCRICOES[f"o_{c}_var3h"] = f"{n} na origem: variação em 3 h"
log = B.log


def _grupo(col):
    if col.startswith(("chegada", "aviao", "recente")):
        return "propagação"
    if col.startswith(("o_", "d_", "ontem_trovoada")):
        return "clima"
    if col.startswith(("hist", "voo_7", "ontem")):
        return "histórico"
    return "programação"


def carregar_metar(pasta=RAW_DATA_DIR / "metar_eua"):
    """METAR horário dos 10 aeroportos. Nos EUA o boletim de rotina sai às hh:51–53: conta como o da hora seguinte."""
    m = pd.concat([carregar_iem(f) for f in sorted(Path(pasta).glob("*.csv"))], ignore_index=True)
    minuto = m["hora_utc"].dt.minute
    m = m[(minuto >= 45) | (minuto == 0)].copy()
    m["hora_utc"] = m["hora_utc"].dt.ceil("h")
    m = m.sort_values("hora_utc").drop_duplicates(["icao", "hora_utc"], keep="last")
    m["spread"] = m["temp_c"] - m["orvalho_c"]
    m[CLIMA] = m[CLIMA].astype(float)
    m.loc[m["vento_kt"].notna() & m["rajada_kt"].isna(), "rajada_kt"] = 0
    m.loc[~m["qnh"].between(950, 1060), "qnh"] = np.nan
    m["icao"] = m["icao"].str[-3:]  # KATL -> ATL, o código da BTS
    return m.set_index(["icao", "hora_utc"])[CLIMA].sort_index()


def clima_no_instante(v, metar, h):
    """METAR da origem (e do destino, se for um dos 10) na hora cheia de (partida - h) e a variação em 3 h."""
    ref = (v["dep_utc"] - pd.Timedelta(hours=h)).dt.floor("h")
    out = pd.DataFrame(index=v.index)
    for lado, chave, cols in [("o", "Origin", CLIMA), ("d", "Dest", CLIMA[:9])]:
        agora = metar.reindex(pd.MultiIndex.from_arrays([v[chave].astype(str), ref]))
        for c in cols:
            out[f"{lado}_{c}"] = agora[c].to_numpy()
        if lado == "o":
            antes = metar.reindex(pd.MultiIndex.from_arrays([v[chave].astype(str), ref - pd.Timedelta(hours=3)]))
            for c in TEND:
                out[f"o_{c}_var3h"] = agora[c].to_numpy() - antes[c].to_numpy()
    return out


def dia_anterior(v, metar, fusos):
    """O que se sabe na véspera: atraso no dia anterior (origem e rede) e se houve trovoada na origem."""
    out = pd.DataFrame(index=v.index)
    r = v[v["realizado"]]
    dia = v["dep_local"].dt.normalize()
    for nome, chave in [("origem", ["Origin"]), ("rede", [])]:
        g = r.assign(dia=dia[r.index] + pd.Timedelta(days=1)).groupby([*chave, "dia"], observed=True)["atr30"].mean()
        g = g.rename("t").reset_index()
        esq = v[chave].assign(dia=dia) if chave else pd.DataFrame({"dia": dia})
        out[f"ontem_{nome}"] = esq.merge(g, on=[*chave, "dia"], how="left")["t"].to_numpy()
    t = metar["trovoada"].reset_index()
    t["dia"] = pd.NaT
    for ap in t["icao"].unique():
        i = t["icao"] == ap
        tz = fusos.get(ap, {}).get("tz", "UTC")
        t.loc[i, "dia"] = (
            t.loc[i, "hora_utc"].dt.tz_localize("UTC").dt.tz_convert(tz).dt.tz_localize(None).dt.normalize()
        )
    t["dia"] = pd.to_datetime(t["dia"]) + pd.Timedelta(days=1)
    t = t.groupby(["icao", "dia"])["trovoada"].max().rename("tr").reset_index()
    j = pd.DataFrame({"icao": v["Origin"].astype(str), "dia": dia}).merge(t, on=["icao", "dia"], how="left")
    out["ontem_trovoada"] = j["tr"].to_numpy()
    return out


def _float32(X):
    for c in X.columns:
        if X[c].dtype.kind in "fib":
            X[c] = X[c].astype("float32")
    return X


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pasta", default=str(RAW_DATA_DIR / "bts"))
    ap.add_argument("--metar", default=str(RAW_DATA_DIR / "metar_eua"))
    a = ap.parse_args()
    fusos = airportsdata.load("IATA")

    todos = B.carregar(a.pasta)
    metar = carregar_metar(a.metar)
    log(f"BTS: {len(todos):,} voos | METAR: {len(metar):,} horas")
    v = todos[todos["Origin"].isin(B.AEROPORTOS)]
    prog = pd.concat([B.programacao(v), B.historico(v)], axis=1)
    ok = v["realizado"].to_numpy()
    ano = v["dep_local"].dt.year.to_numpy()[ok]
    y = v["atr30"].astype(int)[ok].reset_index(drop=True)
    tr0, val, tr, te = ano == 2022, ano == 2023, ano <= 2023, ano == 2024
    vo = v[ok].reset_index(drop=True)
    causas = vo[list(B.CAUSAS)].fillna(0)
    causa_ok, causa_dom = (causas.sum(axis=1) > 0).to_numpy(), causas.idxmax(axis=1).to_numpy()
    log(f"partidas realizadas: {ok.sum():,} | atraso > 30 no teste: {y[te].mean():.2%}")

    resumo = {
        "gerado_em": datetime.now(UTC).isoformat(timespec="seconds"),
        "pais": "eua",
        "alvo": "partida com atraso > 30 min",
        "desde": 2022,
        "periodos": {"treino": "2022", "validacao": "2023", "teste": "2024"},
        "periodos_anomalos": [],
        "horizontes": {k: n for k, (_, n) in HORIZ.items()},
        "hiperparametros": {k: v_ for k, v_ in B.PARAMS.items()},
        "busca": [],
        "n": {"treino": int(tr0.sum()), "validacao": int(val.sum()), "teste": int(te.sum())},
        "modelos": {},
        "mensal": {},
        "janelas": [],
        "causas": {
            c: {"descricao": d, "parcela": _r((causa_dom[te & (y.to_numpy() == 1) & causa_ok] == c).mean())}
            for c, d in B.CAUSAS.items()
        },
    }
    demo = {}
    na_demo = (vo.loc[te, "dep_local"] >= INICIO_DEMO).to_numpy()

    def treinar(X, nome):
        X = _float32(X.loc[:, X[tr0].notna().any().to_numpy()])
        p_val = M.hgb(**B.PARAMS).fit(X[tr0], y[tr0]).predict_proba(X[val])
        limiar, _ = M.ajustar_limiar(p_val, y[val])
        modelo = M.hgb(**B.PARAMS).fit(X[tr], y[tr])
        p = modelo.predict_proba(X[te])
        log(f"{nome}: limiar {limiar} | PR-AUC {average_precision_score(y[te], p[:, 1]):.4f}")
        return X, modelo, p, limiar

    def recall_causa(p, limiar):
        alerta = M.decidir(p, limiar).astype(bool)
        yt = y[te].to_numpy() == 1
        out = {}
        for c in B.CAUSAS:
            sel = yt & causa_ok[te] & (causa_dom[te] == c)
            out[c] = _r(alerta[sel].mean()) if sel.any() else None
        return out

    for k, (h, nome) in HORIZ.items():
        if h is None:
            # Na véspera só entra o que se sabe no dia anterior. Nada que dependa da matrícula: a BTS registra o avião
            # que de fato voou, e uma troca de avião por causa de atraso vazaria para a variável.
            extra = [dia_anterior(v, metar, fusos)]
        else:
            extra = [
                B.recente(v, todos, h=h),
                B.chegada_com_matricula(v, todos, extras=True, h=h),
                clima_no_instante(v, metar, h),
            ]
        X = pd.concat([prog, *extra], axis=1)[ok].reset_index(drop=True)
        del extra
        X, modelo, p, limiar = treinar(X, nome)
        yt = y[te].to_numpy()
        cm = M.matriz_confusao(yt, M.decidir(p, limiar))
        resumo["modelos"][k] = {
            "nome": nome,
            "limiar": limiar,
            **{m: _r(x) for m, x in M.metricas(yt, p, limiar).items()},
            "pontos_operacao": [{c: _r(x) for c, x in d.items()} for d in M.pontos_operacao(yt, p)],
            "confusao": [[_r(x, 2) for x in linha] for linha in cm.values],
            "recall_por_causa": recall_causa(p, limiar),
        }
        info_te = pd.DataFrame({"partida_prev": vo.loc[te, "dep_local"].to_numpy()})
        resumo["mensal"][k] = _mensal(info_te, yt, p, limiar)
        log(f"{nome}: {resumo['modelos'][k]['precisão']} precisão | {resumo['modelos'][k]['recall']} recall")
        demo[k] = {"p": np.rint(p[na_demo, 1] * 100).astype(int), "alerta": M.decidir(p[na_demo], limiar)}

        if k == "h1":
            prior = np.tile([1 - y[tr].mean(), y[tr].mean()], (len(yt), 1))
            resumo["chute"] = {m: _r(x) for m, x in M.metricas(yt, prior, 0.5).items()}
            # Sem matrícula (como no Brasil), mesmo clima e mesmo resto
            Xs = pd.concat(
                [
                    prog,
                    B.recente(v, todos, h=1),
                    B.chegada_sem_matricula(v, todos, h=1),
                    clima_no_instante(v, metar, 1),
                ],
                axis=1,
            )
            Xs, _, ps, ls = treinar(Xs[ok].reset_index(drop=True), "1 h, sem matrícula")
            resumo["matricula"] = {
                "sem": {
                    "limiar": ls,
                    **{m: _r(x) for m, x in M.metricas(yt, ps, ls).items()},
                    "recall_por_causa": recall_causa(ps, ls),
                },
                "com": {
                    key: resumo["modelos"]["h1"][key]
                    for key in [
                        "limiar",
                        "PR-AUC",
                        "ROC-AUC",
                        "log_loss",
                        "precisão",
                        "recall",
                        "F1",
                        "recall_por_causa",
                    ]
                },
            }
            del Xs, ps
            # Quanto histórico (mesmo teste)
            p23 = M.hgb(**B.PARAMS).fit(X[val], y[val]).predict_proba(X[te])
            for nome_j, pj, n in [("2022–2023", p, int(tr.sum())), ("só 2023", p23, int(val.sum()))]:
                resumo["janelas"].append(
                    {
                        "janela": nome_j,
                        "voos_treino": n,
                        "pr_auc": _r(average_precision_score(yt, pj[:, 1])),
                        "log_loss": _r(log_loss(yt, pj)),
                    }
                )
            idx = np.random.default_rng(1).choice(np.flatnonzero(te), 20_000, replace=False)
            imp = permutation_importance(
                modelo, X.iloc[idx], y.iloc[idx], scoring="neg_log_loss", n_repeats=2, random_state=0
            )
            imp = pd.Series(imp.importances_mean, index=X.columns).sort_values(ascending=False).head(20)
            resumo["importancia"] = [
                {"variavel": c, "descricao": DESCRICOES.get(c, c), "grupo": _grupo(c), "valor": _r(x, 5)}
                for c, x in imp.items()
            ]
            d = pd.DataFrame(
                {
                    "atr": y.to_numpy(),
                    "hora": vo["dep_local"].dt.hour,
                    "mes": vo["dep_local"].dt.month,
                    "ano": ano,
                    "dia_semana": vo["dep_local"].dt.dayofweek,
                    "origem": vo["Origin"].astype(str),
                    "empresa": vo["Reporting_Airline"].astype(str),
                }
            )
            condicoes = {
                "Todas as partidas": np.ones(len(d), bool),
                "IMC na origem": X["o_imc"].eq(1).to_numpy(),
                "Chuva na origem": X["o_chuva"].eq(1).to_numpy(),
                "Rajada ≥ 25 kt": X["o_rajada_kt"].ge(25).to_numpy(),
                "Trovoada na origem": X["o_trovoada"].eq(1).to_numpy(),
                "Abaixo dos mínimos": X["o_abaixo_minimos"].eq(1).to_numpy(),
                "Voo anterior do avião saiu > 30 min atrasado": X["chegada_atraso_conhecido"].gt(30).to_numpy(),
            }
            resumo["eda"] = {
                "por_hora": _taxa(d, "hora"),
                "por_aeroporto": _taxa(d, "origem"),
                "por_empresa": _taxa(d.assign(empresa=d["empresa"].map(lambda e: EMPRESAS.get(e, e))), "empresa"),
                "por_mes": _taxa(d, "mes"),
                "por_dia_semana": _taxa(d, "dia_semana"),
                "por_ano": _taxa(d, "ano"),
                "clima": [
                    {"chave": n, "taxa30": _r(d.loc[m, "atr"].mean()), "voos": int(m.sum())}
                    for n, m in condicoes.items()
                ],
            }
            demo["ctx"] = X[te].reset_index(drop=True)[na_demo].reset_index(drop=True)
        del X, modelo, p
        gc.collect()

    gravar(
        resumo, demo, vo[te].reset_index(drop=True)[na_demo].reset_index(drop=True), y[te].to_numpy()[na_demo], fusos
    )
    log(f"pronto: {SAIDA}")


def gravar(resumo, demo, it, yd, fusos):
    SAIDA.mkdir(parents=True, exist_ok=True)
    (SAIDA / "voos").mkdir(exist_ok=True)
    for f in (SAIDA / "voos").glob("*.json"):
        f.unlink()
    (SAIDA / "resumo.json").write_text(json.dumps(resumo, ensure_ascii=False, allow_nan=False), encoding="utf-8")
    (REPORTS_DIR / "eua").mkdir(parents=True, exist_ok=True)
    (REPORTS_DIR / "eua" / "resumo.json").write_text(json.dumps(resumo, ensure_ascii=False, indent=2), encoding="utf-8")
    xt = demo["ctx"]
    ctx = {
        "trov": "o_trovoada",
        "raj": "o_rajada_kt",
        "vis": "o_vis_m",
        "teto": "o_teto_ft",
        "rec": "recente_origem",
        "cia": "recente_cia_origem",
        "chg": "chegada_atraso_conhecido",
        "chgp": "chegada_ainda_nao_partiu",
        "hist": "hist_rota_cia",
        "v7": "voo_7dias",
    }
    dias = it["dep_local"].dt.strftime("%Y-%m-%d").to_numpy()
    num = it["Flight_Number_Reporting_Airline"].astype("Int64").astype(str).to_numpy()
    aps = set()
    for dia in sorted(set(dias)):
        lista = []
        for i in np.flatnonzero(dias == dia):
            o, de = str(it.at[i, "Origin"]), str(it.at[i, "Dest"])
            aps |= {o, de}
            lista.append(
                {
                    "e": str(it.at[i, "Reporting_Airline"]),
                    "n": num[i],
                    "o": o,
                    "d": de,
                    "h": it.at[i, "dep_local"].strftime("%H:%M"),
                    "a": int(np.rint(it.at[i, "DepDelay"])),
                    "f": int(yd[i]),
                    **{f"p{s}": int(demo[k]["p"][i]) for s, k in [("v", "vespera"), ("3", "h3"), ("1", "h1")]},
                    **{f"f{s}": int(demo[k]["alerta"][i]) for s, k in [("v", "vespera"), ("3", "h3"), ("1", "h1")]},
                    "c": {c: _r(xt.at[i, col], 3) if col in xt else None for c, col in ctx.items()},
                }
            )
        lista.sort(key=lambda x: x["h"])
        (SAIDA / "voos" / f"{dia}.json").write_text(
            json.dumps(lista, ensure_ascii=False, separators=(",", ":"), allow_nan=False), encoding="utf-8"
        )
    cidade = lambda c: (fusos.get(c) or {}).get("city") or c
    indice = {
        "datas": sorted(set(dias)),
        "empresas": {e: [EMPRESAS.get(e, e), e] for e in sorted(set(it["Reporting_Airline"].astype(str)))},
        "aeroportos": {c: cidade(c) for c in sorted(aps)},
        "coordenadas": {c: [round(fusos[c]["lat"], 3), round(fusos[c]["lon"], 3)] for c in sorted(aps) if c in fusos},
        "limiares": {k: m["limiar"] for k, m in resumo["modelos"].items()},
    }
    (SAIDA / "indice.json").write_text(json.dumps(indice, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
