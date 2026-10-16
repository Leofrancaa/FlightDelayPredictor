"""Experimento com a BTS (EUA): quanto vale saber qual avião faz cada voo (matrícula)?

O VRA da ANAC não tem a matrícula, então o voo que traz o avião é adivinhado (mesma companhia e modelo chegando
na origem). A BTS tem a matrícula (Tail_Number) e a causa de cada atraso. O experimento treina o mesmo tipo de modelo
(atraso de partida > 30 min, 1 h antes) nos 10 maiores aeroportos dos EUA em três versões que só mudam o voo de chegada:

    A  "como no Brasil": último voo da mesma companhia chegando na origem (a BTS não tem o modelo do avião)
    B  "com matrícula": o voo anterior do mesmo avião
    B+ matrícula + a cadeia do avião no dia (quantos voos já fez, atraso conhecido do voo de antes)

Divisão igual à do Brasil: treino 2022, validação 2023 (limiar do alerta), teste 2024. Sem METAR (igual nas três).
No teste, o recall é separado pela causa principal do atraso (companhia, clima, controle de tráfego, segurança,
avião atrasado), que a BTS informa depois do voo e que, por isso, não entra como variável.

    uv run python -m module_decea.experimento_bts --pasta data/raw/bts     # BTS_2022.parquet ... BTS_2024.parquet
"""

import argparse
import json
import os
from pathlib import Path
import time

import airportsdata
import numpy as np
import pandas as pd

from module_decea import modelagem as M

AEROPORTOS = ["ATL", "DFW", "DEN", "ORD", "LAX", "CLT", "LAS", "PHX", "MCO", "SEA"]
PARAMS = {
    "learning_rate": 0.05,
    "max_iter": int(os.environ.get("BTS_ITER", "400")),
    "max_leaf_nodes": 31,
    "min_samples_leaf": 100,
    "l2_regularization": 1.0,
}
H = 1  # horas antes da partida
CAUSAS = {
    "CarrierDelay": "companhia (manutenção, tripulação, embarque...)",
    "WeatherDelay": "clima extremo",
    "NASDelay": "controle de tráfego / aeroporto",
    "SecurityDelay": "segurança",
    "LateAircraftDelay": "avião chegou atrasado",
}
T0 = time.time()


def log(msg):
    print(f"[{time.time() - T0:6.0f}s] {msg}", flush=True)


def _minutos(s):
    return pd.to_timedelta(s.astype("float64"), unit="m")


def carregar(pasta, anos=(2022, 2023, 2024)):
    d = pd.concat([pd.read_parquet(Path(pasta) / f"BTS_{a}.parquet") for a in anos], ignore_index=True)
    d = d[d["CRSDepTime"].notna() & d["CRSElapsedTime"].notna()].copy()
    hhmm = d["CRSDepTime"].astype(str).str.zfill(4)
    dia = pd.to_datetime(d["FlightDate"])
    d["dep_local"] = dia + pd.to_timedelta(hhmm.str[:2].astype(int) * 60 + hhmm.str[2:].astype(int), unit="m")
    # Horários da BTS são locais de cada aeroporto: converte para UTC pelo fuso da origem
    fusos = airportsdata.load("IATA")
    d["dep_utc"] = pd.NaT
    for ap, idx in d.groupby("Origin", observed=True).groups.items():
        tz = fusos.get(ap, {}).get("tz")
        if not tz:
            continue
        loc = d.loc[idx, "dep_local"].dt.tz_localize(tz, ambiguous="NaT", nonexistent="shift_forward")
        d.loc[idx, "dep_utc"] = loc.dt.tz_convert("UTC").dt.tz_localize(None)
    d = d[d["dep_utc"].notna()].copy()
    d["dep_utc"] = pd.to_datetime(d["dep_utc"])
    d["arr_prev"] = d["dep_utc"] + _minutos(d["CRSElapsedTime"])
    d["dep_real"] = d["dep_utc"] + _minutos(d["DepDelay"])  # NaT se cancelado
    d["arr_real"] = d["arr_prev"] + _minutos(d["ArrDelay"])
    d["cancelado"] = d["Cancelled"].fillna(0) > 0
    d["realizado"] = ~d["cancelado"] & d["DepDelay"].notna()
    d["atr30"] = d["realizado"] & (d["DepDelay"] > 30)
    d["tail"] = d["Tail_Number"].where(d["Tail_Number"].fillna("").str.len() >= 3)
    num = d["Flight_Number_Reporting_Airline"].astype("Int64").astype(str)
    d["voo_id"] = (d["Reporting_Airline"].astype(str) + num).astype("category")
    d["tail"] = d["tail"].astype("category")
    d = d.drop(columns=["Tail_Number", "FlightDate", "Cancelled"])  # strings pesadas que não são mais usadas
    return d.sort_values("dep_utc").reset_index(drop=True)


