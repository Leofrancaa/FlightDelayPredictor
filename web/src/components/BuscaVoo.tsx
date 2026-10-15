"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DetalheVoo from "./DetalheVoo";
import type { Horizonte, Indice, Resumo, Voo } from "@/lib/types";

const PAGINA = 60;
const TODOS = "";
const PERIODOS = [
  { id: "", nome: "Dia todo", de: 0, ate: 24 },
  { id: "madrugada", nome: "Madrugada", de: 0, ate: 6 },
  { id: "manha", nome: "Manhã", de: 6, ate: 12 },
  { id: "tarde", nome: "Tarde", de: 12, ate: 18 },
  { id: "noite", nome: "Noite", de: 18, ate: 24 },
];
const IATA: Record<string, string> = {
  SBGR: "GRU", SBSP: "CGH", SBKP: "VCP", SBCF: "CNF", SBBR: "BSB",
  SBGL: "GIG", SBRJ: "SDU", SBPA: "POA", SBCT: "CWB", SBRF: "REC",
};
const DIAS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const VERDE = "#3fb394";
const VERMELHO = "#e55a4c";

/** "G3 1402", "g31402", "1402" -> { iata: "G3" | null, numero: "1402" } */
function lerBusca(texto: string): { iata: string | null; numero: string } {
  const t = texto.toUpperCase().replace(/\s+/g, "");
  // código IATA tem ao menos uma letra (G3, LA, AD, 2Z), senão "3321" viraria iata "33" + número "21"
  const m = t.match(/^([A-Z][A-Z0-9]|[0-9][A-Z])?(\d{1,4})$/);
  if (!m) return { iata: null, numero: t.replace(/\D/g, "") };
  return { iata: m[1] ?? null, numero: m[2].replace(/^0+/, "") };
}

