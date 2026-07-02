/**
 * Teste do repositório: listarPedidos retorna array (com SQL base placeholder pode ser vazio).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { listarPedidos, obterResumoDashboard } from '../src/data/pedidosRepository.js';

describe('pedidosRepository', () => {
  beforeAll(async () => {
    // Garantir que Prisma está disponível (variáveis de ambiente para teste)
    process.env.DB_URL = process.env.DB_URL || 'postgresql://user:pass@localhost:5432/test?schema=public';
  });

  it('listarPedidos retorna um array', async () => {
    const result = await listarPedidos({});
    expect(Array.isArray(result)).toBe(true);
  });

  it('obterResumoDashboard retorna total, entregaHoje, atrasados, leadTimeMedioDias e totais por valor pendente real', async () => {
    const result = await obterResumoDashboard();
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('entregaHoje');
    expect(result).toHaveProperty('atrasados');
    expect(result).toHaveProperty('leadTimeMedioDias');
    expect(result).toHaveProperty('totalValorPendenteReal');
    expect(result).toHaveProperty('atrasadosValorPendenteReal');
    expect(typeof result.total).toBe('number');
    expect(typeof result.entregaHoje).toBe('number');
    expect(typeof result.atrasados).toBe('number');
    expect(typeof result.totalValorPendenteReal).toBe('number');
    expect(typeof result.atrasadosValorPendenteReal).toBe('number');
  });
});
