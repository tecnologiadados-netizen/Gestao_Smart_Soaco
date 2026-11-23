import { describe, expect, it } from 'vitest';
import { interpretarLoteLookupOtimiza } from './otimizaLookupChamado.js';

describe('lote de chamados abertos no Otimiza', () => {
  it('guarda o número aberto e ignora chamado fechado ou palavra sem resultado', () => {
    const mapa = interpretarLoteLookupOtimiza({
      count: 3,
      items: [
        {
          keyword: 'DE40369',
          found: true,
          count: 2,
          results: [
            { number: 8752, status: 'in_progress', isOpen: true },
            { number: 8700, status: 'completed', isOpen: false },
            { number: 8752, status: 'in_progress', isOpen: true },
          ],
        },
        { keyword: '86110', found: true, count: 1, results: [{ number: 8746, isOpen: true }] },
        { keyword: 'DE40415', found: false, count: 0, results: [] },
      ],
    });
    expect(mapa.get('DE40369')).toEqual([8752]);
    expect(mapa.get('86110')).toEqual([8746]);
    expect(mapa.get('DE40415')).toEqual([]);
  });

  it('ignora corpo sem itens', () => {
    expect(interpretarLoteLookupOtimiza(null).size).toBe(0);
    expect(interpretarLoteLookupOtimiza({ items: [{ keyword: '  ', results: [{ number: 1, isOpen: true }] }] }).size).toBe(0);
  });
});
