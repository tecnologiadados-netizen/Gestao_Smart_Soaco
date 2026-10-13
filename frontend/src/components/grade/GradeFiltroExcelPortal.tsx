import { createPortal } from 'react-dom';
import { useState, type ReactNode } from 'react';
import type { ExcelFilterDraft, SortDir } from '../../hooks/useGradeFiltrosExcel';
import {
  NUMERIC_FILTER_OPTIONS,
  parseCellTextAsNumber,
  parseNumeroFiltroInput,
  type NumericFilterOp,
} from '../../utils/gradeFiltroNumerico';

export type CorCabecalhoGrade = { id: string; hex: string | null };

/** Filtro do cabeçalho: qualquer célula que tenha cor, sem escolher uma cor específica. */
export const FILTRO_COR_QUALQUER = '*';

/** Classificar e filtrar pela cor de preenchimento da coluna (menu do cabeçalho). */
export type FiltroCorCabecalho = {
  cores: CorCabecalhoGrade[];
  filtroId: string | null;
  ordemId: string | null;
  onClassificar: (id: string) => void;
  onFiltrar: (id: string | null) => void;
  /** Abre a classificação por cor da célula, com posição superior ou inferior. */
  onAbrirClassificacao?: () => void;
};

type Props = {
  colunaAberta: string;
  rect: { top: number; left: number; width: number; bottom?: number };
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
  /** Substitui a lista de valores por data início / data fim. */
  showDateRangeFilters?: boolean;
  /** Ordenação só é aplicada ao clicar em Ordenar (não ao escolher A/Z). */
  deferSortUntilApply?: boolean;
  applyButtonLabel?: string;
  /** Ações extras abaixo dos botões de ordenação (ex.: autopreencher Seq.). */
  extraActions?: ReactNode;
  /** Classificação e filtro pela cor da célula, entre a ordenação e a pesquisa. */
  filtroCor?: FiltroCorCabecalho;
  /** Sobreposição do menu (padrão 13001). Subir quando o modal pai tiver z-index maior. */
  zIndex?: number;
};

