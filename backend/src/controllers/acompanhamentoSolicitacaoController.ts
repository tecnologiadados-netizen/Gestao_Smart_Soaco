import type { Request, Response } from 'express';
import {
  listarDetalheAcompanhamento,
  listarPipelineAcompanhamento,
  type EtapaAcompanhamento,
} from '../data/acompanhamentoSolicitacaoRepository.js';

const ETAPAS = new Set<EtapaAcompanhamento>(['solicitado', 'comprado', 'pre_entrada']);

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
