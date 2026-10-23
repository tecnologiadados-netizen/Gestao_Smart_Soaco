import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MultiSelectWithSearch from '../../components/MultiSelectWithSearch';
import {
  definirContaBancariaDiario,
  definirFormaPagamentoDiario,
  fetchDiarioContasBancarias,
  fetchDiarioFormasPagamento,
  fetchDiarioContasPagar,
  aplicarCartorioDiario,
  aplicarCorAnotacoesDiario,
  importarAnotacoesDiario,
  reprogramarDiarioContasPagar,
  type ContaBancariaOpcao,
  type FormaPagamentoOpcao,
  type DiarioContaPagarLinha,
} from '../../api/diarioFinanceiro';
import {
  DFC_PRIORIDADE_CHIP,
  DFC_PRIORIDADE_LABEL,
  DFC_PRIORIDADE_LABEL_CURTO,
  DFC_PRIORIDADES,
  aplicarPrioridadeLancamentosLote,
  listarPrioridadesConta,
  listarPrioridadesLancamento,
  removerPrioridadeLancamento,
  salvarPrioridadeLancamento,
  type DfcPrioridade,
  type DfcTipoRefLancamento,
} from '../../api/dfcPrioridade';
import { criarMatcherTextoLivre } from '../../utils/textoLivreBusca';
import { FILTRO_COR_QUALQUER } from '../../components/grade/GradeFiltroExcelPortal';
import { compareRowsBySortLevels, useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import {
  DIARIO_COLUNAS_GRADE,
  DiarioCabecalhoTh,
  DiarioGradeFiltroPortal,
} from './diario/DiarioGradeCabecalho';
import {
  exportarDiarioContasPagarExcel,
  exportarDiarioContasPagarPdf,
} from './diario/exportDiarioContasPagar';
import { DescricaoReprogramadaGrade } from './diario/descricaoReprogramada';
import { DiarioAnotacaoCelula } from './diario/DiarioAnotacaoCelula';
import { DiarioClassificarCorDialog, type NivelClassificacaoCor } from './diario/DiarioClassificarCorDialog';
import { DiarioPaletaCorExcel } from './diario/DiarioPaletaCorExcel';
import { corObservacaoDiario } from './diario/coresObservacaoDiario';
import { DiarioAlocarSubclassificacaoModal } from './diario/DiarioAlocarSubclassificacaoModal';
import { DiarioSubclassificacaoModal } from './diario/DiarioSubclassificacaoModal';
import { DiarioVencidosPainel, type DiarioVencidosPainelHandle } from './diario/DiarioVencidosPainel';
import { BadgeCartorio, textoCartorio } from './diario/cartorioDiario';
import { lerPlanilhaAnotacoes } from './diario/lerPlanilhaAnotacoes';
import {
  GradeColunasMenu,
  useGradeColunasExcel,
  type GradeColunaConfiguravel,
} from '../../components/grade/GradeColunasExcel';

type Atalho = 'hoje' | 'ontem' | 'amanha' | 'mes';

const FILTRO_INPUT_CLASS =
  'h-8 w-full rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 px-2.5 text-xs focus:ring-2 focus:ring-primary-600 focus:border-transparent';
const FILTRO_LABEL_CLASS = 'block text-[11px] leading-none text-slate-500 dark:text-slate-400 mb-1';
const FILTRO_BTN =
  'inline-flex h-8 items-center justify-center rounded-lg px-3 text-xs font-medium border transition-colors disabled:opacity-60';

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function periodoAtalho(atalho: Atalho): { inicio: string; fim: string } {
  const hoje = new Date();
  if (atalho === 'hoje') {
    const y = ymdLocal(hoje);
    return { inicio: y, fim: y };
  }
  if (atalho === 'ontem') {
    const d = new Date(hoje);
    d.setDate(d.getDate() - 1);
    const y = ymdLocal(d);
    return { inicio: y, fim: y };
  }
  if (atalho === 'amanha') {
    const d = new Date(hoje);
    d.setDate(d.getDate() + 1);
    const y = ymdLocal(d);
    return { inicio: y, fim: y };
  }
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  return { inicio: ymdLocal(inicio), fim: ymdLocal(fim) };
}

function formatData(iso: string | null): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function formatMoeda(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function soma(linhas: DiarioContaPagarLinha[], campo: 'valor' | 'valorBaixado' | 'saldo'): number {
  return linhas.reduce((acc, l) => acc + (Number(l[campo]) || 0), 0);
}

const ATALHOS: { id: Atalho; label: string }[] = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'ontem', label: 'Ontem' },
  { id: 'amanha', label: 'Amanhã' },
  { id: 'mes', label: 'Este mês' },
];

const OPCOES_SITUACAO = ['Em aberto', 'Baixado'];
const OPCOES_ORIGEM = ['Nomus', 'Shop9'];
const OPCOES_CARTORIO = ['Sim', 'Não'];

