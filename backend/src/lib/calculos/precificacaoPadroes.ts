/** Espelho de frontend/src/lib/calculos/precificacaoPadroes.ts */
export const PRECIFICACAO_PADROES = {
  despesasAdministrativas: 12,
  cofins: 7.6,
  pis: 1.65,
  csll: 1.08,
  irpj: 0.42,
  icms: 0,
  ipi: 0,
} as const;

export function aliquotaImpostosVenda(overrides?: {
  cofins?: number;
  pis?: number;
  csll?: number;
  irpj?: number;
  ipi?: number;
  icms?: number;
}): number {
  const p = { ...PRECIFICACAO_PADROES, ...overrides };
  return p.cofins + p.pis + p.csll + p.irpj + p.ipi + p.icms;
}

export function aliquotaDespesasPadrao(): number {
  return PRECIFICACAO_PADROES.despesasAdministrativas;
}
