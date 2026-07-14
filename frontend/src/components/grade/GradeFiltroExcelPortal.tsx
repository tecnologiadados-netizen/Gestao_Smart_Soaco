import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import type { ExcelFilterDraft, SortDir } from '../../hooks/useGradeFiltrosExcel';
import { NUMERIC_FILTER_OPTIONS, type NumericFilterOp } from '../../utils/gradeFiltroNumerico';

type Props = {
  colunaAberta: string;
  rect: { top: number; left: number; width: number };
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  excelFilterDrafts: Record<string, ExcelFilterDraft>;
  setExcelFilterDrafts: React.Dispatch<React.SetStateAction<Record<string, ExcelFilterDraft>>>;
  valoresUnicosPorColuna: Record<string, string[]>;
  onSortAsc: (colId: string) => void;
  onSortDesc: (colId: string) => void;
  onAplicar: (colId: string) => void;
  onCancelar: () => void;
  /** Rótulos de ordenação (ex.: Menor/Maior para colunas numéricas). */
  sortAscLabel?: string;
  sortDescLabel?: string;
  /** Exibe filtros numéricos estilo Excel (somente colunas numéricas). */
  showNumericFilters?: boolean;
  /** Ordenação só é aplicada ao clicar em Ordenar (não ao escolher A/Z). */
  deferSortUntilApply?: boolean;
  applyButtonLabel?: string;
  /** Ações extras abaixo dos botões de ordenação (ex.: autopreencher Seq.). */
  extraActions?: ReactNode;
};

