/**
 * Gestão entradas — leitura das pré-entradas no Nomus e da comunicação Otimiza local.
 */

import { prisma } from '../config/prisma.js';
import { getNomusPool, isNomusEnabled, nomusQueryWithRetry } from '../config/nomusDb.js';
import { formatSqlDateYmd } from './dfcDateUtils.js';
import { listarDocumentosConferidos } from './doubleCheckInLocalRepository.js';
import {
  montarGradePreEntradas,
  montarImpressaoPreEntradas,
  preEntradaNoPeriodo,
  type ApontamentoPedidoPreEntrada,
  type ImpressaoPreEntrada,
  type ItemImpressaoPreEntradaBruto,
  type ComunicacaoOtimizaPreEntrada,
  type DocPreEntradaBruto,
  type GradePreEntrada,
  type PedidoPreEntrada,
  type StatusOtimizaPreEntrada,
  type VinculoPedidoPreEntrada,
} from './gestaoEntradasPreEntrada.js';
import {
  RECEBIMENTO_ID_EMPRESA_SO_ACO,
  RECEBIMENTO_ID_TIPO_PRE_ENTRADA,
} from './recebimentoNomusRepository.js';

const SQL_ATUAIS = `
SELECT
  de.id AS idDocumento,
  MAX(de.numeroDocumentoFiscal) AS numeroDocumentoFiscal,
  MAX(nfe.numero) AS numeroNfe,
  DATE(de.dataEmissao) AS dataEmissao,
  DATE(de.dataEntrada) AS dataEntrada,
  MAX(pe.nome) AS nomeParceiro,
  MAX(uc.nome) AS nomeUsuarioAlteracao,
  tm.id AS idTipoMovimentacao,
  MAX(tm.nome) AS nomeTipo
FROM documentoestoque de
INNER JOIN tipomovimentacao tm ON tm.id = de.idTipoMovimentacao
LEFT JOIN pessoa pe ON pe.id = de.idParceiro
LEFT JOIN usuario uc ON uc.id = de.idUsuario
LEFT JOIN nfe ON nfe.idDocumentoEstoque = de.id
WHERE de.idEmpresaEntrada = ${RECEBIMENTO_ID_EMPRESA_SO_ACO}
  AND de.idTipoMovimentacao = ${RECEBIMENTO_ID_TIPO_PRE_ENTRADA}
GROUP BY de.id, DATE(de.dataEmissao), DATE(de.dataEntrada), tm.id
`.trim();

const SQL_VINCULOS = `
SELECT
  ide.idDocumentoEstoque AS idDocumento,
  pc.id AS idPedido,
  NULLIF(TRIM(pc.nome), '') AS nomePedido
FROM itemdocumentoestoque ide
INNER JOIN documentoestoque de ON de.id = ide.idDocumentoEstoque
INNER JOIN itemdocumentoestoque_itempedidocompra ideipc ON ideipc.idItemDocumentoEstoque = ide.id
INNER JOIN itempedidocompra ipc ON ipc.id = ideipc.idItemPedidoCompra
INNER JOIN pedidocompra pc ON pc.id = ipc.idPedidoCompra
WHERE de.idEmpresaEntrada = ${RECEBIMENTO_ID_EMPRESA_SO_ACO}
  AND ide.discriminador = 'ItemDocumentoEntrada'
  AND ide.idDocumentoEstoque IN (__IDS__)
`.trim();

const SQL_PEDIDO_ITEM = `
SELECT
  ipc.id AS idItemPedido,
  pc.id AS idPedido,
  NULLIF(TRIM(pc.nome), '') AS nomePedido
FROM itempedidocompra ipc
INNER JOIN pedidocompra pc ON pc.id = ipc.idPedidoCompra
WHERE ipc.id IN (__IDS__)
`.trim();

function toInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function idsSql(ids: number[]): string {
  return [...new Set(ids.filter((id) => id > 0))].join(', ');
}

function statusOtimiza(valor: string | null): StatusOtimizaPreEntrada {
  if (valor === 'in_progress' || valor === 'completed' || valor === 'cancelled') return valor;
  return null;
}

