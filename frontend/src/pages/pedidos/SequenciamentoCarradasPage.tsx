import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  atualizarSequenciamentoSnapshot,
  concluirSequenciamentoSnapshot,
  consultarSequenciamentoAoVivo,
  excluirSequenciamentoSnapshot,
  gravarSequenciamentoSnapshot,
  listarSequenciamentoSnapshots,
  obterSequenciamentoSnapshot,
  type SequenciamentoCarradaAgregada,
  type SequenciamentoCarradasPayloadV1,
  type SequenciamentoSimulacao,
  type SequenciamentoSnapshotListItem,
  type SequenciamentoSnapshotStatus,
} from '../../api/sequenciamentoCarradas';
import { ajustarDataProducaoLote, ajustarPrevisao, ajustarPrevisaoLote } from '../../api/pedidos';
import SequenciamentoCarradasDetalheModal from '../../components/sequenciamento-carradas/SequenciamentoCarradasDetalheModal';
import CalendarioProducaoModal from '../../components/sequenciamento-carradas/CalendarioProducaoModal';
import ConfirmacaoSimulacaoModal from '../../components/sequenciamento-carradas/ConfirmacaoSimulacaoModal';
import { useGradeFiltrosExcel, type ExcelFilterDraft } from '../../hooks/useGradeFiltrosExcel';
import GradeFiltroCabecalhoBtn from '../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../components/grade/GradeFiltroExcelPortal';
import GradeCelulaModalBtn from '../../components/pcp/GradeCelulaModalBtn';
import CopiarTextoBtn from '../../components/CopiarTextoBtn';
import {
  formatDateTimeBr,
  formatMoeda,
  formatPercentual,
  classPercentualEmDia,
  garantirEspeciaisNoFim,
  isCarradaOrdemFinal,
  isInserirEmRomaneio,
  ordenarCarradas,
  subtotalCarradas,
  SUBTOTAL_ROW_CLASS,
} from '../../components/sequenciamento-carradas/sequenciamentoCarradasUtils';
import { isCarradaEmFormacao, LABEL_CARRADA_EM_FORMACAO } from '../../utils/rotaCarrada';
import { useDragAutoScroll } from '../../hooks/useDragAutoScroll';
import {
  carradaAlterada,
  carradaKeyDe,
  computarBaselines,
  computarItensDataProducao,
  detectarExcessoQtdeRomaneadaCanon,
  computarPedidosComEntregaAlterada,
  expandirPedidosEntregaComLinhasVivas,
  dataProducaoCarradaEmFormacaoApartirDe,
  formatDataCurta,
  maxDataProducaoCarradasNormais,
  ordenarChavesPorPrioridade,
  indiceBasePrioridadeParaAutopreencher,
  autopreencherPrioridadesSequenciais,
  toISODate,
  valorEfetivo,
  listarCarradasComDatasPassadas,
  listarCarradasSemDatasUnificadas,
  mensagemBloqueioCarradasSemDatasUnificadas,
  mesclarCarradasSemDatasUnificadas,
  atualizarEstadoLinhaCorrigirDatas,
  previsaoAtualDaLinha,
  valorEfetivoItem,
  type CarradaDataInvalida,
  isSimItemKey,
  idPedidoDeSimItemKey,
  linhaCodCarrada,
  linhaCarradaKey,
  isRomaneioComoFormacaoLinha,
  type SimEntry,
} from '../../components/sequenciamento-carradas/simulacaoCarradas';
import {
  DATE_COL_KEYS,
  EDIT_COL_KEYS,
  focusSeqEditInput,
  type EditColKey,
} from '../../components/sequenciamento-carradas/sequenciamentoGradeUi';
import SequenciamentoDateField from '../../components/sequenciamento-carradas/SequenciamentoDateField';
import TogglePrevisaoConfiavel, {
  type PrevisaoConfiavelTri,
} from '../../components/TogglePrevisaoConfiavel';
import { ComoLerBtn } from '../../components/AjudaTelaModal';
import SequenciamentoCarradasAjudaModal from './SequenciamentoCarradasAjudaModal';

const BTN_PRIMARY =
  'inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_SECONDARY =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';

const COL_IDS = [
  'cod',
  'carrada',
  'dataProducao',
  'dataEntrega',
  'confiavel',
  'saldoAFaturar',
  'percentualEmDia',
  'adiantamento',
  'valorAVistaAte10d',
] as const;

const COL_NUMERICAS = new Set(['saldoAFaturar', 'percentualEmDia', 'adiantamento', 'valorAVistaAte10d']);

const COL_LABELS: Record<(typeof COL_IDS)[number], string> = {
  cod: 'Cód',
  carrada: 'Carrada',
  dataProducao: 'Data de produção',
  dataEntrega: 'Data de entrega',
  confiavel: 'Confiável',
  saldoAFaturar: 'Saldo a faturar',
  percentualEmDia: '% Em dia',
  adiantamento: 'Adiantamento',
  valorAVistaAte10d: 'Valor adiantamento + até 10d',
};

const PRIORIDADE_INPUT_CLASS =
  'w-12 rounded-md border border-slate-300 bg-white px-1 py-1 text-center text-xs text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:disabled:bg-slate-800';

const COLUMN_PREFERENCES_STORAGE_KEY = 'sequenciamento-carradas:column-preferences:v2';

const DEFAULT_COLUMN_WIDTHS: Record<(typeof COL_IDS)[number], number> = {
  cod: 64,
  carrada: 160,
  dataProducao: 100,
  dataEntrega: 100,
  confiavel: 112,
  saldoAFaturar: 85,
  percentualEmDia: 65,
  adiantamento: 85,
  valorAVistaAte10d: 100,
};

type ColumnPreferences = {
  visible: Record<(typeof COL_IDS)[number], boolean>;
  widths: Record<(typeof COL_IDS)[number], number>;
};

function loadColumnPreferences(): ColumnPreferences {
  const defaults: ColumnPreferences = {
    visible: Object.fromEntries(COL_IDS.map((id) => [id, true])) as ColumnPreferences['visible'],
    widths: { ...DEFAULT_COLUMN_WIDTHS },
  };
  try {
    const saved = window.localStorage.getItem(COLUMN_PREFERENCES_STORAGE_KEY);
    if (!saved) return defaults;
    const parsed = JSON.parse(saved) as Partial<ColumnPreferences>;
    for (const id of COL_IDS) {
      if (typeof parsed.visible?.[id] === 'boolean') defaults.visible[id] = parsed.visible[id];
      const width = parsed.widths?.[id];
      if (typeof width === 'number' && Number.isFinite(width)) {
        defaults.widths[id] = Math.min(720, Math.max(72, Math.round(width)));
      }
    }
  } catch {
    // Preferências corrompidas não devem impedir a abertura da grade.
  }
  return defaults;
}

type SnapshotVisualizado = {
  id: number | null;
  cod: string;
  createdAt: string;
  usuarioLogin: string;
  carradaCount: number;
  aoVivo: boolean;
  status?: SequenciamentoSnapshotStatus;
  /** Abertura só para leitura (mesmo se o snapshot for rascunho). */
  somenteLeitura?: boolean;
};

function labelStatus(status: SequenciamentoSnapshotStatus): string {
  return status === 'rascunho' ? 'Rascunho' : 'Concluído';
}

function classStatus(status: SequenciamentoSnapshotStatus): string {
  return status === 'rascunho'
    ? 'bg-amber-500/15 text-amber-800 dark:text-amber-200'
    : 'bg-slate-500/15 text-slate-700 dark:text-slate-300';
}

type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function labelStatusComAutosave(status: SequenciamentoSnapshotStatus, autosave: AutosaveStatus): string {
  if (status !== 'rascunho') return labelStatus(status);
  if (autosave === 'saving') return 'Salvando rascunho…';
  if (autosave === 'saved') return 'Rascunho salvo';
  if (autosave === 'error') return 'Erro ao salvar';
  return 'Rascunho';
}

function classStatusComAutosave(status: SequenciamentoSnapshotStatus, autosave: AutosaveStatus): string {
  if (status !== 'rascunho') return classStatus(status);
  if (autosave === 'error') return 'bg-red-500/15 text-red-800 dark:text-red-200';
  if (autosave === 'saving') return 'bg-slate-500/15 text-slate-600 dark:text-slate-300';
  if (autosave === 'saved') return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200';
  return classStatus(status);
}

function aplicarPayload(
  payload: SequenciamentoCarradasPayloadV1
): { carradas: SequenciamentoCarradaAgregada[]; linhas: Record<string, unknown>[] } {
  return {
    carradas: ordenarCarradas(payload.carradas ?? []),
    linhas: payload.linhas ?? [],
  };
}

