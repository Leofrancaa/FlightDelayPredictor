# Animação do totem (apresentação)

Curta em Three.js com o caso do Soussa no aeroporto. Publicado em `/totem` no site (arquivos em `web/public/totem/`).

- `src/config.js`: dados do voo, probabilidades, fatores e falas. Troque pelos valores reais do modelo.
- `src/main.js`: cenas, câmeras e direção. `src/airport.js`: cenário. `src/totem.js`: tela do totem.
- Personagens e lip sync: [TalkingHead](https://github.com/met4citizen/TalkingHead) (MIT), avatares de exemplo do mesmo projeto (uso não comercial).

## Vozes gravadas
Coloque os arquivos em `web/public/totem/audio/` com os nomes de `LINES` em `src/config.js` (`p1.mp3`…`p5.mp3`, `a1.mp3`…`a4.mp3`).
Sem arquivo, a página usa a voz sintética do navegador.

## Build
```
npm install
npm run build
```

## Pré-visualizar um quadro sem GPU
Sirva `web/public/totem` (ex.: `python -m http.server`) e abra `?scene=3&at=4` (cena 3, segundo 4).
