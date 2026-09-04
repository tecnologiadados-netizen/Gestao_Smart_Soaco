import { describe, expect, it } from 'vitest';
import {
  isPedidoBaixadoStub,
  resolverRespostaPedidoAposAjuste,
} from '../src/utils/respostaPedidoAposAjuste.js';

describe('resolverRespostaPedidoAposAjuste', () => {
  const pedido = { id_pedido: '188240-49898-1', PD: 'PD 49898' };

  it('usa a leitura pós-ajuste quando o pedido ainda está no Gerenciador', () => {
    const apos = { id_pedido: '188240-49898-1', PD: 'PD 49898', previsao: '2026-09-01' };
    expect(resolverRespostaPedidoAposAjuste(apos, pedido, pedido.id_pedido)).toBe(apos);
  });

  it('reusa a leitura de antes quando o pedido some do Nomus após gravar', () => {
    const r = resolverRespostaPedidoAposAjuste(null, pedido, pedido.id_pedido);
    expect(r).toBe(pedido);
    expect(isPedidoBaixadoStub(r)).toBe(false);
  });

  it('devolve stub 200 (não 404) quando o pedido nunca esteve na lista viva', () => {
    const r = resolverRespostaPedidoAposAjuste(null, null, '188240-49898-1');
    expect(r).toEqual({ id_pedido: '188240-49898-1', pedido_baixado: true });
    expect(isPedidoBaixadoStub(r)).toBe(true);
  });
});
