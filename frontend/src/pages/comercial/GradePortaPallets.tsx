import { useEffect, useMemo, useState, type ReactNode } from 'react';
import GradeFiltroCabecalhoBtn from '../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../components/grade/GradeFiltroExcelPortal';
import { formatMoeda, formatNumero } from '../../components/painel-comercial/painelComercialUtils';
import { useGradeFiltrosExcel, type SortLevel } from '../../hooks/useGradeFiltrosExcel';

export type TipoColuna = 'texto' | 'numero' | 'moeda' | 'data';

export type ColunaGrade<T> = {
  id: string;
  label: string;
  tipo?: TipoColuna;
  /** Texto da célula, usado também no filtro por valores. */
  texto: (row: T) => string;
  /** Valor para ordenar e para filtro numérico. Datas: AAAA-MM-DD. */
  valor?: (row: T) => number | string;
  /** Soma a coluna no rodapé (só tipos numero/moeda). */
  total?: boolean;
  render?: (row: T) => ReactNode;
  className?: string;
};

type Props<T> = {
  rows: T[];
  colunas: ColunaGrade<T>[];
  rowKey: (row: T, index: number) => string | number;
  defaultSortLevels?: SortLevel[];
  pageSize?: number;
  vazio?: string;
  /** Recebe as linhas depois de filtros e ordenação da grade (ex.: exportar). */
  onLinhasExibidas?: (rows: T[]) => void;
  maxHeightClass?: string;
};

const NUMERICOS: TipoColuna[] = ['numero', 'moeda'];

function vazioParaOrdem(v: string | number): boolean {
  return v === '' || (typeof v === 'number' && !Number.isFinite(v));
}

function compararLinhas<T>(
  a: T,
  b: T,
  levels: SortLevel[],
  getSortValue: (row: T, columnId: string) => string | number
): number {
  for (const level of levels) {
    const av = getSortValue(a, level.id);
    const bv = getSortValue(b, level.id);
    const aVazio = vazioParaOrdem(av);
    const bVazio = vazioParaOrdem(bv);
    if (aVazio || bVazio) {
      if (aVazio && bVazio) continue;
      return aVazio ? 1 : -1;
    }
    const cmp =
      typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv), 'pt-BR', { numeric: true, sensitivity: 'base' });
    if (cmp !== 0) return level.dir === 'asc' ? cmp : -cmp;
  }
  return 0;
}

