import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  Eye,
  FileText,
  Folder,
  FolderPlus,
  Maximize2,
  Paperclip,
  RotateCcw,
  Trash2,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  ORGANICO_DOCUMENT_CLASSIFICATION_OPTIONS,
  resolveDocumentCategoryOptions,
  type OrganicoDocumentClassificationId,
} from "@rh/lib/organico-documents";
import { getFaltasCadastros } from "@rh/lib/api-client";
import { validateOrganicoDocumentFile } from "@rh/lib/organico-document-contract";
import type { OrganicoDocumentPermissions } from "@rh/lib/rh-permissions";
import { Button } from "@rh/components/ui/button";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@rh/components/ui/dialog";
import { Input } from "@rh/components/ui/input";
import { Label } from "@rh/components/ui/label";
import { useToast } from "@rh/hooks/use-toast";
import { isLaunchDocTestMode } from "@rh/lib/launch-document-config";
import {
  clearLaunchDocumentQueue,
  getLaunchTestDocumentObjectUrl,
  isLaunchTestDocumentId,
  LAUNCH_DOC_QUEUE_CHANGED_EVENT,
  LAUNCH_DOC_TEST_FOLDER_ID,
  mergeLaunchDocumentsIntoFolders,
  removeLaunchDocumentById,
} from "@rh/lib/launch-document-queue";
import { clearLaunchTestRecords } from "@rh/lib/launch-document-test-records";
import { Badge } from "@rh/components/ui/badge";
import {
  createOrganicoArchiveFolder,
  deleteOrganicoDocument,
  fetchOrganicoDocumentUrl,
  findArchiveFolder,
  findArchiveFolderPath,
  findArchiveParentFolderId,
  getOrganicoDocuments,
  hideOrganicoArchiveFolder,
  isOrganicoDocumentsApiConfigured,
  renameOrganicoArchiveFolder,
  uploadOrganicoDocument,
  type OrganicoArchiveFolder,
  type OrganicoArchiveFolderScope,
  type OrganicoArchiveDocument,
} from "@rh/lib/organico-documents-api";
import { randomUUID } from "@rh/lib/utils";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type ArchiveFolder = OrganicoArchiveFolder;

type CurrentFolderRef = {
  id: string;
  scope: OrganicoArchiveFolderScope;
} | null;

type PendingFolderAction =
  | { type: "create"; parent: CurrentFolderRef; name: string; scope?: OrganicoArchiveFolderScope }
  | { type: "rename"; folder: ArchiveFolder }
  | { type: "choose-scope"; parent: CurrentFolderRef };

type PendingDeleteAction =
  | { type: "document"; documentId: string; title: string }
  | { type: "folder-global-choice"; folder: ArchiveFolder }
  | { type: "folder"; folder: ArchiveFolder; globalMode?: "delete_one" | "delete_all" };

type PendingAttachmentAction = {
  file: File;
};

type PdfPagePreview = {
  pageNumber: number;
  imageUrl: string;
};

type PdfRangeDraft = {
  id: string;
  title: string;
  startPage: number;
  endPage: number;
  category: string;
  classification: OrganicoDocumentClassificationId;
};

type OrganicoDocumentArchivePanelProps = {
  open: boolean;
  colaboradorMatricula: string;
  colaboradorNome: string;
  permissions?: OrganicoDocumentPermissions;
};

const DEFAULT_CATEGORY = "Admissão";
const DEFAULT_CLASSIFICATION: OrganicoDocumentClassificationId = "confidential";

async function coverBlobFromDataUrl(dataUrl: string): Promise<File | null> {
  try {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    if (!blob.size) return null;
    return new File([blob], "cover.webp", { type: blob.type || "image/webp" });
  } catch {
    return null;
  }
}

type SplitUploadItem = {
  title: string;
  category: string;
  classification: OrganicoDocumentClassificationId;
  file: File;
  coverUrl?: string;
  sourcePages?: string;
};

