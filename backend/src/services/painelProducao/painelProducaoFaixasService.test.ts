import { describe, expect, it } from 'vitest';
import { validarFaixasDesconto } from './painelProducaoFaixasService.js';

describe('faixas mensais de desconto da montagem', () => {
  it('ordena e valida faixas contínuas', () => {
    const faixas = validarFaixasDesconto([
      { media_min: 2, media_max: 3.99, percentual_desconto: 20 },
      { media_min: 0, media_max: 1.99, percentual_desconto: 0 },
      { media_min: 4, media_max: null, percentual_desconto: 30 },
    ]);

    expect(faixas.map((faixa) => faixa.ordem)).toEqual([1, 2, 3]);
    expect(faixas.map((faixa) => faixa.media_min)).toEqual([0, 2, 4]);
  });

  it('rejeita intervalos com lacuna', () => {
    expect(() =>
      validarFaixasDesconto([
        { media_min: 0, media_max: 1, percentual_desconto: 0 },
        { media_min: 2, media_max: null, percentual_desconto: 20 },
      ]),
    ).toThrow('devem ser contínuas');
  });

  it('exige última faixa sem limite', () => {
    expect(() =>
      validarFaixasDesconto([
        { media_min: 0, media_max: 1.99, percentual_desconto: 0 },
        { media_min: 2, media_max: 5, percentual_desconto: 20 },
      ]),
    ).toThrow('última faixa');
  });
});
