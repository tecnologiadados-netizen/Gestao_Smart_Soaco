import { forwardRef, useEffect, useImperativeHandle, useMemo, useState, type ReactNode } from 'react';
import { CalendarRange, Clock3, RefreshCw, Wallet } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
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
import { criarMatcherTextoLivre } from '../../../utils/textoLivreBusca';
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

function empresaExibida(l: DiarioContaPagarLinha): string {
  return (l.filial?.trim() || l.empresa?.trim() || 'Sem empresa').toLocaleUpperCase('pt-BR');
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
};

function ehVencido(l: DiarioContaPagarLinha, hoje: string): boolean {
  return l.status === 'Em aberto' && !!l.dataVencimento && l.dataVencimento.slice(0, 10) < hoje;
}

function chaveClassificacao(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleUpperCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim();
}

function nomeSubclassificacao(l: DiarioContaPagarLinha, mapa: Map<string, string>): string {
  const plano = l.planoContas?.trim() ?? '';
  const direto = plano ? mapa.get(chaveClassificacao(plano)) : undefined;
  const comCodigo = plano && l.codigoClassificacao != null && l.codigoClassificacao > 0
    ? mapa.get(chaveClassificacao(`${l.codigoClassificacao} - ${plano}`))
    : undefined;
  return (comCodigo ?? direto ?? SEM_SUBCLASSIFICACAO).toLocaleUpperCase('pt-BR');
}

