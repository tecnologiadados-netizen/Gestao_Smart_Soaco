import { PERMISSOES, type CodigoPermissao } from './permissoes';

export const ROTAS_FAVORITAVEIS = [
  '/pedidos/painel-metas/tv',
  '/pedidos/painel-metas/gerencial',
] as const;

export type RotaFavoritavel = (typeof ROTAS_FAVORITAVEIS)[number];

export type FiltrosFavorito = Record<string, string>;

export const TELAS_FAVORITAVEIS_CFG: Record<
  RotaFavoritavel,
  { label: string; requiredAny: CodigoPermissao[]; chaves: readonly string[] }
> = {
  '/pedidos/painel-metas/tv': {
    label: 'Painel TV',
    requiredAny: [PERMISSOES.PCP_PAINEL_TV_VER, PERMISSOES.PCP_TOTAL],
    chaves: ['setor', 'mes'],
  },
  '/pedidos/painel-metas/gerencial': {
    label: 'Painel Gerencial',
    requiredAny: [PERMISSOES.PCP_PAINEL_GERENCIAL_VER, PERMISSOES.PCP_TOTAL],
    chaves: ['setor', 'mes'],
  },
};

export function normalizarRotaFavorito(rota: string): string {
  const path = rota.split('?')[0]?.split('#')[0] ?? rota;
  if (!path.startsWith('/')) return `/${path}`;
  return path.replace(/\/+$/, '') || '/';
}

export function isRotaFavoritavel(rota: string): rota is RotaFavoritavel {
  const norm = normalizarRotaFavorito(rota);
  return (ROTAS_FAVORITAVEIS as readonly string[]).includes(norm);
}

export function rotaSuportaFavoritos(rota: string, hasPermission: (p: CodigoPermissao) => boolean): boolean {
  const norm = normalizarRotaFavorito(rota);
  if (!isRotaFavoritavel(norm)) return false;
  const cfg = TELAS_FAVORITAVEIS_CFG[norm];
  return cfg.requiredAny.some((p) => hasPermission(p));
}

export function resumoFiltrosFavorito(rota: string, filtros: FiltrosFavorito): string {
  if (
    rota === '/pedidos/painel-metas/tv' ||
    rota === '/pedidos/painel-metas/gerencial'
  ) {
    const parts: string[] = [];
    if (filtros.setor) parts.push(filtros.setor);
    if (filtros.mes) parts.push(filtros.mes);
    return parts.join(' · ');
  }
  return Object.values(filtros).filter(Boolean).join(' · ');
}

export function buildFavoritoUrl(rota: string, favId: number): string {
  const norm = normalizarRotaFavorito(rota);
  return `${norm}?fav=${favId}`;
}

export function filtrosFromSearchParams(rota: string, params: URLSearchParams): FiltrosFavorito | null {
  const norm = normalizarRotaFavorito(rota);
  if (!isRotaFavoritavel(norm)) return null;
  const cfg = TELAS_FAVORITAVEIS_CFG[norm];
  const out: FiltrosFavorito = {};
  let hasAny = false;
  for (const chave of cfg.chaves) {
    const v = params.get(chave);
    if (v?.trim()) {
      out[chave] = v.trim();
      hasAny = true;
    }
  }
  return hasAny ? out : null;
}
