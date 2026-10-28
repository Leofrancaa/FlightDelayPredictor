// Formato dos JSON gerados por module_decea/exportar_web_eua.py

export type Horizonte = "h1" | "h3" | "vespera";
export type Nivel = 0 | 1 | 2;

export interface Indice {
  datas: string[];
  empresas: Record<string, [nome: string, iata: string]>;
  aeroportos: Record<string, string>;
  limiares?: Record<Horizonte, number>; // vai atrasar (>= 15 min)?
  limiares30?: Record<Horizonte, number>; // se atrasar, passa de 30 min?
  coordenadas?: Record<string, [lat: number, lon: number]>;
}

/** Um voo da demonstração (chaves curtas para o arquivo ficar leve). */
export interface Voo {
  e: string; // empresa (código da BTS)
  n: string; // número do voo
  o: string; // origem
  d: string; // destino
  h: string; // partida prevista HH:MM (hora local da origem)
  a: number; // atraso real da partida, min
  f: Nivel; // o que aconteceu: 0 = < 15 min, 1 = 15–30 min, 2 = > 30 min
  pv: number; // chance (%) de atrasar >= 15 min, prevista na véspera
  p3: number; // ... 3 h antes
  p1: number; // ... 1 h antes
  qv: number; // chance (%) de passar de 30 min, se atrasar, prevista na véspera
  q3: number; // ... 3 h antes
  q1: number; // ... 1 h antes
  fv: Nivel; // alerta na véspera: 0 = sem alerta, 1 = atraso provável, 2 = atraso > 30 min provável
  f3: Nivel; // ... 3 h antes
  f1: Nivel; // ... 1 h antes
  c: {
    trov: number | null;
    raj: number | null;
    vis: number | null;
    teto: number | null;
    rec: number | null;
    cia: number | null; // atraso recente da própria companhia na origem
    chg: number | null; // atraso já conhecido do voo de chegada (min)
    chgp: number | null; // 1 = voo de chegada ainda não tinha decolado e já estava atrasado
    hist: number | null;
    v7: number | null;
  };
}

export interface Taxa {
  chave: string;
  taxa15: number | null; // atraso >= 15 min
  taxa30: number | null; // atraso > 30 min
  voos: number;
}

export interface Metricas {
  log_loss: number;
  "ROC-AUC": number;
  "PR-AUC": number;
  prevalência: number;
  precisão: number | null;
  recall: number;
  F1: number;
  "% voos com alerta": number;
}

export type RecallCausa = Record<string, number | null>;

export interface PontoOperacao {
  recall: number;
  precisão: number;
  limiar: number;
}

/** "Se atrasar, passa de 30 min?", avaliada só nos voos que atrasaram >= 15 min. */
export interface Pergunta30 extends Metricas {
  limiar: number;
  acuracia_balanceada: number;
  pontos_operacao: PontoOperacao[];
  confusao: number[][];
}

/** Métricas do topo = "vai atrasar (>= 15 min)?". */
export interface Modelo extends Metricas {
  recall_por_causa?: RecallCausa;
  nome: string;
  limiar: number;
  pontos_operacao: PontoOperacao[];
  confusao: number[][];
  q30: Pergunta30;
  confusao3: number[][]; // linhas: < 15, 15–30, > 30 (real); colunas: alerta 0, 1, 2 (% da linha)
  log_loss3: number;
  pr_auc_mais30: number;
}

export interface Mes {
  mes: string; // AAAA-MM
  voos: number;
  prevalencia: number;
  pr_auc: number;
  precisao: number | null;
  recall: number;
}

export interface Resumo {
  gerado_em: string;
  pais?: "eua";
  causas?: Record<string, { descricao: string; parcela: number | null }>;
  matricula?: {
    sem: Metricas & { limiar: number; recall_por_causa: RecallCausa; q30: Pergunta30 };
    com: Metricas & { limiar: number; recall_por_causa: RecallCausa; q30: Pergunta30 };
  };
  classes: string[];
  prevalencias: { atraso15: number; mais30: number; mais30_dado_atraso: number };
  chute30: Metricas;
  alvo: string;
  desde: number;
  periodos: { treino: string; validacao: string; teste: string };
  periodos_anomalos: [string, string][];
  horizontes: Record<Horizonte, string>;
  hiperparametros: Record<string, number>;
  busca: { params: Record<string, number>; log_loss: number }[];
  n: { treino: number; validacao: number; teste: number };
  modelos: Record<Horizonte, Modelo>;
  chute: Metricas;
  mensal: Record<Horizonte, Mes[]>;
  janelas: { janela: string; voos_treino: number; pr_auc: number; log_loss: number }[];
  importancia: { variavel: string; descricao: string; grupo: string; valor: number }[];
  eda: {
    por_hora: Taxa[];
    por_aeroporto: Taxa[];
    por_empresa: Taxa[];
    por_mes: Taxa[];
    por_dia_semana: Taxa[];
    por_ano: Taxa[];
    clima: Taxa[];
  };
}
