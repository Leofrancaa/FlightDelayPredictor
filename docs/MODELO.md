# Como o modelo funciona

Resumo das escolhas de modelagem. Código em `module_decea/modelagem.py`, `module_decea/experimento_bts.py` e `module_decea/exportar_web_eua.py`; resultados em `web/public/data/resumo.json`.

## Respostas rápidas

| Pergunta | Resposta |
|---|---|
| Regressão ou classificação? | **Classificação multiclasse (3 classes)**: atraso de partida **< 15 min**, **15–30 min** ou **> 30 min**. Das probabilidades das 3 classes saem as duas perguntas do site (abaixo). |
| Usa ensemble? | **Sim, boosting.** Gradient boosting é um ensemble sequencial de árvores de decisão: cada árvore corrige os erros das anteriores. Em 3 classes, cada rodada treina uma árvore por classe. Não usamos bagging, stacking nem votação entre modelos diferentes. |
| Qual modelo? XGBoost? | **Não é XGBoost.** É o `HistGradientBoostingClassifier` do scikit-learn, que segue a mesma ideia (árvores com histogramas, como o LightGBM). Escolhido por ser rápido em milhões de linhas, aceitar valores ausentes e usar colunas categóricas direto, sem dependência extra. |
| Usa cross-validation? | **Não k-fold.** Os dados são temporais, então embaralhar e dividir em k partes deixaria o modelo "ver o futuro". Usamos **validação temporal (hold-out)**: treino 2022, validação 2023, teste 2024. |
| Busca de hiperparâmetros? | **Não** na versão atual: hiperparâmetros fixos (tabela abaixo). O que é ajustado na validação são os **limiares dos dois alertas**. |

## As duas perguntas

Um só modelo por horizonte dá P(< 15), P(15–30) e P(> 30). Delas:

1. **O voo vai atrasar?** (partida 15 min ou mais depois do previsto, o critério de pontualidade do DOT)
   `P(atraso) = P(15–30) + P(> 30)`
2. **Se atrasar, passa de 30 min?**
   `P(> 30 | atraso) = P(> 30) / P(atraso)`

O alerta do site tem 3 níveis:

```
P(atraso) < limiar1                         → sem alerta
P(atraso) ≥ limiar1 e P(> 30 | atraso) < limiar2 → atraso provável (até 30 min)
P(atraso) ≥ limiar1 e P(> 30 | atraso) ≥ limiar2 → atraso de mais de 30 min provável
```

Por que um modelo de 3 classes em vez de dois modelos em cascata: as probabilidades ficam sempre coerentes entre si, o treino é um só por horizonte, e a pergunta 2 aproveita todos os voos no treino (não só os atrasados).

## Problema

- **Classes desbalanceadas:** no teste, 22,7% dos voos atrasam 15 min ou mais e 14,5% passam de 30 min. Entre os que atrasam, **64% passam de 30 min**.
- **Escopo:** voos que saem dos 10 maiores aeroportos dos EUA (ATL, DFW, DEN, ORD, LAX, CLT, LAS, PHX, MCO, SEA). Cancelados ficam fora.
- **Três horizontes**, um modelo para cada, com só o que se sabe naquele momento:
  - **Véspera:** programação, histórico e clima típico/do dia anterior. Nada que dependa da matrícula.
  - **3 h antes** e **1 h antes:** + METAR da hora, atrasos recentes e o voo que traz o avião (pela matrícula).

## Variáveis

| Grupo | Exemplos |
|---|---|
| Programação | hora, dia da semana, mês, companhia, origem, destino, distância, duração prevista, partidas programadas na hora |
| Histórico | taxa de atraso histórica da rota na companhia, atraso do mesmo voo nos últimos 7 dias, dia anterior |
| Clima (METAR) | visibilidade, teto, vento, rajada, trovoada, nevoeiro, IMC, variação em 3 h, na origem e no destino |
| Propagação | atraso do voo anterior do mesmo avião, se ele ainda não decolou, voos que o avião já fez no dia, atraso recente na origem e na companhia |

Ficam de fora para evitar **vazamento**: as causas do atraso (`CarrierDelay`, `WeatherDelay`...), que a BTS só informa depois do voo, e o tempo de solo/folga pela matrícula, porque a BTS grava o avião que de fato voou e uma troca de avião por causa do atraso entregaria a resposta.

## Treino e avaliação

```
2022 ──── treino ────┐
2023 ── validação ───┤  modelo treinado em 2022 prevê 2023 → escolhe os dois limiares
                     └─ modelo final retreinado em 2022–2023
2024 ──── teste ─────── avaliado uma vez, com os limiares escolhidos em 2023
```

