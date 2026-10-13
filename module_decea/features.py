"""Base de modelagem do atraso de voos: alvo em faixas e variáveis disponíveis em cada horizonte de previsão.

Horizontes (o modelo só pode usar o que já se sabe no instante de referência):
    "vespera": meia-noite do dia do voo. Programação, histórico do voo/rota, como foi o dia anterior e o clima
               típico daquela hora nos últimos 30 dias. Não há previsão do tempo (TAF) no histórico.
    "3h":      3 h antes da partida prevista. Tudo da véspera + METAR da origem e do destino nesse instante,
               tendência do clima nas 3 h anteriores e atraso recente na origem, no destino e na rede.

Os horários do VRA estão em Brasília (UTC-3); o METAR está em UTC.
"""

import numpy as np
import pandas as pd

from module_decea.config import RAW_DATA_DIR
from module_decea.metar import carregar_iem
from module_decea.vra import carregar_vra, voos_regulares_domesticos

AEROPORTOS = ["SBGR", "SBSP", "SBKP", "SBCF", "SBBR", "SBGL", "SBRJ", "SBPA", "SBCT", "SBRF"]

# Alvo: faixa de atraso da partida (minutos)
LIMITES = [-np.inf, 15, 30, 60, np.inf]
FAIXAS = ["até 15 min", "15–30 min", "30–60 min", "> 60 min"]

# Feriados nacionais de 2025 (inclui Carnaval, ponto facultativo com grande efeito na malha)
FERIADOS = pd.to_datetime(
    [
        "2025-01-01",
        "2025-03-03",
        "2025-03-04",
        "2025-04-18",
        "2025-04-21",
        "2025-05-01",
        "2025-06-19",
        "2025-09-07",
        "2025-10-12",
        "2025-11-02",
        "2025-11-15",
        "2025-11-20",
        "2025-12-25",
    ]
)

