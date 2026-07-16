import { useMemo, useRef, useState, type PointerEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, History, Maximize2, Trash2 } from "lucide-react";
import { getOrganicoTrajetoria, deleteOrganicoTrajetoria, isApiConfigured } from "@rh/lib/api-client";
import { isMaster } from "@rh/lib/auth";
import { useToast } from "@rh/hooks/use-toast";
import type { OrganicoTrajetoriaItem } from "@rh/types/api";
import { Button } from "@rh/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@rh/components/ui/dialog";
import { cn } from "@rh/lib/utils";

type TimelineItem = OrganicoTrajetoriaItem | (Omit<OrganicoTrajetoriaItem, "tipoEvento"> & { tipoEvento: "admissao" });
const ADMISSAO_BASELINE_MOTIVO = "__admissao_inicial__";

function formatDateLabel(value: string): string {
  if (!value) return "Data não informada";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function normalizeIsoDate(value: string): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const br = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (br) {
    const [, day, month, year] = br;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function formatSalarioInicialFallback(value: string): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^R\$/i.test(raw)) {
    return raw.includes("por mês") ? raw : `${raw} por mês`;
  }
  const normalized = raw.replace(/[^\d,.-]/g, "");
  if (!normalized) return "";
  let asNumber = normalized;
  if (asNumber.includes(",")) {
    asNumber = asNumber.replace(/\./g, "").replace(",", ".");
  }
  const parsed = Number(asNumber);
  if (!Number.isFinite(parsed) || parsed <= 0) return "";
  return `R$ ${parsed.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} por mês`;
}

function formatMonthYearLabel(start: string, end: string): string {
  if (!start || !end) return "Período não informado";
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return `${formatDateLabel(start)} a ${formatDateLabel(end)}`;
  const fmt = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" });
  return `${fmt.format(startDate)} a ${fmt.format(endDate)}`;
}

function EventBadge({ item }: { item: TimelineItem }) {
  const classes =
    item.tipoEvento === "admissao"
      ? "bg-slate-50 text-slate-700 border-slate-200"
      : item.tipoEvento === "salario"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : item.tipoEvento === "cargo"
        ? "bg-blue-50 text-blue-700 border-blue-200"
        : "bg-violet-50 text-violet-700 border-violet-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${classes}`}>
      {item.tipoEvento === "admissao"
        ? "Admissão"
        : item.tipoEvento === "salario"
          ? "Salário"
          : item.tipoEvento === "cargo"
            ? "Cargo"
            : "Função"}
    </span>
  );
}

