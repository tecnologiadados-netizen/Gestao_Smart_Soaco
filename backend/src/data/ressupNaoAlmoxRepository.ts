/**
 * Repositório Nomus + helpers para Ressup Não Almox.
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getNomusPool } from '../config/nomusDb.js';
import { termoParaPadraoLikeSql } from '../utils/textoLivreBusca.js';
import {
  buildEmpJoinSqlNaoAlmox,
  SQL_REGISTRO_COLETA_BASE,
  SQL_REGISTRO_COLETA_LEVE,
} from './sqlRegistroColetaPrecos.js';
import {
  buildMapCodigosPintados,
  loadRessupNaoAlmoxCatalogo,
  normalizarCodProduto,
} from './ressupNaoAlmoxCatalogRepository.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SQL_VM = readFileSync(join(__dirname, 'sql', 'ressupNaoAlmoxVm.sql'), 'utf-8');
const SQL_ESTOQUE = readFileSync(join(__dirname, 'sql', 'ressupNaoAlmoxEstoque.sql'), 'utf-8');
const SQL_SALDO_PA_EXPLOSAO_SCALAR = readFileSync(
  join(__dirname, 'sql', 'ressupNaoAlmoxSaldoPaExplosaoScalar.sql'),
  'utf-8'
).trim();
const SQL_SALDO_PA_EXPLOSAO_CORRELACIONADO = SQL_SALDO_PA_EXPLOSAO_SCALAR.replace(
  /__CORREL__/g,
  'pq.idProdutoComponente'
);

export const RESSUP_NAO_ALMOX_COLETAS = [
  'ISOPOR',
  'TANQUES DE RESFRIADORES',
  'LAMIPRO/POLIPROPLENO',
  'AGLOMERADOS E COMPENSADOS',
  'FUNDÍVEIS',
] as const;

/** Coletas em que o setor 2 (almox secundário) não entra no saldo. */
export const COLETAS_EXCLUIR_SETOR2_ALMOX = [
  'ISOPOR',
  'LAMIPRO/POLIPROPLENO',
  'AGLOMERADOS E COMPENSADOS',
] as const;

export const SETOR_ALMOX_SECUNDARIO = 2;

export interface EstoqueSetorLinha {
  tipo: string;
  id_setor: number;
  nome_setor: string;
  saldo: number;
}

export function coletaExcluiSetor2Almox(coleta: string | null | undefined): boolean {
  const n = (coleta ?? '').trim().toUpperCase();
  return COLETAS_EXCLUIR_SETOR2_ALMOX.some((c) => c.toUpperCase() === n);
}

async function obterColetaProduto(
  pool: NonNullable<ReturnType<typeof getNomusPool>>,
  idProduto: number
): Promise<string | null> {
  const [rows] = await pool.query<Record<string, unknown>[]>(
    `Select alo.opcao
     From atributoprodutovalor apv
     Left Join atributolistaopcao alo On alo.id = apv.idListaOpcao
     Where apv.idProduto = ? And apv.idAtributo = 650
     Limit 1`,
    [idProduto]
  );
  const list = Array.isArray(rows) ? rows : [];
  const opcao = list[0]?.opcao != null ? String(list[0].opcao).trim() : '';
  return opcao || null;
}

function filtrarSetoresPorColeta(
  setores: EstoqueSetorLinha[],
  coleta: string | null
): EstoqueSetorLinha[] {
  if (!coletaExcluiSetor2Almox(coleta)) return setores;
  return setores.filter((s) => s.id_setor !== SETOR_ALMOX_SECUNDARIO);
}

/** Atributo Nomus "tipo de material" (Matéria Prima, Embalagem, etc.). */
export const RESSUP_NAO_ALMOX_ATTR_TIPO_MATERIAL = 540;

/** Tipos de material elegíveis (valores exatos do Nomus, attr 540). */
export const RESSUP_NAO_ALMOX_TIPOS_MATERIAL = ['Matéria Prima', 'Embalagem', 'Material Secundário'] as const;

/** @deprecated Use RESSUP_NAO_ALMOX_TIPOS_MATERIAL */
export const RESSUP_NAO_ALMOX_SUBGRUPO1 = RESSUP_NAO_ALMOX_TIPOS_MATERIAL;

const SQL_JOIN_TIPO_MATERIAL = `
  Select apv.idProduto, alo.opcao
  From atributoprodutovalor apv
  Left Join atributolistaopcao alo On alo.id = apv.idListaOpcao
  Where apv.idAtributo = ${RESSUP_NAO_ALMOX_ATTR_TIPO_MATERIAL}
`.trim();

