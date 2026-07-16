import { useCallback, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import type { PreCompraCotacaoItem } from '../../../api/preCompra';
import GradeFiltroCabecalhoBtn from '../../grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../grade/GradeFiltroExcelPortal';
import { useGradeFiltrosExcel } from '../../../hooks/useGradeFiltrosExcel';

interface Props {
  items: PreCompraCotacaoItem[];
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onExibidosCountChange?: (count: number) => void;
  limparFiltrosGradeRef?: MutableRefObject<(() => void) | null>;
  onEmitirPdf: (cotacao: string) => void;
  generatingCotacao?: string | null;
}

interface CotacaoGroup {
  cotacao: string;
  items: PreCompraCotacaoItem[];
}

const COLUNAS = [
  { id: 'cotacao', label: 'Cotação', align: 'left' as const },
  { id: 'data_emissao', label: 'Data emissão', align: 'left' as const },
  { id: 'comprador', label: 'Comprador', align: 'left' as const },
  { id: 'status', label: 'Status', align: 'left' as const },
  { id: 'fornecedor', label: 'Fornecedor', align: 'left' as const },
  { id: 'codigo_produto', label: 'Cód. produto', align: 'left' as const },
  { id: 'descricao_produto', label: 'Descrição', align: 'left' as const },
  { id: 'qtde', label: 'Qtde', align: 'right' as const },
  { id: 'unidade', label: 'U.M', align: 'left' as const },
  { id: 'preco_unitario', label: 'Preço unit.', align: 'right' as const },
  { id: 'valor_total', label: 'Total', align: 'right' as const },
  { id: 'solicitacao_id', label: 'Solicitação', align: 'left' as const },
  { id: 'data_necessidade', label: 'Data necessidade', align: 'left' as const },
  { id: 'numeros_coleta', label: 'N° da coleta', align: 'left' as const },
] as const;

const COLUNAS_COM_FILTRO = COLUNAS.map((c) => c.id);
const COLUNAS_NUMERICAS = new Set(['qtde', 'preco_unitario', 'valor_total']);

function formatDate(value: string) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('pt-BR');
}

