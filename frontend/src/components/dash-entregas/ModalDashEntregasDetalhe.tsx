import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  listarPedidosExport,
  type DashEntregasDrillFiltro,
  type FiltrosPedidos,
  type Pedido,
} from '../../api/pedidos';
import GradeFiltroCabecalhoBtn from '../grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../grade/GradeFiltroExcelPortal';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import { useRegisterModalEscape } from '../../contexts/ModalStackContext';
import {
  formatDataPrevisao,
  formatLeadTimeDias,
  formatMoedaDash,
  getCampoPedido,
  getLeadTimeDiasPedido,
  getTipoFPedido,
  getValorPendentePedido,
} from './dashEntregasUtils';

const PAGE_SIZE = 50;

type ColId = 'tipof' | 'pd' | 'cliente' | 'rota' | 'saldo' | 'lead_time' | 'cod' | 'produto' | 'previsao' | 'status';

const COL_LABELS: Record<ColId, string> = {
  tipof: 'TipoF',
  pd: 'PD',
  cliente: 'Cliente',
  rota: 'Rota',
  saldo: 'Saldo Pendente',
  lead_time: 'Lead time',
  cod: 'Cód.',
  produto: 'Produto',
  previsao: 'Previsão',
  status: 'Status',
};

const LAYOUT_COLS: Record<'aging' | 'lead_time' | 'full', ColId[]> = {
  aging: ['tipof', 'pd', 'cliente', 'rota', 'saldo'],
  lead_time: ['tipof', 'pd', 'cliente', 'rota', 'lead_time'],
  full: ['pd', 'cod', 'cliente', 'produto', 'rota', 'previsao', 'status', 'saldo'],
};

type Props = {
  open: boolean;
  filtro: DashEntregasDrillFiltro | null;
  onClose: () => void;
};

function filtrosParaApi(f: DashEntregasDrillFiltro): Omit<FiltrosPedidos, 'page' | 'limit'> {
  return {
    status: f.status,
    observacoes: f.observacoes,
    cliente: f.cliente,
    tipo_f: f.tipo_f,
    grupo_produto: f.grupo_produto,
    subgrupo1: f.subgrupo1,
    subgrupo2: f.subgrupo2,
    setor_producao: f.setor_producao,
    data_ini: f.data_ini,
    data_fim: f.data_fim,
    faixa_atraso: f.faixa_atraso,
    excluir_requisicao: true,
    sort_levels: [{ id: 'valor_pendente_real', dir: 'desc' }],
  };
}

function textoCelula(p: Pedido, colId: string): string {
  switch (colId as ColId) {
    case 'tipof':
      return getTipoFPedido(p);
    case 'pd':
      return getCampoPedido(p, ['PD', 'pd']);
    case 'cliente':
      return p.cliente ?? '—';
    case 'rota':
      return getCampoPedido(p, ['Observacoes', 'Observações']);
    case 'saldo':
      return formatMoedaDash(getValorPendentePedido(p));
    case 'lead_time':
      return formatLeadTimeDias(getLeadTimeDiasPedido(p));
    case 'cod':
      return getCampoPedido(p, ['Cod', 'cod']);
    case 'produto':
      return String(p.produto ?? '—');
    case 'previsao':
      return formatDataPrevisao(String(p.previsao_entrega_atualizada ?? ''));
    case 'status':
      return getCampoPedido(p, ['Status', 'status']);
    default:
      return '—';
  }
}

function valorOrdenacao(p: Pedido, colId: string): string | number {
  if (colId === 'saldo') return getValorPendentePedido(p);
  if (colId === 'lead_time') {
    const dias = getLeadTimeDiasPedido(p);
    return dias ?? Number.MAX_SAFE_INTEGER;
  }
  if (colId === 'previsao') {
    const t = new Date(String(p.previsao_entrega_atualizada ?? '')).getTime();
    return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
  }
  return textoCelula(p, colId as ColId);
}

