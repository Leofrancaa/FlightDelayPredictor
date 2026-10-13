"use client";

import { useEffect, useMemo, useState } from "react";
import BarraProbabilidade from "./BarraProbabilidade";
import DetalheVoo from "./DetalheVoo";
import { ALERTA, COR } from "@/lib/faixas";
import type { Indice, Voo } from "@/lib/types";

const PAGINA = 40;

/** "G3 1402", "g31402", "1402" -> { iata: "G3" | null, numero: "1402" } */
function lerBusca(texto: string): { iata: string | null; numero: string } {
  const t = texto.toUpperCase().replace(/\s+/g, "");
  // código IATA tem ao menos uma letra (G3, LA, AD, 2Z), senão "3321" viraria iata "33" + número "21"
  const m = t.match(/^([A-Z][A-Z0-9]|[0-9][A-Z])?(\d{1,4})$/);
  if (!m) return { iata: null, numero: t.replace(/\D/g, "") };
  return { iata: m[1] ?? null, numero: m[2].replace(/^0+/, "") };
}

export default function BuscaVoo() {
  const [indice, setIndice] = useState<Indice | null>(null);
  const [data, setData] = useState("");
  const [voos, setVoos] = useState<Voo[] | null>(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [selecionado, setSelecionado] = useState<Voo | null>(null);
  const [mostrar, setMostrar] = useState(PAGINA);

  useEffect(() => {
    fetch("/data/indice.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((i: Indice) => {
        setIndice(i);
        setData(i.datas[0]);
      })
      .catch(() => setErro("Não encontrei os dados do modelo. Rode module_decea.exportar_web e publique de novo."));
  }, []);

  useEffect(() => {
    if (!data) return;
    setVoos(null);
    setSelecionado(null);
    fetch(`/data/voos/${data}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setVoos)
      .catch(() => setErro(`Não há voos para ${data}.`));
  }, [data]);

  const iataParaIcao = useMemo(() => {
    const m: Record<string, string> = {};
    if (indice) for (const [icao, [, iata]] of Object.entries(indice.empresas)) m[iata] = icao;
    return m;
  }, [indice]);

  useEffect(() => setMostrar(PAGINA), [data, busca, origem, destino]);

  const filtrados = useMemo(() => {
    if (!voos) return [];
    const { iata, numero } = lerBusca(busca);
    const empresa = iata ? iataParaIcao[iata] : null;
    return voos.filter(
      (v) =>
        (!origem || v.o === origem) &&
        (!destino || v.d === destino) &&
        (!numero || v.n === numero || (!empresa && v.n.startsWith(numero))) &&
        (!iata || !empresa || v.e === empresa),
    );
  }, [voos, busca, origem, destino, iataParaIcao]);

  if (erro) return <p className="mt-6 rounded-md border border-[var(--f3)] bg-cartao p-4">{erro}</p>;
  if (!indice) return <p className="mt-6 text-tinta-2">Carregando…</p>;

  const destinos = voos ? [...new Set(voos.map((v) => v.d))].sort() : [];
  const origens = voos ? [...new Set(voos.map((v) => v.o))].sort() : [];
  const nomeAp = (c: string) => indice.aeroportos[c] ?? c;

  return (
    <div className="mt-6 space-y-6">
      <form className="grid gap-3 rounded-lg border border-linha bg-cartao p-4 sm:grid-cols-4" onSubmit={(e) => e.preventDefault()}>
        <label className="flex flex-col gap-1 text-sm text-tinta-2">
          Dia do voo
          <input
            type="date"
            value={data}
            min={indice.datas[0]}
            max={indice.datas.at(-1)}
            onChange={(e) => indice.datas.includes(e.target.value) && setData(e.target.value)}
            className="rounded border border-linha bg-cartao px-3 py-2 text-base text-tinta"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-tinta-2">
          Número do voo
          <input
            type="search"
            placeholder="Ex.: G3 1402 ou 3321"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="rounded border border-linha bg-cartao px-3 py-2 text-base text-tinta"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-tinta-2">
          Saindo de
          <select value={origem} onChange={(e) => setOrigem(e.target.value)} className="rounded border border-linha bg-cartao px-3 py-2 text-base text-tinta">
            <option value="">Todos os aeroportos</option>
            {origens.map((c) => (
              <option key={c} value={c}>
                {nomeAp(c)} ({c})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-tinta-2">
          Indo para
          <select value={destino} onChange={(e) => setDestino(e.target.value)} className="rounded border border-linha bg-cartao px-3 py-2 text-base text-tinta">
            <option value="">Qualquer destino</option>
            {destinos.map((c) => (
              <option key={c} value={c}>
                {indice.aeroportos[c] ? `${indice.aeroportos[c]} (${c})` : c}
              </option>
            ))}
          </select>
        </label>
      </form>

      {selecionado && <DetalheVoo voo={selecionado} indice={indice} data={data} />}

      <section className="overflow-hidden rounded-lg bg-painel text-painel-texto">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/10 px-4 py-3 font-cond sm:px-5">
          <h2 className="text-xl font-semibold text-sinal">Partidas</h2>
          <span className="text-[15px] text-white/60">
            {voos ? `${filtrados.length.toLocaleString("pt-BR")} ${filtrados.length === 1 ? "voo" : "voos"}` : "carregando…"}
          </span>
        </div>
        <div className="hidden grid-cols-[4rem_6rem_1fr_1fr_14rem] gap-3 px-5 py-2 text-sm text-white/50 sm:grid">
          <span>Hora</span>
          <span>Voo</span>
          <span>De</span>
          <span>Para</span>
          <span>Alerta 3 h antes</span>
        </div>
        {voos && filtrados.length === 0 && (
          <p className="px-5 py-6 text-white/70">Nenhum voo com esses filtros nesse dia. Tente só o número, sem a companhia.</p>
        )}
        <ul>
          {filtrados.slice(0, mostrar).map((v) => {
            const iata = indice.empresas[v.e]?.[1] ?? v.e;
            const ativo = selecionado === v;
            return (
              <li key={`${v.e}${v.n}${v.h}${v.o}`}>
                <button
                  type="button"
                  onClick={() => {
                    setSelecionado(v);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className={`grid w-full grid-cols-[3.5rem_5.5rem_1fr] items-center gap-x-3 gap-y-1 border-t border-white/5 px-4 py-2.5 text-left font-cond text-lg hover:bg-white/5 sm:grid-cols-[4rem_6rem_1fr_1fr_14rem] sm:px-5 ${
                    ativo ? "bg-white/10" : ""
                  }`}
                >
                  <span>{v.h}</span>
                  <span className="font-semibold">
                    {iata} {v.n}
                  </span>
                  <span className="hidden truncate sm:block">{nomeAp(v.o)}</span>
                  <span className="truncate">{nomeAp(v.d)}</span>
                  <span className="col-span-3 flex items-center gap-2 text-[15px] sm:col-span-1">
                    <span className="w-24 shrink-0 sm:w-16">
                      <BarraProbabilidade p={v.p3} compacta />
                    </span>
                    <span style={{ color: COR[v.f3] }}>{ALERTA[v.f3]}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {filtrados.length > mostrar && (
          <button
            type="button"
            onClick={() => setMostrar((m) => m + PAGINA)}
            className="w-full border-t border-white/10 px-5 py-3 text-left font-cond text-lg text-sinal hover:bg-white/5"
          >
            Mostrar mais {Math.min(PAGINA, filtrados.length - mostrar)} de {(filtrados.length - mostrar).toLocaleString("pt-BR")} restantes
          </button>
        )}
      </section>
    </div>
  );
}
