"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/passageiro", rotulo: "Meu voo" },
  { href: "/analista", rotulo: "Análise do modelo" },
];

export default function Navegacao() {
  const rota = usePathname();
  return (
    <header className="mb-8 bg-painel text-painel-texto">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="font-cond text-xl font-semibold tracking-wide">
          <span className="mr-2 inline-block h-3 w-3 rounded-sm bg-sinal align-middle" aria-hidden />
          Previsão de Atrasos
        </Link>
        <nav className="flex gap-1 text-[15px]">
          {LINKS.map((l) => {
            const ativo = rota.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={ativo ? "page" : undefined}
                className={`rounded px-3 py-1.5 transition-colors ${
                  ativo ? "bg-sinal font-semibold text-painel" : "hover:bg-white/10"
                }`}
              >
                {l.rotulo}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
