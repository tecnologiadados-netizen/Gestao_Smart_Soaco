import { resolveUploadUrl } from "@/api/client";
import { fetchQualidadeArquivoPreviewUrl } from "@qualidade/lib/api/qualidadeApi";

type ArquivoRef = {
  nome?: string;
  dataUrl?: string;
  storagePath?: string;
};

function getExt(name: string): string {
  const base = name.split("?")[0]?.split("/").pop() ?? "";
  const parts = base.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

function withExt(nome: string, storagePath?: string): string {
  const trimmed = nome.trim();
  if (getExt(trimmed)) return trimmed;
  const ext = storagePath ? getExt(storagePath) : "";
  return ext ? `${trimmed}.${ext}` : trimmed;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(",");
  if (!data) throw new Error("Arquivo inválido.");
  const mime = header.match(/data:([^;]+)/)?.[1] ?? "application/octet-stream";
  const isBase64 = header.includes("base64");
  if (isBase64) {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  return new Blob([decodeURIComponent(data)], { type: mime });
}

function isPdf(name: string, mime?: string) {
  return mime === "application/pdf" || getExt(name) === "pdf";
}

function isImage(name: string, mime?: string) {
  if (mime?.startsWith("image/")) return true;
  return ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(getExt(name));
}

function isOffice(name: string) {
  return ["xlsx", "xls", "csv", "docx", "doc", "pptx", "ppt"].includes(getExt(name));
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function writePopupHtml(popup: Window, html: string) {
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
}

function loadingHtml(titulo: string): string {
  const t = escapeHtml(titulo || "documento");
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><title>Abrindo ${t}</title>
<style>
  html,body{margin:0;height:100%;font-family:Segoe UI,sans-serif;background:#fff;color:#334155}
  .box{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px}
  .spin{width:36px;height:36px;border:3px solid #e2e8f0;border-top-color:#0f2747;border-radius:50%;animation:s .8s linear infinite}
  @keyframes s{to{transform:rotate(360deg)}}
</style></head><body><div class="box"><div class="spin"></div><p>Abrindo documento…</p></div></body></html>`;
}

function errorHtml(message: string): string {
  const m = escapeHtml(message);
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><title>Falha ao abrir</title>
<style>body{font-family:Segoe UI,sans-serif;padding:32px;color:#0f2747}</style>
</head><body><p>${m}</p></body></html>`;
}

/**
 * Abre o arquivo original no visualizador nativo do Chrome (PDF/imagem),
 * no mesmo fluxo do módulo RH. Planilha/Office vai como PDF fiel do Excel.
 */
export async function openQualidadePrintWindow(
  arquivo: ArquivoRef,
  _mode: "view" | "print" = "print"
): Promise<void> {
  const popup = window.open("about:blank", "_blank");
  if (!popup) {
    throw new Error(
      "Não foi possível abrir a visualização. Verifique se o navegador bloqueou pop-ups."
    );
  }

  const storagePath = arquivo.storagePath?.trim();
  const filename = withExt(arquivo.nome?.trim() || "arquivo", storagePath);
  writePopupHtml(popup, loadingHtml(filename));

  try {
    if (storagePath?.startsWith("/uploads/")) {
      const originalUrl = resolveUploadUrl(storagePath);
      if (isPdf(filename) || isImage(filename)) {
        popup.location.replace(originalUrl);
        return;
      }
      if (isOffice(filename) || isOffice(storagePath)) {
        const previewUrl = await fetchQualidadeArquivoPreviewUrl(storagePath);
        if (popup.closed) return;
        popup.location.replace(resolveUploadUrl(previewUrl));
        return;
      }
      popup.location.replace(originalUrl);
      return;
    }

    const dataUrl = arquivo.dataUrl?.trim();
    if (dataUrl?.startsWith("data:")) {
      const blob = dataUrlToBlob(dataUrl);
      const typed =
        isPdf(filename, blob.type) && blob.type !== "application/pdf"
          ? new Blob([blob], { type: "application/pdf" })
          : blob;
      const blobUrl = URL.createObjectURL(typed);
      popup.location.replace(blobUrl);
      return;
    }

    throw new Error("Arquivo indisponível para visualização.");
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Não foi possível abrir o documento.";
    if (!popup.closed) writePopupHtml(popup, errorHtml(message));
    throw err;
  }
}
