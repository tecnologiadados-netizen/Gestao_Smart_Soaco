const STORAGE_COL_WIDTHS = 'consultaEstoque.colWidths.v1';
const STORAGE_COL_OCULTAS = 'consultaEstoque.colunasOcultas.v1';
const MIN_COL_W = 48;
const MAX_COL_W = 520;

export const CONSULTA_ESTOQUE_DEFAULT_COL_WIDTHS: Record<string, number> = {
  codigo: 100,
  descricao: 240,
  und: 64,
  empenho: 96,
  saldo: 112,
  solicitacao: 100,
  cotacao: 88,
  pedidoCompra: 120,
  saldoProjetado: 120,
};

export function clampConsultaEstoqueColWidth(w: number): number {
  return Math.max(MIN_COL_W, Math.min(MAX_COL_W, Math.round(w)));
}

export function readConsultaEstoqueColWidths(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_COL_WIDTHS);
    if (!raw) return { ...CONSULTA_ESTOQUE_DEFAULT_COL_WIDTHS };
    const p = JSON.parse(raw) as Record<string, unknown>;
    const out = { ...CONSULTA_ESTOQUE_DEFAULT_COL_WIDTHS };
    for (const [k, v] of Object.entries(p)) {
      if (typeof v === 'number' && Number.isFinite(v)) out[k] = clampConsultaEstoqueColWidth(v);
    }
    return out;
  } catch {
    return { ...CONSULTA_ESTOQUE_DEFAULT_COL_WIDTHS };
  }
}

export function persistConsultaEstoqueColWidths(widths: Record<string, number>): void {
  try {
    localStorage.setItem(STORAGE_COL_WIDTHS, JSON.stringify(widths));
  } catch {
    /* quota / privado */
  }
}

export function loadConsultaEstoqueColunasOcultas(): string[] {
  try {
    const s = sessionStorage.getItem(STORAGE_COL_OCULTAS);
    if (!s) return [];
    const p = JSON.parse(s) as unknown;
    return Array.isArray(p) ? p.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function persistConsultaEstoqueColunasOcultas(ocultas: string[]): void {
  try {
    sessionStorage.setItem(STORAGE_COL_OCULTAS, JSON.stringify(ocultas));
  } catch {
    /* ignore */
  }
}