# ---------------------------------------------------------------------------------------------------- variáveis
def programacao(v):
    f = pd.DataFrame(index=v.index)
    f["empresa"] = v["Reporting_Airline"].astype(str).astype("category")
    f["origem"] = v["Origin"].astype(str).astype("category")
    top = v["Dest"].astype(str).value_counts().index[:250]  # HistGradientBoosting aceita até 255 categorias
    f["destino"] = v["Dest"].astype(str).where(v["Dest"].astype(str).isin(top), "outros").astype("category")
    f["hora"] = v["dep_local"].dt.hour + v["dep_local"].dt.minute / 60
    f["dia_semana"] = v["dep_local"].dt.dayofweek
    f["mes"] = v["dep_local"].dt.month
    f["distancia"] = v["Distance"]
    f["duracao_prev"] = v["CRSElapsedTime"]
    hb = v["dep_local"].dt.floor("h")
    f["partidas_hora_origem"] = v.groupby([v["Origin"], hb], observed=True)["voo_id"].transform("size")
    f["partidas_hora_cia"] = v.groupby([v["Origin"], v["Reporting_Airline"], hb], observed=True)["voo_id"].transform(
        "size"
    )
    return f


def historico(v):
    """Taxa de atraso > 30 da rota+companhia nos meses anteriores e do número de voo nos 7 dias anteriores."""
    f = pd.DataFrame(index=v.index)
    r = v[v["realizado"]]
    ym = v["dep_local"].dt.to_period("M")
    chave = v["Reporting_Airline"].astype(str) + v["Origin"].astype(str) + v["Dest"].astype(str)
    g = r.assign(ch=chave[r.index], ym=ym[r.index]).groupby(["ch", "ym"])["atr30"].agg(["sum", "size"])
    g = g.groupby(level=0).cumsum().reset_index()
    g["ym"] = g["ym"] + 1  # o acumulado até o mês m (inclusive) só vale a partir do mês m+1: sem vazamento
    j = pd.DataFrame({"ch": chave, "ym": ym}).merge(g, on=["ch", "ym"], how="left")
    f["hist_rota_cia"] = (j["sum"] / j["size"]).to_numpy()
    dia = v["dep_local"].dt.normalize()
    dd = (
        r.assign(dia=dia[r.index]).groupby(["voo_id", "dia"], observed=True)["atr30"].agg(["sum", "size"]).reset_index()
    )
    dd = dd.sort_values(["voo_id", "dia"])
    rol = (
        dd.groupby("voo_id", observed=True).rolling("7D", on="dia", closed="left")[["sum", "size"]].sum().reset_index()
    )
    dd[["s7", "n7"]] = rol[["sum", "size"]].to_numpy()
    j = pd.DataFrame({"voo_id": v["voo_id"], "dia": dia}).merge(
        dd[["voo_id", "dia", "s7", "n7"]], on=["voo_id", "dia"], how="left"
    )
    f["voo_7dias"] = (j["s7"] / j["n7"].replace(0, np.nan)).to_numpy()
    return f