function BlocoFiltroCor({ filtroCor }: { filtroCor: FiltroCorCabecalho }) {
  const [painel, setPainel] = useState<'classificar' | 'filtrar' | null>(null);
  const abrir = (qual: 'classificar' | 'filtrar') => setPainel((atual) => (atual === qual ? null : qual));

  return (
    <>
      <div className="my-2 border-t border-slate-200 dark:border-slate-600" />
      <button
        type="button"
        onClick={() => abrir('classificar')}
        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-700"
      >
        <span className="min-w-0 flex-1">Classificar por cor</span>
        <span className="text-slate-400">{painel === 'classificar' ? '▾' : '›'}</span>
      </button>
      {painel === 'classificar' ? (
        <div>
          {filtroCor.onAbrirClassificacao ? (
            <button
              type="button"
              onClick={filtroCor.onAbrirClassificacao}
              className="mb-1 block w-full rounded px-2 py-1 text-left text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Classificação personalizada…
            </button>
          ) : null}
          <ListaCoresCabecalho
            cores={filtroCor.cores}
            ativoId={filtroCor.ordemId}
            onEscolher={filtroCor.onClassificar}
          />
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => abrir('filtrar')}
        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-700"
      >
        <span className="min-w-0 flex-1">Filtrar por cor</span>
        <span className="text-slate-400">{painel === 'filtrar' ? '▾' : '›'}</span>
      </button>
      {painel === 'filtrar' ? (
        <div>
          {filtroCor.filtroId != null ? (
            <button
              type="button"
              onClick={() => filtroCor.onFiltrar(null)}
              className="block w-full rounded px-2 py-1 text-left text-[11px] text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Todas as cores
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => filtroCor.onFiltrar(FILTRO_COR_QUALQUER)}
            className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] hover:bg-slate-100 dark:hover:bg-slate-700 ${
              filtroCor.filtroId === FILTRO_COR_QUALQUER ? 'font-medium text-primary-800 dark:text-primary-200' : ''
            }`}
          >
            <span
              className="h-3.5 w-3.5 rounded-sm border border-black/15 bg-gradient-to-br from-violet-500 via-sky-400 to-amber-400"
              aria-hidden
            />
            Com cor
          </button>
          <ListaCoresCabecalho
            cores={filtroCor.cores}
            ativoId={filtroCor.filtroId}
            onEscolher={(id) => filtroCor.onFiltrar(id)}
          />
        </div>
      ) : null}
    </>
  );
}

function ListaCoresCabecalho({
  cores,
  ativoId,
  onEscolher,
}: {
  cores: CorCabecalhoGrade[];
  ativoId: string | null;
  onEscolher: (id: string) => void;
}) {
  const coloridas = cores.filter((cor) => cor.hex);
  const temSem = cores.some((cor) => !cor.hex);
  if (coloridas.length === 0 && !temSem) {
    return <p className="px-2 py-1 text-[11px] text-slate-500">Nenhuma cor nesta coluna.</p>;
  }
  return (
    <div className="px-2 pb-1">
      {coloridas.length > 0 ? (
        <div className="flex flex-wrap gap-1 py-1">
          {coloridas.map((cor) => (
            <button
              key={cor.id}
              type="button"
              title={cor.hex ?? ''}
              aria-label={cor.hex ?? 'Sem preenchimento'}
              aria-pressed={ativoId === cor.id}
              onClick={() => onEscolher(cor.id)}
              className={`h-5 w-5 rounded-sm border border-black/20 ${
                ativoId === cor.id ? 'ring-2 ring-primary-600 ring-offset-1' : ''
              }`}
              style={{ backgroundColor: cor.hex ?? '#ffffff' }}
            />
          ))}
        </div>
      ) : null}
      {temSem ? (
        <button
          type="button"
          onClick={() => onEscolher('')}
          className={`flex w-full items-center gap-2 rounded px-1 py-1 text-left text-[11px] hover:bg-slate-100 dark:hover:bg-slate-700 ${
            ativoId === '' ? 'font-medium text-primary-800 dark:text-primary-200' : ''
          }`}
        >
          <span className="h-3.5 w-3.5 rounded-sm border border-slate-300 bg-white" aria-hidden />
          Sem preenchimento
        </button>
      ) : null}
    </div>
  );
}

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
  showDateRangeFilters = false,
  deferSortUntilApply = false,
  applyButtonLabel = 'OK',
  extraActions,
  filtroCor,
  zIndex = 13001,
}: Props) {
  const key = colunaAberta;
  const valores = valoresUnicosPorColuna[key] ?? [];
  const draft = excelFilterDrafts[key] ?? { search: '', selected: valores };
  const searchTrim = draft.search.trim();
  const visiveis = valores.filter((v) => {
    if (!searchTrim) return true;
    // Colunas numéricas: pesquisa exata pelo valor (evita "0" listar 10, 20…).
    if (showNumericFilters) {
      const nSearch = parseNumeroFiltroInput(searchTrim);
      const nVal = parseCellTextAsNumber(v);
      if (nSearch != null && Number.isFinite(nVal)) return nVal === nSearch;
      return v.toLowerCase() === searchTrim.toLowerCase();
    }
    return v.toLowerCase().includes(searchTrim.toLowerCase());
  });
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
  const btnTop = rect.bottom != null ? rect.top : Math.max(0, rect.top - 4);
  const btnBottom = rect.bottom ?? rect.top;
  const spaceBelow = window.innerHeight - btnBottom - margin;
  const spaceAbove = btnTop - margin;
  const minSpaceDown = 120;
  const openUp = spaceBelow < minSpaceDown && spaceAbove > spaceBelow;
  const menuH = openUp
    ? Math.min(menuMaxH, Math.max(160, spaceAbove - margin))
    : Math.min(menuMaxH, Math.max(160, spaceBelow - margin));
  const top = openUp ? Math.max(margin, btnTop - menuH - 4) : btnBottom + 4;
  const maxHeight = menuH;

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
        zIndex,
      }}
      className="rounded-lg border border-slate-300 bg-white p-2 text-slate-800 shadow-2xl dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button type="button" onClick={() => escolherOrdenacao('asc')} className={sortBtnClass('asc')}>
        {sortAscLabel}
      </button>
      <button type="button" onClick={() => escolherOrdenacao('desc')} className={sortBtnClass('desc')}>
        {sortDescLabel}
      </button>

      {filtroCor ? <BlocoFiltroCor filtroCor={filtroCor} /> : null}

      {extraActions ? (
        <>
          <div className="my-2 border-t border-slate-200 dark:border-slate-600" />
          {extraActions}
        </>
      ) : null}

      {showDateRangeFilters ? (
        <>
          <div className="my-2 border-t border-slate-200 dark:border-slate-600" />
          <p className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Período
          </p>
          <label className="mt-1 block space-y-0.5 px-1">
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">Data início</span>
            <input
              type="date"
              value={draft.dateFrom ?? ''}
              onChange={(e) => patchDraft({ dateFrom: e.target.value })}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
          </label>
          <label className="mt-1.5 block space-y-0.5 px-1">
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">Data fim</span>
            <input
              type="date"
              value={draft.dateTo ?? ''}
              onChange={(e) => patchDraft({ dateTo: e.target.value })}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
          </label>
          <div className="mt-1.5 flex justify-end px-1">
            <button
              type="button"
              onClick={() => patchDraft({ dateFrom: '', dateTo: '' })}
              className="rounded px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Limpar datas
            </button>
          </div>
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

      {!showDateRangeFilters ? (
        <>
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
        </>
      ) : (
        <div className="my-2 border-t border-slate-200 dark:border-slate-600" />
      )}
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
