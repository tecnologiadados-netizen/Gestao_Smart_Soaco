import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@rh/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@rh/components/ui/dialog";
import { Textarea } from "@rh/components/ui/textarea";
import type { OrganicoAlteracaoPendente } from "@rh/types/api";
import { cn } from "@rh/lib/utils";

function tipoLabel(t: OrganicoAlteracaoPendente["tipo"]): string {
  return t === "ctps" ? "CTPS (salário)" : "Cargo";
}

export function OrganicoSecullumPendenciasBanner({
  count,
  onOpen,
}: {
  count: number;
  onOpen: () => void;
}) {
  if (count <= 0) return null;

  return (
    <div
      className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
      role="status"
    >
      <div className="flex items-start gap-2 min-w-0">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" aria-hidden />
        <div className="min-w-0">
          <p className="font-semibold text-foreground">
            Alterações da Secullum aguardando justificativa ({count})
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Registre o motivo para CTPS (salário) ou cargo; o histórico e a trajetória serão atualizados.
          </p>
        </div>
      </div>
      <Button type="button" size="sm" variant="secondary" className="shrink-0" onClick={onOpen}>
        Justificar
      </Button>
    </div>
  );
}

export function OrganicoSecullumPendenciasDialog({
  open,
  onOpenChange,
  items,
  onResolve,
  onDismiss,
  masterCanDismiss = false,
  busyId,
  pendingAction = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: OrganicoAlteracaoPendente[];
  onResolve: (id: string, motivo: string) => Promise<void>;
  /** Só master: remove a pendência do banco (ex.: órfã após excluir trajetória). */
  onDismiss?: (id: string) => Promise<void>;
  masterCanDismiss?: boolean;
  busyId: string | null;
  pendingAction?: "resolve" | "dismiss" | null;
}) {
  const [motivos, setMotivos] = useState<Record<string, string>>({});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Justificar alterações (Secullum)</DialogTitle>
          <DialogDescription>
            Informe o motivo de cada alteração de CTPS ou cargo. Os registros aparecerão nos comentários e na aba
            Trajetória.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma pendência aberta.</p>
          ) : (
            items.map((item) => {
              const key = item.id;
              const value = motivos[key] ?? "";
              const loading = busyId === item.id;
              const dismissing = loading && pendingAction === "dismiss";
              const resolving = loading && pendingAction === "resolve";
              return (
                <div key={key} className="rounded-md border border-border/80 bg-muted/20 p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {tipoLabel(item.tipo)}
                    </span>
                    <span className="text-sm font-medium text-foreground truncate">{item.colaboradorNome}</span>
                    <span className="text-xs font-mono text-muted-foreground">{item.colaboradorMatricula}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.dataReferencia ? (
                      <span className="block mb-0.5">
                        Data da alteração:{" "}
                        {new Date(item.dataReferencia + "T12:00:00").toLocaleDateString("pt-BR")}
                      </span>
                    ) : null}
                    {item.campoLabel}: {item.valorAnterior} → {item.valorAtual}
                  </p>
                  <Textarea
                    placeholder="Motivo da alteração..."
                    value={value}
                    onChange={(e) => setMotivos((prev) => ({ ...prev, [key]: e.target.value }))}
                    rows={3}
                    disabled={loading}
                    className="text-sm"
                  />
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {masterCanDismiss && onDismiss ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={loading}
                        onClick={async () => {
                          await onDismiss(item.id);
                          setMotivos((prev) => {
                            const next = { ...prev };
                            delete next[key];
                            return next;
                          });
                        }}
                        title="Remove esta pendência (não exige mais motivo)"
                      >
                        {dismissing ? (
                          "Excluindo…"
                        ) : (
                          <>
                            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                            Excluir pendência
                          </>
                        )}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      disabled={loading || !value.trim()}
                      onClick={async () => {
                        await onResolve(item.id, value.trim());
                        setMotivos((prev) => {
                          const next = { ...prev };
                          delete next[key];
                          return next;
                        });
                      }}
                    >
                      {resolving ? "Salvando…" : "Registrar motivo"}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OrganicoSecullumPendenciaDot({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full bg-amber-500 ring-2 ring-background shrink-0",
        className,
      )}
      title="Alteração Secullum sem justificativa"
      aria-hidden
    />
  );
}
