import type { Request, Response } from 'express';
import {
  listarPainelComercialVendasDetalhe,
  obterPainelComercialVendasAnalytics,
  obterPainelComercialVendasDrill,
  type DrillContexto,
  type FiltrosPainelComercialVendas,
} from '../data/painelComercialVendasRepository.js';
import {
  obterHistoricoVendasAnalytics,
  obterHistoricoVendasDrill,
  obterHistoricoVendasSerieFatia,
  type DrillContexto as HistoricoDrillContexto,
  type FiltrosHistoricoVendas,
} from '../data/historicoVendasRepository.js';
import { obterRfvClientesAnalytics, type FiltrosRfvClientes } from '../data/rfvClientesRepository.js';
import {
  listarPessoasComissionamento,
  listarComissionamentoDetalhe,
  listarClientesInativosComissionamento,
  montarMensagemClientesInativos,
  obterWhatsappDestinoInativos,
  salvarWhatsappDestinoInativos,
  obterComissionamentoAnalytics,
  obterComissionamentoComparativo,
  obterComissionamentoDrill,
  obterClassificacaoEquipes,
  salvarClassificacaoEquipes,
  type ClassificacaoEquipesMap,
  type DrillDimComissionamento,
  type EquipeComissionamento,
  type FiltrosComissionamento,
} from '../data/comissionamentoRepository.js';
import { sendWhatsAppTextToLong } from '../services/evolutionApi.js';
import { normalizarDestinoEnvioWhatsApp } from '../utils/whatsappDestino.js';

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

