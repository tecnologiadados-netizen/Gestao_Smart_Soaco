/**
 * DRE — Receita Bruta e CMV Shop9 (Movimento), por data de emissão NF.
 *
 * Filial 1 (indireto, split vendedor):
 *   1.5 / 2.1.3.3 / 6.4 PAULO/JAQUELINE (Só Refrigeração)
 *   1.6.2 / 2.1.3.4 (soma filial 1+6) / 6.3.2 demais vendedores (R N Marques)
 *
 * Filial 6 (direto):
 *   1.6.1 Faturamento Direto (Preco_Total_Sem_Desconto_Somado)
 *   2.1.3.4 Desconto R N Marques (Desconto_Valor_Somado)
 *   2.1.1.4 Devolução R N Marques filial 6 DEV (Preco_Final_Somado)
 *   6.3.1 CMV Direto (Preco_Custo_Somado; se custo > preço → preço × 0,41 — no SQL)
 */
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getShop9Pool, isShop9Enabled } from '../config/shop9Db.js';
import {
  DFC_NOMUS_EMPRESA_REFRIGERACAO,
  DFC_NOMUS_EMPRESA_RN_MARQUES,
} from './dfcShop9Empresa.js';
import { formatSqlDateYmd } from './dfcDateUtils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SQL_FILIAL1 = readFileSync(join(__dirname, 'sql', 'dreShop9ReceitaRefrigeracao.sql'), 'utf-8');
const SQL_FILIAL1_DEVOLUCOES = readFileSync(
  join(__dirname, 'sql', 'dreShop9DevolucoesRefrigeracao.sql'),
  'utf-8',
);
const SQL_FILIAL6 = readFileSync(
  join(__dirname, 'sql', 'dreShop9ReceitaRefrigeracaoFilial6.sql'),
  'utf-8',
);
const SQL_FILIAL6_DEVOLUCOES = readFileSync(
  join(__dirname, 'sql', 'dreShop9DevolucoesRnMarques.sql'),
  'utf-8',
);

const CODIGO_DRE_SO_REFRIGERACAO = '1.5';
const CODIGO_DRE_DEVOLUCAO_SO_REFRIGERACAO = '2.1.1.3';
const CODIGO_DRE_DEVOLUCAO_RN_MARQUES = '2.1.1.4';
const CODIGO_DRE_DESCONTO_SO_REFRIGERACAO = '2.1.3.3';
const CODIGO_DRE_RN_MARQUES_DIRETO = '1.6.1';
const CODIGO_DRE_DESCONTO_RN_MARQUES = '2.1.3.4';
const CODIGO_DRE_RN_MARQUES_INDIRETO = '1.6.2';
const CODIGO_DRE_CMV_RN_MARQUES_DIRETO = '6.3.1';
const CODIGO_DRE_CMV_RN_MARQUES_INDIRETO = '6.3.2';
const CODIGO_DRE_CMV_SO_REFRIGERACAO = '6.4';

export type DreReceitaRefrigeracaoAgregado = {
  pathKey: string;
  periodo: string;
  valor: number;
};

function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function aplicarSql(sql: string, dataInicio: string, dataFim: string): string {
  return sql
    .replace(/\{\{DATA_EMISSAO_MIN\}\}/g, dataInicio)
    .replace(/\{\{DATA_EMISSAO_MAX\}\}/g, dataFim);
}

function resolverPathKeyPorCodigo(codigo: string): string | null {
  const paths = [
    join(process.cwd(), 'frontend/src/pages/financeiro/dre/estruturaDreArvore.json'),
    join(process.cwd(), '..', 'frontend/src/pages/financeiro/dre/estruturaDreArvore.json'),
  ];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    const raw = JSON.parse(readFileSync(p, 'utf-8')) as {
      roots?: { codigo?: string; pathKey?: string; children?: unknown[] }[];
    };
    function walk(nodes: { codigo?: string; pathKey?: string; children?: unknown[] }[]): string | null {
      for (const n of nodes) {
        if (n.codigo === codigo && n.pathKey) return n.pathKey;
        const achado = walk((n.children ?? []) as typeof nodes);
        if (achado) return achado;
      }
      return null;
    }
    const pk = walk(raw.roots ?? []);
    if (pk) return pk;
  }
  return null;
}

