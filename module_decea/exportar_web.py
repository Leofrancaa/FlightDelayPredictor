"""Treina o modelo final (atraso > 30 min) com todos os anos e gera os JSON do app web (web/public/data/).

Uso (na raiz do projeto; com 2011–2025 precisa de ~16 GB de RAM):
    uv run python -m module_decea.exportar_web                 # 2011–2025
    uv run python -m module_decea.exportar_web --desde 2016    # menos memória
    uv run python -m module_decea.exportar_web --rapido        # modelos pequenos, só para testar o código

Divisão temporal (sem os períodos anômalos de features.PERIODOS_ANOMALOS):
    treino 2011–2022 -> validação 2023 (hiperparâmetros e limiar do alerta) -> modelo final treinado em 2011–2023
    -> teste em 2024–2025 (anos inteiros, métricas mês a mês)

Grava:
    resumo.json            métricas, pontos de operação, mês a mês, janelas de treino, importância, análise descritiva
    indice.json            datas da demonstração, nomes de empresas e aeroportos
    voos/AAAA-MM-DD.json   previsões de cada voo de out–dez/2025 (demonstração do passageiro; parte do teste)
Também grava reports/modelo_final/resumo.json (cópia para o relatório).
"""

import argparse
from datetime import UTC, datetime
import gc
import json
import time

import numpy as np
import pandas as pd
from sklearn.inspection import permutation_importance
from sklearn.metrics import average_precision_score, log_loss

from module_decea import features as F
from module_decea import modelagem as M
from module_decea.config import PROJ_ROOT, REPORTS_DIR

SAIDA = PROJ_ROOT / "web" / "public" / "data"
INICIO_DEMO = "2025-10-01"  # voos mostrados na área do passageiro

LIVRE = {"max_leaf_nodes": 31, "min_samples_leaf": 100, "l2_regularization": 1.0}
REGULARIZADA = {"max_leaf_nodes": 15, "min_samples_leaf": 1000, "l2_regularization": 5.0, "max_features": 0.5}
GRADE = [{"learning_rate": 0.05, "max_iter": it} | fam for it in (150, 400) for fam in (LIVRE, REGULARIZADA)]
GRADE_RAPIDA = [{"learning_rate": 0.2, "max_iter": 20} | REGULARIZADA]

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
    return None if x is None or pd.isna(x) else round(float(x), n)


def _taxa(df, chave):
    g = df.groupby(chave, observed=True)["atr"].agg(["mean", "size"]).reset_index()
    return [{"chave": str(k), "taxa30": _r(m), "voos": int(n)} for k, m, n in g.itertuples(index=False)]


HORIZ = {"h1": ("1h", "1 h antes"), "h3": ("3h", "3 h antes"), "vespera": ("vespera", "Véspera")}


def _log(t0, msg):
    print(f"[{time.time() - t0:5.0f}s] {msg}", flush=True)