function KpiCard({
  tone,
  titulo,
  valor,
  detalhe,
  icone,
}: {
  tone: Tone;
  titulo: string;
  valor: string;
  detalhe: string;
  icone: ReactNode;
}) {
  const tom = TONE[tone];
  return (
    <article className={`relative overflow-hidden rounded-2xl border p-4 ${tom.card}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{titulo}</p>
          <p className="mt-2 text-[1.45rem] font-semibold leading-none tracking-tight tabular-nums text-slate-900 dark:text-white">{valor}</p>
        </div>
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${tom.icon}`}>{icone}</span>
      </div>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{detalhe}</p>
    </article>
  );
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
    void fetchDiarioSubclassificacoes().then(setGrupos).catch(() => setGrupos([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mapaSub = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const grupo of grupos) mapa.set(chaveClassificacao(grupo.classificacao), grupo.nome);
    return mapa;
  }, [grupos]);

  const base = useMemo(() => {
    const fFornecedor = selecionados(fornecedores);
    const fEmpresa = selecionados(empresas);
    const fPlano = selecionados(planos);
    const fSub = selecionados(subclassificacoes);
    const fOrigem = selecionados(origens);
    const casaObs = criarMatcherTextoLivre(observacao);
    return linhas.filter((l) => {
      if (l.status !== 'Em aberto') return false;
      if (!(ehVencido(l, hoje) || ehReprogramado(l))) return false;
      if (fOrigem.size > 0 && !fOrigem.has(l.origem)) return false;
      if (fFornecedor.size > 0 && !fFornecedor.has(l.fornecedor ?? '')) return false;
      if (fEmpresa.size > 0 && !fEmpresa.has(empresaExibida(l))) return false;
      if (fPlano.size > 0 && !fPlano.has(l.planoContas ?? '')) return false;
      if (fSub.size > 0 && !fSub.has(nomeSubclassificacao(l, mapaSub))) return false;
      if (observacao.trim() && !casaObs(`${l.observacao ?? ''} ${l.descricao ?? ''}`)) return false;
      return true;
    });
  }, [linhas, fornecedores, empresas, planos, subclassificacoes, origens, observacao, hoje, mapaSub]);

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
    const porEmpresa = new Map<string, number>();
    const porFornecedor = new Map<string, number>();
    const porSub = new Map<string, number>();
    const faixas = FAIXAS.map((f) => ({ ...f, qtd: 0, saldo: 0 }));
    for (const l of base) {
      const mes = (l.dataVencimento ?? '').slice(0, 7) || 'sem data';
      const ponto = porMes.get(mes) ?? { mes, vencido: 0, reprogramado: 0 };
      if (ehVencido(l, hoje)) ponto.vencido += Number(l.saldo) || 0;
      if (ehReprogramado(l)) ponto.reprogramado += Number(l.saldo) || 0;
      porMes.set(mes, ponto);
      const emp = empresaExibida(l);
      porEmpresa.set(emp, (porEmpresa.get(emp) ?? 0) + (Number(l.saldo) || 0));
      const forn = (l.fornecedor ?? 'Sem pessoa').toLocaleUpperCase('pt-BR');
      porFornecedor.set(forn, (porFornecedor.get(forn) ?? 0) + (Number(l.saldo) || 0));
      const sub = nomeSubclassificacao(l, mapaSub);
      porSub.set(sub, (porSub.get(sub) ?? 0) + (Number(l.saldo) || 0));
      const dias = ehVencido(l, hoje) ? diasAtraso(l.dataVencimento, hoje) : null;
      if (dias != null) {
        const faixa = faixas.find((f) => dias >= f.min && dias <= f.max);
        if (faixa) {
          faixa.qtd += 1;
          faixa.saldo += Number(l.saldo) || 0;
        }
      }
    }
    const top = (mapa: Map<string, number>) =>
      [...mapa.entries()]
        .map(([nome, saldo]) => ({ nome, saldo }))
        .sort((a, b) => b.saldo - a.saldo)
        .slice(0, 8);
    return {
      qtdVencidos: vencidos.length,
      saldoVencidos: soma(vencidos),
      qtdReprogramados: reprogramados.length,
      saldoReprogramados: soma(reprogramados),
      serie: [...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes)).map((p) => ({
        ...p,
        label: p.mes === 'sem data' ? 'Sem data' : `${p.mes.slice(5)}/${p.mes.slice(0, 4)}`,
      })),
      empresas: top(porEmpresa),
      fornecedores: top(porFornecedor),
      subclassificacoes: [...porSub.entries()]
        .map(([nome, saldo]) => ({ nome, saldo }))
        .sort((a, b) => b.saldo - a.saldo)
        .slice(0, 12),
      faixas,
    };
  }, [base, hoje, mapaSub]);

  const elegiveis = useMemo(() => base.filter(podeAlterar), [base]);
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
      setObservacao('');
    },
    linhasVisiveis: () => base,
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
      void fetchDiarioSubclassificacoes().then(setGrupos).catch(() => setGrupos([]));
    },
  }), [base, marcadas, hoje, onResumo]);

  const abrirDetalhe = (titulo: string, linhasDetalhe: DiarioContaPagarLinha[]) => {
    setDetalhe({ titulo, linhas: linhasDetalhe });
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
            <KpiCard tone="amber" titulo="Vencidos" valor={resumo.qtdVencidos.toLocaleString('pt-BR')} detalhe={formatMoeda(resumo.saldoVencidos)} icone={<Clock3 className="h-4 w-4" />} />
            <KpiCard tone="violet" titulo="Reprogramados" valor={resumo.qtdReprogramados.toLocaleString('pt-BR')} detalhe={formatMoeda(resumo.saldoReprogramados)} icone={<RefreshCw className="h-4 w-4" />} />
            <KpiCard tone="cyan" titulo="Saldo vencido" valor={formatMoeda(resumo.saldoVencidos)} detalhe="Somente títulos em aberto com vencimento passado" icone={<Wallet className="h-4 w-4" />} />
            <KpiCard tone="emerald" titulo="Faixa mais pesada" valor={resumo.faixas.slice().sort((a, b) => b.saldo - a.saldo)[0]?.label ?? '—'} detalhe={formatMoeda(resumo.faixas.slice().sort((a, b) => b.saldo - a.saldo)[0]?.saldo ?? 0)} icone={<CalendarRange className="h-4 w-4" />} />
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
                      if (!ponto?.mes) return;
                      abrirDetalhe(
                        `Vencimento ${ponto.label ?? ponto.mes}`,
                        base.filter((l) => ((l.dataVencimento ?? '').slice(0, 7) || 'sem data') === ponto.mes),
                      );
                    }}
                  >
                    <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.16)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={48} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => formatMoeda(Number(v ?? 0))} />
                    <Line type="monotone" dataKey="vencido" name="Vencido" stroke={COR_VENCIDO} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="reprogramado" name="Reprogramado" stroke={COR_REPROGRAMADO} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Ranking
              titulo="Por empresa"
              dados={resumo.empresas}
              cor={COR_REPROGRAMADO}
              onSelecionar={(nome) => abrirDetalhe(nome, base.filter((l) => empresaExibida(l) === nome))}
            />
            <Ranking
              titulo="Por fornecedor"
              dados={resumo.fornecedores}
              cor={COR_VENCIDO}
              onSelecionar={(nome) => abrirDetalhe(nome, base.filter((l) => (l.fornecedor ?? 'Sem pessoa').toLocaleUpperCase('pt-BR') === nome))}
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
        <div className="card-panel min-h-0 overflow-auto !p-0">
          <table className="min-w-[1100px] w-full text-xs uppercase">
            <thead className="sticky top-0 z-10 bg-primary-600 text-white">
              <tr>
                <th className="w-8 px-2 py-2">
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
                {['Código', 'Situação', 'Classificação', 'SubClassificação', 'Vencimento', 'Reprogramado', 'Dias', 'Empresa', 'Pessoa', 'Descrição', 'Comentários', 'Saldo a pagar'].map((col) => (
                  <th key={col} className="px-2 py-2 text-left font-medium whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {base.length === 0 && !loading ? (
                <tr><td colSpan={13} className="px-3 py-8 text-center normal-case text-slate-500">Nenhum título vencido ou reprogramado em aberto.</td></tr>
              ) : base.map((l, i) => {
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
                    <td className="px-2 py-1.5 whitespace-nowrap">{l.status}</td>
                    <td className="max-w-[14rem] truncate px-2 py-1.5">{l.planoContas ?? '—'}</td>
                    <td className="max-w-[14rem] truncate px-2 py-1.5">{nomeSubclassificacao(l, mapaSub)}</td>
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
      {detalhe ? <ModalDetalheGrafico titulo={detalhe.titulo} linhas={detalhe.linhas} mapaSub={mapaSub} onClose={() => setDetalhe(null)} /> : null}
    </div>
  );
});

function ModalDetalheGrafico({
  titulo,
  linhas,
  mapaSub,
  onClose,
}: {
  titulo: string;
  linhas: DiarioContaPagarLinha[];
  mapaSub: Map<string, string>;
  onClose: () => void;
}) {
  const saldo = linhas.reduce((acc, l) => acc + (Number(l.saldo) || 0), 0);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-slate-900/50" aria-label="Fechar" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="detalhe-grafico-titulo"
        className="relative z-[81] flex max-h-[85vh] w-full max-w-5xl flex-col rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
      >
        <div className="px-5 pt-5 pb-3">
          <h2 id="detalhe-grafico-titulo" className="text-lg font-semibold text-slate-900 dark:text-slate-50">{titulo}</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {linhas.length.toLocaleString('pt-BR')} título(s) · saldo {formatMoeda(saldo)}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-5 pb-4">
          <table className="min-w-[860px] w-full text-xs uppercase">
            <thead className="sticky top-0 bg-white text-left text-slate-500 dark:bg-slate-800">
              <tr>
                {['Situação', 'Classificação', 'SubClassificação', 'Vencimento', 'Empresa', 'Pessoa', 'Descrição', 'Saldo a pagar'].map((col) => (
                  <th key={col} className="py-1.5 pr-3 font-medium whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 ? (
                <tr><td colSpan={8} className="py-8 text-center normal-case text-slate-400">Nenhuma conta neste recorte.</td></tr>
              ) : linhas.map((l, i) => (
                <tr key={`${l.origem}-${l.codigo}-${i}`} className="border-t border-slate-100 text-slate-800 dark:border-slate-700 dark:text-slate-100">
                  <td className="py-1.5 pr-3 whitespace-nowrap">{l.status}</td>
                  <td className="max-w-[14rem] truncate py-1.5 pr-3">{l.planoContas ?? '—'}</td>
                  <td className="max-w-[12rem] truncate py-1.5 pr-3">{nomeSubclassificacao(l, mapaSub)}</td>
                  <td className="py-1.5 pr-3 whitespace-nowrap">{formatData(l.dataVencimento)}</td>
                  <td className="max-w-[12rem] truncate py-1.5 pr-3">{empresaExibida(l)}</td>
                  <td className="max-w-[14rem] truncate py-1.5 pr-3">{l.fornecedor ?? '—'}</td>
                  <td className="max-w-[18rem] truncate py-1.5 pr-3"><DescricaoReprogramadaGrade texto={l.descricao} /></td>
                  <td className="py-1.5 text-right tabular-nums whitespace-nowrap">{formatMoeda(l.saldo)}</td>
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
      </div>
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
