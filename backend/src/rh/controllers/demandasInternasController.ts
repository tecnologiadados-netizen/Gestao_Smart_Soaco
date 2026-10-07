import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { DemandaErro } from '../lib/demandasInternas.js';
import {
  anexarPrint,
  atualizarCard,
  criarCard,
  criarLista,
  criarQuadro,
  excluirAnexo,
  excluirCard,
  excluirLista,
  excluirQuadro,
  listarDemandas,
  moverCard,
  moverLista,
  renomearLista,
  renomearQuadro,
} from '../repositories/demandasInternasRepository.js';

function ator(req: Request): string {
  return req.rhAuth?.actor?.trim() || 'sistema';
}

function texto(valor: unknown): string | null {
  if (valor == null) return null;
  const limpo = String(valor).trim();
  return limpo || null;
}

function responder(res: Response, err: unknown): void {
  if (err instanceof DemandaErro) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error('[demandas-internas]', err instanceof Error ? err.message : err);
  res.status(500).json({ error: 'Não foi possível concluir a operação.' });
}

export async function getDemandasHandler(_req: Request, res: Response): Promise<void> {
  try {
    res.json(await listarDemandas());
  } catch (err) {
    responder(res, err);
  }
}

export async function criarQuadroHandler(req: Request, res: Response): Promise<void> {
  try {
    res.json(await criarQuadro(req.body?.nome, ator(req)));
  } catch (err) {
    responder(res, err);
  }
}

export async function renomearQuadroHandler(req: Request, res: Response): Promise<void> {
  try {
    res.json(await renomearQuadro(String(req.params.id ?? ''), req.body?.nome));
  } catch (err) {
    responder(res, err);
  }
}

export async function excluirQuadroHandler(req: Request, res: Response): Promise<void> {
  try {
    const senha = typeof req.body?.senha === 'string' ? req.body.senha.trim() : '';
    if (!senha) {
      res.status(400).json({ error: 'Digite sua senha para excluir o quadro.' });
      return;
    }
    const login = req.rhAuth?.actor?.trim();
    if (!login) {
      res.status(401).json({ error: 'Não autorizado. Faça login.' });
      return;
    }
    const usuario = await prisma.usuario.findUnique({
      where: { login },
      select: { senhaHash: true, ativo: true },
    });
    if (!usuario || usuario.ativo === false || !usuario.senhaHash) {
      res.status(401).json({ error: 'Não autorizado. Faça login.' });
      return;
    }
    const senhaOk = await bcrypt.compare(senha, usuario.senhaHash);
    if (!senhaOk) {
      res.status(400).json({ error: 'Senha incorreta.' });
      return;
    }
    res.json(await excluirQuadro(String(req.params.id ?? '')));
  } catch (err) {
    responder(res, err);
  }
}

export async function criarListaHandler(req: Request, res: Response): Promise<void> {
  try {
    res.json(await criarLista(String(req.body?.quadroId ?? ''), req.body?.nome));
  } catch (err) {
    responder(res, err);
  }
}

export async function renomearListaHandler(req: Request, res: Response): Promise<void> {
  try {
    res.json(await renomearLista(String(req.params.id ?? ''), req.body?.nome));
  } catch (err) {
    responder(res, err);
  }
}

export async function moverListaHandler(req: Request, res: Response): Promise<void> {
  try {
    res.json(await moverLista(String(req.params.id ?? ''), texto(req.body?.antesDeId)));
  } catch (err) {
    responder(res, err);
  }
}

export async function excluirListaHandler(req: Request, res: Response): Promise<void> {
  try {
    res.json(await excluirLista(String(req.params.id ?? '')));
  } catch (err) {
    responder(res, err);
  }
}

export async function criarCardHandler(req: Request, res: Response): Promise<void> {
  try {
    res.json(await criarCard(String(req.body?.listaId ?? ''), req.body?.titulo, ator(req), req.body?.cor));
  } catch (err) {
    responder(res, err);
  }
}

export async function atualizarCardHandler(req: Request, res: Response): Promise<void> {
  try {
    res.json(
      await atualizarCard(String(req.params.id ?? ''), {
        titulo: req.body?.titulo,
        observacao: req.body?.observacao,
        concluido: req.body?.concluido,
        checklists: req.body?.checklists,
        cor: req.body?.cor,
        prazo: req.body?.prazo,
      }),
    );
  } catch (err) {
    responder(res, err);
  }
}

export async function moverCardHandler(req: Request, res: Response): Promise<void> {
  try {
    res.json(await moverCard(String(req.params.id ?? ''), String(req.body?.listaId ?? ''), texto(req.body?.antesDeId)));
  } catch (err) {
    responder(res, err);
  }
}

export async function excluirCardHandler(req: Request, res: Response): Promise<void> {
  try {
    res.json(await excluirCard(String(req.params.id ?? '')));
  } catch (err) {
    responder(res, err);
  }
}

export async function anexarPrintHandler(req: Request, res: Response): Promise<void> {
  try {
    const arquivo = req.file;
    if (!arquivo) throw new DemandaErro('Selecione um print.');
    res.json(
      await anexarPrint(String(req.params.id ?? ''), {
        buffer: arquivo.buffer,
        mimetype: arquivo.mimetype,
        originalname: arquivo.originalname,
      }),
    );
  } catch (err) {
    responder(res, err);
  }
}

export async function excluirAnexoHandler(req: Request, res: Response): Promise<void> {
  try {
    res.json(await excluirAnexo(String(req.params.id ?? '')));
  } catch (err) {
    responder(res, err);
  }
}
