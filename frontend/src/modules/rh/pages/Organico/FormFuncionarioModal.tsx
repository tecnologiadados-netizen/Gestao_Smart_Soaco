/**
 * Modal de cadastro/edição de funcionário no Orgânico.
 * Formulário longo em página única (scroll), com guias que rolam até a seção.
 */
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  cloneElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { Archive, ArrowLeft, Lock, MessageSquareMore } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@rh/components/ui/dialog";
import { Button } from "@rh/components/ui/button";
import { Input } from "@rh/components/ui/input";
import { Label } from "@rh/components/ui/label";
import { Textarea } from "@rh/components/ui/textarea";
import { ORGANICO_HEADERS, ORGANICO_NUM_COLUNAS } from "./organico-headers";
import { ORGANICO_IDX, parseCtpsToNumber } from "./organico-derive";
import { ORGANICO_COLUNAS_READONLY_SECULLUM } from "./organico-secullum-readonly";
import { isColunaDerivadaSistema, ORGANICO_INDICES_SIM_NAO, COLUNAS_PERCENTUAL } from "./organico-excel-schema";
import { calcularFormulasRow } from "./organico-formulas";
import { displayCellsToStorageRow, formatDateBRDisplay, rowToDisplayCells } from "./organico-display";
import type { OrganicoSheetRow } from "./useOrganicoImport";
import { OrganicoComentariosPanel } from "./OrganicoComentariosPanel";
import { OrganicoFotoUpload } from "./OrganicoFotoUpload";
import { OrganicoTrajetoriaTab } from "./OrganicoTrajetoriaTab";
import { OrganicoDocumentArchivePanel } from "./OrganicoDocumentArchivePanel";
import { buildOrganicoActivityLogs, type OrganicoActivityDraft } from "./organico-activity-log";
import { cn } from "@rh/lib/utils";
import {
  findSecullumFuncionarioByMatricula,
  getSecullumFuncionarios,
  isApiConfigured,
} from "@rh/lib/api-client";
import type { OrganicoDocumentPermissions, OrganicoTabId, PermissionAccess } from "@rh/lib/rh-permissions";

/** Grupos de colunas por seção (âncora) */
const GUIAS: { id: string; label: string; indices: number[] }[] = [
  { id: "identificacao", label: "Identificação", indices: [0, 1, 2, 3, 4, 5] },
  { id: "cargo", label: "Cargo e Trabalho", indices: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17] },
  { id: "formacao", label: "Formação", indices: [18, 19, 20, 21, 22, 23, 24, 25, 26] },
  { id: "pessoal", label: "Pessoal", indices: [27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37] },
  { id: "beneficios", label: "Benefícios", indices: [38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52] },
  { id: "remuneracao", label: "Remuneração", indices: [53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75] },
  { id: "banco", label: "Dados Bancários", indices: [76, 77, 78, 79, 80] },
  { id: "contrato", label: "Contrato", indices: [81, 82, 83, 84, 85, 86] },
  { id: "trajetoria", label: "Trajetória", indices: [] },
];

const STATUS_OPCOES = ["Ativo", "Férias", "Afastado", "Desligado"] as const;

const SIM_NAO_OPCOES = ["Não", "Sim"] as const;

/** Alinhado ao formulário de ausências (LancarAusenciaDialog). */
const lblForm = "text-xs font-medium text-muted-foreground mb-1.5 block";
/** Texto e placeholder com o mesmo contraste (evita placeholder “apagado” vs valor preenchido). */
const dashedInput =
  "flex h-9 w-full min-w-0 rounded-lg border border-dashed border-muted-foreground/35 bg-background px-3 text-sm text-foreground shadow-none transition-colors placeholder:text-foreground focus-visible:border-solid focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:ring-offset-0 read-only:text-foreground disabled:cursor-not-allowed disabled:text-foreground disabled:opacity-100 md:text-sm";
const dashedInputRead =
  "cursor-default bg-muted border-muted-foreground/25 text-foreground placeholder:text-foreground read-only:text-foreground";
