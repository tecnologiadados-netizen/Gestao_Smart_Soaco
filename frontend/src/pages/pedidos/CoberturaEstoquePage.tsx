import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Workbook } from 'exceljs';
import CarregandoInformacoesOverlay from '../../components/CarregandoInformacoesOverlay';
import CoberturaCapitalFamiliaPizza, {
  agruparCapitalPorFamiliaPie,
  COBERTURA_PIE_BUCKET_DEMAIS,
  COBERTURA_PIE_MAX_FATIAS,
} from '../../components/pcp/CoberturaCapitalFamiliaPizza';
import { ComoLerBtn } from '../../components/AjudaTelaModal';
import GradeFiltroCabecalhoBtn from '../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../components/grade/GradeFiltroExcelPortal';
import ModalFiltrosConsultaEstoque, {
  filtrosConsultaTemAlgumSelecionado,
  filtrosStateToPayload,
  ORIGENS_EMPENHO_COBERTURA_TODAS,
  origensEmpenhoIncluiRequisicoes,
  type FiltrosConsultaEstoqueState,
  type PedidoFiltroConsultaEstoque,
} from '../../components/pcp/ModalFiltrosConsultaEstoque';
import {
  buscarOpcoesFiltroConsultaEstoque,
  obterOpcoesFiltroCascataConsultaEstoque,
  obterOpcoesFiltroConsultaEstoque,
  obterCotacaoDetalhe,
  obterSaldoDetalhe,
  obterScDetalhe,
  type CotacaoDetalhe,
  type OpcoesFiltroConsultaEstoque,
  type SaldoSetorDetalhe,
  type ScDetalhe,
} from '../../api/consultaEstoque';
import {
  BARRA_PARA_KPI,
  BARRAS_FIRME_ORDEM,
  KPI_PARA_BARRAS,
  KPIS_FIRME_ORDEM,
  LABELS_BARRA_FIRME,
  LABELS_CLASSE_ATENDIMENTO,
  LABELS_KPI_FIRME,
  LABELS_STATUS_PAINEL,
  STATUS_PAINEL_SORT_ORDEM,
  SUBTITULOS_KPI_FIRME,
  obterPainelCoberturaEstoque,
  type AcaoSugeridaCobertura,
  type BarraFirme,
  type ClasseAtendimento,
  type CoberturaEstoqueLinha,
  type KpiFirme,
  type PainelCoberturaEstoqueData,
  type TotaisCompradorCobertura,
  type VisaoGradeCobertura,
} from '../../api/coberturaEstoque';
import { obterRessupEmpenhoPorPedido, type RessupEmpenhoPedidoResultado } from '../../api/compras';
import ModalConsultaEstoqueDetalhe, { fmtQtde } from '../../components/pcp/ModalConsultaEstoqueDetalhe';
import TabelaDetalheSolicitacao from '../../components/pcp/TabelaDetalheSolicitacao';
import TabelaDetalheCotacao from '../../components/pcp/TabelaDetalheCotacao';
import EmpenhoLiquidoPainel from '../../components/ressupAlmox/EmpenhoLiquidoPainel';
import ModalPcPendDetalhes from '../../components/ressupAlmox/ModalPcPendDetalhes';
import GradeCelulaModalBtn from '../../components/pcp/GradeCelulaModalBtn';
import CopiarTextoBtn from '../../components/CopiarTextoBtn';
import { isSetorEstoquePa } from '../../components/ressupAlmox/empenhoModalUtils';
import RotuloComDica from '../../components/ressupAlmox/RotuloComDica';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import { useGradeScrollIncremental } from '../../hooks/useGradeScrollIncremental';
import CoberturaEstoqueAjudaModal from './CoberturaEstoqueAjudaModal';

