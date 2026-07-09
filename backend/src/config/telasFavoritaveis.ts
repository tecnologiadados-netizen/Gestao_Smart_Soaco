import { PERMISSOES, type CodigoPermissao } from './permissoes.js';

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

export function normalizarRotaFavorito(rota: string): string {
  const path = rota.split('?')[0]?.split('#')[0] ?? rota;
  if (!path.startsWith('/')) return `/${path}`;
  return path.replace(/\/+$/, '') || '/';
}

export function isRotaFavoritavel(rota: string): rota is RotaFavoritavel {
  const norm = normalizarRotaFavorito(rota);
  return (ROTAS_FAVORITAVEIS as readonly string[]).includes(norm);
}

function parseFiltrosJson(raw: unknown): FiltrosFavorito | null {
  if (raw == null) return null;
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

export function validarFiltrosFavorito(
  rota: string,
  filtrosRaw: unknown
): { ok: true; filtros: FiltrosFavorito } | { ok: false; error: string } {
  if (!isRotaFavoritavel(rota)) {
    return { ok: false, error: 'Rota não suporta favoritos.' };
  }
  const cfg = TELAS_FAVORITAVEIS_CFG[rota];
  const filtros = parseFiltrosJson(filtrosRaw);
  if (!filtros) return { ok: false, error: 'Filtros inválidos.' };

  for (const chave of cfg.chaves) {
    if (!filtros[chave]?.trim()) {
      return { ok: false, error: `Filtro "${chave}" é obrigatório.` };
    }
  }

  const extras = Object.keys(filtros).filter((k) => !(cfg.chaves as readonly string[]).includes(k));
  if (extras.length > 0) {
    return { ok: false, error: `Filtros não permitidos: ${extras.join(', ')}.` };
  }

  return { ok: true, filtros };
}

export function filtrosPermitidosParaPermissoes(
  rota: string,
  permissoes: string[]
): boolean {
  if (!isRotaFavoritavel(rota)) return false;
  const cfg = TELAS_FAVORITAVEIS_CFG[rota];
  return cfg.requiredAny.some((p) => permissoes.includes(p));
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
  return Object.values(filtros).filter(Boolean).join(' · ');
}
