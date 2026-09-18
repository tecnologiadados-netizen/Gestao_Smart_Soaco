import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, Printer, X } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@qualidade/components/ui/button";
import {
  blobForInlinePreview,
  clearViewerPayload,
  dataUrlToBlob,
  downloadQualidadeArquivo,
  extensionFromStoragePath,
  isImageFile,
  isPdfFile,
  isSpreadsheetFile,
  nomeArquivoComExtensao,
  readViewerPayload,
} from "@qualidade/lib/documents/file-actions";
import { cn } from "@qualidade/lib/utils";
import "@qualidade/qualidade-module.css";

type PreviewKind = "pdf" | "image" | "spreadsheet" | "file";

type ViewerSource = {
  filename: string;
  mode: "view" | "print";
  dataUrl?: string;
  src?: string;
  ext?: string;
};

type SheetPreview = { name: string; html: string };

function decodeSrc(raw: string | null): string {
  if (!raw?.trim()) return "";
  let value = raw.trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    /* já decodificado */
  }
  if (value.includes("/uploads/") && !value.startsWith("/uploads/")) {
    value = value.slice(value.indexOf("/uploads/"));
  }
  return value;
}

function resolvePreviewKind(source: ViewerSource, mimeType?: string): PreviewKind {
  const fromSrc = source.src ? source.src.split("?")[0]?.split("/").pop() ?? "" : "";
  const typedName = source.ext
    ? `${source.filename.replace(/\.[^.]+$/, "")}.${source.ext}`
    : source.filename.includes(".")
      ? source.filename
      : fromSrc || source.filename;

  if (isPdfFile(typedName, mimeType)) return "pdf";
  if (isImageFile(typedName, mimeType)) return "image";
  if (isSpreadsheetFile(typedName, mimeType)) return "spreadsheet";
  return "file";
}

function spreadsheetFromArrayBuffer(arrayBuffer: ArrayBuffer): SheetPreview[] {
  const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const html = sheet
      ? XLSX.utils.sheet_to_html(sheet, {
          id: `sgq-sheet-${name.replace(/[^a-z0-9]+/gi, "-")}`,
        })
      : "<p>Planilha vazia.</p>";
    return { name, html };
  }).filter((s) => s.html);
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(blob);
  });
}

function ViewerShell({ children }: { children: ReactNode }) {
  return (
    <div className="qualidade-module sgq-file-viewer flex min-h-screen flex-col bg-background text-foreground">
      {children}
    </div>
  );
}

