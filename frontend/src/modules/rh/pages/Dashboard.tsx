import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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
} from "recharts";
import { Button } from "@rh/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@rh/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@rh/components/ui/tabs";
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipTrigger,
} from "@rh/components/ui/tooltip";
import { getOrganico, getSecullumFuncionarios, isApiConfigured } from "@rh/lib/api-client";
import { canEditDashboardModule, canViewDashboardModule } from "@rh/lib/route-permissions";
import {
  buildDashboardFromOrganico,
  deriveTurnoverFromPeople,
  listNovasAdmissoesMesAtual,
  listTurnoverPeopleFromOrganico,
  type TurnoverSeriesPoint,
} from "@rh/lib/dashboard-from-organico";
import AbsenteismoDashboard from "@rh/pages/AbsenteismoDashboard";
import DiagnosticoGeralAusenciasJustificadas from "@rh/pages/DiagnosticoGeralAusenciasJustificadas";
import AbsenteismoPorHorasTab from "@rh/pages/FaltasAtestados/absenteismo-por-horas/AbsenteismoPorHorasTab";
import { OrganicoCard } from "@rh/pages/Organico/OrganicoCard";
import { ORGANICO_IDX, parseDateBR } from "@rh/pages/Organico/organico-derive";
import {
  rhChartAxisTick,
  rhChartCategoryTick,
  rhChartTooltipStyle,
  useRhChartTheme,
} from "@rh/lib/chart-theme";

