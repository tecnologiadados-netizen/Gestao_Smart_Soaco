import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import GradeFiltroCabecalhoBtn from '../grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../grade/GradeFiltroExcelPortal';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import { useRegisterModalEscape } from '../../contexts/ModalStackContext';
import {
  listarPainelComercialVendasDetalhe,
  type FiltrosPainelComercialVendas,
  type VendaPainelRow,
  type DrillDim,
} from '../../api/painelComercialVendas';
import { formatMoeda, formatNumero } from './painelComercialUtils';

const PAGE_SIZE = 60;

type ColId =
  | 'pd'
  | 'emissao'
  | 'cliente'
  | 'vendedor'
  | 'codigo'
  | 'descricao'
  | 'grupo'
  | 'sub1'
  | 'sub2'
  | 'qtde'
  | 'valor'
  | 'regiao'
  | 'uf'
  | 'municipio';

const COL_LABELS: Record<ColId, string> = {
  pd: 'PD',
  emissao: 'Emissão',
  cliente: 'Cliente',
  vendedor: 'Vendedor',
  codigo: 'Cód.',
  descricao: 'Descrição',
  grupo: 'Grupo',
  sub1: 'Subgrupo 1',
  sub2: 'Subgrupo 2',
  qtde: 'Qtde',
  valor: 'Valor',
  regiao: 'Região',
  uf: 'UF',
  municipio: 'Município',
};

function cellText(r: VendaPainelRow, col: ColId): string {
  switch (col) {
    case 'pd':
      return r.pdCodigo || '—';
    case 'emissao':
      return String(r.dataEmissao ?? '—');
    case 'cliente':
      return r.cliente || '—';
    case 'vendedor':
      return r.vendedor || '—';
    case 'codigo':
      return r.codigoProduto || '—';
    case 'descricao':
      return r.descricaoProduto || '—';
    case 'grupo':
      return r.grupoProduto || '—';
    case 'sub1':
      return r.subgrupo1 || '—';
    case 'sub2':
      return r.subgrupo2 || '—';
    case 'qtde':
      return formatNumero(r.qtdeVendida);
    case 'valor':
      return formatMoeda(r.valorVendido);
    case 'regiao':
      return r.regiao || '—';
    case 'uf':
      return r.uf || '—';
    case 'municipio':
      return r.municipio || '—';
    default:
      return '—';
  }
}

function numericValue(r: VendaPainelRow, col: ColId): number {
  if (col === 'qtde') return Number(r.qtdeVendida ?? 0);
  if (col === 'valor') return Number(r.valorVendido ?? 0);
  return NaN;
}

function sortValue(r: VendaPainelRow, col: ColId): string | number {
  if (col === 'valor') return numericValue(r, col);
  if (col === 'qtde') return numericValue(r, col);
  return cellText(r, col).toLowerCase();
}

export type DetalheContexto = {
  dim?: DrillDim;
  mes?: string;
  grupoProduto?: string;
  subgrupo1?: string;
  subgrupo2?: string;
  vendedor?: string;
  regiao?: string;
  uf?: string;
  municipio?: string;
  cliente?: string;
  codigoProduto?: string;
  pd?: string;
};

