import type { Request, Response } from 'express';
import {
  listarPainelComercialVendasDetalhe,
  obterPainelComercialVendasAnalytics,
  obterPainelComercialVendasDrill,
  type DrillContexto,
  type FiltrosPainelComercialVendas,
} from '../data/painelComercialVendasRepository.js';

function getStrQuery(req: Request, key: string): string | undefined {
  const v = req.query[key];
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return s ? s : undefined;
}

function parseFiltros(req: Request): FiltrosPainelComercialVendas {
  return {
    dataIni: getStrQuery(req, 'dataIni') ?? '',
    dataFim: getStrQuery(req, 'dataFim') ?? '',
    comparacaoBase: (getStrQuery(req, 'comparacaoBase') as FiltrosPainelComercialVendas['comparacaoBase']) ?? undefined,
    grupoProduto: getStrQuery(req, 'grupoProduto'),
    subgrupo1: getStrQuery(req, 'subgrupo1'),
    subgrupo2: getStrQuery(req, 'subgrupo2'),
    vendedor: getStrQuery(req, 'vendedor'),
    regiao: getStrQuery(req, 'regiao'),
    uf: getStrQuery(req, 'uf'),
    municipio: getStrQuery(req, 'municipio'),
    cliente: getStrQuery(req, 'cliente'),
    produto: getStrQuery(req, 'produto'),
    pd: getStrQuery(req, 'pd'),
  };
}

function parseCtx(req: Request): DrillContexto {
  const dim = (getStrQuery(req, 'dim') as DrillContexto['dim']) ?? 'grupo';
  const where: DrillContexto['where'] = {};

  const mes = getStrQuery(req, 'mes');
  if (mes) where.mes = mes as any;
  const grupoProduto = getStrQuery(req, 'grupoProduto');
  if (grupoProduto) where.grupoProduto = grupoProduto as any;
  const subgrupo1 = getStrQuery(req, 'subgrupo1');
  if (subgrupo1) where.subgrupo1 = subgrupo1 as any;
  const subgrupo2 = getStrQuery(req, 'subgrupo2');
  if (subgrupo2) where.subgrupo2 = subgrupo2 as any;
  const vendedor = getStrQuery(req, 'vendedor');
  if (vendedor) where.vendedor = vendedor as any;
  const regiao = getStrQuery(req, 'regiao');
  if (regiao) where.regiao = regiao as any;
  const uf = getStrQuery(req, 'uf');
  if (uf) where.uf = uf as any;
  const municipio = getStrQuery(req, 'municipio');
  if (municipio) where.municipio = municipio as any;
  const codigoProduto = getStrQuery(req, 'codigoProduto');
  if (codigoProduto) where.codigoProduto = codigoProduto as any;
  const cliente = getStrQuery(req, 'cliente');
  if (cliente) where.cliente = cliente as any;
  const pdCodigo = getStrQuery(req, 'pd');
  if (pdCodigo) where.pdCodigo = pdCodigo as any;

  return { dim, where: Object.keys(where).length ? where : undefined };
}

export async function getPainelComercialVendasAnalytics(req: Request, res: Response): Promise<void> {
  try {
    const filtros = parseFiltros(req);
    const data = await obterPainelComercialVendasAnalytics(filtros);
    res.json(data);
  } catch (err) {
    console.error('getPainelComercialVendasAnalytics', err);
    res.status(503).json({ error: 'Serviço temporariamente indisponível.' });
  }
}

export async function getPainelComercialVendasDrill(req: Request, res: Response): Promise<void> {
  try {
    const filtros = parseFiltros(req);
    const ctx = parseCtx(req);
    const data = await obterPainelComercialVendasDrill(filtros, ctx);
    res.json({ items: data });
  } catch (err) {
    console.error('getPainelComercialVendasDrill', err);
    res.status(503).json({ error: 'Serviço temporariamente indisponível.' });
  }
}

export async function getPainelComercialVendasDetalhe(req: Request, res: Response): Promise<void> {
  try {
    const filtros = parseFiltros(req);
    const ctx = parseCtx(req);
    const data = await listarPainelComercialVendasDetalhe(filtros, ctx);
    if (data.erro) {
      res.status(503).json({ error: data.erro });
      return;
    }
    res.json({ rows: data.rows });
  } catch (err) {
    console.error('getPainelComercialVendasDetalhe', err);
    res.status(503).json({ error: 'Serviço temporariamente indisponível.' });
  }
}

