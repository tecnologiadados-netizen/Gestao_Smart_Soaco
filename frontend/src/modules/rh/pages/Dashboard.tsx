import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import AppLayout from "@rh/components/AppLayout";
import KpiCard from "@rh/components/KpiCard";
import {
  Users,
  DollarSign,
  TrendingDown,
  Clock,
  Wallet,
  Building2,
  AlertTriangle,
  ArrowUpRight,
  X,
} from "lucide-react";
import {
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  ComposedChart,
  Cell,
  LabelList,
} from "recharts";
import { Button } from "@rh/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@rh/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@rh/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@rh/components/ui/tabs";
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipTrigger,
} from "@rh/components/ui/tooltip";
import {
  getOrganico,
  getOrganicoFotosResumo,
  getOrganicoSalariosTrajetoria,
  getSecullumFuncionarios,
  isApiConfigured,
  normalizeMatriculaFolha,
} from "@rh/lib/api-client";
import {
  canEditDashboardModule,
  canViewDashboardModule,
  canViewOrganicoPhotos,
} from "@rh/lib/route-permissions";
import {
  buildDashboardFromOrganico,
  deriveTurnoverFromPeople,
  listNovasAdmissoesMesAtual,
  listTurnoverPeopleFromOrganico,
  type FolhaMensalPoint,
  type TurnoverSeriesPoint,
} from "@rh/lib/dashboard-from-organico";
import {
  chaveMatricula,
  colaboradorAtivoNaData,
  DASHBOARD_EMPRESA_TODAS,
  dataDentroDoPeriodo,
  fimDoDia,
  formatDiaMmmAno,
  indexarSalariosTrajetoria,
  inicioDoDia,
  parseIsoLocal,
  periodoPadraoExecutivo,
  salarioVigenteDaMatricula,
  toIsoLocal,
  type DashboardPeriodo,
} from "@rh/lib/dashboard-periodo";
import {
  ORGANICO_EMPRESA_SO_ACO,
  resolveEmpresaFromOrganicoCells,
  resolveEmpresaTabFromSecullumFuncionario,
} from "@rh/lib/organico-empresa";
import {
  rhOrganicoFocusPath,
  type RhDashboardNavigationState,
  type RhDashboardReturnFilters,
  type RhOrganicoNavigationState,
} from "@rh/lib/rh-paths";
import { DashboardExecutivoFiltros, DashboardPeriodoDatas } from "@rh/pages/DashboardExecutivoFiltros";
import { DistribuicaoGeneroCard, type GeneroFiltro } from "@rh/pages/DistribuicaoGeneroCard";
import AbsenteismoDashboard, {
  type AbsenteismoFavoritoSnapshot,
} from "@rh/pages/AbsenteismoDashboard";
import DiagnosticoGeralAusenciasJustificadas from "@rh/pages/DiagnosticoGeralAusenciasJustificadas";
import AbsenteismoPorHorasTab from "@rh/pages/FaltasAtestados/absenteismo-por-horas/AbsenteismoPorHorasTab";
import { OrganicoCard } from "@rh/pages/Organico/OrganicoCard";
import { isOrganicoHistoricoLocal, ORGANICO_IDX, parseDateBR } from "@rh/pages/Organico/organico-derive";
import {
  rhChartAxisTick,
  rhChartCategoryTick,
  rhChartTooltipStyle,
  useRhChartTheme,
} from "@rh/lib/chart-theme";
import { useFavoritoPagina } from "../../../hooks/useFavoritoPagina";
import { resumoFiltrosFavorito } from "../../../config/telasFavoritaveis";

const MESES_LABEL = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"] as const;

function correspondeAoGenero(sexo: unknown, filtro: GeneroFiltro) {
  if (!filtro) return true;
  const valor = String(sexo ?? "").normalize("NFD").replace(/\p{M}/gu, "").trim().toUpperCase();
  if (filtro === "masculino") return valor === "M" || valor.startsWith("MASC");
  return valor === "F" || valor.startsWith("FEM");
}

type TurnoverPointPayload = Pick<TurnoverSeriesPoint, "year" | "month">;

function formatTurnoverTooltipMediaAtivos(n: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(n);
}

function TurnoverEvolutionTooltip(props: {
  active?: boolean;
  payload?: Array<{ payload?: TurnoverSeriesPoint }>;
  label?: string;
}) {
  const { active, payload, label } = props;
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const period =
    typeof row.year === "number" && row.month
      ? `${row.month}/${String(row.year).slice(-2)}`
      : String(label ?? "");

  return (
    <div
      className="rounded-sm border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md max-w-[240px]"
      style={{ fontSize: 12 }}
    >
      <p className="font-semibold text-foreground border-b border-border pb-1.5 mb-2">{period}</p>
      <p className="text-foreground">
        <span className="text-muted-foreground">Turnover: </span>
        <span className="font-bold tabular-nums">{row.value}%</span>
      </p>
      <p className="text-[10px] text-muted-foreground mt-2 mb-1.5 uppercase tracking-wide">
        Memorial de cálculo (usado no percentual acima)
      </p>
      <ul className="space-y-0.5 text-[11px] leading-snug tabular-nums">
        <li>
          <span className="text-muted-foreground">Admissões: </span>
          <span className="font-medium text-foreground">{row.admissoesMes}</span>
        </li>
        <li>
          <span className="text-muted-foreground">Desligamentos: </span>
          <span className="font-medium text-foreground">{row.demissoesMes}</span>
        </li>
        <li>
          <span className="text-muted-foreground">Média de ativos: </span>
          <span className="font-medium text-foreground">{formatTurnoverTooltipMediaAtivos(row.mediaAtivos)}</span>
        </li>
      </ul>
    </div>
  );
}

function FolhaMensalTooltip(props: {
  active?: boolean;
  payload?: Array<{ payload?: FolhaMensalPoint }>;
}) {
  const { active, payload } = props;
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-sm border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="font-semibold text-foreground border-b border-border pb-1.5 mb-2">
        {row.month}/{String(row.year).slice(-2)}
      </p>
      <p className="text-foreground">
        <span className="text-muted-foreground">Folha: </span>
        <span className="font-bold tabular-nums">{formatCurrencyBRLExact(row.value)}</span>
      </p>
      <p className="mt-1 text-foreground">
        <span className="text-muted-foreground">Pessoas ativas: </span>
        <span className="font-medium tabular-nums">
          {row.ativosAproximado ? `aprox. ${formatIntPt(row.ativos)} pessoas` : `${formatIntPt(row.ativos)} pessoas`}
        </span>
      </p>
    </div>
  );
}

function empresaDaLinhaOrganico(values: unknown[], secullumEmpresa: Record<string, string>): string {
  const mat = String(values[ORGANICO_IDX.MATRICULA] ?? "").trim();
  const fromApi = secullumEmpresa[mat] ?? secullumEmpresa[chaveMatricula(mat)] ?? secullumEmpresa[normalizeMatriculaFolha(mat)];
  if (fromApi) return fromApi;
  return resolveEmpresaFromOrganicoCells({
    setor: String(values[ORGANICO_IDX.SETOR] ?? ""),
    area: String(values[ORGANICO_IDX.AREA] ?? ""),
    diretoria: String(values[ORGANICO_IDX.DIRETORIA] ?? ""),
    historicoLocal: isOrganicoHistoricoLocal(values),
  });
}

function normalizeMatricula(value: unknown): string {
  const raw = String(value ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  if (digits) return digits.replace(/^0+/, "") || "0";
  return raw.toUpperCase();
}

function formatIntPt(n: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n);
}

