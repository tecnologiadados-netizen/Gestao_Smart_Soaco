import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  formatLeadTimeDias,
  formatMoedaDash,
  getCampoPedido,
  getLeadTimeDiasPedido,
  getTipoFPedido,
  getValorPendentePedido,
} from './dashEntregasUtils';

const PAGE_SIZE = 50;

type ColId = 'tipof' | 'pd' | 'cliente' | 'rota' | 'saldo' | 'lead_time';

const COL_LABELS: Record<ColId, string> = {
  tipof: 'TipoF',
  pd: 'PD',
  cliente: 'Cliente',
  rota: 'Rota',
  saldo: 'Saldo Pendente',
  lead_time: 'Lead time',
};

const LAYOUT_COLS: Record<'aging' | 'lead_time' | 'full', ColId[]> = {
  aging: ['tipof', 'pd', 'cliente', 'rota', 'saldo'],
  lead_time: ['tipof', 'pd', 'cliente', 'rota', 'lead_time'],
  /** KPI / concentração: só PD, cliente e saldo (sem Cód., Produto, Rota, Previsão, Status). */
  full: ['pd', 'cliente', 'saldo'],
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
    uf: f.uf,
    vendedor: f.vendedor,
    municipio_entrega: f.municipio_entrega,
    metodo: f.metodo,
    tipo_pedido: f.tipo_pedido,
    requisicao_loja: f.requisicao_loja,
    data_ini: f.data_ini,
    data_fim: f.data_fim,
    faixa_atraso: f.faixa_atraso,
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
  return textoCelula(p, colId as ColId);
}

/** Uma linha da grade = um PD, com o saldo pendente somado dos itens. */
type GrupoPedido = {
  agrupado: true;
  id: string;
  pd: string;
  cliente: string;
  saldo: number;
  itens: Pedido[];
};

type LinhaGrade = Pedido | GrupoPedido;

function isGrupo(row: LinhaGrade): row is GrupoPedido {
  return (row as GrupoPedido).agrupado === true;
}

function codigoItem(p: Pedido): string {
  return getCampoPedido(p, ['Cod', 'cod']);
}

function descricaoItem(p: Pedido): string {
  const desc = getCampoPedido(p, ['Descricao do produto', 'Descrição do produto', 'descricao do produto']);
  if (desc !== '—') return desc;
  const produto = String(p.produto ?? '').trim();
  return produto || '—';
}

function agruparPorPedido(linhas: Pedido[]): GrupoPedido[] {
  const map = new Map<string, { grupo: GrupoPedido; clientes: Set<string> }>();
  for (const p of linhas) {
    const pd = getCampoPedido(p, ['PD', 'pd']);
    const id = pd !== '—' ? `pd:${pd}` : `item:${p.id_pedido}`;
    let atual = map.get(id);
    if (!atual) {
      atual = {
        grupo: { agrupado: true, id, pd, cliente: '—', saldo: 0, itens: [] },
        clientes: new Set<string>(),
      };
      map.set(id, atual);
    }
    atual.grupo.saldo += getValorPendentePedido(p);
    atual.grupo.itens.push(p);
    const cliente = (p.cliente ?? '').trim();
    if (cliente) atual.clientes.add(cliente);
  }
  const grupos: GrupoPedido[] = [];
  for (const { grupo, clientes } of map.values()) {
    grupo.cliente = clientes.size > 0 ? [...clientes].join(' · ') : '—';
    grupo.itens.sort((a, b) => {
      const diff = getValorPendentePedido(b) - getValorPendentePedido(a);
      if (diff !== 0) return diff;
      return codigoItem(a).localeCompare(codigoItem(b), 'pt-BR', { numeric: true });
    });
    grupos.push(grupo);
  }
  return grupos;
}

function textoGrupo(g: GrupoPedido, colId: string): string {
  switch (colId as ColId) {
    case 'pd':
      return g.pd;
    case 'cliente':
      return g.cliente;
    case 'saldo':
      return formatMoedaDash(g.saldo);
    default:
      return '—';
  }
}

