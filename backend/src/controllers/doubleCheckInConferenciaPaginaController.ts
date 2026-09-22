/**
 * Página pública da conferência NF × PC. O token no link é o acesso.
 */

import type { Request, Response } from 'express';
import { buscarConferenciaPaginaPorToken } from '../data/doubleCheckInLocalRepository.js';
import {
  renderConferenciaHtml,
  renderConferenciaNaoEncontradaHtml,
  type RelatoConferencia,
} from '../services/doubleCheckInConferenciaRelato.js';

const TOKEN_RE = /^[A-Za-z0-9_-]{8,64}$/;

function lerRelato(payloadJson: string): RelatoConferencia | null {
  try {
    const v = JSON.parse(payloadJson) as RelatoConferencia;
    if (!v || typeof v !== 'object' || !Array.isArray(v.produtos)) return null;
    if (typeof v.numeroNfe !== 'string' || typeof v.nomeParceiro !== 'string') return null;
    return v;
  } catch {
    return null;
  }
}

export async function getDoubleCheckInConferenciaPagina(req: Request, res: Response): Promise<void> {
  const token = String(req.params.token ?? '').trim();
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  if (!TOKEN_RE.test(token)) {
    res.status(404).type('html').send(renderConferenciaNaoEncontradaHtml());
    return;
  }
  try {
    const row = await buscarConferenciaPaginaPorToken(token);
    const relato = row ? lerRelato(row.payloadJson) : null;
    if (!relato) {
      res.status(404).type('html').send(renderConferenciaNaoEncontradaHtml());
      return;
    }
    res.status(200).type('html').send(renderConferenciaHtml(relato));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[getDoubleCheckInConferenciaPagina]', msg);
    res.status(503).type('html').send(renderConferenciaNaoEncontradaHtml());
  }
}