/** Vendedores alocados em Só Refrigeração (1.5 / 6.4). */
export function vendedorEhRefrigeracaoDre(nome: unknown): boolean {
  const n = String(nome ?? '')
    .trim()
    .toUpperCase();
  return n === 'PAULO' || n === 'JAQUELINE';
}

/** CMV direto filial 6 — espelha a regra do SQL (Preco_Custo_Somado já vem ajustado). */
export function custoDiretoFilial6Shop9(precoFinal: number, precoCusto: number): number {
  if (precoCusto > precoFinal && precoFinal > 0) return precoFinal * 0.41;
  return precoCusto > 0 ? precoCusto : 0;
}

type PathKeysShop9 = {
  refrigeracao: string | null;
  devolucaoRefrigeracao: string | null;
  descontoRefrigeracao: string | null;
  rnMarquesDireto: string | null;
  descontoRnMarques: string | null;
  devolucaoRnMarques: string | null;
  rnMarquesIndireto: string | null;
  cmvRnMarquesDireto: string | null;
  cmvRnMarquesIndireto: string | null;
  cmvRefrigeracao: string | null;
};

function resolverPathKeys(incluirRefrigeracao: boolean, incluirRnMarques: boolean): PathKeysShop9 {
  return {
    refrigeracao: incluirRefrigeracao ? resolverPathKeyPorCodigo(CODIGO_DRE_SO_REFRIGERACAO) : null,
    devolucaoRefrigeracao: incluirRefrigeracao
      ? resolverPathKeyPorCodigo(CODIGO_DRE_DEVOLUCAO_SO_REFRIGERACAO)
      : null,
    descontoRefrigeracao: incluirRefrigeracao
      ? resolverPathKeyPorCodigo(CODIGO_DRE_DESCONTO_SO_REFRIGERACAO)
      : null,
    rnMarquesDireto: incluirRnMarques ? resolverPathKeyPorCodigo(CODIGO_DRE_RN_MARQUES_DIRETO) : null,
    descontoRnMarques: incluirRnMarques ? resolverPathKeyPorCodigo(CODIGO_DRE_DESCONTO_RN_MARQUES) : null,
    devolucaoRnMarques: incluirRnMarques
      ? resolverPathKeyPorCodigo(CODIGO_DRE_DEVOLUCAO_RN_MARQUES)
      : null,
    rnMarquesIndireto: incluirRnMarques ? resolverPathKeyPorCodigo(CODIGO_DRE_RN_MARQUES_INDIRETO) : null,
    cmvRnMarquesDireto: incluirRnMarques ? resolverPathKeyPorCodigo(CODIGO_DRE_CMV_RN_MARQUES_DIRETO) : null,
    cmvRnMarquesIndireto: incluirRnMarques
      ? resolverPathKeyPorCodigo(CODIGO_DRE_CMV_RN_MARQUES_INDIRETO)
      : null,
    cmvRefrigeracao: incluirRefrigeracao ? resolverPathKeyPorCodigo(CODIGO_DRE_CMV_SO_REFRIGERACAO) : null,
  };
}

