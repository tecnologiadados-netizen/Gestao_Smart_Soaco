const STORAGE_COL_WIDTHS = 'pendenciasCompras.colWidths.v1';
const MIN_COL_W = 48;
const MAX_COL_W = 640;

export const PENDENCIAS_DEFAULT_COL_WIDTHS: Record<string, number> = {
  codigo: 88,
  descricao: 320,
  nomeColeta: 200,
  dataEmissao: 100,
  dataNecessidade: 118,
  solicitacao: 88,
  agPag: 80,
  pedidoCompra: 64,
  estoqueAtual: 120,
  dataUltimaEntrada: 120,
  estoqueAntesUltimaEntrada: 148,
  prioridadeFixa: 112,
  historicoPrioridade: 72,
};

export function clampColWidth(w: number): number {
  return Math.max(MIN_COL_W, Math.min(MAX_COL_W, Math.round(w)));
}

export function readPendenciasColWidths(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_COL_WIDTHS);
    if (!raw) return { ...PENDENCIAS_DEFAULT_COL_WIDTHS };
    const p = JSON.parse(raw) as Record<string, unknown>;
    const out = { ...PENDENCIAS_DEFAULT_COL_WIDTHS };
    for (const [k, v] of Object.entries(p)) {
      if (typeof v === 'number' && Number.isFinite(v)) out[k] = clampColWidth(v);
    }
    return out;
  } catch {
    return { ...PENDENCIAS_DEFAULT_COL_WIDTHS };
  }
}

export function persistPendenciasColWidths(widths: Record<string, number>): void {
  try {
    localStorage.setItem(STORAGE_COL_WIDTHS, JSON.stringify(widths));
  } catch {
    /* quota / privado */
  }
}

export function larguraColunaPendencias(
  colKey: string,
  colWidths: Record<string, number>
): number {
  return colWidths[colKey] ?? PENDENCIAS_DEFAULT_COL_WIDTHS[colKey] ?? 96;
}
