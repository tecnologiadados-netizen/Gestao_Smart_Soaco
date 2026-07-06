import type { ProdutoErp } from "@/types/produto-erp";
import {
  PRODUTOS_INITIAL_LIMIT,
  PRODUTOS_MIN_SEARCH_CHARS,
  PRODUTOS_SEARCH_LIMIT,
} from "@/lib/registros/produtos-constants";

export interface GetProdutosOptions {
  q?: string;
  codigo?: string;
  limit?: number;
}

export interface ProdutosMysqlConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  idEmpresa: number;
}

const PRODUTOS_SELECT = `
  SELECT DISTINCT
    se.codigoProduto,
    se.descricaoProduto,
    se.grupoProduto,
    se.tipoProduto
`;

const PRODUTOS_FROM = `
  FROM dw_saldoestoque se
  INNER JOIN setorestoque st
    ON se.codigoSetorEstoque = st.id
   AND se.codigoEmpresa = st.idEmpresa
`;

function produtosWhereClause(): string {
  return `
    WHERE se.ativoProduto = 'Sim'
      AND st.ativo = 1
      AND st.idEmpresa = ?
      AND st.consideraComoSaldoDisponivel = 1
  `;
}

export function getProdutosSqlConfig(): ProdutosMysqlConfig | null {
  const host = process.env.DB_HOST?.trim();
  const user = process.env.DB_USER?.trim();
  const database = process.env.DB_NAME?.trim();

  if (!host || !user || !database) {
    return null;
  }

  return {
    host,
    port: Number(process.env.DB_PORT?.trim() || 3306),
    user,
    password: process.env.DB_PASSWORD ?? "",
    database,
    idEmpresa: Number(process.env.PRODUTOS_EMPRESA_ID?.trim() || 1),
  };
}

export function mapSqlRowsToProdutos(
  rows: Record<string, unknown>[]
): ProdutoErp[] {
  const produtos: ProdutoErp[] = [];
  const vistos = new Set<string>();

  for (const row of rows) {
    const codigo = row.codigoProduto;
    if (codigo == null) continue;

    const codigoStr = String(codigo).trim();
    if (!codigoStr || vistos.has(codigoStr)) continue;
    vistos.add(codigoStr);

    produtos.push({
      codigo: codigoStr,
      descricao: String(row.descricaoProduto ?? "").trim(),
      grupoProduto: String(row.grupoProduto ?? "").trim(),
      tipoProduto: String(row.tipoProduto ?? "").trim(),
    });
  }

  return produtos;
}

function normalizeLimit(limit?: number): number {
  return Math.min(
    Math.max(limit ?? PRODUTOS_INITIAL_LIMIT, 1),
    PRODUTOS_SEARCH_LIMIT
  );
}

export async function fetchProdutosFromSql(
  config: ProdutosMysqlConfig,
  options: GetProdutosOptions = {}
): Promise<ProdutoErp[]> {
  const limit = normalizeLimit(options.limit);
  const mysql = await import("mysql2/promise");
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    connectTimeout: 10_000,
  });

  const where = produtosWhereClause();
  const idEmpresa = config.idEmpresa;

  try {
    if (options.codigo?.trim()) {
      const codigo = options.codigo.trim();
      const codigoSemEspacos = codigo.replace(/\s+/g, "");
      const [rows] = await connection.query(
        `${PRODUTOS_SELECT} ${PRODUTOS_FROM} ${where}
         AND (
           se.codigoProduto = ?
           OR REPLACE(se.codigoProduto, ' ', '') = ?
         )
         ORDER BY se.codigoProduto ASC
         LIMIT 1`,
        [idEmpresa, codigo, codigoSemEspacos]
      );
      return mapSqlRowsToProdutos(rows as Record<string, unknown>[]);
    }

    const q = options.q?.trim() ?? "";
    if (q.length >= PRODUTOS_MIN_SEARCH_CHARS) {
      const like = `%${q}%`;
      const [rows] = await connection.query(
        `${PRODUTOS_SELECT} ${PRODUTOS_FROM} ${where}
         AND (
           se.codigoProduto LIKE ?
           OR se.descricaoProduto LIKE ?
           OR se.grupoProduto LIKE ?
         )
         ORDER BY se.codigoProduto ASC
         LIMIT ?`,
        [idEmpresa, like, like, like, limit]
      );
      return mapSqlRowsToProdutos(rows as Record<string, unknown>[]);
    }

    const [rows] = await connection.query(
      `${PRODUTOS_SELECT} ${PRODUTOS_FROM} ${where}
       ORDER BY se.codigoProduto ASC
       LIMIT ?`,
      [idEmpresa, limit]
    );
    return mapSqlRowsToProdutos(rows as Record<string, unknown>[]);
  } finally {
    await connection.end();
  }
}
