import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import DoubleCheckInComparativoPcTab, {
  contarPendentesComparativo,
} from './DoubleCheckInComparativoPcTab';
import { AlertTriangle, CalendarRange, ChevronDown, ClipboardCheck, Eye, History, Library, Link2, Maximize2, Minimize2, RefreshCw, RotateCcw, Settings2, SlidersHorizontal, Users } from 'lucide-react';
import DoubleCheckInHistoricoModal from './DoubleCheckInHistoricoModal';
import DoubleCheckInJustificativasModal from './DoubleCheckInJustificativasModal';
import CarregandoInformacoesOverlay from '../../components/CarregandoInformacoesOverlay';
import GradeFiltroCabecalhoBtn from '../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../components/grade/GradeFiltroExcelPortal';
import { useGradeColunasExcel, type GradeColunaConfiguravel } from '../../components/grade/GradeColunasExcel';
import { useAuth } from '../../contexts/AuthContext';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import {
  conferirDoubleCheckIn,
  criarLinkEvidenciaDoubleCheck,
  CRITERIOS_DIVERGENCIA_PADRAO,
  fetchDoubleCheckInComparativoPc,
  fetchDoubleCheckInCriterios,
  fetchDoubleCheckInDestinatarios,
  fetchDoubleCheckInParametros,
  reabrirDoubleCheckIn,
  saveDoubleCheckInCriterios,
  saveDoubleCheckInDestinatarios,
  saveDoubleCheckInParametros,
  syncDoubleCheckIn,
  type CriteriosDivergenciaDoubleCheck,
  type DoubleCheckInCampoComparativo,
  type DoubleCheckInComparativoDecisao,
  type DoubleCheckInSolicitacaoOtimiza,
  type DoubleCheckInComparativoLinha,
  type DoubleCheckInJustificativaOpcao,
  type DoubleCheckInNota,
  type DoubleCheckInUsuarioDest,
} from '../../api/compras';
import { PERMISSOES } from '../../config/permissoes';
import { PLACEHOLDER_BUSCA_TEXTO_LIVRE, criarMatcherTextoLivre } from '../../utils/textoLivreBusca';

const POLL_MS = 120_000;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
const PAGE_SIZE_DEFAULT = 10;

const inputClass =
  'rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100';
const labelClass = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1';
const btnPrimary =
  'inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50';
const btnSecondary =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50';

function hojeYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDataBr(ymd: string | null): string {
  if (!ymd) return '—';
  const [y, m, d] = ymd.slice(0, 10).split('-');
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

const CRITERIOS_OPCOES: { id: DoubleCheckInCampoComparativo; label: string }[] = [
  { id: 'valor_unitario', label: 'Valor unitário' },
  { id: 'qtde', label: 'Quantidade' },
  { id: 'ipi', label: 'IPI' },
  { id: 'condicao_pagamento', label: 'Condição de pagamento' },
];

type ComparativoCache = {
  linhas: DoubleCheckInComparativoLinha[];
  decisoes: DoubleCheckInComparativoDecisao[];
  justificativas: DoubleCheckInJustificativaOpcao[];
  solicitacoesOtimiza: DoubleCheckInSolicitacaoOtimiza[];
  criterios: CriteriosDivergenciaDoubleCheck;
  camposLancados: DoubleCheckInCampoComparativo[];
  semVinculo: boolean;
};

type FiltroSituacao =
  | 'todos'
  | 'pendentes'
  | 'conferidos'
  | 'divergencia_real'
  | 'divergencia_benigna';

type RegimeConferencia = NonNullable<DoubleCheckInNota['regimeConferencia']>;

function textoQuemConferiu(nota: DoubleCheckInNota): string {
  if (regimeDaNota(nota) === 'nao_aplicada') return 'Conferência não aplicada';
  if (!nota.conferido) return 'Ainda não conferido';
  const quem = nota.conferidoPor?.trim() || '—';
  const quando = nota.conferidoEm ? new Date(nota.conferidoEm).toLocaleString('pt-BR') : '';
  return quando ? `${quem} · ${quando}` : quem;
}

function regimeDaNota(nota: DoubleCheckInNota): RegimeConferencia {
  if (nota.regimeConferencia) return nota.regimeConferencia;
  const dataEntrada = String(nota.dataEntrada ?? '').slice(0, 10);
  if (dataEntrada < '2026-09-19') return 'nao_aplicada';
  if (dataEntrada < '2026-09-21') return 'simples';
  return 'completa';
}

const LARGURA_ACOES = 104;
const COLUNAS_FLEXIVEIS = ['parceiro', 'criador'] as const;

function ajustarLargurasGrade(preferidas: Record<string, number>, disponivel: number): Record<string, number> {
  if (disponivel <= 0) return preferidas;
  const minimo = (id: string) => COLUNAS_GRADE.find((coluna) => coluna.id === id)?.larguraMinima ?? 64;
  const fixas = COLUNAS_GRADE.filter((coluna) => !COLUNAS_FLEXIVEIS.includes(coluna.id as (typeof COLUNAS_FLEXIVEIS)[number]));
  const somaFixas = fixas.reduce((soma, coluna) => soma + preferidas[coluna.id], 0) + LARGURA_ACOES;
  const somaFlex = COLUNAS_FLEXIVEIS.reduce((soma, id) => soma + preferidas[id], 0);
  const resto = disponivel - somaFixas;
  const resultado = { ...preferidas };
  const distribuir = (valores: number[]) => {
    let usado = 0;
    COLUNAS_FLEXIVEIS.forEach((id, indice) => {
      if (indice === COLUNAS_FLEXIVEIS.length - 1) {
        resultado[id] = resto - usado;
        return;
      }
      resultado[id] = valores[indice] ?? minimo(id);
      usado += resultado[id];
    });
  };
  if (resto >= somaFlex) {
    const extra = resto - somaFlex;
    const parte = Math.round(extra / COLUNAS_FLEXIVEIS.length);
    distribuir(COLUNAS_FLEXIVEIS.map((id, indice) => preferidas[id] + (indice === COLUNAS_FLEXIVEIS.length - 1 ? 0 : parte)));
    return resultado;
  }
  const somaMin = COLUNAS_FLEXIVEIS.reduce((soma, id) => soma + minimo(id), 0);
  if (resto <= somaMin) {
    for (const id of COLUNAS_FLEXIVEIS) resultado[id] = minimo(id);
    return resultado;
  }
  const folga = somaFlex - somaMin;
  const fator = (resto - somaMin) / folga;
  distribuir(
    COLUNAS_FLEXIVEIS.map((id) => Math.max(minimo(id), Math.round(minimo(id) + (preferidas[id] - minimo(id)) * fator)))
  );
  return resultado;
}

const COLUNAS_GRADE: GradeColunaConfiguravel[] = [
  { id: 'documento', label: 'Documento', largura: 148, larguraMinima: 112 },
  { id: 'datas', label: 'Datas', largura: 132, larguraMinima: 112 },
  { id: 'parceiro', label: 'Parceiro', largura: 280, larguraMinima: 140 },
  { id: 'criador', label: 'Criador', largura: 300, larguraMinima: 140 },
  { id: 'conferencia', label: 'Conferência', largura: 214, larguraMinima: 150 },
  { id: 'itens', label: 'Itens', align: 'right', largura: 108, larguraMinima: 96 },
];

const IDS_COLUNAS_GRADE = COLUNAS_GRADE.map((coluna) => coluna.id);

function labelConferenciaNota(nota: DoubleCheckInNota): string {
  if (regimeDaNota(nota) === 'nao_aplicada') return 'Não aplicada';
  if (nota.conferido && nota.conferidoComDivergencia) return 'Conferido c/ divergência';
  if (nota.conferido) return 'Conferido';
  return 'Pendente';
}

function textoCelulaGrade(nota: DoubleCheckInNota, coluna: string): string {
  if (coluna === 'documento') return (nota.numeroDocumentoFiscal ?? '').trim() || (nota.numeroNfe ?? '').trim() || '—';
  if (coluna === 'datas') return fmtDataBr(nota.dataEntrada);
  if (coluna === 'parceiro') return nota.nomeParceiro?.trim() || '—';
  if (coluna === 'criador') return nota.nomeCriador?.trim() || '—';
  if (coluna === 'conferencia') return labelConferenciaNota(nota);
  if (coluna === 'itens') return String(nota.qtdeItens ?? 0);
  return '';
}

function valoresFiltroGrade(nota: DoubleCheckInNota, coluna: string): string[] | null {
  if (coluna === 'documento') {
    const valores = [nota.numeroDocumentoFiscal, nota.numeroNfe]
      .map((valor) => valor?.trim() ?? '')
      .filter(Boolean);
    return valores.length > 0 ? [...new Set(valores)] : ['—'];
  }
  if (coluna === 'datas') {
    const valores = [`entrada ${fmtDataBr(nota.dataEntrada)}`];
    const emissao = fmtDataBr(nota.dataEmissao);
    if (emissao !== '—') valores.push(`emissão ${emissao}`);
    return valores;
  }
  return null;
}

function valorOrdenacaoGrade(nota: DoubleCheckInNota, coluna: string): string | number {
  if (coluna === 'datas') return String(nota.dataEntrada ?? '').slice(0, 10);
  if (coluna === 'itens') return Number(nota.qtdeItens ?? 0);
  if (coluna === 'documento') return (nota.numeroDocumentoFiscal ?? nota.numeroNfe ?? '').trim();
  return textoCelulaGrade(nota, coluna);
}

function resumoFiltroNotas(lista: DoubleCheckInNota[]) {
  let conferido = 0;
  let comDivergencia = 0;
  let pendente = 0;
  let naoAplicada = 0;
  for (const n of lista) {
    if (regimeDaNota(n) === 'nao_aplicada') {
      naoAplicada += 1;
      continue;
    }
    if (!n.conferido) {
      pendente += 1;
      continue;
    }
    if (n.conferidoComDivergencia) comDivergencia += 1;
    else conferido += 1;
  }
  return { total: lista.length, conferido, comDivergencia, pendente, naoAplicada };
}

export default function DoubleCheckInPage() {
  const { isMaster, hasPermission } = useAuth();
  const podeConfiguracoes = hasPermission(PERMISSOES.COMPRAS_DOUBLE_CHECKIN_CONFIGURACOES);
  const podeReabrirConferencia =
    hasPermission(PERMISSOES.DIVERGENCIAS_REABRIR_CONFERENCIA) ||
    hasPermission(PERMISSOES.COMPRAS_DOUBLE_CHECKIN);

  const [dataInicio, setDataInicio] = useState('2024-01-01');
  const [dataFim, setDataFim] = useState(hojeYmd());
  const [periodoAberto, setPeriodoAberto] = useState(false);
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState<FiltroSituacao>('todos');
  const [notas, setNotas] = useState<DoubleCheckInNota[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [limiarPct, setLimiarPct] = useState(10);
  const [alertaDesde, setAlertaDesde] = useState<string | null>(null);
  const [ultimaSync, setUltimaSync] = useState<string | null>(null);
  const [alertasEnviados, setAlertasEnviados] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_DEFAULT);

  const [modalNota, setModalNota] = useState<DoubleCheckInNota | null>(null);
  const [historicoNota, setHistoricoNota] = useState<DoubleCheckInNota | null>(null);
  const [modalTelaCheia, setModalTelaCheia] = useState(false);

  const [compLoading, setCompLoading] = useState(false);
  const [compErro, setCompErro] = useState<string | null>(null);
  const [compLinhas, setCompLinhas] = useState<DoubleCheckInComparativoLinha[]>([]);
  const [compDecisoes, setCompDecisoes] = useState<DoubleCheckInComparativoDecisao[]>([]);
  const [compJustificativas, setCompJustificativas] = useState<DoubleCheckInJustificativaOpcao[]>([]);
  const [compSolicitacoes, setCompSolicitacoes] = useState<DoubleCheckInSolicitacaoOtimiza[]>([]);
  const [compCriterios, setCompCriterios] = useState<CriteriosDivergenciaDoubleCheck>(
    CRITERIOS_DIVERGENCIA_PADRAO
  );
  const [compCamposLancados, setCompCamposLancados] = useState<DoubleCheckInCampoComparativo[]>([]);
  const [compSemVinculo, setCompSemVinculo] = useState(false);
  const [compBloqueioMsg, setCompBloqueioMsg] = useState<string | null>(null);
  const [reabrindoConferencia, setReabrindoConferencia] = useState(false);

  const [configAberto, setConfigAberto] = useState(false);
  const [paramAberto, setParamAberto] = useState(false);
  const [cadastrosAberto, setCadastrosAberto] = useState(false);
  const [divergAberto, setDivergAberto] = useState(false);
  const [criteriosDraft, setCriteriosDraft] = useState<CriteriosDivergenciaDoubleCheck>(
    CRITERIOS_DIVERGENCIA_PADRAO
  );
  const [criteriosSalvando, setCriteriosSalvando] = useState(false);
  const [criteriosErro, setCriteriosErro] = useState<string | null>(null);
  const [paramDraft, setParamDraft] = useState('10');
  const [paramSalvando, setParamSalvando] = useState(false);
  const [paramErro, setParamErro] = useState<string | null>(null);

  const [destAberto, setDestAberto] = useState(false);
  const [destUsuarios, setDestUsuarios] = useState<DoubleCheckInUsuarioDest[]>([]);
  const [destIds, setDestIds] = useState<number[]>([]);
  const [destLoading, setDestLoading] = useState(false);
  const [destSalvando, setDestSalvando] = useState(false);
  const [destErro, setDestErro] = useState<string | null>(null);
  const [destBusca, setDestBusca] = useState('');

  const [senhaAberto, setSenhaAberto] = useState(false);
  const [senhaDraft, setSenhaDraft] = useState('');
  const [senhaErro, setSenhaErro] = useState<string | null>(null);
  const [senhaSalvando, setSenhaSalvando] = useState(false);
  const [linkCopiadoId, setLinkCopiadoId] = useState<number | null>(null);
  const [linkManual, setLinkManual] = useState<string | null>(null);
  const [linkErro, setLinkErro] = useState<string | null>(null);

  const comparativoCacheRef = useRef(new Map<number, ComparativoCache>());
  const syncSeqRef = useRef(0);
  const periodoRef = useRef<HTMLDivElement>(null);
  const configRef = useRef<HTMLDivElement>(null);
  const appliedRef = useRef({ dataInicio: '2024-01-01', dataFim: hojeYmd() });

  const limparCachesGrade = useCallback(() => {
    comparativoCacheRef.current.clear();
  }, []);

  const carregarParametros = useCallback(async () => {
    const r = await fetchDoubleCheckInParametros();
    if (!r.erro) {
      setLimiarPct(r.limiarPct);
      if (r.alertaDesde) setAlertaDesde(r.alertaDesde);
    }
  }, []);

  const sincronizar = useCallback(
    async (opts?: { silencioso?: boolean }) => {
      const seq = ++syncSeqRef.current;
      const di = appliedRef.current.dataInicio;
      const df = appliedRef.current.dataFim;
      if (!opts?.silencioso) {
        setSyncing(true);
        setErro(null);
      }
      try {
        const r = await syncDoubleCheckIn({ dataInicio: di, dataFim: df });
        if (seq !== syncSeqRef.current) return;
        if (r.erro) {
          if (!opts?.silencioso) setErro(r.erro);
          return;
        }
        setNotas(r.notas);
        setLimiarPct(r.limiarPct);
        if (r.alertaDesde) setAlertaDesde(r.alertaDesde);
        setAlertasEnviados(r.alertasEnviados);
        setUltimaSync(new Date().toLocaleTimeString('pt-BR'));
        comparativoCacheRef.current.clear();
      } catch (e) {
        if (seq !== syncSeqRef.current) return;
        if (!opts?.silencioso) {
          setErro(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (seq === syncSeqRef.current && !opts?.silencioso) setSyncing(false);
      }
    },
    []
  );

  const filtrar = useCallback(async () => {
    appliedRef.current = { dataInicio, dataFim };
    limparCachesGrade();
    setPage(1);
    setLoading(true);
    setErro(null);
    try {
      await sincronizar();
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, sincronizar, limparCachesGrade]);

  useEffect(() => {
    void carregarParametros();
    void filtrar();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carga inicial
  }, []);

  useEffect(() => {
    if (!periodoAberto) return;
    const fecharFora = (event: MouseEvent) => {
      if (!periodoRef.current?.contains(event.target as Node)) setPeriodoAberto(false);
    };
    const fecharEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPeriodoAberto(false);
    };
    document.addEventListener('mousedown', fecharFora);
    document.addEventListener('keydown', fecharEscape);
    return () => {
      document.removeEventListener('mousedown', fecharFora);
      document.removeEventListener('keydown', fecharEscape);
    };
  }, [periodoAberto]);

  useEffect(() => {
    if (!configAberto) return;
    const fecharFora = (event: MouseEvent) => {
      if (!configRef.current?.contains(event.target as Node)) setConfigAberto(false);
    };
    const fecharEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setConfigAberto(false);
    };
    document.addEventListener('mousedown', fecharFora);
    document.addEventListener('keydown', fecharEscape);
    return () => {
      document.removeEventListener('mousedown', fecharFora);
      document.removeEventListener('keydown', fecharEscape);
    };
  }, [configAberto]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void sincronizar({ silencioso: true });
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [sincronizar]);

  const abrirDetalhe = useCallback((nota: DoubleCheckInNota) => {
    setModalNota(nota);
    setModalTelaCheia(false);
    setCompErro(null);
    setCompBloqueioMsg(null);
    comparativoCacheRef.current.delete(nota.idDocumento);
    setCompLinhas([]);
    setCompDecisoes([]);
    setCompSolicitacoes([]);
  }, []);

  const carregarComparativo = useCallback(async (idDocumento: number) => {
    const cached = comparativoCacheRef.current.get(idDocumento);
    if (cached) {
      setCompLinhas(cached.linhas);
      setCompDecisoes(cached.decisoes);
      setCompJustificativas(cached.justificativas);
      setCompSolicitacoes(cached.solicitacoesOtimiza ?? []);
      setCompCriterios(cached.criterios ?? CRITERIOS_DIVERGENCIA_PADRAO);
      setCompCamposLancados(cached.camposLancados ?? []);
      setCompSemVinculo(Boolean(cached.semVinculo));
      setCompErro(null);
      return;
    }
    setCompLoading(true);
    setCompErro(null);
    try {
      const r = await fetchDoubleCheckInComparativoPc(idDocumento);
      if (r.erro) {
        setCompErro(r.erro);
        setCompLinhas([]);
        setCompDecisoes([]);
        setCompSolicitacoes([]);
        setCompJustificativas(r.justificativas);
        setCompCriterios(r.criterios);
        setCompCamposLancados([]);
        setCompSemVinculo(Boolean(r.semVinculo));
        return;
      }
      const payload: ComparativoCache = {
        linhas: r.linhas,
        decisoes: r.decisoes,
        justificativas: r.justificativas,
        solicitacoesOtimiza: r.solicitacoesOtimiza,
        criterios: r.criterios,
        camposLancados: r.camposLancados,
        semVinculo: Boolean(r.semVinculo),
      };
      comparativoCacheRef.current.set(idDocumento, payload);
      setCompLinhas(payload.linhas);
      setCompDecisoes(payload.decisoes);
      setCompJustificativas(payload.justificativas);
      setCompSolicitacoes(payload.solicitacoesOtimiza);
      setCompCriterios(payload.criterios);
      setCompCamposLancados(payload.camposLancados);
      setCompSemVinculo(payload.semVinculo);
    } catch (e) {
      setCompErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCompLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!modalNota) return;
    void carregarComparativo(modalNota.idDocumento);
  }, [modalNota, carregarComparativo]);

  const reabrirConferencia = async () => {
    if (!modalNota || !podeReabrirConferencia || reabrindoConferencia) return;
    const confirmou = window.confirm(
      'Reabrir esta conferência? As decisões anteriores serão preservadas como histórico, mas todas as divergências atuais deverão ser aceitas ou recusadas novamente.'
    );
    if (!confirmou) return;
    setReabrindoConferencia(true);
    setCompBloqueioMsg(null);
    try {
      const r = await reabrirDoubleCheckIn(modalNota.idDocumento);
      if (r.erro || !r.ok) {
        setCompBloqueioMsg(r.erro ?? 'Não foi possível reabrir a conferência.');
        return;
      }
      const atualizar = (nota: DoubleCheckInNota): DoubleCheckInNota =>
        nota.idDocumento === modalNota.idDocumento
          ? {
              ...nota,
              conferido: false,
              conferenciaReaberta: true,
              conferidoComDivergencia: false,
            }
          : nota;
      comparativoCacheRef.current.delete(modalNota.idDocumento);
      setNotas((prev) => prev.map(atualizar));
      setModalNota((prev) => (prev ? atualizar(prev) : prev));
      setCompLinhas([]);
      setCompDecisoes([]);
      setCompSolicitacoes([]);
    } finally {
      setReabrindoConferencia(false);
    }
  };

  const notasFiltradas = (() => {
    const match = criarMatcherTextoLivre(filtroTexto);
    const inicio = dataInicio.slice(0, 10);
    const fim = dataFim.slice(0, 10);
    return notas.filter((n) => {
      const entrada = String(n.dataEntrada ?? '').slice(0, 10);
      if (!entrada || (inicio && entrada < inicio) || (fim && entrada > fim)) return false;
      const passaTexto =
        !filtroTexto.trim() ||
        match(n.numeroDocumentoFiscal ?? '') ||
        match(n.numeroNfe ?? '') ||
        match(n.nomeParceiro ?? '') ||
        match(n.nomeCriador ?? '') ||
        match(String(n.idParceiro ?? ''));
      if (!passaTexto) return false;
      if (filtroSituacao === 'pendentes') {
        return regimeDaNota(n) !== 'nao_aplicada' && !n.conferido;
      }
      if (filtroSituacao === 'conferidos') return Boolean(n.conferido);
      if (filtroSituacao === 'divergencia_real') {
        return Boolean(n.conferido && n.temDivergenciaRealAtual);
      }
      if (filtroSituacao === 'divergencia_benigna') {
        return Boolean(n.conferido && n.temDivergenciaBenignaAtual);
      }
      return true;
    });
  })();

  const colunasUi = useGradeColunasExcel('compras.double-checkin.colunas.v2', COLUNAS_GRADE);
  const [larguraDisponivel, setLarguraDisponivel] = useState(0);
  const redimensionandoRef = useRef(false);
  const grade = useGradeFiltrosExcel<DoubleCheckInNota>({
    rows: notasFiltradas,
    columnIds: IDS_COLUNAS_GRADE,
    getCellText: textoCelulaGrade,
    getCellFilterValues: valoresFiltroGrade,
    valueForSort: valorOrdenacaoGrade,
  });
  useEffect(() => {
    const el = grade.tableScrollRef.current;
    if (!el) return;
    const medir = () => {
      if (redimensionandoRef.current) return;
      setLarguraDisponivel(el.clientWidth);
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, [grade.tableScrollRef]);
  const largurasPreferidas = COLUNAS_GRADE.map((coluna) => colunasUi.largura(coluna.id)).join(',');
  const largurasExibidas = useMemo(() => {
    const preferidas = Object.fromEntries(
      COLUNAS_GRADE.map((coluna) => [coluna.id, colunasUi.largura(coluna.id)])
    );
    return ajustarLargurasGrade(preferidas, larguraDisponivel);
  }, [colunasUi, largurasPreferidas, larguraDisponivel]);
  const larguraTabela = COLUNAS_GRADE.reduce((soma, coluna) => soma + largurasExibidas[coluna.id], 0) + LARGURA_ACOES;
  const estiloColuna = (id: string) => {
    const px = largurasExibidas[id];
    return { width: px, minWidth: px, maxWidth: px };
  };
  const iniciarAjusteColuna = (id: string, evento: ReactMouseEvent) => {
    evento.preventDefault();
    evento.stopPropagation();
    const tabela = grade.tableScrollRef.current?.querySelector('table');
    if (!tabela) return;
    redimensionandoRef.current = true;
    const inicioX = evento.clientX;
    const base = { ...largurasExibidas };
    let ultimas = base;
    let quadro = 0;
    const minimo = (colunaId: string) =>
      COLUNAS_GRADE.find((coluna) => coluna.id === colunaId)?.larguraMinima ?? 64;
    const doadores = id === 'parceiro' ? ['criador'] : id === 'criador' ? ['parceiro'] : ['parceiro', 'criador'];
    const pintar = (widths: Record<string, number>) => {
      let total = LARGURA_ACOES;
      for (const coluna of COLUNAS_GRADE) {
        const px = widths[coluna.id];
        total += px;
        const pxTexto = `${px}px`;
        tabela.querySelectorAll<HTMLElement>(`[data-col="${coluna.id}"]`).forEach((el) => {
          el.style.width = pxTexto;
          el.style.minWidth = pxTexto;
          el.style.maxWidth = pxTexto;
        });
      }
      const disponivel = grade.tableScrollRef.current?.clientWidth ?? total;
      tabela.style.width = total > disponivel ? `${total}px` : '100%';
    };
    const onMove = (move: MouseEvent) => {
      const delta = Math.round(move.clientX - inicioX);
      const next = { ...base };
      const alvo = Math.max(minimo(id), base[id] + delta);
      let restante = alvo - base[id];
      next[id] = alvo;
      for (const doador of doadores) {
        if (restante === 0) break;
        if (restante > 0) {
          const cede = Math.min(next[doador] - minimo(doador), restante);
          next[doador] -= cede;
          restante -= cede;
        } else {
          next[doador] -= restante;
          restante = 0;
        }
      }
      ultimas = next;
      if (quadro) return;
      quadro = window.requestAnimationFrame(() => {
        quadro = 0;
        pintar(ultimas);
      });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (quadro) window.cancelAnimationFrame(quadro);
      pintar(ultimas);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      colunasUi.definirLarguras(ultimas);
      redimensionandoRef.current = false;
      const el = grade.tableScrollRef.current;
      if (el) setLarguraDisponivel(el.clientWidth);
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };
  const notasGrade = grade.rowsExibidas;
  const resumoFiltro = resumoFiltroNotas(notasGrade);
  const totalParaPaginacao = resumoFiltro.total;
  const totalPages = Math.max(1, Math.ceil(totalParaPaginacao / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const notasPagina =
    totalParaPaginacao === 0
      ? []
      : notasGrade.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  useEffect(() => {
    setPage(1);
  }, [filtroTexto, filtroSituacao, pageSize, dataInicio, dataFim, grade.columnFilters]);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const copiarLinkEvidencia = async (nota: DoubleCheckInNota) => {
    setLinkErro(null);
    setLinkManual(null);
    const r = await criarLinkEvidenciaDoubleCheck(nota);
    if (r.erro || !r.url) {
      setLinkErro(r.erro ?? 'Não foi possível gerar o link.');
      return;
    }
    try {
      await navigator.clipboard.writeText(r.url);
      setLinkCopiadoId(nota.idDocumento);
      window.setTimeout(() => setLinkCopiadoId((atual) => (atual === nota.idDocumento ? null : atual)), 2500);
    } catch {
      setLinkManual(r.url);
    }
  };

  const abrirParametros = () => {
    setConfigAberto(false);
    setParamDraft(String(limiarPct));
    setParamErro(null);
    setParamAberto(true);
  };

  const abrirDivergencias = async () => {
    setConfigAberto(false);
    setCriteriosErro(null);
    setDivergAberto(true);
    const r = await fetchDoubleCheckInCriterios();
    if (r.erro) {
      setCriteriosErro(r.erro);
      return;
    }
    setCriteriosDraft(r.criterios);
  };

  const salvarCriterios = async () => {
    setCriteriosSalvando(true);
    setCriteriosErro(null);
    try {
      const r = await saveDoubleCheckInCriterios(criteriosDraft);
      if (r.erro) {
        setCriteriosErro(r.erro);
        return;
      }
      setCriteriosDraft(r.criterios);
      comparativoCacheRef.current.clear();
      setDivergAberto(false);
      if (modalNota) void carregarComparativo(modalNota.idDocumento);
      void filtrar();
    } finally {
      setCriteriosSalvando(false);
    }
  };

  const salvarParametros = async () => {
    const n = Number(String(paramDraft).replace(',', '.'));
    setParamSalvando(true);
    setParamErro(null);
    try {
      const r = await saveDoubleCheckInParametros(n);
      if (r.erro) {
        setParamErro(r.erro);
        return;
      }
      setLimiarPct(r.limiarPct);
      limparCachesGrade();
      setParamAberto(false);
    } finally {
      setParamSalvando(false);
    }
  };

  const abrirDestinatarios = async () => {
    setDestAberto(true);
    setDestErro(null);
    setDestLoading(true);
    try {
      const r = await fetchDoubleCheckInDestinatarios();
      if (r.erro) {
        setDestErro(r.erro);
        return;
      }
      setDestUsuarios(r.usuarios);
      setDestIds(r.usuarioIds);
    } finally {
      setDestLoading(false);
    }
  };

  const salvarDestinatarios = async () => {
    setDestSalvando(true);
    setDestErro(null);
    try {
      const r = await saveDoubleCheckInDestinatarios({ usuarioIds: destIds });
      if (r.erro) {
        setDestErro(r.erro);
        return;
      }
      setDestAberto(false);
    } finally {
      setDestSalvando(false);
    }
  };

  const marcarNotaConferida = useCallback(
    (
      idDocumento: number,
      conferidoEm: string | null,
      conferidoPor: string | null,
      conferidoComDivergencia = false,
      temDivergenciaRealAtual = false,
      temDivergenciaBenignaAtual = false,
      temDivergenciaRealHistorica = false,
      totalDivergenciasReaisHistorica = 0
    ) => {
      setNotas((prev) =>
        prev.map((n) =>
          n.idDocumento === idDocumento
            ? {
                ...n,
                conferido: true,
                conferidoEm,
                conferidoPor,
                conferenciaReaberta: false,
                conferidoComDivergencia,
                temDivergenciaRealAtual,
                temDivergenciaBenignaAtual,
                temDivergenciaRealHistorica,
                totalDivergenciasReaisHistorica,
              }
            : n
        )
      );
      setModalNota((prev) =>
        prev && prev.idDocumento === idDocumento
          ? {
              ...prev,
              conferido: true,
              conferidoEm,
              conferidoPor,
              conferenciaReaberta: false,
              conferidoComDivergencia,
              temDivergenciaRealAtual,
              temDivergenciaBenignaAtual,
              temDivergenciaRealHistorica,
              totalDivergenciasReaisHistorica,
            }
          : prev
      );
    },
    []
  );

  const abrirSenhaConferir = async () => {
    if (!modalNota) return;
    setCompBloqueioMsg(null);
    setSenhaErro(null);
    const regimeConferencia = regimeDaNota(modalNota);
    if (regimeConferencia === 'nao_aplicada') {
      setCompBloqueioMsg('A conferência não se aplica a entradas até 18/09/2026.');
      return;
    }

    // Na conferência completa, garante o comparativo carregado antes de validar decisões.
    let linhas = compLinhas;
    let decisoes = compDecisoes;
    let semVinculoEspelho = compSemVinculo;
    const cached = comparativoCacheRef.current.get(modalNota.idDocumento);
    if (regimeConferencia === 'completa' && !cached) {
      setCompLoading(true);
      try {
        const r = await fetchDoubleCheckInComparativoPc(modalNota.idDocumento);
        if (r.erro) {
          setCompBloqueioMsg(r.erro);
          return;
        }
        const payload: ComparativoCache = {
          linhas: r.linhas,
          decisoes: r.decisoes,
          justificativas: r.justificativas,
          solicitacoesOtimiza: r.solicitacoesOtimiza,
          criterios: r.criterios,
          camposLancados: r.camposLancados,
          semVinculo: Boolean(r.semVinculo),
        };
        comparativoCacheRef.current.set(modalNota.idDocumento, payload);
        setCompLinhas(payload.linhas);
        setCompDecisoes(payload.decisoes);
        setCompJustificativas(payload.justificativas);
        setCompSolicitacoes(payload.solicitacoesOtimiza);
        setCompCriterios(payload.criterios);
        setCompCamposLancados(payload.camposLancados);
        setCompSemVinculo(payload.semVinculo);
        linhas = payload.linhas;
        decisoes = payload.decisoes;
        semVinculoEspelho = payload.semVinculo;
      } finally {
        setCompLoading(false);
      }
    } else if (regimeConferencia === 'completa' && cached) {
      linhas = cached.linhas;
      decisoes = cached.decisoes;
      semVinculoEspelho = Boolean(cached.semVinculo);
    }

    if (regimeConferencia === 'completa' && (linhas.length === 0 || semVinculoEspelho)) {
      setCompBloqueioMsg(
        'Não é possível conferir: nenhum item da nota está vinculado a um pedido de compra. Os cards exibidos são o espelho da primeira leitura.'
      );
      return;
    }

    if (regimeConferencia === 'completa' && linhas.some((l) => l.pagamentoXmlPendente)) {
      setCompBloqueioMsg(
        'A pré-entrada não tem fatura na NF. Informe se já foi paga ou lance a condição completa antes de conferir.'
      );
      return;
    }

    const pendentes =
      regimeConferencia === 'completa'
        ? contarPendentesComparativo(linhas, decisoes)
        : 0;
    if (regimeConferencia === 'completa' && pendentes > 0) {
      setCompBloqueioMsg(
        `Há ${pendentes} divergência(s) NF × PC sem decisão. Na divergência real, a solicitação no Otimiza precisa estar concluída. Na benigna, o número é opcional.`
      );
      return;
    }

    setSenhaDraft('');
    setSenhaAberto(true);
  };

  const confirmarConferencia = async () => {
    if (!modalNota) return;
    const senha = senhaDraft.trim();
    if (!senha) {
      setSenhaErro('Digite sua senha.');
      return;
    }
    setSenhaSalvando(true);
    setSenhaErro(null);
    try {
      const r = await conferirDoubleCheckIn({
        idDocumento: modalNota.idDocumento,
        senha,
        numeroNfe: modalNota.numeroNfe,
        numeroDocumentoFiscal: modalNota.numeroDocumentoFiscal,
        nomeParceiro: modalNota.nomeParceiro,
        reconferencia: Boolean(modalNota.conferenciaReaberta),
      });
      if (r.erro) {
        setSenhaErro(r.erro);
        if (/divergência|pedido de compra/i.test(r.erro)) {
          setSenhaAberto(false);
          setCompBloqueioMsg(r.erro);
        }
        return;
      }
      marcarNotaConferida(
        modalNota.idDocumento,
        r.conferidoEm ?? null,
        r.conferidoPor ?? null,
        Boolean(r.conferidoComDivergencia),
        Boolean(r.temDivergenciaRealAtual),
        Boolean(r.temDivergenciaBenignaAtual),
        Boolean(r.temDivergenciaRealHistorica),
        Number(r.totalDivergenciasReaisHistorica ?? 0)
      );
      setSenhaAberto(false);
      setSenhaDraft('');
    } finally {
      setSenhaSalvando(false);
    }
  };
  const destMatch = criarMatcherTextoLivre(destBusca);
  const destFiltrados = destUsuarios.filter(
    (u) =>
      !destBusca.trim() ||
      destMatch(u.login) ||
      destMatch(u.nome ?? '') ||
      destMatch(u.telefone ?? '')
  );

  return (
    <div className="relative min-w-0 space-y-4">
      <CarregandoInformacoesOverlay show={loading || syncing} mode="contained" />

      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Double Check NFe</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Conferência de entradas · limiar ±{limiarPct}%</p>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Atualiza a cada 2 min
          {ultimaSync ? ` · sync ${ultimaSync}` : ''}
          {alertaDesde ? ` · WhatsApp desde ${fmtDataBr(alertaDesde)}` : ''}
          {alertasEnviados != null && alertasEnviados > 0 ? ` · ${alertasEnviados} alerta(s)` : ''}
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div ref={periodoRef} className="relative">
            <label className={labelClass}>Período de entrada</label>
            <button
              type="button"
              className={`${inputClass} flex min-w-[16rem] items-center justify-between gap-3 text-left`}
              onClick={() => setPeriodoAberto((aberto) => !aberto)}
              aria-expanded={periodoAberto}
              aria-haspopup="dialog"
            >
              <span className="inline-flex items-center gap-2">
                <CalendarRange className="h-4 w-4 text-slate-500" aria-hidden />
                {fmtDataBr(dataInicio)} — {fmtDataBr(dataFim)}
              </span>
              <ChevronDown
                className={`h-4 w-4 text-slate-400 transition-transform ${periodoAberto ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </button>
            {periodoAberto ? (
              <div
                className="absolute left-0 top-full z-30 mt-2 w-[min(23rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900"
                role="dialog"
                aria-label="Selecionar período de entrada"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Data início</label>
                    <input
                      type="date"
                      className={`${inputClass} w-full`}
                      value={dataInicio}
                      max={dataFim || undefined}
                      onChange={(e) => setDataInicio(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Data fim</label>
                    <input
                      type="date"
                      className={`${inputClass} w-full`}
                      value={dataFim}
                      min={dataInicio || undefined}
                      onChange={(e) => setDataFim(e.target.value)}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className={`${btnPrimary} mt-3 w-full justify-center`}
                  onClick={() => {
                    setPeriodoAberto(false);
                    void filtrar();
                  }}
                >
                  Aplicar período
                </button>
              </div>
            ) : null}
          </div>
          <div className="w-full sm:w-64">
            <label className={labelClass}>Documento ou fornecedor</label>
            <input
              className={`${inputClass} w-full`}
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              placeholder="Número, fornecedor ou criador; use %"
            />
          </div>
          <div className="w-full sm:w-60">
            <label className={labelClass}>Situação</label>
            <select
              className={`${inputClass} w-full`}
              value={filtroSituacao}
              onChange={(e) => setFiltroSituacao(e.target.value as FiltroSituacao)}
            >
              <option value="todos">Todos</option>
              <option value="pendentes">Pendentes</option>
              <option value="conferidos">Conferidos</option>
              <option value="divergencia_real">Possuem divergência real</option>
              <option value="divergencia_benigna">Possuem divergência benigna</option>
            </select>
          </div>
          <button
            type="button"
            className={btnPrimary}
            onClick={() => {
              setPeriodoAberto(false);
              void filtrar();
            }}
            disabled={loading || syncing}
          >
            Filtrar
          </button>
          <button
            type="button"
            className={btnSecondary}
            onClick={() => void sincronizar()}
            disabled={loading || syncing}
            title="Sincronizar agora"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            Sincronizar
          </button>
          {podeConfiguracoes && (
            <div ref={configRef} className="relative">
              <button
                type="button"
                className={btnSecondary}
                aria-expanded={configAberto}
                aria-haspopup="menu"
                onClick={() => setConfigAberto((aberto) => !aberto)}
              >
                <Settings2 className="h-4 w-4" />
                Configurações
                <ChevronDown className={`h-4 w-4 transition-transform ${configAberto ? 'rotate-180' : ''}`} />
              </button>
              {configAberto ? (
                <div
                  role="menu"
                  className="absolute right-0 z-30 mt-1 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800"
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-700"
                    onClick={abrirParametros}
                  >
                    <Settings2 className="h-4 w-4" />
                    Parâmetros
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-700"
                    onClick={() => {
                      setConfigAberto(false);
                      void abrirDestinatarios();
                    }}
                  >
                    <Users className="h-4 w-4" />
                    Destinatários
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-700"
                    onClick={() => {
                      setConfigAberto(false);
                      setCadastrosAberto(true);
                    }}
                  >
                    <Library className="h-4 w-4" />
                    Cadastros
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-700"
                    onClick={() => void abrirDivergencias()}
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    Divergências
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
        {erro && (
          <p className="mt-3 text-sm text-rose-600 dark:text-rose-400" role="alert">
            {erro}
          </p>
        )}
      </div>

      <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/40">
        {notas.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-100 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {resumoFiltro.total.toLocaleString('pt-BR')}{' '}
              {resumoFiltro.total === 1 ? 'documento' : 'documentos'}
            </span>
            <span>
              Conferidos{' '}
              <span className="font-medium text-emerald-700 dark:text-emerald-300">
                {resumoFiltro.conferido.toLocaleString('pt-BR')}
              </span>
            </span>
            <span>
              Com divergência{' '}
              <span className="font-medium text-yellow-700 dark:text-yellow-300">
                {resumoFiltro.comDivergencia.toLocaleString('pt-BR')}
              </span>
            </span>
            <span>
              Pendentes{' '}
              <span className="font-medium text-amber-700 dark:text-amber-300">
                {resumoFiltro.pendente.toLocaleString('pt-BR')}
              </span>
            </span>
            <span>
              Não aplicadas{' '}
              <span className="font-medium text-slate-600 dark:text-slate-300">
                {resumoFiltro.naoAplicada.toLocaleString('pt-BR')}
              </span>
            </span>
          </div>
        )}
        <div ref={grade.tableScrollRef} className="w-full min-w-0 overflow-x-auto">
        <table
          className="table-fixed border-separate border-spacing-0 text-sm"
          style={{ width: larguraDisponivel > 0 && larguraTabela > larguraDisponivel ? larguraTabela : '100%' }}
        >
          <colgroup>
            {colunasUi.colunasVisiveis.map((coluna) => (
              <col key={coluna.id} data-col={coluna.id} style={estiloColuna(coluna.id)} />
            ))}
            <col style={{ width: LARGURA_ACOES }} />
          </colgroup>
          <thead className="bg-[#f3f4f6] text-left text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:bg-[#141414] dark:text-slate-400">
            <tr>
              {colunasUi.colunasVisiveis.map((coluna) => {
                const sortAtivo =
                  grade.sortState?.key === coluna.id || grade.sortLevels.some((nivel) => nivel.id === coluna.id);
                const direita = coluna.align === 'right';
                return (
                  <th
                    key={coluna.id}
                    data-col={coluna.id}
                    className={`relative px-2.5 py-3 font-medium ${direita ? 'text-right' : ''}`}
                    style={estiloColuna(coluna.id)}
                  >
                    <div className={`flex min-w-0 items-center gap-1.5 ${direita ? 'justify-end' : 'justify-between'}`}>
                      <span className="min-w-0 truncate">{coluna.label}</span>
                      <GradeFiltroCabecalhoBtn
                        ativo={grade.colunaComFiltroAtivo(coluna.id) || sortAtivo}
                        onClick={(e) => grade.abrirFiltroExcel(coluna.id, e)}
                      />
                    </div>
                    <button
                      type="button"
                      aria-label={`Redimensionar coluna ${coluna.label}`}
                      title="Arraste para ajustar a largura"
                      onMouseDown={(evento) => iniciarAjusteColuna(coluna.id, evento)}
                      onClick={(evento) => evento.stopPropagation()}
                      className="absolute inset-y-0 right-0 z-10 w-1.5 cursor-col-resize touch-none select-none hover:bg-sky-300/70"
                    />
                  </th>
                );
              })}
              <th className="px-4 py-3 font-medium text-right" style={{ width: LARGURA_ACOES }}>
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {notasPagina.length === 0 ? (
              <tr>
                <td colSpan={7} className="bg-white px-4 py-10 text-center text-slate-500 dark:bg-transparent">
                  {notasFiltradas.length === 0
                    ? 'Nenhuma entrada no período.'
                    : 'Nenhum documento com os filtros da grade.'}
                </td>
              </tr>
            ) : (
              notasPagina.map((n, indice) => {
                const regimeConferencia = regimeDaNota(n);
                const conferido = Boolean(n.conferido);
                const conferidoComDivergencia = conferido && Boolean(n.conferidoComDivergencia);
                const temRealAtual = conferido && Boolean(n.temDivergenciaRealAtual);
                const faixa =
                  indice % 2 === 0
                    ? 'bg-white dark:bg-black'
                    : 'bg-[#f7f7f8] dark:bg-[#2a2a2a]';
                const acaoClass =
                  'rounded-md p-1.5 text-slate-400 hover:bg-black/5 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-100';
                return (
                  <tr key={n.idDocumento} className={`${faixa} hover:bg-[#ececee] dark:hover:bg-[#3a3a3a]`}>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium tabular-nums text-slate-800 dark:text-slate-100">
                          {n.numeroDocumentoFiscal ?? '—'}
                        </span>
                        {temRealAtual ? (
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500"
                            title="Possui divergência real no estado atual do Nomus"
                            aria-label="Possui divergência real atual"
                          />
                        ) : null}
                      </div>
                      <div className="text-xs tabular-nums text-slate-400">NF-e {n.numeroNfe ?? '—'}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <div className="tabular-nums text-slate-700 dark:text-slate-200">{fmtDataBr(n.dataEntrada)}</div>
                      <div className="text-xs text-slate-400">emissão {fmtDataBr(n.dataEmissao)}</div>
                    </td>
                    <td className="overflow-hidden px-4 py-3.5">
                      <div className="truncate text-slate-700 dark:text-slate-200" title={n.nomeParceiro ?? undefined}>
                        {n.nomeParceiro ?? '—'}
                      </div>
                      <div className="text-xs tabular-nums text-slate-400">{n.idParceiro ?? '—'}</div>
                    </td>
                    <td className="overflow-hidden px-4 py-3.5 text-slate-600 dark:text-slate-300" title={n.nomeCriador ?? undefined}>
                      <div className="truncate">{n.nomeCriador ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      {regimeConferencia === 'nao_aplicada' ? (
                        <span className="inline-flex items-center rounded-md border-2 border-slate-300 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          Não aplicada
                        </span>
                      ) : conferidoComDivergencia ? (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-md border-2 border-yellow-400 bg-yellow-50 px-2 py-1 text-xs font-semibold text-yellow-900 dark:border-yellow-500 dark:bg-yellow-950/40 dark:text-yellow-100"
                          title={
                            n.conferidoPor
                              ? `NF ainda diverge do pedido. Conferido por ${n.conferidoPor}${n.conferidoEm ? ` em ${new Date(n.conferidoEm).toLocaleString('pt-BR')}` : ''}`
                              : 'NF ainda diverge do pedido de compra'
                          }
                        >
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span className="leading-tight">Conferido c/ divergência</span>
                        </span>
                      ) : conferido ? (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-md border-2 border-emerald-500 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-200"
                          title={
                            n.conferidoPor
                              ? `Conferido por ${n.conferidoPor}${n.conferidoEm ? ` em ${new Date(n.conferidoEm).toLocaleString('pt-BR')}` : ''}`
                              : 'Conferido'
                          }
                        >
                          <ClipboardCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          Conferido
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-md border-2 border-amber-400 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-200">
                          Pendente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-slate-700 dark:text-slate-200">{n.qtdeItens}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        {isMaster && (
                          <button type="button" className={acaoClass} title="Histórico do documento" onClick={() => setHistoricoNota(n)}>
                            <History className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          className={acaoClass}
                          title={linkCopiadoId === n.idDocumento ? 'Link copiado' : 'Copiar link da evidência'}
                          onClick={() => void copiarLinkEvidencia(n)}
                        >
                          <Link2 className="h-4 w-4" />
                        </button>
                        <button type="button" className={acaoClass} title="Ver itens" onClick={() => void abrirDetalhe(n)}>
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
        {grade.colunaFiltroAberta && grade.filtroAbertoRect ? (
          <GradeFiltroExcelPortal
            colunaAberta={grade.colunaFiltroAberta}
            rect={grade.filtroAbertoRect}
            dropdownRef={grade.filtroDropdownRef}
            excelFilterDrafts={grade.excelFilterDrafts}
            setExcelFilterDrafts={grade.setExcelFilterDrafts}
            valoresUnicosPorColuna={grade.valoresUnicosPorColuna}
            showNumericFilters={grade.colunaFiltroAberta === 'itens'}
            sortAscLabel={
              grade.colunaFiltroAberta === 'datas'
                ? 'Mais antiga primeiro'
                : grade.colunaFiltroAberta === 'itens'
                  ? 'Menor para maior'
                  : undefined
            }
            sortDescLabel={
              grade.colunaFiltroAberta === 'datas'
                ? 'Mais recente primeiro'
                : grade.colunaFiltroAberta === 'itens'
                  ? 'Maior para menor'
                  : undefined
            }
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
        ) : null}
      </div>

      {totalParaPaginacao > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
          <span>
            Exibindo {(pageSafe - 1) * pageSize + 1}–{Math.min(pageSafe * pageSize, totalParaPaginacao)} de{' '}
            {totalParaPaginacao.toLocaleString('pt-BR')} no filtro
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <span className="whitespace-nowrap">Por página</span>
              <select
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-slate-700 dark:text-slate-200"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                aria-label="Registros por página"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pageSafe <= 1 || loading || syncing}
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span className="text-slate-500 dark:text-slate-400">
              Página {pageSafe} de {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={pageSafe >= totalPages || loading || syncing}
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      {/* Modal itens */}
      {modalNota &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className={`fixed inset-0 z-[10050] flex bg-slate-900/55 backdrop-blur-[1px] ${
              modalTelaCheia ? 'items-stretch justify-stretch p-0' : 'items-center justify-center p-4'
            }`}
            role="dialog"
            aria-modal="true"
            onClick={() => {
              setModalTelaCheia(false);
              setModalNota(null);
            }}
          >
            <div
              className={`flex flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800 ${
                modalTelaCheia
                  ? 'h-full max-h-none w-full max-w-none rounded-none'
                  : 'max-h-[90vh] w-full max-w-6xl rounded-2xl'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-600">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Itens da entrada
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Doc {modalNota.numeroDocumentoFiscal ?? '—'} · NF-e {modalNota.numeroNfe ?? '—'} ·
                    Entrada {fmtDataBr(modalNota.dataEntrada)} · Emissão {fmtDataBr(modalNota.dataEmissao)} ·{' '}
                    {modalNota.nomeParceiro ?? '—'}
                  </p>
                  <div className="mt-2 inline-flex min-w-[16rem] max-w-full flex-col gap-0.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Conferido por
                    </span>
                    <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-800 dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-100">
                      {textoQuemConferiu(modalNota)}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    className={btnSecondary}
                    title={modalTelaCheia ? 'Sair da tela cheia' : 'Exibir em tela cheia'}
                    aria-label={modalTelaCheia ? 'Sair da tela cheia' : 'Exibir em tela cheia'}
                    onClick={() => setModalTelaCheia((v) => !v)}
                  >
                    {modalTelaCheia ? (
                      <Minimize2 className="h-4 w-4" aria-hidden />
                    ) : (
                      <Maximize2 className="h-4 w-4" aria-hidden />
                    )}
                    {modalTelaCheia ? 'Sair' : 'Tela cheia'}
                  </button>
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() => void copiarLinkEvidencia(modalNota)}
                  >
                    <Link2 className="h-4 w-4" />
                    {linkCopiadoId === modalNota.idDocumento ? 'Link copiado' : 'Copiar link'}
                  </button>
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() => {
                      setModalTelaCheia(false);
                      setModalNota(null);
                    }}
                  >
                    Fechar
                  </button>
                </div>
              </div>
              <div className="relative min-h-[12rem] flex-1 overflow-auto p-4">
                <CarregandoInformacoesOverlay show={compLoading} mode="contained" />
                {compBloqueioMsg && (
                  <p className="mb-3 text-sm text-rose-600" role="alert">
                    {compBloqueioMsg}
                  </p>
                )}
                <div className="space-y-3">
                    {regimeDaNota(modalNota) === 'simples' ? (
                      <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
                        Entrada de 19/09 a 20/09/2026: comparativo somente para consulta.
                        Não é necessário aceitar ou recusar divergências.
                      </p>
                    ) : null}
                    {compSemVinculo ? (
                      <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                        Este documento está sem vínculo com pedido de compra no Nomus. Os cards abaixo são o
                        espelho da primeira leitura. Role para ver as demais divergências.
                      </p>
                    ) : null}
                    <DoubleCheckInComparativoPcTab
                      idDocumento={modalNota.idDocumento}
                      conferido={Boolean(modalNota.conferido)}
                      somenteLeitura={regimeDaNota(modalNota) !== 'completa' || compSemVinculo}
                      linhas={compLinhas}
                      decisoes={compDecisoes}
                      justificativas={compJustificativas}
                      solicitacoesOtimiza={compSolicitacoes}
                      criterios={compCriterios}
                      camposLancados={compCamposLancados}
                      loading={compLoading}
                      erro={compErro}
                      onSolicitacoesChange={(next) => {
                        setCompSolicitacoes(next);
                        const prev = comparativoCacheRef.current.get(modalNota.idDocumento);
                        if (prev) {
                          comparativoCacheRef.current.set(modalNota.idDocumento, {
                            ...prev,
                            solicitacoesOtimiza: next,
                          });
                        }
                      }}
                      onDecisoesChange={(next) => {
                        setCompDecisoes(next);
                        setCompBloqueioMsg(null);
                        const prev = comparativoCacheRef.current.get(modalNota.idDocumento);
                        if (prev) {
                          comparativoCacheRef.current.set(modalNota.idDocumento, {
                            ...prev,
                            decisoes: next,
                          });
                        }
                      }}
                      onLinhasChange={(next) => {
                        setCompLinhas(next);
                        setCompBloqueioMsg(null);
                        const prev = comparativoCacheRef.current.get(modalNota.idDocumento);
                        if (prev) {
                          comparativoCacheRef.current.set(modalNota.idDocumento, {
                            ...prev,
                            linhas: next,
                          });
                        }
                      }}
                    />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-600 dark:bg-slate-900/40">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {regimeDaNota(modalNota) === 'nao_aplicada' ? (
                    <span>
                      Conferência não aplicada para entradas até 18/09/2026.
                    </span>
                  ) : modalNota.conferido ? (
                    <span>
                      Conferida
                      {modalNota.conferidoPor ? ` por ${modalNota.conferidoPor}` : ''}
                      {modalNota.conferidoEm
                        ? ` em ${new Date(modalNota.conferidoEm).toLocaleString('pt-BR')}`
                        : ''}
                      .
                    </span>
                  ) : regimeDaNota(modalNota) === 'completa' && !compLoading && compSemVinculo ? (
                    <span>
                      Sem vínculo com pedido de compra. A tela mantém o espelho da primeira leitura para
                      consulta e impressão. A conferência fica disponível quando o documento for vinculado de novo.
                    </span>
                  ) : regimeDaNota(modalNota) === 'completa' &&
                    !compLoading &&
                    comparativoCacheRef.current.get(modalNota.idDocumento)?.linhas.length === 0 ? (
                    <span>
                      Não é possível conferir: nenhum item da nota está vinculado a um pedido de compra.
                    </span>
                  ) : modalNota.conferenciaReaberta ? (
                    <span>
                      {compDecisoes.some((decisao) => decisao.vigente === false)
                        ? 'Conferência reaberta. Revise e decida novamente todas as divergências antes de confirmar.'
                        : 'Nova divergência detectada após a conferência. Decida a pendência e confirme novamente.'}
                    </span>
                  ) : (
                    <span>
                      {regimeDaNota(modalNota) === 'simples'
                        ? 'Confira o comparativo e confirme com sua senha. Não há aceite ou recusa neste período.'
                        : 'Confirme com sua senha. Divergências NF × PC precisam de decisão antes de conferir.'}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {modalNota.conferido &&
                  regimeDaNota(modalNota) === 'completa' &&
                  podeReabrirConferencia ? (
                    <button
                      type="button"
                      className={btnSecondary}
                      disabled={reabrindoConferencia || compLoading}
                      onClick={() => void reabrirConferencia()}
                    >
                      <RotateCcw
                        className={`h-4 w-4 ${reabrindoConferencia ? 'animate-spin' : ''}`}
                      />
                      Reabrir conferência
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={
                      Boolean(modalNota.conferido) ||
                      regimeDaNota(modalNota) === 'nao_aplicada' ||
                      compLoading ||
                      compLinhas.some((l) => l.pagamentoXmlPendente) ||
                      (regimeDaNota(modalNota) === 'completa' &&
                        (compSemVinculo ||
                          comparativoCacheRef.current.get(modalNota.idDocumento)?.linhas.length === 0))
                    }
                    onClick={() => void abrirSenhaConferir()}
                  >
                    <ClipboardCheck className="h-4 w-4" />
                    {regimeDaNota(modalNota) === 'nao_aplicada'
                      ? 'Não aplicada'
                      : modalNota.conferido
                        ? 'Já conferida'
                        : 'Confirmar conferência'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Modal senha conferência */}
      {senhaAberto &&
        modalNota &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[10060] flex items-center justify-center p-4 bg-slate-900/55"
            role="dialog"
            aria-modal="true"
            onClick={() => !senhaSalvando && setSenhaAberto(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Confirmar conferência
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Digite sua senha para marcar a NF{' '}
                <strong>{modalNota.numeroNfe ?? modalNota.numeroDocumentoFiscal ?? modalNota.idDocumento}</strong>{' '}
                como conferida.
              </p>
              <div className="mt-4">
                <label className={labelClass}>Senha</label>
                <input
                  type="password"
                  className={inputClass}
                  value={senhaDraft}
                  onChange={(e) => setSenhaDraft(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void confirmarConferencia();
                  }}
                />
              </div>
              {senhaErro && <p className="mt-2 text-sm text-rose-600">{senhaErro}</p>}
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={senhaSalvando}
                  onClick={() => setSenhaAberto(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={senhaSalvando || !senhaDraft.trim()}
                  onClick={() => void confirmarConferencia()}
                >
                  {senhaSalvando ? 'Confirmando…' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {historicoNota && (
        <DoubleCheckInHistoricoModal nota={historicoNota} onClose={() => setHistoricoNota(null)} />
      )}
      {(linkErro || linkManual) &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed bottom-4 left-1/2 z-[10080] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-600 dark:bg-slate-800">
            {linkErro ? <p className="text-sm text-rose-600">{linkErro}</p> : null}
            {linkManual ? (
              <>
                <p className="mb-1 text-xs text-slate-500">Copie o link da evidência:</p>
                <input
                  className={`${inputClass} w-full`}
                  readOnly
                  value={linkManual}
                  onFocus={(e) => e.target.select()}
                />
              </>
            ) : null}
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => {
                  setLinkErro(null);
                  setLinkManual(null);
                }}
              >
                Fechar
              </button>
            </div>
          </div>,
          document.body
        )}
      {cadastrosAberto && <DoubleCheckInJustificativasModal onClose={() => setCadastrosAberto(false)} />}

      {divergAberto &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[10055] flex items-center justify-center p-4 bg-slate-900/55"
            role="dialog"
            aria-modal="true"
            onClick={() => !criteriosSalvando && setDivergAberto(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Critérios de divergência
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                O que já foi lançado permanece no documento. Nos documentos novos, o critério inativo
                deixa de aparecer.
              </p>
              <ul className="mt-4 space-y-2">
                {CRITERIOS_OPCOES.map((opcao) => {
                  const ativo = criteriosDraft[opcao.id] !== false;
                  return (
                    <li key={opcao.id}>
                      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600">
                        <span className="text-sm text-slate-800 dark:text-slate-100">{opcao.label}</span>
                        <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
                          {ativo ? 'Ativo' : 'Inativo'}
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={ativo}
                            onChange={(e) =>
                              setCriteriosDraft((atual) => ({
                                ...atual,
                                [opcao.id]: e.target.checked,
                              }))
                            }
                          />
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {criteriosErro && <p className="mt-2 text-sm text-rose-600">{criteriosErro}</p>}
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={criteriosSalvando}
                  onClick={() => setDivergAberto(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={criteriosSalvando}
                  onClick={() => void salvarCriterios()}
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Modal parâmetros */}
      {paramAberto &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[10055] flex items-center justify-center p-4 bg-slate-900/55"
            role="dialog"
            aria-modal="true"
            onClick={() => setParamAberto(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Parâmetros Double Check NFe
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Limiar absoluto de variação de preço (±%). Itens com |variação| acima deste valor são
                destacados. WhatsApp só dispara para NF com emissão
                {alertaDesde ? ` a partir de ${fmtDataBr(alertaDesde)}` : ' a partir do go-live'} —
                histórico anterior é ignorado no alerta (evita bloqueio do número).
              </p>
              <div className="mt-4">
                <label className={labelClass}>Limiar (%)</label>
                <input
                  className={inputClass}
                  value={paramDraft}
                  onChange={(e) => setParamDraft(e.target.value)}
                  inputMode="decimal"
                />
              </div>
              {paramErro && <p className="mt-2 text-sm text-rose-600">{paramErro}</p>}
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" className={btnSecondary} onClick={() => setParamAberto(false)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={paramSalvando}
                  onClick={() => void salvarParametros()}
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Modal destinatários */}
      {destAberto &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[10055] flex items-center justify-center p-4 bg-slate-900/55"
            role="dialog"
            aria-modal="true"
            onClick={() => setDestAberto(false)}
          >
            <div
              className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-600">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Destinatários WhatsApp
                </h3>
                <p className="text-sm text-slate-500">
                  Usuários que receberão alerta quando uma NF (emissão a partir do go-live) tiver item
                  fora do limiar. Requer telefone cadastrado.
                </p>
                <input
                  className={`${inputClass} mt-3 w-full`}
                  value={destBusca}
                  onChange={(e) => setDestBusca(e.target.value)}
                  placeholder={PLACEHOLDER_BUSCA_TEXTO_LIVRE}
                />
              </div>
              <div className="relative min-h-[10rem] flex-1 overflow-auto px-5 py-3">
                <CarregandoInformacoesOverlay show={destLoading} mode="contained" />
                {destErro && <p className="mb-2 text-sm text-rose-600">{destErro}</p>}
                <ul className="space-y-1">
                  {destFiltrados.map((u) => {
                    const checked = destIds.includes(u.id);
                    const semTel = !u.telefone?.trim();
                    return (
                      <li key={u.id}>
                        <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={checked}
                            disabled={semTel}
                            onChange={() => {
                              setDestIds((prev) =>
                                checked ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                              );
                            }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
                              {u.nome || u.login}
                            </span>
                            <span className="block text-xs text-slate-500">
                              {u.login}
                              {semTel ? ' · sem telefone' : ` · ${u.telefone}`}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-600">
                <button type="button" className={btnSecondary} onClick={() => setDestAberto(false)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={destSalvando || destLoading}
                  onClick={() => void salvarDestinatarios()}
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
