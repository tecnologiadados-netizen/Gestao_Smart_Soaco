import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  atualizarSequenciamentoSnapshot,
  concluirSequenciamentoSnapshot,
  consultarSequenciamentoAoVivo,
  gravarSequenciamentoSnapshot,
  listarSequenciamentoSnapshots,
  obterSequenciamentoSnapshot,
  type SequenciamentoCarradaAgregada,
  type SequenciamentoCarradasPayloadV1,
  type SequenciamentoSimulacao,
  type SequenciamentoSnapshotListItem,
  type SequenciamentoSnapshotStatus,
} from '../../api/sequenciamentoCarradas';
import { ajustarDataProducaoLote, ajustarPrevisaoLote } from '../../api/pedidos';
import SequenciamentoCarradasDetalheModal from '../../components/sequenciamento-carradas/SequenciamentoCarradasDetalheModal';
import CalendarioProducaoModal from '../../components/sequenciamento-carradas/CalendarioProducaoModal';
import ConfirmacaoSimulacaoModal from '../../components/sequenciamento-carradas/ConfirmacaoSimulacaoModal';
import ModalCorrigirDatasSequenciamento from '../../components/sequenciamento-carradas/ModalCorrigirDatasSequenciamento';
import { useGradeFiltrosExcel, type ExcelFilterDraft } from '../../hooks/useGradeFiltrosExcel';
import GradeFiltroCabecalhoBtn from '../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../components/grade/GradeFiltroExcelPortal';
import {
  formatDateTimeBr,
  formatMoeda,
  formatPercentual,
  classPercentualEmDia,
  garantirEspeciaisNoFim,
  isCarradaOrdemFinal,
  ordenarCarradas,
  subtotalCarradas,
  SUBTOTAL_ROW_CLASS,
} from '../../components/sequenciamento-carradas/sequenciamentoCarradasUtils';
import { useDragAutoScroll } from '../../hooks/useDragAutoScroll';
import {
  carradaAlterada,
  carradaKeyDe,
  computarBaselines,
  computarItensDataProducao,
  computarPedidosComEntregaAlterada,
  formatDataCurta,
  ordenarChavesPorPrioridade,
  indiceBasePrioridadeParaAutopreencher,
  autopreencherPrioridadesSequenciais,
  toISODate,
  valorEfetivo,
  listarCarradasComDatasPassadas,
  type SimEntry,
} from '../../components/sequenciamento-carradas/simulacaoCarradas';
import {
  DATE_COL_KEYS,
  EDIT_COL_KEYS,
  focusSeqEditInput,
  onDateInputToggleBlur,
  onDateInputToggleClick,
  clearDatePickerAberto,
  type EditColKey,
} from '../../components/sequenciamento-carradas/sequenciamentoGradeUi';

const BTN_PRIMARY =
  'inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_SECONDARY =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';

const COL_IDS = [
  'cod',
  'carrada',
  'dataProducao',
  'dataEntrega',
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
  saldoAFaturar: 'Saldo a faturar',
  percentualEmDia: '% Em dia',
  adiantamento: 'Adiantamento',
  valorAVistaAte10d: 'Valor adiantamento + até 10d',
};

const DATE_INPUT_CLASS =
  'w-[8rem] rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:disabled:bg-slate-800';

const PRIORIDADE_INPUT_CLASS =
  'w-12 rounded-md border border-slate-300 bg-white px-1 py-1 text-center text-xs text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:disabled:bg-slate-800';

const COL_TH_CLASS: Partial<Record<(typeof COL_IDS)[number], string>> = {
  dataProducao: 'w-[8.5rem]',
  dataEntrega: 'w-[8.5rem]',
  saldoAFaturar: 'w-28',
  percentualEmDia: 'w-24',
  adiantamento: 'w-28',
  valorAVistaAte10d: 'w-28',
};

