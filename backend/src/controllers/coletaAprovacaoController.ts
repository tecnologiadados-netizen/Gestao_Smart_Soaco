/**
 * Envio do link de aprovação da coleta para uma pessoa no WhatsApp.
 */

import type { Request, Response } from 'express';
import {
  ColetaAprovacaoErro,
  enviarLinkAprovacaoColeta,
  listarAprovadoresColetaWhatsapp,
} from '../services/coletaAprovacaoLinkService.js';

function lerEnvio(body: unknown): { usuarioId: number; manual: boolean } {
  let raw = body;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw) as unknown;
    } catch {
      return { usuarioId: 0, manual: false };
    }
  }
  const o = raw as { usuarioId?: unknown; manual?: unknown } | null;
  const id = Number(o?.usuarioId);
  return {
    usuarioId: Number.isFinite(id) ? Math.trunc(id) : 0,
    manual: o?.manual === true,
  };
}

function coletaIdDe(req: Request): number {
  const id = parseInt(String(req.params.id), 10);
  return Number.isFinite(id) ? id : 0;
}

export async function getAprovadoresColetaWhatsapp(_req: Request, res: Response): Promise<void> {
  const data = await listarAprovadoresColetaWhatsapp();
  res.json({ data });
}

async function enviar(
  req: Request,
  res: Response,
  alterarStatus: boolean
): Promise<void> {
  const coletaId = coletaIdDe(req);
  const { usuarioId, manual } = lerEnvio(req.body);
  const login = req.user?.login;
  if (coletaId < 1) {
    res.status(400).json({ error: 'ID da coleta inválido.' });
    return;
  }
  if (!login) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }
  if (usuarioId < 1) {
    res.status(400).json({
      error: manual ? 'Selecione quem vai aprovar.' : 'Selecione quem vai receber o WhatsApp.',
    });
    return;
  }
  try {
    const resultado = await enviarLinkAprovacaoColeta({
      coletaId,
      usuarioId,
      enviadoPorLogin: login,
      alterarStatus,
      manual: alterarStatus && manual,
    });
    res.json({ ok: true, ...resultado });
  } catch (err) {
    if (err instanceof ColetaAprovacaoErro) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[coletaAprovacao] enviar link', msg);
    res.status(503).json({ error: msg });
  }
}

/** PATCH /api/compras/coletas/:id/enviar-aprovacao  body: { usuarioId } */
export async function patchEnviarAprovacaoComLink(req: Request, res: Response): Promise<void> {
  await enviar(req, res, true);
}

/** POST /api/compras/coletas/:id/enviar-link-aprovacao  body: { usuarioId } */
export async function postReenviarLinkAprovacao(req: Request, res: Response): Promise<void> {
  await enviar(req, res, false);
}
