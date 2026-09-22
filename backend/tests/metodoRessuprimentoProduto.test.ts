import { describe, expect, it } from 'vitest';
import { parseFiltroMetodosRessuprimento, rotuloMetodoRessuprimento } from '../src/utils/metodoRessuprimentoProduto.js';

describe('rotuloMetodoRessuprimento', () => {
  it('mapeia padraoSuprimento da aba Geral', () => {
    expect(rotuloMetodoRessuprimento(1)).toBe('Comprado');
    expect(rotuloMetodoRessuprimento(2)).toBe('Fabricado');
    expect(rotuloMetodoRessuprimento(3)).toBe('Como padrão fabricado');
    expect(rotuloMetodoRessuprimento(4)).toBe('Como padrão comprado');
  });

  it('vazio quando não preenchido', () => {
    expect(rotuloMetodoRessuprimento(0)).toBe('');
    expect(rotuloMetodoRessuprimento(null)).toBe('');
    expect(rotuloMetodoRessuprimento(undefined)).toBe('');
  });

  it('parseFiltro ignora valores desconhecidos', () => {
    expect(parseFiltroMetodosRessuprimento(['Fabricado', 'xyz', 'Fabricado'])).toEqual(['Fabricado']);
    expect(parseFiltroMetodosRessuprimento(null)).toEqual([]);
  });
});
