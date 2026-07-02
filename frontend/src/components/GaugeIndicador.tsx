interface GaugeIndicadorProps {
  /** Título do indicador (ex.: "% No Prazo - Retirada") */
  title: string;
  /** Valor de 0 a 100 (percentual) */
  value: number;
  loading?: boolean;
}

const SEMICIRCLE_LENGTH = Math.PI * 80; // comprimento do arco (raio 80)

/** Indicador tipo gauge (semi-circular) 0–100%, estilo Power BI. */
export default function GaugeIndicador({ title, value, loading }: GaugeIndicadorProps) {
  const percent = Math.min(100, Math.max(0, value));
  const filled = (percent / 100) * SEMICIRCLE_LENGTH;
  const strokeDasharray = `${filled} ${SEMICIRCLE_LENGTH}`;

  if (loading) {
    return (
      <div className="card-kpi min-h-[200px] flex flex-col items-center justify-center">
        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-4" />
        <div className="h-12 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="card-kpi">
      <p className="text-center card-kpi-label mb-2">
        % No Prazo – {title}
      </p>
      <div className="relative flex justify-center items-end pb-2" style={{ height: 140 }}>
        <svg
          viewBox="0 0 200 120"
          className="w-full max-w-[220px] h-[110px]"
          style={{ overflow: 'visible' }}
        >
          {/* Fundo (arco cinza) */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="currentColor"
            strokeWidth="24"
            strokeLinecap="round"
            className="text-slate-200 dark:text-slate-600"
          />
          {/* Valor (arco azul) */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="currentColor"
            strokeWidth="24"
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={0}
            className="text-primary-600 dark:text-accent-500 transition-all duration-700"
          />
          {/* Marcas 0 e 100 nas extremidades (lado externo do arco) */}
          <text x="0" y="116" className="text-[10px] fill-slate-400 dark:fill-slate-500 font-medium" textAnchor="start">
            0,00%
          </text>
          <text x="200" y="116" className="text-[10px] fill-slate-400 dark:fill-slate-500 font-medium" textAnchor="end">
            100,00%
          </text>
        </svg>
        {/* Valor central */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 text-3xl font-bold text-slate-800 dark:text-slate-100"
          style={{ marginBottom: 4 }}
        >
          {percent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
        </div>
      </div>
    </div>
  );
}
