import type { Request, Response } from 'express';
import {
  listarTiposComDestinatarios,
  listarUsuariosParaDestinatario,
  salvarCatalogoTipos,
  salvarDestinatarios,
  type WhatsappNotificacaoTipoSaveItem,
} from '../data/whatsappNotificacaoRepository.js';
import { previewMensagemDoTipo, testarEnvioTipo } from '../services/whatsappNotificacaoService.js';
import { recarregarCronsWhatsappNotificacao } from '../scheduler/whatsappNotificacaoCron.js';
import { isNomusEnabled } from '../config/nomusDb.js';
import { isConfigured as isEvolutionConfigured } from '../services/evolutionApi.js';

export async function getSmsTipos(_req: Request, res: Response): Promise<void> {
  try {
    const tipos = await listarTiposComDestinatarios();
    res.json({ tipos, nomusEnabled: isNomusEnabled(), evolutionConfigured: isEvolutionConfigured() });
  } catch (err) {
    console.error('getSmsTipos', err);
    res.status(503).json({ error: 'Erro ao listar tipos de mensagem.' });
  }
}

export async function putSmsTipos(req: Request, res: Response): Promise<void> {
  const body = req.body as { tipos?: WhatsappNotificacaoTipoSaveItem[] };
  if (!Array.isArray(body.tipos)) {
    res.status(400).json({ error: 'Campo "tipos" é obrigatório (array).' });
    return;
  }
  try {
    const tipos = await salvarCatalogoTipos(body.tipos);
    await recarregarCronsWhatsappNotificacao();
    res.json({ tipos });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao salvar tipos.';
    console.error('putSmsTipos', err);
    res.status(400).json({ error: msg });
  }
}

export async function putSmsDestinatarios(req: Request, res: Response): Promise<void> {
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
    const tipos = await salvarDestinatarios(tipoId, body.usuarioIds);
    res.json({ tipos });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao salvar destinatários.';
    console.error('putSmsDestinatarios', err);
    res.status(400).json({ error: msg });
  }
}

export async function getSmsUsuarios(_req: Request, res: Response): Promise<void> {
  try {
    const usuarios = await listarUsuariosParaDestinatario();
    res.json(usuarios);
  } catch (err) {
    console.error('getSmsUsuarios', err);
    res.status(503).json({ error: 'Erro ao listar usuários.' });
  }
}

export async function postSmsPreview(req: Request, res: Response): Promise<void> {
  const tipoId = parseInt(req.params.id, 10);
  if (Number.isNaN(tipoId)) {
    res.status(400).json({ error: 'ID inválido.' });
    return;
  }
  try {
    const result = await previewMensagemDoTipo(tipoId);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao gerar preview.';
    console.error('postSmsPreview', err);
    res.status(400).json({ error: msg });
  }
}

export async function postSmsTestar(req: Request, res: Response): Promise<void> {
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
    await testarEnvioTipo(tipoId, usuarioId);
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao testar envio.';
    console.error('postSmsTestar', err);
    res.status(400).json({ error: msg });
  }
}
