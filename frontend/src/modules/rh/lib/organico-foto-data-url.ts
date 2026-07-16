/**
 * Monta URL utilizável em `<img src>` a partir do que está em `rh.organico_fotos.foto_base64`.
 * Upload pelo app grava `data:image/...;base64,...` (FileReader.readAsDataURL).
 * Import em lote pode gravar só o payload base64 — sem prefixo o navegador trata como path relativo e a imagem quebra.
 * Legado Supabase: data URL sem pontuação (`dataimage/jpegbase64/9j/...`).
 */
function sniffMimeFromBase64Payload(raw: string): string {
  const head = raw.slice(0, 16);
  if (head.startsWith("/9j/")) return "image/jpeg";
  if (head.startsWith("iVBOR")) return "image/png";
  if (head.startsWith("R0lGOD")) return "image/gif";
  if (head.startsWith("UklGR") || head.startsWith("Qk")) return "image/webp";
  return "image/jpeg";
}

function normalizeOrganicoFotoPayload(
  input: string,
  mimeType?: string | null,
): { payload: string; mimeType: string | null } {
  const raw = String(input ?? "").trim();
  if (!raw) return { payload: "", mimeType: mimeType ?? null };

  const dataUrl = raw.match(/^data:([^;,]+);base64,(.+)$/is);
  if (dataUrl) {
    return { payload: dataUrl[2]!.trim(), mimeType: dataUrl[1]!.trim() };
  }

  const legacy = raw.match(/^dataimage\/(jpeg|jpg|png|gif|webp)base64\/(.+)$/is);
  if (legacy) {
    const ext = legacy[1]!.toLowerCase();
    const mime = `image/${ext === "jpg" ? "jpeg" : ext}`;
    return { payload: legacy[2]!.trim(), mimeType: mime };
  }

  return { payload: raw, mimeType: mimeType ?? null };
}

export function organicoFotoToDataUrl(
  fotoBase64: string | null | undefined,
  mimeType: string | null | undefined,
): string | null {
  const normalized = normalizeOrganicoFotoPayload(String(fotoBase64 ?? ""), mimeType);
  if (!normalized.payload) return null;
  const mime = normalized.mimeType || sniffMimeFromBase64Payload(normalized.payload);
  return `data:${mime};base64,${normalized.payload}`;
}
