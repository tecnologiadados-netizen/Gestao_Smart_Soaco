import { describe, expect, it } from 'vitest';
import { gerarParcelasDaRegra } from './regraParcelasNomus.js';

describe('gerarParcelasDaRegra', () => {
  it('divide o total em partes iguais a partir da emissão', () => {
    const r = gerarParcelasDaRegra({
      regra: '30,60,90',
      dataBase: '2026-11-20',
      valorTotal: 4793.9,
    });
    expect('erro' in r).toBe(false);
    if ('erro' in r) return;
    expect(r.parcelas.map((p) => p.dataVencimento)).toEqual(['2026-12-20', '2027-01-19', '2027-02-18']);
    expect(r.parcelas.map((p) => p.paga)).toEqual([false, false, false]);
    const soma = r.parcelas.reduce((s, p) => s + Math.round(p.valor * 100), 0);
    expect(soma).toBe(479390);
  });

  it('entrada de 0 dias nasce paga e o percentual fecha o total', () => {
    const r = gerarParcelasDaRegra({
      regra: '0 50%,15 50%',
      dataBase: '2026-11-20',
      valorTotal: 100,
    });
    expect('erro' in r).toBe(false);
    if ('erro' in r) return;
    expect(r.parcelas).toEqual([
      { dataVencimento: '2026-11-20', valor: 50, paga: true },
      { dataVencimento: '2026-12-05', valor: 50, paga: false },
    ]);
  });

  it('empurra sábado e domingo para o próximo dia permitido', () => {
    const r = gerarParcelasDaRegra({
      regra: '1',
      dataBase: '2026-11-20',
      valorTotal: 10,
      diasPermitidos: [1, 2, 3, 4, 5],
    });
    expect('erro' in r).toBe(false);
    if ('erro' in r) return;
    expect(r.parcelas[0]?.dataVencimento).toBe('2026-11-23');
  });
});
