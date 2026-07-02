/**
 * DRE 6.2.1 CPV Direto (Só Móveis): custo por item faturado (PSM).
 * Nomus: última entrada antes da NF → custoTotal = qtde × custoUnitarioEntrada.
 * Shop9 (fallback): última COM (SM%, filiais 5/6) antes de dataEmissao → qtde (Nomus) × Preco_Unitario (Shop9).
 * Fallback final: valorTotal × 0,41 (41% do faturamento como custo).
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import sql from 'mssql';
import { getNomusPool, isNomusEnabled } from '../config/nomusDb.js';
import { getShop9Pool, isShop9Enabled } from '../config/shop9Db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SQL_NOMUS = readFileSync(join(__dirname, 'sql', 'dreCpvMoveisDiretoNomus.sql'), 'utf-8');
const SQL_SHOP9 = readFileSync(join(__dirname, 'sql', 'dreCpvMoveisDiretoShop9Entradas.sql'), 'utf-8');

const PSM_PEDIDO_EMISAO_MIN = '2024-01-01';
const ID_EMPRESA_MOVEIS = 2;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Custo estimado = 41% do faturamento (valorTotal × 0,41). Equivale à regra preço = custo ÷ 0,41. */
const FATOR_CUSTO_SOBRE_FATURAMENTO = 0.41;

export type DreCpvMoveisDiretoLinha = {
  mes: number;
  ano: number;
  dataEmissao: string;
  custoTotal: number;
};

type NomusItemRow = {
  idItemDocumentoEstoque: number;
  dataEmissao: string;
  mes: number;
  ano: number;
  qtde: number;
  codigoProduto: string;
  valorTotal: number;
  custoTotal: number | null;
};

type Shop9EntradaIdx = { dataMs: number; preco: number };

function loadSqlNomus(): string {
  return SQL_NOMUS;
}

function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : Number(v);
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

function ymdToMs(ymd: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return 0;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999).getTime();
}

function normalizeCodigoProduto(v: unknown): string {
  return String(v ?? '')
    .trim()
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function custoNomusValido(v: unknown): number | null {
  const n = toNum(v);
  return n > 0 ? n : null;
}

function custoEstimadoPorFaturamento(valorTotal: number): number | null {
  if (valorTotal <= 0) return null;
  return Math.round(valorTotal * FATOR_CUSTO_SOBRE_FATURAMENTO * 100) / 100;
}

function buildShop9Index(rows: Record<string, unknown>[]): Map<string, Shop9EntradaIdx[]> {
  const map = new Map<string, Shop9EntradaIdx[]>();
  for (const r of rows) {
    const cod = normalizeCodigoProduto(r.codigoProduto);
    const ymd = toDateYmd(r.dataMovimento);
    const preco = toNum(r.precoUnitario);
    if (!cod || !ymd || preco <= 0) continue;
    const dataMs = ymdToMs(ymd);
    if (!map.has(cod)) map.set(cod, []);
    map.get(cod)!.push({ dataMs, preco });
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => b.dataMs - a.dataMs);
  }
  return map;
}

function ultimoPrecoShop9(
  index: Map<string, Shop9EntradaIdx[]>,
  codigoProduto: string,
  dataEmissao: string,
): number | null {
  const arr = index.get(normalizeCodigoProduto(codigoProduto));
  if (!arr?.length) return null;
  const alvo = ymdToMs(dataEmissao);
  for (const e of arr) {
    if (e.dataMs <= alvo) return e.preco;
  }
  return null;
}

async function carregarItensNomus(
  dataInicio: string,
  dataFim: string,
  idEmpresa: number,
): Promise<NomusItemRow[]> {
  const pool = getNomusPool();
  if (!pool) return [];

  const args = [
    PSM_PEDIDO_EMISAO_MIN,
    idEmpresa,
    dataInicio,
    dataFim,
    idEmpresa,
    idEmpresa,
  ];
  const [rows] = await pool.query(loadSqlNomus(), args);
  return (rows as Record<string, unknown>[]).map((r) => ({
    idItemDocumentoEstoque: toInt(r.idItemDocumentoEstoque),
    dataEmissao: toDateYmd(r.dataEmissao) ?? '',
    mes: toInt(r.mes),
    ano: toInt(r.ano),
    qtde: toNum(r.qtde),
    codigoProduto: String(r.codigoProduto ?? r.produto ?? '').trim(),
    valorTotal: toNum(r.valorTotal),
    custoTotal: custoNomusValido(r.custoTotal),
  }));
}

