import type { Metadata } from "next";
import "./globals.css";
import Navegacao from "@/components/Navegacao";

export const metadata: Metadata = {
  title: "Previsão de Atrasos",
  description: "Risco de atraso de voos domésticos a partir da programação, do clima (METAR) e da propagação de atrasos.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">
        <Navegacao />
        <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-8 text-sm text-tinta-2 sm:px-6">
          Dados: VRA/ANAC e METAR (Iowa Environmental Mesonet), 2025. Trabalho acadêmico de mineração de dados.
        </footer>
      </body>
    </html>
  );
}
