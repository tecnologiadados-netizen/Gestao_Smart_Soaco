import { describe, it, expect } from 'vitest';
import { resolverDataProducaoExibicaoGerenciador } from './dataProducaoGerenciador';
import type { Pedido } from '../api/pedidos';

function pedido(partial: Partial<Pedido>): Pedido {
  return partial as Pedido;
}

describe('resolverDataProducaoExibicaoGerenciador', () => {
  it('usa data_producao quando preenchida', () => {
    const r = resolverDataProducaoExibicaoGerenciador(
      pedido({ data_producao: '2026-08-20', previsao_entrega_atualizada: '2026-08-15' })
    );
    expect(r.dataExibicao).toBe('2026-08-20');
    expect(r.producaoPorPrevisao).toBe(false);
  });

  it('replica previsão atual sem data_producao', () => {
    const r = resolverDataProducaoExibicaoGerenciador(
      pedido({ previsao_entrega_atualizada: '2026-08-15' })
    );
    expect(r.dataExibicao).toBe('2026-08-15');
    expect(r.producaoPorPrevisao).toBe(true);
    expect(r.dataProducaoReal).toBe('');
  });

  it('retorna vazio sem produção e sem previsão', () => {
    const r = resolverDataProducaoExibicaoGerenciador(pedido({}));
    expect(r.dataExibicao).toBe('');
    expect(r.producaoPorPrevisao).toBe(false);
  });
});
