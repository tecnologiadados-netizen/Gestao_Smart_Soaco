import { describe, expect, it } from 'vitest';
import {
  converterUnitarioPeloFator,
  precoAindaNaUnidadeInformada,
  resolverConversaoUnidadeNf,
  unitarioPrecisaCasasAltas,
} from './doubleCheckInConversaoUnidade.js';

function arredondar(n: number, casas: number): number {
  const f = 10 ** casas;
  return Math.round((n + Number.EPSILON) * f) / f;
}

const caixa = {
  umNF: 'CAIXA',
  umPC: 'UNIDADE',
  qtde: 165000,
  qtdeInformada: 4,
  qtdeConversaoPrincipal: 41250,
  qtdeConversaoSecundaria: 1,
  unitarioNF: 86.72,
  unitarioPC: 0.0021023,
};

describe('conversão de unidade da NF para o pedido', () => {
  it('divide o preço da caixa para a unidade do pedido', () => {
    const conv = resolverConversaoUnidadeNf(caixa);
    expect(conv?.precoConvertido).toBe(true);
    expect(conv?.quantidadeConvertida).toBe(true);
    expect(conv?.fator).toBe(41250);
    const unitario = converterUnitarioPeloFator(86.72, conv!.fator);
    expect(arredondar(unitario, 8)).toBe(arredondar(0.0021023, 8));
    expect(unitarioPrecisaCasasAltas(unitario, 0.0021023)).toBe(true);
  });

  it('não divide de novo quando o preço da NF já está por unidade', () => {
    const conv = resolverConversaoUnidadeNf({
      ...caixa,
      unitarioNF: 0.0021023,
    });
    expect(conv?.quantidadeConvertida).toBe(true);
    expect(conv?.precoConvertido).toBe(false);
    expect(
      precoAindaNaUnidadeInformada({ unitarioNF: 0.0021023, unitarioPC: 0.0021023, fator: 41250 })
    ).toBe(false);
  });

  it('converte tonelada em R$/t para R$/kg e preserva preço que já está em kg', () => {
    const base = {
      umNF: 'TONELADA',
      umPC: 'QUILOGRAMA',
      qtde: 2122,
      qtdeInformada: 2.122,
      qtdeConversaoPrincipal: 1000,
      qtdeConversaoSecundaria: 1,
    };
    const aindaEmTonelada = resolverConversaoUnidadeNf({
      ...base,
      unitarioNF: 7108.9585,
      unitarioPC: 7.1015,
    });
    expect(aindaEmTonelada?.precoConvertido).toBe(true);
    expect(converterUnitarioPeloFator(7108.9585, 1000)).toBeCloseTo(7.1089585, 10);

    const jaEmKg = resolverConversaoUnidadeNf({
      ...base,
      unitarioNF: 7.1089585,
      unitarioPC: 7.1015,
    });
    expect(jaEmKg?.quantidadeConvertida).toBe(true);
    expect(jaEmKg?.precoConvertido).toBe(false);
  });

  it('converte metro para peça quando o fator é menor que 1', () => {
    const conv = resolverConversaoUnidadeNf({
      umNF: 'METRO',
      umPC: 'PEÇA',
      qtde: 1,
      qtdeInformada: 4,
      qtdeConversaoPrincipal: 1,
      qtdeConversaoSecundaria: 4,
      unitarioNF: 39.6,
      unitarioPC: 158.4,
    });
    expect(conv?.fator).toBe(0.25);
    expect(conv?.precoConvertido).toBe(true);
    expect(converterUnitarioPeloFator(39.6, 0.25)).toBeCloseTo(158.4, 8);
    expect(unitarioPrecisaCasasAltas(158.4, 158.4)).toBe(false);
  });

  it('ignora a mesma unidade e fator 1', () => {
    expect(
      resolverConversaoUnidadeNf({
        ...caixa,
        umPC: 'CAIXA',
      })
    ).toBeNull();
    expect(
      resolverConversaoUnidadeNf({
        umNF: 'UNIDADE',
        umPC: 'PEÇA',
        qtde: 1000,
        qtdeInformada: 1000,
        qtdeConversaoPrincipal: 1,
        qtdeConversaoSecundaria: 1,
        unitarioNF: 3.96,
        unitarioPC: 3.96,
      })
    ).toBeNull();
  });
});
