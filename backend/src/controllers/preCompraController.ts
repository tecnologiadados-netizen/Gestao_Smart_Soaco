import type { Request, Response } from 'express';
import {
  listarPreCompraCotacoes,
  listarPreCompraSugestoes,
  listarPreCompraFornecedores,
  listarPreCompraContatos,
  buscarDadosPdfPreCompra,
  type CampoSugestaoPreCompra,
} from '../data/preCompraRepository.js';
import { gerarPdfPreCompra } from '../services/preCompraPdfService.js';

const CAMPOS_SUGESTAO = new Set<CampoSugestaoPreCompra>(['cotacao', 'fornecedor', 'comprador', 'produto']);

function parseIntParam(v: unknown, fallback: number, min: number, max: number): number {
  const n = Number(v);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export async function getPreCompraCotacoes(req: Request, res: Response): Promise<void> {
  const page = parseIntParam(req.query.page, 1, 1, 10_000);
  const pageSize = parseIntParam(req.query.page_size, 20, 1, 100);

  const statusRaw = req.query.status;
  const status =
    statusRaw != null && String(statusRaw).trim() !== ''
      ? Number(statusRaw)
      : undefined;

  const result = await listarPreCompraCotacoes(
    {
      cotacao: req.query.cotacao != null ? String(req.query.cotacao) : undefined,
      fornecedor: req.query.fornecedor != null ? String(req.query.fornecedor) : undefined,
      produto: req.query.produto != null ? String(req.query.produto) : undefined,
      comprador: req.query.comprador != null ? String(req.query.comprador) : undefined,
      status: status != null && !Number.isNaN(status) ? status : undefined,
      dataInicio: req.query.data_inicio != null ? String(req.query.data_inicio) : undefined,
      dataFim: req.query.data_fim != null ? String(req.query.data_fim) : undefined,
    },
    page,
    pageSize
  );

  res.json(result);
}

export async function getPreCompraSugestoes(req: Request, res: Response): Promise<void> {
  const campo = String(req.query.campo ?? '');
  if (!CAMPOS_SUGESTAO.has(campo as CampoSugestaoPreCompra)) {
    res.status(400).json({ error: 'Campo de sugestão inválido.' });
    return;
  }

  const q = req.query.q != null ? String(req.query.q) : '';
  const limit = parseIntParam(req.query.limit, 12, 1, 20);

  const sugestoes = await listarPreCompraSugestoes(campo as CampoSugestaoPreCompra, q, limit);
  res.json({ sugestoes });
}

export async function getPreCompraFornecedores(req: Request, res: Response): Promise<void> {
  const nome = decodeURIComponent(String(req.params.nome ?? ''));
  const fornecedores = await listarPreCompraFornecedores(nome);
  if (!fornecedores.length) {
    res.status(404).json({ error: 'Cotação não encontrada ou sem fornecedores.' });
    return;
  }
  res.json({ fornecedores });
}

export async function getPreCompraContatos(req: Request, res: Response): Promise<void> {
  const nome = decodeURIComponent(String(req.params.nome ?? ''));
  const fornecedorId = Number(req.query.fornecedorId ?? req.query.fornecedor_id);
  if (Number.isNaN(fornecedorId)) {
    res.status(400).json({ error: 'fornecedorId é obrigatório.' });
    return;
  }

  const contatos = await listarPreCompraContatos(nome, fornecedorId);
  if (!contatos.length) {
    res.status(404).json({ error: 'Nenhum contato encontrado para este fornecedor.' });
    return;
  }
  res.json({ contatos });
}

export async function getPreCompraPdf(req: Request, res: Response): Promise<void> {
  const nome = decodeURIComponent(String(req.params.nome ?? ''));
  const fornecedorId = Number(req.query.fornecedorId ?? req.query.fornecedor_id);
  const contatoId = Number(req.query.contatoId ?? req.query.contato_id);

  if (Number.isNaN(fornecedorId) || Number.isNaN(contatoId)) {
    res.status(400).json({ error: 'fornecedorId e contatoId são obrigatórios.' });
    return;
  }

  const pdfData = await buscarDadosPdfPreCompra(nome, fornecedorId, contatoId);
  if (!pdfData) {
    res.status(404).json({ error: 'Dados não encontrados para gerar o PDF.' });
    return;
  }

  const pdfBytes = await gerarPdfPreCompra(pdfData);
  const fornecedor = String(pdfData.fornecedor ?? 'fornecedor').slice(0, 30);
  const filename = `Cotacao_${nome}_${fornecedor}.pdf`.replace(/\s+/g, '_');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(pdfBytes);
}
