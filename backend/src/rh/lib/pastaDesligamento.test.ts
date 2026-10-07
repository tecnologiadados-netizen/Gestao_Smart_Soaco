import { describe, expect, it } from 'vitest';
import { ehPastaDesligamento } from './pastaDesligamento.js';

describe('pasta global de desligamento', () => {
  it('reconhece o nome da pasta mesmo com acento ou espaços', () => {
    expect(ehPastaDesligamento('Desligamento')).toBe(true);
    expect(ehPastaDesligamento('  desligamento ')).toBe(true);
    expect(ehPastaDesligamento('Atestados')).toBe(false);
  });
});