const SQL_FROM_PRODUTOS_ELEGIVEIS = `
From produto p
Inner Join tipoproduto tp On p.idTipoProduto = tp.id
Inner Join (
${SQL_JOIN_TIPO_MATERIAL}
) tm On tm.idProduto = p.id
Inner Join (
  Select apv.idProduto, alo.opcao
  From atributoprodutovalor apv
  Left Join atributolistaopcao alo On alo.id = apv.idListaOpcao
  Where apv.idAtributo = 650
) nc On nc.idProduto = p.id
Where p.ativo = 1
  And tp.nome = 'Materia prima'
  And tm.opcao In (${RESSUP_NAO_ALMOX_TIPOS_MATERIAL.map(() => '?').join(', ')})
  And nc.opcao In (${RESSUP_NAO_ALMOX_COLETAS.map(() => '?').join(', ')})
`.trim();

const SQL_PRODUTOS_ELEGIVEIS = `
Select
  p.id As idProduto,
  p.nome As codigoProduto,
  Upper(p.descricao) As descricaoProduto,
  Coalesce(nc.opcao, 'A DEFINIR') As nomeColeta
${SQL_FROM_PRODUTOS_ELEGIVEIS}
`.trim();

const ELEGIBILIDADE_PARAMS = [...RESSUP_NAO_ALMOX_TIPOS_MATERIAL, ...RESSUP_NAO_ALMOX_COLETAS];

const BUSCA_OPCOES_LIMITE = 80;

const JOINS_EXTRA = `
  Left Join (
    ${SQL_VM.trim()}
  ) vm On vm.idProduto = p.id
  Inner Join (
${SQL_JOIN_TIPO_MATERIAL}
  ) tmfilt On tmfilt.idProduto = p.id
`;

function adaptSqlForRessupNaoAlmox(baseSql: string): string {
  let sql = baseSql.replace(
    /coalesce\(agpag\.quantidade,0\) as 'Ag Pag'/i,
    "coalesce(agpag.quantidade,0) as 'Ag Pag',\n  Coalesce(vm.VM, 0) As 'VM'"
  );
  sql = sql.replace(
    /  left join usuario u on u\.id = sco\.idUsuario\r?\nWhere\r?\n  \(p\.idTipoProduto In \(5, 13, 14, 6, 10, 16, 21, 22\)\)/i,
    `${JOINS_EXTRA}\n  left join usuario u on u.id = sco.idUsuario\nWhere\n  (p.ativo = 1)\n  And (tp.nome = 'Materia prima')\n  And (tmfilt.opcao In (${RESSUP_NAO_ALMOX_TIPOS_MATERIAL.map(() => '?').join(', ')}))\n  And (Coalesce(nc.opcao, 'A DEFINIR') In (${RESSUP_NAO_ALMOX_COLETAS.map(() => '?').join(', ')}))`
  );
  return sql;
}

const EMP_JOIN_START = '\n  Left Join\n  (Select pq.idProdutoComponente As idprod,';
const EMP_JOIN_END = '  Group By p.id) empd On empd.idprod = p.id\n';

function replaceEmpJoinSql(baseSql: string, considerarRequisicoes: boolean): string {
  const i = baseSql.indexOf(EMP_JOIN_START);
  const j = baseSql.indexOf(EMP_JOIN_END);
  if (i === -1 || j === -1 || j < i) return baseSql;
  const newJoin = buildEmpJoinSqlNaoAlmox(considerarRequisicoes, SQL_SALDO_PA_EXPLOSAO_CORRELACIONADO);
  return baseSql.slice(0, i) + newJoin + baseSql.slice(j + EMP_JOIN_END.length);
}

function buildSqlRessupNaoAlmoxRegistro(
  considerarRequisicoes: boolean,
  leve: boolean
): string {
  const base = leve ? SQL_REGISTRO_COLETA_LEVE : SQL_REGISTRO_COLETA_BASE;
  return adaptSqlForRessupNaoAlmox(replaceEmpJoinSql(base, considerarRequisicoes));
}

export const SQL_RESSUP_NAO_ALMOX_REGISTRO = buildSqlRessupNaoAlmoxRegistro(false, false);
export const SQL_RESSUP_NAO_ALMOX_REGISTRO_LEVE = buildSqlRessupNaoAlmoxRegistro(false, true);

export type RessupNaoAlmoxModoConsulta = 'leve' | 'completo';

export interface FiltrosRessupNaoAlmox {
  codigo?: string;
  descricao?: string;
  coleta?: string;
  codigos?: string[];
  descricoes?: string[];
  coletas?: string[];
  apenasComSolicitacao?: boolean;
}