function formatMoney(value: number | string | null | undefined) {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatQty(value: number | string | null | undefined) {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function parseDataSort(value: string): number {
  if (!value) return 0;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function groupByCotacao(items: PreCompraCotacaoItem[]): CotacaoGroup[] {
  const groups: CotacaoGroup[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.cotacao === item.cotacao) {
      last.items.push(item);
    } else {
      groups.push({ cotacao: item.cotacao, items: [item] });
    }
  }
  return groups;
}

const AVISO_VINCULO_PENDENTE =
  'PDF bloqueado: vínculo pendente. Finalize a coleta na tela de Coleta de Preços, vinculando o pedido de compra (gerado a partir desta cotação) ou a própria cotação. Após finalizar, o PDF será liberado.';

function PdfActionButton({
  loading,
  bloqueado,
  onClick,
}: {
  loading: boolean;
  bloqueado?: boolean;
  onClick: () => void;
}) {
  if (bloqueado) {
    return (
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-400 cursor-not-allowed dark:border-slate-600 dark:bg-slate-700/40 dark:text-slate-500"
          disabled
          title={AVISO_VINCULO_PENDENTE}
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          PDF
        </button>
        <span
          className="max-w-[180px] text-center text-[10px] leading-tight text-amber-600 dark:text-amber-400"
          title={AVISO_VINCULO_PENDENTE}
        >
          Finalize a coleta vinculada para liberar
        </span>
      </div>
    );
  }
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/70"
      onClick={onClick}
      disabled={loading}
      title="Emitir PDF"
    >
      {loading ? (
        <>
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
          Gerando…
        </>
      ) : (
        <>
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2 5 5h-5V4zM8 13h8v2H8v-2zm0 4h5v2H8v-2z" />
          </svg>
          PDF
        </>
      )}
    </button>
  );
}

export default function PreCompraTabela({
  items,
  page,
  pageSize,
  onPageChange,
  onExibidosCountChange,
  limparFiltrosGradeRef,
  onEmitirPdf,
  generatingCotacao = null,
}: Props) {
  const getCellText = useCallback((row: PreCompraCotacaoItem, colId: string): string => {
    switch (colId) {
      case 'cotacao':
        return row.cotacao ?? '';
      case 'data_emissao':
        return formatDate(row.data_emissao) || '—';
      case 'comprador':
        return row.comprador ?? '';
      case 'status':
        return row.status_label ?? '';
      case 'fornecedor':
        return row.fornecedor ?? '';
      case 'codigo_produto':
        return row.codigo_produto ?? '';
      case 'descricao_produto':
        return row.descricao_produto ?? '';
      case 'qtde':
        return formatQty(row.qtde);
      case 'unidade':
        return row.unidade ?? '';
      case 'preco_unitario':
        return formatMoney(row.preco_unitario);
      case 'valor_total':
        return formatMoney(row.valor_total);
      case 'solicitacao_id':
        return row.solicitacao_id != null ? String(row.solicitacao_id) : '';
      case 'data_necessidade':
        return formatDate(row.data_necessidade) || '—';
      case 'numeros_coleta':
        return row.numeros_coleta && row.numeros_coleta.length > 0
          ? row.numeros_coleta.join(', ')
          : '—';
      default:
        return '';
    }
  }, []);

  const getCellFilterValues = useCallback((row: PreCompraCotacaoItem, colId: string): string[] | null => {
    if (colId === 'numeros_coleta') {
      if (row.numeros_coleta && row.numeros_coleta.length > 0) {
        return row.numeros_coleta.map(String);
      }
      return ['—'];
    }
    return null;
  }, []);

  const valueForSort = useCallback(
    (row: PreCompraCotacaoItem, colId: string): string | number => {
      if (colId === 'qtde') return Number(row.qtde) || 0;
      if (colId === 'preco_unitario') return Number(row.preco_unitario) || 0;
      if (colId === 'valor_total') return Number(row.valor_total) || 0;
      if (colId === 'solicitacao_id') return Number(row.solicitacao_id) || 0;
      if (colId === 'data_emissao') return parseDataSort(row.data_emissao);
      if (colId === 'data_necessidade') return parseDataSort(row.data_necessidade);
      return getCellText(row, colId);
    },
    [getCellText]
  );

  const grade = useGradeFiltrosExcel({
    rows: items,
    columnIds: [...COLUNAS_COM_FILTRO],
    getCellText,
    getCellFilterValues,
    valueForSort,
  });

  const limparRef = useRef(grade.limparFiltrosGrade);
  limparRef.current = grade.limparFiltrosGrade;

  useEffect(() => {
    if (!limparFiltrosGradeRef) return;
    limparFiltrosGradeRef.current = () => limparRef.current();
    return () => {
      limparFiltrosGradeRef.current = null;
    };
  }, [limparFiltrosGradeRef]);

  const listaExibida = grade.rowsExibidas;

  useEffect(() => {
    onExibidosCountChange?.(listaExibida.length);
  }, [listaExibida.length, onExibidosCountChange]);

  const columnFiltersKey = JSON.stringify(grade.columnFilters);
  useEffect(() => {
    onPageChange(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetar página ao mudar filtros do cabeçalho
  }, [columnFiltersKey]);

  const listaPagina = useMemo(() => {
    const start = (page - 1) * pageSize;
    return listaExibida.slice(start, start + pageSize);
  }, [listaExibida, page, pageSize]);

  const groups = useMemo(() => groupByCotacao(listaPagina), [listaPagina]);

  const emptyState =
    items.length === 0 ? (
      <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-8 text-center text-slate-500 dark:text-slate-400">
        Nenhuma cotação encontrada.
      </div>
    ) : null;

  return (
    <div className="space-y-2">
      {emptyState}

      {!emptyState && grade.temFiltrosOuOrdem && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={grade.limparFiltrosGrade}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Limpar filtros da grade
          </button>
        </div>
      )}

      {!emptyState && (
        <div
          ref={grade.tableScrollRef}
          className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-600"
        >
          <table className="min-w-full text-sm text-slate-800 dark:text-slate-100">
            <thead className="sticky top-0 z-10">
              <tr className="bg-primary-600 text-white">
                {COLUNAS.map((col) => {
                  const sortAtivo =
                    grade.sortState?.key === col.id || grade.sortLevels.some((l) => l.id === col.id);
                  return (
                    <th
                      key={col.id}
                      className={`border border-primary-500/40 px-2 py-2 font-semibold whitespace-nowrap ${
                        col.align === 'right' ? 'text-right' : 'text-left'
                      } ${col.id === 'descricao_produto' ? 'min-w-[160px]' : ''}`}
                    >
                      <div
                        className={`flex min-w-0 items-center gap-1 ${
                          col.align === 'right' ? 'justify-end' : 'justify-between'
                        }`}
                      >
                        <span className="min-w-0 truncate text-[11px] leading-tight sm:text-xs">
                          {col.label}
                        </span>
                        <GradeFiltroCabecalhoBtn
                          ativo={grade.colunaComFiltroAtivo(col.id) || sortAtivo}
                          onClick={(e) => grade.abrirFiltroExcel(col.id, e)}
                        />
                      </div>
                    </th>
                  );
                })}
                <th className="border border-primary-500/40 px-2 py-2 text-center font-semibold whitespace-nowrap text-[11px] sm:text-xs">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {listaPagina.length === 0 ? (
                <tr>
                  <td
                    colSpan={COLUNAS.length + 1}
                    className="px-3 py-8 text-center text-slate-500 dark:text-slate-400"
                  >
                    Nenhum registro com os filtros da grade.
                  </td>
                </tr>
              ) : (
                groups.map((group, groupIdx) => {
                  const rowSpan = group.items.length;
                  const groupClass =
                    groupIdx % 2 === 0
                      ? 'bg-white dark:bg-slate-900/30'
                      : 'bg-slate-50/80 dark:bg-slate-800/20';
                  const isGenerating = generatingCotacao === group.cotacao;
                  const header = group.items[0];

                  return group.items.map((item, itemIdx) => {
                    const isFirst = itemIdx === 0;

                    return (
                      <tr
                        key={`${item.cotacao}-${item.fornecedor_id}-${item.codigo_produto}-${itemIdx}-${groupIdx}`}
                        className={`border-t border-slate-100 dark:border-slate-700/50 ${groupClass}`}
                      >
                        {isFirst && (
                          <>
                            <td
                              rowSpan={rowSpan}
                              className="px-3 py-2 align-middle font-medium whitespace-nowrap"
                            >
                              {header.cotacao}
                            </td>
                            <td rowSpan={rowSpan} className="px-3 py-2 align-middle whitespace-nowrap">
                              {formatDate(header.data_emissao)}
                            </td>
                            <td rowSpan={rowSpan} className="px-3 py-2 align-middle">
                              {header.comprador}
                            </td>
                            <td rowSpan={rowSpan} className="px-3 py-2 align-middle">
                              <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                                {header.status_label}
                              </span>
                            </td>
                          </>
                        )}

                        <td className="px-3 py-2">{item.fornecedor}</td>
                        <td className="px-3 py-2">
                          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-700">
                            {item.codigo_produto}
                          </code>
                        </td>
                        <td className="px-3 py-2 max-w-[240px] truncate" title={item.descricao_produto}>
                          {item.descricao_produto}
                        </td>
                        <td className="px-3 py-2 text-right">{formatQty(item.qtde)}</td>
                        <td className="px-3 py-2">{item.unidade}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {formatMoney(item.preco_unitario)}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap font-medium">
                          {formatMoney(item.valor_total)}
                        </td>
                        <td className="px-3 py-2">{item.solicitacao_id}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {formatDate(item.data_necessidade)}
                        </td>

                        {isFirst && (
                          <>
                            <td rowSpan={rowSpan} className="px-3 py-2 align-middle whitespace-nowrap">
                              {header.numeros_coleta && header.numeros_coleta.length > 0 ? (
                                <span className="inline-flex flex-wrap gap-1">
                                  {header.numeros_coleta.map((n) => (
                                    <span
                                      key={n}
                                      className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                                    >
                                      {n}
                                    </span>
                                  ))}
                                </span>
                              ) : (
                                <span className="text-slate-400 dark:text-slate-500">—</span>
                              )}
                            </td>
                            <td rowSpan={rowSpan} className="px-3 py-2 align-middle text-center">
                              <PdfActionButton
                                loading={isGenerating}
                                bloqueado={!(header.numeros_coleta && header.numeros_coleta.length > 0)}
                                onClick={() => onEmitirPdf(group.cotacao)}
                              />
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  });
                })
              )}
            </tbody>
          </table>
          <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700">
            {groups.length} cotação(ões) nesta página
          </div>
        </div>
      )}

      {grade.colunaFiltroAberta && grade.filtroAbertoRect && (
        <GradeFiltroExcelPortal
          colunaAberta={grade.colunaFiltroAberta}
          rect={grade.filtroAbertoRect}
          dropdownRef={grade.filtroDropdownRef}
          excelFilterDrafts={grade.excelFilterDrafts}
          setExcelFilterDrafts={grade.setExcelFilterDrafts}
          valoresUnicosPorColuna={grade.valoresUnicosPorColuna}
          showNumericFilters={COLUNAS_NUMERICAS.has(grade.colunaFiltroAberta)}
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
      )}
    </div>
  );
}
