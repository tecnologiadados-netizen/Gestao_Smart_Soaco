import { getNomusPool, isNomusEnabled } from '../config/nomusDb.js';
import { termoParaPadraoLikeSql } from '../utils/textoLivreBusca.js';
import {
  calcularStatusDimensionado,
  listarCubagensLocais,
  type StatusDimensionado,
} from './cubagemRepository.js';

const SQL_BASE = `
SELECT
  p.id AS idProduto,
  p.nome AS codigoProduto,
  p.descricao AS descricaoProduto,
  tp.id AS idTipoProduto,
  tp.nome AS tipoProduto
FROM produto p
INNER JOIN produtoempresa pe ON pe.idProduto = p.id AND pe.idEmpresa = 1
LEFT JOIN tipoproduto tp ON tp.id = p.idTipoProduto
WHERE p.ativo = 1
  AND tp.id IN (8, 15)
`.trim();

export type ProdutoNomusCubagem = {
  idProduto: number;
  codigoProduto: string;
  descricaoProduto: string;
  idTipoProduto: number;
  tipoProduto: string;
};

export type ProdutoCubagemListItem = ProdutoNomusCubagem & {
  status: StatusDimensionado;
  cubagem: {
    id: number;
    pesoKg: number | null;
    alturaMm: number | null;
    larguraMm: number | null;
    profundidadeMm: number | null;
    numVolumes: number;
    empilhavel: boolean;
    pesoMaxTopoKg: number | null;
    podeDeitar: boolean;
    podeVirar: boolean;
    esteLadoParaCima: boolean;
    fragilNaoSobrepor: boolean;
    volumes: Array<{
      id: number;
      ordem: number;
      descricao: string | null;
      alturaMm: number | null;
      larguraMm: number | null;
      profundidadeMm: number | null;
      pesoKg: number | null;
    }>;
  } | null;
};

export type FiltrosProdutosCubagem = {
  busca?: string;
  tipo?: 'acabado' | 'intermediario' | 'todos';
  status?: 'dimensionado' | 'pendente' | 'todos';
};

function mapRow(row: Record<string, unknown>): ProdutoNomusCubagem {
  return {
    idProduto: Number(row.idProduto),
    codigoProduto: String(row.codigoProduto ?? ''),
    descricaoProduto: String(row.descricaoProduto ?? ''),
    idTipoProduto: Number(row.idTipoProduto),
    tipoProduto: String(row.tipoProduto ?? ''),
  };
}

export async function listarProdutosElegiveisNomus(
  filtros: FiltrosProdutosCubagem = {}
): Promise<ProdutoNomusCubagem[]> {
  if (!isNomusEnabled()) {
    throw new Error('Nomus não configurado (NOMUS_DB_URL).');
  }
  const pool = getNomusPool();
  if (!pool) throw new Error('Conexão Nomus indisponível.');

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filtros.tipo === 'acabado') {
    conditions.push('tp.id = 8');
  } else if (filtros.tipo === 'intermediario') {
    conditions.push('tp.id = 15');
  }

  const busca = filtros.busca?.trim();
  if (busca) {
    const like = termoParaPadraoLikeSql(busca);
    conditions.push('(p.nome LIKE ? OR p.descricao LIKE ?)');
    params.push(like, like);
  }

  const whereExtra = conditions.length > 0 ? ` AND ${conditions.join(' AND ')}` : '';
  const sql = `${SQL_BASE}${whereExtra} ORDER BY p.nome ASC`;

  const [rows] = await pool.query(sql, params);
  return (rows as Record<string, unknown>[]).map(mapRow);
}

export async function obterProdutoElegivelNomus(idProduto: number): Promise<ProdutoNomusCubagem | null> {
  if (!isNomusEnabled()) {
    throw new Error('Nomus não configurado (NOMUS_DB_URL).');
  }
  const pool = getNomusPool();
  if (!pool) throw new Error('Conexão Nomus indisponível.');

  const sql = `${SQL_BASE} AND p.id = ? LIMIT 1`;
  const [rows] = await pool.query(sql, [idProduto]);
  const list = rows as Record<string, unknown>[];
  if (list.length === 0) return null;
  return mapRow(list[0]);
}

/** Busca produto elegível pelo código (tenta variantes com/sem espaço). */
export async function obterProdutoElegivelPorCodigo(codigo: string): Promise<ProdutoNomusCubagem | null> {
  if (!isNomusEnabled()) return null;
  const pool = getNomusPool();
  if (!pool) return null;

  const raw = codigo.trim();
  const variantes = [
    raw,
    raw.replace(/\s+/g, ''),
    raw.replace(/\s+/g, ' '),
    raw.toUpperCase(),
    raw.replace(/\s+/g, '').toUpperCase(),
  ];
  const unicos = [...new Set(variantes.filter(Boolean))];

  for (const v of unicos) {
    const sql = `${SQL_BASE} AND p.nome = ? LIMIT 1`;
    const [rows] = await pool.query(sql, [v]);
    const list = rows as Record<string, unknown>[];
    if (list.length > 0) return mapRow(list[0]);
  }

  const like = termoParaPadraoLikeSql(raw.replace(/\s+/g, '%'));
  const sqlLike = `${SQL_BASE} AND p.nome LIKE ? LIMIT 1`;
  const [rowsLike] = await pool.query(sqlLike, [like]);
  const listLike = rowsLike as Record<string, unknown>[];
  if (listLike.length > 0) return mapRow(listLike[0]);

  return null;
}

export async function listarProdutosCubagem(
  filtros: FiltrosProdutosCubagem = {}
): Promise<ProdutoCubagemListItem[]> {
  const [nomusRows, cubagens] = await Promise.all([
    listarProdutosElegiveisNomus(filtros),
    listarCubagensLocais(),
  ]);

  const cubagemPorProduto = new Map(cubagens.map((c) => [c.idProduto, c]));

  let resultado: ProdutoCubagemListItem[] = nomusRows.map((p) => {
    const cub = cubagemPorProduto.get(p.idProduto);
    const status = cub
      ? calcularStatusDimensionado(cub, cub.volumes)
      : ('pendente' as StatusDimensionado);

    return {
      ...p,
      status,
      cubagem: cub
        ? {
            id: cub.id,
            pesoKg: cub.pesoKg,
            alturaMm: cub.alturaMm,
            larguraMm: cub.larguraMm,
            profundidadeMm: cub.profundidadeMm,
            numVolumes: cub.numVolumes,
            empilhavel: cub.empilhavel,
            pesoMaxTopoKg: cub.pesoMaxTopoKg,
            podeDeitar: cub.podeDeitar,
            podeVirar: cub.podeVirar,
            esteLadoParaCima: cub.esteLadoParaCima,
            fragilNaoSobrepor: cub.fragilNaoSobrepor,
            volumes: cub.volumes.map((v) => ({
              id: v.id,
              ordem: v.ordem,
              descricao: v.descricao,
              alturaMm: v.alturaMm,
              larguraMm: v.larguraMm,
              profundidadeMm: v.profundidadeMm,
              pesoKg: v.pesoKg,
            })),
          }
        : null,
    };
  });

  if (filtros.status === 'dimensionado') {
    resultado = resultado.filter((r) => r.status === 'dimensionado');
  } else if (filtros.status === 'pendente') {
    resultado = resultado.filter((r) => r.status === 'pendente');
  }

  return resultado;
}
