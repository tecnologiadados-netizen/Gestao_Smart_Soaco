import { useMemo } from "react";
import { AlertTriangle, Bell } from "lucide-react";
import { Button } from "@qualidade/components/ui/button";
import { Badge } from "@qualidade/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@qualidade/components/ui/dropdown-menu";
import { useDocumentsStore } from "@qualidade/lib/store/documents-store";
import { cn } from "@qualidade/lib/utils";

interface Props {
  onVerDocumento?: (documentId: string) => void;
  variant?: "header" | "default";
}

function severidadeVariant(
  severidade: "info" | "warning" | "danger"
): "default" | "warning" | "destructive" {
  switch (severidade) {
    case "danger":
      return "destructive";
    case "warning":
      return "warning";
    default:
      return "default";
  }
}

export function ValidadeNotificacoesBell({
  onVerDocumento,
  variant = "default",
}: Props) {
  const validadeAlertas = useDocumentsStore((s) => s.validadeAlertas);
  const marcarAlertaValidadeLido = useDocumentsStore(
    (s) => s.marcarAlertaValidadeLido
  );
  const getDocumentById = useDocumentsStore((s) => s.getDocumentById);

  const alertas = useMemo(
    () =>
      validadeAlertas
        .filter((alerta) => !alerta.lida)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [validadeAlertas]
  );

  const isHeader = variant === "header";
  const countLabel = alertas.length > 9 ? "9+" : String(alertas.length);
  const countWide = alertas.length > 9;

  return (
    <div className="relative pr-1.5 pt-1.5">
      <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant={isHeader ? "ghost" : "outline"}
            size="icon"
            className={cn(
              "relative size-10 shrink-0 overflow-visible",
              !isHeader &&
                "border-primary/30 bg-card text-primary shadow-sm hover:bg-muted hover:text-primary"
            )}
            title="Notificações de validade"
            aria-label={`Notificações de validade${alertas.length ? ` (${alertas.length} não lidas)` : ""}`}
          />
        }
      >
        <Bell className="size-5" strokeWidth={2.25} aria-hidden />
        {alertas.length > 0 ? (
          <span
            className={cn(
              "pointer-events-none absolute right-0 top-0 flex h-4 translate-x-2 -translate-y-2 items-center justify-center rounded-full px-0.5 text-[9px] font-bold leading-none",
              countWide ? "min-w-[18px]" : "min-w-4",
              isHeader
                ? "bg-warning text-warning-foreground shadow-sm ring-1 ring-[var(--brand-navy)]"
                : "bg-destructive text-white shadow-sm ring-1 ring-white"
            )}
          >
            {countLabel}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[min(100vw-2rem,380px)] p-0"
      >
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-brand-navy">
            Alertas de validade
          </p>
          <p className="text-xs text-muted-foreground">
            Notificações conforme a proximidade do vencimento
          </p>
        </div>
        <div className="max-h-[min(60vh,420px)] overflow-y-auto">
          {alertas.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhuma notificação pendente.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {alertas.map((alerta) => {
                const doc = getDocumentById(alerta.documentId);
                return (
                  <li key={alerta.id}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                        alerta.severidade === "danger" && "bg-destructive/5",
                        alerta.severidade === "warning" && "bg-warning/5"
                      )}
                      onClick={() => {
                        marcarAlertaValidadeLido(alerta.id);
                        onVerDocumento?.(alerta.documentId);
                      }}
                    >
                      <AlertTriangle
                        className={cn(
                          "mt-0.5 size-4 shrink-0",
                          alerta.severidade === "danger" && "text-destructive",
                          alerta.severidade === "warning" && "text-warning",
                          alerta.severidade === "info" && "text-brand-blue"
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">
                          {alerta.mensagem}
                        </p>
                        {doc ? (
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {doc.titulo}
                          </p>
                        ) : null}
                        <div className="mt-2">
                          <Badge
                            variant={severidadeVariant(alerta.severidade)}
                            className="text-[10px]"
                          >
                            {alerta.marcoDias === 0 &&
                            alerta.severidade === "danger"
                              ? "Vencido"
                              : `${alerta.marcoDias}d`}
                          </Badge>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
    </div>
  );
}
