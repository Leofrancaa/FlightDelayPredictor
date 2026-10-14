"""Download com cache local (pasta data/raw/) das três fontes usadas no notebook 02."""

from datetime import UTC, datetime
import time

import pandas as pd
import requests

from module_decea.aisweb import aisweb, itens, listar_paginado, para_df
from module_decea.config import RAW_DATA_DIR
from module_decea.vra import arquivos_vra

# Rotas da AISWEB usadas na exploração. A coluna "link" das cartas contém a apiKey e nunca é salva.
ROTAS_AISWEB = {
    "localidades": lambda: para_df(itens(aisweb("localidades"))),
    "notam": lambda: para_df(itens(aisweb("notam"))),
    "cartas": lambda: para_df(itens(aisweb("cartas"))).drop(columns=["link"], errors="ignore"),
    "rotaer_lista": lambda: para_df(listar_paginado("rotaer")),
}


def baixar_aisweb(forcar=False):
    """Retrato do momento: NOTAMs vigentes, cartas e aeródromos. Rodar de novo outro dia dá outro retrato."""
    pasta = RAW_DATA_DIR / "aisweb"
    pasta.mkdir(parents=True, exist_ok=True)
    for nome, fn in ROTAS_AISWEB.items():
        destino = pasta / f"{nome}.csv"
        if forcar or not destino.exists():
            fn().to_csv(destino, index=False)
            print("baixado:", destino)


def coletar_notam():
    """Um retrato dos NOTAMs vigentes por chamada, com a hora da coleta. Agendado (1x por dia já basta), vira histórico."""
    pasta = RAW_DATA_DIR / "notam_coleta"
    pasta.mkdir(parents=True, exist_ok=True)
    agora = datetime.now(UTC)
    df = para_df(itens(aisweb("notam")))
    df.insert(0, "coletado_em", agora.strftime("%Y-%m-%d %H:%M"))
    destino = pasta / f"{agora:%Y-%m-%d_%H%M}.csv.gz"
    df.to_csv(destino, index=False)
    print(f"{agora:%Y-%m-%d %H:%M} UTC: {len(df)} NOTAMs em {destino.name}")


def historico_notam(pasta=RAW_DATA_DIR / "notam_coleta"):
    """Junta as coletas: uma linha por NOTAM (id), com a primeira e a última coleta em que ele aparecia.

    A rota notam não traz os NOTAMC (cancelamentos), só N e R. Um NOTAM que some antes do fim previsto (campo c)
    foi cancelado ou substituído (o substituto aponta para ele em ref_id). Os da última coleta ficam com ainda_vigente.
    """
    coletas = pd.concat([pd.read_csv(f, dtype=str) for f in sorted(pasta.glob("*.csv.gz"))], ignore_index=True)
    coletas["coletado_em"] = pd.to_datetime(coletas["coletado_em"])
    visto = coletas.groupby("id")["coletado_em"].agg(visto_primeiro="min", visto_ultimo="max", coletas="size")
    hist = coletas.drop_duplicates("id", keep="last").set_index("id").drop(columns="coletado_em").join(visto)
    hist["ainda_vigente"] = hist["visto_ultimo"] == coletas["coletado_em"].max()
    return hist


def baixar_metar_iem(estacoes, ano):
    """METAR histórico do Iowa Environmental Mesonet (espelho público dos boletins do GTS)."""
    pasta = RAW_DATA_DIR / "metar"
    pasta.mkdir(parents=True, exist_ok=True)
    for icao in estacoes:
        destino = pasta / f"{icao}_{ano}.csv"  # um arquivo por ano, para poder juntar vários anos
        antigo = pasta / f"{icao}.csv"  # formato antigo (só 2025), mantido para não baixar de novo
        if destino.exists() or (ano == 2025 and antigo.exists()):
            continue
        url = (
            "https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py"
            f"?station={icao}&data=metar&year1={ano}&month1=1&day1=1&year2={ano + 1}&month2=1&day2=1"
            "&tz=Etc/UTC&format=onlycomma&latlon=no&missing=M&trace=T&direct=no&report_type=3&report_type=4"
        )
        resp = requests.get(url, timeout=300)
        resp.raise_for_status()
        destino.write_bytes(resp.content)
        print("baixado:", destino)
        time.sleep(2)  # o IEM pede uso moderado


def baixar_vra(ano, meses=range(1, 13)):
    """VRA da ANAC: um CSV por mês (~25 MB cada). Pula o que já existe, solto ou dentro do zip do ano."""
    pasta = RAW_DATA_DIR / "vra"
    pasta.mkdir(parents=True, exist_ok=True)
    ja_tem = {nome for nome, _ in arquivos_vra(anos=(ano,), pasta=pasta)}
    for mes in meses:
        destino = pasta / f"VRA_{ano}_{mes:02d}.csv"
        if destino.name in ja_tem:
            continue
        url = f"https://siros.anac.gov.br/siros/registros/diversos/vra/{ano}/{destino.name}"
        resp = requests.get(url, timeout=600)
        resp.raise_for_status()
        destino.write_bytes(resp.content)
        print("baixado:", destino)