def recente(v, todos, h=H):
    """Atraso recente (mesma regra do Brasil: só horas até ref - 2 h, janela de 3 h) na origem, na companhia na
    origem e na companhia na rede."""
    f = pd.DataFrame(index=v.index)
    r = todos[todos["realizado"]].assign(hb=lambda x: x["dep_utc"].dt.floor("h"))
    ultima = (v["dep_utc"] - pd.Timedelta(hours=h)).dt.floor("h") - pd.Timedelta(hours=2)
    for nome, chave in [
        ("origem", ["Origin"]),
        ("cia_origem", ["Origin", "Reporting_Airline"]),
        ("cia_rede", ["Reporting_Airline"]),
    ]:
        g = r.groupby(chave + ["hb"], observed=True)["atr30"].agg(["sum", "size"]).reset_index()
        jan = pd.concat([g.assign(hb=g["hb"] + pd.Timedelta(hours=k)) for k in range(3)])
        jan = jan.groupby(chave + ["hb"], observed=True)[["sum", "size"]].sum().reset_index()
        esq = v[chave].astype(str).assign(hb=ultima.to_numpy())
        jan[chave] = jan[chave].astype(str)
        j = esq.merge(jan, on=chave + ["hb"], how="left")
        f[f"recente_{nome}"] = (j["sum"] / j["size"].replace(0, np.nan)).to_numpy()
    return f


def _chegada(v, m, prefixo="chegada", h=H):
    """O que se sabe do voo de chegada `m` (alinhado a `v`) 1 h antes da partida."""
    ref = (v["dep_utc"] - pd.Timedelta(hours=h)).to_numpy()
    pp, pr, ap, ar = (m[c].to_numpy() for c in ["dep_utc", "dep_real", "arr_prev", "arr_real"])
    tem = ~pd.isna(pp)
    partiu = ~pd.isna(pr) & (pr <= ref)
    preso = ~pd.isna(pr) & (pr > ref) & tem & (pp + np.timedelta64(30, "m") <= ref)
    atraso = np.where(partiu, m["DepDelay"].to_numpy(), np.nan)
    atraso = np.where(preso, (ref - pp) / np.timedelta64(1, "m"), atraso)
    chegou = ~pd.isna(ar) & (ar <= ref)
    giro = (v["dep_utc"].to_numpy() - ap) / np.timedelta64(1, "m")
    return pd.DataFrame(
        {
            f"{prefixo}_achou": tem.astype("float32"),
            f"{prefixo}_giro_min": giro,
            f"{prefixo}_atraso_conhecido": np.clip(atraso, -60, 600),
            f"{prefixo}_ainda_nao_partiu": preso.astype("float32"),
            f"{prefixo}_atraso_chegada": np.where(chegou, m["ArrDelay"].to_numpy(), np.nan),
            f"{prefixo}_folga": giro - np.nan_to_num(atraso, nan=0.0),
            f"{prefixo}_cancelada": (m["cancelado"].fillna(False).to_numpy().astype(bool) & tem & (pp <= ref)).astype(
                "float32"
            ),
        },
        index=v.index,
    )


COLS_M = ["dep_utc", "dep_real", "arr_prev", "arr_real", "DepDelay", "ArrDelay", "cancelado"]


