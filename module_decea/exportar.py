"""Exporta a base voo x clima (a mesma do notebook 02, seção 7-8) em CSV para visualizar fora do Python.

Uso (na raiz do projeto):
    uv run python -m module_decea.exportar            # baixa o que faltar e exporta
    uv run python -m module_decea.exportar --amostra 50000

Saída em data/processed/:
    voos_clima_2025.csv          base completa (separador ",", decimal ".") -> pandas, Power BI, etc.
    voos_clima_2025_excel.csv    amostra aleatória no padrão do Excel em português (";" e decimal ",")
    dicionario_colunas.csv       o que significa cada coluna
"""

import argparse

import pandas as pd

from module_decea.config import PROCESSED_DATA_DIR, RAW_DATA_DIR
from module_decea.dataset import baixar_metar_iem, baixar_vra
from module_decea.metar import carregar_iem
from module_decea.vra import carregar_vra, voos_regulares_domesticos

AEROPORTOS = ["SBGR", "SBSP", "SBKP", "SBCF", "SBBR", "SBGL", "SBRJ", "SBPA", "SBCT", "SBRF"]
COLS_CLIMA = ["imc", "abaixo_minimos", "trovoada", "nevoeiro", "chuva", "vis_m", "teto_ft", "vento_kt", "rajada_kt"]

DESC_CLIMA = {
    "imc": "1 = condição por instrumentos (visibilidade < 5 km ou teto < 1500 ft)",
    "abaixo_minimos": "1 = abaixo dos mínimos de pouso (visibilidade < 800 m ou teto < 200 ft)",
    "trovoada": "1 = trovoada no METAR",
    "nevoeiro": "1 = nevoeiro no METAR",
    "chuva": "1 = chuva no METAR",
    "vis_m": "visibilidade em metros (9999 = 10 km ou mais)",
    "teto_ft": "teto em pés (99999 = sem teto)",
    "vento_kt": "vento médio em nós",
    "rajada_kt": "rajada em nós (vazio = sem rajada)",
}
DICIONARIO = (
    {
        "empresa": "sigla ICAO da companhia aérea",
        "voo": "número do voo",
        "origem": "aeroporto de origem (ICAO)",
        "destino": "aeroporto de destino (ICAO)",
        "aeronave": "modelo do equipamento",
        "assentos": "número de assentos",
        "situacao": "situação do voo no VRA (REALIZADO, CANCELADO...)",
        "partida_prev": "partida prevista (horário de Brasília)",
        "partida_real": "partida real (horário de Brasília)",
        "chegada_prev": "chegada prevista (horário de Brasília)",
        "chegada_real": "chegada real (horário de Brasília)",
        "atraso_partida_min": "partida real - prevista, em minutos",
        "atraso_chegada_min": "chegada real - prevista, em minutos",
        "atrasado_30": "ALVO: 1 = partida com mais de 30 min de atraso (critério ANAC)",
        "cancelado": "ALVO: 1 = voo cancelado",
        "mes": "mês da partida prevista",
        "dia_semana": "0 = segunda ... 6 = domingo",
        "hora": "hora da partida prevista (Brasília)",
        "hora_utc": "hora cheia da partida prevista em UTC (chave de junção com o METAR)",
        "partidas_previstas_hora": "partidas previstas na origem nessa mesma hora",
        "atraso_origem_lag2": "% de partidas atrasadas na origem 2 h antes (propagação)",
        "atraso_origem_lag3": "% de partidas atrasadas na origem 3 h antes (propagação)",
    }
    | {f"o_{c}": f"ORIGEM na hora da partida: {d}" for c, d in DESC_CLIMA.items()}
    | {f"d_{c}": f"DESTINO na hora da partida: {d}" for c, d in DESC_CLIMA.items()}
)


