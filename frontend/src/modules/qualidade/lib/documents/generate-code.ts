import { codigoBaseFromCodigo } from "@qualidade/lib/documents/document-codigo";

export function generateNextDocumentCode(
  tipoSigla: string,
  existingCodes: string[]
): string {
  const prefix = `${tipoSigla.trim().toUpperCase()}-`;
  let maxNum = 0;

  for (const codigo of existingCodes) {
    const base = codigoBaseFromCodigo(codigo);
    if (!base.toUpperCase().startsWith(prefix)) continue;
    const num = parseInt(base.slice(prefix.length), 10);
    if (!Number.isNaN(num) && num > maxNum) maxNum = num;
  }

  return `${prefix}${String(maxNum + 1).padStart(3, "0")}`;
}
