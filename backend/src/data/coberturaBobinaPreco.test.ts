import { describe, expect, it } from 'vitest';
import {
  aplicarMediaPrecoBobinaPorChave,
  chaveDimensionalBobina,
  isBobinaDimensionalPrecificacao,
} from './coberturaBobinaPreco.js';

describe('chaveDimensionalBobina', () => {
  it('retorna vazio para não-bobina ou etiqueta', () => {
    expect(chaveDimensionalBobina('PARAFUSO M8')).toBe('');
    expect(chaveDimensionalBobina('BOBINA ETIQUETA X 10 MM')).toBe('');
    expect(chaveDimensionalBobina(null)).toBe('');
  });

  it('reconhece padrão BOBINA%X%MM%', () => {
    expect(isBobinaDimensionalPrecificacao('BOBINA SLITADA 0,90 X 1200 MM SAE 1008')).toBe(true);
    expect(isBobinaDimensionalPrecificacao('CHAPA 0,90 X 1200 MM')).toBe(false);
  });

  it('normaliza BOBINA INTEIRA → BOBINA SLITADA na chave', () => {
    const inteira = chaveDimensionalBobina('BOBINA INTEIRA 0,90 X 1200 MM SAE 1008');
    const slitada = chaveDimensionalBobina('BOBINA SLITADA 0,90 X 1200 MM SAE 1008');
    expect(inteira).toBeTruthy();
    expect(inteira).toBe(slitada);
    expect(inteira).toContain('BOBINA SLITADA');
    expect(inteira).not.toContain('BOBINA INTEIRA');
  });

  it('chave com um X concatena trecho antes do X + após MM', () => {
    // Trim(antes do X) + substring após "MM" → "BOBINA SLITADA 0,45" + " ZINC"
    expect(chaveDimensionalBobina('BOBINA SLITADA 0,45 X 200 MM ZINC')).toBe(
      'BOBINA SLITADA 0,45 ZINC'
    );
  });
});

describe('aplicarMediaPrecoBobinaPorChave', () => {
  it('substitui preço próprio pela média da chave e atribui a quem não tinha preço', () => {
    const precos = new Map<number, number>([
      [1, 10],
      [2, 12],
    ]);
    const descs = new Map<number, string>([
      [1, 'BOBINA SLITADA 0,90 X 1200 MM A'],
      [2, 'BOBINA INTEIRA 0,90 X 1200 MM A'],
      [3, 'BOBINA SLITADA 0,90 X 1200 MM A'],
      [4, 'PARAFUSO'],
    ]);
    const chave = chaveDimensionalBobina(descs.get(1)!);
    const medias = new Map([[chave, 11]]);

    aplicarMediaPrecoBobinaPorChave(precos, descs, medias);

    expect(precos.get(1)).toBe(11);
    expect(precos.get(2)).toBe(11);
    expect(precos.get(3)).toBe(11);
    expect(precos.has(4)).toBe(false);
  });

  it('não altera preço se a chave não tem média', () => {
    const precos = new Map([[1, 9.5]]);
    const descs = new Map([[1, 'BOBINA SLITADA 1,00 X 100 MM']]);
    aplicarMediaPrecoBobinaPorChave(precos, descs, new Map());
    expect(precos.get(1)).toBe(9.5);
  });
});
