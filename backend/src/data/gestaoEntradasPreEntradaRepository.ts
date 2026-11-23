/**
 * Gestão entradas — leitura das pré-entradas no Nomus e da comunicação Otimiza local.
 */

import { prisma } from '../config/prisma.js';
import { getNomusPool, isNomusEnabled, nomusQueryWithRetry } from '../config/nomusDb.js';
import { formatSqlDateYmd } from './dfcDateUtils.js';
import { listarDocumentosConferidos } from './doubleCheckInLocalRepository.js';
import { consultarChamadosAbertosOtimiza } from './otimizaLookupChamado.js';
import {
  aplicarChamadosAbertosOtimiza,
  montarGradePreEntradas,
  palavrasChaveChamadoOtimiza,
  type ApontamentoPedidoPreEntrada,
  type ComunicacaoOtimizaPreEntrada,
  type DocPreEntradaBruto,
  type GradePreEntrada,
  type PedidoPreEntrada,
  type StatusOtimizaPreEntrada,
  type VinculoPedidoPreEntrada,
} from './gestaoEntradasPreEntrada.js';
import {
  queryCabecalhosDocumentosNomus,
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

const SQL_USUARIO_ALTERACAO = `
SELECT
  de.id AS idDocumento,
  NULLIF(TRIM(u.nome), '') AS nomeUsuarioAlteracao
FROM documentoestoque de
LEFT JOIN usuario u ON u.id = de.idUsuario
WHERE de.idEmpresaEntrada = ${RECEBIMENTO_ID_EMPRESA_SO_ACO}
  AND de.id IN (__IDS__)
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

async function usuariosAlteracaoDe(ids: number[]): Promise<{ nomes: Map<number, string | null>; erro?: string }> {
  const nomes = new Map<number, string | null>();
  const partes = chunk([...new Set(ids.filter((id) => id > 0))], 400);
  if (partes.length === 0) return { nomes };
  if (!isNomusEnabled()) return { nomes, erro: 'NOMUS_DB_URL não configurado' };
  const pool = getNomusPool();
  if (!pool) return { nomes, erro: 'NOMUS_DB_URL não configurado' };
  try {
    for (const parte of partes) {
      const sql = SQL_USUARIO_ALTERACAO.replace('__IDS__', idsSql(parte));
      const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, sql);
      const list = Array.isArray(rows) ? rows : [];
      for (const row of list) {
        const idDocumento = toInt(row.idDocumento);
        if (idDocumento <= 0) continue;
        nomes.set(idDocumento, strOrNull(row.nomeUsuarioAlteracao));
      }
    }
    return { nomes };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { nomes, erro: msg };
  }
}

async function cabecalhosDe(ids: number[]): Promise<{ docs: DocPreEntradaBruto[]; erro?: string }> {
  const docs: DocPreEntradaBruto[] = [];
  const vistos = new Set<number>();
  for (const parte of chunk(ids, 300)) {
    const { documentos, erro } = await queryCabecalhosDocumentosNomus(parte);
    if (erro) return { docs: [], erro };
    for (const documento of documentos) {
      if (vistos.has(documento.idDocumento)) continue;
      vistos.add(documento.idDocumento);
      docs.push({
        idDocumento: documento.idDocumento,
        numeroDocumentoFiscal: documento.numeroDocumentoFiscal,
        numeroNfe: documento.numeroNfe,
        nomeParceiro: documento.nomeParceiro,
        dataEmissao: documento.dataEmissao,
        dataEntrada: documento.dataEntrada,
        idTipoMovimentacao: documento.idTipoMovimentacao,
        nomeTipo: documento.tipoMovimentacao,
        usuarioAlteracao: null,
      });
    }
  }
  return { docs };
}

export async function queryGestaoEntradasPreEntradas(params: {
  dataInicio: string | null;
  dataFim: string | null;
}): Promise<{ data?: GradePreEntrada; erro?: string }> {
  try {
    const atuais = await queryAtuais();
    if (atuais.erro) return { erro: atuais.erro };

    const mesa = await prisma.recebimentoConferencia.findMany({
      select: { idDocumentoEstoque: true },
    });
    const idsMesa = new Set(mesa.map((row) => row.idDocumentoEstoque).filter((id) => id > 0));
    const atuaisIds = new Set(atuais.docs.map((doc) => doc.idDocumento));
    const idsCandidatos = [
      ...atuaisIds,
      ...[...idsMesa].filter((id) => !atuaisIds.has(id)),
    ];
    const comunicacoes = await comunicacoesDe(idsCandidatos);
    const idsComComunicacao = new Set(comunicacoes.map((item) => item.idDocumentoEstoque));
    const idsEfetivar = [...idsMesa].filter((id) => !atuaisIds.has(id) && idsComComunicacao.has(id));
    const demais = await cabecalhosDe(idsEfetivar);
    if (demais.erro) return { erro: demais.erro };
    const alteracaoDemais = await usuariosAlteracaoDe(demais.docs.map((doc) => doc.idDocumento));
    if (alteracaoDemais.erro) return { erro: alteracaoDemais.erro };
    for (const doc of demais.docs) {
      doc.usuarioAlteracao = alteracaoDemais.nomes.get(doc.idDocumento) ?? null;
    }

    const idsGrade = new Set<number>([
      ...atuaisIds,
      ...demais.docs
        .filter((doc) => doc.idTipoMovimentacao !== RECEBIMENTO_ID_TIPO_PRE_ENTRADA)
        .map((doc) => doc.idDocumento),
    ]);
    const idsLista = [...idsGrade];
    const comunicacoesGrade = comunicacoes.filter((item) => idsGrade.has(item.idDocumentoEstoque));
    const [vinculos, pedidosItem, apontamentos, conferencias] = await Promise.all([
      queryVinculos(idsLista),
      queryPedidosPorItem(comunicacoesGrade.map((item) => item.idItemPedidoCompra)),
      apontamentosDe(idsLista),
      conferenciasDe(idsLista),
    ]);
    if (vinculos.erro) return { erro: vinculos.erro };
    if (pedidosItem.erro) return { erro: pedidosItem.erro };

    const grade = montarGradePreEntradas({
      atuais: atuais.docs,
      demais: demais.docs,
      idsMesa,
      comunicacoes: comunicacoesGrade,
      vinculos: vinculos.vinculos,
      pedidosPorItem: pedidosItem.pedidos,
      apontamentos,
      idsConferidos: conferencias.ids,
      usuariosConferencia: conferencias.usuarios,
      dataInicio: params.dataInicio,
      dataFim: params.dataFim,
    });
    let chamados: Map<string, number[]> | null = null;
    try {
      chamados = await consultarChamadosAbertosOtimiza(
        grade.linhas.flatMap((linha) => palavrasChaveChamadoOtimiza(linha)),
      );
    } catch (err) {
      console.error('[otimiza] chamados da pré-entrada', err instanceof Error ? err.message : 'erro');
    }
    return { data: aplicarChamadosAbertosOtimiza(grade, chamados) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { erro: msg };
  }
}
