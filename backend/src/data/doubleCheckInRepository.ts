/**
 * Double CheckIn — entradas de NF (Nomus) para grade + detalhe com histórico de preço.
 */

import { getNomusPool, isNomusEnabled, nomusQueryWithRetry } from '../config/nomusDb.js';
import { formatSqlDateYmd } from './dfcDateUtils.js';

/** Tipos de movimentação do SQL de negócio (entradas a conferir). */
export const DOUBLE_CHECKIN_TIPOS_MOV = [11, 35, 111, 112, 113, 114, 115, 116] as const;

const TIPOS_IN = DOUBLE_CHECKIN_TIPOS_MOV.join(', ');

export type DoubleCheckInNota = {
  idDocumento: number;
  numeroDocumentoFiscal: string | null;
  numeroNfe: string | null;
  dataEntrada: string | null;
  dataEmissao: string | null;
  idParceiro: number | null;
  nomeParceiro: string | null;
  qtdeItens: number;
};

export type DoubleCheckInHistoricoEntrada = {
  idDocumento: number;
  numeroDocumentoFiscal: string | null;
  numeroNfe: string | null;
  dataEmissao: string | null;
  nomeParceiro: string | null;
  valorUnitario: number;
  qtde: number;
};

export type DoubleCheckInItem = {
  idItem: number;
  idProduto: number;
  codigoProduto: string | null;
  nomeProduto: string | null;
  descricaoProduto: string | null;
  unidadeMedida: string | null;
  qtde: number;
  valorUnitario: number;
  valorTotal: number;
  /** % vs entrada imediatamente anterior (null se não houver histórico). */
  variacaoPct: number | null;
  foraLimiar: boolean;
  historico: DoubleCheckInHistoricoEntrada[];
};

function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

const SQL_NOTAS = `
SELECT
  de.id AS idDocumento,
  de.numeroDocumentoFiscal AS numeroDocumentoFiscal,
  nfe.numero AS numeroNfe,
  DATE(de.dataEntrada) AS dataEntrada,
  DATE(de.dataEmissao) AS dataEmissao,
  de.idParceiro AS idParceiro,
  pe.nome AS nomeParceiro,
  COUNT(ide.id) AS qtdeItens
FROM itemdocumentoestoque ide
LEFT JOIN documentoestoque de ON de.id = ide.idDocumentoEstoque
LEFT JOIN pessoa pe ON pe.id = de.idParceiro
LEFT JOIN tipomovimentacao tp ON tp.id = de.idTipoMovimentacao
LEFT JOIN nfe ON nfe.idDocumentoEstoque = de.id
WHERE DATE(de.dataEntrada) BETWEEN ? AND ?
  AND ide.discriminador = 'ItemDocumentoEntrada'
  AND tp.id IN (${TIPOS_IN})
GROUP BY
  de.id,
  de.numeroDocumentoFiscal,
  nfe.numero,
  DATE(de.dataEntrada),
  DATE(de.dataEmissao),
  de.idParceiro,
  pe.nome
ORDER BY DATE(de.dataEntrada) DESC, de.id DESC
LIMIT 2000
`.trim();

const SQL_ITENS = `
SELECT
  ide.id AS idItem,
  tp.nome AS tipoMovimentacao,
  de.numeroDocumentoFiscal AS numeroDocumentoFiscal,
  nfe.numero AS numeroNfe,
  DATE(de.dataEntrada) AS dataEntrada,
  DATE(de.dataEmissao) AS dataEmissao,
  de.idParceiro AS idParceiro,
  pe.nome AS nomeParceiro,
  ide.idProduto AS idProduto,
  p.nome AS codigoProduto,
  p.descricao AS descricaoProduto,
  um.nome AS unidadeMedida,
  ide.qtde AS qtde,
  ide.valorUnitario AS valorUnitario,
  ide.valorTotal AS valorTotal
FROM itemdocumentoestoque ide
LEFT JOIN documentoestoque de ON de.id = ide.idDocumentoEstoque
LEFT JOIN pessoa pe ON pe.id = de.idParceiro
LEFT JOIN produto p ON p.id = ide.idProduto
LEFT JOIN tipomovimentacao tp ON tp.id = de.idTipoMovimentacao
LEFT JOIN unidademedida um ON um.id = p.idUnidadeMedida
LEFT JOIN nfe ON nfe.idDocumentoEstoque = de.id
WHERE ide.idDocumentoEstoque = ?
  AND ide.discriminador = 'ItemDocumentoEntrada'
  AND tp.id IN (${TIPOS_IN})
ORDER BY ide.id ASC
`.trim();

/** Últimas N entradas do produto com dataEmissao < dataRef (mesmos tipos da grade). */
const SQL_HISTORICO_PRODUTO = `
SELECT
  de.id AS idDocumento,
  de.numeroDocumentoFiscal AS numeroDocumentoFiscal,
  nfe.numero AS numeroNfe,
  DATE(de.dataEmissao) AS dataEmissao,
  pe.nome AS nomeParceiro,
  ide.valorUnitario AS valorUnitario,
  ide.qtde AS qtde
FROM itemdocumentoestoque ide
INNER JOIN documentoestoque de ON de.id = ide.idDocumentoEstoque
LEFT JOIN pessoa pe ON pe.id = de.idParceiro
LEFT JOIN nfe ON nfe.idDocumentoEstoque = de.id
WHERE ide.idProduto = ?
  AND ide.discriminador = 'ItemDocumentoEntrada'
  AND de.idTipoMovimentacao IN (${TIPOS_IN})
  AND DATE(de.dataEmissao) < ?
ORDER BY DATE(de.dataEmissao) DESC, de.id DESC, ide.id DESC
LIMIT 3
`.trim();

