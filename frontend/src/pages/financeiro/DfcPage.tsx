import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLayoutFoco } from '../../contexts/LayoutFocoContext';
import ArvoreContasDfc from './dfc/ArvoreContasDfc';
import DfcPrioridadeModal from './dfc/DfcPrioridadeModal';
import DfcSaldoFaturarModal from './dfc/DfcSaldoFaturarModal';
import DfcVencidoPagarModal from './dfc/DfcVencidoPagarModal';
import DfcProjecaoReceitasModal from './dfc/DfcProjecaoReceitasModal';
import DfcEndividamentoBancarioModal from './dfc/DfcEndividamentoBancarioModal';
import DfcCarregandoModal from './dfc/DfcCarregandoModal';
import { DFC_EMPRESA_OPCOES, DFC_EMPRESAS_TODAS, DFC_ID_EMPRESA_ACO, projecaoReceitasAplicaParaEmpresas } from './dfc/dfcEmpresas';
import MultiSelectWithSearch from '../../components/MultiSelectWithSearch';
import { listarOpcoesPlanoContasDfc } from './dfc/dfcPlanoContasOpcoes';
import {
  agregarContribuicoesParaGrade,
  filtrarContribuicoes,
} from './dfc/dfcFiltrarContribuicoes';
import {
  fetchDfcAgendamentosEfetivos,
  fetchDfcKpis,
  fetchDfcProjecaoReceitas,
  fetchDfcEndividamentoBancario,
  fetchDfcSaldosBancarios,
  type DfcContribuicaoLinha,
  type DfcEndividamentoBancarioResponse,
  type DfcKpis,
  type DfcSaldoBancarioContaGrade,
} from '../../api/financeiro';
import {
  DFC_PRIORIDADE_LABEL,
  listarPrioridadesConta,
  listarPrioridadesLancamento,
  type DfcPrioridade,
  type DfcPrioridadeContaLinha,
  type DfcPrioridadeLancamentoLinha,
} from '../../api/dfcPrioridade';
import { listarPeriodosDfc } from './dfc/dfcPeriodos';
import {
  calcularCruzamentosFluxo,
  totaisEntradasSaidasTresFluxos,
} from './dfc/dfcCruzamentoFluxo';

const OPCOES_PLANO_CONTAS = listarOpcoesPlanoContasDfc();
const OPCOES_EMPRESA_IDS = DFC_EMPRESA_OPCOES.map((o) => String(o.id));
const LABEL_EMPRESA: Record<string, string> = Object.fromEntries(
  DFC_EMPRESA_OPCOES.map((o) => [String(o.id), o.label]),
);
const OPCOES_PRIORIDADE_IDS = ['1', '2', '3', '4'];
const LABEL_PRIORIDADE: Record<string, string> = Object.fromEntries(
  OPCOES_PRIORIDADE_IDS.map((id) => [id, DFC_PRIORIDADE_LABEL[Number(id) as DfcPrioridade]]),
);
const OPCOES_PLANO_IDS = OPCOES_PLANO_CONTAS.map((o) => o.id);
const LABEL_PLANO: Record<string, string> = Object.fromEntries(
  OPCOES_PLANO_CONTAS.map((o) => [o.id, o.label]),
);

const DFC_FILTRO_INPUT_CLASS =
  'w-full rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent';
const DFC_FILTRO_LABEL_CLASS = 'block text-xs text-slate-500 dark:text-slate-400 mb-1';

function parseMultiCsv(value: string): string[] {
  if (!value.trim()) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

function joinMultiCsv(ids: string[]): string {
  return ids.join(',');
}

function hojeLocalYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function inicioAnoLocalYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
}

function diffDaysInclusiveYmd(a: string, b: string): number | null {
  const parse = (s: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  };
  const da = parse(a);
  const db = parse(b);
  if (!da || !db || db < da) return null;
  const ms = 86400000;
  return Math.floor((db.getTime() - da.getTime()) / ms) + 1;
}

function fmtBrl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const KPIS_ZERO: DfcKpis = {
  recebimentos: 0, pagamentos: 0,
  vencidosPagar: 0, vencidosReceber: 0,
  aVencerPagar: 0, aVencerReceber: 0,
  saldoBancario: 0,
};
const ENDIVIDAMENTO_ZERO: DfcEndividamentoBancarioResponse = {
  dataInicio: '',
  dataFim: '',
  idEmpresas: [],
  total: 0,
  vencido: 0,
  aVencer: 0,
  linhas: [],
  porFornecedor: [],
  porEmpresa: [],
  porConta: [],
};

