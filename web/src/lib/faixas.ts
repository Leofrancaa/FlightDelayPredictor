import type { Horizonte } from "./types";

/** Alvo binário: a partida atrasou mais de 30 min (tolerância usada pela ANAC)? */
export const CLASSES = ["até 30 min", "> 30 min"] as const;

/** O que aconteceu de fato. */
export const STATUS = ["No horário", "Atrasou mais de 30 min"] as const;

/**
 * Previsão. O limiar foi calibrado em 2023 para equilibrar precisão e recall (F1). Como só ~8% dos voos atrasam
 * mais de 30 min, o alerta dispara bem abaixo de 50%: é um alerta de risco, não uma certeza.
 */
export const ALERTA = ["Sem alerta", "Alerta de atraso"] as const;

/** O que aconteceu de fato. Atraso de até 30 min não é "no horário": é atraso, só não passa do critério da ANAC. */
export function situacao(atrasoMin: number): { texto: string; cor: string; painel: string } {
  if (atrasoMin <= 0) return { texto: "No horário", cor: "var(--f0)", painel: "#3fb394" };
  if (atrasoMin <= 30) return { texto: "Atrasou até 30 min", cor: "var(--f1)", painel: "#e2b232" };
  return { texto: "Atrasou mais de 30 min", cor: "var(--f3)", painel: "#e55a4c" };
}

/** Cores: até 30 min / mais de 30 min (variáveis CSS definidas em globals.css). */
export const COR = ["var(--f0)", "var(--f3)"] as const;

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
