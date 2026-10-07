import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import AppLayout from "@rh/components/AppLayout";
import KpiCard from "@rh/components/KpiCard";
import {
  Users,
  DollarSign,
  TrendingDown,
  Wallet,
  CalendarDays,
  ArrowUpDown,
  X,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
  LabelList,
} from "recharts";
import { Button } from "@rh/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@rh/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@rh/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rh/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@rh/components/ui/tabs";
import {
  getDesligamentosComplementos,
  getOrganico,
  getOrganicoFotosResumo,
  getOrganicoSalariosTrajetoria,
  getSecullumFuncionarios,
  isApiConfigured,
  normalizeMatriculaFolha,
} from "@rh/lib/api-client";
import {
  escolherComplementoDesligamento,
} from "@rh/lib/motivo-desligamento";
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
  type TurnoverPersonLike,
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
  mesesNoPeriodo,
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
import {
  DistribuicaoExperienciaCard,
  type RetencaoExperienciaResumo,
} from "@rh/pages/DistribuicaoExperienciaCard";
import { EscolaridadeCard } from "@rh/pages/EscolaridadeCard";
import { chaveCidade, inferirUf, MapaLocalidadeCard, type SelecaoLocalidade } from "@rh/pages/MapaLocalidadeCard";
import {
  classificarEscolaridade,
  generoDoSexo,
  montarEscolaridade,
  rotuloNivelEscolaridade,
  type GeneroEscolaridade,
  type NivelEscolaridadeId,
} from "@rh/lib/escolaridade";
import AbsenteismoDashboard, {
  type AbsenteismoFavoritoSnapshot,
} from "@rh/pages/AbsenteismoDashboard";
import DiagnosticoGeralAusenciasJustificadas from "@rh/pages/DiagnosticoGeralAusenciasJustificadas";
import AbsenteismoPorHorasTab from "@rh/pages/FaltasAtestados/absenteismo-por-horas/AbsenteismoPorHorasTab";
import { OrganicoCard } from "@rh/pages/Organico/OrganicoCard";
import { isOrganicoHistoricoLocal, ORGANICO_IDX, parseCtpsToNumber, parseDateBR } from "@rh/pages/Organico/organico-derive";
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
      <p className="mt-1 text-foreground">
        <span className="text-muted-foreground">Custo médio por pessoa: </span>
        <span className="font-medium tabular-nums">
          {row.ativos > 0 ? formatCurrencyBRLExact(row.value / row.ativos) : "—"}
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

function formatCustoFolhaCurto(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  }
  if (n >= 1_000) return `${Math.round(n / 1_000).toLocaleString("pt-BR")} mil`;
  return Math.round(n).toLocaleString("pt-BR");
}

type ComparacaoTempoDesligamento = "acima" | "abaixo";
const OPCOES_DIAS_DESLIGAMENTO = [0, 15, 30, 45, 60, 90] as const;

function desligamentoAtendeTempo(
  admissaoValor: unknown,
  demissao: Date,
  comparacao: ComparacaoTempoDesligamento,
  limiteDias: number,
): boolean {
  // Regra da opção zero:
  // - acima de 0 = visão geral (todos os desligamentos);
  // - abaixo de 0 = nenhum desligamento, pois não existe tempo de empresa negativo.
  if (limiteDias === 0) return comparacao === "acima";
  const admissao = parseDateBR(String(admissaoValor ?? "").trim());
  if (!admissao) return false;
  const dias = Math.floor(
    (inicioDoDia(demissao).getTime() - inicioDoDia(admissao).getTime()) / 86_400_000,
  );
  if (dias < 0) return false;
  return comparacao === "acima" ? dias > limiteDias : dias <= limiteDias;
}