function parseFiltrosHistorico(req: Request): FiltrosHistoricoVendas {
  return parseFiltros(req) as FiltrosHistoricoVendas;
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

function parseCtxHistorico(req: Request): HistoricoDrillContexto {
  return parseCtx(req) as HistoricoDrillContexto;
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

export async function getHistoricoVendasAnalytics(req: Request, res: Response): Promise<void> {
  try {
    const filtros = parseFiltrosHistorico(req);
    const data = await obterHistoricoVendasAnalytics(filtros);
    res.json(data);
  } catch (err) {
    console.error('getHistoricoVendasAnalytics', err);
    res.status(503).json({ error: 'Serviço temporariamente indisponível.' });
  }
}

export async function getHistoricoVendasDrill(req: Request, res: Response): Promise<void> {
  try {
    const filtros = parseFiltrosHistorico(req);
    const ctx = parseCtxHistorico(req);
    const data = await obterHistoricoVendasDrill(filtros, ctx);
    res.json({ items: data });
  } catch (err) {
    console.error('getHistoricoVendasDrill', err);
    res.status(503).json({ error: 'Serviço temporariamente indisponível.' });
  }
}

export async function getHistoricoVendasSerieFatia(req: Request, res: Response): Promise<void> {
  try {
    const filtros = parseFiltrosHistorico(req);
    const ctx = parseCtxHistorico(req);
    const data = await obterHistoricoVendasSerieFatia(filtros, { where: ctx.where });
    if (data.erro) {
      res.status(400).json({ error: data.erro, serieMensal: [] });
      return;
    }
    res.json({ serieMensal: data.serieMensal });
  } catch (err) {
    console.error('getHistoricoVendasSerieFatia', err);
    res.status(503).json({ error: 'Serviço temporariamente indisponível.' });
  }
}

export async function getRfvClientesAnalytics(req: Request, res: Response): Promise<void> {
  try {
    const filtros = parseFiltrosHistorico(req) as FiltrosRfvClientes;
    const data = await obterRfvClientesAnalytics(filtros);
    res.json(data);
  } catch (err) {
    console.error('getRfvClientesAnalytics', err);
    res.status(503).json({ error: 'Serviço temporariamente indisponível.' });
  }
}

function parseFiltrosComissionamento(req: Request): FiltrosComissionamento {
  return {
    dataIni: getStrQuery(req, 'dataIni') ?? '',
    dataFim: getStrQuery(req, 'dataFim') ?? '',
    comparacaoBase:
      (getStrQuery(req, 'comparacaoBase') as FiltrosComissionamento['comparacaoBase']) ?? undefined,
    grupoProduto: getStrQuery(req, 'grupoProduto'),
    vendedor: getStrQuery(req, 'vendedor'),
    equipe: getStrQuery(req, 'equipe') as EquipeComissionamento | undefined,
    status: getStrQuery(req, 'status'),
    cliente: getStrQuery(req, 'cliente'),
    produto: getStrQuery(req, 'produto'),
  };
}

export async function getComissionamentoAnalytics(req: Request, res: Response): Promise<void> {
  try {
    const data = await obterComissionamentoAnalytics(parseFiltrosComissionamento(req));
    res.json(data);
  } catch (err) {
    console.error('getComissionamentoAnalytics', err);
    res.status(503).json({ error: 'Serviço temporariamente indisponível.' });
  }
}

export async function getComissionamentoDrill(req: Request, res: Response): Promise<void> {
  try {
    const filtros = parseFiltrosComissionamento(req);
    const dim = (getStrQuery(req, 'dim') as DrillDimComissionamento) ?? 'vendedor';
    const where: Partial<{
      mes: string;
      grupoProduto: string;
      vendedor: string;
      equipe: EquipeComissionamento;
      status: string;
      cliente: string;
    }> = {};
    const mes = getStrQuery(req, 'mes');
    if (mes) where.mes = mes;
    const grupoProduto = getStrQuery(req, 'grupoProduto');
    if (grupoProduto) where.grupoProduto = grupoProduto;
    const vendedor = getStrQuery(req, 'vendedor');
    if (vendedor) where.vendedor = vendedor;
    const equipe = getStrQuery(req, 'equipe') as EquipeComissionamento | undefined;
    if (equipe) where.equipe = equipe;
    const status = getStrQuery(req, 'status');
    if (status) where.status = status;
    const cliente = getStrQuery(req, 'cliente');
    if (cliente) where.cliente = cliente;
    const items = await obterComissionamentoDrill(filtros, dim, where);
    res.json({ items });
  } catch (err) {
    console.error('getComissionamentoDrill', err);
    res.status(503).json({ error: 'Serviço temporariamente indisponível.' });
  }
}

export async function getComissionamentoDetalhe(req: Request, res: Response): Promise<void> {
  try {
    const filtros = parseFiltrosComissionamento(req);
    const where: Partial<{
      mes: string;
      grupoProduto: string;
      vendedor: string;
      equipe: string;
      status: string;
      cliente: string;
      produto: string;
    }> = {};
    const mes = getStrQuery(req, 'mes');
    if (mes) where.mes = mes;
    const grupoProduto = getStrQuery(req, 'grupoProduto');
    if (grupoProduto) where.grupoProduto = grupoProduto;
    const vendedor = getStrQuery(req, 'vendedor');
    if (vendedor) where.vendedor = vendedor;
    const equipe = getStrQuery(req, 'equipe');
    if (equipe) where.equipe = equipe;
    const status = getStrQuery(req, 'status');
    if (status) where.status = status;
    const cliente = getStrQuery(req, 'cliente');
    if (cliente) where.cliente = cliente;
    const produto = getStrQuery(req, 'produto');
    if (produto) where.produto = produto;
    const data = await listarComissionamentoDetalhe(filtros, where);
    res.json(data);
  } catch (err) {
    console.error('getComissionamentoDetalhe', err);
    res.status(503).json({ error: 'Serviço temporariamente indisponível.', rows: [], truncado: false });
  }
}

export async function getComissionamentoComparativo(req: Request, res: Response): Promise<void> {
  try {
    const filtros = parseFiltrosComissionamento(req);
    const raw = getStrQuery(req, 'vendedores') ?? '';
    const vendedores = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const data = await obterComissionamentoComparativo(filtros, vendedores);
    res.json(data);
  } catch (err) {
    console.error('getComissionamentoComparativo', err);
    res.status(503).json({ error: 'Serviço temporariamente indisponível.', items: [], meses: [] });
  }
}

export async function getComissionamentoClassificacao(req: Request, res: Response): Promise<void> {
  try {
    const filtros = parseFiltrosComissionamento(req);
    if (filtros.dataIni && filtros.dataFim) {
      const data = await listarPessoasComissionamento(filtros);
      res.json(data);
      return;
    }
    const classificacao = await obterClassificacaoEquipes();
    res.json({ pessoas: [], classificacao });
  } catch (err) {
    console.error('getComissionamentoClassificacao', err);
    res.status(503).json({ error: 'Serviço temporariamente indisponível.' });
  }
}

export async function putComissionamentoClassificacao(req: Request, res: Response): Promise<void> {
  try {
    let raw = req.body ?? {};
    // Compat: se o client mandou JSON stringificado 2x, parseia.
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw) as unknown;
      } catch {
        res.status(400).json({ error: 'Body inválido.' });
        return;
      }
    }
    const body = (raw ?? {}) as { classificacao?: ClassificacaoEquipesMap };
    if (!body.classificacao || typeof body.classificacao !== 'object' || Array.isArray(body.classificacao)) {
      res.status(400).json({ error: 'Informe classificacao (objeto nome → equipe).' });
      return;
    }
    const saved = await salvarClassificacaoEquipes(body.classificacao);
    res.json({ classificacao: saved });
  } catch (err) {
    console.error('putComissionamentoClassificacao', err);
    res.status(503).json({ error: 'Serviço temporariamente indisponível.' });
  }
}

