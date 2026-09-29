/**
 * Diário Financeiro — contas a pagar (Shop9 + Nomus) por data de vencimento.
 * Nomus: empresas 1 e 2, agendamento P e lançamento LP órfão.
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import sql from 'mssql';
import type { ResultSetHeader } from 'mysql2';
import { getShop9Pool, isShop9Enabled } from '../config/shop9Db.js';
import { getNomusPool, isNomusEnabled, queryNomus as executarQueryNomus } from '../config/nomusDb.js';
import { formatSqlDateYmd } from './dfcDateUtils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SQL_SHOP9 = readFileSync(join(__dirname, 'sql', 'diarioContasPagarShop9.sql'), 'utf-8');

/** Só Aço (1) e Só Móveis (2), como no recorte do diário. */
const NOMUS_EMPRESAS = [1, 2];

const SQL_NOMUS = `
SELECT
  lf.idContaBancaria AS idContaBancaria,
  cb.nome AS contaBancaria,
  af.id AS codigoConta,
  af.discriminador AS tipoConta,
  lf.dataLancamento AS dataBaixa,
  af.dataVencimento AS dataVencimento,
  af.descricaoLancamento AS descricaoLancamento,
  CASE
    WHEN COALESCE(af.descricaoLancamento, lf.descricao) = 'DESCONTO DE DUPLICATAS'
         AND af.discriminador = 'P'
      THEN 2
    ELSE COALESCE(af.idContaFinanceiro, lf.idContaFinanceiro)
  END AS idPlanoContas,
  cf.nome AS planoContas,
  COALESCE(td.comentarios, af.comentarios) AS comentarios,
  fp.nome AS formaPagamento,
  af.valorBaixar / COUNT(af.id) OVER (PARTITION BY af.id) AS valorBaixar,
  lf.valor AS valorBaixado,
  af.saldoBaixar / COUNT(af.id) OVER (PARTITION BY af.id) AS saldoBaixar,
  af.idEmpresa AS idEmpresa,
  emp.nome AS empresa,
  pe.nomeRazaoSocial AS nomeRazaoSocial,
  pe.nome AS clienteFornecedor,
  af.id AS idAgendamento
FROM agendamentofinanceiro af
LEFT JOIN lancamentofinanceiro lf
  ON COALESCE(lf.idAgendamentoPagamento, lf.idAgendamentoRecebimento) = af.id
LEFT JOIN pessoa pe ON pe.id = af.idPessoa
LEFT JOIN contafinanceiro cf
  ON cf.id = CASE
    WHEN COALESCE(af.descricaoLancamento, lf.descricao) = 'DESCONTO DE DUPLICATAS'
         AND af.discriminador = 'P'
      THEN 2
    ELSE COALESCE(af.idContaFinanceiro, lf.idContaFinanceiro)
  END
LEFT JOIN contabancaria cb ON cb.id = lf.idContaBancaria
LEFT JOIN empresa emp ON emp.id = af.idEmpresa
LEFT JOIN formapagamento fp ON fp.id = af.idFormaPagamento
LEFT JOIN parcelapagamento pg ON pg.id = af.idParcelaDocumentoSaida
LEFT JOIN (
  SELECT DISTINCT
    idAgendamentoRecebimento,
    CASE
      WHEN comentarios LIKE '%DESCONTADO%' THEN 'DESCONTADO ANTECI'
      ELSE NULL
    END AS comentarios
  FROM lancamentofinanceiro
  WHERE idAgendamentoRecebimento IS NOT NULL
    AND comentarios LIKE '%DESCONTADO%'
) td ON td.idAgendamentoRecebimento = af.id
WHERE af.idEmpresa IN (?, ?)
  AND af.discriminador = 'P'
  AND DATE(af.dataVencimento) BETWEEN ? AND ?
  AND af.idPedidoCompra IS NULL
  AND COALESCE(td.comentarios, af.comentarios, '') NOT LIKE '%DESCONTADO ANTECI%'

UNION ALL

SELECT
  lf.idContaBancaria AS idContaBancaria,
  cb.nome AS contaBancaria,
  COALESCE(af.id, lf.id) AS codigoConta,
  lf.discriminador AS tipoConta,
  lf.dataLancamento AS dataBaixa,
  COALESCE(af.dataVencimento, lf.dataLancamento) AS dataVencimento,
  COALESCE(af.descricaoLancamento, lf.descricao) AS descricaoLancamento,
  CASE
    WHEN COALESCE(af.descricaoLancamento, lf.descricao) = 'DESCONTO DE DUPLICATAS'
         AND lf.discriminador = 'LP'
      THEN 2
    ELSE COALESCE(af.idContaFinanceiro, lf.idContaFinanceiro)
  END AS idPlanoContas,
  cf.nome AS planoContas,
  COALESCE(af.comentarios, lf.comentarios) AS comentarios,
  fp.nome AS formaPagamento,
  af.valorBaixar AS valorBaixar,
  lf.valor AS valorBaixado,
  COALESCE(af.saldoBaixar, 0) AS saldoBaixar,
  COALESCE(af.idEmpresa, lf.idEmpresa) AS idEmpresa,
  emp.nome AS empresa,
  pe.nomeRazaoSocial AS nomeRazaoSocial,
  pe.nome AS clienteFornecedor,
  NULL AS idAgendamento
FROM lancamentofinanceiro lf
LEFT JOIN agendamentofinanceiro af
  ON COALESCE(lf.idAgendamentoPagamento, lf.idAgendamentoRecebimento) = af.id
LEFT JOIN pessoa pe ON pe.id = COALESCE(af.idPessoa, lf.idPessoa)
LEFT JOIN contafinanceiro cf
  ON cf.id = CASE
    WHEN COALESCE(af.descricaoLancamento, lf.descricao) = 'DESCONTO DE DUPLICATAS'
         AND lf.discriminador = 'LP'
      THEN 2
    ELSE COALESCE(af.idContaFinanceiro, lf.idContaFinanceiro)
  END
LEFT JOIN empresa emp ON emp.id = COALESCE(af.idEmpresa, lf.idEmpresa)
LEFT JOIN formapagamento fp ON fp.id = COALESCE(af.idFormaPagamento, lf.idFormaPagamento)
LEFT JOIN parcelapagamento pg ON pg.id = af.idParcelaDocumentoSaida
LEFT JOIN contabancaria cb ON cb.id = lf.idContaBancaria
WHERE lf.idEmpresa IN (?, ?)
  AND af.id IS NULL
  AND lf.discriminador = 'LP'
  AND DATE(COALESCE(af.dataVencimento, lf.dataLancamento)) BETWEEN ? AND ?
`.trim();