- **Limiar 1 (vai atrasar?):** o que maximiza o **F1** de "atrasou". Como só ~23% atrasam, 0,5 quase nunca dispararia; fica entre 0,23 e 0,32.
- **Limiar 2 (passa de 30 min?):** escolhido só entre os voos que atrasaram, pela **acurácia balanceada** (média do recall de "sim" e de "não"). O F1 não serve aqui: como 64% dos atrasos já passam de 30 min, maximizar o F1 de "sim" levaria a dizer "sim" para quase todos. Fica entre 0,61 e 0,64.
- **Baseline ("chute"):** dar a todo voo a proporção do treino. PR-AUC do chute = prevalência (0,23 na pergunta 1; 0,64 na pergunta 2).
- **Pergunta 2 avaliada só nos voos que de fato atrasaram**, que é exatamente o que ela pergunta.
- **Janela de treino:** treinar com 2022–2023 ou só com 2023 dá praticamente o mesmo resultado no teste (PR-AUC 0,700 × 0,699).

### Hiperparâmetros

| Parâmetro | Valor |
|---|---|
| `learning_rate` | 0,05 |
| `max_iter` (rodadas de boosting) | 400 |
| `max_leaf_nodes` | 31 |
| `min_samples_leaf` | 100 |
| `l2_regularization` | 1,0 |
| `categorical_features` | `from_dtype` (companhia, rota etc. como categóricas) |

### Métricas

Escolhidas por causa do desbalanceamento (acurácia enganaria: "nunca atrasa" acerta 77%):

- **PR-AUC** (principal) e **ROC-AUC**: qualidade do ranking, sem depender de limiar.
- **Precisão, recall e F1** (pergunta 1) e **acurácia balanceada** (pergunta 2) no limiar escolhido.
- **Log loss**: qualidade das probabilidades; também usada na importância das variáveis (por permutação, nas 3 classes).
- **Matriz de confusão 3×3**: alerta do site (3 níveis) contra o que aconteceu (3 classes).
- **Recall por causa do atraso**, usando as causas da BTS só na avaliação.

## Resultados no teste (2024)

**Pergunta 1: vai atrasar 15 min ou mais?**

| Horizonte | PR-AUC | ROC-AUC | Limiar | Precisão | Recall | F1 |
|---|---|---|---|---|---|---|
| Chute | 0,23 | 0,50 | – | – | – | – |
| Véspera | 0,41 | 0,70 | 0,23 | 36% | 61% | 0,45 |
| 3 h antes | 0,58 | 0,78 | 0,28 | 51% | 58% | 0,54 |
| 1 h antes | 0,70 | 0,84 | 0,32 | 62% | 63% | 0,63 |

**Pergunta 2: se atrasar, passa de 30 min?** (só nos voos que atrasaram)

| Horizonte | PR-AUC | ROC-AUC | Limiar | Precisão | Recall | Acurácia balanceada |
|---|---|---|---|---|---|---|
| Chute | 0,64 | 0,50 | – | – | – | 50% |
| Véspera | 0,71 | 0,60 | 0,61 | 69% | 64% | 57% |
| 3 h antes | 0,80 | 0,69 | 0,63 | 77% | 57% | 63% |
| 1 h antes | 0,84 | 0,73 | 0,64 | 82% | 55% | 66% |

Leitura: a pergunta 1 é onde o modelo mais agrega. A pergunta 2 é mais difícil: saber se um atraso vai ser de 20 ou de 60 min depende de coisas que não estão nos dados (manutenção, tripulação). Na véspera ela quase não passa do chute.

**Alerta do site, 1 h antes** (% de cada linha):

| Real \ alerta | Sem alerta | Atraso provável | > 30 min provável |
|---|---|---|---|
| < 15 min | **89%** | 7% | 4% |
| 15–30 min | 48% | **34%** | 18% |
| > 30 min | 30% | 19% | **50%** |

**Comparação com o modelo binário anterior** (só "> 30 min?"): a P(> 30) direta do modelo de 3 classes tem PR-AUC 0,639 em 1 h, igual ao modelo binário (0,638). A mudança não custou nada na pergunta antiga.

**Quanto vale a matrícula** (1 h antes): sem ela, o voo que traz o avião é adivinhado (último da mesma companhia chegando na origem). A PR-AUC cai de 0,70 para 0,51 na pergunta 1 e de 0,84 para 0,77 na pergunta 2. O experimento separado está em `reports/bts/resumo.json`.

## Limitações

- Sem k-fold nem busca de hiperparâmetros: é possível que outra configuração renda um pouco mais.
- Não há previsão do tempo (TAF) no histórico, então a véspera não sabe do clima do dia.
- As variáveis de histórico (taxa de atraso da rota, do voo nos últimos 7 dias, recente na origem) ainda contam atrasos > 30 min. Versões com ≥ 15 min podem ajudar a pergunta 1.
- Os limites de IMC seguem a regra da ICAO (5 km / 1.500 ft); a FAA usa 3 milhas / 1.000 ft para IFR.
