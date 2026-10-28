import type { Metadata } from "next";
import PainelAnalista from "@/components/PainelAnalista";
import { carregarResumo } from "@/lib/resumo";

export const metadata: Metadata = { title: "Análise do modelo | Previsão de Atrasos" };

export default async function Analista() {
  const resumo = await carregarResumo();
  if (!resumo)
    return (
      <p className="rounded-md border border-linha bg-cartao p-4">
        Não encontrei <code>public/data/resumo.json</code>. Gere com{" "}
        <code>uv run python -m module_decea.exportar_web_eua</code>.
      </p>
    );
  return <PainelAnalista r={resumo} />;
}
