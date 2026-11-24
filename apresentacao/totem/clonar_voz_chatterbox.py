"""Gera as falas do Soussa clonando a voz com o Chatterbox Multilingual (Resemble AI, MIT, roda local).

Instale num ambiente separado (o chatterbox fixa versões de torch/transformers):
    python -m venv .venv-cb
    .venv-cb\\Scripts\\activate                      (Windows)   |   source .venv-cb/bin/activate  (Linux/Mac)
    pip install torch==2.6.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cu124
    pip install chatterbox-tts==0.1.7

Uso (na raiz do repositório):
    python apresentacao/totem/clonar_voz_chatterbox.py ref_bruta1.wav --takes 3
    python apresentacao/totem/clonar_voz_chatterbox.py ref_bruta1.wav --falas p4 --emocao 0.7

A referência deve ter de 10 a 20 s de fala limpa (o modelo usa até ~10 s).
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
    ap.add_argument("referencia", help="áudio de referência da voz (wav)")
    ap.add_argument("--quem", default="prof", choices=["prof", "att"])
    ap.add_argument("--falas", nargs="*", help="só estas falas, ex.: p1 p4")
    ap.add_argument("--takes", type=int, default=1, help="gera N versões de cada fala para escolher a melhor")
    ap.add_argument("--emocao", type=float, default=0.55, help="exagero emocional 0.25–1.0 (padrão 0.55)")
    ap.add_argument("--ritmo", type=float, default=0.45, help="cfg_weight: mais baixo = fala mais pausada (0.2–0.7)")
    ap.add_argument("--temperatura", type=float, default=0.8)
    args = ap.parse_args()

    import torch, torchaudio as ta
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS

    dev = "cuda" if torch.cuda.is_available() else "cpu"
    print("usando", dev)
    model = ChatterboxMultilingualTTS.from_pretrained(device=dev)
    SAIDA.mkdir(parents=True, exist_ok=True)
    ffmpeg = shutil.which("ffmpeg")
    for arquivo, texto in falas(args.quem):
        if args.falas and arquivo.split(".")[0] not in args.falas:
            continue
        for k in range(1, args.takes + 1):
            nome = arquivo if args.takes == 1 else arquivo.replace(".mp3", f"_take{k}.mp3")
            wav = SAIDA / nome.replace(".mp3", ".wav")
            audio = model.generate(texto, language_id="pt", audio_prompt_path=args.referencia,
                                   exaggeration=args.emocao, cfg_weight=args.ritmo, temperature=args.temperatura)
            ta.save(str(wav), audio, model.sr)
            if ffmpeg:  # mp3 é bem menor; sem ffmpeg o site usa o .wav mesmo
                subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-i", str(wav), "-b:a", "128k", str(SAIDA / nome)], check=True)
                wav.unlink()
            print("ok", nome, "-", texto[:50])


if __name__ == "__main__":
    main()
