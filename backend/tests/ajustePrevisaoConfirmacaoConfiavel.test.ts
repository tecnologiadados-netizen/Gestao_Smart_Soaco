import { describe, it, expect, afterAll } from 'vitest';
import { registrarAjustesPrevisaoLote } from '../src/data/pedidosRepository.js';
import { prisma } from '../src/config/prisma.js';

/**
 * Confirmar a data vigente alterando só "Previsão confiável" precisa gerar ajuste novo.
 * Sem isso o dedupe por data igual descarta a mudança e o Gerenciador segue mostrando o valor antigo.
 */
const ID_PEDIDO = 'TESTE-CONFIAVEL-9999-1-1';
const ROTA = 'ROTA TESTE CONFIAVEL - LIBERADA';
const PREVISAO = new Date('2026-08-21T12:00:00.000Z');

const limpar = () =>
  prisma.pedidoPrevisaoAjuste.deleteMany({ where: { id_pedido: { startsWith: 'TESTE-CONFIAVEL-' } } });

const ajustesGravados = () =>
  prisma.pedidoPrevisaoAjuste.findMany({
    where: { id_pedido: ID_PEDIDO },
    orderBy: { id: 'asc' },
    select: { previsao_confiavel: true, rota: true },
  });

describe('registrarAjustesPrevisaoLote — confirmação de data com troca de Confiável', () => {
  afterAll(async () => {
    await limpar();
  });

  it('grava quando a data repete mas a confiabilidade muda e há confirmação', async () => {
    await limpar();
    await registrarAjustesPrevisaoLote(
      [
        {
          id_pedido: ID_PEDIDO,
          previsao_nova: PREVISAO,
          motivo: 'Ajuste inicial',
          rota: ROTA,
          previsao_confiavel: false,
        },
      ],
      'teste'
    );
    expect(await ajustesGravados()).toHaveLength(1);

    const r = await registrarAjustesPrevisaoLote(
      [
        {
          id_pedido: ID_PEDIDO,
          previsao_nova: PREVISAO,
          motivo: 'Confirmação de previsão confiável (sequenciamento)',
          rota: ROTA,
          previsao_confiavel: true,
          confirmacaoData: true,
        },
      ],
      'teste'
    );

    expect(r.erros).toHaveLength(0);
    const rows = await ajustesGravados();
    expect(rows).toHaveLength(2);
    expect(rows[1]?.previsao_confiavel).toBe(true);
  });

  it('mantém o dedupe quando nada muda além da data repetida', async () => {
    await limpar();
    await registrarAjustesPrevisaoLote(
      [
        {
          id_pedido: ID_PEDIDO,
          previsao_nova: PREVISAO,
          motivo: 'Ajuste inicial',
          rota: ROTA,
          previsao_confiavel: true,
        },
      ],
      'teste'
    );
    await registrarAjustesPrevisaoLote(
      [
        {
          id_pedido: ID_PEDIDO,
          previsao_nova: PREVISAO,
          motivo: 'Reenvio sem mudança',
          rota: ROTA,
          previsao_confiavel: true,
          confirmacaoData: true,
        },
      ],
      'teste'
    );
    expect(await ajustesGravados()).toHaveLength(1);
  });

  it('sem confirmação explícita, data repetida continua descartada', async () => {
    await limpar();
    await registrarAjustesPrevisaoLote(
      [
        {
          id_pedido: ID_PEDIDO,
          previsao_nova: PREVISAO,
          motivo: 'Ajuste inicial',
          rota: ROTA,
          previsao_confiavel: false,
        },
      ],
      'teste'
    );
    await registrarAjustesPrevisaoLote(
      [
        {
          id_pedido: ID_PEDIDO,
          previsao_nova: PREVISAO,
          motivo: 'Sem confirmação',
          rota: ROTA,
          previsao_confiavel: true,
        },
      ],
      'teste'
    );
    const rows = await ajustesGravados();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.previsao_confiavel).toBe(false);
  });
});