export async function getComissionamentoClientesInativos(req: Request, res: Response): Promise<void> {
  try {
    const data = await listarClientesInativosComissionamento(parseFiltrosComissionamento(req));
    res.json(data);
  } catch (err) {
    console.error('getComissionamentoClientesInativos', err);
    res.status(503).json({
      error: 'Serviço temporariamente indisponível.',
      clientes: [],
      total: 0,
    });
  }
}

export async function getComissionamentoInativosWhatsapp(req: Request, res: Response): Promise<void> {
  try {
    const numero = await obterWhatsappDestinoInativos();
    res.json({ numero });
  } catch (err) {
    console.error('getComissionamentoInativosWhatsapp', err);
    res.status(503).json({ error: 'Serviço temporariamente indisponível.', numero: '' });
  }
}

export async function putComissionamentoInativosWhatsapp(req: Request, res: Response): Promise<void> {
  try {
    let raw = req.body ?? {};
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw) as unknown;
      } catch {
        res.status(400).json({ error: 'Body inválido.' });
        return;
      }
    }
    const numero = String((raw as { numero?: string })?.numero ?? '').trim();
    if (numero && !normalizarDestinoEnvioWhatsApp(numero)) {
      res.status(400).json({ error: 'Número WhatsApp inválido (use DDD+número ou JID de grupo).' });
      return;
    }
    const saved = await salvarWhatsappDestinoInativos(numero);
    res.json({ numero: saved });
  } catch (err) {
    console.error('putComissionamentoInativosWhatsapp', err);
    res.status(503).json({ error: 'Serviço temporariamente indisponível.' });
  }
}

export async function postComissionamentoInativosWhatsapp(req: Request, res: Response): Promise<void> {
  try {
    let raw = req.body ?? {};
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw) as unknown;
      } catch {
        res.status(400).json({ error: 'Body inválido.' });
        return;
      }
    }
    const body = (raw ?? {}) as { numero?: string };
    const filtros = parseFiltrosComissionamento(req);
    const data = await listarClientesInativosComissionamento(filtros);
    if (data.erro) {
      res.status(400).json({ error: data.erro });
      return;
    }
    if (data.clientes.length === 0) {
      res.status(400).json({ error: 'Nenhum cliente inativo para enviar.' });
      return;
    }

    const numero =
      String(body.numero ?? '').trim() || (await obterWhatsappDestinoInativos());
    if (!numero) {
      res.status(400).json({ error: 'Informe o número WhatsApp de destino.' });
      return;
    }
    if (!normalizarDestinoEnvioWhatsApp(numero)) {
      res.status(400).json({ error: 'Número WhatsApp inválido.' });
      return;
    }

    await salvarWhatsappDestinoInativos(numero);
    const mensagem = montarMensagemClientesInativos(data.clientes, {
      referencia: data.referencia,
      dataIniAnalise: data.dataIniAnalise,
      diasSemCompraMin: data.diasSemCompraMin,
    });
    const send = await sendWhatsAppTextToLong(numero, mensagem);
    if (!send.ok) {
      res.status(502).json({ error: send.error ?? 'Falha ao enviar WhatsApp.', enviado: false });
      return;
    }
    res.json({
      ok: true,
      enviado: true,
      dryRun: Boolean(send.dryRun),
      numero,
      total: data.total,
    });
  } catch (err) {
    console.error('postComissionamentoInativosWhatsapp', err);
    res.status(503).json({ error: 'Serviço temporariamente indisponível.' });
  }
}


