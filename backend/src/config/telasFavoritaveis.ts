import { PERMISSOES, type CodigoPermissao } from './permissoes.js';

/**
 * Registry opcional: telas com validação estrita de filtros.
 * Qualquer outra rota do app pode guardar filtros livres (Record<string,string>).
 *
 * Para persistir visão completa numa tela:
 * - useRegistrarVisaoFavorito / useFavoritoPagina com os filtros atuais
 * - useTelaFavorita / useFavoritoPagina para aplicar ao abrir ?fav=
 */

export const ROTAS_FAVORITAVEIS = [
  '/pedidos/painel-metas/tv',
  '/pedidos/painel-metas/gerencial',
] as const;

export type RotaFavoritavel = (typeof ROTAS_FAVORITAVEIS)[number];

type FiltrosPainel = { setor?: string; mes?: string };

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

const MAX_FILTRO_KEYS = 40;
const MAX_FILTRO_JSON_CHARS = 12_000;

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

function parseFiltrosJson(raw: unknown): FiltrosFavorito | null {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      return parseFiltrosJson(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: FiltrosFavorito = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string' && v.trim()) out[k] = v.trim();
  }
  return out;
}

function limiteTamanhoFiltros(filtros: FiltrosFavorito): string | null {
  const keys = Object.keys(filtros);
  if (keys.length > MAX_FILTRO_KEYS) {
    return `Excesso de filtros (máx. ${MAX_FILTRO_KEYS}).`;
  }
  try {
    if (JSON.stringify(filtros).length > MAX_FILTRO_JSON_CHARS) {
      return 'Filtros muito grandes para salvar no favorito.';
    }
  } catch {
    return 'Filtros inválidos.';
  }
  return null;
}

export function validarFiltrosFavorito(
  rota: string,
  filtrosRaw: unknown
): { ok: true; filtros: FiltrosFavorito } | { ok: false; error: string } {
  const filtros = parseFiltrosJson(filtrosRaw);
  if (!filtros) return { ok: false, error: 'Filtros inválidos.' };

  if (isRotaFavoritavel(rota)) {
    const cfg = TELAS_FAVORITAVEIS_CFG[rota];
    for (const chave of cfg.chaves) {
      if (!filtros[chave]?.trim()) {
        return { ok: false, error: `Filtro "${chave}" é obrigatório.` };
      }
    }
    // Permite chaves extras (ex.: __hash) além das obrigatórias do registry
    const lim = limiteTamanhoFiltros(filtros);
    if (lim) return { ok: false, error: lim };
    return { ok: true, filtros };
  }

  if (!isRotaAppFavoritavel(rota)) {
    return { ok: false, error: 'Rota inválida para favorito.' };
  }
  const lim = limiteTamanhoFiltros(filtros);
  if (lim) return { ok: false, error: lim };
  return { ok: true, filtros };
}

export function filtrosPermitidosParaPermissoes(
  rota: string,
  permissoes: string[]
): boolean {
  if (isRotaFavoritavel(rota)) {
    const cfg = TELAS_FAVORITAVEIS_CFG[rota];
    return cfg.requiredAny.some((p) => permissoes.includes(p));
  }
  return isRotaAppFavoritavel(rota);
}

export function resumoFiltrosPainel(filtros: FiltrosPainel): string {
  const parts: string[] = [];
  if (filtros.setor) parts.push(filtros.setor);
  if (filtros.mes) parts.push(filtros.mes);
  return parts.join(' · ');
}

export function resumoFiltrosFavorito(rota: string, filtros: FiltrosFavorito): string {
  if (
    rota === '/pedidos/painel-metas/tv' ||
    rota === '/pedidos/painel-metas/gerencial'
  ) {
    return resumoFiltrosPainel(filtros);
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

export function labelFavoritoRota(rota: string): string {
  if (isRotaFavoritavel(rota)) return TELAS_FAVORITAVEIS_CFG[rota].label;
  return rota;
}
