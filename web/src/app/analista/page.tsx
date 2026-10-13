import type { Metadata } from "next";
import { readFile } from "node:fs/promises";
import path from "node:path";
import PainelAnalista from "@/components/PainelAnalista";
import type { Resumo } from "@/lib/types";

export const metadata: Metadata = { title: "Análise do modelo | Previsão de Atrasos" };

async function carregar(): Promise<Resumo | null> {
  try {
    const bruto = await readFile(path.join(process.cwd(), "public", "data", "resumo.json"), "utf-8");
    return JSON.parse(bruto) as Resumo;
  } catch {
    return null;
  }
}

export default async function Analista() {
  const resumo = await carregar();
  if (!resumo)
    return (
      <p className="rounded-md border border-linha bg-cartao p-4">
        Não encontrei <code>public/data/resumo.json</code>. Gere com <code>uv run python -m module_decea.exportar_web</code>.
      </p>
    );
  return <PainelAnalista r={resumo} />;
}
