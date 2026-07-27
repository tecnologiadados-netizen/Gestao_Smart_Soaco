import { describe, expect, it } from 'vitest';
import {
  montarDemandaMateriaisDoCalendario,
  type CalendarioCelulaDetalhe,
} from './simulacaoCarradas';

describe('montarDemandaMateriaisDoCalendario', () => {
  it('monta payload com Cod do produto (não RM)', () => {
    const detalhes: CalendarioCelulaDetalhe[] = [
      {
        setor: 'Solda',
        data: '2026-07-23',
        tipoF: 'A',
        pd: '100',
        qtde: 10,
        cod: '01740', // RM — não deve ir como codigoPa
        codigoProduto: 'PA-1',
        carrada: 'C1',
        cliente: 'X',
      },
      {
        setor: 'Solda',
        data: '2026-07-23',
        tipoF: 'A',
        pd: '101',
        qtde: 0,
        cod: '01740',
        codigoProduto: 'PA-1',
        carrada: 'C1',
        cliente: 'Y',
      },
      {
        setor: 'Pintura',
        data: 'bad',
        tipoF: 'B',
        pd: '102',
        qtde: 5,
        cod: '01741',
        codigoProduto: 'PA-2',
        carrada: 'C2',
        cliente: 'Z',
      },
      {
        setor: 'Solda',
        data: '2026-07-24',
        tipoF: 'A',
        pd: '103',
        qtde: 3,
        cod: '01742',
        codigoProduto: '', // sem Cod → ignora
        carrada: 'C3',
        cliente: 'W',
      },
    ];
    const out = montarDemandaMateriaisDoCalendario(detalhes);
    expect(out).toEqual([
      {
        codigoPa: 'PA-1',
        qtde: 10,
        dataIso: '2026-07-23',
        pd: '100',
        setor: 'Solda',
        carrada: 'C1',
      },
    ]);
  });

  it('leva a carrada para a origem do consumo', () => {
    const detalhes: CalendarioCelulaDetalhe[] = [
      {
        setor: 'Solda',
        data: '2026-07-23',
        tipoF: 'A',
        pd: '100',
        qtde: 2,
        cod: '01740',
        codigoProduto: 'PA-1',
        carrada: 'ROTA SUL',
        cliente: 'X',
      },
      {
        setor: 'Solda',
        data: '2026-07-23',
        tipoF: 'A',
        pd: '101',
        qtde: 4,
        cod: '01741',
        codigoProduto: 'PA-1',
        carrada: '',
        cliente: 'Y',
      },
    ];
    const out = montarDemandaMateriaisDoCalendario(detalhes);
    expect(out.map((d) => d.carrada)).toEqual(['ROTA SUL', undefined]);
  });
});
