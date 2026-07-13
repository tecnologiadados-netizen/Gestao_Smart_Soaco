import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, ChevronsUpDown } from "lucide-react";
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
import { Label } from "@rh/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@rh/components/ui/popover";
import { Textarea } from "@rh/components/ui/textarea";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@rh/components/ui/command";
import type { Colaborador, OrganicoRow, SancaoDisciplinarRow } from "@rh/types/api";
import { isLaunchDocTestMode } from "@rh/lib/launch-document-config";
import {
  buildLaunchDocumentTitle,
  pickDefaultLaunchFolderOption,
  resolveLaunchDocumentCategory,
  sancaoExigeAnexoDocumento,
  sancaoPermiteAnexoOpcionalDocumento,
} from "@rh/lib/launch-document-rules";
import { persistLaunchDocumentAttachment, isLaunchDocAttachmentEnabled } from "@rh/lib/launch-document-persist";
import { LAUNCH_DOC_TEST_FOLDER_ID } from "@rh/lib/launch-document-queue";
import {
  flattenArchiveFolderOptions,
  getOrganicoDocuments,
  isOrganicoDocumentsApiConfigured,
} from "@rh/lib/organico-documents-api";
import {
  LaunchDocumentAttachmentField,
  type LaunchDocumentFolderSelection,
} from "@rh/pages/FaltasAtestados/LaunchDocumentAttachmentField";
import { useToast } from "@rh/hooks/use-toast";
import { useSavingOverlay } from "@rh/contexts/saving-overlay-context";
import { organicoRowToColaborador, getStatusFromRow } from "@rh/pages/Organico/organico-derive";
import { emptySancaoFields } from "@rh/pages/FaltasAtestados/sancoes-disciplinares-excel";
import { cn, randomUUID } from "@rh/lib/utils";
import { commandFilterScore } from "@rh/lib/normalize-search-text";

const MANUAL_KEY = "__manual__";
const TIPO_MANUAL_KEY = "__tipo_manual__";