export interface OpcoesFiltroRessupNaoAlmox {
  codigos: string[];
  descricoes: string[];
  coletas: string[];
  items: { codigo: string; descricao: string; coleta: string }[];
}

function dedupTermos(arr?: string[]): string[] {
  if (!Array.isArray(arr)) return [];
  const set = new Set<string>();
  for (const x of arr) {
    if (typeof x !== 'string') continue;
    const t = x.trim();
    if (t) set.add(t);
  }
  return [...set];
}

function buildOptionalFilters(
  filtros: FiltrosRessupNaoAlmox,
  omitir?: 'codigo' | 'descricao' | 'coleta'
): { conditions: string[]; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  const codigos = omitir === 'codigo' ? [] : dedupTermos(filtros.codigos);
  const descricoes = omitir === 'descricao' ? [] : dedupTermos(filtros.descricoes);
  const coletas = omitir === 'coleta' ? [] : dedupTermos(filtros.coletas);

  if (codigos.length > 0) {
    const ors: string[] = [];
    for (const c of codigos) {
      ors.push('(p.nome LIKE ? OR CAST(p.id AS CHAR) = ?)');
      params.push(termoParaPadraoLikeSql(c), c);
    }
    conditions.push(`(${ors.join(' Or ')})`);
  } else if (omitir !== 'codigo' && filtros.codigo?.trim()) {
    const c = filtros.codigo.trim();
    conditions.push('(p.nome LIKE ? OR CAST(p.id AS CHAR) = ?)');
    params.push(termoParaPadraoLikeSql(c), c);
  }

  if (descricoes.length > 0) {
    const ors: string[] = [];
    for (const d of descricoes) {
      ors.push('Upper(p.descricao) LIKE ?');
      params.push(termoParaPadraoLikeSql(d.toUpperCase()));
    }
    conditions.push(`(${ors.join(' Or ')})`);
  } else if (omitir !== 'descricao' && filtros.descricao?.trim()) {
    const d = filtros.descricao.trim().toUpperCase();
    conditions.push('Upper(p.descricao) LIKE ?');
    params.push(termoParaPadraoLikeSql(d));
  }

  if (coletas.length > 0) {
    const coletasElegiveis = new Set<string>(RESSUP_NAO_ALMOX_COLETAS);
    const todasColetas =
      coletas.length >= RESSUP_NAO_ALMOX_COLETAS.length &&
      coletas.every((c) => coletasElegiveis.has(c));
    if (!todasColetas) {
      const ors: string[] = [];
      for (const co of coletas) {
        ors.push("Coalesce(nc.opcao, 'A DEFINIR') = ?");
        params.push(co);
      }
      conditions.push(`(${ors.join(' Or ')})`);
    }
  } else if (omitir !== 'coleta' && filtros.coleta?.trim()) {
    const co = filtros.coleta.trim();
    conditions.push("Coalesce(nc.opcao, 'A DEFINIR') LIKE ?");
    params.push(termoParaPadraoLikeSql(co));
  }

  if (filtros.apenasComSolicitacao === true) {
    conditions.push('(sco.quantidadesolicitada Is Not Null And sco.quantidadesolicitada > 0)');
  }

  return { conditions, params };
}

function deduplicarFundiveis(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const { fundiveis } = loadRessupNaoAlmoxCatalogo();
  const pintados = buildMapCodigosPintados(fundiveis);
  const vmByCodigo = new Map<string, number>();

  for (const r of rows) {
    const cod = String(r['Codigo do Produto'] ?? r.codigo ?? '').trim();
    const vm = Number(r['VM'] ?? r.vm ?? 0);
    if (cod) vmByCodigo.set(normalizarCodProduto(cod), Number.isFinite(vm) ? vm : 0);
  }

  const kept: Record<string, unknown>[] = [];

  for (const r of rows) {
    const cod = normalizarCodProduto(String(r['Codigo do Produto'] ?? r.codigo ?? ''));
    if (!cod) {
      kept.push(r);
      continue;
    }
    if (pintados.has(cod)) continue;

    const codPintado = fundiveis[cod];
    if (codPintado) {
      const vmPintado = vmByCodigo.get(normalizarCodProduto(codPintado)) ?? 0;
      const vmSem = Number(r['VM'] ?? 0);
      r['VM'] = Math.round((vmSem + vmPintado) * 100) / 100;
      r['_codigoPintado'] = normalizarCodProduto(codPintado);
    }
    kept.push(r);
  }

  return kept;
}

