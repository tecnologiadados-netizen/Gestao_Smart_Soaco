import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, CalendarRange, ChartPie, Clock3, ListOrdered, Medal, RefreshCw, Wallet } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import MultiSelectWithSearch from '../../../components/MultiSelectWithSearch';
import {
  fetchDiarioSubclassificacoes,
  fetchDiarioVencidosReprogramados,
  type DiarioContaPagarLinha,
  type DiarioSubclassificacaoItem,
} from '../../../api/diarioFinanceiro';
import { useGradeFiltrosExcel } from '../../../hooks/useGradeFiltrosExcel';
import { criarMatcherTextoLivre } from '../../../utils/textoLivreBusca';
import { DiarioCabecalhoTh, DiarioGradeFiltroPortal } from './DiarioGradeCabecalho';
import { DescricaoReprogramadaGrade, temMarcadorReprogramado } from './descricaoReprogramada';

type Subaba = 'titulos' | 'dashboard';

const FILTRO_INPUT_CLASS =
  'h-8 w-full rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 px-2.5 text-xs focus:ring-2 focus:ring-primary-600 focus:border-transparent';
const FILTRO_LABEL_CLASS = 'block text-[11px] leading-none text-slate-500 dark:text-slate-400 mb-1';
const FILTRO_BTN =
  'inline-flex h-8 items-center justify-center rounded-lg px-3 text-xs font-medium border transition-colors disabled:opacity-60';

const panelSurface =
  'rounded-2xl border border-slate-200/80 bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.05)] backdrop-blur-sm dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(22,26,40,0.96),rgba(12,14,22,0.96))] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_16px_40px_rgba(0,0,0,0.28)]';

