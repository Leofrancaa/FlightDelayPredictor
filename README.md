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

3. `03_modelo_atraso.ipynb`: primeira versão do modelo (faixas de atraso, só 2025). Mantido como histórico.
4. `04_modelo_final.ipynb`: modelo final, **binário**: a partida atrasa mais de 30 min? Previsto na véspera, 3 h e 1 h antes. Dados de 2011 a 2025 (sem os períodos anômalos), treino até 2022, validação 2023 (hiperparâmetros e limiar do alerta), teste 2024–2025. Lê `reports/modelo_final/resumo.json`, gerado por `uv run python -m module_decea.exportar_web` (ou pelo workflow *Treinar modelo final* no GitHub Actions). Variáveis em `module_decea/features.py`, métricas em `module_decea/modelagem.py`.

5. **Experimento BTS (EUA)**: `module_decea/experimento_bts.py` testa quanto vale saber qual avião faz cada voo (matrícula, que o VRA não tem). Mesmo tipo de modelo nos 10 maiores aeroportos dos EUA, treino 2022, validação 2023, teste 2024. Resultado (1 h antes, atraso > 30 min): sem matrícula PR-AUC 0,41, precisão 37%, recall 48%; com matrícula PR-AUC 0,72, precisão 69%, recall 60%. Por causa do atraso (informada pela BTS depois do voo), o modelo com matrícula pega 84% dos atrasos por "avião chegou atrasado", mas só 34% dos atrasos da companhia (manutenção, tripulação, embarque). Resumo em `reports/bts/resumo.json`; dados via workflows *Baixar BTS (EUA)* e *Experimento BTS (EUA)*.

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
