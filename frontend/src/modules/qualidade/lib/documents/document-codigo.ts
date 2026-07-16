import { formatRevision, INITIAL_REVISION } from "@qualidade/lib/documents/revision";

const SUFIXO_REVISAO = /:(\d{2})$/;

/** Remove o sufixo `:NN` do código, se existir. */
export function codigoBaseFromCodigo(codigo: string): string {
  const trimmed = codigo.trim();
  if (!trimmed) return "";
  if (!SUFIXO_REVISAO.test(trimmed)) return trimmed;
  return trimmed.replace(SUFIXO_REVISAO, "");
}

export function revisaoFromCodigo(codigo: string): string | null {
  const match = codigo.trim().match(SUFIXO_REVISAO);
  return match ? match[1] : null;
}

export function formatDocumentCodigo(
  base: string,
  revision: string | number = INITIAL_REVISION
): string {
  const baseNorm = codigoBaseFromCodigo(base);
  if (!baseNorm) return "";
  return `${baseNorm}:${formatRevision(revision)}`;
}

/** Garante exibição no padrão `FO-001:00`, inclusive para documentos antigos. */
export function formatDocumentCodigoExibicao(
  codigo: string,
  versaoAtual?: string
): string {
  if (revisaoFromCodigo(codigo)) return codigo.trim();
  return formatDocumentCodigo(codigo, versaoAtual ?? INITIAL_REVISION);
}
