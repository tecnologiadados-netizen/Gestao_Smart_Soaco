import { describe, expect, it } from 'vitest';
import { unitarioLiquidoComDesconto } from './doubleCheckInRepository.js';
import { unitarioExatoNfMaior, unitariosExatosIguais } from './doubleCheckInPeso.js';

describe('unitarioLiquidoComDesconto', () => {
  it('sem desconto usa o unitário do Nomus e não recria casas pelo total÷qtde', () => {
    // Nomus: 60,8 kg × 8,62 = 524,096 → total gravado 524,10
    const liquido = unitarioLiquidoComDesconto({
      unitarioBruto: 8.62,
      qtde: 60.8,
      desconto: 0,
      totalComDesconto: 524.1,
    });
    expect(liquido).toBe(8.62);
    expect(unitariosExatosIguais(liquido, 8.62)).toBe(true);
    expect(unitarioExatoNfMaior(liquido, 8.62)).toBe(false);
    // A divisão crua inventaria 8,620065… e apontaria divergência real.
    expect(524.1 / 60.8).not.toBe(8.62);
  });

  it('com desconto deriva o líquido pelo total com desconto', () => {
    const liquido = unitarioLiquidoComDesconto({
      unitarioBruto: 10,
      qtde: 5,
      desconto: 2.5,
      totalComDesconto: 47.5,
    });
    expect(liquido).toBe(9.5);
  });

  it('desconto em fração de centavo irrelevante não dispara total÷qtde', () => {
    const liquido = unitarioLiquidoComDesconto({
      unitarioBruto: 8.62,
      qtde: 60.8,
      desconto: 0.001,
      totalComDesconto: 524.1,
    });
    expect(liquido).toBe(8.62);
  });
});
