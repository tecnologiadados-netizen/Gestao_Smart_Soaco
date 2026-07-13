import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BadgeCheck,
  ChevronDown,
  ChevronUp,
  Clock3,
  Download,
  Filter,
  ListTree,
  Timer,
  Trash2,
  TrendingUp,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import KpiCard from "@rh/components/KpiCard";
import { Button } from "@rh/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@rh/components/ui/card";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@rh/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@rh/components/ui/dialog";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@rh/components/ui/hover-card";
import { Label } from "@rh/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@rh/components/ui/popover";
import { Checkbox } from "@rh/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rh/components/ui/select";
import { Slider } from "@rh/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@rh/components/ui/table";
import {
  getOrganico,
  getPontualidadePonto,
  getSancoesDisciplinares,
  getSecullumFuncionarios,
  isApiConfigured,
  replacePontualidadePonto,
} from "@rh/lib/api-client";
import { normalizePontualidadePontoRows } from "@rh/lib/pontualidade-ponto-normalize";
import { cn } from "@rh/lib/utils";
import { textIncludesSearch } from "@rh/lib/normalize-search-text";
import { useToast } from "@rh/hooks/use-toast";
import { useSavingOverlay } from "@rh/contexts/saving-overlay-context";
import { RankingAtrasosTooltip } from "./RankingAtrasosTooltip";
import {
  EMPTY_CHART_CROSS,
  isChartCrossEmpty,
  type AbsenteismoPorHorasRow,
  type ChartCrossState,
  type ChartCrossToggle,
  type CtpsSource,
} from "./types";
import { useAbsenteismoPorHorasExcel } from "./useAbsenteismoPorHorasExcel";
import {
  buildCtpsByMatriculaNormFromOrganico,
  buildCtpsByNomeNormFromOrganico,
  normalizeAbsenteismoNomeKey,
} from "./organico-match";
import { mergeSecullumIntoOrganicoApiRows } from "@rh/pages/Organico/organico-secullum-merge";
import {
  buildCtpsByNomeNormFromSecullum,
  buildCtpsByNumeroFolhaNormFromSecullum,
  resolveCtpsForAbsenteismoRow,
} from "./secullum-ctps-resolve";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
const WEEKDAY_LONG = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
] as const;
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const RANKING_TOP = [5, 10, 15, 20, 25, 30, 50] as const;
const CHART_COLOR = "hsl(var(--primary))";

/**
 * Entrada considerada "no horário" se o atraso em relação ao início previsto da jornada for ≤ este valor (min).
 * Equivale a: horário previsto + tolerância.
 */
const PONTUALIDADE_TOLERANCIA_MIN = 5;

/** Salário mensal (CTPS) → custo/hora — referência usual de horas mensais (CLT). */
const HORAS_MES_CLT_REF = 220;

