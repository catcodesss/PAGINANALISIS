export default function EsqueletoInforme() {
  return (
    <div aria-live="polite" aria-busy="true" className="space-y-4">
      <p className="font-mono text-xs uppercase tracking-[0.15em] text-ink-muted">
        Analizando contingencias y procesos verbales…
      </p>
      <div className="animate-pulse space-y-6 rounded-md border border-divider bg-surface p-6 sm:p-8">
        {Array.from({ length: 6 }).map((_, indice) => (
          <div key={indice} className="space-y-2">
            <div className="h-3 w-1/3 rounded bg-divider" />
            <div className="h-3 w-full rounded bg-divider" />
            <div className="h-3 w-5/6 rounded bg-divider" />
          </div>
        ))}
      </div>
    </div>
  );
}
