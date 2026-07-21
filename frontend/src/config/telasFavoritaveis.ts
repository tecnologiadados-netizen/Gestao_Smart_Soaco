import { PERMISSOES, type CodigoPermissao } from './permissoes';

/**
 * Registry opcional (validação estrita). Qualquer rota do app pode salvar filtros livres.
 *
 * Uso numa página:
 *   useFavoritoPagina({ rota, telaLabel, filtros, aplicarFiltros, resumoFiltros })
 */

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

export function isRotaAppFavoritavel(rota: string): boolean {
  const n = normalizarRotaFavorito(rota);
  if (!n.startsWith('/') || n.startsWith('//')) return false;
  if (n.includes('..') || n.includes('\\')) return false;
  if (n === '/' || n === '/sem-acesso' || n === '/entrar') return false;
  return true;
}

export function rotaSuportaFavoritos(rota: string, hasPermission: (p: CodigoPermissao) => boolean): boolean {
  const norm = normalizarRotaFavorito(rota);
  if (isRotaFavoritavel(norm)) {
    const cfg = TELAS_FAVORITAVEIS_CFG[norm];
    return cfg.requiredAny.some((p) => hasPermission(p));
  }
  return isRotaAppFavoritavel(norm);
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
  if (rota === '/rh/dashboard') {
    const parts: string[] = [];
    const tabLabels: Record<string, string> = {
      executivo: 'Executivo',
      absenteismo: 'Absenteísmo',
      'absenteismo-horas': 'Pontualidade',
      'diagnostico-ausencias-justificadas': 'Diagnóstico',
    };
    if (filtros.tab) parts.push(tabLabels[filtros.tab] ?? filtros.tab);
    if (filtros.selectedColaboradores) {
      try {
        const arr = JSON.parse(filtros.selectedColaboradores) as unknown;
        if (Array.isArray(arr) && arr.length > 0) {
          const nomes = arr
            .map((k) => String(k).split('|||')[1] || String(k))
            .filter(Boolean)
            .slice(0, 2);
          parts.push(nomes.join(', ') + (arr.length > 2 ? ` +${arr.length - 2}` : ''));
        }
      } catch {
        /* ignore */
      }
    }
    return parts.join(' · ');
  }
  const vals = Object.entries(filtros)
    .filter(([k, v]) => v && !k.startsWith('__'))
    .map(([, v]) => v)
    .slice(0, 4);
  return vals.join(' · ');
}

export function buildFavoritoUrl(rota: string, favId: number): string {
  const norm = normalizarRotaFavorito(rota);
  return `${norm}?fav=${favId}`;
}

/** Query da URL atual (sem `fav`) para embutir no favorito. */
export function searchParamsParaFiltrosFavorito(params: URLSearchParams): FiltrosFavorito {
  const out: FiltrosFavorito = {};
  params.forEach((value, key) => {
    if (key === 'fav') return;
    if (value.trim()) out[key] = value.trim();
  });
  return out;
}

export function filtrosFromSearchParams(rota: string, params: URLSearchParams): FiltrosFavorito | null {
  const norm = normalizarRotaFavorito(rota);
  if (isRotaFavoritavel(norm)) {
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
  const fromUrl = searchParamsParaFiltrosFavorito(params);
  return Object.keys(fromUrl).length > 0 ? fromUrl : null;
}
