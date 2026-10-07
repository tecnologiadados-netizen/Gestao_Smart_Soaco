import { describe, expect, it } from 'vitest';
import { motivoPaiCompativel, normalizarMotivoPai } from './motivoDesligamento.js';

describe('motivo pai do desligamento', () => {
  it('ignora acento, caixa e espaços ao comparar', () => {
    expect(normalizarMotivoPai('  Pedido  de Demissão ')).toBe('pedido de demissao');
    expect(motivoPaiCompativel('Pedido de Demissão', 'pedido de demissao')).toBe(true);
  });

  it('não casa motivo vazio nem pais diferentes', () => {
    expect(motivoPaiCompativel('', 'Pedido de demissão')).toBe(false);
    expect(motivoPaiCompativel('Justa causa', 'Pedido de demissão')).toBe(false);
  });
});
