import type { Request, Response } from 'express';
import {
  validarFiltrosPedidoConsultaEstoque,
  type EmpenhoEscopoConsultaEstoque,
  type FiltroSimNaoTodos,
  type FiltrosConsultaEstoque,
  type ModoPedidoConsultaEstoque,
} from '../data/consultaEstoqueRepository.js';
import { consultarPainelCoberturaEstoque, consultarNomesFamiliaProduto } from '../data/coberturaEstoqueRepository.js';
import {
  STATUS_COBERTURA_ORDEM,
  type StatusCoberturaEstoque,
} from '../data/coberturaEstoqueStatus.js';

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
    familias: parseStringArray(f.familias),
    idPedido,
    modoPedido: parseModoPedido(f.modoPedido),
    empenhoEscopo: parseEmpenhoEscopo(f.empenhoEscopo),
    comEmpenho: parseSimNaoTodos(f.comEmpenho),
    comSaldoEstoque: parseSimNaoTodos(f.comSaldoEstoque),
    somenteAlmoxSecundario: f.somenteAlmoxSecundario === true,
  };
}

function parseStatus(v: unknown): StatusCoberturaEstoque | null {
  if (typeof v !== 'string') return null;
  return (STATUS_COBERTURA_ORDEM as string[]).includes(v) ? (v as StatusCoberturaEstoque) : null;
}

export async function postPainelCoberturaEstoque(req: Request, res: Response): Promise<void> {
  const body = req.body;
  const filtros = filtrosFromBody(body);
  const erroPedido = validarFiltrosPedidoConsultaEstoque(filtros);
  if (erroPedido) {
    res.status(400).json({ error: erroPedido, data: null });
    return;
  }

  const considerarRequisicoes =
    body != null &&
    typeof body === 'object' &&
    (body as Record<string, unknown>).considerarRequisicoes === true;

  const statusRaw =
    body != null && typeof body === 'object'
      ? (body as Record<string, unknown>).status
      : undefined;
  const status = parseStatus(statusRaw);

  const topNRaw =
    body != null && typeof body === 'object' ? Number((body as Record<string, unknown>).topN) : NaN;
  const topN = Number.isFinite(topNRaw) && topNRaw > 0 ? Math.min(50, Math.floor(topNRaw)) : 15;

  const { data, erro } = await consultarPainelCoberturaEstoque({
    filtros,
    considerarRequisicoes,
    status,
    topN,
  });

  if (erro) {
    res.status(503).json({ error: erro, data: null });
    return;
  }

  res.json({ data });
}

export async function getFamiliasCoberturaEstoque(_req: Request, res: Response): Promise<void> {
  const { data, erro } = await consultarNomesFamiliaProduto();
  if (erro && data.length === 0) {
    res.status(503).json({ error: erro, data: [] });
    return;
  }
  res.json({ data });
}