export function calcularVariacaoPct(atual: number, anterior: number | null): number | null {
  if (anterior == null || !Number.isFinite(anterior) || anterior === 0) {
    if (anterior === 0 && atual !== 0) return atual > 0 ? 100 : -100;
    return null;
  }
  return ((atual - anterior) / anterior) * 100;
}

export function itemForaLimiar(variacaoPct: number | null, limiarPct: number): boolean {
  if (variacaoPct == null) return false;
  const lim = Math.abs(limiarPct);
  return Math.abs(variacaoPct) > lim;
}

export async function queryDoubleCheckInNotas(params: {
  dataInicio: string;
  dataFim: string;
}): Promise<{ notas: DoubleCheckInNota[]; erro?: string }> {
  if (!isNomusEnabled()) return { notas: [], erro: 'NOMUS_DB_URL não configurado' };
  const pool = getNomusPool();
  if (!pool) return { notas: [], erro: 'NOMUS_DB_URL não configurado' };

  try {
    const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(
      pool,
      SQL_NOTAS,
      [params.dataInicio, params.dataFim]
    );
    const list = Array.isArray(rows) ? rows : [];
    const notas: DoubleCheckInNota[] = list.map((r) => ({
      idDocumento: toInt(r.idDocumento ?? r['idDocumento']),
      numeroDocumentoFiscal: strOrNull(r.numeroDocumentoFiscal ?? r['numeroDocumentoFiscal']),
      numeroNfe: strOrNull(r.numeroNfe ?? r['numeroNfe']),
      dataEntrada: formatSqlDateYmd(r.dataEntrada ?? r['dataEntrada']),
      dataEmissao: formatSqlDateYmd(r.dataEmissao ?? r['dataEmissao']),
      idParceiro: r.idParceiro != null ? toInt(r.idParceiro) : null,
      nomeParceiro: strOrNull(r.nomeParceiro ?? r['nomeParceiro']),
      qtdeItens: toInt(r.qtdeItens ?? r['qtdeItens']),
    }));
    return { notas };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[doubleCheckInRepository] queryDoubleCheckInNotas:', msg);
    return { notas: [], erro: msg };
  }
}

async function queryHistoricoProduto(
  pool: NonNullable<ReturnType<typeof getNomusPool>>,
  idProduto: number,
  dataEmissaoRef: string
): Promise<DoubleCheckInHistoricoEntrada[]> {
  const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(
    pool,
    SQL_HISTORICO_PRODUTO,
    [idProduto, dataEmissaoRef]
  );
  const list = Array.isArray(rows) ? rows : [];
  return list.map((r) => ({
    idDocumento: toInt(r.idDocumento),
    numeroDocumentoFiscal: strOrNull(r.numeroDocumentoFiscal),
    numeroNfe: strOrNull(r.numeroNfe),
    dataEmissao: formatSqlDateYmd(r.dataEmissao),
    nomeParceiro: strOrNull(r.nomeParceiro),
    valorUnitario: toNum(r.valorUnitario),
    qtde: toNum(r.qtde),
  }));
}

export async function queryDoubleCheckInItens(params: {
  idDocumento: number;
  limiarPct: number;
}): Promise<{
  itens: DoubleCheckInItem[];
  dataEmissao: string | null;
  erro?: string;
}> {
  if (!isNomusEnabled()) return { itens: [], dataEmissao: null, erro: 'NOMUS_DB_URL não configurado' };
  const pool = getNomusPool();
  if (!pool) return { itens: [], dataEmissao: null, erro: 'NOMUS_DB_URL não configurado' };

  try {
    const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(
      pool,
      SQL_ITENS,
      [params.idDocumento]
    );
    const list = Array.isArray(rows) ? rows : [];
    if (list.length === 0) return { itens: [], dataEmissao: null };

    const dataEmissao =
      formatSqlDateYmd(list[0].dataEmissao ?? list[0]['dataEmissao']) ?? null;
    if (!dataEmissao) {
      return { itens: [], dataEmissao: null, erro: 'Documento sem data de emissão.' };
    }

    const histCache = new Map<number, DoubleCheckInHistoricoEntrada[]>();
    const itens: DoubleCheckInItem[] = [];

    for (const r of list) {
      const idProduto = toInt(r.idProduto);
      const valorUnitario = toNum(r.valorUnitario);
      let historico = histCache.get(idProduto);
      if (!historico) {
        historico = await queryHistoricoProduto(pool, idProduto, dataEmissao);
        histCache.set(idProduto, historico);
      }
      const anterior = historico[0]?.valorUnitario ?? null;
      const variacaoPct = calcularVariacaoPct(valorUnitario, anterior);
      itens.push({
        idItem: toInt(r.idItem),
        idProduto,
        codigoProduto: strOrNull(r.codigoProduto),
        nomeProduto: strOrNull(r.codigoProduto),
        descricaoProduto: strOrNull(r.descricaoProduto),
        unidadeMedida: strOrNull(r.unidadeMedida),
        qtde: toNum(r.qtde),
        valorUnitario,
        valorTotal: toNum(r.valorTotal),
        variacaoPct,
        foraLimiar: itemForaLimiar(variacaoPct, params.limiarPct),
        historico,
      });
    }

    return { itens, dataEmissao };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[doubleCheckInRepository] queryDoubleCheckInItens:', msg);
    return { itens: [], dataEmissao: null, erro: msg };
  }
}

