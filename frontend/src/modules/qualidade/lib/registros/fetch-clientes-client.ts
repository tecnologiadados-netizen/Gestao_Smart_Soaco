import {
  CLIENTES_INITIAL_LIMIT,
  CLIENTES_MIN_SEARCH_CHARS,
  CLIENTES_SEARCH_LIMIT,
} from "@qualidade/lib/registros/clientes-constants";
import { QUALIDADE_API_BASE } from "@qualidade/lib/api-base";
import type { ClienteErp } from "@qualidade/types/cliente-erp";

export interface FetchClientesOptions {
  q?: string;
  id?: string;
  limit?: number;
}

export async function fetchClientesClient(
  options: FetchClientesOptions = {}
): Promise<ClienteErp[]> {
  const params = new URLSearchParams();

  if (options.q?.trim()) {
    params.set("q", options.q.trim());
  }
  if (options.id?.trim()) {
    params.set("id", options.id.trim());
  }

  params.set(
    "limit",
    String(options.limit ?? CLIENTES_INITIAL_LIMIT)
  );

  const response = await fetch(`${QUALIDADE_API_BASE}/clientes?${params.toString()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Não foi possível carregar os clientes.");
  }

  const data = (await response.json()) as { clientes: ClienteErp[] };
  return data.clientes;
}

export {
  CLIENTES_INITIAL_LIMIT,
  CLIENTES_MIN_SEARCH_CHARS,
  CLIENTES_SEARCH_LIMIT,
};
