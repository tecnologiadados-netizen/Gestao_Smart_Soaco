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

  it('carrada em formação: produção = max+30 e previsão com rótulo', () => {
    const r = resolverDataProducaoExibicaoGerenciador(
      pedido({
        Observacoes: 'ROTA CONSTRUCAO NORTE',
        data_producao: '2026-01-01',
        previsao_entrega_atualizada: '2026-02-01',
      }),
      '2026-09-15'
    );
    expect(r.carradaEmFormacao).toBe(true);
    expect(r.dataExibicao).toBe('2026-09-15');
    expect(r.previsaoAtual).toBe('');
    expect(r.previsaoExibicaoLabel).toBe('Carrada em formação');
  });

  it('romaneio_como_formacao: produção = max+30 e previsão com rótulo', () => {
    const r = resolverDataProducaoExibicaoGerenciador(
      pedido({
        TipoF: 'Inserir em Romaneio',
        Observacoes: '4-Inserir em Romaneio',
        romaneio_como_formacao: true,
        previsao_entrega_atualizada: '2026-07-08',
      }),
      '2026-09-15'
    );
    expect(r.carradaEmFormacao).toBe(true);
    expect(r.dataExibicao).toBe('2026-09-15');
    expect(r.previsaoExibicaoLabel).toBe('Carrada em formação');
    expect(r.producaoPorPrevisao).toBe(false);
  });

  it('romaneio ≥ corte: produção = previsão da regra sem badge Prev.', () => {
    const r = resolverDataProducaoExibicaoGerenciador(
      pedido({
        TipoF: 'Inserir em Romaneio',
        Observacoes: '4-Inserir em Romaneio',
        romaneio_como_formacao: false,
        previsao_entrega_atualizada: '2026-02-15',
      })
    );
    expect(r.dataExibicao).toBe('2026-02-15');
    expect(r.producaoPorPrevisao).toBe(false);
    expect(r.carradaEmFormacao).toBeUndefined();
  });
});
