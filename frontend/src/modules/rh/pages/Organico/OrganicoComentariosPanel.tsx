import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Expand, History, MessageSquareMore, SendHorizontal, Trash2 } from "lucide-react";
import { Button } from "@rh/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@rh/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@rh/components/ui/popover";
import { Textarea } from "@rh/components/ui/textarea";
import { useToast } from "@rh/hooks/use-toast";
import { addOrganicoComentario, deleteOrganicoComentario, getConfig, getOrganicoComentarios } from "@rh/lib/api-client";
import { getCurrentUser } from "@rh/lib/auth";
import { canViewOrganicoCommentTag } from "@rh/lib/route-permissions";
import {
  DEFAULT_ORGANICO_COMMENT_TAG_OPTIONS,
  getOrganicoCommentTagLabel,
  getOrganicoCommentTagTone,
  getOrganicoCommentToneLabel,
  getOrganicoCommentVisibilityLabel,
  ORGANICO_COMMENT_TAGS_CONFIG_KEY,
  ORGANICO_COMMENT_TONE_OPTIONS,
  ORGANICO_COMMENT_VISIBILITY_OPTIONS,
  parseOrganicoCommentTagCatalog,
  type OrganicoCommentTagOption,
  type OrganicoCommentToneId,
  type OrganicoCommentVisibilityId,
} from "@rh/lib/organico-comment-tags";
import type { OrganicoComentario } from "@rh/types/api";
import { cn } from "@rh/lib/utils";
import { getOrganicoActivityCategoryLabel } from "./organico-activity-log";

/** Logs gerados pelo fluxo de sanções disciplinares (campo_alterado no banco). */
function isSancaoDisciplinarLog(comment: OrganicoComentario): boolean {
  if (comment.tipo !== "log_alteracao") return false;
  const raw = (comment.campoAlterado ?? "").trim().toLowerCase();
  if (raw === "sancao_disciplinar") return true;
  const ascii = raw.normalize("NFD").replace(/\p{M}/gu, "");
  return ascii.includes("sancao") && ascii.includes("disciplinar");
}

type SancaoDisciplinarVisualKind = "verbal" | "disciplinary" | "suspension";

function classifySancaoDisciplinarTipo(tipo: string): SancaoDisciplinarVisualKind {
  const t = tipo
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase();
  if (/SUSPENS/.test(t)) return "suspension";
  if (/VERBAL/.test(t)) return "verbal";
  return "disciplinary";
}

function sancaoDisciplinarCardClass(kind: SancaoDisciplinarVisualKind): string {
  switch (kind) {
    case "verbal":
      return "border-yellow-200 bg-yellow-50 text-foreground";
    case "suspension":
      return "border-red-200 bg-red-50 text-foreground";
    default:
      return "border-orange-200 bg-orange-50 text-foreground";
  }
}

function extractTipoMotivoSancaoLog(comment: OrganicoComentario): { tipo: string; motivo: string } {
  const va = String(comment.valorAtual ?? "").trim();
  const com = String(comment.comentario ?? "").trim();

  let tipo = "";
  let motivo = "";

  const tipoLine = va.match(/^Tipo:\s*(.+)$/im);
  if (tipoLine) tipo = tipoLine[1].trim();

  const motivoBlock = va.match(/Motivo:\s*([\s\S]*)$/im);
  if (motivoBlock) motivo = motivoBlock[1].trim();

  if (!tipo) {
    const guillemet = com.match(/«([^»]+)»/);
    if (guillemet) tipo = guillemet[1].trim();
  }
  if (!motivo) {
    const m = com.match(/Motivo:\s*([\s\S]+)$/i);
    if (m) motivo = m[1].replace(/\.\s*$/, "").trim();
  }

  return { tipo, motivo };
}

function getInitials(name: string): string {
  return (
    name
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "US"
  );
}

function formatCommentTimestamp(value: string): string {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dt);
}

