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

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function parseFiltros(req: Request): CarteiraFinanceiraFiltros {
  const q = req.query;
  const statusRaw = String(q.statusPedido ?? '').trim();
  return {
    dataInicio: String(q.dataInicio ?? '').trim() || undefined,
    dataFim: String(q.dataFim ?? '').trim() || undefined,
    dataPrevisaoIni: String(q.dataPrevisaoIni ?? '').trim() || undefined,
    dataPrevisaoFim: String(q.dataPrevisaoFim ?? '').trim() || undefined,
    uf: parseListParam(q.uf),
    cliente: parseListParam(q.cliente),
    empresa: parseListParam(q.empresa),
    statusPedido: statusRaw || undefined,
    tipoF: parseListParam(q.tipoF),
    condicaoPagamento: parseListParam(q.condicaoPagamento),
    observacoes: parseListParam(q.observacoes),
    municipio: parseListParam(q.municipio),
  };
}

function validarParDatas(
  ini: string | undefined,
  fim: string | undefined,
  labelIni: string,
  labelFim: string
): string | null {
  if (ini && !YMD.test(ini)) return `${labelIni} inválida (use YYYY-MM-DD).`;
  if (fim && !YMD.test(fim)) return `${labelFim} inválida (use YYYY-MM-DD).`;
  if (ini && fim && fim < ini) {
    return `Período inválido: ${labelFim} deve ser >= ${labelIni}.`;
  }
  return null;
}

/** GET /api/financeiro/carteira-financeira */
export async function getCarteiraFinanceira(req: Request, res: Response): Promise<void> {
  const filtros = parseFiltros(req);

  const erroEmissao = validarParDatas(
    filtros.dataInicio,
    filtros.dataFim,
    'dataInicio',
    'dataFim'
  );
  if (erroEmissao) {
    res.status(400).json({ error: erroEmissao });
    return;
  }

  const erroPrevisao = validarParDatas(
    filtros.dataPrevisaoIni,
    filtros.dataPrevisaoFim,
    'dataPrevisaoIni',
    'dataPrevisaoFim'
  );
  if (erroPrevisao) {
    res.status(400).json({ error: erroPrevisao });
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
