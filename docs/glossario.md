# Glossário

Siglas e termos técnicos que aparecem no `module_decea` e no site. Agrupados por tema; para achar uma sigla, use a busca do editor (Cmd/Ctrl+F).

1. [Fontes de dados e órgãos](#1-fontes-de-dados-e-órgãos)
2. [Os 10 aeroportos do projeto](#2-os-10-aeroportos-do-projeto)
3. [Condições de voo](#3-condições-de-voo)
4. [Meteorologia: METAR](#4-meteorologia-metar)
5. [Voos e a BTS](#5-voos-e-a-bts)
6. [Machine learning](#6-machine-learning)
7. [Nomes de colunas e variáveis do código](#7-nomes-de-colunas-e-variáveis-do-código)
8. [Unidades e horários](#8-unidades-e-horários)

---

## 1. Fontes de dados e órgãos

| Termo | Significado |
|---|---|
| **BTS** | *Bureau of Transportation Statistics*, do Departamento de Transportes dos EUA. Publica o *On-Time Performance*: todos os voos domésticos das grandes companhias, com horários previstos e reais, matrícula e causa dos atrasos. Ver [seção 5](#5-voos-e-a-bts). |
| **FAA** | *Federal Aviation Administration*, autoridade de aviação civil dos EUA. Opera o controle de tráfego aéreo (o *NAS*). |
| **IEM** | *Iowa Environmental Mesonet*, da Iowa State University. Arquivo público com METAR histórico de aeroportos do mundo todo. É a fonte de METAR do projeto. |
| **ICAO** | *International Civil Aviation Organization* (OACI), agência da ONU que padroniza a aviação civil: códigos de aeroportos, formato do METAR etc. |
| **GTS** | *Global Telecommunication System*, rede da Organização Meteorológica Mundial por onde circulam os boletins meteorológicos. O IEM coleta os METARs dali. |

## 2. Os 10 aeroportos do projeto

Os 10 maiores aeroportos dos EUA (lista `AEROPORTOS` em `experimento_bts.py`). A BTS usa o código **IATA** (3 letras); o METAR usa o **ICAO** (4 letras, `K` + IATA nos EUA continentais). `carregar_metar` converte `KATL` em `ATL`.

| IATA | ICAO | Aeroporto | Cidade |
|---|---|---|---|
| ATL | KATL | Hartsfield–Jackson | Atlanta (GA) |
| DFW | KDFW | Dallas/Fort Worth | Dallas (TX) |
| DEN | KDEN | Denver International | Denver (CO) |
| ORD | KORD | O'Hare | Chicago (IL) |
| LAX | KLAX | Los Angeles International | Los Angeles (CA) |
| CLT | KCLT | Charlotte Douglas | Charlotte (NC) |
| LAS | KLAS | Harry Reid | Las Vegas (NV) |
| PHX | KPHX | Sky Harbor | Phoenix (AZ) |
| MCO | KMCO | Orlando International | Orlando (FL) |
| SEA | KSEA | Seattle–Tacoma | Seattle (WA) |

## 3. Condições de voo

| Termo | Significado |
|---|---|
| **VFR / IFR** | Regras de voo visual / por instrumentos. Voos de linha aérea são IFR. |
| **VMC** | *Visual Meteorological Conditions*: tempo bom o bastante para voo visual. O projeto usa a regra da ICAO para aeródromo controlado: visibilidade ≥ 5 km **e** teto ≥ 1.500 ft. |
| **IMC** | O contrário de VMC (visibilidade < 5 km **ou** teto < 1.500 ft). O aeroporto continua operando, mas com menos pousos por hora. Flag `imc`. |
| **Mínimos** | Visibilidade e teto mínimos de um procedimento de aproximação. A flag `abaixo_minimos` usa visibilidade < 800 m ou teto < 200 ft (~ILS CAT I). |
| **Ground stop / GDP** | Medidas da FAA quando a capacidade cai (clima, congestionamento): segurar os voos na origem ou espaçar as partidas. Aparecem na BTS como atraso `NASDelay`. |

## 4. Meteorologia: METAR

| Termo | Significado |
|---|---|
| **METAR** | Boletim meteorológico regular de aeródromo. Nos EUA o de rotina sai entre hh:51 e hh:53; o projeto o conta como o da hora seguinte. |
| **SPECI** | Boletim especial, emitido fora do horário quando o tempo muda de forma significativa. |
| **TAF** | Previsão do tempo para o aeródromo. Não existe no histórico do projeto, por isso o modelo da véspera usa só clima típico e o dia anterior. |
| **Teto** | Base da camada mais baixa que cobre metade do céu ou mais (`BKN` ou `OVC`), ou a visibilidade vertical (`VV`). Sem camada assim, teto ilimitado (`99999`). |
| **Ponto de orvalho / spread** | Temperatura em que o ar satura. *Spread* = temperatura − orvalho; pequeno favorece nevoeiro. |
| **Altímetro / QNH** | Pressão ao nível do mar. Nos EUA vem em polegadas de mercúrio (`A3021` = 30,21 inHg); o projeto converte para hPa. |

Um METAR dos EUA, decodificado:

```
KATL 010052Z 33008G18KT 1 1/2SM -TSRA BR BKN008 OVC020 06/M04 A3021 RMK AO2
```

| Trecho | Significado |
|---|---|
| `KATL` | Aeródromo (Atlanta) |
| `010052Z` | Dia 01, 00:52 UTC |
| `33008G18KT` | Vento de 330° a 8 kt, rajadas de 18 kt |
| `1 1/2SM` | Visibilidade de 1,5 milha terrestre (~2,4 km) |
| `-TSRA` | Trovoada com chuva fraca |
| `BR` | Névoa úmida |
| `BKN008 OVC020` | Nublado a 800 ft (teto) e encoberto a 2.000 ft |
| `06/M04` | Temperatura 6 °C, orvalho −4 °C |
| `A3021` | Altímetro 30,21 inHg (~1023 hPa) |
| `RMK ...` | Observações (ignoradas pelo decodificador) |

Teto de 800 ft e visibilidade de 2,4 km: boletim **IMC**, mas não **abaixo dos mínimos**.

Fenômenos que `module_decea/metar.py` reconhece: `TS` trovoada (inclui `VCTS`, nas vizinhanças), `RA` chuva, `SH` pancada, `FG` nevoeiro, `BR` névoa úmida, `CB` cumulonimbus. `+`/`-` = forte/fraco.

## 5. Voos e a BTS

| Termo | Significado |
|---|---|
| **On-Time Performance** | Base mensal da BTS, um voo por linha. O workflow *Baixar BTS (EUA)* guarda só os voos que tocam os 10 aeroportos e as colunas usadas. |
| **Matrícula (`Tail_Number`)** | Registro do avião. Permite achar o voo anterior do mesmo avião (de onde vem o atraso propagado). |
| **Atraso > 30 min** | Alvo do modelo: a partida saiu mais de 30 min depois do previsto. |
| **Causas do atraso** | Minutos atribuídos depois do voo: `CarrierDelay` (companhia), `WeatherDelay` (clima extremo), `NASDelay` (controle de tráfego/aeroporto), `SecurityDelay` (segurança), `LateAircraftDelay` (avião chegou atrasado). Só servem para medir o recall por causa no teste, nunca como variável. |
| **Propagação de atraso** | Um atraso empurra os voos seguintes do mesmo avião. Por isso a taxa de atraso cresce ao longo do dia. |
| **Sem / com matrícula** | Duas versões do modelo de 1 h: sem matrícula, o voo que traz o avião é adivinhado (último da mesma companhia chegando na origem); com matrícula, é o voo anterior do mesmo avião. |
| **Vazamento pela matrícula** | A BTS grava o avião que de fato voou. Se houve troca de avião por causa do atraso, isso vaza para o modelo; por isso tempo de solo e folga pela matrícula ficam de fora, e a véspera não usa nada da matrícula. |
| **Fuso horário** | Os horários da BTS estão na hora local de cada aeroporto. O projeto converte para UTC com o fuso de cada aeroporto (`airportsdata`) para alinhar com o METAR. |

## 6. Machine learning

### Avaliação

| Termo | Significado |
|---|---|
| **Divisão temporal** | Treino 2022, validação 2023 (limiar do alerta), teste 2024. O modelo nunca vê o futuro. |
| **Vazamento de dados** | Informação que não estaria disponível na hora da previsão vaza para o treino e infla o resultado. |
| **Horizonte** | Antecedência da previsão: véspera, 3 h e 1 h antes da partida. |
| **Baseline / chute** | Referência simples que o modelo precisa superar: dar a todo voo a proporção de atrasos do treino. |
| **Prevalência** | Proporção de positivos (~15% dos voos atrasam mais de 30 min). É a PR-AUC de um chute ao acaso. |

### Métricas

| Termo | Significado |
|---|---|
| **Precisão** | Dos voos com alerta, quantos atrasaram de fato. |
| **Recall** | Dos voos que atrasaram, quantos receberam alerta. |
| **F1** | Média harmônica de precisão e recall. O limiar do alerta é o que maximiza o F1 na validação. |
| **ROC-AUC** | Chance de um voo atrasado receber nota maior que um pontual. 0,5 = chute. Não depende de limiar. |
| **PR-AUC** | Área sob a curva precisão × recall (`average_precision_score`). Mais informativa que a ROC-AUC em classe rara. |
| **Log loss** | Penaliza probabilidades confiantes e erradas. Usada para comparar modelos sem escolher limiar. |
| **Limiar** | Corte que transforma a probabilidade em alerta sim/não. |

### Modelo

| Termo | Significado |
|---|---|
| **Gradient boosting** | Sequência de árvores pequenas em que cada uma corrige os erros das anteriores. |
| **`HistGradientBoostingClassifier`** | Gradient boosting do scikit-learn que agrupa valores em histogramas (rápido em bases grandes), aceita ausentes e usa direto colunas categóricas (`categorical_features="from_dtype"`). |
| **Importância por permutação** | Quanto o log loss piora ao embaralhar uma variável. É o gráfico de importância do site. |

## 7. Nomes de colunas e variáveis do código

| Nome | Significado |
|---|---|
| `o_` / `d_` | Clima da **origem** e do **destino** (ex.: `o_trovoada`, `d_vis_m`) |
| `_var3h` | Variação da variável em 3 h |
| `vis_m`, `teto_ft` | Visibilidade em metros (9999 = 10 km ou mais) e teto em pés (99999 = sem teto) |
| `vento_kt`, `rajada_kt` | Vento e rajada (nós) |
| `qnh`, `spread` | Pressão (hPa) e temperatura − orvalho |
| `imc`, `abaixo_minimos` | Ver [seção 3](#3-condições-de-voo) |
| `dep_local`, `dep_utc` | Partida prevista em hora local e em UTC |
| `chegada_*` | Variáveis do voo que traz o avião (atraso conhecido, folga, se ainda não partiu) |
| `aviao_*` | Cadeia do avião no dia (voos já feitos, atraso 2 voos antes) |
| `recente_*` | Atraso recente na origem, na companhia na origem e na companhia na rede |

## 8. Unidades e horários

| Termo | Significado |
|---|---|
| **kt (nó)** | 1,852 km/h. |
| **ft (pé)** | 0,3048 m. 1.500 ft ≈ 460 m. |
| **SM** | Milha terrestre (*statute mile*) = 1,609 km. Unidade da visibilidade no METAR dos EUA. |
| **inHg / hPa** | Polegadas de mercúrio / hectopascal. 1 inHg ≈ 33,86 hPa. |
| **UTC / Z** | Tempo Universal Coordenado, usado no METAR. |
