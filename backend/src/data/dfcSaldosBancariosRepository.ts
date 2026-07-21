/**
 * DFC — saldos iniciais/finais das contas bancárias (LF Nomus).
 * Duas agregações SQL (abertura + movimento diário) e série diária em memória.
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getNomusPool } from '../config/nomusDb.js';
import { formatSqlDateYmd } from './dfcDateUtils.js';
import { ehContaBancariaInativaDfc } from './dfcContasCaixaConstantes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SQL_MOV = readFileSync(join(__dirname, 'sql', 'dfcSaldosBancarios.sql'), 'utf-8');
const SQL_ABERTURA = readFileSync(join(__dirname, 'sql', 'dfcSaldosBancariosAbertura.sql'), 'utf-8');

const DATA_MIN = '2015-01-01';
const CACHE_MS = 120_000;
let cacheKey = '';
let cacheLinhas: DfcSaldoBancarioLinha[] = [];
let cacheAt = 0;

export interface DfcSaldoBancarioLinha {
  dataLancamento: string;
  idEmpresa: number;
  idContaBancaria: number;
  nomeContaBancaria: string;
  saldoInicial: number;
  valorLancamento: number;
  saldoFinal: number;
}

function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toInt(v: unknown): number {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : 0;
}

/** Uma série por conta (como PARTITION BY idContaBancaria no SQL). */
function contaChave(idConta: number): string {
  return String(idConta);
}

function parseYmd(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt;
}

function ymdFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function listarDias(dataInicio: string, dataFim: string): string[] {
  const ini = parseYmd(dataInicio);
  const fim = parseYmd(dataFim);
  if (!ini || !fim || fim < ini) return [];
  const out: string[] = [];
  for (let cur = new Date(ini); cur <= fim; cur = addDays(cur, 1)) {
    out.push(ymdFromDate(cur));
  }
  return out;
}

type ContaMeta = { idEmpresa: number; idContaBancaria: number; nomeContaBancaria: string };

function montarSerieDiaria(
  dataInicio: string,
  dataFim: string,
  abertura: Map<string, number>,
  movPorContaDia: Map<string, Map<string, number>>,
  contas: Map<string, ContaMeta>,
): DfcSaldoBancarioLinha[] {
  const dias = listarDias(dataInicio, dataFim);
  const linhas: DfcSaldoBancarioLinha[] = [];

  for (const [chave, meta] of contas) {
    let last = abertura.get(chave) ?? 0;
    const movDias = movPorContaDia.get(chave) ?? new Map();

    for (const ymd of dias) {
      const mov = movDias.get(ymd) ?? 0;
      const saldoInicial = last;
      const saldoFinal = saldoInicial + mov;
      linhas.push({
        dataLancamento: ymd,
        idEmpresa: meta.idEmpresa,
        idContaBancaria: meta.idContaBancaria,
        nomeContaBancaria: meta.nomeContaBancaria,
        saldoInicial,
        valorLancamento: mov,
        saldoFinal,
      });
      last = saldoFinal;
    }
  }

  return linhas;
}

export async function queryDfcSaldosBancarios(params: {
  dataInicio: string;
  dataFim: string;
}): Promise<{ linhas: DfcSaldoBancarioLinha[]; erro?: string }> {
  const dataInicio = params.dataInicio.trim();
  const dataFim = params.dataFim.trim();
  const key = `${dataInicio}|${dataFim}`;
  const now = Date.now();
  if (key === cacheKey && now - cacheAt < CACHE_MS) {
    return { linhas: cacheLinhas };
  }

  const pool = getNomusPool();
  if (!pool) {
    return { linhas: [], erro: 'NOMUS_DB_URL não configurado' };
  }

  const movInicio = dataInicio < DATA_MIN ? DATA_MIN : dataInicio;

  try {
    const [[rowsAbertura], [rowsMov]] = await Promise.all([
      pool.query(SQL_ABERTURA, [dataInicio]),
      pool.query(SQL_MOV, [movInicio, dataFim]),
    ]);

    const abertura = new Map<string, number>();
    const contas = new Map<string, ContaMeta>();
    const movPorContaDia = new Map<string, Map<string, number>>();

    for (const r of (Array.isArray(rowsAbertura) ? rowsAbertura : []) as Record<string, unknown>[]) {
      const idEmpresa = toInt(r.idEmpresa);
      const idConta = toInt(r.idContaBancaria);
      const nome = String(r.nomeContaBancaria ?? '').trim();
      if (!idConta || !nome || ehContaBancariaInativaDfc(idConta, nome)) continue;
      const chave = contaChave(idConta);
      abertura.set(chave, (abertura.get(chave) ?? 0) + toNum(r.saldoAbertura));
      if (!contas.has(chave)) {
        contas.set(chave, { idEmpresa, idContaBancaria: idConta, nomeContaBancaria: nome });
      }
    }

    for (const r of (Array.isArray(rowsMov) ? rowsMov : []) as Record<string, unknown>[]) {
      const ymd = formatSqlDateYmd(r.dataLancamento);
      if (!ymd) continue;
      const idEmpresa = toInt(r.idEmpresa);
      const idConta = toInt(r.idContaBancaria);
      const nome = String(r.nomeContaBancaria ?? '').trim();
      if (!idConta || !nome || ehContaBancariaInativaDfc(idConta, nome)) continue;
      const chave = contaChave(idConta);
      if (!contas.has(chave)) {
        contas.set(chave, { idEmpresa, idContaBancaria: idConta, nomeContaBancaria: nome });
      }
      if (!movPorContaDia.has(chave)) movPorContaDia.set(chave, new Map());
      const diaMap = movPorContaDia.get(chave)!;
      diaMap.set(ymd, (diaMap.get(ymd) ?? 0) + toNum(r.valorLancamento));
    }

    const linhas = montarSerieDiaria(dataInicio, dataFim, abertura, movPorContaDia, contas);
    cacheKey = key;
    cacheLinhas = linhas;
    cacheAt = Date.now();
    return { linhas };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[dfcSaldosBancariosRepository] queryDfcSaldosBancarios:', msg);
    return { linhas: [], erro: msg };
  }
}