export default function SequenciamentoCarradasPage() {
  const [mostrarHistorico, setMostrarHistorico] = useState(true);
  const [historicoLista, setHistoricoLista] = useState<SequenciamentoSnapshotListItem[]>([]);
  const [historicoCarregando, setHistoricoCarregando] = useState(false);
  const [historicoErro, setHistoricoErro] = useState<string | null>(null);
  const [historicoVersao, setHistoricoVersao] = useState(0);

  const [snapshotVisualizado, setSnapshotVisualizado] = useState<SnapshotVisualizado | null>(null);
  const [carradas, setCarradas] = useState<SequenciamentoCarradaAgregada[]>([]);
  const [linhasSnapshot, setLinhasSnapshot] = useState<Record<string, unknown>[]>([]);
  /** Estoque congelado no payload (`undefined` no legado = tratar como {}). */
  const [estoquePorCodSnapshot, setEstoquePorCodSnapshot] = useState<Record<string, number>>({});
  const [estoqueCongeladoSnapshot, setEstoqueCongeladoSnapshot] = useState(false);
  const [geradoEmSnapshot, setGeradoEmSnapshot] = useState<string>('');
  const [detalheCarregando, setDetalheCarregando] = useState(false);
  const [detalheErro, setDetalheErro] = useState<string | null>(null);

  const [gravando, setGravando] = useState(false);
  const [consultando, setConsultando] = useState(false);
  const [feedbackGravacao, setFeedbackGravacao] = useState<string | null>(null);

  const [carradaDetalhe, setCarradaDetalhe] = useState<SequenciamentoCarradaAgregada | null>(null);

  // Simulação
  const [sim, setSim] = useState<Map<string, SimEntry>>(new Map());
  const [ordemManual, setOrdemManual] = useState<string[] | null>(null);
  const [prioridades, setPrioridades] = useState<Record<string, number>>({});
  const [seqFiltroAberto, setSeqFiltroAberto] = useState(false);
  const [seqFiltroRect, setSeqFiltroRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const [seqFiltroDrafts, setSeqFiltroDrafts] = useState<Record<string, ExcelFilterDraft>>({});
  const seqFiltroDropdownRef = useRef<HTMLDivElement>(null);
  const ultimaSeqFocadaRef = useRef<string | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after'>('before');
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('idle');
  const [modalAjudaAberto, setModalAjudaAberto] = useState(false);
  const [calendarioAberto, setCalendarioAberto] = useState(false);
  const [confirmacaoAberta, setConfirmacaoAberta] = useState(false);
  const [columnPreferences, setColumnPreferences] = useState<ColumnPreferences>(loadColumnPreferences);
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const columnResizeRef = useRef<{ id: (typeof COL_IDS)[number]; startX: number; startWidth: number } | null>(
    null
  );
  const [corrigirDatasSnapshot, setCorrigirDatasSnapshot] = useState<CarradaDataInvalida[]>([]);
  /** Linhas do ERP no momento de Concluir (inclui pedidos movidos após o gravar). */
  const [linhasAoVivoConfirmacao, setLinhasAoVivoConfirmacao] = useState<Record<string, unknown>[] | null>(
    null
  );
  const [validandoEntrega, setValidandoEntrega] = useState(false);
  const [salvandoConfirmacao, setSalvandoConfirmacao] = useState(false);
  const [erroConfirmacao, setErroConfirmacao] = useState<string | null>(null);
  const [motivoPorId, setMotivoPorId] = useState<Record<string, string>>({});
  const [observacaoPorId, setObservacaoPorId] = useState<Record<string, string>>({});
  const [previsaoConfiavelPorId, setPrevisaoConfiavelPorId] = useState<Record<string, boolean | null>>(
    {}
  );
  const [menuHistorico, setMenuHistorico] = useState<{
    item: SequenciamentoSnapshotListItem;
    top: number;
    left: number;
  } | null>(null);
  const [confirmExcluir, setConfirmExcluir] = useState<SequenciamentoSnapshotListItem | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);
  const menuHistoricoRef = useRef<HTMLDivElement>(null);

  const detalheReqRef = useRef(0);
  const autosavePayloadRef = useRef<() => SequenciamentoSimulacao | null>(() => null);
  const pendingSimulacaoRef = useRef<SequenciamentoSimulacao | null>(null);
  const flushSimulacaoRef = useRef<SequenciamentoSimulacao | null>(null);
  const flushSnapshotIdRef = useRef<number | null>(null);

  const aoVivo = snapshotVisualizado?.aoVivo ?? false;
  const statusSnapshot = snapshotVisualizado?.status;
  const emConsulta = aoVivo;
  const isRascunho = statusSnapshot === 'rascunho';
  /** Datas editáveis apenas em snapshot rascunho aberto para edição. */
  const editavel = isRascunho && !snapshotVisualizado?.somenteLeitura;
  /** Reordenação visual liberada em consulta ao vivo e em rascunho editável. */
  const podeArrastar = emConsulta || editavel;

  const visibleColumns = useMemo(
    () => COL_IDS.filter((id) => columnPreferences.visible[id]),
    [columnPreferences.visible]
  );

  useEffect(() => {
    window.localStorage.setItem(COLUMN_PREFERENCES_STORAGE_KEY, JSON.stringify(columnPreferences));
  }, [columnPreferences]);

  useEffect(() => {
    if (!columnMenuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !columnMenuRef.current?.contains(event.target)) {
        setColumnMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [columnMenuOpen]);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      const resize = columnResizeRef.current;
      if (!resize) return;
      const width = Math.min(720, Math.max(72, resize.startWidth + event.clientX - resize.startX));
      setColumnPreferences((prev) => ({
        ...prev,
        widths: { ...prev.widths, [resize.id]: width },
      }));
    };
    const onMouseUp = () => {
      columnResizeRef.current = null;
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const baseline = useMemo(() => computarBaselines(linhasSnapshot), [linhasSnapshot]);

  const efProducao = useCallback(
    (key: string) => valorEfetivo(sim, baseline, key, 'dataProducao'),
    [sim, baseline]
  );
  const efEntrega = useCallback(
    (key: string) => valorEfetivo(sim, baseline, key, 'dataEntrega'),
    [sim, baseline]
  );
  const confiabilidadeCarrada = useCallback(
    (key: string): boolean | null => {
      const valores = new Set<boolean | 'blank'>();
      for (const row of linhasSnapshot) {
        if (linhaCarradaKey(row) !== key) continue;
        const idPedido = String(row.id_pedido ?? row.idChave ?? '').trim();
        const escolhido = idPedido ? previsaoConfiavelPorId[idPedido] : undefined;
        let valor: boolean | 'blank';
        if (escolhido === true || escolhido === false) {
          valor = escolhido;
        } else if (row.previsao_atual_confiavel === true || row.previsao_atual_confiavel === false) {
          valor = row.previsao_atual_confiavel;
        } else {
          valor = 'blank';
        }
        valores.add(valor);
        if (valores.size > 1) return null;
      }
      if (valores.size !== 1) return null;
      const only = [...valores][0]!;
      return only === 'blank' ? null : only;
    },
    [linhasSnapshot, previsaoConfiavelPorId]
  );
  /**
   * A escolha na grade é uma decisão para a carrada inteira: todos os itens
   * de pedido com a mesma chave recebem o override no rascunho.
   */
  const editarConfiabilidadeCarrada = useCallback(
    (key: string, confiavel: PrevisaoConfiavelTri) => {
      const idsPedido = new Set<string>();
      for (const row of linhasSnapshot) {
        if (linhaCarradaKey(row) !== key) continue;
        const id = String(row.id_pedido ?? row.idChave ?? '').trim();
        if (id) idsPedido.add(id);
      }
      if (idsPedido.size === 0) return;
      setPrevisaoConfiavelPorId((prev) => {
        const next = { ...prev };
        for (const id of idsPedido) {
          if (confiavel === true || confiavel === false) next[id] = confiavel;
          else delete next[id];
        }
        return next;
      });
    },
    [linhasSnapshot]
  );
  const getCellText = useCallback(
    (c: SequenciamentoCarradaAgregada, colId: string): string => {
      const key = carradaKeyDe(c);
      switch (colId) {
        case 'cod':
          return c.cod;
        case 'carrada':
          return c.carrada;
        case 'dataProducao':
          return formatDataCurta(efProducao(key));
        case 'dataEntrega':
          return formatDataCurta(efEntrega(key));
        case 'confiavel': {
          const valor = confiabilidadeCarrada(key);
          return valor === null ? '' : valor ? 'Confiável' : 'Não confiável';
        }
        case 'saldoAFaturar':
          return formatMoeda(c.saldoAFaturar);
        case 'percentualEmDia':
          return formatPercentual(c.percentualEmDia ?? 0);
        case 'adiantamento':
          return formatMoeda(c.adiantamento);
        case 'valorAVistaAte10d':
          return formatMoeda(c.valorAVistaAte10d);
        default:
          return '';
      }
    },
    [efProducao, efEntrega, confiabilidadeCarrada]
  );

  const valueForSort = useCallback(
    (c: SequenciamentoCarradaAgregada, colId: string): string | number => {
      const key = carradaKeyDe(c);
      switch (colId) {
        case 'cod':
          return c.cod;
        case 'carrada':
          return c.carrada;
        case 'dataProducao':
          return efProducao(key) || '9999-12-31';
        case 'dataEntrega':
          return efEntrega(key) || '9999-12-31';
        case 'confiavel': {
          const valor = confiabilidadeCarrada(key);
          return valor === null ? '' : valor ? 'Confiável' : 'Não confiável';
        }
        case 'saldoAFaturar':
          return c.saldoAFaturar;
        case 'percentualEmDia':
          return c.percentualEmDia ?? 0;
        case 'adiantamento':
          return c.adiantamento;
        case 'valorAVistaAte10d':
          return c.valorAVistaAte10d;
        default:
          return '';
      }
    },
    [efProducao, efEntrega, confiabilidadeCarrada]
  );

  const grade = useGradeFiltrosExcel<SequenciamentoCarradaAgregada>({
    rows: carradas,
    columnIds: [...COL_IDS],
    getCellText,
    valueForSort,
    defaultSortLevels: [{ id: 'dataProducao', dir: 'asc' }],
  });

  const carradasFinais = useMemo(() => {
    const base = grade.rowsExibidas;
    let result = base;
    if (ordemManual) {
      const idx = new Map(ordemManual.map((k, i) => [k, i]));
      result = [...base].sort(
        (a, b) => (idx.get(carradaKeyDe(a)) ?? 1e9) - (idx.get(carradaKeyDe(b)) ?? 1e9)
      );
    }
    return garantirEspeciaisNoFim(result);
  }, [grade.rowsExibidas, ordemManual]);
  const carradasNormais = useMemo(
    () => carradasFinais.filter((c) => !isCarradaOrdemFinal(c.carrada)),
    [carradasFinais]
  );

  const linhasCorrigirDatasModal = useMemo(() => {
    if (!confirmacaoAberta || corrigirDatasSnapshot.length === 0) return [];
    return corrigirDatasSnapshot.map((snap) =>
      atualizarEstadoLinhaCorrigirDatas(snap, sim, baseline, linhasSnapshot)
    );
  }, [confirmacaoAberta, corrigirDatasSnapshot, sim, baseline, linhasSnapshot]);

  const abrirCorrigirDatas = useCallback(async () => {
    setErroConfirmacao(null);
    setFeedbackGravacao(null);
    setLinhasAoVivoConfirmacao(null);
    setCorrigirDatasSnapshot([]);
    setValidandoEntrega(true);
    try {
      const semSnap = listarCarradasSemDatasUnificadas(carradasFinais, sim, baseline, carradaKeyDe);

      const live = await consultarSequenciamentoAoVivo();
      if (live.error || !live.data?.payload) {
        setFeedbackGravacao(
          `Não foi possível revalidar a composição no ERP antes de concluir: ${live.error ?? 'resposta inválida.'}`
        );
        return;
      }
      const linhasVivas = live.data.payload.linhas ?? [];
      const carradasVivas = live.data.payload.carradas ?? [];
      const blLive = computarBaselines(linhasVivas);
      const keysSnap = new Set(carradasFinais.map(carradaKeyDe));
      const carradasLiveNoSnap = carradasVivas.filter((c) => keysSnap.has(carradaKeyDe(c)));
      // Só bloqueia pelo vivo se a grade também não tiver datas efetivas (sim/baseline do snapshot).
      const semLive = listarCarradasSemDatasUnificadas(carradasLiveNoSnap, sim, blLive, carradaKeyDe).filter(
        (c) => {
          const faltaProdSnap = !valorEfetivo(sim, baseline, c.key, 'dataProducao');
          const faltaEntSnap = !valorEfetivo(sim, baseline, c.key, 'dataEntrega');
          return faltaProdSnap || faltaEntSnap;
        }
      );
      const semDatas = mesclarCarradasSemDatasUnificadas(semSnap, semLive);
      if (semDatas.length > 0) {
        setFeedbackGravacao(mensagemBloqueioCarradasSemDatasUnificadas(semDatas));
        return;
      }

      setLinhasAoVivoConfirmacao(linhasVivas);

      const invalidas = listarCarradasComDatasPassadas(
        carradasFinais,
        sim,
        baseline,
        carradaKeyDe,
        undefined,
        linhasSnapshot
      );
      // Uma única etapa: datas vencidas (se houver) + motivos no mesmo modal.
      setCorrigirDatasSnapshot(invalidas);
      setConfirmacaoAberta(true);
    } finally {
      setValidandoEntrega(false);
    }
  }, [carradasFinais, sim, baseline, linhasSnapshot]);

  const subtotal = useMemo(() => subtotalCarradas(carradasFinais), [carradasFinais]);

  const dataProducaoEmFormacao = useMemo(
    () =>
      dataProducaoCarradaEmFormacaoApartirDe(
        maxDataProducaoCarradasNormais(linhasSnapshot, sim, baseline)
      ),
    [linhasSnapshot, sim, baseline]
  );

  /** Chaves de carrada Inserir em Romaneio em que todas as linhas são formação (&lt; corte). */
  const keysRomaneioSoFormacao = useMemo(() => {
    const byKey = new Map<string, { total: number; formacao: number }>();
    for (const row of linhasSnapshot) {
      const { carrada } = linhaCodCarrada(row);
      if (!isInserirEmRomaneio(carrada)) continue;
      const key = linhaCarradaKey(row);
      const cur = byKey.get(key) ?? { total: 0, formacao: 0 };
      cur.total += 1;
      if (isRomaneioComoFormacaoLinha(row)) cur.formacao += 1;
      byKey.set(key, cur);
    }
    const out = new Set<string>();
    for (const [key, v] of byKey) {
      if (v.total > 0 && v.formacao === v.total) out.add(key);
    }
    return out;
  }, [linhasSnapshot]);

  const pedidosEntrega = useMemo(() => {
    const base = computarPedidosComEntregaAlterada(linhasSnapshot, sim, baseline);
    if (!linhasAoVivoConfirmacao) return base;
    return expandirPedidosEntregaComLinhasVivas(base, linhasAoVivoConfirmacao, sim, baseline);
  }, [linhasAoVivoConfirmacao, linhasSnapshot, sim, baseline]);
  const itensProducao = useMemo(
    () => computarItensDataProducao(linhasSnapshot, sim, baseline),
    [linhasSnapshot, sim, baseline]
  );
  const excessosQtdeRomaneada = useMemo(
    () => detectarExcessoQtdeRomaneadaCanon(linhasSnapshot),
    [linhasSnapshot]
  );

  const qtdCarradasSomenteProducao = useMemo(() => {
    const carradasComEntrega = new Set(pedidosEntrega.map((p) => p.rota));
    const carradasComProducao = new Set<string>();
    for (const key of sim.keys()) {
      const s = sim.get(key);
      if (!s || s.dataProducao === undefined) continue;
      const base = baseline.get(key)?.dataProducao ?? '';
      if (s.dataProducao !== '' && s.dataProducao !== base) {
        const c = carradas.find((x) => carradaKeyDe(x) === key);
        if (c) carradasComProducao.add(c.carrada);
      }
    }
    let count = 0;
    for (const rota of carradasComProducao) if (!carradasComEntrega.has(rota)) count += 1;
    return count;
  }, [sim, baseline, carradas, pedidosEntrega]);

  const carregarHistorico = useCallback(async () => {
    setHistoricoCarregando(true);
    setHistoricoErro(null);
    const r = await listarSequenciamentoSnapshots(100);
    setHistoricoCarregando(false);
    if (r.error) {
      setHistoricoErro(r.error);
      setHistoricoLista([]);
      return;
    }
    setHistoricoLista(r.data);
  }, []);

  useEffect(() => {
    void carregarHistorico();
  }, [carregarHistorico, historicoVersao]);

  const resetarSimulacao = useCallback(() => {
    setSim(new Map());
    setOrdemManual(null);
    setPrioridades({});
    setMotivoPorId({});
    setObservacaoPorId({});
    setPrevisaoConfiavelPorId({});
    setDragOverKey(null);
    setAutosaveStatus('idle');
    grade.limparFiltrosGrade();
  }, [grade]);

  const flushRascunho = useCallback(async (id: number) => {
    // A função atual é atualizada durante o render; evita gravar o payload
    // pendente anterior quando uma ação pede salvar imediatamente.
    const simulacao = autosavePayloadRef.current() ?? pendingSimulacaoRef.current;
    if (!simulacao) return true;
    setAutosaveStatus('saving');
    const r = await atualizarSequenciamentoSnapshot(id, simulacao);
    setAutosaveStatus(r.ok ? 'saved' : 'error');
    return r.ok;
  }, []);

  /**
   * O detalhe da carrada edita em memória e só chega ao rascunho ao escolher
   * "Salvar e sair". Assim, descartar não corre contra o autosave.
   */
  const salvarConfiabilidadeDetalhe = useCallback(
    async (alteracoes: Record<string, PrevisaoConfiavelTri>) => {
      let mapaApos: Record<string, boolean | null> = {};
      setPrevisaoConfiavelPorId((prev) => {
        const next = { ...prev };
        for (const [id, valor] of Object.entries(alteracoes)) {
          if (valor === true || valor === false) next[id] = valor;
          else delete next[id];
        }
        mapaApos = next;
        return next;
      });

      const id = snapshotVisualizado?.id;
      if (!id || !editavel) return;

      // Flush com o mapa já mesclado, sem depender do debounce/ref anterior.
      const base = autosavePayloadRef.current() ?? pendingSimulacaoRef.current;
      const confiavelKeys = Object.keys(mapaApos).filter(
        (k) => mapaApos[k] === true || mapaApos[k] === false
      );
      const previsaoConfiavel =
        confiavelKeys.length > 0
          ? Object.fromEntries(confiavelKeys.map((k) => [k, mapaApos[k] as boolean]))
          : undefined;
      const simulacao = {
        ...(base ?? { ordem: [], itens: [] }),
        ...(previsaoConfiavel ? { previsaoConfiavel } : {}),
      };
      if (!previsaoConfiavel && base && 'previsaoConfiavel' in base) {
        delete (simulacao as { previsaoConfiavel?: unknown }).previsaoConfiavel;
      }
      pendingSimulacaoRef.current = simulacao;
      flushSimulacaoRef.current = simulacao;
      setAutosaveStatus('saving');
      const r = await atualizarSequenciamentoSnapshot(id, simulacao);
      setAutosaveStatus(r.ok ? 'saved' : 'error');
      if (!r.ok) throw new Error('Não foi possível salvar o rascunho. Tente novamente.');
    },
    [snapshotVisualizado?.id, editavel]
  );

  const fecharVisualizacao = useCallback(async () => {
    const id = snapshotVisualizado?.id;
    if (id && editavel) {
      await flushRascunho(id);
    }
    setMostrarHistorico(true);
    setSnapshotVisualizado(null);
    setCarradas([]);
    setLinhasSnapshot([]);
    setDetalheErro(null);
    setCarradaDetalhe(null);
    setCalendarioAberto(false);
    setConfirmacaoAberta(false);
    resetarSimulacao();
  }, [snapshotVisualizado?.id, editavel, flushRascunho, resetarSimulacao]);

  const abrirComPayload = useCallback(
    (meta: SnapshotVisualizado, payload: SequenciamentoCarradasPayloadV1) => {
      const { carradas: sorted, linhas } = aplicarPayload(payload);
      setSnapshotVisualizado(meta);
      setCarradas(sorted);
      setLinhasSnapshot(linhas);
      const temEstoque =
        payload.estoquePorCod != null &&
        typeof payload.estoquePorCod === 'object' &&
        !Array.isArray(payload.estoquePorCod);
      setEstoqueCongeladoSnapshot(temEstoque);
      if (temEstoque) {
        const map: Record<string, number> = {};
        for (const [cod, saldo] of Object.entries(payload.estoquePorCod!)) {
          const n = Number(saldo);
          if (cod.trim() && Number.isFinite(n)) map[cod] = n > 0 ? n : 0;
        }
        setEstoquePorCodSnapshot(map);
      } else {
        setEstoquePorCodSnapshot({});
      }
      setGeradoEmSnapshot(typeof payload.geradoEm === 'string' ? payload.geradoEm : '');
      setMostrarHistorico(false);
      grade.limparFiltrosGrade();
      // Restaura simulação salva (snapshots v2)
      const simu = payload.simulacao;
      if (simu) {
        const m = new Map<string, SimEntry>();
        if (Array.isArray(simu.itens)) {
          for (const it of simu.itens) {
            if (!it?.chave) continue;
            const entry: SimEntry = {};
            if (it.dataProducao != null) entry.dataProducao = toISODate(it.dataProducao);
            if (it.dataEntrega != null) entry.dataEntrega = toISODate(it.dataEntrega);
            m.set(it.chave, entry);
          }
        }
        setSim(m);
        setOrdemManual(Array.isArray(simu.ordem) && simu.ordem.length > 0 ? simu.ordem : null);
        setPrioridades(
          simu.prioridades && typeof simu.prioridades === 'object' ? { ...simu.prioridades } : {}
        );
        setMotivoPorId(simu.motivos && typeof simu.motivos === 'object' ? { ...simu.motivos } : {});
        setObservacaoPorId(
          simu.observacoes && typeof simu.observacoes === 'object' ? { ...simu.observacoes } : {}
        );
        setPrevisaoConfiavelPorId(
          simu.previsaoConfiavel && typeof simu.previsaoConfiavel === 'object'
            ? { ...simu.previsaoConfiavel }
            : {}
        );
      } else {
        setSim(new Map());
        setOrdemManual(null);
        setPrioridades({});
        setMotivoPorId({});
        setObservacaoPorId({});
        setPrevisaoConfiavelPorId({});
      }
    },
    [grade]
  );

  const abrirSnapshot = useCallback(
    async (id: number, opts?: { somenteLeitura?: boolean }) => {
      const req = ++detalheReqRef.current;
      setDetalheErro(null);
      setDetalheCarregando(true);
      setFeedbackGravacao(null);
      setCarradaDetalhe(null);
      setMenuHistorico(null);
      try {
        const r = await obterSequenciamentoSnapshot(id);
        if (req !== detalheReqRef.current) return;
        if (r.error) {
          setDetalheErro(r.error);
          setFeedbackGravacao(r.error);
          return;
        }
        const data = r.data;
        if (!data?.payload) {
          const msg =
            `Snapshot ${data?.cod ?? id} sem dados legíveis (payload vazio ou inválido). ` +
            'Exclua este rascunho e use Consultar → Gravar para gerar um novo.';
          setDetalheErro(msg);
          setFeedbackGravacao(msg);
          return;
        }
        const somenteLeitura = opts?.somenteLeitura === true || data.status === 'concluido';
        abrirComPayload(
          {
            id: data.id,
            cod: data.cod,
            createdAt: data.createdAt,
            usuarioLogin: data.usuarioLogin,
            carradaCount: data.carradaCount,
            aoVivo: false,
            status: data.status,
            somenteLeitura,
          },
          data.payload
        );
      } catch (e) {
        if (req !== detalheReqRef.current) return;
        const msg = e instanceof Error ? e.message : String(e);
        setDetalheErro(msg);
        setFeedbackGravacao(msg);
      } finally {
        if (req === detalheReqRef.current) setDetalheCarregando(false);
      }
    },
    [abrirComPayload]
  );

  const abrirMenuHistorico = useCallback(
    (item: SequenciamentoSnapshotListItem, el: HTMLElement) => {
      const rect = el.getBoundingClientRect();
      setMenuHistorico({
        item,
        top: rect.bottom + 4,
        left: Math.min(rect.left, window.innerWidth - 200),
      });
    },
    []
  );

  useEffect(() => {
    if (!menuHistorico) return;
    const fechar = (e: MouseEvent) => {
      const t = e.target;
      if (t instanceof Node && menuHistoricoRef.current?.contains(t)) return;
      setMenuHistorico(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuHistorico(null);
    };
    document.addEventListener('mousedown', fechar, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', fechar, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuHistorico]);

  const confirmarExclusaoHistorico = useCallback(async () => {
    if (!confirmExcluir) return;
    setExcluindo(true);
    setErroExclusao(null);
    try {
      const r = await excluirSequenciamentoSnapshot(confirmExcluir.id);
      if (!r.ok) {
        setErroExclusao(r.error ?? 'Não foi possível excluir.');
        return;
      }
      setConfirmExcluir(null);
      setFeedbackGravacao(`Sequência ${confirmExcluir.cod} excluída.`);
      setHistoricoVersao((v) => v + 1);
    } catch (e) {
      setErroExclusao(e instanceof Error ? e.message : String(e));
    } finally {
      setExcluindo(false);
    }
  }, [confirmExcluir]);

  const handleConsultar = useCallback(async () => {
    const req = ++detalheReqRef.current;
    setConsultando(true);
    setDetalheErro(null);
    setFeedbackGravacao(null);
    setCarradaDetalhe(null);
    setDetalheCarregando(true);
    try {
      const r = await consultarSequenciamentoAoVivo();
      if (req !== detalheReqRef.current) return;
      if (r.error) {
        setDetalheErro(r.error);
        return;
      }
      const data = r.data;
      if (!data?.payload) {
        setDetalheErro('Consulta sem dados legíveis.');
        return;
      }
      abrirComPayload(
        {
          id: null,
          cod: 'Consulta ao vivo',
          createdAt: data.geradoEm,
          usuarioLogin: '—',
          carradaCount: data.carradaCount,
          aoVivo: true,
        },
        data.payload
      );
    } catch (e) {
      if (req !== detalheReqRef.current) return;
      setDetalheErro(e instanceof Error ? e.message : String(e));
    } finally {
      if (req === detalheReqRef.current) {
        setDetalheCarregando(false);
        setConsultando(false);
      }
    }
  }, [abrirComPayload]);

  const montarSimulacaoPayload = useCallback((): SequenciamentoSimulacao | null => {
    const itens = [...sim.entries()].map(([chave, v]) => {
      if (isSimItemKey(chave)) {
        const idPedido = idPedidoDeSimItemKey(chave);
        const linha = linhasSnapshot.find(
          (row) => String(row['id_pedido'] ?? row['idChave'] ?? '').trim() === idPedido
        );
        const { cod, carrada } = linha ? linhaCodCarrada(linha) : { cod: '—', carrada: '' };
        return {
          chave,
          cod,
          carrada,
          dataProducao: v.dataProducao ?? null,
          dataEntrega: v.dataEntrega ?? null,
        };
      }
      const c = carradas.find((x) => carradaKeyDe(x) === chave);
      return {
        chave,
        cod: c?.cod ?? '',
        carrada: c?.carrada ?? '',
        dataProducao: v.dataProducao ?? null,
        dataEntrega: v.dataEntrega ?? null,
      };
    });
    const ordem = ordemManual ?? carradasFinais.map(carradaKeyDe);
    const motivosKeys = Object.keys(motivoPorId).filter((k) => motivoPorId[k]?.trim());
    const motivos =
      motivosKeys.length > 0
        ? Object.fromEntries(motivosKeys.map((k) => [k, motivoPorId[k]!]))
        : undefined;
    const observacoesKeys = Object.keys(observacaoPorId).filter((k) => observacaoPorId[k]?.trim());
    const observacoes =
      observacoesKeys.length > 0
        ? Object.fromEntries(observacoesKeys.map((k) => [k, observacaoPorId[k]!.slice(0, 1000)]))
        : undefined;
    const confiavelKeys = Object.keys(previsaoConfiavelPorId).filter(
      (k) => previsaoConfiavelPorId[k] === true || previsaoConfiavelPorId[k] === false
    );
    const previsaoConfiavel =
      confiavelKeys.length > 0
        ? Object.fromEntries(
            confiavelKeys.map((k) => [k, previsaoConfiavelPorId[k] as boolean])
          )
        : undefined;
    const prioridadesFiltradas = Object.fromEntries(
      Object.entries(prioridades).filter(([chave, v]) => {
        if (typeof v !== 'number' || v <= 0) return false;
        const c = carradas.find((x) => carradaKeyDe(x) === chave);
        return c != null && !isCarradaOrdemFinal(c.carrada);
      })
    );
    const temPrioridades = Object.keys(prioridadesFiltradas).length > 0;
    if (
      itens.length === 0 &&
      !ordemManual &&
      !motivos &&
      !observacoes &&
      !previsaoConfiavel &&
      !temPrioridades
    ) {
      return null;
    }
    return {
      ordem,
      itens,
      ...(motivos ? { motivos } : {}),
      ...(observacoes ? { observacoes } : {}),
      ...(previsaoConfiavel ? { previsaoConfiavel } : {}),
      ...(temPrioridades ? { prioridades: prioridadesFiltradas } : {}),
    };
  }, [
    sim,
    carradas,
    ordemManual,
    carradasFinais,
    motivoPorId,
    observacaoPorId,
    previsaoConfiavelPorId,
    prioridades,
    linhasSnapshot,
  ]);

  autosavePayloadRef.current = montarSimulacaoPayload;

  useEffect(() => {
    const payload = montarSimulacaoPayload();
    pendingSimulacaoRef.current = payload;
    flushSimulacaoRef.current = payload;
  }, [montarSimulacaoPayload]);

  const handleGravar = useCallback(async () => {
    setGravando(true);
    setFeedbackGravacao(null);
    try {
      const simulacao = montarSimulacaoPayload();
      const r = await gravarSequenciamentoSnapshot(simulacao);
      if (!r.ok) {
        setFeedbackGravacao(r.error ?? 'Erro ao gravar snapshot.');
        return;
      }
      setFeedbackGravacao(`Snapshot ${r.cod} gravado como rascunho (${r.carradaCount ?? 0} carradas).`);
      setHistoricoVersao((v) => v + 1);
      if (r.id) {
        await abrirSnapshot(r.id);
      }
    } finally {
      setGravando(false);
    }
  }, [montarSimulacaoPayload, abrirSnapshot]);

  const producaoEfetivaDe = useCallback(
    (next: Map<string, SimEntry>, key: string): string => {
      const s = next.get(key);
      if (s && s.dataProducao !== undefined && s.dataProducao !== '') return s.dataProducao;
      if (s && s.dataProducao === '') return '';
      return baseline.get(key)?.dataProducao ?? '';
    },
    [baseline]
  );

  const entregaEfetivaDe = useCallback(
    (next: Map<string, SimEntry>, key: string): string => {
      const s = next.get(key);
      if (s && s.dataEntrega !== undefined && s.dataEntrega !== '') return s.dataEntrega;
      if (s && s.dataEntrega === '') return '';
      return baseline.get(key)?.dataEntrega ?? '';
    },
    [baseline]
  );

  const editarData = useCallback(
    (key: string, campo: 'dataProducao' | 'dataEntrega', value: string) => {
      setSim((prev) => {
        const next = new Map(prev);
        const cur = { ...(next.get(key) ?? {}) } as SimEntry;
        if (campo === 'dataProducao') {
          cur.dataProducao = value;
          next.set(key, cur);
          const entregaAtual = entregaEfetivaDe(next, key);
          if (value && entregaAtual && entregaAtual < value) {
            cur.dataEntrega = value;
            next.set(key, cur);
          }
        } else {
          const producao = producaoEfetivaDe(next, key);
          let entrega = value;
          if (producao && entrega && entrega < producao) entrega = producao;
          cur.dataEntrega = entrega;
          next.set(key, cur);
        }
        return next;
      });
    },
    [producaoEfetivaDe, entregaEfetivaDe]
  );

  const replicarProducaoNaEntrega = useCallback(
    (key: string) => {
      const producao = efProducao(key);
      if (!producao) return;
      editarData(key, 'dataEntrega', producao);
    },
    [efProducao, editarData]
  );

  const replicarProducaoNaEntregaTodas = useCallback(() => {
    for (const c of carradasFinais) {
      if (isCarradaOrdemFinal(c.carrada)) continue;
      const key = carradaKeyDe(c);
      const producao = efProducao(key);
      if (producao) editarData(key, 'dataEntrega', producao);
    }
  }, [carradasFinais, efProducao, editarData]);

  const replicarEntregaNaProducao = useCallback(
    (key: string) => {
      const entrega = efEntrega(key);
      if (!entrega) return;
      editarData(key, 'dataProducao', entrega);
    },
    [efEntrega, editarData]
  );

  const replicarEntregaNaProducaoTodas = useCallback(() => {
    for (const c of carradasFinais) {
      if (isCarradaOrdemFinal(c.carrada)) continue;
      const key = carradaKeyDe(c);
      const entrega = efEntrega(key);
      if (entrega) editarData(key, 'dataProducao', entrega);
    }
  }, [carradasFinais, efEntrega, editarData]);

  const onDragOverContainer = useDragAutoScroll(grade.tableScrollRef, dragKey != null);

  const linhasEditaveis = useMemo(
    () => carradasFinais.filter((c) => editavel && !isCarradaOrdemFinal(c.carrada)),
    [carradasFinais, editavel]
  );

  /** Linhas com input de Seq. (prioridade) — rascunho ou consulta com reordenação. */
  const linhasSeqEditaveis = useMemo(
    () => carradasFinais.filter((c) => podeArrastar && !isCarradaOrdemFinal(c.carrada)),
    [carradasFinais, podeArrastar]
  );

  const handleEditInputKey = useCallback(
    (e: React.KeyboardEvent<HTMLElement>, rowKey: string, colKey: EditColKey) => {
      if (e.key !== 'Tab' && e.key !== 'Enter') return;

      const cols: readonly EditColKey[] = editavel
        ? podeArrastar
          ? EDIT_COL_KEYS
          : DATE_COL_KEYS
        : (['prioridade'] as const);

      if (e.key === 'Tab') {
        e.preventDefault();
        const colIdx = cols.indexOf(colKey);
        if (colIdx < 0) return;
        const nextColIdx = e.shiftKey ? colIdx - 1 : colIdx + 1;
        if (nextColIdx >= 0 && nextColIdx < cols.length) {
          focusSeqEditInput(rowKey, cols[nextColIdx]!);
        }
        return;
      }

      e.preventDefault();
      const keys = (colKey === 'prioridade' ? linhasSeqEditaveis : linhasEditaveis).map(carradaKeyDe);
      const rowIdx = keys.indexOf(rowKey);
      const targetIdx = e.shiftKey ? rowIdx - 1 : rowIdx + 1;
      if (targetIdx < 0 || targetIdx >= keys.length) return;
      focusSeqEditInput(keys[targetIdx]!, colKey);
    },
    [editavel, podeArrastar, linhasEditaveis, linhasSeqEditaveis]
  );

  const aplicarOrdemPorPrioridade = useCallback(
    (dir: 'asc' | 'desc') => {
      const normais = carradasNormais;
      const finais = carradasFinais.filter((c) => isCarradaOrdemFinal(c.carrada));
      const keysNormais = normais.map(carradaKeyDe);
      const ordenadas = ordenarChavesPorPrioridade(keysNormais, prioridades, dir);
      setOrdemManual([...ordenadas, ...finais.map(carradaKeyDe)]);
      grade.setSortState(null);
      grade.setSortLevels([]);
      setSeqFiltroAberto(false);
      setSeqFiltroRect(null);
    },
    [carradasNormais, carradasFinais, prioridades, grade]
  );

  const autopreencherSeqAPartirDaBase = useCallback(() => {
    const keys = linhasSeqEditaveis.map(carradaKeyDe);
    if (keys.length === 0) return;

    let preferredKey: string | null = ultimaSeqFocadaRef.current;
    const active = document.activeElement;
    if (active instanceof HTMLInputElement && active.dataset.colkey === 'prioridade') {
      preferredKey = active.dataset.rowkey ?? preferredKey;
    }

    setPrioridades((prev) => {
      const fromIndex = indiceBasePrioridadeParaAutopreencher(keys, prev, preferredKey);
      if (fromIndex < 0) return prev;
      return autopreencherPrioridadesSequenciais(keys, prev, fromIndex);
    });
    setSeqFiltroAberto(false);
    setSeqFiltroRect(null);
  }, [linhasSeqEditaveis]);

  const abrirFiltroSeq = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setSeqFiltroAberto((prev) => {
      if (prev) {
        setSeqFiltroRect(null);
        return false;
      }
      setSeqFiltroRect({ top: rect.bottom + 4, left: rect.left, width: 288 });
      setSeqFiltroDrafts({ seq: { search: '', selected: [] } });
      return true;
    });
  }, []);

  const fecharFiltroSeq = useCallback(() => {
    setSeqFiltroAberto(false);
    setSeqFiltroRect(null);
  }, []);

  useEffect(() => {
    if (!seqFiltroAberto) return;
    const handle = (e: Event) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (seqFiltroDropdownRef.current && !seqFiltroDropdownRef.current.contains(target)) {
        fecharFiltroSeq();
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [seqFiltroAberto, fecharFiltroSeq]);

  useEffect(() => {
    if (!seqFiltroAberto) return;
    const el = grade.tableScrollRef.current;
    if (!el) return;
    const handle = () => fecharFiltroSeq();
    el.addEventListener('scroll', handle, { passive: true });
    return () => el.removeEventListener('scroll', handle);
  }, [seqFiltroAberto, fecharFiltroSeq, grade.tableScrollRef]);

  const handlePrioridadeChange = useCallback((key: string, raw: string) => {
    setPrioridades((prev) => {
      const next = { ...prev };
      if (!raw.trim()) {
        delete next[key];
        return next;
      }
      const n = Math.floor(Number(raw));
      if (!Number.isFinite(n) || n <= 0) {
        delete next[key];
        return next;
      }
      next[key] = n;
      return next;
    });
  }, []);

  const handleRowDragOver = useCallback(
    (e: React.DragEvent<HTMLTableRowElement>, targetKey: string) => {
      if (!dragKey || dragKey === targetKey) return;
      onDragOverContainer(e);
      const rect = e.currentTarget.getBoundingClientRect();
      const pos = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
      setDragOverKey(targetKey);
      setDropPosition(pos);
    },
    [dragKey, onDragOverContainer]
  );

  // Autosave do rascunho (debounce ~2s).
  const snapshotId = snapshotVisualizado?.id;
  useEffect(() => {
    flushSnapshotIdRef.current = snapshotId ?? null;
  }, [snapshotId]);

  useEffect(() => {
    if (!snapshotId || !editavel) return;
    const timer = window.setTimeout(() => {
      const simulacao = pendingSimulacaoRef.current ?? autosavePayloadRef.current();
      setAutosaveStatus('saving');
      void atualizarSequenciamentoSnapshot(snapshotId, simulacao).then((r) => {
        setAutosaveStatus(r.ok ? 'saved' : 'error');
      });
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [sim, ordemManual, prioridades, motivoPorId, observacaoPorId, previsaoConfiavelPorId, snapshotId, editavel, carradasFinais]);

  // Flush no unmount e beforeunload.
  useEffect(() => {
    if (!snapshotId || !editavel) return;
    const id = snapshotId;
    const flush = () => {
      const simulacao = flushSimulacaoRef.current;
      if (simulacao) void atualizarSequenciamentoSnapshot(id, simulacao, { keepalive: true });
    };
    const onBeforeUnload = () => flush();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      flush();
    };
  }, [snapshotId, editavel]);

  const handleDrop = useCallback(
    (targetKey: string) => {
      if (!dragKey || dragKey === targetKey) {
        setDragKey(null);
        setDragOverKey(null);
        return;
      }
      const normais = carradasNormais;
      const finais = carradasFinais.filter((c) => isCarradaOrdemFinal(c.carrada));
      const keys = normais.map(carradaKeyDe);
      const from = keys.indexOf(dragKey);
      if (from < 0) {
        setDragKey(null);
        setDragOverKey(null);
        return;
      }
      const targetIsEspecial = finais.some((c) => carradaKeyDe(c) === targetKey);
      let to: number;
      if (targetIsEspecial) {
        to = keys.length;
      } else {
        to = keys.indexOf(targetKey);
        if (to < 0) {
          setDragKey(null);
          setDragOverKey(null);
          return;
        }
        if (dropPosition === 'after') to += 1;
        if (from < to) to -= 1;
      }
      const [moved] = keys.splice(from, 1);
      keys.splice(to, 0, moved!);
      setOrdemManual([...keys, ...finais.map(carradaKeyDe)]);
      grade.setSortState(null);
      grade.setSortLevels([]);
      setDragKey(null);
      setDragOverKey(null);
    },
    [dragKey, carradasNormais, carradasFinais, grade, dropPosition]
  );

  const handleConfirmarAplicar = useCallback(
    async (
      motivos: Record<string, string>,
      anexoAssinatura: {
        fileName: string;
        mimeType?: string;
        contentBase64: string;
      } | null
    ) => {
      setSalvandoConfirmacao(true);
      setErroConfirmacao(null);
      try {
        if (excessosQtdeRomaneada.length > 0) {
          const resumo = excessosQtdeRomaneada
            .slice(0, 5)
            .map((c) => {
              const carradas = c.carradas.length > 0 ? ` [${c.carradas.join(', ')}]` : '';
              return `${c.pd || c.canon}${c.codigo ? ` / ${c.codigo}` : ''}: romaneado ${c.somaRomaneada} > pendente ${c.pendente}${carradas}`;
            })
            .join('; ');
          const extra =
            excessosQtdeRomaneada.length > 5
              ? ` (+${excessosQtdeRomaneada.length - 5} outro(s))`
              : '';
          setErroConfirmacao(
            `Não é possível confirmar: quantidade romaneada excede o Pendente do item. Conflitos: ${resumo}${extra}`
          );
          return;
        }
        if (pedidosEntrega.length > 0) {
          const ajustes = pedidosEntrega.map((p) => ({
            id_pedido: p.idPedido,
            previsao_nova: p.previsaoNova,
            motivo: motivos[p.idPedido] ?? '',
            observacao: observacaoPorId[p.idPedido]?.trim()
              ? observacaoPorId[p.idPedido]!.slice(0, 1000)
              : null,
            previsao_confiavel: previsaoConfiavelPorId[p.idPedido] === true,
            previsao_atual: p.previsaoAnterior,
            rota: p.rota,
            apply_rota: true,
          }));
          await ajustarPrevisaoLote(
            ajustes,
            anexoAssinatura ? { anexo_assinatura: anexoAssinatura } : undefined
          );
        }

        // Só Confiável (sem mudança de entrega): o lote rejeita data igual.
        // Usa o endpoint unitário com confirmacao_data para gravar no Gerenciador.
        const idsEntrega = new Set(pedidosEntrega.map((p) => p.idPedido));
        const idsConfiavelSo: Array<{
          idPedido: string;
          confiavel: boolean;
          previsao: string;
          rota: string;
        }> = [];
        for (const [idPedido, valor] of Object.entries(previsaoConfiavelPorId)) {
          if (valor !== true && valor !== false) continue;
          if (idsEntrega.has(idPedido)) continue;
          const row = linhasSnapshot.find(
            (r) => String(r.id_pedido ?? r.idChave ?? '').trim() === idPedido
          );
          if (!row) continue;
          const snap = row.previsao_atual_confiavel;
          if (snap === valor) continue;
          const previsao =
            valorEfetivoItem(sim, row, 'dataEntrega') || previsaoAtualDaLinha(row);
          if (!previsao) continue;
          const { carrada } = linhaCodCarrada(row);
          idsConfiavelSo.push({
            idPedido,
            confiavel: valor,
            previsao,
            rota: carrada,
          });
        }
        if (idsConfiavelSo.length > 0) {
          await Promise.all(
            idsConfiavelSo.map((item) =>
              ajustarPrevisao(item.idPedido, {
                previsao_nova: item.previsao,
                motivo:
                  motivos[item.idPedido]?.trim() ||
                  'Confirmação de previsão confiável (sequenciamento)',
                observacao: observacaoPorId[item.idPedido]?.trim()
                  ? observacaoPorId[item.idPedido]!.slice(0, 1000)
                  : null,
                previsao_confiavel: item.confiavel,
                confirmacao_data: true,
                rota: item.rota || null,
                anexo_assinatura: anexoAssinatura,
              })
            )
          );
        }

        if (itensProducao.length > 0) {
          const rProd = await ajustarDataProducaoLote(itensProducao);
          if (rProd.erros?.length) {
            throw new Error(rProd.erros[0]?.erro ?? 'Erro ao gravar data de produção.');
          }
        }
        const simulacao = montarSimulacaoPayload();
        const partes: string[] = [];
        if (pedidosEntrega.length > 0) partes.push('previsões');
        if (idsConfiavelSo.length > 0) partes.push('previsão confiável');
        if (itensProducao.length > 0) partes.push('datas de produção');
        const resumo =
          partes.length > 0
            ? `${partes.join(' e ')} aplicadas no Gerenciador`
            : 'Alterações aplicadas';
        if (snapshotVisualizado?.id) {
          const r = await concluirSequenciamentoSnapshot(snapshotVisualizado.id, simulacao);
          if (!r.ok) {
            setErroConfirmacao(r.error ?? 'Erro ao concluir snapshot.');
            return;
          }
          setConfirmacaoAberta(false);
          setCorrigirDatasSnapshot([]);
          setLinhasAoVivoConfirmacao(null);
          setFeedbackGravacao(`${resumo} e snapshot concluído.`);
          setHistoricoVersao((v) => v + 1);
          await abrirSnapshot(snapshotVisualizado.id);
          return;
        }
        setConfirmacaoAberta(false);
        setCorrigirDatasSnapshot([]);
        setLinhasAoVivoConfirmacao(null);
        setFeedbackGravacao(`${resumo} com sucesso.`);
        resetarSimulacao();
        await handleConsultar();
      } catch (e) {
        setErroConfirmacao(e instanceof Error ? e.message : String(e));
      } finally {
        setSalvandoConfirmacao(false);
      }
    },
    [
      excessosQtdeRomaneada,
      pedidosEntrega,
      itensProducao,
      observacaoPorId,
      previsaoConfiavelPorId,
      linhasSnapshot,
      sim,
      montarSimulacaoPayload,
      snapshotVisualizado?.id,
      abrirSnapshot,
      resetarSimulacao,
      handleConsultar,
    ]
  );

  const startColumnResize = (event: React.MouseEvent<HTMLButtonElement>, id: (typeof COL_IDS)[number]) => {
    event.preventDefault();
    event.stopPropagation();
    columnResizeRef.current = {
      id,
      startX: event.clientX,
      startWidth: columnPreferences.widths[id],
    };
  };

  const ocultarColuna = (id: (typeof COL_IDS)[number]) => {
    if (visibleColumns.length <= 1) return;
    grade.fecharFiltroExcel();
    grade.clearColumnFilter(id);
    grade.setSortState((prev) => (prev?.key === id ? null : prev));
    grade.setSortLevels((prev) => prev.filter((level) => level.id !== id));
    setColumnPreferences((prev) => ({
      ...prev,
      visible: { ...prev.visible, [id]: false },
    }));
  };

  const reexibirColuna = (id: (typeof COL_IDS)[number]) => {
    setColumnPreferences((prev) => ({
      ...prev,
      visible: { ...prev.visible, [id]: true },
    }));
  };

  const reexibirTodasColunas = () => {
    setColumnPreferences((prev) => ({
      ...prev,
      visible: Object.fromEntries(COL_IDS.map((id) => [id, true])) as ColumnPreferences['visible'],
    }));
    setColumnMenuOpen(false);
  };

  const hiddenColumns = COL_IDS.filter((id) => !columnPreferences.visible[id]);

  const renderTh = (colId: (typeof COL_IDS)[number]) => {
    const numerica = COL_NUMERICAS.has(colId);
    const labelClass =
      colId === 'valorAVistaAte10d'
        ? 'max-w-[6rem] whitespace-normal break-words text-[10px] leading-tight'
        : 'whitespace-normal break-words text-[11px] leading-tight sm:text-xs';
    return (
      <th
        key={colId}
        style={{ width: columnPreferences.widths[colId], minWidth: columnPreferences.widths[colId] }}
        className="sticky top-0 z-20 border border-primary-500/40 bg-primary-600 px-2 py-2.5 align-middle font-semibold text-white shadow-[0_1px_0_rgba(0,0,0,0.08)]"
      >
        <div className={`flex items-center gap-1 ${numerica ? 'justify-end' : 'justify-between'}`}>
          <span className={labelClass}>{COL_LABELS[colId]}</span>
          <span className="flex shrink-0 flex-col gap-0.5">
            <GradeFiltroCabecalhoBtn
              ativo={grade.colunaComFiltroAtivo(colId)}
              onClick={(e) => grade.abrirFiltroExcel(colId, e)}
            />
            <button
              type="button"
              onClick={() => ocultarColuna(colId)}
              disabled={visibleColumns.length <= 1}
              className="inline-flex items-center justify-center rounded border border-white/25 px-1 py-0.5 text-white/80 hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              title="Ocultar coluna"
              aria-label={`Ocultar coluna ${COL_LABELS[colId]}`}
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
        <button
          type="button"
          className="absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none bg-transparent hover:bg-white/50"
          onMouseDown={(event) => startColumnResize(event, colId)}
          aria-label={`Redimensionar coluna ${COL_LABELS[colId]}`}
          title="Arraste para ajustar a largura"
        />
      </th>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-start gap-2">
          <div>
            <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Sequenciamento carradas</h1>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {mostrarHistorico ? (
                'Histórico de snapshots gravados do Gerenciador de Pedidos.'
              ) : snapshotVisualizado ? (
                snapshotVisualizado.aoVivo ? (
                  <>
                    <span className="font-medium text-primary-600 dark:text-primary-400">Em consulta</span> ·{' '}
                    {formatDateTimeBr(snapshotVisualizado.createdAt)} · {snapshotVisualizado.carradaCount} carradas
                  </>
                ) : (
                  <>
                    <span className="font-medium">Snapshot {snapshotVisualizado.cod}</span>
                    {snapshotVisualizado.status && (
                      <>
                        {' '}
                        ·{' '}
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${classStatusComAutosave(snapshotVisualizado.status, autosaveStatus)}`}
                          role={isRascunho && autosaveStatus !== 'idle' ? 'status' : undefined}
                        >
                          {labelStatusComAutosave(snapshotVisualizado.status, autosaveStatus)}
                        </span>
                      </>
                    )}
                    {' '}
                    · {formatDateTimeBr(snapshotVisualizado.createdAt)} · {snapshotVisualizado.usuarioLogin} ·{' '}
                    {snapshotVisualizado.carradaCount} carradas
                  </>
                )
              ) : (
                'Visualização do snapshot.'
              )}
            </p>
          </div>
          <ComoLerBtn
            onClick={() => setModalAjudaAberto(true)}
            title="Como ler o Sequenciamento — modos, datas, calendário e materiais"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!mostrarHistorico && (
            <>
              {(grade.temFiltrosOuOrdem || ordemManual) && (
                <button
                  type="button"
                  onClick={() => {
                    grade.limparFiltrosGrade();
                    setOrdemManual(null);
                    setSeqFiltroAberto(false);
                    setSeqFiltroRect(null);
                  }}
                  className={BTN_SECONDARY}
                >
                  Limpar filtros/ordem
                </button>
              )}
              {hiddenColumns.length > 0 && (
                <div className="relative" ref={columnMenuRef}>
                  <button
                    type="button"
                    onClick={() => setColumnMenuOpen((open) => !open)}
                    className={BTN_SECONDARY}
                    aria-expanded={columnMenuOpen}
                    aria-haspopup="dialog"
                  >
                    Colunas ocultas
                    <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs text-primary-700 dark:bg-primary-900/40 dark:text-primary-200">
                      {hiddenColumns.length}
                    </span>
                  </button>
                  {columnMenuOpen && (
                    <div
                      role="dialog"
                      aria-label="Reexibir colunas ocultas"
                      className="absolute right-0 z-40 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-600 dark:bg-slate-800"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2 dark:border-slate-600">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Reexibir colunas</p>
                        <button
                          type="button"
                          onClick={reexibirTodasColunas}
                          className="text-xs font-medium text-primary-600 hover:underline dark:text-primary-300"
                        >
                          Reexibir todas
                        </button>
                      </div>
                      <div className="mt-2 max-h-64 overflow-auto">
                        {hiddenColumns.map((id) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => reexibirColuna(id)}
                            className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            <span>{COL_LABELS[id]}</span>
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
              <button type="button" onClick={() => void fecharVisualizacao()} className={BTN_SECONDARY}>
                ← Voltar ao histórico
              </button>
              <button
                type="button"
                onClick={() => setCalendarioAberto(true)}
                disabled={carradas.length === 0}
                className={BTN_SECONDARY}
              >
                Calendário de produção
              </button>
              {emConsulta && (
                <button
                  type="button"
                  onClick={() => void handleGravar()}
                  disabled={gravando || consultando}
                  className={BTN_PRIMARY}
                >
                  {gravando ? 'Gravando...' : 'Gravar'}
                </button>
              )}
              {editavel && (
                <button
                  type="button"
                  onClick={() => void abrirCorrigirDatas()}
                  disabled={gravando || validandoEntrega}
                  className={BTN_PRIMARY}
                >
                  {validandoEntrega ? 'Validando...' : 'Concluir'}
                </button>
              )}
            </>
          )}
          {mostrarHistorico && (
            <button
              type="button"
              onClick={() => void handleConsultar()}
              disabled={consultando}
              className={BTN_PRIMARY}
            >
              {consultando ? 'Consultando...' : 'Consultar'}
            </button>
          )}
        </div>
      </div>

      {feedbackGravacao && (
        <p
          className={`text-sm shrink-0 ${feedbackGravacao.includes('sucesso') ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}
          role="status"
        >
          {feedbackGravacao}
        </p>
      )}

      {mostrarHistorico ? (
        <div className="relative flex-1 min-h-0 card-panel overflow-auto p-4 shadow-sm">
          {historicoCarregando && (
            <p className="text-sm text-slate-500 dark:text-slate-400">Carregando histórico...</p>
          )}
          {detalheCarregando && !historicoCarregando && (
            <p className="text-sm text-slate-500 dark:text-slate-400">Abrindo snapshot...</p>
          )}
          {historicoErro && !historicoCarregando && (
            <p className="text-sm text-red-600 dark:text-red-300" role="alert">
              {historicoErro}
            </p>
          )}
          {detalheErro && !detalheCarregando && (
            <p className="mb-3 text-sm text-red-600 dark:text-red-300" role="alert">
              {detalheErro}
            </p>
          )}
          {!historicoCarregando && !historicoErro && historicoLista.length === 0 && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Nenhum snapshot gravado ainda. Use <span className="font-medium">Consultar</span> para
              visualizar ao vivo; após simular, use <span className="font-medium">Gravar</span> na tela de
              consulta para registrar.
            </p>
          )}
          {!historicoCarregando && historicoLista.length > 0 && (
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/50">
                  <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-200">Cód</th>
                  <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-200">Status</th>
                  <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-200">Criado por</th>
                  <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-200">Data de criação</th>
                  <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-200 text-center">Carradas</th>
                </tr>
              </thead>
              <tbody>
                {historicoLista.map((h) => (
                  <tr
                    key={h.id}
                    className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    <td className="py-2 px-2 font-mono text-slate-800 dark:text-slate-200">
                      <button
                        type="button"
                        className="rounded px-1 py-0.5 font-mono text-primary-700 hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-primary-900/30"
                        title="Abrir opções da sequência"
                        aria-haspopup="menu"
                        aria-expanded={menuHistorico?.item.id === h.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          abrirMenuHistorico(h, e.currentTarget);
                        }}
                      >
                        {h.cod}
                      </button>
                    </td>
                    <td className="py-2 px-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${classStatus(h.status)}`}
                      >
                        {labelStatus(h.status)}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-slate-800 dark:text-slate-200">{h.usuarioLogin}</td>
                    <td className="py-2 px-2 whitespace-nowrap text-slate-800 dark:text-slate-200">
                      {formatDateTimeBr(h.createdAt)}
                    </td>
                    <td className="py-2 px-2 text-center tabular-nums text-slate-800 dark:text-slate-200">
                      {h.carradaCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col card-panel shadow-sm">
          <div
            ref={grade.tableScrollRef}
            className="min-h-0 flex-1 overflow-auto overscroll-contain px-4 pb-4"
            onDragOver={podeArrastar ? onDragOverContainer : undefined}
          >
            {detalheCarregando && <p className="text-sm text-slate-500 dark:text-slate-400">Carregando...</p>}
            {detalheErro && !detalheCarregando && (
              <p className="text-sm text-red-600 dark:text-red-300" role="alert">
                {detalheErro}
              </p>
            )}
            {!detalheCarregando && !detalheErro && (
              <table className="w-full table-fixed border-separate border-spacing-0 text-left text-sm">
                <thead className="sticky top-0 z-10">
                  <tr>
                    {podeArrastar && (
                      <th className="sticky top-0 z-20 w-14 border border-primary-500/40 bg-primary-600 px-1 py-2.5 text-center text-white shadow-[0_1px_0_rgba(0,0,0,0.08)]">
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="flex items-center justify-center gap-0.5">
                            <span className="text-[10px] font-semibold leading-tight">Seq.</span>
                            <GradeFiltroCabecalhoBtn
                              ativo={seqFiltroAberto}
                              onClick={abrirFiltroSeq}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={autopreencherSeqAPartirDaBase}
                            className="rounded px-1 py-0.5 text-[10px] font-medium text-white hover:bg-primary-500/50"
                            title="Autopreencher Seq. abaixo com +1 a partir da linha base (célula focada ou primeira preenchida)"
                            aria-label="Autopreencher sequência com +1"
                          >
                            ↓+1
                          </button>
                        </div>
                      </th>
                    )}
                    {podeArrastar && (
                      <th className="sticky top-0 z-20 w-8 border border-primary-500/40 bg-primary-600 px-1 py-2.5 shadow-[0_1px_0_rgba(0,0,0,0.08)]" />
                    )}
                    {visibleColumns.includes('cod') && renderTh('cod')}
                    {visibleColumns.includes('carrada') && renderTh('carrada')}
                    {visibleColumns.includes('dataProducao') && renderTh('dataProducao')}
                    {editavel && (
                      <th className="sticky top-0 z-20 w-12 border border-primary-500/40 bg-primary-600 px-0.5 py-2.5 shadow-[0_1px_0_rgba(0,0,0,0.08)]">
                        <div className="flex flex-col items-center gap-0.5">
                          <button
                            type="button"
                            onClick={replicarProducaoNaEntregaTodas}
                            className="rounded px-1 py-0.5 text-xs font-medium text-white hover:bg-primary-500/50"
                            title="Replicar data de produção para entrega em todas as carradas"
                            aria-label="Replicar data de produção para entrega em todas as carradas"
                          >
                            →
                          </button>
                          <button
                            type="button"
                            onClick={replicarEntregaNaProducaoTodas}
                            className="rounded px-1 py-0.5 text-xs font-medium text-white hover:bg-primary-500/50"
                            title="Replicar data de entrega para produção em todas as carradas"
                            aria-label="Replicar data de entrega para produção em todas as carradas"
                          >
                            ←
                          </button>
                        </div>
                      </th>
                    )}
                    {visibleColumns.includes('dataEntrega') && renderTh('dataEntrega')}
                    {visibleColumns.includes('confiavel') && renderTh('confiavel')}
                    {visibleColumns.includes('saldoAFaturar') && renderTh('saldoAFaturar')}
                    {visibleColumns.includes('percentualEmDia') && renderTh('percentualEmDia')}
                    {visibleColumns.includes('adiantamento') && renderTh('adiantamento')}
                    {visibleColumns.includes('valorAVistaAte10d') && renderTh('valorAVistaAte10d')}
                  </tr>
                </thead>
                <tbody>
                  {carradasFinais.length === 0 ? (
                    <tr>
                      <td
                        colSpan={
                          visibleColumns.length + (podeArrastar ? 2 : 0) + (editavel ? 1 : 0)
                        }
                        className="py-4 text-center text-slate-500 dark:text-slate-400"
                      >
                        Nenhuma carrada.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {carradasFinais.map((c) => {
                        const key = carradaKeyDe(c);
                        const alterada = carradaAlterada(sim, baseline, key);
                        const carradaEspecial = isCarradaOrdemFinal(c.carrada);
                        const carradaEmFormacao =
                          isCarradaEmFormacao(c.carrada) || keysRomaneioSoFormacao.has(key);
                        const dropBefore = dragOverKey === key && dropPosition === 'before';
                        const dropAfter = dragOverKey === key && dropPosition === 'after';
                        return (
                          <tr
                            key={key}
                            onDragOver={podeArrastar ? (e) => handleRowDragOver(e, key) : undefined}
                            onDrop={podeArrastar ? () => handleDrop(key) : undefined}
                            className={`relative border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 ${
                              alterada ? 'bg-amber-50 dark:bg-amber-900/10' : ''
                            } ${dragKey === key ? 'opacity-50' : ''} ${
                              dropBefore ? 'shadow-[inset_0_2px_0_0] shadow-primary-500' : ''
                            } ${dropAfter ? 'shadow-[inset_0_-2px_0_0] shadow-primary-500' : ''}`}
                          >
                            {podeArrastar && (
                              <td className="w-12 px-1 py-2 text-center align-middle">
                                {carradaEspecial ? (
                                  <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                                ) : (
                                  <input
                                    type="number"
                                    min={1}
                                    step={1}
                                    className={PRIORIDADE_INPUT_CLASS}
                                    value={prioridades[key] ?? ''}
                                    onChange={(e) => handlePrioridadeChange(key, e.target.value)}
                                    data-editinput
                                    data-rowkey={key}
                                    data-colkey="prioridade"
                                    onKeyDown={(e) => {
                                      e.stopPropagation();
                                      handleEditInputKey(e, key, 'prioridade');
                                    }}
                                    onFocus={() => {
                                      ultimaSeqFocadaRef.current = key;
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    title="Prioridade. Foque a linha base e use ↓+1 para autopreencher abaixo."
                                    aria-label={`Prioridade da carrada ${c.cod}`}
                                  />
                                )}
                              </td>
                            )}
                            {podeArrastar && (
                              <td
                                className={`w-8 px-1 text-center align-middle ${
                                  carradaEspecial
                                    ? 'text-slate-300 dark:text-slate-600'
                                    : 'cursor-grab text-slate-400 hover:text-slate-600 active:cursor-grabbing dark:text-slate-500'
                                }`}
                                draggable={!carradaEspecial}
                                onDragStart={
                                  carradaEspecial
                                    ? undefined
                                    : () => setDragKey(key)
                                }
                                onDragEnd={() => {
                                  setDragKey(null);
                                  setDragOverKey(null);
                                }}
                                title={carradaEspecial ? undefined : 'Arraste para reordenar'}
                                aria-label={carradaEspecial ? undefined : 'Arraste para reordenar'}
                              >
                                {carradaEspecial ? '' : '⠿'}
                              </td>
                            )}
                            {visibleColumns.includes('cod') && (
                            <td
                              style={{ width: columnPreferences.widths.cod, minWidth: columnPreferences.widths.cod }}
                              className="py-2 px-2 font-mono text-slate-800 dark:text-slate-200"
                            >
                              <span className="inline-flex items-center gap-1">
                                <GradeCelulaModalBtn
                                  onClick={() => setCarradaDetalhe(c)}
                                  title="Ver detalhe da carrada"
                                  align="left"
                                >
                                  {c.cod}
                                </GradeCelulaModalBtn>
                                <CopiarTextoBtn texto={c.cod} title="Copiar código do romaneio" />
                              </span>
                            </td>
                            )}
                            {visibleColumns.includes('carrada') && (
                            <td
                              style={{ width: columnPreferences.widths.carrada, minWidth: columnPreferences.widths.carrada }}
                              className="py-2 px-2 text-slate-800 dark:text-slate-200"
                            >
                              <GradeCelulaModalBtn
                                onClick={() => setCarradaDetalhe(c)}
                                title={c.carrada}
                                align="left"
                              >
                                <span className="truncate" style={{ maxWidth: columnPreferences.widths.carrada - 20 }}>
                                  {c.carrada}
                                </span>
                              </GradeCelulaModalBtn>
                            </td>
                            )}
                            {visibleColumns.includes('dataProducao') && (
                            <td
                              style={{ width: columnPreferences.widths.dataProducao, minWidth: columnPreferences.widths.dataProducao }}
                              className="py-2 px-2"
                            >
                              {carradaEmFormacao ? (
                                <span
                                  className="text-xs tabular-nums text-slate-700 dark:text-slate-200"
                                  title="Data de produção = maior data das demais carradas + 30 dias"
                                >
                                  {dataProducaoEmFormacao
                                    ? formatDataCurta(dataProducaoEmFormacao)
                                    : '—'}
                                </span>
                              ) : carradaEspecial ? null : (
                                <SequenciamentoDateField
                                  value={toISODate(efProducao(key))}
                                  disabled={!editavel}
                                  fullWidth
                                  rowKey={key}
                                  colKey="dataProducao"
                                  className="text-xs"
                                  onChange={(iso) => editarData(key, 'dataProducao', iso)}
                                  onKeyDown={(e) => handleEditInputKey(e, key, 'dataProducao')}
                                />
                              )}
                            </td>
                            )}
                            {editavel && (
                              <td className="w-12 px-0.5 py-2 text-center align-middle">
                                {!carradaEspecial && !carradaEmFormacao && (
                                  <div className="flex flex-col items-center gap-0.5">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        replicarProducaoNaEntrega(key);
                                      }}
                                      disabled={!efProducao(key)}
                                      className="rounded px-1 py-0.5 text-xs font-medium text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-primary-300 dark:hover:bg-primary-900/30"
                                      title="Replicar produção na entrega"
                                      aria-label="Replicar produção na entrega"
                                    >
                                      →
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        replicarEntregaNaProducao(key);
                                      }}
                                      disabled={!efEntrega(key)}
                                      className="rounded px-1 py-0.5 text-xs font-medium text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-primary-300 dark:hover:bg-primary-900/30"
                                      title="Replicar entrega na produção"
                                      aria-label="Replicar entrega na produção"
                                    >
                                      ←
                                    </button>
                                  </div>
                                )}
                              </td>
                            )}
                            {visibleColumns.includes('dataEntrega') && (
                            <td
                              style={{ width: columnPreferences.widths.dataEntrega, minWidth: columnPreferences.widths.dataEntrega }}
                              className="py-2 px-2"
                            >
                              {carradaEmFormacao ? (
                                <span
                                  className="text-xs font-medium text-amber-700 dark:text-amber-300"
                                  title="Entrega/previsão não definida — carrada em formação"
                                >
                                  {LABEL_CARRADA_EM_FORMACAO}
                                </span>
                              ) : carradaEspecial ? null : (
                                <SequenciamentoDateField
                                  value={toISODate(efEntrega(key))}
                                  disabled={!editavel}
                                  fullWidth
                                  rowKey={key}
                                  colKey="dataEntrega"
                                  className="text-xs"
                                  onChange={(iso) => editarData(key, 'dataEntrega', iso)}
                                  onKeyDown={(e) => handleEditInputKey(e, key, 'dataEntrega')}
                                />
                              )}
                            </td>
                            )}
                            {visibleColumns.includes('confiavel') && (
                            <td
                              style={{ width: columnPreferences.widths.confiavel, minWidth: columnPreferences.widths.confiavel }}
                              className="py-2 px-2 text-center"
                            >
                              {editavel && !carradaEspecial ? (
                                <TogglePrevisaoConfiavel
                                  value={confiabilidadeCarrada(key)}
                                  onChange={(valor) => editarConfiabilidadeCarrada(key, valor)}
                                  compact
                                  showHelp={false}
                                  className="min-w-[102px]"
                                />
                              ) : (
                                (() => {
                                  const valor = confiabilidadeCarrada(key);
                                  if (valor === null) return null;
                                  return (
                                  <span
                                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${classPercentualEmDia(valor ? 100 : 0)}`}
                                    title={
                                      carradaEspecial
                                        ? 'Carrada especial: Confiável só pode ser alterado na conclusão ou no reprogramar do item'
                                        : undefined
                                    }
                                  >
                                    {valor ? 'Confiável' : 'Não confiável'}
                                  </span>
                                  );
                                })()
                              )}
                            </td>
                            )}
                            {visibleColumns.includes('saldoAFaturar') && (
                            <td
                              style={{ width: columnPreferences.widths.saldoAFaturar, minWidth: columnPreferences.widths.saldoAFaturar }}
                              className="py-2 px-2 text-right tabular-nums text-slate-800 dark:text-slate-200"
                            >
                              {formatMoeda(c.saldoAFaturar)}
                            </td>
                            )}
                            {visibleColumns.includes('percentualEmDia') && (
                            <td
                              style={{ width: columnPreferences.widths.percentualEmDia, minWidth: columnPreferences.widths.percentualEmDia }}
                              className="py-2 px-2 text-right tabular-nums"
                            >
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${classPercentualEmDia(c.percentualEmDia ?? 0)}`}
                              >
                                {formatPercentual(c.percentualEmDia ?? 0)}
                              </span>
                            </td>
                            )}
                            {visibleColumns.includes('adiantamento') && (
                            <td
                              style={{ width: columnPreferences.widths.adiantamento, minWidth: columnPreferences.widths.adiantamento }}
                              className="py-2 px-2 text-right tabular-nums text-slate-800 dark:text-slate-200"
                            >
                              {formatMoeda(c.adiantamento)}
                            </td>
                            )}
                            {visibleColumns.includes('valorAVistaAte10d') && (
                            <td
                              style={{ width: columnPreferences.widths.valorAVistaAte10d, minWidth: columnPreferences.widths.valorAVistaAte10d }}
                              className="py-2 px-2 text-right tabular-nums text-slate-800 dark:text-slate-200"
                            >
                              {formatMoeda(c.valorAVistaAte10d)}
                            </td>
                            )}
                          </tr>
                        );
                      })}
                      <tr className={SUBTOTAL_ROW_CLASS}>
                        {podeArrastar && <td colSpan={2} />}
                        {editavel && <td />}
                        {visibleColumns.map((colId, index) => (
                          <td
                            key={colId}
                            style={{ width: columnPreferences.widths[colId], minWidth: columnPreferences.widths[colId] }}
                            className={`py-2 px-2 ${
                              COL_NUMERICAS.has(colId)
                                ? 'text-right tabular-nums'
                                : 'text-slate-800 dark:text-slate-100'
                            }`}
                          >
                            {index === 0 && <span className="font-medium">Subtotal</span>}
                            {colId === 'saldoAFaturar' && formatMoeda(subtotal.saldoAFaturar)}
                            {colId === 'percentualEmDia' && (
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${classPercentualEmDia(subtotal.percentualEmDia)}`}
                              >
                                {formatPercentual(subtotal.percentualEmDia)}
                              </span>
                            )}
                            {colId === 'adiantamento' && formatMoeda(subtotal.adiantamento)}
                            {colId === 'valorAVistaAte10d' && formatMoeda(subtotal.valorAVistaAte10d)}
                          </td>
                        ))}
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {seqFiltroAberto && seqFiltroRect && (
        <GradeFiltroExcelPortal
          colunaAberta="seq"
          rect={seqFiltroRect}
          dropdownRef={seqFiltroDropdownRef}
          excelFilterDrafts={seqFiltroDrafts}
          setExcelFilterDrafts={setSeqFiltroDrafts}
          valoresUnicosPorColuna={{ seq: [] }}
          onSortAsc={() => aplicarOrdemPorPrioridade('asc')}
          onSortDesc={() => aplicarOrdemPorPrioridade('desc')}
          onAplicar={fecharFiltroSeq}
          onCancelar={fecharFiltroSeq}
          sortAscLabel="Menor para Maior"
          sortDescLabel="Maior para Menor"
          showNumericFilters={false}
          extraActions={
            <button
              type="button"
              onClick={autopreencherSeqAPartirDaBase}
              className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-700"
              title="Mantém a Seq. da linha base e preenche as de baixo com +1"
            >
              Autopreencher sequência (+1)
            </button>
          }
        />
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
            setOrdemManual(null);
            grade.fecharFiltroExcel();
          }}
          onSortDesc={(colId) => {
            grade.setSortState({ key: colId, direction: 'desc' });
            grade.setSortLevels([]);
            setOrdemManual(null);
            grade.fecharFiltroExcel();
          }}
          onAplicar={grade.aplicarFiltroExcel}
          onCancelar={grade.fecharFiltroExcel}
          sortAscLabel={COL_NUMERICAS.has(grade.colunaFiltroAberta) ? 'Menor para Maior' : undefined}
          sortDescLabel={COL_NUMERICAS.has(grade.colunaFiltroAberta) ? 'Maior para Menor' : undefined}
          showNumericFilters={COL_NUMERICAS.has(grade.colunaFiltroAberta ?? '')}
        />
      )}

      {carradaDetalhe && (
        <SequenciamentoCarradasDetalheModal
          carrada={carradaDetalhe}
          linhas={linhasSnapshot}
          aoVivo={aoVivo}
          editavel={editavel}
          previsaoConfiavelPorId={previsaoConfiavelPorId}
          onSalvarConfiabilidade={salvarConfiabilidadeDetalhe}
          onClose={() => setCarradaDetalhe(null)}
        />
      )}

      {calendarioAberto && (
        <CalendarioProducaoModal
          linhas={linhasSnapshot}
          sim={sim}
          baseline={baseline}
          onClose={() => setCalendarioAberto(false)}
          onLinhasAtualizadas={setLinhasSnapshot}
          onEditarDataProducao={(key, novaData) => editarData(key, 'dataProducao', novaData)}
          onEditarDataEntrega={(key, novaData) => editarData(key, 'dataEntrega', novaData)}
          onRegistrarMotivoSimulacao={(idsPedido, meta) => {
            if (meta.motivo.trim()) {
              setMotivoPorId((prev) => {
                const next = { ...prev };
                for (const id of idsPedido) next[id] = meta.motivo;
                return next;
              });
            }
            setObservacaoPorId((prev) => {
              const next = { ...prev };
              for (const id of idsPedido) {
                if (meta.observacao?.trim()) next[id] = meta.observacao.slice(0, 1000);
                else delete next[id];
              }
              return next;
            });
            setPrevisaoConfiavelPorId((prev) => {
              const next = { ...prev };
              for (const id of idsPedido) {
                next[id] = meta.previsao_confiavel;
              }
              return next;
            });
          }}
          editavel={editavel}
          estoquePorCod={estoquePorCodSnapshot}
          estoqueCongelado={estoqueCongeladoSnapshot}
          geradoEm={geradoEmSnapshot}
          snapshotId={aoVivo ? null : (snapshotVisualizado?.id ?? null)}
          previsaoConfiavelPorId={previsaoConfiavelPorId}
        />
      )}

      <SequenciamentoCarradasAjudaModal
        aberto={modalAjudaAberto}
        onClose={() => setModalAjudaAberto(false)}
      />

      {confirmacaoAberta && (
        <ConfirmacaoSimulacaoModal
          pedidosEntrega={pedidosEntrega}
          qtdCarradasSomenteProducao={qtdCarradasSomenteProducao}
          excessosQtdeRomaneada={excessosQtdeRomaneada}
          invalidasDatas={linhasCorrigirDatasModal}
          linhasSnapshot={linhasSnapshot}
          sim={sim}
          baseline={baseline}
          onEditarData={editarData}
          salvando={salvandoConfirmacao}
          erro={erroConfirmacao}
          motivoPorId={motivoPorId}
          onMotivoPorIdChange={(updater) => setMotivoPorId(updater)}
          observacaoPorId={observacaoPorId}
          onObservacaoPorIdChange={(updater) => setObservacaoPorId(updater)}
          previsaoConfiavelPorId={previsaoConfiavelPorId}
          onPrevisaoConfiavelPorIdChange={(updater) => setPrevisaoConfiavelPorId(updater)}
          onConfirmar={handleConfirmarAplicar}
          onClose={() => {
            const id = snapshotVisualizado?.id;
            if (id && editavel) {
              void flushRascunho(id);
            }
            // Mantém sim / motivos / obs / confiável; só oculta o modal.
            setConfirmacaoAberta(false);
          }}
        />
      )}

      {menuHistorico &&
        createPortal(
          <div
            ref={menuHistoricoRef}
            role="menu"
            className="fixed z-[80] min-w-[11rem] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-600 dark:bg-slate-800"
            style={{ top: menuHistorico.top, left: menuHistorico.left }}
          >
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
              onClick={() => {
                const id = menuHistorico.item.id;
                setMenuHistorico(null);
                void abrirSnapshot(id, { somenteLeitura: true });
              }}
            >
              Visualizar
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={menuHistorico.item.status !== 'rascunho'}
              title={
                menuHistorico.item.status !== 'rascunho'
                  ? 'Somente rascunhos podem ser editados'
                  : undefined
              }
              className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-200 dark:hover:bg-slate-700"
              onClick={() => {
                if (menuHistorico.item.status !== 'rascunho') return;
                const id = menuHistorico.item.id;
                setMenuHistorico(null);
                void abrirSnapshot(id);
              }}
            >
              Editar
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={menuHistorico.item.status !== 'rascunho'}
              title={
                menuHistorico.item.status !== 'rascunho'
                  ? 'Somente rascunhos podem ser excluídos'
                  : undefined
              }
              className="block w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-300 dark:hover:bg-red-950/40"
              onClick={() => {
                if (menuHistorico.item.status !== 'rascunho') return;
                const item = menuHistorico.item;
                setMenuHistorico(null);
                setErroExclusao(null);
                setConfirmExcluir(item);
              }}
            >
              Excluir
            </button>
          </div>,
          document.body
        )}

      {confirmExcluir && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4"
          role="presentation"
          onClick={() => !excluindo && setConfirmExcluir(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-600 dark:bg-slate-800"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="seq-excluir-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="seq-excluir-title"
              className="text-base font-semibold text-slate-800 dark:text-slate-100"
            >
              Excluir sequência?
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              A sequência{' '}
              <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                {confirmExcluir.cod}
              </span>{' '}
              (rascunho) será removida permanentemente.
            </p>
            {erroExclusao && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-300" role="alert">
                {erroExclusao}
              </p>
            )}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className={BTN_SECONDARY}
                disabled={excluindo}
                onClick={() => setConfirmExcluir(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
                disabled={excluindo}
                onClick={() => void confirmarExclusaoHistorico()}
              >
                {excluindo ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
