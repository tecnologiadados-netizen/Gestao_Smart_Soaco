/**
 * Gestão entradas — notas do período no Nomus cruzadas com conferência e decisão locais.
 */

import { prisma } from '../config/prisma.js';
import { getNomusPool, isNomusEnabled, nomusQueryWithRetry } from '../config/nomusDb.js';
import { formatSqlDateYmd } from './dfcDateUtils.js';
import { DOUBLE_CHECKIN_TIPOS_MOV, queryLinhasComparativoPorDocumentos } from './doubleCheckInRepository.js';
import { DOUBLE_CHECKIN_CONFERENCIA_NF_PC_DESDE } from '../services/doubleCheckInConferenciaPeriodo.js';
import {
  classificarNotaGestaoEntrada,
  montarDivergenciasAtuais,
  montarPainelGestaoEntradas,
  type DecisaoDiaGestaoEntrada,
  type DecisaoGestaoEntrada,
  type DivergenciaAtualEntrada,
  type DocGestaoEntrada,
  type GestaoEntradasPainel,
  type StatusNotaGestaoEntrada,
} from './gestaoEntradasClassificacao.js';

const TIPOS_IN = DOUBLE_CHECKIN_TIPOS_MOV.join(', ');

const SQL_DOCS = `
SELECT
  de.id AS idDocumento,
  DATE(de.dataEntrada) AS dataEntrada,
  tp.id AS idTipoMovimentacao,
  tp.nome AS nomeTipo,
  COUNT(ide.id) AS itens
FROM itemdocumentoestoque ide
INNER JOIN documentoestoque de ON de.id = ide.idDocumentoEstoque
INNER JOIN tipomovimentacao tp ON tp.id = de.idTipoMovimentacao
WHERE DATE(de.dataEntrada) BETWEEN ? AND ?
  AND ide.discriminador = 'ItemDocumentoEntrada'
  AND de.idTipoMovimentacao IN (${TIPOS_IN})
GROUP BY de.id, DATE(de.dataEntrada), tp.id, tp.nome
`.trim();

function toInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function strOrEmpty(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function carregarLocais(ids: number[]): Promise<{
  idsConferidos: Set<number>;
  decisoes: DecisaoGestaoEntrada[];
}> {
  const idsConferidos = new Set<number>();
  const decisoes: DecisaoGestaoEntrada[] = [];
  if (ids.length === 0) return { idsConferidos, decisoes };

  for (const parte of chunk(ids, 800)) {
    const [conferidos, rows] = await Promise.all([
      prisma.doubleCheckInConferido.findMany({
        where: {
          idDocumentoEstoque: { in: parte },
          conferidoEm: { gte: DOUBLE_CHECKIN_CONFERENCIA_NF_PC_DESDE },
        },
        select: { idDocumentoEstoque: true },
      }),
      prisma.doubleCheckInComparativoDecisao.findMany({
        where: { idDocumentoEstoque: { in: parte } },
        select: {
          idDocumentoEstoque: true,
          campo: true,
          decisao: true,
          justificativaOpcao: { select: { codigo: true, label: true } },
        },
      }),
    ]);
    for (const c of conferidos) idsConferidos.add(c.idDocumentoEstoque);
    for (const r of rows) {
      decisoes.push({
        idDocumentoEstoque: r.idDocumentoEstoque,
        campo: r.campo,
        decisao: r.decisao,
        justificativaCodigo: r.justificativaOpcao.codigo,
        justificativaLabel: r.justificativaOpcao.label,
      });
    }
  }

  return { idsConferidos, decisoes };
}

export async function queryGestaoEntradasPainel(params: {
  dataInicio: string;
  dataFim: string;
}): Promise<{ data?: GestaoEntradasPainel; erro?: string }> {
  if (!isNomusEnabled()) return { erro: 'NOMUS_DB_URL não configurado' };
  const pool = getNomusPool();
  if (!pool) return { erro: 'NOMUS_DB_URL não configurado' };

  try {
    const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, SQL_DOCS, [
      params.dataInicio,
      params.dataFim,
    ]);
    const list = Array.isArray(rows) ? rows : [];
    const docs: DocGestaoEntrada[] = [];
    for (const r of list) {
      const idDocumento = toInt(r.idDocumento ?? r['idDocumento']);
      const dataEntrada = formatSqlDateYmd(r.dataEntrada ?? r['dataEntrada']);
      if (idDocumento <= 0 || !dataEntrada) continue;
      docs.push({
        idDocumento,
        dataEntrada,
        idTipoMovimentacao: toInt(r.idTipoMovimentacao ?? r['idTipoMovimentacao']),
        nomeTipo: strOrEmpty(r.nomeTipo ?? r['nomeTipo']),
        itens: toInt(r.itens ?? r['itens']),
      });
    }

    const { idsConferidos, decisoes } = await carregarLocais(docs.map((d) => d.idDocumento));
    const { linhasPorDocumento, erro: erroLinhas } = await queryLinhasComparativoPorDocumentos(
      docs.map((d) => d.idDocumento)
    );
    if (erroLinhas) return { erro: erroLinhas };
    const idsComDivergenciaAtual = new Set<number>();
    for (const [id, linhas] of linhasPorDocumento ?? []) {
      if (linhas.some((l) => l.temDivergencia)) idsComDivergenciaAtual.add(id);
    }
    return {
      data: montarPainelGestaoEntradas({
        dataInicio: params.dataInicio,
        dataFim: params.dataFim,
        docs,
        idsConferidos,
        idsComDivergenciaAtual,
        decisoes,
      }),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[gestaoEntradasRepository] queryGestaoEntradasPainel:', msg);
    return { erro: msg };
  }
}

export type NotaDiaGestaoEntrada = {
  idDocumento: number;
  numeroDocumentoFiscal: string | null;
  numeroNfe: string | null;
  nomeParceiro: string | null;
  itens: number;
  status: StatusNotaGestaoEntrada;
  divergencias: DivergenciaAtualEntrada[];
};

const SQL_DOCS_DIA = `
SELECT
  de.id AS idDocumento,
  de.numeroDocumentoFiscal AS numeroDocumentoFiscal,
  MAX(nfe.numero) AS numeroNfe,
  pe.nome AS nomeParceiro,
  COUNT(DISTINCT ide.id) AS itens
FROM itemdocumentoestoque ide
INNER JOIN documentoestoque de ON de.id = ide.idDocumentoEstoque
LEFT JOIN pessoa pe ON pe.id = de.idParceiro
LEFT JOIN nfe ON nfe.idDocumentoEstoque = de.id
WHERE DATE(de.dataEntrada) BETWEEN ? AND ?
  AND ide.discriminador = 'ItemDocumentoEntrada'
  AND de.idTipoMovimentacao IN (${TIPOS_IN})
GROUP BY de.id, de.numeroDocumentoFiscal, pe.nome
ORDER BY de.numeroDocumentoFiscal ASC, de.id ASC
`.trim();

const ORDEM_STATUS: Record<StatusNotaGestaoEntrada, number> = {
  aceita: 0,
  recusa: 1,
  limpa: 2,
  pendente: 3,
};

export async function queryGestaoEntradasDia(params: {
  dataInicio: string;
  dataFim: string;
}): Promise<{ data?: { dataInicio: string; dataFim: string; notas: NotaDiaGestaoEntrada[] }; erro?: string }> {
  if (!isNomusEnabled()) return { erro: 'NOMUS_DB_URL não configurado' };
  const pool = getNomusPool();
  if (!pool) return { erro: 'NOMUS_DB_URL não configurado' };

  try {
    const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, SQL_DOCS_DIA, [
      params.dataInicio,
      params.dataFim,
    ]);
    const list = Array.isArray(rows) ? rows : [];
    const docs = list
      .map((r) => ({
        idDocumento: toInt(r.idDocumento ?? r['idDocumento']),
        numeroDocumentoFiscal: strOrEmpty(r.numeroDocumentoFiscal) || null,
        numeroNfe: strOrEmpty(r.numeroNfe) || null,
        nomeParceiro: strOrEmpty(r.nomeParceiro) || null,
        itens: toInt(r.itens),
      }))
      .filter((d) => d.idDocumento > 0);
    const ids = docs.map((d) => d.idDocumento);
    const [{ idsConferidos }, linhasResp, decisoes] = await Promise.all([
      carregarLocais(ids),
      queryLinhasComparativoPorDocumentos(ids),
      carregarDecisoesDia(ids),
    ]);
    if (linhasResp.erro) return { erro: linhasResp.erro };

    const notas: NotaDiaGestaoEntrada[] = docs.map((doc) => {
      const linhas = linhasResp.linhasPorDocumento.get(doc.idDocumento) ?? [];
      const decisoesDoc = decisoes.get(doc.idDocumento) ?? [];
      const divergencias = montarDivergenciasAtuais({ linhas, decisoes: decisoesDoc });
      const divergenciaAtual = divergencias.length > 0;
      const conferida = idsConferidos.has(doc.idDocumento);
      const status = classificarNotaGestaoEntrada(
        conferida,
        divergencias
          .filter((d) => d.decisao === 'aceita' || d.decisao === 'recusa')
          .map((d) => ({ decisao: d.decisao as string })),
        divergenciaAtual
      );
      return { ...doc, status, divergencias: divergenciaAtual ? divergencias : [] };
    });
    notas.sort(
      (a, b) =>
        ORDEM_STATUS[a.status] - ORDEM_STATUS[b.status] ||
        (a.numeroDocumentoFiscal ?? '').localeCompare(b.numeroDocumentoFiscal ?? '', 'pt-BR')
    );
    return { data: { dataInicio: params.dataInicio, dataFim: params.dataFim, notas } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[gestaoEntradasRepository] queryGestaoEntradasDia:', msg);
    return { erro: msg };
  }
}

async function carregarDecisoesDia(ids: number[]): Promise<Map<number, DecisaoDiaGestaoEntrada[]>> {
  const map = new Map<number, DecisaoDiaGestaoEntrada[]>();
  if (ids.length === 0) return map;
  for (const parte of chunk(ids, 800)) {
    const [rows, hist] = await Promise.all([
      prisma.doubleCheckInComparativoDecisao.findMany({
        where: { idDocumentoEstoque: { in: parte } },
        include: { justificativaOpcao: { select: { codigo: true, label: true } } },
      }),
      prisma.doubleCheckInComparativoObsHist.findMany({
        where: { idDocumentoEstoque: { in: parte } },
        orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }],
      }),
    ]);
    const histPorChave = new Map<string, DecisaoDiaGestaoEntrada['historico']>();
    for (const h of hist) {
      const key = `${h.idDocumentoEstoque}:${h.idItemDocumentoEstoque}:${h.idItemPedidoCompra}:${h.campo}`;
      const list = histPorChave.get(key) ?? [];
      list.push({
        texto: h.texto,
        usuarioLogin: h.usuarioLogin,
        criadoEm: h.criadoEm.toISOString(),
      });
      histPorChave.set(key, list);
    }
    for (const r of rows) {
      const key = `${r.idDocumentoEstoque}:${r.idItemDocumentoEstoque}:${r.idItemPedidoCompra}:${r.campo}`;
      const item: DecisaoDiaGestaoEntrada = {
        idItemDocumentoEstoque: r.idItemDocumentoEstoque,
        idItemPedidoCompra: r.idItemPedidoCompra,
        campo: r.campo,
        decisao: r.decisao,
        justificativaCodigo: r.justificativaOpcao.codigo,
        justificativaLabel: r.justificativaOpcao.label,
        observacao: r.observacao,
        usuarioLogin: r.usuarioLogin,
        atualizadoEm: r.atualizadoEm.toISOString(),
        historico: histPorChave.get(key) ?? [],
      };
      const list = map.get(r.idDocumentoEstoque) ?? [];
      list.push(item);
      map.set(r.idDocumentoEstoque, list);
    }
  }
  return map;
}
