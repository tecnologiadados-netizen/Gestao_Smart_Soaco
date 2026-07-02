import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getNomusPool, isNomusEnabled } from '../config/nomusDb.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export type ProgramacaoProducaoGradeRow = {
  id_componente: number;
  cod_componente: string;
  descricao_componente: string;
  peso_unitario_bobina: number | null;
  estoque_atual_componente: number;
  empenho_componente: number;
  venda_media_componente: number;
  cod_bobina: string | null;
  descricao_bobina: string | null;
  id_bobina: number | null;
  estoque_atual_bobina: number | null;
  kg_bobina_necessario: number | null;
  saldo_projetado: number | null;
  cobertura_meses: number | null;
};

export type EstoqueSetorRow = {
  id_setor: number;
  nome_setor: string;
  saldo: number;
};

export type ExplosaoPaRow = {
  cod_pa: string;
  descricao_pa: string;
  qtde_alocada: number;
};

const sqlCache = new Map<string, string>();

function resolveDataSqlPath(filename: string): string {
  const candidates = [
    join(__dirname, filename),
    join(process.cwd(), 'src', 'data', filename),
    join(process.cwd(), 'dist', 'data', filename),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error(`Arquivo ${filename} não encontrado.`);
}

function getSql(filename: string): string {
  const cached = sqlCache.get(filename);
  if (cached) return cached;
  const sql = readFileSync(resolveDataSqlPath(filename), 'utf-8').trim();
  sqlCache.set(filename, sql);
  return sql;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function mapGradeRow(r: Record<string, unknown>): ProgramacaoProducaoGradeRow {
  return {
    id_componente: num(r.id_componente),
    cod_componente: String(r.cod_componente ?? ''),
    descricao_componente: String(r.descricao_componente ?? ''),
    peso_unitario_bobina: numOrNull(r.peso_unitario_bobina),
    estoque_atual_componente: num(r.estoque_atual_componente),
    empenho_componente: num(r.empenho_componente),
    venda_media_componente: num(r.venda_media_componente),
    cod_bobina: strOrNull(r.cod_bobina),
    descricao_bobina: strOrNull(r.descricao_bobina),
    id_bobina: r.id_bobina != null ? num(r.id_bobina) : null,
    estoque_atual_bobina: numOrNull(r.estoque_atual_bobina),
    kg_bobina_necessario: numOrNull(r.kg_bobina_necessario),
    saldo_projetado: numOrNull(r.saldo_projetado),
    cobertura_meses: numOrNull(r.cobertura_meses),
  };
}

export async function loadProgramacaoProducaoGrade(): Promise<{
  data: ProgramacaoProducaoGradeRow[];
  erro?: string;
}> {
  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) {
    return { data: [], erro: 'NOMUS_DB_URL não configurado' };
  }
  try {
    const sql = getSql('programacaoProducaoGrade.sql');
    const [rows] = await pool.query(sql);
    const data = (Array.isArray(rows) ? rows : []).map((r) =>
      mapGradeRow(r as Record<string, unknown>)
    );
    return { data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[programacaoProducao] loadGrade:', msg);
    return { data: [], erro: msg };
  }
}

export async function loadEstoqueBobinaSetores(idBobina: number): Promise<{
  setores: EstoqueSetorRow[];
  erro?: string;
}> {
  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) {
    return { setores: [], erro: 'NOMUS_DB_URL não configurado' };
  }
  try {
    const sql = getSql('programacaoProducaoEstoqueBobinaSetores.sql');
    const [rows] = await pool.query(sql, [idBobina]);
    const setores = (Array.isArray(rows) ? rows : []).map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id_setor: num(row.id_setor),
        nome_setor: String(row.nome_setor ?? ''),
        saldo: num(row.saldo),
      };
    });
    return { setores };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[programacaoProducao] estoqueBobina:', msg);
    return { setores: [], erro: msg };
  }
}

export type BobinaBuscaRow = {
  id: number;
  codigo: string;
  descricao: string | null;
};

export type OrdemNomusRow = {
  ordem: string;
  tipo_ordem: string;
  codigo_produto: string;
  descricao_produto: string;
  unidade_medida: string | null;
  qtde_planejada: number;
  qtde_produzida: number;
  saldo: number;
  prioridade: number | null;
  data_emissao: string | null;
  data_inicial_planejada: string | null;
  data_entrega: string | null;
  status: string;
};

function dateOrNull(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v).trim();
  return s || null;
}

function mapOrdemNomusRow(r: Record<string, unknown>): OrdemNomusRow {
  return {
    ordem: String(r.ordem ?? ''),
    tipo_ordem: String(r.tipo_ordem ?? ''),
    codigo_produto: String(r.codigo_produto ?? ''),
    descricao_produto: String(r.descricao_produto ?? ''),
    unidade_medida: strOrNull(r.unidade_medida),
    qtde_planejada: num(r.qtde_planejada),
    qtde_produzida: num(r.qtde_produzida),
    saldo: num(r.saldo),
    prioridade: numOrNull(r.prioridade),
    data_emissao: dateOrNull(r.data_emissao),
    data_inicial_planejada: dateOrNull(r.data_inicial_planejada),
    data_entrega: dateOrNull(r.data_entrega),
    status: String(r.status ?? ''),
  };
}

