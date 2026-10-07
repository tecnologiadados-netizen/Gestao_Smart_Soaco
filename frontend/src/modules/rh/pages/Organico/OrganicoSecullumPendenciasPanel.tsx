import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Label } from "@rh/components/ui/label";
import { Textarea } from "@rh/components/ui/textarea";
import { getMotivosDesligamento, isApiConfigured } from "@rh/lib/api-client";
import { arquivarEntrevistaDesligamento, type PastaEntrevista } from "@rh/lib/entrevista-desligamento";
import { rhFieldLabel, rhFieldSelectNative, rhFieldTextarea } from "@rh/lib/form-field-styles";
import { filhosDoMotivoPai } from "@rh/lib/motivo-desligamento";
import { useToast } from "@rh/hooks/use-toast";
import { EntrevistaDesligamentoAnexo } from "./EntrevistaDesligamentoAnexo";
import type { OrganicoAlteracaoPendente } from "@rh/types/api";
import { cn } from "@rh/lib/utils";

export type ResolverPendenciaSecullumInput = {
  motivo: string;
  motivoFilhoId?: string;
  motivoSensivel?: boolean;
};

function tipoLabel(t: OrganicoAlteracaoPendente["tipo"]): string {
  if (t === "ctps") return "CTPS (salário)";
  if (t === "desligamento") return "Desligamento";
  return "Cargo";
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
            Registre o motivo de CTPS (salário), cargo ou o complemento do desligamento. O histórico será atualizado.
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
  onResolve: (id: string, input: ResolverPendenciaSecullumInput) => Promise<void>;
  /** Só master: remove a pendência do banco (ex.: órfã após excluir trajetória). */
  onDismiss?: (id: string) => Promise<void>;
  masterCanDismiss?: boolean;
  busyId: string | null;
  pendingAction?: "resolve" | "dismiss" | null;
}) {
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const [filhosSelecionados, setFilhosSelecionados] = useState<Record<string, string>>({});
  const [sensiveis, setSensiveis] = useState<Record<string, boolean>>({});
  const [entrevistas, setEntrevistas] = useState<Record<string, File | null>>({});
  const [pastasEntrevista, setPastasEntrevista] = useState<Record<string, PastaEntrevista | null>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const temDesligamento = items.some((item) => item.tipo === "desligamento");
  const { data: motivosPai = [] } = useQuery({
    queryKey: ["motivos-desligamento"],
    queryFn: getMotivosDesligamento,
    enabled: open && temDesligamento && isApiConfigured(),
    staleTime: 30_000,
  });
  const filhosCatalogo = useMemo(
    () =>
      motivosPai.flatMap((pai) =>
        pai.filhos.map((filho) => ({ ...filho, motivoPai: pai.motivoPai })),
      ),
    [motivosPai],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Justificar alterações (Secullum)</DialogTitle>
          <DialogDescription>
            CTPS e cargo pedem um motivo em texto. No desligamento, selecione o complemento cadastrado para o motivo
            da Secullum e escreva o motivo detalhado. Os dois são obrigatórios. Com os dois preenchidos, é possível
            anexar o PDF da entrevista e escolher a pasta de destino no card do colaborador.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma pendência aberta.</p>
          ) : (
            items.map((item) => {
              const key = item.id;
              const value = motivos[key] ?? "";
              const desligamento = item.tipo === "desligamento";
              const filhos = desligamento ? filhosDoMotivoPai(filhosCatalogo, item.valorAtual) : [];
              const filhoId = filhosSelecionados[key] ?? "";
              const loading = busyId === item.id;
              const dismissing = loading && pendingAction === "dismiss";
              const resolving = loading && pendingAction === "resolve";
              const podeFinalizar = desligamento ? Boolean(filhoId && value.trim() && filhos.length > 0) : Boolean(value.trim());
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
                    {desligamento
                      ? `Status: ${item.valorAnterior || "Ativo"} → Desligado`
                      : `${item.campoLabel}: ${item.valorAnterior} → ${item.valorAtual}`}
                  </p>
                  {desligamento ? (
                    <div className="space-y-2">
                      <p className="text-xs text-foreground">
                        Motivo da Secullum: <span className="font-medium">{item.valorAtual || "Não informado"}</span>
                      </p>
                      <div>
                        <Label htmlFor={`motivo-filho-${key}`} className={rhFieldLabel}>
                          Complemento do desligamento
                        </Label>
                        <select
                          id={`motivo-filho-${key}`}
                          className={rhFieldSelectNative}
                          value={filhoId}
                          disabled={loading || filhos.length === 0}
                          onChange={(e) => setFilhosSelecionados((prev) => ({ ...prev, [key]: e.target.value }))}
                        >
                          <option value="">Selecione o complemento</option>
                          {filhos.map((filho) => (
                            <option key={filho.id} value={filho.id}>
                              {filho.descricao}
                            </option>
                          ))}
                        </select>
                        {filhos.length === 0 ? (
                          <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                            Cadastre os filhos deste motivo em Faltas e atestados → Cadastros antes de finalizar.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  {desligamento ? (
                    <Label htmlFor={`motivo-texto-${key}`} className={rhFieldLabel}>
                      Motivo detalhado
                    </Label>
                  ) : null}
                  <Textarea
                    id={desligamento ? `motivo-texto-${key}` : undefined}
                    placeholder={desligamento ? "Escreva o motivo detalhado" : "Motivo da alteração..."}
                    value={value}
                    onChange={(e) => setMotivos((prev) => ({ ...prev, [key]: e.target.value }))}
                    rows={3}
                    disabled={loading}
                    className={cn(rhFieldTextarea, "text-sm")}
                  />
                  {desligamento ? (
                    <label className="flex items-start gap-2 text-xs text-foreground">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 accent-primary"
                        checked={sensiveis[key] === true}
                        disabled={loading}
                        onChange={(e) => setSensiveis((prev) => ({ ...prev, [key]: e.target.checked }))}
                      />
                      <span>Sensível. Só quem tem permissão para ver conteúdo sensível consegue ler este texto.</span>
                    </label>
                  ) : null}
                  {desligamento && filhoId && value.trim() && filhos.length > 0 ? (
                    <EntrevistaDesligamentoAnexo
                      matricula={item.colaboradorMatricula}
                      colaboradorNome={item.colaboradorNome}
                      campoId={key}
                      arquivo={entrevistas[key] ?? null}
                      pasta={pastasEntrevista[key] ?? null}
                      disabled={loading}
                      onArquivo={(arquivo) => setEntrevistas((prev) => ({ ...prev, [key]: arquivo }))}
                      onPasta={(pasta) => setPastasEntrevista((prev) => ({ ...prev, [key]: pasta }))}
                    />
                  ) : null}
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {masterCanDismiss && onDismiss && !desligamento ? (
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
                          setFilhosSelecionados((prev) => {
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
                      disabled={loading || !podeFinalizar}
                      onClick={async () => {
                        const pdf = desligamento ? entrevistas[key] ?? null : null;
                        const pasta = desligamento ? pastasEntrevista[key] ?? null : null;
                        if (pdf && !pasta) {
                          toast({
                            title: "Selecione a pasta de destino da entrevista.",
                            variant: "destructive",
                          });
                          return;
                        }
                        await onResolve(item.id, {
                          motivo: value.trim(),
                          motivoFilhoId: desligamento ? filhoId : undefined,
                          motivoSensivel: desligamento ? sensiveis[key] === true : undefined,
                        });
                        if (pdf && pasta) {
                          try {
                            await arquivarEntrevistaDesligamento({
                              file: pdf,
                              matricula: item.colaboradorMatricula,
                              colaboradorNome: item.colaboradorNome,
                              motivoSensivel: sensiveis[key] === true,
                              pasta,
                            });
                            await queryClient.invalidateQueries({
                              queryKey: ["organico-documents", item.colaboradorMatricula],
                            });
                            toast({ title: "Entrevista arquivada na pasta selecionada." });
                          } catch (error) {
                            toast({
                              title: "O desligamento foi registrado, mas o PDF não foi arquivado.",
                              description: error instanceof Error ? error.message : "Tente novamente.",
                              variant: "destructive",
                            });
                            return;
                          }
                        }
                        setMotivos((prev) => {
                          const next = { ...prev };
                          delete next[key];
                          return next;
                        });
                        setFilhosSelecionados((prev) => {
                          const next = { ...prev };
                          delete next[key];
                          return next;
                        });
                        setSensiveis((prev) => {
                          const next = { ...prev };
                          delete next[key];
                          return next;
                        });
                        setEntrevistas((prev) => {
                          const next = { ...prev };
                          delete next[key];
                          return next;
                        });
                        setPastasEntrevista((prev) => {
                          const next = { ...prev };
                          delete next[key];
                          return next;
                        });
                      }}
                    >
                      {resolving ? "Salvando…" : desligamento ? "Finalizar desligamento" : "Registrar motivo"}
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