export default function GradePortaPallets<T>({
  rows,
  colunas,
  rowKey,
  defaultSortLevels = [],
  pageSize = 100,
  vazio = 'Nenhum registro.',
  onLinhasExibidas,
  maxHeightClass = 'max-h-[min(62vh,560px)]',
}: Props<T>) {
  const porId = useMemo(() => new Map(colunas.map((c) => [c.id, c])), [colunas]);
  const dateColumnIds = useMemo(() => colunas.filter((c) => c.tipo === 'data').map((c) => c.id), [colunas]);

  const grade = useGradeFiltrosExcel<T>({
    rows,
    columnIds: colunas.map((c) => c.id),
    getCellText: (row, id) => porId.get(id)?.texto(row) ?? '',
    valueForSort: (row, id) => {
      const col = porId.get(id);
      if (!col) return '';
      return col.valor ? col.valor(row) : col.texto(row);
    },
    defaultSortLevels,
    dateColumnIds,
    compareRows: compararLinhas,
  });

  const [pagina, setPagina] = useState(1);
  const total = grade.rowsExibidas.length;
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPagina(1);
  }, [rows, grade.columnFilters, grade.sortState]);

  useEffect(() => {
    onLinhasExibidas?.(grade.rowsExibidas);
  }, [grade.rowsExibidas, onLinhasExibidas]);

  const linhas = useMemo(
    () => grade.rowsExibidas.slice((pagina - 1) * pageSize, pagina * pageSize),
    [grade.rowsExibidas, pagina, pageSize]
  );

  const totais = useMemo(() => {
    const out: Record<string, number> = {};
    for (const col of colunas) {
      if (!col.total || !col.valor) continue;
      out[col.id] = grade.rowsExibidas.reduce((s, r) => {
        const v = col.valor!(r);
        return s + (typeof v === 'number' && Number.isFinite(v) ? v : 0);
      }, 0);
    }
    return out;
  }, [colunas, grade.rowsExibidas]);
  const temTotais = Object.keys(totais).length > 0;

  const colAberta = grade.colunaFiltroAberta ? porId.get(grade.colunaFiltroAberta) : undefined;
  const abertaNumerica = colAberta?.tipo != null && NUMERICOS.includes(colAberta.tipo);
  const abertaData = colAberta?.tipo === 'data';

  return (
    <div className="flex min-h-0 flex-col">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>
          {formatNumero(total)} {total === 1 ? 'linha' : 'linhas'}
          {total !== rows.length ? ` de ${formatNumero(rows.length)}` : ''} · filtro e ordem no ▾ do cabeçalho
        </span>
        <div className="flex items-center gap-2">
          {grade.temFiltrosOuOrdem ? (
            <button
              type="button"
              onClick={() => grade.limparFiltrosGrade()}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              Limpar filtros da grade
            </button>
          ) : null}
          {totalPaginas > 1 ? (
            <>
              <button
                type="button"
                disabled={pagina <= 1}
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                className="rounded-md border border-slate-200 px-2 py-1 text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
              >
                Anterior
              </button>
              <span className="tabular-nums">
                {pagina}/{totalPaginas}
              </span>
              <button
                type="button"
                disabled={pagina >= totalPaginas}
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                className="rounded-md border border-slate-200 px-2 py-1 text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
              >
                Próxima
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div
        ref={grade.tableScrollRef}
        className={`min-h-0 overflow-auto rounded-lg border border-slate-200 dark:border-white/10 ${maxHeightClass}`}
      >
        <table className="w-full min-w-[760px] border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-[#12141c]">
            <tr className="border-b border-slate-200 dark:border-white/10">
              {colunas.map((col) => {
                const numerica = col.tipo != null && NUMERICOS.includes(col.tipo);
                return (
                  <th key={col.id} className="px-2 py-2 align-top">
                    <div className={`flex items-center gap-1.5 ${numerica ? 'justify-end' : 'justify-between'}`}>
                      <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{col.label}</span>
                      <GradeFiltroCabecalhoBtn
                        ativo={grade.colunaComFiltroAtivo(col.id)}
                        onClick={(e) => grade.abrirFiltroExcel(col.id, e)}
                        className="border-slate-300 text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                      />
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {linhas.map((row, i) => (
              <tr key={rowKey(row, i)} className="hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                {colunas.map((col) => {
                  const numerica = col.tipo != null && NUMERICOS.includes(col.tipo);
                  return (
                    <td
                      key={col.id}
                      className={`px-2 py-1.5 text-slate-800 dark:text-slate-100 ${numerica ? 'text-right tabular-nums' : ''} ${col.className ?? ''}`}
                    >
                      {col.render ? col.render(row) : col.texto(row)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          {temTotais && total > 0 ? (
            <tfoot className="sticky bottom-0 bg-slate-100 font-semibold dark:bg-[#12141c]">
              <tr className="border-t-2 border-slate-300 dark:border-white/10">
                {colunas.map((col, i) => (
                  <td
                    key={col.id}
                    className={`px-2 py-2 text-slate-800 dark:text-slate-100 ${col.id in totais ? 'text-right tabular-nums' : ''}`}
                  >
                    {col.id in totais
                      ? col.tipo === 'moeda'
                        ? formatMoeda(totais[col.id]!)
                        : formatNumero(totais[col.id]!)
                      : i === 0
                        ? 'Total filtrado'
                        : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
        {total === 0 ? <p className="py-10 text-center text-sm text-slate-500">{vazio}</p> : null}
      </div>

      {grade.colunaFiltroAberta && grade.filtroAbertoRect ? (
        <GradeFiltroExcelPortal
          colunaAberta={grade.colunaFiltroAberta}
          rect={grade.filtroAbertoRect}
          dropdownRef={grade.filtroDropdownRef}
          excelFilterDrafts={grade.excelFilterDrafts}
          setExcelFilterDrafts={grade.setExcelFilterDrafts}
          valoresUnicosPorColuna={grade.valoresUnicosPorColuna}
          showNumericFilters={abertaNumerica}
          showDateRangeFilters={abertaData}
          sortAscLabel={abertaNumerica || abertaData ? 'Menor → Maior' : 'A↧ Classificar de A a Z'}
          sortDescLabel={abertaNumerica || abertaData ? 'Maior → Menor' : 'Z↧ Classificar de Z a A'}
          onSortAsc={(colId) => {
            grade.setSortState({ key: colId, direction: 'asc' });
            grade.setSortLevels([]);
            grade.fecharFiltroExcel();
          }}
          onSortDesc={(colId) => {
            grade.setSortState({ key: colId, direction: 'desc' });
            grade.setSortLevels([]);
            grade.fecharFiltroExcel();
          }}
          onAplicar={grade.aplicarFiltroExcel}
          onCancelar={grade.fecharFiltroExcel}
        />
      ) : null}
    </div>
  );
}
