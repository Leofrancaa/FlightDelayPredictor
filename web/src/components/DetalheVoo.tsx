import dynamic from "next/dynamic";
import BarraProbabilidade from "./BarraProbabilidade";
import { ALERTA, COR, descreverAtraso, pct, situacao } from "@/lib/faixas";
import type { Horizonte, Indice, Nivel, Voo } from "@/lib/types";

// three.js só carrega no navegador e só quando um voo é aberto.
const GloboVoo = dynamic(() => import("./GloboVoo"), {
  ssr: false,
  loading: () => <div className="h-[32rem] rounded-lg bg-painel sm:h-[44rem]" aria-hidden />,
});

function Previsao({
  titulo,
  p,
  q,
  alerta,
  limiar,
  limiar30,
}: {
  titulo: string;
  p: number;
  q: number;
  alerta: Nivel;
  limiar?: number;
  limiar30?: number;
}) {
  return (
    <div className="rounded-md border border-linha p-4">
      <h3 className="text-sm text-tinta-2">{titulo}</h3>
      <p className="mt-1 font-cond text-2xl font-semibold" style={{ color: COR[alerta] }}>
        {ALERTA[alerta]}
      </p>
      <p className="mb-2 mt-2 text-sm text-tinta-2">
        Vai atrasar 15 min ou mais? <strong className="text-tinta">{p}%</strong>
      </p>
      <BarraProbabilidade p={p} limiar={limiar} rotulo="Chance de atrasar 15 min ou mais" corAlerta="var(--f1)" />
      <p className={`mb-2 mt-3 text-sm text-tinta-2 ${alerta ? "" : "opacity-60"}`}>
        Se atrasar, passa de 30 min? <strong className="text-tinta">{q}%</strong>
      </p>
      <div className={alerta ? "" : "opacity-60"}>
        <BarraProbabilidade p={q} limiar={limiar30} rotulo="Chance de passar de 30 min, se atrasar" />
      </div>
      {limiar != null && limiar30 != null && (
        <p className="mt-1.5 text-xs text-tinta-2">
          Os traços marcam onde cada alerta dispara ({Math.round(limiar * 100)}% e {Math.round(limiar30 * 100)}%).
        </p>
      )}
    </div>
  );
}

/** Compara o alerta de 1 h antes (0/1/2) com o que aconteceu (0/1/2). */
function veredito(alerta: Nivel, real: Nivel): string {
  if (alerta === real) return "A previsão de 1 h antes acertou.";
  if (alerta === 0) return "A previsão de 1 h antes não avisou deste atraso.";
  if (real === 0) return "Alarme falso: a previsão de 1 h antes avisou, mas o voo saiu com menos de 15 min de atraso.";
  return alerta === 1
    ? "A previsão de 1 h antes acertou que ia atrasar, mas esperava um atraso de até 30 min."
    : "A previsão de 1 h antes acertou que ia atrasar, mas esperava mais de 30 min.";
}

function motivos(v: Voo): string[] {
  const m: string[] = [];
  const c = v.c;
  if (c.trov) m.push("Havia trovoada na origem 1 h antes da partida.");
  if (c.raj != null && c.raj >= 25) m.push(`Rajadas de ${c.raj} nós na origem 1 h antes.`);
  if (c.vis != null && c.vis < 5000) m.push(`Visibilidade baixa na origem (${c.vis} m).`);
  if (c.teto != null && c.teto < 1500) m.push(`Teto de nuvens baixo na origem (${c.teto} pés).`);
  if (c.chgp) m.push("O avião que deve fazer este voo ainda não tinha decolado da origem anterior, já atrasado.");
  else if (c.chg != null && c.chg > 30) m.push(`O voo que traz o avião saiu ${Math.round(c.chg)} min atrasado da origem anterior.`);
  if (c.cia != null && c.cia >= 0.2) m.push(`${pct(c.cia, 0)} das partidas recentes da companhia nesse aeroporto atrasaram mais de 30 min.`);
  if (c.rec != null && c.rec >= 0.15) m.push(`${pct(c.rec, 0)} das partidas recentes da origem estavam saindo com mais de 30 min de atraso.`);
  if (c.v7 != null && c.v7 >= 0.3) m.push(`Este voo atrasou mais de 30 min em ${pct(c.v7, 0)} das vezes nos 7 dias anteriores.`);
  if (c.hist != null && c.hist >= 0.12) m.push(`Historicamente, ${pct(c.hist, 0)} das partidas deste voo atrasaram mais de 30 min.`);
  return m;
}

