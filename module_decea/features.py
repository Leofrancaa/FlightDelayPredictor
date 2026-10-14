"""Base de modelagem do atraso de voos: alvo em faixas e variáveis disponíveis em cada horizonte de previsão.

Horizontes (o modelo só pode usar o que já se sabe no instante de referência):
    "vespera": meia-noite do dia do voo. Programação, histórico do voo/rota, como foi o dia anterior e o clima
               típico daquela hora nos últimos 30 dias. Não há previsão do tempo (TAF) no histórico.
    "3h", "1h": 3 h ou 1 h antes da partida prevista. Tudo da véspera + METAR da origem e do destino nesse
               instante, tendência do clima nas 3 h anteriores, atraso recente na origem, no destino, na rede e
               da própria companhia, e o atraso já conhecido do voo que deve trazer o avião (voo de chegada).

Os horários do VRA estão em Brasília (UTC-3); o METAR está em UTC.
"""

import numpy as np
import pandas as pd

from module_decea.config import RAW_DATA_DIR
from module_decea.metar import carregar_iem
from module_decea.vra import carregar_vra, voos_regulares_domesticos

AEROPORTOS = ["SBGR", "SBSP", "SBKP", "SBCF", "SBBR", "SBGL", "SBRJ", "SBPA", "SBCT", "SBRF"]

# Alvo: faixa de atraso da partida (minutos). Até 30 min = dentro da tolerância usada pela ANAC.
# A faixa 15–30 min foi unida à primeira: era a mais ruidosa e quase impossível de separar.
LIMITES = [-np.inf, 30, 60, np.inf]
FAIXAS = ["até 30 min", "30–60 min", "> 60 min"]
HORIZONTES = {"vespera": None, "3h": 3, "1h": 1}


def _pascoa(ano):
    """Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher)."""
    a, b, c = ano % 19, ano // 100, ano % 100
    d, e = b // 4, b % 4
    g = (8 * b + 13) // 25
    h = (19 * a + b - d - g + 15) % 30
    i, k = c // 4, c % 4
    l_ = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l_) // 451
    mes = (h + l_ - 7 * m + 114) // 31
    dia = (h + l_ - 7 * m + 114) % 31 + 1
    return pd.Timestamp(ano, mes, dia)


def feriados(anos):
    """Feriados nacionais (inclui Carnaval, ponto facultativo com grande efeito na malha)."""
    datas = []
    for ano in anos:
        p = _pascoa(ano)
        datas += [
            pd.Timestamp(ano, m, d) for m, d in [(1, 1), (4, 21), (5, 1), (9, 7), (10, 12), (11, 2), (11, 15), (12, 25)]
        ]
        datas += [
            p - pd.Timedelta(days=48),
            p - pd.Timedelta(days=47),
            p - pd.Timedelta(days=2),
            p + pd.Timedelta(days=60),
        ]
        if ano >= 2024:  # Consciência Negra virou feriado nacional em 2024
            datas.append(pd.Timestamp(ano, 11, 20))
    return pd.DatetimeIndex(sorted(datas))


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
    # Um arquivo por aeroporto e ano (SBGR_2014.csv) ou o arquivo único antigo (SBGR.csv)
    arquivos = [f for icao in AEROPORTOS for f in sorted((RAW_DATA_DIR / "metar").glob(f"{icao}*.csv"))]
    m = pd.concat([carregar_iem(f) for f in arquivos], ignore_index=True)
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


def _so_rede(df):
    """Filtro aplicado na leitura: voo regular doméstico tocando um dos 10 aeroportos."""
    return (
        (df["di"] == "0") & (df["tipo_linha"] == "N") & (df["origem"].isin(AEROPORTOS) | df["destino"].isin(AEROPORTOS))
    )


# Períodos com dados incompletos ou atípicos no VRA (ver notebook 03): ficam fora quando se carregam vários anos
PERIODOS_ANOMALOS = [
    ("2014-06-01", "2014-08-01"),  # junho e julho de 2014 vêm vazios da ANAC
    ("2017-08-01", "2018-04-01"),  # cerca de metade dos voos (uma companhia ausente nos arquivos)
    ("2020-01-01", "2022-01-01"),  # pandemia
]


