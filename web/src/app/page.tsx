import Link from "next/link";

const EXEMPLO = [
  { h: "07:10", voo: "G3 1402", destino: "Congonhas", status: "Sem alerta", cor: "var(--f0)" },
  { h: "17:45", voo: "LA 3321", destino: "Brasília", status: "Alerta de atraso moderado", cor: "var(--f2)" },
  { h: "19:20", voo: "AD 4870", destino: "Recife", status: "Alerta de atraso leve", cor: "var(--f1)" },
];

export default function Inicio() {
  return (
    <div className="grid gap-10 md:grid-cols-[1.1fr_1fr] md:items-center">
      <section>
        <h1 className="font-cond text-5xl font-semibold leading-[1.05] sm:text-6xl">
          O seu voo vai atrasar?
        </h1>
        <p className="mt-5 max-w-xl text-lg text-tinta-2">
          Um modelo treinado com todos os voos domésticos de 2025 nos 10 maiores aeroportos do país estima em que faixa
          de atraso cada partida deve cair: na véspera e 3 horas antes do embarque.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/passageiro" className="rounded-md bg-sinal px-5 py-3 font-semibold text-[#172230] hover:brightness-95">
            Consultar um voo
          </Link>
          <Link href="/analista" className="rounded-md border border-linha bg-cartao px-5 py-3 font-semibold hover:border-tinta-2">
            Ver a análise do modelo
          </Link>
        </div>
      </section>

      <section aria-label="Exemplo de painel de partidas" className="overflow-hidden rounded-lg bg-painel text-painel-texto shadow-lg">
        <div className="flex items-baseline justify-between border-b border-white/10 px-5 py-3 font-cond">
          <span className="text-lg font-semibold text-sinal">Partidas</span>
          <span className="text-sm text-white/60">exemplo</span>
        </div>
        <ul>
          {EXEMPLO.map((v) => (
            <li key={v.voo} className="grid grid-cols-[3.5rem_5rem_1fr] items-center gap-3 border-b border-white/5 px-5 py-3 font-cond text-lg last:border-0">
              <span>{v.h}</span>
              <span className="font-semibold">{v.voo}</span>
              <span className="flex flex-col leading-tight">
                {v.destino}
                <span className="text-[15px]" style={{ color: v.cor }}>
                  {v.status}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
