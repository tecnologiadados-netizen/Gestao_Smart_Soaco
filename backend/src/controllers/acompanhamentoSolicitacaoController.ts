import type { Request, Response } from 'express';
import {
  listarDatasEntregaAtualizar,
  listarDetalheAcompanhamento,
  listarPipelineAcompanhamento,
  obterDocumentoAcompanhamento,
  type EtapaAcompanhamento,
  type TipoDocumentoAcompanhamento,
} from '../data/acompanhamentoSolicitacaoRepository.js';

const ETAPAS = new Set<EtapaAcompanhamento>(['solicitado', 'comprado', 'pre_entrada']);
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

export async function getDocumentoAcompanhamento(req: Request, res: Response): Promise<void> {
  const tipo = String(req.query.tipo ?? '') as TipoDocumentoAcompanhamento;
  const id = Number(req.query.id);
  if (!TIPOS_DOCUMENTO.has(tipo)) {
    res.status(400).json({ error: 'Tipo de documento inválido.' });
    return;
  }
  const r = await obterDocumentoAcompanhamento(tipo, id);
  if (!r.documento) {
    res.status(r.naoEncontrado ? 404 : r.erro === 'Documento inválido.' ? 400 : 503).json({
      error: r.erro ?? 'Documento não encontrado.',
    });
    return;
  }
  res.json(r.documento);
}
