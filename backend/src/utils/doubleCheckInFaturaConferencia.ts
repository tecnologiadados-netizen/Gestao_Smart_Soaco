/**
 * Fatura ausente na pré-entrada só impede a conferência quando a condição de
 * pagamento ainda entra na leitura. Com o critério desligado e sem lançamento
 * anterior nesse documento, a nota segue sem essa pendência.
 */
export function pagamentoXmlPendenteEfetivo(params: {
  pagamentoXmlPendente: boolean;
  criterioCondicaoAtivo: boolean;
  condicaoJaLancada: boolean;
}): boolean {
  if (!params.pagamentoXmlPendente) return false;
  return params.criterioCondicaoAtivo || params.condicaoJaLancada;
}
