import type { Metadata } from "next";
import BuscaVoo from "@/components/BuscaVoo";

export const metadata: Metadata = { title: "Meu voo | Previsão de Atrasos" };

export default function Passageiro() {
  return (
    <>
      <h1 className="font-cond text-4xl font-semibold">Painel de partidas</h1>
      <p className="mt-2 max-w-2xl text-tinta-2">
        Os 10 maiores aeroportos dos EUA, de 15 a 31 de dezembro de 2024, que o modelo não viu no treino. Escolha o
        aeroporto e o dia, encontre o seu voo e clique nele: o modelo sabe qual avião faz cada voo (matrícula) e segue o
        atraso dele ao longo do dia.
      </p>
      <BuscaVoo />
    </>
  );
}
