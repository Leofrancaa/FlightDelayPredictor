# Exploração da API AISWEB (DECEA)

Notebooks para explorar as rotas da API do [AISWEB](https://aisweb.decea.mil.br/), o portal de informação aeronáutica do DECEA, e procurar uma situação-problema de ML cruzando esses dados com METAR histórico (IEM) e os voos da ANAC (VRA).

## Setup

```bash
make requirements      # = uv sync: cria a .venv e instala o pacote module_decea
cp .env.example .env   # e preencha AISWEB_API_KEY e AISWEB_API_PASS
```

Depois abra os notebooks em `notebooks/` e selecione o kernel `.venv`:

1. `01_explorar_aisweb.ipynb`: mapa das rotas da API AISWEB.
2. `02_insights_ml.ipynb`: exploração dos dados em busca de uma situação-problema de ML. Cruza a AISWEB com METAR histórico (IEM) e os voos da ANAC (VRA) de 2025. Na primeira execução baixa ~330 MB para `data/raw/` (pasta ignorada pelo git).

3. `03_modelo_atraso.ipynb`: modelo que prevê a **faixa de atraso** da partida (até 15 min, 15–30, 30–60, > 60) na véspera e 3 h antes do voo. Gradient boosting em árvores, validação temporal (treino jan–set, teste out–dez). Variáveis em `module_decea/features.py`, treino e métricas em `module_decea/modelagem.py`.

As siglas e os termos técnicos dos notebooks (METAR, NOTAM, IMC, PR-AUC...) estão explicados em [`docs/glossario.md`](docs/glossario.md).

Outros comandos: `make test`, `make lint`, `make format`, `make clean` (`make` sozinho lista todos).

## Coleta diária de NOTAMs

A AISWEB só mostra os NOTAMs vigentes agora. Para montar um histórico:

```bash
make agendar_notam                 # cron todo dia às 9h; outro horário: make agendar_notam NOTAM_HORA=12
make desagendar_notam              # tira do cron
tail ~/Library/Logs/decea-coleta-notam.log
```

Cada coleta salva um retrato em `data/raw/notam_coleta/`. No fim, `historico_notam()` (em `module_decea/dataset.py`) junta os retratos em uma linha por NOTAM, com a primeira e a última coleta em que ele apareceu. Se o computador estiver desligado ou dormindo no horário, o cron pula aquele dia.

## Organização

```
├── data
│   ├── external       <- PDFs de cartas baixados no notebook 01
│   ├── interim        <- dados intermediários, já transformados
│   ├── processed      <- bases finais para modelagem
│   └── raw            <- downloads originais: aisweb/, metar/, vra/, notam_coleta/
├── docs               <- glossario.md: siglas e termos técnicos
├── models             <- modelos treinados
├── module_decea       <- código Python do projeto
│   ├── config.py      <- caminhos do projeto e leitura do .env
│   ├── aisweb.py      <- cliente da API AISWEB
│   ├── dataset.py     <- downloads com cache (AISWEB, METAR/IEM, VRA/ANAC) e coleta de NOTAMs
│   ├── metar.py       <- decodificação de METAR
│   └── vra.py         <- leitura do VRA
├── notebooks          <- numerados na ordem de leitura
├── references         <- dicionários de dados, manuais, ICAs
├── reports
│   └── figures        <- gráficos gerados para o relatório
├── tests
├── .env.example
├── Makefile
└── pyproject.toml
```

## Rotas disponíveis

`localidades`, `rotaer`, `met`, `sol`, `notam`, `cartas`, `suplementos`, `infotemp`, `pub` e `waypoints`. O notebook 01 detalha os parâmetros de cada uma.

> Os links de download das cartas contêm a `apiKey`. Limpe os outputs do notebook antes de commitar.

## App web

`web/` tem um app Next.js (TypeScript + Tailwind) com duas áreas: **Meu voo**, onde o passageiro consulta um voo e vê o alerta de atraso, e **Análise do modelo**, com as métricas e a análise dos dados. Os dados do app são gerados com `uv run python -m module_decea.exportar_web`. Como rodar e publicar no Vercel: [`web/README.md`](web/README.md).
