import { useEffect, useState, useCallback, useMemo, useRef, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@rh/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@rh/components/ui/dialog";
import { Button } from "@rh/components/ui/button";
import { Checkbox } from "@rh/components/ui/checkbox";
import { Input } from "@rh/components/ui/input";
import { Textarea } from "@rh/components/ui/textarea";
import { Label } from "@rh/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@rh/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rh/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@rh/components/ui/command";
import type { Colaborador, FaltaRow, OrganicoRow, SancaoDisciplinarRow } from "@rh/types/api";
import { isLaunchDocTestMode } from "@rh/lib/launch-document-config";
import {
  ausenciaExigeAnexoDocumento,
  ausenciaExigeObservacoes,
  ausenciaPermiteAnexoOpcionalDocumento,
  buildLaunchDocumentTitle,
  pickDefaultLaunchFolderOption,
  resolveLaunchDocumentCategory,
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
import { isSuspensaoDisciplinarAusenciaTipo } from "@rh/pages/FaltasAtestados/sync-suspensao-ausencia-to-sancoes";
import {
  decodeAusenciaSuspensaoObservacoes,
  displayAusenciaObservacoesLista,
  encodeAusenciaSuspensaoObservacoes,
  extractAutoFaltaIdFromSancaoObservacoes,
  sanctionRowIsGeradaPelaAusencia,
  stripMarcaGeradaAusenciaMotivo,
} from "@rh/pages/FaltasAtestados/suspensao-ausencia-encoding";
import { organicoRowToColaborador, getStatusFromRow } from "@rh/pages/Organico/organico-derive";
import { ORGANICO_HEADERS } from "@rh/pages/Organico/organico-headers";
import { cn, randomUUID } from "@rh/lib/utils";
import { commandFilterScore } from "@rh/lib/normalize-search-text";
import type { AusenciaAlertaDetectado } from "@rh/lib/ausencia-inconsistencias/regras-catalogo";
import { getFaltasAlertaRegras, registrarAlertasAusencia } from "@rh/lib/ausencia-inconsistencias/faltas-alerta-storage";
import { validarAusenciaLancamento } from "@rh/lib/ausencia-inconsistencias/validar-ausencia";
import { getFaltasGruposSintomasCid } from "@rh/lib/grupos-sintomas-cid-storage";
import { getFaltasAtestadosHistoricoMatricula, isApiConfigured } from "@rh/lib/api-client";
import { useSavingOverlay } from "@rh/contexts/saving-overlay-context";

const MANUAL_KEY = "__manual__";
/** Valor sentinela no Radix Select (não pode ser string vazia). */
const SELECT_EMPTY = "__cadastro_vazio__";

function mesFaltaFromData(iso: string): string {
  const s = String(iso ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  try {
    return format(parseISO(s), "LLL.", { locale: ptBR });
  } catch {
    return "";
  }
}

function enderecoFromOrganicoValues(values: unknown[]): string {
  const idx = ORGANICO_HEADERS.findIndex((h) =>
    /endereço|endereco|bairro|logradouro|rua|residência|residencia|moradia|distrito/i.test(String(h).trim()),
  );
  if (idx < 0) return "";
  return values[idx] != null ? String(values[idx]).trim() : "";
}

/** Define como o campo quantidade é editado conforme o período (cadastro). */
function periodoQuantidadeMode(periodo: string): "horas" | "dias" | "livre" {
  const raw = String(periodo ?? "").trim();
  if (!raw) return "livre";
  const u = raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase();
  if (u.includes("INTEGRAL")) return "dias";
  if (u.includes("PARCIAL") && (u.includes("MANHA") || u.includes("TARDE"))) return "horas";
  return "livre";
}

function normalizeTipoTexto(tipo: string): string {
  return String(tipo ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase();
}

/** Advertências do cadastro (ex.: AD. VERBAL) — não devem aparecer no lançamento de suspensão na ausência. */
function tipoSancaoCadastroEhAdvertencia(valor: string): boolean {
  const u = normalizeTipoTexto(valor);
  if (u.includes("SUSPENS")) return false;
  if (u.includes("ADVERT")) return true;
  if (u.includes("VERBAL")) return true;
  if (u.includes("AD.") && u.includes("DISCIPLINAR")) return true;
  return false;
}

/** Atestado ou declaração: exige local e médico (comparação tolerante a acentos/caixa). */
function tipoExigeAtendimentoMedico(tipo: string): boolean {
  const u = normalizeTipoTexto(tipo);
  return u.includes("ATESTADO") || u.includes("DECLARACAO");
}

/** CID só para lançamentos de atestado (texto do cadastro pode ser "Atestado", "ATESTADO", etc.). */
function tipoEhAtestado(tipo: string): boolean {
  return normalizeTipoTexto(tipo).includes("ATESTADO");
}

function normalizeMatriculaFalta(value: unknown): string {
  const raw = String(value ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw.toLowerCase();
  return digits.replace(/^0+/, "").toLowerCase() || "0";
}

/** Data de aplicação que a sincronização gravaria na linha automática (alinhado a `faltaToAutoSancoReplace`). */
function resolverDataAplicacaoLinhaAutomaticaSancao(dataAusenciaIso: string, dataAplicacaoInformadaIso: string): string {
  const app = String(dataAplicacaoInformadaIso ?? "").trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(app)) return app;
  return String(dataAusenciaIso ?? "").trim().slice(0, 10);
}

function propagacaoSancoesFromFaltaRow(row: FaltaRow): boolean {
  if (!isSuspensaoDisciplinarAusenciaTipo(String(row.tipo ?? "").trim())) return false;
  const dec = decodeAusenciaSuspensaoObservacoes(String(row.observacoes ?? ""));
  if (dec) return dec.propagarParaSancoes;
  return true;
}

/**
 * Conflito com linha já existente em Sanções se esta ausência gerar automática com mesma matrícula e mesma data de aplicação.
 * Em edição, ignora a própria linha automática vinculada a esta falta.
 */
function encontrarSancoesConflitantesPropagacaoAusencia(
  todas: readonly SancaoDisciplinarRow[],
  cand: {
    matricula: string;
    /** Data yyyy-mm-dd que a nova linha automática usaria. */
    dataAplicacaoLinhaAutoIso: string;
    /** Id da falta em edição (exclui vínculo auto ⟦auto:falta:id⟧). */
    faltaIdExcluir?: string | null;
  },
): SancaoDisciplinarRow[] {
  const tm = normalizeMatriculaFalta(cand.matricula);
  const d = String(cand.dataAplicacaoLinhaAutoIso ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return [];
  const excluir = cand.faltaIdExcluir != null ? String(cand.faltaIdExcluir).trim() : "";

  return todas.filter((r) => {
    const dr = String(r.dataAplicacao ?? "").trim().slice(0, 10);
    if (normalizeMatriculaFalta(r.matricula) !== tm || dr !== d) return false;
    if (sanctionRowIsGeradaPelaAusencia(String(r.observacoes ?? "")) && excluir) {
      const linked = extractAutoFaltaIdFromSancaoObservacoes(String(r.observacoes ?? ""));
      if (linked === excluir) return false;
    }
    return true;
  });
}

function isQntdValid(qntd: string, mode: "horas" | "dias" | "livre"): boolean {
  const s = String(qntd ?? "").trim();
  if (!s) return false;
  if (mode === "livre") return true;
  const n = Number(s.replace(",", "."));
  return !Number.isNaN(n) && n > 0;
}

const lblForm = "text-xs font-medium text-muted-foreground mb-1.5 block";
const dashedInput =
  "flex h-9 w-full min-w-0 rounded-lg border border-dashed border-muted-foreground/35 bg-background px-3 text-sm shadow-none transition-colors placeholder:text-muted-foreground/65 file:mr-3 file:h-8 file:border-0 file:bg-transparent file:text-sm focus-visible:border-solid focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-60 md:text-sm";
const dashedInputRead = "cursor-not-allowed bg-muted/45 border-muted-foreground/25";
const dashedTextarea =
  "flex min-h-[104px] w-full resize-y rounded-lg border border-dashed border-muted-foreground/35 bg-background px-3 py-2.5 text-sm shadow-none transition-colors placeholder:text-muted-foreground/65 focus-visible:border-solid focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-60";
const dashedSelectTrigger =
  "h-9 w-full min-w-0 rounded-lg border border-dashed border-muted-foreground/35 bg-background shadow-none focus:ring-2 focus:ring-ring/25 focus:ring-offset-0 [&>span]:line-clamp-1";
const comboDashed =
  "h-9 w-full min-w-0 justify-between rounded-lg border border-dashed border-muted-foreground/35 bg-background font-normal text-sm shadow-none hover:bg-muted/35";

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border/90 bg-card/35 shadow-sm overflow-hidden">
      <header className="border-b border-border/80 bg-muted/50 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-foreground">
        {title}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function emptyDraft(): Omit<FaltaRow, "id"> {
  return {
    data: "",
    mesFalta: "",
    matricula: "",
    nomeFuncionario: "",
    endereco: "",
    area: "",
    setor: "",
    lider: "",
    periodo: "",
    qntd: "",
    diasTurno: "",
    tipo: "",
    cid: "",
    localAtendimento: "",
    medicoResponsavel: "",
    observacoes: "",
    aprovado: "",
    reprovado: "",
  };
}

function draftFromRow(row: FaltaRow): Omit<FaltaRow, "id"> {
  const b = emptyDraft();
  return {
    ...b,
    data: String(row.data ?? "").trim().slice(0, 10),
    mesFalta: String(row.mesFalta ?? "").trim(),
    matricula: String(row.matricula ?? "").trim(),
    nomeFuncionario: String(row.nomeFuncionario ?? "").trim(),
    endereco: String(row.endereco ?? "").trim(),
    area: String(row.area ?? "").trim(),
    setor: String(row.setor ?? "").trim(),
    lider: String(row.lider ?? "").trim(),
    periodo: String(row.periodo ?? "").trim(),
    qntd: String(row.qntd ?? "").trim(),
    diasTurno: String(row.diasTurno ?? "").trim(),
    tipo: String(row.tipo ?? "").trim(),
    cid: String(row.cid ?? "").trim(),
    localAtendimento: String(row.localAtendimento ?? "").trim(),
    medicoResponsavel: String(row.medicoResponsavel ?? "").trim(),
    observacoes: String(row.observacoes ?? "").trim(),
    aprovado: String(row.aprovado ?? "").trim(),
    reprovado: String(row.reprovado ?? "").trim(),
  };
}

type ColabEntry = { id: string; row: OrganicoRow; colab: Colaborador };

function CadastroSelect({
  id,
  label,
  value,
  onChange,
  options,
  wide,
  className,
  labelRequired,
  triggerClassName,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  wide?: boolean;
  /** Classes da célula no grid (ex.: col-span). */
  className?: string;
  labelRequired?: boolean;
  triggerClassName?: string;
}) {
  const unique = useMemo(() => {
    const s = new Set<string>();
    for (const o of options) {
      const t = String(o).trim();
      if (t) s.add(t);
    }
    return [...s].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  }, [options]);

  const trimmed = value.trim();
  const orphan = trimmed && !unique.includes(trimmed);
  const selectValue = trimmed ? trimmed : SELECT_EMPTY;

  return (
    <div className={cn(wide && "sm:col-span-2", className)}>
      <Label htmlFor={id} className={lblForm}>
        {label}
        {labelRequired ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Select
        value={selectValue}
        onValueChange={(v) => onChange(v === SELECT_EMPTY ? "" : v)}
      >
        <SelectTrigger id={id} className={cn("h-9 text-sm font-normal", triggerClassName)}>
          <SelectValue placeholder="Selecione…" />
        </SelectTrigger>
        <SelectContent position="popper" className="max-h-[min(50vh,18rem)] w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)]">
          <SelectItem value={SELECT_EMPTY} className="text-muted-foreground">
            (Vazio)
          </SelectItem>
          {orphan ? (
            <SelectItem value={trimmed} className="whitespace-normal break-words py-2">
              {trimmed}
            </SelectItem>
          ) : null}
          {unique.map((opt) => (
            <SelectItem
              key={opt}
              value={opt}
              className="whitespace-normal break-words py-2 pr-6 [&>span]:line-clamp-none"
            >
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function CadastroSearchSelect({
  id,
  label,
  value,
  onChange,
  options,
  className,
  labelRequired,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  className?: string;
  labelRequired?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const unique = useMemo(() => {
    const s = new Set<string>();
    for (const o of options) {
      const t = String(o).trim();
      if (t) s.add(t);
    }
    return [...s].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  }, [options]);

  return (
    <div className={className}>
      <Label htmlFor={id} className={lblForm}>
        {label}
        {labelRequired ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={comboDashed}
          >
            <span className="truncate text-left">{value.trim() || "Selecione o CID..."}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[min(100vw-2rem,44rem)]"
          align="start"
        >
          <Command
            filter={(itemValue, search) => commandFilterScore(itemValue, search)}
          >
            <CommandInput placeholder="Pesquisar CID..." className="h-9" />
            <CommandList className="max-h-[min(52vh,18rem)]">
              <CommandEmpty>Nenhum CID encontrado.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="(Vazio)"
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4 shrink-0", !value.trim() ? "opacity-100" : "opacity-0")} />
                  (Vazio)
                </CommandItem>
                {unique.map((opt) => (
                  <CommandItem
                    key={opt}
                    value={opt}
                    onSelect={(selected) => {
                      onChange(selected);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4 shrink-0", value.trim() === opt ? "opacity-100" : "opacity-0")} />
                    <span className="whitespace-normal break-words">{opt}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (row: FaltaRow) => Promise<void>;
  canEdit?: boolean;
  organicoRows: OrganicoRow[];
  /** Endereço por matrícula (API Secullum: Endereco + Bairro) */
  enderecoByMatricula?: Record<string, string>;
  /** Valores dos cadastros (mesmas listas da grade / datalists). */
  periodoOptions: string[];
  tipoOptions: string[];
  cidOptions: string[];
  /** Tipos de sanção cadastrados (aba Cadastros) — obrigatório para Suspensão disciplinar. */
  tiposSancoesOpcoes?: string[];
  /** Linhas já carregadas (ex.: vista atual) para avisar duplicidade mesmo dia/colaborador. */
  getAusenciasParaChecagemDuplicata?: () => FaltaRow[];
  /** Linhas de sanções já carregadas para avisar se propagar criaria segunda linha na mesma matrícula e data efetiva. */
  todasSancoesDisciplinares?: SancaoDisciplinarRow[];
  /** Enquanto a lista acima está a carregar, não gravar com propagação (evita falso negativo na duplicidade). */
  todasSancoesDisciplinaresLoading?: boolean;
  /** Se definido, o formulário abre em modo edição e preserva o `id` ao salvar. */
  initialRow?: FaltaRow | null;
  /** Categorias de documentos (cadastro) para anexo automático no Orgânico. */
  documentCategoryOptions?: string[];
  /** Após registrar alertas de regras, navegar para guia de inconsistências. */
  onAlertasRegistrados?: (count: number) => void;
};

export function LancarAusenciaDialog({
  open,
  onOpenChange,
  onSave,
  canEdit = true,
  organicoRows,
  enderecoByMatricula = {},
  periodoOptions,
  tipoOptions,
  cidOptions,
  tiposSancoesOpcoes = [],
  todasSancoesDisciplinares = [],
  todasSancoesDisciplinaresLoading = false,
  getAusenciasParaChecagemDuplicata,
  initialRow = null,
  documentCategoryOptions = [],
  onAlertasRegistrados,
}: Props) {
  const { toast } = useToast();
  const { runWithSaving } = useSavingOverlay();
  const [draft, setDraft] = useState<Omit<FaltaRow, "id">>(() => emptyDraft());
  const [editingId, setEditingId] = useState<FaltaRow["id"] | null>(null);
  const [saving, setSaving] = useState(false);
  const [colabOpen, setColabOpen] = useState(false);
  const [colabSelection, setColabSelection] = useState<string | null>(null);
  const [tipoSancaoSuspensao, setTipoSancaoSuspensao] = useState("");
  const [motivoSuspensao, setMotivoSuspensao] = useState("");
  const [dataAplicacaoSuspensao, setDataAplicacaoSuspensao] = useState("");
  const [propagarParaAbaSancoes, setPropagarParaAbaSancoes] = useState(true);
  const [dupManualPropagacaoOpen, setDupManualPropagacaoOpen] = useState(false);
  const [dupManualPropagacaoLista, setDupManualPropagacaoLista] = useState<SancaoDisciplinarRow[]>([]);
  /** No aviso de conflito: por defeito manter também Sanções ao sincronizar; desmarcar para não criar nova linha. */
  const [modalPropagarMesmoComConflito, setModalPropagarMesmoComConflito] = useState(true);
  const [dupSuspOpen, setDupSuspOpen] = useState(false);
  const [dupRowsAlerta, setDupRowsAlerta] = useState<FaltaRow[]>([]);
  /** Linha a gravar após confirmar duplicidade (preserva id temporário / edição). */
  const [linhaDupPendente, setLinhaDupPendente] = useState<FaltaRow | null>(null);
  /** Evita `onOpenChange` limpar a linha pendente antes do `onClick` de confirmar (Radix). */
  const confirmandoSalvarDupRef = useRef(false);
  /** ID estável para novo lançamento — evita UUID diferente a cada montarLinhaFalta (duplo clique). */
  const pendingNewRowIdRef = useRef<string | null>(null);
  const prevAttachmentTipoRef = useRef<string | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentTitle, setAttachmentTitle] = useState("");
  const [attachmentFolder, setAttachmentFolder] = useState<LaunchDocumentFolderSelection | null>(null);
  const [attachmentFileError, setAttachmentFileError] = useState<string | null>(null);
  const [attachmentFolderError, setAttachmentFolderError] = useState<string | null>(null);
  const [alertasOpen, setAlertasOpen] = useState(false);
  const [alertasPendentes, setAlertasPendentes] = useState<AusenciaAlertaDetectado[]>([]);
  const [linhaAlertaPendente, setLinhaAlertaPendente] = useState<FaltaRow | null>(null);
  const confirmandoSalvarAlertasRef = useRef(false);

  const { data: regrasAlerta = [] } = useQuery({
    queryKey: ["faltas-alerta-regras"],
    queryFn: getFaltasAlertaRegras,
    enabled: open,
  });
  const { data: gruposSintomas = [] } = useQuery({
    queryKey: ["faltas-grupos-sintomas"],
    queryFn: getFaltasGruposSintomasCid,
    enabled: open,
  });
  const matriculaArquivo = String(draft.matricula ?? "").trim();
  const nomeArquivo = String(draft.nomeFuncionario ?? "").trim();

  const isNewLaunch = editingId == null || String(editingId).startsWith("temp-");
  const exigeObservacoesAusencia = useMemo(
    () => ausenciaExigeObservacoes(String(draft.tipo ?? "")),
    [draft.tipo],
  );
  const exigeAnexoDocumento = useMemo(
    () => isLaunchDocAttachmentEnabled() && isNewLaunch && ausenciaExigeAnexoDocumento(String(draft.tipo ?? "")),
    [draft.tipo, isNewLaunch],
  );
  const permiteAnexoOpcional = useMemo(
    () =>
      isLaunchDocAttachmentEnabled()
      && isNewLaunch
      && ausenciaPermiteAnexoOpcionalDocumento(String(draft.tipo ?? "")),
    [draft.tipo, isNewLaunch],
  );
  const mostrarCampoAnexo = exigeAnexoDocumento || permiteAnexoOpcional;
  const launchDocumentCategory = useMemo(
    () =>
      resolveLaunchDocumentCategory({
        source: "ausencia",
        tipo: String(draft.tipo ?? ""),
        categoryOptions: documentCategoryOptions,
      }),
    [draft.tipo, documentCategoryOptions],
  );
  const suggestedAttachmentTitle = useMemo(
    () =>
      buildLaunchDocumentTitle({
        category: launchDocumentCategory,
        dataIso: String(draft.data ?? ""),
        colaboradorNome: String(draft.nomeFuncionario ?? ""),
      }),
    [launchDocumentCategory, draft.data, draft.nomeFuncionario],
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

  const colaboradoresDisponiveis = useMemo(() => {
    const out: ColabEntry[] = [];
    for (const row of organicoRows) {
      const values = Array.isArray(row.values) ? row.values : [];
      // Permite vínculo para Ativo/Férias/Afastado.
      // Mantemos apenas "Desligado" fora do autocomplete de ausência.
      if (getStatusFromRow(values) === "Desligado") continue;
      const colab = organicoRowToColaborador(row);
      if (!colab) continue;
      out.push({ id: String(row.id), row, colab });
    }
    out.sort((a, b) => a.colab.name.localeCompare(b.colab.name, "pt-BR", { sensitivity: "base" }));
    return out;
  }, [organicoRows]);

  const lockedFromOrganico = Boolean(colabSelection && colabSelection !== MANUAL_KEY);

  const mesFaltaDisplay = mesFaltaFromData(draft.data);
  const isEditMode = editingId != null;

  useEffect(() => {
    if (!open) return;
    setSaving(false);
    setColabOpen(false);
    setModalPropagarMesmoComConflito(true);
    setDupManualPropagacaoOpen(false);
    setDupManualPropagacaoLista([]);
    setDupSuspOpen(false);
    setDupRowsAlerta([]);
    setLinhaDupPendente(null);
    setAttachmentFile(null);
    setAttachmentFileError(null);
    setAttachmentTitle("");
    setAttachmentFolder(null);
    setAttachmentFolderError(null);
    prevAttachmentTipoRef.current = null;
    if (initialRow) {
      const dRow = draftFromRow(initialRow);
      setDraft(dRow);
      setEditingId(initialRow.id);
      pendingNewRowIdRef.current = null;
      if (isSuspensaoDisciplinarAusenciaTipo(String(initialRow.tipo ?? "").trim())) {
        const decoded = decodeAusenciaSuspensaoObservacoes(String(initialRow.observacoes ?? ""));
        const dataAus = String(initialRow.data ?? "").trim().slice(0, 10);
        if (decoded) {
          setTipoSancaoSuspensao(decoded.tipoCadastro);
          setMotivoSuspensao(decoded.motivo);
          const app = decoded.dataAplicacaoSancaoIso?.trim().slice(0, 10) ?? "";
          setDataAplicacaoSuspensao(/^\d{4}-\d{2}-\d{2}$/.test(app) ? app : dataAus);
          setPropagarParaAbaSancoes(decoded.propagarParaSancoes);
        } else {
          setTipoSancaoSuspensao("");
          setMotivoSuspensao(String(initialRow.observacoes ?? "").trim());
          setDataAplicacaoSuspensao(dataAus);
          setPropagarParaAbaSancoes(true);
        }
      } else {
        setTipoSancaoSuspensao("");
        setMotivoSuspensao("");
        setDataAplicacaoSuspensao("");
        setPropagarParaAbaSancoes(true);
      }
    } else {
      setDraft(emptyDraft());
      setEditingId(null);
      pendingNewRowIdRef.current = randomUUID();
      setColabSelection(null);
      setTipoSancaoSuspensao("");
      setMotivoSuspensao("");
      setDataAplicacaoSuspensao("");
      setPropagarParaAbaSancoes(true);
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
    const entry = colaboradoresDisponiveis.find((e) => String(e.colab.id).trim() === mat);
    setColabSelection(entry ? entry.id : MANUAL_KEY);
  }, [open, initialRow, colaboradoresDisponiveis]);

  const setField = useCallback((key: keyof Omit<FaltaRow, "id">, value: string) => {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "data") {
        next.mesFalta = mesFaltaFromData(value);
      }
      if (key === "periodo") {
        const prevMode = periodoQuantidadeMode(prev.periodo);
        const nextMode = periodoQuantidadeMode(value);
        if (prevMode !== nextMode) next.qntd = "";
      }
      if (key === "tipo") {
        if (!tipoExigeAtendimentoMedico(value)) {
          next.localAtendimento = "";
          next.medicoResponsavel = "";
        }
        if (!tipoEhAtestado(value)) {
          next.cid = "";
        }
        const novo = String(value ?? "").trim();
        const eraSuspen = isSuspensaoDisciplinarAusenciaTipo(prev.tipo);
        const seraSuspen = isSuspensaoDisciplinarAusenciaTipo(novo);
        if (eraSuspen && !seraSuspen) {
          const decObs = decodeAusenciaSuspensaoObservacoes(String(prev.observacoes ?? ""));
          next.observacoes = decObs ? decObs.motivo : String(prev.observacoes ?? "");
        }
        window.setTimeout(() => {
          if (!isSuspensaoDisciplinarAusenciaTipo(novo)) {
            setTipoSancaoSuspensao("");
            setMotivoSuspensao("");
            setDataAplicacaoSuspensao("");
            setPropagarParaAbaSancoes(true);
          }
        }, 0);
      }
      return next;
    });
  }, []);

  const applyOrganicoEntry = useCallback((entry: ColabEntry) => {
    const { row, colab } = entry;
    const values = Array.isArray(row.values) ? row.values : [];
    const enderecoSecullum = enderecoByMatricula[String(colab.id).trim()];
    const endereco = enderecoSecullum ?? enderecoFromOrganicoValues(values);
    setDraft((prev) => ({
      ...prev,
      matricula: colab.id,
      nomeFuncionario: colab.name,
      area: colab.area ?? "",
      setor: colab.setor ?? "",
      lider: colab.gestorImediato ?? "",
      endereco,
    }));
    setColabSelection(entry.id);
  }, [enderecoByMatricula]);

  const clearColaboradorCampos = useCallback(() => {
    setDraft((prev) => ({
      ...prev,
      matricula: "",
      nomeFuncionario: "",
      area: "",
      setor: "",
      lider: "",
      endereco: "",
    }));
  }, []);

  const qntdMode = periodoQuantidadeMode(draft.periodo);
  const qntdLabel =
    qntdMode === "horas" ? "Quantidade (horas)" : qntdMode === "dias" ? "Quantidade (dias)" : "Quantidade";
  const showAtendimento = tipoExigeAtendimentoMedico(draft.tipo);
  const showCid = tipoEhAtestado(draft.tipo);
  const ausenciaEhSuspensa = useMemo(
    () => isSuspensaoDisciplinarAusenciaTipo(String(draft.tipo ?? "").trim()),
    [draft.tipo],
  );
  const tiposSancoesOrdenados = useMemo(() => {
    const s = new Set<string>();
    for (const x of tiposSancoesOpcoes ?? []) {
      const v = String(x ?? "").trim();
      if (v && !tipoSancaoCadastroEhAdvertencia(v)) s.add(v);
    }
    return [...s].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  }, [tiposSancoesOpcoes]);

  const formValid = useMemo(() => {
    if (!String(draft.data ?? "").trim()) return false;
    if (!String(draft.nomeFuncionario ?? "").trim()) return false;
    if (!String(draft.matricula ?? "").trim()) return false;
    if (!String(draft.endereco ?? "").trim()) return false;
    if (!String(draft.area ?? "").trim()) return false;
    if (!String(draft.setor ?? "").trim()) return false;
    if (!String(draft.lider ?? "").trim()) return false;
    if (!String(draft.periodo ?? "").trim()) return false;
    if (!isQntdValid(draft.qntd, qntdMode)) return false;
    if (!String(draft.tipo ?? "").trim()) return false;
    if (showCid && !String(draft.cid ?? "").trim()) return false;
    if (showAtendimento) {
      if (!String(draft.localAtendimento ?? "").trim()) return false;
      if (!String(draft.medicoResponsavel ?? "").trim()) return false;
    }
    if (ausenciaEhSuspensa) {
      if (tiposSancoesOrdenados.length === 0) return false;
      const ts = String(tipoSancaoSuspensao ?? "").trim();
      if (!ts || tipoSancaoCadastroEhAdvertencia(ts)) return false;
      if (!String(motivoSuspensao ?? "").trim()) return false;
      const dSan = String(dataAplicacaoSuspensao ?? "").trim().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dSan)) return false;
      if (propagarParaAbaSancoes && todasSancoesDisciplinaresLoading) return false;
    }
    if (exigeObservacoesAusencia && !String(draft.observacoes ?? "").trim()) return false;
    if (exigeAnexoDocumento) {
      if (!attachmentFile) return false;
      if (!String(attachmentTitle ?? "").trim()) return false;
      if (!attachmentFolder?.id) return false;
    }
    if (permiteAnexoOpcional && attachmentFile) {
      if (!String(attachmentTitle ?? "").trim()) return false;
      if (!attachmentFolder?.id) return false;
    }
    return true;
  }, [
    draft,
    qntdMode,
    showAtendimento,
    showCid,
    ausenciaEhSuspensa,
    tiposSancoesOrdenados.length,
    tipoSancaoSuspensao,
    motivoSuspensao,
    dataAplicacaoSuspensao,
    propagarParaAbaSancoes,
    todasSancoesDisciplinaresLoading,
    exigeObservacoesAusencia,
    exigeAnexoDocumento,
    permiteAnexoOpcional,
    attachmentFile,
    attachmentTitle,
    attachmentFolder,
  ]);

  /** Preenche a data da aplicação quando o tipo vira suspensão e o campo ainda está vazio. */
  useEffect(() => {
    if (!open || !ausenciaEhSuspensa) return;
    const d = String(draft.data ?? "").trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
    setDataAplicacaoSuspensao((prev) => (String(prev ?? "").trim() ? prev : d));
  }, [open, ausenciaEhSuspensa, draft.data]);

  /** Remove tipo de advertência selecionado (incompatível com ausência de suspensão). */
  useEffect(() => {
    if (!open || !ausenciaEhSuspensa) return;
    const cur = String(tipoSancaoSuspensao ?? "").trim();
    if (cur && tipoSancaoCadastroEhAdvertencia(cur)) setTipoSancaoSuspensao("");
  }, [open, ausenciaEhSuspensa, tipoSancaoSuspensao]);

  const montarLinhaFalta = useCallback(
    (overrides?: { propagarParaSancoes?: boolean }): FaltaRow => {
    const propagarCodificado = overrides?.propagarParaSancoes ?? propagarParaAbaSancoes;
    const dataVal = String(draft.data ?? "").trim();
    const nomeVal = String(draft.nomeFuncionario ?? "").trim();
    const mes = mesFaltaFromData(dataVal);
    const exigeMed = tipoExigeAtendimentoMedico(draft.tipo);
    const exigeCid = tipoEhAtestado(draft.tipo);
    const ehSuspensa = isSuspensaoDisciplinarAusenciaTipo(String(draft.tipo ?? "").trim());
    const observFinal = ehSuspensa
      ? encodeAusenciaSuspensaoObservacoes(String(tipoSancaoSuspensao ?? "").trim(), String(motivoSuspensao ?? "").trim(), {
          dataAplicacaoIso: String(dataAplicacaoSuspensao ?? "").trim().slice(0, 10),
          propagarParaSancoes: propagarCodificado,
        })
      : String(draft.observacoes ?? "").trim();
    return {
      id: editingId ?? pendingNewRowIdRef.current ?? randomUUID(),
      ...draft,
      data: dataVal,
      mesFalta: mes,
      nomeFuncionario: nomeVal,
      diasTurno: "",
      cid: exigeCid ? String(draft.cid ?? "").trim() : "",
      localAtendimento: exigeMed ? String(draft.localAtendimento ?? "").trim() : "",
      medicoResponsavel: exigeMed ? String(draft.medicoResponsavel ?? "").trim() : "",
      observacoes: observFinal,
    };
  },
  [
    draft,
    editingId,
    tipoSancaoSuspensao,
    motivoSuspensao,
    dataAplicacaoSuspensao,
    propagarParaAbaSancoes,
  ],
  );

  const encontrasOutrasSuspensoesMesmoDia = useCallback(
    (linha: FaltaRow): FaltaRow[] => {
      const fn = getAusenciasParaChecagemDuplicata;
      if (
        !fn ||
        !isSuspensaoDisciplinarAusenciaTipo(String(linha.tipo ?? "").trim())
      )
        return [];
      const dIso = String(linha.data ?? "").trim().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dIso)) return [];
      const mNorm = normalizeMatriculaFalta(linha.matricula);
      const idCand = String(linha.id);
      return fn().filter((r) => {
        if (String(r.id) === idCand) return false;
        if (!isSuspensaoDisciplinarAusenciaTipo(String(r.tipo ?? "").trim()))
          return false;
        const dr = String(r.data ?? "").trim().slice(0, 10);
        if (dr !== dIso) return false;
        return normalizeMatriculaFalta(r.matricula) === mNorm;
      });
    },
    [getAusenciasParaChecagemDuplicata],
  );

  const enviarAusenciaAoPai = useCallback(
    async (row: FaltaRow, alertasParaRegistrar?: AusenciaAlertaDetectado[]) => {
      setSaving(true);
      try {
        if (exigeAnexoDocumento) {
          if (!attachmentFile) {
            setAttachmentFileError("Anexe o documento (atestado ou comprovante) para concluir o lançamento.");
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
          await onSave(row);

          if (alertasParaRegistrar?.length) {
            await registrarAlertasAusencia({ linha: row, alertas: alertasParaRegistrar });
            onAlertasRegistrados?.(alertasParaRegistrar.length);
          }

          const devePersistirAnexo =
            attachmentFile
            && attachmentFolder?.id
            && (exigeAnexoDocumento || permiteAnexoOpcional);

          if (devePersistirAnexo) {
            await persistLaunchDocumentAttachment({
              file: attachmentFile,
              matricula: String(row.matricula ?? "").trim(),
              colaboradorNome: String(row.nomeFuncionario ?? "").trim(),
              category: launchDocumentCategory,
              title: String(attachmentTitle ?? "").trim() || suggestedAttachmentTitle,
              source: "ausencia",
              sourceTipo: String(row.tipo ?? "").trim(),
              sourceTempId: String(row.id),
              folderId: attachmentFolder.id,
              folderScope: attachmentFolder.scope,
            });
            if (isLaunchDocTestMode()) {
              toast({
                title: "Ausência e anexo salvos (teste)",
                description: "Registro local e documento na pasta escolhida do colaborador.",
              });
            } else {
              toast({
                title: "Ausência salva",
                description: "Registro gravado e anexo arquivado na pasta do colaborador.",
              });
            }
          }
        }, isEditMode ? "Atualizando ausência…" : "Salvando ausência…");

        setLinhaDupPendente(null);
        setDupRowsAlerta([]);
        setLinhaAlertaPendente(null);
        setAlertasPendentes([]);
        onOpenChange(false);
      } catch (error) {
        if (exigeAnexoDocumento || (permiteAnexoOpcional && attachmentFile)) {
          setAttachmentFileError(error instanceof Error ? error.message : "Falha ao concluir o lançamento.");
        }
        /* toast no pai */
      } finally {
        setSaving(false);
      }
    },
    [
      attachmentFile,
      attachmentTitle,
      attachmentFolder,
      exigeAnexoDocumento,
      permiteAnexoOpcional,
      launchDocumentCategory,
      onOpenChange,
      onSave,
      onAlertasRegistrados,
      suggestedAttachmentTitle,
      toast,
      runWithSaving,
      isEditMode,
    ],
  );

  const executarGravacaoAusencia = useCallback(
    async (opts?: {
      ignorarChecagemDupDiaSuspensao?: boolean;
      linhaPreMontada?: FaltaRow;
      ignorarChecagemConflitoPropagacaoSancoes?: boolean;
      ignorarChecagemAlertas?: boolean;
      alertasPreConfirmados?: AusenciaAlertaDetectado[];
    }) => {
      if (!canEdit) return;
      if (saving) return;
      if (!opts?.linhaPreMontada && !formValid) return;

      const row = opts?.linhaPreMontada ?? montarLinhaFalta();
      const propagarCodificado = propagacaoSancoesFromFaltaRow(row);

      if (ausenciaEhSuspensa && propagarCodificado && todasSancoesDisciplinaresLoading && !opts?.linhaPreMontada) {
        return;
      }

      if (
        !opts?.ignorarChecagemConflitoPropagacaoSancoes &&
        ausenciaEhSuspensa &&
        propagarCodificado &&
        !todasSancoesDisciplinaresLoading
      ) {
        const dataLinhaAuto = resolverDataAplicacaoLinhaAutomaticaSancao(
          String(draft.data ?? "").trim().slice(0, 10),
          String(dataAplicacaoSuspensao ?? "").trim().slice(0, 10),
        );
        const coincide = encontrarSancoesConflitantesPropagacaoAusencia(todasSancoesDisciplinares, {
          matricula: row.matricula,
          dataAplicacaoLinhaAutoIso: dataLinhaAuto,
          faltaIdExcluir: editingId != null ? String(editingId) : null,
        });
        if (coincide.length > 0) {
          setModalPropagarMesmoComConflito(true);
          setDupManualPropagacaoLista(coincide);
          setDupManualPropagacaoOpen(true);
          return;
        }
      }

      if (
        !opts?.ignorarChecagemDupDiaSuspensao &&
        ausenciaEhSuspensa &&
        getAusenciasParaChecagemDuplicata
      ) {
        const dup = encontrasOutrasSuspensoesMesmoDia(row);
        if (dup.length > 0) {
          setLinhaDupPendente(row);
          setDupRowsAlerta(dup);
          setDupSuspOpen(true);
          return;
        }
      }

      if (!opts?.ignorarChecagemAlertas && !opts?.alertasPreConfirmados) {
        const localHistorico = getAusenciasParaChecagemDuplicata?.() ?? [];
        let historico = localHistorico;
        if (isApiConfigured()) {
          const matricula = String(row.matricula ?? "").trim();
          const refIso = String(row.data ?? "").trim().slice(0, 10);
          if (matricula && /^\d{4}-\d{2}-\d{2}$/.test(refIso)) {
            try {
              const ref = parseISO(refIso);
              const desde = format(subMonths(ref, 12), "yyyy-MM-dd");
              const remoto = await getFaltasAtestadosHistoricoMatricula(matricula, desde, refIso);
              const byId = new Map<string, FaltaRow>();
              for (const r of [...localHistorico, ...remoto]) {
                byId.set(String(r.id), r);
              }
              historico = [...byId.values()];
            } catch {
              historico = localHistorico;
            }
          }
        }
        const alertas = validarAusenciaLancamento({
          linha: row,
          historico,
          regras: regrasAlerta,
          gruposSintomas,
        });
        if (alertas.length > 0) {
          setLinhaAlertaPendente(row);
          setAlertasPendentes(alertas);
          setAlertasOpen(true);
          return;
        }
      }

      await enviarAusenciaAoPai(row, opts?.alertasPreConfirmados);
    },
    [
      canEdit,
      formValid,
      montarLinhaFalta,
      ausenciaEhSuspensa,
      draft.data,
      dataAplicacaoSuspensao,
      todasSancoesDisciplinares,
      todasSancoesDisciplinaresLoading,
      editingId,
      getAusenciasParaChecagemDuplicata,
      encontrasOutrasSuspensoesMesmoDia,
      enviarAusenciaAoPai,
      regrasAlerta,
      gruposSintomas,
      saving,
    ],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    void executarGravacaoAusencia();
  };

  const confirmarSalvarComDuplicidade = async () => {
    if (confirmandoSalvarDupRef.current || saving) return;
    confirmandoSalvarDupRef.current = true;
    const row = linhaDupPendente ?? montarLinhaFalta();
    setLinhaDupPendente(null);
    setDupRowsAlerta([]);
    setDupSuspOpen(false);
    try {
      await executarGravacaoAusencia({
        ignorarChecagemDupDiaSuspensao: true,
        ignorarChecagemConflitoPropagacaoSancoes: true,
        linhaPreMontada: row,
      });
    } finally {
      confirmandoSalvarDupRef.current = false;
    }
  };

  const onAlertasDialogOpenChange = (next: boolean) => {
    setAlertasOpen(next);
    if (!next && !confirmandoSalvarAlertasRef.current) {
      setLinhaAlertaPendente(null);
      setAlertasPendentes([]);
    }
  };

  const confirmarSalvarComAlertas = async () => {
    if (confirmandoSalvarAlertasRef.current || saving) return;
    confirmandoSalvarAlertasRef.current = true;
    const row = linhaAlertaPendente ?? montarLinhaFalta();
    const alertas = [...alertasPendentes];
    setAlertasOpen(false);
    setLinhaAlertaPendente(null);
    setAlertasPendentes([]);
    try {
      await executarGravacaoAusencia({
        ignorarChecagemAlertas: true,
        alertasPreConfirmados: alertas,
        linhaPreMontada: row,
      });
      if (alertas.length > 0) {
        toast({
          title: `${alertas.length} alerta(s) registrado(s)`,
          description: "As inconsistências foram registradas para análise do RH.",
        });
      }
    } finally {
      confirmandoSalvarAlertasRef.current = false;
    }
  };

  const confirmarDecisaoConflitoPropagacaoSancoes = useCallback(() => {
    const escolha = modalPropagarMesmoComConflito;
    setPropagarParaAbaSancoes(escolha);
    const rowMontada = montarLinhaFalta({ propagarParaSancoes: escolha });
    setDupManualPropagacaoOpen(false);
    setDupManualPropagacaoLista([]);
    queueMicrotask(() => {
      void executarGravacaoAusencia({
        ignorarChecagemConflitoPropagacaoSancoes: true,
        linhaPreMontada: rowMontada,
      });
    });
  }, [modalPropagarMesmoComConflito, montarLinhaFalta, executarGravacaoAusencia]);

  const onDupManualPropagacaoOpenChange = (next: boolean) => {
    setDupManualPropagacaoOpen(next);
    if (!next) {
      setDupManualPropagacaoLista([]);
      setModalPropagarMesmoComConflito(true);
    }
  };

  const onDupSuspAlertOpenChange = (nextOpen: boolean) => {
    setDupSuspOpen(nextOpen);
    if (!nextOpen && !confirmandoSalvarDupRef.current) {
      setLinhaDupPendente(null);
      setDupRowsAlerta([]);
    }
  };

  return (
    <>
      <AlertDialog open={dupManualPropagacaoOpen} onOpenChange={onDupManualPropagacaoOpenChange}>
        <AlertDialogContent className="sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Atenção ao lançamento em Sanções</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-sm text-muted-foreground">
                <div className="rounded-lg border border-border bg-muted/40 px-3.5 py-3 text-left">
                  <p className="text-foreground leading-relaxed">
                    Foi identificado <strong>um registro</strong> em <strong>Sanções disciplinares</strong> com as mesmas
                    referências que este lançamento usaria (<strong>mesmo colaborador</strong> e <strong>mesma data</strong>).
                  </p>
                  <p className="mt-2.5 text-foreground leading-relaxed">
                    Deseja <strong className="font-semibold">também</strong> gravar na aba{" "}
                    <span className="font-medium">Sanções</span>, ou <strong className="font-semibold">apenas</strong> em{" "}
                    <span className="font-medium">Faltas e atestados</span>?
                  </p>
                </div>

                <div className="rounded-lg border border-dashed border-amber-500/55 bg-amber-500/10 px-3.5 py-3 text-left">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-950 dark:text-amber-100">
                    Como não lançar em Sanções
                  </p>
                  <p className="mt-1.5 text-sm text-foreground/90 leading-relaxed">
                    <strong className="text-foreground font-semibold">Desmarque</strong> a opção seguinte antes de clicar em{" "}
                    <strong className="text-foreground font-semibold">Guardar.</strong>
                  </p>
                </div>

                {dupManualPropagacaoLista.length > 0 ? (
                  <div className="rounded-lg border-2 border-primary/35 bg-primary/5 px-3.5 py-3 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2.5">Registro já existente</p>
                    <ul className="space-y-3 list-none pl-0 m-0">
                      {dupManualPropagacaoLista.map((r) => {
                        const iso = String(r.dataAplicacao ?? "").trim().slice(0, 10);
                        let dataBr = iso;
                        try {
                          if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
                            dataBr = format(parseISO(iso), "dd/MM/yyyy", { locale: ptBR });
                          }
                        } catch {
                          /* manter texto */
                        }
                        const mv = stripMarcaGeradaAusenciaMotivo(String(r.observacoes ?? "")).trim();
                        const mvC = mv.length > 180 ? `${mv.slice(0, 177)}…` : mv;
                        const origemAuto = sanctionRowIsGeradaPelaAusencia(String(r.observacoes ?? ""));
                        return (
                          <li
                            key={String(r.id)}
                            className="rounded-md border border-border/80 bg-background/90 px-3 py-2.5 text-sm text-foreground shadow-sm"
                          >
                            <div className="font-medium leading-snug">
                              {r.nomeFuncionario.trim()}
                              <span className="text-muted-foreground font-normal"> · </span>
                              <span className="tabular-nums font-medium">{dataBr}</span>
                              <span className="text-muted-foreground font-normal"> · </span>
                              <span>{String(r.tipo ?? "").trim()}</span>
                              {origemAuto ? (
                                <span className="ml-1.5 text-[10px] font-normal uppercase text-muted-foreground">
                                  (automática)
                                </span>
                              ) : null}
                            </div>
                            {mvC ? (
                              <p className="mt-2 text-xs text-muted-foreground leading-relaxed border-t border-border/60 pt-2">
                                <span className="font-medium text-foreground/80">Motivo: </span>
                                {mvC}
                              </p>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}

                <div className="flex gap-3 rounded-lg border border-dashed border-border/90 bg-muted/25 p-3.5">
                  <Checkbox
                    id="modal-propagar-sancao-conflito"
                    checked={modalPropagarMesmoComConflito}
                    onCheckedChange={(c) => setModalPropagarMesmoComConflito(Boolean(c))}
                    className="mt-0.5"
                  />
                  <div className="space-y-1 min-w-0">
                    <Label
                      htmlFor="modal-propagar-sancao-conflito"
                      className="text-sm font-medium cursor-pointer leading-snug text-foreground"
                    >
                      Também incluir linha em Sanções ao sincronizar
                    </Label>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Marcado = Sanções e ausências. Desmarcado = só Faltas e atestados.
                    </p>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <div className="flex flex-wrap gap-2 w-full justify-end">
              <AlertDialogCancel type="button" onClick={() => setDupManualPropagacaoOpen(false)}>
                Voltar
              </AlertDialogCancel>
              <Button type="button" variant="default" onClick={() => confirmarDecisaoConflitoPropagacaoSancoes()}>
                Guardar
              </Button>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dupSuspOpen} onOpenChange={onDupSuspAlertOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspensão já lançada nesta data?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Já existe ao menos uma <strong>suspensão disciplinar</strong> para este colaborador na mesma data. Confirme
                  se deseja registrar outra ocorrência (por exemplo, episódios distintos no mesmo dia).
                </p>
                {dupRowsAlerta.length > 0 ? (
                  <ul className="list-disc pl-5 space-y-1.5 text-foreground/90">
                    {dupRowsAlerta.map((r) => {
                      const trecho = displayAusenciaObservacoesLista(String(r.observacoes ?? "")).trim();
                      const curto = trecho.length > 120 ? `${trecho.slice(0, 117)}…` : trecho;
                      return (
                        <li key={String(r.id)}>
                          <span className="tabular-nums">{String(r.data ?? "").slice(0, 10)}</span>
                          {curto ? <span className="text-muted-foreground"> — {curto}</span> : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Voltar</AlertDialogCancel>
            <AlertDialogAction type="button" onClick={() => void confirmarSalvarComDuplicidade()}>
              Salvar assim mesmo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={alertasOpen} onOpenChange={onAlertasDialogOpenChange}>
        <AlertDialogContent className="sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Regras de alerta acionadas</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  O lançamento se enquadra em {alertasPendentes.length} regra(s) ativa(s). A ausência será salva e
                  os alertas registrados para análise do RH.
                </p>
                <ul className="list-disc pl-5 space-y-2 text-foreground/90">
                  {alertasPendentes.map((a) => (
                    <li key={a.regraId}>
                      <span className="font-medium">{a.titulo}</span>
                      <span className="block text-muted-foreground mt-0.5">{a.motivo}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Voltar</AlertDialogCancel>
            <AlertDialogAction type="button" onClick={() => void confirmarSalvarComAlertas()}>
              Salvar e registrar alertas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "flex flex-col gap-0 p-0 overflow-hidden",
            "w-[min(98vw,80rem)] max-w-[min(98vw,80rem)]",
            "h-[min(92dvh,52rem)] max-h-[92dvh]",
          )}
          onOpenAutoFocus={(ev) => ev.preventDefault()}
        >
        <DialogHeader className="px-6 sm:px-8 pt-5 pb-3 shrink-0 text-left border-b border-border">
          <DialogTitle>{isEditMode ? "Editar ausência" : "Lançar nova ausência"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain px-6 sm:px-8 py-5 space-y-6">
            <FormSection title="Identificação">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-x-5 lg:items-start">
                <div className="lg:col-span-3">
                  <Label htmlFor="aus-data" className={lblForm}>
                    Data<span className="text-destructive"> *</span>
                  </Label>
                  <Input
                    id="aus-data"
                    type="date"
                    value={draft.data}
                    onChange={(e) => setField("data", e.target.value)}
                    className={dashedInput}
                    autoComplete="off"
                  />
                </div>

                <div className="lg:col-span-9 space-y-2 min-w-0">
                  <Label className={lblForm}>
                    Nome do funcionário<span className="text-destructive"> *</span>
                  </Label>
                  <Popover open={colabOpen} onOpenChange={setColabOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={colabOpen}
                        className={comboDashed}
                      >
                      <span className="truncate text-left">
                        {colabSelection === MANUAL_KEY
                          ? "— Informar nome manualmente —"
                          : draft.nomeFuncionario.trim()
                            ? draft.nomeFuncionario
                          : colaboradoresDisponiveis.length
                              ? "Selecione um colaborador…"
                              : "Nenhum colaborador disponível no orgânico — use manual"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                    className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[min(100vw-2rem,40rem)]"
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
                            value={`__manual__ manual digitar`}
                            onSelect={() => {
                              setColabSelection(MANUAL_KEY);
                              clearColaboradorCampos();
                              setColabOpen(false);
                            }}
                          >
                            — Informar nome manualmente —
                          </CommandItem>
                          {colaboradoresDisponiveis.map((entry) => (
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
                      id="aus-nome-manual"
                      value={draft.nomeFuncionario}
                      onChange={(e) => setField("nomeFuncionario", e.target.value)}
                      placeholder="Nome completo"
                      className={dashedInput}
                      autoComplete="name"
                    />
                  ) : null}
                </div>
              </div>
            </FormSection>

            <FormSection title="Dados do colaborador">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 xl:gap-x-5">
                <div>
                  <Label htmlFor="aus-mes" className={lblForm}>
                    Mês da falta<span className="text-destructive"> *</span>
                  </Label>
                  <Input
                    id="aus-mes"
                    readOnly
                    value={mesFaltaDisplay}
                    placeholder="Defina a data"
                    className={cn(dashedInput, dashedInputRead, "text-foreground")}
                    tabIndex={-1}
                  />
                </div>
                <div>
                  <Label htmlFor="aus-mat" className={lblForm}>
                    Matrícula<span className="text-destructive"> *</span>
                  </Label>
                  <Input
                    id="aus-mat"
                    type="text"
                    readOnly={lockedFromOrganico}
                    value={draft.matricula}
                    onChange={(e) => setField("matricula", e.target.value)}
                    className={cn(dashedInput, lockedFromOrganico && dashedInputRead)}
                  />
                </div>

                <div className="sm:col-span-2 xl:col-span-4">
                  <Label htmlFor="aus-end" className={lblForm}>
                    Endereço<span className="text-destructive"> *</span>
                  </Label>
                  <Input
                    id="aus-end"
                    type="text"
                    readOnly={lockedFromOrganico}
                    value={draft.endereco}
                    onChange={(e) => setField("endereco", e.target.value)}
                    className={cn(dashedInput, lockedFromOrganico && dashedInputRead)}
                  />
                </div>

                <div>
                  <Label htmlFor="aus-area" className={lblForm}>
                    Área<span className="text-destructive"> *</span>
                  </Label>
                  <Input
                    id="aus-area"
                    type="text"
                    readOnly={lockedFromOrganico}
                    value={draft.area}
                    onChange={(e) => setField("area", e.target.value)}
                    className={cn(dashedInput, lockedFromOrganico && dashedInputRead)}
                  />
                </div>
                <div>
                  <Label htmlFor="aus-setor" className={lblForm}>
                    Setor<span className="text-destructive"> *</span>
                  </Label>
                  <Input
                    id="aus-setor"
                    type="text"
                    readOnly={lockedFromOrganico}
                    value={draft.setor}
                    onChange={(e) => setField("setor", e.target.value)}
                    className={cn(dashedInput, lockedFromOrganico && dashedInputRead)}
                  />
                </div>

                <div className="sm:col-span-2 xl:col-span-4">
                  <Label htmlFor="aus-lider" className={lblForm}>
                    Líder<span className="text-destructive"> *</span>
                  </Label>
                  <Input
                    id="aus-lider"
                    type="text"
                    readOnly={lockedFromOrganico}
                    value={draft.lider}
                    onChange={(e) => setField("lider", e.target.value)}
                    className={cn(dashedInput, lockedFromOrganico && dashedInputRead)}
                  />
                </div>
              </div>
            </FormSection>

            <FormSection title="Detalhes da ausência">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 xl:gap-x-5">
                <CadastroSelect
                  id="aus-periodo"
                  label="Período"
                  value={draft.periodo}
                  onChange={(v) => setField("periodo", v)}
                  options={periodoOptions}
                  labelRequired
                  triggerClassName={dashedSelectTrigger}
                />
                <div>
                  <Label htmlFor="aus-qntd" className={lblForm}>
                    {qntdLabel}
                    <span className="text-destructive"> *</span>
                  </Label>
                  {qntdMode === "horas" ? (
                    <Input
                      id="aus-qntd"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={24}
                      step={0.25}
                      value={draft.qntd}
                      onChange={(e) => setField("qntd", e.target.value)}
                      placeholder="Ex.: 4 ou 3.5 (horas)"
                      className={dashedInput}
                      autoComplete="off"
                    />
                  ) : qntdMode === "dias" ? (
                    <Input
                      id="aus-qntd"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.25}
                      value={draft.qntd}
                      onChange={(e) => setField("qntd", e.target.value)}
                      placeholder="Ex.: 1 ou 0.5 (dias)"
                      className={dashedInput}
                      autoComplete="off"
                    />
                  ) : (
                    <Input
                      id="aus-qntd"
                      type="text"
                      value={draft.qntd}
                      onChange={(e) => setField("qntd", e.target.value)}
                      className={dashedInput}
                      autoComplete="off"
                    />
                  )}
                </div>

                <CadastroSelect
                  id="aus-tipo"
                  label="Tipo"
                  value={draft.tipo}
                  onChange={(v) => setField("tipo", v)}
                  options={tipoOptions}
                  labelRequired
                  triggerClassName={dashedSelectTrigger}
                />

                {showCid ? (
                  <CadastroSearchSelect
                    id="aus-cid"
                    label="CID"
                    value={draft.cid}
                    onChange={(v) => setField("cid", v)}
                    options={cidOptions}
                    className="sm:col-span-2 xl:col-span-3"
                    labelRequired
                  />
                ) : null}

                {showAtendimento ? (
                  <>
                    <div className="sm:col-span-1 xl:col-span-2">
                      <Label htmlFor="aus-local" className={lblForm}>
                        Local de atendimento<span className="text-destructive"> *</span>
                      </Label>
                      <Input
                        id="aus-local"
                        type="text"
                        value={draft.localAtendimento}
                        onChange={(e) => setField("localAtendimento", e.target.value)}
                        className={dashedInput}
                        autoComplete="off"
                      />
                    </div>

                    <div className="sm:col-span-1 xl:col-span-1">
                      <Label htmlFor="aus-med" className={lblForm}>
                        Médico responsável<span className="text-destructive"> *</span>
                      </Label>
                      <Input
                        id="aus-med"
                        type="text"
                        value={draft.medicoResponsavel}
                        onChange={(e) => setField("medicoResponsavel", e.target.value)}
                        className={dashedInput}
                        autoComplete="off"
                      />
                    </div>
                  </>
                ) : null}
              </div>
            </FormSection>

            <FormSection title="Observações e complementos">
              {ausenciaEhSuspensa ? (
                <div className="space-y-4">
                  {tiposSancoesOrdenados.length === 0 ? (
                    <p className="text-sm text-destructive leading-relaxed">
                      Não há tipos de sanção no cadastro. Inclua-os em <strong>Faltas e atestados → Cadastros</strong> antes
                      de lançar suspensão disciplinar.
                    </p>
                  ) : (
                    <CadastroSelect
                      id="aus-tipo-sancao"
                      label="Tipo de sanção (cadastro)"
                      value={tipoSancaoSuspensao}
                      onChange={setTipoSancaoSuspensao}
                      options={tiposSancoesOrdenados}
                      labelRequired
                      wide
                      className="max-w-xl"
                      triggerClassName={dashedSelectTrigger}
                    />
                  )}
                  <div className="max-w-xs">
                    <Label htmlFor="aus-data-aplic-sanc" className={lblForm}>
                      Data de aplicação da sanção<span className="text-destructive"> *</span>
                    </Label>
                    <Input
                      id="aus-data-aplic-sanc"
                      type="date"
                      value={dataAplicacaoSuspensao}
                      onChange={(e) => setDataAplicacaoSuspensao(e.target.value)}
                      className={dashedInput}
                      autoComplete="off"
                    />
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      Data em que a sanção entra em vigor (pode diferir da <strong>data da falta/ausência</strong> ao lado).
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="aus-motivo-susp" className={lblForm}>
                      Motivo da sanção<span className="text-destructive"> *</span>
                    </Label>
                    <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
                      Usado na linha gerada ao sincronizar com <strong>Sanções disciplinares</strong> (não repete período nem quantidade
                      da falta aqui).
                    </p>
                    <Textarea
                      id="aus-motivo-susp"
                      value={motivoSuspensao}
                      onChange={(e) => setMotivoSuspensao(e.target.value)}
                      placeholder="Descreva o motivo da suspensão disciplinar…"
                      className={dashedTextarea}
                      rows={5}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <Label htmlFor="aus-obs" className={lblForm}>
                    Observações
                    {exigeObservacoesAusencia ? (
                      <span className="text-destructive"> *</span>
                    ) : (
                      <span className="text-muted-foreground font-normal normal-case"> (opcional)</span>
                    )}
                  </Label>
                  <Textarea
                    id="aus-obs"
                    value={draft.observacoes}
                    onChange={(e) => setField("observacoes", e.target.value)}
                    placeholder={
                      exigeObservacoesAusencia
                        ? "Descreva o motivo informado pelo colaborador…"
                        : "Detalhes adicionais sobre a ausência…"
                    }
                    className={dashedTextarea}
                    rows={4}
                  />
                </div>
              )}
            </FormSection>

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
            <Button
              type="submit"
              disabled={!canEdit || saving || !formValid}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {saving ? "Salvando…" : isEditMode ? "Salvar alterações" : "Salvar ausência"}
            </Button>
          </DialogFooter>
        </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
