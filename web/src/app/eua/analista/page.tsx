import type { Metadata } from "next";
import PainelAnalista from "@/components/PainelAnalista";
import { carregarResumo } from "@/lib/resumo";

export const metadata: Metadata = { title: "Análise do modelo (EUA) | Previsão de Atrasos" };

export default async function AnalistaEua() {
  const resumo = await carregarResumo("eua");
  if (!resumo)
    return (
      <p className="rounded-md border border-linha bg-cartao p-4">
        Não encontrei <code>public/data/eua/resumo.json</code>. Gere com{" "}
        <code>uv run python -m module_decea.exportar_web_eua</code>.
      </p>
    );
  return <PainelAnalista r={resumo} />;
}