/** Resumo de outliers por documento (para alerta WhatsApp). */
export async function analisarOutliersDocumento(params: {
  idDocumento: number;
  limiarPct: number;
}): Promise<{
  temOutlier: boolean;
  outliers: Array<{
    idProduto: number;
    descricao: string;
    valorUnitario: number;
    valorAnterior: number | null;
    variacaoPct: number;
  }>;
  meta: {
    numeroDocumentoFiscal: string | null;
    numeroNfe: string | null;
    dataEmissao: string | null;
    nomeParceiro: string | null;
  };
  erro?: string;
}> {
  const { itens, dataEmissao, erro } = await queryDoubleCheckInItens(params);
  if (erro) {
    return {
      temOutlier: false,
      outliers: [],
      meta: {
        numeroDocumentoFiscal: null,
        numeroNfe: null,
        dataEmissao: null,
        nomeParceiro: null,
      },
      erro,
    };
  }

  const outliers = itens
    .filter((i) => i.foraLimiar && i.variacaoPct != null)
    .map((i) => ({
      idProduto: i.idProduto,
      descricao: [i.codigoProduto, i.descricaoProduto].filter(Boolean).join(' — ') || `Produto ${i.idProduto}`,
      valorUnitario: i.valorUnitario,
      valorAnterior: i.historico[0]?.valorUnitario ?? null,
      variacaoPct: i.variacaoPct!,
    }));

  // Meta vem do primeiro item via re-query leve não disponível — buscar nota isolada se preciso.
  // Os campos estão no SQL_ITENS; reconsultamos o cabeçalho se houver itens.
  let meta = {
    numeroDocumentoFiscal: null as string | null,
    numeroNfe: null as string | null,
    dataEmissao,
    nomeParceiro: null as string | null,
  };

  if (!isNomusEnabled()) {
    return { temOutlier: outliers.length > 0, outliers, meta };
  }
  const pool = getNomusPool();
  if (pool) {
    try {
      const [cab] = await nomusQueryWithRetry<Record<string, unknown>[]>(
        pool,
        `
SELECT
  de.numeroDocumentoFiscal AS numeroDocumentoFiscal,
  nfe.numero AS numeroNfe,
  DATE(de.dataEmissao) AS dataEmissao,
  pe.nome AS nomeParceiro
FROM documentoestoque de
LEFT JOIN pessoa pe ON pe.id = de.idParceiro
LEFT JOIN nfe ON nfe.idDocumentoEstoque = de.id
WHERE de.id = ?
LIMIT 1
`.trim(),
        [params.idDocumento]
      );
      const row = Array.isArray(cab) && cab[0] ? cab[0] : null;
      if (row) {
        meta = {
          numeroDocumentoFiscal: strOrNull(row.numeroDocumentoFiscal),
          numeroNfe: strOrNull(row.numeroNfe),
          dataEmissao: formatSqlDateYmd(row.dataEmissao) ?? dataEmissao,
          nomeParceiro: strOrNull(row.nomeParceiro),
        };
      }
    } catch {
      /* keep meta parcial */
    }
  }

  return { temOutlier: outliers.length > 0, outliers, meta };
}

/**
 * Status consolidado (fora limiar) para a página da grade — mesma regra do modal.
 * Limita a 100 IDs por chamada.
 */
export async function queryDoubleCheckInStatus(params: {
  ids: number[];
  limiarPct: number;
}): Promise<{
  status: Array<{ idDocumento: number; temForaLimiar: boolean }>;
  limiarPct: number;
  erro?: string;
}> {
  const ids = [
    ...new Set(
      params.ids
        .map((n) => Math.trunc(Number(n)))
        .filter((n) => Number.isFinite(n) && n > 0)
    ),
  ].slice(0, 100);

  if (ids.length === 0) {
    return { status: [], limiarPct: params.limiarPct };
  }

  const status: Array<{ idDocumento: number; temForaLimiar: boolean }> = [];
  // Sequencial para não saturar Nomus (página típica: 10).
  for (const idDocumento of ids) {
    const { itens, erro } = await queryDoubleCheckInItens({
      idDocumento,
      limiarPct: params.limiarPct,
    });
    if (erro) {
      status.push({ idDocumento, temForaLimiar: false });
      continue;
    }
    status.push({
      idDocumento,
      temForaLimiar: itens.some((i) => i.foraLimiar),
    });
  }

  return { status, limiarPct: params.limiarPct };
}

export type DoubleCheckInDashboardSerieDia = {
  data: string;
  notas: number;
  itens: number;
  variacaoNotasPct: number | null;
};

export type DoubleCheckInDashboardTipo = {
  idTipoMovimentacao: number;
  nomeTipo: string;
  notas: number;
};

export type DoubleCheckInDashboardParceiro = {
  idParceiro: number | null;
  nomeParceiro: string | null;
  notas: number;
  itens: number;
};

