import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import GradeFiltroCabecalhoBtn from '../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../components/grade/GradeFiltroExcelPortal';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import CarregandoInformacoesOverlay from '../../components/CarregandoInformacoesOverlay';
import ModalPcPendDetalhes from '../../components/ressupAlmox/ModalPcPendDetalhes';
import EmpenhoLiquidoPainel from '../../components/ressupAlmox/EmpenhoLiquidoPainel';
import RotuloComDica from '../../components/ressupAlmox/RotuloComDica';
import { DICA_EMPENHO_LIQ_GRADE } from '../../components/ressupAlmox/empenhoModalUtils';
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
import {
  getOrderLabelsForConsultaEstoqueCol,
  isConsultaEstoqueColNumeric,
  SORT_DEFAULT_CONSULTA_ESTOQUE,
} from '../../utils/consultaEstoqueGradeSort';

const COLS = [
  { key: 'codigo', label: 'Código', clickable: false, align: 'left' as const },
  { key: 'descricao', label: 'Descrição', clickable: false, align: 'left' as const },
  { key: 'und', label: 'Und', clickable: false, align: 'left' as const },
  { key: 'empenho', label: 'Empenho', clickable: true as const, align: 'center' as const },
  { key: 'saldo', label: 'Estoque atual', clickable: true as const, align: 'center' as const },
  { key: 'solicitacao', label: 'Solicitação', clickable: true as const, align: 'center' as const },
  { key: 'cotacao', label: 'Ag Pag', clickable: true as const, align: 'center' as const },
  { key: 'pedidoCompra', label: 'Pedido compra', clickable: true as const, align: 'center' as const },
  { key: 'saldoProjetado', label: 'Saldo projetado', clickable: false, align: 'center' as const },
] as const;

type ColKey = (typeof COLS)[number]['key'];

const NUM_KEYS = ['empenho', 'saldo', 'solicitacao', 'cotacao', 'pedidoCompra', 'saldoProjetado'] as const;

const COL_KEYS: ColKey[] = COLS.map((c) => c.key);

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
};

const BTN_PRIMARY =
  'inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50';

