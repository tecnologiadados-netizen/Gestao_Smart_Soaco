import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogDescription,
  DialogTitle,
} from "@rh/components/ui/dialog";
import { Button } from "@rh/components/ui/button";
import { cn } from "@rh/lib/utils";
import type { OrganicoRepresentanteDraft } from "./OrganicoRepresentanteCard";

type RepresentanteField =
  | { key: "nome"; label: string; readOnly: true }
  | { key: "nomeRazaoSocial"; label: string; readOnly: true }
  | { key: keyof OrganicoRepresentanteDraft; label: string; readOnly?: false };
type RepresentanteSection = { id: string; title: string; fields: RepresentanteField[] };

const SECTIONS: RepresentanteSection[] = [
  {
    id: "identificacao",
    title: "Identificação",
    fields: [
      { key: "nome", label: "NOME", readOnly: true },
      { key: "nomeRazaoSocial", label: "RAZÃO SOCIAL", readOnly: true },
      { key: "cpf", label: "CPF" },
    ],
  },
  {
    id: "cargo",
    title: "Cargo e Trabalho",
    fields: [
      { key: "admissao", label: "ADMISSÃO" },
      { key: "tempoEmpresa", label: "TEMPO DE EMPRESA" },
      { key: "cargo", label: "CARGO" },
      { key: "setor", label: "SETOR" },
      { key: "area", label: "ÁREA DE ATUAÇÃO DO REPRESENTANTE" },
    ],
  },
  {
    id: "formacao",
    title: "Formação",
    fields: [
      { key: "grauInstrucao", label: "GRAU INSTRUÇÃO" },
    ],
  },
  {
    id: "pessoal",
    title: "Pessoal",
    fields: [
      { key: "nascimento", label: "NASCIMENTO" },
      { key: "idade", label: "IDADE" },
      { key: "telefone", label: "TELEFONE" },
      { key: "telefoneEmergencial", label: "TELEFONE EMERGENCIAL" },
    ],
  },
  {
    id: "banco",
    title: "Dados Bancários",
    fields: [
      { key: "agencia", label: "AGENCIA" },
      { key: "conta", label: "CONTA" },
      { key: "banco", label: "BANCO" },
      { key: "chavePix", label: "CHAVE PIX" },
      { key: "casoNaoTenhaPix", label: "CASO NÃO TENHA PIX" },
    ],
  },
  {
    id: "contrato",
    title: "Contrato",
    fields: [
      { key: "vinculo", label: "VÍNCULO" },
    ],
  },
];

const lblForm = "text-xs font-medium text-muted-foreground mb-1.5 block";
const dashedInput =
  "flex h-9 w-full min-w-0 rounded-lg border border-dashed border-muted-foreground/35 bg-background px-3 text-sm text-foreground shadow-none transition-colors placeholder:text-foreground focus-visible:border-solid focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:ring-offset-0 read-only:text-foreground disabled:cursor-not-allowed disabled:text-foreground disabled:opacity-100 md:text-sm";
const dashedInputRead =
  "cursor-default bg-muted/45 border-muted-foreground/25 text-foreground placeholder:text-foreground read-only:text-foreground";

function FormSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-3 rounded-xl border border-border/90 bg-card/35 shadow-sm overflow-hidden">
      <header className="border-b border-border/80 bg-muted/50 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-foreground">
        {title}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function FormRepresentanteModal({
  open,
  onOpenChange,
  nome,
  nomeRazaoSocial,
  initialDraft,
  onSave,
  readOnly = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nome fantasia (integração Nomus). */
  nome: string;
  /** Razão social (integração Nomus). */
  nomeRazaoSocial: string;
  initialDraft: OrganicoRepresentanteDraft;
  onSave: (next: OrganicoRepresentanteDraft) => void;
  readOnly?: boolean;
}) {
  const [draft, setDraft] = useState<OrganicoRepresentanteDraft>(initialDraft);
  const [activeSectionId, setActiveSectionId] = useState<string>(SECTIONS[0]!.id);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fotoInputRef = useRef<HTMLInputElement | null>(null);
  const skipObserverRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setDraft(initialDraft);
    setActiveSectionId(SECTIONS[0]!.id);
  }, [open, initialDraft]);

  useEffect(() => {
    if (!open) return;
    let observer: IntersectionObserver | null = null;
    let cancelled = false;

    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      const root = scrollRef.current;
      if (!root) return;
      const sectionEls = SECTIONS.map((section) =>
        root.querySelector<HTMLElement>(`#representante-section-${section.id}`),
      ).filter(Boolean) as HTMLElement[];
      if (sectionEls.length === 0) return;

      const updateActiveSectionFromScroll = () => {
        const maxScrollTop = Math.max(0, root.scrollHeight - root.clientHeight);
        if (root.scrollTop >= maxScrollTop - 8) {
          setActiveSectionId(SECTIONS[SECTIONS.length - 1]!.id);
          return;
        }

        const rootTop = root.getBoundingClientRect().top;
        const targetLine = rootTop + Math.max(80, root.clientHeight * 0.18);
        let currentId = SECTIONS[0]!.id;

        for (const el of sectionEls) {
          const top = el.getBoundingClientRect().top;
          if (top <= targetLine) {
            const sectionId = el.id.replace("representante-section-", "");
            if (SECTIONS.some((section) => section.id === sectionId)) currentId = sectionId;
          }
        }

        setActiveSectionId(currentId);
      };

      observer = new IntersectionObserver(
        (entries) => {
          if (skipObserverRef.current) return;
          const visible = entries
            .filter((entry) => entry.isIntersecting && entry.intersectionRatio > 0)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
          const top = visible[0];
          if (top?.target.id?.startsWith("representante-section-")) {
            const sectionId = top.target.id.replace("representante-section-", "");
            if (SECTIONS.some((section) => section.id === sectionId)) setActiveSectionId(sectionId);
          }
        },
        { root, rootMargin: "-12% 0px -55% 0px", threshold: [0, 0.1, 0.25, 0.5] },
      );

      for (const el of sectionEls) observer.observe(el);
      root.addEventListener("scroll", updateActiveSectionFromScroll, { passive: true });
      updateActiveSectionFromScroll();

      const cleanupScroll = () => root.removeEventListener("scroll", updateActiveSectionFromScroll);
      (observer as IntersectionObserver & { __cleanupScroll?: () => void }).__cleanupScroll = cleanupScroll;
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      const observerWithCleanup = observer as (IntersectionObserver & { __cleanupScroll?: () => void }) | null;
      observerWithCleanup?.__cleanupScroll?.();
      observer?.disconnect();
    };
  }, [open]);

  const scrollToSection = useCallback((sectionId: string) => {
    const container = scrollRef.current;
    const target = document.getElementById(`representante-section-${sectionId}`);
    if (!container || !target) return;
    skipObserverRef.current = true;
    setActiveSectionId(sectionId);
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      skipObserverRef.current = false;
    }, 600);
  }, []);

  const handleFotoChange = useCallback((file: File | null) => {
    if (readOnly) return;
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) return;
      setDraft((prev) => ({
        ...prev,
        fotoBase64: dataUrl,
        fotoMimeType: file.type,
      }));
    };
    reader.readAsDataURL(file);
  }, [readOnly]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col gap-0 p-0 overflow-hidden",
          "w-[min(98vw,104rem)] max-w-[min(98vw,104rem)]",
          "h-[min(92dvh,54rem)] max-h-[92dvh]",
        )}
        onOpenAutoFocus={(ev) => ev.preventDefault()}
      >
        <DialogHeader className="px-6 sm:px-8 pt-5 pb-3 shrink-0 text-left border-b border-border">
          <DialogTitle>{readOnly ? "Visualizar representante" : "Editar representante"}</DialogTitle>
          <DialogDescription className="text-pretty leading-relaxed max-w-none">
            Use as <strong>categorias</strong> para rolar até cada bloco. Os campos <strong>nome</strong> e <strong>razão social</strong> vêm da integração e são somente leitura.
            {readOnly ? " Modo somente leitura." : null}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(draft);
            onOpenChange(false);
          }}
          className="flex flex-col flex-1 min-h-0 overflow-hidden"
        >
          <nav className="shrink-0 border-b border-border bg-muted/25 px-4 sm:px-6 py-2.5" aria-label="Seções do formulário">
            <div className="flex flex-wrap gap-1.5">
              {SECTIONS.map((section) => {
                const isActive = section.id === activeSectionId;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => scrollToSection(section.id)}
                    className={cn(
                      "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                      isActive
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-transparent bg-background/80 text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {section.title}
                  </button>
                );
              })}
            </div>
          </nav>

          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-6 py-5 sm:px-8 space-y-6"
          >
            {SECTIONS.map((section) => (
              <FormSection key={section.id} id={`representante-section-${section.id}`} title={section.title}>
                {section.id === "identificacao" ? (
                  <div className="mb-5 rounded-lg border border-border/80 bg-muted/20 p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        {draft.fotoBase64 ? (
                          <img
                            src={draft.fotoBase64}
                            alt={`Foto de ${nome}`}
                            className="h-16 w-16 rounded-lg border border-border/60 bg-muted/30 object-contain shrink-0"
                          />
                        ) : (
                          <div className="h-16 w-16 rounded-lg border border-dashed border-muted-foreground/35 bg-background flex items-center justify-center shrink-0">
                            <ImagePlus className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">Foto do representante</p>
                          <p className="text-xs text-muted-foreground">
                            A imagem será exibida no card do representante.
                          </p>
                        </div>
                      </div>
                      {!readOnly ? (
                      <div className="flex flex-wrap gap-2">
                        <input
                          ref={fotoInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            handleFotoChange(e.target.files?.[0] ?? null);
                            e.target.value = "";
                          }}
                        />
                        <Button type="button" variant="outline" size="sm" onClick={() => fotoInputRef.current?.click()}>
                          {draft.fotoBase64 ? "Substituir foto" : "Adicionar foto"}
                        </Button>
                        {draft.fotoBase64 ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setDraft((prev) => ({
                                ...prev,
                                fotoBase64: "",
                                fotoMimeType: "",
                              }))
                            }
                            className="gap-1.5 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remover
                          </Button>
                        ) : null}
                      </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-x-5 md:items-start">
                  {section.fields.map((field) => (
                    <div key={field.key} className="min-w-0">
                      <label className={lblForm}>{field.label}</label>
                      {field.key === "nome" ? (
                        <input type="text" readOnly value={nome} className={cn(dashedInput, dashedInputRead)} />
                      ) : field.key === "nomeRazaoSocial" ? (
                        <input type="text" readOnly value={nomeRazaoSocial} className={cn(dashedInput, dashedInputRead)} />
                      ) : (
                        <input
                          type="text"
                          value={draft[field.key]}
                          readOnly={readOnly}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              [field.key]: e.target.value,
                            }))
                          }
                          className={cn(dashedInput, readOnly && dashedInputRead)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </FormSection>
            ))}
          </div>

          <DialogFooter className="shrink-0 px-6 sm:px-8 py-4 border-t border-border bg-background">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {readOnly ? "Fechar" : "Cancelar"}
            </Button>
            {!readOnly && (
              <Button type="submit">
                Salvar alterações
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