def chegada_sem_matricula(v, todos, h=H):
    """Como no Brasil: último voo da mesma companhia chegando na origem >= 25 min antes, em até 4 h."""
    cheg = todos[["Reporting_Airline", "Dest", *COLS_M]].rename(columns={"Dest": "Origin", "dep_utc": "dep_utc_m"})
    cheg = cheg.astype({"Reporting_Airline": str, "Origin": str}).sort_values("arr_prev")
    esq = (
        v[["Reporting_Airline", "Origin"]]
        .astype(str)
        .assign(idx=np.arange(len(v)), t=v["dep_utc"] - pd.Timedelta(minutes=25))
    )
    m = pd.merge_asof(
        esq.sort_values("t"),
        cheg,
        left_on="t",
        right_on="arr_prev",
        by=["Reporting_Airline", "Origin"],
        direction="backward",
        tolerance=pd.Timedelta(hours=4),
    )
    m = m.sort_values("idx").reset_index(drop=True).rename(columns={"dep_utc_m": "dep_utc"})
    m.index = v.index
    return _chegada(v, m, h=h)


def _anterior_do_aviao(todos, n=1):
    """Para cada voo (índice de `todos`), o n-ésimo voo anterior do mesmo avião."""
    t = todos[todos["tail"].notna()].sort_values(["tail", "dep_utc"])
    ant = t.groupby("tail", observed=True)[COLS_M + ["Dest"]].shift(n)
    ant.index = t.index
    return ant


def chegada_com_matricula(v, todos, extras=False, h=H):
    ant = _anterior_do_aviao(todos).reindex(v.index)
    valido = (ant["Dest"].astype(str) == v["Origin"].astype(str)) & (
        v["dep_utc"] - ant["arr_prev"] <= pd.Timedelta(hours=12)
    )
    m = ant.where(valido)
    # Sem tempo de solo, folga e "achou": a BTS grava o avião que de fato voou, e quando a companhia troca o avião
    # por causa de um atraso o tempo de solo do avião novo denuncia a troca (vazamento). O atraso conhecido do voo
    # anterior do avião fica: 1 h antes da partida o avião designado já é conhecido.
    f = _chegada(v, m, h=h).drop(columns=["chegada_giro_min", "chegada_folga", "chegada_achou"])
    f.attrs["achou"] = float(valido.mean())
    if extras:
        ref = (v["dep_utc"] - pd.Timedelta(hours=h)).to_numpy()
        ant2 = _anterior_do_aviao(todos, 2).reindex(v.index).where(valido)
        pr2 = ant2["dep_real"].to_numpy()
        f["aviao_atraso_2_voos_antes"] = np.where(~pd.isna(pr2) & (pr2 <= ref), ant2["DepDelay"].to_numpy(), np.nan)
        t = todos[todos["tail"].notna()].sort_values(["tail", "dep_utc"])
        dia = t["dep_utc"].dt.floor("D")
        legs = t.groupby(["tail", dia], observed=True).cumcount()
        f["aviao_voos_antes_no_dia"] = legs.reindex(v.index).astype("float32")
    return f


