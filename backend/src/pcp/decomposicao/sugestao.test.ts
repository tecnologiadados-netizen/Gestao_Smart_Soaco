import { describe, expect, it } from 'vitest';
import { paisImplicados, resumirSugestao } from './sugestao.js';

describe('sugestão do produto pai', () => {
  it('arredonda para cima a qtde pedida dividida pela quantidade no pai', () => {
    expect(paisImplicados(10, 2)).toBe(5);
    expect(paisImplicados(10, 4)).toBe(3);
    expect(paisImplicados(0, 2)).toBe(0);
    expect(paisImplicados(8, 0)).toBe(0);
  });

  it('a quantidade do pai é o saldo em aberto dos filhos', () => {
    const resumo = resumirSugestao([
      { quantidade: 2, qtdePedida: 10, pendente: 6 },
      { quantidade: 4, qtdePedida: 12, pendente: 4 },
    ]);

    expect(resumo.sugestao).toBe(10);
    expect(resumo.qtdePedida).toBe(22);
    expect(resumo.pendente).toBe(10);
  });

  it('sem venda a sugestão é zero', () => {
    const resumo = resumirSugestao([
      { quantidade: 2, qtdePedida: 0, pendente: 0 },
      { quantidade: 1, qtdePedida: 0, pendente: 0 },
    ]);
    expect(resumo.sugestao).toBe(0);
    expect(resumo.qtdePedida).toBe(0);
  });
});
