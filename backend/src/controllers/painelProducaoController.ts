import type { Request, Response } from 'express';
import { getDashboard, getFilters } from '../services/painelProducao/painelProducaoDashboardService.js';
import {
  advanceNextMonth,
  listTargets,
  upsertTarget,
} from '../services/painelProducao/painelProducaoTargetsService.js';

function parseMesAnoBody(mesAno: string): Date {
  const parts = mesAno.split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
}

export async function getPainelProducaoFilters(_req: Request, res: Response) {
  try {
    const data = await getFilters();
    res.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
}

export async function getPainelProducaoDashboard(req: Request, res: Response) {
  const setor = String(req.query.setor ?? '').trim();
  const mes = String(req.query.mes ?? '').trim();
  if (!setor || !/^\d{4}-\d{2}$/.test(mes)) {
    res.status(400).json({ error: 'Parâmetros setor e mes (YYYY-MM) são obrigatórios.' });
    return;
  }
  try {
    const data = await getDashboard(setor, mes);
    res.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
}

export async function getPainelProducaoTargets(req: Request, res: Response) {
  const setor = req.query.setor ? String(req.query.setor) : undefined;
  const mes = req.query.mes ? String(req.query.mes) : undefined;
  try {
    const data = await listTargets(setor, mes);
    res.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
}

export async function postPainelProducaoTarget(req: Request, res: Response) {
  const { setor, mes_ano, target, sem_meta } = req.body ?? {};
  if (!setor || !mes_ano) {
    res.status(400).json({ error: 'setor e mes_ano são obrigatórios.' });
    return;
  }
  try {
    const mesDate = parseMesAnoBody(String(mes_ano));
    const result = await upsertTarget(
      String(setor),
      mesDate,
      Number(target ?? 0),
      Boolean(sem_meta),
    );
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
}

export async function postPainelProducaoMes(req: Request, res: Response) {
  try {
    const result = await advanceNextMonth();
    const filters = await getFilters();
    res.json({ ...result, meses: filters.meses });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes('já está cadastrado') ? 409 : 500;
    res.status(status).json({ error: msg });
  }
}