const MESES_LABEL = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"] as const;

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

  const demissaoByMatricula = useMemo(() => {
    const map: Record<string, string> = {};
    for (const f of secullumRows ?? []) {
      const mat = String(f.numeroFolha ?? "").trim();
      const dem = String(f.demissao ?? "").trim();
      if (mat && dem) map[mat] = dem;
    }
    return map;
  }, [secullumRows]);

  const derived = useMemo(
    () => buildDashboardFromOrganico(organicoRows, demissaoByMatricula),
    [organicoRows, demissaoByMatricula]
  );
  const turnoverFromSecullum = useMemo(
    () =>
      deriveTurnoverFromPeople(
        (secullumRows ?? []).map((p) => ({
          admissao: p.admissao,
          demissao: p.demissao,
          setor: p.setor,
        }))
      ),
    [secullumRows]
  );
  const useSecullumTurnover = (secullumRows?.length ?? 0) > 0;
  const derivedFinal = useMemo(
    () =>
      useSecullumTurnover
        ? { ...derived, turnoverPct: turnoverFromSecullum.turnoverPct, turnoverData: turnoverFromSecullum.turnoverData }
        : derived,
    [derived, useSecullumTurnover, turnoverFromSecullum]
  );

  const novasAdmissoesLista = useMemo(() => listNovasAdmissoesMesAtual(organicoRows), [organicoRows]);

  const refMes = useMemo(
    () =>
      new Intl.DateTimeFormat("pt-BR", {
        month: "long",
        year: "numeric",
      }).format(new Date()),
    []
  );

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
  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0] ?? "executivo");
    }
  }, [availableTabs, activeTab]);

  const topSetoresTurnover = useMemo(() => {
    const rows = Array.isArray(organicoRows) ? organicoRows : [];
    const ativosBySetor = new Map<string, number>();
    for (const r of rows) {
      const vals = Array.isArray(r?.values) ? r.values : [];
      const nome = String(vals[ORGANICO_IDX.NOME] ?? "").trim();
      if (!nome) continue;
      const status = String(vals[ORGANICO_IDX.STATUS] ?? "").toUpperCase();
      if (status.includes("DESLIG")) continue;
      const setor = String(vals[ORGANICO_IDX.SETOR] ?? "").trim() || "Sem setor";
      ativosBySetor.set(setor, (ativosBySetor.get(setor) ?? 0) + 1);
    }
    const demissoesBySetor = new Map<string, number>();
    const ref = new Date();
    const start = new Date(ref.getFullYear(), ref.getMonth() - 11, 1);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
    for (const f of secullumRows ?? []) {
      const dem = parseDateBR(String(f.demissao ?? "").trim());
      if (!dem) continue;
      if (dem < start || dem > end) continue;
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
  }, [organicoRows, secullumRows]);
  const turnoverSeriesForChart = useMemo(() => {
    if (!turnoverSetorFiltro) {
      return derivedFinal.turnoverData;
    }
    if (useSecullumTurnover) {
      return deriveTurnoverFromPeople(
        (secullumRows ?? []).map((p) => ({
          admissao: p.admissao,
          demissao: p.demissao,
          setor: p.setor,
        })),
        new Date(),
        turnoverSetorFiltro
      ).turnoverData;
    }
    const people = listTurnoverPeopleFromOrganico(organicoRows, demissaoByMatricula);
    return deriveTurnoverFromPeople(people, new Date(), turnoverSetorFiltro).turnoverData;
  }, [
    turnoverSetorFiltro,
    derivedFinal.turnoverData,
    useSecullumTurnover,
    secullumRows,
    organicoRows,
    demissaoByMatricula,
  ]);

  const turnoverChartData = useMemo(
    () => [...turnoverSeriesForChart].reverse(),
    [turnoverSeriesForChart]
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
    const list = derivedFinal.headcountData;
    const n = Array.isArray(list) ? list.length : 0;
    if (n === 0) return 280;
    const pxPerRow = 46;
    const verticalPadding = 56;
    return Math.max(280, n * pxPerRow + verticalPadding);
  }, [derivedFinal.headcountData]);

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
  }, [selectedTurnoverPoint, organicoRows, secullumRows, turnoverSetorFiltro]);

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

  const { headcountData, alerts } = derivedFinal;

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
              <p className="text-sm font-medium whitespace-nowrap text-muted-foreground sm:ml-1">{refMes}</p>
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
        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KpiCard
            title="Total Colaboradores"
            value={formatIntPt(derived.totalColaboradores)}
            icon={Users}
            alertColor="green"
          />
          <KpiCard
            title="Custo Folha Mensal"
            value={formatCustoFolha(derived.custoFolhaMensal)}
            icon={DollarSign}
            alertColor="yellow"
          />
          <KpiCard
            title="Turnover"
            value={`${derivedFinal.turnoverPct.toLocaleString("pt-BR", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 1,
            })}%`}
            change="12 meses"
            changeType="neutral"
            icon={TrendingDown}
            alertColor="red"
          />
          <KpiCard
            title="Absenteísmo"
            value={`${formatIntPt(derived.absenteismoPct)}%`}
            icon={Clock}
            alertColor="green"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <KpiCard
            title="Média salarial (CTPS)"
            value={derived.mediaSalarialCtps > 0 ? formatCurrencyBRLExact(derived.mediaSalarialCtps) : formatCurrencyBRLExact(0)}
            icon={Wallet}
          />
          <KpiCard
            title="Setores Ativos"
            value={formatIntPt(derived.setoresAtivos)}
            icon={Building2}
          />
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="w-full text-left rounded-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label="Ver colaboradores com admissão no mês atual"
              >
                <KpiCard
                  title="Novas Admissões"
                  value={formatIntPt(derived.novasAdmissoesMes)}
                  change="mês atual"
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
              <p className="label-industrial mb-3">Admissões em {refMes}</p>
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
                        const qs = matricula ? `?focusMatricula=${encodeURIComponent(matricula)}` : "";
                        navigate(`/organico${qs}`);
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
            value={formatTenure(derivedFinal.mediaTempoCasaMeses)}
            icon={AlertTriangle}
            alertColor="yellow"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 border border-border bg-card p-6 shadow-level-1">
            <div className="flex flex-wrap items-center gap-2 gap-y-1">
              <span className="label-industrial">Evolução do Turnover — 12 meses</span>
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
            <div className="mt-4 h-[260px] relative overflow-visible">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={turnoverChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                  <XAxis dataKey="month" tick={rhChartAxisTick(chart)} />
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
                            const qs = matricula ? `?focusMatricula=${encodeURIComponent(matricula)}` : "";
                            navigate(`/organico${qs}`);
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
            <div className="mt-1 grid grid-cols-12 gap-0 border-t border-border/70">
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
            <span className="label-industrial">Top Setores por Turnover (12 meses)</span>
            <div className="mt-4 max-h-[260px] overflow-y-auto pr-1 space-y-3">
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
                          title={`Turnover ${item.turnover.toFixed(1)}% • ${formatIntPt(item.dem)} desligamento(s) em 12 meses`}
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
                            aria-label={`Turnover ${item.turnover.toFixed(1)} por cento, ${item.dem} desligamentos em 12 meses. Clique para filtrar a evolução por este setor.`}
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
                            ? "1 desligamento (12 meses)"
                            : `${item.dem} desligamentos (12 meses)`}{" "}
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

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 border border-border bg-card p-6 shadow-level-1">
            <span className="label-industrial">Headcount por Setor</span>
            <div className="mt-4 max-h-[min(420px,55vh)] overflow-y-auto overflow-x-hidden pr-1 rounded-sm border border-border/40 bg-muted/20">
              <div style={{ height: headcountChartHeight, minHeight: 280 }}>
                <ResponsiveContainer width="100%" height={headcountChartHeight}>
                  <BarChart
                    data={headcountData}
                    layout="vertical"
                    margin={{ top: 8, right: 12, left: 4, bottom: 8 }}
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
                    <Bar dataKey="count" fill={chart.barPrimary} barSize={22} maxBarSize={28}>
                      {headcountData.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={entry.count > 1000 ? chart.barLarge : chart.barPrimary}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="border border-border bg-card p-6 shadow-level-1">
            <span className="label-industrial">Alertas Operacionais</span>
            <div className="mt-4 space-y-3">
              {alerts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-sm">
                  Nenhum alerta.
                </p>
              ) : (
                alerts.map((alert, i) => (
                  <div
                    key={i}
                    className={`p-4 border border-border relative ${
                      alert.severity === "red" ? "border-l-4 border-l-destructive" : "border-l-4 border-l-accent"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle
                        className={`w-4 h-4 shrink-0 mt-0.5 ${
                          alert.severity === "red" ? "text-destructive" : "text-accent"
                        }`}
                      />
                      <div>
                        <p className="text-sm text-foreground font-medium">{alert.message}</p>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1 block">
                          {alert.sector}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
              </>
            )}
          </TabsContent> : null}

          {canViewAbsenteismo ? <TabsContent value="absenteismo" className="mt-0 focus-visible:outline-none">
            <AbsenteismoDashboard />
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
