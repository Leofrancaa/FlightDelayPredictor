import type { Faixa } from "./types";

export const FAIXAS = ["até 15 min", "15–30 min", "30–60 min", "> 60 min"] as const;

/** O que aconteceu de fato. */
export const STATUS = ["No horário", "Atraso leve", "Atraso moderado", "Atraso grave"] as const;

/**
 * Previsão. O limiar foi calibrado para não deixar atrasos passarem (alarme falso custa pouco),
 * então a previsão é um alerta de risco, não uma certeza.
 */
export const ALERTA = ["Sem alerta", "Alerta de atraso leve", "Alerta de atraso moderado", "Alerta de atraso grave"] as const;

/** Cores das faixas (variáveis CSS definidas em globals.css). */
export const COR = ["var(--f0)", "var(--f1)", "var(--f2)", "var(--f3)"] as const;

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

/** Probabilidade (%) de atrasar mais de 30 min. */
export const risco30 = (p: number[]) => p[2] + p[3];

export const isFaixa = (n: number): n is Faixa => n >= 0 && n <= 3;
