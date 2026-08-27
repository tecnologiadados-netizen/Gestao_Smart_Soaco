import { useCallback, useMemo, useRef, useState, useEffect, type PointerEvent as ReactPointerEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import GradeFiltroCabecalhoBtn from '../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../components/grade/GradeFiltroExcelPortal';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import CarregandoInformacoesOverlay from '../../components/CarregandoInformacoesOverlay';
import ModalPcPendDetalhes from '../../components/ressupAlmox/ModalPcPendDetalhes';
import EmpenhoLiquidoPainel from '../../components/ressupAlmox/EmpenhoLiquidoPainel';
import RotuloComDica from '../../components/ressupAlmox/RotuloComDica';
import { DICA_EMPENHO_LIQ_GRADE, DICA_ESTOQUE_ATUAL_GRADE, DICA_ESTOQUE_PA_SALDO, isSetorEstoquePa } from '../../components/ressupAlmox/empenhoModalUtils';
import type { RessupAlmoxPcPendLinha, RessupEmpenhoPedidoResultado } from '../../api/compras';
import { obterRessupEmpenhoPorPedido } from '../../api/compras';
import GradeCelulaModalBtn from '../../components/pcp/GradeCelulaModalBtn';
import ModalConsultaEstoqueDetalhe, { fmtQtde } from '../../components/pcp/ModalConsultaEstoqueDetalhe';
import TabelaDetalheSolicitacao from '../../components/pcp/TabelaDetalheSolicitacao';
import TabelaDetalheCotacao from '../../components/pcp/TabelaDetalheCotacao';
import ModalFiltrosConsultaEstoque, {
  filtrosConsultaTemAlgumSelecionado,
  filtrosStateToPayload,
  rotuloEmpenhoEscopo,
  rotuloModoPedido,
  type FiltrosConsultaEstoqueState,
  type PedidoFiltroConsultaEstoque,
} from '../../components/pcp/ModalFiltrosConsultaEstoque';
import type { OptionItem } from '../../components/SingleSelectWithSearch';
import {
  contarConsultaEstoque,
  consultarEstoque,
  obterCotacaoDetalhe,
  buscarOpcoesFiltroConsultaEstoque,
  buscarPedidosGerenciadorTypeahead,
  obterOpcoesFiltroCascataConsultaEstoque,
  obterOpcoesFiltroConsultaEstoque,
  obterSaldoDetalhe,
  obterScDetalhe,
  type ConsultaEstoqueLinha,
  type CotacaoDetalhe,
  type EmpenhoEscopoConsultaEstoque,
  type ModoPedidoConsultaEstoque,
  type OpcoesFiltroConsultaEstoque,
  type PedidoGerenciadorTypeaheadItem,
  type SaldoSetorDetalhe,
  type ScDetalhe,
} from '../../api/consultaEstoque';
import { SETOR_ALMOX_SECUNDARIO } from '../../utils/ressupNaoAlmoxColetas';
import { ComoLerBtn } from '../../components/AjudaTelaModal';
import ConsultaEstoqueAjudaModal from './ConsultaEstoqueAjudaModal';
import {
  getOrderLabelsForConsultaEstoqueCol,
  isConsultaEstoqueColNumeric,
  SORT_DEFAULT_CONSULTA_ESTOQUE,
} from '../../utils/consultaEstoqueGradeSort';
import {
  clampConsultaEstoqueColWidth,
  CONSULTA_ESTOQUE_DEFAULT_COL_WIDTHS,
  loadConsultaEstoqueColunasOcultas,
  persistConsultaEstoqueColunasOcultas,
  persistConsultaEstoqueColWidths,
  readConsultaEstoqueColWidths,
} from '../../utils/consultaEstoqueGradeUi';

const COLS = [
  { key: 'codigo', label: 'Código', clickable: false, align: 'left' as const },
  { key: 'descricao', label: 'Descrição', clickable: false, align: 'left' as const },
  { key: 'und', label: 'Und', clickable: false, align: 'left' as const },
  { key: 'empenho', label: 'Empenho', clickable: true as const, align: 'center' as const },
  { key: 'saldo', label: 'Estoque atual', clickable: true as const, align: 'center' as const },
  { key: 'solicitacao', label: 'Solicitação', clickable: true as const, align: 'center' as const },
  { key: 'cotacao', label: 'Pré Compra', clickable: true as const, align: 'center' as const },
  { key: 'pedidoCompra', label: 'Pedido compra', clickable: true as const, align: 'center' as const },
  { key: 'saldoProjetado', label: 'Saldo projetado', clickable: false, align: 'center' as const },
] as const;

type ColKey = (typeof COLS)[number]['key'];

const NUM_KEYS = ['empenho', 'saldo', 'solicitacao', 'cotacao', 'pedidoCompra', 'saldoProjetado'] as const;

const COL_KEYS: ColKey[] = COLS.map((c) => c.key);

function isNumKey(k: string): k is (typeof NUM_KEYS)[number] {
  return (NUM_KEYS as readonly string[]).includes(k);
}

const SALDO_PROJETADO_NEG_CLASS = 'bg-red-50 dark:bg-red-950/40';

const EMPTY_OPCOES: OpcoesFiltroConsultaEstoque = {
  codigos: [],
  descricoes: [],
  tipos: [],
  grupos: [],
  coletas: [],
  setoresProducao: [],
  subgrupo1: [],
  subgrupo2: [],
};

const EMPTY_FILTROS: FiltrosConsultaEstoqueState = {
  codigos: '',
  descricoes: '',
  tipos: '',
  grupos: '',
  coletas: '',
  setoresProducao: '',
  subgrupo1: '',
  subgrupo2: '',
  familias: '',
  comEmpenho: 'todos',
  comSaldoEstoque: 'todos',
};

const CONSULTA_ESTOQUE_CONFIRM_ROWS = 50;

const BTN_PRIMARY =
  'inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50';

const BTN_COLUNAS_OCULTAS =
  'inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';

type DetalheModal =
  | { tipo: 'saldo'; linha: ConsultaEstoqueLinha }
  | { tipo: 'empenho'; linha: ConsultaEstoqueLinha }
  | { tipo: 'solicitacao'; linha: ConsultaEstoqueLinha }
  | { tipo: 'cotacao'; linha: ConsultaEstoqueLinha }
  | { tipo: 'pc'; linha: ConsultaEstoqueLinha };

function detalheTipoDaColuna(k: ColKey): DetalheModal['tipo'] | null {
  if (k === 'saldo' || k === 'empenho' || k === 'solicitacao' || k === 'cotacao') return k;
  if (k === 'pedidoCompra') return 'pc';
  return null;
}

type DetalheCachePayload =
  | SaldoSetorDetalhe[]
  | ScDetalhe[]
  | CotacaoDetalhe[]
  | RessupEmpenhoPedidoResultado;

const EMPTY_PEDIDO_FILTRO: PedidoFiltroConsultaEstoque = {
  pedido: null,
  modoPedido: null,
  empenhoEscopo: null,
};

type ConsultaPedidoResumo = {
  pedidoNome: string;
  modoPedido: ModoPedidoConsultaEstoque;
  empenhoEscopo: EmpenhoEscopoConsultaEstoque;
  idPedido: number;
};

function formatDateBr(iso: string): string {
  const s = iso.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return iso;
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

function pedidoToOptionItem(p: PedidoGerenciadorTypeaheadItem): OptionItem {
  return {
    id: p.id,
    nome: p.nome,
    descricao: `Cliente: ${p.cliente ?? '—'} — Emissão: ${formatDateBr(p.dataEmissao)}`,
    uniqueKey: `pd-${p.id}`,
  };
}

function detalheModalCacheKey(
  tipo: Exclude<DetalheModal['tipo'], 'pc'>,
  idProduto: number,
  considerarRequisicoes: boolean,
  empenhoCtx?: { escopo: EmpenhoEscopoConsultaEstoque; idPedido?: number }
): string {
  const emp =
    empenhoCtx?.escopo === 'pedido' && empenhoCtx.idPedido
      ? `-pd${empenhoCtx.idPedido}`
      : '-empTodos';
  return `${tipo}-${idProduto}-${considerarRequisicoes ? '1' : '0'}${tipo === 'empenho' ? emp : ''}`;
}

export default function ConsultaEstoquePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [filtrosPopoverAberto, setFiltrosPopoverAberto] = useState(true);
  const [opcoesCarregando, setOpcoesCarregando] = useState(false);
  const [opcoesFiltro, setOpcoesFiltro] = useState<OpcoesFiltroConsultaEstoque>(EMPTY_OPCOES);
  const [filtros, setFiltros] = useState<FiltrosConsultaEstoqueState>(EMPTY_FILTROS);
  const [pedidoFiltro, setPedidoFiltro] = useState<PedidoFiltroConsultaEstoque>(EMPTY_PEDIDO_FILTRO);
  const [confirmEscolhasPedidoAberto, setConfirmEscolhasPedidoAberto] = useState(false);
  const [pedidoPendenteEscolha, setPedidoPendenteEscolha] = useState<OptionItem | null>(null);
  const [escolhaModoTemp, setEscolhaModoTemp] = useState<ModoPedidoConsultaEstoque | null>(null);
  const [consultaPedidoResumo, setConsultaPedidoResumo] = useState<ConsultaPedidoResumo | null>(null);
  const [msgFiltro, setMsgFiltro] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<ConsultaEstoqueLinha[]>([]);
  const [mostrarGrade, setMostrarGrade] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erroApi, setErroApi] = useState<string | null>(null);
  const [modalAjudaAberto, setModalAjudaAberto] = useState(false);
  const [considerarRequisicoes, setConsiderarRequisicoes] = useState(true);
  const [confirmVolumeAberto, setConfirmVolumeAberto] = useState(false);
  const [confirmVolumeTotal, setConfirmVolumeTotal] = useState(0);
  const [detalhe, setDetalhe] = useState<DetalheModal | null>(null);
  const [detalheSaldo, setDetalheSaldo] = useState<SaldoSetorDetalhe[]>([]);
  const [detalheEmpenhoLiquido, setDetalheEmpenhoLiquido] = useState<RessupEmpenhoPedidoResultado | null>(null);
  const [detalheSc, setDetalheSc] = useState<ScDetalhe[]>([]);
  const [detalheCotacao, setDetalheCotacao] = useState<CotacaoDetalhe[]>([]);
  const [colunasOcultas, setColunasOcultas] = useState<string[]>(() => loadConsultaEstoqueColunasOcultas());
  const [colunasOcultasOpen, setColunasOcultasOpen] = useState(false);
  const [colWidths, setColWidths] = useState<Record<string, number>>(readConsultaEstoqueColWidths);
  const colunasOcultasRef = useRef<HTMLDivElement>(null);
  const colResizeRef = useRef<{ colKey: ColKey; startX: number; startW: number } | null>(null);

  const opcoesCarregadasRef = useRef(false);
  const filtrosRef = useRef(filtros);
  const pedidoFiltroRef = useRef(pedidoFiltro);
  const consultaPedidoResumoRef = useRef(consultaPedidoResumo);
  const detalheCacheRef = useRef(new Map<string, DetalheCachePayload>());
  const pcDetalheCacheRef = useRef(new Map<number, RessupAlmoxPcPendLinha[]>());
  filtrosRef.current = filtros;
  pedidoFiltroRef.current = pedidoFiltro;
  consultaPedidoResumoRef.current = consultaPedidoResumo;

  const getCellText = useCallback((row: ConsultaEstoqueLinha, colId: string): string => {
    switch (colId) {
      case 'codigo':
        return row.codigo;
      case 'descricao':
        return row.descricao;
      case 'und':
        return row.unidadeMedida || '—';
      case 'empenho':
        return fmtQtde(row.empenho);
      case 'saldo':
        return fmtQtde(row.saldo);
      case 'solicitacao':
        return fmtQtde(row.solicitacao);
      case 'cotacao':
        return fmtQtde(row.cotacao);
      case 'pedidoCompra':
        return fmtQtde(row.pedidoCompra);
      case 'saldoProjetado':
        return fmtQtde(row.saldoProjetado);
      default:
        return '—';
    }
  }, []);

  const valueForSort = useCallback((row: ConsultaEstoqueLinha, colId: string): string | number => {
    if (isConsultaEstoqueColNumeric(colId)) {
      const v = row[colId as keyof ConsultaEstoqueLinha];
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) ? n : NaN;
    }
    if (colId === 'und') return row.unidadeMedida || '';
    return getCellText(row, colId);
  }, [getCellText]);

  const grade = useGradeFiltrosExcel({
    rows: linhas,
    columnIds: COL_KEYS,
    getCellText,
    valueForSort,
    defaultSortLevels: SORT_DEFAULT_CONSULTA_ESTOQUE,
  });

  const idsColunasValidas = useMemo(() => new Set(COL_KEYS), []);

  useEffect(() => {
    persistConsultaEstoqueColunasOcultas(colunasOcultas);
  }, [colunasOcultas]);

  useEffect(() => {
    if (!colunasOcultasOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (colunasOcultasRef.current && !colunasOcultasRef.current.contains(e.target as Node)) {
        setColunasOcultasOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [colunasOcultasOpen]);

  useEffect(() => {
    const ocultasValidas = colunasOcultas.filter((k) => idsColunasValidas.has(k as ColKey));
    if (ocultasValidas.length >= COLS.length) ocultasValidas.pop();
    if (ocultasValidas.length !== colunasOcultas.length || ocultasValidas.some((k, i) => k !== colunasOcultas[i])) {
      setColunasOcultas(ocultasValidas);
    }
  }, [idsColunasValidas, colunasOcultas]);

  const colunasVisiveisLista = useMemo(
    () => COLS.filter((c) => !colunasOcultas.includes(c.key)),
    [colunasOcultas]
  );

  const colunasOcultasLista = useMemo(
    () => COLS.filter((c) => colunasOcultas.includes(c.key)),
    [colunasOcultas]
  );

  const larguraMinimaTabela = useMemo(() => {
    let w = 0;
    for (const col of colunasVisiveisLista) {
      w += colWidths[col.key] ?? CONSULTA_ESTOQUE_DEFAULT_COL_WIDTHS[col.key] ?? 96;
    }
    return w;
  }, [colunasVisiveisLista, colWidths]);

  const ocultarColuna = (colKey: ColKey) => {
    if (colunasVisiveisLista.length <= 1) return;
    grade.fecharFiltroExcel();
    grade.clearColumnFilter(colKey);
    grade.setSortState((prev) => (prev?.key === colKey ? null : prev));
    grade.setSortLevels((prev) => prev.filter((l) => l.id !== colKey));
    setColunasOcultas((prev) => (prev.includes(colKey) ? prev : [...prev, colKey]));
  };

  const reexibirColuna = (colKey: ColKey) => {
    setColunasOcultas((prev) => prev.filter((k) => k !== colKey));
  };

  const reexibirTodasColunas = () => {
    setColunasOcultas([]);
    setColunasOcultasOpen(false);
  };

  const onColResizePointerDown = useCallback(
    (colKey: ColKey, e: ReactPointerEvent<HTMLSpanElement>) => {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      colResizeRef.current = {
        colKey,
        startX: e.clientX,
        startW: colWidths[colKey] ?? CONSULTA_ESTOQUE_DEFAULT_COL_WIDTHS[colKey] ?? 96,
      };
    },
    [colWidths]
  );

  const onColResizePointerMove = useCallback((e: ReactPointerEvent<HTMLSpanElement>) => {
    const d = colResizeRef.current;
    if (!d) return;
    const delta = e.clientX - d.startX;
    setColWidths((prev) => ({
      ...prev,
      [d.colKey]: clampConsultaEstoqueColWidth(d.startW + delta),
    }));
  }, []);

  const onColResizePointerEnd = useCallback((e: ReactPointerEvent<HTMLSpanElement>) => {
    if (!colResizeRef.current) return;
    colResizeRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* */
    }
    setColWidths((w) => {
      persistConsultaEstoqueColWidths(w);
      return w;
    });
  }, []);

  const gradeResetRef = useRef<() => void>(() => {});
  gradeResetRef.current = () => {
    grade.limparFiltrosGrade();
    grade.setSortLevels([...SORT_DEFAULT_CONSULTA_ESTOQUE]);
  };

  const carregarOpcoes = useCallback(async () => {
    setOpcoesCarregando(true);
    setMsgFiltro(null);
    try {
      const r = await obterOpcoesFiltroConsultaEstoque();
      if (r.error) {
        setMsgFiltro(r.error);
        opcoesCarregadasRef.current = false;
        return;
      }
      if (r.data) {
        setOpcoesFiltro(r.data);
        opcoesCarregadasRef.current = r.data.tipos.length > 0;
        if (r.data.tipos.length === 0) {
          setMsgFiltro('Não foi possível carregar as opções de filtro. Tente novamente.');
        }
      }
    } finally {
      setOpcoesCarregando(false);
    }
  }, []);

  /** Abre com modal de filtros: carrega opções na montagem (mesmo critério do botão Consultar). */
  useEffect(() => {
    if (!opcoesCarregadasRef.current) {
      void carregarOpcoes();
    }
  }, [carregarOpcoes]);

  /** Cascata só para dimensões de catálogo (evita query Nomus a cada busca de código/descrição). */
  const cascataDeps = useMemo(
    () =>
      [
        filtros.tipos,
        filtros.grupos,
        filtros.coletas,
        filtros.setoresProducao,
        filtros.subgrupo1,
        filtros.subgrupo2,
      ].join('\u0001'),
    [
      filtros.tipos,
      filtros.grupos,
      filtros.coletas,
      filtros.setoresProducao,
      filtros.subgrupo1,
      filtros.subgrupo2,
    ]
  );

  useEffect(() => {
    if (!filtrosPopoverAberto || !opcoesCarregadasRef.current) return;
    const t = window.setTimeout(() => {
      void obterOpcoesFiltroCascataConsultaEstoque(
        filtrosStateToPayload(filtrosRef.current, pedidoFiltroRef.current)
      ).then((r) => {
        if (r.data) setOpcoesFiltro(r.data);
      });
    }, 450);
    return () => window.clearTimeout(t);
  }, [filtrosPopoverAberto, cascataDeps]);

  useEffect(() => {
    if (!filtrosPopoverAberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFiltrosPopoverAberto(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [filtrosPopoverAberto]);

  const executarConsulta = useCallback(
    async (
      f: FiltrosConsultaEstoqueState,
      pf: PedidoFiltroConsultaEstoque,
      req: boolean
    ) => {
      detalheCacheRef.current.clear();
      pcDetalheCacheRef.current.clear();
      gradeResetRef.current();
      setLoading(true);
      setErroApi(null);
      const payload = filtrosStateToPayload(f, pf);
      const r = await consultarEstoque({
        filtros: payload,
        considerarRequisicoes: req,
      });
      setLoading(false);
      if (r.error) {
        setErroApi(r.error);
        setLinhas([]);
        return;
      }
      if (pf.pedido && pf.modoPedido && pf.empenhoEscopo) {
        setConsultaPedidoResumo({
          idPedido: pf.pedido.id,
          pedidoNome: pf.pedido.nome,
          modoPedido: pf.modoPedido,
          empenhoEscopo: pf.empenhoEscopo,
        });
      } else {
        setConsultaPedidoResumo(null);
      }
      setLinhas(r.data);
      setMostrarGrade(true);
    },
    []
  );

  /** Hidrata filtros vindos do Painel de Cobertura de Estoque. */
  useEffect(() => {
    const st = location.state as {
      coberturaEstoqueFiltros?: {
        filtros: FiltrosConsultaEstoqueState;
        pedidoFiltro: PedidoFiltroConsultaEstoque;
        considerarRequisicoes: boolean;
      };
    } | null;
    const incoming = st?.coberturaEstoqueFiltros;
    if (!incoming) return;
    navigate(location.pathname, { replace: true, state: null });
    setFiltros(incoming.filtros);
    setPedidoFiltro(incoming.pedidoFiltro);
    setConsiderarRequisicoes(Boolean(incoming.considerarRequisicoes));
    if (!filtrosConsultaTemAlgumSelecionado(incoming.filtros, incoming.pedidoFiltro.pedido)) {
      setFiltrosPopoverAberto(true);
      return;
    }
    setFiltrosPopoverAberto(false);
    void executarConsulta(
      incoming.filtros,
      incoming.pedidoFiltro,
      Boolean(incoming.considerarRequisicoes)
    );
  }, [location.state, location.pathname, navigate, executarConsulta]);

  const buscarPedidoAsync = useCallback(async (term: string) => {
    const q = term.trim();
    if (q.length < 2) return [];
    const r = await buscarPedidosGerenciadorTypeahead(q);
    return r.data.map(pedidoToOptionItem);
  }, []);

  const buscarCodigoAsync = useCallback(async (term: string) => {
    const r = await buscarOpcoesFiltroConsultaEstoque(
      'codigo',
      term,
      filtrosStateToPayload(filtrosRef.current, pedidoFiltroRef.current)
    );
    return r.data;
  }, []);

  const buscarDescricaoAsync = useCallback(async (term: string) => {
    const r = await buscarOpcoesFiltroConsultaEstoque(
      'descricao',
      term,
      filtrosStateToPayload(filtrosRef.current, pedidoFiltroRef.current)
    );
    return r.data;
  }, []);

  const handleConsultarClick = () => {
    setFiltrosPopoverAberto(true);
    if (!opcoesCarregadasRef.current) {
      void carregarOpcoes();
    }
  };

  const handleLimparFiltros = () => {
    setFiltros(EMPTY_FILTROS);
    setPedidoFiltro(EMPTY_PEDIDO_FILTRO);
    setMsgFiltro(null);
  };

  const handlePedidoChange = (pedido: OptionItem | null) => {
    if (!pedido) {
      setPedidoFiltro(EMPTY_PEDIDO_FILTRO);
      return;
    }
    if (pedidoFiltro.pedido?.id === pedido.id && pedidoFiltro.modoPedido && pedidoFiltro.empenhoEscopo) {
      return;
    }
    setPedidoFiltro({
      pedido,
      modoPedido: pedidoFiltro.pedido?.id === pedido.id ? pedidoFiltro.modoPedido : null,
      empenhoEscopo: pedidoFiltro.pedido?.id === pedido.id ? pedidoFiltro.empenhoEscopo : null,
    });
    setPedidoPendenteEscolha(pedido);
    setEscolhaModoTemp(pedidoFiltro.pedido?.id === pedido.id ? pedidoFiltro.modoPedido : null);
    setConfirmEscolhasPedidoAberto(true);
  };

  const confirmarEscolhasPedido = (escopo: EmpenhoEscopoConsultaEstoque) => {
    if (!pedidoPendenteEscolha || !escolhaModoTemp) return;
    setPedidoFiltro({
      pedido: pedidoPendenteEscolha,
      modoPedido: escolhaModoTemp,
      empenhoEscopo: escopo,
    });
    setConfirmEscolhasPedidoAberto(false);
    setPedidoPendenteEscolha(null);
    setEscolhaModoTemp(null);
  };

  const cancelarEscolhasPedido = () => {
    setConfirmEscolhasPedidoAberto(false);
    setPedidoPendenteEscolha(null);
    setEscolhaModoTemp(null);
    if (!pedidoFiltro.modoPedido || !pedidoFiltro.empenhoEscopo) {
      setPedidoFiltro(EMPTY_PEDIDO_FILTRO);
    }
  };

  const handleAlterarEscolhasPedido = () => {
    if (!pedidoFiltro.pedido) return;
    setPedidoPendenteEscolha(pedidoFiltro.pedido);
    setEscolhaModoTemp(pedidoFiltro.modoPedido);
    setConfirmEscolhasPedidoAberto(true);
  };

  const handleFiltrar = async () => {
    if (!filtrosConsultaTemAlgumSelecionado(filtros, pedidoFiltro.pedido)) {
      setMsgFiltro('Informe ao menos um filtro.');
      return;
    }
    if (pedidoFiltro.pedido && (!pedidoFiltro.modoPedido || !pedidoFiltro.empenhoEscopo)) {
      setMsgFiltro('Conclua as escolhas do pedido de venda (visualização e empenho).');
      return;
    }
    setMsgFiltro(null);
    setErroApi(null);
    setFiltrosPopoverAberto(false);
    setLoading(true);
    const countRes = await contarConsultaEstoque({
      filtros: filtrosStateToPayload(filtros, pedidoFiltro),
    });
    setLoading(false);
    if (countRes.error) {
      setErroApi(countRes.error);
      setFiltrosPopoverAberto(true);
      return;
    }
    if (countRes.total > CONSULTA_ESTOQUE_CONFIRM_ROWS) {
      setConfirmVolumeTotal(countRes.total);
      setConfirmVolumeAberto(true);
      return;
    }
    void executarConsulta(filtros, pedidoFiltro, considerarRequisicoes);
  };

  const confirmarVolume = (sim: boolean) => {
    setConfirmVolumeAberto(false);
    if (!sim) {
      setFiltrosPopoverAberto(true);
      return;
    }
    void executarConsulta(filtros, pedidoFiltro, considerarRequisicoes);
  };

  const handleToggleRequisicoes = () => {
    const proximo = !considerarRequisicoes;
    setConsiderarRequisicoes(proximo);
    if (!mostrarGrade) return;
    void executarConsulta(filtrosRef.current, pedidoFiltroRef.current, proximo);
  };

  const cellNum = (n: number) => fmtQtde(n);

  const empenhoCtx = consultaPedidoResumo
    ? { escopo: consultaPedidoResumo.empenhoEscopo, idPedido: consultaPedidoResumo.idPedido }
    : undefined;

  const detailKey =
    detalhe && detalhe.tipo !== 'pc'
      ? detalheModalCacheKey(detalhe.tipo, detalhe.linha.idProduto, considerarRequisicoes, empenhoCtx)
      : null;

  const carregarDetalheModal = useCallback(async (): Promise<{ error?: string }> => {
    if (!detalhe || detalhe.tipo === 'pc') return {};
    const id = detalhe.linha.idProduto;
    const resumo = consultaPedidoResumoRef.current;
    const ctx = resumo
      ? { escopo: resumo.empenhoEscopo, idPedido: resumo.idPedido }
      : undefined;
    const cacheKey = detalheModalCacheKey(detalhe.tipo, id, considerarRequisicoes, ctx);
    const cached = detalheCacheRef.current.get(cacheKey);
    if (cached) {
      if (detalhe.tipo === 'saldo') setDetalheSaldo(cached as SaldoSetorDetalhe[]);
      else if (detalhe.tipo === 'empenho') {
        setDetalheEmpenhoLiquido(cached as RessupEmpenhoPedidoResultado);
      } else if (detalhe.tipo === 'solicitacao') setDetalheSc(cached as ScDetalhe[]);
      else setDetalheCotacao(cached as CotacaoDetalhe[]);
      return {};
    }
    if (detalhe.tipo === 'saldo') {
      const r = await obterSaldoDetalhe(id);
      if (!r.error) detalheCacheRef.current.set(cacheKey, r.data);
      setDetalheSaldo(r.data);
      return { error: r.error };
    }
    if (detalhe.tipo === 'empenho') {
      const idPedidoFiltro =
        resumo?.empenhoEscopo === 'pedido' ? resumo.idPedido : undefined;
      const rLiquido = await obterRessupEmpenhoPorPedido(
        id,
        considerarRequisicoes,
        false,
        idPedidoFiltro
      );
      if (!rLiquido.error && rLiquido.data) detalheCacheRef.current.set(cacheKey, rLiquido.data);
      setDetalheEmpenhoLiquido(rLiquido.data);
      return { error: rLiquido.error };
    }
    if (detalhe.tipo === 'solicitacao') {
      const r = await obterScDetalhe(id);
      if (!r.error) detalheCacheRef.current.set(cacheKey, r.data);
      setDetalheSc(r.data);
      return { error: r.error };
    }
    const r = await obterCotacaoDetalhe(id);
    if (!r.error) detalheCacheRef.current.set(cacheKey, r.data);
    setDetalheCotacao(r.data);
    return { error: r.error };
  }, [detalhe, considerarRequisicoes]);

  useEffect(() => {
    if (!detalhe || detalhe.tipo === 'pc') {
      setDetalheSaldo([]);
      setDetalheEmpenhoLiquido(null);
      setDetalheSc([]);
      setDetalheCotacao([]);
    }
  }, [detalhe]);

  return (
    <div className="relative flex flex-1 min-h-0 flex-col gap-3 overflow-hidden p-3 md:p-4">
      <CarregandoInformacoesOverlay
        show={loading}
        mensagem="Consultando estoque no Nomus…"
        mode="contained"
      />
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-start gap-2">
          <div>
            <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Consulta de Estoque</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Visualização em tempo real — sem histórico gravado.
            </p>
          </div>
          <ComoLerBtn
            onClick={() => setModalAjudaAberto(true)}
            title="Como ler a Consulta de Estoque — saldo, empenho e filtros"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {colunasOcultasLista.length > 0 && (
            <div className="relative" ref={colunasOcultasRef}>
              <button
                type="button"
                onClick={() => setColunasOcultasOpen((o) => !o)}
                className={BTN_COLUNAS_OCULTAS}
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
                        key={col.key}
                        type="button"
                        onClick={() => reexibirColuna(col.key)}
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
          <button type="button" className={BTN_PRIMARY} onClick={handleConsultarClick}>
            Consultar estoque
          </button>
        </div>
      </div>

      {erroApi && (
        <p className="text-sm text-red-600 dark:text-red-300" role="alert">
          {erroApi}
        </p>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 dark:border-slate-600">
        {mostrarGrade && (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-300">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {consultaPedidoResumo && (
                <>
                  <span>
                    Pedido:{' '}
                    <strong className="text-slate-800 dark:text-slate-100">
                      {consultaPedidoResumo.pedidoNome}
                    </strong>
                  </span>
                  <span className="text-slate-400">·</span>
                  <span>
                    Visualização:{' '}
                    <strong className="text-slate-800 dark:text-slate-100">
                      {rotuloModoPedido(consultaPedidoResumo.modoPedido)}
                    </strong>
                  </span>
                  <span className="text-slate-400">·</span>
                  <span>
                    Empenho:{' '}
                    <strong className="text-slate-800 dark:text-slate-100">
                      {rotuloEmpenhoEscopo(consultaPedidoResumo.empenhoEscopo)}
                    </strong>
                  </span>
                  <span className="text-slate-400">·</span>
                </>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={considerarRequisicoes}
                  aria-label="Considerar requisições de loja no empenho"
                  disabled={loading}
                  onClick={handleToggleRequisicoes}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50 ${
                    considerarRequisicoes ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${
                      considerarRequisicoes ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  Requisições de loja
                </span>
              </div>
            </div>
            {linhas.length > 0 && (
              <span className="tabular-nums text-slate-500 dark:text-slate-400">
                {grade.rowsExibidas.length === linhas.length
                  ? `${linhas.length} produto${linhas.length === 1 ? '' : 's'}`
                  : `${grade.rowsExibidas.length} de ${linhas.length} produto${linhas.length === 1 ? '' : 's'}`}
              </span>
            )}
          </div>
        )}
        <div
          ref={grade.tableScrollRef}
          className="min-h-0 flex-1 overflow-auto overscroll-contain"
        >
          <table
            className="w-full border-separate border-spacing-0 text-xs"
            style={{ tableLayout: 'fixed', minWidth: larguraMinimaTabela }}
          >
            <colgroup>
              {colunasVisiveisLista.map((col) => (
                <col
                  key={col.key}
                  style={{ width: colWidths[col.key] ?? CONSULTA_ESTOQUE_DEFAULT_COL_WIDTHS[col.key] ?? 96 }}
                />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="bg-primary-600 text-white">
                {colunasVisiveisLista.map((c) => {
                  const sortAtivo =
                    grade.sortState?.key === c.key || grade.sortLevels.some((l) => l.id === c.key);
                  return (
                  <th
                    key={c.key}
                    className={`sticky top-0 z-30 relative border border-primary-500/40 bg-primary-600 px-2 py-2 font-semibold shadow-[0_1px_0_rgba(0,0,0,0.08)] ${
                      c.align === 'center' ? 'text-center' : 'text-left'
                    }`}
                  >
                    <div className="flex min-w-0 items-start justify-between gap-1">
                      <span className="min-w-0 flex-1 whitespace-normal break-words leading-tight" title={c.label}>
                        {c.key === 'empenho' ? (
                          <span className="inline-flex justify-center">
                            <RotuloComDica rotulo={c.label} dica={DICA_EMPENHO_LIQ_GRADE} headerClaro />
                          </span>
                        ) : c.key === 'saldo' ? (
                          <span className="inline-flex justify-center">
                            <RotuloComDica rotulo={c.label} dica={DICA_ESTOQUE_ATUAL_GRADE} headerClaro />
                          </span>
                        ) : (
                          c.label
                        )}
                      </span>
                      <span className="flex shrink-0 flex-col gap-0.5">
                        <GradeFiltroCabecalhoBtn
                          ativo={grade.colunaComFiltroAtivo(c.key) || sortAtivo}
                          onClick={(e) => grade.abrirFiltroExcel(c.key, e)}
                        />
                        <button
                          type="button"
                          onClick={() => ocultarColuna(c.key)}
                          disabled={colunasVisiveisLista.length <= 1}
                          className="inline-flex items-center justify-center rounded border border-white/25 px-1 py-0.5 text-white/80 hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                          title="Ocultar coluna"
                          aria-label={`Ocultar coluna ${c.label}`}
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
                    <span
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Redimensionar coluna ${c.label}`}
                      title="Arraste para ajustar a largura"
                      className="absolute right-0 top-0 z-20 h-full w-1.5 cursor-col-resize touch-none select-none hover:bg-sky-300/60 active:bg-sky-300"
                      onPointerDown={(e) => onColResizePointerDown(c.key, e)}
                      onPointerMove={onColResizePointerMove}
                      onPointerUp={onColResizePointerEnd}
                      onPointerCancel={onColResizePointerEnd}
                    />
                  </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {!mostrarGrade && (
                <tr>
                  <td colSpan={colunasVisiveisLista.length} className="py-12 text-center text-slate-500">
                    Clique em &quot;Consultar estoque&quot; para definir filtros e carregar a grade.
                  </td>
                </tr>
              )}
              {mostrarGrade && linhas.length === 0 && !loading && (
                <tr>
                  <td colSpan={colunasVisiveisLista.length} className="py-8 text-center text-slate-500">
                    Nenhum produto encontrado.
                  </td>
                </tr>
              )}
              {mostrarGrade && linhas.length > 0 && grade.rowsExibidas.length === 0 && !loading && (
                <tr>
                  <td colSpan={colunasVisiveisLista.length} className="py-8 text-center text-slate-500">
                    Nenhum produto com os filtros da grade. Ajuste ou limpe os filtros por coluna.
                  </td>
                </tr>
              )}
              {mostrarGrade &&
                grade.rowsExibidas.map((row) => (
                  <tr
                    key={row.idProduto}
                    className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50"
                  >
                    {colunasVisiveisLista.map((col) => {
                      if (col.key === 'codigo') {
                        return (
                          <td key={col.key} className="overflow-hidden px-2 py-1.5 font-mono truncate">
                            {row.codigo}
                          </td>
                        );
                      }
                      if (col.key === 'descricao') {
                        return (
                          <td key={col.key} className="overflow-hidden px-2 py-1.5 truncate" title={row.descricao}>
                            {row.descricao}
                          </td>
                        );
                      }
                      if (col.key === 'und') {
                        return (
                          <td key={col.key} className="overflow-hidden px-2 py-1.5">
                            {row.unidadeMedida || '—'}
                          </td>
                        );
                      }
                      if (!isNumKey(col.key)) return null;
                      const val = row[col.key];
                      const clickable = col.clickable;
                      const saldoNegativo = col.key === 'saldoProjetado' && val <= 0;
                      const tipoDetalhe = detalheTipoDaColuna(col.key);
                      return (
                        <td
                          key={col.key}
                          className={`overflow-hidden px-2 py-1.5 text-center tabular-nums ${
                            saldoNegativo ? SALDO_PROJETADO_NEG_CLASS : ''
                          }`}
                        >
                          {clickable && tipoDetalhe ? (
                            <GradeCelulaModalBtn
                              onClick={() =>
                                setDetalhe({
                                  tipo: tipoDetalhe,
                                  linha: row,
                                })
                              }
                            >
                              {cellNum(val)}
                            </GradeCelulaModalBtn>
                          ) : (
                            <span className="font-medium">{cellNum(val)}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <ModalFiltrosConsultaEstoque
        open={filtrosPopoverAberto}
        carregando={opcoesCarregando}
        msgFiltro={msgFiltro}
        filtros={filtros}
        pedidoFiltro={pedidoFiltro}
        opcoes={opcoesFiltro}
        onBuscarPedido={buscarPedidoAsync}
        onClose={() => setFiltrosPopoverAberto(false)}
        onChange={(patch) => setFiltros((prev) => ({ ...prev, ...patch }))}
        onPedidoChange={handlePedidoChange}
        onAlterarEscolhasPedido={handleAlterarEscolhasPedido}
        onLimpar={handleLimparFiltros}
        onFiltrar={handleFiltrar}
        onBuscarCodigo={buscarCodigoAsync}
        onBuscarDescricao={buscarDescricaoAsync}
      />

      {grade.colunaFiltroAberta && grade.filtroAbertoRect && (
        <GradeFiltroExcelPortal
          colunaAberta={grade.colunaFiltroAberta}
          rect={grade.filtroAbertoRect}
          dropdownRef={grade.filtroDropdownRef}
          excelFilterDrafts={grade.excelFilterDrafts}
          setExcelFilterDrafts={grade.setExcelFilterDrafts}
          valoresUnicosPorColuna={grade.valoresUnicosPorColuna}
          sortAscLabel={getOrderLabelsForConsultaEstoqueCol(grade.colunaFiltroAberta).asc}
          sortDescLabel={getOrderLabelsForConsultaEstoqueCol(grade.colunaFiltroAberta).desc}
          showNumericFilters={isConsultaEstoqueColNumeric(grade.colunaFiltroAberta)}
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

      {confirmEscolhasPedidoAberto && pedidoPendenteEscolha && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <div className="max-w-lg rounded-xl bg-white p-5 shadow-xl dark:bg-slate-800">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
              Pedido <strong>{pedidoPendenteEscolha.nome}</strong>
            </p>
            <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
              Como visualizar os produtos?
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className={`flex-1 rounded-lg border px-3 py-2 text-sm text-left ${
                  escolhaModoTemp === 'diretos'
                    ? 'border-primary-500 bg-primary-50 dark:border-primary-500 dark:bg-primary-900/30'
                    : 'border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700'
                }`}
                onClick={() => setEscolhaModoTemp('diretos')}
              >
                <span className="font-medium">Itens diretos do pedido</span>
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                  Produtos nas linhas do pedido
                </span>
              </button>
              <button
                type="button"
                className={`flex-1 rounded-lg border px-3 py-2 text-sm text-left ${
                  escolhaModoTemp === 'componentes'
                    ? 'border-primary-500 bg-primary-50 dark:border-primary-500 dark:bg-primary-900/30'
                    : 'border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700'
                }`}
                onClick={() => setEscolhaModoTemp('componentes')}
              >
                <span className="font-medium">Componentes do pedido</span>
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                  Explosão BOM dos itens
                </span>
              </button>
            </div>
            <p className="mt-4 text-sm text-slate-700 dark:text-slate-200">
              Como calcular o empenho?
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-left hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-700"
                onClick={() => confirmarEscolhasPedido('pedido')}
                disabled={!escolhaModoTemp}
              >
                <span className="font-medium">Somente deste pedido</span>
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-left hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-700"
                onClick={() => confirmarEscolhasPedido('todos')}
                disabled={!escolhaModoTemp}
              >
                <span className="font-medium">Todos os pedidos do sistema</span>
              </button>
            </div>
            {!escolhaModoTemp && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                Escolha primeiro como visualizar os produtos.
              </p>
            )}
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                onClick={cancelarEscolhasPedido}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmVolumeAberto && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <div className="max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-slate-800">
            <p className="text-sm text-slate-800 dark:text-slate-100">
              Sua busca irá trazer o resultado de <strong>{confirmVolumeTotal}</strong> produtos, deseja
              continuar?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border px-3 py-1.5 text-sm dark:border-slate-600 dark:text-slate-200"
                onClick={() => confirmarVolume(false)}
              >
                Não
              </button>
              <button
                type="button"
                className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm text-white"
                onClick={() => confirmarVolume(true)}
              >
                Sim
              </button>
            </div>
          </div>
        </div>
      )}

      {detalhe?.tipo === 'pc' && (
        <ModalPcPendDetalhes
          open
          idProduto={detalhe.linha.idProduto}
          codigo={detalhe.linha.codigo}
          descricao={detalhe.linha.descricao}
          onClose={() => setDetalhe(null)}
          cacheRef={pcDetalheCacheRef}
        />
      )}

      {detalhe && detalhe.tipo !== 'pc' && (
        <ModalConsultaEstoqueDetalhe
          open
          titulo={
            detalhe.tipo === 'saldo'
              ? `Estoque atual — ${detalhe.linha.codigo}`
              : detalhe.tipo === 'empenho'
                ? `Empenho — ${detalhe.linha.codigo}`
                : detalhe.tipo === 'solicitacao'
                  ? `Solicitação de compra — ${detalhe.linha.codigo}`
                  : `Pré Compra — ${detalhe.linha.codigo}`
          }
          subtitulo={detalhe.linha.descricao}
          onClose={() => setDetalhe(null)}
          detailKey={detailKey}
          onLoad={carregarDetalheModal}
          largo={detalhe.tipo === 'empenho'}
        >
          {({ carregando, erro }) => {
            if (carregando) return <p className="py-6 text-center text-slate-500">Carregando…</p>;
            if (erro) return <p className="text-red-600">{erro}</p>;
            if (detalhe.tipo === 'saldo') {
              if (detalheSaldo.length === 0) return <p className="text-slate-500">Sem saldo nos setores aplicáveis.</p>;
              const saldoSetor2 = detalheSaldo
                .filter((s) => s.idSetor === SETOR_ALMOX_SECUNDARIO)
                .reduce((acc, s) => acc + s.saldo, 0);
              const saldoEstoquePa = detalheSaldo
                .filter((s) => isSetorEstoquePa(s.idSetor))
                .reduce((acc, s) => acc + s.saldo, 0);
              const destacarAlmoxSec = saldoSetor2 > 0;
              const totalSaldo = detalhe.linha.saldo;
              return (
                <>
                  <div
                    className={`mb-3 grid gap-2 ${
                      destacarAlmoxSec ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'
                    }`}
                  >
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-900/40">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        <RotuloComDica rotulo="Estoque em PA" dica={DICA_ESTOQUE_PA_SALDO} />
                      </div>
                      <div className="text-sm font-medium tabular-nums">{fmtQtde(saldoEstoquePa)}</div>
                    </div>
                    {destacarAlmoxSec && (
                      <div className="rounded-lg border border-amber-300 bg-amber-50/90 px-3 py-2 dark:border-amber-700 dark:bg-amber-900/25">
                        <div className="text-[11px] font-medium text-amber-800 dark:text-amber-300">
                          Almox secundário
                        </div>
                        <div className="text-sm font-semibold tabular-nums text-amber-900 dark:text-amber-100">
                          {fmtQtde(saldoSetor2)}
                        </div>
                      </div>
                    )}
                    <div className="rounded-lg border border-primary-200 bg-primary-50/80 px-3 py-2 dark:border-primary-800 dark:bg-primary-900/30">
                      <div className="text-[11px] font-medium text-primary-700 dark:text-primary-300">Total</div>
                      <div className="text-sm font-semibold tabular-nums">{fmtQtde(totalSaldo)}</div>
                    </div>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-slate-50 dark:bg-slate-900/50">
                        <th className="py-2 text-left">Setor</th>
                        <th className="py-2 text-right">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalheSaldo.map((s) => (
                        <tr
                          key={s.idSetor}
                          className={`border-b border-slate-100 dark:border-slate-700 ${
                            s.idSetor === SETOR_ALMOX_SECUNDARIO
                              ? 'bg-amber-50/60 dark:bg-amber-900/15'
                              : ''
                          }`}
                        >
                          <td className="py-1.5">{s.setor}</td>
                          <td className="py-1.5 text-right tabular-nums">{fmtQtde(s.saldo)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              );
            }
            if (detalhe.tipo === 'empenho') {
              const saldoAtual = detalhe.linha.saldo;
              if (!detalheEmpenhoLiquido) {
                return <p className="text-slate-500">Sem empenho.</p>;
              }
              return (
                <EmpenhoLiquidoPainel
                  detalhe={detalheEmpenhoLiquido}
                  codigo={detalhe.linha.codigo}
                  descricao={detalhe.linha.descricao}
                  saldoAtual={saldoAtual}
                  rotuloTotal="Empenho líquido"
                  mostrarCards
                  layoutSticky
                />
              );
            }
            if (detalhe.tipo === 'solicitacao') {
              return <TabelaDetalheSolicitacao linhas={detalheSc} />;
            }
            return <TabelaDetalheCotacao linhas={detalheCotacao} />;
          }}
        </ModalConsultaEstoqueDetalhe>
      )}
      <ConsultaEstoqueAjudaModal aberto={modalAjudaAberto} onClose={() => setModalAjudaAberto(false)} />
    </div>
  );
}
