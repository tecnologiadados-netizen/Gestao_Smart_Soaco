import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Bell, ClipboardList, FileWarning } from "lucide-react";
import { Button } from "@qualidade/components/ui/button";
import { Badge } from "@qualidade/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@qualidade/components/ui/dropdown-menu";
import { useDocumentsStore } from "@qualidade/lib/store/documents-store";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import { flushQualidadeDocumentsSync } from "@qualidade/lib/qualidadePersistence";
import {
  getTaskActionHref,
  getTaskActionLabel,
} from "@qualidade/lib/documents/task-routes";
import { cn } from "@qualidade/lib/utils";
import type { Task, TaskType } from "@qualidade/types/task";
import type { DocumentValidadeAlerta } from "@qualidade/types/document";

interface Props {
  onVerDocumento?: (documentId: string) => void;
  variant?: "header" | "default";
}

const TIPOS_TAREFA_SINO: TaskType[] = [
  "elaborar_documento",
  "consenso_documento",
  "aprovar_documento",
  "revalidar_documento",
  "revisar_documento",
];

type ItemSino =
  | { kind: "validade"; createdAt: string; alerta: DocumentValidadeAlerta }
  | { kind: "tarefa"; createdAt: string; task: Task };

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
  const navigate = useNavigate();
  const currentUserId = useConfigStore((s) => s.currentUserId);
  const validadeAlertas = useDocumentsStore((s) => s.validadeAlertas);
  const getPendingTasks = useDocumentsStore((s) => s.getPendingTasks);
  const getDocumentById = useDocumentsStore((s) => s.getDocumentById);
  const marcarAlertaValidadeLido = useDocumentsStore(
    (s) => s.marcarAlertaValidadeLido
  );
  const limparNotificacoesSino = useDocumentsStore(
    (s) => s.limparNotificacoesSino
  );
  const [limpando, setLimpando] = useState(false);

  const itens = useMemo((): ItemSino[] => {
    const alertas: ItemSino[] = validadeAlertas
      .filter((alerta) => !alerta.lida)
      .map((alerta) => ({
        kind: "validade" as const,
        createdAt: alerta.createdAt,
        alerta,
      }));

    const tarefas: ItemSino[] = getPendingTasks(currentUserId)
      .filter(
        (task) =>
          !task.sinoOculto &&
          TIPOS_TAREFA_SINO.includes(task.tipo) &&
          task.referenciaTipo === "documento"
      )
      .map((task) => ({
        kind: "tarefa" as const,
        createdAt: task.createdAt,
        task,
      }));

    return [...alertas, ...tarefas].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  }, [validadeAlertas, getPendingTasks, currentUserId]);

  const isHeader = variant === "header";
  const countLabel = itens.length > 9 ? "9+" : String(itens.length);
  const countWide = itens.length > 9;

  async function handleLimpar() {
    if (itens.length === 0 || limpando) return;
    setLimpando(true);
    try {
      limparNotificacoesSino(currentUserId);
      await flushQualidadeDocumentsSync();
    } catch (err) {
      console.error("[qualidade] falha ao limpar notificações do sino:", err);
    } finally {
      setLimpando(false);
    }
  }

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
              title="Notificações"
              aria-label={`Notificações${itens.length ? ` (${itens.length} pendentes)` : ""}`}
            />
          }
        >
          <Bell className="size-5" strokeWidth={2.25} aria-hidden />
          {itens.length > 0 ? (
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
          <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-brand-navy">
                Notificações
              </p>
              <p className="text-xs text-muted-foreground">
                Pendências de documentos e alertas de validade
              </p>
            </div>
            {itens.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 px-2 text-xs"
                disabled={limpando}
                onClick={() => void handleLimpar()}
              >
                {limpando ? "Limpando…" : "Limpar"}
              </Button>
            ) : null}
          </div>
          <div className="max-h-[min(60vh,420px)] overflow-y-auto">
            {itens.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhuma notificação pendente.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {itens.map((item) => {
                  if (item.kind === "validade") {
                    const { alerta } = item;
                    const doc = getDocumentById(alerta.documentId);
                    return (
                      <li key={`val-${alerta.id}`}>
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
                              alerta.severidade === "danger" &&
                                "text-destructive",
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
                  }

                  const { task } = item;
                  const doc = getDocumentById(task.referenciaId);
                  const Icon =
                    task.tipo === "revalidar_documento"
                      ? FileWarning
                      : ClipboardList;
                  return (
                    <li key={`task-${task.id}`}>
                      <button
                        type="button"
                        className="flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                        onClick={() => {
                          navigate(getTaskActionHref(task));
                        }}
                      >
                        <Icon className="mt-0.5 size-4 shrink-0 text-brand-blue" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-snug">
                            {task.titulo}
                          </p>
                          {task.descricao ? (
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              {task.descricao}
                            </p>
                          ) : doc ? (
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              {doc.titulo}
                            </p>
                          ) : null}
                          <div className="mt-2">
                            <Badge variant="default" className="text-[10px]">
                              {getTaskActionLabel(task)}
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