def carregar_vra_rede(anos=(2025,), sem_anomalias=True):
    """VRA já filtrado (regular, doméstico, tocando os 10 aeroportos). Base para carregar_voos e carregar_chegadas."""
    v = voos_regulares_domesticos(carregar_vra(anos=anos, filtro=_so_rede))
    v = v.drop(columns=["di", "tipo_linha", "situacao"])
    if sem_anomalias:
        for ini, fim in PERIODOS_ANOMALOS:
            v = v[~v["partida_prev"].between(pd.Timestamp(ini), pd.Timestamp(fim), inclusive="left")]
    for c in ["empresa", "aeronave", "origem", "destino"]:  # poucos valores distintos: categoria economiza memória
        v[c] = v[c].astype("category")
    return v.reset_index(drop=True)


def carregar_voos(anos=(2025,), vra=None):
    """Voos regulares domésticos saindo dos 10 aeroportos (inclui cancelados, usados só para contar a demanda)."""
    v = carregar_vra_rede(anos) if vra is None else vra
    v = v[v["origem"].isin(AEROPORTOS)].copy()
    v["partida_utc"] = v["partida_prev"] + pd.Timedelta(hours=3)
    v["hora_bin"] = v["partida_utc"].dt.floor("h")
    v["dia"] = v["partida_prev"].dt.normalize()  # dia local
    v["voo_id"] = v["empresa"].astype(str) + v["voo"].astype(str)
    v["rota"] = v["origem"].astype(str) + "-" + v["destino"].astype(str)
    # Partida real horas antes da prevista (22 voos) = data registrada errada no VRA -> fora
    v["realizado"] = ~v["cancelado"] & v["atraso_partida_min"].ge(-60)
    v["faixa"] = pd.cut(v["atraso_partida_min"], LIMITES, labels=False, right=True)
    v["atr30"] = v["realizado"] & (v["atraso_partida_min"] > 30)
    return v.reset_index(drop=True)


def carregar_chegadas(anos=(2025,), vra=None):
    """Todos os voos regulares domésticos que chegam aos 10 aeroportos (vindos de qualquer origem)."""
    t = carregar_vra_rede(anos) if vra is None else vra
    t = t[t["destino"].isin(AEROPORTOS) & t["chegada_prev"].notna()]
    cols = {
        "destino": "origem",
        "partida_prev": "in_partida_prev",
        "partida_real": "in_partida_real",
        "cancelado": "in_cancelado",
    }
    return (
        t[["empresa", "aeronave", "destino", "chegada_prev", "partida_prev", "partida_real", "cancelado"]]
        .rename(columns=cols)
        .sort_values("chegada_prev")
        .reset_index(drop=True)
    )


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
    # calculado por dia distinto (poucos milhares) e depois mapeado para os voos
    fer = feriados(range(v["dia"].dt.year.min() - 1, v["dia"].dt.year.max() + 2))
    dias_unicos = pd.DatetimeIndex(v["dia"].unique())
    d = (dias_unicos.values[:, None] - fer.values[None, :]) / np.timedelta64(1, "D")
    mais_perto = pd.Series(d[np.arange(len(dias_unicos)), np.abs(d).argmin(axis=1)], index=dias_unicos)
    mp = v["dia"].map(mais_perto).to_numpy()
    f["dias_ate_feriado"] = np.clip(-mp, -7, 7)
    f["feriado"] = (mp == 0).astype(int)
    return f


