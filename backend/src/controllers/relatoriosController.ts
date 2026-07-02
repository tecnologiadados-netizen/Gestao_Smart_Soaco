import type { Request, Response } from 'express';
import { listarAlteracoesParaRelatorio } from '../data/pedidosRepository.js';

/**
 * GET /api/relatorios/alteracoes - registros de alteração com filtros (período, pedido, cliente).
 * Query: data_ini (YYYY-MM-DD), data_fim (YYYY-MM-DD), id_pedido, cliente.
 */
export async function getRelatorioAlteracoes(req: Request, res: Response): Promise<void> {
  const data_ini = typeof req.query.data_ini === 'string' ? req.query.data_ini.trim() || undefined : undefined;
  const data_fim = typeof req.query.data_fim === 'string' ? req.query.data_fim.trim() || undefined : undefined;
  const id_pedido = typeof req.query.id_pedido === 'string' ? req.query.id_pedido.trim() || undefined : undefined;
  const cliente = typeof req.query.cliente === 'string' ? req.query.cliente.trim() || undefined : undefined;

  try {
    const registros = await listarAlteracoesParaRelatorio({
      data_ini,
      data_fim,
      id_pedido,
      cliente,
    });
    res.json({
      registros: registros.map((r) => ({
        ...r,
        data_ajuste: r.data_ajuste.toISOString(),
        previsao_nova: r.previsao_nova.toISOString(),
      })),
      total: registros.length,
    });
  } catch (err) {
    console.error('getRelatorioAlteracoes', err);
    res.status(503).json({ error: 'Erro ao gerar relatório de alterações.' });
  }
}