function mapDoc(r: Record<string, unknown>): DocPreEntradaBruto | null {
  const idDocumento = toInt(r.idDocumento);
  if (idDocumento <= 0) return null;
  return {
    idDocumento,
    numeroDocumentoFiscal: strOrNull(r.numeroDocumentoFiscal),
    numeroNfe: strOrNull(r.numeroNfe),
    nomeParceiro: strOrNull(r.nomeParceiro),
    dataEmissao: formatSqlDateYmd(r.dataEmissao),
    dataEntrada: formatSqlDateYmd(r.dataEntrada),
    idTipoMovimentacao: toInt(r.idTipoMovimentacao),
    nomeTipo: strOrNull(r.nomeTipo ?? r.tipoMovimentacao),
    usuarioAlteracao: strOrNull(r.nomeUsuarioAlteracao),
  };
}

async function queryAtuais(): Promise<{ docs: DocPreEntradaBruto[]; erro?: string }> {
  if (!isNomusEnabled()) return { docs: [], erro: 'NOMUS_DB_URL não configurado' };
  const pool = getNomusPool();
  if (!pool) return { docs: [], erro: 'NOMUS_DB_URL não configurado' };
  try {
    const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, SQL_ATUAIS);
    const list = Array.isArray(rows) ? rows : [];
    const docs: DocPreEntradaBruto[] = [];
    for (const row of list) {
      const doc = mapDoc(row);
      if (doc) docs.push(doc);
    }
    return { docs };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { docs: [], erro: msg };
  }
}

async function queryVinculos(ids: number[]): Promise<{ vinculos: VinculoPedidoPreEntrada[]; erro?: string }> {
  const partes = chunk([...new Set(ids.filter((id) => id > 0))], 400);
  if (partes.length === 0) return { vinculos: [] };
  if (!isNomusEnabled()) return { vinculos: [], erro: 'NOMUS_DB_URL não configurado' };
  const pool = getNomusPool();
  if (!pool) return { vinculos: [], erro: 'NOMUS_DB_URL não configurado' };
  const vinculos: VinculoPedidoPreEntrada[] = [];
  try {
    for (const parte of partes) {
      const sql = SQL_VINCULOS.replace('__IDS__', idsSql(parte));
      const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, sql);
      const list = Array.isArray(rows) ? rows : [];
      for (const row of list) {
        const idDocumento = toInt(row.idDocumento);
        const idPedido = toInt(row.idPedido);
        if (idDocumento <= 0 || idPedido <= 0) continue;
        vinculos.push({
          idDocumento,
          idPedido,
          nome: strOrNull(row.nomePedido) ?? '',
        });
      }
    }
    return { vinculos };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { vinculos: [], erro: msg };
  }
}

async function queryPedidosPorItem(
  idsItem: number[],
): Promise<{ pedidos: Map<number, PedidoPreEntrada>; erro?: string }> {
  const partes = chunk([...new Set(idsItem.filter((id) => id > 0))], 400);
  const pedidos = new Map<number, PedidoPreEntrada>();
  if (partes.length === 0) return { pedidos };
  if (!isNomusEnabled()) return { pedidos, erro: 'NOMUS_DB_URL não configurado' };
  const pool = getNomusPool();
  if (!pool) return { pedidos, erro: 'NOMUS_DB_URL não configurado' };
  try {
    for (const parte of partes) {
      const sql = SQL_PEDIDO_ITEM.replace('__IDS__', idsSql(parte));
      const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, sql);
      const list = Array.isArray(rows) ? rows : [];
      for (const row of list) {
        const idItemPedido = toInt(row.idItemPedido);
        const idPedido = toInt(row.idPedido);
        if (idItemPedido <= 0 || idPedido <= 0) continue;
        pedidos.set(idItemPedido, {
          idPedido,
          nome: strOrNull(row.nomePedido) ?? '',
        });
      }
    }
    return { pedidos };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { pedidos, erro: msg };
  }
}

