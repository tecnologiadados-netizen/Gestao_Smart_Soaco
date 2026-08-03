import { describe, expect, it } from 'vitest';
import { isClienteParceiroCreditoExcluido } from './financeiroCreditoClientesParceiros';

describe('isClienteParceiroCreditoExcluido', () => {
  it('exclui R N Marques e variações', () => {
    expect(isClienteParceiroCreditoExcluido('R N MARQUES')).toBe(true);
    expect(
      isClienteParceiroCreditoExcluido('R N MARQUES ARAÚJO (AÇO MÓVEIS)')
    ).toBe(true);
    expect(isClienteParceiroCreditoExcluido('r n marques ltda')).toBe(true);
  });

  it('exclui Só Móveis e variações', () => {
    expect(isClienteParceiroCreditoExcluido('SÓ MÓVEIS')).toBe(true);
    expect(isClienteParceiroCreditoExcluido('SO MOVEIS')).toBe(true);
    expect(isClienteParceiroCreditoExcluido('SÓ MÓVEIS LTDA')).toBe(true);
  });

  it('não exclui clientes comerciais comuns', () => {
    expect(isClienteParceiroCreditoExcluido('AÇO MÓVEIS COMÉRCIO')).toBe(false);
    expect(isClienteParceiroCreditoExcluido('MARQUES INDUSTRIAL')).toBe(false);
    expect(isClienteParceiroCreditoExcluido('CLIENTE QUALQUER')).toBe(false);
  });
});