CAT = ["empresa", "origem", "destino", "aeronave"]
CLIMA_ATUAL = [
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
TENDENCIA = ["vis_m", "teto_ft", "vento_kt", "spread", "qnh"]


# --------------------------------------------------------------------------------------------------------------------
# Leitura
# --------------------------------------------------------------------------------------------------------------------
def carregar_metar_horario():
    """METAR de hora cheia dos 10 aeroportos, em grade horária completa (horas sem boletim ficam NaN)."""
    m = pd.concat([carregar_iem(RAW_DATA_DIR / f"metar/{icao}.csv") for icao in AEROPORTOS], ignore_index=True)
    m = m[~m["speci"]].drop_duplicates(["icao", "hora_utc"])
    m["spread"] = m["temp_c"] - m["orvalho_c"]  # ar perto da saturação -> nevoeiro
    cols = [
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
    m[cols] = m[cols].astype(float)
    m.loc[m["vento_kt"].notna() & m["rajada_kt"].isna(), "rajada_kt"] = 0  # sem rajada reportada = 0
    m.loc[~m["qnh"].between(950, 1060), "qnh"] = np.nan  # erros de decodificação (ex.: Q0102)
    grade = pd.MultiIndex.from_product(
        [AEROPORTOS, pd.date_range(m["hora_utc"].min().floor("D"), m["hora_utc"].max().ceil("D"), freq="h")],
        names=["icao", "hora_utc"],
    )
    return m.set_index(["icao", "hora_utc"])[cols].reindex(grade).reset_index()


def carregar_voos():
    """Voos regulares domésticos saindo dos 10 aeroportos (inclui cancelados, usados só para contar a demanda)."""
    v = voos_regulares_domesticos(carregar_vra())
    v = v[v["origem"].isin(AEROPORTOS)].copy()
    v["partida_utc"] = v["partida_prev"] + pd.Timedelta(hours=3)
    v["hora_bin"] = v["partida_utc"].dt.floor("h")
    v["dia"] = v["partida_prev"].dt.normalize()  # dia local
    v["voo_id"] = v["empresa"] + v["voo"].astype(str)
    v["rota"] = v["origem"] + "-" + v["destino"]
    # Partida real horas antes da prevista (22 voos) = data registrada errada no VRA -> fora
    v["realizado"] = ~v["cancelado"] & v["atraso_partida_min"].ge(-60)
    v["faixa"] = pd.cut(v["atraso_partida_min"], LIMITES, labels=False, right=True)
    return v.reset_index(drop=True)


# --------------------------------------------------------------------------------------------------------------------
# Variáveis conhecidas na véspera
# --------------------------------------------------------------------------------------------------------------------
def _programacao(v):
    f = pd.DataFrame(index=v.index)
    for c in CAT:
        f[c] = v[c].astype("category")
    f["assentos"] = v["assentos"]
    f["hora"] = v["partida_prev"].dt.hour + v["partida_prev"].dt.minute / 60
    f["dia_semana"] = v["partida_prev"].dt.dayofweek
    f["mes"] = v["partida_prev"].dt.month
    f["dia_mes"] = v["partida_prev"].dt.day
    # Demanda programada (a malha é publicada com antecedência; inclui voos que depois foram cancelados)
    f["partidas_hora_origem"] = v.groupby(["origem", "hora_bin"])["voo"].transform("size")
    f["partidas_dia_origem"] = v.groupby(["origem", "dia"])["voo"].transform("size")
    f["partidas_dia_rede"] = v.groupby("dia")["voo"].transform("size")
    # Distância até o feriado mais próximo, em dias (negativo = depois do feriado), limitada a ±7
    d = v["dia"].values[:, None] - FERIADOS.values[None, :]
    dias = (d / np.timedelta64(1, "D")).astype(float)
    mais_perto = dias[np.arange(len(v)), np.abs(dias).argmin(axis=1)]
    f["dias_ate_feriado"] = np.clip(-mais_perto, -7, 7)
    f["feriado"] = (mais_perto == 0).astype(int)
    return f


def _historico_mensal(v, chave, nome, suav=20):
    """Taxa de atraso > 30 min da chave (voo, rota...) usando só os meses ANTERIORES ao do voo (sem olhar o futuro).

    Suavizada em direção à média global dos meses anteriores para chaves com poucos voos.
    """
    r = v[v["realizado"]].assign(mes=lambda d: d["partida_prev"].dt.month, atr=lambda d: d["faixa"] >= 2)
    meses = range(1, 13)
    # matriz chave x mês, acumulada e deslocada 1 mês -> só meses anteriores
    k = r.pivot_table(index=chave, columns="mes", values="atr", aggfunc="sum", fill_value=0)
    n = r.pivot_table(index=chave, columns="mes", values="atr", aggfunc="count", fill_value=0)
    k = k.reindex(columns=meses, fill_value=0).cumsum(axis=1).shift(1, axis=1, fill_value=0)
    n = n.reindex(columns=meses, fill_value=0).cumsum(axis=1).shift(1, axis=1, fill_value=0)
    glob = r.groupby("mes")["atr"].agg(["sum", "count"]).reindex(meses, fill_value=0).cumsum().shift(1)
    prior = (glob["sum"] / glob["count"]).rename("prior")
    t = (
        pd.DataFrame({"k": k.stack(), "n": n.stack()})
        .rename_axis([chave, "mes"])
        .reset_index()
        .merge(prior, left_on="mes", right_index=True, how="left")
    )
    t[f"hist_{nome}_taxa30"] = (t["k"] + suav * t["prior"]) / (t["n"] + suav)
    t[f"hist_{nome}_n"] = t["n"]
    t.loc[t["prior"].isna(), [f"hist_{nome}_taxa30"]] = np.nan  # janeiro: ainda não há histórico
    chaves = v[[chave]].assign(mes=v["partida_prev"].dt.month)
    return (
        chaves.merge(t[[chave, "mes", f"hist_{nome}_taxa30", f"hist_{nome}_n"]], on=[chave, "mes"], how="left")
        .drop(columns=[chave, "mes"])
        .set_index(v.index)
    )


def _voo_ultimos_7_dias(v):
    """Desempenho do mesmo voo (empresa + número) nos 7 dias anteriores."""
    # atraso limitado a [-60, 600] min: o VRA tem registros com data errada (ex.: -2889 min)
    r = v[v["realizado"]].assign(atr=lambda d: d["faixa"] >= 2, atraso=lambda d: d["atraso_partida_min"].clip(-60, 600))
    d = r.groupby(["voo_id", "dia"]).agg(k=("atr", "sum"), n=("atr", "size"), atraso=("atraso", "mean"))
    dias = pd.date_range(v["dia"].min(), v["dia"].max(), freq="D")
    d = d.reindex(pd.MultiIndex.from_product([d.index.levels[0], dias], names=["voo_id", "dia"]))
    d["atraso_soma"] = d["atraso"] * d["n"]
    g = d[["k", "n", "atraso_soma"]].fillna(0).groupby(level=0)
    rol = g.rolling(7, min_periods=1).sum().droplevel(0)
    rol = rol.groupby(level=0).shift(1)  # janela d-7 .. d-1
    out = pd.DataFrame(
        {"voo7d_taxa30": rol["k"] / rol["n"], "voo7d_atraso_medio": rol["atraso_soma"] / rol["n"], "voo7d_n": rol["n"]}
    )
    out = out.replace([np.inf, -np.inf], np.nan)
    return (
        v[["voo_id", "dia"]]
        .merge(out.reset_index(), on=["voo_id", "dia"], how="left")
        .drop(columns=["voo_id", "dia"])
        .set_index(v.index)
    )


def _dia_anterior(v, metar):
    """Como foi o dia anterior: atraso na origem e na rede, e o tempo na origem."""
    r = v[v["realizado"]].assign(atr=lambda d: d["faixa"] >= 2)
    org = r.groupby(["origem", "dia"])["atr"].mean().rename("ontem_taxa30_origem").reset_index()
    org["dia"] += pd.Timedelta(days=1)
    rede = r.groupby("dia")["atr"].mean().rename("ontem_taxa30_rede").reset_index()
    rede["dia"] += pd.Timedelta(days=1)
    m = metar.assign(dia=(metar["hora_utc"] - pd.Timedelta(hours=3)).dt.normalize() + pd.Timedelta(days=1))
    clima = (
        m.groupby(["icao", "dia"])
        .agg(
            ontem_imc_origem=("imc", "mean"),
            ontem_trovoada_origem=("trovoada", "max"),
            ontem_rajada_max_origem=("rajada_kt", "max"),
        )
        .reset_index()
    )
    out = (
        v[["origem", "dia"]]
        .merge(org, on=["origem", "dia"], how="left")
        .merge(rede, on="dia", how="left")
        .merge(clima.rename(columns={"icao": "origem"}), on=["origem", "dia"], how="left")
    )
    return out.drop(columns=["origem", "dia"]).set_index(v.index)


def _climatologia(v, metar):
    """Frequência de IMC e trovoada naquela hora (UTC) nos 30 dias anteriores, na origem e no destino."""
    m = metar[["icao", "hora_utc", "imc", "trovoada"]].copy()
    m["h"] = m["hora_utc"].dt.hour
    m = m.sort_values(["icao", "h", "hora_utc"])
    for c in ["imc", "trovoada"]:
        m[f"clim30d_{c}"] = m.groupby(["icao", "h"])[c].transform(
            lambda s: s.shift(1).rolling(30, min_periods=10).mean()
        )
    t = m[["icao", "hora_utc", "clim30d_imc", "clim30d_trovoada"]]
    out = pd.DataFrame(index=v.index)
    for lado, chave in [("origem", "origem"), ("destino", "destino")]:
        j = v[[chave, "hora_bin"]].merge(
            t.rename(columns={"icao": chave, "hora_utc": "hora_bin"}), on=[chave, "hora_bin"], how="left"
        )
        out[f"clim30d_imc_{lado}"] = j["clim30d_imc"].values
        out[f"clim30d_trovoada_{lado}"] = j["clim30d_trovoada"].values
    return out


# --------------------------------------------------------------------------------------------------------------------
# Variáveis conhecidas H horas antes da partida
# --------------------------------------------------------------------------------------------------------------------
def _clima_no_instante(v, metar, h):
    """METAR da origem e do destino na hora cheia de (partida - h), e a variação nas 3 h anteriores a ele."""
    ref = (v["partida_utc"] - pd.Timedelta(hours=h)).dt.floor("h")
    base = metar.set_index(["icao", "hora_utc"])
    out = pd.DataFrame(index=v.index)
    for lado, chave, cols in [("o", "origem", CLIMA_ATUAL), ("d", "destino", CLIMA_ATUAL[:9])]:
        idx = pd.MultiIndex.from_arrays([v[chave], ref])
        agora = base.reindex(idx)[cols]
        for c in cols:
            out[f"{lado}_{c}"] = agora[c].values
        if lado == "o":
            antes = base.reindex(pd.MultiIndex.from_arrays([v[chave], ref - pd.Timedelta(hours=3)]))[TENDENCIA]
            for c in TENDENCIA:
                out[f"o_{c}_var3h"] = agora[c].values - antes[c].values
    return out


def _propagacao(v, h):
    """Atraso recente já observável no instante de referência (partida - h).

    Uma partida programada no intervalo [t, t+1h) só pode ser classificada como "> 30 min atrasada" depois de t+1h30.
    Por isso só entram as horas até (referência - 2 h).
    """
    r = v.assign(atr=(v["faixa"] >= 2) & v["realizado"])
    horas = pd.date_range(v["hora_bin"].min() - pd.Timedelta(hours=12), v["hora_bin"].max(), freq="h")
    por_ap = r.groupby(["origem", "hora_bin"]).agg(k=("atr", "sum"), n=("realizado", "sum"))
    por_ap = por_ap.reindex(pd.MultiIndex.from_product([AEROPORTOS, horas], names=["ap", "hora_bin"]), fill_value=0)
    janela = por_ap.groupby(level=0).rolling(3, min_periods=1).sum().droplevel(0)  # 3 h terminando na hora
    rede = por_ap.groupby(level=1).sum().rolling(3, min_periods=1).sum()

    ultima = (v["partida_utc"] - pd.Timedelta(hours=h)).dt.floor("h") - pd.Timedelta(hours=2)
    out = pd.DataFrame(index=v.index)
    for nome, chave in [("origem", "origem"), ("destino", "destino")]:
        j = janela.reindex(pd.MultiIndex.from_arrays([v[chave], ultima]))
        out[f"recente_taxa30_{nome}"] = (j["k"] / j["n"].replace(0, np.nan)).values
    out["recente_n_origem"] = janela.reindex(pd.MultiIndex.from_arrays([v["origem"], ultima]))["n"].values
    j = rede.reindex(ultima)
    out["recente_taxa30_rede"] = (j["k"] / j["n"].replace(0, np.nan)).values

    # Acumulado do dia (local) na origem até a última hora observável
    loc = por_ap.reset_index()
    loc["dia"] = (loc["hora_bin"] - pd.Timedelta(hours=3)).dt.normalize()
    loc[["k_dia", "n_dia"]] = loc.groupby(["ap", "dia"])[["k", "n"]].cumsum()
    loc = loc.set_index(["ap", "hora_bin"])
    j = loc.reindex(pd.MultiIndex.from_arrays([v["origem"], ultima]))
    mesmo_dia = j["dia"].values == v["dia"].values
    out["hoje_taxa30_origem"] = np.where(mesmo_dia, j["k_dia"] / j["n_dia"].replace(0, np.nan), np.nan)
    return out


# --------------------------------------------------------------------------------------------------------------------
# Montagem
# --------------------------------------------------------------------------------------------------------------------
def montar(horizonte="3h", voos=None, metar=None):
    """Devolve (X, y, info) só com voos realizados. y = faixa 0..3. info = datas e atraso para análise."""
    if horizonte not in ("vespera", "3h"):
        raise ValueError("horizonte deve ser 'vespera' ou '3h'")
    v = carregar_voos() if voos is None else voos
    metar = carregar_metar_horario() if metar is None else metar

    partes = [
        _programacao(v),
        _historico_mensal(v, "voo_id", "voo"),
        _historico_mensal(v, "rota", "rota"),
        _voo_ultimos_7_dias(v),
        _dia_anterior(v, metar),
        _climatologia(v, metar),
    ]
    if horizonte == "3h":
        partes += [_clima_no_instante(v, metar, 3), _propagacao(v, 3)]
    X = pd.concat(partes, axis=1)

    ok = v["realizado"].values
    info = v.loc[ok, ["partida_prev", "dia", "empresa", "voo", "origem", "destino", "atraso_partida_min"]]
    return (
        X[ok].reset_index(drop=True),
        v.loc[ok, "faixa"].astype(int).reset_index(drop=True),
        info.reset_index(drop=True),
    )
