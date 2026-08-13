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
  buscarItensSequenciaShop9,
  buscarSequenciasShop9,
  obterSequenciaShop9PorOrdem,
} from '../data/lojaEstoqueKitsShop9Repository.js';
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

export async function getLojaEstoqueKitsSequenciasShop9(req: Request, res: Response): Promise<void> {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
    const limit = Number.isFinite(limitRaw) ? limitRaw : undefined;
    const { sequencias, source } = await buscarSequenciasShop9({ q, limit });
    res.json({ data: sequencias, source });
  } catch (err) {
    console.error('getLojaEstoqueKitsSequenciasShop9', err);
    res.status(503).json({ error: 'Erro ao buscar sequências no Shop9.' });
  }
}

export async function getLojaEstoqueKitsItensSequenciaShop9(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const ordem = Number(req.params.ordem ?? '');
    if (!Number.isFinite(ordem) || ordem <= 0) {
      res.status(400).json({ error: 'ordem da sequência Shop9 é obrigatória.' });
      return;
    }
    const { itens, source } = await buscarItensSequenciaShop9(ordem);
    res.json({ data: itens, source });
  } catch (err) {
    console.error('getLojaEstoqueKitsItensSequenciaShop9', err);
    res.status(503).json({ error: 'Erro ao buscar itens da sequência Shop9.' });
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

async function quantidadeProdutoNoPedidoNomus(input: {
  documentoId?: string;
  documentoSaida: string;
  produtoPedidoCodigo: string;
  pd: string;
}): Promise<{ quantidade: number } | { error: string; status: number }> {
  let documentoId = input.documentoId?.trim() ?? '';
  if (!documentoId) {
    const { documentos, source } = await buscarDocumentosSaidaNomus({
      q: input.documentoSaida,
      limit: 20,
    });
    if (source === 'indisponivel') {
      return { error: 'Não foi possível validar a quantidade no pedido (Nomus indisponível).', status: 503 };
    }
    documentoId =
      documentos.find((d) => d.numero === input.documentoSaida)?.documentoId ?? '';
  }
  if (!documentoId) {
    return { error: 'Documento de saída não encontrado no Nomus.', status: 400 };
  }

  const { itens, source } = await buscarItensDocumentoSaidaNomus(documentoId);
  if (source === 'indisponivel') {
    return { error: 'Não foi possível validar a quantidade no pedido (Nomus indisponível).', status: 503 };
  }

  const item =
    itens.find((i) => i.codigo === input.produtoPedidoCodigo && i.pedidoNumero === input.pd) ??
    itens.find((i) => i.codigo === input.produtoPedidoCodigo);
  if (!item) {
    return { error: 'Produto não encontrado neste documento/pedido.', status: 400 };
  }

  const quantidade = Math.max(1, Math.round(item.quantidade) || 1);
  return { quantidade };
}

async function quantidadeProdutoNaSequenciaShop9(input: {
  ordemMovimentoShop9?: number;
  sequenciaShop9?: number;
  produtoPedidoCodigo: string;
}): Promise<
  | { quantidade: number; sequencia: number; ordem: number }
  | { error: string; status: number }
> {
  let ordem = input.ordemMovimentoShop9 ?? 0;
  let sequencia = input.sequenciaShop9 ?? 0;
  if (!ordem && sequencia) {
    const { sequencias, source } = await buscarSequenciasShop9({
      q: String(sequencia),
      limit: 20,
    });
    if (source === 'indisponivel') {
      return { error: 'Não foi possível validar a sequência no Shop9.', status: 503 };
    }
    const found = sequencias.find((s) => s.sequencia === sequencia) ?? sequencias[0];
    if (found) {
      ordem = found.ordem;
      sequencia = found.sequencia;
    }
  }
  if (!ordem) {
    return { error: 'Sequência Shop9 não encontrada.', status: 400 };
  }

  const { sequencia: seqRow, source: srcSeq } = await obterSequenciaShop9PorOrdem(ordem);
  if (srcSeq === 'indisponivel') {
    return { error: 'Não foi possível validar a sequência no Shop9.', status: 503 };
  }
  if (!seqRow) {
    return { error: 'Sequência Shop9 não encontrada ou não é uma venda.', status: 400 };
  }
  sequencia = seqRow.sequencia;

  const { itens, source } = await buscarItensSequenciaShop9(ordem);
  if (source === 'indisponivel') {
    return { error: 'Não foi possível validar a quantidade na sequência Shop9.', status: 503 };
  }
  const item = itens.find((i) => i.codigo === input.produtoPedidoCodigo);
  if (!item) {
    return { error: 'Produto não encontrado nesta sequência Shop9.', status: 400 };
  }
  const quantidade = Math.max(1, Math.round(item.quantidade) || 1);
  return { quantidade, sequencia, ordem };
}

export async function postLojaEstoqueKitsMovimentacao(req: Request, res: Response): Promise<void> {
  const parsed = criarMovimentacaoLojaKitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
    return;
  }
  try {
    let quantidadeMax: number;
    let pd: string;
    let sequenciaShop9: number | undefined;
    let ordemMovimentoShop9: number | undefined;

    if (parsed.data.tipo === 'entrada') {
      const qtdPedido = await quantidadeProdutoNoPedidoNomus({
        documentoId: parsed.data.documentoId,
        documentoSaida: parsed.data.documentoSaida ?? '',
        produtoPedidoCodigo: parsed.data.produtoPedidoCodigo,
        pd: parsed.data.pd ?? '',
      });
      if ('error' in qtdPedido) {
        res.status(qtdPedido.status).json({ error: qtdPedido.error });
        return;
      }
      quantidadeMax = qtdPedido.quantidade;
      pd = parsed.data.pd?.trim() || '';
    } else {
      const qtdSeq = await quantidadeProdutoNaSequenciaShop9({
        ordemMovimentoShop9: parsed.data.ordemMovimentoShop9,
        sequenciaShop9: parsed.data.sequenciaShop9,
        produtoPedidoCodigo: parsed.data.produtoPedidoCodigo,
      });
      if ('error' in qtdSeq) {
        res.status(qtdSeq.status).json({ error: qtdSeq.error });
        return;
      }
      quantidadeMax = qtdSeq.quantidade;
      sequenciaShop9 = qtdSeq.sequencia;
      ordemMovimentoShop9 = qtdSeq.ordem;
      pd = `SEQ ${qtdSeq.sequencia}`;
    }

    if (parsed.data.quantidade > quantidadeMax) {
      res.status(400).json({
        error: `A quantidade não pode ser maior que a do produto (${quantidadeMax} unid.).`,
      });
      return;
    }

    const user = await resolveUsuario(req.user?.login);
    const data = await registrarMovimentacao({
      produtoId: parsed.data.produtoId,
      kitCompleto: parsed.data.kitCompleto,
      tipo: parsed.data.tipo,
      quantidade: parsed.data.quantidade,
      quantidadeMaxPedido: quantidadeMax,
      pd,
      documentoSaida: parsed.data.documentoSaida,
      sequenciaShop9,
      ordemMovimentoShop9,
      conferenteNome: parsed.data.conferenteNome,
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
