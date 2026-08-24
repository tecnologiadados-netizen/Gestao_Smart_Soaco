/**
 * Recebimento — Gestão Mesa: fila de pré-entrada, detalhe e deliberação do conferente.
 */

import type { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import {
  queryDocumentosPreEntradaNomus,
  queryItensDocumentoPreEntradaNomus,
  RECEBIMENTO_STATUS,
  RECEBIMENTO_STATUS_LABEL,
} from '../data/recebimentoNomusRepository.js';
import {
  deliberarConferente,
  listarConferenciasPorDocumentos,
  listarConferentesRecebimento,
  obterConferenciaPorDocumento,
} from '../data/recebimentoConferenciaRepository.js';

function statusPadrao() {
  return {
    codigo: RECEBIMENTO_STATUS.AGUARDANDO_CONFERENTE,
    label: RECEBIMENTO_STATUS_LABEL[RECEBIMENTO_STATUS.AGUARDANDO_CONFERENTE],
  };
}

/**
 * GET /api/recebimento/mesa/documentos
 */
export async function getRecebimentoMesaDocumentos(_req: Request, res: Response): Promise<void> {
  const { documentos, tipos, erro } = await queryDocumentosPreEntradaNomus();
  if (erro && documentos.length === 0) {
    res.status(503).json({ error: erro, documentos: [], tipos });
    return;
  }

  const locais = await listarConferenciasPorDocumentos(documentos.map((d) => d.idDocumento));
  const lista = documentos.map((d) => {
    const local = locais.get(d.idDocumento);
    const codigo = local?.status ?? RECEBIMENTO_STATUS.AGUARDANDO_CONFERENTE;
    return {
      ...d,
      status: codigo,
      statusLabel: RECEBIMENTO_STATUS_LABEL[codigo] ?? codigo,
      conferenteUsuarioId: local?.conferenteUsuarioId ?? null,
      conferenteLogin: local?.conferenteLogin ?? null,
      conferenteNome: local?.conferenteNome ?? null,
      atribuidoEm: local?.atribuidoEm ?? null,
    };
  });

  res.json({
    documentos: lista,
    tipos,
    erro: erro || undefined,
  });
}

/**
 * GET /api/recebimento/mesa/documentos/:id/itens
 */
export async function getRecebimentoMesaItens(req: Request, res: Response): Promise<void> {
  const idDocumento = Math.trunc(Number(req.params.id));
  if (!Number.isFinite(idDocumento) || idDocumento <= 0) {
    res.status(400).json({ error: 'idDocumento inválido.' });
    return;
  }

  const { itens, erro } = await queryItensDocumentoPreEntradaNomus(idDocumento);
  if (erro) {
    res.status(503).json({ error: erro, itens: [] });
    return;
  }

  const local = await obterConferenciaPorDocumento(idDocumento);
  const codigo = local?.status ?? statusPadrao().codigo;
  res.json({
    itens,
    status: codigo,
    statusLabel: RECEBIMENTO_STATUS_LABEL[codigo] ?? codigo,
    conferenteUsuarioId: local?.conferenteUsuarioId ?? null,
    conferenteLogin: local?.conferenteLogin ?? null,
    conferenteNome: local?.conferenteNome ?? null,
    atribuidoEm: local?.atribuidoEm ?? null,
  });
}

/**
 * GET /api/recebimento/mesa/conferentes
 */
export async function getRecebimentoMesaConferentes(_req: Request, res: Response): Promise<void> {
  const conferentes = await listarConferentesRecebimento();
  res.json({ conferentes });
}

/**
 * POST /api/recebimento/mesa/documentos/:id/deliberar
 * body: { conferenteUsuarioId: number, numeroDocumento?: string }
 */
export async function postRecebimentoMesaDeliberar(req: Request, res: Response): Promise<void> {
  const idDocumento = Math.trunc(Number(req.params.id));
  const conferenteUsuarioId = Math.trunc(Number(req.body?.conferenteUsuarioId));
  const numeroDocumento =
    typeof req.body?.numeroDocumento === 'string' ? req.body.numeroDocumento.trim() : null;

  if (!Number.isFinite(idDocumento) || idDocumento <= 0) {
    res.status(400).json({ error: 'idDocumento inválido.' });
    return;
  }
  if (!Number.isFinite(conferenteUsuarioId) || conferenteUsuarioId <= 0) {
    res.status(400).json({ error: 'Selecione um conferente.' });
    return;
  }
  const login = req.user?.login;
  if (!login) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }

  const [mesa, conferente] = await Promise.all([
    prisma.usuario.findUnique({ where: { login }, select: { id: true, login: true } }),
    prisma.usuario.findUnique({
      where: { id: conferenteUsuarioId },
      select: { id: true, login: true, nome: true, ativo: true },
    }),
  ]);
  if (!mesa) {
    res.status(401).json({ error: 'Usuário não encontrado.' });
    return;
  }
  if (!conferente || conferente.ativo === false) {
    res.status(400).json({ error: 'Conferente inválido ou inativo.' });
    return;
  }

  const permitidos = await listarConferentesRecebimento();
  if (!permitidos.some((c) => c.id === conferente.id)) {
    res.status(400).json({
      error: 'Este usuário não tem permissão de conferente. Atribua a permissão no grupo.',
    });
    return;
  }

  try {
    const local = await deliberarConferente({
      idDocumentoEstoque: idDocumento,
      numeroDocumento: numeroDocumento || null,
      conferente: { id: conferente.id, login: conferente.login, nome: conferente.nome },
      atribuidoPor: mesa,
    });
    res.json({
      ok: true,
      status: local.status,
      statusLabel: RECEBIMENTO_STATUS_LABEL[local.status],
      conferenteUsuarioId: local.conferenteUsuarioId,
      conferenteLogin: local.conferenteLogin,
      conferenteNome: local.conferenteNome,
      atribuidoEm: local.atribuidoEm,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
}
