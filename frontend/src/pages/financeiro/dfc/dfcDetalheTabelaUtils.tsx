import { DFC_PRIORIDADE_CHIP, DFC_PRIORIDADE_LABEL_CURTO, type DfcPrioridade } from '../../../api/dfcPrioridade';

export type SortDir = 'asc' | 'desc';

export function compareYmd(a: string | null | undefined, b: string | null | undefined): number {
  const sa = (a ?? '').slice(0, 10);
  const sb = (b ?? '').slice(0, 10);
  if (!sa && !sb) return 0;
  if (!sa) return 1;
  if (!sb) return -1;
  return sa.localeCompare(sb);
}

export function compareStr(a: string | null | undefined, b: string | null | undefined): number {
  return String(a ?? '')
    .toLocaleLowerCase('pt-BR')
    .localeCompare(String(b ?? '').toLocaleLowerCase('pt-BR'), 'pt-BR');
}

export function nextSortDir(currentKey: string, clickedKey: string, currentDir: SortDir): SortDir {
  if (currentKey !== clickedKey) return 'asc';
  return currentDir === 'asc' ? 'desc' : 'asc';
}

type SortableThProps = {
  label: string;
  sortKey: string;
  activeKey: string;
  dir: SortDir;
  onSort: (key: string) => void;
  align?: 'left' | 'right';
  className?: string;
};

export function SortableTh({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align = 'left',
  className = '',
}: SortableThProps) {
  const active = activeKey === sortKey;
  return (
    <th className={`px-2 py-2 font-semibold ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 w-full hover:text-primary-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 rounded ${
          align === 'right' ? 'justify-end' : 'justify-start'
        }`}
        aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <span>{label}</span>
        <span className="text-[10px] opacity-80 tabular-nums" aria-hidden>
          {active ? (dir === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </button>
    </th>
  );
}

export function PrioridadeSomenteLeitura({
  prioridade,
  hint,
}: {
  prioridade: DfcPrioridade | null;
  hint?: string;
}) {
  if (prioridade == null) {
    return (
      <span
        className="inline-flex min-h-[1.75rem] w-full items-center justify-center rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-500 dark:border-slate-600 dark:bg-slate-700/80 dark:text-slate-400"
        title={hint}
      >
        — Sem prioridade
      </span>
    );
  }

  return (
    <span
      className={`inline-flex min-h-[1.75rem] w-full items-center justify-center rounded-md border px-2 py-1 text-xs font-semibold ${DFC_PRIORIDADE_CHIP[prioridade]}`}
      title={hint}
    >
      {prioridade} — {DFC_PRIORIDADE_LABEL_CURTO[prioridade]}
    </span>
  );
}