export type DoubleCheckInDashboardResult = {
  dataInicio: string;
  dataFim: string;
  kpis: {
    qtdeNotas: number;
    qtdeItens: number;
    mediaItensPorNota: number | null;
    qtdeConferidas: number;
    qtdePendentes: number;
    pctConferencia: number | null;
    qtdeComAtencao: number;
    pctAtencao: number | null;
    mediaNotasPorDia: number | null;
    tempoMedioConferenciaDias: number | null;
  };
  serieDiaria: DoubleCheckInDashboardSerieDia[];
  porTipo: DoubleCheckInDashboardTipo[];
  topParceiros: DoubleCheckInDashboardParceiro[];
};

const SQL_DASH_SERIE = `
SELECT
  DATE(de.dataEntrada) AS dia,
  COUNT(DISTINCT de.id) AS notas,
  COUNT(ide.id) AS itens
FROM itemdocumentoestoque ide
INNER JOIN documentoestoque de ON de.id = ide.idDocumentoEstoque
INNER JOIN tipomovimentacao tp ON tp.id = de.idTipoMovimentacao
WHERE DATE(de.dataEntrada) BETWEEN ? AND ?
  AND ide.discriminador = 'ItemDocumentoEntrada'
  AND de.idTipoMovimentacao IN (${TIPOS_IN})
GROUP BY DATE(de.dataEntrada)
ORDER BY DATE(de.dataEntrada) ASC
`.trim();

const SQL_DASH_TIPO = `
SELECT
  tp.id AS idTipoMovimentacao,
  tp.nome AS nomeTipo,
  COUNT(DISTINCT de.id) AS notas
FROM itemdocumentoestoque ide
INNER JOIN documentoestoque de ON de.id = ide.idDocumentoEstoque
INNER JOIN tipomovimentacao tp ON tp.id = de.idTipoMovimentacao
WHERE DATE(de.dataEntrada) BETWEEN ? AND ?
  AND ide.discriminador = 'ItemDocumentoEntrada'
  AND de.idTipoMovimentacao IN (${TIPOS_IN})
GROUP BY tp.id, tp.nome
ORDER BY notas DESC
`.trim();

const SQL_DASH_PARCEIRO = `
SELECT
  de.idParceiro AS idParceiro,
  pe.nome AS nomeParceiro,
  COUNT(DISTINCT de.id) AS notas,
  COUNT(ide.id) AS itens
FROM itemdocumentoestoque ide
INNER JOIN documentoestoque de ON de.id = ide.idDocumentoEstoque
LEFT JOIN pessoa pe ON pe.id = de.idParceiro
WHERE DATE(de.dataEntrada) BETWEEN ? AND ?
  AND ide.discriminador = 'ItemDocumentoEntrada'
  AND de.idTipoMovimentacao IN (${TIPOS_IN})
GROUP BY de.idParceiro, pe.nome
ORDER BY notas DESC
LIMIT 5
`.trim();

const SQL_DASH_IDS = `
SELECT DISTINCT
  de.id AS idDocumento,
  DATE(de.dataEntrada) AS dataEntrada
FROM itemdocumentoestoque ide
INNER JOIN documentoestoque de ON de.id = ide.idDocumentoEstoque
WHERE DATE(de.dataEntrada) BETWEEN ? AND ?
  AND ide.discriminador = 'ItemDocumentoEntrada'
  AND de.idTipoMovimentacao IN (${TIPOS_IN})
`.trim();

