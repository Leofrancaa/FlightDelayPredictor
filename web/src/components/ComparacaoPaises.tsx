import { NOME_H, ORDEM_H, inteiro, num, pct } from "@/lib/faixas";
import type { Metricas, Resumo } from "@/lib/types";

const GRUPOS = ["propagação", "programação", "histórico", "clima"] as const;
const COR_GRUPO: Record<string, string> = {
  propagação: "var(--f2)",
  programação: "#8a96a3",
  histórico: "var(--tinta-2)",
  clima: "#2a78d6",
};
const COR_BR = "#23866f";
const COR_EUA = "#2a78d6";

/** Quanto do caminho entre o chute (PR-AUC = prevalência) e o modelo perfeito (1) o modelo andou.
 *  Permite comparar países com taxas de atraso diferentes, que o PR-AUC puro não permite. */
const ganho = (m: Pick<Metricas, "PR-AUC" | "prevalência">) => (m["PR-AUC"] - m.prevalência) / (1 - m.prevalência);

function Secao({ titulo, nota, children }: { titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-linha bg-cartao p-5">
      <h2 className="font-cond text-2xl font-semibold">{titulo}</h2>
      {nota && <p className="mt-1 max-w-3xl text-[15px] text-tinta-2">{nota}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Tabela({ cab, linhas, destaque }: { cab: string[]; linhas: React.ReactNode[][]; destaque?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-[15px]">
        <thead className="text-sm text-tinta-2">
          <tr className="border-b border-linha">
            {cab.map((c, i) => (
              <th key={i} className={`py-2 pr-3 font-medium ${i === destaque ? "text-tinta" : ""}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className="border-b border-linha/60 align-top last:border-0">
              {l.map((c, j) => (
                <td key={j} className={`py-2 pr-3 ${j === 0 ? "font-medium" : ""} ${j === destaque ? "font-semibold" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Barra horizontal simples (escala comum passada por `max`). */
function Barra({ rotulo, valor, max, cor, texto }: { rotulo: string; valor: number; max: number; cor: string; texto: string }) {
  return (
    <li className="grid grid-cols-[minmax(8rem,15rem)_1fr_3.5rem] items-center gap-3 text-sm">
      <span className="truncate text-tinta-2" title={rotulo}>
        {rotulo}
      </span>
      <span className="relative h-4 rounded-sm bg-pista">
        <span className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${Math.max((valor / max) * 100, 0.5)}%`, background: cor }} />
      </span>
      <span className="text-right font-medium">{texto}</span>
    </li>
  );
}

/** Parcela de cada grupo de variáveis na importância somada das 20 mais importantes. */
function parcelas(r: Resumo) {
  const total = r.importancia.reduce((s, i) => s + Math.max(i.valor, 0), 0);
  return GRUPOS.map((g) => ({
    grupo: g,
    parcela: r.importancia.filter((i) => i.grupo === g).reduce((s, i) => s + Math.max(i.valor, 0), 0) / total,
  }));
}

function BarraEmpilhada({ nome, dados }: { nome: string; dados: { grupo: string; parcela: number }[] }) {
  return (
    <div className="grid grid-cols-[4rem_1fr] items-center gap-3 text-sm">
      <span className="font-medium">{nome}</span>
      <span className="flex h-7 overflow-hidden rounded-sm">
        {dados
          .filter((d) => d.parcela > 0)
          .map((d) => (
            <span
              key={d.grupo}
              className="flex items-center justify-center text-xs font-semibold text-white"
              style={{ width: `${d.parcela * 100}%`, background: COR_GRUPO[d.grupo] }}
              title={`${d.grupo}: ${pct(d.parcela, 0)}`}
            >
              {d.parcela >= 0.07 ? pct(d.parcela, 0) : ""}
            </span>
          ))}
      </span>
    </div>
  );
}

export default function ComparacaoPaises({ br, eua }: { br: Resumo; eua: Resumo }) {
  const b1 = br.modelos.h1;
  const u1 = eua.modelos.h1;
  const sem = eua.matricula?.sem;
  const nTotal = (r: Resumo) => r.n.treino + r.n.validacao + r.n.teste;
  const cias = (r: Resumo) => r.eda.por_empresa.filter((e) => e.voos > 20000).length;
  const cascata = (r: Resumo) => r.eda.clima.find((c) => c.chave.includes("saiu > 30 min atrasado"));
  const cBr = cascata(br);
  const cEua = cascata(eua);
  const p20 = (r: Resumo) => r.modelos.h1.pontos_operacao.find((p) => p.recall === 0.2)?.precisão ?? null;
  const pBr = parcelas(br);
  const pEua = parcelas(eua);
  const propBr = pBr.find((p) => p.grupo === "propagação")!.parcela;
  const propEua = pEua.find((p) => p.grupo === "propagação")!.parcela;
  const TOP = 8;
  const maxImp = Math.max(...br.importancia.slice(0, TOP).map((i) => i.valor), ...eua.importancia.slice(0, TOP).map((i) => i.valor));
  const fracaoGap = sem ? (u1["PR-AUC"] - sem["PR-AUC"]) / (u1["PR-AUC"] - b1["PR-AUC"]) : null;
  const causas = eua.causas ? Object.entries(eua.causas).sort((a, b) => (b[1].parcela ?? 0) - (a[1].parcela ?? 0)) : [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-cond text-4xl font-semibold">Brasil × EUA</h1>
        <p className="mt-2 max-w-3xl text-tinta-2">
          Os dois modelos têm o mesmo alvo (partida com atraso &gt; 30 min), os mesmos três horizontes, o mesmo algoritmo
          e os mesmos hiperparâmetros. O dos EUA acerta bem mais 1 h antes do embarque. A diferença vem quase toda de uma
          coluna: a <strong className="text-tinta">matrícula do avião</strong>, que a BTS tem e o VRA da ANAC não tem. Com
          ela, o modelo sabe exatamente qual voo traz o avião e se ele está atrasado. Sem ela, os dois países ficam
          praticamente empatados.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-linha bg-cartao p-5">
          <p className="text-sm text-tinta-2">PR-AUC 1 h antes, Brasil</p>
          <p className="font-cond text-5xl font-semibold">{num(b1["PR-AUC"], 2)}</p>
          <p className="text-sm text-tinta-2">chute: {num(br.chute["PR-AUC"], 2)}</p>
        </div>
        <div className="rounded-lg border border-linha bg-cartao p-5">
          <p className="text-sm text-tinta-2">PR-AUC 1 h antes, EUA sem matrícula</p>
          <p className="font-cond text-5xl font-semibold">{sem ? num(sem["PR-AUC"], 2) : "–"}</p>
          <p className="text-sm text-tinta-2">chute: {num(eua.chute["PR-AUC"], 2)}</p>
        </div>
        <div className="rounded-lg bg-painel p-5 text-painel-texto">
          <p className="text-sm text-white/60">PR-AUC 1 h antes, EUA com matrícula</p>
          <p className="font-cond text-5xl font-semibold text-sinal">{num(u1["PR-AUC"], 2)}</p>
          <p className="text-sm text-white/70">
            {fracaoGap != null ? `${pct(fracaoGap, 0)} da diferença para o Brasil vem da matrícula` : ""}
          </p>
        </div>
      </div>

      <Secao titulo="Escopo dos dois datasets" nota="O que entra em cada modelo. Clima vem do METAR (IEM) nos dois países, pelo mesmo processamento.">
        <Tabela
          cab={["", "Brasil", "EUA"]}
          linhas={[
            ["Fonte dos voos", "VRA (ANAC)", "BTS On-Time Performance (Departamento de Transportes)"],
            ["Período", `${br.desde}–2025, sem os períodos com dados falhos`, `${eua.desde}–2024`],
            ["Aeroportos", `10 maiores (${br.eda.por_aeroporto.map((a) => a.chave).join(", ")})`, `10 maiores (${eua.eda.por_aeroporto.map((a) => a.chave).join(", ")})`],
            ["Partidas usadas", inteiro(nTotal(br)), inteiro(nTotal(eua))],
            ["Companhias com > 20 mil partidas", cias(br), cias(eua)],
            ["Atrasos > 30 min (teste)", pct(b1.prevalência), pct(u1.prevalência)],
            ["Treino / validação / teste", `${br.periodos.treino} / ${br.periodos.validacao} / ${br.periodos.teste}`, `${eua.periodos.treino} / ${eua.periodos.validacao} / ${eua.periodos.teste}`],
            ["Qual avião faz o voo", "Só o modelo (ex.: A320), não o avião", <strong key="m">Matrícula de cada avião</strong>],
            ["Voo que traz o avião", "Adivinhado: último voo da mesma companhia e mesmo modelo chegando na origem", <strong key="c">Exato: voo anterior do mesmo avião</strong>],
            ["Causa do atraso", "Não disponível nos dados usados", "5 causas por voo (usadas só para avaliar, nunca como variável)"],
          ]}
        />
      </Secao>

      <Secao
        titulo={`Resultado lado a lado, 1 h antes (teste ${br.periodos.teste} × ${eua.periodos.teste})`}
        nota="O PR-AUC sobe sozinho quando há mais atrasos (o chute já vale a taxa de atraso), então ele não compara países direto. O ganho sobre o chute e o ROC-AUC descontam isso. A coluna do meio é o mesmo modelo dos EUA sem a matrícula, adivinhando o avião como no Brasil."
      >
        <Tabela
          destaque={3}
          cab={["Métrica", "Brasil", "EUA sem matrícula", "EUA com matrícula"]}
          linhas={[
            ["Taxa de atraso > 30 min", pct(b1.prevalência), pct(u1.prevalência), pct(u1.prevalência)],
            ["PR-AUC", num(b1["PR-AUC"]), sem ? num(sem["PR-AUC"]) : "–", num(u1["PR-AUC"])],
            ["Ganho sobre o chute (PR-AUC − taxa) / (1 − taxa)", pct(ganho(b1), 0), sem ? pct(ganho(sem), 0) : "–", pct(ganho(u1), 0)],
            ["ROC-AUC", num(b1["ROC-AUC"]), sem ? num(sem["ROC-AUC"]) : "–", num(u1["ROC-AUC"])],
            ["Precisão no limiar do site", pct(b1.precisão, 0), sem ? pct(sem.precisão, 0) : "–", pct(u1.precisão, 0)],
            ["Recall no limiar do site", pct(b1.recall, 0), sem ? pct(sem.recall, 0) : "–", pct(u1.recall, 0)],
            ["F1", num(b1.F1, 2), sem ? num(sem.F1, 2) : "–", num(u1.F1, 2)],
            ["Acerto dos alertas avisando só 20% dos atrasos", pct(p20(br), 0), "–", pct(p20(eua), 0)],
          ]}
        />
      </Secao>

      <Secao titulo="Por que os EUA se saíram melhor">
        <ol className="grid gap-4 lg:grid-cols-3">
          <li className="rounded-md border border-linha p-4">
            <p className="font-cond text-xl font-semibold">1. Metade dos atrasos é cascata do avião</p>
            <p className="mt-2 text-[15px] text-tinta-2">
              Nos EUA, {eua.causas ? pct(eua.causas.LateAircraftDelay?.parcela, 0) : "metade"} dos atrasos &gt; 30 min
              têm como causa principal o avião que chegou atrasado. Com a matrícula, o modelo vê o atraso desse avião
              antes do embarque e pega{" "}
              {u1.recall_por_causa?.LateAircraftDelay != null ? pct(u1.recall_por_causa.LateAircraftDelay, 0) : "a maioria"}{" "}
              desses atrasos.
            </p>
          </li>
          <li className="rounded-md border border-linha p-4">
            <p className="font-cond text-xl font-semibold">2. No Brasil a cascata é adivinhada</p>
            <p className="mt-2 text-[15px] text-tinta-2">
              Sem matrícula, o voo que traz o avião é um palpite (mesma companhia e modelo). Quando esse voo saiu &gt; 30
              min atrasado, a partida atrasa em {pct(cBr?.taxa30, 0)} dos casos no Brasil, contra {pct(cEua?.taxa30, 0)}{" "}
              nos EUA, onde a ligação é exata. O sinal existe nos dois países; no Brasil ele chega diluído pelos palpites
              errados.
            </p>
          </li>
          <li className="rounded-md border border-linha p-4">
            <p className="font-cond text-xl font-semibold">3. Sem matrícula, empate</p>
            <p className="mt-2 text-[15px] text-tinta-2">
              Tirando a matrícula, o modelo dos EUA fica com ROC-AUC {sem ? num(sem["ROC-AUC"], 2) : "–"}, abaixo do
              Brasil ({num(b1["ROC-AUC"], 2)}), e ganho sobre o chute de {sem ? pct(ganho(sem), 0) : "–"} contra{" "}
              {pct(ganho(b1), 0)}. Na véspera, quando nenhum dos dois sabe o atraso do avião, o ROC-AUC é{" "}
              {num(br.modelos.vespera["ROC-AUC"], 2)} no Brasil e {num(eua.modelos.vespera["ROC-AUC"], 2)} nos EUA. Os
              dados brasileiros não são piores; falta uma coluna.
            </p>
          </li>
        </ol>
        <div className="mt-5">
          <Tabela
            cab={["ROC-AUC por horizonte", "Brasil", "EUA", "Diferença"]}
            linhas={ORDEM_H.map((k) => [
              NOME_H[k],
              num(br.modelos[k]["ROC-AUC"]),
              num(eua.modelos[k]["ROC-AUC"]),
              `${eua.modelos[k]["ROC-AUC"] >= br.modelos[k]["ROC-AUC"] ? "+" : ""}${num(eua.modelos[k]["ROC-AUC"] - br.modelos[k]["ROC-AUC"])}`,
            ])}
          />
          <p className="mt-2 text-sm text-tinta-2">
            A vantagem dos EUA cresce perto do embarque, que é quando o atraso do avião que vem chegando já é conhecido.
          </p>
        </div>
      </Secao>

      <Secao
        titulo="Variáveis que mais importaram (modelo de 1 h)"
        nota="Importância por permutação no teste: quanto o log loss piora quando a variável é embaralhada. Mesma medida e mesma escala nos dois países."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          {[
            { nome: "Brasil", r: br, cor: COR_BR },
            { nome: "EUA", r: eua, cor: COR_EUA },
          ].map(({ nome, r, cor }) => (
            <div key={nome}>
              <h3 className="mb-2 font-semibold">{nome}</h3>
              <ul className="space-y-1.5">
                {r.importancia.slice(0, TOP).map((i) => (
                  <Barra key={i.variavel} rotulo={i.descricao} valor={i.valor} max={maxImp} cor={COR_GRUPO[i.grupo] ?? cor} texto={num(i.valor, 3)} />
                ))}
              </ul>
            </div>
          ))}
        </div>

        <h3 className="mt-6 mb-2 font-semibold">Peso de cada grupo nas 20 variáveis mais importantes</h3>
        <div className="space-y-2">
          <BarraEmpilhada nome="Brasil" dados={pBr} />
          <BarraEmpilhada nome="EUA" dados={pEua} />
        </div>
        <ul className="mt-3 flex flex-wrap gap-4 text-sm text-tinta-2">
          {GRUPOS.map((g) => (
            <li key={g} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COR_GRUPO[g] }} aria-hidden />
              {g}
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-3xl text-[15px] text-tinta-2">
          Nos dois países a variável nº 1 é o atraso do avião que vai fazer o voo. A diferença é o tamanho: nos EUA, as três
          variáveis da cadeia do avião (atraso de chegada, atraso de partida do voo anterior e atraso de dois voos antes)
          somam{" "}
          {num(
            eua.importancia.filter((i) => ["chegada_atraso_chegada", "chegada_atraso_conhecido", "aviao_atraso_2_voos_antes"].includes(i.variavel)).reduce((s, i) => s + i.valor, 0),
            3,
          )}
          , contra {num(br.importancia.find((i) => i.variavel === "chegada_atraso_conhecido")?.valor, 3)} do voo de chegada
          adivinhado no Brasil. A propagação responde por {pct(propEua, 0)} da importância nos EUA e {pct(propBr, 0)} no
          Brasil, onde o modelo se apoia mais em programação (tempo de solo, aeroporto, hora) e histórico do voo. Clima pesa
          pouco nos dois: afeta muitos voos ao mesmo tempo, mas é raro (trovoada em {pct((br.eda.clima.find((c) => c.chave.startsWith("Trovoada"))?.voos ?? 0) / br.eda.clima[0].voos, 0)} das partidas no Brasil).
        </p>
      </Secao>

      {causas.length > 0 && (
        <Secao
          titulo="Mesmo com a matrícula existe um teto"
          nota={`Recall do modelo de 1 h dos EUA por causa principal do atraso (a BTS informa a causa depois do voo; ela não entra no modelo).`}
        >
          <ul className="space-y-1.5">
            {causas.map(([k, c]) => (
              <Barra
                key={k}
                rotulo={`${c.descricao} (${pct(c.parcela, 0)} dos atrasos)`}
                valor={u1.recall_por_causa?.[k] ?? 0}
                max={1}
                cor={k === "LateAircraftDelay" ? "var(--f2)" : COR_EUA}
                texto={pct(u1.recall_por_causa?.[k], 0)}
              />
            ))}
          </ul>
          <p className="mt-3 max-w-3xl text-[15px] text-tinta-2">
            Atrasos da própria companhia (manutenção, tripulação, embarque) são {pct(eua.causas?.CarrierDelay?.parcela, 0)}{" "}
            do total e o modelo pega só {pct(u1.recall_por_causa?.CarrierDelay, 0)}: nada nos dados avisa antes que vai
            faltar um tripulante ou dar uma pane. O limite do Brasil vem de informação que falta, não do algoritmo nem do
            desbalanceamento das classes.
          </p>
        </Secao>
      )}

      <Secao titulo="Ressalvas">
        <ul className="list-disc space-y-1.5 pl-5 text-[15px] text-tinta-2">
          <li>
            Os testes são de anos diferentes ({br.periodos.teste} no Brasil, {eua.periodos.teste} nos EUA) e o Brasil tem
            mais anos de histórico. O volume de histórico não explica a diferença: no Brasil, treinar só com{" "}
            {br.periodos.validacao} dá PR-AUC {num(br.janelas.find((j) => j.janela.startsWith("só"))?.pr_auc, 3)}, quase igual
            ao do modelo com todos os anos ({num(b1["PR-AUC"], 3)}).
          </li>
          <li>
            A versão sem matrícula dos EUA adivinha o avião só pela companhia (a BTS não informa o modelo do avião), um palpite
            mais grosseiro que o do Brasil (companhia e modelo).
          </li>
          <li>
            A BTS registra o avião que de fato voou. Quando a companhia troca de avião por causa de um atraso, a troca aparece
            no dado. Por isso tempo de solo e folga calculados pela matrícula ficaram de fora, e a véspera não usa nada da
            matrícula.
          </li>
          <li>Importâncias calculadas numa amostra de 20 mil partidas do teste; só as 20 maiores de cada país entram na soma por grupo.</li>
        </ul>
      </Secao>
    </div>
  );
}