function formatClock(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const mi = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

function formatMinHuman(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const mi = m % 60;
  if (h === 0) return `${mi} min`;
  return `${h}h ${String(mi).padStart(2, "0")}min`;
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(1).replace(".", ",")}%`;
}

function formatBRL(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Converte `yyyy-mm-dd` (ISO) para exibição brasileira `dd/mm/aaaa`. */
function formatDataIsoParaBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? "").trim());
  if (!m) return String(iso ?? "").trim() || "—";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function formatIntPt(n: number): string {
  return Math.max(0, Math.round(n)).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

/** `yyyy-mm-dd` → "maio de 2024" (pt-BR, UTC). */
function formatMesAnoLongoPtFromIsoYmd(iso: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(String(iso ?? "").trim());
  if (!m) return String(iso ?? "").trim() || "—";
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = new Date(Date.UTC(y, mo, 1));
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** `yyyy-mm` (bucket da planilha) → rótulo curto tipo "mar/2026". */
function formatMesAnoCurtoPtFromBucketMes(bucketMes: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(String(bucketMes ?? "").trim());
  if (!m) return String(bucketMes ?? "").trim() || "—";
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = new Date(Date.UTC(y, mo, 1));
  const mes = d.toLocaleDateString("pt-BR", { month: "short", timeZone: "UTC" });
  return `${mes.replace(/\.$/, "")}/${y}`;
}

function formatHoraPlanilha(min: number | null | undefined): string {
  if (min == null || !Number.isFinite(min)) return "—";
  return formatClock(min);
}

type DetalheSortCol =
  | "dataIso"
  | "nome"
  | "turno"
  | "ent1"
  | "sai2"
  | "normais"
  | "faltas"
  | "extras"
  | "atraso";

type DetalheSortLevel = { key: DetalheSortCol; dir: "asc" | "desc" };

const DETALHE_COL_ORDER: DetalheSortCol[] = [
  "dataIso",
  "nome",
  "turno",
  "ent1",
  "sai2",
  "normais",
  "faltas",
  "extras",
  "atraso",
];

const DETALHE_DEFAULT_WIDTHS: Record<DetalheSortCol, number> = {
  dataIso: 100,
  nome: 200,
  turno: 200,
  ent1: 78,
  sai2: 78,
  normais: 86,
  faltas: 100,
  extras: 78,
  atraso: 108,
};

const DETALHE_SORT_LABELS: Record<DetalheSortCol, string> = {
  dataIso: "DATA",
  nome: "NOME",
  turno: "Turno",
  ent1: "ENT. 1",
  sai2: "SAÍ. 2",
  normais: "NORMAIS",
  faltas: "FALTAS",
  extras: "EXTRAS",
  atraso: "Atraso (calc.)",
};

function compareDetalheRows(a: AbsenteismoPorHorasRow, b: AbsenteismoPorHorasRow, key: DetalheSortCol): number {
  switch (key) {
    case "dataIso":
      return a.dataIso.localeCompare(b.dataIso, "en-CA");
    case "nome":
      return a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
    case "turno":
      return (a.turno || "").localeCompare(b.turno || "", "pt-BR", { sensitivity: "base" });
    case "ent1":
      return a.entradaRealMin - b.entradaRealMin;
    case "sai2": {
      const av = a.saidaRealMin ?? 999_999;
      const bv = b.saidaRealMin ?? 999_999;
      return av - bv;
    }
    case "normais": {
      const av = a.normaisMin ?? 999_999;
      const bv = b.normaisMin ?? 999_999;
      return av - bv;
    }
    case "faltas":
      return (a.faltasText || "").localeCompare(b.faltasText || "", "pt-BR", { sensitivity: "base" });
    case "extras":
      return a.horaExtraMin - b.horaExtraMin;
    case "atraso":
      return a.atrasoMin - b.atrasoMin;
    default:
      return 0;
  }
}

type Agg = {
  key: string;
  label: string;
  qtd: number;
  media: number;
  total: number;
  percentual: number;
  score?: number;
  /** CTPS coerente com a linha (API Secullum prioritária; senão Orgânico). */
  ctpsOrganico?: number;
  ctpsSource?: CtpsSource;
};

function aggFromBarRechartsEvent(data: unknown): Agg | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const p = o.payload;
  if (p && typeof p === "object" && p !== null && "label" in p && "qtd" in p) {
    return p as Agg;
  }
  if ("label" in o && "qtd" in o) return o as Agg;
  return null;
}

/** Largura/altura estimadas do tooltip portal (resumo + sanções). */
const RANKING_FLOAT_TT_MAX_W = 840;
const RANKING_FLOAT_TT_MAX_H = 420;
/** Abertura rápida; conteúdo leve evita “travamento” ao mover o mouse. */
const RANKING_FLOAT_TT_OPEN_DELAY_MS = 280;

/** Posição `fixed` para tooltip portal (evita corte por overflow do gráfico). */
function clampRankingFloatedPosition(clientX: number, clientY: number) {
  if (typeof window === "undefined") return { left: clientX + 12, top: clientY + 12 };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const estW = Math.min(RANKING_FLOAT_TT_MAX_W, vw - 24);
  const estH = Math.min(RANKING_FLOAT_TT_MAX_H, vh - 24);
  const pad = 12;
  let left = clientX + 12;
  let top = clientY + 12;
  if (left + estW > vw - pad) left = Math.max(pad, vw - estW - pad);
  if (top + estH > vh - pad) top = Math.max(pad, vh - estH - pad);
  if (left < pad) left = pad;
  if (top < pad) top = pad;
  return { left, top };
}

function applyRankingTooltipDomPosition(el: HTMLElement | null, clientX: number, clientY: number) {
  if (!el) return;
  const { left, top } = clampRankingFloatedPosition(clientX, clientY);
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

function buildTooltipRows(a: Agg, totalQtd: number) {
  return (
    <div className="space-y-1 text-xs">
      <div className="font-semibold">{a.label}</div>
      <div>Quantidade de atrasos: {a.qtd}</div>
      <div>Tempo médio: {formatMinHuman(a.media)}</div>
      <div>Tempo total: {formatMinHuman(a.total)}</div>
      <div>% relativo: {formatPercent(totalQtd > 0 ? (a.qtd / totalQtd) * 100 : 0)}</div>
      {a.score != null ? <div>Score pontualidade (proxy): {formatPercent(a.score)}</div> : null}
    </div>
  );
}

/** Resumo curto para o gatilho do multi-select (vazio = todos). */
function resumoMultiFiltro(selected: string[], maxLen = 42): string {
  if (selected.length === 0) return "Todos";
  if (selected.length === 1) {
    const s = selected[0];
    return s.length > maxLen ? `${s.slice(0, maxLen - 1)}…` : s;
  }
  return `${selected.length} selecionados`;
}

/** Formata lista para export / memorial (vazio = Todos). */
function formatMultiFiltroExport(selected: string[]): string {
  if (selected.length === 0) return "Todos";
  if (selected.length <= 3) return selected.join("; ");
  return `${selected.length} itens: ${selected.slice(0, 2).join("; ")}; …`;
}

type PainelMultiSelectProps = {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
};

/**
 * Vazio = sem filtro (equivalente a “Todos”). Com itens = apenas esses valores (OU).
 * Se marcar todos os itens da lista, normaliza de volta para vazio.
 */
function PainelMultiSelect({ label, options, selected, onChange, disabled }: PainelMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filteredOptions = useMemo(() => {
    if (!query.trim()) return options;
    return options.filter((opt) => textIncludesSearch(opt, query));
  }, [options, query]);

  const toggle = (opt: string) => {
    const set = new Set(selected);
    if (set.has(opt)) set.delete(opt);
    else set.add(opt);
    let next = [...set].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
    if (
      options.length > 1 &&
      next.length === options.length &&
      options.every((o) => next.includes(o))
    ) {
      next = [];
    }
    onChange(next);
  };

  const marcarTodos = () => onChange([]);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || options.length === 0}
            className="h-9 w-full justify-between font-normal"
          >
            <span className="truncate text-left">{resumoMultiFiltro(selected)}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[240px] p-0" align="start">
          <div className="border-b px-2 py-1.5">
            <span className="text-xs font-medium text-muted-foreground">Uma ou mais opções (OU)</span>
          </div>
          <div className="border-b p-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Pesquisar ${label.toLowerCase()}...`}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="max-h-[min(320px,45vh)] overflow-y-auto overscroll-contain">
            <div className="p-1">
              <label className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted/80">
                <Checkbox
                  checked={selected.length === 0}
                  onCheckedChange={(c) => {
                    if (c === true) marcarTodos();
                  }}
                />
                <span className="font-medium">Todos (sem filtro)</span>
              </label>
              {filteredOptions.map((opt) => {
                const checked = selected.includes(opt);
                return (
                  <label
                    key={opt}
                    className="flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted/80"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(opt)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0 break-words leading-snug">{opt}</span>
                  </label>
                );
              })}
              {filteredOptions.length === 0 ? (
                <div className="px-2 py-2 text-xs text-muted-foreground">Nenhum resultado para "{query}".</div>
              ) : null}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function AbsenteismoPorHorasTab({ canEdit = true }: { canEdit?: boolean }) {
  const { toast } = useToast();
  const { runWithSaving } = useSavingOverlay();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const { parseFile } = useAbsenteismoPorHorasExcel();

  const [rows, setRows] = useState<AbsenteismoPorHorasRow[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [minDelay, setMinDelay] = useState(10);
  /** Vazio = todos. Com valores = apenas esses (OU). */
  const [colaboradoresFiltro, setColaboradoresFiltro] = useState<string[]>([]);
  const [setoresFiltro, setSetoresFiltro] = useState<string[]>([]);
  const [equipesFiltro, setEquipesFiltro] = useState<string[]>([]);
  const [turnosFiltro, setTurnosFiltro] = useState<string[]>([]);
  const [rankingTop, setRankingTop] = useState<number>(10);
  const [timelineMode, setTimelineMode] = useState<"dia" | "mes">("dia");
  const [cross, setCross] = useState<ChartCrossState>(EMPTY_CHART_CROSS);
  const [excluirRegistrosOpen, setExcluirRegistrosOpen] = useState(false);
  const [excluindoRegistros, setExcluindoRegistros] = useState(false);
  /** Evita crash se `cross` vier nulo (ex.: estado legado após import). */
  const crossSafe = cross ?? EMPTY_CHART_CROSS;
  const [filtrosAbertos, setFiltrosAbertos] = useState(true);
  /** Vazio = ordem padrão (ranking + data). Shift+clique acumula critérios (1º, 2º…). */
  const [detalheTabelaSorts, setDetalheTabelaSorts] = useState<DetalheSortLevel[]>([]);
  const [detalheColWidths, setDetalheColWidths] = useState<Record<DetalheSortCol, number>>(() => ({
    ...DETALHE_DEFAULT_WIDTHS,
  }));
  const detalheResizeRef = useRef<{ col: DetalheSortCol; startX: number; startW: number } | null>(null);
  const [rankingFloatedAgg, setRankingFloatedAgg] = useState<Agg | null>(null);
  const rankingFloatedPortalRef = useRef<HTMLDivElement | null>(null);
  const rankingFloatedTtCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rankingFloatedTtOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rankingFloatedTtVisibleRef = useRef(false);
  const pendingRankingOpenRef = useRef<{ agg: Agg } | null>(null);
  const lastRankingPointerRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    rankingFloatedTtVisibleRef.current = rankingFloatedAgg != null;
  }, [rankingFloatedAgg]);

  useLayoutEffect(() => {
    if (rankingFloatedAgg == null) return;
    const { x, y } = lastRankingPointerRef.current;
    applyRankingTooltipDomPosition(rankingFloatedPortalRef.current, x, y);
  }, [rankingFloatedAgg]);

  const clearRankingFloatedTtOpen = useCallback(() => {
    if (rankingFloatedTtOpenTimerRef.current) {
      window.clearTimeout(rankingFloatedTtOpenTimerRef.current);
      rankingFloatedTtOpenTimerRef.current = null;
    }
  }, []);

  const clearRankingFloatedTtClose = useCallback(() => {
    if (rankingFloatedTtCloseTimerRef.current) {
      window.clearTimeout(rankingFloatedTtCloseTimerRef.current);
      rankingFloatedTtCloseTimerRef.current = null;
    }
  }, []);

  const scheduleRankingFloatedTtClose = useCallback(() => {
    clearRankingFloatedTtClose();
    rankingFloatedTtCloseTimerRef.current = window.setTimeout(() => {
      setRankingFloatedAgg(null);
      rankingFloatedTtCloseTimerRef.current = null;
    }, 420);
  }, [clearRankingFloatedTtClose]);

  const handleRankingChartMouseLeave = useCallback(() => {
    if (!rankingFloatedTtVisibleRef.current) {
      clearRankingFloatedTtOpen();
      pendingRankingOpenRef.current = null;
    }
    scheduleRankingFloatedTtClose();
  }, [clearRankingFloatedTtOpen, scheduleRankingFloatedTtClose]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = detalheResizeRef.current;
      if (!d) return;
      const delta = e.clientX - d.startX;
      const nextW = Math.max(52, Math.min(640, d.startW + delta));
      setDetalheColWidths((w) => (w[d.col] === nextW ? w : { ...w, [d.col]: nextW }));
    };
    const onUp = () => {
      detalheResizeRef.current = null;
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  useEffect(
    () => () => {
      clearRankingFloatedTtClose();
      clearRankingFloatedTtOpen();
    },
    [clearRankingFloatedTtClose, clearRankingFloatedTtOpen],
  );

  const beginDetalheColResize = useCallback(
    (col: DetalheSortCol, clientX: number) => {
      detalheResizeRef.current = {
        col,
        startX: clientX,
        startW: detalheColWidths[col],
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [detalheColWidths],
  );

  const { data: organicoRows = [], isLoading: isLoadingOrganico } = useQuery({
    queryKey: ["organico"],
    queryFn: getOrganico,
    staleTime: 60_000,
  });

  const { data: secullumRowsRaw, isLoading: isLoadingSecullum } = useQuery({
    queryKey: ["secullum-funcionarios", "absenteismo-por-horas"],
    queryFn: getSecullumFuncionarios,
    staleTime: 5 * 60_000,
    enabled: isApiConfigured(),
  });
  const secullumRows = secullumRowsRaw ?? [];
  const aguardandoCtpsBase = isLoadingOrganico || (isApiConfigured() && isLoadingSecullum);

  /** Mesmo “merge” da aba Orgânico (CTPS da Secullum por matrícula) — alinha custo ao que o card mostra. */
  const organicoRowsMerged = useMemo(
    () => mergeSecullumIntoOrganicoApiRows(organicoRows, secullumRows),
    [organicoRows, secullumRows],
  );

  const {
    data: sancoesRowsRaw = [],
    isLoading: isLoadingSancoes,
    isError: isErrorSancoes,
  } = useQuery({
    queryKey: ["sancoes-disciplinares", "absenteismo-por-horas"],
    queryFn: () => getSancoesDisciplinares(),
    staleTime: 60_000,
  });

  const pontoRemoteQuery = useQuery({
    queryKey: ["pontualidade-ponto"],
    queryFn: getPontualidadePonto,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    enabled: isApiConfigured(),
  });

  useEffect(() => {
    if (!isApiConfigured()) return;
    if (!pontoRemoteQuery.isSuccess || !pontoRemoteQuery.data) return;
    const d = pontoRemoteQuery.data;
    const normalized = normalizePontualidadePontoRows(d.rows);
    setRows(normalized);
    setStartDate(typeof d.dateRangeStart === "string" ? d.dateRangeStart : "");
    setEndDate(typeof d.dateRangeEnd === "string" ? d.dateRangeEnd : "");
  }, [isApiConfigured(), pontoRemoteQuery.isSuccess, pontoRemoteQuery.data]);

  const onFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!canEdit) {
        e.target.value = "";
        toast({ title: "Sem permissão", description: "Seu perfil só pode visualizar esta guia.", variant: "destructive" });
        return;
      }
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      const lower = file.name.toLowerCase();
      if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
        toast({ title: "Arquivo inválido", description: "Use .xlsx ou .xls.", variant: "destructive" });
        return;
      }
      try {
        const { rows: parsed, stats } = await parseFile(file, organicoRowsMerged, secullumRows);
        if (parsed.length === 0) {
          const parts: string[] = [
            "Confira DATA, NOME e ENT. 1 (ou ENTRADA). Turno pode vir só do Orgânico.",
          ];
          if (stats.skippedAbsence > 0) {
            parts.push(`${stats.skippedAbsence} linha(s) ignoradas (férias/folga/atest./licença etc.)`);
          }
          if (stats.skippedNoSchedule > 0) {
            parts.push(`${stats.skippedNoSchedule} sem jornada prevista (turno vazio no Orgânico)`);
          }
          if (stats.skippedInvalid > 0) {
            parts.push(`${stats.skippedInvalid} linha(s) inválidas ou vazias`);
          }
          toast({
            title: "Nenhuma linha válida",
            description: parts.join(" · "),
            variant: "destructive",
          });
          return;
        }
        setRows(parsed);
        setColaboradoresFiltro([]);
        setSetoresFiltro([]);
        setEquipesFiltro([]);
        setTurnosFiltro([]);
        const sortedDates = [...new Set(parsed.map((r) => r.dataIso))].sort();
        const rangeStart = sortedDates[0] ?? "";
        const rangeEnd = sortedDates[sortedDates.length - 1] ?? "";
        setStartDate(rangeStart);
        setEndDate(rangeEnd);
        setCross(EMPTY_CHART_CROSS);
        const extra: string[] = [];
        if (stats.skippedAbsence > 0) extra.push(`${stats.skippedAbsence} ausência(s) administrativa(s)`);
        if (stats.skippedNoSchedule > 0) extra.push(`${stats.skippedNoSchedule} sem turno (Orgânico)`);
        if (stats.skippedInvalid > 0) extra.push(`${stats.skippedInvalid} inválida(s)/vazia(s)`);
        if (isApiConfigured()) {
          try {
            await runWithSaving(async () => {
              await replacePontualidadePonto({
                rows: parsed as unknown[],
                dateRangeStart: rangeStart,
                dateRangeEnd: rangeEnd,
              });
              await queryClient.invalidateQueries({ queryKey: ["pontualidade-ponto"] });
            }, "Salvando pontualidade…");
          } catch (persistErr) {
            console.error("[Pontualidade] Falha ao salvar snapshot na API:", persistErr);
            toast({
              title: "Importação local OK — nuvem falhou",
              description:
                "Os dados aparecem nesta máquina, mas não foram salvos para outras estações. Verifique VITE_API_URL e as Edge Functions.",
              variant: "destructive",
            });
          }
        }
        toast({
          title: "Planilha carregada",
          description:
            extra.length > 0
              ? `${parsed.length} registro(s). Ignoradas: ${extra.join(" · ")}.`
              : `${parsed.length} registro(s) processados.`,
        });
      } catch (err) {
        console.error("[Pontualidade] Falha ao importar planilha:", err);
        toast({ title: "Erro ao ler planilha", description: "Não foi possível importar o arquivo.", variant: "destructive" });
      }
    },
    [canEdit, organicoRowsMerged, parseFile, queryClient, toast, secullumRows, runWithSaving],
  );

  const handleExcluirRegistros = useCallback(async () => {
    if (!canEdit) {
      toast({ title: "Sem permissão", description: "Seu perfil só pode visualizar esta guia.", variant: "destructive" });
      return;
    }
    setExcluindoRegistros(true);
    try {
      if (isApiConfigured()) {
        await runWithSaving(async () => {
          await replacePontualidadePonto({ rows: [], dateRangeStart: "", dateRangeEnd: "", allowEmpty: true });
          await queryClient.invalidateQueries({ queryKey: ["pontualidade-ponto"] });
        }, "Excluindo registros…");
      }
      setRows([]);
      setStartDate("");
      setEndDate("");
      setColaboradoresFiltro([]);
      setSetoresFiltro([]);
      setEquipesFiltro([]);
      setTurnosFiltro([]);
      setCross(EMPTY_CHART_CROSS);
      setExcluirRegistrosOpen(false);
      toast({
        title: "Registros removidos",
        description: isApiConfigured()
          ? "Os dados de pontualidade foram limpos no servidor. Outras máquinas verão a página vazia após atualizar."
          : "Os dados locais desta página foram limpos.",
      });
    } catch (err) {
      console.error("[Pontualidade] Falha ao excluir registros:", err);
      toast({
        title: "Não foi possível excluir",
        description: "Tente novamente ou verifique a conexão com a API.",
        variant: "destructive",
      });
    } finally {
      setExcluindoRegistros(false);
    }
  }, [canEdit, queryClient, toast, runWithSaving]);

  const rowsComCtps = useMemo(() => {
    if (rows.length === 0) return rows;
    const organicoByMat = buildCtpsByMatriculaNormFromOrganico(organicoRowsMerged);
    const organicoByNome = buildCtpsByNomeNormFromOrganico(organicoRowsMerged);
    const secullumByMat = buildCtpsByNumeroFolhaNormFromSecullum(secullumRows);
    const secullumByNome = buildCtpsByNomeNormFromSecullum(secullumRows);
    return rows.map((r) => {
      const nomeKey = normalizeAbsenteismoNomeKey(r.nome);
      const { ctps, source } = resolveCtpsForAbsenteismoRow({
        nomeKey,
        matriculaPlanilha: r.matriculaPlanilha,
        matriculaOrganico: r.matriculaOrganico,
        secullumByMat,
        secullumByNome,
        organicoByMat,
        organicoByNome,
      });
      return { ...r, ctpsOrganico: ctps, ctpsSource: source };
    });
  }, [rows, organicoRowsMerged, secullumRows]);

  /** Extremos das datas na planilha (para detectar recorte de período). */
  const datasExtremasPlanilha = useMemo(() => {
    if (rows.length === 0) return { min: "", max: "" };
    let min = rows[0].dataIso;
    let max = rows[0].dataIso;
    for (const r of rows) {
      if (r.dataIso < min) min = r.dataIso;
      if (r.dataIso > max) max = r.dataIso;
    }
    return { min, max };
  }, [rows]);

  const filteredBase = useMemo(() => {
    return rowsComCtps.filter((r) => {
      if (startDate && r.dataIso < startDate) return false;
      if (endDate && r.dataIso > endDate) return false;
      if (colaboradoresFiltro.length > 0 && !colaboradoresFiltro.includes(r.nome)) return false;
      if (setoresFiltro.length > 0) {
        const s = r.setorOrganico.trim() || "Sem vínculo orgânico";
        if (!setoresFiltro.includes(s)) return false;
      }
      if (equipesFiltro.length > 0) {
        const eq = r.equipeOrganico.trim() || "Sem vínculo orgânico";
        if (!equipesFiltro.includes(eq)) return false;
      }
      if (turnosFiltro.length > 0 && !turnosFiltro.includes(r.turno)) return false;
      return true;
    });
  }, [rowsComCtps, startDate, endDate, colaboradoresFiltro, setoresFiltro, equipesFiltro, turnosFiltro]);

  /** “Acima de N minutos” = estritamente maior (ex.: 10 min → 07:10 não entra, 07:11 entra). */
  const delayedAll = useMemo(() => filteredBase.filter((r) => r.atrasoMin > minDelay), [filteredBase, minDelay]);

  const delayedView = useMemo(() => {
    return delayedAll.filter((r) => {
      if (crossSafe.colaboradorNome != null && r.nome !== crossSafe.colaboradorNome) return false;
      if (crossSafe.weekdayIndex != null && r.weekdayIndex !== crossSafe.weekdayIndex) return false;
      if (crossSafe.timelineKey != null) {
        const k = timelineMode === "dia" ? r.bucketDia : r.bucketMes;
        if (k !== crossSafe.timelineKey) return false;
      }
      return true;
    });
  }, [delayedAll, crossSafe, timelineMode]);

  /** Recorte do painel + mesmo cruzamento dos gráficos (sem exigir atraso > filtro). Usado no índice de pontualidade. */
  const crossFilteredBase = useMemo(() => {
    return filteredBase.filter((r) => {
      if (crossSafe.colaboradorNome != null && r.nome !== crossSafe.colaboradorNome) return false;
      if (crossSafe.weekdayIndex != null && r.weekdayIndex !== crossSafe.weekdayIndex) return false;
      if (crossSafe.timelineKey != null) {
        const k = timelineMode === "dia" ? r.bucketDia : r.bucketMes;
        if (k !== crossSafe.timelineKey) return false;
      }
      return true;
    });
  }, [filteredBase, crossSafe, timelineMode]);

  const toggleCrossSlice = useCallback((next: ChartCrossToggle) => {
    setCross((prev) => {
      const p = prev ?? EMPTY_CHART_CROSS;
      if (next.kind === "colaborador") {
        const nome = next.nome;
        return {
          ...p,
          colaboradorNome: p.colaboradorNome === nome ? null : nome,
        };
      }
      if (next.kind === "weekday") {
        const weekdayIndex = next.weekdayIndex;
        return {
          ...p,
          weekdayIndex: p.weekdayIndex === weekdayIndex ? null : weekdayIndex,
        };
      }
      const key = next.key;
      return {
        ...p,
        timelineKey: p.timelineKey === key ? null : key,
      };
    });
  }, []);

  const colaboradoresOpts = useMemo(() => {
    return [...new Set(rows.map((r) => r.nome))].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  }, [rows]);

  const setoresOpts = useMemo(() => {
    return [
      ...new Set(rows.map((r) => (r.setorOrganico.trim() ? r.setorOrganico : "Sem vínculo orgânico"))),
    ].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  }, [rows]);

  const equipesOpts = useMemo(() => {
    return [
      ...new Set(rows.map((r) => (r.equipeOrganico.trim() ? r.equipeOrganico : "Sem vínculo orgânico"))),
    ].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  }, [rows]);

  const turnosOpts = useMemo(() => {
    return [...new Set(rows.map((r) => r.turno))].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  }, [rows]);

  useEffect(() => {
    setColaboradoresFiltro((prev) => prev.filter((x) => colaboradoresOpts.includes(x)));
  }, [colaboradoresOpts]);
  useEffect(() => {
    setSetoresFiltro((prev) => prev.filter((x) => setoresOpts.includes(x)));
  }, [setoresOpts]);
  useEffect(() => {
    setEquipesFiltro((prev) => prev.filter((x) => equipesOpts.includes(x)));
  }, [equipesOpts]);
  useEffect(() => {
    setTurnosFiltro((prev) => prev.filter((x) => turnosOpts.includes(x)));
  }, [turnosOpts]);

  /** Índice de pontualidade = (entradas no horário ÷ dias trabalhados no recorte) × 100 — ver memorial no KPI. */
  const {
    indicePontualidade,
    entradasNoHorario,
    entradasTrabalhadasTotal,
  } = useMemo(() => {
    const total = crossFilteredBase.length;
    const noHorario = crossFilteredBase.filter((r) => r.atrasoMin <= PONTUALIDADE_TOLERANCIA_MIN).length;
    return {
      entradasTrabalhadasTotal: total,
      entradasNoHorario: noHorario,
      indicePontualidade: total > 0 ? (noHorario / total) * 100 : 0,
    };
  }, [crossFilteredBase]);

  const totalOcorrencias = delayedView.length;
  const tempoTotalMin = useMemo(() => delayedView.reduce((acc, r) => acc + r.atrasoMin, 0), [delayedView]);
  const tempoMedioMin = totalOcorrencias > 0 ? tempoTotalMin / totalOcorrencias : 0;

  const ctpsByNomeNorm = useMemo(
    () => buildCtpsByNomeNormFromOrganico(organicoRowsMerged),
    [organicoRowsMerged],
  );

  /**
   * Custo estimado = Σ (horas de atraso × salário-hora). Salário-hora = CTPS ÷ 220.
   * CTPS: **API Secullum** quando disponível (igual ao card Orgânico); senão cadastro Orgânico.
   */
  const custoEstimadoAtrasoCtps = useMemo(() => {
    let totalReais = 0;
    let ocorrenciasComCtps = 0;
    let ocorrenciasSemCtps = 0;
    for (const r of delayedView) {
      const ctps = r.ctpsOrganico > 0 ? r.ctpsOrganico : (ctpsByNomeNorm.get(normalizeAbsenteismoNomeKey(r.nome)) ?? 0);
      if (ctps > 0) {
        const custoHora = ctps / HORAS_MES_CLT_REF;
        totalReais += (r.atrasoMin / 60) * custoHora;
        ocorrenciasComCtps += 1;
      } else {
        ocorrenciasSemCtps += 1;
      }
    }
    return { totalReais, ocorrenciasComCtps, ocorrenciasSemCtps };
  }, [delayedView, ctpsByNomeNorm]);

  /** HE no mesmo dia do atraso: considera apenas linhas com pelo menos 1 min de extra (regra da tabela de insights). */
  const MIN_EXTRA_MIN_MESMO_DIA = 1;

  const extrasNoRecorte = useMemo(() => {
    const com = delayedView.filter((r) => r.horaExtraMin >= MIN_EXTRA_MIN_MESMO_DIA);
    return { qtd: com.length, totalMin: com.reduce((a, r) => a + r.horaExtraMin, 0) };
  }, [delayedView]);

  /** Ocorrências de atraso (recorte) em que há EXTRAS no mesmo dia — perfil “atrasou e esticou”. */
  const insightsAtrasoComExtras = useMemo(() => {
    const com = delayedView.filter((r) => r.horaExtraMin >= MIN_EXTRA_MIN_MESMO_DIA);
    const minAtraso = com.reduce((a, r) => a + r.atrasoMin, 0);
    const minExtras = com.reduce((a, r) => a + r.horaExtraMin, 0);
    return {
      ocorrenciasComExtras: com.length,
      pctComExtras: delayedView.length > 0 ? (com.length / delayedView.length) * 100 : 0,
      pessoasDistintas: new Set(com.map((r) => r.nome)).size,
      minAtrasoNessesDias: minAtraso,
      minExtrasNessesDias: minExtras,
      /** Minutos de extras por minuto de atraso nos dias com os dois eventos (null se sem atraso nesses dias). */
      ratioExtrasSobreAtraso: minAtraso > 0 ? minExtras / minAtraso : null,
    };
  }, [delayedView]);

  const rankColaboradoresAtrasoComExtras = useMemo(() => {
    const totalAtrasosPorPessoa = new Map<string, number>();
    for (const r of delayedView) {
      totalAtrasosPorPessoa.set(r.nome, (totalAtrasosPorPessoa.get(r.nome) ?? 0) + 1);
    }

    const m = new Map<string, { ocorr: number; atrasoMin: number; extraMin: number }>();
    for (const r of delayedView) {
      if (r.horaExtraMin < MIN_EXTRA_MIN_MESMO_DIA) continue;
      const c = m.get(r.nome) ?? { ocorr: 0, atrasoMin: 0, extraMin: 0 };
      c.ocorr += 1;
      c.atrasoMin += r.atrasoMin;
      c.extraMin += r.horaExtraMin;
      m.set(r.nome, c);
    }
    return [...m.entries()]
      .map(([nome, v]) => ({
        nome,
        /** Todas as ocorrências de atraso da pessoa no recorte (linhas em atraso), antes de filtrar por HE. */
        totalAtrasosNoRecorte: totalAtrasosPorPessoa.get(nome) ?? 0,
        ...v,
      }))
      .sort((a, b) => b.ocorr - a.ocorr)
      .slice(0, 12);
  }, [delayedView]);

  const aggByColaborador: Agg[] = useMemo(() => {
    const map = new Map<string, { qtd: number; total: number }>();
    const ctpsMetaPorNome = new Map<string, { ctps: number; source: CtpsSource }>();
    for (const r of delayedView) {
      const cur = map.get(r.nome) ?? { qtd: 0, total: 0 };
      cur.qtd += 1;
      cur.total += r.atrasoMin;
      map.set(r.nome, cur);
      if (!ctpsMetaPorNome.has(r.nome)) {
        const ctps = r.ctpsOrganico > 0 ? r.ctpsOrganico : (ctpsByNomeNorm.get(normalizeAbsenteismoNomeKey(r.nome)) ?? 0);
        const source: CtpsSource = r.ctpsOrganico > 0 ? r.ctpsSource : "organico";
        ctpsMetaPorNome.set(r.nome, { ctps, source });
      }
    }
    const diasPorPessoa = new Map<string, number>();
    for (const r of filteredBase) {
      diasPorPessoa.set(r.nome, (diasPorPessoa.get(r.nome) ?? 0) + 1);
    }
    const totalQtd = delayedView.length || 1;
    return [...map.entries()]
      .map(([nome, v]) => {
        const dias = diasPorPessoa.get(nome) ?? v.qtd;
        const score = Math.max(0, 100 - (v.qtd / Math.max(1, dias)) * 100);
        const meta = ctpsMetaPorNome.get(nome) ?? { ctps: 0, source: "organico" as CtpsSource };
        return {
          key: nome,
          label: nome,
          qtd: v.qtd,
          total: v.total,
          media: v.qtd ? v.total / v.qtd : 0,
          percentual: (v.qtd / totalQtd) * 100,
          score,
          ...(meta.ctps > 0 ? { ctpsOrganico: meta.ctps, ctpsSource: meta.source } : {}),
        };
      })
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, rankingTop);
  }, [delayedView, filteredBase, rankingTop, ctpsByNomeNorm]);

  /**
   * Gráfico 1 (barras horizontais): altura cresce com a quantidade de colaboradores.
   * O wrapper usa max-height + overflow-y para rolagem sem espremer as barras.
   */
  const alturaGraficoRankingPx = useMemo(() => {
    const n = aggByColaborador.length;
    if (n === 0) return 280;
    const pxPorBarra = 44;
    const margens = 56;
    return Math.min(8000, Math.max(280, n * pxPorBarra + margens));
  }, [aggByColaborador.length]);

  /** Linhas de atraso (recorte atual) só dos colaboradores do ranking do gráfico 1, ordem = ranking + data. */
  const linhasDetalheRankingColaborador = useMemo(() => {
    const ordem = new Map(aggByColaborador.map((a, i) => [a.key, i]));
    const noRanking = new Set(aggByColaborador.map((a) => a.key));
    return delayedView
      .filter((r) => noRanking.has(r.nome))
      .sort((a, b) => {
        const ia = ordem.get(a.nome) ?? 999;
        const ib = ordem.get(b.nome) ?? 999;
        if (ia !== ib) return ia - ib;
        return a.dataIso.localeCompare(b.dataIso, "en-CA");
      });
  }, [delayedView, aggByColaborador]);

  const linhasDetalheExibicao = useMemo(() => {
    const base = [...linhasDetalheRankingColaborador];
    if (detalheTabelaSorts.length === 0) return base;
    base.sort((a, b) => {
      for (const { key, dir } of detalheTabelaSorts) {
        const c = compareDetalheRows(a, b, key);
        if (c === 0) continue;
        const mult = dir === "asc" ? 1 : -1;
        return mult * (c > 0 ? 1 : -1);
      }
      return a.dataIso.localeCompare(b.dataIso, "en-CA");
    });
    return base;
  }, [linhasDetalheRankingColaborador, detalheTabelaSorts]);

  const handleDetalheSort = useCallback((col: DetalheSortCol, e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const shift = e.shiftKey;
    setDetalheTabelaSorts((prev) => {
      if (!shift) {
        if (prev.length === 1 && prev[0].key === col) {
          return [{ key: col, dir: prev[0].dir === "asc" ? "desc" : "asc" }];
        }
        return [{ key: col, dir: "asc" }];
      }
      const i = prev.findIndex((s) => s.key === col);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], dir: next[i].dir === "asc" ? "desc" : "asc" };
        return next;
      }
      return [...prev, { key: col, dir: "asc" }];
    });
  }, []);

  const detalheSortDescription = useMemo(() => {
    if (detalheTabelaSorts.length === 0) {
      return "Padrão (ranking do gráfico 1 + data crescente)";
    }
    return detalheTabelaSorts
      .map(
        (s, i) =>
          `${i + 1}º ${DETALHE_SORT_LABELS[s.key]} (${s.dir === "asc" ? "crescente" : "decrescente"})`,
      )
      .join(" · ");
  }, [detalheTabelaSorts]);

  const detalheExportFilterLines = useMemo(() => {
    const br = (iso: string) => (iso ? formatDataIsoParaBR(iso) : "—");
    const lines: { label: string; value: string }[] = [
      { label: "Período (datas)", value: `${br(startDate)} a ${br(endDate)}` },
      {
        label: "Atraso mínimo (filtro)",
        value: `Somente ocorrências com atraso estritamente > ${minDelay} min`,
      },
      { label: "Colaborador", value: formatMultiFiltroExport(colaboradoresFiltro) },
      { label: "Setor (Orgânico)", value: formatMultiFiltroExport(setoresFiltro) },
      { label: "Equipe / área (Orgânico)", value: formatMultiFiltroExport(equipesFiltro) },
      { label: "Turno (planilha)", value: formatMultiFiltroExport(turnosFiltro) },
      {
        label: "Recorte do ranking (gráfico 1)",
        value: `Top ${rankingTop} — tabela lista apenas dias com atraso desses colaboradores`,
      },
    ];
    if (!isChartCrossEmpty(crossSafe)) {
      const partes: string[] = [];
      if (crossSafe.colaboradorNome) partes.push(`Colaborador: ${crossSafe.colaboradorNome}`);
      if (crossSafe.weekdayIndex != null) partes.push(`Dia da semana: ${WEEKDAY_LONG[crossSafe.weekdayIndex]}`);
      if (crossSafe.timelineKey) {
        partes.push(
          `Linha do tempo (${timelineMode === "dia" ? "por dia" : "por mês"}): ${crossSafe.timelineKey}`,
        );
      }
      lines.push({ label: "Cruzamento ativo", value: partes.join(" · ") });
    } else {
      lines.push({ label: "Cruzamento ativo", value: "Nenhum" });
    }
    return lines;
  }, [
    startDate,
    endDate,
    minDelay,
    colaboradoresFiltro,
    setoresFiltro,
    equipesFiltro,
    turnosFiltro,
    rankingTop,
    crossSafe,
    timelineMode,
  ]);

  const aggByWeekday: Agg[] = useMemo(() => {
    const map = new Map<number, { qtd: number; total: number }>();
    for (const r of delayedView) {
      const cur = map.get(r.weekdayIndex) ?? { qtd: 0, total: 0 };
      cur.qtd += 1;
      cur.total += r.atrasoMin;
      map.set(r.weekdayIndex, cur);
    }
    const totalQtd = delayedView.length || 1;
    return WEEKDAY_ORDER.map((d) => {
      const v = map.get(d) ?? { qtd: 0, total: 0 };
      return {
        key: String(d),
        label: WEEKDAY_LABELS[d],
        qtd: v.qtd,
        total: v.total,
        media: v.qtd ? v.total / v.qtd : 0,
        percentual: (v.qtd / totalQtd) * 100,
      };
    });
  }, [delayedView]);

  const aggTimeline: Agg[] = useMemo(() => {
    const map = new Map<string, { qtd: number; total: number }>();
    for (const r of delayedView) {
      const k = timelineMode === "dia" ? r.bucketDia : r.bucketMes;
      const cur = map.get(k) ?? { qtd: 0, total: 0 };
      cur.qtd += 1;
      cur.total += r.atrasoMin;
      map.set(k, cur);
    }
    const totalQtd = delayedView.length || 1;
    const entries = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "en-CA"));
    return entries.map(([k, v]) => ({
      key: k,
      label: timelineMode === "mes" ? k : k.slice(8, 10) + "/" + k.slice(5, 7),
      qtd: v.qtd,
      total: v.total,
      media: v.qtd ? v.total / v.qtd : 0,
      percentual: (v.qtd / totalQtd) * 100,
    }));
  }, [delayedView, timelineMode]);

  const filtersInvalid = rows.length > 0 && (!startDate || !endDate);

  /** Mesma fórmula do índice de pontualidade, por mês civil (`bucketMes`), no recorte + cruzamento. */
  const indicePontualidadePorMes = useMemo(() => {
    const byMonth = new Map<string, { total: number; noHorario: number }>();
    for (const r of crossFilteredBase) {
      const key = r.bucketMes;
      const cur = byMonth.get(key) ?? { total: 0, noHorario: 0 };
      cur.total += 1;
      if (r.atrasoMin <= PONTUALIDADE_TOLERANCIA_MIN) cur.noHorario += 1;
      byMonth.set(key, cur);
    }
    const months = [...byMonth.keys()].sort((a, b) => a.localeCompare(b, "en-CA"));
    return months.map((bucketMes) => {
      const { total, noHorario } = byMonth.get(bucketMes)!;
      const indice = total > 0 ? (noHorario / total) * 100 : 0;
      return {
        bucketMes,
        label: formatMesAnoCurtoPtFromBucketMes(bucketMes),
        denom: total,
        num: noHorario,
        indice,
      };
    });
  }, [crossFilteredBase]);

  /** Faixa única: só quando há filtro “real” (painel fora do padrão ou cruzamento nos gráficos). */
  const filtrosAtivosIndicador = useMemo(() => {
    if (rows.length === 0 || filtersInvalid) {
      return { show: false as const, title: "", parts: [] as string[], hasCross: false };
    }
    const hasCross = !isChartCrossEmpty(crossSafe);
    const periodoRestrito =
      Boolean(startDate && endDate && datasExtremasPlanilha.min && datasExtremasPlanilha.max) &&
      (startDate > datasExtremasPlanilha.min || endDate < datasExtremasPlanilha.max);

    const panelParts: string[] = [];
    if (periodoRestrito) {
      panelParts.push(`Período: ${formatDataIsoParaBR(startDate)} → ${formatDataIsoParaBR(endDate)}`);
    }
    if (minDelay !== 10) {
      panelParts.push(`Atraso mín.: > ${minDelay} min`);
    }
    if (colaboradoresFiltro.length > 0) {
      panelParts.push(`Colaborador: ${formatMultiFiltroExport(colaboradoresFiltro)}`);
    }
    if (setoresFiltro.length > 0) {
      panelParts.push(`Setor (Orgânico): ${formatMultiFiltroExport(setoresFiltro)}`);
    }
    if (equipesFiltro.length > 0) {
      panelParts.push(`Equipe / área: ${formatMultiFiltroExport(equipesFiltro)}`);
    }
    if (turnosFiltro.length > 0) {
      panelParts.push(`Turno: ${formatMultiFiltroExport(turnosFiltro)}`);
    }
    if (rankingTop !== 10) {
      panelParts.push(`Ranking gráf. 1: Top ${rankingTop}`);
    }

    const crossParts: string[] = [];
    if (crossSafe.colaboradorNome) crossParts.push(`Colaborador: ${crossSafe.colaboradorNome}`);
    if (crossSafe.weekdayIndex != null) crossParts.push(`Dia: ${WEEKDAY_LONG[crossSafe.weekdayIndex]}`);
    if (crossSafe.timelineKey) crossParts.push(`Período: ${crossSafe.timelineKey}`);

    const hasPanel = panelParts.length > 0;
    if (!hasPanel && !hasCross) {
      return { show: false as const, title: "", parts: [] as string[], hasCross: false };
    }

    const onlyCross = hasCross && !hasPanel;
    const title = onlyCross ? "Cruzamento ativo:" : "Filtros ativos:";
    const parts = onlyCross ? crossParts : [...panelParts, ...crossParts];

    return { show: true as const, title, parts, hasCross };
  }, [
    rows.length,
    filtersInvalid,
    startDate,
    endDate,
    datasExtremasPlanilha.min,
    datasExtremasPlanilha.max,
    minDelay,
    colaboradoresFiltro,
    setoresFiltro,
    equipesFiltro,
    turnosFiltro,
    rankingTop,
    crossSafe,
  ]);

  /** Linha de resumo em caixa alta (padrão Pontualidade & People Analytics). */
  const headerResumoCaps = useMemo(() => {
    if (rows.length === 0) {
      return "NENHUMA LINHA IMPORTADA · ABA CONSOLIDADO DO MODELO";
    }
    let minIso = rows[0].dataIso;
    let maxIso = rows[0].dataIso;
    for (const r of rows) {
      if (r.dataIso < minIso) minIso = r.dataIso;
      if (r.dataIso > maxIso) maxIso = r.dataIso;
    }
    const mesesDistintos = new Set(rows.map((r) => r.bucketMes)).size;
    const colaboradores = new Set(rows.map((r) => r.nome)).size;
    const ymMin = minIso.slice(0, 7);
    const ymMax = maxIso.slice(0, 7);
    const ini = formatMesAnoLongoPtFromIsoYmd(minIso).toUpperCase();
    const fim = formatMesAnoLongoPtFromIsoYmd(maxIso).toUpperCase();
    const periodo = ymMin === ymMax ? ini : `${ini} A ${fim}`;
    return `${formatIntPt(rows.length)} lançamentos · ${formatIntPt(colaboradores)} colaborador(es) · ${formatIntPt(mesesDistintos)} mês(es) · ${periodo}`;
  }, [rows]);

  const exportDetalheTabelaExcel = useCallback(async () => {
    if (filtersInvalid) {
      toast({
        title: "Período incompleto",
        description: "Defina data inicial e final para exportar.",
        variant: "destructive",
      });
      return;
    }
    if (linhasDetalheExibicao.length === 0) {
      toast({
        title: "Nada para exportar",
        description: "Não há linhas na tabela com os filtros atuais.",
        variant: "destructive",
      });
      return;
    }
    try {
      const { exportDetalheAbsenteismoPorHorasExcel } = await import("./exportDetalheAbsenteismoPorHoras");
      await exportDetalheAbsenteismoPorHorasExcel(linhasDetalheExibicao, {
        filterLines: detalheExportFilterLines,
        sortDescription: detalheSortDescription,
      });
      toast({ title: "Excel gerado", description: "O download deve iniciar em instantes." });
    } catch {
      toast({
        title: "Falha na exportação",
        description: "Não foi possível gerar o arquivo. Tente novamente.",
        variant: "destructive",
      });
    }
  }, [
    filtersInvalid,
    linhasDetalheExibicao,
    detalheExportFilterLines,
    detalheSortDescription,
    toast,
  ]);

  return (
    <div className="space-y-6">
      <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onFile} />

      <AlertDialog open={excluirRegistrosOpen} onOpenChange={setExcluirRegistrosOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir todos os registros?</AlertDialogTitle>
            <AlertDialogDescription>
              {isApiConfigured()
                ? "Isso apaga o snapshot de pontualidade no banco. Todas as máquinas passarão a ver esta página sem dados importados. Esta ação não pode ser desfeita."
                : "Isso limpa apenas os dados carregados neste navegador (modo sem API)."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={excluindoRegistros}>
              Cancelar
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={excluindoRegistros}
              onClick={() => void handleExcluirRegistros()}
            >
              {excluindoRegistros ? "Excluindo…" : "Excluir registros"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1 min-w-0">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Pontualidade &amp; People Analytics
          </h2>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Importe o modelo interno ou o Excel exportado pelo sistema de ponto.
          </p>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground max-w-4xl leading-relaxed">
            {headerResumoCaps}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button type="button" variant="outline" size="sm" asChild>
            <a href="/modelo-absenteismo-por-horas.xlsx" download>
              <Download className="w-4 h-4 mr-1.5" />
              Baixar modelo
            </a>
          </Button>
          <Button type="button" variant="default" size="sm" onClick={() => fileRef.current?.click()} disabled={!canEdit}>
            <Upload className="w-4 h-4 mr-1.5" />
            Importar planilha
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={!canEdit || rows.length === 0 || pontoRemoteQuery.isFetching}
            onClick={() => setExcluirRegistrosOpen(true)}
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Excluir registros
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader
          className={cn(
            "flex flex-row items-center justify-between space-y-0",
            filtrosAbertos ? "pb-3" : "pb-4",
          )}
        >
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="w-4 h-4 opacity-80" />
            Filtros
          </CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-md text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            onClick={() => setFiltrosAbertos((v) => !v)}
            aria-expanded={filtrosAbertos}
            aria-label={filtrosAbertos ? "Ocultar filtros" : "Mostrar filtros"}
          >
            {filtrosAbertos ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CardHeader>
        {filtrosAbertos ? (
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div className="space-y-2">
            <Label>Data inicial</Label>
            <input
              type="date"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={rows.length === 0}
            />
          </div>
          <div className="space-y-2">
            <Label>Data final</Label>
            <input
              type="date"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={rows.length === 0}
            />
          </div>
          <div className="space-y-3 md:col-span-2">
            <div className="flex justify-between gap-2">
              <Label>Tempo mínimo de atraso (minutos)</Label>
              <span className="text-sm text-muted-foreground tabular-nums">
                &gt; {minDelay} min
              </span>
            </div>
            <Slider
              value={[minDelay]}
              min={0}
              max={120}
              step={1}
              onValueChange={(v) => setMinDelay(v[0] ?? 0)}
              disabled={rows.length === 0}
            />
          </div>
          <PainelMultiSelect
            label="Colaborador"
            options={colaboradoresOpts}
            selected={colaboradoresFiltro}
            onChange={setColaboradoresFiltro}
            disabled={rows.length === 0}
          />
          <PainelMultiSelect
            label="Setor (Orgânico)"
            options={setoresOpts}
            selected={setoresFiltro}
            onChange={setSetoresFiltro}
            disabled={rows.length === 0}
          />
          <PainelMultiSelect
            label="Equipe / área (Orgânico)"
            options={equipesOpts}
            selected={equipesFiltro}
            onChange={setEquipesFiltro}
            disabled={rows.length === 0}
          />
          <PainelMultiSelect
            label="Turno (planilha)"
            options={turnosOpts}
            selected={turnosFiltro}
            onChange={setTurnosFiltro}
            disabled={rows.length === 0}
          />
        </CardContent>
        ) : null}
      </Card>

      {filtersInvalid ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          Defina data inicial e final para calcular os indicadores.
        </div>
      ) : null}

      {filtrosAtivosIndicador.show ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span className="shrink-0 text-muted-foreground">{filtrosAtivosIndicador.title}</span>
          <span className="font-medium break-words">{filtrosAtivosIndicador.parts.join(" · ")}</span>
          {filtrosAtivosIndicador.hasCross ? (
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => setCross(EMPTY_CHART_CROSS)}>
              <X className="mr-1 h-3.5 w-3.5" />
              Limpar
            </Button>
          ) : null}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground text-sm">
          Importe a planilha para visualizar indicadores e gráficos.
        </div>
      ) : (
        <>
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 lg:gap-6">
            <HoverCard openDelay={120} closeDelay={80}>
              <HoverCardTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "border border-border bg-card p-5 text-left shadow-level-1 transition-all duration-200",
                    "relative overflow-hidden hover:-translate-y-1 hover:shadow-level-2",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "w-full min-w-0 sm:p-6",
                  )}
                  aria-label="Índice de pontualidade — passe o mouse para memorial de cálculo e gráfico mensal"
                >
                  <div className="alert-strip bg-success" />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="label-industrial block leading-snug">Índice de Pontualidade</span>
                      <div className="mt-2 space-y-1.5">
                        <span className="kpi-value block text-xl leading-tight tabular-nums sm:text-2xl whitespace-nowrap">
                          {filtersInvalid ? "—" : formatPercent(indicePontualidade)}
                        </span>
                        <span className="block max-w-full text-[11px] font-semibold leading-snug text-muted-foreground break-words hyphens-auto sm:text-xs">
                          {filtersInvalid
                            ? "Defina data inicial e final para calcular."
                            : `${formatIntPt(entradasNoHorario)} / ${formatIntPt(entradasTrabalhadasTotal)} entradas no horário · tol. ${PONTUALIDADE_TOLERANCIA_MIN} min · passe o mouse para detalhes`}
                        </span>
                      </div>
                    </div>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-muted sm:h-10 sm:w-10">
                      <BadgeCheck className="h-[18px] w-[18px] text-muted-foreground sm:h-5 sm:w-5" aria-hidden />
                    </div>
                  </div>
                </button>
              </HoverCardTrigger>
              <HoverCardContent
                className="w-[min(100vw-1.5rem,440px)] max-h-[min(85vh,520px)] overflow-y-auto p-4"
                align="start"
                side="bottom"
              >
                <div className="space-y-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Memorial de cálculo
                    </p>
                    <p className="mt-2 text-xs font-medium leading-relaxed text-popover-foreground">
                      <strong>Índice de Pontualidade</strong> = (Total de entradas no horário ÷ Total de dias trabalhados)
                      × 100
                    </p>
                    <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-popover-foreground">
                      {filtersInvalid ? (
                        <li>
                          <strong>Período obrigatório:</strong> informe data inicial e final para calcular o índice de forma
                          consistente com os demais indicadores.
                        </li>
                      ) : null}
                      <li>
                        <strong>Total de dias trabalhados (denominador):</strong> quantidade de{" "}
                        <strong>linhas da planilha</strong> no recorte — cada linha representa um dia com registro de
                        entrada no período filtrado (filtros do painel: período, colaborador, setor, equipe, turno).
                      </li>
                      <li>
                        <strong>Entradas no horário (numerador):</strong> linhas em que a chegada está dentro da tolerância:
                        atraso calculado em relação ao <strong>início previsto da jornada</strong> (texto do turno) é menor
                        ou igual a <strong>{PONTUALIDADE_TOLERANCIA_MIN} minutos</strong> (horário previsto + tolerância).
                      </li>
                      <li>
                        {isChartCrossEmpty(crossSafe) ? (
                          <>Não há <strong>cruzamento</strong> ativo nos gráficos; o índice usa todo o recorte do painel.</>
                        ) : (
                          <>
                            Com <strong>cruzamento</strong> nos gráficos (colaborador, dia da semana e/ou linha do tempo),
                            o índice considera apenas as linhas que satisfazem esse recorte adicional (critério{" "}
                            <strong>E</strong>).
                          </>
                        )}
                      </li>
                      {!filtersInvalid ? (
                        <li>
                          <strong>No período filtrado:</strong> {formatIntPt(entradasNoHorario)} entradas no horário,{" "}
                          {formatIntPt(entradasTrabalhadasTotal)} dias trabalhados,{" "}
                          <strong>índice = {formatPercent(indicePontualidade)}</strong>.
                        </li>
                      ) : null}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Evolução do índice (por mês)
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Mesma fórmula por mês civil; respeita filtros do painel e cruzamento ativo.
                    </p>
                    {indicePontualidadePorMes.length === 0 ? (
                      <p className="mt-3 text-xs text-muted-foreground">Sem dados no recorte para montar a série.</p>
                    ) : (
                      <div className="mt-3 h-[200px] w-full min-w-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsLineChart
                            data={indicePontualidadePorMes}
                            margin={{ left: 4, right: 8, top: 8, bottom: 4 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                            <YAxis
                              tick={{ fontSize: 10 }}
                              domain={[0, 100]}
                              tickFormatter={(v) => `${v}%`}
                            />
                            <RechartsTooltip
                              content={({ active, payload }) => {
                                if (!active || !payload?.[0]) return null;
                                const p = payload[0].payload as (typeof indicePontualidadePorMes)[number];
                                return (
                                  <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-md">
                                    <div className="font-medium capitalize">{p.label}</div>
                                    <div>Índice: {formatPercent(p.indice)}</div>
                                    <div className="text-muted-foreground">
                                      {formatIntPt(p.num)} / {formatIntPt(p.denom)} no horário / dias trab.
                                    </div>
                                  </div>
                                );
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="indice"
                              stroke={CHART_COLOR}
                              strokeWidth={2}
                              dot={{ r: 3, fill: CHART_COLOR }}
                              activeDot={{ r: 5 }}
                            />
                          </RechartsLineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
            <KpiCard
              title="Tempo médio de atraso"
              value={formatMinHuman(tempoMedioMin)}
              icon={Clock3}
              alertColor="green"
            />
            <KpiCard
              title="Ocorrências de atraso"
              value={String(totalOcorrencias)}
              icon={Timer}
              alertColor="green"
            />
            <KpiCard
              title="Horas perdidas (soma)"
              value={formatMinHuman(tempoTotalMin)}
              icon={ListTree}
              alertColor="red"
              change={`Extras no recorte: ${extrasNoRecorte.qtd} dia(s) · ${formatMinHuman(extrasNoRecorte.totalMin)}`}
              changeType="neutral"
            />
            <KpiCard
              title="Custo estimado (atraso)"
              value={aguardandoCtpsBase ? "—" : formatBRL(custoEstimadoAtrasoCtps.totalReais)}
              icon={Wallet}
              alertColor="yellow"
              change={
                aguardandoCtpsBase
                  ? "Carregando CTPS (Secullum/Orgânico)…"
                  : totalOcorrencias === 0
                    ? `Secullum (se API ok) ou Orgânico · ÷ ${HORAS_MES_CLT_REF} h/mês`
                    : `CTPS ÷ ${HORAS_MES_CLT_REF} h · ${custoEstimadoAtrasoCtps.ocorrenciasComCtps}/${totalOcorrencias} ocorr.${
                        custoEstimadoAtrasoCtps.ocorrenciasSemCtps > 0
                          ? ` · ${custoEstimadoAtrasoCtps.ocorrenciasSemCtps} sem CTPS`
                          : ""
                      }`
              }
              changeType="neutral"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartBlock
              className="min-w-0 h-full min-h-0"
              title="1. Quantidade de atrasos por colaborador"
              description={`Top ${rankingTop} (ordenado do maior para o menor). Passe o mouse na barra: resumo e custo à esquerda; histórico geral de sanções à direita.`}
              rightSlot={
                <Select
                  value={String(rankingTop)}
                  onValueChange={(v) => setRankingTop(Number(v))}
                >
                  <SelectTrigger className="h-8 w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RANKING_TOP.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        Top {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            >
              <div
                className="max-h-[min(420px,48vh)] w-full overflow-y-auto overflow-x-hidden rounded-md border border-border/80 bg-muted/10 pr-1"
                onMouseEnter={clearRankingFloatedTtClose}
                onMouseLeave={handleRankingChartMouseLeave}
                onScroll={() => {
                  clearRankingFloatedTtOpen();
                  pendingRankingOpenRef.current = null;
                  setRankingFloatedAgg(null);
                }}
              >
                <div className="min-w-0" style={{ height: alturaGraficoRankingPx, minHeight: 280 }}>
                  <ResponsiveContainer width="100%" height={alturaGraficoRankingPx}>
                    <BarChart
                      data={aggByColaborador}
                      layout="vertical"
                      margin={{ left: 4, right: 20, top: 12, bottom: 12 }}
                      barCategoryGap="18%"
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={148}
                        tick={{ fontSize: 10 }}
                        interval={0}
                        tickFormatter={(v) =>
                          String(v).length > 28 ? `${String(v).slice(0, 26)}…` : String(v)
                        }
                      />
                      <Bar
                        dataKey="qtd"
                        radius={[0, 4, 4, 0]}
                        maxBarSize={32}
                        cursor="pointer"
                        onMouseEnter={(data, _i, e) => {
                          clearRankingFloatedTtClose();
                          const agg = aggFromBarRechartsEvent(data);
                          if (!agg) return;
                          lastRankingPointerRef.current = { x: e.clientX, y: e.clientY };
                          if (rankingFloatedTtVisibleRef.current) {
                            clearRankingFloatedTtOpen();
                            pendingRankingOpenRef.current = null;
                            applyRankingTooltipDomPosition(rankingFloatedPortalRef.current, e.clientX, e.clientY);
                            setRankingFloatedAgg((prev) => (prev?.key === agg.key ? prev : agg));
                            return;
                          }
                          pendingRankingOpenRef.current = { agg };
                          clearRankingFloatedTtOpen();
                          rankingFloatedTtOpenTimerRef.current = window.setTimeout(() => {
                            rankingFloatedTtOpenTimerRef.current = null;
                            const p = pendingRankingOpenRef.current;
                            if (!p) return;
                            const { x, y } = lastRankingPointerRef.current;
                            setRankingFloatedAgg(p.agg);
                            pendingRankingOpenRef.current = null;
                            queueMicrotask(() => {
                              applyRankingTooltipDomPosition(rankingFloatedPortalRef.current, x, y);
                            });
                          }, RANKING_FLOAT_TT_OPEN_DELAY_MS);
                        }}
                        onMouseMove={(data, _i, e) => {
                          lastRankingPointerRef.current = { x: e.clientX, y: e.clientY };
                          const agg = aggFromBarRechartsEvent(data);
                          if (!agg) return;
                          pendingRankingOpenRef.current = { agg };
                          if (rankingFloatedTtVisibleRef.current) {
                            applyRankingTooltipDomPosition(rankingFloatedPortalRef.current, e.clientX, e.clientY);
                          }
                          setRankingFloatedAgg((prev) => {
                            if (prev?.key === agg.key) return prev;
                            return agg;
                          });
                        }}
                        onMouseLeave={() => {
                          if (!rankingFloatedTtVisibleRef.current) {
                            clearRankingFloatedTtOpen();
                            pendingRankingOpenRef.current = null;
                          }
                        }}
                        onClick={(d) => {
                          const nome = (d as unknown as { payload?: Agg }).payload?.label;
                          if (nome) toggleCrossSlice({ kind: "colaborador", nome });
                        }}
                      >
                        {aggByColaborador.map((a) => (
                          <Cell
                            key={a.key}
                            fill={CHART_COLOR}
                            opacity={
                              crossSafe.colaboradorNome != null && crossSafe.colaboradorNome !== a.key ? 0.35 : 1
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <p className="min-w-0 flex-1 text-xs font-medium text-foreground">
                  Detalhamento por dia (mesmas colunas da planilha).{" "}
                  <span className="text-muted-foreground font-normal">
                  
                  </span>{" "}
                  {detalheTabelaSorts.length > 0 ? (
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 align-baseline text-xs font-medium"
                      onClick={() => setDetalheTabelaSorts([])}
                    >
                      Voltar à ordem padrão
                    </Button>
                  ) : null}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  onClick={exportDetalheTabelaExcel}
                  disabled={filtersInvalid || linhasDetalheExibicao.length === 0}
                >
                  <Download className="h-4 w-4" />
                  Exportar Excel
                </Button>
              </div>
              <div className="max-h-[min(480px,52vh)] w-full overflow-auto rounded-md border">
                <Table className="table-fixed w-max min-w-full">
                  <colgroup>
                    {DETALHE_COL_ORDER.map((k) => (
                      <col key={k} style={{ width: detalheColWidths[k] }} />
                    ))}
                  </colgroup>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <SortableDetailHead
                        label="DATA"
                        col="dataIso"
                        sorts={detalheTabelaSorts}
                        widthPx={detalheColWidths.dataIso}
                        onSort={handleDetalheSort}
                        onResizeMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          beginDetalheColResize("dataIso", e.clientX);
                        }}
                      />
                      <SortableDetailHead
                        label="NOME"
                        col="nome"
                        sorts={detalheTabelaSorts}
                        widthPx={detalheColWidths.nome}
                        onSort={handleDetalheSort}
                        onResizeMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          beginDetalheColResize("nome", e.clientX);
                        }}
                      />
                      <SortableDetailHead
                        label="Turno"
                        col="turno"
                        sorts={detalheTabelaSorts}
                        widthPx={detalheColWidths.turno}
                        onSort={handleDetalheSort}
                        onResizeMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          beginDetalheColResize("turno", e.clientX);
                        }}
                      />
                      <SortableDetailHead
                        label="ENT. 1"
                        col="ent1"
                        sorts={detalheTabelaSorts}
                        widthPx={detalheColWidths.ent1}
                        onSort={handleDetalheSort}
                        onResizeMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          beginDetalheColResize("ent1", e.clientX);
                        }}
                      />
                      <SortableDetailHead
                        label="SAÍ. 2"
                        col="sai2"
                        sorts={detalheTabelaSorts}
                        widthPx={detalheColWidths.sai2}
                        onSort={handleDetalheSort}
                        onResizeMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          beginDetalheColResize("sai2", e.clientX);
                        }}
                      />
                      <SortableDetailHead
                        label="NORMAIS"
                        col="normais"
                        sorts={detalheTabelaSorts}
                        widthPx={detalheColWidths.normais}
                        onSort={handleDetalheSort}
                        onResizeMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          beginDetalheColResize("normais", e.clientX);
                        }}
                      />
                      <SortableDetailHead
                        label="FALTAS"
                        col="faltas"
                        sorts={detalheTabelaSorts}
                        widthPx={detalheColWidths.faltas}
                        onSort={handleDetalheSort}
                        onResizeMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          beginDetalheColResize("faltas", e.clientX);
                        }}
                      />
                      <SortableDetailHead
                        label="EXTRAS"
                        col="extras"
                        sorts={detalheTabelaSorts}
                        widthPx={detalheColWidths.extras}
                        onSort={handleDetalheSort}
                        onResizeMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          beginDetalheColResize("extras", e.clientX);
                        }}
                      />
                      <SortableDetailHead
                        label="Atraso (calc.)"
                        col="atraso"
                        sorts={detalheTabelaSorts}
                        widthPx={detalheColWidths.atraso}
                        onSort={handleDetalheSort}
                        onResizeMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          beginDetalheColResize("atraso", e.clientX);
                        }}
                      />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhasDetalheExibicao.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-xs text-muted-foreground text-center py-8">
                          Nenhum registro no recorte para o ranking atual.
                        </TableCell>
                      </TableRow>
                    ) : (
                      linhasDetalheExibicao.map((r, i) => (
                        <TableRow key={`${r.dataIso}-${r.nome}-${i}`}>
                          <TableCell className="max-w-0 overflow-hidden p-2 text-xs font-mono whitespace-nowrap">
                            {formatDataIsoParaBR(r.dataIso)}
                          </TableCell>
                          <TableCell className="max-w-0 overflow-hidden p-2 text-xs truncate" title={r.nome}>
                            {r.nome}
                          </TableCell>
                          <TableCell className="max-w-0 overflow-hidden p-2 text-xs truncate" title={r.turno}>
                            {r.turno || "—"}
                          </TableCell>
                          <TableCell className="max-w-0 overflow-hidden p-2 text-xs font-mono whitespace-nowrap">
                            {formatHoraPlanilha(r.entradaRealMin)}
                          </TableCell>
                          <TableCell className="max-w-0 overflow-hidden p-2 text-xs font-mono whitespace-nowrap">
                            {formatHoraPlanilha(r.saidaRealMin)}
                          </TableCell>
                          <TableCell className="max-w-0 overflow-hidden p-2 text-xs font-mono whitespace-nowrap">
                            {formatHoraPlanilha(r.normaisMin)}
                          </TableCell>
                          <TableCell
                            className="max-w-0 overflow-hidden p-2 text-xs whitespace-nowrap truncate"
                            title={r.faltasText || undefined}
                          >
                            {r.faltasText || "—"}
                          </TableCell>
                          <TableCell className="max-w-0 overflow-hidden p-2 text-xs font-mono whitespace-nowrap">
                            {r.horaExtraMin > 0 ? formatHoraPlanilha(r.horaExtraMin) : "—"}
                          </TableCell>
                          <TableCell className="max-w-0 overflow-hidden p-2 text-xs whitespace-nowrap">
                            {formatMinHuman(r.atrasoMin)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </ChartBlock>

            <ChartBlock
              className="min-w-0 h-full min-h-0"
              title="2. Atrasos por dia da semana"
              description="Volume de ocorrências por dia da semana no recorte."
            >
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={aggByWeekday} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const a = payload[0].payload as Agg;
                      return (
                        <div className="rounded-md border bg-background px-3 py-2 shadow-md">
                          {buildTooltipRows(a, delayedView.length)}
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="qtd"
                    fill={CHART_COLOR}
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                    onClick={(d) => {
                      const idx = Number((d as unknown as { payload?: Agg }).payload?.key);
                      if (!Number.isNaN(idx)) toggleCrossSlice({ kind: "weekday", weekdayIndex: idx });
                    }}
                  >
                    {aggByWeekday.map((a) => (
                      <Cell
                        key={a.key}
                        opacity={
                          crossSafe.weekdayIndex != null && crossSafe.weekdayIndex !== Number(a.key) ? 0.35 : 1
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <DetailTable
                className="w-full min-w-0"
                firstColumnWidthPct={38}
                rows={aggByWeekday.map((a) => ({
                  dimensao: WEEKDAY_LONG[Number(a.key)],
                  qtd: a.qtd,
                  media: formatMinHuman(a.media),
                  total: formatMinHuman(a.total),
                  pct: formatPercent(delayedView.length ? (a.qtd / delayedView.length) * 100 : 0),
                }))}
                columns={[
                  { key: "dimensao", label: "Dia" },
                  { key: "qtd", label: "Volume" },
                  { key: "media", label: "Média atraso" },
                  { key: "total", label: "Total atraso" },
                  { key: "pct", label: "% rel." },
                ]}
              />
            </ChartBlock>

            <div className="flex min-h-0 min-w-0 h-full flex-col lg:col-span-2">
              <Card className="flex h-full min-h-0 flex-col border-primary/20 bg-gradient-to-br from-background via-background to-primary/[0.04]">
                <CardHeader className="shrink-0 pb-2">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    <TrendingUp className="h-4 w-4 text-primary" aria-hidden />
                    3. Insights: atraso + horas extras
                  </CardTitle>
                  <CardDescription className="text-xs"></CardDescription>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col">
                  <div className="flex min-h-0 flex-1 flex-col space-y-3 rounded-lg border bg-card/80 p-4 shadow-sm">
                    <p className="shrink-0 text-sm font-semibold text-foreground">
                      Colaboradores com atraso e hora extra no mesmo dia (HE ≥ 1 min)
                    </p>
                    {filtersInvalid ? (
                      <p className="flex flex-1 items-center justify-center px-2 py-6 text-center text-xs text-muted-foreground">
                        Defina o período para ver estes indicadores.
                      </p>
                    ) : totalOcorrencias === 0 ? (
                      <p className="flex flex-1 items-center justify-center px-2 py-6 text-center text-xs text-muted-foreground">
                        Nenhuma ocorrência de atraso no recorte atual.
                      </p>
                    ) : (
                      <>
                        <ul className="grid shrink-0 gap-2 text-xs sm:grid-cols-2">
                          <li className="rounded-md border border-border/80 bg-muted/30 px-2.5 py-2">
                            <span className="text-muted-foreground">% ocorrências com extras</span>
                            <div className="text-lg font-semibold tabular-nums text-foreground">
                              {formatPercent(insightsAtrasoComExtras.pctComExtras)}
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {insightsAtrasoComExtras.ocorrenciasComExtras} de {totalOcorrencias} dia(s)-pessoa
                            </span>
                          </li>
                          <li className="rounded-md border border-border/80 bg-muted/30 px-2.5 py-2">
                            <span className="text-muted-foreground">Colaboradores (nesse perfil)</span>
                            <div className="text-lg font-semibold tabular-nums text-foreground">
                              {insightsAtrasoComExtras.pessoasDistintas}
                            </div>
                            <span className="text-[10px] text-muted-foreground">Com pelo menos 1 dia atraso + HE ≥ 1 min</span>
                          </li>
                          <li className="rounded-md border border-border/80 bg-muted/30 px-2.5 py-2 sm:col-span-2">
                            <span className="text-muted-foreground">Nesses dias: soma atraso vs soma extras</span>
                            <div className="mt-1 font-medium text-foreground">
                              {formatMinHuman(insightsAtrasoComExtras.minAtrasoNessesDias)} de atraso ·{" "}
                              {formatMinHuman(insightsAtrasoComExtras.minExtrasNessesDias)} de extras
                            </div>
                            {insightsAtrasoComExtras.ratioExtrasSobreAtraso != null ? (
                              <span className="text-[10px] text-muted-foreground">
                                Razão extras/atraso (min):{" "}
                                {insightsAtrasoComExtras.ratioExtrasSobreAtraso.toFixed(2).replace(".", ",")} — valores &gt; 1
                                indicam mais minutos de extras do que de atraso nesses dias.
                              </span>
                            ) : null}
                          </li>
                        </ul>
                        {rankColaboradoresAtrasoComExtras.length > 0 ? (
                          <div className="min-h-0 flex-1 overflow-auto rounded-md border">
                            <table className="w-full min-w-[440px] border-collapse text-xs">
                              <thead>
                                <tr className="border-b bg-muted/50 text-left">
                                  <th className="px-2 py-2 font-semibold">Colaborador</th>
                                  <th className="px-2 py-2 text-center font-semibold">
                                    <div className="whitespace-normal leading-tight">Qtd. total de atrasos</div>
                                    <div className="mt-0.5 text-[10px] font-normal text-muted-foreground">
                                      no recorte (todas as ocorrências)
                                    </div>
                                  </th>
                                  <th className="px-2 py-2 text-center font-semibold">
                                    <div className="whitespace-normal leading-tight">Qtd. dias com atraso</div>
                                    <div className="mt-0.5 text-[10px] font-normal text-muted-foreground">
                                      (e HE ≥ 1 min no dia)
                                    </div>
                                  </th>
                                  <th className="px-2 py-2 text-right font-semibold">
                                    <div className="whitespace-normal leading-tight">Soma dos atrasos</div>
                                    <div className="mt-0.5 text-[10px] font-normal text-muted-foreground">
                                      nesses dias
                                    </div>
                                  </th>
                                  <th className="px-2 py-2 text-right font-semibold">
                                    <div className="whitespace-normal leading-tight">Hora extra nesses dias</div>
                                    <div className="mt-0.5 text-[10px] font-normal text-muted-foreground">
                                      total registrado
                                    </div>
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {rankColaboradoresAtrasoComExtras.map((row, i) => (
                                  <tr key={row.nome} className={cn("border-b border-border/60", i % 2 === 1 && "bg-muted/20")}>
                                    <td className="max-w-[200px] truncate px-2 py-1.5 font-medium" title={row.nome}>
                                      {row.nome}
                                    </td>
                                    <td className="px-2 py-1.5 text-center tabular-nums">{row.totalAtrasosNoRecorte}</td>
                                    <td className="px-2 py-1.5 text-center tabular-nums">{row.ocorr}</td>
                                    <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                                      {formatMinHuman(row.atrasoMin)}
                                    </td>
                                    <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                                      {formatMinHuman(row.extraMin)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="flex flex-1 items-center justify-center px-2 py-6 text-center text-xs text-muted-foreground">
                            Nenhum colaborador no recorte com <span className="font-mono">EXTRAS</span> ≥ 1 min no mesmo dia do
                            atraso.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <ChartBlock
              title="4. Atrasos ao longo do tempo"
              description="Evolução por dia ou mês. Clique na barra para filtrar o período; combina com colaborador (gráf. 1) e dia da semana (gráf. 2)."
              className="lg:col-span-2"
              rightSlot={
                <Select value={timelineMode} onValueChange={(v) => setTimelineMode(v as "dia" | "mes")}>
                  <SelectTrigger className="h-8 w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dia">Por dia</SelectItem>
                    <SelectItem value="mes">Por mês</SelectItem>
                  </SelectContent>
                </Select>
              }
            >
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={aggTimeline}
                  margin={{
                    left: 8,
                    right: 8,
                    top: 8,
                    bottom: timelineMode === "dia" ? 24 : 8,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis
                    dataKey={timelineMode === "dia" ? "label" : "key"}
                    tick={{ fontSize: 10 }}
                    angle={timelineMode === "dia" ? -35 : 0}
                    textAnchor={timelineMode === "dia" ? "end" : "middle"}
                    height={timelineMode === "dia" ? 60 : 36}
                  />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const a = payload[0].payload as Agg;
                      return (
                        <div className="rounded-md border bg-background px-3 py-2 shadow-md">
                          <div className="text-xs text-muted-foreground mb-1">{a.key}</div>
                          {buildTooltipRows(a, delayedView.length)}
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="qtd"
                    fill={CHART_COLOR}
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                    onClick={(d) => {
                      const key = (d as unknown as { payload?: Agg }).payload?.key;
                      if (key) toggleCrossSlice({ kind: "timeline", key });
                    }}
                  >
                    {aggTimeline.map((a) => (
                      <Cell
                        key={a.key}
                        opacity={crossSafe.timelineKey != null && crossSafe.timelineKey !== a.key ? 0.35 : 1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <DetailTable
                className="max-h-[min(280px,42vh)] overflow-y-auto overflow-x-auto"
                rows={aggTimeline.map((a) => ({
                  dimensao: timelineMode === "dia" ? formatDataIsoParaBR(a.key) : a.key,
                  qtd: a.qtd,
                  media: formatMinHuman(a.media),
                  total: formatMinHuman(a.total),
                  pct: formatPercent(delayedView.length ? (a.qtd / delayedView.length) * 100 : 0),
                }))}
                columns={[
                  { key: "dimensao", label: timelineMode === "dia" ? "Dia" : "Mês" },
                  { key: "qtd", label: "Qtd" },
                  { key: "media", label: "Média" },
                  { key: "total", label: "Total" },
                  { key: "pct", label: "% rel." },
                ]}
              />
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline" size="sm">
                      <ListTree className="w-4 h-4 mr-1.5" />
                      Drill-down (linhas do recorte)
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[min(100vw-2rem,72rem)] max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Registros no recorte atual</DialogTitle>
                      <DialogDescription>
                        {totalOcorrencias} linha(s) com atraso &gt; {minDelay} min após filtros e cruzamento. Datas em
                        dd/mm/aaaa.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs whitespace-nowrap">DATA</TableHead>
                            <TableHead className="text-xs whitespace-nowrap">NOME</TableHead>
                            <TableHead className="text-xs whitespace-nowrap">Setor</TableHead>
                            <TableHead className="text-xs whitespace-nowrap">Equipe</TableHead>
                            <TableHead className="text-xs whitespace-nowrap">Turno</TableHead>
                            <TableHead className="text-xs whitespace-nowrap">ENT. 1</TableHead>
                            <TableHead className="text-xs whitespace-nowrap">SAÍ. 2</TableHead>
                            <TableHead className="text-xs whitespace-nowrap">NORMAIS</TableHead>
                            <TableHead className="text-xs whitespace-nowrap">FALTAS</TableHead>
                            <TableHead className="text-xs whitespace-nowrap">EXTRAS</TableHead>
                            <TableHead className="text-xs whitespace-nowrap">Previsto</TableHead>
                            <TableHead className="text-xs whitespace-nowrap">Atraso</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {delayedView.slice(0, 500).map((r, i) => (
                            <TableRow key={`${r.dataIso}-${r.nome}-${i}`}>
                              <TableCell className="font-mono text-xs whitespace-nowrap">{formatDataIsoParaBR(r.dataIso)}</TableCell>
                              <TableCell className="max-w-[180px] truncate text-xs" title={r.nome}>
                                {r.nome}
                              </TableCell>
                              <TableCell className="text-xs">{r.setorOrganico || "—"}</TableCell>
                              <TableCell className="text-xs">{r.equipeOrganico || "—"}</TableCell>
                              <TableCell className="text-xs max-w-[160px] truncate" title={r.turno}>
                                {r.turno}
                              </TableCell>
                              <TableCell className="font-mono text-xs whitespace-nowrap">{formatHoraPlanilha(r.entradaRealMin)}</TableCell>
                              <TableCell className="font-mono text-xs whitespace-nowrap">{formatHoraPlanilha(r.saidaRealMin)}</TableCell>
                              <TableCell className="font-mono text-xs whitespace-nowrap">{formatHoraPlanilha(r.normaisMin)}</TableCell>
                              <TableCell className="text-xs whitespace-nowrap">{r.faltasText || "—"}</TableCell>
                              <TableCell className="font-mono text-xs whitespace-nowrap">
                                {r.horaExtraMin > 0 ? formatHoraPlanilha(r.horaExtraMin) : "—"}
                              </TableCell>
                              <TableCell className="font-mono text-xs whitespace-nowrap">{formatClock(r.entradaPrevistaMin)}</TableCell>
                              <TableCell className="text-xs whitespace-nowrap">{formatMinHuman(r.atrasoMin)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {delayedView.length > 500 ? (
                      <p className="text-xs text-muted-foreground mt-2">
                        Mostrando 500 de {delayedView.length}. Exporte a planilha filtrada no Excel se precisar do completo.
                      </p>
                    ) : null}
                  </DialogContent>
                </Dialog>
              </div>
            </ChartBlock>
          </div>

          {typeof document !== "undefined" && rankingFloatedAgg
            ? createPortal(
                <div
                  ref={rankingFloatedPortalRef}
                  className="pointer-events-auto fixed z-[200] max-w-[min(840px,calc(100vw-1.5rem))]"
                  style={{ left: 0, top: 0 }}
                  onMouseEnter={clearRankingFloatedTtClose}
                  onMouseLeave={scheduleRankingFloatedTtClose}
                  role="tooltip"
                >
                  <RankingAtrasosTooltip
                    agg={rankingFloatedAgg}
                    totalDelayed={delayedView.length}
                    todasSancoes={sancoesRowsRaw}
                    isLoadingSancoes={isLoadingSancoes}
                    isErrorSancoes={isErrorSancoes}
                    ctpsByNomeNorm={ctpsByNomeNorm}
                    isLoadingOrganico={aguardandoCtpsBase}
                  />
                </div>,
                document.body,
              )
            : null}
        </>
      )}
    </div>
  );
}

function SortableDetailHead({
  label,
  col,
  sorts,
  widthPx,
  onSort,
  onResizeMouseDown,
  className,
}: {
  label: string;
  col: DetalheSortCol;
  sorts: DetalheSortLevel[];
  widthPx: number;
  onSort: (c: DetalheSortCol, e: React.MouseEvent<HTMLButtonElement>) => void;
  onResizeMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  className?: string;
}) {
  const idx = sorts.findIndex((s) => s.key === col);
  const active = idx >= 0;
  const dir = active ? sorts[idx].dir : null;
  const priority = active ? idx + 1 : null;
  return (
    <TableHead
      style={{ width: widthPx, minWidth: 52 }}
      className={cn(
        "relative p-0 text-xs whitespace-nowrap sticky top-0 z-10 bg-card border-b align-bottom shadow-[0_1px_0_hsl(var(--border))]",
        className,
      )}
    >
      <div className="relative flex min-h-12 items-stretch">
        <button
          type="button"
          className={cn(
            "flex min-w-0 flex-1 items-center gap-0.5 rounded-sm px-2 py-2 pr-3 text-left font-semibold text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            active && "text-foreground",
          )}
          onClick={(e) => onSort(col, e)}
        >
          <span className="min-w-0 truncate">{label}</span>
          {active && sorts.length > 1 && priority != null ? (
            <span
              className="inline-flex h-4 min-w-[1rem] shrink-0 items-center justify-center rounded-full bg-primary/15 px-1 text-[10px] font-bold text-primary"
              title={`Critério ${priority} de ${sorts.length}`}
            >
              {priority}
            </span>
          ) : null}
          {active && dir ? (
            dir === "asc" ? (
              <ArrowUp className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
            ) : (
              <ArrowDown className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
            )
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-35" aria-hidden />
          )}
        </button>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={`Redimensionar coluna ${label}`}
          tabIndex={-1}
          className="absolute right-0 top-0 z-20 h-full w-3 max-w-[12px] translate-x-1/2 cursor-col-resize select-none hover:bg-primary/25 active:bg-primary/40"
          onMouseDown={onResizeMouseDown}
        />
      </div>
    </TableHead>
  );
}

function ChartBlock({
  title,
  description,
  children,
  rightSlot,
  className,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  rightSlot?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            <CardDescription className="text-xs mt-1">{description}</CardDescription>
          </div>
          {rightSlot}
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col space-y-3">{children}</CardContent>
    </Card>
  );
}

function DetailTable({
  rows,
  columns,
  className,
  /** Quando definido, a primeira coluna usa esta % e as demais dividem o restante (útil para textos longos em “Dia”). */
  firstColumnWidthPct,
}: {
  rows: Record<string, string | number>[];
  columns: { key: string; label: string }[];
  /** Ex.: altura máxima + overflow para tabelas longas (gráfico temporal). */
  className?: string;
  firstColumnWidthPct?: number;
}) {
  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground py-2">Sem dados para o recorte.</p>;
  }
  const colPct = 100 / columns.length;
  const rest = firstColumnWidthPct != null ? Math.max(0, 100 - firstColumnWidthPct) : null;
  const otherPct = rest != null && columns.length > 1 ? rest / (columns.length - 1) : colPct;
  return (
    <div className={cn("w-full min-w-0 rounded-md border", className)}>
      <Table className="table-fixed">
        <colgroup>
          {columns.map((c, idx) => (
            <col
              key={c.key}
              style={{
                width:
                  firstColumnWidthPct != null && idx === 0
                    ? `${firstColumnWidthPct}%`
                    : `${otherPct}%`,
              }}
            />
          ))}
        </colgroup>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead
                key={c.key}
                className={cn("text-xs", c.key === "dimensao" ? "text-left" : "text-right")}
              >
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              {columns.map((c) => (
                <TableCell
                  key={c.key}
                  className={cn(
                    "text-xs",
                    c.key === "dimensao" ? "text-left" : "text-right tabular-nums",
                  )}
                >
                  {r[c.key]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
