/**
 * KPI Grupo Econômico — leitura Nomus (grupopessoa + pessoa).
 * Grade sintética (grupos) e detalhe lazy (membros) compartilham a mesma regra de vínculo.
 */

import { getNomusPool, isNomusEnabled } from '../config/nomusDb.js';
import { termoParaPadraoLikeSql } from '../utils/textoLivreBusca.js';

function getCell(row: Record<string, unknown>, ...names: string[]): unknown {
  for (const name of names) {
    if (name in row && row[name] !== undefined) return row[name];
    const target = name.toLowerCase();
    for (const k of Object.keys(row)) {
      if (k.toLowerCase() === target) return row[k];
    }
  }
  return undefined;
}

function num(v: unknown): number {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string {
  if (v == null) return '';
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(v)) return v.toString('utf8').trim();
  return String(v).trim();
}

function boolAtivo(v: unknown): boolean {
  return num(v) === 1;
}

export type GrupoEconomicoFiltros = {
  busca?: string;
  /** Default true: só grupos ativos. */
  somenteAtivos?: boolean;
};

export type GrupoEconomicoResumo = {
  totalGrupos: number;
  totalPessoas: number;
};

export type GrupoEconomicoLinha = {
  id: number;
  grupo: string;
  descricao: string;
  ativo: boolean;
  qtdMembros: number;
};

export type GrupoEconomicoMembro = {
  id: number;
  nome: string;
  razaoSocial: string;
  documento: string;
  tipoPessoa: number | null;
  codigo: string;
  ativo: boolean;
};

export type GrupoEconomicoDetalhe = {
  grupo: GrupoEconomicoLinha;
  membros: GrupoEconomicoMembro[];
};

/** Mesma regra da grade e do modal: pessoa.ativo = 1 e idGrupoPessoa = grupo. */
const SQL_COUNT_MEMBROS = `COUNT(DISTINCT CASE WHEN pes.ativo = 1 THEN pes.id END)`;

export async function listarGruposEconomicos(
  filtros: GrupoEconomicoFiltros = {}
): Promise<{ resumo: GrupoEconomicoResumo; grupos: GrupoEconomicoLinha[]; erro?: string }> {
  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) {
    return {
      resumo: { totalGrupos: 0, totalPessoas: 0 },
      grupos: [],
      erro: 'NOMUS_DB_URL não configurado ou pool indisponível.',
    };
  }

  const somenteAtivos = filtros.somenteAtivos !== false;
  const busca = (filtros.busca ?? '').trim();
  const params: unknown[] = [];
  const where: string[] = ["IFNULL(gp.grupo, '') <> ''"];

  if (somenteAtivos) {
    where.push('gp.ativo = 1');
  }

  if (busca) {
    const like = termoParaPadraoLikeSql(busca);
    where.push(`(
      IFNULL(gp.grupo, '') LIKE ?
      OR IFNULL(gp.descricao, '') LIKE ?
      OR EXISTS (
        SELECT 1 FROM pessoa p2
        WHERE p2.idGrupoPessoa = gp.id
          AND p2.ativo = 1
          AND (
            IFNULL(p2.nome, '') LIKE ?
            OR IFNULL(p2.nomeRazaoSocial, '') LIKE ?
            OR IFNULL(p2.cnpjCpf, '') LIKE ?
            OR IFNULL(p2.cpf, '') LIKE ?
            OR IFNULL(p2.codigo, '') LIKE ?
          )
      )
    )`);
    params.push(like, like, like, like, like, like, like);
  }

  const sql = `
    SELECT
      gp.id AS id,
      IFNULL(gp.grupo, '') AS grupo,
      IFNULL(gp.descricao, '') AS descricao,
      gp.ativo AS ativo,
      ${SQL_COUNT_MEMBROS} AS qtdMembros
    FROM grupopessoa gp
    LEFT JOIN pessoa pes ON pes.idGrupoPessoa = gp.id
    WHERE ${where.join(' AND ')}
    GROUP BY gp.id, gp.grupo, gp.descricao, gp.ativo
    HAVING qtdMembros > 0
    ORDER BY gp.grupo ASC
  `;

  try {
    const [r] = await pool.query(sql, params);
    const rows = (Array.isArray(r) ? r : []) as Record<string, unknown>[];
    const grupos: GrupoEconomicoLinha[] = rows.map((row) => ({
      id: Math.trunc(num(getCell(row, 'id'))) || 0,
      grupo: str(getCell(row, 'grupo')),
      descricao: str(getCell(row, 'descricao')),
      ativo: boolAtivo(getCell(row, 'ativo')),
      qtdMembros: Math.trunc(num(getCell(row, 'qtdMembros'))) || 0,
    })).filter((g) => g.id > 0);

    const resumo: GrupoEconomicoResumo = {
      totalGrupos: grupos.length,
      totalPessoas: grupos.reduce((acc, g) => acc + g.qtdMembros, 0),
    };
    return { resumo, grupos };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { resumo: { totalGrupos: 0, totalPessoas: 0 }, grupos: [], erro: msg };
  }
}