function validarPathKeys(
  incluirRefrigeracao: boolean,
  incluirRnMarques: boolean,
  keys: PathKeysShop9,
): string | null {
  if (incluirRefrigeracao && !keys.refrigeracao) return 'PathKey DRE 1.5 (Só Refrigeração) não encontrado';
  if (incluirRefrigeracao && !keys.devolucaoRefrigeracao) {
    return 'PathKey DRE 2.1.1.3 (Devolução Só Refrigeração) não encontrado';
  }
  if (incluirRefrigeracao && !keys.descontoRefrigeracao) {
    return 'PathKey DRE 2.1.3.3 (Desconto Só Refrigeração) não encontrado';
  }
  if (incluirRefrigeracao && !keys.cmvRefrigeracao) {
    return 'PathKey DRE 6.4 (CMV Só Refrigeração) não encontrado';
  }
  if (incluirRnMarques && !keys.rnMarquesDireto) return 'PathKey DRE 1.6.1 (Faturamento Direto) não encontrado';
  if (incluirRnMarques && !keys.descontoRnMarques) {
    return 'PathKey DRE 2.1.3.4 (Desconto R N Marques) não encontrado';
  }
  if (incluirRnMarques && !keys.devolucaoRnMarques) {
    return 'PathKey DRE 2.1.1.4 (Devolução R N Marques) não encontrado';
  }
  if (incluirRnMarques && !keys.rnMarquesIndireto) {
    return 'PathKey DRE 1.6.2 (Faturamento Indireto) não encontrado';
  }
  if (incluirRnMarques && !keys.cmvRnMarquesDireto) {
    return 'PathKey DRE 6.3.1 (CMV Direto) não encontrado';
  }
  if (incluirRnMarques && !keys.cmvRnMarquesIndireto) {
    return 'PathKey DRE 6.3.2 (CMV Indireto) não encontrado';
  }
  return null;
}

function agregarShop9(
  agregado: Map<string, number>,
  pathKey: string | null,
  periodo: string,
  valor: number,
): void {
  if (!pathKey || valor <= 0) return;
  const k = `${pathKey}\t${periodo}`;
  agregado.set(k, (agregado.get(k) ?? 0) + valor);
}

function processarFilial1(
  list: Record<string, unknown>[],
  keys: PathKeysShop9,
  incluirRefrigeracao: boolean,
  incluirRnMarques: boolean,
  granularidade: 'dia' | 'mes',
  agregado: Map<string, number>,
): void {
  const vistoOrdem = new Set<number>();

  for (const row of list) {
    const ordem = Math.trunc(toNum(row.Ordem ?? row.ordem));
    if (ordem > 0 && vistoOrdem.has(ordem)) continue;
    if (ordem > 0) vistoOrdem.add(ordem);

    const ymd = formatSqlDateYmd(row.Data_Emissao ?? row.dataEmissao);
    if (!ymd) continue;
    const periodo = granularidade === 'mes' ? ymd.slice(0, 7) : ymd;

    const ehRefrigeracao = vendedorEhRefrigeracaoDre(row.Nome_Vendedor ?? row.nomeVendedor);

    if (ehRefrigeracao && incluirRefrigeracao) {
      const valorReceitaBruta = toNum(
        row.Preco_Total_Sem_Desconto_Somado ?? row.precoTotalSemDescontoSomado,
      );
      const valorDesconto = toNum(row.Desconto_Valor_Somado ?? row.descontoValorSomado);
      const valorCusto = toNum(row.Preco_Custo_Somado ?? row.precoCustoSomado);
      if (valorReceitaBruta <= 0 && valorDesconto <= 0 && valorCusto <= 0) continue;

      agregarShop9(agregado, keys.refrigeracao, periodo, valorReceitaBruta);
      agregarShop9(agregado, keys.descontoRefrigeracao, periodo, valorDesconto);
      agregarShop9(agregado, keys.cmvRefrigeracao, periodo, valorCusto);
    } else if (!ehRefrigeracao && incluirRnMarques) {
      const valorReceitaBruta = toNum(
        row.Preco_Total_Sem_Desconto_Somado ?? row.precoTotalSemDescontoSomado,
      );
      const valorDesconto = toNum(row.Desconto_Valor_Somado ?? row.descontoValorSomado);
      const valorCusto = toNum(row.Preco_Custo_Somado ?? row.precoCustoSomado);
      if (valorReceitaBruta <= 0 && valorDesconto <= 0 && valorCusto <= 0) continue;

      agregarShop9(agregado, keys.rnMarquesIndireto, periodo, valorReceitaBruta);
      agregarShop9(agregado, keys.descontoRnMarques, periodo, valorDesconto);
      agregarShop9(agregado, keys.cmvRnMarquesIndireto, periodo, valorCusto);
    }
  }
}

