import type { Request, Response } from 'express';
import {
  countRegistroInadimplentes,
  createContatoRegistro,
  createRegistroInadimplente,
  deleteContatoRegistro,
  deleteRegistroInadimplente,
  importRegistroInadimplentesBulk,
  listContatosRegistro,
  listRegistroInadimplentes,
  updateContatoRegistro,
  updateRegistroInadimplente,
  type ContatoInadimplenteInput,
  type RegistroInadimplenteInput,
} from '../services/crmRegistroInadimplentesService.js';

function parseBody(body: unknown): RegistroInadimplenteInput {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  return {
    vencimento: b.vencimento != null ? String(b.vencimento) : null,
    pagamento: b.pagamento != null ? String(b.pagamento) : null,
    empresa: b.empresa != null ? String(b.empresa) : null,
    banco: b.banco != null ? String(b.banco) : null,
    tipo: b.tipo != null ? String(b.tipo) : null,
    cliente: String(b.cliente ?? ''),
    status: b.status != null ? String(b.status) : null,
    serasa: b.serasa != null ? String(b.serasa) : null,
    vendedor: b.vendedor != null ? String(b.vendedor) : null,
    total: b.total == null || b.total === '' ? null : Number(b.total),
    nfPd: b.nfPd != null ? String(b.nfPd) : null,
    parcela: b.parcela != null ? String(b.parcela) : null,
    obs: b.obs != null ? String(b.obs) : null,
  };
}

function parseContatoBody(body: unknown): ContatoInadimplenteInput {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  return {
    dataContato: b.dataContato != null ? String(b.dataContato) : null,
    texto: String(b.texto ?? ''),
  };
}

function getLogin(req: Request): string | null {
  return typeof (req as { user?: { login?: string } }).user?.login === 'string'
    ? (req as { user?: { login?: string } }).user?.login ?? null
    : null;
}

export async function getCrmRegistroInadimplentes(req: Request, res: Response): Promise<void> {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const page = req.query.page != null ? Number(req.query.page) : 1;
    const pageSize = req.query.pageSize != null ? Number(req.query.pageSize) : 50;
    const result = await listRegistroInadimplentes({ q, page, pageSize });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao listar registros.';
    res.status(500).json({ error: message });
  }
}

export async function postCrmRegistroInadimplente(req: Request, res: Response): Promise<void> {
  try {
    const created = await createRegistroInadimplente(parseBody(req.body), getLogin(req));
    res.status(201).json(created);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao criar registro.';
    res.status(400).json({ error: message });
  }
}

export async function putCrmRegistroInadimplente(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: 'ID inválido.' });
      return;
    }
    const updated = await updateRegistroInadimplente(id, parseBody(req.body));
    if (!updated) {
      res.status(404).json({ error: 'Registro não encontrado.' });
      return;
    }
    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao atualizar registro.';
    res.status(400).json({ error: message });
  }
}

export async function deleteCrmRegistroInadimplente(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: 'ID inválido.' });
      return;
    }
    const ok = await deleteRegistroInadimplente(id);
    if (!ok) {
      res.status(404).json({ error: 'Registro não encontrado.' });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao excluir registro.';
    res.status(500).json({ error: message });
  }
}

export async function postCrmRegistroInadimplentesImport(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const body = req.body as { rows?: unknown[]; clearExistingImport?: boolean };
    if (!Array.isArray(body?.rows) || body.rows.length === 0) {
      res.status(400).json({ error: 'Informe rows[] para importar.' });
      return;
    }
    const rows = body.rows.map((r) => parseBody(r));
    const result = await importRegistroInadimplentesBulk(rows, {
      clearExistingImport: Boolean(body.clearExistingImport),
      login: getLogin(req),
    });
    const total = await countRegistroInadimplentes();
    res.json({ ...result, total });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao importar registros.';
    res.status(500).json({ error: message });
  }
}

export async function getCrmRegistroInadimplenteContatos(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: 'ID inválido.' });
      return;
    }
    const data = await listContatosRegistro(id);
    if (!data) {
      res.status(404).json({ error: 'Registro não encontrado.' });
      return;
    }
    res.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao listar contatos.';
    res.status(500).json({ error: message });
  }
}

export async function postCrmRegistroInadimplenteContato(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: 'ID inválido.' });
      return;
    }
    const created = await createContatoRegistro(id, parseContatoBody(req.body), getLogin(req));
    if (!created) {
      res.status(404).json({ error: 'Registro não encontrado.' });
      return;
    }
    res.status(201).json(created);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao criar contato.';
    res.status(400).json({ error: message });
  }
}

export async function putCrmRegistroInadimplenteContato(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const id = Number(req.params.id);
    const contatoId = Number(req.params.contatoId);
    if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(contatoId) || contatoId <= 0) {
      res.status(400).json({ error: 'ID inválido.' });
      return;
    }
    const updated = await updateContatoRegistro(id, contatoId, parseContatoBody(req.body));
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

export async function deleteCrmRegistroInadimplenteContato(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const id = Number(req.params.id);
    const contatoId = Number(req.params.contatoId);
    if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(contatoId) || contatoId <= 0) {
      res.status(400).json({ error: 'ID inválido.' });
      return;
    }
    const ok = await deleteContatoRegistro(id, contatoId);
    if (!ok) {
      res.status(404).json({ error: 'Contato não encontrado.' });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao excluir contato.';
    res.status(500).json({ error: message });
  }
}
