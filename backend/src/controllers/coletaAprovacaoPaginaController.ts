/**
 * Página pública da aprovação da coleta. O token no link é o acesso.
 */

import type { Request, Response } from 'express';
import {
  htmlPaginaAprovacao,
  registrarQuantidadeItem,
} from '../services/coletaAprovacaoLinkService.js';

function tokenDe(req: Request): string {
  return String(req.params.token ?? '').trim();
}

export async function getColetaAprovacaoPagina(req: Request, res: Response): Promise<void> {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  const { status, html } = await htmlPaginaAprovacao(tokenDe(req));
  res.status(status).type('html').send(html);
}

export async function postColetaAprovacaoPagina(req: Request, res: Response): Promise<void> {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  const token = tokenDe(req);
  const body = req.body as {
    registroId?: unknown;
    modo?: unknown;
    qtde?: unknown;
    idFornecedor?: unknown;
    motivo?: unknown;
  } | undefined;
  const resultado = await registrarQuantidadeItem(token, {
    registroId: body?.registroId,
    modo: body?.modo,
    qtde: body?.qtde,
    idFornecedor: body?.idFornecedor,
    motivo: body?.motivo,
  });
  if ('redirect' in resultado) {
    res.redirect(303, resultado.redirect);
    return;
  }
  res.status(resultado.status).type('html').send(resultado.html);
}