type DetalheModal =
  | { tipo: 'saldo'; linha: ConsultaEstoqueLinha }
  | { tipo: 'empenho'; linha: ConsultaEstoqueLinha }
  | { tipo: 'solicitacao'; linha: ConsultaEstoqueLinha }
  | { tipo: 'cotacao'; linha: ConsultaEstoqueLinha }
  | { tipo: 'pc'; linha: ConsultaEstoqueLinha };

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
  const [filtrosPopoverAberto, setFiltrosPopoverAberto] = useState(false);
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
  const [considerarRequisicoes, setConsiderarRequisicoes] = useState(false);
  const [confirmRequisicoesAberto, setConfirmRequisicoesAberto] = useState(false);
  const [confirmLargeAberto, setConfirmLargeAberto] = useState(false);
  const [pendingConsulta, setPendingConsulta] = useState<{
    filtros: FiltrosConsultaEstoqueState;
    pedidoFiltro: PedidoFiltroConsultaEstoque;
    considerarRequisicoes: boolean;
  } | null>(null);
  const [truncatedInfo, setTruncatedInfo] = useState<{ total: number } | null>(null);
  const [detalhe, setDetalhe] = useState<DetalheModal | null>(null);
  const [detalheSaldo, setDetalheSaldo] = useState<SaldoSetorDetalhe[]>([]);
  const [detalheEmpenhoLiquido, setDetalheEmpenhoLiquido] = useState<RessupEmpenhoPedidoResultado | null>(null);
  const [detalheSc, setDetalheSc] = useState<ScDetalhe[]>([]);
  const [detalheCotacao, setDetalheCotacao] = useState<CotacaoDetalhe[]>([]);

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
      req: boolean,
      confirmLarge?: boolean
    ) => {
      detalheCacheRef.current.clear();
      pcDetalheCacheRef.current.clear();
      gradeResetRef.current();
      setLoading(true);
      setErroApi(null);
      setTruncatedInfo(null);
      const payload = filtrosStateToPayload(f, pf);
      const r = await consultarEstoque({
        filtros: payload,
        considerarRequisicoes: req,
        confirmLarge,
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
      if (r.truncated && !confirmLarge) {
        setTruncatedInfo({ total: r.total });
        setConfirmLargeAberto(true);
        setPendingConsulta({ filtros: f, pedidoFiltro: pf, considerarRequisicoes: req });
        setLinhas(r.data);
        setMostrarGrade(true);
        return;
      }
      setLinhas(r.data);
      setMostrarGrade(true);
      setTruncatedInfo(null);
      setConfirmLargeAberto(false);
      setPendingConsulta(null);
    },
    []
  );

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

  const handleFiltrar = () => {
    if (!filtrosConsultaTemAlgumSelecionado(filtros, pedidoFiltro.pedido)) {
      setMsgFiltro('Informe ao menos um filtro.');
      return;
    }
    if (pedidoFiltro.pedido && (!pedidoFiltro.modoPedido || !pedidoFiltro.empenhoEscopo)) {
      setMsgFiltro('Conclua as escolhas do pedido de venda (visualização e empenho).');
      return;
    }
    setMsgFiltro(null);
    setFiltrosPopoverAberto(false);
    setConfirmRequisicoesAberto(true);
  };

  const confirmarRequisicoes = (sim: boolean) => {
    setConsiderarRequisicoes(sim);
    setConfirmRequisicoesAberto(false);
    if (pendingConsulta) {
      void executarConsulta(
        pendingConsulta.filtros,
        pendingConsulta.pedidoFiltro,
        sim,
        true
      );
    } else {
      void executarConsulta(filtros, pedidoFiltro, sim);
    }
  };

  const voltarConfirmRequisicoes = () => {
    setConfirmRequisicoesAberto(false);
    setFiltrosPopoverAberto(true);
  };

  const confirmarLarge = (sim: boolean) => {
    setConfirmLargeAberto(false);
    if (!sim || !pendingConsulta) {
      setPendingConsulta(null);
      return;
    }
    void executarConsulta(
      pendingConsulta.filtros,
      pendingConsulta.pedidoFiltro,
      pendingConsulta.considerarRequisicoes,
      true
    );
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
        <div>
          <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Consulta de Estoque</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Visualização em tempo real — sem histórico gravado.
          </p>
        </div>
        <button type="button" className={BTN_PRIMARY} onClick={handleConsultarClick}>
          Consultar estoque
        </button>
      </div>

      {erroApi && (
        <p className="text-sm text-red-600 dark:text-red-300" role="alert">
          {erroApi}
        </p>
      )}

      {truncatedInfo && (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Exibindo as primeiras linhas. Confirme para carregar todas as {truncatedInfo.total} linhas.
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
              <span>
                Requisições de loja:{' '}
                <strong className="text-slate-800 dark:text-slate-100">
                  {considerarRequisicoes ? 'Sim' : 'Não'}
                </strong>
              </span>
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
          <table className="w-full min-w-[960px] border-collapse text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-primary-600 text-white">
                {COLS.map((c) => {
                  const sortAtivo =
                    grade.sortState?.key === c.key || grade.sortLevels.some((l) => l.id === c.key);
                  return (
                  <th
                    key={c.key}
                    className={`relative border border-primary-500/40 bg-primary-600 px-2 py-2 font-semibold ${
                      c.align === 'center' ? 'text-center' : 'text-left'
                    }`}
                  >
                    <div
                      className={`flex min-w-0 items-start gap-1 ${
                        c.align === 'center' ? 'justify-center' : 'justify-between'
                      }`}
                    >
                      <span className="min-w-0 flex-1 leading-tight">
                        {c.key === 'empenho' ? (
                          <span className="inline-flex justify-center">
                            <RotuloComDica rotulo={c.label} dica={DICA_EMPENHO_LIQ_GRADE} headerClaro />
                          </span>
                        ) : (
                          c.label
                        )}
                      </span>
                      <GradeFiltroCabecalhoBtn
                        ativo={grade.colunaComFiltroAtivo(c.key) || sortAtivo}
                        onClick={(e) => grade.abrirFiltroExcel(c.key, e)}
                      />
                    </div>
                  </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {!mostrarGrade && (
                <tr>
                  <td colSpan={COLS.length} className="py-12 text-center text-slate-500">
                    Clique em &quot;Consultar estoque&quot; para definir filtros e carregar a grade.
                  </td>
                </tr>
              )}
              {mostrarGrade && linhas.length === 0 && !loading && (
                <tr>
                  <td colSpan={COLS.length} className="py-8 text-center text-slate-500">
                    Nenhum produto encontrado.
                  </td>
                </tr>
              )}
              {mostrarGrade && linhas.length > 0 && grade.rowsExibidas.length === 0 && !loading && (
                <tr>
                  <td colSpan={COLS.length} className="py-8 text-center text-slate-500">
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
                    <td className="px-2 py-1.5 font-mono">{row.codigo}</td>
                    <td className="px-2 py-1.5 max-w-[240px] truncate" title={row.descricao}>
                      {row.descricao}
                    </td>
                    <td className="px-2 py-1.5">{row.unidadeMedida || '—'}</td>
                    {NUM_KEYS.map((k) => {
                      const clickable = k !== 'saldoProjetado';
                      const val = row[k];
                      const saldoNegativo = k === 'saldoProjetado' && val <= 0;
                      return (
                        <td
                          key={k}
                          className={`px-2 py-1.5 text-center tabular-nums ${
                            saldoNegativo ? SALDO_PROJETADO_NEG_CLASS : ''
                          }`}
                        >
                          {clickable ? (
                            <GradeCelulaModalBtn
                              onClick={() =>
                                setDetalhe({
                                  tipo:
                                    k === 'solicitacao'
                                      ? 'solicitacao'
                                      : k === 'pedidoCompra'
                                        ? 'pc'
                                        : k,
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

      {confirmRequisicoesAberto && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <div className="max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-slate-800">
            <p className="text-sm text-slate-800 dark:text-slate-100">
              Deseja considerar requisições no cálculo de <strong>Empenho</strong>?
            </p>
            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                onClick={voltarConfirmRequisicoes}
              >
                ← Voltar
              </button>
              <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg border px-3 py-1.5 text-sm"
                onClick={() => confirmarRequisicoes(false)}
              >
                Não
              </button>
              <button
                type="button"
                className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm text-white"
                onClick={() => confirmarRequisicoes(true)}
              >
                Sim
              </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmLargeAberto && truncatedInfo && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <div className="max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-slate-800">
            <p className="text-sm text-slate-800 dark:text-slate-100">
              Foram encontradas <strong>{truncatedInfo.total}</strong> linhas (limite inicial: 150). Deseja carregar
              todas?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border px-3 py-1.5 text-sm"
                onClick={() => confirmarLarge(false)}
              >
                Não, manter parcial
              </button>
              <button
                type="button"
                className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm text-white"
                onClick={() => confirmarLarge(true)}
              >
                Sim, carregar todas
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
                  : `Ag Pag — ${detalhe.linha.codigo}`
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
              const saldoMpp = detalheSaldo
                .filter((s) => s.idSetor !== SETOR_ALMOX_SECUNDARIO)
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
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">Estoque MPP</div>
                      <div className="text-sm font-medium tabular-nums">{fmtQtde(saldoMpp)}</div>
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
                          <td className="py-1.5">
                            {s.setor}
                            {s.idSetor === SETOR_ALMOX_SECUNDARIO ? (
                              <span className="ml-1 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                                (almox secundário)
                              </span>
                            ) : null}
                          </td>
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
    </div>
  );
}
