import { COR, FAIXAS } from "@/lib/faixas";

/** Barra empilhada com a probabilidade (%) de cada faixa. */
export default function BarraProbabilidade({ p, compacta = false }: { p: number[]; compacta?: boolean }) {
  const total = p.reduce((a, b) => a + b, 0) || 1;
  return (
    <div>
      <div
        className={`flex w-full overflow-hidden rounded ${compacta ? "h-2" : "h-4"}`}
        role="img"
        aria-label={FAIXAS.map((f, i) => `${f}: ${p[i]}%`).join(", ")}
      >
        {p.map((v, i) => (
          <div key={i} style={{ width: `${(v / total) * 100}%`, background: COR[i] }} />
        ))}
      </div>
      {!compacta && (
        <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-tinta-2">
          {FAIXAS.map((f, i) => (
            <li key={f} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COR[i] }} aria-hidden />
              {f} <strong className="ml-auto font-semibold text-tinta">{p[i]}%</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
