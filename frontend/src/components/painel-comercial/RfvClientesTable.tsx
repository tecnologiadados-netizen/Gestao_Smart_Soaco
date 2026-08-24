import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import type { RfvClienteItem } from '../../api/rfvClientes';
import GradeFiltroExcelPortal from '../grade/GradeFiltroExcelPortal';
import GradeFiltroCabecalhoBtn from '../grade/GradeFiltroCabecalhoBtn';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import { formatMoeda, formatNumero, formatYmdBr } from './painelComercialUtils';
import { labelSegmentoUi } from './rfvSegmentos';
import { descricaoSelecao, type RfvSelecao } from './rfvSelecao';

const COLS = [
  { id: 'cliente', label: 'Cliente' },
  { id: 'segmento', label: 'Segmento' },
  { id: 'rfv', label: 'RFV' },
  { id: 'recencia', label: 'Recência' },
  { id: 'frequencia', label: 'Freq.' },
  { id: 'valor', label: 'Valor' },
  { id: 'ultimaEmissao', label: 'Última compra' },
  { id: 'municipio', label: 'Município' },
  { id: 'vendedor', label: 'Vendedor' },
] as const;

const NUM_COLS = new Set(['recencia', 'frequencia', 'valor']);
/** Colunas com filtro Excel no cabeçalho (demais só rótulo). */
const COLS_COM_FILTRO = new Set(['cliente', 'segmento', 'municipio', 'vendedor']);
const BATCH_SIZE = 50;
const SCROLL_MAX_H = 'max-h-[min(70vh,560px)]';

type ColId = (typeof COLS)[number]['id'];

function formatUltimaCompra(ymd: string | undefined | null): string {
  const v = String(ymd ?? '').trim();
  if (!v || v === '—') return '—';
  const m = /^(\d{4}-\d{2}-\d{2})$/.exec(v);
  if (!m) return '—';
  return formatYmdBr(m[0]!);
}

function getCellText(c: RfvClienteItem, colId: string): string {
  switch (colId as ColId) {
    case 'cliente':
      return c.cliente;
    case 'segmento':
      return labelSegmentoUi(c.segmentoId);
    case 'rfv':
      return `${c.rScore}${c.fScore}${c.vScore}`;
    case 'recencia':
      return `${formatNumero(c.recenciaDias)} d`;
    case 'frequencia':
      return formatNumero(c.frequencia);
    case 'valor':
      return formatMoeda(c.valor);
    case 'ultimaEmissao':
      return formatUltimaCompra(c.ultimaEmissao);
    case 'municipio':
      return c.municipio || '—';
    case 'vendedor':
      return c.vendedor || '—';
    default:
      return '';
  }
}

function getNumericValue(c: RfvClienteItem, colId: string): number {
  switch (colId as ColId) {
    case 'recencia':
      return c.recenciaDias;
    case 'frequencia':
      return c.frequencia;
    case 'valor':
      return c.valor;
    default:
      return NaN;
  }
}

function valueForSort(c: RfvClienteItem, colId: string): string | number {
  if (NUM_COLS.has(colId)) return getNumericValue(c, colId);
  return getCellText(c, colId);
}