function hasDocumentAccess(permissions: OrganicoDocumentPermissions | undefined): boolean {
  if (!permissions) return true;
  return permissions.view || permissions.create || permissions.edit || permissions.delete || permissions.download || permissions.audit;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

function rangeLabel(range: Pick<PdfRangeDraft, "startPage" | "endPage">): string {
  return range.startPage === range.endPage ? `página ${range.startPage}` : `páginas ${range.startPage} a ${range.endPage}`;
}

function getCategoryLabel(category: string): string {
  return category.trim() || "Sem categoria";
}

function getClassificationLabel(classification: OrganicoDocumentClassificationId): string {
  return ORGANICO_DOCUMENT_CLASSIFICATION_OPTIONS.find((item) => item.id === classification)?.label ?? classification;
}

function sanitizeFilePart(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function validateRanges(ranges: PdfRangeDraft[], totalPages: number): string | null {
  if (ranges.length === 0) return "Adicione pelo menos um documento para gerar.";
  const seen = new Set<number>();
  for (const [index, range] of ranges.entries()) {
    if (!range.title.trim()) return `Informe o nome do documento ${index + 1}.`;
    if (!Number.isInteger(range.startPage) || !Number.isInteger(range.endPage)) {
      return `Confira as páginas do documento ${index + 1}.`;
    }
    if (range.startPage < 1 || range.endPage > totalPages || range.startPage > range.endPage) {
      return `O intervalo do documento ${index + 1} está fora do PDF.`;
    }
    for (let page = range.startPage; page <= range.endPage; page++) {
      if (seen.has(page)) return `A página ${page} está em mais de um documento.`;
      seen.add(page);
    }
  }
  return null;
}

type PdfDocumentHandle = Awaited<ReturnType<typeof getDocument>["promise"]>;

type RenderedPdfPage = {
  dataUrl: string;
  width: number;
  height: number;
};

const THUMBNAIL_SCALE = 0.28;
const CARD_COVER_SCALE = 0.35;
const MAX_PREVIEW_RENDER_SCALE = 4;

async function generateDocumentCoverUrl(file: File): Promise<string | undefined> {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (isPdf) {
    try {
      const pdf = await loadPdfDocument(file);
      try {
        const rendered = await renderPdfPageToDataUrl(pdf, 1, CARD_COVER_SCALE);
        return rendered.dataUrl || undefined;
      } finally {
        await pdf.destroy();
      }
    } catch {
      return undefined;
    }
  }
  if (file.type.startsWith("image/")) {
    return URL.createObjectURL(file);
  }
  return undefined;
}

async function renderPdfPageToDataUrl(
  pdf: PdfDocumentHandle,
  pageNumber: number,
  scale: number,
): Promise<RenderedPdfPage> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const pixelRatio = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return { dataUrl: "", width: viewport.width, height: viewport.height };

  canvas.width = Math.floor(viewport.width * pixelRatio);
  canvas.height = Math.floor(viewport.height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  await page.render({
    canvasContext: context,
    viewport,
    canvas,
  }).promise;

  return {
    dataUrl: canvas.toDataURL("image/png"),
    width: viewport.width,
    height: viewport.height,
  };
}

async function getPdfPageDimensions(pdf: PdfDocumentHandle, pageNumber: number): Promise<{ width: number; height: number }> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  return { width: viewport.width, height: viewport.height };
}

async function renderPdfThumbnails(pdf: PdfDocumentHandle): Promise<{ totalPages: number; pages: PdfPagePreview[] }> {
  const pages: PdfPagePreview[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const rendered = await renderPdfPageToDataUrl(pdf, pageNumber, THUMBNAIL_SCALE);
    pages.push({ pageNumber, imageUrl: rendered.dataUrl });
  }
  return { totalPages: pdf.numPages, pages };
}

async function loadPdfDocument(file: File): Promise<PdfDocumentHandle> {
  const bytes = await file.arrayBuffer();
  return getDocument({ data: bytes.slice(0) }).promise;
}

async function splitPdfByRanges(file: File, ranges: PdfRangeDraft[], colaboradorNome: string): Promise<SplitUploadItem[]> {
  const sourceBytes = await file.arrayBuffer();
  const sourcePdf = await PDFDocument.load(sourceBytes);
  const items: SplitUploadItem[] = [];
  for (const range of ranges) {
    const output = await PDFDocument.create();
    const pageIndexes = Array.from(
      { length: range.endPage - range.startPage + 1 },
      (_, index) => range.startPage - 1 + index,
    );
    const copiedPages = await output.copyPages(sourcePdf, pageIndexes);
    copiedPages.forEach((page) => output.addPage(page));
    const bytes = await output.save();
    const colaboradorSlug = sanitizeFilePart(colaboradorNome) || "colaborador";
    const fileName = `${colaboradorSlug}-${sanitizeFilePart(range.title) || "documento"}-${range.startPage}-${range.endPage}.pdf`;
    const generatedFile = new File([bytes], fileName, { type: "application/pdf" });
    const coverUrl = await generateDocumentCoverUrl(generatedFile);
    items.push({
      title: range.title.trim(),
      file: generatedFile,
      coverUrl: coverUrl ?? undefined,
      category: range.category,
      classification: range.classification,
      sourcePages: rangeLabel(range),
    });
  }
  return items;
}

function FolderDocumentCard({
  document,
  canDownload,
  canDelete,
  onDelete,
  onOpen,
  isTestDocument = false,
}: {
  document: OrganicoArchiveDocument;
  canDownload: boolean;
  canDelete: boolean;
  onDelete: () => void;
  onOpen: () => void;
  isTestDocument?: boolean;
}) {
  return (
    <div className="group min-h-32 rounded-xl border border-border/80 bg-card/70 p-4 transition-colors hover:border-primary/60 hover:bg-primary/5">
      <div className="flex min-w-0 w-full items-start gap-3">
        <div className="flex h-11 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/70 bg-white shadow-sm">
          {document.coverUrl ? (
            <img
              src={document.coverUrl}
              alt={`Capa de ${document.title}`}
              className="h-full w-full object-cover object-top"
              draggable={false}
            />
          ) : (
            <FileText className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground">{document.title}</span>
            {isTestDocument ? (
              <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0">
                Teste
              </Badge>
            ) : null}
          </span>
          <span className="mt-1 block truncate text-xs text-muted-foreground">{document.fileName}</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {formatBytes(document.fileSizeBytes)}
            {document.sourcePages ? ` · ${document.sourcePages}` : ""}
          </span>
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
        <span className="rounded-full bg-muted px-2 py-0.5">{getCategoryLabel(document.category)}</span>
        <span className="rounded-full bg-muted px-2 py-0.5">{getClassificationLabel(document.classification)}</span>
      </div>
      <div className="mt-3 flex justify-end gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onOpen}>
          <Eye className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={!canDownload} onClick={onOpen}>
          <Download className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          disabled={!canDelete}
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function FolderTree({
  folders,
  currentFolder,
  canCreate,
  canEdit,
  canDownload,
  canDelete,
  canDeleteFolder,
  onDeleteDocument,
  onOpenDocument,
  onOpenFolder,
  onGoToFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}: {
  folders: ArchiveFolder[];
  currentFolder: ArchiveFolder | null;
  canCreate: boolean;
  canEdit: boolean;
  canDownload: boolean;
  canDelete: boolean;
  canDeleteFolder: (folder: ArchiveFolder) => boolean;
  onDeleteDocument: (document: OrganicoArchiveDocument) => void;
  onOpenDocument: (document: OrganicoArchiveDocument) => void;
  onOpenFolder: (folder: ArchiveFolder) => void;
  onGoToFolder: (folder: ArchiveFolder | null) => void;
  onCreateFolder: () => void;
  onRenameFolder: (folder: ArchiveFolder) => void;
  onDeleteFolder: (folder: ArchiveFolder) => void;
}) {
  const visibleFolders = currentFolder ? currentFolder.children : folders;
  const documents = currentFolder?.documents ?? [];
  const hasContent = visibleFolders.length > 0 || documents.length > 0;
  const path = currentFolder ? findArchiveFolderPath(folders, currentFolder.id) : [];
  const parentId = currentFolder ? findArchiveParentFolderId(folders, currentFolder.id) : null;
  const parentFolder = parentId ? findArchiveFolder(folders, parentId) : null;
  return (
    <div className="rounded-xl border border-border/90 bg-background/70 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-foreground">
            {currentFolder ? currentFolder.name : "Arquivamento Digital"}
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">
            {currentFolder
              ? "Pastas e documentos desta pasta."
              : "Organize pastas globais ou individuais do colaborador."}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={!canCreate} onClick={onCreateFolder}>
          <FolderPlus className="mr-1.5 h-4 w-4" />
          {currentFolder ? "Criar pasta filha" : "Nova pasta"}
        </Button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-1 rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-xs">
        <button type="button" className="font-medium text-primary hover:underline" onClick={() => onGoToFolder(null)}>
          Arquivamento Digital
        </button>
        {path.map((folder) => (
          <span key={folder.id} className="inline-flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <button type="button" className="font-medium text-primary hover:underline" onClick={() => onGoToFolder(folder)}>
              {folder.name}
            </button>
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {currentFolder ? (
          <Button type="button" variant="outline" size="sm" onClick={() => onGoToFolder(parentFolder)}>
            Voltar para pasta anterior
          </Button>
        ) : null}
      </div>
      <div className="mt-4 min-h-[16rem] rounded-xl border border-border/70 bg-muted/10 p-4">
        {!hasContent ? (
          <div className="flex min-h-[12rem] items-center justify-center rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {currentFolder
              ? "Esta pasta está vazia. Crie subpastas ou insira documentos abaixo."
              : "Nenhuma pasta criada. Crie uma nova pasta para começar a organização."}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleFolders.map((folder) => (
              <div
                key={`${folder.scope}-${folder.id}`}
                className="group min-h-32 rounded-xl border border-border/80 bg-card/70 p-4 transition-colors hover:border-primary/60 hover:bg-primary/5"
              >
                <button type="button" className="flex min-w-0 w-full items-center gap-3 text-left" onClick={() => onOpenFolder(folder)}>
                  <Folder className="h-11 w-11 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">{folder.name}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      <span
                        className={
                          folder.documents.length > 0
                            ? "inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 font-semibold text-primary"
                            : "inline-flex items-center gap-1 text-muted-foreground"
                        }
                      >
                        <FileText className="h-3 w-3 shrink-0" />
                        {folder.documents.length} documento{folder.documents.length === 1 ? "" : "s"}
                      </span>
                      <span className="text-muted-foreground">
                        {folder.children.length} subpasta{folder.children.length === 1 ? "" : "s"} ·{" "}
                        {folder.scope === "global" ? "Global" : "Individual"}
                      </span>
                    </span>
                  </span>
                </button>
                <div className="mt-3 flex justify-end gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={!canEdit || folder.id === LAUNCH_DOC_TEST_FOLDER_ID} onClick={() => onRenameFolder(folder)}>
                    <Edit3 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    disabled={!canDeleteFolder(folder) || folder.id === LAUNCH_DOC_TEST_FOLDER_ID}
                    onClick={() => onDeleteFolder(folder)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {documents.map((document) => (
              <FolderDocumentCard
                key={document.id}
                document={document}
                isTestDocument={isLaunchTestDocumentId(document.id)}
                canDownload={canDownload}
                canDelete={canDelete}
                onDelete={() => onDeleteDocument(document)}
                onOpen={() => onOpenDocument(document)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MetadataFields({
  title,
  category,
  classification,
  categoryOptions,
  onTitleChange,
  onCategoryChange,
  onClassificationChange,
}: {
  title: string;
  category: string;
  classification: OrganicoDocumentClassificationId;
  categoryOptions: string[];
  onTitleChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onClassificationChange: (value: OrganicoDocumentClassificationId) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr]">
      <div>
        <Label className="mb-1.5 block text-xs text-muted-foreground">Nome do documento</Label>
        <Input value={title} onChange={(event) => onTitleChange(event.target.value)} placeholder="Ex.: Contrato de experiência" />
      </div>
      <div>
        <Label className="mb-1.5 block text-xs text-muted-foreground">Categoria</Label>
        <select
          value={category}
          onChange={(event) => onCategoryChange(event.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {categoryOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label className="mb-1.5 block text-xs text-muted-foreground">Sigilo</Label>
        <select
          value={classification}
          onChange={(event) => onClassificationChange(event.target.value as OrganicoDocumentClassificationId)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {ORGANICO_DOCUMENT_CLASSIFICATION_OPTIONS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

const PREVIEW_ZOOM_MIN = 0.25;
const PREVIEW_ZOOM_MAX = 4;
const PREVIEW_ZOOM_STEP = 0.25;

type PdfZoomPreviewProps = {
  pdfDocRef: React.RefObject<PdfDocumentHandle | null>;
  pageNumber: number;
  totalPages: number;
  canGoPrevious?: boolean;
  canGoNext?: boolean;
  onPreviousPage?: () => void;
  onNextPage?: () => void;
};

function PdfZoomPreview({
  pdfDocRef,
  pageNumber,
  totalPages,
  canGoPrevious = pageNumber > 1,
  canGoNext = pageNumber < totalPages,
  onPreviousPage,
  onNextPage,
}: PdfZoomPreviewProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const renderRequestRef = useRef(0);
  const pageDimensionsRef = useRef<Map<number, { width: number; height: number }>>(new Map());
  const panStateRef = useRef<{ startX: number; startY: number; scrollLeft: number; scrollTop: number } | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pageBaseSize, setPageBaseSize] = useState<{ width: number; height: number } | null>(null);
  const [renderUrl, setRenderUrl] = useState<string | null>(null);
  const [displaySize, setDisplaySize] = useState<{ width: number; height: number } | null>(null);
  const [rendering, setRendering] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    setZoom(1);
    setPageBaseSize(null);
    setRenderUrl(null);
    setDisplaySize(null);
    panStateRef.current = null;
    setIsPanning(false);
    if (viewportRef.current) {
      viewportRef.current.scrollLeft = 0;
      viewportRef.current.scrollTop = 0;
    }
  }, [pageNumber]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
      setContainerHeight(entry.contentRect.height);
    });
    observer.observe(viewport);
    setContainerWidth(viewport.clientWidth);
    setContainerHeight(viewport.clientHeight);
    return () => observer.disconnect();
  }, []);

  const clampZoom = (value: number) => Math.min(PREVIEW_ZOOM_MAX, Math.max(PREVIEW_ZOOM_MIN, value));
  const fitWidthScale = pageBaseSize && containerWidth > 0 ? Math.min(1, (containerWidth - 32) / pageBaseSize.width) : 1;
  const actualSizeZoom = fitWidthScale > 0 ? clampZoom(1 / fitWidthScale) : 1;
  const previewPadding = 32;
  const contentWidth = displaySize ? displaySize.width + previewPadding : containerWidth;
  const contentHeight = displaySize ? displaySize.height + previewPadding : containerHeight;
  const canPan =
    displaySize != null &&
    (contentWidth > containerWidth + 1 || contentHeight > containerHeight + 1);

  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollLeft = 0;
      viewportRef.current.scrollTop = 0;
    }
  }, [zoom]);

  useEffect(() => {
    const pdf = pdfDocRef.current;
    if (!pdf || containerWidth <= 0) return;

    let cancelled = false;
    const requestId = ++renderRequestRef.current;

    async function renderPreview() {
      setRendering(true);
      try {
        let baseSize = pageDimensionsRef.current.get(pageNumber);
        if (!baseSize) {
          baseSize = await getPdfPageDimensions(pdf, pageNumber);
          pageDimensionsRef.current.set(pageNumber, baseSize);
        }
        if (cancelled || requestId !== renderRequestRef.current) return;

        setPageBaseSize(baseSize);

        const fitWidth = Math.min(1, (containerWidth - previewPadding) / baseSize.width);
        const displayScale = fitWidth * zoom;
        const pdfRenderScale = Math.min(displayScale, MAX_PREVIEW_RENDER_SCALE);
        const rendered = await renderPdfPageToDataUrl(pdf, pageNumber, pdfRenderScale);
        if (cancelled || requestId !== renderRequestRef.current) return;

        setRenderUrl(rendered.dataUrl);
        setDisplaySize({
          width: baseSize.width * displayScale,
          height: baseSize.height * displayScale,
        });
      } catch {
        if (!cancelled && requestId === renderRequestRef.current) {
          setRenderUrl(null);
          setDisplaySize(null);
        }
      } finally {
        if (!cancelled && requestId === renderRequestRef.current) setRendering(false);
      }
    }

    void renderPreview();
    return () => {
      cancelled = true;
    };
  }, [containerWidth, pageNumber, pdfDocRef, zoom]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const delta = event.deltaY > 0 ? -PREVIEW_ZOOM_STEP : PREVIEW_ZOOM_STEP;
      setZoom((current) => clampZoom(Number((current + delta).toFixed(2))));
    };
    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canPan || event.button !== 0) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    panStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };
    setIsPanning(true);
    viewport.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const pan = panStateRef.current;
    const viewport = viewportRef.current;
    if (!pan || !viewport) return;
    viewport.scrollLeft = pan.scrollLeft - (event.clientX - pan.startX);
    viewport.scrollTop = pan.scrollTop - (event.clientY - pan.startY);
    event.preventDefault();
  };

  const endPan = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!panStateRef.current) return;
    panStateRef.current = null;
    setIsPanning(false);
    if (viewport?.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/20 px-3 py-2">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={!canGoPrevious}
            onClick={onPreviousPage}
            title="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={!canGoNext}
            onClick={onNextPage}
            title="Próxima página"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={zoom <= PREVIEW_ZOOM_MIN}
            onClick={() => setZoom((current) => clampZoom(current - PREVIEW_ZOOM_STEP))}
            title="Diminuir zoom"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="min-w-[3.5rem] text-center text-xs font-medium tabular-nums">{Math.round(zoom * 100)}%</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={zoom >= PREVIEW_ZOOM_MAX}
            onClick={() => setZoom((current) => clampZoom(current + PREVIEW_ZOOM_STEP))}
            title="Aumentar zoom"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(1)} title="Ajustar à largura">
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={fitWidthScale <= 0}
            onClick={() => setZoom(actualSizeZoom)}
            title="Tamanho real (100%)"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div
        ref={viewportRef}
        className={`relative min-h-0 flex-1 overflow-auto bg-muted/30 ${canPan ? (isPanning ? "cursor-grabbing select-none" : "cursor-grab") : ""}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      >
        {rendering ? (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center">
            <span className="rounded-full bg-background/90 px-3 py-1 text-xs text-muted-foreground shadow-sm">
              Atualizando visualização...
            </span>
          </div>
        ) : null}
        <div
          className="flex items-center justify-center p-4"
          style={{
            width: Math.max(containerWidth, contentWidth),
            height: Math.max(containerHeight, contentHeight),
            minWidth: Math.max(containerWidth, contentWidth),
            minHeight: Math.max(containerHeight, contentHeight),
          }}
        >
          {renderUrl && displaySize ? (
            <img
              src={renderUrl}
              alt={`Pré-visualização da página ${pageNumber}`}
              draggable={false}
              className="rounded-md border bg-white shadow-sm"
              style={{
                width: Math.round(displaySize.width),
                height: Math.round(displaySize.height),
                maxWidth: "none",
                pointerEvents: "none",
              }}
            />
          ) : (
            <div className="flex min-h-[16rem] items-center justify-center text-sm text-muted-foreground">
              {rendering ? "Carregando página..." : "Pré-visualização indisponível."}
            </div>
          )}
        </div>
      </div>
      <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
        Ampliado: arraste para mover a visualização. Ctrl + scroll ou os botões alteram o zoom.
      </p>
    </div>
  );
}

function BulkArchiveDialog({
  open,
  onOpenChange,
  colaboradorNome,
  initialFile,
  categoryOptions,
  onUploadItems,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  colaboradorNome: string;
  initialFile?: File | null;
  categoryOptions: string[];
  onUploadItems: (items: SplitUploadItem[]) => Promise<void>;
}) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PdfPagePreview[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [ranges, setRanges] = useState<PdfRangeDraft[]>([]);
  const [activePage, setActivePage] = useState(1);
  const [rangeStartPage, setRangeStartPage] = useState<number | null>(null);
  const [rangeEndPage, setRangeEndPage] = useState<number | null>(null);
  const [pendingTitle, setPendingTitle] = useState("");
  const [pendingCategory, setPendingCategory] = useState(DEFAULT_CATEGORY);
  const [pendingClassification, setPendingClassification] = useState<OrganicoDocumentClassificationId>(DEFAULT_CLASSIFICATION);
  const [namingDialogOpen, setNamingDialogOpen] = useState(false);
  const [viewingRangeId, setViewingRangeId] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const pdfDocRef = useRef<PdfDocumentHandle | null>(null);

  const destroyPdfDoc = useCallback(() => {
    void pdfDocRef.current?.destroy();
    pdfDocRef.current = null;
  }, []);

  const handlePdfFile = useCallback(async (nextFile: File | null) => {
    if (!nextFile) return;
    if (nextFile.type !== "application/pdf") {
      toast({ title: "Formato inválido", description: "Selecione um arquivo PDF.", variant: "destructive" });
      return;
    }
    const validation = validateOrganicoDocumentFile(nextFile);
    if (!validation.ok) {
      toast({ title: "Arquivo inválido", description: validation.error, variant: "destructive" });
      return;
    }
    setLoadingPreview(true);
    setFile(nextFile);
    destroyPdfDoc();
    try {
      const pdf = await loadPdfDocument(nextFile);
      pdfDocRef.current = pdf;
      const preview = await renderPdfThumbnails(pdf);
      setPages(preview.pages);
      setTotalPages(preview.totalPages);
      setActivePage(1);
      setRangeStartPage(null);
      setRangeEndPage(null);
      setPendingTitle("");
      setPendingCategory(DEFAULT_CATEGORY);
      setPendingClassification(DEFAULT_CLASSIFICATION);
      setNamingDialogOpen(false);
      setViewingRangeId(null);
      setRanges([]);
    } catch (error) {
      toast({
        title: "Erro ao ler PDF",
        description: error instanceof Error ? error.message : "Não foi possível carregar a prévia das páginas.",
        variant: "destructive",
      });
    } finally {
      setLoadingPreview(false);
    }
  }, [destroyPdfDoc, toast]);

  useEffect(() => {
    if (!open) {
      destroyPdfDoc();
      setFile(null);
      setPages([]);
      setTotalPages(0);
      setRanges([]);
      setActivePage(1);
      setRangeStartPage(null);
      setRangeEndPage(null);
      setPendingTitle("");
      setPendingCategory(DEFAULT_CATEGORY);
      setPendingClassification(DEFAULT_CLASSIFICATION);
      setNamingDialogOpen(false);
      setViewingRangeId(null);
      setLoadingPreview(false);
      setSplitting(false);
    }
  }, [destroyPdfDoc, open]);

  useEffect(() => {
    if (!open || !initialFile || file) return;
    void handlePdfFile(initialFile);
  }, [file, handlePdfFile, initialFile, open]);

  const pendingRange =
    rangeStartPage != null && rangeEndPage != null
      ? {
          startPage: Math.min(rangeStartPage, rangeEndPage),
          endPage: Math.max(rangeStartPage, rangeEndPage),
        }
      : null;

  const pagesInPendingRange = (pageNumber: number): boolean =>
    pendingRange != null && pageNumber >= pendingRange.startPage && pageNumber <= pendingRange.endPage;

  const getPageOwner = (pageNumber: number): PdfRangeDraft | undefined =>
    ranges.find((range) => pageNumber >= range.startPage && pageNumber <= range.endPage);

  const isPageClickable = (pageNumber: number): boolean => {
    const owner = getPageOwner(pageNumber);
    if (!owner) return true;
    return viewingRangeId === owner.id;
  };

  const viewingRange = viewingRangeId ? ranges.find((range) => range.id === viewingRangeId) ?? null : null;

  const viewDocument = (range: PdfRangeDraft) => {
    cancelPendingRange();
    setViewingRangeId(range.id);
    setActivePage(range.startPage);
  };

  const navigateToPage = (pageNumber: number) => {
    if (!isPageClickable(pageNumber)) return;
    setActivePage(pageNumber);
    const owner = getPageOwner(pageNumber);
    if (!owner) setViewingRangeId(null);
  };

  const activePageOwner = getPageOwner(activePage);
  const canMarkRange = activePageOwner == null;

  const navigablePages = useMemo(() => {
    if (viewingRange) {
      return Array.from({ length: viewingRange.endPage - viewingRange.startPage + 1 }, (_, index) => viewingRange.startPage + index);
    }
    return Array.from({ length: totalPages }, (_, index) => index + 1).filter(
      (pageNumber) => !ranges.some((range) => pageNumber >= range.startPage && pageNumber <= range.endPage),
    );
  }, [ranges, totalPages, viewingRange]);

  const navigableIndex = navigablePages.indexOf(activePage);
  const canGoPreviousNav = navigableIndex > 0 || navigablePages.some((pageNumber) => pageNumber < activePage);
  const canGoNextNav =
    (navigableIndex >= 0 && navigableIndex < navigablePages.length - 1) ||
    navigablePages.some((pageNumber) => pageNumber > activePage);

  const goToPreviousPage = () => {
    const currentIndex = navigablePages.indexOf(activePage);
    if (currentIndex > 0) {
      setActivePage(navigablePages[currentIndex - 1]);
      return;
    }
    if (currentIndex === -1 && navigablePages.length > 0) {
      const previousPages = navigablePages.filter((pageNumber) => pageNumber < activePage);
      if (previousPages.length > 0) setActivePage(previousPages[previousPages.length - 1]);
    }
  };

  const goToNextPage = () => {
    const currentIndex = navigablePages.indexOf(activePage);
    if (currentIndex >= 0 && currentIndex < navigablePages.length - 1) {
      setActivePage(navigablePages[currentIndex + 1]);
      return;
    }
    if (currentIndex === -1 && navigablePages.length > 0) {
      const nextPage = navigablePages.find((pageNumber) => pageNumber > activePage);
      if (nextPage) setActivePage(nextPage);
    }
  };

  const validatePendingRange = (start: number, end: number): boolean => {
    const nextStart = Math.min(start, end);
    const nextEnd = Math.max(start, end);
    const overlaps = ranges.some((range) => nextStart <= range.endPage && nextEnd >= range.startPage);
    if (overlaps) {
      toast({
        title: "Páginas já usadas",
        description: "Este intervalo encosta em páginas que já pertencem a outro documento.",
        variant: "destructive",
      });
      setRangeStartPage(null);
      setRangeEndPage(null);
      return false;
    }
    return true;
  };

  const createPendingDocument = () => {
    if (!pendingRange) return;
    const title = pendingTitle.trim();
    if (!title) {
      toast({ title: "Nome obrigatório", description: "Informe o nome do documento antes de criar.", variant: "destructive" });
      return;
    }
    setRanges((current) => [
      ...current,
      {
        id: randomUUID(),
        title,
        startPage: pendingRange.startPage,
        endPage: pendingRange.endPage,
        category: pendingCategory,
        classification: pendingClassification,
      },
    ]);
    setRangeStartPage(null);
    setRangeEndPage(null);
    setPendingTitle("");
    setPendingCategory(DEFAULT_CATEGORY);
    setPendingClassification(DEFAULT_CLASSIFICATION);
    setNamingDialogOpen(false);
    setViewingRangeId(null);
    toast({
      title: "Documento criado",
      description: `${title} foi criado como intervalo ${rangeLabel(pendingRange)}.`,
    });
  };

  const markStartPage = () => {
    if (!canMarkRange) return;
    setViewingRangeId(null);
    setRangeStartPage(activePage);
    setRangeEndPage(null);
    setPendingTitle("");
  };

  const markEndPage = () => {
    if (!canMarkRange || rangeStartPage == null) return;
    if (!validatePendingRange(rangeStartPage, activePage)) return;
    setRangeEndPage(activePage);
    setPendingTitle(`Documento ${ranges.length + 1}`);
  };

  const cancelPendingRange = () => {
    setRangeStartPage(null);
    setRangeEndPage(null);
    setPendingTitle("");
    setPendingCategory(DEFAULT_CATEGORY);
    setPendingClassification(DEFAULT_CLASSIFICATION);
    setNamingDialogOpen(false);
  };

  const removeRange = (rangeId: string) => {
    setRanges((current) => current.filter((item) => item.id !== rangeId));
    if (viewingRangeId === rangeId) setViewingRangeId(null);
  };

  const openNamingDialog = () => {
    setPendingTitle((current) => current.trim() || `Documento ${ranges.length + 1}`);
    setNamingDialogOpen(true);
  };

  const handleSplit = async () => {
    if (!file) return;
    const error = validateRanges(ranges, totalPages);
    if (error) {
      toast({ title: "Confira os cortes", description: error, variant: "destructive" });
      return;
    }
    setSplitting(true);
    try {
      const items = await splitPdfByRanges(file, ranges, colaboradorNome);
      await onUploadItems(items);
      toast({ title: "PDF dividido", description: `${items.length} documento(s) gravado(s) no banco.` });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Erro ao dividir PDF",
        description: error instanceof Error ? error.message : "Não foi possível gerar os documentos separados.",
        variant: "destructive",
      });
    } finally {
      setSplitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(92dvh,56rem)] max-w-6xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Arquivamento em massa</DialogTitle>
          <DialogDescription>
            Envie um PDF único, visualize as páginas e defina quais intervalos formam cada documento.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="rounded-lg border border-dashed border-border p-4">
            <Label className="mb-2 block text-sm font-medium">PDF da pasta física</Label>
            <Input type="file" accept="application/pdf,.pdf" onChange={(event) => void handlePdfFile(event.target.files?.[0] ?? null)} />
            <p className="mt-2 text-xs text-muted-foreground">
              O arquivo é processado nesta aba e, ao concluir, cada documento é gravado no banco com capa e metadados.
            </p>
          </div>

          {loadingPreview ? <p className="text-sm text-muted-foreground">Carregando prévia das páginas...</p> : null}

          {file && pages.length > 0 ? (
            <div className="grid min-h-[38rem] gap-4 xl:grid-cols-[12rem_minmax(0,1fr)_18rem]">
              <aside className="min-h-0 rounded-lg border border-border bg-muted/20 p-3">
                <div className="mb-2">
                  <h4 className="text-sm font-semibold">Páginas ({totalPages})</h4>
                  <p className="text-xs text-muted-foreground">
                    {viewingRange
                      ? `Visualizando "${viewingRange.title}". Clique nas páginas dele ou escolha uma página livre.`
                      : "Clique em páginas livres para navegar."}
                  </p>
                </div>
                <div className="max-h-[29rem] space-y-2 overflow-y-auto pr-1">
                  {pages.map((page) => {
                    const owner = getPageOwner(page.pageNumber);
                    const clickable = isPageClickable(page.pageNumber);
                    const isDisabled = owner != null && !clickable;
                    return (
                      <button
                        key={page.pageNumber}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => navigateToPage(page.pageNumber)}
                        className={`w-full rounded-lg border p-2 text-left transition-colors ${
                          isDisabled
                            ? "cursor-not-allowed border-border/60 bg-muted/40 opacity-60"
                            : activePage === page.pageNumber
                              ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                              : pagesInPendingRange(page.pageNumber)
                                ? "border-primary/70 bg-primary/10"
                                : rangeStartPage === page.pageNumber
                                  ? "border-primary bg-primary/10"
                                  : owner && viewingRangeId === owner.id
                                    ? "border-primary/40 bg-primary/5 hover:border-primary/60"
                                    : "border-border bg-background hover:border-primary/50"
                        }`}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold">Página {page.pageNumber}</span>
                          {owner ? <span className="truncate text-muted-foreground">{owner.title}</span> : null}
                          {!owner && pagesInPendingRange(page.pageNumber) ? <span className="text-primary">Selecionada</span> : null}
                          {isDisabled ? <span className="text-muted-foreground">Indisponível</span> : null}
                        </div>
                        <img src={page.imageUrl} alt={`Página ${page.pageNumber}`} className="w-full rounded border bg-white" />
                      </button>
                    );
                  })}
                </div>
              </aside>

              <div className="flex min-h-0 flex-col rounded-lg border border-border bg-background">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                  <div>
                    <h4 className="text-sm font-semibold">Pré-visualização</h4>
                    <p className="text-xs text-muted-foreground">
                      Página {activePage} de {totalPages}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={rangeStartPage === activePage ? "default" : "outline"}
                      size="sm"
                      disabled={!canMarkRange}
                      onClick={markStartPage}
                    >
                      Marcar início
                    </Button>
                    {rangeStartPage != null && !pendingRange ? (
                      <Button
                        type="button"
                        variant={rangeEndPage === activePage ? "default" : "outline"}
                        size="sm"
                        disabled={!canMarkRange}
                        onClick={markEndPage}
                      >
                        Marcar fim
                      </Button>
                    ) : null}
                  </div>
                </div>
                {file && totalPages > 0 ? (
                  <PdfZoomPreview
                    pdfDocRef={pdfDocRef}
                    pageNumber={activePage}
                    totalPages={totalPages}
                    canGoPrevious={canGoPreviousNav}
                    canGoNext={canGoNextNav}
                    onPreviousPage={goToPreviousPage}
                    onNextPage={goToNextPage}
                  />
                ) : (
                  <div className="flex min-h-[20rem] flex-1 items-center justify-center bg-muted/30 text-sm text-muted-foreground">
                    Selecione uma página para visualizar.
                  </div>
                )}
                <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
                  {viewingRange
                    ? `Visualizando "${viewingRange.title}" (${rangeLabel(viewingRange)}). Clique em uma página livre para iniciar um novo recorte.`
                    : pendingRange
                      ? `Intervalo selecionado: ${rangeLabel(pendingRange)}. Confira as páginas antes de criar o documento.`
                      : rangeStartPage != null
                        ? `Início marcado: página ${rangeStartPage}. Agora navegue até a página final e clique em “Marcar fim”.`
                        : activePageOwner
                          ? "Esta página já pertence a um documento. Clique no nome dele na lista à direita para visualizar."
                          : "Marque a página de início para começar o recorte."}
                </div>
              </div>

              <aside className="space-y-3">
                {pendingRange ? (
                  <div className="space-y-3 rounded-lg border border-primary/50 bg-primary/5 p-3">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">Intervalo selecionado</h4>
                      <p className="text-xs text-muted-foreground">{rangeLabel(pendingRange)}</p>
                    </div>
                    <Button type="button" size="sm" onClick={openNamingDialog}>
                      Criar novo documento
                    </Button>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold">Documentos criados</h4>
                    <p className="text-xs text-muted-foreground">Clique para visualizar.</p>
                  </div>
                </div>
                {ranges.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                    Marque uma página de início e uma página de fim para criar o primeiro documento.
                  </div>
                ) : null}
                {ranges.map((range, index) => (
                  <div
                    key={range.id}
                    className={`rounded-lg border p-2 ${
                      viewingRangeId === range.id ? "border-primary bg-primary/5" : "border-border bg-background"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => viewDocument(range)}>
                        <span className="block truncate text-sm font-semibold">{range.title || `Documento ${index + 1}`}</span>
                        <span className="block text-xs text-muted-foreground">{rangeLabel(range)}</span>
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-destructive hover:text-destructive"
                        onClick={() => removeRange(range.id)}
                      >
                        Remover
                      </Button>
                    </div>
                  </div>
                ))}
              </aside>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSplit} disabled={!file || splitting || loadingPreview}>
            {splitting ? "Gerando..." : "Gerar documentos separados"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <Dialog open={namingDialogOpen} onOpenChange={setNamingDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nomear documento</DialogTitle>
            <DialogDescription>
              Informe um nome para o documento criado a partir de {pendingRange ? rangeLabel(pendingRange) : "páginas selecionadas"}.
            </DialogDescription>
          </DialogHeader>
          <MetadataFields
            title={pendingTitle}
            category={pendingCategory}
            classification={pendingClassification}
            categoryOptions={categoryOptions}
            onTitleChange={setPendingTitle}
            onCategoryChange={setPendingCategory}
            onClassificationChange={setPendingClassification}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNamingDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={createPendingDocument}>
              Criar documento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

export function OrganicoDocumentArchivePanel({
  open,
  colaboradorMatricula,
  colaboradorNome,
  permissions,
}: OrganicoDocumentArchivePanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkInitialFile, setBulkInitialFile] = useState<File | null>(null);
  const [currentFolder, setCurrentFolder] = useState<ArchiveFolder | null>(null);
  const [folderNameInput, setFolderNameInput] = useState("");
  const [pendingFolderAction, setPendingFolderAction] = useState<PendingFolderAction | null>(null);
  const [pendingDeleteAction, setPendingDeleteAction] = useState<PendingDeleteAction | null>(null);
  const [pendingAttachmentAction, setPendingAttachmentAction] = useState<PendingAttachmentAction | null>(null);
  const [pendingUniqueDocument, setPendingUniqueDocument] = useState<PendingAttachmentAction | null>(null);
  const [uniqueDocTitle, setUniqueDocTitle] = useState("");
  const [uniqueDocCategory, setUniqueDocCategory] = useState(DEFAULT_CATEGORY);
  const [uniqueDocClassification, setUniqueDocClassification] = useState<OrganicoDocumentClassificationId>(DEFAULT_CLASSIFICATION);
  const [uploading, setUploading] = useState(false);
  const [launchQueueTick, setLaunchQueueTick] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const archiveQueryKey = useMemo(
    () => ["organico-documents", colaboradorMatricula] as const,
    [colaboradorMatricula],
  );

  const {
    data: folders = [],
    isLoading: loadingFolders,
    isError: archiveLoadError,
    error: archiveError,
  } = useQuery({
    queryKey: archiveQueryKey,
    queryFn: () => getOrganicoDocuments(colaboradorMatricula, colaboradorNome),
    enabled: open && Boolean(colaboradorMatricula) && isOrganicoDocumentsApiConfigured(),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!open) return;
    const refresh = () => setLaunchQueueTick((value) => value + 1);
    window.addEventListener(LAUNCH_DOC_QUEUE_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(LAUNCH_DOC_QUEUE_CHANGED_EVENT, refresh);
  }, [open]);

  const displayFolders = useMemo(() => {
    void launchQueueTick;
    return mergeLaunchDocumentsIntoFolders(folders, colaboradorMatricula);
  }, [folders, colaboradorMatricula, launchQueueTick]);

  const { data: faltasCadastros } = useQuery({
    queryKey: ["faltas-cadastros"],
    queryFn: getFaltasCadastros,
    staleTime: 5 * 60 * 1000,
  });

  const documentCategoryOptions = useMemo(
    () => resolveDocumentCategoryOptions(faltasCadastros?.categoriasDocumentos),
    [faltasCadastros?.categoriasDocumentos],
  );

  const canView = hasDocumentAccess(permissions);
  const canDownload = permissions ? permissions.download || permissions.view : true;
  const canDelete = permissions ? permissions.delete : true;
  const canDeleteGlobalForOne = permissions
    ? permissions.delete && permissions.deleteGlobalForOne
    : true;
  const canDeleteGlobalForAll = permissions
    ? permissions.delete && permissions.deleteGlobalForAll
    : true;
  const canDeleteFolder = (folder: ArchiveFolder) => {
    if (folder.id === LAUNCH_DOC_TEST_FOLDER_ID) return false;
    if (folder.scope === "global") {
      return canDeleteGlobalForOne || canDeleteGlobalForAll;
    }
    return canDelete;
  };
  const canCreate = permissions ? permissions.create : true;
  const canEdit = permissions ? permissions.edit : true;

  const refreshArchive = async () => {
    await queryClient.invalidateQueries({ queryKey: archiveQueryKey });
  };

  const uploadDocumentFile = async (
    file: File,
    metadata: {
      title: string;
      category: string;
      classification: OrganicoDocumentClassificationId;
      sourceKind?: "individual" | "bulk";
      sourcePages?: string;
      coverUrl?: string;
    },
  ) => {
    if (!currentFolder) {
      toast({ title: "Abra uma pasta", description: "Entre em uma pasta antes de inserir anexos.", variant: "destructive" });
      return;
    }
    if (!isOrganicoDocumentsApiConfigured()) {
      toast({ title: "API indisponível", description: "Não foi possível gravar o documento no servidor.", variant: "destructive" });
      return;
    }
    const validation = validateOrganicoDocumentFile(file);
    if (!validation.ok) {
      toast({ title: "Arquivo inválido", description: validation.error, variant: "destructive" });
      return;
    }
    const title = metadata.title.trim();
    if (!title || !metadata.category.trim()) {
      toast({ title: "Dados incompletos", description: "Informe nome e categoria.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const coverDataUrl = metadata.coverUrl ?? (await generateDocumentCoverUrl(file));
      const cover = coverDataUrl ? await coverBlobFromDataUrl(coverDataUrl) : null;
      await uploadOrganicoDocument({
        matricula: colaboradorMatricula,
        colaboradorNome,
        title,
        category: metadata.category,
        classification: metadata.classification,
        folderScope: currentFolder.scope,
        folderId: currentFolder.id,
        file,
        cover,
        sourceKind: metadata.sourceKind,
        sourcePages: metadata.sourcePages ?? null,
      });
      await refreshArchive();
      toast({ title: "Documento gravado", description: `${title} foi salvo no banco.` });
    } catch (error) {
      toast({
        title: "Falha ao gravar",
        description: error instanceof Error ? error.message : "Não foi possível salvar o documento.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const uploadSplitItems = async (items: SplitUploadItem[]) => {
    for (const item of items) {
      await uploadDocumentFile(item.file, {
        title: item.title,
        category: item.category,
        classification: item.classification,
        sourceKind: "bulk",
        sourcePages: item.sourcePages,
        coverUrl: item.coverUrl,
      });
    }
  };

  const openDocument = async (document: OrganicoArchiveDocument) => {
    try {
      if (isLaunchTestDocumentId(document.id)) {
        const url = await getLaunchTestDocumentObjectUrl(document.id);
        if (!url) throw new Error("Documento de teste indisponível.");
        window.open(url, "_blank", "noopener");
        return;
      }
      const url =
        document.downloadUrl ??
        (await fetchOrganicoDocumentUrl({
          matricula: colaboradorMatricula,
          documentId: document.id,
        }));
      window.open(url, "_blank", "noopener");
    } catch (error) {
      toast({
        title: "Não foi possível abrir",
        description: error instanceof Error ? error.message : "Documento indisponível.",
        variant: "destructive",
      });
    }
  };

  const requestDeleteDocument = (document: OrganicoArchiveDocument) => {
    setPendingDeleteAction({ type: "document", documentId: document.id, title: document.title });
  };

  const requestDeleteFolder = (folder: ArchiveFolder) => {
    if (folder.scope === "global") {
      if (canDeleteGlobalForOne && canDeleteGlobalForAll) {
        setPendingDeleteAction({ type: "folder-global-choice", folder });
        return;
      }
      if (canDeleteGlobalForAll) {
        setPendingDeleteAction({ type: "folder", folder, globalMode: "delete_all" });
        return;
      }
      if (canDeleteGlobalForOne) {
        setPendingDeleteAction({ type: "folder", folder, globalMode: "delete_one" });
        return;
      }
      return;
    }
    if (!canDelete) return;
    setPendingDeleteAction({ type: "folder", folder });
  };

  const chooseGlobalFolderDeleteMode = (globalMode: "delete_one" | "delete_all") => {
    setPendingDeleteAction((current) => {
      if (current?.type !== "folder-global-choice") return current;
      return { type: "folder", folder: current.folder, globalMode };
    });
  };

  const confirmDeleteAction = async () => {
    if (!pendingDeleteAction) return;
    try {
      if (pendingDeleteAction.type === "document") {
        if (isLaunchTestDocumentId(pendingDeleteAction.documentId)) {
          await removeLaunchDocumentById(pendingDeleteAction.documentId);
          setLaunchQueueTick((value) => value + 1);
          toast({ title: "Documento de teste removido", description: "Removido da fila local." });
        } else {
          await deleteOrganicoDocument({
            matricula: colaboradorMatricula,
            documentId: pendingDeleteAction.documentId,
            confirm: true,
          });
          toast({ title: "Documento excluído", description: "O arquivo foi removido deste colaborador." });
        }
      } else {
        const folderAction = pendingDeleteAction;
        await hideOrganicoArchiveFolder({
          matricula: colaboradorMatricula,
          folderId: folderAction.folder.id,
          scope: folderAction.folder.scope,
          globalMode: folderAction.folder.scope === "global" ? folderAction.globalMode ?? "delete_one" : undefined,
          confirm: true,
        });
        if (currentFolder?.id === folderAction.folder.id) setCurrentFolder(null);
        const isGlobalDeleteOne =
          folderAction.folder.scope === "global" && (folderAction.globalMode ?? "delete_one") === "delete_one";
        const isGlobalDeleteAll = folderAction.folder.scope === "global" && folderAction.globalMode === "delete_all";
        toast({
          title: isGlobalDeleteOne || isGlobalDeleteAll ? "Pasta global excluída" : "Pasta excluída",
          description: isGlobalDeleteOne
            ? "A pasta global foi excluída apenas deste colaborador. Nos demais cards ela permanece disponível."
            : isGlobalDeleteAll
              ? "A pasta global foi excluída para todos os colaboradores."
              : "A pasta individual foi excluída deste colaborador.",
        });
      }
      if (
        pendingDeleteAction.type !== "document" ||
        !isLaunchTestDocumentId(pendingDeleteAction.documentId)
      ) {
        await refreshArchive();
      }
    } catch (error) {
      toast({
        title: "Falha ao excluir",
        description: error instanceof Error ? error.message : "Operação não concluída.",
        variant: "destructive",
      });
    } finally {
      setPendingDeleteAction(null);
    }
  };

  useEffect(() => {
    if (!open) {
      setBulkOpen(false);
      setBulkInitialFile(null);
      setCurrentFolder(null);
    }
  }, [open]);

  const requestAttachmentMode = (file: File | null) => {
    if (!file || !canCreate) return;
    if (!currentFolder) {
      toast({ title: "Abra uma pasta", description: "Entre em uma pasta antes de inserir anexos.", variant: "destructive" });
      return;
    }
    setPendingAttachmentAction({ file });
  };

  const handleAttachmentAsUnique = () => {
    const file = pendingAttachmentAction?.file;
    if (!file) return;
    setUniqueDocTitle(file.name.replace(/\.[^.]+$/, "") || "Documento");
    setUniqueDocCategory(documentCategoryOptions[0] ?? DEFAULT_CATEGORY);
    setUniqueDocClassification(DEFAULT_CLASSIFICATION);
    setPendingUniqueDocument({ file });
    setPendingAttachmentAction(null);
  };

  const confirmUniqueDocument = () => {
    const pending = pendingUniqueDocument;
    if (!pending) return;
    void uploadDocumentFile(pending.file, {
      title: uniqueDocTitle,
      category: uniqueDocCategory,
      classification: uniqueDocClassification,
      sourceKind: "individual",
    }).then(() => setPendingUniqueDocument(null));
  };

  const handleAttachmentAsBatch = () => {
    const file = pendingAttachmentAction?.file;
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast({ title: "Lote exige PDF", description: "Para documento em lote, selecione um arquivo PDF.", variant: "destructive" });
      setPendingAttachmentAction(null);
      return;
    }
    setBulkInitialFile(file);
    setBulkOpen(true);
    setPendingAttachmentAction(null);
  };

  const requestCreateFolder = () => {
    if (!canCreate) return;
    setFolderNameInput("");
    setPendingFolderAction({
      type: "choose-scope",
      parent: currentFolder ? { id: currentFolder.id, scope: currentFolder.scope } : null,
    });
  };

  const chooseFolderScope = (scope: OrganicoArchiveFolderScope) => {
    setPendingFolderAction((current) => {
      if (current?.type !== "choose-scope") return current;
      return { type: "create", parent: current.parent, name: "", scope };
    });
  };

  const dismissChooseScopeDialog = () => {
    setPendingFolderAction((current) => (current?.type === "choose-scope" ? null : current));
  };

  const dismissCreateRenameDialog = () => {
    setPendingFolderAction((current) =>
      current?.type === "create" || current?.type === "rename" ? null : current,
    );
  };

  const requestRenameFolder = (folder: ArchiveFolder) => {
    if (!canEdit) return;
    setFolderNameInput(folder.name);
    setPendingFolderAction({ type: "rename", folder });
  };

  const confirmFolderAction = async () => {
    const name = folderNameInput.trim();
    if (!name || !pendingFolderAction) {
      toast({ title: "Nome obrigatório", description: "Informe um nome para a pasta.", variant: "destructive" });
      return;
    }
    if (!isOrganicoDocumentsApiConfigured()) {
      toast({ title: "API indisponível", description: "Não foi possível concluir a operação no servidor.", variant: "destructive" });
      return;
    }
    try {
      if (pendingFolderAction.type === "create") {
        const scope = pendingFolderAction.scope ?? "local";
        const created = await createOrganicoArchiveFolder({
          matricula: colaboradorMatricula,
          colaboradorNome,
          name,
          scope,
          parentId: pendingFolderAction.parent?.id ?? null,
          parentScope: pendingFolderAction.parent?.scope ?? null,
        });
        await refreshArchive();
        const updatedFolders = await queryClient.fetchQuery({
          queryKey: archiveQueryKey,
          queryFn: () => getOrganicoDocuments(colaboradorMatricula, colaboradorNome),
        });
        const nextFolder = findArchiveFolder(updatedFolders, created.id, created.scope);
        if (nextFolder) setCurrentFolder(nextFolder);
        toast({
          title: scope === "global" ? "Pasta global criada" : "Pasta individual criada",
          description: scope === "global" ? "Visível em todos os colaboradores." : "Visível apenas neste colaborador.",
        });
      } else if (pendingFolderAction.type === "rename") {
        await renameOrganicoArchiveFolder({
          matricula: colaboradorMatricula,
          colaboradorNome,
          folderId: pendingFolderAction.folder.id,
          scope: pendingFolderAction.folder.scope,
          name,
        });
        await refreshArchive();
        if (currentFolder?.id === pendingFolderAction.folder.id) {
          setCurrentFolder((prev) => (prev ? { ...prev, name } : prev));
        }
        toast({ title: "Pasta renomeada", description: "Nome atualizado com sucesso." });
      }
      setPendingFolderAction(null);
      setFolderNameInput("");
    } catch (error) {
      toast({
        title: "Falha na pasta",
        description: error instanceof Error ? error.message : "Operação não concluída.",
        variant: "destructive",
      });
    }
  };

  const handleClearLaunchTestData = async () => {
    try {
      await clearLaunchDocumentQueue();
      clearLaunchTestRecords();
      setLaunchQueueTick((value) => value + 1);
      if (currentFolder?.id === LAUNCH_DOC_TEST_FOLDER_ID) setCurrentFolder(null);
      toast({
        title: "Testes locais limpos",
        description: "Fila de anexos e lançamentos de teste foram removidos deste navegador.",
      });
    } catch (error) {
      toast({
        title: "Falha ao limpar",
        description: error instanceof Error ? error.message : "Não foi possível limpar os dados de teste.",
        variant: "destructive",
      });
    }
  };

  if (!canView) return null;

  return (
    <>
      <div className="space-y-4">
        {isLaunchDocTestMode() ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
            <p className="text-amber-950 dark:text-amber-100">
              Modo teste de anexos — documentos e lançamentos não foram enviados ao servidor.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => void handleClearLaunchTestData()}>
              Limpar testes locais
            </Button>
          </div>
        ) : null}
        {loadingFolders ? <p className="text-sm text-muted-foreground">Carregando arquivamento...</p> : null}
        {archiveLoadError ? (
          <p className="text-sm text-destructive" role="alert">
            {archiveError instanceof Error
              ? archiveError.message
              : "Não foi possível carregar as pastas do arquivamento."}
          </p>
        ) : null}
        <div className="grid gap-4">
          <FolderTree
            folders={displayFolders}
            currentFolder={currentFolder}
            canCreate={canCreate}
            canEdit={canEdit}
            canDownload={canDownload}
            canDelete={canDelete}
            canDeleteFolder={canDeleteFolder}
            onDeleteDocument={requestDeleteDocument}
            onOpenDocument={(document) => void openDocument(document)}
            onOpenFolder={setCurrentFolder}
            onGoToFolder={setCurrentFolder}
            onCreateFolder={requestCreateFolder}
            onRenameFolder={requestRenameFolder}
            onDeleteFolder={requestDeleteFolder}
          />
        </div>

        {currentFolder ? (
          <div
            className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-8 text-center"
            onDragOver={(event) => {
              if (!canCreate) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }}
            onDrop={(event) => {
              event.preventDefault();
              requestAttachmentMode(event.dataTransfer.files?.[0] ?? null);
            }}
          >
            <Paperclip className="mx-auto h-16 w-16 text-primary" />
            <h4 className="mt-3 text-base font-semibold text-foreground">Arraste um anexo para esta pasta</h4>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Ao inserir ou arrastar um arquivo, o sistema perguntará se ele é único ou em lote.
            </p>
            <Button
              type="button"
              className="mt-4"
              variant="outline"
              disabled={!canCreate || uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? "Gravando..." : "Inserir anexo"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
              onChange={(event) => {
                requestAttachmentMode(event.target.files?.[0] ?? null);
                event.target.value = "";
              }}
            />
          </div>
        ) : null}
      </div>

      <BulkArchiveDialog
        open={bulkOpen}
        onOpenChange={(nextOpen) => {
          setBulkOpen(nextOpen);
          if (!nextOpen) setBulkInitialFile(null);
        }}
        colaboradorNome={colaboradorNome}
        initialFile={bulkInitialFile}
        categoryOptions={documentCategoryOptions}
        onUploadItems={uploadSplitItems}
      />

      <AlertDialog open={pendingFolderAction?.type === "choose-scope"} onOpenChange={(next) => !next && dismissChooseScopeDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Escopo da nova pasta</AlertDialogTitle>
            <AlertDialogDescription>
              Escolha se a pasta será visível em todos os colaboradores (global) ou apenas neste card (individual).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button type="button" variant="outline" onClick={() => chooseFolderScope("local")}>
              Individual (este colaborador)
            </Button>
            <Button type="button" onClick={() => chooseFolderScope("global")}>
              Global (todos)
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingFolderAction?.type === "create" || pendingFolderAction?.type === "rename"}
        onOpenChange={(next) => !next && dismissCreateRenameDialog()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingFolderAction?.type === "rename"
                ? pendingFolderAction.folder.scope === "global"
                  ? "Renomear pasta global"
                  : "Renomear pasta individual"
                : pendingFolderAction?.type === "create" && pendingFolderAction.scope === "global"
                  ? "Criar pasta global"
                  : "Criar pasta individual"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingFolderAction?.type === "rename" && pendingFolderAction.folder.scope === "global"
                ? "Renomear uma pasta global altera o nome para todos os colaboradores que ainda a visualizam."
                : pendingFolderAction?.type === "create" && pendingFolderAction.scope === "global"
                  ? "Esta pasta ficará disponível em todos os cards de colaboradores."
                  : "Esta pasta ficará disponível apenas neste colaborador."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label className="mb-1.5 block text-xs text-muted-foreground">Nome da pasta</Label>
            <Input value={folderNameInput} onChange={(event) => setFolderNameInput(event.target.value)} autoFocus />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button type="button" onClick={() => void confirmFolderAction()} disabled={!folderNameInput.trim()}>
              {pendingFolderAction?.type === "rename" ? "Salvar nome" : "Criar pasta"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingDeleteAction?.type === "folder-global-choice"}
        onOpenChange={(next) => !next && setPendingDeleteAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pasta global</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteAction?.type === "folder-global-choice"
                ? `Deseja excluir a pasta global "${pendingDeleteAction.folder.name}" apenas deste colaborador ou para todos os colaboradores?`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:items-stretch">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {canDeleteGlobalForOne ? (
              <Button type="button" variant="outline" onClick={() => chooseGlobalFolderDeleteMode("delete_one")}>
                Apenas deste colaborador
              </Button>
            ) : null}
            {canDeleteGlobalForAll ? (
              <Button
                type="button"
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => chooseGlobalFolderDeleteMode("delete_all")}
              >
                Todos os colaboradores
              </Button>
            ) : null}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingDeleteAction !== null && pendingDeleteAction.type !== "folder-global-choice"}
        onOpenChange={(next) => !next && setPendingDeleteAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteAction?.type === "document"
                ? `Excluir permanentemente o documento "${pendingDeleteAction.title}" deste colaborador? Esta ação não pode ser desfeita.`
                : pendingDeleteAction?.type === "folder" && pendingDeleteAction.folder.scope === "global"
                  ? pendingDeleteAction.globalMode === "delete_all"
                    ? `Excluir a pasta global "${pendingDeleteAction.folder.name}" para todos os colaboradores? Documentos dentro dela também serão removidos para todos. Esta ação não pode ser desfeita.`
                    : `Excluir a pasta global "${pendingDeleteAction.folder.name}" apenas deste colaborador? Documentos dentro dela serão removidos só deste card. Nos demais colaboradores a pasta continuará disponível.`
                  : `Excluir a pasta "${pendingDeleteAction?.type === "folder" ? pendingDeleteAction.folder.name : ""}" deste colaborador? Documentos dentro dela também serão removidos.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDeleteAction()}
            >
              Confirmar exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pendingAttachmentAction !== null} onOpenChange={(next) => !next && setPendingAttachmentAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Como deseja inserir este documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Escolha se o arquivo é um documento único ou se é um PDF em lote que precisa ser dividido por páginas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button type="button" variant="outline" onClick={handleAttachmentAsUnique}>
              Documento único
            </Button>
            <AlertDialogAction onClick={handleAttachmentAsBatch}>Documento em lote</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={pendingUniqueDocument !== null} onOpenChange={(nextOpen) => !nextOpen && setPendingUniqueDocument(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Categorizar documento</DialogTitle>
            <DialogDescription>
              Antes de concluir o upload, informe o nome, a categoria e o nível de sigilo deste documento.
            </DialogDescription>
          </DialogHeader>
          <MetadataFields
            title={uniqueDocTitle}
            category={uniqueDocCategory}
            classification={uniqueDocClassification}
            categoryOptions={documentCategoryOptions}
            onTitleChange={setUniqueDocTitle}
            onCategoryChange={setUniqueDocCategory}
            onClassificationChange={setUniqueDocClassification}
          />
          <p className="text-xs text-muted-foreground">
            As categorias são cadastradas em Faltas e Atestados → Cadastros → Categorias de documentos.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingUniqueDocument(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={confirmUniqueDocument}
              disabled={!uniqueDocTitle.trim() || !uniqueDocCategory.trim() || uploading}
            >
              {uploading ? "Gravando..." : "Inserir documento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

