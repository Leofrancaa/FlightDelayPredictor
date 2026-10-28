import dynamic from "next/dynamic";
import BarraProbabilidade from "./BarraProbabilidade";
import { ALERTA, COR, descreverAtraso, pct, situacao } from "@/lib/faixas";
import type { Horizonte, Indice, Voo } from "@/lib/types";

// three.js só carrega no navegador e só quando um voo é aberto.
const GloboVoo = dynamic(() => import("./GloboVoo"), {
  ssr: false,
  loading: () => <div className="h-[32rem] rounded-lg bg-painel sm:h-[44rem]" aria-hidden />,
});

function Previsao({ titulo, p, alerta, limiar }: { titulo: string; p: number; alerta: 0 | 1; limiar?: number }) {
  return (
    <div className="rounded-md border border-linha p-4">
      <h3 className="text-sm text-tinta-2">{titulo}</h3>
      <p className="mt-1 font-cond text-2xl font-semibold" style={{ color: COR[alerta] }}>
        {ALERTA[alerta]}
      </p>
      <p className="mb-3 text-sm text-tinta-2">
        Chance de atrasar mais de 30 min: <strong className="text-tinta">{p}%</strong>
      </p>
      <BarraProbabilidade p={p} limiar={limiar} />
      {limiar != null && (
        <p className="mt-1.5 text-xs text-tinta-2">O traço marca {Math.round(limiar * 100)}%, onde o alerta dispara.</p>
      )}
    </div>
  );
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
  prevalencia = 0.15,
}: {
  voo: Voo;
  indice: Indice;
  data: string;
  limiares?: Partial<Record<Horizonte, number>>;
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
        <Previsao titulo="Na véspera" p={voo.pv} alerta={voo.fv} limiar={limiares?.vespera} />
        <Previsao titulo="3 h antes da partida" p={voo.p3} alerta={voo.f3} limiar={limiares?.h3} />
        <Previsao titulo="1 h antes da partida" p={voo.p1} alerta={voo.f1} limiar={limiares?.h1} />
      </div>

      <p className="mt-3 text-sm text-tinta-2">
        Só cerca de {Math.round(prevalencia * 100)}% dos voos atrasam mais de 30 min, então o alerta dispara quando a chance fica bem acima do
        normal, mesmo abaixo de 50%. Quanto mais perto da partida, mais o modelo sabe e mais confiável fica o alerta.
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
            {voo.f1 === voo.f
              ? voo.f || voo.a <= 0
                ? "A previsão de 1 h antes acertou."
                : "A previsão de 1 h antes acertou: o alerta só cobre atrasos de mais de 30 min, e este ficou abaixo disso."
              : voo.f1
                ? "Alarme falso: a previsão de 1 h antes avisou, mas o atraso não passou de 30 min."
                : "A previsão de 1 h antes não avisou deste atraso."}
          </p>
        </section>
      </div>
    </article>
  );
}
