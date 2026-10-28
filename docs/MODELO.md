# Como o modelo funciona

Resumo das escolhas de modelagem. Código em `module_decea/modelagem.py`, `module_decea/experimento_bts.py` e `module_decea/exportar_web_eua.py`; resultados em `web/public/data/resumo.json`.

## Respostas rápidas

| Pergunta | Resposta |
|---|---|
| Regressão ou classificação? | **Classificação binária.** O alvo é "a partida atrasou mais de 30 min?" (1 = sim, 0 = não). O modelo devolve uma probabilidade e o alerta dispara quando ela passa de um limiar. |
| Usa ensemble? | **Sim, boosting.** Gradient boosting é um ensemble sequencial de árvores de decisão: cada árvore corrige os erros das anteriores. Não usamos bagging, stacking nem votação entre modelos diferentes. |
| Qual modelo? XGBoost? | **Não é XGBoost.** É o `HistGradientBoostingClassifier` do scikit-learn, que segue a mesma ideia (árvores com histogramas, como o LightGBM). Escolhido por ser rápido em milhões de linhas, aceitar valores ausentes e usar colunas categóricas direto, sem dependência extra. |
| Usa cross-validation? | **Não k-fold.** Os dados são temporais, então embaralhar e dividir em k partes deixaria o modelo "ver o futuro". Usamos **validação temporal (hold-out)**: treino 2022, validação 2023, teste 2024. |
| Busca de hiperparâmetros? | **Não** na versão atual: hiperparâmetros fixos (tabela abaixo). O que é ajustado na validação é o **limiar do alerta**. |

## Problema

- **Alvo:** atraso de partida > 30 min (`DepDelay > 30`). Cerca de 15% dos voos do teste são positivos, então é um problema de **classe desbalanceada**.
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
2023 ── validação ───┤  modelo treinado em 2022 prevê 2023 → escolhe o limiar (máx. F1)
                     └─ modelo final retreinado em 2022–2023
2024 ──── teste ─────── avaliado uma vez, com o limiar escolhido em 2023
```

- **Limiar:** como só ~15% atrasam, 0,5 quase nunca dispararia. O limiar é o que maximiza o **F1** da classe "atrasou" na validação (fica entre 0,18 e 0,28).
- **Baseline ("chute"):** dar a todo voo a proporção de atrasos do treino. PR-AUC do chute = prevalência (~0,15).
- **Janela de treino:** comparamos treinar com 2022–2023 e só com 2023; o resultado no teste é praticamente o mesmo (PR-AUC 0,638 × 0,636).

### Hiperparâmetros

| Parâmetro | Valor |
|---|---|
| `learning_rate` | 0,05 |
| `max_iter` (nº de árvores) | 400 |
| `max_leaf_nodes` | 31 |
| `min_samples_leaf` | 100 |
| `l2_regularization` | 1,0 |
| `categorical_features` | `from_dtype` (companhia, rota etc. como categóricas) |

### Métricas

Escolhidas por causa do desbalanceamento (acurácia enganaria: "nunca atrasa" acerta 85%):

- **PR-AUC** (principal) e **ROC-AUC**: qualidade do ranking, sem depender de limiar.
- **Precisão, recall e F1** no limiar escolhido.
- **Log loss**: qualidade das probabilidades; também usada na importância das variáveis (por permutação).
- **Recall por causa do atraso**, usando as causas da BTS só na avaliação.

### Resultados no teste (2024)

| Horizonte | PR-AUC | ROC-AUC | Limiar | Precisão | Recall | F1 |
|---|---|---|---|---|---|---|
| Chute | 0,15 | 0,50 | – | – | – | – |
| Véspera | 0,29 | 0,71 | 0,18 | 28% | 50% | 0,36 |
| 3 h antes | 0,51 | 0,80 | 0,25 | 48% | 50% | 0,49 |
| 1 h antes | 0,64 | 0,85 | 0,28 | 58% | 57% | 0,58 |

**Quanto vale a matrícula** (1 h antes): sem ela, o voo que traz o avião é adivinhado (último da mesma companhia chegando na origem) e a PR-AUC cai para 0,42. Detalhes em `reports/bts/resumo.json`.

## Limitações

- Sem k-fold nem busca de hiperparâmetros: é possível que outra configuração renda um pouco mais.
- Não há previsão do tempo (TAF) no histórico, então a véspera não sabe do clima do dia.
- Os limites de IMC seguem a regra da ICAO (5 km / 1.500 ft); a FAA usa 3 milhas / 1.000 ft para IFR.
