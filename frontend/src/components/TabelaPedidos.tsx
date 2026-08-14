import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Pedido } from '../api/pedidos';
import ModalHistoricoPedido from './ModalHistoricoPedido';
import { MensagemSemRegistros } from './MensagemSemRegistros';
import { useGradeFiltrosExcel } from '../hooks/useGradeFiltrosExcel';
import GradeFiltroExcelPortal from './grade/GradeFiltroExcelPortal';
import GradeFiltroCabecalhoBtn from './grade/GradeFiltroCabecalhoBtn';
import GradeCelulaModalBtn from './pcp/GradeCelulaModalBtn';
import ModalConsultaEstoqueEmbed from './pcp/ModalConsultaEstoqueEmbed';
import IndicadorDataPorPrevisao from './sequenciamento-carradas/IndicadorDataPorPrevisao';
import { resolverDataProducaoExibicaoGerenciador, maxDataProducaoPedidosNormais, dataProducaoCarradaEmFormacaoApartirDe } from '../utils/dataProducaoGerenciador';
import { LABEL_CARRADA_EM_FORMACAO } from '../utils/rotaCarrada';
import {
  mensagemCanalDatasPedido,
  pedidoElegivelReprogramarGerenciador,
} from '../utils/canalReprogramacaoDatas';
import {
  BADGE_GRADE_CLASS,
  classePillStatusPrazo,
  linhaEstaFaturada,
  statusFlagsPedido,
  statusPrincipalPedido,
} from '../utils/statusPedidoBadges';
import { formatDataCurta } from './sequenciamento-carradas/simulacaoCarradas';

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
  {
    id: 'data_producao',
    label: 'Data de produção',
    getValue: (p) => resolverDataProducaoExibicaoGerenciador(p).dataExibicao,
  },
  { id: 'data_base_entrega_futura', label: 'Data base entrega futura', keys: ['Data base entrega futura'] },
  { id: 'status', label: 'Status', keys: [] },
  { id: 'historico', label: 'Histórico', keys: [] },
];

/** Colunas que entram no subtotal do rodapé (soma dos valores filtrados). */
const SUBTOTAL_COLUMN_IDS = ['valor_pendente_real', 'qtde_pendente_real'];

/** Texto longo: limita altura da linha e mostra completo no tooltip. */
const COLUNAS_TEXTO_LONGO = new Set(['descricao', 'cliente', 'municipio']);

function CelulaDataProducao({
  pedido: p,
  dataProducaoEmFormacao,
}: {
  pedido: Pedido;
  dataProducaoEmFormacao: string;
}) {
  const exib = resolverDataProducaoExibicaoGerenciador(p, dataProducaoEmFormacao);
  const dataFormatada = exib.dataExibicao ? formatDataCurta(exib.dataExibicao) : '—';

  return (
    <div className="flex items-center gap-1.5">
      <span className="tabular-nums text-slate-700 dark:text-slate-200">{dataFormatada}</span>
      {exib.producaoPorPrevisao ? <IndicadorDataPorPrevisao /> : null}
    </div>
  );
}

