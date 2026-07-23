import type { Request, Response } from 'express';
import {
  buscarPedidosGerenciadorTypeahead,
  consultarEstoque,
  contarConsultaEstoque,
  filtrosConsultaTemAlgum,
  listarCotacaoDetalhePorProduto,
  buscarOpcoesFiltroCampo,
  listarOpcoesFiltroCascata,
  listarOpcoesFiltroConsultaEstoque,
  listarPcPendDetalhesPorProduto,
  listarSaldoDetalhePorProduto,
  listarScDetalhePorProduto,
  validarFiltrosPedidoConsultaEstoque,
  type EmpenhoEscopoConsultaEstoque,
  type FiltroSimNaoTodos,
  type FiltrosConsultaEstoque,
  type ModoPedidoConsultaEstoque,
} from '../data/consultaEstoqueRepository.js';

function parseStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.map((x) => String(x).trim()).filter(Boolean);
}

function parseModoPedido(v: unknown): ModoPedidoConsultaEstoque | undefined {
  if (v === 'diretos' || v === 'componentes') return v;
  return undefined;
}

function parseEmpenhoEscopo(v: unknown): EmpenhoEscopoConsultaEstoque | undefined {
  if (v === 'pedido' || v === 'todos') return v;
  return undefined;
}

function parseSimNaoTodos(v: unknown): FiltroSimNaoTodos | undefined {
  if (v === 'todos' || v === 'sim' || v === 'nao') return v;
  return undefined;
}

function filtrosFromBody(body: unknown): FiltrosConsultaEstoque {
  const b = body != null && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const f = b.filtros != null && typeof b.filtros === 'object' ? (b.filtros as Record<string, unknown>) : b;
  const idPedidoRaw = f.idPedido;
  const idPedido =
    idPedidoRaw != null && Number.isFinite(Number(idPedidoRaw)) && Number(idPedidoRaw) > 0
      ? Number(idPedidoRaw)
      : undefined;
  return {
    codigos: parseStringArray(f.codigos),
    descricoes: parseStringArray(f.descricoes),
    tipos: parseStringArray(f.tipos),
    grupos: parseStringArray(f.grupos),
    coletas: parseStringArray(f.coletas),
    setoresProducao: parseStringArray(f.setoresProducao),
    subgrupo1: parseStringArray(f.subgrupo1),
    subgrupo2: parseStringArray(f.subgrupo2),
    idPedido,
    modoPedido: parseModoPedido(f.modoPedido),
    empenhoEscopo: parseEmpenhoEscopo(f.empenhoEscopo),
    comEmpenho: parseSimNaoTodos(f.comEmpenho),
    comSaldoEstoque: parseSimNaoTodos(f.comSaldoEstoque),
  };
}

function parseIdProduto(req: Request): number | null {
  const id = Number(req.query.idProduto);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
}

export async function getOpcoesFiltroConsultaEstoque(_req: Request, res: Response): Promise<void> {
  const { data, erro } = await listarOpcoesFiltroConsultaEstoque();
  if (erro) {
    res.status(503).json({ error: erro, ...data });
    return;
  }
  res.json(data);
}

export async function postOpcoesFiltroCascata(req: Request, res: Response): Promise<void> {
  const filtros = filtrosFromBody(req.body);
  const { data, erro } = await listarOpcoesFiltroCascata(filtros);
  if (erro) {
    res.status(503).json({ error: erro, ...data });
    return;
  }
  res.json(data);
}

export async function getBuscarOpcoesFiltro(req: Request, res: Response): Promise<void> {
  const campo = req.query.campo === 'descricao' ? 'descricao' : 'codigo';
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const filtros: FiltrosConsultaEstoque = {
    codigos: parseCommaQuery(req.query.codigos),
    descricoes: parseCommaQuery(req.query.descricoes),
    tipos: parseCommaQuery(req.query.tipos),
    grupos: parseCommaQuery(req.query.grupos),
    coletas: parseCommaQuery(req.query.coletas),
    setoresProducao: parseCommaQuery(req.query.setoresProducao),
    subgrupo1: parseCommaQuery(req.query.subgrupo1),
    subgrupo2: parseCommaQuery(req.query.subgrupo2),
  };
  const { data, erro } = await buscarOpcoesFiltroCampo(campo, q, filtros);
  if (erro) {
    res.status(503).json({ error: erro, data: [] });
    return;
  }
  res.json({ data });
}

