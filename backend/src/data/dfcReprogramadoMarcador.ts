/**
 * Marcadores operacionais de título reprogramado (vencimento empurrado para o futuro,
 * mas tratado como vencido na DFC).
 *
 * Nomus: "REPROGR" em descricaoLancamento do agendamento ou descricao do lançamento.
 * Shop9: "REPR" em Descricao (histórico/descrição da conta) — KPI vencidos hoje é só Nomus.
 */

/** Token Nomus (REPROGRAMADO / REPROGRAMAÇÃO / …). */
export const DFC_REPROGRAMADO_TOKEN_NOMUS = 'REPROGR';

/** Token Shop9 (mais curto; usado se/quando Shop9 entrar no KPI de vencidos). */
export const DFC_REPROGRAMADO_TOKEN_SHOP9 = 'REPR';

/**
 * SQL booleano: agendamento Nomus marcado como reprogramado.
 * Sem parâmetros bind — o token é constante de código.
 */
export function sqlAfMarcadoReprogramadoNomus(aliasAf = 'af'): string {
  const like = `'%${DFC_REPROGRAMADO_TOKEN_NOMUS}%'`;
  return `(
    UPPER(COALESCE(${aliasAf}.descricaoLancamento, '')) LIKE ${like}
    OR EXISTS (
      SELECT 1
      FROM lancamentofinanceiro lf_repr
      WHERE COALESCE(lf_repr.idAgendamentoPagamento, lf_repr.idAgendamentoRecebimento) = ${aliasAf}.id
        AND UPPER(COALESCE(lf_repr.descricao, '')) LIKE ${like}
    )
  )`;
}

/** True se texto Shop9 contém o marcador REPR. */
export function textoMarcadoReprogramadoShop9(descricao: string | null | undefined): boolean {
  return String(descricao ?? '')
    .toUpperCase()
    .includes(DFC_REPROGRAMADO_TOKEN_SHOP9);
}