export default function RfvClientesTable({
  clientes,
  selecao,
  loading,
  onLimparSelecao,
}: {
  clientes: RfvClienteItem[];
  selecao: RfvSelecao;
  loading?: boolean;
  onLimparSelecao: () => void;
}) {
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const grade = useGradeFiltrosExcel({
    rows: clientes,
    columnIds: COLS.map((c) => c.id),
    getCellText,
    valueForSort,
    getNumericValue: (row, colId) => getNumericValue(row, colId),
  });

  const totalFiltrados = grade.rowsExibidas.length;
  const linhasVisiveis = grade.rowsExibidas.slice(0, visibleCount);
  const temMais = visibleCount < totalFiltrados;

  const resetVisiveis = useCallback(() => setVisibleCount(BATCH_SIZE), []);

  const gradeFiltrosKey = useMemo(
    () => JSON.stringify({ selecao, cf: grade.columnFilters, sort: grade.sortState }),
    [selecao, grade.columnFilters, grade.sortState]
  );

  useEffect(() => {
    resetVisiveis();
  }, [clientes, gradeFiltrosKey, resetVisiveis]);

  useEffect(() => {
    const root = grade.tableScrollRef.current;
    const sentinel = loadMoreRef.current;
    if (!root || !sentinel || !temMais) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((n) => Math.min(n + BATCH_SIZE, totalFiltrados));
        }
      },
      { root, rootMargin: '80px', threshold: 0 }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [grade.tableScrollRef, temMais, totalFiltrados, visibleCount]);

  const onAbrirFiltro = useCallback(
    (colId: string, e: MouseEvent<HTMLButtonElement>) => {
      resetVisiveis();
      grade.abrirFiltroExcel(colId, e);
    },
    [grade, resetVisiveis]
  );

  if (loading) {
    return (
      <div className="card-panel min-h-[240px] animate-pulse p-4">
        <div className="h-full rounded bg-slate-200 dark:bg-slate-700" />
      </div>
    );
  }

  return (
    <div className="card-panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-soaco-navy dark:text-soaco-white">Clientes</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {selecao ? (
              <>
                Filtro: <span className="font-medium text-slate-700 dark:text-slate-200">{descricaoSelecao(selecao, labelSegmentoUi)}</span>
                {' · '}
                {formatNumero(grade.rowsExibidas.length)} cliente(s)
              </>
            ) : (
              <>
                Exibindo {formatNumero(Math.min(visibleCount, totalFiltrados))} de {formatNumero(totalFiltrados)} clientes
                {totalFiltrados !== clientes.length && ` (${formatNumero(clientes.length)} no período)`}
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {grade.temFiltrosOuOrdem && (
            <button
              type="button"
              onClick={() => {
                grade.limparFiltrosGrade();
                resetVisiveis();
              }}
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              Limpar filtros da grade
            </button>
          )}
          {selecao && (
            <button
              type="button"
              onClick={onLimparSelecao}
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              Limpar seleção
            </button>
          )}
        </div>
      </div>

      <div ref={grade.tableScrollRef} className={`overflow-auto ${SCROLL_MAX_H}`}>
        <table className="w-full min-w-[720px] border-collapse text-xs">
          <thead className="sticky top-0 z-[1] bg-white dark:bg-slate-900">
            <tr className="border-b border-slate-200 text-left text-[10px] uppercase tracking-wide text-slate-500 dark:border-slate-700">
              {COLS.map((col) => {
                const sortAtivo = grade.sortState?.key === col.id;
                const hiddenClass =
                  col.id === 'ultimaEmissao'
                    ? 'hidden md:table-cell'
                    : col.id === 'municipio' || col.id === 'vendedor'
                      ? 'hidden lg:table-cell'
                      : '';
                return (
                  <th key={col.id} className={`py-2 pr-2 ${hiddenClass}`}>
                    <div className="flex items-center gap-1">
                      <span>{col.label}</span>
                      {COLS_COM_FILTRO.has(col.id) && (
                        <GradeFiltroCabecalhoBtn
                          ativo={grade.colunaComFiltroAtivo(col.id) || sortAtivo}
                          onClick={(e) => onAbrirFiltro(col.id, e)}
                          className="border-slate-300 text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                        />
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {linhasVisiveis.map((c) => (
              <tr key={c.cliente} className="border-b border-slate-100 dark:border-slate-800">
                <td className="max-w-[200px] truncate py-2 pr-2 font-medium text-slate-800 dark:text-slate-100" title={c.cliente}>{c.cliente}</td>
                <td className="py-2 pr-2 text-slate-600 dark:text-slate-300">{labelSegmentoUi(c.segmentoId)}</td>
                <td className="py-2 pr-2 font-mono text-slate-600 dark:text-slate-300">{c.rScore}{c.fScore}{c.vScore}</td>
                <td className="py-2 pr-2 text-right">{formatNumero(c.recenciaDias)} d</td>
                <td className="py-2 pr-2 text-right">{formatNumero(c.frequencia)}</td>
                <td className="py-2 pr-2 text-right font-medium">{formatMoeda(c.valor, true)}</td>
                <td className="hidden py-2 pr-2 md:table-cell">{formatUltimaCompra(c.ultimaEmissao)}</td>
                <td className="hidden max-w-[120px] truncate py-2 pr-2 lg:table-cell" title={c.municipio}>{c.municipio}</td>
                <td className="hidden max-w-[120px] truncate py-2 lg:table-cell" title={c.vendedor}>{c.vendedor}</td>
              </tr>
            ))}
            {temMais && (
              <tr>
                <td colSpan={COLS.length} className="py-3 text-center text-xs text-slate-500">
                  <div ref={loadMoreRef}>Carregando mais clientes…</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {!totalFiltrados && (
          <p className="py-10 text-center text-slate-500">Nenhum cliente neste recorte.</p>
        )}
      </div>

      {totalFiltrados > 0 && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {temMais
            ? `Role a grade para carregar mais (${formatNumero(Math.min(visibleCount, totalFiltrados))} de ${formatNumero(totalFiltrados)}).`
            : `Todos os ${formatNumero(totalFiltrados)} clientes exibidos.`}
        </p>
      )}

      {grade.colunaFiltroAberta && grade.filtroAbertoRect && (
        <GradeFiltroExcelPortal
          colunaAberta={grade.colunaFiltroAberta}
          rect={grade.filtroAbertoRect}
          dropdownRef={grade.filtroDropdownRef}
          excelFilterDrafts={grade.excelFilterDrafts}
          setExcelFilterDrafts={grade.setExcelFilterDrafts}
          valoresUnicosPorColuna={grade.valoresUnicosPorColuna}
          showNumericFilters={NUM_COLS.has(grade.colunaFiltroAberta)}
          sortAscLabel={NUM_COLS.has(grade.colunaFiltroAberta) ? 'Menor → Maior' : 'A↧ Classificar de A a Z'}
          sortDescLabel={NUM_COLS.has(grade.colunaFiltroAberta) ? 'Maior → Menor' : 'Z↧ Classificar de Z a A'}
          onSortAsc={(colId) => {
            grade.setSortState({ key: colId, direction: 'asc' });
            grade.setSortLevels([]);
            grade.fecharFiltroExcel();
            resetVisiveis();
          }}
          onSortDesc={(colId) => {
            grade.setSortState({ key: colId, direction: 'desc' });
            grade.setSortLevels([]);
            grade.fecharFiltroExcel();
            resetVisiveis();
          }}
          onAplicar={(colId) => {
            grade.aplicarFiltroExcel(colId);
            resetVisiveis();
          }}
          onCancelar={grade.fecharFiltroExcel}
        />
      )}
    </div>
  );
}