const COL_TD_CLASS: Partial<Record<(typeof COL_IDS)[number], string>> = {
  dataProducao: 'w-[8.5rem]',
  dataEntrega: 'w-[8.5rem]',
  saldoAFaturar: 'w-28 text-right tabular-nums',
  percentualEmDia: 'w-24 text-right tabular-nums',
  adiantamento: 'w-28 text-right tabular-nums',
  valorAVistaAte10d: 'w-28 text-right tabular-nums',
};

type SnapshotVisualizado = {
  id: number | null;
  cod: string;
  createdAt: string;
  usuarioLogin: string;
  carradaCount: number;
  aoVivo: boolean;
  status?: SequenciamentoSnapshotStatus;
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
  const datePickerAbertoRef = useRef<string | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after'>('before');
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('idle');
  const [calendarioAberto, setCalendarioAberto] = useState(false);
  const [confirmacaoAberta, setConfirmacaoAberta] = useState(false);
  const [corrigirDatasAberta, setCorrigirDatasAberta] = useState(false);
  const [salvandoConfirmacao, setSalvandoConfirmacao] = useState(false);
  const [erroConfirmacao, setErroConfirmacao] = useState<string | null>(null);
  const [motivoPorId, setMotivoPorId] = useState<Record<string, string>>({});

  const detalheReqRef = useRef(0);
  const autosavePayloadRef = useRef<() => SequenciamentoSimulacao | null>(() => null);
  const pendingSimulacaoRef = useRef<SequenciamentoSimulacao | null>(null);
  const flushSimulacaoRef = useRef<SequenciamentoSimulacao | null>(null);
  const flushSnapshotIdRef = useRef<number | null>(null);

  const aoVivo = snapshotVisualizado?.aoVivo ?? false;
  const statusSnapshot = snapshotVisualizado?.status;
  const emConsulta = aoVivo;
  const isRascunho = statusSnapshot === 'rascunho';
  /** Datas editáveis apenas em snapshot rascunho. */
  const editavel = isRascunho;
  /** Reordenação visual liberada em consulta ao vivo e em rascunho. */
  const podeArrastar = emConsulta || isRascunho;

  const baseline = useMemo(() => computarBaselines(linhasSnapshot), [linhasSnapshot]);

  const efProducao = useCallback(
    (key: string) => valorEfetivo(sim, baseline, key, 'dataProducao'),
    [sim, baseline]
  );
  const efEntrega = useCallback(
    (key: string) => valorEfetivo(sim, baseline, key, 'dataEntrega'),
    [sim, baseline]
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
    [efProducao, efEntrega]
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
    [efProducao, efEntrega]
  );

  const grade = useGradeFiltrosExcel<SequenciamentoCarradaAgregada>({
    rows: carradas,
    columnIds: [...COL_IDS],
    getCellText,
    valueForSort,
    defaultSortLevels: [],
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

  const carradasComDatasPassadas = useMemo(
    () => listarCarradasComDatasPassadas(carradasFinais, sim, baseline, carradaKeyDe),
    [carradasFinais, sim, baseline]
  );

  const subtotal = useMemo(() => subtotalCarradas(carradasFinais), [carradasFinais]);

  const pedidosEntrega = useMemo(
    () => computarPedidosComEntregaAlterada(linhasSnapshot, sim, baseline),
    [linhasSnapshot, sim, baseline]
  );
  const itensProducao = useMemo(
    () => computarItensDataProducao(linhasSnapshot, sim, baseline),
    [linhasSnapshot, sim, baseline]
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
    setDragOverKey(null);
    setAutosaveStatus('idle');
    grade.limparFiltrosGrade();
  }, [grade]);

  const flushRascunho = useCallback(async (id: number) => {
    const simulacao = pendingSimulacaoRef.current ?? autosavePayloadRef.current();
    if (!simulacao) return;
    setAutosaveStatus('saving');
    const r = await atualizarSequenciamentoSnapshot(id, simulacao);
    setAutosaveStatus(r.ok ? 'saved' : 'error');
  }, []);

  const fecharVisualizacao = useCallback(async () => {
    const id = snapshotVisualizado?.id;
    if (id && isRascunho) {
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
  }, [snapshotVisualizado?.id, isRascunho, flushRascunho, resetarSimulacao]);

  const abrirComPayload = useCallback(
    (meta: SnapshotVisualizado, payload: SequenciamentoCarradasPayloadV1) => {
      const { carradas: sorted, linhas } = aplicarPayload(payload);
      setSnapshotVisualizado(meta);
      setCarradas(sorted);
      setLinhasSnapshot(linhas);
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
            if (it.dataProducao != null) entry.dataProducao = it.dataProducao;
            if (it.dataEntrega != null) entry.dataEntrega = it.dataEntrega;
            m.set(it.chave, entry);
          }
        }
        setSim(m);
        setOrdemManual(Array.isArray(simu.ordem) && simu.ordem.length > 0 ? simu.ordem : null);
        setPrioridades(
          simu.prioridades && typeof simu.prioridades === 'object' ? { ...simu.prioridades } : {}
        );
        setMotivoPorId(simu.motivos && typeof simu.motivos === 'object' ? { ...simu.motivos } : {});
      } else {
        setSim(new Map());
        setOrdemManual(null);
        setPrioridades({});
        setMotivoPorId({});
      }
    },
    [grade]
  );

  const abrirSnapshot = useCallback(
    async (id: number) => {
      const req = ++detalheReqRef.current;
      setDetalheErro(null);
      setDetalheCarregando(true);
      setFeedbackGravacao(null);
      setCarradaDetalhe(null);
      try {
        const r = await obterSequenciamentoSnapshot(id);
        if (req !== detalheReqRef.current) return;
        if (r.error) {
          setDetalheErro(r.error);
          return;
        }
        const data = r.data;
        if (!data?.payload) {
          setDetalheErro('Snapshot sem dados legíveis.');
          return;
        }
        abrirComPayload(
          {
            id: data.id,
            cod: data.cod,
            createdAt: data.createdAt,
            usuarioLogin: data.usuarioLogin,
            carradaCount: data.carradaCount,
            aoVivo: false,
            status: data.status,
          },
          data.payload
        );
      } catch (e) {
        if (req !== detalheReqRef.current) return;
        setDetalheErro(e instanceof Error ? e.message : String(e));
      } finally {
        if (req === detalheReqRef.current) setDetalheCarregando(false);
      }
    },
    [abrirComPayload]
  );

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
    const prioridadesFiltradas = Object.fromEntries(
      Object.entries(prioridades).filter(([chave, v]) => {
        if (typeof v !== 'number' || v <= 0) return false;
        const c = carradas.find((x) => carradaKeyDe(x) === chave);
        return c != null && !isCarradaOrdemFinal(c.carrada);
      })
    );
    const temPrioridades = Object.keys(prioridadesFiltradas).length > 0;
    if (itens.length === 0 && !ordemManual && !motivos && !temPrioridades) return null;
    return {
      ordem,
      itens,
      ...(motivos ? { motivos } : {}),
      ...(temPrioridades ? { prioridades: prioridadesFiltradas } : {}),
    };
  }, [sim, carradas, ordemManual, carradasFinais, motivoPorId, prioridades]);

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
    (e: React.KeyboardEvent<HTMLInputElement>, rowKey: string, colKey: EditColKey) => {
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

  // Fecha o date picker nativo ao rolar a grade (evita popup desposicionado).
  useEffect(() => {
    const el = grade.tableScrollRef.current;
    if (!el || mostrarHistorico) return;
    const onScroll = () => {
      const active = document.activeElement;
      if (active instanceof HTMLInputElement && active.type === 'date') {
        active.blur();
      }
      clearDatePickerAberto(datePickerAbertoRef);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [grade.tableScrollRef, mostrarHistorico, snapshotVisualizado?.id]);

  // Autosave do rascunho (debounce ~2s).
  const snapshotId = snapshotVisualizado?.id;
  useEffect(() => {
    flushSnapshotIdRef.current = snapshotId ?? null;
  }, [snapshotId]);

  useEffect(() => {
    if (!snapshotId || !isRascunho) return;
    const timer = window.setTimeout(() => {
      const simulacao = pendingSimulacaoRef.current ?? autosavePayloadRef.current();
      setAutosaveStatus('saving');
      void atualizarSequenciamentoSnapshot(snapshotId, simulacao).then((r) => {
        setAutosaveStatus(r.ok ? 'saved' : 'error');
      });
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [sim, ordemManual, prioridades, motivoPorId, snapshotId, isRascunho, carradasFinais]);

  // Flush no unmount e beforeunload.
  useEffect(() => {
    if (!snapshotId || !isRascunho) return;
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
  }, [snapshotId, isRascunho]);

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
    async (motivos: Record<string, string>) => {
      setSalvandoConfirmacao(true);
      setErroConfirmacao(null);
      try {
        if (pedidosEntrega.length > 0) {
          const ajustes = pedidosEntrega.map((p) => ({
            id_pedido: p.idPedido,
            previsao_nova: p.previsaoNova,
            motivo: motivos[p.idPedido] ?? '',
            previsao_atual: p.previsaoAnterior,
            rota: p.rota,
            apply_rota: true,
          }));
          await ajustarPrevisaoLote(ajustes);
        }
        if (itensProducao.length > 0) {
          await ajustarDataProducaoLote(itensProducao);
        }
        const simulacao = montarSimulacaoPayload();
        if (snapshotVisualizado?.id) {
          const r = await concluirSequenciamentoSnapshot(snapshotVisualizado.id, simulacao);
          if (!r.ok) {
            setErroConfirmacao(r.error ?? 'Erro ao concluir snapshot.');
            return;
          }
          setConfirmacaoAberta(false);
          setFeedbackGravacao('Alterações aplicadas e snapshot concluído.');
          setHistoricoVersao((v) => v + 1);
          await abrirSnapshot(snapshotVisualizado.id);
          return;
        }
        setConfirmacaoAberta(false);
        setFeedbackGravacao('Alterações aplicadas com sucesso nos pedidos.');
        resetarSimulacao();
        await handleConsultar();
      } catch (e) {
        setErroConfirmacao(e instanceof Error ? e.message : String(e));
      } finally {
        setSalvandoConfirmacao(false);
      }
    },
    [
      pedidosEntrega,
      itensProducao,
      montarSimulacaoPayload,
      snapshotVisualizado?.id,
      abrirSnapshot,
      resetarSimulacao,
      handleConsultar,
    ]
  );

  const renderTh = (colId: (typeof COL_IDS)[number]) => {
    const numerica = COL_NUMERICAS.has(colId);
    const extra = COL_TH_CLASS[colId] ?? '';
    const labelClass =
      colId === 'valorAVistaAte10d'
        ? 'max-w-[6rem] whitespace-normal break-words text-[10px] leading-tight'
        : 'whitespace-normal break-words text-[11px] leading-tight sm:text-xs';
    return (
      <th
        key={colId}
        className={`sticky top-0 z-20 border border-primary-500/40 bg-primary-600 px-2 py-2.5 align-middle font-semibold text-white shadow-[0_1px_0_rgba(0,0,0,0.08)] ${extra}`}
      >
        <div className={`flex items-center gap-1 ${numerica ? 'justify-end' : 'justify-between'}`}>
          <span className={labelClass}>{COL_LABELS[colId]}</span>
          <GradeFiltroCabecalhoBtn
            ativo={grade.colunaComFiltroAtivo(colId)}
            onClick={(e) => grade.abrirFiltroExcel(colId, e)}
          />
        </div>
      </th>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
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
              {isRascunho && (
                <button
                  type="button"
                  onClick={() => {
                    setErroConfirmacao(null);
                    if (carradasComDatasPassadas.length > 0) {
                      setCorrigirDatasAberta(true);
                    } else {
                      setConfirmacaoAberta(true);
                    }
                  }}
                  disabled={gravando}
                  className={BTN_PRIMARY}
                >
                  Registrar Motivos
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
          {historicoErro && !historicoCarregando && (
            <p className="text-sm text-red-600 dark:text-red-300" role="alert">
              {historicoErro}
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
                    tabIndex={0}
                    className="border-b border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
                    title="Clique para ver este snapshot"
                    onClick={() => void abrirSnapshot(h.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        void abrirSnapshot(h.id);
                      }
                    }}
                  >
                    <td className="py-2 px-2 font-mono text-slate-800 dark:text-slate-200">{h.cod}</td>
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
              <table className="w-full border-separate border-spacing-0 text-left text-sm">
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
                    {renderTh('cod')}
                    {renderTh('carrada')}
                    {renderTh('dataProducao')}
                    {editavel && (
                      <th className="sticky top-0 z-20 w-8 border border-primary-500/40 bg-primary-600 px-1 py-2.5 shadow-[0_1px_0_rgba(0,0,0,0.08)]">
                        <button
                          type="button"
                          onClick={replicarProducaoNaEntregaTodas}
                          className="mx-auto block rounded px-1.5 py-0.5 text-xs font-medium text-white hover:bg-primary-500/50"
                          title="Replicar data de produção para entrega em todas as carradas"
                          aria-label="Replicar data de produção para entrega em todas as carradas"
                        >
                          →
                        </button>
                      </th>
                    )}
                    {renderTh('dataEntrega')}
                    {renderTh('saldoAFaturar')}
                    {renderTh('percentualEmDia')}
                    {renderTh('adiantamento')}
                    {renderTh('valorAVistaAte10d')}
                  </tr>
                </thead>
                <tbody>
                  {carradasFinais.length === 0 ? (
                    <tr>
                      <td
                        colSpan={
                          COL_IDS.length + (podeArrastar ? 2 : 0) + (editavel ? 1 : 0)
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
                        const datasBloqueadas = !editavel || carradaEspecial;
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
                            <td
                              className="cursor-pointer py-2 px-2 font-mono text-slate-800 dark:text-slate-200"
                              onClick={() => setCarradaDetalhe(c)}
                            >
                              {c.cod}
                            </td>
                            <td
                              className="max-w-[280px] cursor-pointer truncate py-2 px-2 text-slate-800 dark:text-slate-200"
                              title={c.carrada}
                              onClick={() => setCarradaDetalhe(c)}
                            >
                              {c.carrada}
                            </td>
                            <td className={`py-2 px-2 ${COL_TD_CLASS.dataProducao ?? ''}`}>
                              <input
                                type="date"
                                className={DATE_INPUT_CLASS}
                                value={toISODate(efProducao(key))}
                                disabled={datasBloqueadas}
                                data-editinput
                                data-rowkey={key}
                                data-colkey="dataProducao"
                                onChange={(e) => {
                                  clearDatePickerAberto(datePickerAbertoRef);
                                  editarData(key, 'dataProducao', e.target.value);
                                }}
                                onKeyDown={(e) => {
                                  e.stopPropagation();
                                  if (e.key === 'Escape') clearDatePickerAberto(datePickerAbertoRef);
                                  handleEditInputKey(e, key, 'dataProducao');
                                }}
                                onClick={(e) => onDateInputToggleClick(e, `${key}:dataProducao`, datePickerAbertoRef)}
                                onBlur={() => onDateInputToggleBlur(`${key}:dataProducao`, datePickerAbertoRef)}
                              />
                            </td>
                            {editavel && (
                              <td className="w-8 px-1 py-2 text-center align-middle">
                                {!carradaEspecial && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      replicarProducaoNaEntrega(key);
                                    }}
                                    disabled={!efProducao(key)}
                                    className="rounded px-1.5 py-0.5 text-xs font-medium text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-primary-300 dark:hover:bg-primary-900/30"
                                    title="Replicar produção na entrega"
                                    aria-label="Replicar produção na entrega"
                                  >
                                    →
                                  </button>
                                )}
                              </td>
                            )}
                            <td className={`py-2 px-2 ${COL_TD_CLASS.dataEntrega ?? ''}`}>
                              <input
                                type="date"
                                className={DATE_INPUT_CLASS}
                                value={toISODate(efEntrega(key))}
                                disabled={datasBloqueadas}
                                data-editinput
                                data-rowkey={key}
                                data-colkey="dataEntrega"
                                onChange={(e) => {
                                  clearDatePickerAberto(datePickerAbertoRef);
                                  editarData(key, 'dataEntrega', e.target.value);
                                }}
                                onKeyDown={(e) => {
                                  e.stopPropagation();
                                  if (e.key === 'Escape') clearDatePickerAberto(datePickerAbertoRef);
                                  handleEditInputKey(e, key, 'dataEntrega');
                                }}
                                onClick={(e) => onDateInputToggleClick(e, `${key}:dataEntrega`, datePickerAbertoRef)}
                                onBlur={() => onDateInputToggleBlur(`${key}:dataEntrega`, datePickerAbertoRef)}
                              />
                            </td>
                            <td
                              className={`cursor-pointer py-2 px-2 text-slate-800 dark:text-slate-200 ${COL_TD_CLASS.saldoAFaturar ?? 'text-right tabular-nums'}`}
                              onClick={() => setCarradaDetalhe(c)}
                            >
                              {formatMoeda(c.saldoAFaturar)}
                            </td>
                            <td
                              className={`cursor-pointer py-2 px-2 ${COL_TD_CLASS.percentualEmDia ?? 'text-right tabular-nums'}`}
                              onClick={() => setCarradaDetalhe(c)}
                            >
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${classPercentualEmDia(c.percentualEmDia ?? 0)}`}
                              >
                                {formatPercentual(c.percentualEmDia ?? 0)}
                              </span>
                            </td>
                            <td
                              className={`cursor-pointer py-2 px-2 text-slate-800 dark:text-slate-200 ${COL_TD_CLASS.adiantamento ?? 'text-right tabular-nums'}`}
                              onClick={() => setCarradaDetalhe(c)}
                            >
                              {formatMoeda(c.adiantamento)}
                            </td>
                            <td
                              className={`cursor-pointer py-2 px-2 text-slate-800 dark:text-slate-200 ${COL_TD_CLASS.valorAVistaAte10d ?? 'text-right tabular-nums'}`}
                              onClick={() => setCarradaDetalhe(c)}
                            >
                              {formatMoeda(c.valorAVistaAte10d)}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className={SUBTOTAL_ROW_CLASS}>
                        <td
                          className="py-2 px-2 text-slate-800 dark:text-slate-100"
                          colSpan={(podeArrastar ? 2 : 0) + 3 + (editavel ? 1 : 0)}
                        >
                          Subtotal
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums text-slate-800 dark:text-slate-100">
                          {formatMoeda(subtotal.saldoAFaturar)}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${classPercentualEmDia(subtotal.percentualEmDia)}`}
                          >
                            {formatPercentual(subtotal.percentualEmDia)}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums text-slate-800 dark:text-slate-100">
                          {formatMoeda(subtotal.adiantamento)}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums text-slate-800 dark:text-slate-100">
                          {formatMoeda(subtotal.valorAVistaAte10d)}
                        </td>
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
        />
      )}

      {corrigirDatasAberta && (
        <ModalCorrigirDatasSequenciamento
          invalidas={carradasComDatasPassadas}
          onEditar={editarData}
          onContinuar={() => {
            if (carradasComDatasPassadas.length === 0) {
              setCorrigirDatasAberta(false);
              setConfirmacaoAberta(true);
            }
          }}
          onClose={() => setCorrigirDatasAberta(false)}
        />
      )}

      {confirmacaoAberta && (
        <ConfirmacaoSimulacaoModal
          pedidosEntrega={pedidosEntrega}
          qtdCarradasSomenteProducao={qtdCarradasSomenteProducao}
          salvando={salvandoConfirmacao}
          erro={erroConfirmacao}
          motivoPorId={motivoPorId}
          onMotivoPorIdChange={(updater) => setMotivoPorId(updater)}
          onConfirmar={handleConfirmarAplicar}
          onClose={() => setConfirmacaoAberta(false)}
        />
      )}
    </div>
  );
}