def montar_base(ano=2025):
    """Voos regulares domésticos saindo dos 10 aeroportos + METAR da origem e do destino + atraso recente."""
    baixar_metar_iem(AEROPORTOS, ano)
    baixar_vra(ano)

    metar = pd.concat([carregar_iem(RAW_DATA_DIR / f"metar/{icao}.csv") for icao in AEROPORTOS], ignore_index=True)
    metar = metar[~metar["speci"]]  # só METAR de hora cheia, como no notebook

    v = voos_regulares_domesticos(carregar_vra())
    v = v[v["origem"].isin(AEROPORTOS)].copy()
    v["mes"] = v["partida_prev"].dt.month
    v["dia_semana"] = v["partida_prev"].dt.dayofweek
    v["hora"] = v["partida_prev"].dt.hour
    # VRA está em horário de Brasília (ver notebook 02, seção 6) -> +3 h para casar com o METAR em UTC
    v["hora_utc"] = (v["partida_prev"] + pd.Timedelta(hours=3)).dt.floor("h")

    w = metar[["icao", "hora_utc"] + COLS_CLIMA]
    for lado, chave in [("o", "origem"), ("d", "destino")]:
        v = v.merge(
            w.rename(columns={c: f"{lado}_{c}" for c in COLS_CLIMA} | {"icao": chave}),
            on=[chave, "hora_utc"],
            how="left",
        )

    taxa = v.groupby(["origem", "hora_utc"])["atrasado_30"].mean().rename("taxa").reset_index()
    for lag in [2, 3]:
        t = taxa.assign(hora_utc=taxa["hora_utc"] + pd.Timedelta(hours=lag)).rename(
            columns={"taxa": f"atraso_origem_lag{lag}"}
        )
        v = v.merge(t, on=["origem", "hora_utc"], how="left")
    v["partidas_previstas_hora"] = v.groupby(["origem", "hora_utc"])["voo"].transform("size")

    for c in [f"atraso_origem_lag{lag}" for lag in (2, 3)]:
        v[c] = (v[c] * 100).round(1)
    for c in ["atraso_partida_min", "atraso_chegada_min"]:
        v[c] = v[c].round(0).astype("Int64")
    # Flags viram 0/1 e medidas viram inteiros, com vazio onde não há METAR (legível no Excel, numérico no pandas)
    for c in ["atrasado_30", "cancelado"] + [f"{lado}_{c}" for lado in "od" for c in COLS_CLIMA]:
        v[c] = v[c].astype(float).round().astype("Int64")

    return v[list(DICIONARIO)].sort_values(["partida_prev", "origem"]).reset_index(drop=True)


def exportar(ano=2025, amostra=20000):
    PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)
    base = montar_base(ano)

    completo = PROCESSED_DATA_DIR / f"voos_clima_{ano}.csv"
    base.to_csv(completo, index=False, date_format="%Y-%m-%d %H:%M")

    excel = PROCESSED_DATA_DIR / f"voos_clima_{ano}_excel.csv"
    amos = base.sample(min(amostra, len(base)), random_state=0).sort_values("partida_prev")
    amos.to_csv(excel, index=False, sep=";", decimal=",", encoding="utf-8-sig", date_format="%d/%m/%Y %H:%M")

    dic = PROCESSED_DATA_DIR / "dicionario_colunas.csv"
    pd.DataFrame(DICIONARIO.items(), columns=["coluna", "descricao"]).to_csv(
        dic, index=False, sep=";", encoding="utf-8-sig"
    )

    print(
        f"{len(base):,} voos | atraso > 30 min {base['atrasado_30'].mean():.1%} | "
        f"cancelados {base['cancelado'].mean():.1%}".replace(",", ".")
    )
    for f in (completo, excel, dic):
        print(f"salvo: {f} ({f.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--ano", type=int, default=2025)
    p.add_argument("--amostra", type=int, default=20000, help="linhas do CSV para Excel (padrão 20000)")
    a = p.parse_args()
    exportar(a.ano, a.amostra)
