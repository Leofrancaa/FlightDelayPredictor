import type { Metadata } from "next";
import BuscaVoo from "@/components/BuscaVoo";

export const metadata: Metadata = { title: "Meu voo | Previsão de Atrasos" };

export default function Passageiro() {
  return (
    <>
      <h1 className="font-cond text-4xl font-semibold">Consultar um voo</h1>
      <p className="mt-2 max-w-2xl text-tinta-2">
        Escolha o dia e busque pelo número do voo ou pela rota. Esta demonstração usa os voos reais de outubro a
        dezembro de 2025, que o modelo não viu no treino: dá para comparar a previsão com o que aconteceu.
      </p>
      <BuscaVoo />
    </>
  );
}