function processarFilial1Devolucoes(
  list: Record<string, unknown>[],
  keys: PathKeysShop9,
  incluirRefrigeracao: boolean,
  granularidade: 'dia' | 'mes',
  agregado: Map<string, number>,
): void {
  if (!incluirRefrigeracao) return;

  const vistoOrdem = new Set<number>();

  for (const row of list) {
    const ordem = Math.trunc(toNum(row.Ordem ?? row.ordem));
    if (ordem > 0 && vistoOrdem.has(ordem)) continue;
    if (ordem > 0) vistoOrdem.add(ordem);

    const ymd = formatSqlDateYmd(row.Data_Emissao ?? row.dataEmissao);
    if (!ymd) continue;
    const periodo = granularidade === 'mes' ? ymd.slice(0, 7) : ymd;

    const valorDevolucao = Math.abs(toNum(row.Preco_Final_Somado ?? row.precoFinalSomado));
    if (valorDevolucao <= 0) continue;

    agregarShop9(agregado, keys.devolucaoRefrigeracao, periodo, valorDevolucao);
  }
}

function processarFilial6(
  list: Record<string, unknown>[],
  keys: PathKeysShop9,
  incluirRnMarques: boolean,
  granularidade: 'dia' | 'mes',
  agregado: Map<string, number>,
): void {
  if (!incluirRnMarques) return;

  const vistoOrdem = new Set<number>();

  for (const row of list) {
    const ordem = Math.trunc(toNum(row.Ordem ?? row.ordem));
    if (ordem > 0 && vistoOrdem.has(ordem)) continue;
    if (ordem > 0) vistoOrdem.add(ordem);

    const ymd = formatSqlDateYmd(row.Data_Emissao ?? row.dataEmissao);
    if (!ymd) continue;
    const periodo = granularidade === 'mes' ? ymd.slice(0, 7) : ymd;

    const valorReceitaBruta = toNum(
      row.Preco_Total_Sem_Desconto_Somado ?? row.precoTotalSemDescontoSomado,
    );
    const valorDesconto = toNum(row.Desconto_Valor_Somado ?? row.descontoValorSomado);
    const valorCusto = toNum(row.Preco_Custo_Somado ?? row.precoCustoSomado);
    if (valorReceitaBruta <= 0 && valorDesconto <= 0 && valorCusto <= 0) continue;

    agregarShop9(agregado, keys.rnMarquesDireto, periodo, valorReceitaBruta);
    agregarShop9(agregado, keys.descontoRnMarques, periodo, valorDesconto);
    agregarShop9(agregado, keys.cmvRnMarquesDireto, periodo, valorCusto);
  }
}

function processarFilial6Devolucoes(
  list: Record<string, unknown>[],
  keys: PathKeysShop9,
  incluirRnMarques: boolean,
  granularidade: 'dia' | 'mes',
  agregado: Map<string, number>,
): void {
  if (!incluirRnMarques) return;

  const vistoOrdem = new Set<number>();

  for (const row of list) {
    const ordem = Math.trunc(toNum(row.Ordem ?? row.ordem));
    if (ordem > 0 && vistoOrdem.has(ordem)) continue;
    if (ordem > 0) vistoOrdem.add(ordem);

    const ymd = formatSqlDateYmd(row.Data_Emissao ?? row.dataEmissao);
    if (!ymd) continue;
    const periodo = granularidade === 'mes' ? ymd.slice(0, 7) : ymd;

    const valorDevolucao = Math.abs(toNum(row.Preco_Final_Somado ?? row.precoFinalSomado));
    if (valorDevolucao <= 0) continue;

    agregarShop9(agregado, keys.devolucaoRnMarques, periodo, valorDevolucao);
  }
}

