import { describe, expect, it } from 'vitest';
import {
  LABEL_PRODUTO_NAO_PADRAO,
  LABEL_PRODUTO_PADRAO,
  LABEL_PRODUTO_PADRAO_INDEFINIDO,
  classificarProdutoPadrao,
} from './produtoPadrao.js';

describe('classificarProdutoPadrao', () => {
  it('família Padrão → produto padrão', () => {
    expect(classificarProdutoPadrao('Padrão')).toBe(LABEL_PRODUTO_PADRAO);
    expect(classificarProdutoPadrao('PADRAO')).toBe(LABEL_PRODUTO_PADRAO);
    expect(classificarProdutoPadrao(' padrão ')).toBe(LABEL_PRODUTO_PADRAO);
  });

  it('família Projeto → não padrão', () => {
    expect(classificarProdutoPadrao('Projeto')).toBe(LABEL_PRODUTO_NAO_PADRAO);
    expect(classificarProdutoPadrao('PROJETO')).toBe(LABEL_PRODUTO_NAO_PADRAO);
  });

  it('família vazia ou outra → indefinido', () => {
    expect(classificarProdutoPadrao('')).toBe(LABEL_PRODUTO_PADRAO_INDEFINIDO);
    expect(classificarProdutoPadrao(null)).toBe(LABEL_PRODUTO_PADRAO_INDEFINIDO);
    expect(classificarProdutoPadrao('Outros')).toBe(LABEL_PRODUTO_PADRAO_INDEFINIDO);
  });
});
