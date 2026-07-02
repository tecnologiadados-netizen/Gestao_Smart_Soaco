import type { MapaMunicipioItem, TooltipDetalheRow } from '../api/pedidos';
import { isCarradaRota } from './rotaCarrada';

export const ROTULO_SEM_ROTA = '(sem rota)';

/** Separador de valores no MultiSelect (evita conflito com vírgulas em nomes de rota). */
export const FILTRO_ROTEIRO_SEP = '\x1f';

export type ItemMapaRoteiro = {
  chave: string;
  municipio: string;
  uf: string;
  rotas: Set<string>;
};

export function rotasDoItem(detalhes: MapaMunicipioItem['detalhes']): Set<string> {
  const s = new Set<string>();
  for (const d of detalhes ?? []) {
    const r = (d.rota ?? '').trim();
    s.add(r || ROTULO_SEM_ROTA);
  }
  if (s.size === 0) s.add(ROTULO_SEM_ROTA);
  return s;
}

export function indexarItensMapaRoteiro(
  itens: { item: MapaMunicipioItem; chave: string }[]
): ItemMapaRoteiro[] {
  return itens.map(({ item, chave }) => ({
    chave,
    municipio: (item.municipio ?? '').trim(),
    uf: (item.uf ?? '').trim().toUpperCase(),
    rotas: rotasDoItem(item.detalhes),
  }));
}

function itemAtendeRotas(item: ItemMapaRoteiro, rotasSel: ReadonlySet<string>): boolean {
  if (rotasSel.size === 0) return true;
  for (const r of item.rotas) {
    if (rotasSel.has(r)) return true;
  }
  return false;
}

function itemAtendeUfs(item: ItemMapaRoteiro, ufsSel: ReadonlySet<string>): boolean {
  if (ufsSel.size === 0) return true;
  return ufsSel.has(item.uf);
}

function itemAtendeMunicipios(item: ItemMapaRoteiro, munSel: ReadonlySet<string>): boolean {
  if (munSel.size === 0) return true;
  return munSel.has(item.chave);
}

export function filtrarItensMapaRoteiro(
  itens: ItemMapaRoteiro[],
  rotasSel: ReadonlySet<string>,
  ufsSel: ReadonlySet<string>,
  municipiosSel: ReadonlySet<string>
): ItemMapaRoteiro[] {
  return itens.filter(
    (it) =>
      itemAtendeRotas(it, rotasSel) &&
      itemAtendeUfs(it, ufsSel) &&
      itemAtendeMunicipios(it, municipiosSel)
  );
}

