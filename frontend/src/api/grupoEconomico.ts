import { apiFetch } from './client';

export type GrupoEconomicoResumo = {
  totalGrupos: number;
  totalPessoas: number;
};

export type GrupoEconomicoLinha = {
  id: number;
  grupo: string;
  descricao: string;
  ativo: boolean;
  qtdMembros: number;
};

export type GrupoEconomicoMembro = {
  id: number;
  nome: string;
  razaoSocial: string;
  documento: string;
  tipoPessoa: number | null;
  codigo: string;
  ativo: boolean;
};

export type GrupoEconomicoLista = {
  resumo: GrupoEconomicoResumo;
  grupos: GrupoEconomicoLinha[];
  filtros: { busca: string; somenteAtivos: boolean };
  error?: string;
};

export type GrupoEconomicoDetalhe = {
  grupo: GrupoEconomicoLinha;
  membros: GrupoEconomicoMembro[];
};

function qs(params: Record<string, string | boolean | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export async function fetchGruposEconomicos(opts: {
  busca?: string;
  somenteAtivos?: boolean;
}): Promise<GrupoEconomicoLista> {
  const res = await apiFetch(
    `/api/comercial/grupo-economico${qs({
      busca: opts.busca?.trim() || undefined,
      somenteAtivos: opts.somenteAtivos === false ? '0' : '1',
    })}`
  );
  const data = (await res.json().catch(() => ({}))) as GrupoEconomicoLista & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? 'Erro ao listar grupos econômicos.');
  }
  return data;
}

export async function fetchGrupoEconomicoDetalhe(
  id: number,
  opts: { somenteAtivos?: boolean } = {}
): Promise<GrupoEconomicoDetalhe> {
  const res = await apiFetch(
    `/api/comercial/grupo-economico/${id}${qs({
      somenteAtivos: opts.somenteAtivos === false ? '0' : '1',
    })}`
  );
  const data = (await res.json().catch(() => ({}))) as GrupoEconomicoDetalhe & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? 'Erro ao carregar membros do grupo.');
  }
  return data;
}
