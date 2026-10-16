import type { Metadata } from "next";
import BuscaVoo from "@/components/BuscaVoo";

export const metadata: Metadata = { title: "Painel de partidas (EUA) | Previsão de Atrasos" };

export default function PassageiroEua() {
  return (
    <>
      <h1 className="font-cond text-4xl font-semibold">Painel de partidas: EUA</h1>
      <p className="mt-2 max-w-2xl text-tinta-2">
        Os 10 maiores aeroportos dos EUA, de 15 a 31 de dezembro de 2024, que o modelo não viu no treino. Aqui o modelo
        sabe qual avião faz cada voo (matrícula) e segue o atraso dele ao longo do dia, informação que os dados da ANAC
        não têm.
      </p>
      <BuscaVoo pais="eua" />
    </>
  );
}
