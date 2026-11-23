import type { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import {
  buscarDatasEntregaForaJanela,
  listarDatasEntregaAtualizar,
  listarDetalheAcompanhamento,
  listarPipelineAcompanhamento,
  obterDocumentoAcompanhamento,
  obterPedidoDataEntregaElegivel,
  type EtapaAcompanhamento,
  type TipoDocumentoAcompanhamento,
} from '../data/acompanhamentoSolicitacaoRepository.js';

const ETAPAS = new Set<EtapaAcompanhamento>(['solicitado', 'pre_compra', 'comprado', 'pre_entrada']);
const TIPOS_DOCUMENTO = new Set<TipoDocumentoAcompanhamento>(['pedido', 'pre_entrada']);

export async function getPipelineAcompanhamento(_req: Request, res: Response): Promise<void> {
  const r = await listarPipelineAcompanhamento();
  if (r.erro) {
    res.status(503).json({ error: r.erro });
    return;
  }
  res.json({ linhas: r.linhas });
}

export async function getDetalheAcompanhamento(req: Request, res: Response): Promise<void> {
  const idProduto = Number(req.query.idProduto);
  const etapa = String(req.query.etapa ?? '') as EtapaAcompanhamento;
  if (!ETAPAS.has(etapa)) {
    res.status(400).json({ error: 'Etapa inválida.' });
    return;
  }
  const r = await listarDetalheAcompanhamento(idProduto, etapa);
  if (r.erro) {
    res.status(503).json({ error: r.erro });
    return;
  }
  res.json({ etapa, linhas: r.linhas });
}

export async function getDatasEntregaAtualizar(_req: Request, res: Response): Promise<void> {
  const r = await listarDatasEntregaAtualizar();
  if (r.erro) {
    res.status(503).json({ error: r.erro });
    return;
  }
  res.json({ pedidos: r.pedidos });
}

/** GET ?q= — pedidos elegíveis fora da janela de 7 dias (busca forçada). */
export async function getDatasEntregaForaJanelaBusca(req: Request, res: Response): Promise<void> {
  const q = String(req.query.q ?? '');
  const r = await buscarDatasEntregaForaJanela(q);
  if (r.erro) {
    res.status(503).json({ error: r.erro });
    return;
  }
  res.json({ pedidos: r.pedidos });
}

/**
 * POST { idPedido } — registra o pin forçado no histórico e devolve o pedido
 * para exibição pontual na tabela (fora da janela de alerta).
 */
export async function postDatasEntregaForcar(req: Request, res: Response): Promise<void> {
  const idPedido = Number((req.body as { idPedido?: unknown } | undefined)?.idPedido);
  const r = await obterPedidoDataEntregaElegivel(idPedido);
  if (!r.pedido) {
    res.status(r.naoEncontrado ? 404 : r.erro === 'Pedido inválido.' ? 400 : 503).json({
      error: r.erro ?? 'Pedido não encontrado.',
    });
    return;
  }
  if (!r.pedido.foraDaJanela) {
    res.status(400).json({
      error:
        'Este pedido já entra no recorte normal (atrasado, sem data ou vencendo em até 7 dias). Use a lista principal.',
    });
    return;
  }

  const usuarioLogin = req.user?.login ?? 'anon';
  try {
    await prisma.materiaisAChegarDataEntregaForcada.create({
      data: {
        idPedidoCompra: r.pedido.idPedido,
        pedido: r.pedido.pedido,
        fornecedor: r.pedido.fornecedor,
        menorDataEntrega: r.pedido.menorDataEntrega,
        menorDias: r.pedido.menorDias,
        usuarioLogin,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[acompanhamentoSolicitacao] postDatasEntregaForcar histórico:', msg);
    res.status(503).json({ error: 'Não foi possível registrar o histórico do pin forçado.' });
    return;
  }

  res.json({ pedido: r.pedido });
}

export async function getDocumentoAcompanhamento(req: Request, res: Response): Promise<void> {
  const tipo = String(req.query.tipo ?? '') as TipoDocumentoAcompanhamento;
  const id = Number(req.query.id);
  const somenteElegiveisDataEntrega = req.query.escopo === 'datas_entrega';
  if (!TIPOS_DOCUMENTO.has(tipo)) {
    res.status(400).json({ error: 'Tipo de documento inválido.' });
    return;
  }
  const r = await obterDocumentoAcompanhamento(tipo, id, somenteElegiveisDataEntrega);
  if (!r.documento) {
    res.status(r.naoEncontrado ? 404 : r.erro === 'Documento inválido.' ? 400 : 503).json({
      error: r.erro ?? 'Documento não encontrado.',
    });
    return;
  }
  res.json(r.documento);
}
