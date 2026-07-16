import { memo, type ReactNode } from "react";
import { Eye, MessageSquareMore, Pencil } from "lucide-react";
import { cn } from "@rh/lib/utils";
import { ORGANICO_IDX, organicoRowToColaborador, getStatusFromRow, parseCtpsToNumber } from "./organico-derive";
import { useOrganicoCardFoto } from "./useOrganicoCardFoto";
import { formatCurrencyBRLDisplay, formatDateBRDisplay } from "./organico-display";
import type { OrganicoSheetRow } from "./useOrganicoImport";
import type { OrganicoCardViewMode } from "./organico-card-view";
import { OrganicoSecullumPendenciaDot } from "./OrganicoSecullumPendenciasPanel";

const statusColors: Record<string, string> = {
  Ativo: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  Férias: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  Afastado: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  Desligado: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

function getInitials(name: string): string {
  return (
    name
      .split(" ")
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "—"
  );
}

function StatusBadge({ status, size }: { status: string; size: "sm" | "md" | "lg" }) {
  const sz =
    size === "lg"
      ? "text-sm px-2.5 py-1"
      : size === "md"
        ? "text-xs px-2 py-0.5"
        : "text-[10px] px-1.5 py-0.5";
  return (
    <span className={cn("font-medium rounded-full shrink-0", sz, statusColors[status] ?? "bg-muted text-muted-foreground")}>
      {status}
    </span>
  );
}

export const OrganicoCard = memo(function OrganicoCard({
  row,
  rowIndex,
  demissao,
  pendenciaSecullum = false,
  fotoCadastrada = false,
  fotoApiHabilitada = false,
  hasComments = false,
  showCustoTotal = false,
  custoRevealed = false,
  onToggleCustoTotal,
  onEdit,
  onView,
  readOnly = false,
  viewMode = "medium",
}: {
  row: OrganicoSheetRow;
  rowIndex: number;
  demissao?: string;
  /** Pendência de justificativa Secullum (CTPS/cargo) — exibe indicador no card. */
  pendenciaSecullum?: boolean;
  /** Há linha em `organico_fotos` para esta matrícula (resumo leve). */
  fotoCadastrada?: boolean;
  /** Pode chamar API de foto (permissão + URL configurada). */
  fotoApiHabilitada?: boolean;
  hasComments?: boolean;
  showCustoTotal?: boolean;
  custoRevealed?: boolean;
  onToggleCustoTotal?: () => void;
  onEdit?: (i: number) => void;
  onView?: (i: number) => void;
  readOnly?: boolean;
  viewMode?: OrganicoCardViewMode;
}) {
  const matricula = String(row[ORGANICO_IDX.MATRICULA] ?? "").trim();
  const nomeColaborador = String(row[ORGANICO_IDX.NOME] ?? "").trim();
  const { rootRef, fotoSrc } = useOrganicoCardFoto({
    matricula,
    nome: nomeColaborador,
    fotoDisponivel: fotoCadastrada,
    podeBuscar: fotoApiHabilitada,
  });
  const emp = organicoRowToColaborador({
    id: matricula,
    values: row,
    demissaoApi: demissao,
  });
  const status = getStatusFromRow(row);
  const isDesligado = status === "Desligado";

  if (!emp) return null;

  const handleEdit = () => onEdit?.(rowIndex);
  const handleView = () => onView?.(rowIndex);
  const admSource = emp.admissao || String(row[ORGANICO_IDX.ADMISSAO] ?? "");
  const admLabel = admSource.trim() ? formatDateBRDisplay(admSource) : "—";
  const demissaoLabel = demissao?.trim() ? formatDateBRDisplay(demissao) : "";
  const custoTotalMes = (() => {
    const raw = row[75];
    const n = typeof raw === "number" && Number.isFinite(raw) ? raw : parseCtpsToNumber(raw);
    return Number.isFinite(n) ? n : 0;
  })();
  const custoTotalLabel = showCustoTotal ? formatCurrencyBRLDisplay(custoTotalMes) : "*****";
  const commentBadge = hasComments ? (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
      title="Possui comentários"
    >
      <MessageSquareMore className="h-3.5 w-3.5" />
      <span>Comentário</span>
    </span>
  ) : null;
  const renderAvatar = (className: string, initialsClassName: string) => {
    const inner = fotoSrc ? (
      <img
        src={fotoSrc}
        alt={`Foto de ${emp.name}`}
        className={cn(className, "shrink-0 object-contain bg-muted/30 border border-border/50")}
      />
    ) : (
      <div className={cn(className, "bg-primary/10 flex items-center justify-center shrink-0")}>
        <span className={cn("text-primary font-semibold", initialsClassName)}>{getInitials(emp.name)}</span>
      </div>
    );
    if (!pendenciaSecullum) return inner;
    return (
      <div className="relative shrink-0">
        <OrganicoSecullumPendenciaDot className="absolute -right-0.5 -top-0.5 z-[1]" />
        {inner}
      </div>
    );
  };

  const actionsInline = viewMode === "list" || viewMode === "details";
  const actionBtn = (extra: string) =>
    cn(
      "rounded-md hover:bg-muted text-muted-foreground hover:text-foreground",
      actionsInline ? "p-1.5" : "p-2",
      extra
    );

  const actions = !readOnly && onEdit != null && (
    <div className={cn("shrink-0", actionsInline ? "flex flex-row items-center gap-0.5" : "flex flex-col gap-1")}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEdit(rowIndex);
        }}
        className={actionBtn("")}
        title={isDesligado ? "Visualizar" : "Editar"}
      >
        <Pencil className={actionsInline ? "w-3.5 h-3.5" : "w-4 h-4"} />
      </button>
      {onToggleCustoTotal && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCustoTotal();
          }}
          className={actionBtn(custoRevealed ? "text-primary" : "")}
          title={custoRevealed ? "Ocultar custo total (mês)" : "Exibir custo total (mês)"}
          aria-label={custoRevealed ? "Ocultar custo total (mês)" : "Exibir custo total (mês)"}
        >
          <Eye className={actionsInline ? "w-3.5 h-3.5" : "w-4 h-4"} />
        </button>
      )}
    </div>
  );

  const interactiveWrap = (children: ReactNode, className?: string) => {
    if (readOnly || onView == null) return <div className={cn("min-w-0", className)}>{children}</div>;
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleView}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleView();
          }
        }}
        className={cn("min-w-0 cursor-pointer", className)}
      >
        {children}
      </div>
    );
  };

  // —— Lista (uma linha, estilo Explorer) ——
  if (viewMode === "list") {
    return (
      <div
        ref={rootRef}
        className="border border-border bg-card rounded-md px-3 py-2.5 shadow-sm hover:shadow transition-shadow flex items-center gap-3"
      >
        {interactiveWrap(
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {renderAvatar("w-11 h-11 rounded-lg", "text-xs")}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm text-foreground truncate">{emp.name}</h3>
                {commentBadge}
                <StatusBadge status={status} size="sm" />
              </div>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {emp.cargo} · {emp.setor} · <span className="font-mono">{emp.id}</span>
              </p>
            </div>
          </div>,
          "flex-1"
        )}
        {actions}
      </div>
    );
  }

  // —— Detalhes (linha densa, várias colunas) ——
  if (viewMode === "details") {
    return (
      <div
        ref={rootRef}
        className="border border-border bg-card rounded-sm px-2 py-2 sm:px-3 shadow-sm hover:shadow transition-shadow flex items-start sm:items-center gap-2"
      >
        {interactiveWrap(
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 flex-1 min-w-0 w-full">
            <div className="flex items-center gap-2 shrink-0">
              {renderAvatar("w-10 h-10 rounded-md", "text-[10px]")}
              <div className="min-w-0 max-w-[11rem] sm:max-w-[14rem]">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-sm text-foreground truncate">{emp.name}</h3>
                  {commentBadge}
                </div>
                <p className="text-[10px] text-muted-foreground font-mono truncate">{emp.id}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-x-3 gap-y-1 text-[11px] flex-1">
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase tracking-wide">Cargo</span>
                <span className="font-medium truncate block">{emp.cargo}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase tracking-wide">Setor</span>
                <span className="font-medium truncate block">{emp.setor}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase tracking-wide">Custo total (mês)</span>
                <span className={cn("font-semibold tabular-nums", !showCustoTotal && "tracking-widest")}>{custoTotalLabel}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase tracking-wide">Admissão</span>
                <span className="font-medium">{admLabel}</span>
              </div>
              {demissaoLabel ? (
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase tracking-wide">Demissão</span>
                  <span className="font-medium">{demissaoLabel}</span>
                </div>
              ) : null}
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase tracking-wide">Tempo</span>
                <span className="font-medium">{emp.tempoEmpresa}</span>
              </div>
              <div className="flex items-end lg:col-span-1">
                <StatusBadge status={status} size="sm" />
              </div>
            </div>
          </div>,
          "flex-1 w-full"
        )}
        {actions}
      </div>
    );
  }

  // —— Grades: extra-large, large, medium, small ——
  const gridStyles: Record<
    Exclude<OrganicoCardViewMode, "list" | "details">,
    {
      root: string;
      avatar: string;
      initials: string;
      title: string;
      meta: string;
      inner: string;
      label: string;
      value: string;
      badgeSize: "sm" | "md" | "lg";
    }
  > = {
    "extra-large": {
      root: "rounded-xl p-5",
      avatar: "w-20 h-20 rounded-xl",
      initials: "text-lg",
      title: "text-lg",
      meta: "text-sm",
      inner: "mt-4 grid grid-cols-2 gap-3 text-sm",
      label: "text-muted-foreground block text-xs",
      value: "font-medium truncate block",
      badgeSize: "lg",
    },
    large: {
      root: "rounded-lg p-4",
      avatar: "w-16 h-16 rounded-lg",
      initials: "text-base",
      title: "text-base",
      meta: "text-xs",
      inner: "mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-sm",
      label: "text-muted-foreground block text-xs",
      value: "font-medium truncate block",
      badgeSize: "md",
    },
    medium: {
      root: "rounded-lg p-4",
      avatar: "w-16 h-16 rounded-lg",
      initials: "text-sm",
      title: "font-semibold text-foreground",
      meta: "text-xs",
      inner: "mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs",
      label: "text-muted-foreground block",
      value: "font-medium truncate block",
      badgeSize: "md",
    },
    small: {
      root: "rounded-md p-2.5",
      avatar: "w-10 h-10 rounded-md",
      initials: "text-[10px]",
      title: "text-sm font-semibold",
      meta: "text-[10px]",
      inner: "mt-2 grid grid-cols-2 gap-1.5 text-[10px]",
      label: "text-muted-foreground block",
      value: "font-medium truncate block leading-tight",
      badgeSize: "sm",
    },
  };

  const g = gridStyles[viewMode];

  const mainContent = (
    <>
      <div className="flex items-center gap-3">
        {renderAvatar(g.avatar, g.initials)}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={cn(g.title, "truncate")}>{emp.name}</h3>
            {commentBadge}
          </div>
          <p className={cn(g.meta, "text-muted-foreground font-mono truncate")}>{emp.id}</p>
        </div>
      </div>
      <div className={g.inner}>
        <div>
          <span className={g.label}>Cargo</span>
          <span className={g.value}>{emp.cargo}</span>
        </div>
        <div>
          <span className={g.label}>Setor</span>
          <span className={g.value}>{emp.setor}</span>
        </div>
        {viewMode !== "small" && (
          <div>
            <span className={g.label}>Admissão</span>
            <span className={cn(g.value, "truncate")}>{admLabel}</span>
          </div>
        )}
        {demissaoLabel && viewMode !== "small" && (
          <div>
            <span className={g.label}>Demissão</span>
            <span className={g.value}>{demissaoLabel}</span>
          </div>
        )}
        <div>
          <span className={g.label}>Tempo</span>
          <span className={g.value}>{emp.tempoEmpresa}</span>
        </div>
        <div>
          <span className={g.label}>Custo total (mês)</span>
          <span className={cn(g.value, "tabular-nums", !showCustoTotal && "tracking-widest")}>{custoTotalLabel}</span>
        </div>
      </div>
      <div className="mt-2">
        <StatusBadge status={status} size={g.badgeSize} />
      </div>
    </>
  );

  return (
    <div ref={rootRef} className={cn("border border-border bg-card shadow-sm hover:shadow-md transition-shadow", g.root)}>
      <div className="flex items-start justify-between gap-2">
        {interactiveWrap(mainContent, "flex-1")}
        {actions}
      </div>
    </div>
  );
});
