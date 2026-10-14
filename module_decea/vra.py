"""Leitura do VRA (Voo Regular Ativo) da ANAC: siros.anac.gov.br/siros/registros/diversos/vra/

Os arquivos ficam em data/raw/vra/ como CSV mensal (VRA_2025_01.csv) ou como zip anual com os CSVs dentro
(VRA_2014.zip, gerado pelo workflow "Baixar VRA da ANAC"). Os dois formatos são lidos direto, sem descompactar.
"""

import io
from pathlib import Path
import re
import zipfile

import pandas as pd

from module_decea.config import RAW_DATA_DIR

COLUNAS = {
    "Sigla ICAO Empresa Aérea": "empresa",
    "Número Voo": "voo",
    "Código DI": "di",
    "Código Tipo Linha": "tipo_linha",
    "Modelo Equipamento": "aeronave",
    "Número de Assentos": "assentos",
    "Sigla ICAO Aeroporto Origem": "origem",
    "Partida Prevista": "partida_prev",
    "Partida Real": "partida_real",
    "Sigla ICAO Aeroporto Destino": "destino",
    "Chegada Prevista": "chegada_prev",
    "Chegada Real": "chegada_real",
    "Situação Voo": "situacao",
}
FMT = "%d/%m/%Y %H:%M"
RE_ARQUIVO = re.compile(r"VRA_(\d{4})_(\d{2})\.csv$", re.IGNORECASE)


def arquivos_vra(anos=None, pasta=RAW_DATA_DIR / "vra"):
    """Lista (nome, função que devolve os bytes) dos CSVs mensais, soltos ou dentro dos zips anuais.

    Se o mesmo mês existir solto e dentro de um zip, vale o CSV solto.
    """
    achados = {}
    for z in sorted(Path(pasta).glob("VRA_*.zip")):
        with zipfile.ZipFile(z) as zf:
            for nome in zf.namelist():
                if m := RE_ARQUIVO.search(nome):
                    achados[Path(nome).name] = (int(m[1]), lambda z=z, nome=nome: _ler_do_zip(z, nome))
    for f in sorted(Path(pasta).glob("VRA_*.csv")):
        if m := RE_ARQUIVO.search(f.name):
            achados[f.name] = (int(m[1]), lambda f=f: f.read_bytes())
    return [(nome, abrir) for nome, (ano, abrir) in sorted(achados.items()) if anos is None or ano in anos]


def _ler_do_zip(z, nome):
    with zipfile.ZipFile(z) as zf:
        return zf.read(nome)


def carregar_vra(anos=(2025,), filtro=None, pasta=RAW_DATA_DIR / "vra"):
    """Lê o VRA dos anos pedidos (None = todos os arquivos da pasta).

    `filtro(df) -> máscara` é aplicado em cada mês logo após a leitura, antes de converter datas. Com vários anos
    isso evita carregar milhões de linhas que seriam descartadas (voos internacionais, outros aeroportos...).
    """
    partes = []
    for _, ler in arquivos_vra(anos, pasta):
        df = pd.read_csv(io.BytesIO(ler()), sep=";", dtype=str, usecols=list(COLUNAS), encoding="utf-8")
        df = df.rename(columns=COLUNAS)
        if filtro is not None:
            df = df[filtro(df)]
        if len(df):
            partes.append(_tipar(df))  # datas e números já convertidos: bem menos memória que texto
    df = pd.concat(partes, ignore_index=True)
    df["cancelado"] = df["situacao"].eq("CANCELADO")
    df["atraso_partida_min"] = (df["partida_real"] - df["partida_prev"]).dt.total_seconds() / 60
    df["atraso_chegada_min"] = (df["chegada_real"] - df["chegada_prev"]).dt.total_seconds() / 60
    # Critério da ANAC nos relatórios de pontualidade: atraso acima de 30 minutos
    df["atrasado_30"] = df["atraso_partida_min"] > 30
    return df


def _tipar(df):
    df = df.copy()
    for c in ["partida_prev", "partida_real", "chegada_prev", "chegada_real"]:
        df[c] = pd.to_datetime(df[c], format=FMT, errors="coerce")
    df["assentos"] = pd.to_numeric(df["assentos"], errors="coerce")
    return df


def voos_regulares_domesticos(df):
    """Só voos regulares (DI = 0) de linha doméstica de passageiros (tipo N), com horário previsto."""
    return df[(df["di"] == "0") & (df["tipo_linha"] == "N") & df["partida_prev"].notna()].copy()