function VisualizarDocumentoContent() {
  const [searchParams] = useSearchParams();
  const key = searchParams.get("k");
  const srcParam = decodeSrc(searchParams.get("src"));
  const nomeParam = searchParams.get("n");
  const extParam = (searchParams.get("ext") ?? "").replace(/^\./, "").toLowerCase();
  const modeParam = searchParams.get("mode") === "view" ? "view" : "print";

  const storagePayload = useMemo(() => readViewerPayload(key), [key]);

  const source: ViewerSource | null = useMemo(() => {
    if (srcParam.startsWith("/uploads/")) {
      const fromPath = srcParam.split("/").pop() ?? "arquivo";
      return {
        filename: nomeArquivoComExtensao(
          (nomeParam ?? "").trim() || fromPath,
          srcParam
        ),
        mode: modeParam,
        src: srcParam,
        ext: extParam || extensionFromStoragePath(srcParam),
      };
    }
    if (storagePayload) {
      return {
        filename: storagePayload.filename,
        mode: storagePayload.mode,
        dataUrl: storagePayload.dataUrl,
        ext: extensionFromStoragePath(storagePayload.filename),
      };
    }
    return null;
  }, [srcParam, nomeParam, extParam, modeParam, storagePayload]);

  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [sheets, setSheets] = useState<SheetPreview[]>([]);
  const [sheetAtiva, setSheetAtiva] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [baixando, setBaixando] = useState(false);

  const previewKind: PreviewKind = source
    ? resolvePreviewKind(source)
    : "file";

  useEffect(() => {
    if (!source) {
      setLoading(false);
      return;
    }

    let active = true;
    let createdUrl: string | null = null;

    async function preparePreview() {
      setLoading(true);
      setError(null);
      setSheets([]);
      setObjectUrl(null);
      try {
        let blob: Blob | null = null;
        let dataUrl = source!.dataUrl;

        if (source!.src) {
          const res = await fetch(source!.src);
          if (!res.ok) {
            throw new Error("Não foi possível carregar o arquivo no servidor.");
          }
          blob = await res.blob();
        } else if (dataUrl) {
          blob = dataUrlToBlob(dataUrl);
        }

        if (!blob) {
          throw new Error("Arquivo indisponível.");
        }

        const kind = resolvePreviewKind(source!, blob.type);

        if (kind === "spreadsheet") {
          const previews = spreadsheetFromArrayBuffer(await blob.arrayBuffer());
          if (!active) return;
          if (!previews.length) {
            setError("Planilha vazia.");
            return;
          }
          setSheets(previews);
          setSheetAtiva(0);
          return;
        }

        if (kind === "pdf" || kind === "image") {
          if (!dataUrl) dataUrl = await blobToDataUrl(blob);
          const typed = blobForInlinePreview(dataUrl, source!.filename);
          createdUrl = URL.createObjectURL(typed);
          if (!active) {
            URL.revokeObjectURL(createdUrl);
            return;
          }
          setObjectUrl(createdUrl);
          return;
        }

        createdUrl = URL.createObjectURL(blob);
        if (!active) {
          URL.revokeObjectURL(createdUrl);
          return;
        }
        setObjectUrl(createdUrl);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Não foi possível preparar a visualização do arquivo."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void preparePreview();

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [source]);

  useEffect(() => {
    if (!key) return;
    return () => clearViewerPayload(key);
  }, [key]);

  async function handleBaixar() {
    if (!source) return;
    setBaixando(true);
    try {
      await downloadQualidadeArquivo({
        nome: source.filename,
        dataUrl: source.dataUrl,
        storagePath: source.src,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível baixar o arquivo."
      );
    } finally {
      setBaixando(false);
    }
  }

  if (!source) {
    return (
      <ViewerShell>
        <div className="flex min-h-screen items-center justify-center bg-muted p-6">
          <div className="max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-sm">
            <p className="text-sm text-foreground">
              Visualização expirada ou inválida. Feche esta aba e tente novamente
              a partir da consulta de documentos.
            </p>
          </div>
        </div>
      </ViewerShell>
    );
  }

  const sheetAtual = sheets[sheetAtiva] ?? sheets[0];
  const podeImprimir =
    !loading && !error && (Boolean(objectUrl) || sheets.length > 0);

  return (
    <ViewerShell>
      <header className="sgq-viewer-toolbar flex shrink-0 items-center justify-between gap-4 border-b bg-brand-navy px-4 py-3 text-white print:hidden">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{source.filename}</p>
          <p className="text-xs text-white/70">
            {loading ? "Preparando arquivo…" : "Visualizar, imprimir ou baixar"}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5 border-white/30 bg-white/10 text-white hover:bg-white/20"
            disabled={!podeImprimir}
            onClick={() => window.print()}
          >
            <Printer className="size-4" />
            Imprimir
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5 border-white/30 bg-white/10 text-white hover:bg-white/20"
            disabled={loading || baixando}
            onClick={() => void handleBaixar()}
          >
            <Download className="size-4" />
            Baixar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5 border-white/30 bg-white/10 text-white hover:bg-white/20"
            onClick={() => window.close()}
          >
            <X className="size-4" />
            Fechar
          </Button>
        </div>
      </header>

      {sheets.length > 1 ? (
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b bg-muted/40 px-4 py-2 print:hidden">
          {sheets.map((sheet, idx) => (
            <button
              key={sheet.name}
              type="button"
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium",
                idx === sheetAtiva
                  ? "bg-brand-navy text-white"
                  : "bg-white text-brand-navy hover:bg-muted"
              )}
              onClick={() => setSheetAtiva(idx)}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      ) : null}

      <main className="min-h-0 flex-1 overflow-auto bg-muted/20 p-4 print:bg-white print:p-0">
        {loading ? (
          <div className="flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center gap-3 print:hidden">
            <div className="size-10 animate-spin rounded-full border-2 border-brand-navy/20 border-t-brand-navy" />
            <p className="text-sm text-muted-foreground">Carregando arquivo…</p>
          </div>
        ) : null}

        {error ? (
          <div className="mx-auto max-w-lg rounded-xl border bg-card p-6 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {!loading && !error && previewKind === "pdf" && objectUrl ? (
          <iframe
            src={objectUrl}
            title={source.filename}
            className="mx-auto h-[calc(100vh-5rem)] w-full max-w-6xl rounded-lg border bg-white shadow-sm print:h-screen print:max-w-none print:border-0 print:shadow-none"
          />
        ) : null}

        {!loading && !error && previewKind === "image" && objectUrl ? (
          <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center print:min-h-screen">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={objectUrl}
              alt={source.filename}
              className="max-h-[calc(100vh-6rem)] max-w-full rounded-lg border bg-white object-contain shadow-sm print:max-h-none print:border-0 print:shadow-none"
            />
          </div>
        ) : null}

        {!loading && !error && previewKind === "spreadsheet" && sheetAtual ? (
          <div className="space-y-6">
            {sheets.map((sheet, idx) => (
              <div
                key={sheet.name}
                className={cn(
                  "sgq-sheet-preview mx-auto overflow-auto rounded-lg border bg-white p-4 shadow-sm print:border-0 print:p-0 print:shadow-none",
                  idx === sheetAtiva ? "block" : "hidden"
                )}
                dangerouslySetInnerHTML={{ __html: sheet.html }}
              />
            ))}
          </div>
        ) : null}

        {!loading && !error && previewKind === "file" ? (
          <div className="mx-auto flex max-w-lg flex-col items-center gap-3 rounded-xl border bg-card p-8 text-center print:hidden">
            <p className="text-sm text-foreground">
              Este formato abre pelo botão Baixar, no aplicativo original.
            </p>
            <Button type="button" onClick={() => void handleBaixar()} disabled={baixando}>
              <Download className="size-4" />
              Baixar arquivo
            </Button>
          </div>
        ) : null}
      </main>
    </ViewerShell>
  );
}

export function VisualizarDocumentoPage() {
  return (
    <Suspense
      fallback={
        <div className="qualidade-module flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Carregando visualização…
        </div>
      }
    >
      <VisualizarDocumentoContent />
    </Suspense>
  );
}
