import type { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import {
  confirmarInventario,
  listarInventarios,
  listarMovimentacoes,
  obterResumo,
  registrarMovimentacao,
  type TipoMovimentacaoLojaKit,
} from '../data/lojaEstoqueKitsRepository.js';
import {
  buscarDocumentosSaidaNomus,
  buscarItensDocumentoSaidaNomus,
} from '../data/lojaEstoqueKitsNomusRepository.js';
import {
  criarInventarioLojaKitSchema,
  criarMovimentacaoLojaKitSchema,
} from '../validators/lojaEstoqueKits.js';

async function resolveUsuario(login: string | undefined): Promise<{
  id: number | null;
  nome: string;
}> {
  if (!login) return { id: null, nome: '—' };
  const u = await prisma.usuario.findUnique({
    where: { login },
    select: { id: true, nome: true, login: true },
  });
  if (!u) return { id: null, nome: login };
  return { id: u.id, nome: (u.nome?.trim() || u.login) };
}

export async function getLojaEstoqueKitsResumo(_req: Request, res: Response): Promise<void> {
  try {
    const data = await obterResumo();
    res.json({ data });
  } catch (err) {
    console.error('getLojaEstoqueKitsResumo', err);
    res.status(503).json({ error: 'Erro ao carregar resumo de estoque de kits.' });
  }
}

export async function getLojaEstoqueKitsDocumentosSaidaNomus(req: Request, res: Response): Promise<void> {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
    const limit = Number.isFinite(limitRaw) ? limitRaw : undefined;
    const { documentos, source } = await buscarDocumentosSaidaNomus({ q, limit });
    res.json({ data: documentos, source });
  } catch (err) {
    console.error('getLojaEstoqueKitsDocumentosSaidaNomus', err);
    res.status(503).json({ error: 'Erro ao buscar documentos de saída no Nomus.' });
  }
}

export async function getLojaEstoqueKitsItensDocumentoSaidaNomus(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const documentoId = String(req.params.documentoId ?? '').trim();
    if (!documentoId) {
      res.status(400).json({ error: 'documentoId é obrigatório.' });
      return;
    }
    const { itens, source } = await buscarItensDocumentoSaidaNomus(documentoId);
    res.json({ data: itens, source });
  } catch (err) {
    console.error('getLojaEstoqueKitsItensDocumentoSaidaNomus', err);
    res.status(503).json({ error: 'Erro ao buscar itens do documento de saída.' });
  }
}

export async function getLojaEstoqueKitsMovimentacoes(req: Request, res: Response): Promise<void> {
  try {
    const tipoRaw = typeof req.query.tipo === 'string' ? req.query.tipo : undefined;
    const tipo =
      tipoRaw === 'entrada' || tipoRaw === 'saida' || tipoRaw === 'inventario'
        ? (tipoRaw as TipoMovimentacaoLojaKit)
        : undefined;
    const produtoIdRaw = typeof req.query.produtoId === 'string' ? Number(req.query.produtoId) : NaN;
    const produtoId = Number.isFinite(produtoIdRaw) && produtoIdRaw > 0 ? produtoIdRaw : undefined;
    const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
    const data = await listarMovimentacoes({
      tipo,
      produtoId,
      limit: limitRaw,
    });
    res.json({ data });
  } catch (err) {
    console.error('getLojaEstoqueKitsMovimentacoes', err);
    res.status(503).json({ error: 'Erro ao listar movimentações.' });
  }
}

export async function postLojaEstoqueKitsMovimentacao(req: Request, res: Response): Promise<void> {
  const parsed = criarMovimentacaoLojaKitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
    return;
  }
  try {
    const user = await resolveUsuario(req.user?.login);
    const data = await registrarMovimentacao({
      produtoId: parsed.data.produtoId,
      tipo: parsed.data.tipo,
      quantidade: parsed.data.quantidade,
      pd: parsed.data.pd,
      documentoSaida: parsed.data.documentoSaida,
      produtoPedidoCodigo: parsed.data.produtoPedidoCodigo,
      produtoPedidoDescricao: parsed.data.produtoPedidoDescricao,
      usuarioId: user.id,
      responsavelNome: user.nome,
    });
    res.status(201).json({ data });
  } catch (err) {
    const status = (err as { status?: number }).status;
    const msg = err instanceof Error ? err.message : 'Erro ao registrar movimentação.';
    if (status === 400 || status === 404) {
      res.status(status).json({ error: msg });
      return;
    }
    console.error('postLojaEstoqueKitsMovimentacao', err);
    res.status(503).json({ error: 'Erro ao registrar movimentação.' });
  }
}

export async function getLojaEstoqueKitsInventarios(_req: Request, res: Response): Promise<void> {
  try {
    const data = await listarInventarios();
    res.json({ data });
  } catch (err) {
    console.error('getLojaEstoqueKitsInventarios', err);
    res.status(503).json({ error: 'Erro ao listar inventários.' });
  }
}

export async function postLojaEstoqueKitsInventario(req: Request, res: Response): Promise<void> {
  const parsed = criarInventarioLojaKitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
    return;
  }
  try {
    const user = await resolveUsuario(req.user?.login);
    const data = await confirmarInventario({
      observacao: parsed.data.observacao,
      itens: parsed.data.itens,
      usuarioId: user.id,
      responsavelNome: user.nome,
    });
    res.status(201).json({ data });
  } catch (err) {
    const status = (err as { status?: number }).status;
    const msg = err instanceof Error ? err.message : 'Erro ao confirmar inventário.';
    if (status === 400 || status === 404) {
      res.status(status).json({ error: msg });
      return;
    }
    console.error('postLojaEstoqueKitsInventario', err);
    res.status(503).json({ error: 'Erro ao confirmar inventário.' });
  }
}