export default function ModalPainelComercialDetalhe({
  open,
  modalId,
  titulo,
  subtitulo,
  filtros,
  contexto,
  onClose,
  cacheRef,
}: {
  open: boolean;
  modalId: string;
  titulo: string;
  subtitulo?: string;
  filtros: FiltrosPainelComercialVendas;
  contexto?: DetalheContexto;
  onClose: () => void;
  cacheRef?: React.MutableRefObject<Map<string, VendaPainelRow[]>>;
}) {
  const [rows, setRows] = useState<VendaPainelRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const cacheKey = useMemo(() => JSON.stringify({ filtros, contexto }), [contexto, filtros]);

  const carregar = useCallback(async () => {
    if (!open) return;
    const cached = cacheRef?.current.get(cacheKey);
    if (cached) {
      setRows(cached);
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      const data = await listarPainelComercialVendasDetalhe(filtros, contexto);
      const r = data.rows ?? [];
      setRows(r);
      cacheRef?.current.set(cacheKey, r);
    } catch (e) {
      setRows([]);
      setErro(e instanceof Error ? e.message : 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }, [cacheKey, cacheRef, contexto, filtros, open]);

  useEffect(() => {
    if (!open) {
      setRows([]);
      setErro(null);
      setPage(1);
      return;
    }
    void carregar();
  }, [carregar, open]);

  useRegisterModalEscape({ id: modalId, onClose, zIndex: 12950, enabled: open });

  const cols: ColId[] = useMemo(
    () => ['pd', 'emissao', 'cliente', 'vendedor', 'codigo', 'descricao', 'grupo', 'sub1', 'sub2', 'qtde', 'valor', 'regiao', 'uf', 'municipio'],
    []
  );

  const grade = useGradeFiltrosExcel<VendaPainelRow>({
    rows,
    columnIds: cols,
    getCellText: (r, c) => cellText(r, c as ColId),
    valueForSort: (r, c) => sortValue(r, c as ColId),
    defaultSortLevels: [{ id: 'valor', dir: 'desc' }],
  });

  useEffect(() => {
    setPage(1);
  }, [grade.rowsExibidas.length]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return grade.rowsExibidas.slice(start, start + PAGE_SIZE);
  }, [grade.rowsExibidas, page]);

  const totalPages = Math.max(1, Math.ceil(grade.rowsExibidas.length / PAGE_SIZE));
  const totalValor = useMemo(() => grade.rowsExibidas.reduce((s, r) => s + (Number(r.valorVendido) || 0), 0), [grade.rowsExibidas]);
  const totalQtde = useMemo(() => grade.rowsExibidas.reduce((s, r) => s + (Number(r.qtdeVendida) || 0), 0), [grade.rowsExibidas]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[12950] flex items-center justify-center bg-black/70 p-4" role="presentation" onClick={onClose}>
      <div
        className="flex max-h-[min(88vh,760px)] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900"
        role="dialog"
        aria-modal
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-slate-800 dark:text-slate-100">{titulo}</h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              {subtitulo ? subtitulo : `${formatMoeda(totalValor)} · ${formatNumero(totalQtde)} un. · ${formatNumero(grade.rowsExibidas.length)} linhas`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => grade.limparFiltrosGrade()}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              title="Limpar filtros da grade"
            >
              Limpar filtros
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Fechar
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden p-5">
          {loading ? (
            <div className="py-16 text-center text-slate-500">Carregando…</div>
          ) : erro ? (
            <div className="py-16 text-center text-red-600 dark:text-red-400">{erro}</div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-slate-500">Sem dados.</div>
          ) : (
            <div className="flex h-full flex-col">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Exibindo {formatNumero(paged.length)} de {formatNumero(grade.rowsExibidas.length)} (filtros no cabeçalho).
                </p>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded-md border border-slate-200 px-2 py-1 text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
                  >
                    Anterior
                  </button>
                  <span className="tabular-nums text-slate-600 dark:text-slate-300">
                    {page}/{totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="rounded-md border border-slate-200 px-2 py-1 text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
                  >
                    Próxima
                  </button>
                </div>
              </div>

              <div ref={grade.tableScrollRef} className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="min-w-[980px] w-full text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-white/90 backdrop-blur dark:bg-slate-900/80">
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      {cols.map((c) => (
                        <th key={c} className="px-2 py-2 align-top">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                              {COL_LABELS[c]}
                            </span>
                            <GradeFiltroCabecalhoBtn
                              ativo={grade.colunaComFiltroAtivo(c)}
                              onClick={(e) => grade.abrirFiltroExcel(c, e)}
                              className="border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                            />
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {paged.map((r, idx) => (
                      <tr key={`${r.pdId}-${r.codigoProduto}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        {cols.map((c) => (
                          <td key={c} className="px-2 py-2">
                            <span className={c === 'valor' || c === 'qtde' ? 'tabular-nums font-medium text-slate-700 dark:text-slate-200' : 'text-slate-700 dark:text-slate-200'}>
                              {cellText(r, c)}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {grade.colunaFiltroAberta && grade.filtroAbertoRect && (
                <GradeFiltroExcelPortal
                  colunaAberta={grade.colunaFiltroAberta}
                  rect={grade.filtroAbertoRect}
                  dropdownRef={grade.filtroDropdownRef}
                  excelFilterDrafts={grade.excelFilterDrafts}
                  setExcelFilterDrafts={grade.setExcelFilterDrafts}
                  valoresUnicosPorColuna={grade.valoresUnicosPorColuna}
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
                  showNumericFilters={grade.colunaFiltroAberta === 'valor' || grade.colunaFiltroAberta === 'qtde'}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

