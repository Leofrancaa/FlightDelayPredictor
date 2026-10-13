import BarraProbabilidade from "./BarraProbabilidade";
import { ALERTA, COR, FAIXAS, STATUS, descreverAtraso, pct, risco30 } from "@/lib/faixas";
import type { Indice, Voo } from "@/lib/types";

function Previsao({ titulo, p, faixa }: { titulo: string; p: number[]; faixa: number }) {
  return (
    <div className="rounded-md border border-linha p-4">
      <h3 className="text-sm text-tinta-2">{titulo}</h3>
      <p className="mt-1 font-cond text-2xl font-semibold" style={{ color: COR[faixa] }}>
        {ALERTA[faixa]}
      </p>
      <p className="mb-3 text-sm text-tinta-2">
        Chance de atrasar mais de 30 min: <strong className="text-tinta">{risco30(p)}%</strong>
      </p>
      <BarraProbabilidade p={p} />
    </div>
  );
}

function motivos(v: Voo): string[] {
  const m: string[] = [];
  const c = v.c;
  if (c.trov) m.push("Havia trovoada na origem 3 h antes da partida.");
  if (c.raj != null && c.raj >= 25) m.push(`Rajadas de ${c.raj} nós na origem 3 h antes.`);
  if (c.vis != null && c.vis < 5000) m.push(`Visibilidade baixa na origem (${c.vis} m).`);
  if (c.teto != null && c.teto < 1500) m.push(`Teto de nuvens baixo na origem (${c.teto} pés).`);
  if (c.rec != null && c.rec >= 0.15) m.push(`${pct(c.rec, 0)} das partidas recentes da origem estavam saindo com mais de 30 min de atraso.`);
  if (c.v7 != null && c.v7 >= 0.3) m.push(`Este voo atrasou mais de 30 min em ${pct(c.v7, 0)} das vezes nos 7 dias anteriores.`);
  if (c.hist != null && c.hist >= 0.12) m.push(`Historicamente, ${pct(c.hist, 0)} das partidas deste voo atrasaram mais de 30 min.`);
  return m;
}

export default function DetalheVoo({ voo, indice, data }: { voo: Voo; indice: Indice; data: string }) {
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

      <div className="grid gap-4 md:grid-cols-2">
        <Previsao titulo="Previsão na véspera" p={voo.pv} faixa={voo.fv} />
        <Previsao titulo="Previsão 3 h antes da partida" p={voo.p3} faixa={voo.f3} />
      </div>

      <p className="mt-3 text-sm text-tinta-2">
        O alerta dispara mesmo com chance abaixo de 50%: o modelo foi ajustado para avisar cedo, aceitando alguns
        alarmes falsos em troca de deixar passar menos atrasos.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <section>
          <h3 className="font-semibold">O que pesou na previsão</h3>
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
            <span className="font-semibold" style={{ color: COR[voo.f] }}>
              {STATUS[voo.f]}
            </span>{" "}
            ({FAIXAS[voo.f]}): {descreverAtraso(voo.a)}.
          </p>
          <p className="mt-1 text-sm text-tinta-2">
            {voo.f3 === voo.f
              ? "O alerta de 3 h antes acertou a faixa."
              : voo.f3 > voo.f
                ? "O alerta de 3 h antes foi mais pessimista do que o real."
                : "O alerta de 3 h antes foi mais otimista do que o real."}
          </p>
        </section>
      </div>
    </article>
  );
}
