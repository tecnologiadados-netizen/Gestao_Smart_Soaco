import type { Request, Response } from 'express';
import {
  listarTiposEmailComDestinatarios,
  listarUsuariosParaDestinatarioEmail,
  salvarCatalogoTiposEmail,
  salvarDestinatariosEmail,
  type EmailNotificacaoTipoSaveItem,
} from '../data/emailNotificacaoRepository.js';
import { previewEmailDoTipo, testarEnvioEmailTipo } from '../services/emailNotificacaoService.js';
import { recarregarCronsEmailNotificacao } from '../scheduler/emailNotificacaoCron.js';
import { isNomusEnabled } from '../config/nomusDb.js';
import { fetchEmailProviderSettings } from '../services/systemEmail.js';
import { prisma } from '../config/prisma.js';

export async function getEmailTipos(_req: Request, res: Response): Promise<void> {
  try {
    const tipos = await listarTiposEmailComDestinatarios();
    const settings = await fetchEmailProviderSettings(prisma);
    res.json({
      tipos,
      nomusEnabled: isNomusEnabled(),
      emailConfigured: Boolean(settings),
    });
  } catch (err) {
    console.error('getEmailTipos', err);
    res.status(503).json({ error: 'Erro ao listar tipos de e-mail.' });
  }
}

export async function putEmailTipos(req: Request, res: Response): Promise<void> {
  const body = req.body as { tipos?: EmailNotificacaoTipoSaveItem[] };
  if (!Array.isArray(body.tipos)) {
    res.status(400).json({ error: 'Campo "tipos" é obrigatório (array).' });
    return;
  }
  try {
    const tipos = await salvarCatalogoTiposEmail(body.tipos);
    await recarregarCronsEmailNotificacao();
    res.json({ tipos });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao salvar tipos.';
    console.error('putEmailTipos', err);
    res.status(400).json({ error: msg });
  }
}

export async function putEmailDestinatarios(req: Request, res: Response): Promise<void> {
  const tipoId = parseInt(req.params.id, 10);
  if (Number.isNaN(tipoId)) {
    res.status(400).json({ error: 'ID inválido.' });
    return;
  }
  const body = req.body as { usuarioIds?: number[] };
  if (!Array.isArray(body.usuarioIds)) {
    res.status(400).json({ error: 'Campo "usuarioIds" é obrigatório (array).' });
    return;
  }
  try {
    const tipos = await salvarDestinatariosEmail(tipoId, body.usuarioIds);
    res.json({ tipos });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao salvar destinatários.';
    console.error('putEmailDestinatarios', err);
    res.status(400).json({ error: msg });
  }
}

export async function getEmailUsuarios(_req: Request, res: Response): Promise<void> {
  try {
    const usuarios = await listarUsuariosParaDestinatarioEmail();
    res.json(usuarios);
  } catch (err) {
    console.error('getEmailUsuarios', err);
    res.status(503).json({ error: 'Erro ao listar usuários.' });
  }
}

export async function postEmailPreview(req: Request, res: Response): Promise<void> {
  const tipoId = parseInt(req.params.id, 10);
  if (Number.isNaN(tipoId)) {
    res.status(400).json({ error: 'ID inválido.' });
    return;
  }
  try {
    const result = await previewEmailDoTipo(tipoId);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao gerar preview.';
    console.error('postEmailPreview', err);
    res.status(400).json({ error: msg });
  }
}

export async function postEmailTestar(req: Request, res: Response): Promise<void> {
  const tipoId = parseInt(req.params.id, 10);
  if (Number.isNaN(tipoId)) {
    res.status(400).json({ error: 'ID inválido.' });
    return;
  }
  const body = req.body as { usuarioId?: number };
  const usuarioId = body.usuarioId;
  if (!usuarioId || typeof usuarioId !== 'number') {
    res.status(400).json({ error: 'Campo "usuarioId" é obrigatório.' });
    return;
  }
  try {
    await testarEnvioEmailTipo(tipoId, usuarioId);
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao testar envio.';
    console.error('postEmailTestar', err);
    res.status(400).json({ error: msg });
  }
}
