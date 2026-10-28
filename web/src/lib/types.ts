// Formato dos JSON gerados por module_decea/exportar_web_eua.py

export type Horizonte = "h1" | "h3" | "vespera";

export interface Indice {
  datas: string[];
  empresas: Record<string, [nome: string, iata: string]>;
  aeroportos: Record<string, string>;
  limiares?: Record<Horizonte, number>;
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
  f: 0 | 1; // 1 = atrasou mais de 30 min
  pv: number; // chance (%) de atrasar > 30 min, prevista na véspera
  p3: number; // ... 3 h antes
  p1: number; // ... 1 h antes
  fv: 0 | 1; // alerta na véspera
  f3: 0 | 1; // alerta 3 h antes
  f1: 0 | 1; // alerta 1 h antes
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
  taxa30: number | null;
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

export interface Modelo extends Metricas {
  recall_por_causa?: RecallCausa;
  nome: string;
  limiar: number;
  pontos_operacao: { recall: number; precisão: number; limiar: number }[];
  confusao: number[][];
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
    sem: Metricas & { limiar: number; recall_por_causa: RecallCausa };
    com: Metricas & { limiar: number; recall_por_causa: RecallCausa };
  };
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
