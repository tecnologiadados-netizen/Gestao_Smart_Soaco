const STORAGE_COL_WIDTHS = 'ressupAlmox.colWidths.v1';
const MIN_COL_W = 48;
const MAX_COL_W = 520;

export const RESSUP_DEFAULT_COL_WIDTHS: Record<string, number> = {
  codigo: 88,
  descricao: 200,
  coleta: 120,
  itemCritico: 72,
  qtdeEmp: 72,
  cm: 56,
  cobertura: 72,
  qtdSolicit: 80,
  qtdeSug: 108,
  dataNecessSug: 132,
  qtdAprov: 128,
  dataNecessAprov: 140,
  estoqAtual: 88,
  qtdeUltComp: 88,
  ultimoFornecedor: 140,
  estSeg: 64,
  pcPend: 64,
  agPag: 64,
  saldoProjetado: 96,
};

export function clampColWidth(w: number): number {
  return Math.max(MIN_COL_W, Math.min(MAX_COL_W, Math.round(w)));
}

export function readRessupColWidths(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_COL_WIDTHS);
    if (!raw) return { ...RESSUP_DEFAULT_COL_WIDTHS };
    const p = JSON.parse(raw) as Record<string, unknown>;
    const out = { ...RESSUP_DEFAULT_COL_WIDTHS };
    for (const [k, v] of Object.entries(p)) {
      if (typeof v === 'number' && Number.isFinite(v)) out[k] = clampColWidth(v);
    }
    return out;
  } catch {
    return { ...RESSUP_DEFAULT_COL_WIDTHS };
  }
}

export function persistRessupColWidths(widths: Record<string, number>): void {
  try {
    localStorage.setItem(STORAGE_COL_WIDTHS, JSON.stringify(widths));
  } catch {
    /* quota / privado */
  }
}
