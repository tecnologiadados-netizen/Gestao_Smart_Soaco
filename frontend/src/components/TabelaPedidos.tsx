import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Pedido } from '../api/pedidos';
import ModalHistoricoPedido from './ModalHistoricoPedido';
import { MensagemSemRegistros } from './MensagemSemRegistros';
import { useGradeFiltrosExcel } from '../hooks/useGradeFiltrosExcel';
import GradeFiltroExcelPortal from './grade/GradeFiltroExcelPortal';
import GradeFiltroCabecalhoBtn from './grade/GradeFiltroCabecalhoBtn';

type SortDir = 'asc' | 'desc';

/** Colunas: ordem com 4 datas (mesma sequência do Excel) entre Saldo a Faturar Real e Status. */
const COLUMNS: Array<{
  id: string;
  label: string;
  keys?: string[];
  getValue?: (p: Pedido) => string | number | unknown;
}> = [
  { id: 'observacoes', label: 'Rota', keys: ['Observacoes', 'Observacoes ', 'Observações'] },
  { id: 'pd', label: 'Pedido', keys: ['PD'] },
  { id: 'cliente', label: 'Cliente', keys: ['Cliente'] },
  { id: 'cod', label: 'Código', keys: ['Cod'] },
  { id: 'descricao', label: 'Descrição do produto', keys: ['Descricao do produto'] },
  { id: 'setor_producao', label: 'Setor de produção', keys: ['Setor de Producao', 'Setor de produção'] },
  { id: 'stauts', label: 'Status (ERP)', keys: ['Stauts', 'Status'] },
  { id: 'uf', label: 'UF', keys: ['UF'] },
  { id: 'municipio', label: 'Município de entrega', keys: ['Municipio de entrega'] },
  { id: 'qtde_pendente_real', label: 'Qtde Pendente Real', keys: ['Qtde Pendente Real'] },
  { id: 'valor_pendente_real', label: 'Saldo a Faturar Real', keys: ['Saldo a Faturar Real', 'Valor Pendente Real'] },
  { id: 'emissao', label: 'Emissão', keys: ['Emissao', 'emissao'] },
  { id: 'data_original', label: 'Data original', keys: ['Data de entrega', 'dataParametro'] },
  { id: 'previsao_anterior', label: 'Previsão anterior', getValue: (p) => {
    if (p.previsao_anterior) return p.previsao_anterior;
    const dataOrig = (p as Record<string, unknown>)['Data de entrega'] ?? (p as Record<string, unknown>).dataParametro;
    return dataOrig ?? p.previsao_entrega;
  }},
  { id: 'previsao_atual', label: 'Previsão atual', getValue: (p) => p.previsao_entrega_atualizada ?? p.previsao_entrega },
  { id: 'data_producao', label: 'Data de produção', keys: ['data_producao'] },
  { id: 'data_base_entrega_futura', label: 'Data base entrega futura', keys: ['Data base entrega futura'] },
  { id: 'status', label: 'Status', keys: [] },
  { id: 'historico', label: 'Histórico', keys: [] },
  { id: 'acao', label: 'Ação', keys: [] },
];

/** Colunas que entram no subtotal do rodapé (soma dos valores filtrados). */
const SUBTOTAL_COLUMN_IDS = ['valor_pendente_real', 'qtde_pendente_real'];

/** Texto longo: limita altura da linha e mostra completo no tooltip. */
const COLUNAS_TEXTO_LONGO = new Set(['descricao', 'cliente', 'municipio']);

/** Mesmo padrão da coluna Status (pill com fundo suave). */
const BADGE_GRADE_CLASS = 'inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap';

const VALOR_FATURADO_EF_KEY = 'Valor Faturado Entrega Futura + IPI do item do Pedido';

function linhaEstaFaturada(p: Pedido): boolean {
  const n = Number(p[VALOR_FATURADO_EF_KEY]);
  return Number.isFinite(n) && n > 0;
}

function statusPrincipalPedido(p: Pedido): string {
  const status = (p['Status'] ?? p['StatusPedido'] ?? p['statusPedido']) as string | undefined;
  const texto = status?.trim() || '—';
  if (texto === '—') return texto;
  return texto === 'Em dia' ? 'No prazo' : texto;
}