export async function listarOpcoesFiltroRessupNaoAlmox(): Promise<{
  data: OpcoesFiltroRessupNaoAlmox;
  erro?: string;
}> {
  const pool = getNomusPool();
  if (!pool) {
    return { data: { codigos: [], descricoes: [], coletas: [], items: [] }, erro: 'NOMUS_DB_URL não configurado' };
  }
  try {
    const sql = `Select Distinct Coalesce(nc.opcao, 'A DEFINIR') As nomeColeta ${SQL_FROM_PRODUTOS_ELEGIVEIS} Order By nomeColeta`;
    const [rows] = await pool.query<Record<string, unknown>[]>(sql, ELEGIBILIDADE_PARAMS);
    const coletasSet = new Set<string>(RESSUP_NAO_ALMOX_COLETAS);
    for (const r of Array.isArray(rows) ? rows : []) {
      const coleta = String(r.nomeColeta ?? '').trim();
      if (coleta) coletasSet.add(coleta);
    }
    const coletas = [...coletasSet].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return { data: { codigos: [], descricoes: [], coletas, items: [] } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ressupNaoAlmoxRepository] listarOpcoesFiltro:', msg);
    return { data: { codigos: [], descricoes: [], coletas: [], items: [] }, erro: msg };
  }
}

/** Cascata server-side: recalcula coletas conforme código/descrição já escolhidos. */
export async function listarOpcoesFiltroCascataRessupNaoAlmox(
  filtros: FiltrosRessupNaoAlmox
): Promise<{ data: OpcoesFiltroRessupNaoAlmox; erro?: string }> {
  const pool = getNomusPool();
  if (!pool) {
    return { data: { codigos: [], descricoes: [], coletas: [], items: [] }, erro: 'NOMUS_DB_URL não configurado' };
  }
  try {
    const { conditions, params: cascadeParams } = buildOptionalFilters(filtros, 'coleta');
    const cascadeSql = conditions.length > 0 ? ` And ${conditions.join(' And ')}` : '';
    const sql = `Select Distinct Coalesce(nc.opcao, 'A DEFINIR') As nomeColeta ${SQL_FROM_PRODUTOS_ELEGIVEIS}${cascadeSql} Order By nomeColeta`;
    const [rows] = await pool.query<Record<string, unknown>[]>(sql, [...ELEGIBILIDADE_PARAMS, ...cascadeParams]);
    const coletasSet = new Set<string>(RESSUP_NAO_ALMOX_COLETAS);
    for (const r of Array.isArray(rows) ? rows : []) {
      const coleta = String(r.nomeColeta ?? '').trim();
      if (coleta) coletasSet.add(coleta);
    }
    const coletas = [...coletasSet].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return { data: { codigos: [], descricoes: [], coletas, items: [] } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ressupNaoAlmoxRepository] listarOpcoesFiltroCascata:', msg);
    return { data: { codigos: [], descricoes: [], coletas: [], items: [] }, erro: msg };
  }
}

export async function buscarOpcoesFiltroCampoRessupNaoAlmox(
  campo: 'codigo' | 'descricao',
  termo: string,
  filtros: FiltrosRessupNaoAlmox
): Promise<{ data: string[]; erro?: string }> {
  const pool = getNomusPool();
  if (!pool) {
    return { data: [], erro: 'NOMUS_DB_URL não configurado' };
  }
  const q = termo.trim();
  if (q.length < 2) {
    return { data: [] };
  }

  const { conditions, params: cascadeParams } = buildOptionalFilters(filtros, campo);
  const cascadeSql = conditions.length > 0 ? ` And ${conditions.join(' And ')}` : '';
  const buscaSql =
    campo === 'codigo'
      ? ` And (p.nome Like ? Or Cast(p.id As Char) = ?)`
      : ` And Upper(p.descricao) Like ?`;
  const buscaParams =
    campo === 'codigo'
      ? [termoParaPadraoLikeSql(q), q]
      : [termoParaPadraoLikeSql(q.toUpperCase())];
  const selectExpr = campo === 'codigo' ? 'p.nome' : 'Upper(p.descricao)';
  const sql = `Select Distinct ${selectExpr} As v ${SQL_FROM_PRODUTOS_ELEGIVEIS}${cascadeSql}${buscaSql} Order By v Limit ${BUSCA_OPCOES_LIMITE}`;

  try {
    const [rows] = await pool.query<Record<string, unknown>[]>(sql, [
      ...ELEGIBILIDADE_PARAMS,
      ...cascadeParams,
      ...buscaParams,
    ]);
    const data = (Array.isArray(rows) ? rows : [])
      .map((r) => String(r.v ?? '').trim())
      .filter(Boolean);
    return { data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ressupNaoAlmoxRepository] buscarOpcoesFiltroCampo:', msg);
    return { data: [], erro: msg };
  }
}