def _mensal(info_te, y_te, p_te, limiar):
    """Métricas por mês do teste."""
    mes = info_te["partida_prev"].dt.strftime("%Y-%m").to_numpy()
    alerta = p_te[:, 1] >= limiar
    linhas = []
    for m in sorted(set(mes)):
        i = mes == m
        y, a = y_te[i], alerta[i]
        linhas.append(
            {
                "mes": m,
                "voos": int(i.sum()),
                "prevalencia": _r(y.mean()),
                "pr_auc": _r(average_precision_score(y, p_te[i, 1])),
                "precisao": _r(y[a].mean()) if a.any() else None,
                "recall": _r(a[y == 1].mean()),
            }
        )
    return linhas


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--desde", type=int, default=2011, help="primeiro ano usado (padrão 2011)")
    ap.add_argument("--rapido", action="store_true", help="modelos pequenos, só para testar o código")
    a = ap.parse_args()
    t0 = time.time()
    grade = GRADE_RAPIDA if a.rapido else GRADE

    base = F.carregar_vra_rede(range(a.desde, 2026))
    voos, chegadas = F.carregar_voos(vra=base), F.carregar_chegadas(vra=base)
    del base
    metar = F.carregar_metar_horario()
    _log(t0, f"dados {a.desde}–2025: {len(voos):,} voos")

    resumo = {
        "gerado_em": datetime.now(UTC).isoformat(timespec="seconds"),
        "alvo": "partida com atraso > 30 min",
        "desde": a.desde,
        "periodos": {"treino": f"{a.desde}–2022", "validacao": "2023", "teste": "2024–2025"},
        "periodos_anomalos": [list(p) for p in F.PERIODOS_ANOMALOS],
        "horizontes": {k: nome for k, (_, nome) in HORIZ.items()},
        "modelos": {},
        "mensal": {},
        "janelas": [],
    }
    demo = {}
    for k, (cod, nome) in HORIZ.items():
        X, y, info = F.montar(cod, voos, metar, chegadas)
        ano = info["partida_prev"].dt.year.to_numpy()
        tr_val, val, tr, te = ano <= 2022, ano == 2023, ano <= 2023, ano >= 2024
        _log(t0, f"{nome}: {X.shape[1]} variáveis | treino {tr_val.sum():,} | val {val.sum():,} | teste {te.sum():,}")
        if k == "h1":  # hiperparâmetros escolhidos no horizonte principal e usados nos três
            busca = []
            for g in grade:
                p = M.hgb(**g).fit(X[tr_val], y[tr_val]).predict_proba(X[val])
                busca.append({"params": g, "log_loss": log_loss(y[val], p), "_p": p})
                _log(t0, f"  {g} -> log loss 2023 = {busca[-1]['log_loss']:.4f}")
            busca.sort(key=lambda b: b["log_loss"])
            params, p_val = busca[0]["params"], busca[0]["_p"]
            resumo["hiperparametros"] = params
            resumo["busca"] = [{"params": b["params"], "log_loss": _r(b["log_loss"])} for b in busca]
            resumo["n"] = {"treino": int(tr_val.sum()), "validacao": int(val.sum()), "teste": int(te.sum())}
        else:
            p_val = M.hgb(**params).fit(X[tr_val], y[tr_val]).predict_proba(X[val])
        limiar, _ = M.ajustar_limiar(p_val, y[val])

        modelo = M.hgb(**params).fit(X[tr], y[tr])
        p_te = modelo.predict_proba(X[te])
        y_te = y[te].to_numpy()
        info_te = info[te].reset_index(drop=True)
        cm = M.matriz_confusao(y_te, M.decidir(p_te, limiar))
        resumo["modelos"][k] = {
            "nome": nome,
            "limiar": limiar,
            **{m: _r(v) for m, v in M.metricas(y_te, p_te, limiar).items()},
            "pontos_operacao": [{c: _r(v) for c, v in d.items()} for d in M.pontos_operacao(y_te, p_te)],
            "confusao": [[_r(x, 2) for x in linha] for linha in cm.values],
        }
        resumo["mensal"][k] = _mensal(info_te, y_te, p_te, limiar)
        _log(t0, f"{nome}: limiar {limiar} | {resumo['modelos'][k]}")

        if k == "h1":
            prior = np.tile([1 - y[tr].mean(), y[tr].mean()], (len(y_te), 1))
            resumo["chute"] = {m: _r(v) for m, v in M.metricas(y_te, prior, 0.5).items()}
            # Quanto histórico de treino vale a pena (mesmos hiperparâmetros, mesmo teste)
            janelas = [(f"desde {a.desde}", tr), ("desde 2016", tr & (ano >= 2016)), ("só 2023", val)]
            for nome_j, m_j in janelas:
                if nome_j == "desde 2016" and a.desde >= 2016:
                    continue
                p_j = p_te if m_j is tr else M.hgb(**params).fit(X[m_j], y[m_j]).predict_proba(X[te])
                resumo["janelas"].append(
                    {
                        "janela": nome_j,
                        "voos_treino": int(m_j.sum()),
                        "pr_auc": _r(average_precision_score(y_te, p_j[:, 1])),
                        "log_loss": _r(log_loss(y_te, p_j)),
                    }
                )
                _log(t0, f"  janela {resumo['janelas'][-1]}")
            # Importância por permutação (amostra do teste)
            idx = np.random.default_rng(1).choice(np.flatnonzero(te), min(20_000, int(te.sum())), replace=False)
            imp = permutation_importance(
                modelo, X.iloc[idx], y.iloc[idx], scoring="neg_log_loss", n_repeats=2, random_state=0
            )
            imp = pd.Series(imp.importances_mean, index=X.columns).sort_values(ascending=False).head(20)
            resumo["importancia"] = [
                {"variavel": c, "descricao": DESCRICOES.get(c, c), "grupo": _grupo(c), "valor": _r(v, 5)}
                for c, v in imp.items()
            ]
            # Análise descritiva (todos os anos carregados)
            d = info.assign(
                atr=y.to_numpy(),
                hora=info["partida_prev"].dt.hour,
                mes=info["partida_prev"].dt.month,
                ano=ano,
                dia_semana=info["partida_prev"].dt.dayofweek,
            )
            condicoes = {
                "Todas as partidas": np.ones(len(d), bool),
                "IMC na origem": X["o_imc"].eq(1).to_numpy(),
                "Chuva na origem": X["o_chuva"].eq(1).to_numpy(),
                "Rajada ≥ 25 kt": X["o_rajada_kt"].ge(25).to_numpy(),
                "Trovoada na origem": X["o_trovoada"].eq(1).to_numpy(),
                "Abaixo dos mínimos": X["o_abaixo_minimos"].eq(1).to_numpy(),
                "Voo de chegada saiu > 30 min atrasado": X["chegada_atraso_conhecido"].gt(30).to_numpy(),
            }
            resumo["eda"] = {
                "por_hora": _taxa(d, "hora"),
                "por_aeroporto": _taxa(d, "origem"),
                "por_empresa": _taxa(d, "empresa"),
                "por_mes": _taxa(d, "mes"),
                "por_dia_semana": _taxa(d, "dia_semana"),
                "por_ano": _taxa(d, "ano"),
                "clima": [
                    {"chave": n, "taxa30": _r(d.loc[m, "atr"].mean()), "voos": int(m.sum())}
                    for n, m in condicoes.items()
                ],
            }
        # Demonstração do passageiro: out–dez/2025
        na_demo = (info_te["partida_prev"] >= INICIO_DEMO).to_numpy()
        demo[k] = {"p": np.rint(p_te[na_demo, 1] * 100).astype(int), "alerta": M.decidir(p_te[na_demo], limiar)}
        if k == "h1":
            demo["info"] = info_te[na_demo].reset_index(drop=True)
            demo["y"] = y_te[na_demo]
            demo["ctx"] = X[te].reset_index(drop=True)[na_demo].reset_index(drop=True)
        del X, y, info, modelo
        gc.collect()

    _gravar(resumo, demo)
    _log(t0, f"pronto: {SAIDA}")