/** Destaque suave ao passar o mouse nos cards KPI. */
const KPI_CARD_CLASS =
  'rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-3 min-w-0 shadow-sm transition-all duration-200 ease-out hover:shadow-md hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-slate-500';


export default function DfcPage() {
  const dfcShellRef = useRef<HTMLDivElement>(null);
  const { modoFoco, alternarModoFoco, sairModoFoco } = useLayoutFoco();

  // Restaura o header ao sair da página DFC
  useEffect(() => {
    return () => sairModoFoco();
  }, [sairModoFoco]);

  const [dataInicio, setDataInicio] = useState(inicioAnoLocalYmd);
  const [dataFim, setDataFim] = useState(hojeLocalYmd);
  const [granularidade, setGranularidade] = useState<'dia' | 'mes'>('mes');
  const [periodos, setPeriodos] = useState<string[]>(() => listarPeriodosDfc(inicioAnoLocalYmd(), hojeLocalYmd(), 'mes'));
  const [aplicadoDataInicio, setAplicadoDataInicio] = useState('');
  const [aplicadoDataFim, setAplicadoDataFim] = useState('');
  const [aplicadoGranularidade, setAplicadoGranularidade] = useState<'dia' | 'mes'>('mes');
  const [contribuicoesBase, setContribuicoesBase] = useState<DfcContribuicaoLinha[]>([]);
  const [saldosIniciaisPorPeriodo, setSaldosIniciaisPorPeriodo] = useState<Record<string, number>>({});
  const [saldosFinaisPorPeriodo, setSaldosFinaisPorPeriodo] = useState<Record<string, number>>({});
  const [saldosPorConta, setSaldosPorConta] = useState<DfcSaldoBancarioContaGrade[]>([]);
  const [erroSaldosBancarios, setErroSaldosBancarios] = useState<string | null>(null);
  const [projecaoReceitasPorPeriodo, setProjecaoReceitasPorPeriodo] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtrosEmpresaCsv, setFiltrosEmpresaCsv] = useState('');
  const [filtrosContaCsv, setFiltrosContaCsv] = useState('');
  const [filtrosPlanoCsv, setFiltrosPlanoCsv] = useState('');
  const [contasBancariasOpcoes, setContasBancariasOpcoes] = useState<string[]>([]);
  const [kpisBase, setKpisBase] = useState<DfcKpis>(KPIS_ZERO);
  const [filtrosPrioridadeCsv, setFiltrosPrioridadeCsv] = useState('');

  const filtrosEmpresaIds = useMemo(() => parseMultiCsv(filtrosEmpresaCsv), [filtrosEmpresaCsv]);
  const filtrosContaBancaria = useMemo(() => parseMultiCsv(filtrosContaCsv), [filtrosContaCsv]);
  const filtrosPlanoContas = useMemo(() => parseMultiCsv(filtrosPlanoCsv), [filtrosPlanoCsv]);
  const filtrosPrioridade = useMemo(() => parseMultiCsv(filtrosPrioridadeCsv), [filtrosPrioridadeCsv]);
  const [faixaFiltrosVisivel, setFaixaFiltrosVisivel] = useState(true);

  useEffect(() => {
    if (modoFoco) setFaixaFiltrosVisivel(false);
  }, [modoFoco]);

  const [modalPrioridadeAberto, setModalPrioridadeAberto] = useState(false);
  const [modalSaldoFaturarAberto, setModalSaldoFaturarAberto] = useState(false);
  const [modalVencidoPagarAberto, setModalVencidoPagarAberto] = useState(false);
  const [modalProjecao, setModalProjecao] = useState<{ periodo?: string; titulo: string } | null>(null);
  const [modalEndividamentoAberto, setModalEndividamentoAberto] = useState(false);
  const [endividamento, setEndividamento] = useState<DfcEndividamentoBancarioResponse>(ENDIVIDAMENTO_ZERO);
  const [prioridadesContasMap, setPrioridadesContasMap] = useState<Record<string, DfcPrioridade>>({});
  const [prioridadesLancsMap, setPrioridadesLancsMap] = useState<Record<string, DfcPrioridade>>({});
  /**
   * Flag que indica que classificações de prioridade mudaram desde o último carregamento.
   * Quando o usuário fecha o modal (ou o detalhe), recarregamos a DFC apenas se houver filtro
   * de prioridade ativo — assim os cliques unitários não disparam reflows.
   */
  const houveMudancaPrioridadeRef = useRef(false);
  /** Ignora respostas de requisições obsoletas (evita precisar clicar Aplicar duas vezes). */
  const carregarSeqRef = useRef(0);
  const filtrosAplicarRef = useRef({ dataInicio, dataFim, granularidade });
  filtrosAplicarRef.current = { dataInicio, dataFim, granularidade };
  /** Recarrega uma vez se o filtro de empresa exige o campo `empresa` ausente na carga antiga. */
  const recarregouParaFiltroEmpresaRef = useRef(false);

  const aplicarPrioridadeContaNoMapa = useCallback(
    (idEmpresa: number, idContaFinanceiro: number, prioridade: DfcPrioridade | null) => {
      const k = `${idEmpresa}#${idContaFinanceiro}`;
      setPrioridadesContasMap((prev) => {
        if (prioridade == null) {
          if (!(k in prev)) return prev;
          const next = { ...prev };
          delete next[k];
          return next;
        }
        if (prev[k] === prioridade) return prev;
        return { ...prev, [k]: prioridade };
      });
      houveMudancaPrioridadeRef.current = true;
    },
    [],
  );

  const aplicarPrioridadeLancNoMapa = useCallback(
    (idEmpresa: number, tipoRef: 'A' | 'L', idRef: number, prioridade: DfcPrioridade | null) => {
      const k = `${idEmpresa}#${tipoRef}#${idRef}`;
      setPrioridadesLancsMap((prev) => {
        if (prioridade == null) {
          if (!(k in prev)) return prev;
          const next = { ...prev };
          delete next[k];
          return next;
        }
        if (prev[k] === prioridade) return prev;
        return { ...prev, [k]: prioridade };
      });
      houveMudancaPrioridadeRef.current = true;
    },
    [],
  );

  const diasNoIntervalo = useMemo(() => diffDaysInclusiveYmd(dataInicio, dataFim), [dataInicio, dataFim]);
  const bloqueioDiario = granularidade === 'dia' && diasNoIntervalo != null && diasNoIntervalo > 120;

  const carregarMapasPrioridade = useCallback(async (empresas: number[]) => {
    const [contasResp, lancsResp] = await Promise.all([
      listarPrioridadesConta({ idEmpresas: empresas }),
      listarPrioridadesLancamento({ idEmpresas: empresas }),
    ]);
    const mc: Record<string, DfcPrioridade> = {};
    for (const c of contasResp.linhas as DfcPrioridadeContaLinha[]) {
      mc[`${c.idEmpresa}#${c.idContaFinanceiro}`] = c.prioridade;
    }
    const ml: Record<string, DfcPrioridade> = {};
    for (const l of lancsResp.linhas as DfcPrioridadeLancamentoLinha[]) {
      ml[`${l.idEmpresa}#${l.tipoRef}#${l.idRef}`] = l.prioridade;
    }
    return { mc, ml };
  }, []);

  const aplicarMapasPrioridade = useCallback((mc: Record<string, DfcPrioridade>, ml: Record<string, DfcPrioridade>) => {
    setPrioridadesContasMap(mc);
    setPrioridadesLancsMap(ml);
  }, []);

  const carregar = useCallback(async () => {
    const f = filtrosAplicarRef.current;
    const dias = diffDaysInclusiveYmd(f.dataInicio, f.dataFim);
    const bloqueio = f.granularidade === 'dia' && dias != null && dias > 120;
    if (bloqueio) {
      setError('No modo diário o intervalo máximo é 120 dias. Reduza o período ou use visão mensal.');
      return;
    }

    const seq = ++carregarSeqRef.current;
    setLoading(true);
    setError(null);
    const per = listarPeriodosDfc(f.dataInicio, f.dataFim, f.granularidade);
    setPeriodos(per);
    setAplicadoDataInicio(f.dataInicio);
    setAplicadoDataFim(f.dataFim);
    setAplicadoGranularidade(f.granularidade);

    try {
      const [res, projRes, kpisRes, endivRes, mapasPrioridade] = await Promise.all([
        fetchDfcAgendamentosEfetivos({
          dataInicio: f.dataInicio,
          dataFim: f.dataFim,
          granularidade: f.granularidade,
        }),
        fetchDfcProjecaoReceitas({
          dataInicio: f.dataInicio,
          dataFim: f.dataFim,
          granularidade: f.granularidade,
          idEmpresas: [DFC_ID_EMPRESA_ACO],
        }),
        fetchDfcKpis({
          dataInicio: f.dataInicio,
          dataFim: f.dataFim,
          idEmpresas: DFC_EMPRESAS_TODAS,
        }).catch(() => KPIS_ZERO),
        fetchDfcEndividamentoBancario({
          dataInicio: f.dataInicio,
          dataFim: f.dataFim,
          idEmpresas: DFC_EMPRESAS_TODAS,
        }),
        carregarMapasPrioridade(DFC_EMPRESAS_TODAS),
      ]);

      if (seq !== carregarSeqRef.current) return;

      aplicarMapasPrioridade(mapasPrioridade.mc, mapasPrioridade.ml);

      if (res.erro) {
        setContribuicoesBase([]);
        setSaldosIniciaisPorPeriodo({});
        setSaldosFinaisPorPeriodo({});
        setSaldosPorConta([]);
        setErroSaldosBancarios(null);
        setProjecaoReceitasPorPeriodo({});
        setContasBancariasOpcoes([]);
        setKpisBase(kpisRes);
        setEndividamento({ ...ENDIVIDAMENTO_ZERO, dataInicio: f.dataInicio, dataFim: f.dataFim });
        setError(res.erro);
        return;
      }
      const opcoesCb = res.contasBancariasDisponiveis ?? [];
      setContasBancariasOpcoes(opcoesCb);
      setFiltrosContaCsv((prev) => {
        const kept = parseMultiCsv(prev).filter((n) => opcoesCb.includes(n));
        return joinMultiCsv(kept);
      });
      setContribuicoesBase(res.contribuicoes ?? []);
      setSaldosIniciaisPorPeriodo(res.saldosIniciaisPorPeriodo ?? {});
      setSaldosFinaisPorPeriodo(res.saldosFinaisPorPeriodo ?? {});
      setSaldosPorConta(res.saldosPorConta ?? []);
      setErroSaldosBancarios(res.erroSaldosBancarios ?? null);
      setProjecaoReceitasPorPeriodo(projRes.porPeriodo ?? {});
      setKpisBase(kpisRes);
      setEndividamento(endivRes);
      if (projRes.erro) {
        console.warn('[DFC] Projeção de receitas:', projRes.erro);
      }
      if (res.erroSaldosBancarios) {
        console.warn('[DFC] Saldos bancários:', res.erroSaldosBancarios);
      }
    } catch (e) {
      if (seq !== carregarSeqRef.current) return;
      setContribuicoesBase([]);
      setSaldosIniciaisPorPeriodo({});
      setSaldosFinaisPorPeriodo({});
      setSaldosPorConta([]);
      setErroSaldosBancarios(null);
      setProjecaoReceitasPorPeriodo({});
      setEndividamento({ ...ENDIVIDAMENTO_ZERO, dataInicio: f.dataInicio, dataFim: f.dataFim });
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (seq === carregarSeqRef.current) {
        setLoading(false);
      }
    }
  }, [aplicarMapasPrioridade, carregarMapasPrioridade]);

  const idEmpresasEfetivas = useMemo(
    () =>
      filtrosEmpresaIds.length > 0
        ? filtrosEmpresaIds.map((s) => Number(s)).filter((n) => Number.isFinite(n))
        : [...DFC_EMPRESAS_TODAS],
    [filtrosEmpresaIds],
  );

  /** Projeção de receitas (saldo a faturar Só Aço) — entra na grade quando Só Aço está no filtro. */
  const projecaoReceitasHabilitada = useMemo(
    () => projecaoReceitasAplicaParaEmpresas(idEmpresasEfetivas),
    [idEmpresasEfetivas],
  );

  const projecaoReceitasPorPeriodoEfetiva = useMemo(
    () => (projecaoReceitasHabilitada ? projecaoReceitasPorPeriodo : {}),
    [projecaoReceitasHabilitada, projecaoReceitasPorPeriodo],
  );

  useEffect(() => {
    if (!projecaoReceitasHabilitada) setModalProjecao(null);
  }, [projecaoReceitasHabilitada]);

  const prioridadesSelecionadas = useMemo(
    () =>
      filtrosPrioridade
        .map((s) => Number(s) as DfcPrioridade)
        .filter((p) => p >= 1 && p <= 4),
    [filtrosPrioridade],
  );

  const idsPlanoContasFiltro = useMemo(
    () =>
      filtrosPlanoContas
        .map((s) => Number(s))
        .filter((n) => Number.isFinite(n) && n > 0),
    [filtrosPlanoContas],
  );

  /** Vazio = todas as empresas; com seleção = mesma lista usada no modal de detalhe. */
  const idEmpresasFiltroGrade = useMemo(
    () => (filtrosEmpresaIds.length > 0 ? idEmpresasEfetivas : []),
    [filtrosEmpresaIds.length, idEmpresasEfetivas],
  );

  const contribuicoesFiltradas = useMemo(
    () =>
      filtrarContribuicoes(
        contribuicoesBase,
        {
          idEmpresas: idEmpresasFiltroGrade,
          contasBancarias: filtrosContaBancaria,
          prioridades: prioridadesSelecionadas,
          idsPlanoContas: idsPlanoContasFiltro,
        },
        prioridadesContasMap,
        prioridadesLancsMap,
      ),
    [
      contribuicoesBase,
      idEmpresasFiltroGrade,
      filtrosContaBancaria,
      prioridadesSelecionadas,
      idsPlanoContasFiltro,
      prioridadesContasMap,
      prioridadesLancsMap,
    ],
  );

  const valoresPorConta = useMemo(
    () => agregarContribuicoesParaGrade(contribuicoesFiltradas, aplicadoGranularidade),
    [contribuicoesFiltradas, aplicadoGranularidade],
  );

  const dadosJaCarregados = contribuicoesBase.length > 0;
  const temFiltroSaldos =
    filtrosEmpresaIds.length > 0 || filtrosContaBancaria.length > 0;

  useEffect(() => {
    if (loading || !dadosJaCarregados || filtrosEmpresaIds.length === 0) return;
    const temCampoEmpresa = contribuicoesBase.some(
      (c) => typeof c.empresa === 'string' && c.empresa.trim() !== '',
    );
    if (temCampoEmpresa || recarregouParaFiltroEmpresaRef.current) return;
    recarregouParaFiltroEmpresaRef.current = true;
    void carregar();
  }, [
    loading,
    dadosJaCarregados,
    filtrosEmpresaIds.length,
    contribuicoesBase,
    carregar,
  ]);

  useEffect(() => {
    if (!dadosJaCarregados || !aplicadoDataInicio || !aplicadoDataFim) return;
    if (!temFiltroSaldos) return;

    let cancel = false;
    void fetchDfcSaldosBancarios({
      dataInicio: aplicadoDataInicio,
      dataFim: aplicadoDataFim,
      granularidade: aplicadoGranularidade,
      idEmpresas: idEmpresasEfetivas,
      contasBancarias: filtrosContaBancaria,
    }).then((r) => {
      if (cancel) return;
      setSaldosIniciaisPorPeriodo(r.saldosIniciaisPorPeriodo);
      setSaldosFinaisPorPeriodo(r.saldosFinaisPorPeriodo);
      setSaldosPorConta(r.saldosPorConta);
      if (r.erro) setErroSaldosBancarios(r.erro);
    });

    return () => {
      cancel = true;
    };
  }, [
    dadosJaCarregados,
    aplicadoDataInicio,
    aplicadoDataFim,
    aplicadoGranularidade,
    idEmpresasEfetivas,
    filtrosContaBancaria,
    temFiltroSaldos,
  ]);

  const kpis = useMemo(() => {
    if (contribuicoesBase.length === 0) return kpisBase;
    const cruz = calcularCruzamentosFluxo({
      periodos,
      valoresPorConta,
      projecaoReceitasPorPeriodo: projecaoReceitasPorPeriodoEfetiva,
    });
    const { recebimentos, pagamentos } = totaisEntradasSaidasTresFluxos(cruz);
    return {
      ...kpisBase,
      recebimentos,
      pagamentos,
      saldoBancario: 0,
    };
  }, [contribuicoesBase.length, kpisBase, periodos, valoresPorConta, projecaoReceitasPorPeriodoEfetiva]);

  const filtrosDesabilitados = !dadosJaCarregados;

  const focoMaximo = modoFoco && !faixaFiltrosVisivel;
  const mostrarPainelFiltros = !modoFoco || faixaFiltrosVisivel;

  return (
    <div
      ref={dfcShellRef}
      className={`w-full min-w-0 flex flex-col min-h-0 ${modoFoco ? 'flex-1 gap-3' : 'gap-6'}`}
    >
      {!modoFoco ? (
        <div className="flex items-start justify-between gap-3 shrink-0">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 min-w-0 pr-2">
            DFC — Demonstração dos Fluxos de Caixa
          </h2>
          <button
            type="button"
            onClick={alternarModoFoco}
            className="shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition"
            title="Ocultar menu — modo foco"
            aria-label="Ocultar menu — modo foco"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
          </button>
        </div>
      ) : null}

      {/* ── Faixa de filtros ──────────────────────────────────────────────── */}
      {mostrarPainelFiltros ? (
      <div className="card-panel w-full shrink-0 shadow-sm relative">
        <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-2">
          {modoFoco ? (
            <button
              type="button"
              onClick={alternarModoFoco}
              className="inline-flex h-9 items-center px-3 rounded-lg border border-primary-400 dark:border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200 text-xs font-medium hover:bg-primary-100 dark:hover:bg-primary-900/50 transition shadow-sm"
            >
              Sair da tela cheia
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setFaixaFiltrosVisivel((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 transition shadow-sm"
            title={faixaFiltrosVisivel ? 'Ocultar filtros' : 'Exibir filtros'}
            aria-label={faixaFiltrosVisivel ? 'Ocultar filtros' : 'Exibir filtros'}
            aria-expanded={faixaFiltrosVisivel}
          >
            {faixaFiltrosVisivel ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75 12 8.25m0 0 7.5 7.5M12 8.25v12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m0 0 7.5-7.5M12 19.5l-7.5-7.5" />
              </svg>
            )}
          </button>
        </div>

        {faixaFiltrosVisivel ? (
          <div className="px-4 py-3 flex flex-col gap-3 pr-12">
            <div className="flex flex-wrap items-end gap-3 min-w-0 w-full">
              <label className="flex flex-col gap-0.5">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Início</span>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-2.5 py-1.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Fim</span>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-2.5 py-1.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </label>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Agrupar por</span>
                <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden bg-slate-50 dark:bg-slate-700">
                  {(['mes', 'dia'] as const).map((g, i) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGranularidade(g)}
                      className={`px-3.5 py-1.5 text-xs font-semibold transition ${
                        i > 0 ? 'border-l border-slate-200 dark:border-slate-600' : ''
                      } ${
                        granularidade === g
                          ? 'bg-primary-600 text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'
                      }`}
                    >
                      {g === 'mes' ? 'Mês' : 'Dia'}
                    </button>
                  ))}
                </div>
              </div>
              <MultiSelectWithSearch
                label="Empresa"
                placeholder="Todas"
                options={OPCOES_EMPRESA_IDS}
                value={filtrosEmpresaCsv}
                onChange={setFiltrosEmpresaCsv}
                labelClass={DFC_FILTRO_LABEL_CLASS}
                inputClass={DFC_FILTRO_INPUT_CLASS}
                labelByValue={LABEL_EMPRESA}
                minWidth="140px"
                optionLabel="empresas"
                disabled={filtrosDesabilitados}
                dropdownZIndex={200}
              />
              <MultiSelectWithSearch
                label="Conta bancária"
                placeholder="Todas"
                options={contasBancariasOpcoes}
                value={filtrosContaCsv}
                onChange={setFiltrosContaCsv}
                labelClass={DFC_FILTRO_LABEL_CLASS}
                inputClass={DFC_FILTRO_INPUT_CLASS}
                minWidth="160px"
                optionLabel="contas"
                disabled={filtrosDesabilitados}
                dropdownZIndex={200}
                dropdownMaxWidth="320px"
              />
              <MultiSelectWithSearch
                label="Prioridade"
                placeholder="Todas"
                options={OPCOES_PRIORIDADE_IDS}
                value={filtrosPrioridadeCsv}
                onChange={setFiltrosPrioridadeCsv}
                labelClass={DFC_FILTRO_LABEL_CLASS}
                inputClass={DFC_FILTRO_INPUT_CLASS}
                labelByValue={LABEL_PRIORIDADE}
                minWidth="150px"
                optionLabel="prioridades"
                disabled={filtrosDesabilitados}
                dropdownZIndex={200}
                dropdownMaxWidth="360px"
              />
              <MultiSelectWithSearch
                label="Plano de contas"
                placeholder="Todas"
                options={OPCOES_PLANO_IDS}
                value={filtrosPlanoCsv}
                onChange={setFiltrosPlanoCsv}
                labelClass={DFC_FILTRO_LABEL_CLASS}
                inputClass={DFC_FILTRO_INPUT_CLASS}
                labelByValue={LABEL_PLANO}
                minWidth="180px"
                optionLabel="contas"
                disabled={filtrosDesabilitados}
                dropdownZIndex={200}
                dropdownMaxWidth="420px"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-600">
              <button
                type="button"
                onClick={() => setModalSaldoFaturarAberto(true)}
                title="Saldo a faturar por parcela de PD"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 transition shadow-sm"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75V5.25A2.25 2.25 0 0 1 4.5 3h15a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 19.5 21h-15a2.25 2.25 0 0 1-2.25-2.25ZM9 8.25h6M9 12h6" />
                </svg>
                Saldo a faturar
              </button>
              <button
                type="button"
                onClick={() => setModalPrioridadeAberto(true)}
                title="Classificar plano de contas / lançamentos"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 transition shadow-sm"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h18M6 12h12M10 19.5h4" />
                </svg>
                Classificar
              </button>
              <button
                type="button"
                onClick={() => void carregar()}
                disabled={bloqueioDiario}
                className="px-5 py-2 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
              >
                {loading ? 'Carregando…' : 'Aplicar'}
              </button>
            </div>

            {bloqueioDiario ? (
              <p className="text-[11px] text-amber-700 dark:text-amber-300 w-full">
                ⚠ Intervalo maior que 120 dias: use visão mensal ou encurte as datas.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="h-11 pr-12" aria-hidden />
        )}
      </div>
      ) : null}

      <DfcCarregandoModal aberto={loading} />

      {!loading && !dadosJaCarregados && !error ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 shrink-0 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 px-4 py-3">
          Ajuste os filtros e clique em <span className="font-semibold text-slate-700 dark:text-slate-200">Aplicar</span> para carregar a demonstração.
        </p>
      ) : null}

      <DfcSaldoFaturarModal
        aberto={modalSaldoFaturarAberto}
        onClose={() => setModalSaldoFaturarAberto(false)}
        idEmpresas={idEmpresasEfetivas}
      />

      <DfcVencidoPagarModal
        aberto={modalVencidoPagarAberto}
        onClose={() => setModalVencidoPagarAberto(false)}
        dataInicio={aplicadoDataInicio || dataInicio}
        dataFim={aplicadoDataFim || dataFim}
        idEmpresas={idEmpresasEfetivas.length > 0 ? idEmpresasEfetivas : DFC_EMPRESAS_TODAS}
        totalKpi={kpis.vencidosPagar}
      />

      {modalProjecao && projecaoReceitasHabilitada ? (
        <DfcProjecaoReceitasModal
          aberto
          onClose={() => setModalProjecao(null)}
          titulo={modalProjecao.titulo}
          dataInicio={aplicadoDataInicio || dataInicio}
          dataFim={aplicadoDataFim || dataFim}
          granularidade={aplicadoGranularidade}
          idEmpresas={[DFC_ID_EMPRESA_ACO]}
          periodo={modalProjecao.periodo}
        />
      ) : null}

      {modalEndividamentoAberto ? (
        <DfcEndividamentoBancarioModal
          aberto
          onClose={() => setModalEndividamentoAberto(false)}
          dataInicio={aplicadoDataInicio || dataInicio}
          dataFim={aplicadoDataFim || dataFim}
          dados={endividamento}
        />
      ) : null}

      <DfcPrioridadeModal
        aberto={modalPrioridadeAberto}
        dataInicio={aplicadoDataInicio || dataInicio}
        dataFim={aplicadoDataFim || dataFim}
        onClose={() => {
          setModalPrioridadeAberto(false);
          houveMudancaPrioridadeRef.current = false;
        }}
        idEmpresas={idEmpresasEfetivas.length > 0 ? idEmpresasEfetivas : DFC_EMPRESAS_TODAS}
        onPrioridadeContaAtualizada={aplicarPrioridadeContaNoMapa}
        onPrioridadeLancAtualizada={aplicarPrioridadeLancNoMapa}
      />

      {/* ── Cards KPI ─────────────────────────────────────────────────────── */}
      {!modoFoco ? (
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 shrink-0">

        {/* Recebimentos */}
        <div className={KPI_CARD_CLASS}>
          <div className="flex items-center gap-2.5">
            <div className="shrink-0 h-9 w-9 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
              <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
              </svg>
            </div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-tight">Recebimentos</span>
          </div>
          {loading ? (
            <span className="h-7 w-28 rounded-md bg-slate-200 dark:bg-slate-700 animate-pulse block" />
          ) : (
            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums leading-tight truncate">
              {fmtBrl(kpis.recebimentos)}
            </span>
          )}
          <span className="text-[11px] text-slate-400 dark:text-slate-500 -mt-1">no período selecionado</span>
        </div>

        {/* Pagamentos */}
        <div className={KPI_CARD_CLASS}>
          <div className="flex items-center gap-2.5">
            <div className="shrink-0 h-9 w-9 rounded-full bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center">
              <svg className="h-4 w-4 text-rose-600 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
              </svg>
            </div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-tight">Pagamentos</span>
          </div>
          {loading ? (
            <span className="h-7 w-28 rounded-md bg-slate-200 dark:bg-slate-700 animate-pulse block" />
          ) : (
            <span className="text-lg font-bold text-rose-600 dark:text-rose-400 tabular-nums leading-tight truncate">
              {fmtBrl(kpis.pagamentos)}
            </span>
          )}
          <span className="text-[11px] text-slate-400 dark:text-slate-500 -mt-1">no período selecionado</span>
        </div>

        {/* Vencido a pagar — clique abre análise detalhada */}
        <button
          type="button"
          onClick={() => setModalVencidoPagarAberto(true)}
          className={`${KPI_CARD_CLASS} text-left cursor-pointer hover:border-orange-300 dark:hover:border-orange-600 hover:shadow-orange-100/80 dark:hover:shadow-orange-950/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900`}
          title="Ver análise de vencidos a pagar"
        >
          <div className="flex items-center gap-2.5">
            <div className="shrink-0 h-9 w-9 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
              <svg className="h-4 w-4 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-tight">Vencido a pagar</span>
          </div>
          {loading ? (
            <span className="h-7 w-28 rounded-md bg-slate-200 dark:bg-slate-700 animate-pulse block" />
          ) : (
            <span className="text-lg font-bold text-orange-600 dark:text-orange-400 tabular-nums leading-tight truncate">
              {fmtBrl(kpis.vencidosPagar)}
            </span>
          )}
          <span className="text-[11px] text-slate-400 dark:text-slate-500 -mt-1">clique para detalhes · período selecionado</span>
        </button>

        {/* Saldo Bancário */}
        <div className={KPI_CARD_CLASS}>
          <div className="flex items-center gap-2.5">
            <div className={`shrink-0 h-9 w-9 rounded-full flex items-center justify-center ${
              kpis.saldoBancario >= 0 ? 'bg-sky-100 dark:bg-sky-900/50' : 'bg-red-100 dark:bg-red-900/50'
            }`}>
              <svg className={`h-4 w-4 ${kpis.saldoBancario >= 0 ? 'text-sky-600 dark:text-sky-400' : 'text-red-600 dark:text-red-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-tight">Saldo Bancário</span>
          </div>
          {loading ? (
            <span className="h-7 w-28 rounded-md bg-slate-200 dark:bg-slate-700 animate-pulse block" />
          ) : (
            <span className={`text-lg font-bold tabular-nums leading-tight truncate ${
              kpis.saldoBancario >= 0 ? 'text-sky-600 dark:text-sky-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {fmtBrl(kpis.saldoBancario)}
            </span>
          )}
          <span className="text-[11px] text-slate-400 dark:text-slate-500 -mt-1">acumulado até o fim do período</span>
        </div>

        {/* Endividamento Bancário */}
        <button
          type="button"
          onClick={() => setModalEndividamentoAberto(true)}
          className={`${KPI_CARD_CLASS} text-left cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-indigo-100/80 dark:hover:shadow-indigo-950/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900`}
          title="Ver dashboard de endividamento bancário"
        >
          <div className="flex items-center gap-2.5">
            <div className="shrink-0 h-9 w-9 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
              <svg className="h-4 w-4 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m4.5-9h-9m13.5 3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-tight">Endividamento bancário</span>
          </div>
          {loading ? (
            <span className="h-7 w-28 rounded-md bg-slate-200 dark:bg-slate-700 animate-pulse block" />
          ) : (
            <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400 tabular-nums leading-tight truncate">
              {fmtBrl(endividamento.total)}
            </span>
          )}
          <span className="text-[11px] text-slate-400 dark:text-slate-500 -mt-1">clique para dashboard por conta/fornecedor/empresa</span>
        </button>

      </div>
      ) : null}

      <div className={`min-h-0 w-full ${modoFoco ? 'flex-1 flex flex-col' : ''}`}>
        <ArvoreContasDfc
          periodos={periodos}
          valoresPorConta={valoresPorConta}
          granularidade={aplicadoGranularidade}
          dataInicio={aplicadoDataInicio || dataInicio}
          dataFim={aplicadoDataFim || dataFim}
          idEmpresas={idEmpresasEfetivas}
          contasBancariasSelecionadas={filtrosContaBancaria}
          loading={loading}
          error={error}
          telaCheia={modoFoco}
          onMostrarFiltros={focoMaximo ? () => setFaixaFiltrosVisivel(true) : undefined}
          onSairTelaCheia={focoMaximo ? alternarModoFoco : undefined}
          idsPlanoContasFiltro={idsPlanoContasFiltro}
          prioridadesSelecionadas={prioridadesSelecionadas}
          prioridadesContasMap={prioridadesContasMap}
          prioridadesLancsMap={prioridadesLancsMap}
          onPrioridadeLancAtualizada={aplicarPrioridadeLancNoMapa}
          projecaoReceitasPorPeriodo={projecaoReceitasPorPeriodoEfetiva}
          saldosIniciaisPorPeriodo={saldosIniciaisPorPeriodo}
          saldosFinaisPorPeriodo={saldosFinaisPorPeriodo}
          saldosPorConta={saldosPorConta}
          erroSaldosBancarios={erroSaldosBancarios}
          onAbrirProjecaoDetalhe={
            projecaoReceitasHabilitada
              ? (periodo, titulo) => setModalProjecao({ periodo, titulo })
              : undefined
          }
          onDetalheFechado={() => {
            houveMudancaPrioridadeRef.current = false;
          }}
        />
      </div>
    </div>
  );
}
