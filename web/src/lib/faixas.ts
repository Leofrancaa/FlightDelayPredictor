import type { Horizonte, Nivel } from "./types";

/** Pergunta 1: a partida vai atrasar 15 min ou mais (critério do DOT)? */
export const CLASSES = ["< 15 min", "≥ 15 min"] as const;

/** Pergunta 2, só entre os voos que atrasam: passa de 30 min? */
export const CLASSES30 = ["15–30 min", "> 30 min"] as const;

/** O que aconteceu, nas 3 classes do modelo. */
export const CLASSES3 = ["Menos de 15 min", "15 a 30 min", "Mais de 30 min"] as const;

/**
 * Alerta em 3 níveis. "Atraso provável" quando a chance de atrasar >= 15 min passa do limiar (calibrado em 2023 pelo
 * F1); entre esses, "> 30 min" quando a chance de passar de 30 min, se atrasar, passa do segundo limiar.
 */
export const ALERTA = ["Sem alerta", "Atraso provável", "Atraso > 30 min provável"] as const;
export const ALERTA_CURTO = ["Sem alerta", "Risco de atraso", "Risco > 30 min"] as const;

/** Cores por nível: < 15 min / 15–30 min / > 30 min (variáveis CSS definidas em globals.css). */
export const COR = ["var(--f0)", "var(--f1)", "var(--f3)"] as const;
/** Mesmas cores no painel escuro de partidas. */
export const COR_PAINEL = ["#3fb394", "#e2b232", "#e55a4c"] as const;

export function nivelReal(atrasoMin: number): Nivel {
  return atrasoMin > 30 ? 2 : atrasoMin >= 15 ? 1 : 0;
}

/** O que aconteceu de fato. Menos de 15 min conta como no horário (critério do DOT). */
export function situacao(atrasoMin: number): { texto: string; cor: string; painel: string } {
  const n = nivelReal(atrasoMin);
  const texto = atrasoMin <= 0 ? "No horário" : ["Atraso de menos de 15 min", "Atrasou 15 a 30 min", "Atrasou mais de 30 min"][n];
  return { texto, cor: COR[n], painel: COR_PAINEL[n] };
}

export const NOME_H: Record<Horizonte, string> = { vespera: "Véspera", h3: "3 h antes", h1: "1 h antes" };
export const ORDEM_H: Horizonte[] = ["vespera", "h3", "h1"];

export const pct = (x: number | null | undefined, casas = 1) =>
  x == null ? "–" : `${(x * 100).toLocaleString("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: casas })}%`;

export const num = (x: number | null | undefined, casas = 3) =>
  x == null ? "–" : x.toLocaleString("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: casas });

export const inteiro = (x: number) => x.toLocaleString("pt-BR");

export function descreverAtraso(min: number): string {
  if (min <= 0) return min < 0 ? `saiu ${-min} min adiantado` : "saiu no horário";
  if (min < 60) return `saiu ${min} min atrasado`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `saiu ${h} h${m ? ` ${m} min` : ""} atrasado`;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
/** "2024-07" -> "jul/24" */
export const mesCurto = (am: string) => `${MESES[Number(am.slice(5, 7)) - 1]}/${am.slice(2, 4)}`;
