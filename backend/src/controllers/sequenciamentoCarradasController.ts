import type { Request, Response } from 'express';
import {
  gravarSnapshotSequenciamento,
  listarSnapshotsSequenciamento,
  montarPayloadSequenciamento,
  obterSnapshotSequenciamento,
} from '../data/sequenciamentoCarradasRepository.js';

/**
 * POST /api/pedidos/sequenciamento-carradas/snapshots
 */
export async function postSequenciamentoCarradasSnapshot(req: Request, res: Response): Promise<void> {
  const login = req.user?.login?.trim();
  if (!login) {
    res.status(401).json({ error: 'Sessão inválida.' });
    return;
  }
  try {
    const { erroConexao } = await montarPayloadSequenciamento();
    if (erroConexao) {
      res.status(503).json({ error: 'Não foi possível consultar o Nomus. Tente novamente.' });
      return;
    }
    const row = await gravarSnapshotSequenciamento(login);
    res.status(201).json({
      ok: true,
      id: row.id,
      cod: row.cod,
      createdAt: row.createdAt.toISOString(),
      usuarioLogin: row.usuarioLogin,
      carradaCount: row.carradaCount,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[sequenciamentoCarradasController] postSnapshot:', msg);
    res.status(503).json({ error: msg });
  }
}

/**
 * GET /api/pedidos/sequenciamento-carradas/snapshots?limit=100
 */
export async function getSequenciamentoCarradasSnapshots(req: Request, res: Response): Promise<void> {
  try {
    const limitRaw = parseInt(String(req.query.limit ?? '100'), 10);
    const limit = Number.isFinite(limitRaw) ? limitRaw : 100;
    const rows = await listarSnapshotsSequenciamento(limit);
    res.json({
      data: rows.map((r) => ({
        id: r.id,
        cod: r.cod,
        usuarioLogin: r.usuarioLogin,
        createdAt: r.createdAt.toISOString(),
        carradaCount: r.carradaCount,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[sequenciamentoCarradasController] getSnapshots:', msg);
    res.status(503).json({ error: msg });
  }
}

/**
 * GET /api/pedidos/sequenciamento-carradas/consulta-ao-vivo
 * Consulta o estado atual do Gerenciador sem gravar snapshot.
 */
export async function getSequenciamentoCarradasConsultaAoVivo(_req: Request, res: Response): Promise<void> {
  try {
    const { payload, erroConexao } = await montarPayloadSequenciamento();
    if (erroConexao) {
      res.status(503).json({ error: 'Não foi possível consultar o Nomus. Tente novamente.' });
      return;
    }
    res.json({
      aoVivo: true,
      geradoEm: payload.geradoEm,
      carradaCount: payload.carradas.length,
      payload,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[sequenciamentoCarradasController] consultaAoVivo:', msg);
    res.status(503).json({ error: msg });
  }
}

/**
 * GET /api/pedidos/sequenciamento-carradas/snapshots/:id
 */
export async function getSequenciamentoCarradasSnapshotById(req: Request, res: Response): Promise<void> {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id) || id < 1) {
    res.status(400).json({ error: 'ID inválido.' });
    return;
  }
  try {
    const row = await obterSnapshotSequenciamento(id);
    if (!row) {
      res.status(404).json({ error: 'Snapshot não encontrado.' });
      return;
    }
    res.json({
      id: row.id,
      cod: row.cod,
      usuarioLogin: row.usuarioLogin,
      createdAt: row.createdAt.toISOString(),
      carradaCount: row.carradaCount,
      payload: row.payload,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[sequenciamentoCarradasController] getSnapshotById:', msg);
    res.status(503).json({ error: msg });
  }
}
