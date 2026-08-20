import type { Request, Response } from 'express';
import {
  listarDetalhePainelInadimplencia,
  obterResumoPainelInadimplencia,
  type PainelDetalheFiltro,
} from '../services/crmInadimplentePainelService.js';

function ymdQuery(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export async function getCrmInadimplentePainel(req: Request, res: Response): Promise<void> {
  try {
    const data = await obterResumoPainelInadimplencia({
      vencimentoDe: ymdQuery(req.query.de),
      vencimentoAte: ymdQuery(req.query.ate),
    });
    res.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar o painel.';
    res.status(500).json({ error: message });
  }
}

export async function getCrmInadimplentePainelDetalhe(req: Request, res: Response): Promise<void> {
  try {
    const universoRaw = String(req.query.universo ?? 'recuperado');
    const universo: PainelDetalheFiltro['universo'] =
      universoRaw === 'aberto' || universoRaw === 'atraso_lote' || universoRaw === 'vencido' ? universoRaw : 'recuperado';
    const classeRaw = String(req.query.classe ?? 'total');
    const classes: PainelDetalheFiltro['classe'][] = [
      'empresa',
      'condicao',
      'total',
      'mesmo_mes',
      'outros_meses',
    ];
    const classe = classes.includes(classeRaw as PainelDetalheFiltro['classe'])
      ? (classeRaw as PainelDetalheFiltro['classe'])
      : 'total';
    const offset = Number.parseInt(String(req.query.offset ?? '0'), 10);
    const limit = Number.parseInt(String(req.query.limit ?? '400'), 10);
    const ordemRaw = String(req.query.ordem ?? 'vencimento');
    const ordens: PainelDetalheFiltro['ordem'][] = [
      'vencimento',
      'recebimento',
      'cliente',
      'empresa',
      'conta',
      'condicao',
      'valor',
      'atraso',
    ];
    const ordem = ordens.includes(ordemRaw as PainelDetalheFiltro['ordem'])
      ? (ordemRaw as PainelDetalheFiltro['ordem'])
      : 'vencimento';
    const dir = req.query.dir === 'asc' ? 'asc' : 'desc';
    const result = await listarDetalhePainelInadimplencia({
      vencimentoDe: ymdQuery(req.query.de),
      vencimentoAte: ymdQuery(req.query.ate),
      recebimentoDe: ymdQuery(req.query.recDe),
      recebimentoAte: ymdQuery(req.query.recAte),
      universo,
      classe,
      chave: typeof req.query.chave === 'string' ? req.query.chave : null,
      offset: Number.isFinite(offset) ? offset : 0,
      limit: Number.isFinite(limit) ? limit : 400,
      ordem,
      dir,
      completo: req.query.completo === '1' || req.query.completo === 'true',
    });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar o detalhe.';
    res.status(500).json({ error: message });
  }
}