/** Badges exibidos na coluna Status — cada uma entra como opção no filtro Excel. */
function statusFlagsPedido(p: Pedido): string[] {
  const flags: string[] = [];
  const principal = statusPrincipalPedido(p);
  if (principal !== '—') flags.push(principal);
  const cardSinal = String(p.Card ?? '').trim();
  if (cardSinal === 'Card') flags.push('Card');
  if (cardSinal === 'Disponível') flags.push('Disponível');
  if (linhaEstaFaturada(p)) flags.push('Faturado');
  return flags.length > 0 ? flags : ['—'];
}

function CelulaPrevisaoAtual({
  dataFormatada,
  pedido: p,
}: {
  dataFormatada: string;
  pedido: Pedido;
}) {
  const naoConfiavel = p.previsao_atual_confiavel === false;

  return (
    <div className="flex flex-col items-start gap-1">
      <span className="tabular-nums text-slate-700 dark:text-slate-200">{dataFormatada}</span>
      {naoConfiavel ? (
        <span
          className={`${BADGE_GRADE_CLASS} bg-red-500/20 text-red-700 dark:text-red-300`}
          title="Previsão provisória: não aparece no histórico da Comunicação Interna"
        >
          Não confiável
        </span>
      ) : null}
    </div>
  );
}

const STORAGE_COL_OCULTAS_PEDIDOS = 'pedidos.colunasOcultas.v1';

/** Colunas com filtro/classificação no cabeçalho (estilo MRP). */
const COLUNAS_COM_FILTRO_GRADE = COLUMNS.filter(
  (c) => (c.keys?.length || c.getValue || c.id === 'status') && !['historico', 'acao'].includes(c.id)
).map((c) => c.id);

