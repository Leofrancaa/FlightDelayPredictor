# Previsão de atraso de voos (EUA)

Modelo que estima a chance de uma partida atrasar mais de 30 min, previsto na véspera, 3 h e 1 h antes, nos 10 maiores aeroportos dos EUA. Dados: BTS On-Time Performance 2022–2024 (com a matrícula de cada avião e a causa de cada atraso) e METAR histórico do Iowa Environmental Mesonet (IEM).

## Setup

```bash
make requirements      # = uv sync: cria a .venv e instala o pacote module_decea
```

## Dados

Os dados brutos ficam na Release `dados-bts` do GitHub, gerados pelos workflows (aba Actions):

1. *Baixar BTS (EUA)*: um parquet por ano (`BTS_2022.parquet` ...), só os voos que tocam os 10 aeroportos.
2. *Baixar METAR (IEM)*: um zip por ano (`METAR_EUA_2022.zip` ...) com o METAR dos 10 aeroportos.

Para rodar local, baixe para `data/raw/bts/` e descompacte os CSVs do METAR em `data/raw/metar_eua/` (pasta ignorada pelo git).

## Modelo

`module_decea/exportar_web_eua.py` treina o modelo e exporta os dados do site para `web/public/data/` (`make treinar`, ou o workflow *Treinar modelo EUA*). Treino 2022, validação 2023 (limiar do alerta), teste 2024.

No teste, 1 h antes, atraso > 30 min: sem matrícula PR-AUC 0,42 (precisão 38%, recall 48%); com matrícula PR-AUC 0,64 (precisão 58%, recall 57%). O modelo com matrícula pega 79% dos atrasos por "avião chegou atrasado", mas só 32% dos atrasos da companhia (manutenção, tripulação, embarque), que somam 37% dos atrasos. Tempo de solo e folga calculados pela matrícula ficam de fora: a BTS grava o avião que de fato voou, e a troca de avião por causa de atraso vazava para o modelo.

`module_decea/experimento_bts.py` compara as versões sem/com matrícula (`make experimento`, resultado em `reports/bts/resumo.json`).

Como o modelo funciona (classificação, gradient boosting, validação temporal, métricas): [`docs/MODELO.md`](docs/MODELO.md).

As siglas e os termos técnicos (METAR, IMC, PR-AUC...) estão explicados em [`docs/glossario.md`](docs/glossario.md).

Outros comandos: `make test`, `make lint`, `make format`, `make clean` (`make` sozinho lista todos).

## Organização

```
├── .github/workflows  <- download dos dados (BTS, METAR) e treino na nuvem
├── data/raw           <- bts/, metar_eua/ (ignorado pelo git)
├── docs               <- glossario.md: siglas e termos técnicos
├── module_decea       <- código Python do projeto
│   ├── config.py           <- caminhos do projeto
│   ├── metar.py            <- decodificação de METAR
│   ├── modelagem.py        <- treino, limiar do alerta e métricas
│   ├── experimento_bts.py  <- leitura da BTS, variáveis e experimento sem/com matrícula
│   └── exportar_web_eua.py <- modelo final e JSON do site
├── reports            <- bts/ e eua/: métricas e logs do treino
├── tests
├── web                <- site Next.js
├── Makefile
└── pyproject.toml
```

## App web

`web/` tem um app Next.js (TypeScript + Tailwind) com duas áreas: **Meu voo**, onde o passageiro consulta um voo e vê o alerta de atraso, e **Análise do modelo**, com as métricas e a análise dos dados. Como rodar e publicar no Vercel: [`web/README.md`](web/README.md).