function CommentItem({
  comment,
  tagOptions,
  canDelete,
  deleting,
  onDelete,
}: {
  comment: OrganicoComentario;
  tagOptions: OrganicoCommentTagOption[];
  canDelete: boolean;
  deleting: boolean;
  onDelete: (id: string) => void;
}) {
  const isLog = comment.tipo === "log_alteracao";
  const isSancaoLog = isLog && isSancaoDisciplinarLog(comment);
  const { tipo: sancaoTipo, motivo: sancaoMotivo } = isSancaoLog ? extractTipoMotivoSancaoLog(comment) : { tipo: "", motivo: "" };
  const sancaoKind = isSancaoLog ? classifySancaoDisciplinarTipo(sancaoTipo) : null;
  const tagTone = getOrganicoCommentTagTone(comment.tagCode, tagOptions);

  const toneClassName =
    tagTone === "positive"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tagTone === "negative"
        ? "border-red-200 bg-red-50 text-red-700"
        : tagTone === "sensitive"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <article
      className={cn(
        "rounded-xl border px-3 py-3 shadow-sm",
        isSancaoLog && sancaoKind ? sancaoDisciplinarCardClass(sancaoKind) : "border-border/70 bg-card",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            isSancaoLog && sancaoKind
              ? sancaoKind === "verbal"
                ? "bg-yellow-100 text-yellow-900"
                : sancaoKind === "suspension"
                  ? "bg-red-100 text-red-800"
                  : "bg-orange-100 text-orange-900"
              : "bg-primary/10 text-primary",
          )}
        >
          {isLog ? <History className="h-4 w-4" /> : getInitials(comment.createdBy)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-semibold text-foreground">{comment.createdBy}</span>
              <span className="text-xs text-muted-foreground">{formatCommentTimestamp(comment.createdAt)}</span>
              <span className="rounded-full border border-border/70 bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {isSancaoLog ? "Atividade registrada" : isLog ? "Log automático" : "Comentário"}
              </span>
              {!isLog ? (
                <>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${toneClassName}`}>
                    {getOrganicoCommentToneLabel(tagTone)}
                  </span>
                  <span className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-[11px] font-medium text-foreground/80">
                    {getOrganicoCommentTagLabel(comment.tagCode, tagOptions)}
                  </span>
                  <span className="rounded-full border border-border/70 bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {getOrganicoCommentVisibilityLabel(comment.visibility)}
                  </span>
                </>
              ) : null}
            </div>
            {canDelete ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(comment.id)}
                disabled={deleting}
                title={isLog ? "Excluir log" : "Excluir comentário"}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
          {isSancaoLog ? (
            <div className="mt-2 space-y-2 text-sm leading-6 text-foreground/90">
              <p className="text-[13px] text-foreground/80">
                Lançamento de atividade de <span className="font-semibold text-foreground">sanção disciplinar</span> vinculada ao
                colaborador.
              </p>
              {sancaoTipo || sancaoMotivo ? (
                <>
                  <p className="break-words">
                    <span className="font-semibold">Tipo:</span> {sancaoTipo || "—"}
                  </p>
                  <p className="whitespace-pre-wrap break-words">
                    <span className="font-semibold">Motivo:</span> {sancaoMotivo || "—"}
                  </p>
                </>
              ) : (
                <p className="whitespace-pre-wrap break-words">
                  {String(comment.valorAtual ?? "").trim() || comment.comentario || "—"}
                </p>
              )}
            </div>
          ) : isLog ? (
            <div className="mt-2 space-y-1.5 text-sm leading-6 text-foreground/90">
              <p>
                <span className="font-medium">Aba alterada:</span> {getOrganicoActivityCategoryLabel(comment.categoria)}
              </p>
              {comment.campoAlterado ? (
                <p>
                  <span className="font-medium">Campo alterado:</span> {comment.campoAlterado}
                </p>
              ) : null}
              <p className="whitespace-pre-wrap break-words">
                <span className="font-medium">Antes da alteração:</span> {comment.valorAnterior || "-"}
              </p>
              <p className="whitespace-pre-wrap break-words">
                <span className="font-medium">Após a alteração:</span> {comment.valorAtual || "-"}
              </p>
              {comment.comentario?.trim() &&
              !String(comment.valorAtual ?? "").trim() &&
              !String(comment.valorAnterior ?? "").trim() ? (
                <p className="whitespace-pre-wrap break-words">
                  <span className="font-medium">Resumo:</span> {comment.comentario}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-foreground/90">{comment.comentario}</p>
          )}
        </div>
      </div>
    </article>
  );
}

function CommentComposer({
  draft,
  onDraftChange,
  tagOptions,
  selectedTone,
  onToneChange,
  selectedTagCode,
  onTagChange,
  selectedVisibility,
  onVisibilityChange,
  currentUser,
  canCreate,
  isSubmitting,
  onSubmit,
  disabled,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  tagOptions: OrganicoCommentTagOption[];
  selectedTone: OrganicoCommentToneId | "";
  onToneChange: (value: OrganicoCommentToneId | "") => void;
  selectedTagCode: string;
  onTagChange: (value: string) => void;
  selectedVisibility: OrganicoCommentVisibilityId | "";
  onVisibilityChange: (value: OrganicoCommentVisibilityId | "") => void;
  currentUser: string;
  canCreate: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
  disabled: boolean;
}) {
  const [classificationOpen, setClassificationOpen] = useState(false);
  const availableTags = tagOptions.filter((item) => item.tone === selectedTone);
  const canOpenClassification = canCreate && draft.trim().length > 0 && !isSubmitting;
  const canConfirm = !disabled;

  useEffect(() => {
    if (!canCreate || !draft.trim()) {
      setClassificationOpen(false);
    }
  }, [canCreate, draft]);

  return (
    <>
      <Textarea
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        placeholder="Escrever uma observação..."
        className="min-h-[88px] resize-none rounded-xl border-border/80 bg-background shadow-none"
        maxLength={2000}
        disabled={!canCreate}
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">Registrando como {currentUser}</span>
        <Popover open={classificationOpen} onOpenChange={setClassificationOpen}>
          <PopoverTrigger asChild>
            <Button type="button" size="sm" disabled={!canOpenClassification}>
              <SendHorizontal className="mr-1.5 h-4 w-4" />
              Adicionar
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[min(92vw,28rem)] space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Classificar comentário</p>
              <p className="text-xs text-muted-foreground">
                Revise a mensagem abaixo e defina a classificação antes de salvar.
              </p>
            </div>

            <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Mensagem</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">{draft.trim() || "-"}</p>
            </div>

            <div className="grid gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Tom</label>
                <select
                  value={selectedTone}
                  onChange={(event) => {
                    onToneChange(event.target.value as OrganicoCommentToneId | "");
                    onTagChange("");
                  }}
                  disabled={!canCreate}
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="">Selecione</option>
                  {ORGANICO_COMMENT_TONE_OPTIONS.map((tone) => (
                    <option key={tone.id} value={tone.id}>
                      {tone.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Categoria</label>
                <select
                  value={selectedTagCode}
                  onChange={(event) => onTagChange(event.target.value)}
                  disabled={!canCreate || !selectedTone}
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="">Selecione</option>
                  {availableTags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Visibilidade</label>
                <select
                  value={selectedVisibility}
                  onChange={(event) => onVisibilityChange(event.target.value as OrganicoCommentVisibilityId | "")}
                  disabled={!canCreate}
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="">Selecione</option>
                  {ORGANICO_COMMENT_VISIBILITY_OPTIONS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setClassificationOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onSubmit();
                  if (canConfirm) {
                    setClassificationOpen(false);
                  }
                }}
                disabled={!canConfirm}
              >
                {isSubmitting ? "Salvando..." : "Salvar comentário"}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
}

interface OrganicoComentariosPanelProps {
  open: boolean;
  colaboradorNome: string;
  colaboradorMatricula?: string | null;
  canCreate?: boolean;
  canDelete?: boolean;
}

function scrollToBottom(element: HTMLDivElement | null) {
  if (!element) return;
  window.requestAnimationFrame(() => {
    element.scrollTop = element.scrollHeight;
  });
}

export function OrganicoComentariosPanel({
  open,
  colaboradorNome,
  colaboradorMatricula,
  canCreate = true,
  canDelete = false,
}: OrganicoComentariosPanelProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [draft, setDraft] = useState("");
  const [selectedTone, setSelectedTone] = useState<OrganicoCommentToneId | "">("");
  const [selectedTagCode, setSelectedTagCode] = useState("");
  const [selectedVisibility, setSelectedVisibility] = useState<OrganicoCommentVisibilityId | "">("");
  const [expandedOpen, setExpandedOpen] = useState(false);
  const inlineScrollRef = useRef<HTMLDivElement | null>(null);
  const dialogScrollRef = useRef<HTMLDivElement | null>(null);

  const nome = colaboradorNome.trim();
  const matricula = String(colaboradorMatricula ?? "").trim();
  const currentUser = useMemo(() => getCurrentUser()?.trim() || "Usuário", []);
  const queryKey = ["organico-comentarios", matricula, nome];
  const tagCatalogQuery = useQuery({
    queryKey: ["organico-comment-tags-catalog"],
    queryFn: async () => parseOrganicoCommentTagCatalog((await getConfig(ORGANICO_COMMENT_TAGS_CONFIG_KEY)).value),
    staleTime: 30_000,
  });
  const tagOptions = tagCatalogQuery.data ?? DEFAULT_ORGANICO_COMMENT_TAG_OPTIONS;

  useEffect(() => {
    if (open) {
      setDraft("");
      setSelectedTone("");
      setSelectedTagCode("");
      setSelectedVisibility("");
    }
  }, [open, nome, matricula]);

  useEffect(() => {
    if (!open) {
      setExpandedOpen(false);
    }
  }, [open]);

  const commentsQuery = useQuery({
    queryKey,
    queryFn: () => getOrganicoComentarios({ nome, matricula }),
    enabled: open && Boolean(nome || matricula),
  });

  const addCommentMutation = useMutation({
    mutationFn: async () =>
      addOrganicoComentario({
        matricula,
        colaboradorNome: nome,
        comentario: draft.trim(),
        createdBy: currentUser,
        tagCode: selectedTagCode,
        visibility: selectedVisibility as OrganicoCommentVisibilityId,
      }),
    onSuccess: async () => {
      setDraft("");
      setSelectedTone("");
      setSelectedTagCode("");
      setSelectedVisibility("");
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ["organico-comentarios-resumo"] });
      toast({ title: "Comentário adicionado", description: "A observação foi registrada para este colaborador." });
    },
    onError: (error) => {
      toast({
        title: "Erro ao adicionar comentário",
        description: error instanceof Error ? error.message : "Não foi possível gravar a observação.",
        variant: "destructive",
      });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (id: string) => deleteOrganicoComentario({ id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ["organico-comentarios-resumo"] });
      toast({ title: "Registro excluído", description: "O item foi removido com sucesso." });
    },
    onError: (error) => {
      toast({
        title: "Erro ao excluir registro",
        description: error instanceof Error ? error.message : "Não foi possível remover o item.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!canCreate || !draft.trim() || !selectedTone || !selectedTagCode || !selectedVisibility || addCommentMutation.isPending) return;
    addCommentMutation.mutate();
  };

  const handleDelete = (id: string) => {
    if (!canDelete || deleteCommentMutation.isPending) return;
    deleteCommentMutation.mutate(id);
  };

  const comments = useMemo(() => {
    const items = (commentsQuery.data ?? []).filter((c) =>
      canViewOrganicoCommentTag(c.tagCode, c.visibility),
    );
    return [...items].sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      if (!Number.isNaN(timeA) && !Number.isNaN(timeB) && timeA !== timeB) {
        return timeA - timeB;
      }
      return a.createdAt.localeCompare(b.createdAt);
    });
  }, [commentsQuery.data]);

  useEffect(() => {
    if (!open) return;
    scrollToBottom(inlineScrollRef.current);
    if (expandedOpen) {
      scrollToBottom(dialogScrollRef.current);
    }
  }, [comments.length, open, expandedOpen]);

  const renderActivityList = (scrollRef: typeof inlineScrollRef, className: string) => (
    <div ref={scrollRef} className={`min-h-0 flex-1 overflow-y-auto ${className}`}>
      <div className="px-4 py-4 lg:px-5">
        <div className="space-y-3">
          {commentsQuery.isLoading ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
              Carregando atividade...
            </div>
          ) : comments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
              Nenhuma atividade registrada para este colaborador.
            </div>
          ) : (
            comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                tagOptions={tagOptions}
                canDelete={canDelete}
                deleting={deleteCommentMutation.isPending}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="flex w-full shrink-0 flex-col border-t border-border bg-muted/20 lg:w-[28rem] xl:w-[30rem] lg:border-l lg:border-t-0">
        <div className="border-b border-border px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <MessageSquareMore className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Comentários e atividade</h3>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Observações e logs automáticos registrados para <strong>{nome || "este colaborador"}</strong>.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setExpandedOpen(true)}>
              <Expand className="h-4 w-4" />
              Tela maior
            </Button>
          </div>
        </div>

        {renderActivityList(inlineScrollRef, "")}

        <div className="border-t border-border bg-background/95 px-4 py-4 lg:px-5">
          <CommentComposer
            draft={draft}
            onDraftChange={setDraft}
            tagOptions={tagOptions}
            selectedTone={selectedTone}
            onToneChange={setSelectedTone}
            selectedTagCode={selectedTagCode}
            onTagChange={setSelectedTagCode}
            selectedVisibility={selectedVisibility}
            onVisibilityChange={setSelectedVisibility}
            currentUser={currentUser}
            canCreate={canCreate}
            isSubmitting={addCommentMutation.isPending}
            onSubmit={handleSubmit}
            disabled={!canCreate || !draft.trim() || !selectedTone || !selectedTagCode || !selectedVisibility || addCommentMutation.isPending || !nome}
          />
        </div>
      </aside>

      <Dialog open={expandedOpen} onOpenChange={setExpandedOpen}>
        <DialogContent className="flex h-[min(88vh,56rem)] max-w-[min(100vw-2rem,76rem)] flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-6 py-4 text-left">
            <DialogTitle>Comentários e atividade</DialogTitle>
            <DialogDescription>
              Visualização ampliada do histórico de <strong>{nome || "este colaborador"}</strong>.
            </DialogDescription>
          </DialogHeader>

          {renderActivityList(dialogScrollRef, "")}

          <div className="border-t border-border bg-background px-6 py-4">
            <CommentComposer
              draft={draft}
              onDraftChange={setDraft}
              tagOptions={tagOptions}
              selectedTone={selectedTone}
              onToneChange={setSelectedTone}
              selectedTagCode={selectedTagCode}
              onTagChange={setSelectedTagCode}
              selectedVisibility={selectedVisibility}
              onVisibilityChange={setSelectedVisibility}
              currentUser={currentUser}
              canCreate={canCreate}
              isSubmitting={addCommentMutation.isPending}
              onSubmit={handleSubmit}
              disabled={!canCreate || !draft.trim() || !selectedTone || !selectedTagCode || !selectedVisibility || addCommentMutation.isPending || !nome}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
