/**
 * Processo do contas a pagar do Diário Financeiro.
 */

import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.js';
import {
  aprovarProcessoDiario,
  atualizarDescricaoProcessoDiario,
  devolverProcessoDiario,
  enviarProcessoDiarioAprovacao,
  iniciarProcessoDiario,
  listarProcessosDiario,
} from '../data/diarioProcessoRepository.js';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function getProcessosDiario(_req: Request, res: Response): Promise<void> {
  try {
    const processos = await listarProcessosDiario();
    res.json({ processos });
  } catch (err) {
    console.error('[getProcessosDiario]', msg(err));
    res.status(500).json({ error: msg(err) });
  }
}

export async function postIniciarProcessoDiario(req: Request, res: Response): Promise<void> {
  const dataVencimento = String(req.body?.dataVencimento ?? '').trim();
  const descricao = String(req.body?.descricao ?? '');
  if (!YMD.test(dataVencimento)) {
    res.status(400).json({ error: 'Informe a data de vencimento no formato AAAA-MM-DD.' });
    return;
  }
  try {
    const resultado = await iniciarProcessoDiario({
      dataVencimento,
      descricao,
      usuario: req.user?.login ?? '?',
    });
    res.status(resultado.existente ? 200 : 201).json(resultado);
  } catch (err) {
    console.error('[postIniciarProcessoDiario]', msg(err));
    res.status(400).json({ error: msg(err) });
  }
}

export async function patchDescricaoProcessoDiario(req: Request, res: Response): Promise<void> {
  const id = Math.trunc(Number(req.params.id));
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Processo inválido.' });
    return;
  }
  try {
    const processo = await atualizarDescricaoProcessoDiario(id);
    res.json({ processo });
  } catch (err) {
    console.error('[patchDescricaoProcessoDiario]', msg(err));
    res.status(400).json({ error: msg(err) });
  }
}

export async function postEnviarProcessoDiario(req: Request, res: Response): Promise<void> {
  const id = Math.trunc(Number(req.params.id));
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Processo inválido.' });
    return;
  }
  try {
    const processo = await enviarProcessoDiarioAprovacao(id);
    res.json({ processo });
  } catch (err) {
    console.error('[postEnviarProcessoDiario]', msg(err));
    res.status(400).json({ error: msg(err) });
  }
}

export async function postAprovarProcessoDiario(req: Request, res: Response): Promise<void> {
  const id = Math.trunc(Number(req.params.id));
  const senha = typeof req.body?.senha === 'string' ? req.body.senha.trim() : '';
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Processo inválido.' });
    return;
  }
  if (!senha) {
    res.status(400).json({ error: 'Informe sua senha para aprovar.' });
    return;
  }
  const login = req.user?.login;
  if (!login) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { login },
      select: { senhaHash: true },
    });
    if (!usuario) {
      res.status(401).json({ error: 'Usuário não encontrado.' });
      return;
    }
    const senhaOk = await bcrypt.compare(senha, usuario.senhaHash);
    if (!senhaOk) {
      res.status(401).json({ error: 'Senha incorreta. O contas a pagar não foi aprovado.' });
      return;
    }
    const processo = await aprovarProcessoDiario(id, login);
    res.json({ processo });
  } catch (err) {
    console.error('[postAprovarProcessoDiario]', msg(err));
    res.status(400).json({ error: msg(err) });
  }
}

export async function postDevolverProcessoDiario(req: Request, res: Response): Promise<void> {
  const id = Math.trunc(Number(req.params.id));
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Processo inválido.' });
    return;
  }
  try {
    const processo = await devolverProcessoDiario(id, String(req.body?.motivo ?? ''));
    res.json({ processo });
  } catch (err) {
    console.error('[postDevolverProcessoDiario]', msg(err));
    res.status(400).json({ error: msg(err) });
  }
}
