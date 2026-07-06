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

export function getFileExtension(filename: string) {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
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
  const blob = dataUrlToBlob(dataUrl);
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

export function openDocumentFileViewer(
  dataUrl: string,
  filename: string,
  mode: DocumentFileViewMode
) {
  const key = `${VIEWER_STORAGE_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  sessionStorage.setItem(
    key,
    JSON.stringify({ dataUrl, filename, mode, createdAt: Date.now() })
  );

  const popup = window.open(
    `/documentos/visualizar?k=${encodeURIComponent(key)}`,
    "_blank",
    "noopener,noreferrer"
  );

  if (!popup) {
    sessionStorage.removeItem(key);
    throw new Error(
      "Não foi possível abrir a visualização. Verifique se o navegador bloqueou pop-ups."
    );
  }
}

export function readViewerPayload(key: string | null) {
  if (!key?.startsWith(VIEWER_STORAGE_PREFIX)) return null;

  const raw = sessionStorage.getItem(key);
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
      sessionStorage.removeItem(key);
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function clearViewerPayload(key: string | null) {
  if (!key) return;
  sessionStorage.removeItem(key);
}
