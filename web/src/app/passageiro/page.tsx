import type { Metadata } from "next";
import BuscaVoo from "@/components/BuscaVoo";

export const metadata: Metadata = { title: "Meu voo | Previsão de Atrasos" };

export default function Passageiro() {
  return (
    <>
      <h1 className="font-cond text-4xl font-semibold">Painel de partidas</h1>
      <p className="mt-2 max-w-2xl text-tinta-2">
        Escolha o aeroporto e o dia, encontre o seu voo no painel e clique nele. Os voos são reais, de outubro a dezembro
        de 2025, e o modelo não os viu no treino: dá para comparar a previsão com o que aconteceu.
      </p>
      <BuscaVoo />
    </>
  );
}
