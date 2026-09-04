import type { MetricaPainel } from './metricaPainel';

export type { MetricaPainel } from './metricaPainel';

export default function MetricToggle({
  value,
  onChange,
}: {
  value: MetricaPainel;
  onChange: (v: MetricaPainel) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-slate-200 p-0.5 dark:border-slate-600">
      <button
        type="button"
        onClick={() => onChange('valor')}
        className={`rounded px-2 py-0.5 text-[11px] font-semibold transition-colors ${
          value === 'valor'
            ? 'bg-primary-600 text-white'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
        }`}
      >
        Valor
      </button>
      <button
        type="button"
        onClick={() => onChange('qtde')}
        title="Unidades vendidas"
        className={`rounded px-2 py-0.5 text-[11px] font-semibold transition-colors ${
          value === 'qtde'
            ? 'bg-primary-600 text-white'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
        }`}
      >
        Qtde
      </button>
    </div>
  );
}
