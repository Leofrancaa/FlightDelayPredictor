"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PAISES, type Pais } from "@/lib/pais";

const LINKS = [
  { href: "/passageiro", rotulo: "Meu voo" },
  { href: "/analista", rotulo: "Análise do modelo" },
];

export default function Navegacao() {
  const rota = usePathname();
  const pais: Pais = rota.startsWith("/eua") ? "eua" : "br";
  const pagina = rota.replace(/^\/eua/, "") || "/";
  const destino = (p: Pais) => `${PAISES[p].prefixo}${pagina === "/" ? "/passageiro" : pagina}`;
  return (
    <header className="mb-8 bg-painel text-painel-texto">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="font-cond text-xl font-semibold tracking-wide">
          <span className="mr-2 inline-block h-3 w-3 rounded-sm bg-sinal align-middle" aria-hidden />
          Previsão de Atrasos
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-md border border-white/20 p-0.5 text-sm" role="group" aria-label="País">
            {(Object.keys(PAISES) as Pais[]).map((p) => (
              <Link
                key={p}
                href={destino(p)}
                aria-current={pais === p && pagina !== "/" ? "true" : undefined}
                className={`rounded px-2.5 py-1 ${pais === p && pagina !== "/" ? "bg-white/15 font-semibold text-white" : "text-white/60 hover:text-white"}`}
              >
                {PAISES[p].nome}
              </Link>
            ))}
          </div>
          <nav className="flex gap-1 text-[15px]">
            {LINKS.map((l) => {
              const href = `${PAISES[pais].prefixo}${l.href}`;
              const ativo = pagina.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={href}
                  aria-current={ativo ? "page" : undefined}
                  className={`rounded px-3 py-1.5 transition-colors ${ativo ? "bg-sinal font-semibold text-painel" : "hover:bg-white/10"}`}
                >
                  {l.rotulo}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