function valorOrdenacaoGrupo(g: GrupoPedido, colId: string): string | number {
  if (colId === 'saldo') return g.saldo;
  return textoGrupo(g, colId);
}

function rotuloContagem(n: number, singular: string, plural: string): string {
  return `${n.toLocaleString('pt-BR')} ${n === 1 ? singular : plural}`;
}

export default function ModalDashEntregasDetalhe({ open, filtro, onClose }: Props) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [expandidos, setExpandidos] = useState<Set<string>>(() => new Set());
  const cacheRef = useRef(new Map<string, Pedido[]>());

  const layout = filtro?.gradeLayout ?? 'full';
  const agrupar = layout === 'full';
  const colunas = LAYOUT_COLS[layout];
  const sortColDefault = layout === 'lead_time' ? 'lead_time' : 'saldo';
  const grupos = useMemo(() => (agrupar ? agruparPorPedido(pedidos) : []), [agrupar, pedidos]);

  const getCellText = useCallback((row: LinhaGrade, colId: string) => {
    return isGrupo(row) ? textoGrupo(row, colId) : textoCelula(row, colId);
  }, []);

  const valueForSort = useCallback((row: LinhaGrade, colId: string): string | number => {
    return isGrupo(row) ? valorOrdenacaoGrupo(row, colId) : valorOrdenacao(row, colId);
  }, []);

  const grade = useGradeFiltrosExcel<LinhaGrade>({
    rows: agrupar ? grupos : pedidos,
    columnIds: colunas,
    getCellText,
    valueForSort,
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
      setExpandidos(new Set());
    }
  }, [open]);

  useEffect(() => {
    setExpandidos(new Set());
  }, [cacheKey]);

  const toggleGrupo = useCallback((id: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const rowsPagina = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return grade.rowsExibidas.slice(start, start + PAGE_SIZE);
  }, [grade.rowsExibidas, page]);

  const totalExibidos = grade.rowsExibidas.length;
  const totalPages = Math.max(1, Math.ceil(totalExibidos / PAGE_SIZE));
  const totalValor = useMemo(
    () =>
      grade.rowsExibidas.reduce(
        (s, row) => s + (isGrupo(row) ? row.saldo : getValorPendentePedido(row)),
        0
      ),
    [grade.rowsExibidas]
  );
  const totalItens = useMemo(
    () =>
      agrupar
        ? grade.rowsExibidas.reduce((s, row) => s + (isGrupo(row) ? row.itens.length : 1), 0)
        : grade.rowsExibidas.length,
    [agrupar, grade.rowsExibidas]
  );
  const leadTimeMedioExibido = useMemo(() => {
    const comDias = grade.rowsExibidas
      .filter((row): row is Pedido => !isGrupo(row))
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
              {agrupar
                ? `${rotuloContagem(totalExibidos, 'pedido', 'pedidos')} · ${rotuloContagem(totalItens, 'item', 'itens')}`
                : rotuloContagem(totalExibidos, 'linha', 'linhas')}
              {!loading && totalExibidos > 0 && layout === 'lead_time' && leadTimeMedioExibido !== null
                ? ` · Lead time médio: ${formatLeadTimeDias(leadTimeMedioExibido)}`
                : !loading && totalExibidos > 0 && layout !== 'lead_time'
                  ? ` · Saldo: ${formatMoedaDash(totalValor)}`
                  : ''}
            </p>
            {agrupar && !loading && totalExibidos > 0 && (
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                Clique no pedido para ver código, descrição e saldo de cada item.
              </p>
            )}
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
                {rowsPagina.map((row, i) => {
                  if (isGrupo(row)) {
                    const aberto = expandidos.has(row.id);
                    const qtdItens = row.itens.length;
                    return (
                      <Fragment key={row.id}>
                        <tr
                          className={`cursor-pointer hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-500 dark:hover:bg-slate-800/60 ${
                            aberto ? 'bg-sky-50/80 dark:bg-sky-950/30' : ''
                          }`}
                          onClick={() => toggleGrupo(row.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              toggleGrupo(row.id);
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          aria-expanded={aberto}
                          title="Clique para ver os itens deste pedido"
                        >
                          {colunas.map((colId) => {
                            const align = colId === 'saldo' ? 'text-right tabular-nums font-medium' : '';
                            const truncate = colId === 'cliente' ? 'max-w-[280px] truncate' : '';
                            if (colId === 'pd') {
                              return (
                                <td key={colId} className="px-3 py-2 text-xs">
                                  <span className="inline-flex items-center gap-2">
                                    <svg
                                      viewBox="0 0 16 16"
                                      className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${
                                        aberto ? 'rotate-90 text-sky-600 dark:text-sky-400' : ''
                                      }`}
                                      aria-hidden
                                    >
                                      <path
                                        d="M6 3.5 11 8 6 12.5"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.8"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                    <span className="font-medium text-slate-800 dark:text-slate-100">{row.pd}</span>
                                    <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                                      {rotuloContagem(qtdItens, 'item', 'itens')}
                                    </span>
                                  </span>
                                </td>
                              );
                            }
                            const val = textoGrupo(row, colId);
                            return (
                              <td key={colId} className={`px-3 py-2 text-xs ${align} ${truncate}`} title={val}>
                                {val}
                              </td>
                            );
                          })}
                        </tr>
                        {aberto && (
                          <tr className="bg-slate-50 dark:bg-slate-950/50">
                            <td colSpan={colunas.length} className="px-3 py-2">
                              <table className="w-full border border-slate-200 text-xs dark:border-slate-700">
                                <thead>
                                  <tr className="bg-slate-200/80 text-left text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                    <th className="w-[22%] px-3 py-1.5">Código</th>
                                    <th className="px-3 py-1.5">Descrição</th>
                                    <th className="w-[22%] px-3 py-1.5 text-right">Saldo pendente</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {row.itens.map((item, idx) => {
                                    const codigo = codigoItem(item);
                                    const descricao = descricaoItem(item);
                                    const saldo = formatMoedaDash(getValorPendentePedido(item));
                                    return (
                                      <tr
                                        key={`${item.id_pedido}-${idx}`}
                                        className="border-t border-slate-200 dark:border-slate-700"
                                      >
                                        <td className="px-3 py-1.5 font-medium tabular-nums text-slate-700 dark:text-slate-200">
                                          {codigo}
                                        </td>
                                        <td className="px-3 py-1.5 text-slate-600 dark:text-slate-300" title={descricao}>
                                          {descricao}
                                        </td>
                                        <td className="px-3 py-1.5 text-right font-medium tabular-nums text-slate-800 dark:text-slate-100">
                                          {saldo}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                <tfoot>
                                  <tr className="border-t border-slate-300 bg-slate-100/80 font-semibold dark:border-slate-600 dark:bg-slate-800/80">
                                    <td className="px-3 py-1.5 text-slate-500 dark:text-slate-400" colSpan={2}>
                                      Total do pedido
                                    </td>
                                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-800 dark:text-slate-100">
                                      {formatMoedaDash(row.saldo)}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  }

                  return (
                    <tr key={`${row.id_pedido}-${i}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                      {colunas.map((colId) => {
                        const align = ['saldo', 'lead_time'].includes(colId)
                          ? 'text-right tabular-nums font-medium'
                          : '';
                        const truncate = ['cliente', 'rota', 'tipof'].includes(colId)
                          ? 'max-w-[160px] truncate'
                          : '';
                        const val = textoCelula(row, colId);
                        return (
                          <td key={colId} className={`px-3 py-2 text-xs ${align} ${truncate}`} title={val}>
                            {val}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
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
