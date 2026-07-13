import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CalendarRange, FileText, MapPin, Stethoscope, X } from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import KpiCard from "@rh/components/KpiCard";
import { Button } from "@rh/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@rh/components/ui/dialog";
import {
  applyFiltrosAtestados,
  buildAtestadosRelatorioModel,
  diaSemanaLabelToWeekdayIndex,
  type AtestadoCrossFilter,
  type AtestadosEvolucaoPonto,
} from "@rh/pages/FaltasAtestados/atestados-relatorio-logic";
import type { FaltaRow } from "@rh/types/api";

function formatIntPt(value: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);
}

function formatDecimalPt(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

type AtestadosRelatorioDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  colaboradorNome: string;
  /** Linhas do colaborador (mesmo recorte da trajetória; o modelo considera só atestados). */
  rows: FaltaRow[];
};

/** Alinhado ao painel de absenteísmo (ranking / tendências). */
const ABS_CHART_BAR = "#2f3138";
const ABS_CHART_LINE = "#2f3138";
const ABS_CHART_GRID = "hsl(20,2%,90%)";
const ABS_CHART_AXIS_TICK = "#808080";
/** Destaque de barra/ponto selecionado (bronze do painel). */
const ABS_CHART_SELECTED = "#b38b63";

const Y_LABEL_MAX_LINES = 5;
const Y_LABEL_LINE_HEIGHT = 11;

function toggleCrossFilter<K extends keyof AtestadoCrossFilter>(
  prev: AtestadoCrossFilter,
  key: K,
  value: NonNullable<AtestadoCrossFilter[K]>,
): AtestadoCrossFilter {
  const next: AtestadoCrossFilter = { ...prev };
  if (next[key] === value) {
    delete next[key];
  } else {
    next[key] = value;
  }
  return next;
}

/** Quebra rótulos longos em várias linhas (palavras; palavras muito longas são fatiadas). */
function wrapLabelLines(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const raw = String(text).trim();
  if (!raw) return [""];
  const words = raw.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  const pushLine = (s: string) => {
    if (lines.length >= maxLines) return;
    lines.push(s);
  };

  const flush = () => {
    if (current) {
      pushLine(current);
      current = "";
    }
  };

  for (const w of words) {
    if (lines.length >= maxLines) break;
    const chunks =
      w.length > maxCharsPerLine
        ? w.match(new RegExp(`.{1,${maxCharsPerLine}}`, "gu")) ?? [w.slice(0, maxCharsPerLine)]
        : [w];
    for (const part of chunks) {
      if (lines.length >= maxLines) break;
      const candidate = current ? `${current} ${part}` : part;
      if (candidate.length <= maxCharsPerLine) {
        current = candidate;
      } else {
        flush();
        if (part.length > maxCharsPerLine) {
          pushLine(part.slice(0, maxCharsPerLine));
        } else {
          current = part;
        }
      }
    }
  }
  flush();
  if (lines.length === 0) return [""];
  return lines.slice(0, maxLines);
}

type YAxisTickProps = {
  x?: number;
  y?: number;
  payload?: { value?: string | number };
};

function HorizBarYAxisTick(props: YAxisTickProps & { maxCharsPerLine: number }) {
  const { x = 0, y = 0, payload, maxCharsPerLine } = props;
  const raw = String(payload?.value ?? "");
  const lines = wrapLabelLines(raw, maxCharsPerLine, Y_LABEL_MAX_LINES);
  const startDy = -((lines.length - 1) * Y_LABEL_LINE_HEIGHT) / 2;
  return (
    <text x={x} y={y} textAnchor="end" fill={ABS_CHART_AXIS_TICK} fontSize={10}>
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? startDy : Y_LABEL_LINE_HEIGHT}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

function EvolucaoTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload: AtestadosEvolucaoPonto }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2.5 text-sm shadow-md">
      <p className="mb-2 font-medium text-foreground">{label}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Atestados no mês:{" "}
        <span className="font-semibold tabular-nums text-foreground">{formatIntPt(row.quantidade)}</span>
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Dias perdidos:{" "}
        <span className="font-semibold tabular-nums text-foreground">{formatDecimalPt(row.diasPerdidosMes)}</span>
      </p>
      <p className="mt-2 border-t border-border pt-2 text-[10px] text-muted-foreground">
        Clique no ponto para filtrar este mês (Power BI).
      </p>
    </div>
  );
}

function RankingAtestadosBarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: number | string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value;
  if (v == null) return null;
  return (
    <div className="max-w-[min(420px,90vw)] rounded-lg border border-border bg-popover px-3 py-2.5 text-sm shadow-md">
      <p className="mb-2 break-words font-medium text-foreground">{label}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Quantidade de atestados:{" "}
        <span className="font-semibold tabular-nums text-foreground">{formatIntPt(Number(v))}</span>
      </p>
    </div>
  );
}

function EvolucaoTemporalBlock({
  data,
  mesYmAtivo,
  onMesClick,
}: {
  data: AtestadosEvolucaoPonto[];
  mesYmAtivo?: string;
  onMesClick?: (ym: string) => void;
}) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 shadow-level-1 min-w-0">
        <h3 className="label-industrial mb-2 text-sm font-semibold text-foreground">
          Evolução de atestados ao longo do tempo
        </h3>
        <p className="text-sm text-muted-foreground">
          Nenhuma data válida nos registros para montar a série mensal.
        </p>
      </div>
    );
  }

  const manyPontos = data.length > 18;
  const xAngle = data.length > 10 ? -38 : 0;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-level-1 min-w-0">
      <h3 className="label-industrial mb-3 text-sm font-semibold text-foreground">
        Evolução de atestados ao longo do tempo
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Contagem de atestados por mês (calendário) ao longo da trajetória. Clique em um mês para filtrar os demais
        gráficos.
      </p>
      <div className="h-[min(340px,40vh)] w-full min-h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: xAngle !== 0 ? 56 : 28 }}>
            <defs>
              <linearGradient id="evolucaoAtestadosArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ABS_CHART_LINE} stopOpacity={0.55} />
                <stop offset="55%" stopColor={ABS_CHART_LINE} stopOpacity={0.14} />
                <stop offset="100%" stopColor={ABS_CHART_LINE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={ABS_CHART_GRID} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: manyPontos ? 8 : 10, fill: ABS_CHART_AXIS_TICK }}
              interval={manyPontos ? Math.max(0, Math.floor(data.length / 14)) : 0}
              angle={xAngle}
              textAnchor="end"
              height={xAngle !== 0 ? 64 : 28}
            />
            <YAxis tick={{ fontSize: 11, fill: ABS_CHART_AXIS_TICK }} allowDecimals={false} width={44} />
            <Tooltip content={<EvolucaoTooltip />} />
            <Area
              type="monotone"
              dataKey="quantidade"
              name="Atestados no mês"
              stroke={ABS_CHART_LINE}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="url(#evolucaoAtestadosArea)"
              dot={(props: { cx?: number; cy?: number; payload?: AtestadosEvolucaoPonto }) => {
                const { cx = 0, cy = 0, payload } = props;
                const ym = payload?.ym;
                const active = ym != null && mesYmAtivo === ym;
                const r = data.length > 40 ? 2.5 : 3.5;
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill={active ? ABS_CHART_SELECTED : ABS_CHART_LINE}
                    stroke="hsl(var(--card))"
                    strokeWidth={2}
                    style={{ cursor: onMesClick ? "pointer" : undefined }}
                    onClick={() => ym && onMesClick?.(ym)}
                  />
                );
              }}
              activeDot={{ r: 6, fill: ABS_CHART_SELECTED }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

type BarDim = "local" | "medico" | "cid" | "diaSemana";

function BarBlock({
  title,
  data,
  emptyHint,
  layoutVertical,
  yAxisWidth,
  tickMaxLen,
  dim,
  filtro,
  onCrossClick,
}: {
  title: string;
  data: { name: string; quantidade: number }[];
  emptyHint?: string;
  layoutVertical?: boolean;
  yAxisWidth?: number;
  tickMaxLen?: number;
  dim?: BarDim;
  filtro?: AtestadoCrossFilter;
  onCrossClick?: (dim: BarDim, name: string) => void;
}) {
  const hasData = data.some((d) => d.quantidade > 0);
  if (!hasData) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 shadow-level-1">
        <h3 className="label-industrial mb-2 text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{emptyHint ?? "Sem dados para exibir."}</p>
      </div>
    );
  }

  const isBarActive = (name: string): boolean => {
    if (!dim || !filtro) return false;
    if (dim === "local") return filtro.local === name;
    if (dim === "medico") return filtro.medico === name;
    if (dim === "cid") return filtro.cid === name;
    if (dim === "diaSemana") {
      const idx = diaSemanaLabelToWeekdayIndex(name);
      return idx !== null && filtro.diaSemana === idx;
    }
    return false;
  };

  const barFill = (name: string) => (dim && isBarActive(name) ? ABS_CHART_SELECTED : ABS_CHART_BAR);

  const handleBarClick = (payload: { name?: string }) => {
    if (!dim || !onCrossClick || payload?.name == null) return;
    onCrossClick(dim, String(payload.name));
  };

  if (layoutVertical) {
    const truncateTicks = tickMaxLen != null && tickMaxLen > 0;
    const baseW = yAxisWidth ?? 168;
    const maxCharsPerLine = truncateTicks
      ? Math.max(8, tickMaxLen)
      : Math.max(14, Math.min(22, Math.floor(baseW / 6.2)));
    const yW = truncateTicks
      ? Math.min(520, baseW)
      : Math.min(280, Math.max(120, maxCharsPerLine * 6.2 + 24));
    const lineCounts = data.map((d) => wrapLabelLines(String(d.name), maxCharsPerLine, Y_LABEL_MAX_LINES).length);
    const maxLinesInAnyRow = Math.max(1, ...lineCounts);
    const barRowPx = Math.max(34, maxLinesInAnyRow * Y_LABEL_LINE_HEIGHT + 16);
    const chartHeight = Math.min(2400, Math.max(200, data.length * barRowPx + 48));

    return (
      <div className="rounded-xl border border-border bg-card p-4 shadow-level-1 min-w-0">
        <h3 className="label-industrial mb-3 text-sm font-semibold text-foreground">{title}</h3>
        <div className="max-h-[min(720px,68vh)] w-full overflow-x-auto overflow-y-auto rounded-md">
          <div style={{ height: chartHeight, minWidth: Math.min(720, yW + 120) }} className="min-h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={data} margin={{ left: 4, right: 12, top: 8, bottom: 8 }} barCategoryGap="12%">
                <CartesianGrid strokeDasharray="3 3" stroke={ABS_CHART_GRID} vertical={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: ABS_CHART_AXIS_TICK }} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={yW}
                  interval={0}
                  tickMargin={6}
                  tick={
                    truncateTicks ? (
                      { fontSize: 10, fill: ABS_CHART_AXIS_TICK }
                    ) : (
                      (tickProps: YAxisTickProps) => (
                        <HorizBarYAxisTick {...tickProps} maxCharsPerLine={maxCharsPerLine} />
                      )
                    )
                  }
                  tickFormatter={
                    truncateTicks && tickMaxLen != null
                      ? (v: string) =>
                          v.length > tickMaxLen ? `${v.slice(0, Math.max(1, tickMaxLen - 2))}…` : v
                      : undefined
                  }
                />
                <Tooltip content={<RankingAtestadosBarTooltip />} />
                <Bar
                  dataKey="quantidade"
                  radius={[0, 4, 4, 0]}
                  name="Quantidade de atestados"
                  cursor={onCrossClick ? "pointer" : undefined}
                  onClick={(e: unknown) => handleBarClick(e as { name?: string })}
                >
                  {data.map((entry, i) => (
                    <Cell key={`cell-${i}`} fill={barFill(entry.name)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-level-1 min-w-0">
      <h3 className="label-industrial mb-3 text-sm font-semibold text-foreground">{title}</h3>
      <div className="h-[min(300px,36vh)] w-full min-h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 48 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={ABS_CHART_GRID} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: ABS_CHART_AXIS_TICK }}
              interval={0}
              angle={-35}
              textAnchor="end"
              height={64}
            />
            <YAxis tick={{ fontSize: 11, fill: ABS_CHART_AXIS_TICK }} allowDecimals={false} />
            <Tooltip content={<RankingAtestadosBarTooltip />} />
            <Bar
              dataKey="quantidade"
              radius={[4, 4, 0, 0]}
              name="Quantidade de atestados"
              cursor={onCrossClick ? "pointer" : undefined}
              onClick={(e: unknown) => handleBarClick(e as { name?: string })}
            >
              {data.map((entry, i) => (
                <Cell key={`cell-${i}`} fill={barFill(entry.name)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function AtestadosRelatorioDialog({ open, onOpenChange, colaboradorNome, rows }: AtestadosRelatorioDialogProps) {
  const nome = colaboradorNome.trim() || "Colaborador";
  const [filtro, setFiltro] = useState<AtestadoCrossFilter>({});

  useEffect(() => {
    if (!open) setFiltro({});
  }, [open]);

  useEffect(() => {
    setFiltro({});
  }, [rows]);

  const model = useMemo(() => {
    if (!rows.length) return null;
    return buildAtestadosRelatorioModel(applyFiltrosAtestados(rows, filtro));
  }, [rows, filtro]);

  const totalAtestadosSemFiltro = useMemo(() => {
    if (!rows.length) return 0;
    return buildAtestadosRelatorioModel(rows).totalAtestados;
  }, [rows]);

  const hasFiltro = Object.keys(filtro).length > 0;

  const handleCrossClick = (dim: BarDim, name: string) => {
    if (dim === "diaSemana") {
      const idx = diaSemanaLabelToWeekdayIndex(name);
      if (idx === null) return;
      setFiltro((f) => toggleCrossFilter(f, "diaSemana", idx));
      return;
    }
    if (dim === "local") {
      setFiltro((f) => toggleCrossFilter(f, "local", name));
      return;
    }
    if (dim === "medico") {
      setFiltro((f) => toggleCrossFilter(f, "medico", name));
      return;
    }
    if (dim === "cid") {
      setFiltro((f) => toggleCrossFilter(f, "cid", name));
    }
  };

  const handleMesClick = (ym: string) => {
    setFiltro((f) => toggleCrossFilter(f, "mesYm", ym));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex !max-w-none w-[min(96vw,1280px)] max-h-[min(92vh,1080px)] flex-col gap-0 overflow-hidden p-0 sm:!max-w-none">
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-5 py-4 text-left">
          <DialogTitle className="text-xl">Relatório de atestados</DialogTitle>
          <DialogDescription className="text-muted-foreground leading-relaxed">
            Resumo da trajetória completa de atestados de{" "}
            <span className="font-medium text-foreground">{nome}</span>
            <span className="block pt-1">
              Não usa o filtro de período nem o drill-down do painel; considera todo o histórico disponível no sistema,
              respeitando apenas a base de colaboradores (orgânico / multiseleção) ativa no dashboard.
            </span>
            <span className="block pt-1 text-xs">
              Clique em barras ou pontos da evolução para cruzar filtros (estilo Power BI). Clique de novo no mesmo item
              para remover o filtro.
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {totalAtestadosSemFiltro === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhum atestado encontrado na trajetória completa para este colaborador.
            </p>
          ) : model && model.totalAtestados === 0 && hasFiltro ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhum atestado corresponde aos filtros selecionados.{" "}
              <Button type="button" variant="link" className="h-auto p-0 align-baseline" onClick={() => setFiltro({})}>
                Limpar filtros
              </Button>
            </p>
          ) : model ? (
            <>
              {hasFiltro ? (
                <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Filtros ativos
                  </span>
                  {filtro.mesYm ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-popover px-2 py-0.5 text-xs">
                      Mês: {filtro.mesYm}
                      <button
                        type="button"
                        className="rounded p-0.5 hover:bg-muted"
                        aria-label="Remover filtro de mês"
                        onClick={() => setFiltro((f) => {
                          const n = { ...f };
                          delete n.mesYm;
                          return n;
                        })}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ) : null}
                  {filtro.local ? (
                    <span className="inline-flex max-w-[min(100%,280px)] items-center gap-1 rounded-full border border-border bg-popover px-2 py-0.5 text-xs">
                      <span className="truncate">Local: {filtro.local}</span>
                      <button
                        type="button"
                        className="shrink-0 rounded p-0.5 hover:bg-muted"
                        aria-label="Remover filtro de local"
                        onClick={() => setFiltro((f) => {
                          const n = { ...f };
                          delete n.local;
                          return n;
                        })}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ) : null}
                  {filtro.medico ? (
                    <span className="inline-flex max-w-[min(100%,280px)] items-center gap-1 rounded-full border border-border bg-popover px-2 py-0.5 text-xs">
                      <span className="truncate">Médico: {filtro.medico}</span>
                      <button
                        type="button"
                        className="shrink-0 rounded p-0.5 hover:bg-muted"
                        aria-label="Remover filtro de médico"
                        onClick={() => setFiltro((f) => {
                          const n = { ...f };
                          delete n.medico;
                          return n;
                        })}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ) : null}
                  {filtro.cid ? (
                    <span className="inline-flex max-w-[min(100%,320px)] items-center gap-1 rounded-full border border-border bg-popover px-2 py-0.5 text-xs">
                      <span className="truncate">CID: {filtro.cid}</span>
                      <button
                        type="button"
                        className="shrink-0 rounded p-0.5 hover:bg-muted"
                        aria-label="Remover filtro de CID"
                        onClick={() => setFiltro((f) => {
                          const n = { ...f };
                          delete n.cid;
                          return n;
                        })}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ) : null}
                  {filtro.diaSemana !== undefined ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-popover px-2 py-0.5 text-xs">
                      Dia: {model.barrasDiasSemana.find((b) => diaSemanaLabelToWeekdayIndex(b.name) === filtro.diaSemana)?.name ?? filtro.diaSemana}
                      <button
                        type="button"
                        className="rounded p-0.5 hover:bg-muted"
                        aria-label="Remover filtro de dia da semana"
                        onClick={() => setFiltro((f) => {
                          const n = { ...f };
                          delete n.diaSemana;
                          return n;
                        })}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ) : null}
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setFiltro({})}>
                    Limpar todos
                  </Button>
                </div>
              ) : null}

              <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <KpiCard
                  title="Total de atestados"
                  value={formatIntPt(model.totalAtestados)}
                  icon={FileText}
                  alertColor="green"
                />
                <KpiCard
                  title="Total de dias perdidos"
                  value={formatDecimalPt(model.totalDiasPerdidos)}
                  icon={CalendarDays}
                  alertColor="green"
                />
                <KpiCard
                  title="Local mais recorrente"
                  value={model.localMaisRecorrente}
                  icon={MapPin}
                  alertColor="yellow"
                  valueMultiline
                />
                <KpiCard
                  title="Dia mais recorrente"
                  value={model.diaMaisRecorrente}
                  icon={CalendarRange}
                  alertColor="yellow"
                  valueMultiline
                />
                <KpiCard
                  title="Médico mais recorrente"
                  value={model.medicoMaisRecorrente}
                  icon={Stethoscope}
                  alertColor="yellow"
                  valueMultiline
                />
              </div>
              <div className="mt-6 grid min-w-0 gap-5">
                <EvolucaoTemporalBlock
                  data={model.evolucaoTemporal}
                  mesYmAtivo={filtro.mesYm}
                  onMesClick={handleMesClick}
                />
                <BarBlock
                  title="Atestados por dia da semana"
                  data={model.barrasDiasSemana}
                  emptyHint="Nenhuma data válida nos atestados."
                  dim="diaSemana"
                  filtro={filtro}
                  onCrossClick={handleCrossClick}
                />
                <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3 xl:gap-5">
                  <BarBlock
                    title="Locais de atendimento (ranking completo)"
                    data={model.barrasLocais}
                    layoutVertical
                    yAxisWidth={188}
                    emptyHint="Sem local informado nos registros."
                    dim="local"
                    filtro={filtro}
                    onCrossClick={handleCrossClick}
                  />
                  <BarBlock
                    title="Médicos (ranking completo)"
                    data={model.barrasMedicos}
                    layoutVertical
                    yAxisWidth={188}
                    emptyHint="Sem médico informado nos registros."
                    dim="medico"
                    filtro={filtro}
                    onCrossClick={handleCrossClick}
                  />
                  <BarBlock
                    title="Motivos de CID (ranking completo)"
                    data={model.barrasMotivosCid}
                    layoutVertical
                    yAxisWidth={200}
                    emptyHint="Sem CID informado nos registros."
                    dim="cid"
                    filtro={filtro}
                    onCrossClick={handleCrossClick}
                  />
                </div>
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