/** OPs abertas no Nomus para o componente (recurso 124 — Perfiladeira Mod 1000). */
export async function loadOrdensNomusPorComponente(
  idComponente: number
): Promise<{ data: OrdemNomusRow[]; erro?: string }> {
  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) {
    return { data: [], erro: 'NOMUS_DB_URL não configurado' };
  }
  if (!Number.isFinite(idComponente) || idComponente <= 0) {
    return { data: [], erro: 'ID do componente inválido.' };
  }
  try {
    const sql = getSql('programacaoProducaoOrdensNomus.sql');
    const [rows] = await pool.query(sql, [idComponente]);
    const data = (Array.isArray(rows) ? rows : [])
      .map((r) => mapOrdemNomusRow(r as Record<string, unknown>))
      .filter((r) => r.ordem.trim());
    return { data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[programacaoProducao] ordensNomus:', msg);
    return { data: [], erro: msg };
  }
}

export async function buscarBobinasProgramacaoProducao(
  q: string,
  limit = 50
): Promise<{ data: BobinaBuscaRow[]; erro?: string }> {
  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) {
    return { data: [], erro: 'NOMUS_DB_URL não configurado' };
  }
  const termo = q.trim();
  const lim = Math.min(100, Math.max(1, limit));
  const like = termo ? `%${termo}%` : '';
  try {
    const sql = getSql('programacaoProducaoBobinasBusca.sql');
    const [rows] = await pool.query(sql, [termo, like, like, lim]);
    const data = (Array.isArray(rows) ? rows : []).map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: num(row.id),
        codigo: String(row.codigo ?? ''),
        descricao: strOrNull(row.descricao),
      };
    });
    return { data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[programacaoProducao] buscarBobinas:', msg);
    return { data: [], erro: msg };
  }
}

export async function buscarBobinasPorCodigos(
  codigos: string[]
): Promise<{ data: BobinaBuscaRow[]; erro?: string }> {
  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) {
    return { data: [], erro: 'NOMUS_DB_URL não configurado' };
  }
  const uniq = [...new Set(codigos.map((c) => c.trim()).filter(Boolean))];
  if (!uniq.length) return { data: [] };
  try {
    const placeholders = uniq.map(() => '?').join(', ');
    const sql = `
SELECT p.id AS id, p.nome AS codigo, p.descricao AS descricao
FROM weberp_soaco.produto p
INNER JOIN weberp_soaco.tipoproduto tp ON tp.id = p.idTipoProduto
WHERE p.ativo = 1
  AND tp.id = 16
  AND p.idFamiliaProduto = 65
  AND p.nome IN (${placeholders})
  AND p.revisao = (
    SELECT MAX(prod.rv)
    FROM (
      SELECT pd1.nome AS cod_p, CONVERT(pd1.revisao, DECIMAL(18, 4)) AS rv
      FROM weberp_soaco.produto pd1
    ) AS prod
    WHERE prod.cod_p = p.nome
  )
`.trim();
    const [rows] = await pool.query(sql, uniq);
    const data = (Array.isArray(rows) ? rows : []).map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: num(row.id),
        codigo: String(row.codigo ?? ''),
        descricao: strOrNull(row.descricao),
      };
    });
    return { data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[programacaoProducao] buscarBobinasPorCodigos:', msg);
    return { data: [], erro: msg };
  }
}

export async function loadEstoqueComponenteDetalhe(idComponente: number): Promise<{
  setores: EstoqueSetorRow[];
  explosaoPa: ExplosaoPaRow[];
  erro?: string;
}> {
  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) {
    return { setores: [], explosaoPa: [], erro: 'NOMUS_DB_URL não configurado' };
  }
  try {
    const sqlSetores = getSql('programacaoProducaoEstoqueComponenteSetores.sql');
    const sqlExplosao = getSql('programacaoProducaoEstoqueComponenteExplosao.sql');
    const [[rowsSetores], [rowsExplosao]] = await Promise.all([
      pool.query(sqlSetores, [idComponente, idComponente]),
      pool.query(sqlExplosao, [idComponente]),
    ]);
    const setores = (Array.isArray(rowsSetores) ? rowsSetores : []).map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id_setor: num(row.id_setor),
        nome_setor: String(row.nome_setor ?? ''),
        saldo: num(row.saldo),
      };
    });
    const explosaoPa = (Array.isArray(rowsExplosao) ? rowsExplosao : []).map((r) => {
      const row = r as Record<string, unknown>;
      return {
        cod_pa: String(row.cod_pa ?? ''),
        descricao_pa: String(row.descricao_pa ?? ''),
        qtde_alocada: num(row.qtde_alocada),
      };
    });
    return { setores, explosaoPa };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[programacaoProducao] estoqueComponente:', msg);
    return { setores: [], explosaoPa: [], erro: msg };
  }
}
