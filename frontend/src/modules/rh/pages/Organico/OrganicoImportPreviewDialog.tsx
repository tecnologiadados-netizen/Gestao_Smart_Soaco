import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@rh/components/ui/dialog";
import { Button } from "@rh/components/ui/button";
import { Input } from "@rh/components/ui/input";
import { Checkbox } from "@rh/components/ui/checkbox";
import { Label } from "@rh/components/ui/label";
import { cn } from "@rh/lib/utils";
import type { OrganicoImportValidationResult } from "./organico-import-validate";
import { formatValidationSummary } from "./organico-import-validate";
import { downloadChangeLogCsv } from "./organico-import-change-log";
import { OrganicoImportChangeLogTable } from "./OrganicoImportChangeLogTable";

type PreviewTab = "changes" | "errors" | "warnings";

export type OrganicoImportConfirmPhase = "idle" | "progress" | "success" | "error";

export type OrganicoImportConfirmOptions = {
  /** Quando false, grava o orgânico sem registrar comentários/trajetória (correção em massa). */
  generateActivityLogs: boolean;
};

export function OrganicoImportPreviewDialog({
  open,
  onOpenChange,
  fileName,
  validation,
  confirmPhase,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  validation: OrganicoImportValidationResult | null;
  confirmPhase: OrganicoImportConfirmPhase;
  onConfirm: (options: OrganicoImportConfirmOptions) => void;
}) {
  const [tab, setTab] = useState<PreviewTab>("changes");
  const [filter, setFilter] = useState("");
  const [warningsAck, setWarningsAck] = useState(false);
  const [generateActivityLogs, setGenerateActivityLogs] = useState(true);
  const [importProgressPct, setImportProgressPct] = useState(0);
  const confirmPhaseRef = useRef(confirmPhase);
  confirmPhaseRef.current = confirmPhase;

  useEffect(() => {
    if (confirmPhase === "success") {
      setImportProgressPct(100);
      return;
    }
    if (confirmPhase !== "progress") {
      setImportProgressPct(0);
      return;
    }

    setImportProgressPct(0);
    const collaborators = Math.max(1, validation?.stats.collaboratorsChanged ?? 1);
    const logCount = generateActivityLogs ? (validation?.changeLog.length ?? 0) : 0;
    const estimatedMs = Math.min(14_000, Math.max(2_800, 2_000 + collaborators * 35 + logCount * 8));
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      if (confirmPhaseRef.current !== "progress") return;
      const t = Math.min(1, (now - start) / estimatedMs);
      const eased = 1 - (1 - t) ** 3;
      setImportProgressPct(Math.min(92, eased * 92));
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [confirmPhase, validation?.stats.collaboratorsChanged, validation?.changeLog.length, generateActivityLogs]);

  useEffect(() => {
    if (!open || !validation) return;
    if (validation.errors.length > 0) setTab("errors");
    else if (validation.changeLog.length > 0) setTab("changes");
    else if (validation.warnings.length > 0) setTab("warnings");
    else setTab("changes");
    setWarningsAck(false);
    setGenerateActivityLogs(true);
  }, [open, validation]);

  const filteredChangeLog = useMemo(() => {
    if (!validation) return [];
    return validation.changeLog;
  }, [validation]);

  const hasWarnings = (validation?.warnings.length ?? 0) > 0;
  const isAlreadySynced =
    validation != null &&
    validation.errors.length === 0 &&
    validation.changeLog.length === 0 &&
    validation.stats.sheetRows > 0;
  const isBusy = confirmPhase === "progress" || confirmPhase === "success";
  const canConfirm =
    validation?.canImport === true && (!hasWarnings || warningsAck) && confirmPhase === "idle";

  const handleOpenChange = (next: boolean) => {
    if (!next && isBusy) return;
    if (!next) {
      setFilter("");
      setWarningsAck(false);
      setTab("changes");
      setGenerateActivityLogs(true);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[min(92vh,calc(100dvh-2rem))] max-h-[min(92vh,calc(100dvh-2rem))] w-[min(98vw,96rem)] max-w-none flex-col gap-0 overflow-hidden p-0">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {(confirmPhase === "progress" || confirmPhase === "success") && (
          <div
            className="absolute inset-0 z-[70] flex items-center justify-center bg-background/85 backdrop-blur-[2px]"
            role="status"
            aria-live="polite"
            aria-busy={confirmPhase === "progress"}
          >
            <div className="flex flex-col items-center gap-4 px-8 py-10 text-center max-w-md">
              {confirmPhase === "progress" ? (
                <>
                  <div className="relative flex h-20 w-20 items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-4 border-primary/15" />
                    <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                    <Loader2 className="h-9 w-9 text-primary animate-pulse" aria-hidden />
                  </div>
                  <div className="space-y-1">
                    <p className="text-lg font-semibold text-foreground">Importando planilha…</p>
                    <p className="text-sm text-muted-foreground">
                      Gravando {validation?.stats.collaboratorsChanged ?? 0} colaborador(es) no sistema.
                      {generateActivityLogs ? " Aguarde." : " Sem gerar logs de comentários. Aguarde."}
                    </p>
                  </div>
                  <div className="w-56 space-y-1.5">
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
                        style={{ width: `${importProgressPct}%` }}
                        role="progressbar"
                        aria-valuenow={Math.round(importProgressPct)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      />
                    </div>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {Math.round(importProgressPct)}%
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 animate-in zoom-in-50 duration-300">
                    <CheckCircle2 className="h-14 w-14 text-emerald-600 animate-in zoom-in duration-500" aria-hidden />
                  </div>
                  <div className="space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <p className="text-lg font-semibold text-foreground">Importação concluída!</p>
                    <p className="text-sm text-muted-foreground">
                      Os dados foram gravados com sucesso.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        <DialogHeader className="border-b border-border px-6 py-4 text-left">
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 shrink-0" aria-hidden />
            Validar importação
          </DialogTitle>
          <DialogDescription className="text-pretty">
            {fileName ? (
              <>
                Arquivo: <span className="font-medium text-foreground">{fileName}</span>
                {validation ? <> — {formatValidationSummary(validation)}</> : null}
              </>
            ) : (
              "Revise alterações antes de gravar no sistema."
            )}
          </DialogDescription>
        </DialogHeader>

        {!validation ? (
          <div className="px-6 py-8 text-sm text-muted-foreground">Carregando validação…</div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-6 py-3">
              <TabButton
                active={tab === "changes"}
                onClick={() => setTab("changes")}
                label={`Log de alterações (${validation.changeLog.length})`}
              />
              <TabButton
                active={tab === "errors"}
                onClick={() => setTab("errors")}
                label={`Erros (${validation.errors.length})`}
                variant="destructive"
              />
              <TabButton
                active={tab === "warnings"}
                onClick={() => setTab("warnings")}
                label={`Avisos (${validation.warnings.length})`}
                variant="warning"
              />
              {tab === "changes" && validation.changeLog.length > 0 ? (
                <div className="ml-auto flex items-center gap-2">
                  <Input
                    placeholder="Busca rápida em todas as colunas…"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="h-8 w-48 sm:w-64"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => downloadChangeLogCsv(validation.changeLog)}
                  >
                    <Download className="h-4 w-4 mr-1.5" aria-hidden />
                    Exportar log (.csv)
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-4 py-4 sm:px-6">
              {tab === "changes" && isAlreadySynced ? (
                <AlreadySyncedState
                  sheetRows={validation.stats.sheetRows}
                  warningCount={validation.warnings.length}
                  onViewWarnings={validation.warnings.length > 0 ? () => setTab("warnings") : undefined}
                />
              ) : tab === "changes" ? (
                <OrganicoImportChangeLogTable
                  entries={filteredChangeLog}
                  globalFilter={filter}
                  resetKey={fileName}
                />
              ) : tab === "errors" ? (
                <IssueList items={validation.errors} emptyLabel="Nenhum erro bloqueante." />
              ) : (
                <IssueList items={validation.warnings} emptyLabel="Nenhum aviso." />
              )}
            </div>

            <div className="border-t border-border px-6 py-3 text-xs text-muted-foreground">
              {validation.stats.collaboratorsChanged} colaborador(es) com alteração ·{" "}
              {validation.stats.totalFieldChanges} campo(s) · {validation.stats.notInSheet} não presente(s) na
              planilha (permanecem inalterados)
            </div>

            {validation.canImport ? (
              <div className="border-t border-border bg-muted/20 px-6 py-3">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="import-generate-activity-logs"
                    checked={generateActivityLogs}
                    onCheckedChange={(v) => setGenerateActivityLogs(v === true)}
                    disabled={isBusy}
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="import-generate-activity-logs" className="text-sm font-medium cursor-pointer">
                      Deseja gerar logs de comentários/trajetória?
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {generateActivityLogs
                        ? "Sim — cada alteração importada será registrada no histórico do colaborador."
                        : "Não — use para correção do sistema; os dados serão atualizados sem novos comentários ou trajetória."}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {hasWarnings && validation.canImport ? (
              <div className="flex items-start gap-2 border-t border-amber-500/30 bg-amber-500/5 px-6 py-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" aria-hidden />
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="import-warnings-ack"
                    checked={warningsAck}
                    onCheckedChange={(v) => setWarningsAck(v === true)}
                  />
                  <Label htmlFor="import-warnings-ack" className="text-sm font-normal cursor-pointer">
                    Li os avisos e confirmo que desejo importar mesmo assim.
                  </Label>
                </div>
              </div>
            ) : null}
          </>
        )}

        <DialogFooter className="border-t border-border px-6 py-4">
          {isAlreadySynced || !validation?.canImport ? (
            <Button type="button" onClick={() => handleOpenChange(false)} disabled={isBusy}>
              Fechar
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isBusy}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => onConfirm({ generateActivityLogs })}
                disabled={!canConfirm}
              >
                {confirmPhase === "progress"
                  ? "Importando…"
                  : confirmPhase === "success"
                    ? "Concluído"
                    : "Confirmar importação"}
              </Button>
            </>
          )}
        </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AlreadySyncedState({
  sheetRows,
  warningCount,
  onViewWarnings,
}: {
  sheetRows: number;
  warningCount: number;
  onViewWarnings?: () => void;
}) {
  return (
    <div className="flex min-h-[min(40vh,320px)] flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
        <CheckCircle2 className="h-14 w-14 text-emerald-600" aria-hidden />
      </div>
      <div className="max-w-md space-y-2">
        <p className="text-lg font-semibold text-foreground">Planilha já sincronizada</p>
        <p className="text-sm text-muted-foreground">
          {sheetRows} linha(s) válida(s) conferida(s) — nenhum campo difere da base atual do sistema. Não há nada a
          importar.
        </p>
      </div>
      {warningCount > 0 && onViewWarnings ? (
        <Button type="button" variant="outline" size="sm" onClick={onViewWarnings}>
          Ver {warningCount} aviso(s)
        </Button>
      ) : null}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  variant,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  variant?: "destructive" | "warning";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? variant === "destructive"
            ? "bg-destructive/10 text-destructive"
            : variant === "warning"
              ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
              : "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}

function IssueList({
  items,
  emptyLabel,
}: {
  items: Array<{ message: string }>;
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">{emptyLabel}</p>;
  }
  return (
    <ul className="space-y-2 text-sm">
      {items.map((item, i) => (
        <li key={i} className="rounded-md border border-border px-3 py-2">
          {item.message}
        </li>
      ))}
    </ul>
  );
}