export default function ModalDashEntregasDetalhe({ open, filtro, onClose }: Props) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const cacheRef = useRef(new Map<string, Pedido[]>());

  const layout = filtro?.gradeLayout ?? 'full';
  const colunas = LAYOUT_COLS[layout];
  const sortColDefault = layout === 'lead_time' ? 'lead_time' : 'saldo';

  const grade = useGradeFiltrosExcel({
    rows: pedidos,
    columnIds: colunas,
    getCellText: textoCelula,
    valueForSort: valorOrdenacao,
    defaultSortLevels: [{ id: sortColDefault, dir: 'desc' }],
  });

  const cacheKey = useMemo(() => (filtro ? JSON.stringify(filtrosParaApi(filtro)) : ''), [filtro]);

  const carregar = useCallback(async () => {
    if (!filtro || !open) return;
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setPedidos(cached);
      setErro(null);
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      const res = await listarPedidosExport(filtrosParaApi(filtro));
      const data = res.data ?? [];
      cacheRef.current.set(cacheKey, data);
      setPedidos(data);
    } catch (e) {
      setPedidos([]);
      setErro(e instanceof Error ? e.message : 'Erro ao carregar pedidos.');
    } finally {
      setLoading(false);
    }
  }, [cacheKey, filtro, open]);

  useEffect(() => {
    if (!open || !filtro) return;
    setPage(1);
    grade.limparFiltrosGrade();
    void carregar();
  }, [carregar, filtro, open]);

  useEffect(() => {
    if (!open) {
      setPedidos([]);
      setErro(null);
      setPage(1);
    }
  }, [open]);

  const rowsPagina = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return grade.rowsExibidas.slice(start, start + PAGE_SIZE);
  }, [grade.rowsExibidas, page]);

  const totalExibidos = grade.rowsExibidas.length;
  const totalPages = Math.max(1, Math.ceil(totalExibidos / PAGE_SIZE));
  const totalValor = useMemo(
    () => grade.rowsExibidas.reduce((s, p) => s + getValorPendentePedido(p), 0),
    [grade.rowsExibidas]
  );
  const leadTimeMedioExibido = useMemo(() => {
    const comDias = grade.rowsExibidas
      .map((p) => getLeadTimeDiasPedido(p))
      .filter((d): d is number => d !== null);
    if (comDias.length === 0) return null;
    return Math.round(comDias.reduce((s, d) => s + d, 0) / comDias.length);
  }, [grade.rowsExibidas]);

  useRegisterModalEscape({
    id: 'dash-entregas-detalhe',
    onClose,
    zIndex: 13000,
    enabled: open,
  });

  if (!open || !filtro) return null;

  const renderCabecalho = (colId: ColId) => (
    <th
      key={colId}
      className="sticky top-0 z-10 border border-primary-500/40 bg-primary-600 px-2 py-2.5 align-middle font-semibold text-white"
    >
      <div className="flex min-w-0 items-start justify-between gap-1">
        <span className="min-w-0 flex-1 whitespace-normal break-words text-[11px] leading-tight">
          {COL_LABELS[colId]}
        </span>
        <GradeFiltroCabecalhoBtn
          ativo={grade.colunaComFiltroAtivo(colId)}
          onClick={(e) => grade.abrirFiltroExcel(colId, e)}
        />
      </div>
    </th>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[13000] flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(90vh,720px)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900"
        role="dialog"
        aria-modal
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-slate-800 dark:text-slate-100">
              {filtro.titulo}
            </h2>
            {filtro.subtitulo && (
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{filtro.subtitulo}</p>
            )}
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {totalExibidos.toLocaleString('pt-BR')} {totalExibidos === 1 ? 'linha' : 'linhas'}
              {!loading && totalExibidos > 0 && layout === 'lead_time' && leadTimeMedioExibido !== null
                ? ` · Lead time médio: ${formatLeadTimeDias(leadTimeMedioExibido)}`
                : !loading && totalExibidos > 0 && layout !== 'lead_time'
                  ? ` · Saldo: ${formatMoedaDash(totalValor)}`
                  : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {grade.temFiltrosOuOrdem && (
              <button
                type="button"
                onClick={grade.limparFiltrosGrade}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Limpar filtros da grade
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Fechar
            </button>
          </div>
        </div>

        <div ref={grade.tableScrollRef} className="min-h-0 flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-500">Carregando pedidos…</div>
          ) : erro ? (
            <div className="px-5 py-10 text-center text-red-600 dark:text-red-400">{erro}</div>
          ) : totalExibidos === 0 ? (
            <div className="px-5 py-10 text-center text-slate-500">Nenhum pedido encontrado para este filtro.</div>
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr>{colunas.map(renderCabecalho)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rowsPagina.map((p, i) => (
                  <tr key={`${p.id_pedido}-${i}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    {colunas.map((colId) => {
                      const align = ['saldo', 'lead_time'].includes(colId)
                        ? 'text-right tabular-nums font-medium'
                        : '';
                      const truncate = ['cliente', 'produto', 'rota', 'tipof'].includes(colId)
                        ? 'max-w-[160px] truncate'
                        : '';
                      const val = textoCelula(p, colId);
                      return (
                        <td key={colId} className={`px-3 py-2 text-xs ${align} ${truncate}`} title={val}>
                          {colId === 'status' ? (
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                val.toLowerCase() === 'atrasado'
                                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              }`}
                            >
                              {val}
                            </span>
                          ) : (
                            val
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 dark:border-slate-700">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Anterior
            </button>
            <span className="text-sm text-slate-500">
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Próxima
            </button>
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
            showNumericFilters={grade.colunaFiltroAberta === 'saldo' || grade.colunaFiltroAberta === 'lead_time'}
          />
        )}
      </div>
    </div>,
    document.body
  );
}
