"""Decodificação simplificada de METAR: só os campos usados nas análises."""
import re

import numpy as np
import pandas as pd

RE_VENTO = re.compile(r"\b(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT\b")
RE_VIS = re.compile(r"\s(\d{4})(?:\s|$)")
RE_NUVEM = re.compile(r"\b(FEW|SCT|BKN|OVC|VV)(\d{3}|///)")
RE_TEMP = re.compile(r"\s(M?\d{2})/(M?\d{2})\s")
RE_QNH = re.compile(r"\bQ(\d{4})\b")
# EUA: visibilidade em milhas terrestres ("10SM", "1/2SM", "1 1/2SM", "M1/4SM") e altímetro em polegadas ("A3021")
RE_VIS_SM = re.compile(r"\s(?:(\d+)\s)?M?(?:(\d+)/(\d+)|(\d+))SM\b")
RE_ALTIMETRO = re.compile(r"\bA(\d{4})\b")


def _temp(t):
    return -int(t[1:]) if t.startswith("M") else int(t)


def decodificar(metar):
    corpo = metar.split(" RMK")[0].split(" TEMPO")[0].split(" BECMG")[0]
    d = {"vento_dir": np.nan, "vento_kt": np.nan, "rajada_kt": np.nan, "vis_m": np.nan,
         "teto_ft": np.nan, "temp_c": np.nan, "orvalho_c": np.nan, "qnh": np.nan}
    if m := RE_VENTO.search(corpo):
        d["vento_dir"] = np.nan if m[1] == "VRB" else int(m[1])
        d["vento_kt"] = int(m[2])
        d["rajada_kt"] = int(m[3]) if m[3] else np.nan
    if "CAVOK" in corpo:
        d["vis_m"], d["teto_ft"] = 9999, 99999
    elif m := RE_VIS_SM.search(corpo):
        milhas = (int(m[1]) if m[1] else 0) + (int(m[2]) / int(m[3]) if m[2] else int(m[4]))
        d["vis_m"] = min(round(milhas * 1609.34), 9999)  # mesma escala do Brasil: 9999 = 10 km ou mais
    elif m := RE_VIS.search(corpo):
        d["vis_m"] = int(m[1])
    # Teto = camada BKN/OVC/VV mais baixa (em pés). Sem camada assim, céu "ilimitado".
    tetos = [int(h) * 100 for c, h in RE_NUVEM.findall(corpo) if c in ("BKN", "OVC", "VV") and h != "///"]
    if "CAVOK" not in corpo:
        d["teto_ft"] = min(tetos) if tetos else 99999
    if m := RE_TEMP.search(corpo + " "):
        d["temp_c"], d["orvalho_c"] = _temp(m[1]), _temp(m[2])
    if m := RE_QNH.search(corpo):
        d["qnh"] = int(m[1])
    elif m := RE_ALTIMETRO.search(corpo):
        d["qnh"] = round(int(m[1]) / 100 * 33.8639)  # inHg -> hPa
    for fen, padrao in {"trovoada": r"\b[+-]?(?:VC)?TS", "chuva": r"\b[+-]?(?:SH|TS)?RA\b|\b[+-]?(?:SH|TS)RA",
                        "nevoeiro": r"\b(?:MI|BC|PR)?FG\b", "nevoa": r"\bBR\b", "cb": r"\d{3}CB\b"}.items():
        d[fen] = bool(re.search(padrao, corpo))
    return d


def carregar_iem(caminho):
    """Lê o CSV do IEM (station, valid, metar) e devolve um DataFrame decodificado."""
    bruto = pd.read_csv(caminho)
    bruto = bruto[~bruto["metar"].str.contains(" NIL", na=True)]
    df = pd.DataFrame([decodificar(m) for m in bruto["metar"]], index=bruto.index)
    df.insert(0, "hora_utc", pd.to_datetime(bruto["valid"]))
    df.insert(0, "icao", bruto["station"])
    # O IEM tira o prefixo METAR/SPECI. Boletins fora da hora cheia são SPECI (emitidos quando o tempo muda).
    df["speci"] = df["hora_utc"].dt.minute != 0
    # Regra VMC do ICA 100-12 para aeródromo controlado: visibilidade >= 5 km e teto >= 1500 ft
    df["imc"] = (df["vis_m"] < 5000) | (df["teto_ft"] < 1500)
    df["abaixo_minimos"] = (df["vis_m"] < 800) | (df["teto_ft"] < 200)  # ~ mínimos ILS CAT I
    return df
