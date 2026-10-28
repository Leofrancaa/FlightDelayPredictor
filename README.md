# Previsão de atraso de voos (EUA)

Modelo que responde, para cada partida, duas perguntas: **o voo vai atrasar (15 min ou mais)?** e, **se atrasar, passa de 30 min?** Previstas na véspera, 3 h e 1 h antes, nos 10 maiores aeroportos dos EUA. Dados: BTS On-Time Performance 2022–2024 (com a matrícula de cada avião e a causa de cada atraso) e METAR histórico do Iowa Environmental Mesonet (IEM).

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

`module_decea/exportar_web_eua.py` treina o modelo e exporta os dados do site para `web/public/data/` (`make treinar`, ou o workflow *Treinar modelo EUA*). Um classificador de 3 classes (< 15, 15–30, > 30 min) por horizonte; treino 2022, validação 2023 (limiares dos alertas), teste 2024.

No teste, 1 h antes: **vai atrasar?** PR-AUC 0,70 (chute 0,23), precisão 62%, recall 63%; **se atrasar, passa de 30 min?** PR-AUC 0,84 (chute 0,64, porque 64% dos atrasos já passam de 30 min). Sem a matrícula do avião, a PR-AUC da primeira pergunta cai para 0,51. O alerta de 1 h pega 89% dos atrasos por "avião chegou atrasado", mas só 42% dos atrasos da companhia (manutenção, tripulação, embarque), que somam 39% dos atrasos. Tempo de solo e folga calculados pela matrícula ficam de fora: a BTS grava o avião que de fato voou, e a troca de avião por causa de atraso vazava para o modelo.

`module_decea/experimento_bts.py` é um experimento à parte, só com "> 30 min?", que compara as versões sem/com matrícula (`make experimento`, resultado em `reports/bts/resumo.json`).

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
│   ├── modelagem.py        <- treino, limiares dos alertas e métricas
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
