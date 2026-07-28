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
 * Abre visualização/impressão do arquivo.
 * PDF e imagens usam blob URL (viewer nativo do navegador) — evita rota SPA autenticada
 * que quebrava com noopener (nova aba sem sessionStorage → /sem-acesso).
 * Demais formatos usam a página viewer com payload em localStorage.
 */
export function openDocumentFileViewer(
  dataUrl: string,
  filename: string,
  mode: DocumentFileViewMode
) {
  const blob = blobForInlinePreview(dataUrl, filename);
  const mime = blob.type;

  if (isPdfFile(filename, mime) || isImageFile(filename, mime)) {
    const objectUrl = URL.createObjectURL(blob);
    const popup = window.open(objectUrl, "_blank");
    if (!popup) {
      URL.revokeObjectURL(objectUrl);
      throw new Error(
        "Não foi possível abrir a visualização. Verifique se o navegador bloqueou pop-ups."
      );
    }
    if (mode === "print") {
      window.setTimeout(() => {
        try {
          popup.focus();
          popup.print();
        } catch {
          /* ignore */
        }
      }, 700);
    }
    // Mantém o blob enquanto a aba de visualização estiver em uso.
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10 * 60 * 1000);
    return;
  }

  const key = `${VIEWER_STORAGE_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ dataUrl, filename, mode, createdAt: Date.now() })
    );
  } catch {
    throw new Error(
      "Não foi possível preparar a visualização (armazenamento local indisponível)."
    );
  }

  const popup = window.open(
    `/qualidade/documentos/visualizar?k=${encodeURIComponent(key)}`,
    "_blank"
  );

  if (!popup) {
    localStorage.removeItem(key);
    throw new Error(
      "Não foi possível abrir a visualização. Verifique se o navegador bloqueou pop-ups."
    );
  }
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

