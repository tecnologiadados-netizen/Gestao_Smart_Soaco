import { openQualidadePrintWindow } from "@qualidade/lib/documents/sgq-print-window";
import { resolveUploadUrl } from "@/api/client";

export type DocumentFileViewMode = "view" | "print";

const VIEWER_STORAGE_PREFIX = "sgq-file-view:";

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(",");
  if (!data) {
    throw new Error("Arquivo inválido.");
  }

  const mime =
    header.match(/data:([^;]+)/)?.[1] ?? "application/octet-stream";
  const isBase64 = header.includes("base64");

  if (isBase64) {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  }

  return new Blob([decodeURIComponent(data)], { type: mime });
}

/** Garante MIME adequado para preview inline (PDF/imagem), mesmo se o dataUrl veio como octet-stream. */
export function blobForInlinePreview(dataUrl: string, filename: string): Blob {
  const blob = dataUrlToBlob(dataUrl);
  if (isPdfFile(filename, blob.type) && blob.type !== "application/pdf") {
    return new Blob([blob], { type: "application/pdf" });
  }
  if (isImageFile(filename) && !blob.type.startsWith("image/")) {
    const ext = getFileExtension(filename);
    const mimeByExt: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      bmp: "image/bmp",
      svg: "image/svg+xml",
    };
    const mime = mimeByExt[ext];
    if (mime) return new Blob([blob], { type: mime });
  }
  return blob;
}

export function getFileExtension(filename: string) {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

export function extensionFromStoragePath(path: string) {
  const base = path.split("?")[0]?.split("/").pop() ?? "";
  return getFileExtension(base);
}

export function nomeArquivoComExtensao(
  nome: string,
  storagePath?: string
): string {
  const trimmed = nome.trim();
  if (getFileExtension(trimmed)) return trimmed;
  const ext = storagePath ? extensionFromStoragePath(storagePath) : "";
  return ext ? `${trimmed}.${ext}` : trimmed;
}

export function arquivoTemPreviewNativo(
  filename: string,
  mimeType?: string
): boolean {
  return isPdfFile(filename, mimeType) || isImageFile(filename, mimeType);
}

export function isPdfFile(filename: string, mimeType?: string) {
  return (
    mimeType === "application/pdf" || getFileExtension(filename) === "pdf"
  );
}

export function isImageFile(filename: string, mimeType?: string) {
  if (mimeType?.startsWith("image/")) return true;
  return ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(
    getFileExtension(filename)
  );
}

export function isSpreadsheetFile(filename: string, mimeType?: string) {
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel"
  ) {
    return true;
  }
  return ["xlsx", "xls", "csv"].includes(getFileExtension(filename));
}

export function isOfficeDocumentFile(filename: string, mimeType?: string) {
  if (isSpreadsheetFile(filename, mimeType)) return true;

  const ext = getFileExtension(filename);
  if (["doc", "docx", "ppt", "pptx"].includes(ext)) return true;

  return Boolean(
    mimeType?.includes("wordprocessingml") ||
      mimeType?.includes("presentationml") ||
      mimeType === "application/msword"
  );
}

export function downloadDocumentFile(dataUrl: string, filename: string) {
  const blob = blobForInlinePreview(dataUrl, filename);
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

/**
 * Abre o visualizador/impressão numa aba limpa (sem o layout do sistema).
 * Planilha/PDF/imagem são preparados nessa aba; print só dispara com o documento no DOM.
 */
export function openDocumentFileViewer(
  dataUrl: string,
  filename: string,
  mode: DocumentFileViewMode
) {
  return openQualidadePrintWindow({ nome: filename, dataUrl }, mode);
}

/** Abre o visualizador numa aba limpa. O download fica na própria tela. */
export async function openQualidadeArquivo(
  arquivo: { nome?: string; dataUrl?: string; storagePath?: string },
  mode: DocumentFileViewMode = "print"
): Promise<void> {
  await openQualidadePrintWindow(arquivo, mode);
}

export async function downloadQualidadeArquivo(arquivo: {
  nome?: string;
  dataUrl?: string;
  storagePath?: string;
}): Promise<void> {
  const nome = arquivo.nome?.trim();
  if (!nome) throw new Error("Arquivo sem nome.");

  const storagePath = arquivo.storagePath?.trim();
  const nomeComExt = nomeArquivoComExtensao(nome, storagePath);

  const dataUrl = arquivo.dataUrl?.trim();
  if (dataUrl?.startsWith("data:")) {
    downloadDocumentFile(dataUrl, nomeComExt);
    return;
  }

  if (storagePath?.startsWith("/uploads/")) {
    const res = await fetch(resolveUploadUrl(storagePath));
    if (!res.ok) throw new Error("Não foi possível baixar o arquivo.");
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = nomeComExt;
    link.rel = "noopener";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    return;
  }

  throw new Error("Arquivo indisponível para download.");
}

export function readViewerPayload(key: string | null) {
  if (!key?.startsWith(VIEWER_STORAGE_PREFIX)) return null;

  const raw =
    localStorage.getItem(key) ?? sessionStorage.getItem(key);
  if (!raw) return null;

  try {
    const payload = JSON.parse(raw) as {
      dataUrl: string;
      filename: string;
      mode: DocumentFileViewMode;
      createdAt: number;
    };

    if (!payload.dataUrl || !payload.filename) return null;

    // Expira após 5 minutos.
    if (Date.now() - payload.createdAt > 5 * 60 * 1000) {
      clearViewerPayload(key);
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function clearViewerPayload(key: string | null) {
  if (!key) return;
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
}

async function storagePathToDataUrl(storagePath: string): Promise<string | null> {
  const path = storagePath.trim();
  if (!path.startsWith("/uploads/")) return null;
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        typeof reader.result === "string"
          ? resolve(reader.result)
          : reject(new Error("Falha ao ler arquivo."));
      reader.onerror = () => reject(new Error("Falha ao ler arquivo."));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Resolve o arquivo da versão para visualizar/baixar (dataUrl em memória ou disco).
 */
export async function resolveVersionArquivoParaAcao(version: {
  arquivoNome?: string;
  arquivoDataUrl?: string;
  anexos?: Array<{ nome: string; dataUrl?: string; storagePath?: string }>;
}): Promise<{ nome: string; dataUrl: string } | null> {
  const nome =
    version.arquivoNome?.trim() ||
    version.anexos?.find((a) => a.nome?.trim())?.nome?.trim() ||
    "";
  if (!nome) return null;

  const dataUrlDireto = version.arquivoDataUrl?.trim();
  if (dataUrlDireto?.startsWith("data:")) {
    return { nome, dataUrl: dataUrlDireto };
  }

  const anexoComData = version.anexos?.find((a) =>
    a.dataUrl?.trim().startsWith("data:")
  );
  if (anexoComData?.dataUrl) {
    return {
      nome: anexoComData.nome?.trim() || nome,
      dataUrl: anexoComData.dataUrl,
    };
  }

  const storagePath =
    version.anexos?.find((a) => a.storagePath?.startsWith("/uploads/"))
      ?.storagePath ?? null;
  if (storagePath) {
    const dataUrl = await storagePathToDataUrl(storagePath);
    if (dataUrl) return { nome, dataUrl };
  }

  return null;
}

