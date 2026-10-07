import type { Request, Response } from 'express';
import { MotivoDesligamentoErro } from '../lib/motivoDesligamento.js';
import {
  listDesligamentosComplementos,
  listMotivosDesligamento,
  replaceMotivosDesligamentoFilhos,
} from '../repositories/motivoDesligamentoRepository.js';
import { s, sendError } from '../utils/rhHelpers.js';

function sendFalha(res: Response, error: unknown) {
  if (error instanceof MotivoDesligamentoErro) return sendError(res, error.message, error.status);
  sendError(res, (error as Error).message);
}

export async function getMotivosDesligamentoHandler(_req: Request, res: Response) {
  try {
    res.json({ pais: await listMotivosDesligamento() });
  } catch (error) {
    sendFalha(res, error);
  }
}

export async function replaceMotivosDesligamentoFilhosHandler(req: Request, res: Response) {
  try {
    const body = req.body as { motivoPai?: string; filhos?: unknown[] };
    const filhos = Array.isArray(body.filhos)
      ? body.filhos.filter((item): item is { descricao?: string | null } => item != null && typeof item === 'object')
      : [];
    res.json(await replaceMotivosDesligamentoFilhos(s(body.motivoPai), filhos));
  } catch (error) {
    sendFalha(res, error);
  }
}

export async function getDesligamentosComplementosHandler(_req: Request, res: Response) {
  try {
    res.json({ complementos: await listDesligamentosComplementos() });
  } catch (error) {
    sendFalha(res, error);
  }
}
