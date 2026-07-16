import { apiFetch } from "@/api/client";
import { QUALIDADE_API_BASE } from "@qualidade/lib/api-base";
import {
  DOCUMENTOS_ENTRADA_INITIAL_LIMIT,
  DOCUMENTOS_ENTRADA_SEARCH_LIMIT,
} from "@qualidade/lib/avaliacao-fornecedor/documentos-entrada-constants";

export interface DocumentoEntradaErp {
  id: string;
  numero: string;
  dataEmissao?: string;
  dataEntrada?: string;
  numeroNFe?: string;
  tipoMovimentacao?: string;
}

export interface FetchDocumentosEntradaOptions {
  fornecedorId: string;
  q?: string;
  limit?: number;
}

export async function fetchDocumentosEntradaClient(
  options: FetchDocumentosEntradaOptions
): Promise<DocumentoEntradaErp[]> {
  const params = new URLSearchParams();
  params.set("fornecedorId", options.fornecedorId);

  if (options.q?.trim()) {
    params.set("q", options.q.trim());
  }

  params.set(
    "limit",
    String(options.limit ?? DOCUMENTOS_ENTRADA_INITIAL_LIMIT)
  );

  const response = await apiFetch(
    `${QUALIDADE_API_BASE}/documentos-entrada?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error("Não foi possível carregar os documentos de entrada.");
  }

  const data = (await response.json()) as { documentos: DocumentoEntradaErp[] };
  return data.documentos;
}

export {
  DOCUMENTOS_ENTRADA_INITIAL_LIMIT,
  DOCUMENTOS_ENTRADA_MIN_SEARCH_CHARS,
  DOCUMENTOS_ENTRADA_SEARCH_LIMIT,
} from "@qualidade/lib/avaliacao-fornecedor/documentos-entrada-constants";