const dashedSelect =
  "flex h-9 w-full min-w-0 appearance-none rounded-lg border border-dashed border-muted-foreground/35 bg-background px-3 pr-9 text-sm text-foreground shadow-none transition-colors focus-visible:border-solid focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:text-foreground disabled:opacity-100";

function IconeEdicaoBloqueada() {
  return (
    <Lock
      className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
      aria-label="Edição bloqueada"
      title="Edição bloqueada"
    />
  );
}

function FormSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-3 rounded-xl border border-border/90 bg-card/35 shadow-sm overflow-hidden"
    >
      <header className="border-b border-border/80 bg-muted/50 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-foreground">
        {title}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function getEmptyRow(): OrganicoSheetRow {
  return ORGANICO_HEADERS.map(() => "");
}

function cellsToRow(cells: string[]): OrganicoSheetRow {
  const row: OrganicoSheetRow = [];
  for (let i = 0; i < ORGANICO_HEADERS.length; i++) {
    row.push(cells[i] ?? "");
  }
  return row;
}

export interface FormFuncionarioModalSavePayload {
  row: OrganicoSheetRow;
  activityLogs: OrganicoActivityDraft[];
}

interface FormFuncionarioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialRow?: OrganicoSheetRow | null;
  onSave: (payload: FormFuncionarioModalSavePayload) => void;
  readOnly?: boolean;
  demissao?: string;
  allowedTabIds?: OrganicoTabId[];
  editableTabIds?: OrganicoTabId[];
  commentsPermissions?: PermissionAccess;
  photoPermissions?: PermissionAccess;
  documentPermissions?: OrganicoDocumentPermissions;
  /**
   * Quando true, colunas espelhadas da Secullum (nome, setor, CTPS, etc.) não podem ser editadas.
   * Cadastro novo (sem linha inicial) nunca usa isto.
   */
  secullumFieldsLocked?: boolean;
  /** Motivo de desligamento (API Pessoas Secullum), quando aplicável. */
  motivoDemissao?: string;
}

