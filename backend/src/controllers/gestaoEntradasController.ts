/**
 * GET /api/compras/gestao-entradas?dataInicio=&dataFim=
 * Painel KPI de acuracidade das entradas (NF × pedido de compra).
 */

import type { Request, Response } from 'express';
import { queryGestaoEntradasDia, queryGestaoEntradasPainel } from '../data/gestaoEntradasRepository.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseYmd(v: unknown): string | null {
  const s = String(v ?? '').trim().slice(0, 10);
  return DATE_RE.test(s) ? s : null;
}

export async function getGestaoEntradasPainel(req: Request, res: Response): Promise<void> {
  const dataInicio = parseYmd(req.query.dataInicio);
  const dataFim = parseYmd(req.query.dataFim);
  if (!dataInicio || !dataFim) {
    res.status(400).json({ error: 'Informe dataInicio e dataFim (YYYY-MM-DD).' });
    return;
  }
  if (dataFim < dataInicio) {
    res.status(400).json({ error: 'dataFim deve ser >= dataInicio.' });
    return;
  }

  const { data, erro } = await queryGestaoEntradasPainel({ dataInicio, dataFim });
  if (erro || !data) {
    res.status(503).json({ error: erro ?? 'Falha ao montar o painel Gestão entradas.', erro });
    return;
  }
  res.json(data);
}

export async function getGestaoEntradasDia(req: Request, res: Response): Promise<void> {
  const dataInicio = parseYmd(req.query.dataInicio);
  const dataFim = parseYmd(req.query.dataFim);
  if (!dataInicio || !dataFim) {
    res.status(400).json({ error: 'Informe dataInicio e dataFim (YYYY-MM-DD).' });
    return;
  }
  if (dataFim < dataInicio) {
    res.status(400).json({ error: 'dataFim deve ser >= dataInicio.' });
    return;
  }
  const { data, erro } = await queryGestaoEntradasDia({ dataInicio, dataFim });
  if (erro || !data) {
    res.status(503).json({ error: erro ?? 'Falha ao carregar as entradas do período.', erro });
    return;
  }
  res.json(data);
}
