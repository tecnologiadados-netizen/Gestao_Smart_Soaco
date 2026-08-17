import type { Request, Response } from 'express';
import {
  atualizarTarefaInadimplente,
  createContatoTarefa,
  deleteContatoTarefa,
  listarTarefasInadimplentes,
  listContatosTarefa,
  obterConfigResponsavel,
  salvarConfigResponsavel,
  sincronizarTarefasInadimplentes,
  updateContatoTarefa,
  type StatusTarefaInadimplente,
} from '../services/crmInadimplenteTarefasService.js';

function getLogin(req: Request): string | null {
  return typeof (req as { user?: { login?: string } }).user?.login === 'string'
    ? (req as { user?: { login?: string } }).user?.login ?? null
    : null;
}

export async function getCrmInadimplenteTarefas(req: Request, res: Response): Promise<void> {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const sync = req.query.sync === '1' || req.query.sync === 'true';
    const result = await listarTarefasInadimplentes({ q, status, sync });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao listar tarefas.';
    res.status(500).json({ error: message });
  }
}

export async function postCrmInadimplenteTarefasSync(_req: Request, res: Response): Promise<void> {
  try {
    const sync = await sincronizarTarefasInadimplentes();
    res.json({ sync });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao sincronizar.';
    res.status(500).json({ error: message });
  }
}

export async function getCrmInadimplenteTarefaConfig(_req: Request, res: Response): Promise<void> {
  try {
    const cfg = await obterConfigResponsavel();
    res.json(cfg);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar responsável.';
    res.status(500).json({ error: message });
  }
}

export async function putCrmInadimplenteTarefaConfig(req: Request, res: Response): Promise<void> {
  try {
    const raw = (req.body as { responsavelUsuarioId?: unknown })?.responsavelUsuarioId;
    const usuarioId =
      raw == null || raw === '' ? null : Number(raw);
    if (usuarioId != null && (!Number.isFinite(usuarioId) || usuarioId <= 0)) {
      res.status(400).json({ error: 'Usuário inválido.' });
      return;
    }
    const saved = await salvarConfigResponsavel(usuarioId, getLogin(req));
    res.json(saved);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao salvar responsável.';
    res.status(400).json({ error: message });
  }
}

export async function putCrmInadimplenteTarefa(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: 'ID inválido.' });
      return;
    }
    const body = (req.body ?? {}) as {
      status?: string;
      responsavelUsuarioId?: number | null;
    };
    const statusOk: StatusTarefaInadimplente[] = ['aberta', 'em_contato', 'concluida'];
    const status =
      body.status && statusOk.includes(body.status as StatusTarefaInadimplente)
        ? (body.status as StatusTarefaInadimplente)
        : undefined;
    const updated = await atualizarTarefaInadimplente(id, {
      status,
      responsavelUsuarioId: body.responsavelUsuarioId,
    });
    if (!updated) {
      res.status(404).json({ error: 'Tarefa não encontrada.' });
      return;
    }
    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao atualizar tarefa.';
    res.status(400).json({ error: message });
  }
}

export async function getCrmInadimplenteTarefaContatos(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: 'ID inválido.' });
      return;
    }
    const result = await listContatosTarefa(id);
    if (!result) {
      res.status(404).json({ error: 'Tarefa não encontrada.' });
      return;
    }
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao listar contatos.';
    res.status(500).json({ error: message });
  }
}

export async function postCrmInadimplenteTarefaContato(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: 'ID inválido.' });
      return;
    }
    const body = (req.body ?? {}) as { dataContato?: string | null; texto?: string };
    const created = await createContatoTarefa(
      id,
      { dataContato: body.dataContato, texto: String(body.texto ?? '') },
      getLogin(req),
    );
    if (!created) {
      res.status(404).json({ error: 'Tarefa não encontrada.' });
      return;
    }
    res.status(201).json(created);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao registrar contato.';
    res.status(400).json({ error: message });
  }
}

export async function putCrmInadimplenteTarefaContato(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    const contatoId = Number(req.params.contatoId);
    if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(contatoId) || contatoId <= 0) {
      res.status(400).json({ error: 'ID inválido.' });
      return;
    }
    const body = (req.body ?? {}) as { dataContato?: string | null; texto?: string };
    const updated = await updateContatoTarefa(id, contatoId, {
      dataContato: body.dataContato,
      texto: String(body.texto ?? ''),
    });
    if (!updated) {
      res.status(404).json({ error: 'Contato não encontrado.' });
      return;
    }
    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao atualizar contato.';
    res.status(400).json({ error: message });
  }
}

export async function deleteCrmInadimplenteTarefaContato(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    const contatoId = Number(req.params.contatoId);
    if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(contatoId) || contatoId <= 0) {
      res.status(400).json({ error: 'ID inválido.' });
      return;
    }
    const ok = await deleteContatoTarefa(id, contatoId);
    if (!ok) {
      res.status(404).json({ error: 'Contato não encontrado.' });
      return;
    }
    res.status(204).end();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao excluir contato.';
    res.status(500).json({ error: message });
  }
}