export function FormFuncionarioModal({
  open,
  onOpenChange,
  initialRow,
  onSave,
  readOnly = false,
  demissao,
  allowedTabIds,
  editableTabIds,
  commentsPermissions,
  photoPermissions,
  documentPermissions,
  secullumFieldsLocked = false,
  motivoDemissao,
}: FormFuncionarioModalProps) {
  const [cells, setCells] = useState<string[]>(() =>
    initialRow ? rowToDisplayCells(initialRow) : rowToDisplayCells(getEmptyRow()),
  );
  const [activeGuia, setActiveGuia] = useState(GUIAS[0].id);
  const [commentsVisible, setCommentsVisible] = useState(true);
  const [archiveScreenVisible, setArchiveScreenVisible] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const skipObserverRef = useRef(false);
  const colaboradorNome = String(initialRow?.[ORGANICO_IDX.NOME] ?? "").trim();
  const colaboradorMatricula = String(initialRow?.[ORGANICO_IDX.MATRICULA] ?? "").trim();
  const visibleGuias = useMemo(
    () => GUIAS.filter((guia) => !allowedTabIds || allowedTabIds.includes(guia.id as OrganicoTabId)),
    [allowedTabIds],
  );
  const editableGuias = useMemo(() => new Set(editableTabIds ?? []), [editableTabIds]);
  const canViewComments = commentsPermissions ? commentsPermissions.view || commentsPermissions.edit : true;
  const canViewDocuments = documentPermissions
    ? documentPermissions.view ||
      documentPermissions.create ||
      documentPermissions.edit ||
      documentPermissions.delete ||
      documentPermissions.download ||
      documentPermissions.audit
    : true;

  const isDesligadoContratoSecullum = String(cells[ORGANICO_IDX.STATUS] ?? "").trim() === "Desligado";

  const { data: secullumListaMotivo, isFetching: carregandoMotivoSecullum } = useQuery({
    queryKey: ["secullum-funcionarios-modal-motivo", colaboradorMatricula],
    queryFn: getSecullumFuncionarios,
    enabled:
      open &&
      secullumFieldsLocked &&
      isDesligadoContratoSecullum &&
      Boolean(colaboradorMatricula) &&
      isApiConfigured(),
    staleTime: 45_000,
  });

  const motivoDemissaoResolvido = useMemo(() => {
    const aoVivo =
      secullumListaMotivo?.length && colaboradorMatricula
        ? String(
            findSecullumFuncionarioByMatricula(secullumListaMotivo, colaboradorMatricula)?.motivoDemissao ?? "",
          ).trim()
        : "";
    return aoVivo || String(motivoDemissao ?? "").trim();
  }, [secullumListaMotivo, colaboradorMatricula, motivoDemissao]);

  /** Só ao abrir o modal: evita resetar o rascunho quando o pai refaz fetch do Orgânico (initialRow nova referência). */
  const wasModalOpenRef = useRef(false);
  const demissaoBaselineWhileOpenRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!open) {
      wasModalOpenRef.current = false;
      demissaoBaselineWhileOpenRef.current = undefined;
      setArchiveScreenVisible(false);
      return;
    }
    const justOpened = !wasModalOpenRef.current;
    wasModalOpenRef.current = true;

    if (!justOpened) return;

    const row: OrganicoSheetRow = initialRow
      ? [...(Array.isArray(initialRow) ? initialRow : [])]
      : getEmptyRow();
    while (row.length < ORGANICO_NUM_COLUNAS) row.push("");
    calcularFormulasRow(row, { demissaoApi: demissao });
    setCells(rowToDisplayCells(row));
    setActiveGuia((visibleGuias[0] ?? GUIAS[0]).id);
    setCommentsVisible(canViewComments);
    demissaoBaselineWhileOpenRef.current = demissao;
  }, [open, initialRow, demissao, visibleGuias, canViewComments]);

  /** Demissão (Secullum) pode chegar depois de abrir; recalcula fórmulas sem descartar o que já foi digitado. */
  useEffect(() => {
    if (!open) return;
    if (demissaoBaselineWhileOpenRef.current === undefined) return;
    if (demissaoBaselineWhileOpenRef.current === demissao) return;
    demissaoBaselineWhileOpenRef.current = demissao;
    setCells((prev) => {
      const canonical = displayCellsToStorageRow(prev);
      const row = cellsToRow(canonical);
      calcularFormulasRow(row, { demissaoApi: demissao });
      return rowToDisplayCells(row);
    });
  }, [open, demissao]);

  useEffect(() => {
    if (!open) return;
    setCommentsVisible(canViewComments);
  }, [open, canViewComments]);

  /** Destaca a seção visível ao rolar (dentro do painel). */
  useEffect(() => {
    if (!open) return;
    let observer: IntersectionObserver | null = null;
    let cancelled = false;
    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      const root = scrollRef.current;
      if (!root) return;
      const sectionEls = visibleGuias.map((g) => root.querySelector<HTMLElement>(`#organico-section-${g.id}`)).filter(
        Boolean,
      ) as HTMLElement[];
      if (sectionEls.length === 0) return;

      const updateActiveGuiaFromScroll = () => {
        const maxScrollTop = Math.max(0, root.scrollHeight - root.clientHeight);
        if (root.scrollTop >= maxScrollTop - 8) {
          setActiveGuia((visibleGuias[visibleGuias.length - 1] ?? GUIAS[GUIAS.length - 1])!.id);
          return;
        }

        const rootTop = root.getBoundingClientRect().top;
        const targetLine = rootTop + Math.max(80, root.clientHeight * 0.18);
        let currentId = (visibleGuias[0] ?? GUIAS[0])!.id;

        for (const el of sectionEls) {
          const top = el.getBoundingClientRect().top;
          if (top <= targetLine) {
            const sid = el.id.replace("organico-section-", "");
            if (visibleGuias.some((g) => g.id === sid)) currentId = sid;
          }
        }

        setActiveGuia(currentId);
      };

      observer = new IntersectionObserver(
        (entries) => {
          if (skipObserverRef.current) return;
          const visible = entries
            .filter((e) => e.isIntersecting && e.intersectionRatio > 0)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
          const top = visible[0];
          if (top?.target.id?.startsWith("organico-section-")) {
            const sid = top.target.id.replace("organico-section-", "");
            if (visibleGuias.some((g) => g.id === sid)) setActiveGuia(sid);
          }
        },
        { root, rootMargin: "-12% 0px -55% 0px", threshold: [0, 0.1, 0.25, 0.5] },
      );
      for (const el of sectionEls) observer.observe(el);

      root.addEventListener("scroll", updateActiveGuiaFromScroll, { passive: true });
      updateActiveGuiaFromScroll();

      const cleanupScroll = () => root.removeEventListener("scroll", updateActiveGuiaFromScroll);
      (observer as IntersectionObserver & { __cleanupScroll?: () => void }).__cleanupScroll = cleanupScroll;
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      const observerWithCleanup = observer as (IntersectionObserver & { __cleanupScroll?: () => void }) | null;
      observerWithCleanup?.__cleanupScroll?.();
      observer?.disconnect();
    };
  }, [open, visibleGuias]);

  const scrollToGuia = useCallback((id: string) => {
    const root = scrollRef.current;
    const el = root?.querySelector<HTMLElement>(`#organico-section-${id}`);
    if (!el || !root) return;
    skipObserverRef.current = true;
    setActiveGuia(id);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      skipObserverRef.current = false;
    }, 600);
  }, []);

  const isCellReadOnly = (idx: number) =>
    readOnly ||
    isColunaDerivadaSistema(idx) ||
    (secullumFieldsLocked && ORGANICO_COLUNAS_READONLY_SECULLUM.has(idx));

  const recalcCellsFromDisplay = useCallback(
    (display: string[], opts?: { keepRawAt?: number; keepRawValue?: string }) => {
      const nextDisplay = [...display];
      while (nextDisplay.length < ORGANICO_NUM_COLUNAS) nextDisplay.push("");
      const canonical = displayCellsToStorageRow(nextDisplay);
      const row = cellsToRow(canonical);
      calcularFormulasRow(row, { demissaoApi: demissao });
      const formatted = rowToDisplayCells(row);
      if (opts?.keepRawAt != null) {
        formatted[opts.keepRawAt] = opts.keepRawValue ?? nextDisplay[opts.keepRawAt] ?? "";
      }
      return formatted;
    },
    [demissao],
  );

  const handleChange = (idx: number, value: string) => {
    if (isCellReadOnly(idx)) return;
    setCells((prev) => {
      const nextDisplay = [...prev];
      while (nextDisplay.length < ORGANICO_NUM_COLUNAS) nextDisplay.push("");
      nextDisplay[idx] = value;
      if (COLUNAS_PERCENTUAL.has(idx)) {
        return recalcCellsFromDisplay(nextDisplay, { keepRawAt: idx, keepRawValue: value });
      }
      return recalcCellsFromDisplay(nextDisplay);
    });
  };

  const handlePercentBlur = (idx: number) => {
    if (!COLUNAS_PERCENTUAL.has(idx) || isCellReadOnly(idx)) return;
    setCells((prev) => recalcCellsFromDisplay(prev));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    const canonical = displayCellsToStorageRow(cells);
    const row = cellsToRow(canonical);
    calcularFormulasRow(row, { demissaoApi: demissao });
    onSave({
      row,
      activityLogs: buildOrganicoActivityLogs(initialRow, row),
    });
    onOpenChange(false);
  };

  const fieldNodesForIndex = (idx: number, guiaId: string): ReactNode[] => {
    const label = (ORGANICO_HEADERS[idx] ?? "").trim() || `Coluna ${idx + 1}`;
    const isStatus = idx === ORGANICO_IDX.STATUS;
    const isSimNao = ORGANICO_INDICES_SIM_NAO.has(idx);
    const isSituacaoTrabalhista = idx === ORGANICO_IDX.SITUACAO_TRABALHISTA;
    const isDerivada = isColunaDerivadaSistema(idx);
    const cellRo = readOnly || !editableGuias.has(guiaId as OrganicoTabId) || isCellReadOnly(idx);
    const secullumStatusDetalhado = String(cells[ORGANICO_IDX.SITUACAO_TRABALHISTA] ?? "").trim();
    const secullumHint =
      secullumFieldsLocked && ORGANICO_COLUNAS_READONLY_SECULLUM.has(idx) && !isDerivada ? (
        <span className="normal-case font-normal text-muted-foreground"> (Secullum)</span>
      ) : null;

    if (isSituacaoTrabalhista && secullumFieldsLocked) {
      return [];
    }

    const campoBloqueado = cellRo || isDerivada;

    const field = (
      <div key={idx} className="min-w-0">
        <Label htmlFor={`cell-${idx}`} className={lblForm}>
          <span className="inline-flex max-w-full flex-wrap items-center gap-1.5">
            <span className="min-w-0">{label}</span>
            {campoBloqueado ? <IconeEdicaoBloqueada /> : null}
          </span>
          {isDerivada ? <span className="normal-case font-normal text-muted-foreground"> (calculado)</span> : null}
          {secullumHint}
        </Label>
        {isStatus ? (
          <div className="relative">
            <select
              id={`cell-${idx}`}
              value={cells[idx] ?? "Ativo"}
              onChange={(e) => handleChange(idx, e.target.value)}
              disabled={cellRo}
              className={cn(dashedSelect, cellRo && dashedInputRead)}
            >
              {STATUS_OPCOES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        ) : isSimNao ? (
          <div className="relative">
            <select
              id={`cell-${idx}`}
              value={cells[idx] === "Sim" ? "Sim" : "Não"}
              onChange={(e) => handleChange(idx, e.target.value)}
              disabled={cellRo}
              className={cn(dashedSelect, cellRo && dashedInputRead)}
            >
              {SIM_NAO_OPCOES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        ) : isSituacaoTrabalhista && cellRo ? (
          <Textarea
            id={`cell-${idx}`}
            value={cells[idx] ?? ""}
            readOnly
            className="min-h-[88px] resize-none rounded-xl border border-dashed border-muted-foreground/35 bg-muted px-3 py-2 text-sm text-foreground placeholder:text-foreground shadow-none read-only:text-foreground disabled:opacity-100"
          />
        ) : isDerivada ? (
          <Input
            id={`cell-${idx}`}
            value={cells[idx] ?? ""}
            disabled
            title="Valor calculado automaticamente; não editável."
            className={cn(dashedInput, dashedInputRead)}
          />
        ) : (
          <Input
            id={`cell-${idx}`}
            value={cells[idx] ?? ""}
            onChange={(e) => handleChange(idx, e.target.value)}
            onBlur={COLUNAS_PERCENTUAL.has(idx) ? () => handlePercentBlur(idx) : undefined}
            autoComplete={COLUNAS_PERCENTUAL.has(idx) ? "off" : undefined}
            placeholder="—"
            readOnly={cellRo}
            className={cn(dashedInput, cellRo && dashedInputRead)}
          />
        )}
      </div>
    );

    if (idx === ORGANICO_IDX.ADMISSAO && guiaId === "cargo" && demissao) {
      return [
        field,
        <div key="demissao-api" className="min-w-0 md:col-span-2">
          <Label className={lblForm}>
            <span className="inline-flex flex-wrap items-center gap-1.5">
              Demissão (Secullum)
              <IconeEdicaoBloqueada />
            </span>
          </Label>
          <Input value={formatDateBRDisplay(demissao)} readOnly className={cn(dashedInput, dashedInputRead)} />
        </div>,
      ];
    }
    if (idx === ORGANICO_IDX.STATUS && secullumFieldsLocked && secullumStatusDetalhado) {
      const isDesligado = String(cells[ORGANICO_IDX.STATUS] ?? "").trim() === "Desligado";

      const detalhadoSecullum = (
        <div key="status-secullum-detalhado" className="min-w-0 md:col-span-2">
          <Label className={lblForm}>
            <span className="inline-flex flex-wrap items-center gap-1.5">
              Status Funcionário (Secullum)
              <IconeEdicaoBloqueada />
            </span>
          </Label>
          <Textarea
            value={secullumStatusDetalhado}
            readOnly
            className="min-h-[88px] resize-none rounded-xl border border-dashed border-muted-foreground/35 bg-muted px-3 py-2 text-sm text-foreground placeholder:text-foreground shadow-none read-only:text-foreground disabled:opacity-100"
          />
        </div>
      );

      const textoMotivoExibido = carregandoMotivoSecullum
        ? "Carregando motivo na Secullum…"
        : motivoDemissaoResolvido ||
          "—\n\nNenhum motivo veio na resposta da integração. Confira no Ponto Secullum se o motivo de demissão está preenchido e se a função secullum-funcionarios no Supabase está na versão mais recente.";

      if (isDesligado) {
        return [
          <div
            key="status-motivo-linha"
            className="md:col-span-2 grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start"
          >
            {field}
            <div className="min-w-0">
              <Label htmlFor="motivo-desligamento-secullum" className={lblForm}>
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  <span>
                    Motivo do desligamento
                    <span className="normal-case font-normal text-muted-foreground"> (Secullum)</span>
                  </span>
                  <IconeEdicaoBloqueada />
                </span>
              </Label>
              <Textarea
                id="motivo-desligamento-secullum"
                value={textoMotivoExibido}
                readOnly
                className="min-h-[88px] resize-none rounded-xl border border-dashed border-muted-foreground/35 bg-muted px-3 py-2 text-sm text-foreground placeholder:text-foreground shadow-none read-only:text-foreground disabled:opacity-100 whitespace-pre-wrap"
              />
            </div>
          </div>,
          detalhadoSecullum,
        ];
      }

      return [field, detalhadoSecullum];
    }
    if (idx === ORGANICO_IDX.CTPS && guiaId === "remuneracao") {
      const ctpsBruto = String(cells[idx] ?? "").trim();
      const ctpsNum = parseCtpsToNumber(cells[idx]);
      const divisaoCtpsIndice = 1685;
      const indiceTexto =
        ctpsBruto.length > 0 && Number.isFinite(ctpsNum)
          ? new Intl.NumberFormat("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(ctpsNum / divisaoCtpsIndice)
          : "";
      const campoIndiceCtps = (
        <div className="min-w-0">
          <Label htmlFor="organico-indice-ctps" className={lblForm}>
            <span className="inline-flex max-w-full flex-wrap items-center gap-1.5">
              <span className="min-w-0">Índice</span>
              <IconeEdicaoBloqueada />
            </span>
            <span className="normal-case font-normal text-muted-foreground">
              {" "}
              (calculado · Baseado em 1.685)
            </span>
          </Label>
          <Input
            id="organico-indice-ctps"
            value={indiceTexto || "—"}
            readOnly
            title="CTPS do colaborador ÷ 1.685,00"
            className={cn(dashedInput, dashedInputRead)}
          />
        </div>
      );
      return [
        <div key={idx} className="min-w-0 space-y-4">
          {cloneElement(field as ReactElement, { key: undefined })}
          {campoIndiceCtps}
        </div>,
      ];
    }
    return [field];
  };

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
          <DialogTitle>
            {readOnly ? "Visualizar funcionário" : "Editar funcionário"}
          </DialogTitle>
          <DialogDescription className="text-pretty leading-relaxed max-w-none">
            Todas as colunas do orgânico estão abaixo. Use as <strong>categorias</strong> para rolar até cada bloco.
            Campos <strong>calculados</strong> são somente leitura.
            {secullumFieldsLocked && !readOnly ? (
              <>
                {" "}
                Campos marcados <strong>(Secullum)</strong> vêm da integração e não podem ser editados aqui.
              </>
            ) : null}
            {readOnly ? " Modo somente leitura." : null}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {archiveScreenVisible ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 sm:px-8">
              <div className="mb-4 flex justify-start">
                <Button type="button" variant="outline" size="sm" onClick={() => setArchiveScreenVisible(false)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>
              </div>
              <OrganicoDocumentArchivePanel
                open={open && archiveScreenVisible}
                colaboradorMatricula={colaboradorMatricula}
                colaboradorNome={colaboradorNome}
                permissions={documentPermissions}
              />
            </div>
          ) : (
            <>
            <nav
              className="shrink-0 border-b border-border bg-muted/25 px-4 sm:px-6 py-2.5"
              aria-label="Seções do formulário"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {visibleGuias.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => scrollToGuia(g.id)}
                      className={cn(
                        "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                        activeGuia === g.id
                          ? "border-primary bg-primary/10 text-primary shadow-sm"
                          : "border-transparent bg-background/80 text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => setCommentsVisible((prev) => !prev)}
                    disabled={!canViewComments}
                  >
                    <MessageSquareMore className="h-4 w-4" />
                    {commentsVisible ? "Ocultar comentários" : "Exibir comentários"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => setArchiveScreenVisible(true)}
                    disabled={!canViewDocuments || !colaboradorMatricula}
                  >
                    <Archive className="h-4 w-4" />
                    Arquivamento Digital
                  </Button>
                </div>
              </div>
            </nav>
            <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
              <div
                ref={scrollRef}
                className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-6 py-5 sm:px-8 space-y-6"
              >
                {visibleGuias.map((guia) => (
                  <FormSection key={guia.id} id={`organico-section-${guia.id}`} title={guia.label}>
                    {guia.id === "identificacao" ? (
                      <div className="space-y-4">
                        <OrganicoFotoUpload
                          open={open}
                          matricula={colaboradorMatricula}
                          nome={colaboradorNome}
                          canView={photoPermissions ? photoPermissions.view || photoPermissions.edit : true}
                          canEdit={photoPermissions ? photoPermissions.edit : true}
                          canDelete={photoPermissions ? photoPermissions.edit : true}
                        />
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-x-5 md:items-start">
                          {guia.indices
                            .filter((i) => i < ORGANICO_HEADERS.length)
                            .flatMap((idx) => fieldNodesForIndex(idx, guia.id))}
                        </div>
                      </div>
                    ) : guia.id === "trajetoria" ? (
                      <OrganicoTrajetoriaTab
                        open={open}
                        matricula={colaboradorMatricula}
                        nome={colaboradorNome}
                        admissao={initialRow?.[ORGANICO_IDX.ADMISSAO] ?? null}
                        cargoAtual={initialRow?.[ORGANICO_IDX.CARGO] ?? null}
                        salarioCtpsAtual={initialRow?.[ORGANICO_IDX.CTPS] ?? null}
                      />
                    ) : (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-x-5 md:items-start">
                        {guia.indices
                          .filter((i) => i < ORGANICO_HEADERS.length)
                          .flatMap((idx) => fieldNodesForIndex(idx, guia.id))}
                      </div>
                    )}
                  </FormSection>
                ))}
              </div>
              {commentsVisible && canViewComments ? (
                <OrganicoComentariosPanel
                  open={open}
                  colaboradorNome={colaboradorNome}
                  colaboradorMatricula={colaboradorMatricula}
                  canCreate={commentsPermissions ? commentsPermissions.edit : true}
                  canDelete={commentsPermissions ? commentsPermissions.edit : true}
                />
              ) : null}
            </div>
            </>
          )}

          <DialogFooter className="shrink-0 px-6 sm:px-8 py-4 border-t border-border bg-background">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {readOnly ? "Fechar" : "Cancelar"}
            </Button>
            {!readOnly && (
              <Button type="submit">Salvar alterações</Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