async function comunicacoesDe(ids: number[]): Promise<ComunicacaoOtimizaPreEntrada[]> {
  const out: ComunicacaoOtimizaPreEntrada[] = [];
  for (const parte of chunk(ids, 500)) {
    if (parte.length === 0) continue;
    const rows = await prisma.doubleCheckInSolicitacaoOtimiza.findMany({
      where: { idDocumentoEstoque: { in: parte } },
      select: {
        idDocumentoEstoque: true,
        idItemPedidoCompra: true,
        numero: true,
        status: true,
      },
    });
    for (const row of rows) {
      out.push({
        idDocumentoEstoque: row.idDocumentoEstoque,
        idItemPedidoCompra: row.idItemPedidoCompra,
        numero: row.numero,
        status: statusOtimiza(row.status),
      });
    }
  }
  return out;
}

async function apontamentosDe(ids: number[]): Promise<ApontamentoPedidoPreEntrada[]> {
  const out: ApontamentoPedidoPreEntrada[] = [];
  for (const parte of chunk(ids, 500)) {
    if (parte.length === 0) continue;
    const rows = await prisma.doubleCheckInDivergenciaApontada.findMany({
      where: { idDocumentoEstoque: { in: parte } },
      select: {
        idDocumentoEstoque: true,
        idItemPedidoCompra: true,
        idPedidoCompra: true,
        nomePedidoCompra: true,
      },
    });
    for (const row of rows) {
      out.push({
        idDocumentoEstoque: row.idDocumentoEstoque,
        idItemPedidoCompra: row.idItemPedidoCompra,
        idPedidoCompra: row.idPedidoCompra,
        nomePedidoCompra: row.nomePedidoCompra,
      });
    }
  }
  return out;
}

async function conferenciasDe(ids: number[]): Promise<{
  ids: Set<number>;
  usuarios: Map<number, string>;
}> {
  const infos = new Map<number, { usuarioId: number; usuarioLogin: string }>();
  for (const parte of chunk(ids, 500)) {
    if (parte.length === 0) continue;
    const map = await listarDocumentosConferidos(parte);
    for (const [id, info] of map) {
      infos.set(id, { usuarioId: info.usuarioId, usuarioLogin: info.usuarioLogin });
    }
  }
  const idsUsuario = [...new Set([...infos.values()].map((info) => info.usuarioId).filter((id) => id > 0))];
  const nomePorUsuario = new Map<number, string>();
  for (const parte of chunk(idsUsuario, 500)) {
    if (parte.length === 0) continue;
    const rows = await prisma.usuario.findMany({
      where: { id: { in: parte } },
      select: { id: true, nome: true, login: true },
    });
    for (const row of rows) {
      nomePorUsuario.set(row.id, row.nome?.trim() || row.login);
    }
  }
  const usuarios = new Map<number, string>();
  for (const [idDocumento, info] of infos) {
    const nome = nomePorUsuario.get(info.usuarioId)?.trim() || info.usuarioLogin.trim();
    if (nome) usuarios.set(idDocumento, nome);
  }
  return { ids: new Set(infos.keys()), usuarios };
}

export async function queryGestaoEntradasPreEntradas(params: {
  dataInicio: string | null;
  dataFim: string | null;
}): Promise<{ data?: GradePreEntrada; erro?: string }> {
  try {
    const atuais = await queryAtuais();
    if (atuais.erro) return { erro: atuais.erro };

    const idsLista = [...new Set(atuais.docs.map((doc) => doc.idDocumento).filter((id) => id > 0))];
    const comunicacoes = await comunicacoesDe(idsLista);
    const [vinculos, pedidosItem, apontamentos, conferencias] = await Promise.all([
      queryVinculos(idsLista),
      queryPedidosPorItem(comunicacoes.map((item) => item.idItemPedidoCompra)),
      apontamentosDe(idsLista),
      conferenciasDe(idsLista),
    ]);
    if (vinculos.erro) return { erro: vinculos.erro };
    if (pedidosItem.erro) return { erro: pedidosItem.erro };

    const grade = montarGradePreEntradas({
      atuais: atuais.docs,
      comunicacoes,
      vinculos: vinculos.vinculos,
      pedidosPorItem: pedidosItem.pedidos,
      apontamentos,
      idsConferidos: conferencias.ids,
      usuariosConferencia: conferencias.usuarios,
      dataInicio: params.dataInicio,
      dataFim: params.dataFim,
    });
    return { data: grade };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { erro: msg };
  }
}

