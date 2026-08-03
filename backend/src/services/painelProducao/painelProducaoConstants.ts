export const SETOR_EXCLUIDOS = new Set(['---', 'Outros', 'A definir', 'Setor', '', null as unknown as string]);

export const SETOR_PESO = new Set(['Porta Paletes', 'Gôndolas']);

/** A partir de mar/2026, Gôndolas e Porta Paletes passam a medir pedidos atendidos. */
export const SETOR_PEDIDOS_CUTOVER = new Date(2026, 2, 1);

/** Início do histórico mensal (alinhado ao BI / gond_portap.sql). */
export const PRODUCAO_HISTORICO_INICIO = new Date(2024, 0, 1);

/** Nome canônico do setor (CSV antigo usava sem acento). */
export const SETOR_MOVEIS_MELAMINICO = 'Móveis em melamínico';

const SETOR_ALIASES: Record<string, string> = {
  'Móveis em melaminico': SETOR_MOVEIS_MELAMINICO,
  'Moveis em melaminico': SETOR_MOVEIS_MELAMINICO,
  'Moveis em melamínico': SETOR_MOVEIS_MELAMINICO,
};

/** Unifica grafias equivalentes de setor (ex.: melaminico → melamínico). */
export function canonicalizeSetorPainel(setor: string): string {
  const t = String(setor ?? '').trim();
  if (!t) return t;
  return SETOR_ALIASES[t] ?? t;
}