function parseCommaQuery(v: unknown): string[] | undefined {
  if (typeof v !== 'string' || !v.trim()) return undefined;
  return v.split('|').map((s) => s.trim()).filter(Boolean);
}

export async function getBuscarPedidosGerenciadorTypeahead(req: Request, res: Response): Promise<void> {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const { data, erro } = await buscarPedidosGerenciadorTypeahead(q);
  if (erro) {
    res.status(503).json({ error: erro, data: [] });
    return;
  }
  res.json({ data });
}

export async function postContarConsultaEstoque(req: Request, res: Response): Promise<void> {
  const filtros = filtrosFromBody(req.body);
  if (!filtrosConsultaTemAlgum(filtros)) {
    res.status(400).json({ error: 'Informe ao menos um filtro.', total: 0 });
    return;
  }
  const erroPedido = validarFiltrosPedidoConsultaEstoque(filtros);
  if (erroPedido) {
    res.status(400).json({ error: erroPedido, total: 0 });
    return;
  }

  const { total, erro } = await contarConsultaEstoque(filtros);
  if (erro) {
    res.status(503).json({ error: erro, total: 0 });
    return;
  }
  res.json({ total });
}

export async function postConsultarEstoque(req: Request, res: Response): Promise<void> {
  const body = req.body;
  const filtros = filtrosFromBody(body);
  if (!filtrosConsultaTemAlgum(filtros)) {
    res.status(400).json({
      error: 'Informe ao menos um filtro.',
      data: [],
      total: 0,
    });
    return;
  }
  const erroPedido = validarFiltrosPedidoConsultaEstoque(filtros);
  if (erroPedido) {
    res.status(400).json({
      error: erroPedido,
      data: [],
      total: 0,
    });
    return;
  }
  const considerarRequisicoes =
    body != null &&
    typeof body === 'object' &&
    (body as Record<string, unknown>).considerarRequisicoes === true;

  const { data, total, erro } = await consultarEstoque({
    filtros,
    considerarRequisicoes,
  });

  if (erro) {
    res.status(503).json({ error: erro, data: [], total: 0 });
    return;
  }

  res.json({ data, total });
}

export async function getSaldoDetalheConsultaEstoque(req: Request, res: Response): Promise<void> {
  const idProduto = parseIdProduto(req);
  if (idProduto == null) {
    res.status(400).json({ error: 'Parâmetro idProduto inválido.', data: [] });
    return;
  }
  const { data, erro } = await listarSaldoDetalhePorProduto(idProduto);
  if (erro) {
    res.status(503).json({ error: erro, data: [] });
    return;
  }
  res.json({ data });
}

export async function getScDetalheConsultaEstoque(req: Request, res: Response): Promise<void> {
  const idProduto = parseIdProduto(req);
  if (idProduto == null) {
    res.status(400).json({ error: 'Parâmetro idProduto inválido.', data: [] });
    return;
  }
  const { data, erro } = await listarScDetalhePorProduto(idProduto);
  if (erro) {
    res.status(503).json({ error: erro, data: [] });
    return;
  }
  res.json({ data });
}

export async function getCotacaoDetalheConsultaEstoque(req: Request, res: Response): Promise<void> {
  const idProduto = parseIdProduto(req);
  if (idProduto == null) {
    res.status(400).json({ error: 'Parâmetro idProduto inválido.', data: [] });
    return;
  }
  const { data, erro } = await listarCotacaoDetalhePorProduto(idProduto);
  if (erro) {
    res.status(503).json({ error: erro, data: [] });
    return;
  }
  res.json({ data });
}

export async function getPcDetalheConsultaEstoque(req: Request, res: Response): Promise<void> {
  const idProduto = parseIdProduto(req);
  if (idProduto == null) {
    res.status(400).json({ error: 'Parâmetro idProduto inválido.', data: [] });
    return;
  }
  const { data, erro } = await listarPcPendDetalhesPorProduto(idProduto);
  if (erro) {
    res.status(503).json({ error: erro, data: [] });
    return;
  }
  res.json({ data });
}
