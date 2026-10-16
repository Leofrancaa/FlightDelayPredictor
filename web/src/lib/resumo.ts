import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Resumo } from "./types";

/** Lê o resumo do modelo no build (o site é estático). `pasta` é relativa a public/data. */
export async function carregarResumo(pasta = ""): Promise<Resumo | null> {
  try {
    const bruto = await readFile(path.join(process.cwd(), "public", "data", pasta, "resumo.json"), "utf-8");
    return JSON.parse(bruto) as Resumo;
  } catch {
    return null;
  }
}
