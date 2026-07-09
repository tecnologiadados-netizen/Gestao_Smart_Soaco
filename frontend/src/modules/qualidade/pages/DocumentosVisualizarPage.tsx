import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from 'react-router-dom';
import { Printer, X } from "lucide-react";
import * as XLSX from "xlsx";
import { Button, buttonVariants } from "@qualidade/components/ui/button";
import {
  clearViewerPayload,
  dataUrlToBlob,
  isImageFile,
  isOfficeDocumentFile,
  isPdfFile,
  isSpreadsheetFile,
  readViewerPayload,
} from "@qualidade/lib/documents/file-actions";
import { cn } from "@qualidade/lib/utils";

type PreviewKind =
  | "pdf"
  | "image"
  | "spreadsheet"
  | "office-fallback"
  | "unsupported";

function spreadsheetToHtml(dataUrl: string) {
  const blob = dataUrlToBlob(dataUrl);
  return blob.arrayBuffer().then((arrayBuffer) => {
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) {
      return "<p>Planilha vazia.</p>";
    }

    const sheet = workbook.Sheets[firstSheet];
    return XLSX.utils.sheet_to_html(sheet, { id: "sgq-sheet-table" });
  });
}

function VisualizarDocumentoContent() {
  const [searchParams] = useSearchParams();
  const key = searchParams.get("k");
  const payload = useMemo(() => readViewerPayload(key), [key]);

  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [spreadsheetHtml, setSpreadsheetHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [readyToPrint, setReadyToPrint] = useState(false);
  const printedRef = useRef(false);

  const mimeType = payload ? dataUrlToBlob(payload.dataUrl).type : undefined;

  const previewKind: PreviewKind = useMemo(() => {
    if (!payload) return "unsupported";
    if (isPdfFile(payload.filename, mimeType)) return "pdf";
    if (isImageFile(payload.filename, mimeType)) return "image";
    if (isSpreadsheetFile(payload.filename, mimeType)) return "spreadsheet";
    if (isOfficeDocumentFile(payload.filename, mimeType)) {
      return "office-fallback";
    }
    return "unsupported";
  }, [payload, mimeType]);

  useEffect(() => {
    if (!payload || !key) return;

    let active = true;
    let createdUrl: string | null = null;

    async function preparePreview() {
      try {
        if (previewKind === "spreadsheet") {
          const html = await spreadsheetToHtml(payload!.dataUrl);
          if (!active) return;
          setSpreadsheetHtml(html);
          setReadyToPrint(true);
          return;
        }

        if (
          previewKind === "pdf" ||
          previewKind === "image" ||
          previewKind === "office-fallback"
        ) {
          const blob = dataUrlToBlob(payload!.dataUrl);
          createdUrl = URL.createObjectURL(blob);
          if (!active) {
            URL.revokeObjectURL(createdUrl);
            return;
          }
          setObjectUrl(createdUrl);
          setReadyToPrint(true);
          return;
        }

        setError("Formato de arquivo não suportado para visualização.");
      } catch {
        if (active) {
          setError("Não foi possível preparar a visualização do arquivo.");
        }
      }
    }

    preparePreview();

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
      clearViewerPayload(key);
    };
  }, [payload, key, previewKind]);

  useEffect(() => {
    if (
      !payload ||
      payload.mode !== "print" ||
      !readyToPrint ||
      printedRef.current
    ) {
      return;
    }

    printedRef.current = true;
    const timer = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(timer);
  }, [payload, readyToPrint]);

  if (!payload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
        <div className="max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">
            Visualização expirada ou inválida. Feche esta aba e tente novamente
            a partir da consulta de documentos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sgq-viewer-toolbar flex shrink-0 items-center justify-between gap-4 border-b bg-brand-navy px-4 py-3 text-white print:hidden">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{payload.filename}</p>
          <p className="text-xs text-white/70">
            {payload.mode === "print"
              ? "Modo impressão"
              : "Somente visualização"}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5 border-white/30 bg-white/10 text-white hover:bg-white/20"
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
            onClick={() => window.close()}
          >
            <X className="size-4" />
            Fechar
          </Button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto bg-muted/20 p-4 print:bg-white print:p-0">
        {error ? (
          <div className="mx-auto max-w-lg rounded-xl border bg-card p-6 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {!error && previewKind === "pdf" && objectUrl ? (
          <iframe
            src={objectUrl}
            title={payload.filename}
            className="mx-auto h-[calc(100vh-5rem)] w-full max-w-6xl rounded-lg border bg-white shadow-sm print:h-screen print:max-w-none print:border-0 print:shadow-none"
          />
        ) : null}

        {!error && previewKind === "image" && objectUrl ? (
          <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center print:min-h-screen">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={objectUrl}
              alt={payload.filename}
              className="max-h-[calc(100vh-6rem)] max-w-full rounded-lg border bg-white object-contain shadow-sm print:max-h-none print:border-0 print:shadow-none"
            />
          </div>
        ) : null}

        {!error && previewKind === "spreadsheet" && spreadsheetHtml ? (
          <div
            className="sgq-sheet-preview mx-auto max-w-6xl overflow-auto rounded-lg border bg-white p-4 shadow-sm print:border-0 print:shadow-none"
            dangerouslySetInnerHTML={{ __html: spreadsheetHtml }}
          />
        ) : null}

        {!error && previewKind === "office-fallback" && objectUrl ? (
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 rounded-xl border bg-card p-8 text-center shadow-sm">
            <p className="text-base font-medium text-brand-navy">
              {payload.filename}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Este formato não possui visualização integrada no navegador. Você
              pode abrir o documento no aplicativo padrão do sistema para
              visualizar ou imprimir.
            </p>
            <a
              href={objectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants(), "inline-flex")}
            >
              Abrir documento
            </a>
          </div>
        ) : null}

        {!error && previewKind === "unsupported" ? (
          <div className="mx-auto max-w-lg rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
            Formato não suportado para visualização.
          </div>
        ) : null}
      </main>
    </div>
  );
}

export function VisualizarDocumentoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Carregando visualização…
        </div>
      }
    >
      <VisualizarDocumentoContent />
    </Suspense>
  );
}
