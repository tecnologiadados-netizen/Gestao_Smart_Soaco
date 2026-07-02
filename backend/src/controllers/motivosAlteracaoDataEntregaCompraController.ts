import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.js';
import {
  listarMotivosAlteracaoDataEntregaCompra,
  criarMotivoAlteracaoDataEntregaCompra,
  atualizarMotivoAlteracaoDataEntregaCompra,
  excluirMotivoAlteracaoDataEntregaCompra,
} from '../data/motivosAlteracaoDataEntregaCompraRepository.js';
import {
  criarMotivoAlteracaoDataEntregaCompraSchema,
  atualizarMotivoAlteracaoDataEntregaCompraSchema,
  excluirMotivoAlteracaoDataEntregaCompraSchema,
} from '../validators/motivosAlteracaoDataEntregaCompra.js';

export async function getMotivosAlteracaoDataEntregaCompra(_req: Request, res: Response): Promise<void> {
  try {
    const list = await listarMotivosAlteracaoDataEntregaCompra();
    res.json(list);
  } catch (err) {
    console.error('getMotivosAlteracaoDataEntregaCompra', err);
    res.status(503).json({ error: 'Erro ao listar motivos.' });
  }
}

export async function postMotivoAlteracaoDataEntregaCompra(req: Request, res: Response): Promise<void> {
  const parsed = criarMotivoAlteracaoDataEntregaCompraSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
    return;
  }
  try {
    const row = await criarMotivoAlteracaoDataEntregaCompra(parsed.data.descricao);
    res.status(201).json(row);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao criar motivo.';
    if (msg.includes('obrigatória') || msg.includes('unique') || msg.includes('Unique')) {
      res.status(400).json({ error: msg });
      return;
    }
    console.error('postMotivoAlteracaoDataEntregaCompra', err);
    res.status(503).json({ error: 'Erro ao criar motivo.' });
  }
}

export async function putMotivoAlteracaoDataEntregaCompra(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'ID inválido.' });
    return;
  }
  const parsed = atualizarMotivoAlteracaoDataEntregaCompraSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
    return;
  }
  const login = req.user?.login;
  if (!login) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }
  try {
    const usuario = await prisma.usuario.findUnique({ where: { login } });
    if (!usuario) {
      res.status(401).json({ error: 'Usuário não encontrado.' });
      return;
    }
    const senhaOk = await bcrypt.compare(parsed.data.senha, usuario.senhaHash);
    if (!senhaOk) {
      res.status(401).json({ error: 'Senha incorreta. Operação cancelada.' });
      return;
    }
    const row = await atualizarMotivoAlteracaoDataEntregaCompra(id, parsed.data.descricao);
    res.json(row);
  } catch (err) {
    if ((err as { code?: string }).code === 'P2025') {
      res.status(404).json({ error: 'Motivo não encontrado.' });
      return;
    }
    console.error('putMotivoAlteracaoDataEntregaCompra', err);
    res.status(503).json({ error: 'Erro ao atualizar motivo.' });
  }
}

export async function deleteMotivoAlteracaoDataEntregaCompra(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'ID inválido.' });
    return;
  }
  const parsed = excluirMotivoAlteracaoDataEntregaCompraSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Senha é obrigatória para confirmar a exclusão.', details: parsed.error.flatten() });
    return;
  }
  const login = req.user?.login;
  if (!login) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }
  try {
    const usuario = await prisma.usuario.findUnique({ where: { login } });
    if (!usuario) {
      res.status(401).json({ error: 'Usuário não encontrado.' });
      return;
    }
    const senhaOk = await bcrypt.compare(parsed.data.senha, usuario.senhaHash);
    if (!senhaOk) {
      res.status(401).json({ error: 'Senha incorreta. Operação cancelada.' });
      return;
    }
    await excluirMotivoAlteracaoDataEntregaCompra(id);
    res.status(204).send();
  } catch (err) {
    if ((err as { code?: string }).code === 'P2025') {
      res.status(404).json({ error: 'Motivo não encontrado.' });
      return;
    }
    console.error('deleteMotivoAlteracaoDataEntregaCompra', err);
    res.status(503).json({ error: 'Erro ao excluir motivo.' });
  }
}
