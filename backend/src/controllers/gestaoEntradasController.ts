/**
 * GET /api/compras/gestao-entradas?dataInicio=&dataFim=
 * Painel KPI de acuracidade das entradas (NF × pedido de compra).
 */

import type { Request, Response } from 'express';
import {
  queryGestaoEntradasComprador,
  queryGestaoEntradasDia,
  queryGestaoEntradasPainel,
} from '../data/gestaoEntradasRepository.js';
import { queryConferenciaFisicaDetalhe, queryConferenciaFisicaPainel } from '../data/gestaoEntradasConferenciaFisicaRepository.js';
import type { RecorteConferenciaFisica } from '../data/gestaoEntradasConferenciaFisica.js';
import type { MundoCompradorGestao } from '../data/gestaoEntradasComprador.js';
import { normalizarEscopoDivergencia } from '../data/gestaoEntradasClassificacao.js';
import { responderResumoHistoricoConferencia } from './recebimentoController.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseYmd(v: unknown): string | null {
  const s = String(v ?? '').trim().slice(0, 10);
  return DATE_RE.test(s) ? s : null;
}

export async function getGestaoEntradasPainel(req: Request, res: Response): Promise<void> {
  const dataInicio = parseYmd(req.query.dataInicio);
  const dataFim = parseYmd(req.query.dataFim);
  if (!dataInicio || !dataFim) {
    res.status(400).json({ error: 'Informe dataInicio e dataFim (YYYY-MM-DD).' });
    return;
  }
  if (dataFim < dataInicio) {
    res.status(400).json({ error: 'dataFim deve ser >= dataInicio.' });
    return;
  }

  const { data, erro } = await queryGestaoEntradasPainel({
    dataInicio,
    dataFim,
    escopo: normalizarEscopoDivergencia(req.query.escopo),
  });
  if (erro || !data) {
    res.status(503).json({ error: erro ?? 'Falha ao montar o painel Gestão entradas.', erro });
    return;
  }
  res.json(data);
}

export async function getGestaoEntradasComprador(req: Request, res: Response): Promise<void> {
  const dataInicio = parseYmd(req.query.dataInicio);
  const dataFim = parseYmd(req.query.dataFim);
  const mundo = String(req.query.mundo ?? '').trim();
  const comprador = String(req.query.comprador ?? '').trim();
  if (!dataInicio || !dataFim) {
    res.status(400).json({ error: 'Informe dataInicio e dataFim (YYYY-MM-DD).' });
    return;
  }
  if (dataFim < dataInicio) {
    res.status(400).json({ error: 'dataFim deve ser >= dataInicio.' });
    return;
  }
  if (mundo !== 'apontada' && mundo !== 'aceita') {
    res.status(400).json({ error: 'mundo deve ser apontada ou aceita.' });
    return;
  }
  if (!comprador) {
    res.status(400).json({ error: 'Informe o comprador.' });
    return;
  }
  const { data, erro } = await queryGestaoEntradasComprador({
    dataInicio,
    dataFim,
    escopo: normalizarEscopoDivergencia(req.query.escopo),
    mundo: mundo as MundoCompradorGestao,
    comprador,
  });
  if (erro || !data) {
    res.status(503).json({ error: erro ?? 'Falha ao carregar as divergências do comprador.', erro });
    return;
  }
  res.json(data);
}

const RECORTES_FISICA = new Set([
  'destinacoes',
  'finalizadas',
  'divergencia',
  'divergencia_primeira',
  'divergencia_segunda',
  'sem_divergencia',
  'leadtime',
  'dia',
  'conferente',
]);

function recorteFisico(req: Request): RecorteConferenciaFisica | { erro: string } {
  const tipo = String(req.query.recorte ?? '').trim();
  if (!RECORTES_FISICA.has(tipo)) {
    return { erro: 'recorte inválido.' };
  }
  if (tipo === 'dia') {
    const dia = String(req.query.dia ?? '').trim();
    if (!/^\d{4}-\d{2}(-\d{2})?$/.test(dia)) {
      return { erro: 'Informe dia (YYYY-MM-DD ou YYYY-MM).' };
    }
    return { tipo: 'dia', dia };
  }
  if (tipo === 'conferente') {
    const nome = String(req.query.conferente ?? '').trim();
    if (!nome) return { erro: 'Informe o conferente.' };
    return { tipo: 'conferente', nome };
  }
  return { tipo } as RecorteConferenciaFisica;
}

export async function getConferenciaFisicaPainel(req: Request, res: Response): Promise<void> {
  const dataInicio = parseYmd(req.query.dataInicio);
  const dataFim = parseYmd(req.query.dataFim);
  if (!dataInicio || !dataFim) {
    res.status(400).json({ error: 'Informe dataInicio e dataFim (YYYY-MM-DD).' });
    return;
  }
  if (dataFim < dataInicio) {
    res.status(400).json({ error: 'dataFim deve ser >= dataInicio.' });
    return;
  }
  const { data, erro } = await queryConferenciaFisicaPainel({ dataInicio, dataFim });
  if (erro || !data) {
    res.status(503).json({ error: erro ?? 'Falha ao montar a conferência física.', erro });
    return;
  }
  res.json(data);
}

export async function getConferenciaFisicaDetalhe(req: Request, res: Response): Promise<void> {
  const dataInicio = parseYmd(req.query.dataInicio);
  const dataFim = parseYmd(req.query.dataFim);
  if (!dataInicio || !dataFim) {
    res.status(400).json({ error: 'Informe dataInicio e dataFim (YYYY-MM-DD).' });
    return;
  }
  if (dataFim < dataInicio) {
    res.status(400).json({ error: 'dataFim deve ser >= dataInicio.' });
    return;
  }
  const recorte = recorteFisico(req);
  if ('erro' in recorte) {
    res.status(400).json({ error: recorte.erro });
    return;
  }
  const { data, erro } = await queryConferenciaFisicaDetalhe({ dataInicio, dataFim, recorte });
  if (erro || !data) {
    res.status(503).json({ error: erro ?? 'Falha ao carregar as voltas da conferência física.', erro });
    return;
  }
  res.json(data);
}

export async function getConferenciaFisicaDocumento(req: Request, res: Response): Promise<void> {
  const idDocumento = Math.trunc(Number(req.params.id));
  if (!Number.isFinite(idDocumento) || idDocumento <= 0) {
    res.status(400).json({ error: 'idDocumento inválido.' });
    return;
  }
  await responderResumoHistoricoConferencia(res, idDocumento, { incluirVoltaAberta: true });
}

export async function getGestaoEntradasDia(req: Request, res: Response): Promise<void> {
  const dataInicio = parseYmd(req.query.dataInicio);
  const dataFim = parseYmd(req.query.dataFim);
  if (!dataInicio || !dataFim) {
    res.status(400).json({ error: 'Informe dataInicio e dataFim (YYYY-MM-DD).' });
    return;
  }
  if (dataFim < dataInicio) {
    res.status(400).json({ error: 'dataFim deve ser >= dataInicio.' });
    return;
  }
  const { data, erro } = await queryGestaoEntradasDia({
    dataInicio,
    dataFim,
    escopo: normalizarEscopoDivergencia(req.query.escopo),
  });
  if (erro || !data) {
    res.status(503).json({ error: erro ?? 'Falha ao carregar as entradas do período.', erro });
    return;
  }
  res.json(data);
}
