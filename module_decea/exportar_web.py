"""Gera os JSON consumidos pelo app web (pasta web/public/data/).

Uso (na raiz do projeto):
    uv run python -m module_decea.exportar_web

Treina os modelos de véspera, 3 h e 1 h como no notebook 03 (treino jan–set, teste out–dez) e grava:
    resumo.json            métricas, matriz de confusão, importância, análises descritivas (lado do analista)
    indice.json            datas disponíveis, nomes de empresas e aeroportos
    voos/AAAA-MM-DD.json   previsões de cada voo do período de teste (lado do passageiro)
"""

from datetime import UTC, datetime
import json

import numpy as np
import pandas as pd
from sklearn.inspection import permutation_importance
from sklearn.metrics import average_precision_score

from module_decea import features as F
from module_decea import modelagem as M
from module_decea.config import PROJ_ROOT

SAIDA = PROJ_ROOT / "web" / "public" / "data"

# Hiperparâmetros escolhidos na validação temporal do notebook 03 (seção 5)
PARAMS = {
    "learning_rate": 0.05,
    "max_iter": 150,
    "max_leaf_nodes": 15,
    "min_samples_leaf": 1000,
    "l2_regularization": 5.0,
    "max_features": 0.5,
}

EMPRESAS = {
    "AZU": ["Azul", "AD"],
    "GLO": ["Gol", "G3"],
    "TAM": ["LATAM", "LA"],
    "ACN": ["Azul Conecta", "2F"],
    "PTB": ["Passaredo", "2Z"],
    "PAM": ["MAP", "7M"],
    "SID": ["Sideral", "S0"],
}
AEROPORTOS = {
    "SBGR": "São Paulo/Guarulhos",
    "SBSP": "São Paulo/Congonhas",
    "SBKP": "Campinas/Viracopos",
    "SBCF": "Belo Horizonte/Confins",
    "SBBR": "Brasília",
    "SBGL": "Rio de Janeiro/Galeão",
    "SBRJ": "Rio de Janeiro/Santos Dumont",
    "SBPA": "Porto Alegre",
    "SBCT": "Curitiba",
    "SBRF": "Recife",
    "SBSV": "Salvador",
    "SBFZ": "Fortaleza",
    "SBEG": "Manaus",
    "SBBE": "Belém",
    "SBFL": "Florianópolis",
    "SBGO": "Goiânia",
    "SBCY": "Cuiabá",
    "SBVT": "Vitória",
    "SBNT": "Natal",
    "SBMO": "Maceió",
    "SBJP": "João Pessoa",
    "SBAR": "Aracaju",
    "SBTE": "Teresina",
    "SBSL": "São Luís",
    "SBCG": "Campo Grande",
    "SBPV": "Porto Velho",
    "SBRB": "Rio Branco",
    "SBMQ": "Macapá",
    "SBBV": "Boa Vista",
    "SBPJ": "Palmas",
    "SBNF": "Navegantes",
    "SBLO": "Londrina",
    "SBFI": "Foz do Iguaçu",
    "SBUL": "Uberlândia",
    "SBRP": "Ribeirão Preto",
    "SBSR": "São José do Rio Preto",
    "SBJV": "Joinville",
    "SBCH": "Chapecó",
    "SBMG": "Maringá",
    "SBPS": "Porto Seguro",
    "SBIL": "Ilhéus",
    "SBJU": "Juazeiro do Norte",
    "SBMK": "Montes Claros",
    "SBIZ": "Imperatriz",
    "SBMA": "Marabá",
    "SBSN": "Santarém",
    "SBKG": "Campina Grande",
    "SBPL": "Petrolina",
    "SBCA": "Cascavel",
    "SBJA": "Jaguaruna",
    "SBCX": "Caxias do Sul",
    "SBPF": "Passo Fundo",
    "SBSG": "Natal",
    "SBVC": "Vitória da Conquista",
    "SBAU": "Araçatuba",
    "SBDN": "Presidente Prudente",
    "SBBH": "Belo Horizonte/Pampulha",
    "SBME": "Macaé",
    "SBCB": "Cabo Frio",
    "SBJR": "Rio de Janeiro/Jacarepaguá",
    "SBUR": "Uberaba",
    "SBIP": "Ipatinga",
    "SBGV": "Governador Valadares",
    "SBZM": "Juiz de Fora",
    "SBBW": "Barra do Garças",
    "SBSI": "Sinop",
    "SBAT": "Alta Floresta",
    "SBRD": "Rondonópolis",
    "SBDO": "Dourados",
    "SBCZ": "Cruzeiro do Sul",
    "SBTT": "Tabatinga",
    "SBTF": "Tefé",
    "SBHT": "Altamira",
    "SBCJ": "Parauapebas/Carajás",
    "SBAE": "Bauru/Arealva",
    "SBTG": "Três Lagoas",
    "SBSM": "Santa Maria",
    "SBPK": "Pelotas",
    "SBUG": "Uruguaiana",
    "SBBG": "Bagé",
    "SBFN": "Fernando de Noronha",
    "SBJE": "Jericoacoara",
    "SBLE": "Lençóis",
    "SBTC": "Una/Comandatuba",
}
DESCRICOES = {
    "recente_taxa30_origem": "Atraso recente na origem",
    "recente_taxa30_rede": "Atraso recente na rede",
    "recente_taxa30_destino": "Atraso recente no destino",
    "hoje_taxa30_origem": "Atraso acumulado do dia na origem",
    "recente_n_origem": "Partidas recentes na origem",
    "hora": "Hora da partida",
    "voo7d_taxa30": "Mesmo voo, últimos 7 dias",
    "voo7d_atraso_medio": "Atraso médio do voo (7 dias)",
    "hist_voo_taxa30": "Histórico do voo",
    "hist_rota_taxa30": "Histórico da rota",
    "ontem_taxa30_rede": "Atraso da rede ontem",
    "ontem_taxa30_origem": "Atraso da origem ontem",
    "empresa": "Companhia",
    "origem": "Aeroporto de origem",
    "destino": "Aeroporto de destino",
    "aeronave": "Aeronave",
    "mes": "Mês",
    "dia_mes": "Dia do mês",
    "dia_semana": "Dia da semana",
    "dias_ate_feriado": "Dias até feriado",
    "partidas_hora_origem": "Partidas na hora",
    "partidas_dia_origem": "Partidas no dia (origem)",
    "partidas_dia_rede": "Partidas no dia (rede)",
    "o_rajada_kt": "Rajada na origem",
    "o_vento_kt": "Vento na origem",
    "o_trovoada": "Trovoada na origem",
    "o_teto_ft": "Teto na origem",
    "o_vis_m": "Visibilidade na origem",
    "o_imc": "IMC na origem",
    "o_qnh": "Pressão na origem",
    "o_spread": "Temp. − orvalho na origem",
    "o_qnh_var3h": "Variação da pressão (3 h)",
    "d_trovoada": "Trovoada no destino",
    "d_rajada_kt": "Rajada no destino",
    "d_vento_kt": "Vento no destino",
    "clim30d_trovoada_origem": "Trovoada típica na origem",
    "clim30d_imc_origem": "IMC típico na origem",
    "clim30d_imc_destino": "IMC típico no destino",
    "ontem_rajada_max_origem": "Rajada máx. ontem na origem",
    "o_chuva": "Chuva na origem",
    "o_nevoeiro": "Nevoeiro na origem",
    "o_abaixo_minimos": "Abaixo dos mínimos (origem)",
    "o_vis_m_var3h": "Variação da visibilidade (3 h)",
    "o_teto_ft_var3h": "Variação do teto (3 h)",
    "o_vento_kt_var3h": "Variação do vento (3 h)",
    "o_spread_var3h": "Variação temp. − orvalho (3 h)",
    "d_imc": "IMC no destino",
    "d_chuva": "Chuva no destino",
    "d_vis_m": "Visibilidade no destino",
    "d_teto_ft": "Teto no destino",
    "d_nevoeiro": "Nevoeiro no destino",
    "d_abaixo_minimos": "Abaixo dos mínimos (destino)",
    "hist_voo_n": "Voos no histórico do voo",
    "hist_rota_n": "Voos no histórico da rota",
    "voo7d_n": "Voos do mesmo número (7 dias)",
    "assentos": "Assentos",
    "feriado": "Feriado",
    "ontem_imc_origem": "IMC ontem na origem",
    "ontem_trovoada_origem": "Trovoada ontem na origem",
    "clim30d_trovoada_destino": "Trovoada típica no destino",
    "chegada_atraso_conhecido": "Atraso do voo de chegada",
    "chegada_ainda_nao_partiu": "Voo de chegada ainda não decolou",
    "chegada_cancelada": "Voo de chegada cancelado",
    "chegada_giro_min": "Tempo de solo programado",
    "recente_taxa30_cia_origem": "Atraso recente da cia na origem",
    "recente_taxa30_cia_rede": "Atraso recente da cia na rede",
}