export async function queryDoubleCheckInDashboard(params: {
  dataInicio: string;
  dataFim: string;
  conferidos: Map<number, { conferidoEm: string }>;
  idsComAtencao: Set<number>;
}): Promise<{ data?: DoubleCheckInDashboardResult; erro?: string }> {
  if (!isNomusEnabled()) return { erro: 'NOMUS_DB_URL não configurado' };
  const pool = getNomusPool();
  if (!pool) return { erro: 'NOMUS_DB_URL não configurado' };

  try {
    const args = [params.dataInicio, params.dataFim];
    const [[serieRows], [tipoRows], [parcRows], [idRows]] = await Promise.all([
      nomusQueryWithRetry<Record<string, unknown>[]>(pool, SQL_DASH_SERIE, args),
      nomusQueryWithRetry<Record<string, unknown>[]>(pool, SQL_DASH_TIPO, args),
      nomusQueryWithRetry<Record<string, unknown>[]>(pool, SQL_DASH_PARCEIRO, args),
      nomusQueryWithRetry<Record<string, unknown>[]>(pool, SQL_DASH_IDS, args),
    ]);

    const serieRaw = Array.isArray(serieRows) ? serieRows : [];
    const serieDiaria: DoubleCheckInDashboardSerieDia[] = [];
    let prevNotas: number | null = null;
    for (const r of serieRaw) {
      const data = formatSqlDateYmd(r.dia ?? r['dia']) ?? '';
      const notas = toInt(r.notas ?? r['notas']);
      const itens = toInt(r.itens ?? r['itens']);
      let variacaoNotasPct: number | null = null;
      if (prevNotas != null && prevNotas !== 0) {
        variacaoNotasPct = ((notas - prevNotas) / prevNotas) * 100;
      } else if (prevNotas === 0 && notas > 0) {
        variacaoNotasPct = 100;
      }
      serieDiaria.push({ data, notas, itens, variacaoNotasPct });
      prevNotas = notas;
    }

    const porTipo: DoubleCheckInDashboardTipo[] = (Array.isArray(tipoRows) ? tipoRows : []).map(
      (r) => ({
        idTipoMovimentacao: toInt(r.idTipoMovimentacao ?? r['idTipoMovimentacao']),
        nomeTipo: strOrNull(r.nomeTipo ?? r['nomeTipo']) ?? `Tipo ${toInt(r.idTipoMovimentacao)}`,
        notas: toInt(r.notas ?? r['notas']),
      })
    );

    const topParceiros: DoubleCheckInDashboardParceiro[] = (
      Array.isArray(parcRows) ? parcRows : []
    ).map((r) => ({
      idParceiro: r.idParceiro != null ? toInt(r.idParceiro) : null,
      nomeParceiro: strOrNull(r.nomeParceiro ?? r['nomeParceiro']),
      notas: toInt(r.notas ?? r['notas']),
      itens: toInt(r.itens ?? r['itens']),
    }));

    const idsList = Array.isArray(idRows) ? idRows : [];
    const dataPorDoc = new Map<number, string>();
    for (const r of idsList) {
      const id = toInt(r.idDocumento ?? r['idDocumento']);
      const d = formatSqlDateYmd(r.dataEntrada ?? r['dataEntrada']);
      if (id > 0 && d) dataPorDoc.set(id, d);
    }

    const qtdeNotas = dataPorDoc.size;
    const qtdeItens = serieDiaria.reduce((s, x) => s + x.itens, 0);
    let qtdeConferidas = 0;
    let somaDiasConf = 0;
    let nDiasConf = 0;
    for (const [id, conf] of params.conferidos) {
      if (!dataPorDoc.has(id)) continue;
      qtdeConferidas += 1;
      const emissao = dataPorDoc.get(id)!;
      const em = Date.parse(`${emissao}T12:00:00`);
      const cf = Date.parse(conf.conferidoEm);
      if (Number.isFinite(em) && Number.isFinite(cf)) {
        const dias = (cf - em) / (1000 * 60 * 60 * 24);
        if (dias >= 0) {
          somaDiasConf += dias;
          nDiasConf += 1;
        }
      }
    }

    let qtdeComAtencao = 0;
    for (const id of params.idsComAtencao) {
      if (dataPorDoc.has(id)) qtdeComAtencao += 1;
    }

    const diasComMovimento = serieDiaria.filter((d) => d.notas > 0).length;
    const qtdePendentes = Math.max(0, qtdeNotas - qtdeConferidas);

    return {
      data: {
        dataInicio: params.dataInicio,
        dataFim: params.dataFim,
        kpis: {
          qtdeNotas,
          qtdeItens,
          mediaItensPorNota: qtdeNotas > 0 ? qtdeItens / qtdeNotas : null,
          qtdeConferidas,
          qtdePendentes,
          pctConferencia: qtdeNotas > 0 ? (qtdeConferidas / qtdeNotas) * 100 : null,
          qtdeComAtencao,
          pctAtencao: qtdeNotas > 0 ? (qtdeComAtencao / qtdeNotas) * 100 : null,
          mediaNotasPorDia: diasComMovimento > 0 ? qtdeNotas / diasComMovimento : null,
          tempoMedioConferenciaDias: nDiasConf > 0 ? somaDiasConf / nDiasConf : null,
        },
        serieDiaria,
        porTipo,
        topParceiros,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[doubleCheckInRepository] queryDoubleCheckInDashboard:', msg);
    return { erro: msg };
  }
}

export type DoubleCheckInComparativoCampo = 'valor_unitario' | 'qtde' | 'ipi' | 'condicao_pagamento';

export type DoubleCheckInComparativoLinha = {
  idItemDocumentoEstoque: number;
  idItemPedidoCompra: number;
  idPedidoCompra: number | null;
  nomePedidoCompra: string | null;
  idProduto: number | null;
  codigoProduto: string | null;
  descricaoProduto: string | null;
  qtdeNF: number;
  umNF: string | null;
  qtdePC: number;
  umPC: string | null;
  /** Valor unitário bruto (sem desconto). */
  valorUnitarioBrutoNF: number;
  valorUnitarioBrutoPC: number;
  descontoNF: number;
  descontoPC: number;
  /** Valor unitário líquido (após desconto) — base da comparação. */
  valorUnitarioNF: number;
  valorUnitarioPC: number;
  valorIpiNF: number;
  valorIpiPC: number;
  condicaoPagamentoNF: string | null;
  regraPagamentoNF: string | null;
  condicaoPagamentoPC: string | null;
  regraPagamentoPC: string | null;
  /** Data base das parcelas (YYYY-MM-DD). */
  dataBaseParcelasNF: string | null;
  dataBaseParcelasPC: string | null;
  /** Parcelas com data base, vencimento e dias (vencimento − base). */
  parcelasNF: DoubleCheckInParcelaPrazo[];
  parcelasPC: DoubleCheckInParcelaPrazo[];
  /** Offsets em dias: vencimento − dataBase, na ordem das parcelas. */
  prazosDiasNF: number[];
  prazosDiasPC: number[];
  /** Ex.: "21" ou "30/60/90". */
  prazosLabelNF: string | null;
  prazosLabelPC: string | null;
  divergValorUnitario: boolean;
  divergQtde: boolean;
  divergIpi: boolean;
  divergCondicaoPagamento: boolean;
  temDivergencia: boolean;
};

export type DoubleCheckInParcelaPrazo = {
  numero: number;
  dataBase: string | null;
  dataVencimento: string | null;
  dias: number | null;
};

/** Arredonda para comparar sem microdivergência de casas decimais. */
export function arredondarComparativo(n: number, casas: number): number {
  if (!Number.isFinite(n)) return 0;
  const f = 10 ** casas;
  return Math.round((n + Number.EPSILON) * f) / f;
}

/** Dinheiro: 2 casas. Quantidade: 4 casas. */
export function valoresIguaisComparativo(a: number, b: number, casas: number): boolean {
  return arredondarComparativo(a, casas) === arredondarComparativo(b, casas);
}

/** Unitário líquido: prioriza totalComDesconto/qtde; senão bruto − desconto/qtde. */
export function unitarioLiquidoComDesconto(params: {
  unitarioBruto: number;
  qtde: number;
  desconto: number;
  totalComDesconto: number;
}): number {
  const qtde = params.qtde;
  if (qtde > 0 && Number.isFinite(params.totalComDesconto)) {
    return params.totalComDesconto / qtde;
  }
  if (qtde > 0 && params.desconto > 0) {
    return (params.unitarioBruto * qtde - params.desconto) / qtde;
  }
  return params.unitarioBruto;
}

function normalizarTextoComparativo(v: unknown): string {
  return String(v ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR');
}

export function textosIguaisComparativo(a: unknown, b: unknown): boolean {
  return normalizarTextoComparativo(a) === normalizarTextoComparativo(b);
}

/** Extrai YYYY-MM-DD de Date/string Nomus (meia-noite BRT costuma vir como 03:00Z). */
export function ymdNomusDate(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    if (v.getUTCHours() === 3 && v.getUTCMinutes() === 0) {
      const y = v.getUTCFullYear();
      const m = String(v.getUTCMonth() + 1).padStart(2, '0');
      const d = String(v.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    const via = formatSqlDateYmd(v);
    return via || null;
  }
  const s = String(v);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

export function diasEntreYmd(base: string | null, venc: string | null): number | null {
  if (!base || !venc) return null;
  const da = Date.parse(`${base}T12:00:00Z`);
  const db = Date.parse(`${venc}T12:00:00Z`);
  if (!Number.isFinite(da) || !Number.isFinite(db)) return null;
  return Math.round((db - da) / 86400000);
}

export function labelPrazosDias(dias: number[]): string | null {
  if (dias.length === 0) return null;
  return dias.map((d) => `${d}`).join('/');
}

export function prazosDiasIguais(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Critério final de Cond. pagamento: sequência de dias (vencimento − data base).
 * Sem parcelas nos dois lados → fallback ao texto da condição/regra.
 * Só um lado com parcelas → divergente.
 */
export function divergenciaCondicaoPorPrazos(params: {
  prazosNF: number[];
  prazosPC: number[];
  condicaoNF: string | null;
  regraNF: string | null;
  condicaoPC: string | null;
  regraPC: string | null;
}): boolean {
  const temNf = params.prazosNF.length > 0;
  const temPc = params.prazosPC.length > 0;
  if (temNf || temPc) {
    if (!temNf || !temPc) return true;
    return !prazosDiasIguais(params.prazosNF, params.prazosPC);
  }
  return (
    !textosIguaisComparativo(params.condicaoNF, params.condicaoPC) ||
    !textosIguaisComparativo(params.regraNF, params.regraPC)
  );
}

const SQL_COMPARATIVO_PC = `
SELECT
  de.id AS idDocumento,
  de.numeroDocumentoFiscal AS numeroDocumentoFiscal,
  de.dataBaseParcelas AS dataBaseParcelasNF,
  pc.id AS idPedidoCompra,
  pc.nome AS nomePedidoCompra,
  pc.dataBaseParcelas AS dataBaseParcelasPC,
  ide.id AS idItemDocumentoEstoque,
  ipc.id AS idItemPedidoCompra,
  ide.idProduto AS idProduto,
  p.nome AS codigoProduto,
  p.descricao AS descricaoProduto,
  ide.qtde AS qtdeNF,
  umide.nome AS umNF,
  ipc.qtde AS qtdePC,
  umipc.nome AS umPC,
  ide.valorUnitario AS valorUnitarioBrutoNF,
  ipc.precoUnitario AS valorUnitarioBrutoPC,
  IFNULL(ide.valorDesconto, 0) AS descontoNF,
  IFNULL(ipc.valorDesconto, 0) AS descontoPC,
  ide.valorTotalComDesconto AS valorTotalComDescontoNF,
  ipc.valorTotalComDesconto AS valorTotalComDescontoPC,
  IFNULL(tde.valorIPI, 0) AS valorIpiNF,
  IFNULL(tpc.valorIPI, 0) AS valorIpiPC,
  cpde.nome AS condicaoPagamentoNF,
  cpde.regra AS regraPagamentoNF,
  cppc.nome AS condicaoPagamentoPC,
  cppc.regra AS regraPagamentoPC
FROM itemdocumentoestoque_itempedidocompra ideipc
LEFT JOIN itemdocumentoestoque ide ON ide.id = ideipc.idItemDocumentoEstoque
LEFT JOIN documentoestoque de ON de.id = ide.idDocumentoEstoque
LEFT JOIN itempedidocompra ipc ON ipc.id = ideipc.idItemPedidoCompra
LEFT JOIN pedidocompra pc ON pc.id = ipc.idPedidoCompra
LEFT JOIN produto p ON p.id = ide.idProduto
LEFT JOIN unidademedida umide ON umide.id = ide.idUnidadeMedida
LEFT JOIN unidademedida umipc ON umipc.id = ipc.idUnidadeMedida
LEFT JOIN tributacao tde ON tde.idItemDocumentoEstoque = ide.id
LEFT JOIN tributacao tpc ON tpc.idItemPedidoCompra = ipc.id
LEFT JOIN condicaopagamento cpde ON cpde.id = de.idCondicaoPagamento
LEFT JOIN condicaopagamento cppc ON cppc.id = pc.idCondicaoPagamento
WHERE de.id = ?
ORDER BY ide.id ASC, ipc.id ASC
`.trim();

async function carregarPrazosParcelas(params: {
  pool: NonNullable<ReturnType<typeof getNomusPool>>;
  idDocumento: number;
  idsPedidoCompra: number[];
  dataBaseNF: string | null;
  dataBasePorPc: Map<number, string | null>;
}): Promise<{
  parcelasNF: DoubleCheckInParcelaPrazo[];
  parcelasPorPc: Map<number, DoubleCheckInParcelaPrazo[]>;
}> {
  const parcelasNF: DoubleCheckInParcelaPrazo[] = [];
  const parcelasPorPc = new Map<number, DoubleCheckInParcelaPrazo[]>();
  for (const id of params.idsPedidoCompra) parcelasPorPc.set(id, []);

  let sql: string;
  let args: unknown[];
  if (params.idsPedidoCompra.length === 0) {
    sql = `
SELECT idEntidadeOrigem, discriminador, numero, dataVencimento
FROM parcelapagamento
WHERE discriminador = 'DocumentoEntrada' AND idEntidadeOrigem = ?
ORDER BY numero ASC, dataVencimento ASC, id ASC
`.trim();
    args = [params.idDocumento];
  } else {
    const ph = params.idsPedidoCompra.map(() => '?').join(', ');
    sql = `
SELECT idEntidadeOrigem, discriminador, numero, dataVencimento
FROM parcelapagamento
WHERE (discriminador = 'DocumentoEntrada' AND idEntidadeOrigem = ?)
   OR (discriminador = 'PedidoCompra' AND idEntidadeOrigem IN (${ph}))
ORDER BY idEntidadeOrigem ASC, numero ASC, dataVencimento ASC, id ASC
`.trim();
    args = [params.idDocumento, ...params.idsPedidoCompra];
  }

  const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(params.pool, sql, args);
  const list = Array.isArray(rows) ? rows : [];
  for (const r of list) {
    const disc = String(r.discriminador ?? '');
    const idOrigem = toInt(r.idEntidadeOrigem);
    const venc = ymdNomusDate(r.dataVencimento);
    if (disc === 'DocumentoEntrada' && idOrigem === params.idDocumento) {
      parcelasNF.push({
        numero: parcelasNF.length + 1,
        dataBase: params.dataBaseNF,
        dataVencimento: venc,
        dias: diasEntreYmd(params.dataBaseNF, venc),
      });
      continue;
    }
    if (disc === 'PedidoCompra' && parcelasPorPc.has(idOrigem)) {
      const dataBase = params.dataBasePorPc.get(idOrigem) ?? null;
      const arr = parcelasPorPc.get(idOrigem)!;
      arr.push({
        numero: arr.length + 1,
        dataBase,
        dataVencimento: venc,
        dias: diasEntreYmd(dataBase, venc),
      });
    }
  }
  return { parcelasNF, parcelasPorPc };
}

export async function queryDoubleCheckInComparativoPc(params: {
  idDocumento: number;
}): Promise<{ linhas: DoubleCheckInComparativoLinha[]; erro?: string }> {
  if (!isNomusEnabled() || !getNomusPool()) {
    return { linhas: [], erro: 'Nomus não configurado.' };
  }
  const pool = getNomusPool();
  if (!pool) return { linhas: [], erro: 'Nomus não configurado.' };
  try {
    const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(
      pool,
      SQL_COMPARATIVO_PC,
      [params.idDocumento]
    );
    const list = Array.isArray(rows) ? rows : [];

    const dataBaseNF =
      list.length > 0 ? ymdNomusDate(list[0]!.dataBaseParcelasNF) : null;
    const dataBasePorPc = new Map<number, string | null>();
    const idsPc: number[] = [];
    for (const r of list) {
      if (r.idPedidoCompra == null) continue;
      const idPc = toInt(r.idPedidoCompra);
      if (!dataBasePorPc.has(idPc)) {
        dataBasePorPc.set(idPc, ymdNomusDate(r.dataBaseParcelasPC));
        idsPc.push(idPc);
      }
    }

    const { parcelasNF, parcelasPorPc } = await carregarPrazosParcelas({
      pool,
      idDocumento: params.idDocumento,
      idsPedidoCompra: idsPc,
      dataBaseNF,
      dataBasePorPc,
    });
    const prazosNF = parcelasNF.map((p) => p.dias).filter((d): d is number => d != null);
    const prazosLabelNF = labelPrazosDias(prazosNF);

    const linhas: DoubleCheckInComparativoLinha[] = list.map((r) => {
      const qtdeNF = toNum(r.qtdeNF);
      const qtdePC = toNum(r.qtdePC);
      const valorUnitarioBrutoNF = toNum(r.valorUnitarioBrutoNF);
      const valorUnitarioBrutoPC = toNum(r.valorUnitarioBrutoPC);
      const descontoNF = toNum(r.descontoNF);
      const descontoPC = toNum(r.descontoPC);
      const totalDescNF =
        r.valorTotalComDescontoNF != null
          ? toNum(r.valorTotalComDescontoNF)
          : valorUnitarioBrutoNF * qtdeNF - descontoNF;
      const totalDescPC =
        r.valorTotalComDescontoPC != null
          ? toNum(r.valorTotalComDescontoPC)
          : valorUnitarioBrutoPC * qtdePC - descontoPC;
      const valorUnitarioNF = unitarioLiquidoComDesconto({
        unitarioBruto: valorUnitarioBrutoNF,
        qtde: qtdeNF,
        desconto: descontoNF,
        totalComDesconto: totalDescNF,
      });
      const valorUnitarioPC = unitarioLiquidoComDesconto({
        unitarioBruto: valorUnitarioBrutoPC,
        qtde: qtdePC,
        desconto: descontoPC,
        totalComDesconto: totalDescPC,
      });
      const valorIpiNF = toNum(r.valorIpiNF);
      const valorIpiPC = toNum(r.valorIpiPC);
      const condicaoPagamentoNF = strOrNull(r.condicaoPagamentoNF);
      const regraPagamentoNF = strOrNull(r.regraPagamentoNF);
      const condicaoPagamentoPC = strOrNull(r.condicaoPagamentoPC);
      const regraPagamentoPC = strOrNull(r.regraPagamentoPC);
      const idPedidoCompra = r.idPedidoCompra != null ? toInt(r.idPedidoCompra) : null;
      const dataBaseParcelasPC =
        idPedidoCompra != null ? (dataBasePorPc.get(idPedidoCompra) ?? null) : null;
      const parcelasPC =
        idPedidoCompra != null ? (parcelasPorPc.get(idPedidoCompra) ?? []) : [];
      const prazosDiasPC = parcelasPC.map((p) => p.dias).filter((d): d is number => d != null);
      const prazosLabelPC = labelPrazosDias(prazosDiasPC);
      const divergValorUnitario = !valoresIguaisComparativo(valorUnitarioNF, valorUnitarioPC, 2);
      const divergQtde = !valoresIguaisComparativo(qtdeNF, qtdePC, 4);
      const divergIpi = !valoresIguaisComparativo(valorIpiNF, valorIpiPC, 2);
      const divergCondicaoPagamento = divergenciaCondicaoPorPrazos({
        prazosNF,
        prazosPC: prazosDiasPC,
        condicaoNF: condicaoPagamentoNF,
        regraNF: regraPagamentoNF,
        condicaoPC: condicaoPagamentoPC,
        regraPC: regraPagamentoPC,
      });
      return {
        idItemDocumentoEstoque: toInt(r.idItemDocumentoEstoque),
        idItemPedidoCompra: toInt(r.idItemPedidoCompra),
        idPedidoCompra,
        nomePedidoCompra: strOrNull(r.nomePedidoCompra),
        idProduto: r.idProduto != null ? toInt(r.idProduto) : null,
        codigoProduto: strOrNull(r.codigoProduto),
        descricaoProduto: strOrNull(r.descricaoProduto),
        qtdeNF: arredondarComparativo(qtdeNF, 4),
        umNF: strOrNull(r.umNF),
        qtdePC: arredondarComparativo(qtdePC, 4),
        umPC: strOrNull(r.umPC),
        valorUnitarioBrutoNF: arredondarComparativo(valorUnitarioBrutoNF, 2),
        valorUnitarioBrutoPC: arredondarComparativo(valorUnitarioBrutoPC, 2),
        descontoNF: arredondarComparativo(descontoNF, 2),
        descontoPC: arredondarComparativo(descontoPC, 2),
        valorUnitarioNF: arredondarComparativo(valorUnitarioNF, 2),
        valorUnitarioPC: arredondarComparativo(valorUnitarioPC, 2),
        valorIpiNF: arredondarComparativo(valorIpiNF, 2),
        valorIpiPC: arredondarComparativo(valorIpiPC, 2),
        condicaoPagamentoNF,
        regraPagamentoNF,
        condicaoPagamentoPC,
        regraPagamentoPC,
        dataBaseParcelasNF: dataBaseNF,
        dataBaseParcelasPC,
        parcelasNF,
        parcelasPC,
        prazosDiasNF: prazosNF,
        prazosDiasPC,
        prazosLabelNF,
        prazosLabelPC,
        divergValorUnitario,
        divergQtde,
        divergIpi,
        divergCondicaoPagamento,
        temDivergencia:
          divergValorUnitario || divergQtde || divergIpi || divergCondicaoPagamento,
      };
    });
    return { linhas };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[doubleCheckInRepository] queryDoubleCheckInComparativoPc:', msg);
    return { linhas: [], erro: msg };
  }
}