def _historico_mensal(v, chave, nome, suav=20):
    """Taxa de atraso > 30 min da chave (voo, rota...) usando só os meses ANTERIORES ao do voo (sem olhar o futuro).

    Acumula todos os meses anteriores (de todos os anos carregados). Suavizada em direção à média global dos
    meses anteriores para chaves com poucos voos.
    """
    ym = v["partida_prev"].dt.year * 12 + v["partida_prev"].dt.month - 1
    r = v[v["realizado"]].assign(ym=ym[v["realizado"]], atr=lambda d: d["atr30"])
    meses = range(int(ym.min()), int(ym.max()) + 1)
    # matriz chave x mês, acumulada e deslocada 1 mês -> só meses anteriores
    k = r.pivot_table(index=chave, columns="ym", values="atr", aggfunc="sum", fill_value=0)
    n = r.pivot_table(index=chave, columns="ym", values="atr", aggfunc="count", fill_value=0)
    k = k.reindex(columns=meses, fill_value=0).cumsum(axis=1).shift(1, axis=1, fill_value=0)
    n = n.reindex(columns=meses, fill_value=0).cumsum(axis=1).shift(1, axis=1, fill_value=0)
    glob = r.groupby("ym")["atr"].agg(["sum", "count"]).reindex(meses, fill_value=0).cumsum().shift(1)
    prior = (glob["sum"] / glob["count"].replace(0, np.nan)).rename("prior")
    t = (
        pd.DataFrame({"k": k.stack(), "n": n.stack()})
        .rename_axis([chave, "ym"])
        .reset_index()
        .merge(prior, left_on="ym", right_index=True, how="left")
    )
    t[f"hist_{nome}_taxa30"] = (t["k"] + suav * t["prior"]) / (t["n"] + suav)
    t[f"hist_{nome}_n"] = t["n"]
    t.loc[t["prior"].isna(), [f"hist_{nome}_taxa30"]] = np.nan  # 1º mês: ainda não há histórico
    chaves = v[[chave]].assign(ym=ym)
    return (
        chaves.merge(t[[chave, "ym", f"hist_{nome}_taxa30", f"hist_{nome}_n"]], on=[chave, "ym"], how="left")
        .drop(columns=[chave, "ym"])
        .set_index(v.index)
    )


def _voo_ultimos_7_dias(v):
    """Desempenho do mesmo voo (empresa + número) nos 7 dias anteriores (janela d-7 .. d-1)."""
    # atraso limitado a [-60, 600] min: o VRA tem registros com data errada (ex.: -2889 min)
    r = v[v["realizado"]].assign(atr=lambda d: d["atr30"], atraso=lambda d: d["atraso_partida_min"].clip(-60, 600))
    d = r.groupby(["voo_id", "dia"]).agg(k=("atr", "sum"), n=("atr", "size"), atraso_soma=("atraso", "sum"))
    d = d.reset_index().sort_values(["voo_id", "dia"])
    # d está ordenado por voo e dia, e o groupby (sort=True) devolve as linhas nessa mesma ordem
    rol = d.groupby("voo_id", sort=True).rolling("7D", on="dia", closed="left")[["k", "n", "atraso_soma"]].sum()
    d[["k7", "n7", "s7"]] = rol[["k", "n", "atraso_soma"]].to_numpy()
    n7 = d["n7"].replace(0, np.nan)
    out = pd.DataFrame(
        {
            "voo_id": d["voo_id"],
            "dia": d["dia"],
            "voo7d_taxa30": d["k7"] / n7,
            "voo7d_atraso_medio": d["s7"] / n7,
            "voo7d_n": d["n7"].fillna(0),
        }
    )
    return (
        v[["voo_id", "dia"]]
        .merge(out, on=["voo_id", "dia"], how="left")
        .drop(columns=["voo_id", "dia"])
        .set_index(v.index)
    )


def _dia_anterior(v, metar):
    """Como foi o dia anterior: atraso na origem e na rede, e o tempo na origem."""
    r = v[v["realizado"]].assign(atr=lambda d: d["atr30"])
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
    r = v.assign(atr=v["atr30"])
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


def _cia_recente(v, h):
    """Atraso recente da PRÓPRIA companhia na origem e na rede inteira (mesma regra de observabilidade acima)."""
    r = v.assign(hb=v["partida_prev"].dt.floor("h"))
    ultima = (v["partida_prev"] - pd.Timedelta(hours=h)).dt.floor("h") - pd.Timedelta(hours=2)
    out = pd.DataFrame(index=v.index)
    for chave, nome in [(["origem", "empresa"], "cia_origem"), (["empresa"], "cia_rede")]:
        g = r.groupby(chave + ["hb"]).agg(k=("atr30", "sum"), n=("realizado", "sum")).reset_index()
        janela = pd.concat([g.assign(hb=g["hb"] + pd.Timedelta(hours=d)) for d in range(3)])
        janela = janela.groupby(chave + ["hb"])[["k", "n"]].sum().reset_index()
        j = v[chave].assign(hb=ultima.values).merge(janela, on=chave + ["hb"], how="left")
        out[f"recente_taxa30_{nome}"] = (j["k"] / j["n"].replace(0, np.nan)).values
    return out