function CelulaPrevisaoAtual({
  pedido: p,
  dataProducaoEmFormacao,
}: {
  pedido: Pedido;
  dataProducaoEmFormacao: string;
}) {
  const exib = resolverDataProducaoExibicaoGerenciador(p, dataProducaoEmFormacao);
  if (exib.carradaEmFormacao) {
    return (
      <span
        className="font-medium text-amber-700 dark:text-amber-300"
        title="Entrega/previsão não definida — carrada em formação"
      >
        {exib.previsaoExibicaoLabel ?? LABEL_CARRADA_EM_FORMACAO}
      </span>
    );
  }
  const dataFormatada = exib.previsaoAtual ? formatDataCurta(exib.previsaoAtual) : '—';
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
  (c) => (c.keys?.length || c.getValue || c.id === 'status') && c.id !== 'historico'
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
  /** Quando definido, exibe coluna de seleção para Reprogramar (só Requisição é marcável). */
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

function getSortValue(p: Pedido, colId: string, dataProducaoEmFormacao = ''): string | number {
  if (colId === 'previsao_atual' || colId === 'data_producao') {
    const exib = resolverDataProducaoExibicaoGerenciador(p, dataProducaoEmFormacao);
    if (colId === 'previsao_atual') {
      if (exib.carradaEmFormacao || !exib.previsaoAtual) return Number.MAX_SAFE_INTEGER;
      const d = new Date(exib.previsaoAtual);
      return Number.isNaN(d.getTime()) ? Number.MAX_SAFE_INTEGER : d.getTime();
    }
    if (!exib.dataExibicao) return Number.MAX_SAFE_INTEGER;
    const d = new Date(exib.dataExibicao);
    return Number.isNaN(d.getTime()) ? Number.MAX_SAFE_INTEGER : d.getTime();
  }
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

/** Nome do cliente normalizado para agrupar “mesmo cliente” (sem id_cliente no payload). */
function chaveCliente(p: Pedido): string {
  const nome = getField(p, ['Cliente']) || String(p.cliente ?? '');
  return nome.trim().toUpperCase();
}

function chavePd(p: Pedido): string {
  return getField(p, ['PD']).trim().toUpperCase();
}

function indicePedidosPorCliente(rows: Pedido[]): {
  pdsPorCliente: Map<string, Set<string>>;
  linhasPorCliente: Map<string, Pedido[]>;
} {
  const pdsPorCliente = new Map<string, Set<string>>();
  const linhasPorCliente = new Map<string, Pedido[]>();
  for (const p of rows) {
    const ck = chaveCliente(p);
    if (!ck) continue;
    const pd = chavePd(p);
    if (!pdsPorCliente.has(ck)) pdsPorCliente.set(ck, new Set());
    if (pd) pdsPorCliente.get(ck)!.add(pd);
    if (!linhasPorCliente.has(ck)) linhasPorCliente.set(ck, []);
    linhasPorCliente.get(ck)!.push(p);
  }
  return { pdsPorCliente, linhasPorCliente };
}

/** Une linhas filtradas com todos os pedidos dos clientes expandidos (dataset da tela). */
function mesclarLinhasClientesExpandidos(
  base: Pedido[],
  clientesExpandidos: Set<string>,
  linhasPorClienteCompleto: Map<string, Pedido[]>
): Pedido[] {
  if (clientesExpandidos.size === 0) return base;
  const presentIds = new Set(base.map(normIdPedido));
  const result = [...base];
  for (const key of clientesExpandidos) {
    const todas = linhasPorClienteCompleto.get(key) ?? [];
    const faltantes = todas.filter((p) => !presentIds.has(normIdPedido(p)));
    if (faltantes.length === 0) continue;
    let lastIdx = -1;
    for (let i = 0; i < result.length; i++) {
      if (chaveCliente(result[i]) === key) lastIdx = i;
    }
    if (lastIdx >= 0) {
      result.splice(lastIdx + 1, 0, ...faltantes);
    } else {
      result.push(...faltantes);
    }
    for (const p of faltantes) presentIds.add(normIdPedido(p));
  }
  return result;
}

export default function TabelaPedidos({
  pedidos = [],
  loading,
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
  const dataProducaoEmFormacao = useMemo(
    () => dataProducaoCarradaEmFormacaoApartirDe(maxDataProducaoPedidosNormais(lista)),
    [lista]
  );
  const showSelection = Boolean(onSelectionChange);
  const [colunasOcultas, setColunasOcultas] = useState<string[]>(() => loadColunasOcultasPedidos());
  const [colunasOcultasOpen, setColunasOcultasOpen] = useState(false);
  const colunasOcultasRef = useRef<HTMLDivElement>(null);
  const [historicoPedido, setHistoricoPedido] = useState<Pedido | null>(null);
  const [consultaCodigo, setConsultaCodigo] = useState<string | null>(null);
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [clientesExpandidos, setClientesExpandidos] = useState<Set<string>>(() => new Set());

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
      const v = getSortValue(p, colId, dataProducaoEmFormacao);
      if (['qtde_pendente_real', 'valor_pendente_real'].includes(colId)) {
        const n = Number(v);
        return Number.isFinite(n) ? n : NaN;
      }
      return v;
    },
    defaultSortLevels: SORT_LEVELS_DEFAULT,
    persistGradeFilters: true,
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

  const indiceCompleto = useMemo(() => indicePedidosPorCliente(lista), [lista]);
  const indiceFiltrado = useMemo(
    () => indicePedidosPorCliente(grade.rowsExibidas),
    [grade.rowsExibidas]
  );

  const listaExibida = useMemo(
    () =>
      mesclarLinhasClientesExpandidos(
        grade.rowsExibidas,
        clientesExpandidos,
        indiceCompleto.linhasPorCliente
      ),
    [grade.rowsExibidas, clientesExpandidos, indiceCompleto.linhasPorCliente]
  );

  const toggleClienteExpandido = useCallback((clienteKey: string) => {
    setClientesExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(clienteKey)) next.delete(clienteKey);
      else next.add(clienteKey);
      return next;
    });
  }, []);

  const listaPagina = useMemo(() => {
    if (!paginateLocally) return listaExibida;
    const start = (page - 1) * pageSize;
    return listaExibida.slice(start, start + pageSize);
  }, [listaExibida, paginateLocally, page, pageSize]);

  const columnFiltersKey = JSON.stringify(grade.columnFilters);

  useEffect(() => {
    setClientesExpandidos(new Set());
  }, [columnFiltersKey]);

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

  const listaPaginaElegivel = useMemo(
    () =>
      listaPagina.filter((p) =>
        pedidoElegivelReprogramarGerenciador(p as unknown as Record<string, unknown>)
      ),
    [listaPagina]
  );

  const toggleSelectAll = useCallback(() => {
    if (!onSelectionChange || selectedIds == null) return;
    const allSelected =
      listaPaginaElegivel.length > 0 &&
      listaPaginaElegivel.every((p) => selectedIds.has(normIdPedido(p)));
    const next = new Set(selectedIds);
    if (allSelected) {
      listaPaginaElegivel.forEach((p) => next.delete(normIdPedido(p)));
    } else {
      listaPaginaElegivel.forEach((p) => next.add(normIdPedido(p)));
    }
    onSelectionChange(next);
  }, [listaPaginaElegivel, selectedIds, onSelectionChange]);

  const toggleSelectOne = useCallback(
    (p: Pedido) => {
      if (!onSelectionChange || selectedIds == null) return;
      const id = normIdPedido(p);
      if (!pedidoElegivelReprogramarGerenciador(p as unknown as Record<string, unknown>)) return;
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
    const some =
      listaPaginaElegivel.length > 0 &&
      listaPaginaElegivel.some((p) => selectedIds?.has(normIdPedido(p)));
    const all =
      listaPaginaElegivel.length > 0 &&
      listaPaginaElegivel.every((p) => selectedIds?.has(normIdPedido(p)));
    el.indeterminate = some && !all;
  }, [listaPaginaElegivel, selectedIds]);

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
              onClick={() => {
                grade.limparFiltrosGrade();
                onSortLevelsChange?.([...SORT_LEVELS_DEFAULT]);
              }}
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
                <label className="flex cursor-pointer items-center justify-center" title="Seleciona apenas Requisição">
                  <input
                    ref={headerCheckRef}
                    type="checkbox"
                    checked={
                      listaPaginaElegivel.length > 0 &&
                      listaPaginaElegivel.every((p) => selectedIds?.has(normIdPedido(p)))
                    }
                    onChange={toggleSelectAll}
                    disabled={listaPaginaElegivel.length === 0}
                    className="rounded border-white/40 text-primary-200 focus:ring-primary-300 disabled:opacity-40"
                    aria-label="Selecionar todas as requisições visíveis"
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
              {showSelection && (() => {
                const elegivel = pedidoElegivelReprogramarGerenciador(
                  p as unknown as Record<string, unknown>
                );
                const title = elegivel
                  ? `Selecionar pedido ${normIdPedido(p)}`
                  : mensagemCanalDatasPedido(p as unknown as Record<string, unknown>);
                return (
                  <td className="p-3 w-10">
                    <label
                      className={`flex items-center justify-center ${elegivel ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                      title={title}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds?.has(normIdPedido(p)) ?? false}
                        onChange={() => toggleSelectOne(p)}
                        disabled={!elegivel}
                        className="rounded border-slate-300 dark:border-slate-500 text-primary-600 focus:ring-primary-500 disabled:cursor-not-allowed"
                        aria-label={title}
                      />
                    </label>
                  </td>
                );
              })()}
              {colunasVisiveisLista.map((col) => {
                if (col.id === 'status') {
                  const texto = statusPrincipalPedido(p);
                  const cardSinal = String(p.Card ?? '').trim() as '' | 'Card' | 'Disponível';
                  return (
                    <td key={col.id} className="p-3">
                      <div className="flex flex-col items-start gap-1">
                        <span className={`${BADGE_GRADE_CLASS} ${classePillStatusPrazo(texto)}`}>{texto}</span>
                        {cardSinal === 'Card' && (
                          <span className={`${BADGE_GRADE_CLASS} bg-sky-500/20 text-sky-400`}>Card</span>
                        )}
                        {cardSinal === 'Disponível' && (
                          <span className={`${BADGE_GRADE_CLASS} bg-emerald-600/25 text-emerald-300`}>
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
                if (col.id === 'pd') {
                  const numeroPedido = getField(p, col.keys ?? []) || String(p.id_pedido ?? '');
                  const confiavel = p.previsao_atual_confiavel;
                  return (
                    <td key={col.id} className="p-3">
                      <div className="flex flex-col items-start gap-1">
                        <span className="font-medium text-slate-800 dark:text-slate-100">{numeroPedido || '—'}</span>
                        {confiavel === true || confiavel === false ? (
                          <span
                            className={`text-xs font-medium ${
                              confiavel
                                ? 'text-emerald-700 dark:text-emerald-300'
                                : 'text-rose-700 dark:text-rose-300'
                            }`}
                          >
                            {confiavel ? 'Confiável' : 'Não confiável'}
                          </span>
                        ) : null}
                      </div>
                    </td>
                  );
                }
                if (col.id === 'cod') {
                  const codigo = getField(p, col.keys ?? []);
                  return (
                    <td key={col.id} className="p-3 font-mono text-slate-700 dark:text-slate-200">
                      {codigo ? (
                        <GradeCelulaModalBtn
                          onClick={() => setConsultaCodigo(codigo)}
                          title={`Consultar estoque de ${codigo}`}
                          align="left"
                        >
                          {codigo}
                        </GradeCelulaModalBtn>
                      ) : (
                        '—'
                      )}
                    </td>
                  );
                }
                if (col.id === 'cliente') {
                  const nome = getField(p, col.keys ?? []);
                  const ck = chaveCliente(p);
                  const pdsCompletos = indiceCompleto.pdsPorCliente.get(ck) ?? new Set<string>();
                  const pdsFiltrados = indiceFiltrado.pdsPorCliente.get(ck) ?? new Set<string>();
                  const expandido = clientesExpandidos.has(ck);
                  const pdsOcultos = [...pdsCompletos].filter((pd) => !pdsFiltrados.has(pd));
                  const nOcultos = pdsOcultos.length;
                  const mostrarSinal = ck.length > 0 && (expandido || nOcultos > 0);
                  const labelSinal = expandido
                    ? `Recolher · ${pdsCompletos.size} pedido${pdsCompletos.size === 1 ? '' : 's'}`
                    : nOcultos === 1
                      ? '+1 outro pedido'
                      : `+${nOcultos} outros pedidos`;
                  const titleSinal = expandido
                    ? 'Ocultar pedidos extras deste cliente (voltar ao filtro da grade)'
                    : `Outros pedidos no filtro da tela: ${pdsOcultos.join(', ')}. Clique para exibir na grade.`;
                  return (
                    <td key={col.id} className="p-3 max-w-[13rem] text-slate-700 dark:text-slate-200">
                      <div className="flex flex-col items-start gap-1">
                        <span className="line-clamp-2 block break-words leading-snug" title={nome || undefined}>
                          {nome || '—'}
                        </span>
                        {mostrarSinal ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleClienteExpandido(ck);
                            }}
                            className={`${BADGE_GRADE_CLASS} bg-sky-500/20 text-sky-700 hover:bg-sky-500/30 dark:text-sky-300 cursor-pointer`}
                            title={titleSinal}
                            aria-label={labelSinal}
                          >
                            {labelSinal}
                          </button>
                        ) : null}
                      </div>
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
                      <CelulaPrevisaoAtual pedido={p} dataProducaoEmFormacao={dataProducaoEmFormacao} />
                    </td>
                  );
                }
                if (col.id === 'data_producao') {
                  return (
                    <td key={col.id} className="p-3">
                      <CelulaDataProducao pedido={p} dataProducaoEmFormacao={dataProducaoEmFormacao} />
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
    {consultaCodigo ? (
      <ModalConsultaEstoqueEmbed
        codigo={consultaCodigo}
        onClose={() => setConsultaCodigo(null)}
      />
    ) : null}
    </>
  );
}
