import type { Metadata } from "next";
import ComparacaoPaises from "@/components/ComparacaoPaises";
import { carregarResumo } from "@/lib/resumo";

export const metadata: Metadata = { title: "Brasil × EUA | Previsão de Atrasos" };

export default async function Comparacao() {
  const [br, eua] = await Promise.all([carregarResumo(), carregarResumo("eua")]);
  if (!br || !eua)
    return (
      <p className="rounded-md border border-linha bg-cartao p-4">
        Faltam os resumos dos modelos (<code>public/data/resumo.json</code> e <code>public/data/eua/resumo.json</code>).
      </p>
    );
  return <ComparacaoPaises br={br} eua={eua} />;
}
