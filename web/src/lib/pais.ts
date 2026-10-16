export type Pais = "br" | "eua";

/** O que muda entre os países: de onde vêm os dados e o aeroporto que o painel abre. */
export const PAISES: Record<Pais, { nome: string; base: string; prefixo: string; aeroporto: string; fonte: string; exemplo: string }> = {
  br: { nome: "Brasil", base: "/data", prefixo: "", aeroporto: "SBGR", fonte: "VRA/ANAC e METAR (IEM)", exemplo: "G3 1402" },
  eua: { nome: "EUA", base: "/data/eua", prefixo: "/eua", aeroporto: "ATL", fonte: "BTS (On-Time Performance) e METAR (IEM)", exemplo: "DL 774" },
};