/** Opções de UF ainda válidas dado o recorte de rotas. */
export function ufsDisponiveis(itens: ItemMapaRoteiro[], rotasSel: ReadonlySet<string>): string[] {
  const ufs = new Set<string>();
  for (const it of itens) {
    if (itemAtendeRotas(it, rotasSel)) ufs.add(it.uf);
  }
  return [...ufs].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/** Municípios (chave) ainda válidos dado rotas + UFs. */
export function municipiosDisponiveis(
  itens: ItemMapaRoteiro[],
  rotasSel: ReadonlySet<string>,
  ufsSel: ReadonlySet<string>
): ItemMapaRoteiro[] {
  return itens.filter((it) => itemAtendeRotas(it, rotasSel) && itemAtendeUfs(it, ufsSel));
}

export function rotasUnicas(itens: ItemMapaRoteiro[]): string[] {
  const s = new Set<string>();
  for (const it of itens) {
    for (const r of it.rotas) s.add(r);
  }
  return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
}

/** Carradas reais (ROTA …) presentes no mapa — exclui (sem rota) e rotas não-carrada. */
export function rotasCarradaUnicas(itens: ItemMapaRoteiro[]): string[] {
  return rotasUnicas(itens).filter((r) => r !== ROTULO_SEM_ROTA && isCarradaRota(r));
}

/** Filtra linhas de detalhe pelas rotas selecionadas. `rotasSel` null/empty = sem filtro. */
export function filtrarDetalhesPorRotas(
  detalhes: TooltipDetalheRow[],
  rotasSel: ReadonlySet<string> | null
): TooltipDetalheRow[] {
  if (!rotasSel || rotasSel.size === 0) return detalhes;
  return detalhes.filter((row) => rotasSel.has((row.rota ?? '').trim()));
}

/** Rotas ainda compatíveis com UF/municípios selecionados. */
export function rotasDisponiveis(
  itens: ItemMapaRoteiro[],
  ufsSel: ReadonlySet<string>,
  municipiosSel: ReadonlySet<string>
): string[] {
  const s = new Set<string>();
  for (const it of itens) {
    if (!itemAtendeUfs(it, ufsSel)) continue;
    if (!itemAtendeMunicipios(it, municipiosSel)) continue;
    for (const r of it.rotas) s.add(r);
  }
  return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
}

export type SelecoesFiltroRoteiro = {
  rotasSel: Set<string>;
  ufsSel: Set<string>;
  municipiosSel: Set<string>;
};

export type OrigemFiltroRoteiro = 'rota' | 'uf' | 'municipio';

/**
 * Sincroniza facetas: ao mudar rota recalcula UF/município; ao mudar UF recalcula município; etc.
 */
export function sincronizarFacetasRoteiro(
  itens: ItemMapaRoteiro[],
  rotasSel: Set<string>,
  ufsSel: Set<string>,
  municipiosSel: Set<string>,
  origem: OrigemFiltroRoteiro
): SelecoesFiltroRoteiro {
  if (origem === 'rota') {
    if (rotasSel.size === 0) {
      return { rotasSel: new Set(), ufsSel: new Set(), municipiosSel: new Set() };
    }
    const ufs = ufsDisponiveis(itens, rotasSel);
    const ufsSet = new Set(ufs);
    const mun = municipiosDisponiveis(itens, rotasSel, ufsSet);
    return {
      rotasSel: new Set(rotasSel),
      ufsSel: ufsSet,
      municipiosSel: new Set(mun.map((m) => m.chave)),
    };
  }

  if (origem === 'uf') {
    if (rotasSel.size === 0 || ufsSel.size === 0) {
      return {
        rotasSel: new Set(rotasSel),
        ufsSel: new Set(ufsSel),
        municipiosSel: new Set(),
      };
    }
    const mun = municipiosDisponiveis(itens, rotasSel, ufsSel);
    const rotasOk = rotasDisponiveis(itens, ufsSel, new Set(mun.map((m) => m.chave)));
    const rotasSet = new Set([...rotasSel].filter((r) => rotasOk.includes(r)));
    return {
      rotasSel: rotasSet.size > 0 ? rotasSet : new Set(rotasOk),
      ufsSel: new Set(ufsSel),
      municipiosSel: new Set(mun.map((m) => m.chave)),
    };
  }

  const rotasOk = rotasDisponiveis(itens, ufsSel, municipiosSel);
  const rotasSet = new Set([...rotasSel].filter((r) => rotasOk.includes(r)));
  const ufsOk = ufsDisponiveis(itens, rotasSet.size > 0 ? rotasSet : rotasSel);
  const ufsSet = new Set([...ufsSel].filter((u) => ufsOk.includes(u)));
  const mun = municipiosDisponiveis(
    itens,
    rotasSet.size > 0 ? rotasSet : rotasSel,
    ufsSet.size > 0 ? ufsSet : ufsSel
  );
  const munSet = new Set([...municipiosSel].filter((k) => mun.some((m) => m.chave === k)));
  return {
    rotasSel: rotasSet.size > 0 ? rotasSet : new Set(rotasOk),
    ufsSel: ufsSet.size > 0 ? ufsSet : new Set(ufsOk),
    municipiosSel: munSet.size > 0 ? munSet : new Set(mun.map((m) => m.chave)),
  };
}

export function labelMunicipio(item: ItemMapaRoteiro): string {
  return item.uf ? `${item.municipio}/${item.uf}` : item.municipio;
}

/** Remove seleções que deixaram de ser válidas após mudar filtro superior. */
export function restringirSelecoes(
  ufsSel: Set<string>,
  municipiosSel: Set<string>,
  itens: ItemMapaRoteiro[],
  rotasSel: ReadonlySet<string>
): { ufsSel: Set<string>; municipiosSel: Set<string> } {
  const ufsOk = ufsDisponiveis(itens, rotasSel);
  const ufsSet = new Set([...ufsSel].filter((u) => ufsOk.includes(u)));
  const munOk = municipiosDisponiveis(itens, rotasSel, ufsSet);
  const munSet = new Set([...municipiosSel].filter((k) => munOk.some((m) => m.chave === k)));
  return { ufsSel: ufsSet, municipiosSel: munSet };
}
