import { QUALIDADE_API_BASE } from "@qualidade/lib/api-base";
import type { RncPainelResponse } from "@qualidade/types/rnc-painel";

export async function fetchRncPainelClient(): Promise<RncPainelResponse> {
  const response = await fetch(`${QUALIDADE_API_BASE}/rnc-painel`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Não foi possível carregar o painel de RNC.");
  }

  return (await response.json()) as RncPainelResponse;
}
