import { describe, expect, it } from 'vitest';
import {
  MOTIVO_SECULLUM_NAO_INFORMADO,
  motivoPaiCompativel,
  motivoSecullumAusente,
  normalizarMotivoPai,
} from './motivoDesligamento.js';

describe('motivo pai do desligamento', () => {
  it('ignora acento, caixa e espaços ao comparar', () => {
    expect(normalizarMotivoPai('  Pedido  de Demissão ')).toBe('pedido de demissao');
    expect(motivoPaiCompativel('Pedido de Demissão', 'pedido de demissao')).toBe(true);
  });

  it('trata o placeholder como motivo ainda não lido', () => {
    expect(motivoSecullumAusente('')).toBe(true);
    expect(motivoSecullumAusente(MOTIVO_SECULLUM_NAO_INFORMADO)).toBe(true);
    expect(motivoSecullumAusente('Pedido de Demissão')).toBe(false);
  });

  it('não casa motivo vazio nem pais diferentes', () => {
    expect(motivoPaiCompativel('', 'Pedido de demissão')).toBe(false);
    expect(motivoPaiCompativel('Justa causa', 'Pedido de demissão')).toBe(false);
  });
});
