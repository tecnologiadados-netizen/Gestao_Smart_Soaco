import type { Request, Response } from 'express';
import {
  queryCarteiraFinanceira,
  type CarteiraFinanceiraFiltros,
} from '../data/carteiraFinanceiraRepository.js';

function parseListParam(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.flatMap((x) => String(x).split(',')).map((s) => s.trim()).filter(Boolean);
  }
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseFiltros(req: Request): CarteiraFinanceiraFiltros {
  const q = req.query;
  const statusRaw = String(q.statusPedido ?? '').trim();
  return {
    dataInicio: String(q.dataInicio ?? '').trim() || undefined,
    dataFim: String(q.dataFim ?? '').trim() || undefined,
    uf: parseListParam(q.uf),
    cliente: parseListParam(q.cliente),
    empresa: parseListParam(q.empresa),
    statusPedido: statusRaw || undefined,
    tipoF: parseListParam(q.tipoF),
    condicaoPagamento: parseListParam(q.condicaoPagamento),
    municipio: parseListParam(q.municipio),
  };
}

/** GET /api/financeiro/carteira-financeira */
export async function getCarteiraFinanceira(req: Request, res: Response): Promise<void> {
  const filtros = parseFiltros(req);
  if (filtros.dataInicio && !/^\d{4}-\d{2}-\d{2}$/.test(filtros.dataInicio)) {
    res.status(400).json({ error: 'dataInicio inválida (use YYYY-MM-DD).' });
    return;
  }
  if (filtros.dataFim && !/^\d{4}-\d{2}-\d{2}$/.test(filtros.dataFim)) {
    res.status(400).json({ error: 'dataFim inválida (use YYYY-MM-DD).' });
    return;
  }
  if (
    filtros.dataInicio &&
    filtros.dataFim &&
    filtros.dataFim < filtros.dataInicio
  ) {
    res.status(400).json({ error: 'Período inválido: dataFim deve ser >= dataInicio.' });
    return;
  }

  try {
    const payload = await queryCarteiraFinanceira(filtros);
    if (payload.erro && payload.linhas.length === 0) {
      res.status(503).json({ error: payload.erro, ...payload });
      return;
    }
    res.json(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[getCarteiraFinanceira]', msg);
    res.status(503).json({ error: msg });
  }
}