async function carregarEntradasShop9(dataFim: string): Promise<Map<string, Shop9EntradaIdx[]>> {
  const pool = await getShop9Pool();
  if (!pool) return new Map();

  const req = pool.request();
  req.input('dataFim', sql.DateTime, new Date(`${dataFim}T23:59:59`));
  const result = await req.query(SQL_SHOP9);
  const list = Array.isArray(result.recordset) ? result.recordset : [];
  return buildShop9Index(list as Record<string, unknown>[]);
}

function agregarLinhas(
  itens: { mes: number; ano: number; dataEmissao: string; custoTotal: number }[],
): DreCpvMoveisDiretoLinha[] {
  const map = new Map<string, DreCpvMoveisDiretoLinha>();
  for (const item of itens) {
    if (item.custoTotal <= 0 || !item.mes || !item.ano || !item.dataEmissao) continue;
    const k = `${item.ano}\t${item.mes}\t${item.dataEmissao}`;
    const prev = map.get(k);
    map.set(k, {
      mes: item.mes,
      ano: item.ano,
      dataEmissao: item.dataEmissao,
      custoTotal: Math.round(((prev?.custoTotal ?? 0) + item.custoTotal) * 100) / 100,
    });
  }
  return [...map.values()].sort((a, b) => a.dataEmissao.localeCompare(b.dataEmissao));
}

export async function queryDreCpvMoveisDireto(params: {
  dataInicio: string;
  dataFim: string;
  idEmpresaSaida?: number;
}): Promise<{ linhas: DreCpvMoveisDiretoLinha[]; erro?: string; aviso?: string }> {
  if (!isNomusEnabled()) {
    return { linhas: [], erro: 'Nomus não configurado (NOMUS_DB_URL).' };
  }
  if (!DATE_RE.test(params.dataInicio) || !DATE_RE.test(params.dataFim)) {
    return { linhas: [], erro: 'Datas inválidas (use YYYY-MM-DD).' };
  }

  const idEmpresa = params.idEmpresaSaida ?? ID_EMPRESA_MOVEIS;
  if (!Number.isFinite(idEmpresa) || idEmpresa <= 0) {
    return { linhas: [], erro: 'idEmpresaSaida inválido.' };
  }

  try {
    const nomusItens = await carregarItensNomus(params.dataInicio, params.dataFim, idEmpresa);
    const precisaShop9 = nomusItens.some((i) => i.custoTotal == null && i.qtde > 0 && i.codigoProduto);

    let shop9Index = new Map<string, Shop9EntradaIdx[]>();
    let aviso: string | undefined;
    if (precisaShop9 && isShop9Enabled()) {
      shop9Index = await carregarEntradasShop9(params.dataFim);
    }

    let semCusto = 0;
    let estimados41 = 0;
    const calculados: { mes: number; ano: number; dataEmissao: string; custoTotal: number }[] = [];

    for (const item of nomusItens) {
      if (!item.dataEmissao) {
        semCusto += 1;
        continue;
      }

      if (item.custoTotal != null && item.custoTotal > 0) {
        calculados.push({
          mes: item.mes,
          ano: item.ano,
          dataEmissao: item.dataEmissao,
          custoTotal: item.custoTotal,
        });
        continue;
      }

      if (item.qtde > 0 && item.codigoProduto) {
        const precoUnit = ultimoPrecoShop9(shop9Index, item.codigoProduto, item.dataEmissao);
        if (precoUnit != null && precoUnit > 0) {
          calculados.push({
            mes: item.mes,
            ano: item.ano,
            dataEmissao: item.dataEmissao,
            custoTotal: Math.round(item.qtde * precoUnit * 100) / 100,
          });
          continue;
        }
      }

      const estimado = custoEstimadoPorFaturamento(item.valorTotal);
      if (estimado != null && estimado > 0) {
        calculados.push({
          mes: item.mes,
          ano: item.ano,
          dataEmissao: item.dataEmissao,
          custoTotal: estimado,
        });
        estimados41 += 1;
        continue;
      }

      semCusto += 1;
    }

    const avisos: string[] = [];
    if (estimados41 > 0) {
      avisos.push(
        `${estimados41} item(ns) com custo estimado (41% do valorTotal — sem entrada Nomus/Shop9).`,
      );
    }
    if (semCusto > 0) {
      avisos.push(`${semCusto} item(ns) sem custo (sem Nomus, Shop9 nem faturamento para estimar).`);
    }
    if (avisos.length) aviso = avisos.join(' ');

    return { linhas: agregarLinhas(calculados), aviso };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[queryDreCpvMoveisDireto]', msg);
    return { linhas: [], erro: msg };
  }
}