export default function GradeFiltroExcelPortal({
  colunaAberta,
  rect,
  dropdownRef,
  excelFilterDrafts,
  setExcelFilterDrafts,
  valoresUnicosPorColuna,
  onSortAsc,
  onSortDesc,
  onAplicar,
  onCancelar,
  sortAscLabel = 'A↧ Classificar de A a Z',
  sortDescLabel = 'Z↧ Classificar de Z a A',
  showNumericFilters = false,
  deferSortUntilApply = false,
  applyButtonLabel = 'OK',
  extraActions,
}: Props) {
  const key = colunaAberta;
  const valores = valoresUnicosPorColuna[key] ?? [];
  const draft = excelFilterDrafts[key] ?? { search: '', selected: valores };
  const visiveis = valores.filter((v) => v.toLowerCase().includes(draft.search.trim().toLowerCase()));
  const todosVisiveisSelecionados = visiveis.length > 0 && visiveis.every((v) => draft.selected.includes(v));
  const numericOp = draft.numericOp ?? null;

  const patchDraft = (patch: Partial<ExcelFilterDraft>) => {
    setExcelFilterDrafts((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? { search: '', selected: valores }), ...patch },
    }));
  };

  const escolherOrdenacao = (dir: SortDir) => {
    if (deferSortUntilApply) {
      patchDraft({ sortDir: dir });
      return;
    }
    if (dir === 'asc') onSortAsc(key);
    else onSortDesc(key);
  };

  const sortBtnClass = (dir: SortDir) => {
    const ativo = deferSortUntilApply && draft.sortDir === dir;
    return `block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-700 ${
      ativo ? 'bg-primary-50 font-medium text-primary-800 dark:bg-primary-900/30 dark:text-primary-200' : ''
    }`;
  };

  const toggle = (value: string, checked: boolean) => {
    setExcelFilterDrafts((prev) => {
      const atual = prev[key] ?? { search: '', selected: valores };
      const set = new Set(atual.selected);
      if (checked) set.add(value);
      else set.delete(value);
      return { ...prev, [key]: { ...atual, selected: [...set] } };
    });
  };

  const selectNumericOp = (op: NumericFilterOp) => {
    patchDraft({ numericOp: op, numericV1: draft.numericV1 ?? '', numericV2: draft.numericV2 ?? '' });
  };

  const limparFiltroNumerico = () => {
    patchDraft({ numericOp: null, numericV1: '', numericV2: '' });
  };

  const menuMaxH = 420;
  const margin = 8;
  const spaceBelow = window.innerHeight - rect.top - margin;
  const flipUp = spaceBelow < 200 && rect.top > spaceBelow + 80;
  const top = flipUp ? Math.max(margin, rect.top - menuMaxH - margin) : rect.top;
  const maxHeight = flipUp
    ? Math.min(menuMaxH, rect.top - margin * 2)
    : Math.min(menuMaxH, spaceBelow);

  return createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top,
        left: Math.max(margin, Math.min(rect.left, window.innerWidth - 296)),
        width: Math.max(rect.width, 288),
        maxHeight: Math.max(160, maxHeight),
        overflowY: 'auto',
        zIndex: 13001,
      }}
      className="rounded-lg border border-slate-300 bg-white p-2 text-slate-800 shadow-2xl dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button type="button" onClick={() => escolherOrdenacao('asc')} className={sortBtnClass('asc')}>
        {sortAscLabel}
      </button>
      <button type="button" onClick={() => escolherOrdenacao('desc')} className={sortBtnClass('desc')}>
        {sortDescLabel}
      </button>

      {extraActions ? (
        <>
          <div className="my-2 border-t border-slate-200 dark:border-slate-600" />
          {extraActions}
        </>
      ) : null}

      {showNumericFilters && (
        <>
          <div className="my-2 border-t border-slate-200 dark:border-slate-600" />
          <p className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Filtros de número
          </p>
          {NUMERIC_FILTER_OPTIONS.map((item, idx) => (
            <div key={item.op}>
              {idx === 1 || idx === 5 ? (
                <div className="my-1 border-t border-slate-200 dark:border-slate-600" />
              ) : null}
              <button
                type="button"
                onClick={() => selectNumericOp(item.op)}
                className={`block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-700 ${
                  numericOp === item.op ? 'bg-primary-50 font-medium text-primary-800 dark:bg-primary-900/40 dark:text-primary-200' : ''
                }`}
              >
                {item.label}
              </button>
            </div>
          ))}
          {numericOp && (
            <div className="mt-2 space-y-1.5 rounded border border-slate-200 bg-slate-50/80 p-2 dark:border-slate-600 dark:bg-slate-900/40">
              <input
                type="text"
                inputMode="decimal"
                value={draft.numericV1 ?? ''}
                onChange={(e) => patchDraft({ numericV1: e.target.value })}
                placeholder={numericOp === 'between' ? 'Valor mínimo' : 'Valor'}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
              {numericOp === 'between' && (
                <input
                  type="text"
                  inputMode="decimal"
                  value={draft.numericV2 ?? ''}
                  onChange={(e) => patchDraft({ numericV2: e.target.value })}
                  placeholder="Valor máximo"
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                />
              )}
              <div className="flex justify-end gap-1">
                <button
                  type="button"
                  onClick={limparFiltroNumerico}
                  className="rounded px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={() => onAplicar(key)}
                  className="rounded bg-primary-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-primary-700"
                >
                  Aplicar filtro
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <div className="my-2 border-t border-slate-200 dark:border-slate-600" />
      <input
        type="text"
        value={draft.search}
        onChange={(e) => patchDraft({ search: e.target.value })}
        placeholder="Pesquisar"
        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        autoFocus={!numericOp}
      />
      <div className="mt-2 max-h-44 overflow-auto rounded border border-slate-200 p-1 dark:border-slate-600">
        <label className="flex items-center gap-2 px-1 py-1 text-xs font-medium">
          <input
            type="checkbox"
            checked={todosVisiveisSelecionados}
            onChange={(e) => {
              const checked = e.target.checked;
              setExcelFilterDrafts((prev) => {
                const atual = prev[key] ?? { search: '', selected: valores };
                const set = new Set(atual.selected);
                for (const v of visiveis) {
                  if (checked) set.add(v);
                  else set.delete(v);
                }
                return { ...prev, [key]: { ...atual, selected: [...set] } };
              });
            }}
          />
          (Selecionar tudo)
        </label>
        {visiveis.map((value) => (
          <label key={value} className="flex items-center gap-2 px-1 py-0.5 text-xs">
            <input
              type="checkbox"
              checked={draft.selected.includes(value)}
              onChange={(e) => toggle(value, e.target.checked)}
            />
            <span className="truncate" title={value}>
              {value}
            </span>
          </label>
        ))}
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => onAplicar(key)}
          className="rounded border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
        >
          {applyButtonLabel}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="rounded border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
        >
          Cancelar
        </button>
      </div>
    </div>,
    document.body
  );
}