# ---------------------------------------------------------------------------------------------------- avaliação
def avaliar(nome, X, y, ano, causa_dom, causa_ok):
    tr0, val, tr, te = ano == 2022, ano == 2023, ano <= 2023, ano == 2024
    X = X.loc[:, X[tr0].notna().any().to_numpy()]  # coluna toda vazia no treino quebra o binning
    p_val = M.hgb(**PARAMS).fit(X[tr0], y[tr0]).predict_proba(X[val])
    limiar, _ = M.ajustar_limiar(p_val, y[val])
    log(f"{nome}: limiar {limiar}")
    p = M.hgb(**PARAMS).fit(X[tr], y[tr]).predict_proba(X[te])
    yt = y[te].to_numpy()
    met = M.metricas(yt, p, limiar)
    alerta = M.decidir(p, limiar).astype(bool)
    por_causa = {}
    cd, ok = causa_dom[te].to_numpy(), causa_ok[te].to_numpy()
    for c, desc in CAUSAS.items():
        sel = (yt == 1) & ok & (cd == c)
        if sel.sum():
            por_causa[c] = {"descricao": desc, "atrasos": int(sel.sum()), "recall": float(alerta[sel].mean())}
    sem = (yt == 1) & ~ok
    por_causa["sem_causa"] = {
        "descricao": "sem causa informada",
        "atrasos": int(sem.sum()),
        "recall": float(alerta[sem].mean()) if sem.sum() else None,
    }
    r = {
        "limiar": limiar,
        **{k: float(v) for k, v in met.items() if v is not None},
        "pontos_operacao": M.pontos_operacao(yt, p),
        "recall_por_causa": por_causa,
    }
    log(
        f"{nome}: PR-AUC {met['PR-AUC']:.4f} | precisão {met['precisão']:.3f} | recall {met['recall']:.3f} | F1 {met['F1']:.3f}"
    )
    return r


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pasta", default="data/raw/bts")
    ap.add_argument("--saida", default="reports/bts")
    ap.add_argument("--amostra", type=float, default=1.0, help="fração dos voos (para testar rápido)")
    a = ap.parse_args()

    todos = carregar(a.pasta)
    log(f"BTS: {len(todos):,} voos tocando os 10 aeroportos")
    v = todos[todos["Origin"].isin(AEROPORTOS)]
    base = pd.concat([programacao(v), historico(v), recente(v, todos)], axis=1)
    ok = v["realizado"].to_numpy()
    if a.amostra < 1:
        ok &= np.random.default_rng(0).random(len(v)) < a.amostra
    v, base = v[ok], base[ok]
    y = v["atr30"].astype(int)
    ano = v["dep_local"].dt.year.to_numpy()
    log(
        f"partidas realizadas: {len(v):,} | atraso > 30: {y.mean():.3%} | por ano {pd.Series(ano).value_counts().sort_index().to_dict()}"
    )

    causas = v[list(CAUSAS)].fillna(0)
    causa_ok = causas.sum(axis=1) > 0
    causa_dom = causas.idxmax(axis=1)
    resumo = {
        "aeroportos": AEROPORTOS,
        "periodos": {"treino": "2022", "validacao": "2023", "teste": "2024"},
        "n": {"treino": int((ano <= 2023).sum()), "teste": int((ano == 2024).sum())},
        "prevalencia_teste": float(y[ano == 2024].mean()),
        "matricula_preenchida": float(v["tail"].notna().mean()),
        "modelos": {},
    }
    te = (ano == 2024) & (y.to_numpy() == 1) & causa_ok.to_numpy()
    resumo["causas_teste"] = {c: float((causa_dom.to_numpy()[te] == c).mean()) for c in CAUSAS}

    variantes = {
        "A_sem_matricula": lambda: chegada_sem_matricula(v, todos),
        "B_com_matricula": lambda: chegada_com_matricula(v, todos),
        "B+_matricula_e_cadeia": lambda: chegada_com_matricula(v, todos, extras=True),
    }
    for nome, f in variantes.items():
        cheg = f()
        achou = cheg.attrs.get("achou", cheg["chegada_achou"].mean() if "chegada_achou" in cheg else np.nan)
        log(f"{nome}: voo de chegada encontrado em {achou:.1%}")
        X = pd.concat([base, cheg], axis=1)
        for c in X.columns:
            if X[c].dtype.kind in "fi":
                X[c] = X[c].astype("float32")
        resumo["modelos"][nome] = {
            "achou_chegada": float(achou),
            **avaliar(nome, X, y, ano, causa_dom, causa_ok),
        }

    Path(a.saida).mkdir(parents=True, exist_ok=True)
    (Path(a.saida) / "resumo.json").write_text(
        json.dumps(resumo, ensure_ascii=False, indent=2, default=float), encoding="utf-8"
    )
    log("resumo em " + str(Path(a.saida) / "resumo.json"))
    print(
        json.dumps(
            {
                k: {m: resumo["modelos"][k][m] for m in ["PR-AUC", "precisão", "recall", "F1"]}
                for k in resumo["modelos"]
            },
            indent=2,
            default=float,
        )
    )


if __name__ == "__main__":
    main()