export type DiarioContaPagarStatus = 'Em aberto' | 'Baixado';

export interface DiarioContaPagarLinha {
  origem: 'Shop9' | 'Nomus';
  codigo: number;
  status: DiarioContaPagarStatus;
  dataVencimento: string | null;
  dataBaixa: string | null;
  fornecedor: string | null;
  empresa: string | null;
  filial: string | null;
  planoContas: string | null;
  descricao: string | null;
  observacao: string | null;
  formaPagamento: string | null;
  contaBancaria: string | null;
  valor: number;
  valorBaixado: number;
  saldo: number;
  /** Nomus: agendamentofinanceiro.id. Nulo no lançamento LP sem agendamento. Shop9 não usa. */
  idAgendamento: number | null;
}

function toNum(v: unknown): number {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function texto(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function primeiroTexto(...vals: unknown[]): string | null {
  for (const v of vals) {
    const s = texto(v);
    if (s) return s;
  }
  return null;
}

function statusNomus(dataBaixa: string | null): DiarioContaPagarStatus {
  return dataBaixa ? 'Baixado' : 'Em aberto';
}

function mapShop9(row: Record<string, unknown>): DiarioContaPagarLinha {
  const statusRaw = texto(row.statusBaixa);
  const status: DiarioContaPagarStatus = statusRaw === 'Baixado' ? 'Baixado' : 'Em aberto';
  return {
    origem: 'Shop9',
    codigo: toNum(row.ordemFinanceira ?? row.codigoConta),
    status,
    dataVencimento: formatSqlDateYmd(row.dataVencimento),
    dataBaixa: formatSqlDateYmd(row.dataBaixa),
    fornecedor: primeiroTexto(row.clienteFornecedor, row.nomeRazaoSocial),
    empresa: texto(row.empresa),
    filial: texto(row.nomeFilial),
    planoContas: texto(row.planoContas),
    descricao: texto(row.descricaoLancamento),
    observacao: null,
    formaPagamento: null,
    contaBancaria: null,
    valor: toNum(row.valorTotalCalculado),
    valorBaixado: toNum(row.valorBaixado),
    saldo: toNum(row.saldoBaixar),
    idAgendamento: null,
  };
}

function mapNomus(row: Record<string, unknown>): DiarioContaPagarLinha {
  const dataBaixa = formatSqlDateYmd(row.dataBaixa);
  const valorBaixar = toNum(row.valorBaixar);
  const valorBaixado = toNum(row.valorBaixado);
  const saldo = toNum(row.saldoBaixar);
  return {
    origem: 'Nomus',
    codigo: toNum(row.codigoConta),
    status: statusNomus(dataBaixa),
    dataVencimento: formatSqlDateYmd(row.dataVencimento),
    dataBaixa,
    fornecedor: primeiroTexto(row.clienteFornecedor, row.nomeRazaoSocial),
    empresa: texto(row.empresa),
    filial: null,
    planoContas: texto(row.planoContas),
    descricao: texto(row.descricaoLancamento),
    observacao: texto(row.comentarios),
    formaPagamento: texto(row.formaPagamento),
    contaBancaria: texto(row.contaBancaria),
    valor: valorBaixar > 0 ? valorBaixar : valorBaixado + saldo,
    valorBaixado,
    saldo,
    idAgendamento: toNum(row.idAgendamento) > 0 ? toNum(row.idAgendamento) : null,
  };
}

async function queryShop9(dataInicio: string, dataFim: string): Promise<{ linhas: DiarioContaPagarLinha[]; erro?: string }> {
  if (!isShop9Enabled()) return { linhas: [], erro: 'Shop9 não configurado' };
  const pool = await getShop9Pool();
  if (!pool) return { linhas: [], erro: 'Shop9: falha ao conectar' };
  try {
    const req = pool.request();
    req.input('dataInicio', sql.Date, new Date(`${dataInicio}T12:00:00`));
    req.input('dataFim', sql.Date, new Date(`${dataFim}T12:00:00`));
    const result = await req.query(SQL_SHOP9);
    const list = Array.isArray(result.recordset) ? result.recordset : [];
    return { linhas: list.map((r) => mapShop9(r as Record<string, unknown>)) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[diarioContasPagar] Shop9:', msg);
    return { linhas: [], erro: msg };
  }
}

async function queryNomus(dataInicio: string, dataFim: string): Promise<{ linhas: DiarioContaPagarLinha[]; erro?: string }> {
  const params = [...NOMUS_EMPRESAS, dataInicio, dataFim, ...NOMUS_EMPRESAS, dataInicio, dataFim];
  try {
    const [rows] = await executarQueryNomus<Record<string, unknown>[]>(SQL_NOMUS, params);
    const list = Array.isArray(rows) ? rows : [];
    return { linhas: list.map((r) => mapNomus(r)) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[diarioContasPagar] Nomus:', msg);
    return { linhas: [], erro: msg };
  }
}

export async function queryDiarioContasPagar(params: {
  dataInicio: string;
  dataFim: string;
}): Promise<{
  linhas: DiarioContaPagarLinha[];
  erroShop9?: string;
  erroNomus?: string;
}> {
  const [shop9, nomus] = await Promise.all([
    queryShop9(params.dataInicio, params.dataFim),
    queryNomus(params.dataInicio, params.dataFim),
  ]);
  const linhas = [...shop9.linhas, ...nomus.linhas].sort((a, b) => {
    const dv = (a.dataVencimento ?? '').localeCompare(b.dataVencimento ?? '');
    if (dv !== 0) return dv;
    const fo = (a.fornecedor ?? '').localeCompare(b.fornecedor ?? '', 'pt-BR');
    if (fo !== 0) return fo;
    return a.origem.localeCompare(b.origem);
  });
  return {
    linhas,
    erroShop9: shop9.erro,
    erroNomus: nomus.erro,
  };
}

const MAX_REPROGRAMAR = 400;

export interface ReprogramarVencimentoItem {
  origem: 'Nomus' | 'Shop9';
  id: number;
}

export interface ReprogramarVencimentoIgnorado {
  origem: 'Nomus' | 'Shop9';
  id: number;
  motivo: string;
}

export interface ReprogramarVencimentoResultado {
  dataVencimento: string;
  atualizados: number;
  ignorados: ReprogramarVencimentoIgnorado[];
  erroNomus?: string;
  erroShop9?: string;
}

/**
 * Nomus: `agendamentofinanceiro.dataVencimento` e, na primeira vez,
 * `descricaoLancamento`. Sempre WHERE id do agendamento.
 * Shop9: `Financeiro_Contas.Data_Vencimento` e, na primeira vez, `Descricao`.
 * Sempre WHERE Ordem. Baixado não entra.
 */
const SQL_NOMUS_ELEGIVEL = `
SELECT af.descricaoLancamento AS descricao, af.dataVencimento AS dataVencimento
FROM agendamentofinanceiro af
WHERE af.id = ?
  AND af.discriminador = 'P'
  AND af.idEmpresa IN (1, 2)
  AND af.idPedidoCompra IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM lancamentofinanceiro lf
    WHERE COALESCE(lf.idAgendamentoPagamento, lf.idAgendamentoRecebimento) = af.id
      AND lf.dataLancamento IS NOT NULL
  )
LIMIT 1
`;

const SQL_UPDATE_NOMUS_DATA = `
UPDATE agendamentofinanceiro af
SET af.dataVencimento = ?
WHERE af.id = ?
  AND af.discriminador = 'P'
  AND af.idEmpresa IN (1, 2)
  AND af.idPedidoCompra IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM lancamentofinanceiro lf
    WHERE COALESCE(lf.idAgendamentoPagamento, lf.idAgendamentoRecebimento) = af.id
      AND lf.dataLancamento IS NOT NULL
  )
`;

const SQL_UPDATE_NOMUS_DATA_E_DESCRICAO = `
UPDATE agendamentofinanceiro af
SET af.dataVencimento = ?, af.descricaoLancamento = ?
WHERE af.id = ?
  AND af.discriminador = 'P'
  AND af.idEmpresa IN (1, 2)
  AND af.idPedidoCompra IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM lancamentofinanceiro lf
    WHERE COALESCE(lf.idAgendamentoPagamento, lf.idAgendamentoRecebimento) = af.id
      AND lf.dataLancamento IS NOT NULL
  )
`;

const SQL_SHOP9_ELEGIVEL = `
SELECT TOP 1 fc.Descricao AS descricao, fc.Data_Vencimento AS dataVencimento
FROM Financeiro_Contas fc
WHERE fc.Ordem = @ordem
  AND fc.Pagar_Receber = 'P'
  AND fc.Situacao = 'A'
  AND (fc.Descricao IS NULL OR fc.Descricao NOT LIKE '%conta pai%')
`;

const SQL_UPDATE_SHOP9_DATA = `
UPDATE Financeiro_Contas
SET Data_Vencimento = @dataVencimento
WHERE Ordem = @ordem
  AND Pagar_Receber = 'P'
  AND Situacao = 'A'
  AND (Descricao IS NULL OR Descricao NOT LIKE '%conta pai%')
`;

const SQL_UPDATE_SHOP9_DATA_E_DESCRICAO = `
UPDATE Financeiro_Contas
SET Data_Vencimento = @dataVencimento, Descricao = @descricao
WHERE Ordem = @ordem
  AND Pagar_Receber = 'P'
  AND Situacao = 'A'
  AND (Descricao IS NULL OR Descricao NOT LIKE '%conta pai%')
`;

function ymdParaBr(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Null quando a descrição já foi marcada; senão o texto completo da primeira reprogramação. */
function descricaoPrimeiraReprogramacao(descricaoAtual: unknown, vencimentoAtual: unknown): string | null {
  const atual = descricaoAtual == null ? '' : String(descricaoAtual).trim();
  if (/reprogramado/i.test(atual)) return null;
  const ymd = formatSqlDateYmd(vencimentoAtual);
  if (!ymd) return null;
  const prefixo = `REPROGRAMADO - VENC ORIGINAL ${ymdParaBr(ymd)} - `;
  return atual ? `${prefixo}${atual}` : `REPROGRAMADO - VENC ORIGINAL ${ymdParaBr(ymd)}`;
}

const MOTIVO_IGNORADO = 'Título baixado, inexistente ou fora do contas a pagar em aberto.';

function idsUnicos(itens: ReprogramarVencimentoItem[], origem: 'Nomus' | 'Shop9'): number[] {
  const set = new Set<number>();
  for (const item of itens) {
    if (item.origem !== origem) continue;
    if (!Number.isInteger(item.id) || item.id <= 0) continue;
    set.add(item.id);
  }
  return [...set];
}

async function reprogramarNomus(
  ids: number[],
  dataVencimento: string,
): Promise<{ atualizados: number; ignorados: ReprogramarVencimentoIgnorado[]; erro?: string }> {
  if (ids.length === 0) return { atualizados: 0, ignorados: [] };
  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) {
    return { atualizados: 0, ignorados: [], erro: 'Nomus não configurado' };
  }
  const connection = await pool.getConnection();
  const ignorados: ReprogramarVencimentoIgnorado[] = [];
  let atualizados = 0;
  try {
    await connection.beginTransaction();
    for (const id of ids) {
      const [found] = await connection.query(SQL_NOMUS_ELEGIVEL, [id]);
      const row = Array.isArray(found) ? (found[0] as Record<string, unknown> | undefined) : undefined;
      if (!row) {
        ignorados.push({ origem: 'Nomus', id, motivo: MOTIVO_IGNORADO });
        continue;
      }
      const novaDescricao = descricaoPrimeiraReprogramacao(row.descricao, row.dataVencimento);
      const [result] = novaDescricao
        ? await connection.execute(SQL_UPDATE_NOMUS_DATA_E_DESCRICAO, [dataVencimento, novaDescricao, id])
        : await connection.execute(SQL_UPDATE_NOMUS_DATA, [dataVencimento, id]);
      let affected = (result as ResultSetHeader).affectedRows ?? 0;
      if (affected === 0) {
        const [again] = await connection.query(SQL_NOMUS_ELEGIVEL, [id]);
        if (Array.isArray(again) && again.length > 0) affected = 1;
      }
      if (affected > 0) atualizados += 1;
      else ignorados.push({ origem: 'Nomus', id, motivo: MOTIVO_IGNORADO });
    }
    await connection.commit();
    return { atualizados, ignorados };
  } catch (err) {
    try {
      await connection.rollback();
    } catch {
      /* rollback best-effort */
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[diarioContasPagar] reprogramar Nomus:', msg);
    return { atualizados: 0, ignorados: [], erro: msg };
  } finally {
    connection.release();
  }
}

async function reprogramarShop9(
  ids: number[],
  dataVencimento: string,
): Promise<{ atualizados: number; ignorados: ReprogramarVencimentoIgnorado[]; erro?: string }> {
  if (ids.length === 0) return { atualizados: 0, ignorados: [] };
  if (!isShop9Enabled()) return { atualizados: 0, ignorados: [], erro: 'Shop9 não configurado' };
  const pool = await getShop9Pool();
  if (!pool) return { atualizados: 0, ignorados: [], erro: 'Shop9: falha ao conectar' };
  const data = new Date(`${dataVencimento}T12:00:00`);
  const transaction = new sql.Transaction(pool);
  const ignorados: ReprogramarVencimentoIgnorado[] = [];
  let atualizados = 0;
  try {
    await transaction.begin();
    for (const ordem of ids) {
      const leitura = new sql.Request(transaction);
      leitura.input('ordem', sql.Int, ordem);
      const found = await leitura.query(SQL_SHOP9_ELEGIVEL);
      const row = found.recordset?.[0] as Record<string, unknown> | undefined;
      if (!row) {
        ignorados.push({ origem: 'Shop9', id: ordem, motivo: MOTIVO_IGNORADO });
        continue;
      }
      const novaDescricao = descricaoPrimeiraReprogramacao(row.descricao, row.dataVencimento);
      const req = new sql.Request(transaction);
      req.input('dataVencimento', sql.Date, data);
      req.input('ordem', sql.Int, ordem);
      if (novaDescricao) req.input('descricao', sql.NVarChar(sql.MAX), novaDescricao);
      const result = await req.query(novaDescricao ? SQL_UPDATE_SHOP9_DATA_E_DESCRICAO : SQL_UPDATE_SHOP9_DATA);
      let affected = result.rowsAffected?.[0] ?? 0;
      if (affected === 0) {
        const check = new sql.Request(transaction);
        check.input('ordem', sql.Int, ordem);
        const still = await check.query(SQL_SHOP9_ELEGIVEL);
        if ((still.recordset?.length ?? 0) > 0) affected = 1;
      }
      if (affected > 0) atualizados += 1;
      else ignorados.push({ origem: 'Shop9', id: ordem, motivo: MOTIVO_IGNORADO });
    }
    await transaction.commit();
    return { atualizados, ignorados };
  } catch (err) {
    try {
      await transaction.rollback();
    } catch {
      /* rollback best-effort */
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[diarioContasPagar] reprogramar Shop9:', msg);
    return { atualizados: 0, ignorados: [], erro: msg };
  }
}

export async function reprogramarVencimentoContasPagar(params: {
  dataVencimento: string;
  itens: ReprogramarVencimentoItem[];
}): Promise<ReprogramarVencimentoResultado> {
  const idsNomus = idsUnicos(params.itens, 'Nomus');
  const idsShop9 = idsUnicos(params.itens, 'Shop9');
  const [nomus, shop9] = await Promise.all([
    reprogramarNomus(idsNomus, params.dataVencimento),
    reprogramarShop9(idsShop9, params.dataVencimento),
  ]);
  return {
    dataVencimento: params.dataVencimento,
    atualizados: nomus.atualizados + shop9.atualizados,
    ignorados: [...nomus.ignorados, ...shop9.ignorados],
    erroNomus: nomus.erro,
    erroShop9: shop9.erro,
  };
}

export { MAX_REPROGRAMAR };