function loadColunasOcultasPedidos(): string[] {
  try {
    const s = sessionStorage.getItem(STORAGE_COL_OCULTAS_PEDIDOS);
    if (!s) return [];
    const p = JSON.parse(s) as unknown;
    return Array.isArray(p) ? p.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Formata data sem mudar o dia por causa do fuso (ex.: 25/02 não vira 24/02). */
function formatDate(value: string | Date): string {
  if (value == null) return '-';
  const s = typeof value === 'string' ? value : value.toISOString?.() ?? '';
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR');
}

/** Formata número: inteiro para qtde, 2 decimais para valor. */
function formatNum(colId: string, value: unknown): string {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  if (colId === 'valor_pendente_real') {
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (colId === 'qtde_pendente_real') {
    return Math.round(n).toLocaleString('pt-BR');
  }
  return String(value);
}

interface TabelaPedidosProps {
  /** Conjunto completo retornado pelo filtro da tela (todas as páginas) para filtros do cabeçalho. */
  pedidos: Pedido[];
  loading?: boolean;
  onAjustar?: (pedido: Pedido) => void;
  /** Quando definido, exibe coluna de seleção para reprogramação em lote. */
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  /** Classificação personalizada: níveis (coluna + asc/desc) definidos no popup "Classificar". A grade é ordenada por estes níveis. */
  sortLevels?: { id: string; dir: SortDir }[] | null;
  /** Quando definido, o clique no cabeçalho da coluna atualiza a classificação (primeiro nível) em vez de só estado local. */
  onSortLevelsChange?: (levels: { id: string; dir: SortDir }[]) => void;
  /** Paginação client-side após filtros do cabeçalho. */
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  /** Total de linhas após filtros do cabeçalho (para paginação externa). */
  onExibidosCountChange?: (count: number) => void;
  /** Linhas exibidas na grade (após filtros/ordenação do cabeçalho), para exportação alinhada à tela. */
  onGradeRowsForExport?: (rows: Pedido[]) => void;
  paginateLocally?: boolean;
  /** Quando definido, os botões "Limpar filtros da grade" e "Colunas ocultas" são renderizados
   * neste elemento (ex.: barra de botões da página) em vez de ocupar uma linha acima da grade. */
  toolbarExtrasContainer?: HTMLElement | null;
  /** Quando true, a grade ocupa toda a altura disponível do contêiner pai (até a paginação),
   * em vez do teto fixo de 70vh. Requer pai flex com altura limitada (ex.: Gestão de Pedidos). */
  fillHeight?: boolean;
}

function getField(row: Pedido, keys: string[]): string {
  for (const k of keys) {
    const v = row[k as keyof Pedido];
    if (v != null && String(v).length > 0) return String(v);
  }
  return '';
}

function compareSort(a: string | number | unknown, b: string | number | unknown): number {
  const da = typeof a === 'string' ? new Date(a).getTime() : NaN;
  const db = typeof b === 'string' ? new Date(b).getTime() : NaN;
  if (!Number.isNaN(da) && !Number.isNaN(db)) return da - db;
  const sa = a == null ? '' : String(a);
  const sb = b == null ? '' : String(b);
  return sa.localeCompare(sb, undefined, { numeric: true });
}

const DATE_COLUMN_IDS = ['emissao', 'data_original', 'previsao_anterior', 'previsao_atual', 'data_producao'];

function pedidoTextoCelula(p: Pedido, colId: string): string {
  const col = COLUMNS.find((c) => c.id === colId);
  if (!col) return '—';
  if (colId === 'status') {
    return statusPrincipalPedido(p);
  }
  const raw = col.getValue ? col.getValue(p) : getField(p, col.keys ?? []);
  if (DATE_COLUMN_IDS.includes(colId)) return formatDate(raw as string);
  if (['valor_pendente_real', 'qtde_pendente_real'].includes(colId)) return formatNum(colId, raw);
  return raw == null || String(raw) === '' ? '—' : String(raw);
}

/** Ordem de classificação padrão: 1.Previsão atual (mais antigo→novo), 2.Observações, 3.PD, 4.Descrição. */
export const SORT_LEVELS_DEFAULT: { id: string; dir: SortDir }[] = [
  { id: 'previsao_atual', dir: 'asc' },
  { id: 'observacoes', dir: 'asc' },
  { id: 'pd', dir: 'asc' },
  { id: 'descricao', dir: 'asc' },
];

/** Colunas que podem ser usadas na classificação (todas exceto Histórico e Ação). */
export const COLUMNS_SORTABLE = COLUMNS.filter(
  (c) => (c.keys?.length || c.getValue) && !['historico', 'acao'].includes(c.id)
).map((c) => ({ id: c.id, label: c.label }));

export type SortLevel = { id: string; dir: SortDir };

function getSortValue(p: Pedido, colId: string): string | number {
  const col = COLUMNS.find((c) => c.id === colId);
  if (!col) return '';
  const raw = col.getValue ? col.getValue(p) : getField(p, col.keys ?? []);
  if (raw == null || raw === '') return DATE_COLUMN_IDS.includes(colId) ? Number.MAX_SAFE_INTEGER : '';
  if (DATE_COLUMN_IDS.includes(colId)) {
    const d = typeof raw === 'string' ? new Date(raw) : raw;
    return Number.isNaN((d as Date).getTime()) ? Number.MAX_SAFE_INTEGER : (d as Date).getTime();
  }
  return String(raw);
}

function comparePedidos(a: Pedido, b: Pedido, levels: { id: string; dir: SortDir }[]): number {
  for (const { id, dir } of levels) {
    const va = getSortValue(a, id);
    const vb = getSortValue(b, id);
    let cmp: number;
    if (typeof va === 'number' && typeof vb === 'number') {
      cmp = va - vb;
    } else {
      cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
    }
    if (cmp !== 0) return dir === 'asc' ? cmp : -cmp;
  }
  return 0;
}

function ClockIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function normIdPedido(p: { id_pedido?: string | number }): string {
  const v = p.id_pedido;
  if (v == null) return '';
  return String(v).trim();
}

export default function TabelaPedidos({
  pedidos = [],
  loading,
  onAjustar,
  selectedIds,
  onSelectionChange,
  sortLevels,
  onSortLevelsChange,
  page = 1,
  pageSize = 100,
  onPageChange,
  onExibidosCountChange,
  onGradeRowsForExport,
  paginateLocally = true,
  toolbarExtrasContainer,
  fillHeight = false,
}: TabelaPedidosProps) {
  const lista = Array.isArray(pedidos) ? pedidos : [];
  const showSelection = Boolean(onSelectionChange);
  const [colunasOcultas, setColunasOcultas] = useState<string[]>(() => loadColunasOcultasPedidos());
  const [colunasOcultasOpen, setColunasOcultasOpen] = useState(false);
  const colunasOcultasRef = useRef<HTMLDivElement>(null);
  const [historicoPedido, setHistoricoPedido] = useState<Pedido | null>(null);
  const [historicoOpen, setHistoricoOpen] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_COL_OCULTAS_PEDIDOS, JSON.stringify(colunasOcultas));
    } catch {
      /* ignore */
    }
  }, [colunasOcultas]);

  useEffect(() => {
    if (!colunasOcultasOpen) return;
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (colunasOcultasRef.current && !colunasOcultasRef.current.contains(e.target as Node)) {
        setColunasOcultasOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [colunasOcultasOpen]);

  const idsColunasValidas = useMemo(() => new Set(COLUMNS.map((c) => c.id)), []);

  useEffect(() => {
    const ocultasValidas = colunasOcultas.filter((k) => idsColunasValidas.has(k));
    if (ocultasValidas.length >= COLUMNS.length) ocultasValidas.pop();
    if (ocultasValidas.length !== colunasOcultas.length || ocultasValidas.some((k, i) => k !== colunasOcultas[i])) {
      setColunasOcultas(ocultasValidas);
    }
  }, [idsColunasValidas, colunasOcultas]);

  const colunasVisiveisLista = useMemo(
    () => COLUMNS.filter((c) => !colunasOcultas.includes(c.id)),
    [colunasOcultas]
  );

  const colunasOcultasLista = useMemo(
    () => COLUMNS.filter((c) => colunasOcultas.includes(c.id)),
    [colunasOcultas]
  );

  const getCellText = useCallback((p: Pedido, colId: string) => pedidoTextoCelula(p, colId), []);

  const getCellFilterValues = useCallback((p: Pedido, colId: string) => {
    if (colId === 'status') return statusFlagsPedido(p);
    return null;
  }, []);

  const grade = useGradeFiltrosExcel({
    rows: lista,
    columnIds: COLUNAS_COM_FILTRO_GRADE,
    getCellText,
    getCellFilterValues,
    valueForSort: (p, colId) => {
      const v = getSortValue(p, colId);
      if (['qtde_pendente_real', 'valor_pendente_real'].includes(colId)) {
        const n = Number(v);
        return Number.isFinite(n) ? n : NaN;
      }
      return v;
    },
    defaultSortLevels: SORT_LEVELS_DEFAULT,
  });

  useEffect(() => {
    if (Array.isArray(sortLevels) && sortLevels.length > 0) {
      grade.setSortLevels(sortLevels.map((l) => ({ id: l.id, dir: l.dir })));
      grade.setSortState(null);
    }
  }, [sortLevels, grade.setSortLevels, grade.setSortState]);

  const ocultarColuna = (colId: string) => {
    if (colunasVisiveisLista.length <= 1) return;
    grade.fecharFiltroExcel();
    grade.clearColumnFilter(colId);
    grade.setSortState((prev) => (prev?.key === colId ? null : prev));
    grade.setSortLevels((prev) => prev.filter((l) => l.id !== colId));
    setColunasOcultas((prev) => (prev.includes(colId) ? prev : [...prev, colId]));
  };

  const reexibirColuna = (colId: string) => {
    setColunasOcultas((prev) => prev.filter((k) => k !== colId));
  };

  const reexibirTodasColunas = () => {
    setColunasOcultas([]);
    setColunasOcultasOpen(false);
  };

  const aplicarSortNoFiltro = useCallback(
    (colId: string, dir: SortDir) => {
      const rest = (Array.isArray(sortLevels) && sortLevels.length > 0 ? sortLevels : SORT_LEVELS_DEFAULT).filter(
        (l) => l.id !== colId
      );
      const next = [{ id: colId, dir }, ...rest];
      if (onSortLevelsChange) onSortLevelsChange(next);
      else {
        grade.setSortLevels(next);
        grade.setSortState(null);
      }
      grade.fecharFiltroExcel();
    },
    [sortLevels, onSortLevelsChange, grade]
  );

  const listaExibida = grade.rowsExibidas;

  const listaPagina = useMemo(() => {
    if (!paginateLocally) return listaExibida;
    const start = (page - 1) * pageSize;
    return listaExibida.slice(start, start + pageSize);
  }, [listaExibida, paginateLocally, page, pageSize]);

  const columnFiltersKey = JSON.stringify(grade.columnFilters);

  useEffect(() => {
    onExibidosCountChange?.(listaExibida.length);
  }, [listaExibida.length, onExibidosCountChange]);

  useEffect(() => {
    onGradeRowsForExport?.(listaExibida);
  }, [listaExibida, onGradeRowsForExport]);

  useEffect(() => {
    onPageChange?.(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetar página ao mudar filtros do cabeçalho
  }, [columnFiltersKey]);

  const toggleSelectAll = useCallback(() => {
    if (!onSelectionChange || selectedIds == null) return;
    const allSelected = listaPagina.length > 0 && listaPagina.every((p) => selectedIds.has(normIdPedido(p)));
    const next = new Set(selectedIds);
    if (allSelected) {
      listaPagina.forEach((p) => next.delete(normIdPedido(p)));
    } else {
      listaPagina.forEach((p) => next.add(normIdPedido(p)));
    }
    onSelectionChange(next);
  }, [listaPagina, selectedIds, onSelectionChange]);

  const toggleSelectOne = useCallback(
    (id: string) => {
      if (!onSelectionChange || selectedIds == null) return;
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onSelectionChange(next);
    },
    [selectedIds, onSelectionChange]
  );

  const headerCheckRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const el = headerCheckRef.current;
    if (!el) return;
    const some = listaPagina.length > 0 && listaPagina.some((p) => selectedIds?.has(normIdPedido(p)));
    const all = listaPagina.length > 0 && listaPagina.every((p) => selectedIds?.has(normIdPedido(p)));
    el.indeterminate = some && !all;
  }, [listaPagina, selectedIds]);

  const subtotais = useMemo(() => {
    const out: Record<string, number> = {};
    for (const colId of SUBTOTAL_COLUMN_IDS) {
      out[colId] = 0;
    }
    for (const p of listaExibida) {
      for (const colId of SUBTOTAL_COLUMN_IDS) {
        const col = COLUMNS.find((c) => c.id === colId);
        if (!col) continue;
        const raw = col.getValue ? col.getValue(p) : getField(p, col.keys ?? []);
        const n = typeof raw === 'number' ? raw : Number(raw);
        if (!Number.isNaN(n)) out[colId] += n;
      }
    }
    return out;
  }, [listaExibida]);

  const renderCabecalhoColuna = (col: (typeof COLUMNS)[number]) => {
    const comFiltro = COLUNAS_COM_FILTRO_GRADE.includes(col.id);
    return (
      <th
        key={col.id}
        className={`sticky top-0 z-30 border border-primary-500/40 bg-primary-600 px-2 py-2.5 align-middle font-semibold text-white shadow-[0_1px_0_rgba(0,0,0,0.08)] ${
          col.id === 'historico' ? 'w-10' : ''
        }`}
      >
        <div className="flex min-w-0 items-start justify-between gap-1">
          <span
            className="min-w-0 flex-1 whitespace-normal break-words text-[11px] leading-tight sm:text-xs"
            title={col.label}
          >
            {col.label}
          </span>
          <span className="flex shrink-0 flex-col gap-0.5">
            {comFiltro && (
              <GradeFiltroCabecalhoBtn
                ativo={grade.colunaComFiltroAtivo(col.id)}
                onClick={(e) => grade.abrirFiltroExcel(col.id, e)}
              />
            )}
            <button
              type="button"
              onClick={() => ocultarColuna(col.id)}
              disabled={colunasVisiveisLista.length <= 1}
              className="inline-flex items-center justify-center rounded border border-white/25 px-1 py-0.5 text-white/80 hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              title="Ocultar coluna"
              aria-label={`Ocultar coluna ${col.label}`}
            >
              <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 3l18 18M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58M9.88 5.08A9.77 9.77 0 0112 4c5 0 8.27 4.11 9.54 6.06a1.75 1.75 0 010 1.88 16.2 16.2 0 01-2.1 2.64M6.1 6.1a16.46 16.46 0 00-3.64 3.96 1.75 1.75 0 000 1.88C3.73 13.89 7 18 12 18a9.77 9.77 0 004.17-.94"
                />
              </svg>
            </button>
          </span>
        </div>
      </th>
    );
  };

  const onVerHistorico = useCallback((pedido: Pedido) => {
    setHistoricoPedido(pedido);
    setHistoricoOpen(true);
  }, []);

  const fecharModalHistorico = useCallback(() => {
    setHistoricoOpen(false);
    setHistoricoPedido(null);
  }, []);
  if (loading) {
    return (
      <div className="tabela-pedidos-outer min-w-0 w-full flex-1 flex flex-col overflow-hidden" style={{ width: '100%', minWidth: 0 }}>
        <div
          className={`tabela-pedidos-scroll scrollbar-app block min-w-0 overflow-x-auto overflow-y-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700/50 dark:bg-slate-800/50 ${
            fillHeight ? 'min-h-0 flex-1' : ''
          }`}
          style={{
            width: '100%',
            maxWidth: '100%',
            ...(fillHeight ? {} : { maxHeight: 'min(70vh, calc(100svh - 18rem))' }),
          }}
        >
          <table className="tabela-pedidos-grade w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-600">
                {showSelection && (
                  <th className="p-3 w-10 text-slate-500 dark:text-slate-400 font-medium">
                    <span className="sr-only">Seleção</span>
                  </th>
                )}
                {colunasVisiveisLista.map((col) => renderCabecalhoColuna(col))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={colunasVisiveisLista.length + (showSelection ? 1 : 0)} className="p-8 text-center text-slate-500 dark:text-slate-400">
                  Carregando...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (pedidos.length === 0) {
    return (
      <div className="tabela-pedidos-outer min-w-0 w-full flex-1 flex flex-col overflow-hidden" style={{ width: '100%', minWidth: 0 }}>
        <div className="w-full p-4">
          <MensagemSemRegistros />
        </div>
      </div>
    );
  }

  const mostraOverlayAtualizando = loading && lista.length > 0;
  const colSpanGrade = colunasVisiveisLista.length + (showSelection ? 1 : 0);

  const temExtrasGrade = colunasOcultasLista.length > 0 || grade.temFiltrosOuOrdem;
  const extrasGrade = temExtrasGrade && (
        <div
          className={
            toolbarExtrasContainer
              ? 'flex flex-wrap items-center gap-2'
              : 'mb-2 flex flex-wrap items-center justify-end gap-2'
          }
        >
          {grade.temFiltrosOuOrdem && (
            <button
              type="button"
              onClick={grade.limparFiltrosGrade}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Limpar filtros da grade
            </button>
          )}
          {colunasOcultasLista.length > 0 && (
            <div className="relative" ref={colunasOcultasRef}>
              <button
                type="button"
                onClick={() => setColunasOcultasOpen((o) => !o)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                aria-expanded={colunasOcultasOpen}
                aria-haspopup="true"
              >
                Colunas ocultas
                <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs text-primary-700 dark:bg-primary-900/40 dark:text-primary-200">
                  {colunasOcultasLista.length}
                </span>
              </button>
              {colunasOcultasOpen && (
                <div
                  className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 text-slate-800 shadow-xl dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  role="dialog"
                  aria-label="Reexibir colunas ocultas"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2 dark:border-slate-600">
                    <p className="text-sm font-semibold">Reexibir colunas</p>
                    <button
                      type="button"
                      onClick={reexibirTodasColunas}
                      className="text-xs font-medium text-primary-600 hover:underline dark:text-primary-300"
                    >
                      Reexibir todas
                    </button>
                  </div>
                  <div className="mt-2 max-h-64 overflow-auto scrollbar-app">
                    {colunasOcultasLista.map((col) => (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => reexibirColuna(col.id)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <span className="truncate" title={col.label}>
                          {col.label}
                        </span>
                        <span className="shrink-0 text-xs font-medium text-primary-600 dark:text-primary-300">
                          Reexibir
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
  );

  return (
    <>
    <div className="tabela-pedidos-outer min-w-0 w-full flex-1 flex flex-col overflow-hidden" style={{ width: '100%', minWidth: 0 }}>
      {extrasGrade && (toolbarExtrasContainer ? createPortal(extrasGrade, toolbarExtrasContainer) : extrasGrade)}
      <div
        ref={grade.tableScrollRef}
        className={`tabela-pedidos-scroll scrollbar-app relative block min-w-0 overflow-x-auto overflow-y-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700/50 dark:bg-slate-800/50 ${
          fillHeight ? 'min-h-0 flex-1' : ''
        }`}
        style={{
          width: '100%',
          maxWidth: '100%',
          ...(fillHeight ? {} : { maxHeight: 'min(70vh, calc(100svh - 18rem))' }),
        }}
      >
        {mostraOverlayAtualizando && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-[2px]"
            style={{ animation: 'fadeIn 0.2s ease-out' }}
            aria-live="polite"
            aria-busy="true"
          >
            <div className="flex flex-col items-center gap-2 text-primary-600 dark:text-primary-400">
              <span className="inline-block w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium">Atualizando...</span>
            </div>
          </div>
        )}
        <table className="tabela-pedidos-grade w-full min-w-[800px] text-left text-sm" style={{ width: '100%' }}>
        <thead>
          <tr>
            {showSelection && (
              <th className="sticky top-0 z-30 w-10 border border-primary-500/40 bg-primary-600 p-2 shadow-[0_1px_0_rgba(0,0,0,0.08)]">
                <label className="flex cursor-pointer items-center justify-center">
                  <input
                    ref={headerCheckRef}
                    type="checkbox"
                    checked={
                      listaPagina.length > 0 && listaPagina.every((p) => selectedIds?.has(normIdPedido(p)))
                    }
                    onChange={toggleSelectAll}
                    className="rounded border-white/40 text-primary-200 focus:ring-primary-300"
                    aria-label="Selecionar todos visíveis"
                  />
                </label>
              </th>
            )}
            {colunasVisiveisLista.map(renderCabecalhoColuna)}
          </tr>
        </thead>
        <tbody>
          {listaExibida.length === 0 ? (
            <tr>
              <td colSpan={colSpanGrade} className="p-8 text-center text-slate-500 dark:text-slate-400">
                {grade.temFiltrosOuOrdem
                  ? 'Nenhum pedido corresponde aos filtros aplicados.'
                  : 'Nenhum registro para exibir.'}
              </td>
            </tr>
          ) : (
          listaPagina.map((p) => (
            <tr key={p.id_pedido}>
              {showSelection && (
                <td className="p-3 w-10">
                  <label className="flex items-center justify-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedIds?.has(normIdPedido(p)) ?? false}
                      onChange={() => toggleSelectOne(normIdPedido(p))}
                      className="rounded border-slate-300 dark:border-slate-500 text-primary-600 focus:ring-primary-500"
                      aria-label={`Selecionar pedido ${normIdPedido(p)}`}
                    />
                  </label>
                </td>
              )}
              {colunasVisiveisLista.map((col) => {
                if (col.id === 'status') {
                  const texto = statusPrincipalPedido(p);
                  const atrasado = texto.toLowerCase() === 'atrasado';
                  const cardSinal = String(p.Card ?? '').trim() as '' | 'Card' | 'Disponível';
                  return (
                    <td key={col.id} className="p-3">
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${
                            atrasado ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                          }`}
                        >
                          {texto}
                        </span>
                        {cardSinal === 'Card' && (
                          <span className="inline-flex rounded-full bg-sky-500/20 px-2 py-0.5 text-xs font-medium text-sky-400 whitespace-nowrap">
                            Card
                          </span>
                        )}
                        {cardSinal === 'Disponível' && (
                          <span className="inline-flex rounded-full bg-emerald-600/25 px-2 py-0.5 text-xs font-medium text-emerald-300 whitespace-nowrap">
                            Disponível
                          </span>
                        )}
                        {linhaEstaFaturada(p) && (
                          <span className={`${BADGE_GRADE_CLASS} bg-violet-500/20 text-violet-400`}>
                            Faturado
                          </span>
                        )}
                      </div>
                    </td>
                  );
                }
                if (col.id === 'historico') {
                  return (
                    <td key={col.id} className="p-3">
                      <button
                        type="button"
                        onClick={() => onVerHistorico(p)}
                        className="rounded p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600/50 hover:text-slate-700 dark:hover:text-slate-200 transition"
                        title="Ver histórico de alterações"
                        aria-label="Ver histórico"
                      >
                        <ClockIcon />
                      </button>
                    </td>
                  );
                }
                if (col.id === 'acao') {
                  return (
                    <td key={col.id} className="p-3">
                      {onAjustar ? (
                        <button
                          type="button"
                          onClick={() => onAjustar(p)}
                          className="rounded-lg bg-primary-600/80 hover:bg-primary-600 px-3 py-1.5 text-xs font-medium text-white transition whitespace-nowrap"
                        >
                          Ajustar previsão
                        </button>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  );
                }
                const raw = col.getValue ? col.getValue(p) : getField(p, col.keys ?? []);
                const isDate = DATE_COLUMN_IDS.includes(col.id);
                const isNum = ['valor_pendente_real', 'qtde_pendente_real'].includes(col.id);
                const display = isDate ? formatDate(raw as string) : isNum ? formatNum(col.id, raw) : (raw == null || String(raw) === '' ? '—' : String(raw));
                if (col.id === 'previsao_atual') {
                  return (
                    <td key={col.id} className="p-3">
                      <CelulaPrevisaoAtual dataFormatada={display} pedido={p} />
                    </td>
                  );
                }
                const textoLongo = COLUNAS_TEXTO_LONGO.has(col.id);
                return (
                  <td
                    key={col.id}
                    className={`p-3 text-slate-700 dark:text-slate-200 ${isNum ? 'text-right tabular-nums' : ''} ${textoLongo ? 'max-w-[13rem]' : ''}`}
                  >
                    {textoLongo ? (
                      <span className="line-clamp-2 block break-words leading-snug" title={display}>
                        {display}
                      </span>
                    ) : (
                      display
                    )}
                  </td>
                );
              })}
            </tr>
          ))
          )}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700/60 font-medium">
            {showSelection && <td className="p-3 w-10" />}
            {colunasVisiveisLista.map((col) => {
              if (col.id === 'observacoes') {
                return (
                  <td key={col.id} className="p-3 text-slate-700 dark:text-slate-200">
                    Subtotal
                  </td>
                );
              }
              if (SUBTOTAL_COLUMN_IDS.includes(col.id)) {
                const total = subtotais[col.id] ?? 0;
                const display = formatNum(col.id, total);
                return (
                  <td key={col.id} className="p-3 text-slate-700 dark:text-slate-200 text-right tabular-nums">
                    {display}
                  </td>
                );
              }
              return <td key={col.id} className="p-3" />;
            })}
          </tr>
        </tfoot>
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
            if (onSortLevelsChange) aplicarSortNoFiltro(colId, 'asc');
            else {
              grade.setSortState({ key: colId, direction: 'asc' });
              grade.setSortLevels([]);
              grade.fecharFiltroExcel();
            }
          }}
          onSortDesc={(colId) => {
            if (onSortLevelsChange) aplicarSortNoFiltro(colId, 'desc');
            else {
              grade.setSortState({ key: colId, direction: 'desc' });
              grade.setSortLevels([]);
              grade.fecharFiltroExcel();
            }
          }}
          onAplicar={grade.aplicarFiltroExcel}
          onCancelar={grade.fecharFiltroExcel}
          sortAscLabel={
            ['qtde_pendente_real', 'valor_pendente_real'].includes(grade.colunaFiltroAberta)
              ? 'Menor para Maior'
              : undefined
          }
          sortDescLabel={
            ['qtde_pendente_real', 'valor_pendente_real'].includes(grade.colunaFiltroAberta)
              ? 'Maior para Menor'
              : undefined
          }
          showNumericFilters={['qtde_pendente_real', 'valor_pendente_real'].includes(
            grade.colunaFiltroAberta ?? ''
          )}
        />
      )}
    </div>

    <ModalHistoricoPedido
      pedido={historicoPedido}
      open={historicoOpen}
      onClose={fecharModalHistorico}
    />
    </>
  );
}
