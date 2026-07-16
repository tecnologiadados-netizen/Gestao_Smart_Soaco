import type { FiltrosPreCompra } from '../../../api/preCompra';
import { INPUT_CLASS, LABEL_CLASS } from './PreCompraAutocomplete';

const BTN_FILTRAR =
  'inline-flex items-center justify-center rounded-lg bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 px-4 py-2 text-sm font-medium hover:bg-slate-700 dark:hover:bg-slate-300 disabled:opacity-50';

const BTN_LIMPAR =
  'px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600';

interface Props {
  filters: FiltrosPreCompra;
  onChange: (filters: FiltrosPreCompra) => void;
  onSearch: () => void;
  onClear: () => void;
}

export default function PreCompraFiltros({ filters, onChange, onSearch, onClear }: Props) {
  const set = (key: keyof FiltrosPreCompra, value: string) =>
    onChange({ ...filters, [key]: value });

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800/50 mb-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Período</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Filtre pela data de emissão. Demais filtros ficam no cabeçalho da grade.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-3xl">
        <div>
          <label className={LABEL_CLASS}>Data início</label>
          <input
            className={INPUT_CLASS}
            type="date"
            value={filters.data_inicio ?? ''}
            onChange={(e) => set('data_inicio', e.target.value)}
          />
        </div>

        <div>
          <label className={LABEL_CLASS}>Data fim</label>
          <input
            className={INPUT_CLASS}
            type="date"
            value={filters.data_fim ?? ''}
            onChange={(e) => set('data_fim', e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <button type="button" className={BTN_FILTRAR} onClick={onSearch}>
          Filtrar
        </button>
        <button type="button" className={BTN_LIMPAR} onClick={onClear}>
          Limpar filtros
        </button>
      </div>
    </section>
  );
}