function FiltroTempoDesligamento({
  comparacao,
  limiteDias,
  onComparacaoChange,
  onLimiteDiasChange,
}: {
  comparacao: ComparacaoTempoDesligamento;
  limiteDias: number;
  onComparacaoChange: (comparacao: ComparacaoTempoDesligamento) => void;
  onLimiteDiasChange: (dias: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>Considerar desligamentos</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 min-w-[76px] capitalize"
        onClick={() => onComparacaoChange(comparacao === "acima" ? "abaixo" : "acima")}
        aria-label={`Trocar filtro para ${comparacao === "acima" ? "abaixo" : "acima"} do período`}
      >
        {comparacao}
      </Button>
      <span>de</span>
      <Select value={String(limiteDias)} onValueChange={(value) => onLimiteDiasChange(Number(value))}>
        <SelectTrigger className="h-8 w-[112px]" aria-label="Limite de dias para desligamentos">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPCOES_DIAS_DESLIGAMENTO.map((dias) => (
            <SelectItem key={dias} value={String(dias)}>
              {dias} dias
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const Dashboard = () => {
  const chart = useRhChartTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedTurnoverPoint, setSelectedTurnoverPoint] = useState<{
    year: number;
    month: string;
  } | null>(null);
  /** Filtro da série "Evolução do Turnover" ao clicar numa barra de setor (null = todos). */
  const [turnoverSetorFiltro, setTurnoverSetorFiltro] = useState<string | null>(null);
  const [empresaPainel, setEmpresaPainel] = useState(ORGANICO_EMPRESA_SO_ACO);
  const [generoFiltro, setGeneroFiltro] = useState<GeneroFiltro>(null);
  const [periodoFolha, setPeriodoFolha] = useState<DashboardPeriodo>(() => periodoPadraoExecutivo());
  const [folhaModalAberto, setFolhaModalAberto] = useState(false);
  const [turnoverModalAberto, setTurnoverModalAberto] = useState(false);
  const [movimentacoesPopoverAberto, setMovimentacoesPopoverAberto] = useState(false);
  const [movimentacoesLinhaModalAberto, setMovimentacoesLinhaModalAberto] = useState(false);
  const [retencaoExperienciaModalAberto, setRetencaoExperienciaModalAberto] = useState(false);
  const [avaliacaoExperienciaModalAberto, setAvaliacaoExperienciaModalAberto] = useState(false);
  const [periodoRetencaoExperiencia, setPeriodoRetencaoExperiencia] =
    useState<DashboardPeriodo>(() => periodoPadraoExecutivo());
  const [movimentacaoPontoSelecionado, setMovimentacaoPontoSelecionado] = useState<{
    year: number;
    month: number;
  } | null>(null);
  const [comparacaoTempoDesligamento, setComparacaoTempoDesligamento] =
    useState<ComparacaoTempoDesligamento>("acima");
  const [limiteDiasDesligamento, setLimiteDiasDesligamento] = useState(0);
  const [periodoMovimentacoes, setPeriodoMovimentacoes] = useState<DashboardPeriodo>(() => periodoPadraoExecutivo());
  const [setorHeadcountSelecionado, setSetorHeadcountSelecionado] = useState<string | null>(null);
  const [escolaridadeSelecionada, setEscolaridadeSelecionada] = useState<{
    nivelId: NivelEscolaridadeId;
    genero: GeneroEscolaridade;
  } | null>(null);
  const [coorteRetencaoSelecionada, setCoorteRetencaoSelecionada] = useState<{
    eixo: string;
    fatia: "retidos" | "desligados" | "avaliacao";
  } | null>(null);
  const [localidadeSelecionada, setLocalidadeSelecionada] = useState<SelecaoLocalidade | null>(null);
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
  const { data: complementosDesligamento = [] } = useQuery({
    queryKey: ["desligamentos-complementos"],
    queryFn: getDesligamentosComplementos,
    enabled: isApiConfigured(),
    staleTime: 30_000,
  });
  const podeVerFotosOrganico = canViewOrganicoPhotos();
  const { data: fotosResumo } = useQuery({
    queryKey: ["organico-fotos-resumo"],
    queryFn: getOrganicoFotosResumo,
    enabled:
      (setorHeadcountSelecionado != null ||
        escolaridadeSelecionada != null ||
        coorteRetencaoSelecionada != null ||
        localidadeSelecionada != null) &&
      isApiConfigured() &&
      podeVerFotosOrganico,
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
    () => {
      const fatorPessoas = folhaMensal.reduce((menorFator, ponto) => {
        if (ponto.ativos <= 0 || ponto.value <= 0) return menorFator;
        return Math.min(menorFator, (ponto.value / ponto.ativos) * 0.88);
      }, Number.POSITIVE_INFINITY);
      const fatorSeguro = Number.isFinite(fatorPessoas) ? fatorPessoas : 0;
      return folhaMensal.map((p) => ({
        ...p,
        eixo: `${p.month}/${String(p.year).slice(-2)}`,
        ativosExibicao: `${p.ativosAproximado ? "≈ " : ""}${formatIntPt(p.ativos)}`,
        ativosEscalados: p.ativos * fatorSeguro,
      }));
    },
    [folhaMensal],
  );
  const maiorCustoFolha = useMemo(
    () =>
      folhaChartData.reduce<(typeof folhaChartData)[number] | null>(
        (maior, ponto) => (!maior || ponto.value > maior.value ? ponto : maior),
        null,
      ),
    [folhaChartData],
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

  const pessoasRetencaoExperiencia = useMemo(() => {
    const organicoPorMatricula = new Map<string, (string | number)[]>();
    for (const registro of organicoDaEmpresa) {
      const values = Array.isArray(registro?.values) ? registro.values : [];
      const matricula = normalizeMatricula(values[ORGANICO_IDX.MATRICULA]);
      if (matricula) organicoPorMatricula.set(matricula, values);
    }
    const ehAprendiz = (values: unknown[]) =>
      [
        values[ORGANICO_IDX.VINCULO],
        values[ORGANICO_IDX.CARGO],
        values[ORGANICO_IDX.SITUACAO_TRABALHISTA],
      ]
        .map((valor) => String(valor ?? "").normalize("NFD").replace(/\p{M}/gu, "").toUpperCase())
        .some((valor) => valor.includes("APRENDIZ"));

    if (secullumDaEmpresa.length > 0) {
      return secullumDaEmpresa.map((pessoa) => {
        const values = organicoPorMatricula.get(normalizeMatricula(pessoa.numeroFolha)) ?? [];
        const aprendiz =
          ehAprendiz(values) ||
          String(pessoa.cargo ?? "").normalize("NFD").replace(/\p{M}/gu, "").toUpperCase().includes("APRENDIZ");
        const rowExistente = values.length > 0 ? values : null;
        const row: (string | number)[] = rowExistente ? [...rowExistente] : new Array(86).fill("");
        if (!rowExistente) {
          row[ORGANICO_IDX.MATRICULA] = String(pessoa.numeroFolha ?? "").trim();
          row[ORGANICO_IDX.NOME] = String(pessoa.nome ?? "").trim();
          row[ORGANICO_IDX.CARGO] = String(pessoa.cargo ?? "").trim();
          row[ORGANICO_IDX.SETOR] = String(pessoa.setor ?? "").trim();
          row[ORGANICO_IDX.AREA] = String(pessoa.area ?? "").trim();
          row[ORGANICO_IDX.ADMISSAO] = String(pessoa.admissao ?? "").trim();
        }
        return {
          admissao: String(pessoa.admissao ?? "").trim(),
          demissao: String(pessoa.demissao ?? "").trim(),
          aprendiz,
          row,
          key: normalizeMatricula(pessoa.numeroFolha) || String(pessoa.nome ?? "").trim(),
        };
      });
    }

    return organicoDaEmpresa.map((registro, index) => {
      const values = Array.isArray(registro?.values) ? registro.values : [];
      const matricula = String(values[ORGANICO_IDX.MATRICULA] ?? "").trim();
      return {
        admissao: String(values[ORGANICO_IDX.ADMISSAO] ?? "").trim(),
        demissao: String(demissaoByMatricula[matricula] ?? "").trim(),
        aprendiz: ehAprendiz(values),
        row: values,
        key: `${normalizeMatricula(matricula) || "semmat"}-${index}`,
      };
    });
  }, [demissaoByMatricula, organicoDaEmpresa, secullumDaEmpresa]);

  const retencaoExperiencia = useMemo(() => {
    const resumo: RetencaoExperienciaResumo = {
      retidos: 0,
      desligadosNaExperiencia: 0,
      emAvaliacao: 0,
      aprendizesExcluidos: 0,
    };
    const meses = mesesNoPeriodo(periodoRetencaoExperiencia.inicio, periodoRetencaoExperiencia.fim).map((mes) => ({
      ...mes,
      eixo: `${mes.label}/${String(mes.year).slice(-2)}`,
      retidos: 0,
      desligadosNaExperiencia: 0,
      emAvaliacao: 0,
      pessoasRetidos: [] as Array<{ row: (string | number)[]; demissao: string; key: string }>,
      pessoasDesligados: [] as Array<{ row: (string | number)[]; demissao: string; key: string }>,
      pessoasAvaliacao: [] as Array<{ row: (string | number)[]; demissao: string; key: string }>,
    }));
    const porMes = new Map(meses.map((mes) => [`${mes.year}-${mes.month}`, mes]));
    const emAvaliacao: Array<{ row: (string | number)[]; demissao: string; key: string }> = [];
    const hojeMs = inicioDoDia(hojePainel).getTime();

    for (const pessoa of pessoasRetencaoExperiencia) {
      const admissao = parseDateBR(pessoa.admissao);
      if (!dataDentroDoPeriodo(admissao, periodoRetencaoExperiencia.inicio, periodoRetencaoExperiencia.fim)) continue;
      if (!admissao) continue;
      if (pessoa.aprendiz) {
        resumo.aprendizesExcluidos += 1;
        continue;
      }

      const ponto = porMes.get(`${admissao.getFullYear()}-${admissao.getMonth()}`);
      if (!ponto) continue;
      const demissao = parseDateBR(pessoa.demissao);
      const diasAteDemissao = demissao
        ? Math.floor((inicioDoDia(demissao).getTime() - inicioDoDia(admissao).getTime()) / 86_400_000)
        : null;
      const diasDesdeAdmissao = Math.floor((hojeMs - inicioDoDia(admissao).getTime()) / 86_400_000);

      const card = { row: pessoa.row, demissao: pessoa.demissao, key: pessoa.key };
      if (diasAteDemissao != null && diasAteDemissao >= 0 && diasAteDemissao <= 90) {
        resumo.desligadosNaExperiencia += 1;
        ponto.desligadosNaExperiencia += 1;
        ponto.pessoasDesligados.push(card);
      } else if ((diasAteDemissao != null && diasAteDemissao > 90) || diasDesdeAdmissao > 90) {
        resumo.retidos += 1;
        ponto.retidos += 1;
        ponto.pessoasRetidos.push(card);
      } else {
        resumo.emAvaliacao += 1;
        ponto.emAvaliacao += 1;
        ponto.pessoasAvaliacao.push(card);
        emAvaliacao.push(card);
      }
    }
    emAvaliacao.sort((a, b) =>
      String(a.row[ORGANICO_IDX.NOME] ?? "").localeCompare(
        String(b.row[ORGANICO_IDX.NOME] ?? ""),
        "pt-BR",
      ),
    );

    const serie = meses.map((mes) => {
      const total = mes.retidos + mes.desligadosNaExperiencia + mes.emAvaliacao;
      return {
        ...mes,
        retidosPct: total > 0 ? (mes.retidos / total) * 100 : 0,
        desligadosPct: total > 0 ? (mes.desligadosNaExperiencia / total) * 100 : 0,
        avaliacaoPct: total > 0 ? (mes.emAvaliacao / total) * 100 : 0,
      };
    });
    return { resumo, serie, emAvaliacao };
  }, [hojePainel, periodoRetencaoExperiencia, pessoasRetencaoExperiencia]);
  const totalConclusivoRetencao =
    retencaoExperiencia.resumo.retidos + retencaoExperiencia.resumo.desligadosNaExperiencia;
  const taxaRetencaoExperiencia =
    totalConclusivoRetencao > 0
      ? (retencaoExperiencia.resumo.retidos / totalConclusivoRetencao) * 100
      : 0;
  const taxaDesligamentoExperiencia =
    totalConclusivoRetencao > 0 ? 100 - taxaRetencaoExperiencia : 0;
  const colaboradoresDaCoorte = useMemo(() => {
    if (!coorteRetencaoSelecionada) return [];
    const mes = retencaoExperiencia.serie.find((item) => item.eixo === coorteRetencaoSelecionada.eixo);
    if (!mes) return [];
    const lista =
      coorteRetencaoSelecionada.fatia === "retidos"
        ? mes.pessoasRetidos
        : coorteRetencaoSelecionada.fatia === "desligados"
          ? mes.pessoasDesligados
          : mes.pessoasAvaliacao;
    return [...lista].sort((a, b) =>
      String(a.row[ORGANICO_IDX.NOME] ?? "").localeCompare(String(b.row[ORGANICO_IDX.NOME] ?? ""), "pt-BR"),
    );
  }, [coorteRetencaoSelecionada, retencaoExperiencia.serie]);
  const rotuloFatiaCoorte =
    coorteRetencaoSelecionada?.fatia === "retidos"
      ? "Retidos após 90 dias"
      : coorteRetencaoSelecionada?.fatia === "desligados"
        ? "Desligados até 90 dias"
        : "Ainda em avaliação";

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
  const incluirDemissaoNoFiltro = useCallback(
    (pessoa: TurnoverPersonLike, demissao: Date) =>
      desligamentoAtendeTempo(
        pessoa.admissao,
        demissao,
        comparacaoTempoDesligamento,
        limiteDiasDesligamento,
      ),
    [comparacaoTempoDesligamento, limiteDiasDesligamento],
  );

  const turnoverKpi = useMemo(
    () => deriveTurnoverFromPeople(turnoverPeople, hojePainel, null, null, incluirDemissaoNoFiltro),
    [incluirDemissaoNoFiltro, turnoverPeople, hojePainel],
  );

  const novasAdmissoesLista = useMemo(
    () => listNovasAdmissoesMesAtual(organicoDaEmpresa),
    [organicoDaEmpresa],
  );
  const movimentacoesMesAtual = useMemo(() => {
    type MovimentacaoCard = {
      row: (string | number)[];
      demissao: string;
      motivoDemissao: string;
      key: string;
    };
    const admissoes: MovimentacaoCard[] = [];
    const desligamentos: MovimentacaoCard[] = [];
    const ano = hojePainel.getFullYear();
    const mes = hojePainel.getMonth();
    const noMesAtual = (valor: unknown) => {
      const data = parseDateBR(String(valor ?? "").trim());
      return data != null && data.getFullYear() === ano && data.getMonth() === mes;
    };

    const organicoPorMatricula = new Map<string, (string | number)[]>();
    for (const registro of organicoDaEmpresa) {
      const row = Array.isArray(registro?.values) ? registro.values : [];
      const chave = normalizeMatricula(row[ORGANICO_IDX.MATRICULA]);
      if (chave) organicoPorMatricula.set(chave, row);
    }

    if (secullumDaEmpresa.length > 0) {
      for (let index = 0; index < secullumDaEmpresa.length; index += 1) {
        const funcionario = secullumDaEmpresa[index];
        const matricula = String(funcionario.numeroFolha ?? "").trim();
        const chave = normalizeMatricula(matricula);
        const rowExistente = organicoPorMatricula.get(chave);
        const row: (string | number)[] = rowExistente ? [...rowExistente] : new Array(86).fill("");
        if (!rowExistente) {
          row[ORGANICO_IDX.MATRICULA] = matricula;
          row[ORGANICO_IDX.NOME] = String(funcionario.nome ?? "").trim();
          row[ORGANICO_IDX.CARGO] = String(funcionario.cargo ?? "").trim();
          row[ORGANICO_IDX.SETOR] = String(funcionario.setor ?? "").trim();
          row[ORGANICO_IDX.AREA] = String(funcionario.area ?? "").trim();
          row[ORGANICO_IDX.ADMISSAO] = String(funcionario.admissao ?? "").trim();
        }
        const demissao = String(funcionario.demissao ?? "").trim();
        const item = {
          row,
          demissao,
          motivoDemissao: String(funcionario.motivoDemissao ?? "").trim(),
          key: `${chave || "semmat"}-${index}`,
        };
        if (noMesAtual(funcionario.admissao)) admissoes.push(item);
        if (noMesAtual(demissao)) {
          row[ORGANICO_IDX.STATUS] = "Desligado";
          desligamentos.push(item);
        }
      }
    } else {
      for (let index = 0; index < novasAdmissoesLista.length; index += 1) {
        const row = novasAdmissoesLista[index];
        admissoes.push({
          row,
          demissao: "",
          motivoDemissao: "",
          key: `${normalizeMatricula(row[ORGANICO_IDX.MATRICULA]) || "semmat"}-${index}`,
        });
      }
      for (let index = 0; index < organicoDaEmpresa.length; index += 1) {
        const row = Array.isArray(organicoDaEmpresa[index]?.values) ? organicoDaEmpresa[index].values : [];
        const matricula = String(row[ORGANICO_IDX.MATRICULA] ?? "").trim();
        const demissao = String(demissaoByMatricula[matricula] ?? "").trim();
        if (!noMesAtual(demissao)) continue;
        desligamentos.push({
          row,
          demissao,
          motivoDemissao: "",
          key: `${normalizeMatricula(matricula) || "semmat"}-${index}`,
        });
      }
    }

    return { admissoes, desligamentos };
  }, [
    demissaoByMatricula,
    hojePainel,
    novasAdmissoesLista,
    organicoDaEmpresa,
    secullumDaEmpresa,
  ]);
  const movimentacoesLinhaData = useMemo(() => {
    const pontos = mesesNoPeriodo(periodoMovimentacoes.inicio, periodoMovimentacoes.fim).map((mes) => ({
      ...mes,
      eixo: `${mes.label}/${String(mes.year).slice(-2)}`,
      admissoes: 0,
      desligamentos: 0,
    }));
    const porMes = new Map(pontos.map((ponto) => [`${ponto.year}-${ponto.month}`, ponto]));
    const inicio = inicioDoDia(periodoMovimentacoes.inicio);
    const fim = fimDoDia(periodoMovimentacoes.fim);

    for (const pessoa of turnoverPeople) {
      const admissao = parseDateBR(String(pessoa.admissao ?? "").trim());
      if (admissao && dataDentroDoPeriodo(admissao, inicio, fim)) {
        const ponto = porMes.get(`${admissao.getFullYear()}-${admissao.getMonth()}`);
        if (ponto) ponto.admissoes += 1;
      }
      const demissao = parseDateBR(String(pessoa.demissao ?? "").trim());
      if (
        demissao &&
        dataDentroDoPeriodo(demissao, inicio, fim) &&
        incluirDemissaoNoFiltro(pessoa, demissao)
      ) {
        const ponto = porMes.get(`${demissao.getFullYear()}-${demissao.getMonth()}`);
        if (ponto) ponto.desligamentos += 1;
      }
    }

    return pontos;
  }, [incluirDemissaoNoFiltro, periodoMovimentacoes, turnoverPeople]);
  const totaisMovimentacoesLinha = useMemo(
    () =>
      movimentacoesLinhaData.reduce(
        (totais, ponto) => ({
          admissoes: totais.admissoes + ponto.admissoes,
          desligamentos: totais.desligamentos + ponto.desligamentos,
        }),
        { admissoes: 0, desligamentos: 0 },
      ),
    [movimentacoesLinhaData],
  );
  const colaboradoresMovimentacaoSelecionada = useMemo(() => {
    type MovimentacaoItem = {
      row: (string | number)[];
      demissao: string;
      motivoDemissao: string;
      key: string;
    };
    const resultado: {
      admissoes: MovimentacaoItem[];
      desligamentos: MovimentacaoItem[];
    } = { admissoes: [], desligamentos: [] };
    if (!movimentacaoPontoSelecionado) return resultado;
    const { year, month } = movimentacaoPontoSelecionado;
    const organicoPorMatricula = new Map<string, (string | number)[]>();
    for (const registro of organicoDaEmpresa) {
      const row = Array.isArray(registro?.values) ? registro.values : [];
      const chave = normalizeMatricula(row[ORGANICO_IDX.MATRICULA]);
      if (chave) organicoPorMatricula.set(chave, row);
    }

    const pertenceAoPonto = (valor: unknown) => {
      const data = parseDateBR(String(valor ?? "").trim());
      return data != null && data.getFullYear() === year && data.getMonth() === month;
    };

    if (secullumDaEmpresa.length > 0) {
      for (let index = 0; index < secullumDaEmpresa.length; index += 1) {
        const funcionario = secullumDaEmpresa[index];
        const matricula = String(funcionario.numeroFolha ?? "").trim();
        const chave = normalizeMatricula(matricula);
        const rowExistente = organicoPorMatricula.get(chave);
        const criarRow = () => {
          const row: (string | number)[] = rowExistente ? [...rowExistente] : new Array(86).fill("");
          if (!rowExistente) {
            row[ORGANICO_IDX.MATRICULA] = matricula;
            row[ORGANICO_IDX.NOME] = String(funcionario.nome ?? "").trim();
            row[ORGANICO_IDX.CARGO] = String(funcionario.cargo ?? "").trim();
            row[ORGANICO_IDX.SETOR] = String(funcionario.setor ?? "").trim();
            row[ORGANICO_IDX.AREA] = String(funcionario.area ?? "").trim();
            row[ORGANICO_IDX.ADMISSAO] = String(funcionario.admissao ?? "").trim();
          }
          return row;
        };
        const demissao = String(funcionario.demissao ?? "").trim();
        const motivoDemissao = String(funcionario.motivoDemissao ?? "").trim();
        if (pertenceAoPonto(funcionario.admissao)) {
          resultado.admissoes.push({
            row: criarRow(),
            demissao,
            motivoDemissao,
            key: `adm-${chave || "semmat"}-${index}`,
          });
        }
        const dataDemissao = parseDateBR(demissao);
        if (
          pertenceAoPonto(demissao) &&
          dataDemissao &&
          desligamentoAtendeTempo(
            funcionario.admissao,
            dataDemissao,
            comparacaoTempoDesligamento,
            limiteDiasDesligamento,
          )
        ) {
          const row = criarRow();
          row[ORGANICO_IDX.STATUS] = "Desligado";
          resultado.desligamentos.push({
            row,
            demissao,
            motivoDemissao,
            key: `desl-${chave || "semmat"}-${index}`,
          });
        }
      }
    } else {
      for (let index = 0; index < organicoDaEmpresa.length; index += 1) {
        const row = Array.isArray(organicoDaEmpresa[index]?.values) ? organicoDaEmpresa[index].values : [];
        const matricula = String(row[ORGANICO_IDX.MATRICULA] ?? "").trim();
        const demissao = String(demissaoByMatricula[matricula] ?? "").trim();
        const chave = normalizeMatricula(matricula) || "semmat";
        if (pertenceAoPonto(row[ORGANICO_IDX.ADMISSAO])) {
          resultado.admissoes.push({
            row: [...row],
            demissao,
            motivoDemissao: "",
            key: `adm-${chave}-${index}`,
          });
        }
        const dataDemissao = parseDateBR(demissao);
        if (
          pertenceAoPonto(demissao) &&
          dataDemissao &&
          desligamentoAtendeTempo(
            row[ORGANICO_IDX.ADMISSAO],
            dataDemissao,
            comparacaoTempoDesligamento,
            limiteDiasDesligamento,
          )
        ) {
          const rowDesligado = [...row];
          rowDesligado[ORGANICO_IDX.STATUS] = "Desligado";
          resultado.desligamentos.push({
            row: rowDesligado,
            demissao,
            motivoDemissao: "",
            key: `desl-${chave}-${index}`,
          });
        }
      }
    }

    const ordenar = (a: MovimentacaoItem, b: MovimentacaoItem) =>
      String(a.row[ORGANICO_IDX.NOME] ?? "").localeCompare(
        String(b.row[ORGANICO_IDX.NOME] ?? ""),
        "pt-BR",
      );
    resultado.admissoes.sort(ordenar);
    resultado.desligamentos.sort(ordenar);
    return resultado;
  }, [
    comparacaoTempoDesligamento,
    demissaoByMatricula,
    limiteDiasDesligamento,
    movimentacaoPontoSelecionado,
    organicoDaEmpresa,
    secullumDaEmpresa,
  ]);
  const matriculasAdmitidasEDesligadasNoMes = useMemo(() => {
    const admitidos = new Set(
      colaboradoresMovimentacaoSelecionada.admissoes
        .map((item) => normalizeMatricula(item.row[ORGANICO_IDX.MATRICULA]))
        .filter(Boolean),
    );
    return new Set(
      colaboradoresMovimentacaoSelecionada.desligamentos
        .map((item) => normalizeMatricula(item.row[ORGANICO_IDX.MATRICULA]))
        .filter((matricula) => matricula && admitidos.has(matricula)),
    );
  }, [colaboradoresMovimentacaoSelecionada]);

  const folhaNoFechamento = `em ${formatDiaMmmAno(hojePainel)}`;
  const periodoNoPadrao = (periodo: DashboardPeriodo) => {
    const padrao = periodoPadraoExecutivo();
    return toIsoLocal(periodo.inicio) === toIsoLocal(padrao.inicio) && toIsoLocal(periodo.fim) === toIsoLocal(padrao.fim);
  };
  const limparFiltrosDesabilitado =
    empresaPainel === ORGANICO_EMPRESA_SO_ACO &&
    generoFiltro === null &&
    periodoNoPadrao(periodoFolha) &&
    periodoNoPadrao(periodoTurnover) &&
    periodoNoPadrao(periodoMovimentacoes) &&
    periodoNoPadrao(periodoRetencaoExperiencia) &&
    comparacaoTempoDesligamento === "acima" &&
    limiteDiasDesligamento === 0;

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
    const movimentacoesInicio = parseIsoLocal(restore.movimentacoesInicio ?? "");
    const movimentacoesFim = parseIsoLocal(restore.movimentacoesFim ?? "");
    if (movimentacoesInicio && movimentacoesFim) {
      setPeriodoMovimentacoes({ inicio: movimentacoesInicio, fim: movimentacoesFim });
    }
    setComparacaoTempoDesligamento(
      restore.comparacaoTempoDesligamento === "abaixo" ? "abaixo" : "acima",
    );
    if (OPCOES_DIAS_DESLIGAMENTO.includes(restore.limiteDiasDesligamento as 0 | 15 | 30 | 45 | 60 | 90)) {
      setLimiteDiasDesligamento(restore.limiteDiasDesligamento as number);
    }
    setTurnoverSetorFiltro(restore.turnoverSetor);
    setSelectedTurnoverPoint(null);
    setSetorHeadcountSelecionado(null);
    setEscolaridadeSelecionada(null);
    setLocalidadeSelecionada(null);
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
        movimentacoesInicio: toIsoLocal(periodoMovimentacoes.inicio),
        movimentacoesFim: toIsoLocal(periodoMovimentacoes.fim),
        comparacaoTempoDesligamento,
        limiteDiasDesligamento,
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
      comparacaoTempoDesligamento,
      limiteDiasDesligamento,
      location.pathname,
      location.search,
      navigate,
      periodoFolha,
      periodoMovimentacoes,
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

  const turnoverSeriesForChart = useMemo(
    () =>
      deriveTurnoverFromPeople(
        turnoverPeople,
        periodoTurnover.fim,
        turnoverSetorFiltro,
        periodoTurnover,
        incluirDemissaoNoFiltro,
      ).turnoverData,
    [incluirDemissaoNoFiltro, turnoverPeople, turnoverSetorFiltro, periodoTurnover],
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

  const escolaridadeResumo = useMemo(() => {
    const pessoas: Array<{ grau: unknown; genero: GeneroEscolaridade | null }> = [];
    for (const registro of organicoDaEmpresa) {
      const row = Array.isArray(registro?.values) ? registro.values : [];
      const nome = String(row[ORGANICO_IDX.NOME] ?? "").trim();
      if (!nome) continue;
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
      pessoas.push({
        grau: row[ORGANICO_IDX.GRAU_INSTRUCAO],
        genero: generoDoSexo(row[ORGANICO_IDX.SEXO]),
        salario: salarioNaData(matricula, hojePainel, parseCtpsToNumber(row[ORGANICO_IDX.CTPS])),
      });
    }
    return montarEscolaridade(pessoas);
  }, [organicoDaEmpresa, demissaoByMatricula, hojePainel, salarioNaData]);

  const colaboradoresDaEscolaridade = useMemo(() => {
    if (!escolaridadeSelecionada) return [];
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
      if (classificarEscolaridade(row[ORGANICO_IDX.GRAU_INSTRUCAO]) !== escolaridadeSelecionada.nivelId) continue;
      if (generoDoSexo(row[ORGANICO_IDX.SEXO]) !== escolaridadeSelecionada.genero) continue;
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
  }, [escolaridadeSelecionada, organicoDaEmpresa, demissaoByMatricula, hojePainel]);

  const locaisColaboradores = useMemo(() => {
    const organicoPorMatricula = new Map<string, { row: (string | number)[]; rowIndex: number }>();
    organicoDaEmpresa.forEach((registro, index) => {
      const row = Array.isArray(registro?.values) ? registro.values : [];
      const chave = normalizeMatricula(row[ORGANICO_IDX.MATRICULA]);
      if (chave) organicoPorMatricula.set(chave, { row: row as (string | number)[], rowIndex: index });
    });

    const pessoas: Array<{
      uf: string;
      cidade: string;
      cidadeChave: string;
      bairro: string;
      bairroChave: string;
      endereco: string;
      logradouro: string;
      cep: string;
      matricula: string;
      nome: string;
      row: (string | number)[];
      demissao: string;
      rowIndex: number;
    }> = [];
    let semLocalidade = 0;
    let semBairro = 0;

    secullumDaEmpresa.forEach((funcionario, index) => {
      const matricula = String(funcionario.numeroFolha ?? "").trim();
      const demissao = String(funcionario.demissao ?? "").trim();
      const organico = organicoPorMatricula.get(normalizeMatricula(matricula));
      const statusDesligado = Boolean(funcionario.desligado) && !demissao;
      const ativo = colaboradorAtivoNaData(
        {
          admissao: parseDateBR(String(funcionario.admissao ?? organico?.row[ORGANICO_IDX.ADMISSAO] ?? "")),
          demissao: parseDateBR(demissao),
          statusDesligado,
        },
        hojePainel,
      );
      if (!ativo) return;
      const cidade = String(funcionario.cidade ?? "").trim();
      const bairro = String(funcionario.bairro ?? "").trim();
      const uf = inferirUf(
        String(funcionario.uf ?? ""),
        cidade,
        `${funcionario.endereco ?? ""} ${funcionario.logradouro ?? ""}`,
      );
      if (!/^[A-Z]{2}$/.test(uf) || !cidade) {
        semLocalidade += 1;
        return;
      }
      if (!bairro) semBairro += 1;
      const row = organico?.row ?? new Array<string | number>(86).fill("");
      if (!organico) {
        row[ORGANICO_IDX.MATRICULA] = matricula;
        row[ORGANICO_IDX.NOME] = String(funcionario.nome ?? "").trim();
        row[ORGANICO_IDX.CARGO] = String(funcionario.cargo ?? "").trim();
        row[ORGANICO_IDX.SETOR] = String(funcionario.setor ?? "").trim();
        row[ORGANICO_IDX.ADMISSAO] = String(funcionario.admissao ?? "").trim();
      }
      pessoas.push({
        uf,
        cidade,
        cidadeChave: chaveCidade(cidade),
        bairro,
        bairroChave: chaveCidade(bairro),
        endereco: String(funcionario.endereco ?? "").trim(),
        logradouro: String(funcionario.logradouro ?? "").trim(),
        cep: String(funcionario.cep ?? "").replace(/\D/g, ""),
        matricula,
        nome: String(row[ORGANICO_IDX.NOME] ?? funcionario.nome ?? "").trim(),
        row,
        demissao,
        rowIndex: organico?.rowIndex ?? index,
      });
    });

    return { pessoas, semLocalidade, semBairro };
  }, [secullumDaEmpresa, organicoDaEmpresa, hojePainel]);

  const colaboradoresDaLocalidade = useMemo(() => {
    if (!localidadeSelecionada) return [];
    return locaisColaboradores.pessoas
      .filter((pessoa) => {
        if (pessoa.uf !== localidadeSelecionada.uf) return false;
        if (localidadeSelecionada.cidade && pessoa.cidadeChave !== chaveCidade(localidadeSelecionada.cidade)) return false;
        if (localidadeSelecionada.matricula) return pessoa.matricula === localidadeSelecionada.matricula;
        if (localidadeSelecionada.bairroChave != null) return pessoa.bairroChave === localidadeSelecionada.bairroChave;
        return true;
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [localidadeSelecionada, locaisColaboradores]);

  const handleTurnoverPointClick = (payload: TurnoverPointPayload | undefined) => {
    const y = payload?.year;
    const m = payload?.month;
    if (typeof y !== "number" || typeof m !== "string") return;
    setSelectedTurnoverPoint({ year: y, month: m });
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

    const out: Array<{
      row: (string | number)[];
      demissao: string;
      motivoDemissao: string;
      key: string;
    }> = [];
    for (let i = 0; i < (secullumRows?.length ?? 0); i++) {
      const f = secullumRows?.[i];
      if (!f) continue;
      const demissao = String(f.demissao ?? "").trim();
      if (!demissao) continue;
      const d = parseDateBR(demissao);
      if (!d) continue;
      if (d.getFullYear() !== selectedTurnoverPoint.year || d.getMonth() !== monthIdx) continue;
      if (
        !desligamentoAtendeTempo(
          f.admissao,
          d,
          comparacaoTempoDesligamento,
          limiteDiasDesligamento,
        )
      ) {
        continue;
      }

      if (empresaPainel !== DASHBOARD_EMPRESA_TODAS && resolveEmpresaTabFromSecullumFuncionario(f) !== empresaPainel) {
        continue;
      }
      if (!dataDentroDoPeriodo(d, periodoTurnover.inicio, periodoTurnover.fim)) continue;

      const secSetor = String(f.setor ?? "").trim() || "Sem setor";
      if (turnoverSetorFiltro != null && secSetor !== turnoverSetorFiltro) continue;

      const matKey = normalizeMatricula(f.numeroFolha);
      const existing = orgByMat.get(matKey);
      const motivoDemissao = String(f.motivoDemissao ?? "").trim();
      if (existing) {
        out.push({ row: existing, demissao, motivoDemissao, key: `${matKey}-${i}` });
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
      out.push({ row, demissao, motivoDemissao, key: `${matKey || "semmat"}-${i}` });
    }

    out.sort((a, b) =>
      String(a.row[ORGANICO_IDX.NOME] ?? "").localeCompare(String(b.row[ORGANICO_IDX.NOME] ?? ""), "pt-BR")
    );
    return out;
  }, [
    comparacaoTempoDesligamento,
    empresaPainel,
    limiteDiasDesligamento,
    organicoRows,
    periodoTurnover,
    secullumRows,
    selectedTurnoverPoint,
    turnoverSetorFiltro,
  ]);

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
            setEscolaridadeSelecionada(null);
            setLocalidadeSelecionada(null);
          }}
          limparDesabilitado={limparFiltrosDesabilitado}
          onLimpar={() => {
            setEmpresaPainel(ORGANICO_EMPRESA_SO_ACO);
            setGeneroFiltro(null);
            setPeriodoFolha(periodoPadraoExecutivo());
            setPeriodoTurnover(periodoPadraoExecutivo());
            setPeriodoMovimentacoes(periodoPadraoExecutivo());
            setPeriodoRetencaoExperiencia(periodoPadraoExecutivo());
            setComparacaoTempoDesligamento("acima");
            setLimiteDiasDesligamento(0);
            setTurnoverSetorFiltro(null);
            setSelectedTurnoverPoint(null);
            setMovimentacaoPontoSelecionado(null);
            setSetorHeadcountSelecionado(null);
            setEscolaridadeSelecionada(null);
            setLocalidadeSelecionada(null);
          }}
        />

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
              change={
                limiteDiasDesligamento === 0
                  ? comparacaoTempoDesligamento === "acima"
                    ? "todos os desligamentos · 12 meses"
                    : "abaixo de 0 dias · 12 meses"
                  : `${comparacaoTempoDesligamento === "acima" ? "acima de" : "até"} ${limiteDiasDesligamento} dias · 12 meses`
              }
            changeType="neutral"
            icon={TrendingDown}
            alertColor="red"
          />
          </button>
        </div>

        <Dialog open={folhaModalAberto} onOpenChange={setFolhaModalAberto}>
          <DialogContent
            aria-describedby={undefined}
            className="flex h-[min(90vh,660px)] max-h-[90vh] w-[min(98vw,1200px)] max-w-none flex-col gap-4 overflow-hidden sm:max-w-none"
          >
            <DialogHeader className="shrink-0 pr-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 text-left">
                  <DialogTitle>Custo da folha mês a mês</DialogTitle>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {maiorCustoFolha && maiorCustoFolha.value > 0 ? (
                      <p className="flex flex-wrap items-center gap-1.5">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-sm"
                          style={{ background: `linear-gradient(180deg, ${chart.lineSecondary}, ${chart.danger})` }}
                          aria-hidden
                        />
                        Maior custo no período:
                        <strong className="font-semibold text-foreground">
                          {maiorCustoFolha.eixo} · {formatCurrencyBRLExact(maiorCustoFolha.value)}
                        </strong>
                      </p>
                    ) : null}
                    <p className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-300" aria-hidden />
                      Barra cinza: pessoas ativas (escala proporcional)
                    </p>
        </div>
                </div>
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
            <div className="min-h-0 w-full min-w-0 flex-1 overflow-x-auto overflow-y-hidden pb-3">
              <div
                className="h-full min-h-[460px] w-full pr-2"
                style={{ minWidth: `${Math.max(960, folhaChartData.length * 140)}px` }}
              >
                {folhaModalAberto ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={folhaChartData}
                      barCategoryGap="18%"
                      barGap={7}
                      margin={{ top: 30, right: 12, left: 4, bottom: 8 }}
                    >
                      <defs>
                        <linearGradient id="folhaBarExecutivo" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={chart.lineSecondary} />
                          <stop offset="100%" stopColor={chart.danger} />
                        </linearGradient>
                        <linearGradient id="ativosBarExecutivo" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={chart.neutralActive} />
                          <stop offset="100%" stopColor={chart.neutral} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                      <XAxis dataKey="eixo" tick={rhChartAxisTick(chart)} interval={0} />
                      <YAxis
                        tick={rhChartAxisTick(chart)}
                        width={72}
                        tickFormatter={(value) => formatCustoFolha(Number(value))}
                      />
                      <Tooltip content={FolhaMensalTooltip} />
                      <Bar
                        dataKey="value"
                        name="Folha"
                        fill="url(#folhaBarExecutivo)"
                        radius={[7, 7, 0, 0]}
                        maxBarSize={44}
                      >
                        <LabelList
                          dataKey="value"
                          position="top"
                          formatter={(value: number) => formatCustoFolhaCurto(Number(value))}
                          style={{ fill: chart.lineSecondary, fontSize: 10, fontWeight: 700 }}
                        />
                      </Bar>
                      <Bar
                        dataKey="ativosEscalados"
                        name="Pessoas ativas"
                        fill="url(#ativosBarExecutivo)"
                        radius={[7, 7, 0, 0]}
                        maxBarSize={44}
                      >
                        <LabelList
                          dataKey="ativosExibicao"
                          position="top"
                          style={{ fill: chart.neutralActive, fontSize: 9, fontWeight: 700 }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : null}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <KpiCard
            title="Média salarial (CTPS)"
            value={derived.mediaSalarialCtps > 0 ? formatCurrencyBRLExact(derived.mediaSalarialCtps) : formatCurrencyBRLExact(0)}
            change={folhaNoFechamento}
            changeType="neutral"
            icon={Wallet}
          />
          <Popover open={movimentacoesPopoverAberto} onOpenChange={setMovimentacoesPopoverAberto}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="w-full text-left rounded-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label="Ver admissões e desligamentos deste mês"
              >
                <KpiCard
                  title="Admissões vs Desligamentos"
                  value={`${formatIntPt(movimentacoesMesAtual.admissoes.length)} / ${formatIntPt(
                    movimentacoesMesAtual.desligamentos.length,
                  )}`}
                  change="neste mês · adm. / desl."
                  changeType="neutral"
                  icon={ArrowUpDown}
                  alertColor="yellow"
                />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-[min(94vw,980px)] max-h-[min(78vh,620px)] overflow-y-auto p-4"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="label-industrial">Movimentações deste mês</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMovimentacoesPopoverAberto(false);
                    setMovimentacoesLinhaModalAberto(true);
                  }}
                >
                  Ver linha temporal
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {[
                  {
                    titulo: "Admissões",
                    vazio: "Nenhuma admissão neste mês.",
                    itens: movimentacoesMesAtual.admissoes,
                    cor: "text-emerald-400",
                  },
                  {
                    titulo: "Desligamentos",
                    vazio: "Nenhum desligamento neste mês.",
                    itens: movimentacoesMesAtual.desligamentos,
                    cor: "text-orange-400",
                  },
                ].map((grupo) => (
                  <section key={grupo.titulo} className="min-w-0">
                    <div className="mb-3 flex items-center justify-between gap-3 border-b border-border pb-2">
                      <span className={`text-sm font-semibold ${grupo.cor}`}>{grupo.titulo}</span>
                      <span className="tabular-nums text-xs text-muted-foreground">
                        {formatIntPt(grupo.itens.length)}
                      </span>
                    </div>
                    {grupo.itens.length === 0 ? (
                      <p className="rounded-sm border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                        {grupo.vazio}
                </p>
              ) : (
                      <div className="space-y-3">
                        {grupo.itens.map((item, index) => (
                    <button
                            key={`${grupo.titulo}-${item.key}`}
                      type="button"
                      onClick={() => {
                              const matricula = String(item.row[ORGANICO_IDX.MATRICULA] ?? "").trim();
                              abrirColaboradorNoOrganico(matricula);
                      }}
                            className="w-full rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            aria-label={`Abrir colaborador de ${grupo.titulo.toLowerCase()} no orgânico`}
                    >
                      <OrganicoCard
                              row={item.row}
                              rowIndex={index}
                              demissao={item.demissao}
                              motivoSecullum={grupo.titulo === "Desligamentos" ? item.motivoDemissao : undefined}
                              complementoDesligamento={
                                grupo.titulo === "Desligamentos"
                                  ? escolherComplementoDesligamento(
                                      complementosDesligamento,
                                      String(item.row[ORGANICO_IDX.MATRICULA] ?? ""),
                                      item.demissao,
                                    )?.motivoFilho ?? ""
                                  : undefined
                              }
                        readOnly
                      />
                    </button>
                  ))}
                </div>
              )}
                  </section>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <KpiCard
            title="Idade média"
            value={`${derived.mediaIdadeAnos.toLocaleString("pt-BR", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 1,
            })} anos`}
            change={folhaNoFechamento}
            changeType="neutral"
            icon={CalendarDays}
            alertColor="yellow"
          />
        </div>

        <Dialog
          open={movimentacoesLinhaModalAberto}
          onOpenChange={(aberto) => {
            setMovimentacoesLinhaModalAberto(aberto);
            if (!aberto) setMovimentacaoPontoSelecionado(null);
          }}
        >
          <DialogContent
            aria-describedby={undefined}
            className="flex max-h-[min(92vh,760px)] w-[min(96vw,1100px)] max-w-none flex-col gap-5 overflow-hidden sm:max-w-none"
          >
            <DialogHeader className="shrink-0 border-b border-border pb-4 pr-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 text-left">
                  <DialogTitle>Linha temporal de admissões e desligamentos</DialogTitle>
                  <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chart.success }} />
                      Admissões:
                      <strong className="text-foreground">{formatIntPt(totaisMovimentacoesLinha.admissoes)}</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chart.danger }} />
                      Desligamentos:
                      <strong className="text-foreground">{formatIntPt(totaisMovimentacoesLinha.desligamentos)}</strong>
                    </span>
                  </div>
                </div>
                <DashboardPeriodoDatas
                  idPrefix="movimentacoes"
                  periodo={periodoMovimentacoes}
                  onPeriodoChange={(periodo) => {
                    setPeriodoMovimentacoes(periodo);
                    setMovimentacaoPontoSelecionado(null);
                  }}
                />
              </div>
              <FiltroTempoDesligamento
                comparacao={comparacaoTempoDesligamento}
                limiteDias={limiteDiasDesligamento}
                onComparacaoChange={(comparacao) => {
                  setComparacaoTempoDesligamento(comparacao);
                  setMovimentacaoPontoSelecionado(null);
                }}
                onLimiteDiasChange={(dias) => {
                  setLimiteDiasDesligamento(dias);
                  setMovimentacaoPontoSelecionado(null);
                }}
              />
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden rounded-sm border border-border/50 bg-muted/10 p-3">
              <div
                className="h-[440px]"
                style={{ minWidth: `${Math.max(760, movimentacoesLinhaData.length * 76)}px` }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={movimentacoesLinhaData}
                    margin={{ top: 24, right: 24, left: 0, bottom: 8 }}
                    onClick={(state) => {
                      const payload = (
                        state as {
                          activePayload?: Array<{ payload?: { year?: number; month?: number } }>;
                        }
                      )?.activePayload?.[0]?.payload;
                      if (typeof payload?.year !== "number" || typeof payload.month !== "number") return;
                      setMovimentacaoPontoSelecionado({ year: payload.year, month: payload.month });
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                    <XAxis dataKey="eixo" tick={rhChartAxisTick(chart)} interval={0} />
                    <YAxis tick={rhChartAxisTick(chart)} allowDecimals={false} width={42} />
                    <Tooltip
                      contentStyle={rhChartTooltipStyle(chart)}
                      labelStyle={{ color: chart.tooltipText }}
                      itemStyle={{ color: chart.tooltipText }}
                      formatter={(value: number, name: string) => [
                        formatIntPt(Number(value)),
                        name === "admissoes" ? "Admissões" : "Desligamentos",
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="admissoes"
                      stroke={chart.success}
                      strokeWidth={3}
                      dot={(props: { cx?: number; cy?: number; payload?: { year: number; month: number }; index?: number }) => (
                        <g
                          key={`adm-${props.payload?.year}-${props.payload?.month}-${props.index ?? 0}`}
                          onClick={() => {
                            if (!props.payload) return;
                            setMovimentacaoPontoSelecionado({ ...props.payload });
                          }}
                          style={{ cursor: "pointer" }}
                        >
                          <circle cx={props.cx} cy={props.cy} r={12} fill="transparent" />
                          <circle cx={props.cx} cy={props.cy} r={4} fill={chart.success} />
                        </g>
                      )}
                      activeDot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="desligamentos"
                      stroke={chart.danger}
                      strokeWidth={3}
                      dot={(props: { cx?: number; cy?: number; payload?: { year: number; month: number }; index?: number }) => (
                        <g
                          key={`desl-${props.payload?.year}-${props.payload?.month}-${props.index ?? 0}`}
                          onClick={() => {
                            if (!props.payload) return;
                            setMovimentacaoPontoSelecionado({ ...props.payload });
                          }}
                          style={{ cursor: "pointer" }}
                        >
                          <circle cx={props.cx} cy={props.cy} r={12} fill="transparent" />
                          <circle cx={props.cx} cy={props.cy} r={4} fill={chart.danger} />
                        </g>
                      )}
                      activeDot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={movimentacaoPontoSelecionado != null}
          onOpenChange={(aberto) => {
            if (!aberto) setMovimentacaoPontoSelecionado(null);
          }}
        >
          <DialogContent
            aria-describedby={undefined}
            className="flex max-h-[min(90vh,780px)] w-[min(94vw,980px)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
          >
            <DialogHeader className="shrink-0 border-b border-border px-6 py-5 text-left">
              <DialogTitle>
                Admissões e desligamentos —{" "}
                {movimentacaoPontoSelecionado
                  ? `${MESES_LABEL[movimentacaoPontoSelecionado.month]}/${movimentacaoPontoSelecionado.year}`
                  : ""}
              </DialogTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatIntPt(colaboradoresMovimentacaoSelecionada.admissoes.length)} admissões ·{" "}
                {formatIntPt(colaboradoresMovimentacaoSelecionada.desligamentos.length)} desligamentos
              </p>
            </DialogHeader>
            <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
              {[
                {
                  titulo: "Admitidos",
                  itens: colaboradoresMovimentacaoSelecionada.admissoes,
                  vazio: "Nenhuma admissão neste mês.",
                  cor: "text-emerald-400",
                  mostrarMotivo: false,
                },
                {
                  titulo: "Desligados",
                  itens: colaboradoresMovimentacaoSelecionada.desligamentos,
                  vazio: "Nenhum desligamento neste mês para o filtro atual.",
                  cor: "text-red-400",
                  mostrarMotivo: true,
                },
              ].map((grupo, grupoIndex) => (
                <section
                  key={grupo.titulo}
                  className={`flex min-h-0 flex-col ${grupoIndex > 0 ? "border-t border-border lg:border-l lg:border-t-0" : ""}`}
                >
                  <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/20 px-5 py-3">
                    <span className={`text-sm font-semibold ${grupo.cor}`}>{grupo.titulo}</span>
                    <span className="tabular-nums text-xs text-muted-foreground">
                      {formatIntPt(grupo.itens.length)}
                    </span>
                  </div>
                  <div className="min-h-[180px] flex-1 space-y-4 overflow-y-auto p-5">
                    {grupo.itens.length === 0 ? (
                      <p className="rounded-sm border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                        {grupo.vazio}
                      </p>
                    ) : (
                      grupo.itens.map((item, index) => {
                        const matriculaNormalizada = normalizeMatricula(item.row[ORGANICO_IDX.MATRICULA]);
                        const admitidoEDesligado = matriculasAdmitidasEDesligadasNoMes.has(matriculaNormalizada);
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => {
                              const matricula = String(item.row[ORGANICO_IDX.MATRICULA] ?? "").trim();
                              abrirColaboradorNoOrganico(matricula);
                            }}
                            className={`w-full rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                              admitidoEDesligado
                                ? "border border-amber-400/45 bg-amber-400/[0.06] p-1.5 shadow-[0_0_0_1px_rgba(251,191,36,0.08)]"
                                : ""
                            }`}
                            aria-label={`Abrir colaborador ${grupo.titulo.toLowerCase()} no orgânico`}
                          >
                            {admitidoEDesligado ? (
                              <span className="mb-1.5 inline-flex rounded-sm bg-amber-400/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                                Admitido e desligado no mesmo mês
                              </span>
                            ) : null}
                            <OrganicoCard
                              row={item.row}
                              rowIndex={index}
                              demissao={item.demissao}
                              motivoSecullum={grupo.mostrarMotivo ? item.motivoDemissao : undefined}
                              complementoDesligamento={
                                grupo.mostrarMotivo
                                  ? escolherComplementoDesligamento(
                                      complementosDesligamento,
                                      String(item.row[ORGANICO_IDX.MATRICULA] ?? ""),
                                      item.demissao,
                                    )?.motivoFilho ?? ""
                                  : undefined
                              }
                              readOnly
                            />
                          </button>
                        );
                      })
                    )}
                  </div>
                </section>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={turnoverModalAberto}
          onOpenChange={(aberto) => {
            setTurnoverModalAberto(aberto);
            if (!aberto) setSelectedTurnoverPoint(null);
          }}
        >
          <DialogContent aria-describedby={undefined} className="flex max-h-[min(92vh,820px)] w-[min(96vw,1100px)] max-w-none flex-col gap-4 overflow-y-auto sm:max-w-none">
            <DialogHeader className="border-b border-border pb-4 pr-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
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
              <FiltroTempoDesligamento
                comparacao={comparacaoTempoDesligamento}
                limiteDias={limiteDiasDesligamento}
                onComparacaoChange={(comparacao) => {
                  setComparacaoTempoDesligamento(comparacao);
                  setSelectedTurnoverPoint(null);
                }}
                onLimiteDiasChange={(dias) => {
                  setLimiteDiasDesligamento(dias);
                  setSelectedTurnoverPoint(null);
                }}
              />
            </DialogHeader>
            <div className="min-w-0">
            <div className="relative h-[320px] w-full min-w-0">
              {turnoverModalAberto ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={turnoverChartData} margin={{ top: 28, right: 24, left: 0, bottom: 0 }}>
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
                        onClick={() => handleTurnoverPointClick(props.payload)}
                        style={{ cursor: "pointer" }}
                      >
                        <circle cx={props.cx} cy={props.cy} r={10} fill="transparent" />
                        <circle cx={props.cx} cy={props.cy} r={3} fill={chart.lineDot} />
                      </g>
                    )}
                    activeDot={(props: { cx?: number; cy?: number; payload?: TurnoverPointPayload; index?: number }) => (
                      <g
                        key={`active-dot-${props.payload?.year}-${props.payload?.month}-${props.index ?? 0}`}
                        onClick={() => handleTurnoverPointClick(props.payload)}
                        style={{ cursor: "pointer" }}
                      >
                        <circle cx={props.cx} cy={props.cy} r={12} fill="transparent" />
                        <circle cx={props.cx} cy={props.cy} r={5} fill={chart.lineDotActive} stroke={chart.dotStrokeActive} strokeWidth={2} />
                      </g>
                    )}
                  >
                    <LabelList
                      dataKey="value"
                      position="top"
                      offset={10}
                      formatter={(value: number) => `${Number(value).toLocaleString("pt-BR", {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 1,
                      })}%`}
                      style={{ fill: chart.axisCategory, fontSize: 10, fontWeight: 700 }}
                    />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
              ) : null}
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
          </DialogContent>
        </Dialog>

        <Dialog
          open={selectedTurnoverPoint != null}
          onOpenChange={(aberto) => {
            if (!aberto) setSelectedTurnoverPoint(null);
          }}
        >
          <DialogContent
            aria-describedby={undefined}
            className="flex max-h-[min(90vh,780px)] w-[min(94vw,980px)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
          >
            <DialogHeader className="shrink-0 border-b border-border px-6 py-5 text-left">
              <DialogTitle>
                Desligamentos em {selectedTurnoverPoint?.month}/
                {selectedTurnoverPoint ? String(selectedTurnoverPoint.year).slice(-2) : ""}
                {turnoverSetorFiltro ? ` · ${turnoverSetorFiltro}` : ""}
              </DialogTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatIntPt(desligadosByTurnoverPoint.length)}{" "}
                {desligadosByTurnoverPoint.length === 1 ? "colaborador desligado" : "colaboradores desligados"}
              </p>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              {desligadosByTurnoverPoint.length === 0 ? (
                <p className="rounded-sm border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                  Nenhum colaborador desligado neste período.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {desligadosByTurnoverPoint.map((item, index) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        const matricula = String(item.row[ORGANICO_IDX.MATRICULA] ?? "").trim();
                        abrirColaboradorNoOrganico(matricula);
                      }}
                      className="rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      aria-label="Abrir colaborador desligado no orgânico"
                    >
                      <OrganicoCard
                        row={item.row}
                        rowIndex={index}
                        demissao={item.demissao}
                        motivoSecullum={item.motivoDemissao}
                        complementoDesligamento={
                          escolherComplementoDesligamento(
                            complementosDesligamento,
                            String(item.row[ORGANICO_IDX.MATRICULA] ?? ""),
                            item.demissao,
                          )?.motivoFilho ?? ""
                        }
                        readOnly
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={retencaoExperienciaModalAberto}
          onOpenChange={(aberto) => {
            setRetencaoExperienciaModalAberto(aberto);
            if (!aberto) {
              setAvaliacaoExperienciaModalAberto(false);
              setCoorteRetencaoSelecionada(null);
            }
          }}
        >
          <DialogContent
            aria-describedby={undefined}
            className="flex max-h-[min(92vh,780px)] w-[min(96vw,1100px)] max-w-none flex-col gap-5 overflow-hidden sm:max-w-none"
          >
            <DialogHeader className="shrink-0 border-b border-border pb-4 pr-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 text-left">
                  <DialogTitle>Retenção pós-experiência</DialogTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Coortes agrupadas pelo mês de admissão. Aprendizes não entram na taxa.
                  </p>
                </div>
                <DashboardPeriodoDatas
                  idPrefix="retencao-experiencia"
                  periodo={periodoRetencaoExperiencia}
                  onPeriodoChange={(periodo) => {
                    setPeriodoRetencaoExperiencia(periodo);
                    setAvaliacaoExperienciaModalAberto(false);
                    setCoorteRetencaoSelecionada(null);
                  }}
                />
              </div>
            </DialogHeader>

            <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-sm border border-emerald-600/25 bg-emerald-600/10 px-4 py-3">
                <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: chart.success }}>
                  Retidos após 90 dias
                </span>
                <p className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: chart.success }}>
                  {taxaRetencaoExperiencia.toLocaleString("pt-BR", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatIntPt(retencaoExperiencia.resumo.retidos)} colaboradores
                </p>
              </div>
              <div className="rounded-sm border border-red-600/25 bg-red-600/10 px-4 py-3">
                <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: chart.danger }}>
                  Desligados até 90 dias
                </span>
                <p className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: chart.danger }}>
                  {taxaDesligamentoExperiencia.toLocaleString("pt-BR", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatIntPt(retencaoExperiencia.resumo.desligadosNaExperiencia)} colaboradores
                </p>
              </div>
              <button
                type="button"
                className="rounded-sm border border-border bg-muted/40 px-4 py-3 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Ver colaboradores ainda em avaliação"
                onClick={() => setAvaliacaoExperienciaModalAberto(true)}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
                  Ainda em avaliação
                </span>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {formatIntPt(retencaoExperiencia.resumo.emAvaliacao)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Clique para ver os colaboradores
                </p>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden rounded-sm border border-border/50 bg-muted/10 p-3">
              <div
                className="h-[360px]"
                style={{ minWidth: `${Math.max(760, retencaoExperiencia.serie.length * 86)}px` }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={retencaoExperiencia.serie}
                    margin={{ top: 20, right: 20, left: 0, bottom: 8 }}
                    barCategoryGap="28%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                    <XAxis dataKey="eixo" tick={rhChartAxisTick(chart)} interval={0} />
                    <YAxis
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                      tick={rhChartAxisTick(chart)}
                      tickFormatter={(value) => `${value}%`}
                      width={42}
                    />
                    <Tooltip
                      contentStyle={rhChartTooltipStyle(chart)}
                      labelStyle={{ color: chart.tooltipText }}
                      itemStyle={{ color: chart.tooltipText }}
                      formatter={(value: number, name: string) => {
                        const labels: Record<string, string> = {
                          retidosPct: "Retidos após 90 dias",
                          desligadosPct: "Desligados até 90 dias",
                          avaliacaoPct: "Ainda em avaliação",
                        };
                        return [
                          `${Number(value).toLocaleString("pt-BR", {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })}%`,
                          labels[name] ?? name,
                        ];
                      }}
                    />
                    <Bar
                      dataKey="retidosPct"
                      stackId="coorte"
                      fill={chart.success}
                      cursor="pointer"
                      onClick={(item) => {
                        const row = (item as { payload?: { eixo?: string; retidos?: number } })?.payload;
                        if (!row?.eixo || !row.retidos) return;
                        setCoorteRetencaoSelecionada({ eixo: row.eixo, fatia: "retidos" });
                      }}
                    />
                    <Bar
                      dataKey="desligadosPct"
                      stackId="coorte"
                      fill={chart.danger}
                      cursor="pointer"
                      onClick={(item) => {
                        const row = (item as { payload?: { eixo?: string; desligadosNaExperiencia?: number } })?.payload;
                        if (!row?.eixo || !row.desligadosNaExperiencia) return;
                        setCoorteRetencaoSelecionada({ eixo: row.eixo, fatia: "desligados" });
                      }}
                    />
                    <Bar
                      dataKey="avaliacaoPct"
                      stackId="coorte"
                      fill={chart.neutral}
                      radius={[5, 5, 0, 0]}
                      cursor="pointer"
                      onClick={(item) => {
                        const row = (item as { payload?: { eixo?: string; emAvaliacao?: number } })?.payload;
                        if (!row?.eixo || !row.emAvaliacao) return;
                        setCoorteRetencaoSelecionada({ eixo: row.eixo, fatia: "avaliacao" });
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                Taxa conclusiva: {formatIntPt(totalConclusivoRetencao)} colaboradores com resultado conhecido. Clique na faixa da barra para ver os cards.
              </span>
              {retencaoExperiencia.resumo.aprendizesExcluidos > 0 ? (
                <span>
                  {formatIntPt(retencaoExperiencia.resumo.aprendizesExcluidos)} aprendizes fora da taxa.
                </span>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={coorteRetencaoSelecionada != null}
          onOpenChange={(aberto) => {
            if (!aberto) setCoorteRetencaoSelecionada(null);
          }}
        >
          <DialogContent
            aria-describedby={undefined}
            className="flex max-h-[min(90vh,780px)] w-[min(94vw,980px)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
          >
            <DialogHeader className="shrink-0 border-b border-border px-6 py-5 text-left">
              <DialogTitle>
                {coorteRetencaoSelecionada?.eixo} — {rotuloFatiaCoorte}
              </DialogTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatIntPt(colaboradoresDaCoorte.length)}{" "}
                {colaboradoresDaCoorte.length === 1 ? "colaborador admitido neste mês" : "colaboradores admitidos neste mês"}
              </p>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              {colaboradoresDaCoorte.length === 0 ? (
                <p className="rounded-sm border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                  Nenhum colaborador nesta faixa.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {colaboradoresDaCoorte.map((item, index) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        const matricula = String(item.row[ORGANICO_IDX.MATRICULA] ?? "").trim();
                        abrirColaboradorNoOrganico(matricula);
                      }}
                      className="rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      aria-label="Abrir colaborador da coorte no orgânico"
                    >
                      <OrganicoCard
                        row={item.row}
                        rowIndex={index}
                        demissao={item.demissao}
                        fotoCadastrada={matriculasComFoto.has(String(item.row[ORGANICO_IDX.MATRICULA] ?? "").trim())}
                        fotoApiHabilitada={podeVerFotosOrganico && isApiConfigured()}
                        readOnly
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={avaliacaoExperienciaModalAberto} onOpenChange={setAvaliacaoExperienciaModalAberto}>
          <DialogContent
            aria-describedby={undefined}
            className="flex max-h-[min(90vh,780px)] w-[min(94vw,980px)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
          >
            <DialogHeader className="shrink-0 border-b border-border px-6 py-5 text-left">
              <DialogTitle>Ainda em avaliação</DialogTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatIntPt(retencaoExperiencia.emAvaliacao.length)}{" "}
                {retencaoExperiencia.emAvaliacao.length === 1
                  ? "colaborador admitido há até 90 dias e ainda ativo"
                  : "colaboradores admitidos há até 90 dias e ainda ativos"}
              </p>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              {retencaoExperiencia.emAvaliacao.length === 0 ? (
                <p className="rounded-sm border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                  Nenhum colaborador em avaliação neste período.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {retencaoExperiencia.emAvaliacao.map((item, index) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        const matricula = String(item.row[ORGANICO_IDX.MATRICULA] ?? "").trim();
                        abrirColaboradorNoOrganico(matricula);
                      }}
                      className="rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      aria-label="Abrir colaborador em avaliação no orgânico"
                    >
                      <OrganicoCard
                        row={item.row}
                        rowIndex={index}
                        demissao={item.demissao}
                        readOnly
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
          <div className="h-full">
            <DistribuicaoExperienciaCard
              resumo={retencaoExperiencia.resumo}
              referencia="coortes do período"
              onOpen={() => setRetencaoExperienciaModalAberto(true)}
            />
          </div>
          <DistribuicaoGeneroCard
            contagem={generoAtivos}
            referencia={folhaNoFechamento}
            filtro={generoFiltro}
            onFiltroChange={(filtro) => {
              setGeneroFiltro(filtro);
              setTurnoverSetorFiltro(null);
              setSelectedTurnoverPoint(null);
              setSetorHeadcountSelecionado(null);
              setEscolaridadeSelecionada(null);
              setLocalidadeSelecionada(null);
            }}
          />

          <div className="grid grid-cols-1 items-stretch gap-6 lg:col-span-2 lg:grid-cols-2">
          <div className="relative min-h-[360px]">
          <div className="flex h-[min(640px,75vh)] min-h-[360px] flex-col overflow-hidden border border-border bg-card p-6 shadow-level-1 lg:absolute lg:inset-0 lg:h-auto lg:max-h-none lg:min-h-0">
            <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="label-industrial">Pessoas por Setor</span>
              <span className="text-xs text-muted-foreground">
                {formatIntPt(derived.setoresAtivos)}{" "}
                {derived.setoresAtivos === 1 ? "setor no filtro atual" : "setores no filtro atual"}
              </span>
            </div>
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-sm border border-border/40 bg-muted/20 pr-1">
              <div style={{ height: headcountChartHeight }}>
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

          <EscolaridadeCard
            resumo={escolaridadeResumo}
            referencia={folhaNoFechamento}
            onSelect={setEscolaridadeSelecionada}
          />
          </div>

        </div>

        <div className="mt-6">
          <MapaLocalidadeCard
            pessoas={locaisColaboradores.pessoas}
            semLocalidade={locaisColaboradores.semLocalidade}
            semBairro={locaisColaboradores.semBairro}
            referencia={folhaNoFechamento}
            onSelect={setLocalidadeSelecionada}
          />
        </div>

        <Dialog
          open={localidadeSelecionada != null}
          onOpenChange={(open) => {
            if (!open) setLocalidadeSelecionada(null);
          }}
        >
          <DialogContent
            aria-describedby={undefined}
            className="flex max-h-[min(92vh,820px)] w-[min(96vw,1100px)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
          >
            <DialogHeader className="shrink-0 border-b border-border px-6 py-5 text-left">
              <DialogTitle className="text-lg">
                Colaboradores — {localidadeSelecionada?.rotulo ?? ""}
              </DialogTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {colaboradoresDaLocalidade.length.toLocaleString("pt-BR")}{" "}
                {colaboradoresDaLocalidade.length === 1 ? "colaborador ativo" : "colaboradores ativos"}
                {" · "}
                {folhaNoFechamento}
              </p>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto bg-muted/15 px-6 py-5">
              {colaboradoresDaLocalidade.length === 0 ? (
                <p className="rounded-sm border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                  Nenhum colaborador ativo encontrado nesta localidade.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {colaboradoresDaLocalidade.map((colaborador) => (
                    <button
                      key={`${colaborador.matricula || colaborador.nome}-${colaborador.rowIndex}`}
                      type="button"
                      onClick={() => abrirColaboradorNoOrganico(colaborador.matricula)}
                      className="rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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

        <Dialog
          open={escolaridadeSelecionada != null}
          onOpenChange={(open) => {
            if (!open) setEscolaridadeSelecionada(null);
          }}
        >
          <DialogContent
            aria-describedby={undefined}
            className="flex max-h-[min(92vh,820px)] w-[min(96vw,1100px)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
          >
            <DialogHeader className="shrink-0 border-b border-border px-6 py-5 text-left">
              <DialogTitle className="text-lg">
                {escolaridadeSelecionada
                  ? `${rotuloNivelEscolaridade(escolaridadeSelecionada.nivelId)} — ${
                      escolaridadeSelecionada.genero === "masculino" ? "Homens" : "Mulheres"
                    }`
                  : "Escolaridade"}
              </DialogTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {colaboradoresDaEscolaridade.length.toLocaleString("pt-BR")}{" "}
                {colaboradoresDaEscolaridade.length === 1 ? "colaborador ativo" : "colaboradores ativos"}
                {" · "}
                {folhaNoFechamento}
              </p>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto bg-muted/15 px-6 py-5">
              {colaboradoresDaEscolaridade.length === 0 ? (
                <p className="rounded-sm border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                  Nenhum colaborador ativo encontrado neste nível.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {colaboradoresDaEscolaridade.map((colaborador) => (
                    <button
                      key={`${colaborador.matricula || colaborador.nome}-${colaborador.rowIndex}`}
                      type="button"
                      onClick={() => {
                        abrirColaboradorNoOrganico(colaborador.matricula);
                      }}
                      className="rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