const SQL_ITENS_IMPRESSAO = `
SELECT
  ide.idDocumentoEstoque AS idDocumento,
  ide.id AS idItem,
  NULLIF(TRIM(p.nome), '') AS codigoProduto,
  NULLIF(TRIM(p.descricao), '') AS descricaoProduto,
  NULLIF(TRIM(um.nome), '') AS unidadeMedida,
  ide.qtde AS qtde,
  pc.id AS idPedido,
  NULLIF(TRIM(pc.nome), '') AS nomePedido,
  CASE
    WHEN ipc.dataEntrega IS NULL THEN NULL
    ELSE DATE_FORMAT(CAST(ipc.dataEntrega AS DATE), '%Y-%m-%d')
  END AS dataEntrega
FROM itemdocumentoestoque ide
INNER JOIN documentoestoque de ON de.id = ide.idDocumentoEstoque
LEFT JOIN produto p ON p.id = ide.idProduto
LEFT JOIN unidademedida um ON um.id = COALESCE(ide.idUnidadeMedida, p.idUnidadeMedida)
LEFT JOIN itemdocumentoestoque_itempedidocompra ideipc ON ideipc.idItemDocumentoEstoque = ide.id
LEFT JOIN itempedidocompra ipc ON ipc.id = ideipc.idItemPedidoCompra
LEFT JOIN pedidocompra pc ON pc.id = ipc.idPedidoCompra
WHERE de.idEmpresaEntrada = ${RECEBIMENTO_ID_EMPRESA_SO_ACO}
  AND ide.discriminador = 'ItemDocumentoEntrada'
  AND ide.idDocumentoEstoque IN (__IDS__)
`.trim();

function qtdeItem(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function queryItensImpressao(ids: number[]): Promise<{ itens: ItemImpressaoPreEntradaBruto[]; erro?: string }> {
  const partes = chunk([...new Set(ids.filter((id) => id > 0))], 300);
  if (partes.length === 0) return { itens: [] };
  if (!isNomusEnabled()) return { itens: [], erro: 'NOMUS_DB_URL não configurado' };
  const pool = getNomusPool();
  if (!pool) return { itens: [], erro: 'NOMUS_DB_URL não configurado' };
  const itens: ItemImpressaoPreEntradaBruto[] = [];
  try {
    for (const parte of partes) {
      const sql = SQL_ITENS_IMPRESSAO.replace('__IDS__', idsSql(parte));
      const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, sql);
      const list = Array.isArray(rows) ? rows : [];
      for (const row of list) {
        const idDocumento = toInt(row.idDocumento);
        const idItem = toInt(row.idItem);
        if (idDocumento <= 0 || idItem <= 0) continue;
        const idPedido = toInt(row.idPedido);
        itens.push({
          idDocumento,
          idItem,
          codigo: strOrNull(row.codigoProduto),
          descricao: strOrNull(row.descricaoProduto),
          unidade: strOrNull(row.unidadeMedida),
          qtde: qtdeItem(row.qtde),
          idPedido: idPedido > 0 ? idPedido : 0,
          nomePedido: strOrNull(row.nomePedido),
          dataEntrega: idPedido > 0 ? formatSqlDateYmd(row.dataEntrega) : null,
        });
      }
    }
    return { itens };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { itens: [], erro: msg };
  }
}

export async function queryImpressaoPreEntradas(params: {
  dataInicio: string | null;
  dataFim: string | null;
}): Promise<{ data?: ImpressaoPreEntrada; erro?: string }> {
  try {
    const atuais = await queryAtuais();
    if (atuais.erro) return { erro: atuais.erro };
    const ids = atuais.docs
      .filter(
        (doc) =>
          doc.idDocumento > 0 &&
          doc.idTipoMovimentacao === RECEBIMENTO_ID_TIPO_PRE_ENTRADA &&
          preEntradaNoPeriodo(doc.dataEntrada, params.dataInicio, params.dataFim),
      )
      .map((doc) => doc.idDocumento);
    const itens = await queryItensImpressao(ids);
    if (itens.erro) return { erro: itens.erro };
    return {
      data: montarImpressaoPreEntradas({
        documentos: atuais.docs,
        itens: itens.itens,
        dataInicio: params.dataInicio,
        dataFim: params.dataFim,
      }),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { erro: msg };
  }
}
