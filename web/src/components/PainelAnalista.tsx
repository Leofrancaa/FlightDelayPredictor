"use client";

import { Fragment, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CLASSES, COR, NOME_H, ORDEM_H, inteiro, mesCurto, num, pct } from "@/lib/faixas";
import type { Horizonte, Modelo, Resumo, Taxa } from "@/lib/types";

const DIAS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const COR_H: Record<Horizonte, string> = { h1: "#184f95", h3: "#2a78d6", vespera: "var(--f2)" };
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
      {ORDEM_H.map((h) => (
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
        <li key={d.chave} className="grid grid-cols-[minmax(7rem,13rem)_1fr_3.5rem] items-center gap-3 text-sm">
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

/** Precisão, recall e F1 de cada classe, a partir da matriz de confusão (% por linha) e da prevalência. */
function porClasse(m: Modelo) {
  const p = m.prevalência;
  const [[tn, fp], [fn, tp]] = m.confusao.map((l, i) => l.map((v) => (v / 100) * (i ? p : 1 - p)));
  return [
    [tn, fn, fp],
    [tp, fp, fn],
  ].map(([acerto, falsoPos, falsoNeg]) => {
    const precisao = acerto / (acerto + falsoPos);
    const recall = acerto / (acerto + falsoNeg);
    return { precisao, recall, f1: (2 * precisao * recall) / (precisao + recall) };
  });
}

const eixo = { tick: { fill: "var(--tinta-2)", fontSize: 12 }, stroke: "var(--linha)" };
const dica = { background: "var(--cartao)", border: "1px solid var(--linha)", color: "var(--tinta)" };

export default function PainelAnalista({ r }: { r: Resumo }) {
  const [h, setH] = useState<Horizonte>("h1");
  const m1 = r.modelos.h1;
  const media = r.eda.clima[0]?.taxa30 ?? 0;
  const maxImp = Math.max(...r.importancia.map((i) => i.valor));
  const porAeroporto = [...r.eda.por_aeroporto].sort((a, b) => (b.taxa30 ?? 0) - (a.taxa30 ?? 0));
  const porEmpresa = r.eda.por_empresa.filter((e) => e.voos > 20000).sort((a, b) => (b.taxa30 ?? 0) - (a.taxa30 ?? 0));
  const mensal = r.mensal.h1.map((m, i) => ({
    mes: m.mes,
    prevalencia: m.prevalencia,
    h1: m.pr_auc,
    h3: r.mensal.h3[i]?.pr_auc,
    vespera: r.mensal.vespera[i]?.pr_auc,
    precisao: m.precisao,
    recall: m.recall,
  }));
  const linhas: { nome: string; m: Resumo["chute"]; limiar?: number }[] = [
    { nome: "Chute (proporção do treino)", m: r.chute },
    ...ORDEM_H.map((k) => ({ nome: NOME_H[k], m: r.modelos[k], limiar: r.modelos[k].limiar })),
  ];
  const cm = r.modelos[h].confusao;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-cond text-4xl font-semibold">Análise do modelo</h1>
        <p className="mt-2 max-w-3xl text-tinta-2">
          Gradient boosting em árvores que estima a chance de uma partida atrasar mais de 30 min. Treino em{" "}
          {r.periodos.treino} ({inteiro(r.n.treino)} partidas), validação em {r.periodos.validacao} para escolher o limiar
          do alerta, e teste em {r.periodos.teste} (
          {inteiro(r.n.teste)} partidas que o modelo nunca viu).
          {" "}
          Dados da BTS nos 10 maiores aeroportos dos EUA, com a matrícula de cada avião e METAR. Na véspera o modelo não
          usa nada que dependa da matrícula: a BTS registra o avião que de fato voou, e a troca de avião por causa de um
          atraso vazaria para o modelo.
          {r.periodos_anomalos.length > 0 && (
            <>
              {" "}
              Períodos com dados incompletos ou atípicos ficam fora:{" "}
              {r.periodos_anomalos.map(([a, b]) => `${a.slice(0, 7)} a ${b.slice(0, 7)}`).join(", ")} (fim exclusivo).
            </>
          )}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-painel p-5 text-painel-texto">
          <p className="text-sm text-white/60">PR-AUC, 1 h antes</p>
          <p className="font-cond text-5xl font-semibold text-sinal">{num(m1["PR-AUC"], 2)}</p>
          <p className="text-sm text-white/70">contra {num(r.chute["PR-AUC"], 2)} de um chute</p>
        </div>
        <div className="rounded-lg border border-linha bg-cartao p-5">
          <p className="text-sm text-tinta-2">Atrasos &gt; 30 min avisados</p>
          <p className="font-cond text-5xl font-semibold">{pct(m1.recall, 0)}</p>
          <p className="text-sm text-tinta-2">e {pct(m1.precisão, 0)} dos alertas se confirmam</p>
        </div>
        <div className="rounded-lg border border-linha bg-cartao p-5">
          <p className="text-sm text-tinta-2">Voos com alerta</p>
          <p className="font-cond text-5xl font-semibold">{pct(m1["% voos com alerta"], 0)}</p>
          <p className="text-sm text-tinta-2">para {pct(m1.prevalência, 0)} que de fato atrasam</p>
        </div>
      </div>

      <Secao
        titulo={`Comparação dos horizontes (teste ${r.periodos.teste})`}
        nota="Ranking (ROC-AUC, PR-AUC, log loss): quanto o modelo ordena bem o risco, sem depender de limiar. Decisão (precisão, recall, F1): no limiar escolhido em 2023 para equilibrar precisão e recall."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-[15px]">
            <thead className="text-sm text-tinta-2">
              <tr className="border-b border-linha">
                {["Modelo", "ROC-AUC", "PR-AUC", "Log loss", "Limiar", "Precisão", "Recall", "F1"].map((c) => (
                  <th key={c} className="py-2 pr-3 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ nome, m, limiar }) => (
                <tr key={nome} className="border-b border-linha/60 last:border-0">
                  <td className="py-2 pr-3 font-medium">{nome}</td>
                  <td className="py-2 pr-3">{num(m["ROC-AUC"])}</td>
                  <td className="py-2 pr-3">{num(m["PR-AUC"])}</td>
                  <td className="py-2 pr-3">{num(m.log_loss)}</td>
                  <td className="py-2 pr-3">{limiar != null ? pct(limiar, 0) : "–"}</td>
                  <td className="py-2 pr-3">{limiar != null ? pct(m.precisão) : "–"}</td>
                  <td className="py-2 pr-3">{limiar != null ? pct(m.recall) : "–"}</td>
                  <td className="py-2">{limiar != null ? num(m.F1) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Secao>

      <Secao
        titulo={`Desempenho por classe (teste ${r.periodos.teste})`}
        nota={`Precisão, recall e F1 de cada classe no limiar do site. "Até 30 min" parece ótimo porque ${pct(1 - m1.prevalência, 0)} dos voos saem com no máximo 30 min de atraso: dizer "até 30 min" para todos daria ${pct(1 - m1.prevalência, 0)} de precisão e 100% de recall nessa classe. A classe difícil é "> 30 min".`}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[15px]">
            <thead className="text-sm text-tinta-2">
              <tr>
                <th rowSpan={2} className="border-b border-linha py-2 pr-3 align-bottom font-medium">
                  Modelo
                </th>
                {CLASSES.map((c, i) => (
                  <th key={c} colSpan={3} className="pt-2 pr-4 font-semibold text-tinta">
                    <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COR[i] }} aria-hidden />
                    {c}
                  </th>
                ))}
              </tr>
              <tr className="border-b border-linha">
                {CLASSES.flatMap((c) =>
                  ["Precisão", "Recall", "F1"].map((t) => (
                    <th key={c + t} className="py-2 pr-2 font-medium">
                      {t}
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {ORDEM_H.map((k) => (
                <tr key={k} className="border-b border-linha/60 last:border-0">
                  <td className="py-2 pr-3 font-medium">{NOME_H[k]}</td>
                  {porClasse(r.modelos[k]).map((c, i) => (
                    <Fragment key={i}>
                      <td className="py-2 pr-2">{pct(c.precisao)}</td>
                      <td className="py-2 pr-2">{pct(c.recall)}</td>
                      <td className="py-2 pr-4">{num(c.f1)}</td>
                    </Fragment>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Secao>

      {r.matricula && r.causas && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Secao
            titulo="Quanto vale saber qual avião faz o voo"
            nota="Mesmo modelo de 1 h, com o mesmo clima e o mesmo resto. Sem matrícula, o voo que traz o avião é adivinhado (o último da mesma companhia chegando na origem)."
          >
            <table className="w-full text-left text-[15px]">
              <thead className="text-sm text-tinta-2">
                <tr className="border-b border-linha">
                  {["Modelo", "PR-AUC", "Precisão", "Recall", "F1"].map((c) => (
                    <th key={c} className="py-2 pr-3 font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Sem matrícula", r.matricula.sem],
                  ["Com matrícula", r.matricula.com],
                ].map(([nome, m]) => {
                  const x = m as typeof r.matricula.sem;
                  return (
                    <tr key={nome as string} className="border-b border-linha/60 last:border-0">
                      <td className="py-2 pr-3 font-medium">{nome as string}</td>
                      <td className="py-2 pr-3">{num(x["PR-AUC"])}</td>
                      <td className="py-2 pr-3">{pct(x.precisão)}</td>
                      <td className="py-2 pr-3">{pct(x.recall)}</td>
                      <td className="py-2">{num(x.F1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Secao>
          <Secao
            titulo="Que atrasos o modelo pega"
            nota="A BTS informa a causa de cada atraso depois do voo (por isso ela não entra no modelo). Recall do alerta de 1 h em cada causa, no teste."
          >
            <table className="w-full text-left text-[15px]">
              <thead className="text-sm text-tinta-2">
                <tr className="border-b border-linha">
                  <th className="py-2 pr-3 font-medium">Causa</th>
                  <th className="py-2 pr-3 font-medium">% dos atrasos</th>
                  <th className="py-2 pr-3 font-medium">Sem matrícula</th>
                  <th className="py-2 font-medium">Com matrícula</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(r.causas)
                  .sort((a, b) => (b[1].parcela ?? 0) - (a[1].parcela ?? 0))
                  .map(([c, info]) => (
                    <tr key={c} className="border-b border-linha/60 last:border-0">
                      <td className="py-2 pr-3">{info.descricao}</td>
                      <td className="py-2 pr-3">{pct(info.parcela, 0)}</td>
                      <td className="py-2 pr-3">{pct(r.matricula!.sem.recall_por_causa[c], 0)}</td>
                      <td className="py-2 font-medium">{pct(r.matricula!.com.recall_por_causa[c], 0)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </Secao>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Secao
          titulo="Escolhendo o equilíbrio"
          nota="Melhor precisão possível para cada fração de atrasos que se quer pegar. Mais recall = mais alertas e mais alarmes falsos."
        >
          <Seletor valor={h} onChange={setH} />
          <table className="mt-4 w-full text-left text-[15px]">
            <thead className="text-sm text-tinta-2">
              <tr className="border-b border-linha">
                <th className="py-2 font-medium">Pegar (recall)</th>
                <th className="py-2 font-medium">Precisão dos alertas</th>
                <th className="py-2 text-right font-medium">Limiar</th>
              </tr>
            </thead>
            <tbody>
              {r.modelos[h].pontos_operacao.map((p) => (
                <tr key={p.recall} className="border-b border-linha/60 last:border-0">
                  <td className="py-2">{pct(p.recall, 0)} dos atrasos</td>
                  <td className="py-2">
                    <span className="mr-2 inline-block h-2.5 rounded-sm bg-[#2a78d6] align-middle" style={{ width: `${p.precisão * 100}px` }} />
                    {pct(p.precisão)}
                  </td>
                  <td className="py-2 text-right">{pct(p.limiar, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-sm text-tinta-2">
            O site usa o limiar de {pct(r.modelos[h].limiar, 0)} ({NOME_H[h].toLowerCase()}), escolhido em 2023 pelo F1.
          </p>
        </Secao>

        <Secao titulo="Matriz de confusão" nota="Cada linha é o que aconteceu; as células mostram o que o modelo previu (% da linha).">
          <Seletor valor={h} onChange={setH} />
          <table className="mt-4 w-full text-center text-sm">
            <thead>
              <tr className="text-tinta-2">
                <th className="p-1 text-left font-medium">real / previsto</th>
                <th className="p-1 font-medium">sem alerta</th>
                <th className="p-1 font-medium">alerta</th>
              </tr>
            </thead>
            <tbody>
              {cm.map((linha, i) => (
                <tr key={i}>
                  <th className="p-1 text-left font-medium">
                    <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COR[i] }} aria-hidden />
                    {CLASSES[i]}
                  </th>
                  {linha.map((v, j) => (
                    <td
                      key={j}
                      className="p-3 font-medium"
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
        </Secao>
      </div>

      <Secao
        titulo={`Sazonalidade: mês a mês em ${r.periodos.teste}`}
        nota="PR-AUC de cada horizonte por mês. A linha tracejada é o chute (a proporção de atrasos naquele mês): o ganho do modelo é a distância até ela."
      >
        <div className="h-72 w-full">
          <ResponsiveContainer>
            <LineChart data={mensal} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="var(--linha)" vertical={false} />
              <XAxis dataKey="mes" tickFormatter={mesCurto} interval={1} {...eixo} />
              <YAxis domain={[0, "auto"]} {...eixo} />
              <Tooltip formatter={(v: number) => num(v, 3)} labelFormatter={mesCurto} contentStyle={dica} />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              {ORDEM_H.slice()
                .reverse()
                .map((k) => (
                  <Line key={k} type="monotone" dataKey={k} name={NOME_H[k]} stroke={COR_H[k]} strokeWidth={2} dot={false} isAnimationActive={false} />
                ))}
              <Line type="monotone" dataKey="prevalencia" name="Chute" stroke="var(--tinta-2)" strokeWidth={2} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <h3 className="mt-6 font-semibold">Precisão e recall do alerta de 1 h, mês a mês</h3>
        <div className="mt-2 h-60 w-full">
          <ResponsiveContainer>
            <LineChart data={mensal} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="var(--linha)" vertical={false} />
              <XAxis dataKey="mes" tickFormatter={mesCurto} interval={1} {...eixo} />
              <YAxis domain={[0, 1]} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} {...eixo} />
              <Tooltip formatter={(v: number) => pct(v)} labelFormatter={mesCurto} contentStyle={dica} />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              <Line type="monotone" dataKey="precisao" name="Precisão" stroke="#184f95" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="recall" name="Recall" stroke="var(--f2)" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="prevalencia" name="% de atrasos" stroke="var(--tinta-2)" strokeWidth={2} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Secao>

      <div className="grid gap-6 lg:grid-cols-2">
        <Secao
          titulo="Quanto histórico usar"
          nota={`Mesmo modelo de 1 h e mesmo teste (${r.periodos.teste}), mudando só os anos de treino.`}
        >
          <table className="w-full text-left text-[15px]">
            <thead className="text-sm text-tinta-2">
              <tr className="border-b border-linha">
                <th className="py-2 font-medium">Treino</th>
                <th className="py-2 font-medium">Partidas</th>
                <th className="py-2 font-medium">PR-AUC</th>
                <th className="py-2 font-medium">Log loss</th>
              </tr>
            </thead>
            <tbody>
              {r.janelas.map((j) => (
                <tr key={j.janela} className="border-b border-linha/60 last:border-0">
                  <td className="py-2">{j.janela}</td>
                  <td className="py-2">{inteiro(j.voos_treino)}</td>
                  <td className="py-2">{num(j.pr_auc)}</td>
                  <td className="py-2">{num(j.log_loss, 4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Secao>

        <Secao titulo="Taxa de atraso por ano" nota="Partidas com mais de 30 min de atraso. Anos com períodos excluídos aparecem só com os meses válidos.">
          <BarrasTaxa dados={r.eda.por_ano} rotulo={(c) => c} media={media} />
        </Secao>
      </div>

      <Secao titulo="O que o modelo usa" nota="Importância por permutação no modelo de 1 h: quanto o log loss piora quando a variável é embaralhada.">
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

      <h2 className="pt-4 font-cond text-3xl font-semibold">Os dados de {r.desde} a {r.periodos.teste.slice(-4)}</h2>
      <p className="-mt-4 max-w-3xl text-tinta-2">
        Taxa de partidas com mais de 30 min de atraso. A linha vertical marca a média geral ({pct(media)}).
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Secao titulo="Condições 1 h antes da partida">
          <BarrasTaxa dados={r.eda.clima} rotulo={(c) => c} media={media} />
        </Secao>
        <Secao titulo="Por mês do ano">
          <BarrasTaxa dados={r.eda.por_mes} rotulo={(c) => MESES[Number(c) - 1]} media={media} />
        </Secao>
        <Secao titulo="Por hora da partida">
          <BarrasTaxa dados={r.eda.por_hora} rotulo={(c) => `${c}h`} media={media} />
        </Secao>
        <div className="space-y-6">
          <Secao titulo="Por aeroporto de origem">
            <BarrasTaxa dados={porAeroporto} rotulo={(c) => c} media={media} />
          </Secao>
          <Secao titulo="Por companhia">
            <BarrasTaxa dados={porEmpresa} rotulo={(c) => c} media={media} />
          </Secao>
          <Secao titulo="Por dia da semana">
            <BarrasTaxa dados={r.eda.por_dia_semana} rotulo={(c) => DIAS[Number(c)]} media={media} />
          </Secao>
        </div>
      </div>
    </div>
  );
}