def _casar_chegada(v, chegadas):
    """Voo de chegada provável: o último da mesma companhia e mesmo modelo de avião chegando na origem
    pelo menos 25 min antes da partida (giro mínimo), em até 4 h. Sem a matrícula, é uma aproximação."""
    chaves = ["empresa", "aeronave", "origem"]
    chegadas = chegadas.astype({c: str for c in chaves})
    esq = (
        v[["empresa", "aeronave", "origem", "partida_prev"]]
        .astype({c: str for c in chaves})
        .assign(idx=np.arange(len(v)), chave_t=v["partida_prev"] - pd.Timedelta(minutes=25))
    )
    m = pd.merge_asof(
        esq.sort_values("chave_t"),
        chegadas,
        left_on="chave_t",
        right_on="chegada_prev",
        by=["empresa", "aeronave", "origem"],
        direction="backward",
        tolerance=pd.Timedelta(hours=4),
    )
    return m.sort_values("idx").reset_index(drop=True)


def _giro(v, m):
    """Tempo de solo programado entre a chegada provável e a partida (conhecido desde a véspera)."""
    giro = (v["partida_prev"].values - m["chegada_prev"].values) / np.timedelta64(1, "m")
    return pd.DataFrame({"chegada_giro_min": giro}, index=v.index)


def _voo_chegada(v, m, h):
    """O que já se sabe do voo de chegada no instante de referência (partida - h)."""
    ref = (v["partida_prev"] - pd.Timedelta(hours=h)).values
    pp, pr = m["in_partida_prev"].values, m["in_partida_real"].values
    partiu = ~pd.isna(pr) & (pr <= ref)
    # Ainda não decolou mas já passou 30 min do horário: atraso é pelo menos (ref - previsto)
    preso = ~partiu & ~pd.isna(pp) & (pp + np.timedelta64(30, "m") <= ref)
    atraso = np.where(partiu, (pr - pp) / np.timedelta64(1, "m"), np.nan)
    atraso = np.where(preso, (ref - pp) / np.timedelta64(1, "m"), atraso)
    cancelado_ja_sabido = m["in_cancelado"].fillna(False).values.astype(bool) & ~pd.isna(pp) & (pp <= ref)
    return pd.DataFrame(
        {
            "chegada_atraso_conhecido": np.clip(atraso, -60, 600),
            "chegada_ainda_nao_partiu": preso.astype(float),
            "chegada_cancelada": cancelado_ja_sabido.astype(float),
        },
        index=v.index,
    )


# --------------------------------------------------------------------------------------------------------------------
# Montagem
# --------------------------------------------------------------------------------------------------------------------
def montar(horizonte="3h", voos=None, metar=None, chegadas=None):
    """Devolve (X, y, info) só com voos realizados. y = faixa 0..2. info = datas e atraso para análise."""
    if horizonte not in HORIZONTES:
        raise ValueError(f"horizonte deve ser um de {list(HORIZONTES)}")
    h = HORIZONTES[horizonte]
    v = carregar_voos() if voos is None else voos
    metar = carregar_metar_horario() if metar is None else metar
    chegadas = carregar_chegadas() if chegadas is None else chegadas
    m = _casar_chegada(v, chegadas)

    partes = [
        _programacao(v),
        _historico_mensal(v, "voo_id", "voo"),
        _historico_mensal(v, "rota", "rota"),
        _voo_ultimos_7_dias(v),
        _dia_anterior(v, metar),
        _climatologia(v, metar),
        _giro(v, m),
    ]
    if h is not None:
        partes += [_clima_no_instante(v, metar, h), _propagacao(v, h), _cia_recente(v, h), _voo_chegada(v, m, h)]
    # float32 em cada bloco antes de juntar: metade da memória (com vários anos faz diferença)
    partes = [p.astype({c: "float32" for c in p.select_dtypes("number").columns}) for p in partes]
    X = pd.concat(partes, axis=1)
    del partes

    ok = v["realizado"].values
    info = v.loc[ok, ["partida_prev", "dia", "empresa", "voo", "origem", "destino", "atraso_partida_min"]]
    return (
        X[ok].reset_index(drop=True),
        v.loc[ok, "faixa"].astype(int).reset_index(drop=True),
        info.reset_index(drop=True),
    )
