import { chaveAgregacaoCidPlanilha } from "@rh/lib/cid-grupos";
import {
  buildGruposSintomasFromCadastro,
  isGrupoSintomasCustomizado,
} from "@rh/lib/grupos-sintomas-cid-default";
import {
  tituloGrupoPrecisaReparo,
  tituloGrupoSintoma,
} from "@rh/lib/grupos-sintomas-cid-titulos";
import type { FaltaGrupoSintomaCidRow } from "@rh/types/api";

/** Normaliza valor para uma linha exata do cadastro de CIDs, se existir. */
export function normalizarParaLinhaCadastro(valor: string, cidsCadastro: string[]): string {
  const trimmed = valor.trim();
  if (!trimmed) return "";
  const exact = cidsCadastro.find((c) => c.trim() === trimmed);
  if (exact) return exact.trim();
  const chave = chaveAgregacaoCidPlanilha(trimmed);
  const byKey = cidsCadastro.find((c) => chaveAgregacaoCidPlanilha(c) === chave);
  return byKey?.trim() ?? trimmed;
}

/**
 * Sincroniza grupos padrão com as linhas exatas do quadro de CIDs.
 * Grupos customizados mantêm apenas entradas que existem no cadastro.
 */
export function syncGruposSintomasComCadastro(
  grupos: FaltaGrupoSintomaCidRow[],
  cidsCadastro: string[],
): FaltaGrupoSintomaCidRow[] {
  const cadastroUnico = [...new Set(cidsCadastro.map((c) => c.trim()).filter(Boolean))];
  const cadastroSet = new Set(cadastroUnico);

  if (cadastroUnico.length === 0) {
    return grupos.map((g) => ({
      ...g,
      titulo: tituloGrupoPrecisaReparo(g.titulo) ? tituloGrupoSintoma(g.id, g.titulo) : g.titulo,
    }));
  }

  const built = buildGruposSintomasFromCadastro(cadastroUnico);
  const builtById = new Map(built.map((g) => [g.id, g]));
  const presentIds = new Set<string>();

  const synced = grupos.flatMap((g) => {
    presentIds.add(g.id);
    if (isGrupoSintomasCustomizado(g.id)) {
      return [
        {
          ...g,
          titulo: tituloGrupoPrecisaReparo(g.titulo) ? tituloGrupoSintoma(g.id, g.titulo) : g.titulo,
          cids: g.cids.map((c) => c.trim()).filter((c) => cadastroSet.has(c)),
        },
      ];
    }
    if (!builtById.has(g.id)) return [];
    const fromCadastro = builtById.get(g.id)!;
    return [
      {
        ...g,
        titulo: tituloGrupoPrecisaReparo(g.titulo) ? fromCadastro.titulo : g.titulo,
        cids: fromCadastro.cids,
      },
    ];
  });

  for (const g of built) {
    if (!presentIds.has(g.id)) synced.push(g);
  }

  return synced.sort((a, b) => a.ordem - b.ordem);
}

/** @deprecated Use syncGruposSintomasComCadastro */
export function repairGruposSintomasCid(
  grupos: FaltaGrupoSintomaCidRow[],
  cidsCadastro: string[],
): FaltaGrupoSintomaCidRow[] {
  return syncGruposSintomasComCadastro(grupos, cidsCadastro);
}

export function gruposSintomasPrecisamReparo(
  grupos: FaltaGrupoSintomaCidRow[],
  cidsCadastro: string[],
): boolean {
  const repaired = syncGruposSintomasComCadastro(grupos, cidsCadastro);
  return JSON.stringify(repaired) !== JSON.stringify(grupos);
}
