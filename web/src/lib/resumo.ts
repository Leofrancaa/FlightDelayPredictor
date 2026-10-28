import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Resumo } from "./types";

/** Lê o resumo do modelo no build (o site é estático). */
export async function carregarResumo(): Promise<Resumo | null> {
  try {
    const bruto = await readFile(path.join(process.cwd(), "public", "data", "resumo.json"), "utf-8");
    return JSON.parse(bruto) as Resumo;
  } catch {
    return null;
  }
}
