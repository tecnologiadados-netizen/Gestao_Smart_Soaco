import { apiFetch } from "@/api/client";
import { QUALIDADE_API_BASE } from "@qualidade/lib/api-base";

export interface OrganicoColaboradorRnc {
  id: string;
  nome: string;
  matricula: string;
  cargo: string;
  setor: string;
  status: string;
}

let listaEmCache: Promise<OrganicoColaboradorRnc[]> | null = null;

export function fetchOrganicoColaboradores(): Promise<OrganicoColaboradorRnc[]> {
  if (!listaEmCache) {
    listaEmCache = apiFetch(`${QUALIDADE_API_BASE}/organico-colaboradores`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Não foi possível carregar o orgânico.");
        }
        const data = (await response.json()) as { colaboradores: OrganicoColaboradorRnc[] };
        return data.colaboradores ?? [];
      })
      .catch((erro: unknown) => {
        listaEmCache = null;
        throw erro;
      });
  }
  return listaEmCache;
}