function selecionados(csv: string): Set<string> {
  return new Set(
    csv
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function chaveLinha(l: DiarioContaPagarLinha): string {
  return [
    l.origem,
    l.codigo,
    l.status,
    l.dataVencimento ?? '',
    l.dataBaixa ?? '',
    l.valor,
    l.saldo,
    l.idAgendamento ?? '',
    l.fornecedor ?? '',
    l.descricao ?? '',
    l.observacao ?? '',
  ].join('\u001f');
}

function idReprogramacao(l: DiarioContaPagarLinha): number | null {
  if (l.status !== 'Em aberto') return null;
  if (l.origem === 'Nomus') return l.idAgendamento && l.idAgendamento > 0 ? l.idAgendamento : null;
  return l.codigo > 0 ? l.codigo : null;
}

function podeReprogramar(l: DiarioContaPagarLinha): boolean {
  return idReprogramacao(l) != null;
}

function podePriorizar(l: DiarioContaPagarLinha): boolean {
  return (
    l.idEmpresa != null
    && l.idEmpresa > 0
    && (l.tipoRef === 'A' || l.tipoRef === 'L' || l.tipoRef === 'S')
    && l.idRef != null
    && l.idRef > 0
  );
}

function dedupePrioridade(linhas: DiarioContaPagarLinha[]): DiarioContaPagarLinha[] {
  const vistos = new Set<string>();
  const saida: DiarioContaPagarLinha[] = [];
  for (const l of linhas) {
    if (!podePriorizar(l)) continue;
    const chave = chavePrioridadeLanc(l.idEmpresa as number, l.tipoRef as string, l.idRef as number);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    saida.push(l);
  }
  return saida;
}

function motivoBloqueio(l: DiarioContaPagarLinha): string | null {
  if (l.status === 'Baixado') return 'Título baixado não pode ser reprogramado.';
  if (l.origem === 'Nomus' && !(l.idAgendamento && l.idAgendamento > 0)) {
    return 'Lançamento sem agendamento financeiro. Não há id para alterar o vencimento.';
  }
  return null;
}

function dedupeReprogramar(linhas: DiarioContaPagarLinha[]): DiarioContaPagarLinha[] {
  const vistos = new Set<string>();
  const saida: DiarioContaPagarLinha[] = [];
  for (const l of linhas) {
    const id = idReprogramacao(l);
    if (id == null) continue;
    const chave = `${l.origem}:${id}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    saida.push(l);
  }
  return saida;
}

function chaveCartorio(l: Pick<DiarioContaPagarLinha, 'origem' | 'codigo'>): string {
  return `${l.origem}:${l.codigo}`;
}

function dedupeCartorio(linhas: DiarioContaPagarLinha[]): DiarioContaPagarLinha[] {
  const vistos = new Set<string>();
  const saida: DiarioContaPagarLinha[] = [];
  for (const l of linhas) {
    if (!(l.codigo > 0)) continue;
    const chave = chaveCartorio(l);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    saida.push(l);
  }
  return saida;
}

function empresaExibida(l: DiarioContaPagarLinha): string | null {
  if (l.filial?.trim()) return l.filial.trim();
  if (l.empresa?.trim()) return l.empresa.trim();
  return null;
}

const VAZIO_CELULA = '—';

function textoCelula(l: DiarioContaPagarLinha, col: string): string {
  const texto = (v: string | null | undefined) => {
    const t = v?.trim();
    return t ? t.toLocaleUpperCase('pt-BR') : VAZIO_CELULA;
  };
  switch (col) {
    case 'origem':
      return l.origem.toLocaleUpperCase('pt-BR');
    case 'situacao':
      return l.status.toLocaleUpperCase('pt-BR');
    case 'vencimento':
      return formatData(l.dataVencimento);
    case 'reprogramado':
      return texto(l.reprogramado);
    case 'cartorio':
      return textoCartorio(l.emCartorio);
    case 'baixa':
      return formatData(l.dataBaixa);
    case 'fornecedor':
      return texto(l.fornecedor);
    case 'empresa':
      return texto(empresaExibida(l));
    case 'codigo':
      return l.codigoClassificacao != null && l.codigoClassificacao > 0 ? String(l.codigoClassificacao) : VAZIO_CELULA;
    case 'plano':
      return texto(l.planoContas);
    case 'pc':
      return texto(l.pedidoCompra);
    case 'nfe':
      return texto(l.notaFiscal);
    case 'itens':
      return (l.itens?.length ?? 0) > 0 ? 'Com itens' : VAZIO_CELULA;
    case 'descricao':
      return texto(l.descricao);
    case 'observacao':
      return texto(l.observacao);
    case 'anotacao':
      return texto(l.anotacao);
    case 'forma':
      return texto(l.formaPagamento);
    case 'conta':
      return texto(l.contaBancaria);
    case 'valor':
      return formatMoeda(l.valor);
    case 'baixado':
      return formatMoeda(l.valorBaixado);
    case 'saldo':
      return formatMoeda(l.saldo);
    default:
      return '';
  }
}

function valorOrdenacao(l: DiarioContaPagarLinha, col: string): string | number {
  if (col === 'valor') return l.valor;
  if (col === 'baixado') return l.valorBaixado;
  if (col === 'saldo') return l.saldo;
  if (col === 'vencimento') return l.dataVencimento ?? '';
  if (col === 'baixa') return l.dataBaixa ?? '';
  return textoCelula(l, col);
}

function chavePrioridadeConta(idEmpresa: number, idConta: number): string {
  return `${idEmpresa}#${idConta}`;
}

function chavePrioridadeLanc(idEmpresa: number, tipoRef: string, idRef: number): string {
  return `${idEmpresa}#${tipoRef}#${idRef}`;
}

function ehPrioridade(n: number): n is DfcPrioridade {
  return (DFC_PRIORIDADES as readonly number[]).includes(n);
}

function opcoesCampo(linhas: DiarioContaPagarLinha[], campo: 'fornecedor' | 'planoContas'): string[] {
  const set = new Set<string>();
  for (const l of linhas) {
    const v = l[campo];
    if (v?.trim()) set.add(v.trim());
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export type DiarioFinanceiroModo = {
  dataFixa: string;
  editavel: boolean;
  aprovacao?: boolean;
  onAprovacaoChange?: (itens: DiarioAprovacaoSelecao[]) => void;
};

export type DiarioAprovacaoSelecao = {
  linha: DiarioContaPagarLinha;
  banco: string;
};

function podeAprovarConta(l: DiarioContaPagarLinha): boolean {
  return l.status === 'Em aberto' && l.codigo > 0 && Number(l.saldo) > 0;
}

export default function DiarioFinanceiroPage({ modo }: { modo?: DiarioFinanceiroModo } = {}) {
  const inicial = modo ? { inicio: modo.dataFixa, fim: modo.dataFixa } : periodoAtalho('hoje');
  const editavel = modo ? modo.editavel : true;
  const [aba, setAba] = useState<'pagar' | 'vencidos'>('pagar');
  const [atalho, setAtalho] = useState<Atalho | null>(modo ? null : 'hoje');
  const [dataInicio, setDataInicio] = useState(inicial.inicio);
  const [dataFim, setDataFim] = useState(inicial.fim);
  const dataProcesso = modo?.dataFixa || dataInicio;
  const [filtrosPagarVisivel, setFiltrosPagarVisivel] = useState(true);
  const [filtrosVencidosVisivel, setFiltrosVencidosVisivel] = useState(true);
  const [vencidosVisitado, setVencidosVisitado] = useState(false);
  const filtrosVisivel = aba === 'vencidos' ? filtrosVencidosVisivel : filtrosPagarVisivel;
  const [acoesAberto, setAcoesAberto] = useState(false);
  const [colunasAberto, setColunasAberto] = useState(false);
  const acoesRef = useRef<HTMLDivElement>(null);
  const [fornecedores, setFornecedores] = useState('');
  const [empresas, setEmpresas] = useState('');
  const [planos, setPlanos] = useState('');
  const [origens, setOrigens] = useState('');
  const [situacoes, setSituacoes] = useState('');
  const [cartorioFiltro, setCartorioFiltro] = useState('');
  const [observacao, setObservacao] = useState('');
  const [corObservacao, setCorObservacao] = useState('');
  const [filtroCorHex, setFiltroCorHex] = useState<string | null>(null);
  const [niveisCor, setNiveisCor] = useState<NivelClassificacaoCor[]>([]);
  const [classificarCorAberto, setClassificarCorAberto] = useState(false);
  const [linhas, setLinhas] = useState<DiarioContaPagarLinha[]>([]);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(() => new Set());
  const [bancosAprovacao, setBancosAprovacao] = useState<Record<string, string>>({});
  const [modalAberto, setModalAberto] = useState(false);
  const [modalLinhas, setModalLinhas] = useState<DiarioContaPagarLinha[]>([]);
  const [novaData, setNovaData] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState<string | null>(null);
  const [contaAberta, setContaAberta] = useState(false);
  const [contasOpcoes, setContasOpcoes] = useState<ContaBancariaOpcao[]>([]);
  const [contaId, setContaId] = useState('');
  const [carregandoContas, setCarregandoContas] = useState(false);
  const [prioridadeAberta, setPrioridadeAberta] = useState(false);
  const [prioridadeValor, setPrioridadeValor] = useState('');
  const [cartorioAberto, setCartorioAberto] = useState(false);
  const [cartorioAcao, setCartorioAcao] = useState<'apontar' | 'remover'>('apontar');
  const [formaAberta, setFormaAberta] = useState(false);
  const [subAberta, setSubAberta] = useState(false);
  const [alocarSubAberta, setAlocarSubAberta] = useState(false);
  const [alocarClassifs, setAlocarClassifs] = useState<string[]>([]);
  const vencidosRef = useRef<DiarioVencidosPainelHandle>(null);
  const [vencidosUi, setVencidosUi] = useState({ linhas: 0, selecionadas: 0, loading: false });
  const onResumoVencidos = useCallback((resumo: { linhas: number; selecionadas: number; loading: boolean }) => {
    setVencidosUi(resumo);
  }, []);
  const [formasOpcoes, setFormasOpcoes] = useState<FormaPagamentoOpcao[]>([]);
  const [formaId, setFormaId] = useState('');
  const [carregandoFormas, setCarregandoFormas] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [itensModal, setItensModal] = useState<DiarioContaPagarLinha | null>(null);
  const [prioridadeConta, setPrioridadeConta] = useState<Map<string, DfcPrioridade>>(() => new Map());
  const [prioridadeLanc, setPrioridadeLanc] = useState<Map<string, DfcPrioridade>>(() => new Map());
  const [salvandoPrioridade, setSalvandoPrioridade] = useState<string | null>(null);
  const [exportando, setExportando] = useState<'xlsx' | 'pdf' | null>(null);
  const [importando, setImportando] = useState(false);
  const [aplicandoCor, setAplicandoCor] = useState(false);
  const arquivoAnotacaoRef = useRef<HTMLInputElement | null>(null);
  const [cargaTick, setCargaTick] = useState(0);

  const carregarPrioridades = useCallback(async () => {
    const [contas, lancs] = await Promise.all([listarPrioridadesConta(), listarPrioridadesLancamento()]);
    if (contas.erro || lancs.erro) setAviso((prev) => prev ?? contas.erro ?? lancs.erro ?? null);
    const mapaConta = new Map<string, DfcPrioridade>();
    for (const c of contas.linhas) {
      if (ehPrioridade(c.prioridade)) mapaConta.set(chavePrioridadeConta(c.idEmpresa, c.idContaFinanceiro), c.prioridade);
    }
    const mapaLanc = new Map<string, DfcPrioridade>();
    for (const l of lancs.linhas) {
      if (ehPrioridade(l.prioridade)) mapaLanc.set(chavePrioridadeLanc(l.idEmpresa, l.tipoRef, l.idRef), l.prioridade);
    }
    setPrioridadeConta(mapaConta);
    setPrioridadeLanc(mapaLanc);
  }, []);

  const prioridadeDaLinha = useCallback(
    (l: DiarioContaPagarLinha) => {
      if (l.idEmpresa == null || l.idEmpresa <= 0 || l.tipoRef == null || l.idRef == null || l.idRef <= 0) {
        return { override: null as DfcPrioridade | null, plano: null as DfcPrioridade | null, efetiva: null as DfcPrioridade | null, chave: null as string | null };
      }
      const chave = chavePrioridadeLanc(l.idEmpresa, l.tipoRef, l.idRef);
      const override = prioridadeLanc.get(chave) ?? null;
      const plano =
        l.idContaFinanceiro != null && l.idContaFinanceiro > 0
          ? prioridadeConta.get(chavePrioridadeConta(l.idEmpresa, l.idContaFinanceiro)) ?? null
          : null;
      return { override, plano, efetiva: override ?? plano, chave };
    },
    [prioridadeConta, prioridadeLanc],
  );

  const rotuloPrioridade = useCallback((l: DiarioContaPagarLinha) => {
    const { efetiva } = prioridadeDaLinha(l);
    return efetiva == null ? '' : `${efetiva} — ${DFC_PRIORIDADE_LABEL[efetiva]}`;
  }, [prioridadeDaLinha]);

  const alterarPrioridade = useCallback(
    async (l: DiarioContaPagarLinha, novo: DfcPrioridade | null) => {
      if (l.idEmpresa == null || l.idEmpresa <= 0 || l.tipoRef == null || l.idRef == null || l.idRef <= 0) return;
      const tipoRef = l.tipoRef as DfcTipoRefLancamento;
      const chave = chavePrioridadeLanc(l.idEmpresa, tipoRef, l.idRef);
      setSalvandoPrioridade(chave);
      const anterior = prioridadeLanc.get(chave) ?? null;
      setPrioridadeLanc((prev) => {
        const next = new Map(prev);
        if (novo == null) next.delete(chave);
        else next.set(chave, novo);
        return next;
      });
      try {
        if (novo == null) {
          const r = await removerPrioridadeLancamento(l.idEmpresa, tipoRef, l.idRef);
          if (!r.ok) throw new Error(r.erro || 'Falha ao remover a prioridade.');
        } else {
          const r = await salvarPrioridadeLancamento({
            idEmpresa: l.idEmpresa,
            tipoRef,
            idRef: l.idRef,
            idContaFinanceiro: l.idContaFinanceiro,
            prioridade: novo,
          });
          if (!r.ok) throw new Error(r.erro || 'Falha ao salvar a prioridade.');
        }
      } catch (e) {
        setPrioridadeLanc((prev) => {
          const next = new Map(prev);
          if (anterior == null) next.delete(chave);
          else next.set(chave, anterior);
          return next;
        });
        setErro(e instanceof Error ? e.message : String(e));
      } finally {
        setSalvandoPrioridade(null);
      }
    },
    [prioridadeLanc],
  );

  const carregar = useCallback(async (inicio: string, fim: string) => {
    setLoading(true);
    setErro(null);
    setAviso(null);
    try {
      const res = await fetchDiarioContasPagar({ dataInicio: inicio, dataFim: fim });
      setLinhas(res.linhas);
      setSelecionadas(new Set());
      setBancosAprovacao({});
      setCargaTick((n) => n + 1);
      const partes = [res.erroShop9, res.erroNomus].filter(Boolean);
      setAviso(partes.length > 0 ? partes.join(' · ') : null);
      void carregarPrioridades();
    } catch (e) {
      setLinhas([]);
      setSelecionadas(new Set());
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [carregarPrioridades]);

  useEffect(() => {
    void carregar(inicial.inicio, inicial.fim);
    // carga do dia corrente
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregar]);

  useEffect(() => {
    const onFocus = () => void carregarPrioridades();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [carregarPrioridades]);

  useEffect(() => {
    if (!acoesAberto) return;
    const fechar = (e: MouseEvent) => {
      if (!acoesRef.current?.contains(e.target as Node)) setAcoesAberto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAcoesAberto(false);
    };
    document.addEventListener('mousedown', fechar);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fechar);
      document.removeEventListener('keydown', tecla);
    };
  }, [acoesAberto]);

  const aplicarAtalho = (id: Atalho) => {
    const p = periodoAtalho(id);
    setAtalho(id);
    setDataInicio(p.inicio);
    setDataFim(p.fim);
    void carregar(p.inicio, p.fim);
  };

  const aplicarIntervalo = () => {
    setAtalho(null);
    void carregar(dataInicio, dataFim);
  };

  const opcoesFornecedor = useMemo(() => opcoesCampo(linhas, 'fornecedor'), [linhas]);
  const opcoesEmpresa = useMemo(() => {
    const set = new Set<string>();
    for (const l of linhas) {
      const v = empresaExibida(l);
      if (v) set.add(v);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [linhas]);
  const opcoesPlano = useMemo(() => opcoesCampo(linhas, 'planoContas'), [linhas]);

  const linhasFiltradas = useMemo(() => {
    const fFornecedor = selecionados(fornecedores);
    const fEmpresa = selecionados(empresas);
    const fPlano = selecionados(planos);
    const fOrigem = selecionados(origens);
    const fSituacao = selecionados(situacoes);
    const fCartorio = selecionados(cartorioFiltro);
    const casaObs = criarMatcherTextoLivre(observacao);
    return linhas.filter((l) => {
      if (fSituacao.size > 0 && !fSituacao.has(l.status)) return false;
      if (fOrigem.size > 0 && !fOrigem.has(l.origem)) return false;
      if (fFornecedor.size > 0 && !fFornecedor.has(l.fornecedor ?? '')) return false;
      if (fEmpresa.size > 0 && !fEmpresa.has(empresaExibida(l) ?? '')) return false;
      if (fPlano.size > 0 && !fPlano.has(l.planoContas ?? '')) return false;
      if (fCartorio.size > 0 && !fCartorio.has(l.emCartorio ? 'Sim' : 'Não')) return false;
      if (observacao.trim()) {
        const texto = `${l.observacao ?? ''} ${l.descricao ?? ''} ${l.anotacao ?? ''}`;
        if (!casaObs(texto)) return false;
      }
      if (corObservacao === 'sem' && l.anotacaoCor) return false;
      if (corObservacao === 'com' && !l.anotacaoCor) return false;
      return true;
    });
  }, [linhas, fornecedores, empresas, planos, origens, situacoes, cartorioFiltro, observacao, corObservacao]);

  const coresCabecalho = useMemo(() => {
    const usadas = new Set<string>();
    let temSem = false;
    for (const l of linhasFiltradas) {
      const cor = corObservacaoDiario(l.anotacaoCor);
      if (cor) usadas.add(cor);
      else temSem = true;
    }
    const lista: Array<{ id: string; hex: string | null }> = [...usadas].sort().map((hex) => ({ id: hex, hex }));
    if (temSem) lista.push({ id: '', hex: null });
    return lista;
  }, [linhasFiltradas]);

  const linhasComCor = useMemo(() => {
    if (filtroCorHex == null) return linhasFiltradas;
    if (filtroCorHex === FILTRO_COR_QUALQUER) {
      return linhasFiltradas.filter((l) => corObservacaoDiario(l.anotacaoCor) != null);
    }
    return linhasFiltradas.filter((l) => (corObservacaoDiario(l.anotacaoCor) ?? '') === filtroCorHex);
  }, [linhasFiltradas, filtroCorHex]);

  const colunasDaGrade = useMemo<GradeColunaConfiguravel[]>(() => {
    const larguras: Record<string, number> = {
      codigo: 86,
      situacao: 105,
      plano: 180,
      vencimento: 112,
      reprogramado: 118,
      cartorio: 90,
      empresa: 160,
      conta: 170,
      forma: 165,
      fornecedor: 190,
      descricao: 260,
      observacao: 190,
      anotacao: 190,
      pc: 210,
      saldo: 130,
      nfe: 110,
      banco: 170,
      prioridade: 170,
      itens: 72,
    };
    const base: GradeColunaConfiguravel[] = DIARIO_COLUNAS_GRADE.map((coluna) => ({
      ...coluna,
      largura: larguras[coluna.id] ?? 140,
      larguraMinima: coluna.id === 'itens' ? 60 : 72,
    }));
    if (!modo?.aprovacao) return base;
    const posicao = base.findIndex((coluna) => coluna.id === 'prioridade');
    base.splice(posicao < 0 ? base.length : posicao, 0, {
      id: 'banco',
      label: 'Banco',
      largura: larguras.banco,
      larguraMinima: 110,
      fixa: true,
    });
    return base;
  }, [modo?.aprovacao]);
  const colunasGrade = useGradeColunasExcel('financeiro.diario.contas-pagar.colunas.v1', colunasDaGrade);

  const getCellText = useCallback(
    (row: DiarioContaPagarLinha, colId: string) =>
      colId === 'prioridade'
        ? rotuloPrioridade(row) || VAZIO_CELULA
        : colId === 'banco'
          ? bancosAprovacao[chaveLinha(row)] || VAZIO_CELULA
          : textoCelula(row, colId),
    [bancosAprovacao, rotuloPrioridade],
  );
  const valueForSort = useCallback(
    (row: DiarioContaPagarLinha, colId: string) =>
      colId === 'prioridade'
        ? prioridadeDaLinha(row).efetiva ?? -1
        : colId === 'banco'
          ? bancosAprovacao[chaveLinha(row)] || ''
          : valorOrdenacao(row, colId),
    [bancosAprovacao, prioridadeDaLinha],
  );
  const compareRows = useCallback(
    (
      a: DiarioContaPagarLinha,
      b: DiarioContaPagarLinha,
      levels: { id: string; dir: 'asc' | 'desc' }[],
      getSortValue: (row: DiarioContaPagarLinha, columnId: string) => string | number,
    ) => {
      if (niveisCor.length > 0 && levels.some((nivel) => nivel.id === 'anotacao')) {
        const corA = corObservacaoDiario(a.anotacaoCor) ?? '';
        const corB = corObservacaoDiario(b.anotacaoCor) ?? '';
        for (const nivel of niveisCor) {
          const aCombina = corA === nivel.corId;
          const bCombina = corB === nivel.corId;
          if (aCombina === bCombina) continue;
          if (nivel.posicao === 'superior') return aCombina ? -1 : 1;
          return aCombina ? 1 : -1;
        }
        return 0;
      }
      return compareRowsBySortLevels(a, b, levels, getSortValue);
    },
    [niveisCor],
  );
  const grade = useGradeFiltrosExcel({
    rows: linhasComCor,
    columnIds: colunasDaGrade.map((c) => c.id),
    getCellText,
    valueForSort,
    compareRows,
    dateColumnIds: ['vencimento', 'baixa'],
  });
  const limparFiltros = () => {
    if (aba === 'vencidos') {
      vencidosRef.current?.limparFiltros();
      return;
    }
    setFornecedores('');
    setEmpresas('');
    setPlanos('');
    setOrigens('');
    setSituacoes('');
    setCartorioFiltro('');
    setObservacao('');
    setCorObservacao('');
    setFiltroCorHex(null);
    setNiveisCor([]);
    setClassificarCorAberto(false);
    grade.limparFiltrosGrade();
  };
  const limparGradeRef = useRef(grade.limparFiltrosGrade);
  limparGradeRef.current = grade.limparFiltrosGrade;
  useEffect(() => {
    limparGradeRef.current();
    setFiltroCorHex(null);
    setNiveisCor([]);
  }, [cargaTick]);

  const linhasExibidas = grade.rowsExibidas;

  const elegiveisVisiveis = useMemo(
    () => linhasExibidas.filter(modo?.aprovacao ? podeAprovarConta : podeReprogramar),
    [linhasExibidas, modo?.aprovacao],
  );
  const qtdSelecionadaVisivel = useMemo(
    () => elegiveisVisiveis.filter((l) => selecionadas.has(chaveLinha(l))).length,
    [elegiveisVisiveis, selecionadas],
  );
  const todosVisiveisMarcados =
    elegiveisVisiveis.length > 0 && qtdSelecionadaVisivel === elegiveisVisiveis.length;
  const headerCheckRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = headerCheckRef.current;
    if (!el) return;
    el.indeterminate = qtdSelecionadaVisivel > 0 && !todosVisiveisMarcados;
  }, [qtdSelecionadaVisivel, todosVisiveisMarcados]);

  useEffect(() => {
    if (!modo?.onAprovacaoChange) return;
    if (!modo.aprovacao) {
      modo.onAprovacaoChange([]);
      return;
    }
    const unicos = new Map<string, DiarioAprovacaoSelecao>();
    for (const linha of linhas) {
      if (!podeAprovarConta(linha) || !selecionadas.has(chaveLinha(linha))) continue;
      unicos.set(`${linha.origem}:${linha.codigo}`, {
        linha,
        banco: bancosAprovacao[chaveLinha(linha)]?.trim() ?? '',
      });
    }
    modo.onAprovacaoChange([...unicos.values()]);
  }, [bancosAprovacao, linhas, modo?.aprovacao, modo?.onAprovacaoChange, selecionadas]);

  const alternarTodos = () => {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (todosVisiveisMarcados) {
        for (const l of elegiveisVisiveis) next.delete(chaveLinha(l));
      } else {
        for (const l of elegiveisVisiveis) next.add(chaveLinha(l));
      }
      return next;
    });
  };

  const alternarUm = (l: DiarioContaPagarLinha) => {
    if (!(modo?.aprovacao ? podeAprovarConta(l) : podeReprogramar(l))) return;
    const chave = chaveLinha(l);
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(chave)) next.delete(chave);
      else next.add(chave);
      return next;
    });
  };

  const linhasMarcadas = () => (
    aba === 'vencidos'
      ? (vencidosRef.current?.linhasSelecionadas() ?? [])
      : linhas.filter((l) => podeReprogramar(l) && selecionadas.has(chaveLinha(l)))
  );

  const abrirPrioridade = () => {
    const escolhidas = dedupePrioridade(linhasMarcadas());
    if (escolhidas.length === 0) {
      setErro('Marque ao menos um título identificado para classificar a prioridade.');
      return;
    }
    setModalLinhas(escolhidas);
    setPrioridadeValor('');
    setErroModal(null);
    setErro(null);
    setPrioridadeAberta(true);
  };

  const confirmarPrioridade = async () => {
    const remover = prioridadeValor === 'remover';
    const prioNum = Number(prioridadeValor);
    const prio = ehPrioridade(prioNum) ? prioNum : null;
    if ((!remover && prio == null) || salvando) return;
    const itens = modalLinhas.flatMap((l) => {
      if (!podePriorizar(l)) return [];
      return [{
        idEmpresa: l.idEmpresa as number,
        tipoRef: l.tipoRef as DfcTipoRefLancamento,
        idRef: l.idRef as number,
        idContaFinanceiro: l.idContaFinanceiro,
      }];
    });
    if (itens.length === 0) return;
    setSalvando(true);
    setErroModal(null);
    try {
      const r = await aplicarPrioridadeLancamentosLote({
        itens,
        prioridade: remover ? undefined : prio ?? undefined,
        remover,
      });
      if (!r.ok) throw new Error(r.erro || 'Falha ao classificar a prioridade.');
      const nova: DfcPrioridade | null = remover ? null : prio;
      setPrioridadeLanc((prev) => {
        const next = new Map(prev);
        for (const it of itens) {
          const chave = chavePrioridadeLanc(it.idEmpresa, it.tipoRef, it.idRef);
          if (nova == null) next.delete(chave);
          else next.set(chave, nova);
        }
        return next;
      });
      setSelecionadas(new Set());
      setAviso(
        `${r.afetados.toLocaleString('pt-BR')} título(s) ${remover ? 'sem prioridade' : `classificado(s) como ${prio} — ${DFC_PRIORIDADE_LABEL[prio as DfcPrioridade]}`}.`,
      );
      setPrioridadeAberta(false);
    } catch (e) {
      setErroModal(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  };

  const abrirCartorio = () => {
    if (!editavel) return;
    const escolhidas = dedupeCartorio(linhasMarcadas());
    if (escolhidas.length === 0) {
      setErro('Marque ao menos um título identificado para apontar o cartório.');
      return;
    }
    setModalLinhas(escolhidas);
    setCartorioAcao(escolhidas.every((l) => l.emCartorio) ? 'remover' : 'apontar');
    setErroModal(null);
    setErro(null);
    setCartorioAberto(true);
  };

  const confirmarCartorio = async () => {
    if (salvando) return;
    const itens = modalLinhas.flatMap((l) => (l.codigo > 0 ? [{ origem: l.origem, codigo: l.codigo }] : []));
    if (itens.length === 0) return;
    const emCartorio = cartorioAcao === 'apontar';
    const chaves = new Set(itens.map((it) => `${it.origem}:${it.codigo}`));
    setSalvando(true);
    setErroModal(null);
    try {
      const r = await aplicarCartorioDiario({ itens, emCartorio, dataProcesso });
      setLinhas((prev) =>
        prev.map((item) => (chaves.has(chaveCartorio(item)) ? { ...item, emCartorio: r.emCartorio } : item)),
      );
      vencidosRef.current?.aplicarCartorio(itens, r.emCartorio);
      setSelecionadas(new Set());
      setAviso(
        r.emCartorio
          ? `${r.atualizados.toLocaleString('pt-BR')} título(s) apontado(s) como em cartório.`
          : `${r.atualizados.toLocaleString('pt-BR')} título(s) sem apontamento de cartório.`,
      );
      setCartorioAberto(false);
    } catch (e) {
      setErroModal(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  };

  const abrirReprogramar = () => {
    if (!editavel) return;
    const escolhidas = dedupeReprogramar(linhasMarcadas());
    if (escolhidas.length === 0) return;
    setModalLinhas(escolhidas);
    setNovaData('');
    setErroModal(null);
    setModalAberto(true);
  };

  const abrirContaBancaria = () => {
    if (!editavel) return;
    const escolhidas = dedupeReprogramar(linhasMarcadas());
    if (escolhidas.length === 0) return;
    const origens = new Set(escolhidas.map((l) => l.origem));
    if (origens.size > 1) {
      setErro(
        'Selecione títulos de uma só origem. No Nomus a conta é gravada no ERP; no Shop9 ela fica registrada neste projeto.',
      );
      return;
    }
    const origem = escolhidas[0]?.origem;
    if (!origem) return;
    setModalLinhas(escolhidas);
    setContaId('');
    setContasOpcoes([]);
    setErroModal(null);
    setErro(null);
    setContaAberta(true);
    setCarregandoContas(true);
    void fetchDiarioContasBancarias(origem)
      .then((contas) => setContasOpcoes(contas))
      .catch((e) => setErroModal(e instanceof Error ? e.message : String(e)))
      .finally(() => setCarregandoContas(false));
  };

  const confirmarContaBancaria = async () => {
    const idConta = Number(contaId);
    if (!Number.isInteger(idConta) || idConta <= 0 || salvando) return;
    const itens = modalLinhas.flatMap((l) => {
      const id = idReprogramacao(l);
      return id == null ? [] : [{ origem: l.origem, id }];
    });
    if (itens.length === 0) return;
    setSalvando(true);
    setErroModal(null);
    try {
      const res = await definirContaBancariaDiario({ idContaBancaria: idConta, dataProcesso, itens });
      const partes: string[] = [];
      if (res.atualizados > 0) {
        const onde = res.origem === 'Nomus' ? 'no Nomus' : 'neste projeto';
        partes.push(
          `${res.atualizados.toLocaleString('pt-BR')} título(s) com a conta ${res.nomeConta || ''} gravada ${onde}.`.trim(),
        );
      }
      if (res.ignorados.length > 0) {
        partes.push(
          `${res.ignorados.length.toLocaleString('pt-BR')} título(s) não alterado(s) porque já estavam baixados ou o id não confere.`,
        );
      }
      if (res.erro) partes.push(res.erro);
      const texto = partes.join(' ');
      if (res.atualizados > 0) {
        setSelecionadas(new Set());
        setAviso(texto || null);
        setContaAberta(false);
        await carregar(dataInicio, dataFim);
        vencidosRef.current?.recarregar();
      } else {
        setErroModal(texto || 'Nenhuma conta bancária foi alterada.');
      }
    } catch (e) {
      setErroModal(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  };

  const abrirFormaPagamento = () => {
    if (!editavel) return;
    const escolhidas = dedupeReprogramar(linhasMarcadas());
    if (escolhidas.length === 0) return;
    const origens = new Set(escolhidas.map((l) => l.origem));
    if (origens.size > 1) {
      setErro(
        'Selecione títulos de uma só origem. No Nomus a forma de pagamento é gravada no ERP; no Shop9 ela fica registrada neste projeto.',
      );
      return;
    }
    const origem = escolhidas[0]?.origem;
    if (!origem) return;
    setModalLinhas(escolhidas);
    setFormaId('');
    setFormasOpcoes([]);
    setErroModal(null);
    setErro(null);
    setFormaAberta(true);
    setCarregandoFormas(true);
    void fetchDiarioFormasPagamento(origem)
      .then((formas) => setFormasOpcoes(formas))
      .catch((e) => setErroModal(e instanceof Error ? e.message : String(e)))
      .finally(() => setCarregandoFormas(false));
  };

  const abrirSubclassificacao = () => {
    setErro(null);
    setSubAberta(true);
  };

  const abrirRelacionarSubclassificacao = () => {
    if (aba !== 'vencidos') {
      setErro('Marque títulos na grade de Vencidos/Reprogramados para relacionar a classificação.');
      return;
    }
    const marcadas = vencidosRef.current?.linhasSelecionadas() ?? [];
    if (marcadas.length === 0) {
      setErro('Marque ao menos um título na grade de Vencidos/Reprogramados para relacionar a classificação.');
      return;
    }
    const classifs = [...new Set(marcadas.map((l) => l.planoContas?.trim() || '').filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    if (classifs.length === 0) {
      setErro('Os títulos marcados não têm classificação para relacionar.');
      return;
    }
    setErro(null);
    setAlocarClassifs(classifs);
    setAlocarSubAberta(true);
  };

  const confirmarFormaPagamento = async () => {
    const idForma = formaId.trim();
    if (!idForma || salvando) return;
    const itens = modalLinhas.flatMap((l) => {
      const id = idReprogramacao(l);
      return id == null ? [] : [{ origem: l.origem, id }];
    });
    if (itens.length === 0) return;
    setSalvando(true);
    setErroModal(null);
    try {
      const res = await definirFormaPagamentoDiario({ idFormaPagamento: idForma, dataProcesso, itens });
      const partes: string[] = [];
      if (res.atualizados > 0) {
        const onde = res.origem === 'Nomus' ? 'no Nomus' : 'neste projeto';
        partes.push(
          `${res.atualizados.toLocaleString('pt-BR')} título(s) com a forma ${res.nomeForma || ''} gravada ${onde}.`.trim(),
        );
      }
      if (res.ignorados.length > 0) {
        partes.push(
          `${res.ignorados.length.toLocaleString('pt-BR')} título(s) não alterado(s) porque já estavam baixados ou o id não confere.`,
        );
      }
      if (res.erro) partes.push(res.erro);
      const texto = partes.join(' ');
      if (res.atualizados > 0) {
        setSelecionadas(new Set());
        setAviso(texto || null);
        setFormaAberta(false);
        await carregar(dataInicio, dataFim);
        vencidosRef.current?.recarregar();
      } else {
        setErroModal(texto || 'Nenhuma forma de pagamento foi alterada.');
      }
    } catch (e) {
      setErroModal(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  };

  const confirmarReprogramar = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(novaData) || salvando) return;
    const itens = modalLinhas.flatMap((l) => {
      const id = idReprogramacao(l);
      return id == null ? [] : [{ origem: l.origem, id }];
    });
    if (itens.length === 0) return;
    setSalvando(true);
    setErroModal(null);
    try {
      const res = await reprogramarDiarioContasPagar({ dataVencimento: novaData, dataProcesso, itens });
      const partes: string[] = [];
      if (res.atualizados > 0) {
        partes.push(`${res.atualizados.toLocaleString('pt-BR')} vencimento(s) atualizado(s) para ${formatData(res.dataVencimento)}.`);
      }
      if (res.ignorados.length > 0) {
        partes.push(`${res.ignorados.length.toLocaleString('pt-BR')} título(s) não alterado(s) porque já estavam baixados ou o id não confere.`);
      }
      if (res.erroNomus) partes.push(`Nomus: ${res.erroNomus}`);
      if (res.erroShop9) partes.push(`Shop9: ${res.erroShop9}`);
      const texto = partes.join(' ');
      if (res.atualizados > 0) {
        setSelecionadas(new Set());
        setAviso(texto || null);
        setModalAberto(false);
        await carregar(dataInicio, dataFim);
        vencidosRef.current?.recarregar();
      } else {
        setErroModal(texto || 'Nenhum vencimento foi alterado.');
      }
    } catch (e) {
      setErroModal(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  };

  const totais = useMemo(
    () => ({
      qtd: linhasExibidas.length,
      valor: soma(linhasExibidas, 'valor'),
      baixado: soma(linhasExibidas, 'valorBaixado'),
      saldo: soma(linhasExibidas, 'saldo'),
    }),
    [linhasExibidas],
  );

  const importarAnotacoes = async (arquivo: File | undefined) => {
    if (!editavel || !arquivo || importando) return;
    setImportando(true);
    setErro(null);
    try {
      const matriz = await lerPlanilhaAnotacoes(arquivo);
      const res = await importarAnotacoesDiario(matriz, dataProcesso);
      const partes = [`${res.gravados} observação(ões) gravada(s).`];
      if (res.semCorrespondencia > 0) partes.push(`${res.semCorrespondencia} sem conta correspondente.`);
      if (res.ambiguos > 0) partes.push(`${res.ambiguos} com mais de uma conta possível.`);
      if (res.amostrasSem.length > 0) partes.push(`Exemplos: ${res.amostrasSem.join('; ')}.`);
      await carregar(dataInicio, dataFim);
      vencidosRef.current?.recarregar();
      setAviso(partes.join(' '));
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setImportando(false);
      if (arquivoAnotacaoRef.current) arquivoAnotacaoRef.current.value = '';
    }
  };

  const aplicarCorLote = async (corHex: string | null) => {
    if (!editavel || aplicandoCor) return;
    const vistos = new Set<string>();
    const itens = linhas.flatMap((l) => {
      if (!selecionadas.has(chaveLinha(l)) || !(l.codigo > 0)) return [];
      const chave = `${l.origem}:${l.codigo}`;
      if (vistos.has(chave)) return [];
      vistos.add(chave);
      return [{ origem: l.origem, codigo: l.codigo }];
    });
    if (itens.length === 0) {
      setErro('Marque ao menos um título na grade para aplicar a cor.');
      return;
    }
    setAplicandoCor(true);
    setErro(null);
    try {
      const res = await aplicarCorAnotacoesDiario({ itens, cor: corHex, dataProcesso });
      setLinhas((prev) =>
        prev.map((item) => (vistos.has(`${item.origem}:${item.codigo}`) ? { ...item, anotacaoCor: res.cor } : item)),
      );
      setAviso(
        res.cor
          ? `${res.atualizados.toLocaleString('pt-BR')} observação(ões) coloridas.`
          : `${res.atualizados.toLocaleString('pt-BR')} observação(ões) sem preenchimento.`,
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setAplicandoCor(false);
    }
  };

  const exportar = async (formato: 'xlsx' | 'pdf') => {
    const doVencidos = aba === 'vencidos';
    const alvo = doVencidos ? (vencidosRef.current?.linhasVisiveis() ?? []) : linhasExibidas;
    const periodo = doVencidos ? vencidosRef.current?.periodo() : { inicio: dataInicio, fim: dataFim };
    if (exportando || alvo.length === 0 || !periodo) return;
    const totaisAlvo = {
      qtd: alvo.length,
      valor: soma(alvo, 'valor'),
      baixado: soma(alvo, 'valorBaixado'),
      saldo: soma(alvo, 'saldo'),
    };
    setExportando(formato);
    try {
      if (formato === 'xlsx') {
        await exportarDiarioContasPagarExcel({
          linhas: alvo,
          totais: totaisAlvo,
          dataInicio: periodo.inicio,
          dataFim: periodo.fim,
          rotuloPrioridade: (l) => rotuloPrioridade(l),
        });
      } else {
        exportarDiarioContasPagarPdf({
          linhas: alvo,
          totais: totaisAlvo,
          dataInicio: periodo.inicio,
          dataFim: periodo.fim,
          rotuloPrioridade: (l) => rotuloPrioridade(l),
        });
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setExportando(null);
    }
  };

  const renderCelulaGrade = (
    colId: string,
    l: DiarioContaPagarLinha,
    prio: ReturnType<typeof prioridadeDaLinha>,
    salvandoPrio: boolean,
  ) => {
    const style = colunasGrade.estiloColuna(colId);
    switch (colId) {
      case 'codigo':
        return <td key={colId} style={style} className="px-2 py-1.5 whitespace-nowrap tabular-nums">{l.codigoClassificacao != null && l.codigoClassificacao > 0 ? l.codigoClassificacao : '—'}</td>;
      case 'situacao':
        return (
          <td key={colId} style={style} className="px-2 py-1.5 whitespace-nowrap">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${l.status === 'Baixado' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'}`}>{l.status}</span>
          </td>
        );
      case 'plano':
        return <td key={colId} style={style} className="truncate px-2 py-1.5" title={l.planoContas ?? ''}>{l.planoContas ?? '—'}</td>;
      case 'vencimento':
        return <td key={colId} style={style} className="px-2 py-1.5 whitespace-nowrap">{formatData(l.dataVencimento)}</td>;
      case 'reprogramado':
        return <td key={colId} style={style} className="px-2 py-1.5 whitespace-nowrap font-semibold text-red-600 dark:text-red-400">{l.reprogramado ?? '—'}</td>;
      case 'cartorio':
        return <td key={colId} style={style} className="px-2 py-1.5 whitespace-nowrap normal-case"><BadgeCartorio sim={l.emCartorio} /></td>;
      case 'empresa':
        return <td key={colId} style={style} className="truncate px-2 py-1.5" title={empresaExibida(l) ?? ''}>{empresaExibida(l) ?? '—'}</td>;
      case 'conta':
        return <td key={colId} style={style} className="truncate px-2 py-1.5" title={l.contaBancaria ?? ''}>{l.contaBancaria ?? '—'}</td>;
      case 'forma':
        return <td key={colId} style={style} className="truncate px-2 py-1.5" title={l.formaPagamento ?? ''}>{l.formaPagamento ?? '—'}</td>;
      case 'fornecedor':
        return <td key={colId} style={style} className="truncate px-2 py-1.5" title={l.fornecedor ?? ''}>{l.fornecedor ?? '—'}</td>;
      case 'descricao':
        return <td key={colId} style={style} className="truncate px-2 py-1.5" title={l.descricao ?? ''}><DescricaoReprogramadaGrade texto={l.descricao} /></td>;
      case 'observacao':
        return <td key={colId} style={style} className="truncate px-2 py-1.5" title={l.observacao ?? ''}>{l.observacao ?? '—'}</td>;
      case 'anotacao':
        return (
          <td key={colId} style={style} className="px-1 py-1">
            <DiarioAnotacaoCelula
              linha={l}
              dataProcesso={dataProcesso}
              somenteLeitura={!editavel}
              onGravada={(gravado) => {
                setLinhas((prev) => prev.map((item) => item.origem === l.origem && item.codigo === l.codigo ? { ...item, anotacao: gravado.texto, anotacaoCor: gravado.cor } : item));
              }}
            />
          </td>
        );
      case 'pc':
        return <td key={colId} style={style} className="truncate px-2 py-1.5" title={l.pedidoCompra ?? ''}>{l.pedidoCompra ?? '—'}</td>;
      case 'saldo':
        return <td key={colId} style={style} className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">{formatMoeda(l.saldo)}</td>;
      case 'nfe':
        return <td key={colId} style={style} className="truncate px-2 py-1.5 whitespace-nowrap" title={l.notaFiscal ?? ''}>{l.notaFiscal ?? '—'}</td>;
      case 'banco': {
        const chave = chaveLinha(l);
        return (
          <td key={colId} style={style} className="px-1 py-1 normal-case">
            <input
              type="text"
              value={bancosAprovacao[chave] ?? ''}
              maxLength={100}
              disabled={!podeAprovarConta(l)}
              onChange={(evento) => setBancosAprovacao((atual) => ({ ...atual, [chave]: evento.target.value }))}
              placeholder="Digite o banco"
              aria-label={`Banco da conta ${l.codigo}`}
              className="h-7 w-full rounded border border-slate-300 bg-white px-1.5 text-xs uppercase text-slate-800 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-700"
            />
          </td>
        );
      }
      case 'prioridade':
        return (
          <td key={colId} style={style} className="px-2 py-1.5">
            {prio.chave == null ? <span className="text-slate-400">—</span> : (
              <select
                value={prio.override ?? ''}
                disabled={salvandoPrio || !editavel}
                onChange={(e) => {
                  const v = e.target.value;
                  void alterarPrioridade(l, v === '' ? null : (Number(v) as DfcPrioridade));
                }}
                className={`w-full rounded-md border border-slate-300 bg-white px-1.5 py-1 text-[11px] dark:border-slate-600 dark:bg-slate-700 ${prio.efetiva != null ? `${DFC_PRIORIDADE_CHIP[prio.efetiva]} font-semibold` : ''}`}
              >
                <option value="">{prio.override == null && prio.plano != null ? `${prio.plano} — ${DFC_PRIORIDADE_LABEL_CURTO[prio.plano]}` : prio.override == null ? '— Sem prioridade —' : '— Remover —'}</option>
                {DFC_PRIORIDADES.filter((p) => prio.override != null || prio.plano == null || p !== prio.plano).map((p) => <option key={p} value={p}>{p} — {DFC_PRIORIDADE_LABEL_CURTO[p]}</option>)}
              </select>
            )}
          </td>
        );
      case 'itens':
        return (
          <td key={colId} style={style} className="px-2 py-1.5 text-center">
            {(l.itens?.length ?? 0) > 0 ? (
              <button type="button" onClick={() => setItensModal(l)} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-primary-700 hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-slate-700" title="Ver itens da nota" aria-label={`Ver itens da nota ${l.notaFiscal ?? l.codigo}`}>
                <svg className="h-4 w-4 text-primary-700 dark:text-primary-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h10" /></svg>
              </button>
            ) : <span className="text-slate-300">—</span>}
          </td>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`flex flex-col gap-3 min-h-0 ${modo ? 'h-full overflow-hidden' : ''}`}>
      <div className={`shrink-0 overflow-visible ${modo ? '' : 'card-panel'}`}>
        {modo ? null : (
          <div className="px-4 pt-3 flex items-center justify-between gap-3">
            <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Diário Financeiro</h1>
          </div>
        )}
        <div className="px-4 flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setAba('pagar')}
              className={`px-3 py-2 text-sm font-medium border-b-2 ${
                aba === 'pagar'
                  ? 'border-primary-600 text-primary-700 dark:text-primary-300'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Contas a pagar
            </button>
            <button
              type="button"
              onClick={() => {
                setVencidosVisitado(true);
                setAba('vencidos');
              }}
              className={`px-3 py-2 text-sm font-medium border-b-2 ${
                aba === 'vencidos'
                  ? 'border-primary-600 text-primary-700 dark:text-primary-300'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Vencidos/Reprogramados
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 py-1.5">
            <input
              ref={arquivoAnotacaoRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => void importarAnotacoes(e.target.files?.[0])}
            />
            {aba === 'pagar' ? (
              <GradeColunasMenu
                configuracao={colunasGrade}
                aberto={colunasAberto}
                onAlternar={() => setColunasAberto((valor) => !valor)}
                onFechar={() => setColunasAberto(false)}
              />
            ) : null}
            <div className="relative" ref={acoesRef}>
              <button
                type="button"
                onClick={() => setAcoesAberto((v) => !v)}
                aria-expanded={acoesAberto}
                aria-haspopup="menu"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h10" />
                </svg>
                Ações
                <svg className={`h-3.5 w-3.5 transition-transform ${acoesAberto ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {acoesAberto ? (
                <div
                  role="menu"
                  className="absolute right-0 z-30 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800"
                >
                  <button
                    type="button"
                    role="menuitem"
                    disabled={loading || importando || !editavel}
                    onClick={() => {
                      setAcoesAberto(false);
                      arquivoAnotacaoRef.current?.click();
                    }}
                    className="flex w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    {importando ? 'Importando…' : 'Importar observações'}
                  </button>
                  <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Exportar</p>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={(aba === 'vencidos' ? vencidosUi.loading : loading) || exportando != null || (aba === 'vencidos' ? vencidosUi.linhas === 0 : linhasExibidas.length === 0)}
                    onClick={() => {
                      setAcoesAberto(false);
                      void exportar('xlsx');
                    }}
                    className="flex w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    {exportando === 'xlsx' ? 'Exportando…' : 'Excel'}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={(aba === 'vencidos' ? vencidosUi.loading : loading) || exportando != null || (aba === 'vencidos' ? vencidosUi.linhas === 0 : linhasExibidas.length === 0)}
                    onClick={() => {
                      setAcoesAberto(false);
                      void exportar('pdf');
                    }}
                    className="flex w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    {exportando === 'pdf' ? 'Gerando PDF…' : 'PDF'}
                  </button>
                  <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Atualizar</p>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!editavel || (aba === 'vencidos' ? vencidosUi.selecionadas === 0 : selecionadas.size === 0)}
                    onClick={() => {
                      setAcoesAberto(false);
                      abrirReprogramar();
                    }}
                    className="flex w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    Reprogramar
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={(aba === 'vencidos' ? vencidosUi.selecionadas === 0 : selecionadas.size === 0) || salvando}
                    onClick={() => {
                      setAcoesAberto(false);
                      abrirPrioridade();
                    }}
                    className="flex w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    Prioridade
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!editavel || (aba === 'vencidos' ? vencidosUi.selecionadas === 0 : selecionadas.size === 0) || salvando}
                    onClick={() => {
                      setAcoesAberto(false);
                      abrirCartorio();
                    }}
                    className="flex w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    Cartório
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!editavel || (aba === 'vencidos' ? vencidosUi.selecionadas === 0 : selecionadas.size === 0) || salvando}
                    onClick={() => {
                      setAcoesAberto(false);
                      abrirContaBancaria();
                    }}
                    className="flex w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    Conta bancária
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!editavel || (aba === 'vencidos' ? vencidosUi.selecionadas === 0 : selecionadas.size === 0) || salvando}
                    onClick={() => {
                      setAcoesAberto(false);
                      abrirFormaPagamento();
                    }}
                    className="flex w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    Forma de pagamento
                  </button>
                  <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Alocar</p>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAcoesAberto(false);
                      abrirSubclassificacao();
                    }}
                    className="flex w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    SubClassificação
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={aba !== 'vencidos' || vencidosUi.selecionadas === 0}
                    onClick={() => {
                      setAcoesAberto(false);
                      abrirRelacionarSubclassificacao();
                    }}
                    className="flex w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    Relacionar classificação
                  </button>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => {
                if (aba === 'vencidos') setFiltrosVencidosVisivel((v) => !v);
                else setFiltrosPagarVisivel((v) => !v);
              }}
              aria-expanded={filtrosVisivel}
              aria-label={filtrosVisivel ? 'Ocultar filtros' : 'Mostrar filtros'}
              title={filtrosVisivel ? 'Ocultar filtros' : 'Mostrar filtros'}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <svg
                className={`h-4 w-4 transition-transform ${filtrosVisivel ? '' : 'rotate-180'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={limparFiltros}
              aria-label="Limpar filtros"
              title="Limpar filtros"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18l-7 8v5l-4 2v-7L3 4z" />
                <path strokeLinecap="round" strokeWidth={2} d="M4 20L20 4" />
              </svg>
            </button>
          </div>
        </div>

        {aba === 'pagar' && filtrosPagarVisivel ? (
          <div className="px-3 py-2 flex flex-wrap items-end gap-2">
            <div>
              <span className={FILTRO_LABEL_CLASS}>Período</span>
              <div className="inline-flex h-8 overflow-hidden rounded-lg border border-slate-300 dark:border-slate-600">
                {ATALHOS.map((a, i) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => aplicarAtalho(a.id)}
                    disabled={loading}
                    className={`inline-flex h-8 items-center px-3 text-xs font-medium transition-colors disabled:opacity-60 ${
                      i > 0 ? 'border-l border-slate-300 dark:border-slate-600' : ''
                    } ${
                      atalho === a.id
                        ? 'bg-primary-600 text-white'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="w-[9.25rem]">
              <label className={FILTRO_LABEL_CLASS}>Vencimento de</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => {
                  setAtalho(null);
                  setDataInicio(e.target.value);
                }}
                className={FILTRO_INPUT_CLASS}
                disabled={loading}
              />
            </div>
            <div className="w-[9.25rem]">
              <label className={FILTRO_LABEL_CLASS}>até</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => {
                  setAtalho(null);
                  setDataFim(e.target.value);
                }}
                className={FILTRO_INPUT_CLASS}
                disabled={loading}
              />
            </div>
            <FiltroMulti
              label="Fornecedor"
              placeholder="Todos"
              options={opcoesFornecedor}
              value={fornecedores}
              onChange={setFornecedores}
              optionLabel="fornecedores"
              minWidth="150px"
              disabled={loading || opcoesFornecedor.length === 0}
            />
            <FiltroMulti
              label="Empresa"
              placeholder="Todas"
              options={opcoesEmpresa}
              value={empresas}
              onChange={setEmpresas}
              optionLabel="empresas"
              minWidth="140px"
              disabled={loading || opcoesEmpresa.length === 0}
            />
            <FiltroMulti
              label="Plano de contas"
              placeholder="Todos"
              options={opcoesPlano}
              value={planos}
              onChange={setPlanos}
              optionLabel="planos"
              minWidth="160px"
              disabled={loading || opcoesPlano.length === 0}
            />
            <FiltroMulti
              label="Origem"
              placeholder="Todas"
              options={OPCOES_ORIGEM}
              value={origens}
              onChange={setOrigens}
              optionLabel="origens"
              minWidth="110px"
              disabled={loading}
            />
            <FiltroMulti
              label="Situação"
              placeholder="Todas"
              options={OPCOES_SITUACAO}
              value={situacoes}
              onChange={setSituacoes}
              optionLabel="situações"
              minWidth="120px"
              disabled={loading}
            />
            <FiltroMulti
              label="Cartório"
              placeholder="Todos"
              options={OPCOES_CARTORIO}
              value={cartorioFiltro}
              onChange={setCartorioFiltro}
              optionLabel="cartório"
              minWidth="110px"
              disabled={loading}
            />
            <div className="w-44">
              <label className={FILTRO_LABEL_CLASS}>Observações</label>
              <input
                type="search"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Descrição ou comentário"
                className={FILTRO_INPUT_CLASS}
              />
            </div>
            <div className="w-44">
              <label className={FILTRO_LABEL_CLASS}>Cor da observação</label>
              <select
                value={corObservacao}
                onChange={(e) => setCorObservacao(e.target.value)}
                className={FILTRO_INPUT_CLASS}
                disabled={loading}
              >
                <option value="">Todas</option>
                <option value="sem">Sem cor</option>
                <option value="com">Com cor</option>
              </select>
            </div>
            <button
              type="button"
              onClick={aplicarIntervalo}
              disabled={loading || !dataInicio || !dataFim}
              className={`${FILTRO_BTN} border-primary-600 bg-primary-600 text-white hover:bg-primary-700`}
            >
              {loading ? 'Buscando…' : 'Buscar'}
            </button>
            <DiarioPaletaCorExcel
              disabled={!editavel || aplicandoCor || selecionadas.size === 0}
              onEscolher={(cor) => void aplicarCorLote(cor)}
            />
          </div>
        ) : null}
      </div>

      {vencidosVisitado ? (
        <div className={aba === 'vencidos' ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'hidden'}>
          {erro ? (
            <div className="mb-2 shrink-0 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
              {erro}
            </div>
          ) : aviso ? (
            <div className="mb-2 shrink-0 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
              {aviso}
            </div>
          ) : null}
          <DiarioVencidosPainel
            ref={vencidosRef}
            ativo={aba === 'vencidos'}
            filtrosVisivel={filtrosVencidosVisivel}
            onResumo={onResumoVencidos}
          />
        </div>
      ) : null}

      {aba === 'pagar' && erro && (
        <div className="rounded-lg border border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200 px-4 py-2 text-sm">
          {erro}
        </div>
      )}
      {aba === 'pagar' && aviso && !erro && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100 px-4 py-2 text-sm">
          {aviso}
        </div>
      )}

      <div className={aba === 'pagar' ? 'contents' : 'hidden'}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Resumo label="Lançamentos" valor={totais.qtd.toLocaleString('pt-BR')} />
        <Resumo label="Valor" valor={formatMoeda(totais.valor)} />
        <Resumo label="Baixado" valor={formatMoeda(totais.baixado)} />
        <Resumo label="Saldo" valor={formatMoeda(totais.saldo)} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {selecionadas.size.toLocaleString('pt-BR')} selecionado(s).{' '}
          {modo?.aprovacao
            ? 'Apenas as contas marcadas serão aprovadas; informe o Banco em cada uma.'
            : 'Título baixado não pode ser reprogramado nem ter a conta alterada.'}
          {linhasFiltradas.length !== linhasExibidas.length
            ? ` ${linhasExibidas.length.toLocaleString('pt-BR')} de ${linhasFiltradas.length.toLocaleString('pt-BR')} na grade.`
            : ''}
        </p>
      </div>

      <div
        ref={grade.tableScrollRef}
        className={`card-panel min-h-0 overflow-auto !p-0 ${
          filtrosPagarVisivel ? 'max-h-[calc(100svh-18.5rem)]' : 'max-h-[calc(100svh-14rem)]'
        }`}
      >
        <table
          className="table-fixed text-xs"
          style={{ width: Math.max(1100, colunasGrade.larguraTotal + 36) }}
        >
          <colgroup>
            <col style={{ width: 36 }} />
            {colunasGrade.colunasVisiveis.map((coluna) => <col key={coluna.id} style={colunasGrade.estiloColuna(coluna.id)} />)}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-primary-600 text-white">
            <tr>
              <th className="sticky left-0 z-20 w-8 bg-primary-600 px-2 py-2">
                <input
                  ref={headerCheckRef}
                  type="checkbox"
                  checked={todosVisiveisMarcados}
                  onChange={alternarTodos}
                  disabled={elegiveisVisiveis.length === 0}
                  aria-label={modo?.aprovacao ? 'Selecionar todas as contas visíveis para aprovação' : 'Selecionar todos os títulos em aberto'}
                  className="rounded border-white/70 text-primary-600 focus:ring-primary-500 disabled:opacity-40"
                />
              </th>
              {colunasGrade.colunasVisiveis.map((col) => (
                <DiarioCabecalhoTh
                  key={col.id}
                  colId={col.id}
                  label={col.label}
                  grade={grade}
                  colunas={colunasGrade}
                  align={col.align ?? 'left'}
                  filtroExtraAtivo={col.id === 'anotacao' && (filtroCorHex != null || niveisCor.length > 0)}
                />
              ))}
            </tr>
          </thead>
          <tbody className="uppercase">
            {linhasExibidas.length === 0 && !loading && (
              <tr>
                <td colSpan={colunasGrade.colunasVisiveis.length + 1} className="px-3 py-8 text-center text-slate-500 dark:text-slate-400">
                  {linhasFiltradas.length === 0
                    ? 'Nenhum contas a pagar neste vencimento.'
                    : 'Nenhum lançamento com os filtros da grade.'}
                </td>
              </tr>
            )}
            {linhasExibidas.map((l, i) => {
              const chave = chaveLinha(l);
              const bloqueio = modo?.aprovacao
                ? (podeAprovarConta(l) ? null : 'Somente contas em aberto com saldo podem ser aprovadas.')
                : motivoBloqueio(l);
              const marcado = selecionadas.has(chave);
              const prio = prioridadeDaLinha(l);
              const salvandoPrio = prio.chave != null && salvandoPrioridade === prio.chave;
              return (
              <tr
                key={`${chave}-${i}`}
                className="border-t border-slate-100 dark:border-slate-700/80 text-slate-800 dark:text-slate-100"
              >
                <td className="sticky left-0 z-[1] bg-white px-2 py-1.5 dark:bg-slate-900">
                  <input
                    type="checkbox"
                    checked={marcado}
                    disabled={bloqueio != null}
                    onChange={() => alternarUm(l)}
                    aria-label={
                      bloqueio
                        ? bloqueio
                        : `Selecionar título ${l.codigo}`
                    }
                    title={bloqueio ?? `Selecionar título ${l.codigo}`}
                    className="rounded border-slate-400 text-primary-600 focus:ring-primary-500 disabled:opacity-40"
                  />
                </td>
                {colunasGrade.colunasVisiveis.map((coluna) => renderCelulaGrade(coluna.id, l, prio, salvandoPrio))}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <DiarioGradeFiltroPortal
        grade={grade}
        onOrdenacaoTexto={() => setNiveisCor([])}
        filtroCor={{
          cores: coresCabecalho,
          filtroId: filtroCorHex,
          ordemId: niveisCor.length === 1 ? niveisCor[0].corId : null,
          onClassificar: (id) => {
            const desligar = niveisCor.length === 1 && niveisCor[0].corId === id && niveisCor[0].posicao === 'superior';
            setNiveisCor(desligar ? [] : [{ id: crypto.randomUUID(), corId: id, posicao: 'superior' }]);
            grade.setSortState(desligar ? null : { key: 'anotacao', direction: 'asc' });
            grade.setSortLevels([]);
            grade.fecharFiltroExcel();
          },
          onAbrirClassificacao: () => {
            grade.fecharFiltroExcel();
            setClassificarCorAberto(true);
          },
          onFiltrar: (id) => {
            setFiltroCorHex(id);
            grade.fecharFiltroExcel();
          },
        }}
      />
      {classificarCorAberto ? (
        <DiarioClassificarCorDialog
          cores={coresCabecalho}
          niveis={niveisCor}
          onCancelar={() => setClassificarCorAberto(false)}
          onConfirmar={(niveis) => {
            setNiveisCor(niveis);
            grade.setSortState({ key: 'anotacao', direction: 'asc' });
            grade.setSortLevels([]);
            setClassificarCorAberto(false);
          }}
        />
      ) : null}
      </div>

      {itensModal ? <ModalItensNota linha={itensModal} onClose={() => setItensModal(null)} /> : null}

      {prioridadeAberta ? (
        <ModalPrioridadeDiario
          linhas={modalLinhas}
          valor={prioridadeValor}
          onChange={setPrioridadeValor}
          onClose={() => {
            if (!salvando) setPrioridadeAberta(false);
          }}
          onConfirm={() => void confirmarPrioridade()}
          salvando={salvando}
          erro={erroModal}
        />
      ) : null}

      {cartorioAberto ? (
        <ModalCartorioDiario
          linhas={modalLinhas}
          acao={cartorioAcao}
          onChangeAcao={setCartorioAcao}
          onClose={() => {
            if (!salvando) setCartorioAberto(false);
          }}
          onConfirm={() => void confirmarCartorio()}
          salvando={salvando}
          erro={erroModal}
        />
      ) : null}

      {modalAberto ? (
        <ModalReprogramar
          linhas={modalLinhas}
          novaData={novaData}
          onChangeData={setNovaData}
          onClose={() => {
            if (!salvando) setModalAberto(false);
          }}
          onConfirm={() => void confirmarReprogramar()}
          salvando={salvando}
          erro={erroModal}
        />
      ) : null}

      {contaAberta ? (
        <ModalAjusteDiario
          tituloId="conta-bancaria-titulo"
          titulo="Conta bancária"
          campoId="diario-conta-bancaria"
          campoLabel="Conta"
          linhas={modalLinhas}
          opcoes={contasOpcoes}
          valor={contaId}
          carregando={carregandoContas}
          textoNomus="A conta do agendamento em aberto é atualizada no Nomus. Lançamento já baixado não é reescrito."
          textoShop9="A escolha fica registrada neste projeto, pela Ordem do título. O Shop9 não é alterado."
          onChange={setContaId}
          onClose={() => {
            if (!salvando) setContaAberta(false);
          }}
          onConfirm={() => void confirmarContaBancaria()}
          salvando={salvando}
          erro={erroModal}
        />
      ) : null}

      {subAberta ? (
        <DiarioSubclassificacaoModal onClose={() => setSubAberta(false)} />
      ) : null}

      {alocarSubAberta ? (
        <DiarioAlocarSubclassificacaoModal
          classificacoes={alocarClassifs}
          onClose={() => setAlocarSubAberta(false)}
          onAlocado={() => {
            setAlocarSubAberta(false);
            setAviso('Subclassificação relacionada. Todos os títulos com essas classificações passam a usar o agrupamento.');
            vencidosRef.current?.atualizarSubclassificacoes();
          }}
        />
      ) : null}

      {formaAberta ? (
        <ModalAjusteDiario
          tituloId="forma-pagamento-titulo"
          titulo="Forma de pagamento"
          campoId="diario-forma-pagamento"
          campoLabel="Forma"
          linhas={modalLinhas}
          opcoes={formasOpcoes}
          valor={formaId}
          carregando={carregandoFormas}
          textoNomus="A forma de pagamento do agendamento em aberto é atualizada no Nomus. Lançamento já baixado não é reescrito."
          textoShop9="A escolha fica registrada neste projeto, pela Ordem do título. O Shop9 não é alterado."
          onChange={setFormaId}
          onClose={() => {
            if (!salvando) setFormaAberta(false);
          }}
          onConfirm={() => void confirmarFormaPagamento()}
          salvando={salvando}
          erro={erroModal}
        />
      ) : null}
    </div>
  );
}

function ModalAjusteDiario({
  tituloId,
  titulo,
  campoId,
  campoLabel,
  linhas,
  opcoes,
  valor,
  carregando,
  textoNomus,
  textoShop9,
  onChange,
  onClose,
  onConfirm,
  salvando,
  erro,
}: {
  tituloId: string;
  titulo: string;
  campoId: string;
  campoLabel: string;
  linhas: DiarioContaPagarLinha[];
  opcoes: { id: string | number; nome: string }[];
  valor: string;
  carregando: boolean;
  textoNomus: string;
  textoShop9: string;
  onChange: (id: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  salvando: boolean;
  erro: string | null;
}) {
  const origem = linhas[0]?.origem ?? 'Nomus';
  const shop9 = origem === 'Shop9';
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-slate-900/50" aria-label="Fechar" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="relative z-[81] flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
      >
        <div className="px-5 pt-5 pb-3">
          <h2 id={tituloId} className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            {titulo}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {linhas.length.toLocaleString('pt-BR')} título(s) {origem} em aberto. {shop9 ? textoShop9 : textoNomus}
          </p>
        </div>
        <div className="px-5 pb-4">
          <label className={FILTRO_LABEL_CLASS} htmlFor={campoId}>
            {campoLabel}
          </label>
          <select
            id={campoId}
            value={valor}
            onChange={(e) => onChange(e.target.value)}
            disabled={salvando || carregando}
            className={FILTRO_INPUT_CLASS}
          >
            <option value="">{carregando ? 'Carregando…' : 'Selecione'}</option>
            {opcoes.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.nome}
              </option>
            ))}
          </select>
          {erro ? <p className="mt-2 text-xs text-red-700 dark:text-red-300">{erro}</p> : null}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="inline-flex h-8 items-center rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={salvando || carregando || !valor}
            className="inline-flex h-8 items-center rounded-lg bg-primary-600 px-3 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {salvando ? 'Salvando…' : 'Gravar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FiltroMulti({
  label,
  placeholder,
  options,
  value,
  onChange,
  optionLabel,
  minWidth,
  disabled,
}: {
  label: string;
  placeholder: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  optionLabel: string;
  minWidth: string;
  disabled?: boolean;
}) {
  return (
    <MultiSelectWithSearch
      label={label}
      placeholder={placeholder}
      options={options}
      value={value}
      onChange={onChange}
      labelClass={FILTRO_LABEL_CLASS}
      inputClass={FILTRO_INPUT_CLASS}
      optionLabel={optionLabel}
      valueSeparator="|"
      minWidth={minWidth}
      disabled={disabled}
      dropdownZIndex={200}
    />
  );
}

function Resumo({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="card-panel px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{valor}</div>
    </div>
  );
}

function ModalCartorioDiario({
  linhas,
  acao,
  onChangeAcao,
  onClose,
  onConfirm,
  salvando,
  erro,
}: {
  linhas: DiarioContaPagarLinha[];
  acao: 'apontar' | 'remover';
  onChangeAcao: (value: 'apontar' | 'remover') => void;
  onClose: () => void;
  onConfirm: () => void;
  salvando: boolean;
  erro: string | null;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !salvando) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, salvando]);

  const apontar = acao === 'apontar';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-slate-900/50" aria-label="Fechar" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cartorio-lote-titulo"
        className="relative z-[81] flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
      >
        <div className="px-5 pt-5 pb-3">
          <h2 id="cartorio-lote-titulo" className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            Cartório
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {linhas.length.toLocaleString('pt-BR')} título(s) selecionado(s). O apontamento fica só neste projeto —
            Nomus e Shop9 não são alterados. Confirme para gravar.
          </p>
        </div>
        <div className="space-y-2 px-5 pb-4">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Os títulos selecionados devem ser demonstrados como em cartório na grade?
          </p>
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600">
            <input
              type="radio"
              name="diario-cartorio-acao"
              checked={apontar}
              disabled={salvando}
              onChange={() => onChangeAcao('apontar')}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium text-slate-800 dark:text-slate-100">Apontar como cartório</span>
              <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                A coluna Cartório passa a exibir SIM.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600">
            <input
              type="radio"
              name="diario-cartorio-acao"
              checked={!apontar}
              disabled={salvando}
              onChange={() => onChangeAcao('remover')}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium text-slate-800 dark:text-slate-100">Remover apontamento</span>
              <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                Os títulos deixam de aparecer como em cartório.
              </span>
            </span>
          </label>
          {erro ? <p className="mt-2 text-xs text-red-700 dark:text-red-300">{erro}</p> : null}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="inline-flex h-8 items-center rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={salvando}
            className="inline-flex h-8 items-center rounded-lg bg-primary-600 px-3 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {salvando ? 'Gravando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalPrioridadeDiario({
  linhas,
  valor,
  onChange,
  onClose,
  onConfirm,
  salvando,
  erro,
}: {
  linhas: DiarioContaPagarLinha[];
  valor: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  salvando: boolean;
  erro: string | null;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !salvando) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, salvando]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-slate-900/50" aria-label="Fechar" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="prioridade-lote-titulo"
        className="relative z-[81] flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
      >
        <div className="px-5 pt-5 pb-3">
          <h2 id="prioridade-lote-titulo" className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            Prioridade em massa
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {linhas.length.toLocaleString('pt-BR')} título(s) selecionado(s). A classificação vale no Diário e no DFC.
          </p>
        </div>
        <div className="px-5 pb-4">
          <label className={FILTRO_LABEL_CLASS} htmlFor="diario-prioridade-lote">
            Prioridade
          </label>
          <select
            id="diario-prioridade-lote"
            value={valor}
            onChange={(e) => onChange(e.target.value)}
            disabled={salvando}
            className={FILTRO_INPUT_CLASS}
          >
            <option value="">Selecione</option>
            {DFC_PRIORIDADES.map((p) => (
              <option key={p} value={String(p)}>
                {p} — {DFC_PRIORIDADE_LABEL[p]}
              </option>
            ))}
            <option value="remover">Remover prioridade</option>
          </select>
          {erro ? <p className="mt-2 text-xs text-red-700 dark:text-red-300">{erro}</p> : null}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="inline-flex h-8 items-center rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={salvando || !valor}
            className="inline-flex h-8 items-center rounded-lg bg-primary-600 px-3 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {salvando ? 'Salvando…' : 'Gravar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalReprogramar({
  linhas,
  novaData,
  onChangeData,
  onClose,
  onConfirm,
  salvando,
  erro,
}: {
  linhas: DiarioContaPagarLinha[];
  novaData: string;
  onChangeData: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  salvando: boolean;
  erro: string | null;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !salvando) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, salvando]);

  const total = linhas.reduce((acc, l) => acc + (Number(l.saldo) || 0), 0);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reprogramar-titulo"
        className="relative z-[81] flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
      >
        <div className="px-5 pt-5 pb-3">
          <h2 id="reprogramar-titulo" className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            Reprogramar vencimento
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {linhas.length.toLocaleString('pt-BR')} título(s) em aberto. A data de vencimento é alterada no
            Nomus pelo id do agendamento e no Shop9 pela Ordem. Na primeira vez, a descrição recebe o vencimento original.
          </p>
        </div>
        <div className="px-5 pb-3">
          <label className={FILTRO_LABEL_CLASS} htmlFor="reprogramar-nova-data">
            Novo vencimento
          </label>
          <input
            id="reprogramar-nova-data"
            type="date"
            value={novaData}
            onChange={(e) => onChangeData(e.target.value)}
            disabled={salvando}
            className={`${FILTRO_INPUT_CLASS} max-w-[12rem]`}
          />
          {erro ? <p className="mt-2 text-xs text-red-700 dark:text-red-300">{erro}</p> : null}
        </div>
        <div className="min-h-0 flex-1 overflow-auto border-y border-slate-200 dark:border-slate-700">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              <tr>
                {['Origem', 'Código', 'Fornecedor', 'Empresa', 'Vencimento atual', 'Saldo'].map((col) => (
                  <th
                    key={col}
                    className={`px-3 py-2 font-medium whitespace-nowrap ${col === 'Saldo' ? 'text-right' : 'text-left'}`}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr
                  key={`${chaveLinha(l)}-${i}`}
                  className="border-t border-slate-100 text-slate-800 dark:border-slate-700 dark:text-slate-100"
                >
                  <td className="px-3 py-1.5 whitespace-nowrap">{l.origem}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">{idReprogramacao(l) ?? l.codigo}</td>
                  <td className="px-3 py-1.5 max-w-[16rem] truncate" title={l.fornecedor ?? ''}>
                    {l.fornecedor ?? '—'}
                  </td>
                  <td className="px-3 py-1.5 max-w-[12rem] truncate" title={empresaExibida(l) ?? ''}>
                    {empresaExibida(l) ?? '—'}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">{formatData(l.dataVencimento)}</td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap tabular-nums">{formatMoeda(l.saldo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Saldo dos selecionados: {formatMoeda(total)}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="inline-flex h-8 items-center rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={salvando || !novaData}
              className="inline-flex h-8 items-center rounded-lg bg-primary-600 px-3 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {salvando ? 'Reprogramando…' : 'Reprogramar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function textoProdutoItem(item: DiarioContaPagarLinha['itens'][number]): string {
  return item.codigo || item.produto || '—';
}

function textoDescricaoItem(item: DiarioContaPagarLinha['itens'][number]): string {
  if (item.descricao) return item.descricao;
  if (item.codigo && item.produto) return item.produto;
  return '—';
}

function ModalItensNota({ linha, onClose }: { linha: DiarioContaPagarLinha; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const itens = linha.itens ?? [];
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-slate-900/50" aria-label="Fechar" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative z-[81] flex max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800">
        <div className="px-5 pt-5 pb-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Itens da nota fiscal</h2>
          <p className="mt-1 text-xs text-slate-500">
            {[linha.notaFiscal ? `Nota ${linha.notaFiscal}` : null, linha.pedidoCompra ? `Pedido ${linha.pedidoCompra}` : null, linha.fornecedor].filter(Boolean).join(' · ') || 'Sem nota informada'}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-5 pb-5">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              <tr>
                {['Produto', 'Descrição', 'Qtde', 'Valor unitário', 'Valor', 'Desconto', 'Total com desconto'].map((col) => (
                  <th key={col} className={`px-2 py-2 font-medium ${col === 'Produto' || col === 'Descrição' ? 'text-left' : 'text-right'}`}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {itens.map((item, i) => (
                <tr key={`${item.codigo ?? ''}-${i}`} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="px-2 py-1.5 whitespace-nowrap">{textoProdutoItem(item)}</td>
                  <td className="px-2 py-1.5">{textoDescricaoItem(item)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{item.qtde == null ? '—' : item.qtde.toLocaleString('pt-BR')}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{item.valorUnitario == null ? '—' : formatMoeda(item.valorUnitario)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{item.valorTotal == null ? '—' : formatMoeda(item.valorTotal)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{item.valorDesconto == null ? '—' : formatMoeda(item.valorDesconto)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{item.valorTotalComDesconto == null ? '—' : formatMoeda(item.valorTotalComDesconto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
