import type { Request, Response } from 'express';
import {
  atualizarSimulacaoSnapshot,
  concluirSnapshotSequenciamento,
  gravarSnapshotSequenciamento,
  listarSnapshotsSequenciamento,
  montarPayloadConsultaAoVivo,
  montarPayloadSequenciamento,
  obterSnapshotSequenciamento,
  sanitizarSimulacao,
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
    const simulacao = sanitizarSimulacao((req.body as Record<string, unknown> | undefined)?.simulacao);
    const row = await gravarSnapshotSequenciamento(login, simulacao);
    res.status(201).json({
      ok: true,
      id: row.id,
      cod: row.cod,
      createdAt: row.createdAt.toISOString(),
      usuarioLogin: row.usuarioLogin,
      carradaCount: row.carradaCount,
      status: row.status,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[sequenciamentoCarradasController] postSnapshot:', msg);
    res.status(503).json({ error: msg });
  }
}

/**
 * PATCH /api/pedidos/sequenciamento-carradas/snapshots/:id
 * Autosave da simulação (datas/ordem/motivos) de um snapshot em rascunho.
 */
export async function patchSequenciamentoCarradasSnapshot(req: Request, res: Response): Promise<void> {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id) || id < 1) {
    res.status(400).json({ error: 'ID inválido.' });
    return;
  }
  try {
    const simulacao = sanitizarSimulacao((req.body as Record<string, unknown> | undefined)?.simulacao);
    const r = await atualizarSimulacaoSnapshot(id, simulacao);
    if (!r.ok) {
      res.status(r.notFound ? 404 : 409).json({ error: r.error });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[sequenciamentoCarradasController] patchSnapshot:', msg);
    res.status(503).json({ error: msg });
  }
}

/**
 * POST /api/pedidos/sequenciamento-carradas/snapshots/:id/concluir
 * Marca o snapshot como concluído (status final, somente leitura).
 */
export async function postSequenciamentoCarradasSnapshotConcluir(req: Request, res: Response): Promise<void> {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id) || id < 1) {
    res.status(400).json({ error: 'ID inválido.' });
    return;
  }
  try {
    // Persiste a simulação final (se enviada) antes de congelar o snapshot.
    const body = req.body as Record<string, unknown> | undefined;
    if (body && 'simulacao' in body) {
      const simulacao = sanitizarSimulacao(body.simulacao);
      const upd = await atualizarSimulacaoSnapshot(id, simulacao);
      if (!upd.ok && upd.notFound) {
        res.status(404).json({ error: upd.error });
        return;
      }
    }
    const r = await concluirSnapshotSequenciamento(id);
    if (!r.ok) {
      res.status(r.notFound ? 404 : 409).json({ error: r.error });
      return;
    }
    res.json({ ok: true, status: 'concluido' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[sequenciamentoCarradasController] concluirSnapshot:', msg);
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
        status: r.status,
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
    const { payload, erroConexao } = await montarPayloadConsultaAoVivo();
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
      status: row.status,
      payload: row.payload,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[sequenciamentoCarradasController] getSnapshotById:', msg);
    res.status(503).json({ error: msg });
  }
}