const COR_VENCIDO = '#FF6B35';
const COR_REPROGRAMADO = '#5C92D6';
const COR_SUB = '#0F766E';
const CORES_PIZZA = ['#FF6B35', '#5C92D6', '#0F766E', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#3B82F6', '#84CC16'];
const SEM_SUBCLASSIFICACAO = 'Sem subclassificação';
const FAIXAS = [
  { id: '1-30', label: '1 a 30 dias', min: 1, max: 30, cor: '#FBBF24' },
  { id: '31-60', label: '31 a 60 dias', min: 31, max: 60, cor: '#FB923C' },
  { id: '61-90', label: '61 a 90 dias', min: 61, max: 90, cor: '#F97316' },
  { id: '91-180', label: '91 a 180 dias', min: 91, max: 180, cor: '#EF4444' },
  { id: '180+', label: 'Acima de 180 dias', min: 181, max: 100000, cor: '#9F1239' },
] as const;

type Tone = 'amber' | 'violet' | 'cyan' | 'emerald';
const TONE: Record<Tone, { card: string; icon: string }> = {
  amber: {
    card: 'border-[#FFAD00]/40 bg-[radial-gradient(120%_90%_at_0%_0%,rgba(255,173,0,0.22),transparent_55%),linear-gradient(180deg,#ffffff,#fffaf0)] dark:border-[#FFAD00]/35 dark:bg-[radial-gradient(120%_85%_at_0%_0%,rgba(255,173,0,0.32),transparent_58%),linear-gradient(180deg,#2a220c,#120e0c)]',
    icon: 'bg-[#FFAD00]/15 text-[#C48400] ring-[#FFAD00]/40 dark:text-[#FBB03B]',
  },
  violet: {
    card: 'border-[#1E22AA]/25 bg-[radial-gradient(120%_90%_at_0%_0%,rgba(30,34,170,0.16),transparent_55%),linear-gradient(180deg,#ffffff,#f4f5fb)] dark:border-[#2B36C1]/40 dark:bg-[radial-gradient(120%_85%_at_0%_0%,rgba(30,34,170,0.48),transparent_58%),linear-gradient(180deg,#101433,#0c1018)]',
    icon: 'bg-[#1E22AA]/12 text-[#1E22AA] ring-[#1E22AA]/30 dark:text-[#C5C9EF]',
  },
  cyan: {
    card: 'border-[#041E42]/20 bg-[radial-gradient(120%_90%_at_0%_0%,rgba(4,30,66,0.12),transparent_55%),linear-gradient(180deg,#ffffff,#f3f6fa)] dark:border-[#041E42]/80 dark:bg-[radial-gradient(120%_85%_at_0%_0%,rgba(4,30,66,0.95),transparent_62%),linear-gradient(180deg,#0a2244,#0c1218)]',
    icon: 'bg-[#041E42]/10 text-[#041E42] ring-[#041E42]/25 dark:text-[#C5C9EF]',
  },
  emerald: {
    card: 'border-[#00A859]/30 bg-[radial-gradient(120%_90%_at_0%_0%,rgba(0,168,89,0.16),transparent_55%),linear-gradient(180deg,#ffffff,#f3fbf7)] dark:border-[#00A859]/35 dark:bg-[radial-gradient(120%_85%_at_0%_0%,rgba(0,168,89,0.34),transparent_58%),linear-gradient(180deg,#0c2418,#0c1214)]',
    icon: 'bg-[#00A859]/15 text-[#00A859] ring-[#00A859]/35 dark:text-[#7ddea8]',
  },
};

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function hojeYmd(): string {
  return ymdLocal(new Date());
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

function empresaCanon(nome: string): string {
  const k = chaveClassificacao(nome);
  if (!k || k === 'SEM EMPRESA') return 'SEM EMPRESA';
  if (k.includes('SO MOVEIS')) return 'SÓ MÓVEIS';
  if (k.includes('SO ACO') || k.includes('ACO INDUSTRIAL')) return 'SÓ AÇO INDUSTRIAL';
  if (k.includes('REFRIGER')) return 'SO REFRIGERAÇÃO';
  if (k.includes('R N MARQUES') || k.includes('RN MARQUES')) return 'R N MARQUES ARAUJO';
  return nome.toLocaleUpperCase('pt-BR');
}

function empresaExibida(l: DiarioContaPagarLinha): string {
  return empresaCanon(l.filial?.trim() || l.empresa?.trim() || 'Sem empresa');
}

const VAZIO_CELULA = '—';

const COLUNAS_TITULOS_VENCIDOS = [
  { id: 'codigo', label: 'Código' },
  { id: 'situacao', label: 'Situação' },
  { id: 'plano', label: 'Classificação' },
  { id: 'subclassificacao', label: 'SubClassificação' },
  { id: 'vencimento', label: 'Vencimento' },
  { id: 'reprogramado', label: 'Reprogramado' },
  { id: 'dias', label: 'Dias' },
  { id: 'empresa', label: 'Empresa' },
  { id: 'fornecedor', label: 'Pessoa' },
  { id: 'descricao', label: 'Descrição' },
  { id: 'observacao', label: 'Comentários' },
  { id: 'saldo', label: 'Saldo a pagar', align: 'right' as const },
] as const;

const COLUNAS_DETALHE_VENCIDOS = [
  { id: 'situacao', label: 'Situação' },
  { id: 'plano', label: 'Classificação' },
  { id: 'subclassificacao', label: 'SubClassificação' },
  { id: 'vencimento', label: 'Vencimento' },
  { id: 'empresa', label: 'Empresa' },
  { id: 'fornecedor', label: 'Pessoa' },
  { id: 'descricao', label: 'Descrição' },
  { id: 'saldo', label: 'Saldo a pagar', align: 'right' as const },
] as const;

function textoCelulaVencidos(
  l: DiarioContaPagarLinha,
  col: string,
  mapaSub: Map<string, string>,
  hoje: string,
): string {
  const texto = (v: string | null | undefined) => {
    const t = v?.trim();
    return t ? t.toLocaleUpperCase('pt-BR') : VAZIO_CELULA;
  };
  switch (col) {
    case 'codigo':
      return l.codigoClassificacao != null && l.codigoClassificacao > 0 ? String(l.codigoClassificacao) : VAZIO_CELULA;
    case 'situacao':
      return l.status.toLocaleUpperCase('pt-BR');
    case 'plano':
      return texto(l.planoContas);
    case 'subclassificacao':
      return nomeSubclassificacao(l, mapaSub);
    case 'vencimento':
      return formatData(l.dataVencimento);
    case 'reprogramado':
      return texto(l.reprogramado);
    case 'dias': {
      const dias = ehVencido(l, hoje) ? diasAtraso(l.dataVencimento, hoje) : null;
      return dias != null ? String(dias) : VAZIO_CELULA;
    }
    case 'empresa':
      return empresaExibida(l);
    case 'fornecedor':
      return texto(l.fornecedor);
    case 'descricao':
      return texto(l.descricao);
    case 'observacao':
      return texto(l.observacao);
    case 'saldo':
      return formatMoeda(l.saldo);
    default:
      return '';
  }
}

function valorOrdenacaoVencidos(
  l: DiarioContaPagarLinha,
  col: string,
  mapaSub: Map<string, string>,
  hoje: string,
): string | number {
  if (col === 'saldo') return Number(l.saldo) || 0;
  if (col === 'codigo') return l.codigoClassificacao ?? 0;
  if (col === 'vencimento') return l.dataVencimento ?? '';
  if (col === 'dias') {
    const dias = ehVencido(l, hoje) ? diasAtraso(l.dataVencimento, hoje) : null;
    return dias ?? -1;
  }
  return textoCelulaVencidos(l, col, mapaSub, hoje);
}

function selecionados(csv: string): Set<string> {
  return new Set(csv.split('|').map((s) => s.trim()).filter(Boolean));
}

function diasAtraso(vencimento: string | null, hoje: string): number | null {
  if (!vencimento || vencimento.slice(0, 10) >= hoje) return null;
  const a = Date.parse(`${vencimento.slice(0, 10)}T12:00:00`);
  const b = Date.parse(`${hoje}T12:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

function ehReprogramado(l: DiarioContaPagarLinha): boolean {
  return Boolean(l.reprogramado?.trim())
    || temMarcadorReprogramado(l.descricao)
    || temMarcadorReprogramado(l.observacao);
}

function passaSituacao(l: DiarioContaPagarLinha, filtro: Set<string>, hoje: string): boolean {
  const vencido = ehVencido(l, hoje);
  const reprogramado = ehReprogramado(l);
  if (filtro.size === 0) return vencido || reprogramado;
  return (filtro.has('Vencidos') && vencido) || (filtro.has('Reprogramados') && reprogramado);
}

/** Reprogramado prevalece para o saldo da barra não duplicar título que é as duas coisas. */
function fatiaSaldo(l: DiarioContaPagarLinha): 'vencido' | 'reprogramado' {
  return ehReprogramado(l) ? 'reprogramado' : 'vencido';
}

function podeAlterar(l: DiarioContaPagarLinha): boolean {
  if (l.status !== 'Em aberto') return false;
  if (l.origem === 'Nomus') return Boolean(l.idAgendamento && l.idAgendamento > 0);
  return l.codigo > 0;
}

function chaveSelecao(l: DiarioContaPagarLinha): string {
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

export type DiarioVencidosPainelHandle = {
  limparFiltros: () => void;
  linhasVisiveis: () => DiarioContaPagarLinha[];
  linhasSelecionadas: () => DiarioContaPagarLinha[];
  periodo: () => { inicio: string; fim: string };
  recarregar: () => void;
  atualizarSubclassificacoes: () => void;
};

function ehVencido(l: DiarioContaPagarLinha, hoje: string): boolean {
  return l.status === 'Em aberto' && !!l.dataVencimento && l.dataVencimento.slice(0, 10) < hoje;
}

function chaveClassificacao(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
    .toLocaleUpperCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim();
}

function montarMapaSubclassificacao(grupos: DiarioSubclassificacaoItem[]): Map<string, string> {
  const mapa = new Map<string, string>();
  const gravar = (chave: string, nome: string) => {
    if (!chave || mapa.has(chave)) return;
    mapa.set(chave, nome);
  };
  for (const grupo of grupos) {
    const chave = chaveClassificacao(grupo.classificacao);
    gravar(chave, grupo.nome);
    gravar(chave.replace(/^\d+\s*-\s*/, ''), grupo.nome);
  }
  return mapa;
}

function nomeSubclassificacao(l: DiarioContaPagarLinha, mapa: Map<string, string>): string {
  const plano = l.planoContas?.trim() ?? '';
  if (!plano) return SEM_SUBCLASSIFICACAO.toLocaleUpperCase('pt-BR');
  const kPlano = chaveClassificacao(plano);
  const direto = mapa.get(kPlano);
  if (direto) return direto.toLocaleUpperCase('pt-BR');
  if (l.codigoClassificacao != null && l.codigoClassificacao > 0) {
    const comCodigo = mapa.get(chaveClassificacao(`${l.codigoClassificacao} - ${plano}`));
    if (comCodigo) return comCodigo.toLocaleUpperCase('pt-BR');
  }
  for (const [chave, nome] of mapa) {
    if (chave.endsWith(` - ${kPlano}`)) return nome.toLocaleUpperCase('pt-BR');
  }
  return SEM_SUBCLASSIFICACAO.toLocaleUpperCase('pt-BR');
}

function ehSemSubclassificacao(nome: string): boolean {
  return chaveClassificacao(nome) === chaveClassificacao(SEM_SUBCLASSIFICACAO);
}

function chaveMatriz(fornecedor: string, empresa: string): string {
  return `${fornecedor}\u001f${empresa}`;
}

function BadgeSituacao({ status }: { status: string }) {
  const baixado = status === 'Baixado';
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        baixado
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
          : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
      }`}
    >
      {status}
    </span>
  );
}

function BadgeSubclassificacao({ nome }: { nome: string }) {
  const sem = ehSemSubclassificacao(nome);
  return (
    <span
      className={`inline-flex max-w-full truncate rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
        sem
          ? 'border-red-500 bg-red-50 text-red-700 dark:border-red-400 dark:bg-red-950/40 dark:text-red-200'
          : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
      }`}
    >
      {nome}
    </span>
  );
}

function PontoSerieClicavel({
  cx,
  cy,
  payload,
  stroke,
  onPonto,
}: {
  cx?: number;
  cy?: number;
  payload?: { mes?: string; label?: string };
  stroke?: string;
  onPonto?: (ponto: { mes?: string; label?: string }) => void;
}) {
  if (cx == null || cy == null) return null;
  return (
    <g style={{ cursor: 'pointer' }} onClick={() => payload && onPonto?.(payload)}>
      <circle cx={cx} cy={cy} r={12} fill="transparent" />
      <circle cx={cx} cy={cy} r={3.5} fill={stroke} stroke="#fff" strokeWidth={1} />
    </g>
  );
}

function KpiCard({
  tone,
  titulo,
  valor,
  detalhe,
  icone,
  onClick,
}: {
  tone: Tone;
  titulo: string;
  valor: string;
  detalhe: string;
  icone: ReactNode;
  onClick?: () => void;
}) {
  const tom = TONE[tone];
  const corpo = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{titulo}</p>
          <p className="mt-2 text-[1.45rem] font-semibold leading-none tracking-tight tabular-nums text-slate-900 dark:text-white">{valor}</p>
        </div>
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${tom.icon}`}>{icone}</span>
      </div>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{detalhe}</p>
    </>
  );
  const classe = `relative overflow-hidden rounded-2xl border p-4 text-left ${tom.card}`;
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${classe} cursor-pointer hover:ring-2 hover:ring-primary-400/50`}>
        {corpo}
      </button>
    );
  }
  return <article className={classe}>{corpo}</article>;
}

