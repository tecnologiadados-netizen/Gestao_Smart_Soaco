/**
 * Monta URL utilizável em `<img src>` a partir do que está em `rh.organico_fotos.foto_base64`.
 * Upload pelo app grava `data:image/...;base64,...` (FileReader.readAsDataURL).
 * Import em lote pode gravar só o payload base64 — sem prefixo o navegador trata como path relativo e a imagem quebra.
 */
function sniffMimeFromBase64Payload(raw: string): string {
  const head = raw.slice(0, 16);
  if (head.startsWith("/9j/")) return "image/jpeg";
  if (head.startsWith("iVBOR")) return "image/png";
  if (head.startsWith("R0lGOD")) return "image/gif";
  if (head.startsWith("UklGR") || head.startsWith("Qk")) return "image/webp";
  return "image/jpeg";
}

export function organicoFotoToDataUrl(
  fotoBase64: string | null | undefined,
  mimeType: string | null | undefined,
): string | null {
  const raw = String(fotoBase64 ?? "").trim();
  if (!raw) return null;
  if (raw.startsWith("data:")) return raw;
  const fromMeta = String(mimeType ?? "").trim();
  const mime = fromMeta || sniffMimeFromBase64Payload(raw);
  return `data:${mime};base64,${raw}`;
}