export async function detalheGrupoEconomico(
  grupoId: number,
  opts: { somenteAtivosGrupo?: boolean } = {}
): Promise<{ data: GrupoEconomicoDetalhe | null; erro?: string }> {
  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) {
    return { data: null, erro: 'NOMUS_DB_URL não configurado ou pool indisponível.' };
  }
  if (!Number.isFinite(grupoId) || grupoId <= 0) {
    return { data: null, erro: 'grupoId inválido.' };
  }

  const somenteAtivosGrupo = opts.somenteAtivosGrupo !== false;
  const whereGrupo = ["gp.id = ?", "IFNULL(gp.grupo, '') <> ''"];
  if (somenteAtivosGrupo) whereGrupo.push('gp.ativo = 1');

  const sqlGrupo = `
    SELECT
      gp.id AS id,
      IFNULL(gp.grupo, '') AS grupo,
      IFNULL(gp.descricao, '') AS descricao,
      gp.ativo AS ativo,
      ${SQL_COUNT_MEMBROS} AS qtdMembros
    FROM grupopessoa gp
    LEFT JOIN pessoa pes ON pes.idGrupoPessoa = gp.id
    WHERE ${whereGrupo.join(' AND ')}
    GROUP BY gp.id, gp.grupo, gp.descricao, gp.ativo
    LIMIT 1
  `;

  const sqlMembros = `
    SELECT
      pes.id AS id,
      IFNULL(pes.nome, '') AS nome,
      IFNULL(pes.nomeRazaoSocial, '') AS razaoSocial,
      IF(pes.tipoPessoa = 1, IFNULL(pes.cnpjCpf, ''), IFNULL(pes.cpf, '')) AS documento,
      pes.tipoPessoa AS tipoPessoa,
      IFNULL(pes.codigo, '') AS codigo,
      pes.ativo AS ativo
    FROM pessoa pes
    WHERE pes.idGrupoPessoa = ?
      AND pes.ativo = 1
    ORDER BY pes.nome ASC, pes.id ASC
  `;

  try {
    const [rg] = await pool.query(sqlGrupo, [grupoId]);
    const grupoRows = (Array.isArray(rg) ? rg : []) as Record<string, unknown>[];
    const g0 = grupoRows[0];
    if (!g0) {
      return { data: null, erro: 'Grupo econômico não encontrado.' };
    }

    const grupo: GrupoEconomicoLinha = {
      id: Math.trunc(num(getCell(g0, 'id'))) || 0,
      grupo: str(getCell(g0, 'grupo')),
      descricao: str(getCell(g0, 'descricao')),
      ativo: boolAtivo(getCell(g0, 'ativo')),
      qtdMembros: Math.trunc(num(getCell(g0, 'qtdMembros'))) || 0,
    };

    const [rm] = await pool.query(sqlMembros, [grupoId]);
    const membroRows = (Array.isArray(rm) ? rm : []) as Record<string, unknown>[];
    const membros: GrupoEconomicoMembro[] = membroRows.map((row) => {
      const tipoRaw = getCell(row, 'tipoPessoa');
      const tipo = tipoRaw == null || tipoRaw === '' ? null : Math.trunc(num(tipoRaw));
      return {
        id: Math.trunc(num(getCell(row, 'id'))) || 0,
        nome: str(getCell(row, 'nome')),
        razaoSocial: str(getCell(row, 'razaoSocial')),
        documento: str(getCell(row, 'documento')),
        tipoPessoa: tipo,
        codigo: str(getCell(row, 'codigo')),
        ativo: boolAtivo(getCell(row, 'ativo')),
      };
    }).filter((m) => m.id > 0);

    // Integridade grade == modal
    grupo.qtdMembros = membros.length;

    return { data: { grupo, membros } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { data: null, erro: msg };
  }
}
