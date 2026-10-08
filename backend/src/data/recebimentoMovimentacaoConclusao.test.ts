import { describe, expect, it } from 'vitest';
import { movimentacaoDeixouPreEntrada } from './recebimentoNomusRepository.js';

describe('movimentacaoDeixouPreEntrada', () => {
  const preEntrada = new Set([10, 11]);

  it('mantém o documento na fila enquanto o tipo ainda é pré-entrada', () => {
    expect(movimentacaoDeixouPreEntrada(10, preEntrada)).toBe(false);
  });

  it('conclui quando o Nomus troca para outro tipo de movimentação', () => {
    expect(movimentacaoDeixouPreEntrada(42, preEntrada)).toBe(true);
  });

  it('não conclui sem tipo identificado', () => {
    expect(movimentacaoDeixouPreEntrada(0, preEntrada)).toBe(false);
  });
});
