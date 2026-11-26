/**
 * Mensagens da trava Disponível × previsão não confiável.
 * Devem permanecer iguais às de backend/src/services/sycroOrderDisponivelConfiavel.ts.
 */

export const MSG_BLOQUEIO_MARCAR_DISPONIVEL =
  'Não é possível marcar como disponível enquanto a previsão estiver como não confiável. Atualize a previsão para o dia de hoje ou um dia seguinte, marque Previsão confiável como Sim e só então marque o pedido como disponível.';

export function mensagemBloqueioNaoConfiavel(pds: string[] = []): string {
  const lista = [...new Set(pds.map((p) => String(p ?? '').trim()).filter(Boolean))];
  const alvo =
    lista.length === 0
      ? 'o pedido estiver marcado como disponível'
      : lista.length === 1
        ? `o pedido ${lista[0]} estiver marcado como disponível`
        : `os pedidos ${lista.slice(0, 8).join(', ')}${lista.length > 8 ? '…' : ''} estiverem marcados como disponível`;
  return `Não é possível gravar a previsão como não confiável enquanto ${alvo}. Desmarque a tag Disponível na Comunicação PD e só então escolha Não em Previsão confiável.`;
}
