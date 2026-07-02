/**
 * DRE 2.1.1.1 / 2.1.1.2 — Devoluções Nomus (Só Aço idEmpresaEntrada=1, Só Móveis=2).
 * Soma valorTotal por dataEmissao.
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getNomusPool, isNomusEnabled } from '../config/nomusDb.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SQL = readFileSync(join(__dirname, 'sql', 'dreDevolucoesNomus.sql'), 'utf-8');

function loadSql(name: string): string {
  return readFileSync(join(__dirname, 'sql', name), 'utf-8');
}

const DEVOLUCOES_DATA_MIN = '2024-01-01';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_EMPRESA_ACO = 1;
const ID_EMPRESA_MOVEIS = 2;
const MAX_DETALHE_LINHAS = 8000;

export type DreDevolucoesLinha = {
  idEmpresaEntrada: number;
  mes: number;
  ano: number;
  dataEmissao: string;
  valorTotal: number;
};

export type DreDevolucoesDetalheLinha = {
  idItemDocumentoEstoque: number;
  idEmpresaEntrada: number;
  dataEmissao: string | null;
  numeroDocumentoFiscal: number | null;
  tipoMovimentacao: string | null;
  idProduto: number | null;
  produto: string | null;
  grupoProduto: string;
  qtde: number;
  valorUnitario: number;
  valorTotal: number;
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

function toDateYmd(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  const s = String(v).trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : s || null;
}

function normalizarEmpresas(idEmpresas?: number[]): number[] {
  const permitidas = new Set([ID_EMPRESA_ACO, ID_EMPRESA_MOVEIS]);
  const src = idEmpresas?.length ? idEmpresas : [ID_EMPRESA_ACO, ID_EMPRESA_MOVEIS];
  return [...new Set(src.filter((id) => permitidas.has(id)))];
}

export async function queryDreDevolucoes(params: {
  dataInicio: string;
  dataFim: string;
  idEmpresas?: number[];
}): Promise<{ linhas: DreDevolucoesLinha[]; erro?: string }> {
  if (!isNomusEnabled()) {
    return { linhas: [], erro: 'Nomus não configurado (NOMUS_DB_URL).' };
  }
  if (!DATE_RE.test(params.dataInicio) || !DATE_RE.test(params.dataFim)) {
    return { linhas: [], erro: 'Datas inválidas (use YYYY-MM-DD).' };
  }

  const empresas = normalizarEmpresas(params.idEmpresas);
  if (!empresas.length) {
    return { linhas: [] };
  }

  const pool = getNomusPool();
  if (!pool) return { linhas: [], erro: 'Pool Nomus indisponível.' };

  try {
    const [rows] = await pool.query(SQL, [
      DEVOLUCOES_DATA_MIN,
      params.dataInicio,
      params.dataFim,
      empresas,
    ]);
    const linhas = (rows as Record<string, unknown>[]).map((r) => ({
      idEmpresaEntrada: toInt(r.idEmpresaEntrada),
      mes: toInt(r.mes),
      ano: toInt(r.ano),
      dataEmissao: toDateYmd(r.dataEmissao) ?? '',
      valorTotal: toNum(r.valorTotal),
    }));
    return { linhas };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[queryDreDevolucoes]', msg);
    return { linhas: [], erro: msg };
  }
}

/** Detalhe item a item das devoluções de uma empresa (Só Aço ou Só Móveis). */
export async function queryDreDevolucoesDetalhe(params: {
  dataInicio: string;
  dataFim: string;
  idEmpresaEntrada: number;
}): Promise<{ detalhes: DreDevolucoesDetalheLinha[]; truncado?: boolean; erro?: string }> {
  if (!isNomusEnabled()) {
    return { detalhes: [], erro: 'Nomus não configurado (NOMUS_DB_URL).' };
  }
  if (!DATE_RE.test(params.dataInicio) || !DATE_RE.test(params.dataFim)) {
    return { detalhes: [], erro: 'Datas inválidas (use YYYY-MM-DD).' };
  }
  const empresa = toInt(params.idEmpresaEntrada);
  if (empresa !== ID_EMPRESA_ACO && empresa !== ID_EMPRESA_MOVEIS) {
    return { detalhes: [] };
  }

  const pool = getNomusPool();
  if (!pool) return { detalhes: [], erro: 'Pool Nomus indisponível.' };

  try {
    const [rows] = await pool.query(loadSql('dreDevolucoesDetalheNomus.sql'), [
      DEVOLUCOES_DATA_MIN,
      params.dataInicio,
      params.dataFim,
      [empresa],
      MAX_DETALHE_LINHAS + 1,
    ]);
    const list = rows as Record<string, unknown>[];
    const truncado = list.length > MAX_DETALHE_LINHAS;
    const slice = truncado ? list.slice(0, MAX_DETALHE_LINHAS) : list;
    const detalhes = slice.map((r) => ({
      idItemDocumentoEstoque: toInt(r.idItemDocumentoEstoque),
      idEmpresaEntrada: toInt(r.idEmpresaEntrada),
      dataEmissao: toDateYmd(r.dataEmissao),
      numeroDocumentoFiscal: r.numeroDocumentoFiscal != null ? toInt(r.numeroDocumentoFiscal) : null,
      tipoMovimentacao: r.tipoMovimentacao != null ? String(r.tipoMovimentacao) : null,
      idProduto: r.idProduto != null ? toInt(r.idProduto) : null,
      produto: r.produto != null ? String(r.produto) : null,
      grupoProduto: String(r.grupoProduto ?? 'Outros').trim() || 'Outros',
      qtde: toNum(r.qtde),
      valorUnitario: toNum(r.valorUnitario),
      valorTotal: toNum(r.valorTotal),
    }));
    return { detalhes, truncado: truncado || undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[queryDreDevolucoesDetalhe]', msg);
    return { detalhes: [], erro: msg };
  }
}
