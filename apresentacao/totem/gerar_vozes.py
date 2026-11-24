"""Gera as falas com vozes neurais (Microsoft Edge TTS, grátis) em web/public/totem/audio.

Uso (na raiz do repositório):
    pip install edge-tts
    python apresentacao/totem/gerar_vozes.py            # todas as falas
    python apresentacao/totem/gerar_vozes.py --so att    # só a atendente (quando o Soussa tiver áudio gravado)
"""
import argparse, asyncio, re
from pathlib import Path

import edge_tts

AQUI = Path(__file__).resolve().parent
SAIDA = AQUI.parents[1] / "web" / "public" / "totem" / "audio"
VOZES = {
    "prof": dict(voice="pt-BR-AntonioNeural", rate="-6%", pitch="-6Hz"),
    "att": dict(voice="pt-BR-FranciscaNeural", rate="+0%", pitch="+0Hz"),
}

def falas():
    js = (AQUI / "src" / "config.js").read_text(encoding="utf-8")
    padrao = r"(\w+): \{ who: '(\w+)', audio: '([\w.]+)', text: '((?:[^'\\]|\\.)*)' \}"
    return [dict(id=m[0], who=m[1], arquivo=m[2], texto=m[3].replace("\\'", "'")) for m in re.findall(padrao, js)]

async def main(so):
    SAIDA.mkdir(parents=True, exist_ok=True)
    for f in falas():
        if so and f["who"] != so:
            continue
        await edge_tts.Communicate(f["texto"], **VOZES[f["who"]]).save(str(SAIDA / f["arquivo"]))
        print("ok", f["arquivo"], "-", f["texto"][:50])

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--so", choices=["prof", "att"])
    asyncio.run(main(ap.parse_args().so))
