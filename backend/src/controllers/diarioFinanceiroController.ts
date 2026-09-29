import type { Request, Response } from 'express';
import {
  MAX_REPROGRAMAR,
  queryDiarioContasPagar,
  reprogramarVencimentoContasPagar,
  type ReprogramarVencimentoItem,
} from '../data/diarioContasPagarRepository.js';

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DIAS = 366;

function diasEntre(inicio: string, fim: string): number {
  const a = Date.parse(`${inicio}T12:00:00`);
  const b = Date.parse(`${fim}T12:00:00`);
  return Math.round((b - a) / 86_400_000);
}

/** GET /api/financeiro/diario/contas-pagar?dataInicio=&dataFim= */
export async function getDiarioContasPagar(req: Request, res: Response): Promise<void> {
  const dataInicio = String(req.query.dataInicio ?? '').trim();
  const dataFim = String(req.query.dataFim ?? '').trim();
  if (!YMD.test(dataInicio) || !YMD.test(dataFim)) {
    res.status(400).json({ error: 'Informe dataInicio e dataFim no formato AAAA-MM-DD.' });
    return;
  }
  if (dataInicio > dataFim) {
    res.status(400).json({ error: 'A data inicial não pode ser maior que a data final.' });
    return;
  }
  if (diasEntre(dataInicio, dataFim) > MAX_DIAS) {
    res.status(400).json({ error: 'O intervalo de vencimento pode ter no máximo 366 dias.' });
    return;
  }

  try {
    const resultado = await queryDiarioContasPagar({ dataInicio, dataFim });
    res.json({ dataInicio, dataFim, ...resultado });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[getDiarioContasPagar]', msg);
    res.status(500).json({ error: msg });
  }
}

/** POST /api/financeiro/diario/contas-pagar/reprogramar */
export async function postReprogramarContasPagar(req: Request, res: Response): Promise<void> {
  const dataVencimento = String(req.body?.dataVencimento ?? '').trim();
  if (!YMD.test(dataVencimento)) {
    res.status(400).json({ error: 'Informe o novo vencimento no formato AAAA-MM-DD.' });
    return;
  }
  const bruto = req.body?.itens;
  if (!Array.isArray(bruto) || bruto.length === 0) {
    res.status(400).json({ error: 'Selecione ao menos um título.' });
    return;
  }
  if (bruto.length > MAX_REPROGRAMAR) {
    res.status(400).json({ error: `É possível reprogramar no máximo ${MAX_REPROGRAMAR} títulos por vez.` });
    return;
  }

  const itens: ReprogramarVencimentoItem[] = [];
  for (const item of bruto) {
    const origem = item?.origem;
    const id = Number(item?.id);
    if ((origem !== 'Nomus' && origem !== 'Shop9') || !Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Cada título precisa de origem Nomus ou Shop9 e um id válido.' });
      return;
    }
    itens.push({ origem, id });
  }

  try {
    const resultado = await reprogramarVencimentoContasPagar({ dataVencimento, itens });
    console.log(
      '[reprogramar vencimento] user=%s data=%s atualizados=%s ignorados=%s',
      req.user?.login ?? '?',
      dataVencimento,
      resultado.atualizados,
      resultado.ignorados.length,
    );
    res.json(resultado);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[postReprogramarContasPagar]', msg);
    res.status(500).json({ error: msg });
  }
}
