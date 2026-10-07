import type { Request, Response } from 'express';
import { MotivoDesligamentoErro } from '../lib/motivoDesligamento.js';
import {
  listDesligamentosComplementos,
  listMotivosDesligamento,
  replaceMotivosDesligamentoFilhos,
  salvarDesligamentoComplemento,
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

export async function getDesligamentosComplementosHandler(req: Request, res: Response) {
  try {
    const ctx = req.rhAuth;
    res.json({
      complementos: await listDesligamentosComplementos({
        isMaster: ctx?.isMaster === true,
        permissions: ctx?.permissions ?? null,
      }),
    });
  } catch (error) {
    sendFalha(res, error);
  }
}

export async function salvarDesligamentoComplementoHandler(req: Request, res: Response) {
  try {
    const ctx = req.rhAuth!;
    const body = req.body as {
      colaboradorMatricula?: string;
      colaboradorNome?: string;
      dataDemissao?: string;
      motivoPai?: string;
      motivoFilhoId?: string;
      motivoTexto?: string;
      motivoSensivel?: boolean;
    };
    res.json(
      await salvarDesligamentoComplemento({
        colaboradorMatricula: s(body.colaboradorMatricula),
        colaboradorNome: s(body.colaboradorNome),
        dataDemissao: s(body.dataDemissao),
        motivoPai: s(body.motivoPai),
        motivoFilhoId: s(body.motivoFilhoId),
        motivoTexto: s(body.motivoTexto),
        motivoSensivel: body.motivoSensivel === true,
        registradoPor: ctx.actor,
      }),
    );
  } catch (error) {
    sendFalha(res, error);
  }
}