function formatCurrencyBRL(n: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Moeda com centavos (soma CTPS / folha). */
function formatCurrencyBRLExact(n: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Soma da coluna CTPS — valores grandes em milhões com 2 dec. */
function formatCustoFolha(n: number): string {
  if (n <= 0) return formatCurrencyBRLExact(0);
  if (n >= 1_000_000) {
    const mi = n / 1_000_000;
    return `R$ ${mi.toLocaleString("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} mi`;
  }
  return formatCurrencyBRLExact(n);
}

function formatTenure(meses: number): string {
  const m = Math.max(0, Math.round(meses));
  const anos = Math.floor(m / 12);
  const resto = m % 12;
  if (anos <= 0) return `${resto} ${resto === 1 ? "mês" : "meses"}`;
  if (resto <= 0) return `${anos} ${anos === 1 ? "ano" : "anos"}`;
  return `${anos}a ${resto}m`;
}

const Dashboard = () => {
  const chart = useRhChartTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedTurnoverPoint, setSelectedTurnoverPoint] = useState<{
    year: number;
    month: string;
    x: number;
    y: number;
  } | null>(null);
  const [dragState, setDragState] = useState<{ dx: number; dy: number } | null>(null);
  /** Filtro da série "Evolução do Turnover" ao clicar numa barra de setor (null = todos). */
  const [turnoverSetorFiltro, setTurnoverSetorFiltro] = useState<string | null>(null);
  const turnoverPopoverRef = useRef<HTMLDivElement | null>(null);
  const [empresaPainel, setEmpresaPainel] = useState(ORGANICO_EMPRESA_SO_ACO);
  const [generoFiltro, setGeneroFiltro] = useState<GeneroFiltro>(null);
  const [periodoFolha, setPeriodoFolha] = useState<DashboardPeriodo>(() => periodoPadraoExecutivo());
  const [folhaModalAberto, setFolhaModalAberto] = useState(false);
  const [turnoverModalAberto, setTurnoverModalAberto] = useState(false);
  const [setorHeadcountSelecionado, setSetorHeadcountSelecionado] = useState<string | null>(null);
  const [periodoTurnover, setPeriodoTurnover] = useState<DashboardPeriodo>(() => periodoPadraoExecutivo());
  const { data: organicoRows, isLoading, isError, refetch } = useQuery({
    queryKey: ["organico"],
    queryFn: getOrganico,
  });
  const { data: secullumRows } = useQuery({
    queryKey: ["secullum-funcionarios-dashboard"],
    queryFn: getSecullumFuncionarios,
    enabled: isApiConfigured(),
    staleTime: 5 * 60 * 1000,
  });
  const podeVerFotosOrganico = canViewOrganicoPhotos();
  const { data: fotosResumo } = useQuery({
    queryKey: ["organico-fotos-resumo"],
    queryFn: getOrganicoFotosResumo,
    enabled: setorHeadcountSelecionado != null && isApiConfigured() && podeVerFotosOrganico,
    staleTime: 60 * 1000,
  });

  const demissaoByMatricula = useMemo(() => {
    const map: Record<string, string> = {};
    for (const f of secullumRows ?? []) {
      const mat = String(f.numeroFolha ?? "").trim();
      const dem = String(f.demissao ?? "").trim();
      if (mat && dem) map[mat] = dem;
    }
    return map;
  }, [secullumRows]);

  const { data: salariosTrajetoria, isError: salariosTrajetoriaErro } = useQuery({
    queryKey: ["organico-salarios-trajetoria"],
    queryFn: getOrganicoSalariosTrajetoria,
    enabled: isApiConfigured(),
    staleTime: 5 * 60 * 1000,
  });

  const salariosPorMatricula = useMemo(
    () => indexarSalariosTrajetoria(salariosTrajetoria),
    [salariosTrajetoria],
  );

  const secullumEmpresaByMatricula = useMemo(() => {
    const map: Record<string, string> = {};
    for (const f of secullumRows ?? []) {
      const rawMat = String(f.numeroFolha ?? "").trim();
      if (!rawMat) continue;
      const empresa = resolveEmpresaTabFromSecullumFuncionario(f);
      map[rawMat] = empresa;
      map[chaveMatricula(rawMat)] = empresa;
      map[normalizeMatriculaFolha(rawMat)] = empresa;
    }
    return map;
  }, [secullumRows]);

  const empresaDaPessoaSecullum = useCallback(
    (f: NonNullable<typeof secullumRows>[number]) => resolveEmpresaTabFromSecullumFuncionario(f),
    [],
  );

  const organicoDaEmpresaBase = useMemo(() => {
    const list = Array.isArray(organicoRows) ? organicoRows : [];
    if (empresaPainel === DASHBOARD_EMPRESA_TODAS) return list;
    return list.filter((r) => {
      const values = Array.isArray(r?.values) ? r.values : [];
      return empresaDaLinhaOrganico(values, secullumEmpresaByMatricula) === empresaPainel;
    });
  }, [organicoRows, empresaPainel, secullumEmpresaByMatricula]);

  const secullumDaEmpresaBase = useMemo(() => {
    const list = secullumRows ?? [];
    if (empresaPainel === DASHBOARD_EMPRESA_TODAS) return list;
    return list.filter((f) => empresaDaPessoaSecullum(f) === empresaPainel);
  }, [secullumRows, empresaPainel, empresaDaPessoaSecullum]);

  const organicoDaEmpresa = useMemo(
    () =>
      generoFiltro
        ? organicoDaEmpresaBase.filter((r) => {
            const values = Array.isArray(r?.values) ? r.values : [];
            return correspondeAoGenero(values[ORGANICO_IDX.SEXO], generoFiltro);
          })
        : organicoDaEmpresaBase,
    [organicoDaEmpresaBase, generoFiltro],
  );

  const secullumDaEmpresa = useMemo(
    () => (generoFiltro ? secullumDaEmpresaBase.filter((f) => correspondeAoGenero(f.sexo, generoFiltro)) : secullumDaEmpresaBase),
    [secullumDaEmpresaBase, generoFiltro],
  );

  const empresasPainel = useMemo(() => {
    const tabs = new Set<string>([ORGANICO_EMPRESA_SO_ACO]);
    for (const r of organicoRows ?? []) {
      const values = Array.isArray(r?.values) ? r.values : [];
      const nome = String(values[ORGANICO_IDX.NOME] ?? "").trim();
      if (!nome) continue;
      tabs.add(empresaDaLinhaOrganico(values, secullumEmpresaByMatricula));
    }
    for (const f of secullumRows ?? []) tabs.add(resolveEmpresaTabFromSecullumFuncionario(f));
    return Array.from(tabs).sort((a, b) => {
      if (a === ORGANICO_EMPRESA_SO_ACO) return -1;
      if (b === ORGANICO_EMPRESA_SO_ACO) return 1;
      return a.localeCompare(b, "pt-BR");
    });
  }, [organicoRows, secullumRows, secullumEmpresaByMatricula]);

  const hojePainel = useMemo(() => inicioDoDia(new Date()), []);

  const salarioNaData = useCallback(
    (matricula: string, asOf: Date, ctpsAtual: number) =>
      salarioVigenteDaMatricula(salariosPorMatricula, matricula, asOf, ctpsAtual, hojePainel),
    [salariosPorMatricula, hojePainel],
  );

  const derived = useMemo(
    () =>
      buildDashboardFromOrganico(organicoDaEmpresa, demissaoByMatricula, {
        inicio: hojePainel,
        fim: hojePainel,
        hoje: hojePainel,
        salarioNaData,
      }),
    [organicoDaEmpresa, demissaoByMatricula, hojePainel, salarioNaData],
  );

  const folhaMensal = useMemo(
    () =>
      buildDashboardFromOrganico(organicoDaEmpresa, demissaoByMatricula, {
        inicio: periodoFolha.inicio,
        fim: periodoFolha.fim,
        hoje: hojePainel,
        salarioNaData,
      }).folhaMensal,
    [organicoDaEmpresa, demissaoByMatricula, periodoFolha, hojePainel, salarioNaData],
  );
  const folhaChartData = useMemo(
    () => folhaMensal.map((p) => ({ ...p, eixo: `${p.month}/${String(p.year).slice(-2)}` })),
    [folhaMensal],
  );

  const generoAtivos = useMemo(() => {
    const acc = { masculino: 0, feminino: 0, naoInformado: 0 };
    const somar = (sexo: string) => {
      const s = sexo.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase().trim();
      if (s.startsWith("MASC") || s === "M") acc.masculino += 1;
      else if (s.startsWith("FEM") || s === "F") acc.feminino += 1;
      else acc.naoInformado += 1;
    };
    if (secullumDaEmpresaBase.length > 0) {
      for (const p of secullumDaEmpresaBase) {
        const demissao = parseDateBR(String(p.demissao ?? ""));
        const ativo = colaboradorAtivoNaData(
          {
            admissao: parseDateBR(String(p.admissao ?? "")),
            demissao,
            statusDesligado: Boolean(p.desligado) && !demissao,
          },
          hojePainel,
        );
        if (!ativo) continue;
        somar(String(p.sexo ?? ""));
      }
      return acc;
    }
    for (const r of organicoDaEmpresaBase) {
      const values = Array.isArray(r?.values) ? r.values : [];
      if (!String(values[ORGANICO_IDX.NOME] ?? "").trim()) continue;
      const demissao = parseDateBR(String(demissaoByMatricula[String(values[ORGANICO_IDX.MATRICULA] ?? "").trim()] ?? ""));
      const status = String(values[ORGANICO_IDX.STATUS] ?? "").toUpperCase();
      const ativo = colaboradorAtivoNaData(
        {
          admissao: parseDateBR(String(values[ORGANICO_IDX.ADMISSAO] ?? "")),
          demissao,
          statusDesligado: status.includes("DESLIG") && !demissao,
        },
        hojePainel,
      );
      if (!ativo) continue;
      somar(String(values[ORGANICO_IDX.SEXO] ?? ""));
    }
    return acc;
  }, [secullumDaEmpresaBase, organicoDaEmpresaBase, demissaoByMatricula, hojePainel]);

  const turnoverPeople = useMemo(() => {
    if (secullumDaEmpresa.length > 0) {
      return secullumDaEmpresa.map((p) => ({
        admissao: p.admissao,
        demissao: p.demissao,
        setor: p.setor,
      }));
    }
    return listTurnoverPeopleFromOrganico(organicoDaEmpresa, demissaoByMatricula);
  }, [secullumDaEmpresa, organicoDaEmpresa, demissaoByMatricula]);

  const turnoverKpi = useMemo(
    () => deriveTurnoverFromPeople(turnoverPeople, hojePainel),
    [turnoverPeople, hojePainel],
  );

  const headcountNoFimTurnover = useMemo(
    () =>
      buildDashboardFromOrganico(organicoDaEmpresa, demissaoByMatricula, {
        inicio: periodoTurnover.fim,
        fim: periodoTurnover.fim,
        hoje: hojePainel,
        salarioNaData,
      }).headcountData,
    [organicoDaEmpresa, demissaoByMatricula, periodoTurnover.fim, hojePainel, salarioNaData],
  );

  const novasAdmissoesLista = useMemo(
    () => listNovasAdmissoesMesAtual(organicoDaEmpresa),
    [organicoDaEmpresa],
  );

  const folhaNoFechamento = `em ${formatDiaMmmAno(hojePainel)}`;
  const periodoNoPadrao = (periodo: DashboardPeriodo) => {
    const padrao = periodoPadraoExecutivo();
    return toIsoLocal(periodo.inicio) === toIsoLocal(padrao.inicio) && toIsoLocal(periodo.fim) === toIsoLocal(padrao.fim);
  };
  const limparFiltrosDesabilitado =
    empresaPainel === ORGANICO_EMPRESA_SO_ACO &&
    generoFiltro === null &&
    periodoNoPadrao(periodoFolha) &&
    periodoNoPadrao(periodoTurnover);

  type DashboardTab = "executivo" | "absenteismo" | "absenteismo-horas" | "diagnostico-ausencias-justificadas";
  const canViewExecutivo = canViewDashboardModule("executivo");
  const canViewAbsenteismo = canViewDashboardModule("absenteismo");
  const canViewPontualidade = canViewDashboardModule("absenteismo-horas");
  const canViewDiagnosticoAusenciasJustificadas = canViewDashboardModule("diagnostico-ausencias-justificadas");
  const canEditPontualidade = canEditDashboardModule("absenteismo-horas");
  const availableTabs = useMemo<DashboardTab[]>(() => {
    const tabs: DashboardTab[] = [];
    if (canViewExecutivo) tabs.push("executivo");
    if (canViewAbsenteismo) tabs.push("absenteismo");
    if (canViewPontualidade) tabs.push("absenteismo-horas");
    if (canViewDiagnosticoAusenciasJustificadas) tabs.push("diagnostico-ausencias-justificadas");
    return tabs;
  }, [canViewExecutivo, canViewAbsenteismo, canViewPontualidade, canViewDiagnosticoAusenciasJustificadas]);
  const [activeTab, setActiveTab] = useState<DashboardTab>("executivo");
  const dashboardRestoreAplicadoRef = useRef(false);

  useEffect(() => {
    if (dashboardRestoreAplicadoRef.current) return;
    const restore = (location.state as RhDashboardNavigationState | null)?.dashboardRestore;
    if (!restore) return;
    dashboardRestoreAplicadoRef.current = true;

    setActiveTab("executivo");
    setEmpresaPainel(restore.empresa || ORGANICO_EMPRESA_SO_ACO);
    setGeneroFiltro(restore.genero);
    const folhaInicio = parseIsoLocal(restore.folhaInicio);
    const folhaFim = parseIsoLocal(restore.folhaFim);
    if (folhaInicio && folhaFim) setPeriodoFolha({ inicio: folhaInicio, fim: folhaFim });
    const turnoverInicio = parseIsoLocal(restore.turnoverInicio);
    const turnoverFim = parseIsoLocal(restore.turnoverFim);
    if (turnoverInicio && turnoverFim) setPeriodoTurnover({ inicio: turnoverInicio, fim: turnoverFim });
    setTurnoverSetorFiltro(restore.turnoverSetor);
    setSelectedTurnoverPoint(null);
    setSetorHeadcountSelecionado(null);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.pathname, location.search, location.state, navigate]);

  const abrirColaboradorNoOrganico = useCallback(
    (matricula: unknown) => {
      const filters: RhDashboardReturnFilters = {
        empresa: empresaPainel,
        genero: generoFiltro,
        folhaInicio: toIsoLocal(periodoFolha.inicio),
        folhaFim: toIsoLocal(periodoFolha.fim),
        turnoverInicio: toIsoLocal(periodoTurnover.inicio),
        turnoverFim: toIsoLocal(periodoTurnover.fim),
        turnoverSetor: turnoverSetorFiltro,
      };
      const state: RhOrganicoNavigationState = {
        dashboardShortcut: {
          returnTo: `${location.pathname}${location.search}`,
          filters,
        },
      };
      navigate(rhOrganicoFocusPath(matricula), { state });
    },
    [
      empresaPainel,
      generoFiltro,
      location.pathname,
      location.search,
      navigate,
      periodoFolha,
      periodoTurnover,
      turnoverSetorFiltro,
    ],
  );

  const [absenteismoSnap, setAbsenteismoSnap] = useState<AbsenteismoFavoritoSnapshot>({
    selectedColaboradores: [],
    startDate: "",
    endDate: "",
    incluirColaboradoresDesligados: false,
    rankingTiposAusencia: null,
    rankingTopN: 10,
  });
  const [absenteismoApply, setAbsenteismoApply] = useState<AbsenteismoFavoritoSnapshot | null>(null);
  const [absenteismoApplyToken, setAbsenteismoApplyToken] = useState<string | null>(null);
  const onAbsenteismoFiltrosChange = useCallback((snap: AbsenteismoFavoritoSnapshot) => {
    setAbsenteismoSnap(snap);
  }, []);

  const filtrosFavorito = useMemo(() => {
    const f: Record<string, string> = { tab: activeTab };
    if (activeTab === "executivo") {
      f.empresa = empresaPainel;
      f.folhaInicio = toIsoLocal(periodoFolha.inicio);
      f.folhaFim = toIsoLocal(periodoFolha.fim);
      f.turnoverInicio = toIsoLocal(periodoTurnover.inicio);
      f.turnoverFim = toIsoLocal(periodoTurnover.fim);
      if (generoFiltro) f.genero = generoFiltro;
    }
    if (activeTab === "absenteismo") {
      if (absenteismoSnap.selectedColaboradores.length > 0) {
        f.selectedColaboradores = JSON.stringify(absenteismoSnap.selectedColaboradores);
      }
      if (absenteismoSnap.startDate) f.startDate = absenteismoSnap.startDate;
      if (absenteismoSnap.endDate) f.endDate = absenteismoSnap.endDate;
      f.incluirColaboradoresDesligados = absenteismoSnap.incluirColaboradoresDesligados
        ? "true"
        : "false";
      f.rankingTopN = String(absenteismoSnap.rankingTopN);
      if (absenteismoSnap.rankingTiposAusencia !== null) {
        f.rankingTiposAusencia = JSON.stringify(absenteismoSnap.rankingTiposAusencia);
      }
    }
    return f;
  }, [activeTab, absenteismoSnap, empresaPainel, generoFiltro, periodoFolha, periodoTurnover]);

  const aplicarFiltrosFavorito = useCallback((raw: Record<string, string>) => {
    const tab = (raw.tab as DashboardTab) || "absenteismo";
    const nextTab: DashboardTab =
      tab === "executivo" ||
      tab === "absenteismo" ||
      tab === "absenteismo-horas" ||
      tab === "diagnostico-ausencias-justificadas"
        ? tab
        : "absenteismo";
    setActiveTab(nextTab);

    if (raw.empresa) setEmpresaPainel(raw.empresa);
    setGeneroFiltro(raw.genero === "masculino" || raw.genero === "feminino" ? raw.genero : null);
    const lerPeriodo = (inicioKey: string, fimKey: string) => {
      const inicioFav = raw[inicioKey] ? parseIsoLocal(raw[inicioKey]) : null;
      const fimFav = raw[fimKey] ? parseIsoLocal(raw[fimKey]) : null;
      if (inicioFav && fimFav && inicioFav <= fimFav) return { inicio: inicioFav, fim: fimFav };
      const legadoInicio = raw.periodoInicio ? parseIsoLocal(raw.periodoInicio) : null;
      const legadoFim = raw.periodoFim ? parseIsoLocal(raw.periodoFim) : null;
      if (legadoInicio && legadoFim && legadoInicio <= legadoFim) return { inicio: legadoInicio, fim: legadoFim };
      return null;
    };
    const folhaFav = lerPeriodo("folhaInicio", "folhaFim");
    const turnoverFav = lerPeriodo("turnoverInicio", "turnoverFim");
    if (folhaFav) setPeriodoFolha(folhaFav);
    if (turnoverFav) setPeriodoTurnover(turnoverFav);

    if (nextTab === "absenteismo" || raw.selectedColaboradores) {
      let selectedColaboradores: string[] = [];
      try {
        const parsed = JSON.parse(raw.selectedColaboradores || "[]") as unknown;
        if (Array.isArray(parsed)) selectedColaboradores = parsed.map(String);
      } catch {
        selectedColaboradores = [];
      }
      let rankingTiposAusencia: string[] | null = null;
      if (raw.rankingTiposAusencia) {
        try {
          const parsed = JSON.parse(raw.rankingTiposAusencia) as unknown;
          rankingTiposAusencia = Array.isArray(parsed) ? parsed.map(String) : null;
        } catch {
          rankingTiposAusencia = null;
        }
      }
      const snap: AbsenteismoFavoritoSnapshot = {
        selectedColaboradores,
        startDate: raw.startDate ?? "",
        endDate: raw.endDate ?? "",
        incluirColaboradoresDesligados: raw.incluirColaboradoresDesligados === "true",
        rankingTiposAusencia,
        rankingTopN: Number(raw.rankingTopN) > 0 ? Number(raw.rankingTopN) : 10,
      };
      setAbsenteismoSnap(snap);
      setAbsenteismoApply(snap);
      setAbsenteismoApplyToken(`${Date.now()}-${raw.selectedColaboradores ?? ""}`);
    }
  }, []);

  useFavoritoPagina({
    rota: "/rh/dashboard",
    telaLabel: "RH — Dashboard",
    filtros: filtrosFavorito,
    aplicarFiltros: aplicarFiltrosFavorito,
    resumoFiltros: resumoFiltrosFavorito("/rh/dashboard", filtrosFavorito),
  });

  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0] ?? "executivo");
    }
  }, [availableTabs, activeTab]);

  const topSetoresTurnover = useMemo(() => {
    const ativosBySetor = new Map<string, number>();
    for (const item of headcountNoFimTurnover) {
      if (!item.sector || item.sector === "—" || item.count <= 0) continue;
      ativosBySetor.set(item.sector, item.count);
    }
    const demissoesBySetor = new Map<string, number>();
    const start = inicioDoDia(periodoTurnover.inicio);
    const end = fimDoDia(periodoTurnover.fim);
    for (const f of secullumDaEmpresa) {
      const dem = parseDateBR(String(f.demissao ?? "").trim());
      if (!dataDentroDoPeriodo(dem, start, end)) continue;
      const setor = String(f.setor ?? "").trim() || "Sem setor";
      demissoesBySetor.set(setor, (demissoesBySetor.get(setor) ?? 0) + 1);
    }
    const data = Array.from(ativosBySetor.entries()).map(([setor, ativos]) => {
      const dem = demissoesBySetor.get(setor) ?? 0;
      const turnover = ativos > 0 ? (dem / ativos) * 100 : 0;
      return { setor, turnover: Math.round(turnover * 10) / 10, dem };
    });
    return data
      .filter((d) => d.turnover > 0)
      .sort((a, b) => b.turnover - a.turnover);
  }, [headcountNoFimTurnover, secullumDaEmpresa, periodoTurnover]);
  const turnoverSeriesForChart = useMemo(
    () =>
      deriveTurnoverFromPeople(
        turnoverPeople,
        periodoTurnover.fim,
        turnoverSetorFiltro,
        periodoTurnover,
      ).turnoverData,
    [turnoverPeople, turnoverSetorFiltro, periodoTurnover],
  );

  const turnoverChartData = useMemo(
    () =>
      [...turnoverSeriesForChart]
        .reverse()
        .map((p) => ({ ...p, eixo: `${p.year}-${p.month}` })),
    [turnoverSeriesForChart],
  );
  const turnoverYearBands = useMemo(() => {
    const data = turnoverChartData;
    if (data.length === 0) return [];
    const out: Array<{ year: number; start: number; end: number }> = [];
    let start = 0;
    let currentYear = data[0].year;
    for (let i = 1; i <= data.length; i++) {
      if (i === data.length || data[i].year !== currentYear) {
        out.push({ year: currentYear, start, end: i - 1 });
        if (i < data.length) {
          start = i;
          currentYear = data[i].year;
        }
      }
    }
    return out;
  }, [turnoverChartData]);

  /** Altura mínima por linha no headcount vertical — evita barras espremidas; rolagem no card. */
  const headcountChartHeight = useMemo(() => {
    const list = derived.headcountData;
    const n = Array.isArray(list) ? list.length : 0;
    if (n === 0) return 280;
    const pxPerRow = 46;
    const verticalPadding = 56;
    return Math.max(280, n * pxPerRow + verticalPadding);
  }, [derived.headcountData]);

  const matriculasComFoto = useMemo(() => {
    const matriculas = new Set<string>();
    for (const foto of fotosResumo ?? []) {
      const matricula = String(foto.colaboradorMatricula ?? "").trim();
      if (matricula) matriculas.add(matricula);
    }
    return matriculas;
  }, [fotosResumo]);

  const colaboradoresDoSetorSelecionado = useMemo(() => {
    if (!setorHeadcountSelecionado) return [];
    const setorEsperado = setorHeadcountSelecionado;
    const colaboradores: Array<{
      row: (string | number)[];
      rowIndex: number;
      matricula: string;
      nome: string;
      demissao: string;
    }> = [];

    for (let index = 0; index < organicoDaEmpresa.length; index += 1) {
      const registro = organicoDaEmpresa[index];
      const row = Array.isArray(registro?.values) ? registro.values : [];
      const nome = String(row[ORGANICO_IDX.NOME] ?? "").trim();
      if (!nome) continue;
      const setor = String(row[ORGANICO_IDX.SETOR] ?? "").trim() || "Sem setor";
      if (setor !== setorEsperado) continue;
      const matricula = String(row[ORGANICO_IDX.MATRICULA] ?? "").trim();
      const demissao = String(demissaoByMatricula[matricula] ?? "").trim();
      const status = String(row[ORGANICO_IDX.STATUS] ?? "").toUpperCase();
      const ativo = colaboradorAtivoNaData(
        {
          admissao: parseDateBR(String(row[ORGANICO_IDX.ADMISSAO] ?? "")),
          demissao: parseDateBR(demissao),
          statusDesligado: status.includes("DESLIG"),
        },
        hojePainel,
      );
      if (!ativo) continue;
      colaboradores.push({
        row: row as (string | number)[],
        rowIndex: index,
        matricula,
        nome,
        demissao,
      });
    }

    return colaboradores.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [setorHeadcountSelecionado, organicoDaEmpresa, demissaoByMatricula, hojePainel]);

  const handleTurnoverPointClick = (
    payload: TurnoverPointPayload | undefined,
    ev: { clientX?: number; clientY?: number } | undefined
  ) => {
    const y = payload?.year;
    const m = payload?.month;
    if (typeof y !== "number" || typeof m !== "string") return;
    const x = typeof ev?.clientX === "number" ? ev.clientX : window.innerWidth / 2;
    const top = typeof ev?.clientY === "number" ? ev.clientY : window.innerHeight / 2;
    setSelectedTurnoverPoint({ year: y, month: m, x, y: top });
  };
  const desligadosByTurnoverPoint = useMemo(() => {
    if (!selectedTurnoverPoint) return [];
    const monthIdx = MESES_LABEL.indexOf(selectedTurnoverPoint.month as (typeof MESES_LABEL)[number]);
    if (monthIdx < 0) return [];

    const orgByMat = new Map<string, (string | number)[]>();
    for (const r of organicoRows ?? []) {
      const row = Array.isArray(r?.values) ? r.values : [];
      const key = normalizeMatricula(row[ORGANICO_IDX.MATRICULA]);
      if (!key) continue;
      orgByMat.set(key, row);
    }

    const out: Array<{ row: (string | number)[]; demissao: string; key: string }> = [];
    for (let i = 0; i < (secullumRows?.length ?? 0); i++) {
      const f = secullumRows?.[i];
      if (!f) continue;
      const demissao = String(f.demissao ?? "").trim();
      if (!demissao) continue;
      const d = parseDateBR(demissao);
      if (!d) continue;
      if (d.getFullYear() !== selectedTurnoverPoint.year || d.getMonth() !== monthIdx) continue;

      if (empresaPainel !== DASHBOARD_EMPRESA_TODAS && resolveEmpresaTabFromSecullumFuncionario(f) !== empresaPainel) {
        continue;
      }
      if (!dataDentroDoPeriodo(d, periodoTurnover.inicio, periodoTurnover.fim)) continue;

      const secSetor = String(f.setor ?? "").trim() || "Sem setor";
      if (turnoverSetorFiltro != null && secSetor !== turnoverSetorFiltro) continue;

      const matKey = normalizeMatricula(f.numeroFolha);
      const existing = orgByMat.get(matKey);
      if (existing) {
        out.push({ row: existing, demissao, key: `${matKey}-${i}` });
        continue;
      }

      const row: (string | number)[] = new Array(86).fill("");
      row[ORGANICO_IDX.MATRICULA] = String(f.numeroFolha ?? "").trim();
      row[ORGANICO_IDX.NOME] = String(f.nome ?? "").trim();
      row[ORGANICO_IDX.CARGO] = String(f.cargo ?? "").trim();
      row[ORGANICO_IDX.SETOR] = String(f.setor ?? "").trim();
      row[ORGANICO_IDX.AREA] = String(f.area ?? "").trim();
      row[ORGANICO_IDX.ADMISSAO] = String(f.admissao ?? "").trim();
      row[ORGANICO_IDX.STATUS] = "Desligado";
      out.push({ row, demissao, key: `${matKey || "semmat"}-${i}` });
    }

    out.sort((a, b) =>
      String(a.row[ORGANICO_IDX.NOME] ?? "").localeCompare(String(b.row[ORGANICO_IDX.NOME] ?? ""), "pt-BR")
    );
    return out;
  }, [selectedTurnoverPoint, organicoRows, secullumRows, turnoverSetorFiltro, empresaPainel, periodoTurnover]);

  useEffect(() => {
    if (!selectedTurnoverPoint) return;
    const onDown = (ev: MouseEvent) => {
      if (!turnoverPopoverRef.current) return;
      const target = ev.target as Node | null;
      if (target && !turnoverPopoverRef.current.contains(target)) {
        setSelectedTurnoverPoint(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [selectedTurnoverPoint]);

  useEffect(() => {
    if (!selectedTurnoverPoint || !dragState) return;
    const onMove = (ev: MouseEvent) => {
      setSelectedTurnoverPoint((prev) => {
        if (!prev) return prev;
        return { ...prev, x: ev.clientX - dragState.dx, y: ev.clientY - dragState.dy };
      });
    };
    const onUp = () => setDragState(null);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [selectedTurnoverPoint, dragState]);

  const { headcountData } = derived;

  return (
    <AppLayout>
      <div className="py-8 px-10">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DashboardTab)} className="space-y-6">
          {/* Header + guias */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 min-w-0">
              <h1 className="text-3xl font-bold tracking-tight text-foreground shrink-0">Dashboard</h1>
              <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <TabsList className="inline-flex h-auto min-h-10 w-max min-w-max flex-nowrap justify-start gap-1 whitespace-nowrap bg-muted/80 p-1">
                {canViewExecutivo ? (
                  <TabsTrigger value="executivo" className="shrink-0 text-xs sm:text-sm px-3 sm:px-4">
                    Dashboard Executivo
                  </TabsTrigger>
                ) : null}
                {canViewAbsenteismo ? (
                  <TabsTrigger value="absenteismo" className="shrink-0 text-xs sm:text-sm px-3 sm:px-4">
                    Absenteísmo (por faltas)
                  </TabsTrigger>
                ) : null}
                {canViewPontualidade ? (
                  <TabsTrigger value="absenteismo-horas" className="shrink-0 text-xs sm:text-sm px-3 sm:px-4">
                    Pontualidade
                  </TabsTrigger>
                ) : null}
                {canViewDiagnosticoAusenciasJustificadas ? (
                  <TabsTrigger value="diagnostico-ausencias-justificadas" className="shrink-0 text-xs sm:text-sm px-3 sm:px-4">
                    Diagnóstico Geral - Ausências justificadas
                  </TabsTrigger>
                ) : null}
                </TabsList>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-muted-foreground shrink-0">
              <div className="w-2 h-2 bg-success rounded-full animate-pulse-glow" />
              Sistema operacional
            </div>
          </div>

          {canViewExecutivo ? <TabsContent value="executivo" className="mt-0 space-y-8 focus-visible:outline-none">
            {isLoading ? (
              <div className="flex items-center justify-center min-h-[40vh]">
                <p className="text-muted-foreground">Carregando dados do orgânico...</p>
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
                <p className="text-destructive">Erro ao carregar o orgânico.</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Tentar novamente
                </Button>
              </div>
            ) : (
              <>
        <DashboardExecutivoFiltros
          empresas={empresasPainel}
          empresa={empresaPainel}
          onEmpresaChange={(next) => {
            setEmpresaPainel(next);
            setTurnoverSetorFiltro(null);
            setSelectedTurnoverPoint(null);
            setSetorHeadcountSelecionado(null);
          }}
          limparDesabilitado={limparFiltrosDesabilitado}
          onLimpar={() => {
            setEmpresaPainel(ORGANICO_EMPRESA_SO_ACO);
            setGeneroFiltro(null);
            setPeriodoFolha(periodoPadraoExecutivo());
            setPeriodoTurnover(periodoPadraoExecutivo());
            setTurnoverSetorFiltro(null);
            setSelectedTurnoverPoint(null);
            setSetorHeadcountSelecionado(null);
          }}
        />

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KpiCard
            title="Total Colaboradores"
            value={formatIntPt(derived.totalColaboradores)}
            change={folhaNoFechamento}
            changeType="neutral"
            icon={Users}
            alertColor="green"
          />
          <button
            type="button"
            className="w-full text-left rounded-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Ver custo da folha mês a mês"
            onClick={() => setFolhaModalAberto(true)}
          >
            <KpiCard
              title="Custo Folha Mensal"
              value={formatCustoFolha(derived.custoFolhaMensal)}
              change={folhaNoFechamento}
              changeType="neutral"
              icon={DollarSign}
              alertColor="yellow"
            />
          </button>
          <button
            type="button"
            className="w-full text-left rounded-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Ver evolução do turnover"
            onClick={() => setTurnoverModalAberto(true)}
          >
            <KpiCard
              title="Turnover"
              value={`${turnoverKpi.turnoverPct.toLocaleString("pt-BR", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 1,
              })}%`}
              change="últimos 12 meses"
              changeType="neutral"
              icon={TrendingDown}
              alertColor="red"
            />
          </button>
          <KpiCard
            title="Absenteísmo"
            value={`${formatIntPt(derived.absenteismoPct)}%`}
            icon={Clock}
            alertColor="green"
          />
        </div>

        <Dialog open={folhaModalAberto} onOpenChange={setFolhaModalAberto}>
          <DialogContent aria-describedby={undefined} className="flex max-h-[min(92vh,760px)] w-[min(96vw,960px)] max-w-none flex-col gap-4 overflow-y-auto sm:max-w-none">
            <DialogHeader className="pr-8">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <DialogTitle className="shrink-0 text-left">Custo da folha mês a mês</DialogTitle>
                <DashboardPeriodoDatas
                  idPrefix="folha"
                  periodo={periodoFolha}
                  onPeriodoChange={setPeriodoFolha}
                />
              </div>
            </DialogHeader>
            {salariosTrajetoriaErro ? (
              <p className="text-xs text-destructive">
                Não foi possível ler a trajetória. Os meses passados podem estar com a CTPS de hoje.
              </p>
            ) : null}
            <div className="h-[320px] w-full min-w-0">
              {folhaModalAberto ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={folhaChartData}>
                    <defs>
                      <linearGradient id="folhaFillExecutivo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={chart.lineSecondary} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={chart.lineSecondary} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                    <XAxis dataKey="eixo" tick={rhChartAxisTick(chart)} interval="preserveStartEnd" minTickGap={28} />
                    <YAxis
                      yAxisId="folha"
                      tick={rhChartAxisTick(chart)}
                      width={72}
                      tickFormatter={(value) => formatCustoFolha(Number(value))}
                    />
                    <YAxis
                      yAxisId="ativos"
                      orientation="right"
                      tick={rhChartAxisTick(chart)}
                      width={36}
                      allowDecimals={false}
                      tickFormatter={(value) => formatIntPt(Number(value))}
                    />
                    <Tooltip content={FolhaMensalTooltip} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area
                      yAxisId="folha"
                      type="monotone"
                      dataKey="value"
                      name="Folha"
                      stroke={chart.lineSecondary}
                      strokeWidth={2.5}
                      fill="url(#folhaFillExecutivo)"
                      dot={{ r: 3, fill: chart.lineSecondary }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      yAxisId="ativos"
                      type="monotone"
                      dataKey="ativos"
                      name="Pessoas ativas"
                      stroke={chart.linePrimary}
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: chart.linePrimary }}
                      activeDot={{ r: 5 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <KpiCard
            title="Média salarial (CTPS)"
            value={derived.mediaSalarialCtps > 0 ? formatCurrencyBRLExact(derived.mediaSalarialCtps) : formatCurrencyBRLExact(0)}
            change={folhaNoFechamento}
            changeType="neutral"
            icon={Wallet}
          />
          <KpiCard
            title="Setores Ativos"
            value={formatIntPt(derived.setoresAtivos)}
            change={folhaNoFechamento}
            changeType="neutral"
            icon={Building2}
          />
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="w-full text-left rounded-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label="Ver colaboradores admitidos neste mês"
              >
                <KpiCard
                  title="Novas Admissões"
                  value={formatIntPt(novasAdmissoesLista.length)}
                  change="neste mês"
                  changeType="neutral"
                  icon={ArrowUpRight}
                  alertColor="green"
                />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-[min(92vw,720px)] max-h-[min(75vh,520px)] overflow-y-auto p-4"
            >
              <p className="label-industrial mb-3">Admissões neste mês</p>
              {novasAdmissoesLista.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-sm">
                  Nenhuma admissão neste mês.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {novasAdmissoesLista.map((row, i) => (
                    <button
                      key={`${String(row[ORGANICO_IDX.MATRICULA] ?? "").trim() || "—"}-${i}`}
                      type="button"
                      onClick={() => {
                        const matricula = String(row[ORGANICO_IDX.MATRICULA] ?? "").trim();
                        abrirColaboradorNoOrganico(matricula);
                      }}
                      className="text-left rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      aria-label="Abrir colaborador no orgânico"
                    >
                      <OrganicoCard
                        row={row}
                        rowIndex={i}
                        readOnly
                      />
                    </button>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>
          <KpiCard
            title="Tempo médio de casa"
            value={formatTenure(derived.mediaTempoCasaMeses)}
            change={folhaNoFechamento}
            changeType="neutral"
            icon={AlertTriangle}
            alertColor="yellow"
          />
        </div>

        <Dialog
          open={turnoverModalAberto}
          onOpenChange={(aberto) => {
            setTurnoverModalAberto(aberto);
            if (!aberto) setSelectedTurnoverPoint(null);
          }}
        >
          <DialogContent aria-describedby={undefined} className="flex max-h-[min(92vh,820px)] w-[min(96vw,1100px)] max-w-none flex-col gap-4 overflow-y-auto sm:max-w-none">
            <DialogHeader className="pr-8">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <DialogTitle className="shrink-0 text-left">Evolução do Turnover</DialogTitle>
                  {turnoverSetorFiltro ? (
                    <span className="inline-flex items-center gap-1 rounded-sm border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground">
                      Setor: {turnoverSetorFiltro}
                      <button
                        type="button"
                        className="rounded-sm p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                        aria-label="Limpar filtro de setor"
                        onClick={() => setTurnoverSetorFiltro(null)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ) : null}
                </div>
                <DashboardPeriodoDatas
                  idPrefix="turnover"
                  periodo={periodoTurnover}
                  onPeriodoChange={(next) => {
                    setPeriodoTurnover(next);
                    setTurnoverSetorFiltro(null);
                    setSelectedTurnoverPoint(null);
                  }}
                />
              </div>
            </DialogHeader>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 min-w-0">
            <div className="relative h-[320px] w-full min-w-0">
              {turnoverModalAberto ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={turnoverChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                  <XAxis
                    dataKey="eixo"
                    tick={rhChartAxisTick(chart)}
                    interval="preserveStartEnd"
                    minTickGap={16}
                    tickFormatter={(value) => String(value).split("-").slice(1).join("-")}
                  />
                  <YAxis tick={rhChartAxisTick(chart)} domain={[0, "auto"]} />
                  <Tooltip content={TurnoverEvolutionTooltip} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={chart.linePrimary}
                    strokeWidth={2.5}
                    dot={(props: { cx?: number; cy?: number; payload?: TurnoverPointPayload; index?: number }) => (
                      <g
                        key={`dot-${props.payload?.year}-${props.payload?.month}-${props.index ?? 0}`}
                        onClick={(ev) => handleTurnoverPointClick(props.payload, ev)}
                        style={{ cursor: "pointer" }}
                      >
                        <circle cx={props.cx} cy={props.cy} r={10} fill="transparent" />
                        <circle cx={props.cx} cy={props.cy} r={3} fill={chart.lineDot} />
                      </g>
                    )}
                    activeDot={(props: { cx?: number; cy?: number; payload?: TurnoverPointPayload; index?: number }) => (
                      <g
                        key={`active-dot-${props.payload?.year}-${props.payload?.month}-${props.index ?? 0}`}
                        onClick={(ev) => handleTurnoverPointClick(props.payload, ev)}
                        style={{ cursor: "pointer" }}
                      >
                        <circle cx={props.cx} cy={props.cy} r={12} fill="transparent" />
                        <circle cx={props.cx} cy={props.cy} r={5} fill={chart.lineDotActive} stroke={chart.dotStrokeActive} strokeWidth={2} />
                      </g>
                    )}
                  />
                </LineChart>
              </ResponsiveContainer>
              ) : null}
              {selectedTurnoverPoint && (
                <div
                  ref={turnoverPopoverRef}
                  className="fixed z-[70] w-[min(92vw,720px)] max-h-[min(75vh,520px)] overflow-y-auto border border-border bg-popover p-4 shadow-md"
                  style={{
                    left: Math.min(
                      Math.max(selectedTurnoverPoint.x, 16 + (Math.min(window.innerWidth * 0.92, 720) / 2)),
                      window.innerWidth - 16 - (Math.min(window.innerWidth * 0.92, 720) / 2)
                    ),
                    top: Math.min(selectedTurnoverPoint.y + 14, window.innerHeight - 24),
                    transform: "translate(-50%, 0)",
                  }}
                >
                  <div
                    className="flex items-center justify-between mb-3 cursor-move select-none"
                    onMouseDown={(ev) => {
                      if (!selectedTurnoverPoint) return;
                      setDragState({
                        dx: ev.clientX - selectedTurnoverPoint.x,
                        dy: ev.clientY - selectedTurnoverPoint.y,
                      });
                    }}
                  >
                    <p className="label-industrial">
                      Desligamentos em {selectedTurnoverPoint.month}/{String(selectedTurnoverPoint.year).slice(-2)}
                      {turnoverSetorFiltro ? ` • ${turnoverSetorFiltro}` : ""}
                    </p>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setSelectedTurnoverPoint(null)}
                    >
                      Fechar
                    </button>
                  </div>
                  {desligadosByTurnoverPoint.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-sm">
                      Nenhum colaborador desligado neste período.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {desligadosByTurnoverPoint.map((item, i) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => {
                            const matricula = String(item.row[ORGANICO_IDX.MATRICULA] ?? "").trim();
                            abrirColaboradorNoOrganico(matricula);
                          }}
                          className="text-left rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          aria-label="Abrir colaborador desligado no orgânico"
                        >
                          <OrganicoCard
                            row={item.row as (string | number)[]}
                            rowIndex={i}
                            demissao={item.demissao}
                            readOnly
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div
              className="mt-1 grid gap-0 border-t border-border/70"
              style={{ gridTemplateColumns: `repeat(${Math.max(turnoverChartData.length, 1)}, minmax(0, 1fr))` }}
            >
              {turnoverYearBands.map((b, i) => (
                <div
                  key={`${b.year}-${b.start}`}
                  className={`h-5 flex items-center justify-center text-[10px] text-muted-foreground ${
                    i > 0 ? "border-l border-border/70" : ""
                  }`}
                  style={{ gridColumn: `${b.start + 1} / ${b.end + 2}` }}
                >
                  {b.year}
                </div>
              ))}
            </div>
          </div>

          <div className="border border-border bg-card p-6 shadow-level-1">
            <span className="label-industrial">Top Setores por Turnover</span>
            <div className="mt-4 max-h-[320px] overflow-y-auto pr-1 space-y-3">
              {topSetoresTurnover.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-sm">
                  Sem desligamentos por setor no período.
                </p>
              ) : (
                topSetoresTurnover.map((item, idx) => {
                  const maxTurnover = topSetoresTurnover[0]?.turnover || 1;
                  const widthPct = Math.max(8, (item.turnover / maxTurnover) * 100);
                  return (
                    <div key={`${item.setor}-${idx}`} className="space-y-1">
                      <div className="flex items-center justify-between text-xs gap-2 min-w-0">
                        <span className="text-foreground truncate pr-2">{item.setor}</span>
                        <div
                          className="shrink-0 flex items-center gap-2 tabular-nums text-right"
                          title={`Turnover ${item.turnover.toFixed(1)}% • ${formatIntPt(item.dem)} desligamento(s) no período`}
                        >
                          <span className="font-semibold text-sm text-foreground">{item.turnover.toFixed(1)}%</span>
                          <span className="text-[10px] sm:text-xs text-muted-foreground border-l border-border/80 pl-2 whitespace-nowrap">
                            {formatIntPt(item.dem)} desl.
                          </span>
                        </div>
                      </div>
                      <UiTooltip delayDuration={150}>
                        <TooltipTrigger asChild>
                          <div
                            role="button"
                            tabIndex={0}
                            className={`h-3 bg-muted rounded-sm overflow-hidden cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                              turnoverSetorFiltro === item.setor ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                            }`}
                            aria-label={`Turnover ${item.turnover.toFixed(1)} por cento, ${item.dem} desligamentos no período. Clique para filtrar a evolução por este setor.`}
                            aria-pressed={turnoverSetorFiltro === item.setor}
                            onClick={(e) => {
                              e.preventDefault();
                              setTurnoverSetorFiltro((prev) => (prev === item.setor ? null : item.setor));
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setTurnoverSetorFiltro((prev) => (prev === item.setor ? null : item.setor));
                              }
                            }}
                          >
                            <div
                              className="h-full rounded-sm pointer-events-none"
                              style={{
                                width: `${widthPct}%`,
                                backgroundColor: chart.sectorGradient[idx % chart.sectorGradient.length],
                              }}
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-none whitespace-nowrap text-xs">
                          {item.dem === 1
                            ? "1 desligamento no período"
                            : `${item.dem} desligamentos no período`}{" "}
                          · {item.turnover.toFixed(1)}%
                        </TooltipContent>
                      </UiTooltip>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
          </DialogContent>
        </Dialog>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-full lg:col-start-3 lg:row-start-1">
            <DistribuicaoGeneroCard
              contagem={generoAtivos}
              referencia={folhaNoFechamento}
              filtro={generoFiltro}
              onFiltroChange={(filtro) => {
                setGeneroFiltro(filtro);
                setTurnoverSetorFiltro(null);
                setSelectedTurnoverPoint(null);
                setSetorHeadcountSelecionado(null);
              }}
            />
          </div>

          <div className="lg:col-span-2 lg:col-start-1 lg:row-start-1 border border-border bg-card p-6 shadow-level-1">
            <span className="label-industrial">Headcount por Setor</span>
            <div className="mt-4 max-h-[min(420px,55vh)] overflow-y-auto overflow-x-hidden pr-1 rounded-sm border border-border/40 bg-muted/20">
              <div style={{ height: headcountChartHeight, minHeight: 280 }}>
                <ResponsiveContainer width="100%" height={headcountChartHeight}>
                  <BarChart
                    data={headcountData}
                    layout="vertical"
                    margin={{ top: 8, right: 48, left: 4, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} horizontal={false} />
                    <XAxis type="number" tick={rhChartAxisTick(chart)} allowDecimals={false} />
                    <YAxis
                      dataKey="sector"
                      type="category"
                      tick={rhChartCategoryTick(chart)}
                      width={132}
                      interval={0}
                    />
                    <Tooltip contentStyle={rhChartTooltipStyle(chart)} labelStyle={{ color: chart.tooltipText }} itemStyle={{ color: chart.tooltipText }} />
                    <Bar
                      dataKey="count"
                      fill={chart.barPrimary}
                      barSize={22}
                      maxBarSize={28}
                      cursor="pointer"
                      onClick={(item) => {
                        const row = (item as { payload?: { sector?: string; count?: number } })?.payload;
                        if (!row?.sector || !row.count || row.count <= 0 || row.sector === "—") return;
                        setSetorHeadcountSelecionado(row.sector);
                      }}
                    >
                      {headcountData.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={entry.count > 1000 ? chart.barLarge : chart.barPrimary}
                        />
                      ))}
                      <LabelList
                        dataKey="count"
                        position="right"
                        formatter={(value: number) => formatIntPt(Number(value))}
                        style={{ fill: chart.axisCategory, fontSize: 11 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

        </div>

        <Dialog
          open={setorHeadcountSelecionado != null}
          onOpenChange={(open) => {
            if (!open) setSetorHeadcountSelecionado(null);
          }}
        >
          <DialogContent
            aria-describedby={undefined}
            className="flex max-h-[min(92vh,820px)] w-[min(96vw,1100px)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
          >
            <DialogHeader className="shrink-0 border-b border-border px-6 py-5 text-left">
              <DialogTitle className="text-lg">
                Colaboradores do setor — {setorHeadcountSelecionado ?? ""}
              </DialogTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {colaboradoresDoSetorSelecionado.length.toLocaleString("pt-BR")}{" "}
                {colaboradoresDoSetorSelecionado.length === 1 ? "colaborador ativo" : "colaboradores ativos"}
                {generoFiltro === "masculino"
                  ? " · filtro: homens"
                  : generoFiltro === "feminino"
                    ? " · filtro: mulheres"
                    : ""}
                {" · "}
                {folhaNoFechamento}
              </p>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto bg-muted/15 px-6 py-5">
              {colaboradoresDoSetorSelecionado.length === 0 ? (
                <p className="rounded-sm border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                  Nenhum colaborador ativo encontrado neste setor.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {colaboradoresDoSetorSelecionado.map((colaborador) => (
                    <button
                      key={`${colaborador.matricula || colaborador.nome}-${colaborador.rowIndex}`}
                      type="button"
                      onClick={() => {
                        abrirColaboradorNoOrganico(colaborador.matricula);
                      }}
                      className="text-left rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      aria-label={`Abrir ${colaborador.nome} no Orgânico`}
                    >
                      <OrganicoCard
                        row={colaborador.row}
                        rowIndex={colaborador.rowIndex}
                        demissao={colaborador.demissao}
                        fotoCadastrada={matriculasComFoto.has(colaborador.matricula)}
                        fotoApiHabilitada={podeVerFotosOrganico && isApiConfigured()}
                        readOnly
                        viewMode="medium"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
              </>
            )}
          </TabsContent> : null}

          {canViewAbsenteismo ? <TabsContent value="absenteismo" className="mt-0 focus-visible:outline-none">
            <AbsenteismoDashboard
              filtrosIniciaisToken={absenteismoApplyToken}
              filtrosIniciais={absenteismoApply}
              onFiltrosChange={onAbsenteismoFiltrosChange}
            />
          </TabsContent> : null}

          {canViewPontualidade ? <TabsContent value="absenteismo-horas" className="mt-0 focus-visible:outline-none">
            <AbsenteismoPorHorasTab canEdit={canEditPontualidade} />
          </TabsContent> : null}

          {canViewDiagnosticoAusenciasJustificadas ? (
            <TabsContent value="diagnostico-ausencias-justificadas" className="mt-0 focus-visible:outline-none">
              <DiagnosticoGeralAusenciasJustificadas />
            </TabsContent>
          ) : null}
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