export async function buscarRegistroRessupNaoAlmoxComFiltros(
  filtros: FiltrosRessupNaoAlmox,
  modo: RessupNaoAlmoxModoConsulta = 'completo',
  considerarRequisicoes = false
): Promise<{ rows: Record<string, unknown>[]; erro?: string }> {
  const pool = getNomusPool();
  if (!pool) return { rows: [], erro: 'NOMUS_DB_URL não configurado' };

  const { conditions, params: filterParams } = buildOptionalFilters(filtros);
  const base = buildSqlRessupNaoAlmoxRegistro(considerarRequisicoes, modo === 'leve');
  const eligParams = [...ELEGIBILIDADE_PARAMS];
  const sqlParts = [base];
  if (conditions.length > 0) {
    sqlParts.push(`And ${conditions.join(' And ')}`);
  }
  const sql = sqlParts.join('\n');
  const params = [...eligParams, ...filterParams];

  try {
    const [rows] = await pool.query<Record<string, unknown>[]>(sql, params);
    const list = Array.isArray(rows) ? rows : [];
    return { rows: deduplicarFundiveis(list) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ressupNaoAlmoxRepository] buscarRegistro:', msg);
    return { rows: [], erro: msg };
  }
}

/** Saldo de PA em unidades de componente (explosão BOM setor 5) — mesma regra do modal de estoque. */
export async function obterSaldoPaExplosao(idProduto: number): Promise<{ saldo: number; erro?: string }> {
  const pool = getNomusPool();
  if (!pool) return { saldo: 0, erro: 'NOMUS_DB_URL não configurado' };
  if (!Number.isFinite(idProduto) || idProduto <= 0) {
    return { saldo: 0, erro: 'idProduto inválido.' };
  }
  try {
    const sql = SQL_SALDO_PA_EXPLOSAO_SCALAR.replace(/__CORREL__/g, '?');
    const [rows] = await pool.query<Record<string, unknown>[]>(sql, [idProduto]);
    const list = Array.isArray(rows) ? rows : [];
    const raw = list[0];
    const keys = raw ? Object.keys(raw) : [];
    const saldo = raw && keys.length > 0 ? Number(raw[keys[0]] ?? 0) : 0;
    return { saldo: Number.isFinite(saldo) ? saldo : 0 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ressupNaoAlmoxRepository] obterSaldoPaExplosao:', msg);
    return { saldo: 0, erro: msg };
  }
}

export async function buscarEstoqueProdutoNaoAlmox(
  idProduto: number
): Promise<{ setores: EstoqueSetorLinha[]; erro?: string }> {
  const pool = getNomusPool();
  if (!pool) return { setores: [], erro: 'NOMUS_DB_URL não configurado' };
  if (!Number.isFinite(idProduto) || idProduto <= 0) {
    return { setores: [], erro: 'idProduto inválido.' };
  }
  try {
    const coleta = await obterColetaProduto(pool, idProduto);
    const [rows] = await pool.query<Record<string, unknown>[]>(SQL_ESTOQUE, [
      idProduto,
      idProduto,
      idProduto,
    ]);
    const setores = filtrarSetoresPorColeta(
      (Array.isArray(rows) ? rows : []).map((r) => ({
        tipo: String(r.tipo ?? 'SETOR'),
        id_setor: Number(r.id_setor ?? 0),
        nome_setor: String(r.nome_setor ?? '').trim(),
        saldo: Number(r.saldo ?? 0),
      })),
      coleta
    );
    return { setores };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ressupNaoAlmoxRepository] buscarEstoque:', msg);
    return { setores: [], erro: msg };
  }
}

export async function resolverIdProdutoPorCodigo(
  codigo: string
): Promise<{ idProduto: number | null; erro?: string }> {
  const pool = getNomusPool();
  if (!pool) return { idProduto: null, erro: 'NOMUS_DB_URL não configurado' };
  const cod = codigo.trim();
  if (!cod) return { idProduto: null };
  try {
    const [rows] = await pool.query<Record<string, unknown>[]>(
      'SELECT id FROM produto WHERE nome = ? AND ativo = 1 LIMIT 1',
      [cod]
    );
    const list = Array.isArray(rows) ? rows : [];
    const id = list[0]?.id != null ? Number(list[0].id) : null;
    return { idProduto: id && Number.isFinite(id) ? id : null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { idProduto: null, erro: msg };
  }
}
