// Formato dos JSON gerados por module_decea/exportar_web.py

export type Faixa = 0 | 1 | 2 | 3;

export interface Indice {
  datas: string[];
  empresas: Record<string, [nome: string, iata: string]>;
  aeroportos: Record<string, string>;
}

/** Um voo do período de teste (chaves curtas para o arquivo ficar leve). */
export interface Voo {
  e: string; // empresa (ICAO)
  n: string; // número do voo
  o: string; // origem
  d: string; // destino
  h: string; // partida prevista HH:MM (Brasília)
  a: number; // atraso real da partida, min
  f: Faixa; // faixa real
  pv: number[]; // probabilidades (%) na véspera
  p3: number[]; // probabilidades (%) 3 h antes
  fv: Faixa; // faixa prevista na véspera
  f3: Faixa; // faixa prevista 3 h antes
  c: {
    trov: number | null;
    raj: number | null;
    vis: number | null;
    teto: number | null;
    rec: number | null;
    hist: number | null;
    v7: number | null;
  };
}

export interface Taxa {
  chave: string;
  taxa30: number | null;
  voos: number;
}

export interface LinhaModelo {
  nome: string;
  log_loss: number;
  "ROC-AUC macro (4 faixas)": number;
  "ROC-AUC atraso>30": number;
  "PR-AUC atraso>30": number;
  "F2 macro": number;
  "recall atraso>30": number;
  "precisão atraso>30": number | null;
  "erro de no máx. 1 faixa": number;
}

export interface PorFaixa {
  faixa: string;
  precisao: number;
  recall: number;
  f1: number;
  voos: number;
}

export interface Resumo {
  gerado_em: string;
  faixas: string[];
  periodo_treino: [string, string];
  periodo_teste: [string, string];
  n_treino: number;
  n_teste: number;
  distribuicao: { treino: number[]; teste: number[] };
  hiperparametros: Record<string, number>;
  pesos: { vespera: number[]; h3: number[] };
  modelos: LinhaModelo[];
  por_faixa: { vespera: PorFaixa[]; h3: PorFaixa[] };
  confusao: { vespera: number[][]; h3: number[][] };
  importancia: { variavel: string; descricao: string; grupo: string; valor: number }[];
  semanal: { semana: string; prevalencia: number; vespera: number; h3: number }[];
  eda: {
    por_hora: Taxa[];
    por_aeroporto: Taxa[];
    por_empresa: Taxa[];
    por_mes: Taxa[];
    por_dia_semana: Taxa[];
    clima: Taxa[];
  };
}
