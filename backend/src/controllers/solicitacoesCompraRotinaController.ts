import type { Request, Response } from 'express';
import { consultarSolicitacoesCompraRotina } from '../data/solicitacoesCompraRotinaRepository.js';

/** Visão de um comprador, ou de todos quando o parâmetro vem vazio ou "todos". */
export async function getSolicitacoesCompraRotina(req: Request, res: Response): Promise<void> {
  const bruto = String(req.query.comprador ?? '').trim();
  const todos = bruto === '' || bruto.toLowerCase() === 'todos';
  const { data, erro } = await consultarSolicitacoesCompraRotina(todos ? null : bruto);
  if (erro) {
    res.status(503).json({ error: erro });
    return;
  }
  res.json(data);
}
