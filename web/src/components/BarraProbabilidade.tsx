/** Barra de risco: uma chance (%), com a marca do limiar em que o alerta dispara. */
export default function BarraProbabilidade({
  p,
  limiar,
  rotulo = "Chance de atrasar",
  corAlerta = "var(--f3)",
  compacta = false,
}: {
  p: number;
  limiar?: number;
  rotulo?: string;
  corAlerta?: string;
  compacta?: boolean;
}) {
  const alerta = limiar != null && p >= limiar * 100;
  return (
    <div
      className={`relative w-full rounded bg-[color-mix(in_srgb,var(--f0)_22%,transparent)] ${compacta ? "h-2" : "h-3"}`}
      role="img"
      aria-label={`${rotulo}: ${p}%`}
    >
      <div
        className="absolute inset-y-0 left-0 rounded"
        style={{ width: `${Math.min(p, 100)}%`, background: alerta ? corAlerta : "var(--f0)" }}
      />
      {limiar != null && !compacta && (
        <div
          className="absolute -inset-y-1 w-0.5 bg-tinta"
          style={{ left: `${limiar * 100}%` }}
          title={`Limiar do alerta: ${Math.round(limiar * 100)}%`}
          aria-hidden
        />
      )}
    </div>
  );
}
