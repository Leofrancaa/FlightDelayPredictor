"""Gera as falas do Soussa clonando a voz de uma gravação de referência (XTTS-v2, roda local).

Uso (na raiz do repositório, de preferência num PC com GPU NVIDIA):
    pip install coqui-tts            # Python 3.10–3.12; baixa o modelo (~2 GB) na 1ª execução
    python apresentacao/totem/clonar_voz.py referencia.wav            # gera p1..p5
    python apresentacao/totem/clonar_voz.py referencia.wav --quem att  # (opcional) outra voz p/ a atendente

Para escolher a melhor versão de cada fala:
    python apresentacao/totem/clonar_voz.py ref_bruta*.wav --takes 3
  depois renomeie a escolhida para p1.mp3 etc. e apague as outras.

Dicas para a referência: 10 a 30 s de fala limpa, sem música nem eco, uma pessoa só.
Pode passar vários arquivos: clonar_voz.py a.wav b.wav c.wav
Use só a voz de quem autorizou.
"""
import argparse, re, shutil, subprocess
from pathlib import Path

AQUI = Path(__file__).resolve().parent
SAIDA = AQUI.parents[1] / "web" / "public" / "totem" / "audio"


def falas(quem):
    js = (AQUI / "src" / "config.js").read_text(encoding="utf-8")
    padrao = r"(\w+): \{ who: '(\w+)', audio: '([\w.]+)', text: '((?:[^'\\]|\\.)*)' \}"
    return [(m[2], m[3].replace("\\'", "'").replace("…", "...")) for m in re.findall(padrao, js) if m[1] == quem]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("referencia", nargs="+", help="áudio(s) de referência da voz")
    ap.add_argument("--quem", default="prof", choices=["prof", "att"])
    ap.add_argument("--falas", nargs="*", help="só estas falas, ex.: p1 p4")
    ap.add_argument("--takes", type=int, default=1, help="gera N versões de cada fala (p1_take1.mp3…) para escolher a melhor")
    ap.add_argument("--temperatura", type=float, default=0.8, help="mais alto = mais expressivo e variado (0.6–0.9)")
    args = ap.parse_args()

    import torch
    from TTS.api import TTS

    dev = "cuda" if torch.cuda.is_available() else "cpu"
    print("usando", dev)
    tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(dev)
    SAIDA.mkdir(parents=True, exist_ok=True)
    ffmpeg = shutil.which("ffmpeg")
    for arquivo, texto in falas(args.quem):
        if args.falas and arquivo.split(".")[0] not in args.falas:
            continue
        for k in range(1, args.takes + 1):
            nome = arquivo if args.takes == 1 else arquivo.replace(".mp3", f"_take{k}.mp3")
            wav = SAIDA / nome.replace(".mp3", ".wav")
            tts.tts_to_file(text=texto, speaker_wav=args.referencia, language="pt", file_path=str(wav),
                            temperature=args.temperatura, top_p=0.85, top_k=50, repetition_penalty=5.0,
                            speed=1.0, enable_text_splitting=False)
            if ffmpeg:  # mp3 é bem menor; sem ffmpeg o site usa o .wav mesmo
                subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-i", str(wav), "-b:a", "128k", str(SAIDA / nome)], check=True)
                wav.unlink()
            print("ok", nome, "-", texto[:50])


if __name__ == "__main__":
    main()
