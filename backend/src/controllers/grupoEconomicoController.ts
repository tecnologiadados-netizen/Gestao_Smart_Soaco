/**
 * GET /api/comercial/grupo-economico
 * GET /api/comercial/grupo-economico/:id
 */

import type { Request, Response } from 'express';
import {
  detalheGrupoEconomico,
  listarGruposEconomicos,
} from '../data/grupoEconomicoRepository.js';

function parseSomenteAtivos(v: unknown): boolean {
  if (v == null || v === '') return true;
  const s = String(v).trim().toLowerCase();
  if (s === '0' || s === 'false' || s === 'nao' || s === 'não') return false;
  return true;
}

export async function getGrupoEconomicoLista(req: Request, res: Response): Promise<void> {
  const busca = String(req.query.busca ?? req.query.q ?? '').trim().slice(0, 120);
  const somenteAtivos = parseSomenteAtivos(req.query.somenteAtivos);
  const { resumo, grupos, erro } = await listarGruposEconomicos({ busca, somenteAtivos });
  if (erro) {
    res.status(503).json({ error: erro, resumo, grupos });
    return;
  }
  res.json({ resumo, grupos, filtros: { busca, somenteAtivos } });
}

export async function getGrupoEconomicoDetalhe(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: 'Informe um id de grupo válido.' });
    return;
  }
  const somenteAtivos = parseSomenteAtivos(req.query.somenteAtivos);
  const { data, erro } = await detalheGrupoEconomico(id, { somenteAtivosGrupo: somenteAtivos });
  if (erro || !data) {
    res.status(erro?.includes('não encontrado') ? 404 : 503).json({
      error: erro ?? 'Falha ao carregar o grupo econômico.',
    });
    return;
  }
  res.json(data);
}