export default function DetalheVoo({
  voo,
  indice,
  data,
  limiares,
  limiares30,
  prevalencia = 0.22,
}: {
  voo: Voo;
  indice: Indice;
  data: string;
  limiares?: Partial<Record<Horizonte, number>>;
  limiares30?: Partial<Record<Horizonte, number>>;
  prevalencia?: number;
}) {
  const coord = indice.coordenadas ?? {};
  const [nomeEmpresa, iata] = indice.empresas[voo.e] ?? [voo.e, voo.e];
  const sinais = motivos(voo);
  const dataBr = new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <article className="rounded-lg border border-linha bg-cartao p-5 sm:p-6" aria-live="polite">
      <header className="mb-5">
        <p className="text-sm text-tinta-2">
          {nomeEmpresa}, {dataBr}, partida prevista às {voo.h}
        </p>
        <h2 className="font-cond text-3xl font-semibold">
          {iata} {voo.n}{" "}
          <span className="font-medium text-tinta-2">
            {indice.aeroportos[voo.o] ?? voo.o} para {indice.aeroportos[voo.d] ?? voo.d}
          </span>
        </h2>
      </header>

      {coord[voo.o] && coord[voo.d] && (
        <div className="mb-5">
          <GloboVoo
            origem={coord[voo.o]}
            destino={coord[voo.d]}
            siglaOrigem={voo.o}
            siglaDestino={voo.d}
            horario={voo.h}
            atraso={voo.a}
          />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Previsao titulo="Na véspera" p={voo.pv} q={voo.qv} alerta={voo.fv} limiar={limiares?.vespera} limiar30={limiares30?.vespera} />
        <Previsao titulo="3 h antes da partida" p={voo.p3} q={voo.q3} alerta={voo.f3} limiar={limiares?.h3} limiar30={limiares30?.h3} />
        <Previsao titulo="1 h antes da partida" p={voo.p1} q={voo.q1} alerta={voo.f1} limiar={limiares?.h1} limiar30={limiares30?.h1} />
      </div>

      <p className="mt-3 text-sm text-tinta-2">
        Cerca de {Math.round(prevalencia * 100)}% dos voos atrasam 15 min ou mais, então o alerta dispara quando a chance fica bem acima do
        normal, mesmo abaixo de 50%. Entre os que atrasam, a maioria passa de 30 min, por isso a segunda chance costuma ser alta. Quanto
        mais perto da partida, mais o modelo sabe e mais confiável fica o alerta.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <section>
          <h3 className="font-semibold">O que se sabia 1 h antes</h3>
          {sinais.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-tinta-2">
              {sinais.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-tinta-2">
              Sem sinais fortes de clima ou de atraso na origem. O risco vem do perfil do voo: dia, horário, rota e
              desempenho nos dias anteriores.
            </p>
          )}
        </section>
        <section className="rounded-md bg-pista p-4">
          <h3 className="font-semibold">O que aconteceu</h3>
          <p className="mt-1 text-lg">
            <span className="font-semibold" style={{ color: situacao(voo.a).cor }}>
              {situacao(voo.a).texto}
            </span>
            : {descreverAtraso(voo.a)}.
          </p>
          <p className="mt-1 text-sm text-tinta-2">
            {veredito(voo.f1, voo.f)}
          </p>
        </section>
      </div>
    </article>
  );
}
