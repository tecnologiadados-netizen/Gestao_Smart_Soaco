/**
 * Percentuais padrão da aba Markup da Precificação (INITIAL_VALUES).
 * Fonte: frontend/src/components/precificacao/ModalResultadoPrecificacao.tsx
 * Não altera a tela de Engenharia — só reaproveita os números.
 */
export const PRECIFICACAO_PADROES = {
  sucata: 1,
  fosfatizacao: 5,
  solda: 3,
  gasGlp: 3,
  maoDeObraDireta: 20,
  maoDeObraIndireta: 1,
  depreciacao: 1,
  /** % despesas usado na Rentabilidade (sobre Receita Bruta). */
  despesasAdministrativas: 12,
  embalagem: 5,
  frete: 8,
  comissoes: 5,
  propaganda: 1,
  lucro: 50,
  cofins: 7.6,
  pis: 1.65,
  csll: 1.08,
  irpj: 0.42,
  icms: 0,
  ipi: 0,
} as const;

/** Soma dos tributos s/ venda (decisão Rentabilidade: Receita × Σ alíquotas). */
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
