"use client";

import { useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { COR, FAIXAS, inteiro, num, pct } from "@/lib/faixas";
import type { Resumo, Taxa } from "@/lib/types";

type Horizonte = "vespera" | "h3";
const NOME_H: Record<Horizonte, string> = { vespera: "Véspera", h3: "3 h antes" };
const DIAS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const COR_GRUPO: Record<string, string> = {
  propagação: "var(--f2)",
  clima: "#2a78d6",
  histórico: "var(--tinta-2)",
  programação: "var(--linha)",
};

function Secao({ titulo, children, nota }: { titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-linha bg-cartao p-5">
      <h2 className="font-cond text-2xl font-semibold">{titulo}</h2>
      {nota && <p className="mt-1 max-w-3xl text-[15px] text-tinta-2">{nota}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Seletor({ valor, onChange }: { valor: Horizonte; onChange: (h: Horizonte) => void }) {
  return (
    <div className="inline-flex rounded-md border border-linha p-0.5" role="group" aria-label="Horizonte de previsão">
      {(["vespera", "h3"] as const).map((h) => (
        <button
          key={h}
          type="button"
          aria-pressed={valor === h}
          onClick={() => onChange(h)}
          className={`rounded px-3 py-1 text-sm ${valor === h ? "bg-painel text-painel-texto" : "text-tinta-2 hover:text-tinta"}`}
        >
          {NOME_H[h]}
        </button>
      ))}
    </div>
  );
}

/** Barras horizontais de taxa de atraso > 30 min, com a média geral marcada. */
function BarrasTaxa({ dados, rotulo, media }: { dados: Taxa[]; rotulo: (c: string) => string; media: number }) {
  const max = Math.max(...dados.map((d) => d.taxa30 ?? 0), media) * 1.1;
  return (
    <ul className="space-y-1.5">
      {dados.map((d) => (
        <li key={d.chave} className="grid grid-cols-[minmax(7rem,11rem)_1fr_3.5rem] items-center gap-3 text-sm">
          <span className="truncate text-tinta-2" title={rotulo(d.chave)}>
            {rotulo(d.chave)}
          </span>
          <span className="relative h-4 rounded-sm bg-pista">
            <span className="absolute inset-y-0 left-0 rounded-sm bg-[#2a78d6]" style={{ width: `${((d.taxa30 ?? 0) / max) * 100}%` }} />
            <span className="absolute inset-y-[-3px] w-px bg-tinta" style={{ left: `${(media / max) * 100}%` }} aria-hidden />
          </span>
          <span className="text-right font-medium">{pct(d.taxa30)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PainelAnalista({ r }: { r: Resumo }) {
  const [h, setH] = useState<Horizonte>("h3");
  const media = r.eda.clima[0]?.taxa30 ?? 0;
  const chute = r.modelos[0];
  const final = r.modelos.find((m) => m.nome === "3 h antes") ?? r.modelos.at(-1)!;
  const maxImp = Math.max(...r.importancia.map((i) => i.valor));
  const porAeroporto = [...r.eda.por_aeroporto].sort((a, b) => (b.taxa30 ?? 0) - (a.taxa30 ?? 0));
  const porEmpresa = r.eda.por_empresa.filter((e) => e.voos > 5000).sort((a, b) => (b.taxa30 ?? 0) - (a.taxa30 ?? 0));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-cond text-4xl font-semibold">Análise do modelo</h1>
        <p className="mt-2 max-w-3xl text-tinta-2">
          Gradient boosting em árvores, treinado com {inteiro(r.n_treino)} partidas de jan a set de 2025 e testado em{" "}
          {inteiro(r.n_teste)} partidas de out a dez, que o modelo nunca viu. O alvo é a faixa de atraso da partida.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-painel p-5 text-painel-texto">
          <p className="text-sm text-white/60">PR-AUC de atraso &gt; 30 min, 3 h antes</p>
          <p className="font-cond text-5xl font-semibold text-sinal">{num(final["PR-AUC atraso>30"], 2)}</p>
          <p className="text-sm text-white/70">contra {num(chute["PR-AUC atraso>30"], 2)} de um chute</p>
        </div>
        <div className="rounded-lg border border-linha bg-cartao p-5">
          <p className="text-sm text-tinta-2">Atrasos &gt; 30 min detectados</p>
          <p className="font-cond text-5xl font-semibold">{pct(final["recall atraso>30"], 0)}</p>
          <p className="text-sm text-tinta-2">com precisão de {pct(final["precisão atraso>30"], 0)} nos alertas</p>
        </div>
        <div className="rounded-lg border border-linha bg-cartao p-5">
          <p className="text-sm text-tinta-2">Faixa prevista certa ou vizinha</p>
          <p className="font-cond text-5xl font-semibold">{pct(final["erro de no máx. 1 faixa"], 0)}</p>
          <p className="text-sm text-tinta-2">dos voos do teste</p>
        </div>
      </div>

      <Secao
        titulo="Comparação de modelos (teste out–dez)"
        nota="Ranking: quanto o modelo ordena bem o risco, sem depender de limiar. Decisão: resultado após calibrar o limiar para priorizar o recall (alarme falso custa pouco). O chute não tem limiar calibrado."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[15px]">
            <thead className="text-sm text-tinta-2">
              <tr className="border-b border-linha">
                <th className="py-2 pr-3 font-medium">Modelo</th>
                <th className="py-2 pr-3 font-medium">ROC-AUC &gt;30</th>
                <th className="py-2 pr-3 font-medium">PR-AUC &gt;30</th>
                <th className="py-2 pr-3 font-medium">Log loss</th>
                <th className="py-2 pr-3 font-medium">Recall &gt;30</th>
                <th className="py-2 pr-3 font-medium">Precisão &gt;30</th>
                <th className="py-2 font-medium">F2 macro</th>
              </tr>
            </thead>
            <tbody>
              {r.modelos.map((m) => (
                <tr key={m.nome} className="border-b border-linha/60 last:border-0">
                  <td className="py-2 pr-3 font-medium">{m.nome}</td>
                  <td className="py-2 pr-3">{num(m["ROC-AUC atraso>30"])}</td>
                  <td className="py-2 pr-3">{num(m["PR-AUC atraso>30"])}</td>
                  <td className="py-2 pr-3">{num(m.log_loss)}</td>
                  <td className="py-2 pr-3">{pct(m["recall atraso>30"])}</td>
                  <td className="py-2 pr-3">{pct(m["precisão atraso>30"])}</td>
                  <td className="py-2">{num(m["F2 macro"])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Secao>

      <div className="grid gap-6 lg:grid-cols-2">
        <Secao titulo="Matriz de confusão" nota="Cada linha é a faixa real; as células mostram para onde o modelo mandou esses voos (% da linha).">
          <Seletor valor={h} onChange={setH} />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[420px] text-center text-sm">
              <thead>
                <tr className="text-tinta-2">
                  <th className="p-1 text-left font-medium">real \ previsto</th>
                  {FAIXAS.map((f) => (
                    <th key={f} className="p-1 font-medium">
                      {f}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.confusao[h].map((linha, i) => (
                  <tr key={i}>
                    <th className="p-1 text-left font-medium">
                      <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COR[i] }} aria-hidden />
                      {FAIXAS[i]}
                    </th>
                    {linha.map((v, j) => (
                      <td
                        key={j}
                        className="p-2 font-medium"
                        style={{
                          background: `color-mix(in srgb, #2a78d6 ${Math.round(v * 0.85)}%, transparent)`,
                          color: v > 55 ? "#fff" : undefined,
                          outline: i === j ? "2px solid var(--tinta)" : undefined,
                          outlineOffset: -2,
                        }}
                      >
                        {v.toFixed(0)}%
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Secao>

        <Secao titulo="Desempenho por faixa" nota={`Pesos de decisão (${NOME_H[h]}): ${r.pesos[h].join(", ")}. Peso maior = o modelo aceita mais alarmes falsos naquela faixa.`}>
          <Seletor valor={h} onChange={setH} />
          <table className="mt-4 w-full text-left text-[15px]">
            <thead className="text-sm text-tinta-2">
              <tr className="border-b border-linha">
                <th className="py-2 font-medium">Faixa</th>
                <th className="py-2 font-medium">Precisão</th>
                <th className="py-2 font-medium">Recall</th>
                <th className="py-2 font-medium">F1</th>
                <th className="py-2 text-right font-medium">Voos</th>
              </tr>
            </thead>
            <tbody>
              {r.por_faixa[h].map((f, i) => (
                <tr key={f.faixa} className="border-b border-linha/60 last:border-0">
                  <td className="py-2">
                    <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COR[i] }} aria-hidden />
                    {f.faixa}
                  </td>
                  <td className="py-2">{pct(f.precisao)}</td>
                  <td className="py-2">{pct(f.recall)}</td>
                  <td className="py-2">{num(f.f1)}</td>
                  <td className="py-2 text-right">{inteiro(f.voos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Secao>
      </div>

      <Secao
        titulo="O que o modelo usa"
        nota="Importância por permutação no modelo de 3 h: quanto o log loss piora quando a variável é embaralhada."
      >
        <ul className="mb-4 flex flex-wrap gap-4 text-sm text-tinta-2">
          {Object.entries(COR_GRUPO).map(([g, c]) => (
            <li key={g} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: c }} aria-hidden />
              {g}
            </li>
          ))}
        </ul>
        <ul className="space-y-1.5">
          {r.importancia.map((i) => (
            <li key={i.variavel} className="grid grid-cols-[minmax(9rem,15rem)_1fr] items-center gap-3 text-sm">
              <span className="truncate text-tinta-2" title={i.variavel}>
                {i.descricao}
              </span>
              <span className="h-4 rounded-sm" style={{ width: `${Math.max((i.valor / maxImp) * 100, 0.5)}%`, background: COR_GRUPO[i.grupo] }} />
            </li>
          ))}
        </ul>
      </Secao>

      <Secao
        titulo="O ganho se mantém semana a semana?"
        nota="PR-AUC de atraso > 30 min por semana do teste. A linha cinza é o chute (a proporção de atrasos naquela semana)."
      >
        <div className="h-72 w-full">
          <ResponsiveContainer>
            <LineChart data={r.semanal} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="var(--linha)" vertical={false} />
              <XAxis
                dataKey="semana"
                tickFormatter={(s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`}
                tick={{ fill: "var(--tinta-2)", fontSize: 12 }}
                stroke="var(--linha)"
              />
              <YAxis domain={[0, "auto"]} tick={{ fill: "var(--tinta-2)", fontSize: 12 }} stroke="var(--linha)" />
              <Tooltip
                formatter={(v: number) => num(v, 3)}
                labelFormatter={(s: string) => `semana de ${s.slice(8, 10)}/${s.slice(5, 7)}`}
                contentStyle={{ background: "var(--cartao)", border: "1px solid var(--linha)", color: "var(--tinta)" }}
              />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              <Line type="monotone" dataKey="h3" name="3 h antes" stroke="#2a78d6" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="vespera" name="Véspera" stroke="var(--f2)" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="prevalencia" name="Chute" stroke="var(--tinta-2)" strokeWidth={2} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Secao>

      <h2 className="pt-4 font-cond text-3xl font-semibold">Os dados de 2025</h2>
      <p className="-mt-4 max-w-3xl text-tinta-2">
        Taxa de partidas com mais de 30 min de atraso no ano todo. A linha vertical marca a média geral ({pct(media)}).
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Secao titulo="Clima na origem, 3 h antes">
          <BarrasTaxa dados={r.eda.clima} rotulo={(c) => c} media={media} />
          <p className="mt-3 text-sm text-tinta-2">
            {r.eda.clima.map((c) => `${c.chave}: ${inteiro(c.voos)} voos`).slice(1).join("; ")}.
          </p>
        </Secao>
        <Secao titulo="Por hora da partida">
          <BarrasTaxa dados={r.eda.por_hora} rotulo={(c) => `${c}h`} media={media} />
        </Secao>
        <Secao titulo="Por aeroporto de origem">
          <BarrasTaxa dados={porAeroporto} rotulo={(c) => c} media={media} />
        </Secao>
        <div className="space-y-6">
          <Secao titulo="Por companhia">
            <BarrasTaxa dados={porEmpresa} rotulo={(c) => c} media={media} />
          </Secao>
          <Secao titulo="Por dia da semana">
            <BarrasTaxa dados={r.eda.por_dia_semana} rotulo={(c) => DIAS[Number(c)]} media={media} />
          </Secao>
          <Secao titulo="Por mês">
            <BarrasTaxa dados={r.eda.por_mes} rotulo={(c) => MESES[Number(c) - 1]} media={media} />
          </Secao>
        </div>
      </div>
    </div>
  );
}
