import { describe, expect, it } from 'vitest';
import { contarItensSemVinculoPedido } from './doubleCheckInPendencias.js';

describe('contarItensSemVinculoPedido', () => {
  it('conta o item sem pedido quando o documento também tem vínculo', () => {
    expect(
      contarItensSemVinculoPedido([
        { semVinculoPedido: false },
        { semVinculoPedido: true },
        { semVinculoPedido: true },
      ])
    ).toBe(2);
  });

  it('não conta quando o documento inteiro está sem pedido', () => {
    expect(
      contarItensSemVinculoPedido([{ semVinculoPedido: true }, { semVinculoPedido: true }])
    ).toBe(0);
  });

  it('trata linha antiga, sem a marca, como vinculada', () => {
    expect(contarItensSemVinculoPedido([{}, { semVinculoPedido: true }])).toBe(1);
  });
});
