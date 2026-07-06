import {
  fetchClientesFromSql,
  getClientesSqlConfig,
  type GetClientesOptions,
} from "@/lib/registros/clientes-sql";
import type { ClienteErp } from "@/types/cliente-erp";

export type { GetClientesOptions };

export async function getClientes(
  options: GetClientesOptions = {}
): Promise<ClienteErp[]> {
  const sqlConfig = getClientesSqlConfig();

  if (!sqlConfig) {
    return [];
  }

  try {
    return await fetchClientesFromSql(sqlConfig, options);
  } catch (error) {
    console.error("[clientes-sql]", error);
    throw error;
  }
}

export function getClientesSource(): "erp" | "indisponivel" {
  return getClientesSqlConfig() ? "erp" : "indisponivel";
}