function TrajetoriaTimeline({
  items,
  expanded = false,
  masterCanDelete = false,
  onDeleteItem,
  deletePending = false,
}: {
  items: TimelineItem[];
  expanded?: boolean;
  /** Somente master: excluir evento persistido em `organico_trajetoria`. */
  masterCanDelete?: boolean;
  onDeleteItem?: (id: string) => void;
  deletePending?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{ pointerId: number; startX: number; startScrollLeft: number } | null>(null);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    /** Não iniciar arraste ao clicar em controles (senão o capture rouba o clique do botão Excluir). */
    if (target?.closest("button, a, input, textarea, select, [role='button']")) {
      return;
    }
    const container = scrollRef.current;
    if (!container) return;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: container.scrollLeft,
    };
    container.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const container = scrollRef.current;
    const dragState = dragStateRef.current;
    if (!container || !dragState || dragState.pointerId !== event.pointerId) return;
    const delta = event.clientX - dragState.startX;
    container.scrollLeft = dragState.startScrollLeft - delta;
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const container = scrollRef.current;
    const dragState = dragStateRef.current;
    if (!container || !dragState || dragState.pointerId !== event.pointerId) return;
    dragStateRef.current = null;
    if (container.hasPointerCapture(event.pointerId)) {
      container.releasePointerCapture(event.pointerId);
    }
  };

  const columns = useMemo(() => {
    const orderedDates: string[] = [];
    const byDate = new Map<string, TimelineItem[]>();
    for (const item of items) {
      const key = normalizeIsoDate(item.dataEvento) || String(item.dataEvento ?? "").trim() || "sem-data";
      if (!byDate.has(key)) {
        byDate.set(key, []);
        orderedDates.push(key);
      }
      byDate.get(key)!.push(item);
    }
    return orderedDates.map((date) => ({ date, items: byDate.get(date) ?? [] }));
  }, [items]);

  const renderEventCard = (item: TimelineItem) => {
    const showDelete =
      masterCanDelete &&
      item.tipoEvento !== "admissao" &&
      Boolean(onDeleteItem);
    return (
      <article
        key={item.id}
        className={cn(
          "rounded-2xl border border-border/70 bg-card p-4 shadow-sm ring-1 ring-black/5 overflow-x-hidden overflow-y-auto",
          expanded ? "h-[240px]" : "h-[210px]",
          // Fundo sólido + leve tinte via gradiente (gradiente compõe sobre o bg-card, sem transparência real).
          item.tipoEvento === "admissao" &&
            "border-primary/20 bg-gradient-to-b from-primary/[0.04] to-primary/[0.04]",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{item.titulo}</p>
            <EventBadge item={item} />
          </div>
          {showDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteItem?.(item.id);
              }}
              disabled={deletePending}
              title="Excluir evento da trajetória"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>

        <p className="mt-3 whitespace-pre-line text-sm leading-6 text-foreground/90">{item.descricao}</p>

        {item.motivo ? (
          <div className="mt-3 rounded-lg border border-border/60 bg-muted/35 px-3 py-2">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              Motivo
            </div>
            <p className="mt-1 text-sm leading-6 text-foreground/90">{item.motivo}</p>
          </div>
        ) : item.origemArquivo?.includes("aguardando motivo") ? (
          <div className="mt-3 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/10 px-3 py-2">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-amber-900/80 dark:text-amber-200/90">
              <FileText className="h-3.5 w-3.5" />
              Motivo
            </div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Aguardando inserção do motivo.
            </p>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {item.origemArquivo ? <span>Arquivo: {item.origemArquivo}</span> : null}
          {item.importadoPor ? <span>Importado por: {item.importadoPor}</span> : null}
        </div>
      </article>
    );
  };

  return (
    <div className={cn("space-y-3", expanded && "flex h-full min-h-0 flex-col")}>
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Arraste horizontalmente sobre a linha do tempo para navegar — a rolagem vertical não desloca a timeline
      </p>

      <div
        ref={scrollRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={cn(
          "cursor-grab overflow-x-auto rounded-2xl border border-border/80 bg-gradient-to-b from-background to-muted/20 p-4 active:cursor-grabbing md:p-6",
          expanded ? "min-h-0 flex-1 overflow-y-auto pb-6" : "overflow-y-hidden",
        )}
      >
        <div
          className="relative min-w-max"
          style={{ width: `${Math.max(columns.length * (expanded ? 420 : 320), expanded ? 1400 : 900)}px` }}
        >
          <div className="pointer-events-none absolute left-0 right-0 top-1/2 z-[1] h-[2px] -translate-y-1/2 rounded-full bg-gradient-to-r from-primary/20 via-primary/50 to-primary/20" />

          <div className="flex items-stretch gap-6 md:gap-8">
            {columns.map((column, columnIndex) => {
              // Alterna o "lado inicial" por marco da timeline para evitar concentração no topo
              // quando existe apenas 1 movimentação por data.
              const topItems = column.items.filter((_, index) => (index + columnIndex) % 2 === 0);
              const bottomItems = column.items.filter((_, index) => (index + columnIndex) % 2 === 1);
              const hasSalario = column.items.some((item) => item.tipoEvento === "salario");
              const hasFuncaoOuCargo = column.items.some((item) => item.tipoEvento === "funcao" || item.tipoEvento === "cargo");
              const hasIndicadorFuncaoNoMotivo = column.items.some((item) => {
                const motivo = String(item.motivo ?? "").toLocaleLowerCase("pt-BR");
                return motivo.includes("funcao") || motivo.includes("função");
              });
              const isPromocaoMarco = hasSalario && (hasFuncaoOuCargo || hasIndicadorFuncaoNoMotivo);
              return (
                <div
                  key={column.date}
                  className={cn(
                    "relative shrink-0 snap-center",
                    expanded ? "h-[640px] w-[400px]" : "h-[560px] w-[300px] md:w-[320px]",
                  )}
                >
                  <div className="absolute left-1/2 top-1/2 z-30 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
                    <div
                      className={cn(
                        "mb-2 rounded-full border bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground shadow-sm",
                        isPromocaoMarco
                          ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-100"
                          : "border-primary/20",
                      )}
                    >
                      {formatDateLabel(column.date)}
                    </div>
                    <div
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full border bg-background text-primary shadow-sm md:h-10 md:w-10",
                        isPromocaoMarco
                          ? "border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-500/60 dark:bg-amber-500/15 dark:text-amber-200"
                          : "border-primary/20",
                      )}
                      title={isPromocaoMarco ? "Possível promoção: salário e função alterados no mesmo dia" : undefined}
                    >
                      <History className="h-4 w-4" />
                    </div>
                  </div>

                  <div className="absolute bottom-1/2 left-1/2 z-[8] h-14 w-px -translate-x-1/2 bg-border" />
                  <div className="absolute left-1/2 top-1/2 z-[8] h-14 w-px -translate-x-1/2 bg-border" />

                  <div className="absolute left-1/2 top-0 z-10 flex max-h-[calc(50%-4.25rem)] w-[88%] -translate-x-1/2 flex-col gap-3 overflow-x-hidden overflow-y-auto pr-1">
                    {topItems.map(renderEventCard)}
                  </div>
                  <div className="absolute left-1/2 top-[calc(50%+4.25rem)] z-10 flex max-h-[calc(50%-4.25rem)] w-[88%] -translate-x-1/2 flex-col gap-3 overflow-x-hidden overflow-y-auto pr-1">
                    {bottomItems.map(renderEventCard)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function OrganicoTrajetoriaTab({
  open,
  matricula,
  nome,
  admissao,
  cargoAtual,
  salarioCtpsAtual,
}: {
  open: boolean;
  matricula?: string | null;
  nome?: string | null;
  admissao?: string | null;
  cargoAtual?: string | null;
  salarioCtpsAtual?: string | number | null;
}) {
  const matriculaValue = String(matricula ?? "").trim();
  const nomeValue = String(nome ?? "").trim();
  const admissaoValue = String(admissao ?? "").trim();
  const cargoAtualValue = String(cargoAtual ?? "").trim();
  const salarioCtpsAtualValue = String(salarioCtpsAtual ?? "").trim();
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const masterCanDelete = isMaster() && isApiConfigured();

  const query = useQuery({
    queryKey: ["organico-trajetoria", matriculaValue, nomeValue],
    queryFn: () => getOrganicoTrajetoria({ matricula: matriculaValue, nome: nomeValue }),
    enabled: open && Boolean(matriculaValue || nomeValue),
  });

  const deleteTrajetoriaMutation = useMutation({
    mutationFn: (id: string) => deleteOrganicoTrajetoria({ id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["organico-trajetoria", matriculaValue, nomeValue] });
      await queryClient.invalidateQueries({ queryKey: ["organico-alteracoes-pendentes"] });
      toast({ title: "Evento excluído", description: "O ponto foi removido da trajetória." });
    },
    onError: (error) => {
      toast({
        title: "Erro ao excluir",
        description: error instanceof Error ? error.message : "Não foi possível excluir o evento.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteTrajetoria = (id: string) => {
    if (!masterCanDelete || deleteTrajetoriaMutation.isPending) return;
    deleteTrajetoriaMutation.mutate(id);
  };

  const items = useMemo(() => {
    const allRows = [...(query.data ?? [])];
    const sorted = allRows.sort((a, b) => {
      if (a.dataEvento !== b.dataEvento) return a.dataEvento.localeCompare(b.dataEvento);
      return a.createdAt.localeCompare(b.createdAt);
    });

    const admissaoIso = normalizeIsoDate(admissaoValue);
    if (!admissaoIso) return sorted;

    const baselineRows = sorted.filter(
      (row) => normalizeIsoDate(row.dataEvento) === admissaoIso && row.motivo === ADMISSAO_BASELINE_MOTIVO,
    );
    const salarioInicialBaseline =
      baselineRows.find((row) => row.tipoEvento === "salario")?.descricao.trim() ??
      baselineRows.find((row) => row.tipoEvento === "salario")?.motivo?.trim() ??
      "";
    const cargoInicialBaseline = baselineRows.find((row) => row.tipoEvento === "cargo")?.descricao.replace(/^Cargo:\s*/i, "").trim() ?? "";
    const salarioInicial = salarioInicialBaseline || formatSalarioInicialFallback(salarioCtpsAtualValue);
    const cargoInicial = cargoInicialBaseline || cargoAtualValue;
    const admissaoDescricao = [
      "Início do vínculo do colaborador na empresa.",
      cargoInicial ? `Cargo inicial: ${cargoInicial}` : "",
      salarioInicial ? `Salário inicial: ${salarioInicial}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const admissaoItem: TimelineItem = {
      id: `admissao-${matriculaValue || nomeValue || admissaoIso}`,
      colaboradorMatricula: matriculaValue,
      colaboradorNome: nomeValue,
      dataEvento: admissaoIso,
      tipoEvento: "admissao",
      titulo: "Admissão",
      descricao: admissaoDescricao,
      motivo: null,
      origemArquivo: null,
      importadoPor: null,
      createdAt: `${admissaoIso}T00:00:00.000Z`,
    };

    const visibleRows = sorted.filter((row) => row.motivo !== ADMISSAO_BASELINE_MOTIVO);
    return [admissaoItem, ...visibleRows].sort((a, b) => {
      if (a.dataEvento !== b.dataEvento) return a.dataEvento.localeCompare(b.dataEvento);
      if (a.tipoEvento === "admissao" && b.tipoEvento !== "admissao") return -1;
      if (b.tipoEvento === "admissao" && a.tipoEvento !== "admissao") return 1;
      return a.createdAt.localeCompare(b.createdAt);
    });
  }, [admissaoValue, cargoAtualValue, matriculaValue, nomeValue, query.data, salarioCtpsAtualValue]);

  const summary = useMemo(() => {
    if (items.length === 0) return null;
    const first = items[0]?.dataEvento ?? "";
    const last = items[items.length - 1]?.dataEvento ?? "";
    const movimentacoes = items.filter((item) => item.tipoEvento !== "admissao").length;
    return {
      totalEventos: new Set(items.map((item) => normalizeIsoDate(item.dataEvento) || item.dataEvento)).size,
      movimentacoes,
      periodo: formatMonthYearLabel(first, last),
    };
  }, [items]);

  if (query.isError) {
    return (
      <div className="rounded-xl border border-dashed border-destructive/40 bg-destructive/5 px-4 py-8 text-sm text-destructive">
        {query.error instanceof Error
          ? `Não foi possível carregar a trajetória: ${query.error.message}`
          : "Não foi possível carregar a trajetória deste colaborador."}
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
        Carregando trajetória do colaborador...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
        Nenhum histórico de trajetória foi importado para este colaborador.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/80 bg-card/70 p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
            <History className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Linha do tempo da trajetória</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Visualização cronológica da jornada do colaborador, desde a admissão até as últimas movimentações.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setExpanded(true)}>
          <Maximize2 className="h-3.5 w-3.5" />
          Tela cheia
        </Button>
      </div>

      {summary ? (
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border/70 bg-background/80 px-4 py-3 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Início ao fim</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{summary.periodo}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/80 px-4 py-3 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Movimentações</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{summary.movimentacoes}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/80 px-4 py-3 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Marcos da timeline</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{summary.totalEventos}</p>
          </div>
        </div>
      ) : null}

      <TrajetoriaTimeline
        items={items}
        masterCanDelete={masterCanDelete}
        onDeleteItem={handleDeleteTrajetoria}
        deletePending={deleteTrajetoriaMutation.isPending}
      />

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="flex h-[96vh] w-[98vw] max-w-[98vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[98vw]">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>Trajetória completa do colaborador</DialogTitle>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col px-6 py-5">
            {summary ? (
              <div className="mb-5 grid shrink-0 gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-border/70 bg-background/80 px-4 py-3 shadow-sm">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Início ao fim</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{summary.periodo}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/80 px-4 py-3 shadow-sm">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Movimentações</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{summary.movimentacoes}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/80 px-4 py-3 shadow-sm">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Marcos da timeline</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{summary.totalEventos}</p>
                </div>
              </div>
            ) : null}
            <div className="min-h-0 flex-1">
              <TrajetoriaTimeline
                items={items}
                expanded
                masterCanDelete={masterCanDelete}
                onDeleteItem={handleDeleteTrajetoria}
                deletePending={deleteTrajetoriaMutation.isPending}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