const somarMin = (hhmm: string, min: number) => {
  const [h, m] = hhmm.split(":").map(Number);
  const t = (((h * 60 + m + min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

/** Texto em plaquinhas que viram uma a uma. `inicio` escalona a animação entre linhas. */
function Plaquinhas({ texto, inicio = 0 }: { texto: string; inicio?: number }) {
  return (
    <span aria-label={texto} className="whitespace-nowrap">
      {[...texto].map((c, i) => (
        <span key={i} aria-hidden className="flap" style={{ "--i": inicio + i } as React.CSSProperties}>
          {c === " " ? " " : c}
        </span>
      ))}
    </span>
  );
}

function Modal({ aberto, onFechar, titulo, children }: { aberto: boolean; onFechar: () => void; titulo: string; children: React.ReactNode }) {
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const antes = document.activeElement as HTMLElement | null;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", tecla);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    caixa.current?.focus();
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = overflow;
      antes?.focus();
    };
  }, [aberto, onFechar]);
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-2 backdrop-blur-sm sm:p-6" onClick={onFechar}>
      <div
        ref={caixa}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        className="relative w-full max-w-5xl outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-painel text-xl leading-none text-white hover:bg-black"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}

export default function BuscaVoo() {
  const [indice, setIndice] = useState<Indice | null>(null);
  const [data, setData] = useState("");
  const [voos, setVoos] = useState<Voo[] | null>(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [aeroporto, setAeroporto] = useState("SBGR");
  const [periodo, setPeriodo] = useState("");
  const [soRisco, setSoRisco] = useState(false);
  const [selecionado, setSelecionado] = useState<Voo | null>(null);
  const [mostrar, setMostrar] = useState(PAGINA);
  const [limiares, setLimiares] = useState<Partial<Record<Horizonte, number>>>({});

  useEffect(() => {
    // limiares do alerta de cada horizonte (vêm no indice; se não, do resumo do modelo)
    fetch("/data/resumo.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((r: Resumo | null) => {
        if (r?.modelos)
          setLimiares(Object.fromEntries(Object.entries(r.modelos).map(([k, m]) => [k, m.limiar])) as Record<Horizonte, number>);
      })
      .catch(() => undefined);
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
      .then((v: Voo[]) => setVoos([...v].sort((a, b) => a.h.localeCompare(b.h))))
      .catch(() => setErro(`Não há voos para ${data}.`));
  }, [data]);

  const iataParaIcao = useMemo(() => {
    const m: Record<string, string> = {};
    if (indice) for (const [icao, [, iata]] of Object.entries(indice.empresas)) m[iata] = icao;
    return m;
  }, [indice]);

  useEffect(() => setMostrar(PAGINA), [data, busca, aeroporto, periodo, soRisco]);
  const fechar = useCallback(() => setSelecionado(null), []);

  const buscando = busca.trim() !== "";
  const naVista = useMemo(() => {
    if (!voos) return [];
    const { iata, numero } = lerBusca(busca);
    const empresa = iata ? iataParaIcao[iata] : null;
    const p = PERIODOS.find((x) => x.id === periodo)!;
    return voos.filter((v) => {
      if (buscando)
        return (!numero || v.n === numero || (!empresa && v.n.startsWith(numero))) && (!iata || !empresa || v.e === empresa);
      const hora = Number(v.h.slice(0, 2));
      return (!aeroporto || v.o === aeroporto) && hora >= p.de && hora < p.ate;
    });
  }, [voos, busca, buscando, aeroporto, periodo, iataParaIcao]);
  const comRisco = useMemo(() => naVista.filter((v) => v.f1), [naVista]);
  const filtrados = soRisco && !buscando ? comRisco : naVista;

  if (erro) return <p className="mt-6 rounded-md border border-[var(--f3)] bg-cartao p-4">{erro}</p>;
  if (!indice) return <p className="mt-6 text-tinta-2">Carregando…</p>;

  const lim = indice.limiares ?? limiares;
  const origens = voos ? [...new Set(voos.map((v) => v.o))].sort() : [];
  const nomeAp = (c: string) => indice.aeroportos[c] ?? c;
  const curto = (c: string) => nomeAp(c).replace("Rio de Janeiro/", "Rio/").replace("Belo Horizonte/", "BH/");
  const iataDe = (v: Voo) => indice.empresas[v.e]?.[1] ?? v.e;
  const d = data ? new Date(`${data}T12:00:00`) : null;
  const dataLonga = d ? `${DIAS[d.getDay()]} ${data.slice(8)} ${MESES[d.getMonth()]} ${data.slice(0, 4)}` : "";
  const chaveAnim = `${data}|${aeroporto}|${periodo}|${soRisco}|${buscando ? busca : ""}`;
  const i = data ? indice.datas.indexOf(data) : -1;

  return (
    <div className="mt-6">
      {/* Abas de aeroporto: "em qual aeroporto você está?" */}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div role="tablist" aria-label="Aeroporto de partida" className="flex min-w-max gap-1">
          {[...origens, TODOS].map((c) => {
            const ativo = !buscando && aeroporto === c;
            return (
              <button
                key={c || "todos"}
                role="tab"
                type="button"
                aria-selected={ativo}
                onClick={() => {
                  setAeroporto(c);
                  setBusca("");
                }}
                className={`rounded-t-md px-3 py-2 text-left font-cond leading-tight ${
                  ativo ? "bg-painel text-sinal" : "bg-cartao text-tinta-2 hover:text-tinta"
                }`}
              >
                <span className="block text-lg font-semibold">{c ? (IATA[c] ?? c) : "Todos"}</span>
                <span className="block max-w-28 truncate text-xs">{c ? curto(c) : "os 10 aeroportos"}</span>
              </button>
            );
          })}
        </div>
      </div>

      <section className="overflow-hidden rounded-b-lg rounded-tr-lg bg-painel text-painel-texto shadow-lg">
        {/* Cabeçalho do painel */}
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-white/10 px-4 py-4 sm:px-5">
          <div>
            <p className="font-cond text-sm uppercase tracking-[0.2em] text-white/50">Partidas</p>
            <h2 className="font-cond text-2xl font-semibold uppercase text-sinal sm:text-3xl">
              {buscando ? `Voo ${busca.toUpperCase()}` : aeroporto ? nomeAp(aeroporto) : "Todos os aeroportos"}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 font-cond">
            <div className="flex items-center rounded border border-white/15">
              <button type="button" aria-label="Dia anterior" disabled={i <= 0} onClick={() => setData(indice.datas[i - 1])} className="px-2.5 py-1.5 text-lg hover:bg-white/10 disabled:opacity-30">
                ‹
              </button>
              <label className="relative px-1 text-base tracking-wide">
                <span className="sr-only">Dia do voo</span>
                {dataLonga}
                <input
                  type="date"
                  value={data}
                  min={indice.datas[0]}
                  max={indice.datas.at(-1)}
                  onChange={(e) => indice.datas.includes(e.target.value) && setData(e.target.value)}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </label>
              <button type="button" aria-label="Próximo dia" disabled={i >= indice.datas.length - 1} onClick={() => setData(indice.datas[i + 1])} className="px-2.5 py-1.5 text-lg hover:bg-white/10 disabled:opacity-30">
                ›
              </button>
            </div>
            <input
              type="search"
              placeholder="Buscar voo: G3 1402"
              aria-label="Buscar pelo número do voo"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-44 rounded border border-white/15 bg-transparent px-3 py-1.5 text-base text-white placeholder:text-white/40"
            />
          </div>
        </div>

        {!buscando && (
          <div className="flex gap-1 overflow-x-auto border-b border-white/10 px-4 py-2 font-cond sm:px-5" role="group" aria-label="Período do dia">
            {PERIODOS.map((p) => (
              <button
                key={p.id || "dia"}
                type="button"
                aria-pressed={periodo === p.id}
                onClick={() => setPeriodo(p.id)}
                className={`shrink-0 rounded px-3 py-1 text-[15px] ${periodo === p.id ? "bg-white/15 text-white" : "text-white/55 hover:text-white"}`}
              >
                {p.nome}
                {p.id && <span className="ml-1 text-white/40">{String(p.de).padStart(2, "0")}–{String(p.ate).padStart(2, "0")}h</span>}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={soRisco}
              onClick={() => setSoRisco((x) => !x)}
              className={`ml-auto flex shrink-0 items-center gap-2 rounded border px-3 py-1 text-[15px] ${
                soRisco ? "border-[#e55a4c] bg-[#e55a4c]/20 text-white" : "border-white/15 text-white/70 hover:text-white"
              }`}
            >
              <span className={`inline-block h-2.5 w-2.5 rounded-full bg-[#e55a4c] ${soRisco ? "piscar" : ""}`} aria-hidden />
              Só risco de atraso
              <span className="rounded bg-black/30 px-1.5 text-white/80">{voos ? comRisco.length : "–"}</span>
            </button>
            <span className="shrink-0 self-center pl-3 text-[15px] text-white/50">
              {voos ? `${filtrados.length.toLocaleString("pt-BR")} ${filtrados.length === 1 ? "voo" : "voos"}` : "carregando…"}
            </span>
          </div>
        )}

        <div className="hidden grid-cols-[4.5rem_7rem_1fr_11rem_10rem] gap-4 px-5 pb-1 pt-3 font-cond text-sm uppercase tracking-wider text-white/45 md:grid">
          <span>Hora</span>
          <span>Voo</span>
          <span>Destino</span>
          <span>Previsão (1 h antes)</span>
          <span>Situação</span>
        </div>

        {voos && filtrados.length === 0 && (
          <p className="px-5 py-8 text-white/70">
            {buscando ? "Nenhum voo com esse número nesse dia. Tente só o número, sem a companhia." : soRisco
                ? "Nenhum voo com risco de atraso nesse período. Bom sinal!"
                : "Nenhuma partida nesse período."}
          </p>
        )}

        <ul key={chaveAnim} className="font-cond">
          {filtrados.slice(0, mostrar).map((v, idx) => {
            const atraso = v.a > 30;
            const inicio = Math.min(idx, 18) * 2;
            return (
              <li key={`${v.e}${v.n}${v.h}${v.o}`} className={idx % 2 ? "bg-white/[0.025]" : ""}>
                <button
                  type="button"
                  onClick={() => setSelecionado(v)}
                  className="grid w-full grid-cols-[4rem_6.5rem_1fr] items-center gap-x-3 gap-y-1.5 border-t border-white/5 px-4 py-2.5 text-left text-lg hover:bg-white/[0.07] md:grid-cols-[4.5rem_7rem_1fr_11rem_10rem] md:gap-x-4 md:px-5"
                >
                  <span className="text-sinal">
                    <Plaquinhas texto={v.h} inicio={inicio} />
                  </span>
                  <span className="text-white">
                    <Plaquinhas texto={`${iataDe(v)} ${v.n}`} inicio={inicio + 3} />
                  </span>
                  <span className="min-w-0 truncate uppercase tracking-wide text-white">
                    {buscando && <span className="text-white/50">{IATA[v.o] ?? v.o} → </span>}
                    {curto(v.d)}
                  </span>
                  <span className="col-span-3 flex items-center gap-2 text-[15px] uppercase tracking-wide md:col-span-1 md:text-base">
                    <span
                      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${v.f1 ? "piscar" : ""}`}
                      style={{ background: v.f1 ? VERMELHO : VERDE }}
                      aria-hidden
                    />
                    <span style={{ color: v.f1 ? VERMELHO : VERDE }}>{v.f1 ? "Risco de atraso" : "No horário"}</span>
                    <span className="text-white/45">{v.p1}%</span>
                    <span className="ml-auto text-white/60 md:hidden">
                      Partiu {somarMin(v.h, v.a)}
                      {atraso && <span style={{ color: VERMELHO }}> +{v.a}′</span>}
                    </span>
                  </span>
                  <span className="hidden text-base uppercase tracking-wide md:block">
                    <span className="text-white/60">Partiu </span>
                    <span style={{ color: atraso ? VERMELHO : "#fff" }}>{somarMin(v.h, v.a)}</span>
                    {v.a > 5 && <span style={{ color: atraso ? VERMELHO : "rgba(255,255,255,.5)" }}> +{v.a}′</span>}
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

      <p className="mt-3 text-sm text-tinta-2">
        <strong className="text-tinta">Previsão</strong>: o alerta do modelo 1 h antes da partida, com a chance de atrasar
        mais de 30 min. <strong className="text-tinta">Situação</strong>: o que aconteceu de fato. Clique num voo para ver os
        detalhes e a animação do trajeto.
      </p>

      <Modal aberto={!!selecionado} onFechar={fechar} titulo="Detalhe do voo">
        {selecionado && <DetalheVoo voo={selecionado} indice={indice} data={data} limiares={lim} />}
      </Modal>
    </div>
  );
}
