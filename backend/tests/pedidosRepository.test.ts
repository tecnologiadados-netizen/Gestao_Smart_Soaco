/**
 * Teste do repositório: listarPedidos retorna array (com SQL base placeholder pode ser vazio).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { listarPedidos, obterResumoDashboard, obterDashEntregasAnalytics, pedidoEhRequisicao, type PedidoRow } from '../src/data/pedidosRepository.js';

describe('pedidosRepository', () => {
  beforeAll(async () => {
    // Garantir que Prisma está disponível (variáveis de ambiente para teste)
    process.env.DB_URL = process.env.DB_URL || 'postgresql://user:pass@localhost:5432/test?schema=public';
  });

  it(
    'listarPedidos retorna um array',
    async () => {
    const result = await listarPedidos({});
    // Contrato do repo: { data, total, erroConexao? } (array fica em `data`)
    expect(result).toHaveProperty('data');
    expect(Array.isArray(result.data)).toBe(true);
    },
    15000
  );

  it('obterResumoDashboard retorna total, entregaHoje, atrasados, leadTimeMedioDias e totais por valor pendente real', async () => {
    const result = await obterResumoDashboard();
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('entregaHoje');
    expect(result).toHaveProperty('atrasados');
    expect(result).toHaveProperty('emDia');
    expect(result).toHaveProperty('leadTimeMedioDias');
    expect(result).toHaveProperty('totalValorPendenteReal');
    expect(result).toHaveProperty('atrasadosValorPendenteReal');
    expect(result).toHaveProperty('emDiaValorPendenteReal');
    expect(result).toHaveProperty('pctAtrasadoValor');
    expect(typeof result.total).toBe('number');
    expect(typeof result.entregaHoje).toBe('number');
    expect(typeof result.atrasados).toBe('number');
    expect(typeof result.totalValorPendenteReal).toBe('number');
    expect(typeof result.atrasadosValorPendenteReal).toBe('number');
  });

  it('pedidoEhRequisicao identifica requisição por TipoF ou Observacoes', () => {
    const base = {
      id_pedido: '1',
      cliente: 'X',
      produto: 'Y',
      qtd: 1,
      previsao_entrega: new Date(),
      previsao_entrega_atualizada: new Date(),
    } satisfies PedidoRow;
    expect(pedidoEhRequisicao({ ...base, TipoF: '5 - Requisição' })).toBe(true);
    expect(pedidoEhRequisicao({ ...base, Observacoes: '5-Requisicao' })).toBe(true);
    expect(pedidoEhRequisicao({ ...base, TipoF: 'ROTA Teresina', Observacoes: 'ROTA Teresina' })).toBe(false);
  });

  it('obterDashEntregasAnalytics retorna resumo, rotas, aging e topClientesAtrasados', async () => {
    const result = await obterDashEntregasAnalytics();
    expect(result).toHaveProperty('resumo');
    expect(result).toHaveProperty('rotas');
    expect(result).toHaveProperty('aging');
    expect(result).toHaveProperty('topClientesAtrasados');
    expect(Array.isArray(result.rotas)).toBe(true);
    expect(Array.isArray(result.aging)).toBe(true);
    expect(result.aging.length).toBe(6);
  });
});
