/**
 * Resposta de POST /ajustar-previsao quando o pedido some da lista viva do Nomus
 * (baixado no ERP) depois de o ajuste já ter sido gravado no SQLite.
 */

export type PedidoBaixadoStub = {
  id_pedido: string;
  pedido_baixado: true;
};

export function isPedidoBaixadoStub(value: unknown): value is PedidoBaixadoStub {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as PedidoBaixadoStub).pedido_baixado === true &&
    typeof (value as PedidoBaixadoStub).id_pedido === 'string'
  );
}

/**
 * O ajuste já persistiu: não devolver 404 só porque a linha saiu do Gerenciador.
 * Prefere a leitura pós-ajuste; se sumiu, reusa a de antes; se nunca esteve na lista, stub 200.
 */
export function resolverRespostaPedidoAposAjuste<T>(
  pedidoApos: T | null | undefined,
  pedidoAntes: T | null | undefined,
  idPedido: string
): T | PedidoBaixadoStub {
  if (pedidoApos) return pedidoApos;
  if (pedidoAntes) return pedidoAntes;
  return { id_pedido: idPedido, pedido_baixado: true };
}