def _grupo(col):
    if col.startswith(("recente", "hoje", "chegada_atraso", "chegada_ainda", "chegada_cancelada")):
        return "propagação"
    if col.startswith(("o_", "d_", "clim30d", "ontem_imc", "ontem_trovoada", "ontem_rajada")):
        return "clima"
    if col.startswith(("hist", "voo7d", "ontem")):
        return "histórico"
    return "programação"


def _r(x, n=4):
    return None if x is None or (isinstance(x, float) and np.isnan(x)) else round(float(x), n)


def _taxa(df, chave):
    g = df.groupby(chave, observed=True)["atr"].agg(["mean", "size"]).reset_index()
    return [{"chave": str(k), "taxa30": _r(m), "voos": int(n)} for k, m, n in g.itertuples(index=False)]


HORIZ = {"vespera": ("vespera", "Véspera"), "h3": ("3h", "3 h antes"), "h1": ("1h", "1 h antes")}


def main():
    print("montando bases...")
    voos, metar, chegadas = F.carregar_voos(), F.carregar_metar_horario(), F.carregar_chegadas()
    bases = {}
    for k, (cod, _) in HORIZ.items():
        bases[k], y, info = F.montar(cod, voos, metar, chegadas)
    X1 = bases["h1"]
    meses = info["partida_prev"].dt.month.values
    treino, teste = meses <= 9, meses >= 10

    print("calibrando a decisão em set...")
    pesos = {}
    for k, X in bases.items():
        tr, va = meses <= 8, meses == 9
        p = M.hgb(**PARAMS).fit(X[tr], y[tr]).predict_proba(X[va])
        pesos[k] = M.ajustar_pesos(p, y[va].values)[0]

    print("treinando modelos finais...")
    modelos, proba = {}, {}
    for k, X in bases.items():
        modelos[k] = M.hgb(**PARAMS).fit(X[treino], y[treino])
        proba[k] = modelos[k].predict_proba(X[teste])

    yt = y[teste].values
    prior = np.tile(y[treino].value_counts(normalize=True).sort_index().values, (len(yt), 1))
    tabela = [{"nome": "Chute (proporção do treino)", **M.metricas(yt, prior)}]
    tabela += [{"nome": nome, **M.metricas(yt, proba[k], pesos[k])} for k, (_, nome) in HORIZ.items()]
    pred = {k: M.decidir(proba[k], pesos[k]) for k in bases}

    print("importância por permutação...")
    idx = np.random.default_rng(1).choice(np.flatnonzero(teste), 20_000, replace=False)
    imp = permutation_importance(
        modelos["h1"], X1.iloc[idx], y.iloc[idx], scoring="neg_log_loss", n_repeats=2, random_state=0
    )
    imp = pd.Series(imp.importances_mean, index=X1.columns).sort_values(ascending=False).head(20)

    # Semanal
    semana = info.loc[teste, "partida_prev"].dt.to_period("W").dt.start_time.values
    atr_t = yt >= 1
    semanal = []
    for s in np.unique(semana):
        m = semana == s
        semanal.append(
            {
                "semana": str(pd.Timestamp(s).date()),
                "prevalencia": _r(atr_t[m].mean()),
                **{k: _r(average_precision_score(atr_t[m], proba[k][m][:, 1:].sum(1))) for k in bases},
            }
        )

    # Análise descritiva do ano todo (voos realizados)
    d = info.assign(
        atr=(y >= 1).values,
        hora=info["partida_prev"].dt.hour,
        mes=info["partida_prev"].dt.month,
        dia_semana=info["partida_prev"].dt.dayofweek,
    )
    condicoes = {
        "Todas as partidas": np.ones(len(d), bool),
        "IMC na origem": X1["o_imc"].eq(1).values,
        "Chuva na origem": X1["o_chuva"].eq(1).values,
        "Rajada ≥ 25 kt": X1["o_rajada_kt"].ge(25).values,
        "Trovoada na origem": X1["o_trovoada"].eq(1).values,
        "Abaixo dos mínimos": X1["o_abaixo_minimos"].eq(1).values,
        "Voo de chegada saiu > 30 min atrasado": X1["chegada_atraso_conhecido"].gt(30).values,
    }
    clima = [{"chave": n, "taxa30": _r(d.loc[m, "atr"].mean()), "voos": int(m.sum())} for n, m in condicoes.items()]

    resumo = {
        "gerado_em": datetime.now(UTC).isoformat(timespec="seconds"),
        "faixas": F.FAIXAS,
        "horizontes": {k: nome for k, (_, nome) in HORIZ.items()},
        "periodo_treino": ["2025-01-01", "2025-09-30"],
        "periodo_teste": ["2025-10-01", "2025-12-31"],
        "n_treino": int(treino.sum()),
        "n_teste": int(teste.sum()),
        "distribuicao": {
            "treino": [_r(x) for x in y[treino].value_counts(normalize=True).sort_index()],
            "teste": [_r(x) for x in y[teste].value_counts(normalize=True).sort_index()],
        },
        "hiperparametros": PARAMS,
        "pesos": {k: list(v) for k, v in pesos.items()},
        "modelos": [{k: (_r(v) if not isinstance(v, str) else v) for k, v in linha.items()} for linha in tabela],
        "por_faixa": {
            k: [
                {
                    "faixa": f,
                    "precisao": _r(r["precisão"]),
                    "recall": _r(r["recall"]),
                    "f1": _r(r["F1"]),
                    "voos": int(r["voos"]),
                }
                for f, r in M.tabela_por_faixa(yt, pred[k]).iterrows()
            ]
            for k in bases
        },
        "confusao": {k: [[_r(x, 2) for x in linha] for linha in M.matriz_confusao(yt, pred[k]).values] for k in bases},
        "importancia": [
            {"variavel": c, "descricao": DESCRICOES.get(c, c), "grupo": _grupo(c), "valor": _r(v, 5)}
            for c, v in imp.items()
        ],
        "semanal": semanal,
        "eda": {
            "por_hora": _taxa(d, "hora"),
            "por_aeroporto": _taxa(d, "origem"),
            "por_empresa": _taxa(d, "empresa"),
            "por_mes": _taxa(d, "mes"),
            "por_dia_semana": _taxa(d, "dia_semana"),
            "clima": clima,
        },
    }

    print("gravando JSON...")
    (SAIDA / "voos").mkdir(parents=True, exist_ok=True)
    for f in (SAIDA / "voos").glob("*.json"):
        f.unlink()
    (SAIDA / "resumo.json").write_text(json.dumps(resumo, ensure_ascii=False), encoding="utf-8")

    it = info[teste].reset_index(drop=True)
    xt = X1[teste].reset_index(drop=True)
    pct = {k: np.rint(proba[k] * 100).astype(int) for k in bases}
    registros = pd.DataFrame(
        {
            "e": it["empresa"],
            "n": it["voo"].astype(str).str.lstrip("0"),
            "o": it["origem"],
            "d": it["destino"],
            "h": it["partida_prev"].dt.strftime("%H:%M"),
            "dia": it["dia"].dt.strftime("%Y-%m-%d"),
            "a": np.rint(it["atraso_partida_min"]).astype(int),
            "f": yt,
        }
    )
    # Contexto mostrado ao passageiro: o que se sabia 1 h antes da partida
    ctx_cols = {
        "trov": "o_trovoada",
        "raj": "o_rajada_kt",
        "vis": "o_vis_m",
        "teto": "o_teto_ft",
        "rec": "recente_taxa30_origem",
        "cia": "recente_taxa30_cia_origem",
        "chg": "chegada_atraso_conhecido",
        "chgp": "chegada_ainda_nao_partiu",
        "hist": "hist_voo_taxa30",
        "v7": "voo7d_taxa30",
    }
    for dia, g in registros.groupby("dia"):
        lista = []
        for i, r in g.iterrows():
            ctx = {k: _r(xt.at[i, c], 3) for k, c in ctx_cols.items()}
            lista.append(
                {
                    "e": r["e"],
                    "n": r["n"],
                    "o": r["o"],
                    "d": r["d"],
                    "h": r["h"],
                    "a": int(r["a"]),
                    "f": int(r["f"]),
                    "pv": pct["vespera"][i].tolist(),
                    "p3": pct["h3"][i].tolist(),
                    "p1": pct["h1"][i].tolist(),
                    "fv": int(pred["vespera"][i]),
                    "f3": int(pred["h3"][i]),
                    "f1": int(pred["h1"][i]),
                    "c": ctx,
                }
            )
        lista.sort(key=lambda x: x["h"])
        (SAIDA / "voos" / f"{dia}.json").write_text(
            json.dumps(lista, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
        )

    indice = {"datas": sorted(registros["dia"].unique().tolist()), "empresas": EMPRESAS, "aeroportos": AEROPORTOS}
    (SAIDA / "indice.json").write_text(json.dumps(indice, ensure_ascii=False), encoding="utf-8")
    print(f"pronto: {SAIDA} ({len(indice['datas'])} dias, {len(registros):,} voos)")


if __name__ == "__main__":
    main()