const EMPTY_OPCOES: OpcoesFiltroConsultaEstoque = {
  codigos: [],
  descricoes: [],
  tipos: [],
  grupos: [],
  coletas: [],
  setoresProducao: [],
  subgrupo1: [],
  subgrupo2: [],
  familias: [],
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

const EMPTY_PEDIDO: PedidoFiltroConsultaEstoque = {
  pedido: null,
  modoPedido: null,
  empenhoEscopo: null,
};

function payloadCobertura(filtros: FiltrosConsultaEstoqueState, somenteComEmpenho: boolean) {
  return {
    ...filtrosStateToPayload(filtros),
    comEmpenho: (somenteComEmpenho ? 'sim' : 'todos') as const,
    somenteAlmoxSecundario: true,
  };
}

const KPI_ACCENT: Record<KpiFirme, string> = {
  ruptura: 'border-l-red-600',
  aguardando_pc: 'border-l-violet-600',
  critico: 'border-l-orange-500',
  atencao: 'border-l-amber-400',
  saudavel: 'border-l-emerald-600',
  excesso: 'border-l-sky-600',
  sem_giro: 'border-l-slate-400',
  sem_historico: 'border-l-slate-500',
};

const KPI_NUMERO: Record<KpiFirme, string> = {
  ruptura: 'text-red-600 dark:text-red-400',
  aguardando_pc: 'text-violet-700 dark:text-violet-300',
  critico: 'text-orange-600 dark:text-orange-400',
  atencao: 'text-amber-600 dark:text-amber-300',
  saudavel: 'text-emerald-700 dark:text-emerald-400',
  excesso: 'text-sky-700 dark:text-sky-400',
  sem_giro: 'text-slate-600 dark:text-slate-300',
  sem_historico: 'text-slate-500 dark:text-slate-400',
};

const ATENDE_BG: Record<ClasseAtendimento, string> = {
  descoberto: 'bg-red-600',
  parcial: 'bg-amber-500',
  atendido: 'bg-emerald-600',
};

const ATENDE_TXT: Record<ClasseAtendimento, string> = {
  descoberto: 'text-red-600 dark:text-red-400',
  parcial: 'text-amber-700 dark:text-amber-300',
  atendido: 'text-emerald-700 dark:text-emerald-400',
};

const VISOES_GRADE: { id: VisaoGradeCobertura; label: string; title: string }[] = [
  { id: 'atende_venda', label: 'Atende venda', title: 'Itens com empenho > 0' },
  { id: 'cobertura', label: 'Cobertura', title: 'Itens com CM > 0' },
  { id: 'sem_giro', label: 'Sem giro', title: 'CM = 0 e empenho = 0' },
];

const BARRA_BG: Record<BarraFirme, string> = {
  lt0: 'bg-red-600',
  '0_05': 'bg-orange-500',
  '05_1': 'bg-amber-400',
  '1_2': 'bg-emerald-700',
  '2_3': 'bg-emerald-500',
  '3_6': 'bg-sky-700',
  gt6: 'bg-sky-400',
};

const LEYENDA_GRUPO: { label: string; className: string; span: number }[] = [
  { label: 'REPOR', className: 'bg-red-600', span: 2 },
  { label: 'VIGIAR', className: 'bg-amber-400 text-slate-900', span: 1 },
  { label: 'OPERAÇÃO NORMAL', className: 'bg-emerald-600', span: 2 },
  { label: 'CAPITAL PARADO', className: 'bg-sky-600', span: 2 },
];

const COLS = [
  { key: 'codigo', label: 'Código', align: 'left' as const },
  { key: 'descricao', label: 'Descrição', align: 'left' as const },
  {
    key: 'statusPainel',
    label: 'Status',
    align: 'left' as const,
    title: 'Status operacional em cascata (mesmos cards do painel)',
  },
  { key: 'consumoMedio', label: 'CM', align: 'center' as const, title: 'Consumo médio mensal' },
  {
    key: 'precoUnitario',
    label: 'Preço',
    align: 'center' as const,
    title: 'Última entrada qualificada com valor unitário > 0 (almox secundário, industrialização ou ajuste de preço)',
  },
  {
    key: 'atendimentoExibicao',
    label: 'Atende venda',
    align: 'center' as const,
    title: 'Estoque ÷ empenho (cap visual 100%). — se empenho = 0',
  },
  {
    key: 'faltante',
    label: 'Faltante',
    align: 'center' as const,
    title: 'max(0, empenho − estoque)',
  },
  {
    key: 'cobertura',
    label: 'Cobertura',
    align: 'center' as const,
    title: '(Estoque − empenho) ÷ CM em meses. — se CM ≤ 0 (não usa divisor 0,01)',
  },
  { key: 'empenho', label: 'Empenho', align: 'center' as const },
  { key: 'saldo', label: 'Estoque', align: 'center' as const },
  { key: 'solicitacao', label: 'SC', align: 'center' as const },
  { key: 'cotacao', label: 'Pré Compra', align: 'center' as const },
  { key: 'pedidoCompra', label: 'PC', align: 'center' as const },
  { key: 'saldoProjetado', label: 'Proj.', align: 'center' as const },
  {
    key: 'acaoSugerida',
    label: 'Ação sugerida',
    align: 'left' as const,
    title: 'Próximo passo sugerido a partir do Status e do pipeline SC / Pré Compra / PC',
  },
] as const;

type ColKey = (typeof COLS)[number]['key'];
const COL_KEYS = COLS.map((c) => c.key);
const NUM_KEYS: ColKey[] = [
  'consumoMedio',
  'precoUnitario',
  'atendimentoExibicao',
  'faltante',
  'cobertura',
  'empenho',
  'saldo',
  'solicitacao',
  'cotacao',
  'pedidoCompra',
  'saldoProjetado',
];

function colLetterExcel(colIdx0: number): string {
  let n = colIdx0;
  let s = '';
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function fmtCobertura(n: number | null | undefined, opts?: { visualCap?: boolean }): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (opts?.visualCap) {
    if (n < -3) return '< −3';
    if (n > 12) return '> 12';
  }
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function classNameCobertura(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return 'text-slate-400 dark:text-slate-500';
  if (n < 0) return 'font-semibold text-red-600 dark:text-red-400';
  if (n < 1) return 'font-semibold text-amber-700 dark:text-amber-300';
  return 'text-slate-800 dark:text-slate-100';
}

function fmtAtendeVenda(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return '—';
  return `${Math.round(Math.min(1, Math.max(0, pct)) * 100)}%`;
}

function statusDaLinha(row: CoberturaEstoqueLinha): KpiFirme {
  return row.statusPainel ?? row.kpiFirme;
}

type CardValorCobertura = 'estoque' | 'firme' | 'sem_mov_60d';

const LABELS_CARD_VALOR: Record<CardValorCobertura, string> = {
  estoque: 'Valor em estoque',
  firme: 'Valor em estoque firme',
  sem_mov_60d: 'Valor sem movimentação',
};

function itemPassaCardValor(row: CoberturaEstoqueLinha, card: CardValorCobertura): boolean {
  if (card === 'estoque') return row.valorEstoque != null;
  if (card === 'firme') return row.valorFirme != null;
  return row.semMovimentacao60d === true && row.valorEstoque != null;
}

function passaVisaoGrade(row: CoberturaEstoqueLinha, visao: VisaoGradeCobertura): boolean {
  if (visao === 'atende_venda') return (Number(row.empenho) || 0) > 0;
  if (visao === 'cobertura') return (Number(row.consumoMedio) || 0) > 0;
  return (Number(row.consumoMedio) || 0) <= 0 && (Number(row.empenho) || 0) === 0;
}

function classNameAcao(prioridade: AcaoSugeridaCobertura['prioridade']): string {
  if (prioridade === 'urgente') return 'font-semibold text-red-600 dark:text-red-400';
  if (prioridade === 'atencao') return 'font-medium text-orange-600 dark:text-orange-400';
  return 'text-slate-500 dark:text-slate-400';
}

function rankAcao(prioridade: AcaoSugeridaCobertura['prioridade']): number {
  if (prioridade === 'urgente') return 0;
  if (prioridade === 'atencao') return 1;
  return 2;
}

function detalheTipoDaAcao(
  chave: AcaoSugeridaCobertura['chave']
): 'pc' | 'cotacao' | 'solicitacao' | null {
  if (
    chave === 'cobrar_pc' ||
    chave === 'antecipar_pc' ||
    chave === 'complementar_compra' ||
    chave === 'suspender_compra'
  ) {
    return 'pc';
  }
  if (chave === 'urgenciar_cotacao' || chave === 'converter_cotacao' || chave === 'acelerar_sc_agpag') {
    return 'cotacao';
  }
  if (
    chave === 'urgenciar_sc' ||
    chave === 'acelerar_cotacao' ||
    chave === 'converter_sc' ||
    chave === 'abrir_sc_urgente' ||
    chave === 'programar_sc' ||
    chave === 'gerar_sc'
  ) {
    return 'solicitacao';
  }
  return null;
}

const BARRA_CHART_ALTURA_PX = 168;
const BARRA_MAX_ALTURA_PX = 140;

function fmtCapital(capital: number | null | undefined): string {
  if (capital == null || !Number.isFinite(capital)) return '—';
  return capital.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

/** Preço unitário — 2 casas; até 4 quando < 0,01 (ex. R$ 0,0020). */
function fmtPreco(preco: number | null | undefined): string {
  if (preco == null || !Number.isFinite(preco) || preco <= 0) return '—';
  const casas = preco < 0.01 ? 4 : 2;
  return preco.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

/** Rótulo sobre a barra — abrevia milhões/mil sem truncar com reticências. */
function fmtCapitalBar(capital: number | null | undefined): string {
  if (capital == null || !Number.isFinite(capital)) return '—';
  const abs = Math.abs(capital);
  const sinal = capital < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    const mi = abs / 1_000_000;
    return `${sinal}R$ ${mi.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  }
  if (abs >= 10_000) {
    const mil = Math.round(abs / 1_000);
    return `${sinal}R$ ${mil.toLocaleString('pt-BR')} mil`;
  }
  return fmtCapital(capital);
}

function itemPassaFiltroFamiliaCapital(
  item: CoberturaEstoqueLinha,
  familiaAtiva: string | null,
  familiasPrincipais: Set<string>
): boolean {
  if (!familiaAtiva) return true;
  const familia = item.familiaProduto.trim() || 'Sem família';
  if (familiaAtiva === COBERTURA_PIE_BUCKET_DEMAIS) return !familiasPrincipais.has(familia);
  return familia === familiaAtiva;
}

function itemSemPrecoValido(row: CoberturaEstoqueLinha): boolean {
  return row.precoUnitario == null || row.precoUnitario === 0;
}

/**
 * Faixa efetiva para capital / clique na barra &lt; 0:
 * itens sem CM (cobertura null) com valor firme negativo entram em `lt0`.
 */
function faixaEfetivaCapital(row: CoberturaEstoqueLinha): BarraFirme | null {
  if (row.faixaFirme != null) return row.faixaFirme;
  if (row.valorFirme != null && Number.isFinite(row.valorFirme) && row.valorFirme < 0) {
    return 'lt0';
  }
  return null;
}

function itemNaFaixaCapital(row: CoberturaEstoqueLinha, faixa: BarraFirme): boolean {
  return faixaEfetivaCapital(row) === faixa;
}

function contagemItensPorFaixa(itens: CoberturaEstoqueLinha[]): Map<BarraFirme, number> {
  const acc = new Map<BarraFirme, number>();
  for (const f of BARRAS_FIRME_ORDEM) acc.set(f, 0);
  for (const i of itens) {
    const faixa = faixaEfetivaCapital(i);
    if (faixa == null) continue;
    acc.set(faixa, (acc.get(faixa) ?? 0) + 1);
  }
  return acc;
}

function agregarCargaPorComprador(linhas: CoberturaEstoqueLinha[]): TotaisCompradorCobertura[] {
  const map = new Map<string, TotaisCompradorCobertura>();
  for (const row of linhas) {
    const st = statusDaLinha(row);
    const atual = map.get(row.comprador) ?? {
      comprador: row.comprador,
      itens: 0,
      ruptura: 0,
      aguardandoPc: 0,
      critico: 0,
      atencao: 0,
    };
    atual.itens += 1;
    if (st === 'ruptura') atual.ruptura += 1;
    else if (st === 'aguardando_pc') atual.aguardandoPc += 1;
    else if (st === 'critico') atual.critico += 1;
    else if (st === 'atencao') atual.atencao += 1;
    map.set(row.comprador, atual);
  }
  const rank = (n: string) => {
    const m = /^Comprador\s+(\d+)$/i.exec(n);
    if (m) return Number(m[1]);
    if (n === 'A definir') return 1000;
    return 100;
  };
  return [...map.values()].sort(
    (a, b) => rank(a.comprador) - rank(b.comprador) || a.comprador.localeCompare(b.comprador, 'pt-BR')
  );
}

function urgenciaComprador(c: TotaisCompradorCobertura): number {
  return c.ruptura + c.aguardandoPc + c.critico + c.atencao;
}

type DetalheModal =
  | { tipo: 'saldo'; linha: CoberturaEstoqueLinha }
  | { tipo: 'empenho'; linha: CoberturaEstoqueLinha }
  | { tipo: 'solicitacao'; linha: CoberturaEstoqueLinha }
  | { tipo: 'cotacao'; linha: CoberturaEstoqueLinha }
  | { tipo: 'pc'; linha: CoberturaEstoqueLinha };

export default function CoberturaEstoquePage() {
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const [filtros, setFiltros] = useState<FiltrosConsultaEstoqueState>(EMPTY_FILTROS);
  const [opcoes, setOpcoes] = useState<OpcoesFiltroConsultaEstoque>(EMPTY_OPCOES);
  const [msgFiltro, setMsgFiltro] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [origensEmpenho, setOrigensEmpenho] = useState(ORIGENS_EMPENHO_COBERTURA_TODAS);
  const [considerarRequisicoesAplicado, setConsiderarRequisicoesAplicado] = useState(true);
  const [somenteComEmpenho, setSomenteComEmpenho] = useState(false);
  const [somenteComEmpenhoDraft, setSomenteComEmpenhoDraft] = useState(false);
  const [painel, setPainel] = useState<PainelCoberturaEstoqueData | null>(null);
  const [cardValorAtivo, setCardValorAtivo] = useState<CardValorCobertura | null>(null);
  const [kpiAtivo, setKpiAtivo] = useState<KpiFirme | null>(null);
  const [barraAtiva, setBarraAtiva] = useState<BarraFirme | null>(null);
  const [compradorAtivo, setCompradorAtivo] = useState<string | null>(null);
  const [kpiCompradorAtivo, setKpiCompradorAtivo] = useState<KpiFirme | null>(null);
  const [filtroSemPreco, setFiltroSemPreco] = useState(false);
  const [produtoTopCapitalAtivo, setProdutoTopCapitalAtivo] = useState<number | null>(null);
  const [familiaCapitalAtiva, setFamiliaCapitalAtiva] = useState<string | null>(null);
  const [visaoGrade, setVisaoGrade] = useState<VisaoGradeCobertura>('atende_venda');
  const reqSeqRef = useRef(0);
  const detalheCacheRef = useRef(new Map<string, unknown>());
  const limparFiltrosGradeRef = useRef<() => void>(() => {});

  const [detalhe, setDetalhe] = useState<DetalheModal | null>(null);
  const [detalheSaldo, setDetalheSaldo] = useState<SaldoSetorDetalhe[]>([]);
  const [detalheEmpenho, setDetalheEmpenho] = useState<RessupEmpenhoPedidoResultado | null>(null);
  const [detalheSc, setDetalheSc] = useState<ScDetalhe[]>([]);
  const [detalheCotacao, setDetalheCotacao] = useState<CotacaoDetalhe[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await obterOpcoesFiltroConsultaEstoque();
      if (!cancelled && r.data) {
        setOpcoes({ ...r.data, familias: r.data.familias ?? [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(() => {
      void (async () => {
        const payload = payloadCobertura(filtros, somenteComEmpenho);
        const r = await obterOpcoesFiltroCascataConsultaEstoque(payload);
        if (!cancelled && r.data) {
          setOpcoes((prev) => ({
            ...r.data!,
            // Famílias vêm do painel (universo apto), não da cascata Nomus genérica.
            familias: prev.familias ?? [],
          }));
        }
      })();
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [filtros, somenteComEmpenho]);

  const executarPainel = useCallback(
    async (req: boolean, f: FiltrosConsultaEstoqueState, soComEmpenho: boolean) => {
      const seq = ++reqSeqRef.current;
      setErro(null);
      setLoading(true);
      detalheCacheRef.current.clear();
      limparFiltrosGradeRef.current();
      setCardValorAtivo(null);
      setKpiAtivo(null);
      setBarraAtiva(null);
      setCompradorAtivo(null);
      setKpiCompradorAtivo(null);
      setFiltroSemPreco(false);
      setProdutoTopCapitalAtivo(null);
      setFamiliaCapitalAtiva(null);
      setVisaoGrade('atende_venda');
      const r = await obterPainelCoberturaEstoque({
        filtros: payloadCobertura(f, soComEmpenho),
        considerarRequisicoes: req,
      });
      if (seq !== reqSeqRef.current) return;
      setLoading(false);
      if (r.error) {
        setErro(r.error);
        setPainel(null);
        return;
      }
      setPainel(r.data);
      if (r.data?.familiasDisponiveis) {
        setOpcoes((prev) => ({ ...prev, familias: r.data!.familiasDisponiveis! }));
      }
      setConsiderarRequisicoesAplicado(req);
      setSomenteComEmpenho(soComEmpenho);
      setFiltrosOpen(false);
    },
    []
  );

  useEffect(() => {
    void executarPainel(
      origensEmpenhoIncluiRequisicoes(origensEmpenho),
      EMPTY_FILTROS,
      somenteComEmpenho
    );
    // Só reage à origem de empenho (requisições). O toggle de "somente com empenho"
    // dispara via onClick com o valor novo — evita resetar filtros do modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intencional: não incluir somenteComEmpenho
  }, [executarPainel, origensEmpenho]);

  const handleFiltrar = () => {
    setMsgFiltro(null);
    setSomenteComEmpenho(somenteComEmpenhoDraft);
    void executarPainel(
      origensEmpenhoIncluiRequisicoes(origensEmpenho),
      filtros,
      somenteComEmpenhoDraft
    );
  };

  const itensPorFaixa = useMemo(() => {
    if (!painel) return [];
    return painel.itens.filter((i) => {
      if (cardValorAtivo && !itemPassaCardValor(i, cardValorAtivo)) return false;
      if (barraAtiva) return itemNaFaixaCapital(i, barraAtiva);
      if (kpiAtivo) return statusDaLinha(i) === kpiAtivo;
      return true;
    });
  }, [painel, cardValorAtivo, barraAtiva, kpiAtivo]);

  const itensRecortePainel = useMemo(() => {
    if (!filtroSemPreco) return itensPorFaixa;
    return itensPorFaixa.filter(itemSemPrecoValido);
  }, [itensPorFaixa, filtroSemPreco]);

  const cargaPorComprador = useMemo(() => {
    return agregarCargaPorComprador(itensRecortePainel).filter((c) => urgenciaComprador(c) > 0);
  }, [itensRecortePainel]);

  const fatiasCapitalFamilia = useMemo(
    () => agruparCapitalPorFamiliaPie(itensRecortePainel),
    [itensRecortePainel]
  );

  const familiasPiePrincipais = useMemo(() => {
    const todas = agruparCapitalPorFamiliaPie(itensRecortePainel, 999);
    return new Set(todas.slice(0, COBERTURA_PIE_MAX_FATIAS - 1).map((f) => f.familia));
  }, [itensRecortePainel]);

  const itensFiltrados = useMemo(() => {
    return itensRecortePainel.filter((i) => {
      if (!passaVisaoGrade(i, visaoGrade)) return false;
      if (produtoTopCapitalAtivo != null && i.idProduto !== produtoTopCapitalAtivo) return false;
      if (!itemPassaFiltroFamiliaCapital(i, familiaCapitalAtiva, familiasPiePrincipais)) return false;
      if (compradorAtivo && i.comprador !== compradorAtivo) return false;
      if (kpiCompradorAtivo && statusDaLinha(i) !== kpiCompradorAtivo) return false;
      return true;
    });
  }, [
    itensRecortePainel,
    visaoGrade,
    produtoTopCapitalAtivo,
    familiaCapitalAtiva,
    familiasPiePrincipais,
    compradorAtivo,
    kpiCompradorAtivo,
  ]);

  const contagemFaixaRecorte = useMemo(
    () => contagemItensPorFaixa(itensRecortePainel),
    [itensRecortePainel]
  );

  const capitalPorFaixa = useMemo(() => {
    const acc = new Map<BarraFirme, number>();
    for (const f of BARRAS_FIRME_ORDEM) acc.set(f, 0);
    for (const i of itensRecortePainel) {
      if (i.valorFirme == null || !Number.isFinite(i.valorFirme)) continue;
      const faixa = faixaEfetivaCapital(i);
      if (faixa == null) continue;
      acc.set(faixa, (acc.get(faixa) ?? 0) + i.valorFirme);
    }
    return acc;
  }, [itensRecortePainel]);

  const semPrecoNoRecorte = useMemo(
    () => itensPorFaixa.filter(itemSemPrecoValido).length,
    [itensPorFaixa]
  );

  const top10ValorFirme = useMemo(() => {
    const comValor = [...itensRecortePainel].filter(
      (i) => i.valorFirme != null && Number.isFinite(i.valorFirme)
    );
    const capitalNegativo =
      comValor.length > 0 && comValor.every((i) => (i.valorFirme ?? 0) <= 0);
    return comValor
      .sort((a, b) =>
        capitalNegativo
          ? (a.valorFirme ?? 0) - (b.valorFirme ?? 0)
          : (b.valorFirme ?? 0) - (a.valorFirme ?? 0)
      )
      .slice(0, 10);
  }, [itensRecortePainel]);

  const top10CapitalNegativo =
    top10ValorFirme.length > 0 && top10ValorFirme.every((i) => (i.valorFirme ?? 0) <= 0);

  const maxTop10ValorFirme = useMemo(() => {
    if (!top10ValorFirme.length) return 1;
    return Math.max(1, ...top10ValorFirme.map((i) => Math.abs(i.valorFirme ?? 0)));
  }, [top10ValorFirme]);

  const getCellText = useCallback((row: CoberturaEstoqueLinha, colId: string): string => {
    switch (colId) {
      case 'codigo':
        return row.codigo;
      case 'descricao':
        return row.descricao;
      case 'statusPainel':
        return LABELS_STATUS_PAINEL[statusDaLinha(row)];
      case 'consumoMedio':
        return fmtQtde(row.consumoMedio);
      case 'precoUnitario':
        return fmtPreco(row.precoUnitario);
      case 'atendimentoExibicao':
        return fmtAtendeVenda(row.atendimentoExibicao);
      case 'faltante':
        return fmtQtde(row.faltante);
      case 'cobertura':
        return fmtCobertura(row.cobertura, { visualCap: true });
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
      case 'acaoSugerida':
        return row.acaoSugerida?.texto ?? '—';
      default:
        return '—';
    }
  }, []);

  const getCellFilterValues = useCallback((row: CoberturaEstoqueLinha, colId: string): string[] | null => {
    if (colId === 'statusPainel') return [LABELS_STATUS_PAINEL[statusDaLinha(row)]];
    if (colId === 'atendimentoExibicao' && row.classeAtendimento) {
      return [LABELS_CLASSE_ATENDIMENTO[row.classeAtendimento]];
    }
    return null;
  }, []);

  const valueForSort = useCallback((row: CoberturaEstoqueLinha, colId: string): string | number => {
    if (colId === 'precoUnitario') {
      return row.precoUnitario != null && Number.isFinite(row.precoUnitario) && row.precoUnitario !== 0
        ? row.precoUnitario
        : NaN;
    }
    if (colId === 'cobertura') {
      return row.cobertura != null && Number.isFinite(row.cobertura) ? row.cobertura : NaN;
    }
    if (colId === 'atendimentoExibicao') {
      return row.atendimentoExibicao != null && Number.isFinite(row.atendimentoExibicao)
        ? row.atendimentoExibicao
        : NaN;
    }
    if ((NUM_KEYS as string[]).includes(colId)) {
      const v = row[colId as keyof CoberturaEstoqueLinha];
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) ? n : NaN;
    }
    if (colId === 'statusPainel') {
      const idx = STATUS_PAINEL_SORT_ORDEM.indexOf(statusDaLinha(row));
      return idx < 0 ? 999 : idx;
    }
    if (colId === 'acaoSugerida') return rankAcao(row.acaoSugerida?.prioridade ?? 'ok');
    return getCellText(row, colId);
  }, [getCellText]);

  const grade = useGradeFiltrosExcel({
    rows: itensFiltrados,
    columnIds: COL_KEYS,
    getCellText,
    getCellFilterValues,
    valueForSort,
    defaultSortLevels: [{ id: 'statusPainel', dir: 'asc' }],
  });
  limparFiltrosGradeRef.current = grade.limparFiltrosGrade;

  const totalLinhasGrade = grade.rowsExibidas.length;
  const linhasGradeVisiveis = useGradeScrollIncremental(grade.tableScrollRef, totalLinhasGrade);
  const linhasGradeRender = useMemo(
    () => grade.rowsExibidas.slice(0, linhasGradeVisiveis),
    [grade.rowsExibidas, linhasGradeVisiveis]
  );

  const maxBarra = useMemo(() => {
    const vals = BARRAS_FIRME_ORDEM.map((f) => contagemFaixaRecorte.get(f) ?? 0);
    return Math.max(1, ...vals);
  }, [contagemFaixaRecorte]);

  const maxBarraCapital = useMemo(() => {
    const caps = BARRAS_FIRME_ORDEM.map((f) => Math.abs(capitalPorFaixa.get(f) ?? 0));
    return Math.max(1, ...caps);
  }, [capitalPorFaixa]);

  const maxCarga = useMemo(() => {
    if (!cargaPorComprador.length) return 1;
    return Math.max(1, ...cargaPorComprador.map(urgenciaComprador));
  }, [cargaPorComprador]);

  const abrirDetalhe = (d: DetalheModal) => {
    setDetalhe(d);
  };

  const exportarExcelGrade = useCallback(async () => {
    const rows = grade.rowsExibidas;
    if (rows.length === 0) return;
    const headers = COLS.map((c) => c.label);
    const tableRows = rows.map((row) =>
      COLS.map((c) => {
        if ((NUM_KEYS as string[]).includes(c.key)) {
          const v = valueForSort(row, c.key);
          if (typeof v !== 'number' || !Number.isFinite(v)) return null;
          if (c.key === 'precoUnitario') {
            return v < 0.01 ? Math.round(v * 10000) / 10000 : Math.round(v * 100) / 100;
          }
          if (c.key === 'cobertura') return Math.round(v * 100) / 100;
          if (c.key === 'atendimentoExibicao') return Math.round(v * 10000) / 100;
          return Math.round(v);
        }
        const t = getCellText(row, c.key);
        return t === '—' ? null : t;
      })
    );

    const wb = new Workbook();
    const ws = wb.addWorksheet('Cobertura Estoque', { views: [{ state: 'frozen', ySplit: 1 }] });
    const lastRow = tableRows.length + 1;
    const ref = `A1:${colLetterExcel(headers.length - 1)}${lastRow}`;

    ws.addTable({
      name: 'TabelaCoberturaEstoque',
      ref,
      headerRow: true,
      style: { theme: 'TableStyleMedium2', showRowStripes: true },
      columns: headers.map((name) => ({ name, filterButton: true })),
      rows: tableRows,
    });

    for (let c = 0; c < headers.length; c++) {
      const key = COLS[c]!.key;
      let width = 12;
      if (key === 'descricao' || key === 'acaoSugerida') width = 36;
      else if (key === 'codigo') width = 14;
      else if (key === 'statusPainel') width = 14;
      else if (key === 'atendimentoExibicao') width = 12;
      else if (key === 'precoUnitario') width = 14;
      ws.getColumn(c + 1).width = width;
      if ((NUM_KEYS as string[]).includes(key)) {
        for (let r = 2; r <= lastRow; r++) {
          const cell = ws.getCell(r, c + 1);
          if (key === 'precoUnitario') {
            const raw = tableRows[r - 2]?.[c];
            const n = typeof raw === 'number' ? raw : Number(raw);
            cell.numFmt =
              Number.isFinite(n) && n > 0 && n < 0.01 ? '"R$"#,##0.0000' : '"R$"#,##0.00';
          } else if (key === 'cobertura' || key === 'atendimentoExibicao') {
            cell.numFmt = '#,##0.00';
          } else {
            cell.numFmt = '#,##0';
          }
        }
      }
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ts = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    a.download = `cobertura-estoque-${ts}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }, [grade.rowsExibidas, getCellText, valueForSort]);

  const selecionarCardValor = (card: CardValorCobertura) => {
    setCompradorAtivo(null);
    setKpiCompradorAtivo(null);
    setFiltroSemPreco(false);
    setProdutoTopCapitalAtivo(null);
    setFamiliaCapitalAtiva(null);
    setKpiAtivo(null);
    setBarraAtiva(null);
    if (cardValorAtivo === card) {
      setCardValorAtivo(null);
      return;
    }
    setCardValorAtivo(card);
  };

  const selecionarKpi = (kpi: KpiFirme) => {
    setCardValorAtivo(null);
    setCompradorAtivo(null);
    setKpiCompradorAtivo(null);
    setFiltroSemPreco(false);
    setProdutoTopCapitalAtivo(null);
    setFamiliaCapitalAtiva(null);
    if (kpiAtivo === kpi && barraAtiva == null) {
      setKpiAtivo(null);
      return;
    }
    setKpiAtivo(kpi);
    setBarraAtiva(null);
  };

  const selecionarBarra = (barra: BarraFirme) => {
    setCardValorAtivo(null);
    setCompradorAtivo(null);
    setKpiCompradorAtivo(null);
    setFiltroSemPreco(false);
    setProdutoTopCapitalAtivo(null);
    setFamiliaCapitalAtiva(null);
    if (barraAtiva === barra) {
      setBarraAtiva(null);
      setKpiAtivo(null);
      return;
    }
    setBarraAtiva(barra);
    setKpiAtivo(BARRA_PARA_KPI[barra]);
  };

  const selecionarComprador = (comprador: string) => {
    if (compradorAtivo === comprador && kpiCompradorAtivo == null) {
      setCompradorAtivo(null);
      return;
    }
    setCompradorAtivo(comprador);
    setKpiCompradorAtivo(null);
  };

  const selecionarSegmento = (comprador: string, kpi: KpiFirme) => {
    if (compradorAtivo === comprador && kpiCompradorAtivo === kpi) {
      setCompradorAtivo(null);
      setKpiCompradorAtivo(null);
      return;
    }
    setCompradorAtivo(comprador);
    setKpiCompradorAtivo(kpi);
  };

  const selecionarSemPreco = () => {
    setCardValorAtivo(null);
    setCompradorAtivo(null);
    setKpiCompradorAtivo(null);
    setProdutoTopCapitalAtivo(null);
    setFamiliaCapitalAtiva(null);
    setFiltroSemPreco((v) => !v);
  };

  const selecionarProdutoTopCapital = (idProduto: number) => {
    setFamiliaCapitalAtiva(null);
    setProdutoTopCapitalAtivo((prev) => (prev === idProduto ? null : idProduto));
  };

  const selecionarFamiliaCapital = (familia: string) => {
    setProdutoTopCapitalAtivo(null);
    setFamiliaCapitalAtiva((prev) => (prev === familia ? null : familia));
  };

  const limparRecorte = () => {
    setCardValorAtivo(null);
    setKpiAtivo(null);
    setBarraAtiva(null);
    setCompradorAtivo(null);
    setKpiCompradorAtivo(null);
    setFiltroSemPreco(false);
    setProdutoTopCapitalAtivo(null);
    setFamiliaCapitalAtiva(null);
  };

  const recorteAtivo =
    cardValorAtivo != null ||
    kpiAtivo != null ||
    barraAtiva != null ||
    compradorAtivo != null ||
    filtroSemPreco ||
    produtoTopCapitalAtivo != null ||
    familiaCapitalAtiva != null;

  const temFiltrosParaLimpar =
    filtrosConsultaTemAlgumSelecionado(filtros) || somenteComEmpenho || recorteAtivo;

  const handleLimparFiltrosTopo = () => {
    setMsgFiltro(null);
    if (filtrosConsultaTemAlgumSelecionado(filtros) || somenteComEmpenho) {
      setFiltros(EMPTY_FILTROS);
      setSomenteComEmpenho(false);
      setSomenteComEmpenhoDraft(false);
      void executarPainel(
        origensEmpenhoIncluiRequisicoes(origensEmpenho),
        EMPTY_FILTROS,
        false
      );
      return;
    }
    limparRecorte();
  };
  const barraDestacada = (barra: BarraFirme) => {
    if (barraAtiva) return barraAtiva === barra;
    if (kpiAtivo) return (KPI_PARA_BARRAS[kpiAtivo] ?? []).includes(barra);
    return false;
  };

  const rotuloRecorte = [
    cardValorAtivo ? LABELS_CARD_VALOR[cardValorAtivo] : null,
    barraAtiva ? LABELS_BARRA_FIRME[barraAtiva] : kpiAtivo ? LABELS_KPI_FIRME[kpiAtivo] : null,
    filtroSemPreco ? 'Sem preço' : null,
    compradorAtivo,
    kpiCompradorAtivo && compradorAtivo ? LABELS_KPI_FIRME[kpiCompradorAtivo] : null,
    produtoTopCapitalAtivo != null
      ? (() => {
          const p = itensRecortePainel.find((i) => i.idProduto === produtoTopCapitalAtivo);
          return p ? `Produto ${p.codigo}` : 'Produto';
        })()
      : null,
    familiaCapitalAtiva,
  ]
    .filter(Boolean)
    .join(' — ');

  const detailKey =
    detalhe && detalhe.tipo !== 'pc'
      ? `${detalhe.tipo}-${detalhe.linha.idProduto}-${considerarRequisicoesAplicado ? 1 : 0}`
      : null;

  const carregarDetalheModal = useCallback(async (): Promise<{ error?: string }> => {
    if (!detalhe || detalhe.tipo === 'pc') return {};
    const id = detalhe.linha.idProduto;
    const key = `${detalhe.tipo}-${id}-${considerarRequisicoesAplicado ? 1 : 0}`;
    const cached = detalheCacheRef.current.get(key);
    if (cached) {
      if (detalhe.tipo === 'saldo') setDetalheSaldo(cached as SaldoSetorDetalhe[]);
      else if (detalhe.tipo === 'empenho') setDetalheEmpenho(cached as RessupEmpenhoPedidoResultado);
      else if (detalhe.tipo === 'solicitacao') setDetalheSc(cached as ScDetalhe[]);
      else setDetalheCotacao(cached as CotacaoDetalhe[]);
      return {};
    }
    if (detalhe.tipo === 'saldo') {
      const r = await obterSaldoDetalhe(id);
      if (!r.error) detalheCacheRef.current.set(key, r.data);
      setDetalheSaldo(r.data);
      return { error: r.error };
    }
    if (detalhe.tipo === 'empenho') {
      const r = await obterRessupEmpenhoPorPedido(id, considerarRequisicoesAplicado, false);
      if (!r.error && r.data) detalheCacheRef.current.set(key, r.data);
      setDetalheEmpenho(r.data);
      return { error: r.error };
    }
    if (detalhe.tipo === 'solicitacao') {
      const r = await obterScDetalhe(id);
      if (!r.error) detalheCacheRef.current.set(key, r.data);
      setDetalheSc(r.data);
      return { error: r.error };
    }
    const r = await obterCotacaoDetalhe(id);
    if (!r.error) detalheCacheRef.current.set(key, r.data);
    setDetalheCotacao(r.data);
    return { error: r.error };
  }, [detalhe, considerarRequisicoesAplicado]);

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col px-3 py-4 md:px-4">
      <CarregandoInformacoesOverlay
        show={loading}
        mensagem="Calculando cobertura de estoque…"
        mode="viewport"
      />

      <div className="mx-auto w-full max-w-[1920px] space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
            <RotuloComDica
              rotulo="Cobertura de Estoque"
              dica="Visão gerencial do almoxarifado secundário — Atendimento da venda (estoque ÷ empenho) e Cobertura em meses (estoque − empenho) ÷ CM, sem divisor 0,01."
            />
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-600 dark:bg-slate-800">
              <button
                type="button"
                role="switch"
                aria-checked={origensEmpenhoIncluiRequisicoes(origensEmpenho)}
                aria-label="Considerar empenho de requisições"
                disabled={loading}
                onClick={() => {
                  const atual = origensEmpenhoIncluiRequisicoes(origensEmpenho);
                  const proximo = !atual;
                  const nextOrigens = proximo
                    ? ORIGENS_EMPENHO_COBERTURA_TODAS
                    : 'Pedidos de venda';
                  setOrigensEmpenho(nextOrigens);
                  void executarPainel(proximo, filtros, somenteComEmpenho);
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50 ${
                  origensEmpenhoIncluiRequisicoes(origensEmpenho)
                    ? 'bg-primary-600'
                    : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${
                    origensEmpenhoIncluiRequisicoes(origensEmpenho)
                      ? 'translate-x-5'
                      : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="max-w-[11rem] text-xs font-medium leading-tight text-slate-700 dark:text-slate-200 sm:max-w-none">
                Considerar empenho de requisições?
              </span>
            </div>
            <ComoLerBtn onClick={() => setAjudaAberta(true)} title="Como ler a Cobertura de Estoque" />
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
              disabled={loading || !temFiltrosParaLimpar}
              onClick={handleLimparFiltrosTopo}
              title="Limpa filtros do modal e faixas/KPI/comprador/capital clicados"
            >
              Limpar filtros
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setSomenteComEmpenhoDraft(somenteComEmpenho);
                setFiltrosOpen(true);
              }}
            >
              Filtrar
            </button>
          </div>
        </header>

        {erro && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200" role="alert">
            {erro}
          </p>
        )}

        {!painel && !loading && (
          <div className="card-panel border-dashed px-6 py-10 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Nenhum dado para exibir. Clique em <strong>Filtrar</strong> para montar o painel.
            </p>
          </div>
        )}

        {painel && (
          <>
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <button
                type="button"
                onClick={() => selecionarCardValor('estoque')}
                className={`card-panel border-l-4 border-l-slate-500 p-4 text-left transition hover:shadow-soaco-lg ${
                  cardValorAtivo === 'estoque' ? 'ring-2 ring-primary-600' : ''
                }`}
              >
                <p className="text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-100">
                  {fmtCapital(painel.valorEstoqueTotal)}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Valor em estoque
                </p>
                <p className="mt-0.5 text-xs text-slate-500">qtde × preço</p>
              </button>
              <button
                type="button"
                onClick={() => selecionarCardValor('firme')}
                className={`card-panel border-l-4 border-l-emerald-600 p-4 text-left transition hover:shadow-soaco-lg ${
                  cardValorAtivo === 'firme' ? 'ring-2 ring-primary-600' : ''
                }`}
              >
                <p
                  className={`text-2xl font-bold tabular-nums ${
                    (painel.valorFirmeTotal ?? 0) < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  {fmtCapital(painel.valorFirmeTotal)}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Valor em estoque firme
                </p>
                <p className="mt-0.5 text-xs text-slate-500">(estoque − empenho) × preço</p>
              </button>
              <button
                type="button"
                onClick={() => selecionarCardValor('sem_mov_60d')}
                className={`card-panel border-l-4 border-l-amber-500 p-4 text-left transition hover:shadow-soaco-lg ${
                  cardValorAtivo === 'sem_mov_60d' ? 'ring-2 ring-primary-600' : ''
                }`}
              >
                <p className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
                  {fmtCapital(painel.valorEstoqueSemMov60dTotal)}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Valor sem movimentação
                </p>
                <p className="mt-0.5 text-xs text-slate-500">sem mov. nos últimos 60 dias</p>
              </button>
            </section>

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {KPIS_FIRME_ORDEM.map((kpi) => {
                const t = painel.kpisFirme.find((x) => x.kpi === kpi);
                if (!t) return null;
                const itensKpi = filtroSemPreco
                  ? itensRecortePainel.filter((i) => statusDaLinha(i) === kpi).length
                  : t.itens;
                const ativo = kpiAtivo === kpi;
                return (
                  <button
                    key={kpi}
                    type="button"
                    onClick={() => selecionarKpi(kpi)}
                    className={`card-panel border-l-4 p-4 text-left transition hover:shadow-soaco-lg ${KPI_ACCENT[kpi]} ${
                      ativo ? 'ring-2 ring-primary-600' : ''
                    }`}
                  >
                    <p className={`text-2xl font-bold tabular-nums ${KPI_NUMERO[kpi]}`}>{itensKpi}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {t.label}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{t.subtitulo}</p>
                  </button>
                );
              })}
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="card-panel p-4">
                <div className="mb-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-soaco-navy dark:text-soaco-white">
                    Distribuição da cobertura (meses)
                  </h2>
                </div>
                <div
                  className="grid w-full grid-cols-7 items-end gap-2"
                  style={{ height: BARRA_CHART_ALTURA_PX }}
                >
                  {BARRAS_FIRME_ORDEM.map((faixa) => {
                    const qtd = contagemFaixaRecorte.get(faixa) ?? 0;
                    const altura = Math.max(6, (qtd / maxBarra) * BARRA_MAX_ALTURA_PX);
                    const ativo = barraDestacada(faixa);
                    return (
                      <button
                        key={faixa}
                        type="button"
                        onClick={() => selecionarBarra(faixa)}
                        className={`flex h-full min-w-0 flex-col items-center justify-end gap-1 rounded-md px-1 pb-0 pt-2 transition ${
                          ativo
                            ? 'bg-slate-200 ring-2 ring-sky-500 dark:bg-slate-800 dark:ring-sky-400'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                        title={`${LABELS_BARRA_FIRME[faixa]}: ${qtd} itens`}
                      >
                        <span
                          className={`text-[11px] font-semibold tabular-nums leading-tight ${
                            ativo ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {qtd}
                        </span>
                        <span
                          className={`w-full max-w-[2.75rem] rounded-t ${BARRA_BG[faixa]}`}
                          style={{ height: `${altura}px` }}
                        />
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 grid w-full grid-cols-7 gap-2 text-center text-[10px] leading-tight text-slate-500">
                  {BARRAS_FIRME_ORDEM.map((faixa) => (
                    <span key={faixa} className="min-w-0 px-0.5">
                      {LABELS_BARRA_FIRME[faixa]}
                    </span>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-7 gap-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                  {LEYENDA_GRUPO.map((g) => (
                    <span
                      key={g.label}
                      className={`rounded px-1 py-1 text-center ${g.className}`}
                      style={{ gridColumn: `span ${g.span}` }}
                    >
                      {g.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="card-panel p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-soaco-navy dark:text-soaco-white">
                    Carga por comprador
                  </h2>
                  <p className="text-[10px] text-slate-500">
                    <span className="font-medium text-red-600">ruptura</span>
                    {' — '}
                    <span className="font-medium text-violet-600">aguard. PC</span>
                    {' — '}
                    <span className="font-medium text-orange-500">crítico</span>
                    {' — '}
                    <span className="font-medium text-amber-500">atenção</span>
                  </p>
                </div>
                {cargaPorComprador.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-500">
                    Nenhum comprador com ruptura, aguardando PC, crítico ou atenção neste recorte.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {cargaPorComprador.map((c) => {
                      const total = urgenciaComprador(c);
                      const largura = (total / maxCarga) * 100;
                      const ativo = compradorAtivo === c.comprador;
                      return (
                        <li key={c.comprador}>
                          <button
                            type="button"
                            onClick={() => selecionarComprador(c.comprador)}
                            className={`w-full rounded-md px-1 py-1 text-left transition ${
                              ativo
                                ? 'bg-slate-200 ring-1 ring-sky-500 dark:bg-slate-800 dark:ring-sky-400'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <span
                                className={`truncate text-xs font-medium ${
                                  ativo ? 'text-slate-900 dark:text-white' : 'text-slate-800 dark:text-slate-100'
                                }`}
                              >
                                {c.comprador}
                              </span>
                              <span className="flex shrink-0 gap-2 text-[11px] tabular-nums">
                                <span className="text-red-600">{c.ruptura}</span>
                                <span className="text-violet-600">{c.aguardandoPc}</span>
                                <span className="text-orange-500">{c.critico}</span>
                                <span className="text-amber-500">{c.atencao}</span>
                              </span>
                            </div>
                            <div className="h-3 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                              <div className="flex h-full" style={{ width: `${largura}%` }}>
                                {c.ruptura > 0 && (
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    className={`h-full bg-red-600 ${kpiCompradorAtivo === 'ruptura' && ativo ? 'ring-1 ring-white' : ''}`}
                                    style={{ width: `${(c.ruptura / total) * 100}%` }}
                                    title={`${c.ruptura} ruptura`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      selecionarSegmento(c.comprador, 'ruptura');
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        selecionarSegmento(c.comprador, 'ruptura');
                                      }
                                    }}
                                  />
                                )}
                                {c.aguardandoPc > 0 && (
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    className={`h-full bg-violet-600 ${kpiCompradorAtivo === 'aguardando_pc' && ativo ? 'ring-1 ring-white' : ''}`}
                                    style={{ width: `${(c.aguardandoPc / total) * 100}%` }}
                                    title={`${c.aguardandoPc} aguardando PC`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      selecionarSegmento(c.comprador, 'aguardando_pc');
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        selecionarSegmento(c.comprador, 'aguardando_pc');
                                      }
                                    }}
                                  />
                                )}
                                {c.critico > 0 && (
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    className={`h-full bg-orange-500 ${kpiCompradorAtivo === 'critico' && ativo ? 'ring-1 ring-white' : ''}`}
                                    style={{ width: `${(c.critico / total) * 100}%` }}
                                    title={`${c.critico} crítico`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      selecionarSegmento(c.comprador, 'critico');
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        selecionarSegmento(c.comprador, 'critico');
                                      }
                                    }}
                                  />
                                )}
                                {c.atencao > 0 && (
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    className={`h-full bg-amber-400 ${kpiCompradorAtivo === 'atencao' && ativo ? 'ring-1 ring-white' : ''}`}
                                    style={{ width: `${(c.atencao / total) * 100}%` }}
                                    title={`${c.atencao} atenção`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      selecionarSegmento(c.comprador, 'atencao');
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        selecionarSegmento(c.comprador, 'atencao');
                                      }
                                    }}
                                  />
                                )}
                              </div>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-stretch">
              <div className="flex flex-col gap-4">
                <div className="card-panel p-4">
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-soaco-navy dark:text-soaco-white">
                        Distribuição do capital (valor firme)
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Soma de (estoque − empenho) × preço unitário por faixa. Na faixa &lt; 0 entram também itens sem CM
                        com capital firme negativo. Respeita o recorte de KPI/barras acima.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={selecionarSemPreco}
                      className={`shrink-0 rounded-lg border px-3 py-2 text-right transition ${
                        filtroSemPreco
                          ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-500 dark:border-sky-400 dark:bg-sky-950/40 dark:ring-sky-400'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800/60 dark:hover:bg-slate-800'
                      }`}
                      title="Filtrar itens sem preço de entrada qualificada ou com preço zero"
                    >
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Sem preço
                      </p>
                      <p
                        className={`text-xl font-bold tabular-nums leading-tight ${
                          filtroSemPreco ? 'text-sky-700 dark:text-sky-300' : 'text-slate-800 dark:text-slate-100'
                        }`}
                      >
                        {semPrecoNoRecorte}
                      </p>
                      <p className="text-[9px] text-slate-400">códigos no recorte</p>
                    </button>
                  </div>
                  <div
                    className="grid w-full grid-cols-7 items-end gap-1.5 sm:gap-2"
                    style={{ height: BARRA_CHART_ALTURA_PX }}
                  >
                    {BARRAS_FIRME_ORDEM.map((faixa) => {
                      const capital = capitalPorFaixa.get(faixa) ?? 0;
                      const temCapital = itensRecortePainel.some(
                        (i) => itemNaFaixaCapital(i, faixa) && i.valorFirme != null
                      );
                      const altura = Math.max(6, (Math.abs(capital) / maxBarraCapital) * BARRA_MAX_ALTURA_PX);
                      const ativo = barraDestacada(faixa);
                      const valorExibido = temCapital ? capital : null;
                      return (
                        <button
                          key={faixa}
                          type="button"
                          onClick={() => selecionarBarra(faixa)}
                          className={`flex h-full min-w-0 flex-col items-center justify-end gap-1 rounded-md px-0.5 pb-0 pt-2 transition sm:px-1 ${
                            ativo
                              ? 'bg-slate-200 ring-2 ring-sky-500 dark:bg-slate-800 dark:ring-sky-400'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                          title={`${LABELS_BARRA_FIRME[faixa]}: ${fmtCapital(valorExibido)}`}
                        >
                          <span
                            className={`whitespace-nowrap text-[9px] font-semibold tabular-nums leading-tight sm:text-[10px] ${
                              capital < 0
                                ? 'text-red-600 dark:text-red-400'
                                : ativo
                                  ? 'text-slate-900 dark:text-white'
                                  : 'text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            {fmtCapitalBar(valorExibido)}
                          </span>
                          <span
                            className={`w-full max-w-[2.75rem] rounded-t ${BARRA_BG[faixa]}`}
                            style={{ height: `${altura}px` }}
                          />
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 grid w-full grid-cols-7 gap-1.5 text-center text-[9px] leading-tight text-slate-500 sm:gap-2 sm:text-[10px]">
                    {BARRAS_FIRME_ORDEM.map((faixa) => (
                      <span key={faixa} className="min-w-0 px-0.5">
                        {LABELS_BARRA_FIRME[faixa]}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="card-panel flex min-h-0 flex-1 flex-col p-4">
                  <div className="mb-3">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-soaco-navy dark:text-soaco-white">
                      Capital por família de produto
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Participação do valor firme por família (cadastro Nomus). Produtos com valor firme negativo
                      são ignorados e não entram na soma da família. Fatias menores agrupadas em Demais famílias.
                      Clique para filtrar a grade.
                    </p>
                  </div>
                  <CoberturaCapitalFamiliaPizza
                    fatias={fatiasCapitalFamilia}
                    formatCapital={fmtCapital}
                    familiaAtiva={familiaCapitalAtiva}
                    onSelecionarFamilia={selecionarFamiliaCapital}
                  />
                </div>
              </div>

              <div className="card-panel flex min-h-0 flex-col p-4">
                <div className="mb-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-soaco-navy dark:text-soaco-white">
                    Top 10 — capital em estoque firme
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {top10CapitalNegativo
                      ? 'Produtos com maior déficit de capital firme ((estoque − empenho) × preço) no recorte — ordem do mais negativo ao menos negativo. Clique para filtrar a grade.'
                      : 'Produtos com maior (estoque − empenho) × preço unitário no recorte atual. Clique para filtrar a grade.'}
                  </p>
                </div>
                {top10ValorFirme.length === 0 ? (
                  <p className="flex flex-1 items-center justify-center py-8 text-center text-xs text-slate-500">
                    Nenhum item com valor firme calculado neste recorte.
                  </p>
                ) : (
                  <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
                    {top10ValorFirme.map((item, idx) => {
                      const ativo = produtoTopCapitalAtivo === item.idProduto;
                      const valor = item.valorFirme ?? 0;
                      const largura = (Math.abs(valor) / maxTop10ValorFirme) * 100;
                      return (
                        <li key={item.idProduto}>
                          <div
                            className={`w-full rounded-md px-1.5 py-1.5 transition ${
                              ativo
                                ? 'bg-slate-200 ring-1 ring-sky-500 dark:bg-slate-800 dark:ring-sky-400'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            <div className="mb-1 flex items-start justify-between gap-2">
                              <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
                                <span className="shrink-0 text-[10px] font-bold tabular-nums text-slate-400">
                                  {idx + 1}.
                                </span>
                                <div className="min-w-0">
                                  <div className="flex min-w-0 items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => selecionarProdutoTopCapital(item.idProduto)}
                                      className={`truncate text-left text-xs font-semibold ${
                                        ativo
                                          ? 'text-slate-900 dark:text-white'
                                          : 'text-slate-800 dark:text-slate-100'
                                      }`}
                                      title={`${item.codigo} — ${item.descricao}: ${fmtCapital(item.valorFirme)}`}
                                    >
                                      {item.codigo}
                                    </button>
                                    <CopiarTextoBtn texto={item.codigo} title="Copiar código do produto" />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => selecionarProdutoTopCapital(item.idProduto)}
                                    className="block w-full truncate text-left text-[11px] text-slate-500 dark:text-slate-400"
                                  >
                                    {item.descricao}
                                  </button>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => selecionarProdutoTopCapital(item.idProduto)}
                                className={`shrink-0 text-right text-[11px] font-semibold tabular-nums leading-tight ${
                                  valor < 0
                                    ? 'text-red-600 dark:text-red-400'
                                    : KPI_NUMERO[statusDaLinha(item)]
                                }`}
                                title={fmtCapital(item.valorFirme)}
                              >
                                {fmtCapital(item.valorFirme)}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => selecionarProdutoTopCapital(item.idProduto)}
                              className="block h-2 w-full overflow-hidden rounded bg-slate-100 dark:bg-slate-800"
                              aria-label={`Filtrar grade pelo produto ${item.codigo}`}
                            >
                              <span
                                className={`block h-full rounded ${
                                  item.faixaFirme ? BARRA_BG[item.faixaFirme] : 'bg-slate-400'
                                }`}
                                style={{ width: `${largura}%` }}
                              />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>

            <section className="card-panel overflow-hidden p-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-soaco-gray/25 px-4 py-3">
                <div className="flex min-w-0 flex-wrap items-center gap-3">
                  <h2 className="text-sm font-semibold text-soaco-navy dark:text-soaco-white">
                    Itens
                    {rotuloRecorte ? ` — ${rotuloRecorte}` : ''}
                  </h2>
                  <div
                    className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-600 dark:bg-slate-800/80"
                    role="tablist"
                    aria-label="Visão da grade"
                  >
                    {VISOES_GRADE.map((v) => {
                      const ativo = visaoGrade === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          role="tab"
                          aria-selected={ativo}
                          title={v.title}
                          onClick={() => setVisaoGrade(v.id)}
                          className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                            ativo
                              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                          }`}
                        >
                          {v.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {recorteAtivo && (
                    <button
                      type="button"
                      className="text-xs font-medium text-primary-600 hover:underline"
                      onClick={limparRecorte}
                    >
                      Limpar recorte
                    </button>
                  )}
                  {grade.temFiltrosOuOrdem && (
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                      onClick={() => grade.limparFiltrosGrade()}
                    >
                      Limpar filtros da grade
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void exportarExcelGrade()}
                    disabled={totalLinhasGrade === 0}
                    className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
                    title="Exporta as linhas da grade com o recorte e os filtros de coluna aplicados"
                  >
                    Excel
                  </button>
                </div>
              </div>
              <div ref={grade.tableScrollRef} className="max-h-[420px] overflow-auto">
                <table className="w-full border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-soaco-navy text-white">
                    <tr>
                      {COLS.map((c) => {
                        return (
                          <th
                            key={c.key}
                            className={`px-2 py-2 font-semibold ${c.align === 'center' ? 'text-center' : 'text-left'}`}
                            title={'title' in c ? c.title : undefined}
                          >
                            <div
                              className={`flex min-w-0 items-center gap-1 ${
                                c.align === 'center' ? 'justify-center' : 'justify-between'
                              }`}
                            >
                              <span className="min-w-0 truncate">{c.label}</span>
                              <GradeFiltroCabecalhoBtn
                                ativo={grade.colunaComFiltroAtivo(c.key)}
                                onClick={(e) => grade.abrirFiltroExcel(c.key, e)}
                              />
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {linhasGradeRender.map((row) => {
                      const st = statusDaLinha(row);
                      const cob = row.cobertura;
                      return (
                      <tr
                        key={row.idProduto}
                        className={`border-b border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                          st === 'ruptura' || st === 'aguardando_pc'
                            ? 'bg-rose-50/90 dark:bg-rose-950/35'
                            : cob != null && cob < 1
                              ? 'bg-amber-50/70 dark:bg-amber-950/25'
                              : ''
                        }`}
                      >
                        <td className="px-2 py-1.5 font-medium text-slate-800 dark:text-slate-100">
                          <span className="inline-flex items-center gap-1">
                            {row.codigo}
                            <CopiarTextoBtn texto={row.codigo} title="Copiar código do produto" />
                          </span>
                        </td>
                        <td className="max-w-[240px] truncate px-2 py-1.5 text-slate-600 dark:text-slate-300">
                          {row.descricao}
                        </td>
                        <td className="px-2 py-1.5">
                          <span
                            className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${KPI_NUMERO[st]} border-l-2 ${KPI_ACCENT[st]}`}
                          >
                            {LABELS_STATUS_PAINEL[st]}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-center tabular-nums text-slate-700 dark:text-slate-200">
                          {fmtQtde(row.consumoMedio)}
                        </td>
                        <td
                          className="px-2 py-1.5 text-center tabular-nums text-slate-800 dark:text-slate-100"
                          title="Última entrada qualificada com preço > 0"
                        >
                          {fmtPreco(row.precoUnitario)}
                        </td>
                        <td className="px-2 py-1.5 text-center" title="Estoque ÷ empenho (cap 100%)">
                          {row.atendimentoExibicao == null || !row.classeAtendimento ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            <span className="inline-flex w-full min-w-[4.5rem] flex-col items-stretch gap-0.5">
                              <span
                                className={`text-[11px] font-semibold tabular-nums ${ATENDE_TXT[row.classeAtendimento]}`}
                              >
                                {fmtAtendeVenda(row.atendimentoExibicao)}
                              </span>
                              <span className="h-1.5 overflow-hidden rounded bg-slate-200 dark:bg-slate-700">
                                <span
                                  className={`block h-full rounded ${ATENDE_BG[row.classeAtendimento]}`}
                                  style={{
                                    width: `${Math.round(Math.min(1, row.atendimentoExibicao) * 100)}%`,
                                  }}
                                />
                              </span>
                            </span>
                          )}
                        </td>
                        <td
                          className={`px-2 py-1.5 text-center tabular-nums ${
                            row.faltante > 0
                              ? 'font-semibold text-red-600 dark:text-red-400'
                              : 'text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {fmtQtde(row.faltante)}
                        </td>
                        <td
                          className={`px-2 py-1.5 text-center tabular-nums ${classNameCobertura(cob)}`}
                          title="(Estoque − empenho) ÷ CM"
                        >
                          {fmtCobertura(cob, { visualCap: true })}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <GradeCelulaModalBtn onClick={() => abrirDetalhe({ tipo: 'empenho', linha: row })}>
                            {fmtQtde(row.empenho)}
                          </GradeCelulaModalBtn>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <GradeCelulaModalBtn onClick={() => abrirDetalhe({ tipo: 'saldo', linha: row })}>
                            {fmtQtde(row.saldo)}
                          </GradeCelulaModalBtn>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <GradeCelulaModalBtn onClick={() => abrirDetalhe({ tipo: 'solicitacao', linha: row })}>
                            {fmtQtde(row.solicitacao)}
                          </GradeCelulaModalBtn>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <GradeCelulaModalBtn onClick={() => abrirDetalhe({ tipo: 'cotacao', linha: row })}>
                            {fmtQtde(row.cotacao)}
                          </GradeCelulaModalBtn>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <GradeCelulaModalBtn onClick={() => abrirDetalhe({ tipo: 'pc', linha: row })}>
                            {fmtQtde(row.pedidoCompra)}
                          </GradeCelulaModalBtn>
                        </td>
                        <td
                          className={`px-2 py-1.5 text-center tabular-nums font-medium ${
                            row.saldoProjetado < 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-slate-800 dark:text-slate-100'
                          }`}
                        >
                          {fmtQtde(row.saldoProjetado)}
                        </td>
                        <td className="max-w-[280px] px-2 py-1.5">
                          {row.acaoSugerida ? (
                            (() => {
                              const tipo = detalheTipoDaAcao(row.acaoSugerida.chave);
                              const conteudo = (
                                <span
                                  className={`inline-flex max-w-full items-center gap-1 ${classNameAcao(row.acaoSugerida.prioridade)}`}
                                  title={row.acaoSugerida.texto}
                                >
                                  {row.acaoSugerida.prioridade === 'urgente' ? (
                                    <span aria-hidden className="shrink-0 text-orange-500">
                                      ⚡
                                    </span>
                                  ) : null}
                                  <span className="truncate">{row.acaoSugerida.texto}</span>
                                </span>
                              );
                              if (!tipo) return conteudo;
                              return (
                                <button
                                  type="button"
                                  className="max-w-full text-left hover:underline"
                                  onClick={() => abrirDetalhe({ tipo, linha: row })}
                                >
                                  {conteudo}
                                </button>
                              );
                            })()
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                      );
                    })}
                    {grade.rowsExibidas.length === 0 && (
                      <tr>
                        <td colSpan={COLS.length} className="px-4 py-8 text-center text-slate-500">
                          Nenhum item neste recorte
                          {visaoGrade === 'sem_giro' ? ' (visão Sem giro vazia até ampliar o universo)' : ''}.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {totalLinhasGrade > linhasGradeVisiveis && (
                <p className="border-t border-soaco-gray/25 px-4 py-2 text-xs text-slate-500">
                  Exibindo {linhasGradeVisiveis} de {totalLinhasGrade} itens. Role a grade para carregar mais.
                </p>
              )}
            </section>

            <section className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/40">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                Legenda — Status do painel
              </h2>
              <ul className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
                {KPIS_FIRME_ORDEM.map((kpi) => (
                  <li key={kpi} className="text-xs">
                    <p className={`font-medium ${KPI_NUMERO[kpi]}`}>{LABELS_KPI_FIRME[kpi]}</p>
                    <p className="mt-0.5 text-slate-500 dark:text-slate-400">{SUBTITULOS_KPI_FIRME[kpi]}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Barras: REPOR (&lt; 0, inclui CM = 0 com capital firme negativo, e 0–0,5), VIGIAR (0,5–1),
                OPERAÇÃO NORMAL (1–3), CAPITAL PARADO (&gt; 3). Status Ruptura/Aguardando PC também vêm do empenho vs
                estoque, não só da barra.
              </p>
              <h2 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                Legenda — Ação sugerida
              </h2>
              <ul className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-3">
                <li className="text-xs">
                  <p className="font-semibold text-red-600 dark:text-red-400">⚡ Urgente</p>
                  <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                    Ruptura ou Aguardando PC: acelerar SC/Pré Compra, comprar agora se não houver pipeline, ou cobrar entrega do PC.
                  </p>
                </li>
                <li className="text-xs">
                  <p className="font-medium text-orange-600 dark:text-orange-400">Atenção</p>
                  <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                    Crítico ou Atenção: converter/abrir SC urgente ou programar SC conforme o Status.
                  </p>
                </li>
                <li className="text-xs">
                  <p className="font-medium text-slate-600 dark:text-slate-300">Acompanhar</p>
                  <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                    Saudável: sem ação. Excesso: suspender compra ou bloquear reposição. Sem giro / Sem histórico: avaliar descarte ou validar cadastro.
                  </p>
                </li>
              </ul>
            </section>
          </>
        )}
      </div>

      {grade.colunaFiltroAberta && grade.filtroAbertoRect && (
        <GradeFiltroExcelPortal
          colunaAberta={grade.colunaFiltroAberta}
          rect={grade.filtroAbertoRect}
          dropdownRef={grade.filtroDropdownRef}
          excelFilterDrafts={grade.excelFilterDrafts}
          setExcelFilterDrafts={grade.setExcelFilterDrafts}
          valoresUnicosPorColuna={grade.valoresUnicosPorColuna}
          showNumericFilters={(NUM_KEYS as string[]).includes(grade.colunaFiltroAberta)}
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

      <ModalFiltrosConsultaEstoque
        open={filtrosOpen}
        carregando={loading}
        msgFiltro={msgFiltro}
        filtros={filtros}
        pedidoFiltro={EMPTY_PEDIDO}
        opcoes={opcoes}
        modo="cobertura"
        somenteComEmpenho={somenteComEmpenhoDraft}
        onSomenteComEmpenhoChange={setSomenteComEmpenhoDraft}
        onClose={() => setFiltrosOpen(false)}
        onChange={(patch) => setFiltros((f) => ({ ...f, ...patch }))}
        onPedidoChange={() => undefined}
        onAlterarEscolhasPedido={() => undefined}
        onLimpar={() => {
          setFiltros(EMPTY_FILTROS);
          setSomenteComEmpenhoDraft(false);
          setMsgFiltro(null);
        }}
        onFiltrar={handleFiltrar}
        onBuscarCodigo={(term) =>
          buscarOpcoesFiltroConsultaEstoque('codigo', term, payloadCobertura(filtros, somenteComEmpenho)).then(
            (r) => r.data
          )
        }
        onBuscarDescricao={(term) =>
          buscarOpcoesFiltroConsultaEstoque(
            'descricao',
            term,
            payloadCobertura(filtros, somenteComEmpenho)
          ).then((r) => r.data)
        }
      />

      {detalhe?.tipo === 'pc' && (
        <ModalPcPendDetalhes
          open
          onClose={() => setDetalhe(null)}
          idProduto={detalhe.linha.idProduto}
          codigo={detalhe.linha.codigo}
          descricao={detalhe.linha.descricao}
          overlayFixed
        />
      )}

      {detalhe && detalhe.tipo !== 'pc' && (
        <ModalConsultaEstoqueDetalhe
          open
          detailKey={detailKey}
          onClose={() => setDetalhe(null)}
          titulo={
            detalhe.tipo === 'saldo'
              ? `Estoque — ${detalhe.linha.codigo}`
              : detalhe.tipo === 'empenho'
                ? `Empenho — ${detalhe.linha.codigo}`
                : detalhe.tipo === 'solicitacao'
                  ? `Solicitação — ${detalhe.linha.codigo}`
                  : `Pré Compra — ${detalhe.linha.codigo}`
          }
          subtitulo={detalhe.linha.descricao}
          onLoad={carregarDetalheModal}
          largo={detalhe.tipo === 'empenho'}
          backdropMode="fixed"
        >
          {({ carregando, erro: erroDetalhe }) => {
            if (carregando) return <p className="py-6 text-center text-slate-500">Carregando…</p>;
            if (erroDetalhe) return <p className="text-red-600">{erroDetalhe}</p>;
            if (detalhe.tipo === 'saldo') {
              if (detalheSaldo.length === 0) {
                return <p className="text-slate-500">Sem saldo por setor.</p>;
              }
              return (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-slate-50 dark:bg-slate-900/50">
                      <th className="py-2 text-left">Setor</th>
                      <th className="py-2 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalheSaldo.map((s) => (
                      <tr key={s.idSetor} className="border-b border-slate-100 dark:border-slate-700">
                        <td className="py-1.5">
                          {s.setor}
                          {isSetorEstoquePa(s.idSetor) ? ' (PA)' : ''}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">{fmtQtde(s.saldo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            }
            if (detalhe.tipo === 'empenho') {
              if (!detalheEmpenho) return <p className="text-slate-500">Sem empenho.</p>;
              return (
                <EmpenhoLiquidoPainel
                  detalhe={detalheEmpenho}
                  codigo={detalhe.linha.codigo}
                  descricao={detalhe.linha.descricao}
                  saldoAtual={detalhe.linha.saldo}
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

      <CoberturaEstoqueAjudaModal aberto={ajudaAberta} onClose={() => setAjudaAberta(false)} />
    </div>
  );
}
