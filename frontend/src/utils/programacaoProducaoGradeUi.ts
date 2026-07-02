import type { PpColKey } from './programacaoProducaoGradeCells';

/** Colunas que permanecem fixas à esquerda na rolagem horizontal (podem ser ocultadas). */
export const PP_FROZEN_COL_KEYS: readonly PpColKey[] = [
  'cod_componente',
  'descricao_componente',
  'descricao_simplificada',
];

const STORAGE_COL_WIDTHS = 'programacaoProducao.colWidths.v3';
const MIN_COL_W = 48;
const MAX_COL_W = 520;

export const PP_DEFAULT_COL_WIDTHS: Record<string, number> = {
  cod_componente: 88,
  descricao_componente: 200,
  descricao_simplificada: 120,
  peso_unitario_bobina: 88,
  estoque: 88,
  empenho_componente: 88,
  venda_media_componente: 72,
  cod_bobina: 80,
  descricao_bobina: 160,
  estoque_atual_bobina: 96,
  estoque_mp_alternativa: 96,
  cod_bobina_alternativa: 100,
  descricao_bobina_alternativa: 140,
  saldo_projetado: 100,
  kg_bobina_necessario: 110,
  cobertura_meses: 88,
  sequencia: 72,
  qtde_produzir: 96,
  qtde_mp: 88,
  ordem_producao_nomus: 200,
  observacao: 140,
};

export function clampColWidth(w: number): number {
  return Math.max(MIN_COL_W, Math.min(MAX_COL_W, Math.round(w)));
}

export function colWidthPx(key: string, colWidths: Record<string, number>): number {
  return colWidths[key] ?? PP_DEFAULT_COL_WIDTHS[key] ?? 96;
}

/** `left` em px para coluna congelada visível; `undefined` se não for congelada ou estiver oculta. */
export function stickyLeftFrozenCol(
  colKey: PpColKey,
  visibleColKeys: PpColKey[],
  colWidths: Record<string, number>
): number | undefined {
  if (!PP_FROZEN_COL_KEYS.includes(colKey)) return undefined;
  const visIndex = visibleColKeys.indexOf(colKey);
  if (visIndex < 0) return undefined;
  let left = 0;
  for (const key of visibleColKeys) {
    if (key === colKey) break;
    if (PP_FROZEN_COL_KEYS.includes(key)) {
      left += colWidthPx(key, colWidths);
    }
  }
  return left;
}

export function isLastVisibleFrozenCol(colKey: PpColKey, visibleColKeys: PpColKey[]): boolean {
  if (!PP_FROZEN_COL_KEYS.includes(colKey)) return false;
  const frozenVisible = visibleColKeys.filter((k) => PP_FROZEN_COL_KEYS.includes(k));
  return frozenVisible[frozenVisible.length - 1] === colKey;
}

export function readProgramacaoProducaoColWidths(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_COL_WIDTHS);
    if (!raw) return { ...PP_DEFAULT_COL_WIDTHS };
    const p = JSON.parse(raw) as Record<string, unknown>;
    const out = { ...PP_DEFAULT_COL_WIDTHS };
    for (const [k, v] of Object.entries(p)) {
      if (typeof v === 'number' && Number.isFinite(v)) out[k] = clampColWidth(v);
    }
    return out;
  } catch {
    return { ...PP_DEFAULT_COL_WIDTHS };
  }
}

export function persistProgramacaoProducaoColWidths(widths: Record<string, number>): void {
  try {
    localStorage.setItem(STORAGE_COL_WIDTHS, JSON.stringify(widths));
  } catch {
    /* */
  }
}