function mesAnoFromDataAplicacao(iso: string): { mes: string; ano: string } {
  const s = String(iso ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { mes: "", ano: "" };
  try {
    const d = parseISO(s);
    return { mes: format(d, "LLL.", { locale: ptBR }), ano: format(d, "yyyy") };
  } catch {
    return { mes: "", ano: "" };
  }
}

type ColabEntry = { id: string; row: OrganicoRow; colab: Colaborador };

const lblForm = "text-xs font-medium text-muted-foreground mb-1.5 block";
const dashedInput =
  "flex h-9 w-full min-w-0 rounded-lg border border-dashed border-muted-foreground/35 bg-background px-3 text-sm shadow-none transition-colors placeholder:text-muted-foreground/65 focus-visible:border-solid focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:ring-offset-0 md:text-sm";
const dashedInputRead = "cursor-not-allowed bg-muted/45 border-muted-foreground/25";
const dashedTextarea =
  "flex min-h-[88px] w-full resize-y rounded-lg border border-dashed border-muted-foreground/35 bg-background px-3 py-2.5 text-sm shadow-none transition-colors placeholder:text-muted-foreground/65 focus-visible:border-solid focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:ring-offset-0";
const comboDashed =
  "h-9 w-full min-w-0 justify-between rounded-lg border border-dashed border-muted-foreground/35 bg-background font-normal text-sm shadow-none hover:bg-muted/35";

function isProvisionalSancaoId(id: SancaoDisciplinarRow["id"]): boolean {
  const s = String(id);
  return s.startsWith("temp-") || s.startsWith("import-");
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (row: SancaoDisciplinarRow) => Promise<void>;
  canEdit?: boolean;
  organicoRows: OrganicoRow[];
  /** Valores do cadastro “Tipos de sanções” (já ordenados). Se vazio, o tipo é só texto livre. */
  tiposSancaoOptions?: string[];
  /** Modo edição: preserva o `id` e regras de motivo para registros já existentes no banco. */
  initialRow?: SancaoDisciplinarRow | null;
  documentCategoryOptions?: string[];
};

function draftFromSancaoRow(row: SancaoDisciplinarRow): Omit<SancaoDisciplinarRow, "id"> {
  const { id: _id, ...rest } = row;
  return {
    ...rest,
    matricula: String(rest.matricula ?? "").trim(),
    nomeFuncionario: String(rest.nomeFuncionario ?? "").trim(),
    tipo: String(rest.tipo ?? "").trim(),
    dataAplicacao: String(rest.dataAplicacao ?? "").trim().slice(0, 10),
    mes: String(rest.mes ?? "").trim(),
    ano: String(rest.ano ?? "").trim(),
    observacoes: String(rest.observacoes ?? "").trim(),
  };
}

export function LancarSancaoDialog({
  open,
  onOpenChange,
  onSave,
  canEdit = true,
  organicoRows,
  tiposSancaoOptions = [],
  initialRow = null,
  documentCategoryOptions = [],
}: Props) {
  const { toast } = useToast();
  const { runWithSaving } = useSavingOverlay();
  const [draft, setDraft] = useState<Omit<SancaoDisciplinarRow, "id">>(() => emptySancaoFields());
  const [editingId, setEditingId] = useState<SancaoDisciplinarRow["id"] | null>(null);
  const [saving, setSaving] = useState(false);
  const [colabOpen, setColabOpen] = useState(false);
  const [colabSelection, setColabSelection] = useState<string | null>(null);
  const [tipoOpen, setTipoOpen] = useState(false);
  const [tipoPick, setTipoPick] = useState<string | null>(null);
  const prevAttachmentTipoRef = useRef<string | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentTitle, setAttachmentTitle] = useState("");
  const [attachmentFolder, setAttachmentFolder] = useState<LaunchDocumentFolderSelection | null>(null);
  const [attachmentFileError, setAttachmentFileError] = useState<string | null>(null);
  const [attachmentFolderError, setAttachmentFolderError] = useState<string | null>(null);

  const matriculaArquivo = String(draft.matricula ?? "").trim();
  const nomeArquivo = String(draft.nomeFuncionario ?? "").trim();

  const isNewLaunch = editingId == null || String(editingId).startsWith("temp-");
  const tipoSancao = String(draft.tipo ?? "");
  const exigeAnexoDocumento = useMemo(
    () => isLaunchDocAttachmentEnabled() && sancaoExigeAnexoDocumento(isNewLaunch, tipoSancao),
    [isNewLaunch, tipoSancao],
  );
  const permiteAnexoOpcional = useMemo(
    () => isLaunchDocAttachmentEnabled() && sancaoPermiteAnexoOpcionalDocumento(isNewLaunch, tipoSancao),
    [isNewLaunch, tipoSancao],
  );
  const mostrarCampoAnexo = exigeAnexoDocumento || permiteAnexoOpcional;
  const launchDocumentCategory = useMemo(
    () =>
      resolveLaunchDocumentCategory({
        source: "sancao",
        tipo: String(draft.tipo ?? ""),
        categoryOptions: documentCategoryOptions,
      }),
    [draft.tipo, documentCategoryOptions],
  );
  const suggestedAttachmentTitle = useMemo(
    () =>
      buildLaunchDocumentTitle({
        category: launchDocumentCategory,
        dataIso: String(draft.dataAplicacao ?? ""),
        colaboradorNome: String(draft.nomeFuncionario ?? ""),
      }),
    [launchDocumentCategory, draft.dataAplicacao, draft.nomeFuncionario],
  );

  const { data: colaboradorArchiveFolders = [], isLoading: loadingArchiveFolders } = useQuery({
    queryKey: ["launch-doc-folders", matriculaArquivo],
    queryFn: () => getOrganicoDocuments(matriculaArquivo, nomeArquivo),
    enabled: open && mostrarCampoAnexo && Boolean(matriculaArquivo) && isOrganicoDocumentsApiConfigured(),
    staleTime: 30_000,
  });

  const attachmentFolderOptions = useMemo(() => {
    const fromApi = flattenArchiveFolderOptions(colaboradorArchiveFolders);
    if (isLaunchDocTestMode()) {
      const testOption = {
        id: LAUNCH_DOC_TEST_FOLDER_ID,
        scope: "local" as const,
        label: "Lançamentos (teste)",
      };
      if (fromApi.some((folder) => folder.id === LAUNCH_DOC_TEST_FOLDER_ID)) return fromApi;
      return [...fromApi, testOption];
    }
    return fromApi;
  }, [colaboradorArchiveFolders]);

  const colaboradoresAtivos = useMemo(() => {
    const out: ColabEntry[] = [];
    for (const row of organicoRows) {
      const values = Array.isArray(row.values) ? row.values : [];
      if (getStatusFromRow(values) !== "Ativo") continue;
      const colab = organicoRowToColaborador(row);
      if (!colab) continue;
      out.push({ id: String(row.id), row, colab });
    }
    out.sort((a, b) => a.colab.name.localeCompare(b.colab.name, "pt-BR", { sensitivity: "base" }));
    return out;
  }, [organicoRows]);

  const lockedFromOrganico = Boolean(colabSelection && colabSelection !== MANUAL_KEY);

  const { mes: mesDisplay, ano: anoDisplay } = mesAnoFromDataAplicacao(draft.dataAplicacao);

  const useTipoLista = tiposSancaoOptions.length > 0;
  const isEditMode = editingId != null;

  const requiresMotivo = editingId == null || isProvisionalSancaoId(editingId);

  useEffect(() => {
    if (!open) return;
    setSaving(false);
    setColabOpen(false);
    setTipoOpen(false);
    setAttachmentFile(null);
    setAttachmentFileError(null);
    setAttachmentTitle("");
    setAttachmentFolder(null);
    setAttachmentFolderError(null);
    prevAttachmentTipoRef.current = null;
    if (initialRow) {
      setDraft(draftFromSancaoRow(initialRow));
      setEditingId(initialRow.id);
    } else {
      setDraft(emptySancaoFields());
      setEditingId(null);
      setColabSelection(null);
      setTipoPick(null);
    }
  }, [open, initialRow]);

  useEffect(() => {
    if (!open || !mostrarCampoAnexo) return;
    const tipo = String(draft.tipo ?? "");
    const tipoChanged = prevAttachmentTipoRef.current !== tipo;
    prevAttachmentTipoRef.current = tipo;
    setAttachmentTitle((prev) => {
      if (tipoChanged || !prev.trim()) return suggestedAttachmentTitle;
      return prev;
    });
  }, [open, mostrarCampoAnexo, suggestedAttachmentTitle, draft.tipo]);

  useEffect(() => {
    if (!open || !mostrarCampoAnexo) return;
    setAttachmentFolder(null);
    setAttachmentFolderError(null);
  }, [open, mostrarCampoAnexo, matriculaArquivo]);

  useEffect(() => {
    if (!open || !mostrarCampoAnexo || attachmentFolderOptions.length === 0) return;
    setAttachmentFolder((current) => {
      if (
        current &&
        attachmentFolderOptions.some((option) => option.id === current.id && option.scope === current.scope)
      ) {
        return current;
      }
      return pickDefaultLaunchFolderOption(attachmentFolderOptions);
    });
  }, [open, mostrarCampoAnexo, attachmentFolderOptions]);

  useEffect(() => {
    if (!open || !initialRow) return;
    const mat = String(initialRow.matricula ?? "").trim();
    if (!mat) {
      setColabSelection(MANUAL_KEY);
      return;
    }
    const entry = colaboradoresAtivos.find((e) => String(e.colab.id).trim() === mat);
    setColabSelection(entry ? entry.id : MANUAL_KEY);
  }, [open, initialRow, colaboradoresAtivos]);

  useEffect(() => {
    if (!open || !initialRow) return;
    const t = String(initialRow.tipo ?? "").trim();
    if (!t) {
      setTipoPick(null);
      return;
    }
    if (tiposSancaoOptions.length > 0) {
      setTipoPick(tiposSancaoOptions.includes(t) ? t : TIPO_MANUAL_KEY);
    } else {
      setTipoPick(null);
    }
  }, [open, initialRow, tiposSancaoOptions]);

  const setField = useCallback((key: keyof Omit<SancaoDisciplinarRow, "id">, value: string) => {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "dataAplicacao") {
        const { mes, ano } = mesAnoFromDataAplicacao(value);
        next.mes = mes;
        next.ano = ano;
      }
      return next;
    });
  }, []);

  const applyOrganicoEntry = useCallback((entry: ColabEntry) => {
    const { colab } = entry;
    setDraft((prev) => ({
      ...prev,
      matricula: colab.id,
      nomeFuncionario: colab.name,
    }));
    setColabSelection(entry.id);
  }, []);

  const clearColaboradorCampos = useCallback(() => {
    setDraft((prev) => ({
      ...prev,
      matricula: "",
      nomeFuncionario: "",
    }));
  }, []);

  const formValid = useMemo(() => {
    if (!String(draft.dataAplicacao ?? "").trim()) return false;
    if (!String(draft.nomeFuncionario ?? "").trim()) return false;
    if (!String(draft.matricula ?? "").trim()) return false;
    if (!String(draft.tipo ?? "").trim()) return false;
    if (requiresMotivo && !String(draft.observacoes ?? "").trim()) return false;
    if (exigeAnexoDocumento) {
      if (!attachmentFile) return false;
      if (!String(attachmentTitle ?? "").trim()) return false;
      if (!attachmentFolder?.id) return false;
    } else if (permiteAnexoOpcional && attachmentFile) {
      if (!String(attachmentTitle ?? "").trim()) return false;
      if (!attachmentFolder?.id) return false;
    }
    return true;
  }, [
    draft,
    requiresMotivo,
    exigeAnexoDocumento,
    permiteAnexoOpcional,
    attachmentFile,
    attachmentTitle,
    attachmentFolder,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !formValid) return;
    const dataVal = String(draft.dataAplicacao ?? "").trim();
    const nomeVal = String(draft.nomeFuncionario ?? "").trim();
    const { mes, ano } = mesAnoFromDataAplicacao(dataVal);
    setSaving(true);
    try {
      const row: SancaoDisciplinarRow = {
        id: editingId != null ? editingId : `temp-${randomUUID()}`,
        matricula: String(draft.matricula ?? "").trim(),
        nomeFuncionario: nomeVal,
        tipo: String(draft.tipo ?? "").trim(),
        dataAplicacao: dataVal,
        mes,
        ano,
        observacoes: String(draft.observacoes ?? "").trim(),
      };
      if (exigeAnexoDocumento) {
        if (!attachmentFile) {
          setAttachmentFileError("Anexe o documento comprobatório para concluir o lançamento.");
          throw new Error("Anexo obrigatório.");
        }
        if (!attachmentFolder?.id) {
          setAttachmentFolderError("Selecione a pasta de destino no card do colaborador.");
          throw new Error("Selecione a pasta de destino.");
        }
        setAttachmentFileError(null);
        setAttachmentFolderError(null);
      } else if (permiteAnexoOpcional && attachmentFile) {
        if (!String(attachmentTitle ?? "").trim()) {
          setAttachmentFileError("Informe o título do documento.");
          throw new Error("Título do anexo obrigatório.");
        }
        if (!attachmentFolder?.id) {
          setAttachmentFolderError("Selecione a pasta de destino no card do colaborador.");
          throw new Error("Selecione a pasta de destino.");
        }
        setAttachmentFileError(null);
        setAttachmentFolderError(null);
      }

      await runWithSaving(async () => {
        const devePersistirAnexo =
          attachmentFile && attachmentFolder?.id && (exigeAnexoDocumento || permiteAnexoOpcional);

        if (devePersistirAnexo) {
          await persistLaunchDocumentAttachment({
            file: attachmentFile,
            matricula: row.matricula,
            colaboradorNome: row.nomeFuncionario,
            category: launchDocumentCategory,
            title: String(attachmentTitle ?? "").trim() || suggestedAttachmentTitle,
            source: "sancao",
            sourceTipo: row.tipo,
            sourceTempId: String(row.id),
            folderId: attachmentFolder.id,
            folderScope: attachmentFolder.scope,
          });
          if (isLaunchDocTestMode()) {
            toast({
              title: "Anexo enfileirado (teste)",
              description: "O documento aparecerá na pasta escolhida no arquivamento digital do colaborador.",
            });
          } else {
            toast({
              title: "Documento arquivado",
              description: "O anexo foi gravado na pasta do colaborador no Orgânico.",
            });
          }
        }
        await onSave(row);
      }, isEditMode ? "Atualizando sanção…" : "Salvando sanção…");
      onOpenChange(false);
    } catch (error) {
      if (exigeAnexoDocumento || (permiteAnexoOpcional && attachmentFile)) {
        setAttachmentFileError(error instanceof Error ? error.message : "Falha ao processar anexo.");
      }
      /* toast no pai */
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col gap-0 p-0 overflow-hidden",
          "w-[min(96vw,42rem)] max-w-[min(96vw,42rem)]",
          "max-h-[min(90dvh,36rem)]",
        )}
        onOpenAutoFocus={(ev) => ev.preventDefault()}
      >
        <DialogHeader className="px-6 sm:px-8 pt-5 pb-3 shrink-0 text-left border-b border-border">
          <DialogTitle>{isEditMode ? "Editar sanção disciplinar" : "Lançar sanção disciplinar"}</DialogTitle>
          <DialogDescription className="text-pretty leading-relaxed max-w-none">
            {isEditMode ? (
              <>
                Ajuste os campos e salve para gravar no banco. Mês e ano seguem a <strong>data da aplicação</strong>.
              </>
            ) : (
              <>
                Informe a <strong>data da aplicação</strong>, o <strong>colaborador</strong> (ativo no orgânico ou manual), o{" "}
                <strong>tipo</strong> de sanção e o <strong>motivo</strong>. Mês e ano seguem a data.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain px-6 sm:px-8 py-5 space-y-5">
            <div className="rounded-xl border border-border/90 bg-card/35 shadow-sm overflow-hidden">
              <header className="border-b border-border/80 bg-muted/50 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-foreground">
                Registro
              </header>
              <div className="p-4 sm:p-5 space-y-4">
                <div>
                  <Label htmlFor="san-data" className={lblForm}>
                    Data da aplicação<span className="text-destructive"> *</span>
                  </Label>
                  <Input
                    id="san-data"
                    type="date"
                    value={draft.dataAplicacao}
                    onChange={(e) => setField("dataAplicacao", e.target.value)}
                    className={dashedInput}
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-2">
                  <Label className={lblForm}>
                    Nome<span className="text-destructive"> *</span>
                  </Label>
                  <Popover open={colabOpen} onOpenChange={setColabOpen}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" role="combobox" aria-expanded={colabOpen} className={comboDashed}>
                        <span className="truncate text-left">
                          {colabSelection === MANUAL_KEY
                            ? "— Informar nome manualmente —"
                            : draft.nomeFuncionario.trim()
                              ? draft.nomeFuncionario
                              : colaboradoresAtivos.length
                                ? "Selecione um colaborador ativo…"
                                : "Nenhum ativo no orgânico — use manual"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[min(100vw-2rem,28rem)]"
                      align="start"
                    >
                      <Command
                        filter={(value, search) => commandFilterScore(value, search)}
                      >
                        <CommandInput placeholder="Buscar por nome ou matrícula…" className="h-9" />
                        <CommandList className="max-h-[min(50vh,16rem)]">
                          <CommandEmpty>Nenhum resultado.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="__manual__ manual"
                              onSelect={() => {
                                setColabSelection(MANUAL_KEY);
                                clearColaboradorCampos();
                                setColabOpen(false);
                              }}
                            >
                              — Informar nome manualmente —
                            </CommandItem>
                            {colaboradoresAtivos.map((entry) => (
                              <CommandItem
                                key={entry.id}
                                value={`${entry.colab.name} ${entry.colab.id}`}
                                onSelect={() => {
                                  applyOrganicoEntry(entry);
                                  setColabOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4 shrink-0",
                                    colabSelection === entry.id ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                <span className="truncate min-w-0">{entry.colab.name}</span>
                                <span className="ml-2 text-xs text-muted-foreground shrink-0 tabular-nums">
                                  {entry.colab.id}
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {colabSelection === MANUAL_KEY ? (
                    <Input
                      id="san-nome-manual"
                      value={draft.nomeFuncionario}
                      onChange={(e) => setField("nomeFuncionario", e.target.value)}
                      placeholder="Nome completo"
                      className={dashedInput}
                      autoComplete="name"
                    />
                  ) : null}
                </div>

                <div>
                  <Label htmlFor="san-id" className={lblForm}>
                    ID (matrícula)<span className="text-destructive"> *</span>
                  </Label>
                  <Input
                    id="san-id"
                    value={draft.matricula}
                    onChange={(e) => setField("matricula", e.target.value)}
                    readOnly={lockedFromOrganico}
                    className={cn(dashedInput, lockedFromOrganico && dashedInputRead)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="san-mes" className={lblForm}>
                      Mês
                    </Label>
                    <Input
                      id="san-mes"
                      readOnly
                      value={mesDisplay}
                      placeholder="—"
                      className={cn(dashedInput, dashedInputRead)}
                      tabIndex={-1}
                    />
                  </div>
                  <div>
                    <Label htmlFor="san-ano" className={lblForm}>
                      Ano
                    </Label>
                    <Input
                      id="san-ano"
                      readOnly
                      value={anoDisplay}
                      placeholder="—"
                      className={cn(dashedInput, dashedInputRead)}
                      tabIndex={-1}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="san-tipo" className={lblForm}>
                    Tipo de sanção<span className="text-destructive"> *</span>
                  </Label>
                  {useTipoLista ? (
                    <div className="space-y-2">
                      <Popover open={tipoOpen} onOpenChange={setTipoOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={tipoOpen}
                            className={comboDashed}
                          >
                            <span className="truncate text-left">
                              {tipoPick === TIPO_MANUAL_KEY
                                ? "— Digitar manualmente —"
                                : draft.tipo.trim()
                                  ? draft.tipo
                                  : "Selecione um tipo…"}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[min(100vw-2rem,28rem)]"
                          align="start"
                        >
                          <Command>
                            <CommandInput placeholder="Buscar tipo…" className="h-9" />
                            <CommandList className="max-h-[min(50vh,16rem)]">
                              <CommandEmpty>Nenhum resultado.</CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  value="__manual__ digitar"
                                  onSelect={() => {
                                    setTipoPick(TIPO_MANUAL_KEY);
                                    setField("tipo", "");
                                    setTipoOpen(false);
                                  }}
                                >
                                  — Digitar manualmente —
                                </CommandItem>
                                {tiposSancaoOptions.map((opt) => (
                                  <CommandItem
                                    key={opt}
                                    value={opt}
                                    onSelect={() => {
                                      setField("tipo", opt);
                                      setTipoPick(opt);
                                      setTipoOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4 shrink-0",
                                        draft.tipo === opt ? "opacity-100" : "opacity-0",
                                      )}
                                    />
                                    <span className="truncate min-w-0">{opt}</span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      {tipoPick === TIPO_MANUAL_KEY || (draft.tipo.trim() && !tiposSancaoOptions.includes(draft.tipo)) ? (
                        <Input
                          id="san-tipo"
                          value={draft.tipo}
                          onChange={(e) => {
                            setField("tipo", e.target.value);
                            if (e.target.value.trim()) setTipoPick(TIPO_MANUAL_KEY);
                          }}
                          placeholder="Digite o tipo de sanção…"
                          className={dashedInput}
                          autoComplete="off"
                        />
                      ) : null}
                    </div>
                  ) : (
                    <Input
                      id="san-tipo"
                      value={draft.tipo}
                      onChange={(e) => setField("tipo", e.target.value)}
                      placeholder="Ex.: Advertência verbal, suspensão…"
                      className={dashedInput}
                      autoComplete="off"
                    />
                  )}
                </div>

                <div>
                  <Label htmlFor="san-motivo" className={lblForm}>
                    Motivo
                    {requiresMotivo ? <span className="text-destructive"> *</span> : null}
                  </Label>
                  <Textarea
                    id="san-motivo"
                    value={draft.observacoes}
                    onChange={(e) => setField("observacoes", e.target.value)}
                    placeholder="Descreva o motivo da sanção…"
                    className={dashedTextarea}
                    rows={3}
                    required={requiresMotivo}
                  />
                </div>
              </div>
            </div>

            <LaunchDocumentAttachmentField
              visible={mostrarCampoAnexo}
              attachmentRequired={exigeAnexoDocumento}
              category={launchDocumentCategory}
              title={attachmentTitle}
              onTitleChange={setAttachmentTitle}
              file={attachmentFile}
              onFileChange={(nextFile) => {
                setAttachmentFile(nextFile);
                setAttachmentFileError(null);
              }}
              folderOptions={attachmentFolderOptions}
              folderSelection={attachmentFolder}
              onFolderChange={(selection) => {
                setAttachmentFolder(selection);
                setAttachmentFolderError(null);
              }}
              foldersLoading={loadingArchiveFolders}
              fileError={attachmentFileError}
              folderError={attachmentFolderError}
              disabled={saving || !matriculaArquivo}
            />
          </div>

          <DialogFooter className="px-6 sm:px-8 py-3 shrink-0 border-t border-border bg-muted/20 gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canEdit || saving || !formValid} className="bg-accent text-accent-foreground hover:bg-accent/90">
              {saving ? "Salvando…" : isEditMode ? "Salvar alterações" : "Salvar sanção"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
