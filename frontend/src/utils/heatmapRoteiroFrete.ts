/**
 * %Frete = ((Distância / Consumo) × PrCombustível) / Valor × 100
 */

export function pctFrete(
  distanciaKm: number,
  consumoKmL: number,
  precoLitro: number,
  valorVenda: number
): number | null {
  if (!(distanciaKm >= 0) || !(consumoKmL > 0) || !(precoLitro >= 0) || !(valorVenda > 0)) {
    return null;
  }
  const custo = (distanciaKm / consumoKmL) * precoLitro;
  return (custo / valorVenda) * 100;
}

export function fmtPctFrete(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return '—';
  return `${pct.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

export function fmtPrecoCombustivelBrl(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export const HEATMAP_PRECO_COMBUSTIVEL_KEY = 'heatmap_preco_combustivel';
export const HEATMAP_CATEGORIA_ROTEIRO_KEY = 'heatmap_categoria_roteiro_id';
export const PRECO_COMBUSTIVEL_DEFAULT = 6;

export function readStoredPrecoCombustivel(): number {
  try {
    const raw = localStorage.getItem(HEATMAP_PRECO_COMBUSTIVEL_KEY);
    if (raw == null) return PRECO_COMBUSTIVEL_DEFAULT;
    const n = Number(String(raw).replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) return PRECO_COMBUSTIVEL_DEFAULT;
    return n;
  } catch {
    return PRECO_COMBUSTIVEL_DEFAULT;
  }
}

export function writeStoredPrecoCombustivel(valor: number): void {
  try {
    localStorage.setItem(HEATMAP_PRECO_COMBUSTIVEL_KEY, String(valor));
  } catch {
    /* */
  }
}

export function readStoredCategoriaRoteiroId(): number | null {
  try {
    const raw = localStorage.getItem(HEATMAP_CATEGORIA_ROTEIRO_KEY);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function writeStoredCategoriaRoteiroId(id: number | null): void {
  try {
    if (id == null) localStorage.removeItem(HEATMAP_CATEGORIA_ROTEIRO_KEY);
    else localStorage.setItem(HEATMAP_CATEGORIA_ROTEIRO_KEY, String(id));
  } catch {
    /* */
  }
}