function FiltroMulti(props: {
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
      label={props.label}
      placeholder={props.placeholder}
      options={props.options}
      value={props.value}
      onChange={props.onChange}
      labelClass={FILTRO_LABEL_CLASS}
      inputClass={FILTRO_INPUT_CLASS}
      optionLabel={props.optionLabel}
      valueSeparator="|"
      minWidth={props.minWidth}
      disabled={props.disabled}
      dropdownZIndex={200}
    />
  );
}

export const DiarioVencidosPainel = forwardRef<
  DiarioVencidosPainelHandle,
  { filtrosVisivel: boolean; ativo?: boolean; onResumo?: (resumo: { linhas: number; selecionadas: number; loading: boolean }) => void }
>(function DiarioVencidosPainel({ filtrosVisivel, ativo = true, onResumo }, ref) {
  const [fornecedores, setFornecedores] = useState('');
  const [empresas, setEmpresas] = useState('');
  const [planos, setPlanos] = useState('');
  const [subclassificacoes, setSubclassificacoes] = useState('');
  const [grupos, setGrupos] = useState<DiarioSubclassificacaoItem[]>([]);
  const [origens, setOrigens] = useState('');
  const [situacoes, setSituacoes] = useState('');
  const [observacao, setObservacao] = useState('');
  const [linhas, setLinhas] = useState<DiarioContaPagarLinha[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [subaba, setSubaba] = useState<Subaba>('titulos');
  const [selecionadas, setSelecionadas] = useState<Set<string>>(() => new Set());
  const [detalhe, setDetalhe] = useState<{ titulo: string; linhas: DiarioContaPagarLinha[] } | null>(null);
  const hoje = hojeYmd();

  const carregar = async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetchDiarioVencidosReprogramados();
      setLinhas(res.linhas);
      const partes = [res.erroShop9, res.erroNomus].filter(Boolean);
      if (partes.length > 0) setErro(partes.join(' · '));
    } catch (e) {
      setLinhas([]);
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ativo) return;
    const id = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
    return () => window.clearTimeout(id);
  }, [ativo]);

  useEffect(() => {
    void carregar();
    void fetchDiarioSubclassificacoes()
      .then(setGrupos)
      .catch((e) => {
        setGrupos([]);
        setErro((prev) => prev ?? (e instanceof Error ? e.message : String(e)));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mapaSub = useMemo(() => montarMapaSubclassificacao(grupos), [grupos]);

  const base = useMemo(() => {
    const fFornecedor = selecionados(fornecedores);
    const fEmpresa = selecionados(empresas);
    const fPlano = selecionados(planos);
    const fSub = selecionados(subclassificacoes);
    const fOrigem = selecionados(origens);
    const fSituacao = selecionados(situacoes);
    const casaObs = criarMatcherTextoLivre(observacao);
    return linhas.filter((l) => {
      if (l.status !== 'Em aberto') return false;
      if (!passaSituacao(l, fSituacao, hoje)) return false;
      if (fOrigem.size > 0 && !fOrigem.has(l.origem)) return false;
      if (fFornecedor.size > 0 && !fFornecedor.has(l.fornecedor ?? '')) return false;
      if (fEmpresa.size > 0 && !fEmpresa.has(empresaExibida(l))) return false;
      if (fPlano.size > 0 && !fPlano.has(l.planoContas ?? '')) return false;
      if (fSub.size > 0 && !fSub.has(nomeSubclassificacao(l, mapaSub))) return false;
      if (observacao.trim() && !casaObs(`${l.observacao ?? ''} ${l.descricao ?? ''}`)) return false;
      return true;
    });
  }, [linhas, fornecedores, empresas, planos, subclassificacoes, origens, situacoes, observacao, hoje, mapaSub]);

  const getCellTextTitulos = useCallback(
    (row: DiarioContaPagarLinha, colId: string) => textoCelulaVencidos(row, colId, mapaSub, hoje),
    [mapaSub, hoje],
  );
  const valueForSortTitulos = useCallback(
    (row: DiarioContaPagarLinha, colId: string) => valorOrdenacaoVencidos(row, colId, mapaSub, hoje),
    [mapaSub, hoje],
  );
  const gradeTitulos = useGradeFiltrosExcel({
    rows: base,
    columnIds: COLUNAS_TITULOS_VENCIDOS.map((c) => c.id),
    getCellText: getCellTextTitulos,
    valueForSort: valueForSortTitulos,
    dateColumnIds: ['vencimento'],
  });
  const titulosExibidos = gradeTitulos.rowsExibidas;

  const opcoes = (campo: 'fornecedor' | 'planoContas') => {
    const set = new Set<string>();
    for (const l of linhas) {
      const v = l[campo]?.trim();
      if (v) set.add(v);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  };
  const opcoesEmpresa = [...new Set(linhas.map(empresaExibida))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const opcoesSub = useMemo(() => {
    const set = new Set<string>();
    for (const l of linhas) {
      if (ehVencido(l, hoje) || ehReprogramado(l)) set.add(nomeSubclassificacao(l, mapaSub));
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [linhas, mapaSub, hoje]);

  const resumo = useMemo(() => {
    const vencidos = base.filter((l) => ehVencido(l, hoje));
    const reprogramados = base.filter(ehReprogramado);
    const soma = (lista: DiarioContaPagarLinha[]) => lista.reduce((acc, l) => acc + (Number(l.saldo) || 0), 0);
    const porMes = new Map<string, { mes: string; vencido: number; reprogramado: number }>();
    const porEmpresa = new Map<string, { nome: string; vencido: number; reprogramado: number }>();
    const porFornecedor = new Map<string, number>();
    const porCelula = new Map<string, number>();
    const porSub = new Map<string, number>();
    const faixas = FAIXAS.map((f) => ({ ...f, qtd: 0, saldo: 0 }));
    for (const l of base) {
      const saldo = Number(l.saldo) || 0;
      const mes = (l.dataVencimento ?? '').slice(0, 7) || 'sem data';
      const ponto = porMes.get(mes) ?? { mes, vencido: 0, reprogramado: 0 };
      if (ehVencido(l, hoje)) ponto.vencido += saldo;
      if (ehReprogramado(l)) ponto.reprogramado += saldo;
      porMes.set(mes, ponto);
      const empNome = empresaExibida(l);
      const emp = porEmpresa.get(empNome) ?? { nome: empNome, vencido: 0, reprogramado: 0 };
      if (fatiaSaldo(l) === 'reprogramado') emp.reprogramado += saldo;
      else emp.vencido += saldo;
      porEmpresa.set(empNome, emp);
      const forn = (l.fornecedor ?? 'Sem pessoa').toLocaleUpperCase('pt-BR');
      porFornecedor.set(forn, (porFornecedor.get(forn) ?? 0) + saldo);
      const chaveCel = chaveMatriz(forn, empNome);
      porCelula.set(chaveCel, (porCelula.get(chaveCel) ?? 0) + saldo);
      const sub = nomeSubclassificacao(l, mapaSub);
      porSub.set(sub, (porSub.get(sub) ?? 0) + saldo);
      const dias = ehVencido(l, hoje) ? diasAtraso(l.dataVencimento, hoje) : null;
      if (dias != null) {
        const faixa = faixas.find((f) => dias >= f.min && dias <= f.max);
        if (faixa) {
          faixa.qtd += 1;
          faixa.saldo += Number(l.saldo) || 0;
        }
      }
    }
    return {
      qtdVencidos: vencidos.length,
      saldoVencidos: soma(vencidos),
      qtdReprogramados: reprogramados.length,
      saldoReprogramados: soma(reprogramados),
      serie: [...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes)).map((p) => ({
        ...p,
        label: p.mes === 'sem data' ? 'Sem data' : `${p.mes.slice(5)}/${p.mes.slice(0, 4)}`,
      })),
      empresas: [...porEmpresa.values()]
        .map((item) => ({ ...item, saldo: item.vencido + item.reprogramado }))
        .sort((a, b) => b.saldo - a.saldo)
        .slice(0, 10),
      fornecedores: [...porFornecedor.entries()]
        .map(([nome, saldo]) => ({ nome, saldo }))
        .sort((a, b) => b.saldo - a.saldo),
      empresasMatriz: [...porEmpresa.values()]
        .sort((a, b) => (b.vencido + b.reprogramado) - (a.vencido + a.reprogramado) || a.nome.localeCompare(b.nome, 'pt-BR'))
        .map((item) => item.nome),
      celulas: Object.fromEntries(porCelula),
      subclassificacoes: [...porSub.entries()]
        .map(([nome, saldo]) => ({ nome, saldo }))
        .sort((a, b) => b.saldo - a.saldo)
        .slice(0, 12),
      faixas: [...faixas].sort((a, b) => b.saldo - a.saldo || a.min - b.min),
    };
  }, [base, hoje, mapaSub]);

  const elegiveis = useMemo(() => titulosExibidos.filter(podeAlterar), [titulosExibidos]);
  const marcadas = useMemo(
    () => elegiveis.filter((l) => selecionadas.has(chaveSelecao(l))),
    [elegiveis, selecionadas],
  );

  useEffect(() => {
    onResumo?.({ linhas: base.length, selecionadas: marcadas.length, loading });
  }, [base.length, marcadas.length, loading, onResumo]);

  useImperativeHandle(ref, () => ({
    limparFiltros: () => {
      setFornecedores('');
      setEmpresas('');
      setPlanos('');
      setSubclassificacoes('');
      setOrigens('');
      setSituacoes('');
      setObservacao('');
      gradeTitulos.limparFiltrosGrade();
    },
    linhasVisiveis: () => titulosExibidos,
    linhasSelecionadas: () => marcadas,
    periodo: () => {
      const datas = base
        .map((l) => (l.dataVencimento ?? '').slice(0, 10))
        .filter(Boolean)
        .sort();
      if (datas.length === 0) return { inicio: hoje, fim: hoje };
      return { inicio: datas[0], fim: datas[datas.length - 1] };
    },
    recarregar: () => {
      setSelecionadas(new Set());
      void carregar();
      void fetchDiarioSubclassificacoes()
      .then(setGrupos)
      .catch((e) => {
        setGrupos([]);
        setErro((prev) => prev ?? (e instanceof Error ? e.message : String(e)));
      });
    },
    atualizarSubclassificacoes: () => {
      void fetchDiarioSubclassificacoes()
      .then(setGrupos)
      .catch((e) => {
        setGrupos([]);
        setErro((prev) => prev ?? (e instanceof Error ? e.message : String(e)));
      });
    },
  }), [base, titulosExibidos, marcadas, hoje, onResumo, gradeTitulos.limparFiltrosGrade]);

  const abrirDetalhe = (titulo: string, linhasDetalhe: DiarioContaPagarLinha[]) => {
    setDetalhe({ titulo, linhas: linhasDetalhe });
  };
  const abrirMes = (ponto?: { mes?: string; label?: string }) => {
    if (!ponto?.mes) return;
    abrirDetalhe(
      `Vencimento ${ponto.label ?? ponto.mes}`,
      base.filter((l) => ((l.dataVencimento ?? '').slice(0, 7) || 'sem data') === ponto.mes),
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="card-panel shrink-0 overflow-visible">
        <div className="flex items-center gap-2 border-b border-slate-200 px-3 dark:border-slate-700">
          {([
            ['titulos', 'Títulos'],
            ['dashboard', 'Dashboard'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSubaba(id)}
              className={`px-3 py-2 text-sm font-medium border-b-2 ${
                subaba === id
                  ? 'border-primary-600 text-primary-700 dark:text-primary-300'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {filtrosVisivel ? <div className="flex flex-wrap items-end gap-2 px-3 py-2">
          <FiltroMulti label="Fornecedor" placeholder="Todos" options={opcoes('fornecedor')} value={fornecedores} onChange={setFornecedores} optionLabel="fornecedores" minWidth="150px" disabled={loading} />
          <FiltroMulti label="Empresa" placeholder="Todas" options={opcoesEmpresa} value={empresas} onChange={setEmpresas} optionLabel="empresas" minWidth="140px" disabled={loading} />
          <FiltroMulti label="Plano de contas" placeholder="Todos" options={opcoes('planoContas')} value={planos} onChange={setPlanos} optionLabel="planos" minWidth="160px" disabled={loading} />
          <FiltroMulti label="SubClassificação" placeholder="Todas" options={opcoesSub} value={subclassificacoes} onChange={setSubclassificacoes} optionLabel="subclassificações" minWidth="160px" disabled={loading} />
          <FiltroMulti label="Origem" placeholder="Todas" options={['Nomus', 'Shop9']} value={origens} onChange={setOrigens} optionLabel="origens" minWidth="110px" disabled={loading} />
          <FiltroMulti label="Situação" placeholder="Todas" options={['Vencidos', 'Reprogramados']} value={situacoes} onChange={setSituacoes} optionLabel="situações" minWidth="150px" disabled={loading} />
          <div className="w-44">
            <label className={FILTRO_LABEL_CLASS}>Observações</label>
            <input type="search" value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Descrição ou comentário" className={FILTRO_INPUT_CLASS} />
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => void carregar()}
            className={`${FILTRO_BTN} border-primary-600 bg-primary-600 text-white hover:bg-primary-700`}
          >
            {loading ? 'Buscando…' : 'Buscar'}
          </button>
        </div> : null}
      </div>

      {erro ? (
        <div className="shrink-0 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">{erro}</div>
      ) : null}

      <p className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
        {base.length.toLocaleString('pt-BR')} título(s) em aberto: vencidos (qualquer data) ou reprogramados (qualquer data). Contas já baixadas não entram.
      </p>

      <div className="min-h-0 flex-1 overflow-auto pb-4">
      {subaba === 'dashboard' ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              tone="amber"
              titulo="Vencidos"
              valor={resumo.qtdVencidos.toLocaleString('pt-BR')}
              detalhe={formatMoeda(resumo.saldoVencidos)}
              icone={<Clock3 className="h-4 w-4" />}
              onClick={() => abrirDetalhe('Vencidos', base.filter((l) => ehVencido(l, hoje)))}
            />
            <KpiCard
              tone="violet"
              titulo="Reprogramados"
              valor={resumo.qtdReprogramados.toLocaleString('pt-BR')}
              detalhe={formatMoeda(resumo.saldoReprogramados)}
              icone={<RefreshCw className="h-4 w-4" />}
              onClick={() => abrirDetalhe('Reprogramados', base.filter(ehReprogramado))}
            />
            <KpiCard
              tone="cyan"
              titulo="Saldo vencido"
              valor={formatMoeda(resumo.saldoVencidos)}
              detalhe="Somente títulos em aberto com vencimento passado"
              icone={<Wallet className="h-4 w-4" />}
              onClick={() => abrirDetalhe('Saldo vencido', base.filter((l) => ehVencido(l, hoje)))}
            />
            <KpiCard
              tone="emerald"
              titulo="Faixa mais pesada"
              valor={resumo.faixas[0]?.label ?? '—'}
              detalhe={formatMoeda(resumo.faixas[0]?.saldo ?? 0)}
              icone={<CalendarRange className="h-4 w-4" />}
              onClick={() => {
                const faixa = resumo.faixas[0];
                if (!faixa) return;
                abrirDetalhe(
                  faixa.label,
                  base.filter((l) => {
                    const dias = ehVencido(l, hoje) ? diasAtraso(l.dataVencimento, hoje) : null;
                    return dias != null && dias >= faixa.min && dias <= faixa.max;
                  }),
                );
              }}
            />
          </div>

          <div className={`p-4 ${panelSurface}`}>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Saldo no tempo</h2>
            <p className="mt-0.5 text-xs text-slate-500">Por mês de vencimento. Clique em um ponto para ver as contas.</p>
            <div className="mt-3 h-72">
              {resumo.serie.length === 0 ? <p className="py-16 text-center text-sm text-slate-400">Nenhum título neste recorte.</p> : (
                <ResponsiveContainer>
                  <LineChart
                    data={resumo.serie}
                    margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
                    style={{ cursor: 'pointer' }}
                    onClick={(estado) => {
                      const ponto = estado?.activePayload?.[0]?.payload as { mes?: string; label?: string } | undefined;
                      abrirMes(ponto);
                    }}
                  >
                    <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.16)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={48} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => formatMoeda(Number(v ?? 0))} />
                    <Line
                      type="monotone"
                      dataKey="vencido"
                      name="Vencido"
                      stroke={COR_VENCIDO}
                      strokeWidth={2.5}
                      dot={(props) => (
                        <PontoSerieClicavel
                          cx={props.cx}
                          cy={props.cy}
                          payload={props.payload as { mes?: string; label?: string }}
                          stroke={props.stroke}
                          onPonto={abrirMes}
                        />
                      )}
                      activeDot={(props) => (
                        <PontoSerieClicavel
                          cx={props.cx}
                          cy={props.cy}
                          payload={props.payload as { mes?: string; label?: string }}
                          stroke={props.stroke}
                          onPonto={abrirMes}
                        />
                      )}
                    />
                    <Line
                      type="monotone"
                      dataKey="reprogramado"
                      name="Reprogramado"
                      stroke={COR_REPROGRAMADO}
                      strokeWidth={2.5}
                      dot={(props) => (
                        <PontoSerieClicavel
                          cx={props.cx}
                          cy={props.cy}
                          payload={props.payload as { mes?: string; label?: string }}
                          stroke={props.stroke}
                          onPonto={abrirMes}
                        />
                      )}
                      activeDot={(props) => (
                        <PontoSerieClicavel
                          cx={props.cx}
                          cy={props.cy}
                          payload={props.payload as { mes?: string; label?: string }}
                          stroke={props.stroke}
                          onPonto={abrirMes}
                        />
                      )}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <GraficoEmpresaEmpilhado
              dados={resumo.empresas}
              onSelecionar={(nome) => abrirDetalhe(nome, base.filter((l) => empresaExibida(l) === nome))}
            />
            <RankingFornecedores
              dados={resumo.fornecedores}
              empresas={resumo.empresasMatriz}
              celulas={resumo.celulas}
              onSelecionar={(nome) => abrirDetalhe(nome, base.filter((l) => (l.fornecedor ?? 'Sem pessoa').toLocaleUpperCase('pt-BR') === nome))}
              onSelecionarCelula={(fornecedor, empresa) => abrirDetalhe(
                `${fornecedor} · ${empresa}`,
                base.filter((l) => (l.fornecedor ?? 'Sem pessoa').toLocaleUpperCase('pt-BR') === fornecedor && empresaExibida(l) === empresa),
              )}
            />
          </div>

          <Ranking
            titulo="Por subclassificação"
            detalhe="Clique em uma barra para ver as contas desse agrupamento."
            dados={resumo.subclassificacoes}
            cor={COR_SUB}
            onSelecionar={(nome) => abrirDetalhe(nome, base.filter((l) => nomeSubclassificacao(l, mapaSub) === nome))}
          />

          <div className={`p-4 ${panelSurface}`}>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Faixa de dias vencidos</h2>
            <p className="mt-0.5 text-xs text-slate-500">Clique em uma faixa para ver os títulos em aberto daquele atraso.</p>
            <div className="mt-3 h-64">
              <ResponsiveContainer>
                <BarChart data={resumo.faixas} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} style={{ cursor: 'pointer' }}>
                  <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.16)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={48} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => formatMoeda(Number(v ?? 0))} />
                  <Bar
                    dataKey="saldo"
                    name="Saldo"
                    radius={[6, 6, 0, 0]}
                    cursor="pointer"
                    onClick={(item) => {
                      const bruto = item as { id?: string; label?: string; payload?: { id?: string; label?: string } };
                      const faixa = { id: bruto.id ?? bruto.payload?.id, label: bruto.label ?? bruto.payload?.label };
                      const regra = FAIXAS.find((f) => f.id === faixa.id || f.label === faixa.label);
                      if (!regra) return;
                      abrirDetalhe(
                        regra.label,
                        base.filter((l) => {
                          const dias = ehVencido(l, hoje) ? diasAtraso(l.dataVencimento, hoje) : null;
                          return dias != null && dias >= regra.min && dias <= regra.max;
                        }),
                      );
                    }}
                  >
                    {resumo.faixas.map((f) => <Cell key={f.id} fill={f.cor} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        <div ref={gradeTitulos.tableScrollRef} className="card-panel min-h-0 overflow-auto !p-0">
          <table className="min-w-[1100px] w-full border-separate border-spacing-0 text-xs uppercase">
            <thead className="sticky top-0 z-10 bg-primary-600 text-white">
              <tr>
                <th className="sticky top-0 z-20 w-8 bg-primary-600 px-2 py-2">
                  <input
                    type="checkbox"
                    aria-label="Selecionar títulos em aberto"
                    checked={elegiveis.length > 0 && marcadas.length === elegiveis.length}
                    disabled={elegiveis.length === 0}
                    onChange={() => {
                      setSelecionadas((prev) => {
                        const next = new Set(prev);
                        if (marcadas.length === elegiveis.length) {
                          for (const l of elegiveis) next.delete(chaveSelecao(l));
                        } else {
                          for (const l of elegiveis) next.add(chaveSelecao(l));
                        }
                        return next;
                      });
                    }}
                  />
                </th>
                {COLUNAS_TITULOS_VENCIDOS.map((col) => (
                  <DiarioCabecalhoTh
                    key={col.id}
                    colId={col.id}
                    label={col.label}
                    grade={gradeTitulos}
                    align={'align' in col ? col.align : 'left'}
                    className="sticky top-0 bg-primary-600"
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {titulosExibidos.length === 0 && !loading ? (
                <tr>
                  <td colSpan={13} className="px-3 py-8 text-center normal-case text-slate-500">
                    {base.length === 0
                      ? 'Nenhum título vencido ou reprogramado em aberto.'
                      : 'Nenhum lançamento com os filtros da grade.'}
                  </td>
                </tr>
              ) : titulosExibidos.map((l, i) => {
                const dias = ehVencido(l, hoje) ? diasAtraso(l.dataVencimento, hoje) : null;
                const chave = chaveSelecao(l);
                const alteravel = podeAlterar(l);
                return (
                  <tr key={`${l.origem}-${l.codigo}-${i}`} className="border-t border-slate-100 text-slate-800 dark:border-slate-700/80 dark:text-slate-100">
                    <td className="px-2 py-1.5">
                      <input
                        type="checkbox"
                        aria-label="Selecionar título"
                        checked={selecionadas.has(chave)}
                        disabled={!alteravel}
                        onChange={() => {
                          if (!alteravel) return;
                          setSelecionadas((prev) => {
                            const next = new Set(prev);
                            if (next.has(chave)) next.delete(chave);
                            else next.add(chave);
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td className="px-2 py-1.5 tabular-nums">{l.codigoClassificacao ?? '—'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap normal-case"><BadgeSituacao status={l.status} /></td>
                    <td className="max-w-[14rem] truncate px-2 py-1.5">{l.planoContas ?? '—'}</td>
                    <td className="max-w-[14rem] truncate px-2 py-1.5 normal-case">
                      <BadgeSubclassificacao nome={nomeSubclassificacao(l, mapaSub)} />
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{formatData(l.dataVencimento)}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap font-semibold text-red-600 dark:text-red-400">{l.reprogramado ?? '—'}</td>
                    <td className="px-2 py-1.5 tabular-nums">{dias ?? '—'}</td>
                    <td className="max-w-[12rem] truncate px-2 py-1.5">{empresaExibida(l)}</td>
                    <td className="max-w-[14rem] truncate px-2 py-1.5">{l.fornecedor ?? '—'}</td>
                    <td className="max-w-[22rem] truncate px-2 py-1.5"><DescricaoReprogramadaGrade texto={l.descricao} /></td>
                    <td className="max-w-[14rem] truncate px-2 py-1.5">{l.observacao ?? '—'}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{formatMoeda(l.saldo)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      </div>
      {subaba === 'titulos' ? <DiarioGradeFiltroPortal grade={gradeTitulos} zIndex={14000} /> : null}
      {detalhe ? (
        <ModalDetalheGrafico
          titulo={detalhe.titulo}
          linhas={detalhe.linhas}
          mapaSub={mapaSub}
          hoje={hoje}
          onClose={() => setDetalhe(null)}
        />
      ) : null}
    </div>
  );
});

function ModalDetalheGrafico({
  titulo,
  linhas,
  mapaSub,
  hoje,
  onClose,
}: {
  titulo: string;
  linhas: DiarioContaPagarLinha[];
  mapaSub: Map<string, string>;
  hoje: string;
  onClose: () => void;
}) {
  const getCellText = useCallback(
    (row: DiarioContaPagarLinha, colId: string) => textoCelulaVencidos(row, colId, mapaSub, hoje),
    [mapaSub, hoje],
  );
  const valueForSort = useCallback(
    (row: DiarioContaPagarLinha, colId: string) => valorOrdenacaoVencidos(row, colId, mapaSub, hoje),
    [mapaSub, hoje],
  );
  const grade = useGradeFiltrosExcel({
    rows: linhas,
    columnIds: COLUNAS_DETALHE_VENCIDOS.map((c) => c.id),
    getCellText,
    valueForSort,
    dateColumnIds: ['vencimento'],
  });
  const visiveis = grade.rowsExibidas;
  const saldo = visiveis.reduce((acc, l) => acc + (Number(l.saldo) || 0), 0);
  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-slate-900/50" aria-label="Fechar" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="detalhe-grafico-titulo"
        className="relative z-[81] flex h-[min(92vh,56rem)] w-[min(98vw,96rem)] max-w-none flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div>
            <h2 id="detalhe-grafico-titulo" className="text-lg font-semibold text-slate-900 dark:text-slate-50">{titulo}</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {visiveis.length.toLocaleString('pt-BR')}
              {visiveis.length !== linhas.length ? ` de ${linhas.length.toLocaleString('pt-BR')}` : ''} título(s) · saldo {formatMoeda(saldo)}
              {' · use ▾ no cabeçalho para filtrar e classificar'}
            </p>
          </div>
          {grade.temFiltrosOuOrdem ? (
            <button
              type="button"
              onClick={() => grade.limparFiltrosGrade()}
              className="shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
            >
              Limpar filtros da grade
            </button>
          ) : null}
        </div>
        <div ref={grade.tableScrollRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <table className="w-full table-fixed border-separate border-spacing-0 text-xs uppercase">
            <colgroup>
              <col className="w-[9%]" />
              <col className="w-[14%]" />
              <col className="w-[13%]" />
              <col className="w-[9%]" />
              <col className="w-[13%]" />
              <col className="w-[15%]" />
              <col className="w-[18%]" />
              <col className="w-[9%]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-primary-600 text-white">
              <tr>
                {COLUNAS_DETALHE_VENCIDOS.map((col) => (
                  <DiarioCabecalhoTh
                    key={col.id}
                    colId={col.id}
                    label={col.label}
                    grade={grade}
                    align={'align' in col ? col.align : 'left'}
                    className="sticky top-0 border-r border-white/20 bg-primary-600 last:border-r-0"
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {visiveis.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center normal-case text-slate-400">Nenhuma conta neste recorte.</td></tr>
              ) : visiveis.map((l, i) => (
                <tr key={`${l.origem}-${l.codigo}-${i}`} className="text-slate-800 dark:text-slate-100">
                  <td className="border-r border-t border-slate-200 px-2 py-1.5 align-top normal-case dark:border-slate-700"><BadgeSituacao status={l.status} /></td>
                  <td className="border-r border-t border-slate-200 px-2 py-1.5 align-top break-words dark:border-slate-700">{l.planoContas ?? '—'}</td>
                  <td className="border-r border-t border-slate-200 px-2 py-1.5 align-top normal-case dark:border-slate-700">
                    <BadgeSubclassificacao nome={nomeSubclassificacao(l, mapaSub)} />
                  </td>
                  <td className="border-r border-t border-slate-200 px-2 py-1.5 align-top whitespace-nowrap dark:border-slate-700">{formatData(l.dataVencimento)}</td>
                  <td className="border-r border-t border-slate-200 px-2 py-1.5 align-top break-words dark:border-slate-700">{empresaExibida(l)}</td>
                  <td className="border-r border-t border-slate-200 px-2 py-1.5 align-top break-words dark:border-slate-700">{l.fornecedor ?? '—'}</td>
                  <td className="border-r border-t border-slate-200 px-2 py-1.5 align-top break-words dark:border-slate-700"><DescricaoReprogramadaGrade texto={l.descricao} /></td>
                  <td className="border-t border-slate-200 px-2 py-1.5 align-top text-right tabular-nums whitespace-nowrap dark:border-slate-700">{formatMoeda(l.saldo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200"
          >
            Fechar
          </button>
        </div>
        <DiarioGradeFiltroPortal grade={grade} zIndex={14000} />
      </div>
    </div>,
    document.body,
  );
}

const MEDALHA = [
  'text-amber-400',
  'text-slate-400',
  'text-orange-700',
] as const;

function GraficoEmpresaEmpilhado({
  dados,
  onSelecionar,
}: {
  dados: Array<{ nome: string; vencido: number; reprogramado: number; saldo: number }>;
  onSelecionar: (nome: string) => void;
}) {
  const [visao, setVisao] = useState<'barras' | 'pizza'>('barras');
  const pizza = visao === 'pizza';

  return (
    <div className={`relative p-4 ${panelSurface}`}>
      <button
        type="button"
        aria-label={pizza ? 'Ver gráfico de barras' : 'Ver gráfico de pizza'}
        title={pizza ? 'Ver barras' : 'Ver pizza'}
        onClick={() => setVisao((atual) => (atual === 'barras' ? 'pizza' : 'barras'))}
        className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        {pizza ? <BarChart3 className="h-4 w-4" /> : <ChartPie className="h-4 w-4" />}
      </button>
      <h2 className="pr-10 text-sm font-semibold text-slate-900 dark:text-white">Por empresa</h2>
      <p className="mt-0.5 pr-10 text-xs text-slate-500">
        {pizza
          ? 'Cada fatia é uma empresa. Clique para ver as contas.'
          : 'Laranja: vencido. Azul: reprogramado. Clique na barra para ver as contas.'}
      </p>
      <div className="relative mt-3 h-72 overflow-hidden">
        {dados.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">Sem dados.</p>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={visao}
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 0.55, rotate: pizza ? -90 : 90 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.45, rotate: pizza ? 90 : -90 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <ResponsiveContainer>
                {pizza ? (
                  <PieChart>
                    <Tooltip
                      formatter={(v, _n, item) => {
                        const bruto = item?.payload as { vencido?: number; reprogramado?: number } | undefined;
                        return [
                          `${formatMoeda(Number(v ?? 0))} · venc. ${formatMoeda(bruto?.vencido ?? 0)} · reprog. ${formatMoeda(bruto?.reprogramado ?? 0)}`,
                          'Saldo',
                        ];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Pie
                      data={dados}
                      dataKey="saldo"
                      nameKey="nome"
                      cx="50%"
                      cy="46%"
                      innerRadius={48}
                      outerRadius={92}
                      paddingAngle={2}
                      cornerRadius={6}
                      cursor="pointer"
                      onClick={(item) => {
                        const nome = String((item as { nome?: string }).nome ?? '');
                        if (nome) onSelecionar(nome);
                      }}
                    >
                      {dados.map((item, idx) => (
                        <Cell key={item.nome} fill={CORES_PIZZA[idx % CORES_PIZZA.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                ) : (
                  <BarChart data={dados} layout="vertical" margin={{ top: 8, right: 12, left: 8, bottom: 4 }} style={{ cursor: 'pointer' }}>
                    <CartesianGrid horizontal={false} stroke="rgba(148,163,184,0.16)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="nome" width={120} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(v, nome) => [formatMoeda(Number(v ?? 0)), String(nome)]}
                      labelFormatter={(label) => String(label)}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar
                      dataKey="vencido"
                      name="Vencido"
                      stackId="saldo"
                      fill={COR_VENCIDO}
                      cursor="pointer"
                      onClick={(item) => {
                        const nome = String((item as { payload?: { nome?: string } }).payload?.nome ?? '');
                        if (nome) onSelecionar(nome);
                      }}
                    />
                    <Bar
                      dataKey="reprogramado"
                      name="Reprogramado"
                      stackId="saldo"
                      fill={COR_REPROGRAMADO}
                      radius={[0, 6, 6, 0]}
                      cursor="pointer"
                      onClick={(item) => {
                        const nome = String((item as { payload?: { nome?: string } }).payload?.nome ?? '');
                        if (nome) onSelecionar(nome);
                      }}
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

type LinhaMatrizGrade = {
  fornecedor: string;
  total: number;
  [col: string]: string | number;
};

function RankingFornecedores({
  dados,
  empresas,
  celulas,
  onSelecionar,
  onSelecionarCelula,
}: {
  dados: Array<{ nome: string; saldo: number }>;
  empresas: string[];
  celulas: Record<string, number>;
  onSelecionar: (nome: string) => void;
  onSelecionarCelula: (fornecedor: string, empresa: string) => void;
}) {
  const [matrizAberta, setMatrizAberta] = useState(false);
  const [busca, setBusca] = useState('');
  const visiveis = dados.slice(0, 10);
  const max = visiveis[0]?.saldo || 1;
  const passa = useMemo(() => criarMatcherTextoLivre(busca), [busca]);
  const rowsMatriz = useMemo((): LinhaMatrizGrade[] => {
    return dados
      .filter((item) => passa(item.nome))
      .map((forn) => {
        const row: LinhaMatrizGrade = { fornecedor: forn.nome, total: forn.saldo };
        for (const emp of empresas) {
          row[`emp:${emp}`] = celulas[chaveMatriz(forn.nome, emp)] ?? 0;
        }
        return row;
      });
  }, [dados, empresas, celulas, passa]);
  const columnIds = useMemo(
    () => ['fornecedor', ...empresas.map((emp) => `emp:${emp}`), 'total'],
    [empresas],
  );
  const getCellText = useCallback((row: LinhaMatrizGrade, colId: string) => {
    if (colId === 'fornecedor') return String(row.fornecedor);
    const n = Number(row[colId] ?? 0);
    return n > 0 ? formatMoeda(n) : VAZIO_CELULA;
  }, []);
  const valueForSort = useCallback((row: LinhaMatrizGrade, colId: string) => {
    if (colId === 'fornecedor') return String(row.fornecedor);
    return Number(row[colId] ?? 0);
  }, []);
  const gradeMatriz = useGradeFiltrosExcel({
    rows: rowsMatriz,
    columnIds,
    getCellText,
    valueForSort,
  });
  const linhasMatriz = gradeMatriz.rowsExibidas;

  return (
    <div className={`relative p-4 ${panelSurface}`}>
      <button
        type="button"
        aria-label="Abrir matriz fornecedor por empresa"
        title="Abrir matriz fornecedor por empresa"
        onClick={() => setMatrizAberta(true)}
        className="absolute left-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        <ListOrdered className="h-4 w-4" />
      </button>
      <h2 className="pl-10 text-sm font-semibold text-slate-900 dark:text-white">Ranking de fornecedores</h2>
      <p className="mt-0.5 pl-10 text-xs text-slate-500">
        Top 10 por saldo. Clique em uma linha para ver as contas.
      </p>
      <div className="mt-3 max-h-72 space-y-1.5 overflow-auto pr-1">
        {visiveis.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">Sem dados.</p>
        ) : visiveis.map((item, idx) => {
          const pct = Math.max(2, Math.round((item.saldo / max) * 100));
          const medalha = MEDALHA[idx];
          return (
            <button
              key={item.nome}
              type="button"
              onClick={() => onSelecionar(item.nome)}
              className="flex w-full flex-col gap-0.5 rounded-lg px-1 py-1 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50"
            >
              <div className="flex items-center gap-2">
                {medalha ? (
                  <span className={`inline-flex w-6 shrink-0 items-center justify-center ${medalha}`} title={`${idx + 1}º`}>
                    <Medal className="h-4 w-4" />
                  </span>
                ) : (
                  <span className="w-6 shrink-0 text-right text-[11px] font-semibold tabular-nums text-slate-500">{idx + 1}º</span>
                )}
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800 dark:text-slate-100">{item.nome}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-slate-600 dark:text-slate-300">{formatMoeda(item.saldo)}</span>
              </div>
              <div className="ml-8 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COR_VENCIDO }} />
              </div>
            </button>
          );
        })}
      </div>

      {matrizAberta
        ? createPortal(
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
              <button type="button" className="absolute inset-0 bg-slate-900/55" aria-label="Fechar" onClick={() => setMatrizAberta(false)} />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="matriz-forn-titulo"
                className="relative z-[121] flex h-[min(92vh,56rem)] w-[min(98vw,92rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800"
              >
                <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-5 pb-3">
                  <div className="min-w-0 flex-1">
                    <h2 id="matriz-forn-titulo" className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                      Matriz fornecedor × empresa
                    </h2>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Colunas da maior para a menor. Clique no valor para ver as contas. Use ▾ no cabeçalho para filtrar e classificar.
                    </p>
                    <input
                      type="search"
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar fornecedor"
                      className={`${FILTRO_INPUT_CLASS} mt-3 max-w-sm`}
                    />
                  </div>
                  {gradeMatriz.temFiltrosOuOrdem ? (
                    <button
                      type="button"
                      onClick={() => gradeMatriz.limparFiltrosGrade()}
                      className="shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                    >
                      Limpar filtros da grade
                    </button>
                  ) : null}
                </div>
                <div ref={gradeMatriz.tableScrollRef} className="min-h-0 flex-1 overflow-auto">
                  {linhasMatriz.length === 0 || empresas.length === 0 ? (
                    <p className="py-10 text-center text-sm text-slate-400">Sem dados.</p>
                  ) : (
                    <table className="w-max min-w-full border-separate border-spacing-0 text-xs uppercase">
                      <thead className="text-white">
                        <tr>
                          <DiarioCabecalhoTh
                            colId="fornecedor"
                            label="Fornecedor"
                            grade={gradeMatriz}
                            className="sticky left-0 top-0 z-40 min-w-[16rem] border-r border-white/25 bg-primary-600 text-white shadow-[2px_0_0_0_rgb(37,99,235)]"
                          />
                          {empresas.map((emp) => (
                            <DiarioCabecalhoTh
                              key={emp}
                              colId={`emp:${emp}`}
                              label={emp}
                              grade={gradeMatriz}
                              align="right"
                              className="sticky top-0 z-30 min-w-[9rem] border-r border-white/25 bg-primary-600 text-white last:border-r-0"
                            />
                          ))}
                          <DiarioCabecalhoTh
                            colId="total"
                            label="Total"
                            grade={gradeMatriz}
                            align="right"
                            className="sticky top-0 z-30 min-w-[9rem] bg-primary-600 text-white"
                          />
                        </tr>
                      </thead>
                      <tbody>
                        {linhasMatriz.map((forn) => (
                          <tr key={String(forn.fornecedor)} className="text-slate-800 dark:text-slate-100">
                            <th className="sticky left-0 z-10 border-r border-t border-slate-200 bg-white px-2 py-1.5 text-left font-medium whitespace-nowrap shadow-[2px_0_6px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-slate-800">
                              <button
                                type="button"
                                className="max-w-[22rem] truncate text-left hover:underline"
                                title={String(forn.fornecedor)}
                                onClick={() => onSelecionar(String(forn.fornecedor))}
                              >
                                {forn.fornecedor}
                              </button>
                            </th>
                            {empresas.map((emp) => {
                              const valor = Number(forn[`emp:${emp}`] ?? 0);
                              return (
                                <td key={emp} className="border-r border-t border-slate-200 px-2 py-1.5 text-right tabular-nums whitespace-nowrap dark:border-slate-700">
                                  {valor > 0 ? (
                                    <button type="button" className="hover:underline" onClick={() => onSelecionarCelula(String(forn.fornecedor), emp)}>
                                      {formatMoeda(valor)}
                                    </button>
                                  ) : (
                                    <span className="text-slate-300 dark:text-slate-600">—</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="border-t border-slate-200 px-2 py-1.5 text-right font-semibold tabular-nums whitespace-nowrap dark:border-slate-700">
                              {formatMoeda(Number(forn.total) || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <div className="flex shrink-0 justify-end border-t border-slate-200 px-5 py-4 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setMatrizAberta(false)}
                    className="inline-flex h-9 items-center rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200"
                  >
                    Fechar
                  </button>
                </div>
                <DiarioGradeFiltroPortal grade={gradeMatriz} zIndex={14000} />
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function Ranking({
  titulo,
  dados,
  cor,
  detalhe = 'Clique em uma barra para ver as contas.',
  onSelecionar,
}: {
  titulo: string;
  dados: Array<{ nome: string; saldo: number }>;
  cor: string;
  detalhe?: string;
  onSelecionar?: (nome: string) => void;
}) {
  return (
    <div className={`p-4 ${panelSurface}`}>
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{titulo}</h2>
      <p className="mt-0.5 text-xs text-slate-500">{detalhe}</p>
      <div className="mt-3 h-72">
        {dados.length === 0 ? <p className="py-16 text-center text-sm text-slate-400">Sem dados.</p> : (
          <ResponsiveContainer>
            <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }} style={{ cursor: onSelecionar ? 'pointer' : undefined }}>
              <CartesianGrid horizontal={false} stroke="rgba(148,163,184,0.16)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="nome" width={120} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => formatMoeda(Number(v ?? 0))} />
              <Bar
                dataKey="saldo"
                name="Saldo"
                fill={cor}
                radius={[0, 6, 6, 0]}
                cursor={onSelecionar ? 'pointer' : undefined}
                onClick={(item) => {
                  const bruto = item as { nome?: string; payload?: { nome?: string } };
                  const nome = String(bruto.nome ?? bruto.payload?.nome ?? '');
                  if (nome && onSelecionar) onSelecionar(nome);
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