export async function carregarReceitaRefrigeracaoShop9Dre(params: {
  dataInicio: string;
  dataFim: string;
  idEmpresas: number[];
  granularidade?: 'dia' | 'mes';
}): Promise<{ linhas: DreReceitaRefrigeracaoAgregado[]; erro?: string }> {
  const incluirRefrigeracao = params.idEmpresas.includes(DFC_NOMUS_EMPRESA_REFRIGERACAO);
  const incluirRnMarques = params.idEmpresas.includes(DFC_NOMUS_EMPRESA_RN_MARQUES);
  if (!incluirRefrigeracao && !incluirRnMarques) {
    return { linhas: [] };
  }
  if (!isShop9Enabled()) {
    return { linhas: [], erro: 'Shop9: SHOP9_DB_* não configurado' };
  }

  const keys = resolverPathKeys(incluirRefrigeracao, incluirRnMarques);
  const erroPath = validarPathKeys(incluirRefrigeracao, incluirRnMarques, keys);
  if (erroPath) return { linhas: [], erro: erroPath };

  const pool = await getShop9Pool();
  if (!pool) {
    return { linhas: [], erro: 'Shop9: falha ao conectar' };
  }

  const granularidade = params.granularidade ?? 'mes';
  const agregado = new Map<string, number>();

  try {
    const sqlFilial1 = aplicarSql(SQL_FILIAL1, params.dataInicio, params.dataFim);
    const resultFilial1 = await pool.query(sqlFilial1);
    const listFilial1 = Array.isArray(resultFilial1.recordset)
      ? (resultFilial1.recordset as Record<string, unknown>[])
      : [];
    processarFilial1(listFilial1, keys, incluirRefrigeracao, incluirRnMarques, granularidade, agregado);

    const sqlFilial1Devolucoes = aplicarSql(SQL_FILIAL1_DEVOLUCOES, params.dataInicio, params.dataFim);
    const resultFilial1Devolucoes = await pool.query(sqlFilial1Devolucoes);
    const listFilial1Devolucoes = Array.isArray(resultFilial1Devolucoes.recordset)
      ? (resultFilial1Devolucoes.recordset as Record<string, unknown>[])
      : [];
    processarFilial1Devolucoes(
      listFilial1Devolucoes,
      keys,
      incluirRefrigeracao,
      granularidade,
      agregado,
    );

    const sqlFilial6 = aplicarSql(SQL_FILIAL6, params.dataInicio, params.dataFim);
    const resultFilial6 = await pool.query(sqlFilial6);
    const listFilial6 = Array.isArray(resultFilial6.recordset)
      ? (resultFilial6.recordset as Record<string, unknown>[])
      : [];
    processarFilial6(listFilial6, keys, incluirRnMarques, granularidade, agregado);

    const sqlFilial6Devolucoes = aplicarSql(SQL_FILIAL6_DEVOLUCOES, params.dataInicio, params.dataFim);
    const resultFilial6Devolucoes = await pool.query(sqlFilial6Devolucoes);
    const listFilial6Devolucoes = Array.isArray(resultFilial6Devolucoes.recordset)
      ? (resultFilial6Devolucoes.recordset as Record<string, unknown>[])
      : [];
    processarFilial6Devolucoes(listFilial6Devolucoes, keys, incluirRnMarques, granularidade, agregado);

    const linhas: DreReceitaRefrigeracaoAgregado[] = [...agregado.entries()].map(([k, valor]) => {
      const [pathKey, periodo] = k.split('\t');
      return { pathKey: pathKey!, periodo: periodo!, valor: Math.round(valor * 100) / 100 };
    });

    return { linhas };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[dreShop9ReceitaRefrigeracaoRepository]', msg);
    return { linhas: [], erro: msg };
  }
}