def _gravar(resumo, demo):
    SAIDA.mkdir(parents=True, exist_ok=True)
    (SAIDA / "voos").mkdir(exist_ok=True)
    for f in (SAIDA / "voos").glob("*.json"):
        f.unlink()
    texto = json.dumps(resumo, ensure_ascii=False, allow_nan=False)
    (SAIDA / "resumo.json").write_text(texto, encoding="utf-8")
    (REPORTS_DIR / "modelo_final").mkdir(parents=True, exist_ok=True)
    (REPORTS_DIR / "modelo_final" / "resumo.json").write_text(
        json.dumps(resumo, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    it, xt = demo["info"], demo["ctx"]
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
    dias = it["dia"].dt.strftime("%Y-%m-%d").to_numpy()
    for dia in sorted(set(dias)):
        lista = []
        for i in np.flatnonzero(dias == dia):
            lista.append(
                {
                    "e": str(it.at[i, "empresa"]),
                    "n": str(it.at[i, "voo"]).lstrip("0"),
                    "o": str(it.at[i, "origem"]),
                    "d": str(it.at[i, "destino"]),
                    "h": it.at[i, "partida_prev"].strftime("%H:%M"),
                    "a": int(np.rint(it.at[i, "atraso_partida_min"])),
                    "f": int(demo["y"][i]),
                    "pv": int(demo["vespera"]["p"][i]),
                    "p3": int(demo["h3"]["p"][i]),
                    "p1": int(demo["h1"]["p"][i]),
                    "fv": int(demo["vespera"]["alerta"][i]),
                    "f3": int(demo["h3"]["alerta"][i]),
                    "f1": int(demo["h1"]["alerta"][i]),
                    "c": {c: _r(xt.at[i, col], 3) for c, col in ctx_cols.items()},
                }
            )
        lista.sort(key=lambda x: x["h"])
        (SAIDA / "voos" / f"{dia}.json").write_text(
            json.dumps(lista, ensure_ascii=False, separators=(",", ":"), allow_nan=False), encoding="utf-8"
        )
    indice = {
        "datas": sorted(set(dias)),
        "empresas": EMPRESAS,
        "aeroportos": AEROPORTOS,
        "limiares": {k: m["limiar"] for k, m in resumo["modelos"].items()},
    }
    (SAIDA / "indice.json").write_text(json.dumps(indice, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
