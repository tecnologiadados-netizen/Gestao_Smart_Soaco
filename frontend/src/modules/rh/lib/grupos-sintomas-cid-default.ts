import { classificarLinhaCadastroCid } from "@rh/lib/cid-grupos";
import {
  GRUPO_SINTOMA_CATALOGO_IDS,
  tituloGrupoSintoma,
  type GrupoSintomaCatalogoId,
} from "@rh/lib/grupos-sintomas-cid-titulos";
import type { FaltaGrupoSintomaCidRow } from "@rh/types/api";

/** Ordem de exibição — alinhada à planilha e ao ranking do painel de diagnóstico. */
export const GRUPO_SINTOMA_IDS = GRUPO_SINTOMA_CATALOGO_IDS;

export type GrupoSintomaId = GrupoSintomaCatalogoId;

function sortLinhasCadastro(linhas: string[]): string[] {
  return [...linhas].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
}

function ordenarIdsGrupo(ids: string[]): string[] {
  const set = new Set(ids);
  const livreIds = [...set]
    .filter((id) => !GRUPO_SINTOMA_IDS.includes(id as GrupoSintomaId))
    .sort();

  return [...GRUPO_SINTOMA_IDS.filter((id) => set.has(id)), ...livreIds];
}

/** Monta grupos usando somente as linhas exatas do cadastro de CIDs — cobertura total. */
export function buildGruposSintomasFromCadastro(cidsCadastro: string[]): FaltaGrupoSintomaCidRow[] {
  const linhas = sortLinhasCadastro([...new Set(cidsCadastro.map((c) => c.trim()).filter(Boolean))]);
  const porGrupo = new Map<string, { titulo: string; cids: string[] }>();

  for (const linha of linhas) {
    const { id, titulo } = classificarLinhaCadastroCid(linha);
    const cur = porGrupo.get(id);
    if (cur) {
      cur.cids.push(linha);
    } else {
      porGrupo.set(id, { titulo, cids: [linha] });
    }
  }

  return ordenarIdsGrupo([...porGrupo.keys()]).map((id, index) => ({
    id,
    ordem: index + 1,
    titulo: tituloGrupoSintoma(id, porGrupo.get(id)!.titulo),
    cids: sortLinhasCadastro(porGrupo.get(id)!.cids),
  }));
}

export function buildGruposSintomasCidDefault(cidsCadastro: string[] = []): FaltaGrupoSintomaCidRow[] {
  if (cidsCadastro.length > 0) {
    return buildGruposSintomasFromCadastro(cidsCadastro);
  }
  return GRUPO_SINTOMA_IDS.map((id, index) => ({
    id,
    ordem: index + 1,
    titulo: tituloGrupoSintoma(id),
    cids: [],
  }));
}

export function isGrupoSintomasCustomizado(id: string): boolean {
  return id.startsWith("grupo-");
}

/** Reagrupa CIDs salvos com ids legados para o catálogo consolidado. */
export function remontarGruposSintomasLegados(grupos: FaltaGrupoSintomaCidRow[]): FaltaGrupoSintomaCidRow[] {
  const cids = [...new Set(grupos.flatMap((g) => g.cids.map((c) => c.trim()).filter(Boolean)))];
  const custom = grupos.filter((g) => isGrupoSintomasCustomizado(g.id));
  if (cids.length === 0) {
    return buildGruposSintomasCidDefault();
  }
  const built = buildGruposSintomasFromCadastro(cids);
  for (const c of custom) {
    const filtered = c.cids.map((x) => x.trim()).filter(Boolean);
    if (filtered.length === 0) continue;
    built.push({
      ...c,
      ordem: built.length + 1,
      cids: sortLinhasCadastro(filtered),
    });
  }
  return built.map((g, i) => ({ ...g, ordem: i + 1 }));
}
