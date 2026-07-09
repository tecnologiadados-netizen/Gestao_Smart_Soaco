import type { Fornecedor } from "@/types/avaliacao-fornecedor";
import type { FornecedoresSearchParams } from "@/lib/avaliacao-fornecedor/fornecedores-constants";
import {
  FORNECEDORES_INITIAL_LIMIT,
  FORNECEDORES_MIN_SEARCH_CHARS,
  FORNECEDORES_SEARCH_LIMIT,
} from "@/lib/avaliacao-fornecedor/fornecedores-constants";

const DEFAULT_SUPPLIERS_BASE_QUERY = `SELECT nome, fornecedor FROM pessoa p WHERE fornecedor = 1`;

interface SuppliersColumnMapping {
  colId: string;
  colNome: string;
  colDocumento: string;
}

export interface MysqlSuppliersConfig extends SuppliersColumnMapping {
  driver: "mysql";
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  baseQuery: string;
}

export interface MssqlSuppliersConfig extends SuppliersColumnMapping {
  driver: "mssql";
  connectionString: string;
  baseQuery: string;
}

export type SuppliersSqlConfig = MysqlSuppliersConfig | MssqlSuppliersConfig;

function getColumnMapping(): SuppliersColumnMapping {
  return {
    colId: process.env.SUPPLIERS_COL_ID?.trim() || "nome",
    colNome: process.env.SUPPLIERS_COL_NOME?.trim() || "nome",
    colDocumento: process.env.SUPPLIERS_COL_DOCUMENTO?.trim() || "documento",
  };
}

function getSuppliersBaseQuery(): string {
  return process.env.SUPPLIERS_QUERY?.trim() || DEFAULT_SUPPLIERS_BASE_QUERY;
}

export function getSuppliersSqlConfig(): SuppliersSqlConfig | null {
  const baseQuery = getSuppliersBaseQuery();
  const columns = getColumnMapping();

  const host = process.env.DB_HOST?.trim();
  const user = process.env.DB_USER?.trim();
  const database = process.env.DB_NAME?.trim();

  if (host && user && database) {
    return {
      driver: "mysql",
      host,
      port: Number(process.env.DB_PORT?.trim() || 3306),
      user,
      password: process.env.DB_PASSWORD ?? "",
      database,
      baseQuery,
      ...columns,
    };
  }

  const connectionString = process.env.SUPPLIERS_DB_CONNECTION_STRING?.trim();
  if (connectionString) {
    return {
      driver: "mssql",
      connectionString,
      baseQuery,
      ...columns,
    };
  }

  return null;
}

export function mapSqlRowsToFornecedores(
  rows: Record<string, unknown>[],
  config: SuppliersColumnMapping
): Fornecedor[] {
  const fornecedores: Fornecedor[] = [];
  const seenIds = new Set<string>();

  for (const row of rows) {
    const id = row[config.colId];
    const nome = row[config.colNome];
    if (id == null || nome == null) continue;

    const idStr = String(id).trim();
    const nomeStr = String(nome).trim();
    if (!idStr || !nomeStr) continue;

    if (seenIds.has(idStr)) continue;
    seenIds.add(idStr);

    const documento = row[config.colDocumento];

    fornecedores.push({
      id: idStr,
      nome: nomeStr,
      documento:
        documento != null && String(documento).trim()
          ? String(documento)
          : undefined,
    });
  }

  return fornecedores;
}

function normalizeSearchParams(
  params: FornecedoresSearchParams = {}
): { q: string; limit: number } {
  const q = params.q?.trim() ?? "";
  const limit = Math.min(
    Math.max(params.limit ?? FORNECEDORES_INITIAL_LIMIT, 1),
    FORNECEDORES_SEARCH_LIMIT
  );
  return { q, limit };
}

async function fetchFornecedoresFromMysql(
  config: MysqlSuppliersConfig,
  params: FornecedoresSearchParams
): Promise<Fornecedor[]> {
  const { q, limit } = normalizeSearchParams(params);
  const mysql = await import("mysql2/promise");
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    connectTimeout: 10_000,
  });

  const nomeCol = config.colNome;

  try {
    if (q.length >= FORNECEDORES_MIN_SEARCH_CHARS) {
      const [rows] = await connection.query(
        `SELECT * FROM (${config.baseQuery}) AS fornecedores WHERE ${nomeCol} LIKE ? ORDER BY ${nomeCol} ASC LIMIT ?`,
        [`%${q}%`, limit]
      );
      return mapSqlRowsToFornecedores(
        rows as Record<string, unknown>[],
        config
      );
    }

    const [rows] = await connection.query(
      `SELECT * FROM (${config.baseQuery}) AS fornecedores ORDER BY ${nomeCol} ASC LIMIT ?`,
      [limit]
    );
    return mapSqlRowsToFornecedores(rows as Record<string, unknown>[], config);
  } finally {
    await connection.end();
  }
}

async function fetchFornecedoresFromMssql(
  config: MssqlSuppliersConfig,
  params: FornecedoresSearchParams
): Promise<Fornecedor[]> {
  const { q, limit } = normalizeSearchParams(params);
  const sql = await import("mssql");
  const pool = await sql.connect(config.connectionString);

  const nomeCol = config.colNome;

  try {
    const request = pool.request().input("limit", sql.Int, limit);

    let query: string;
    if (q.length >= FORNECEDORES_MIN_SEARCH_CHARS) {
      request.input("q", sql.NVarChar, `%${q}%`);
      query = `SELECT TOP (@limit) * FROM (${config.baseQuery}) AS fornecedores WHERE ${nomeCol} LIKE @q ORDER BY ${nomeCol} ASC`;
    } else {
      query = `SELECT TOP (@limit) * FROM (${config.baseQuery}) AS fornecedores ORDER BY ${nomeCol} ASC`;
    }

    const result = await request.query(query);
    const rows = (result.recordset ?? []) as Record<string, unknown>[];
    return mapSqlRowsToFornecedores(rows, config);
  } finally {
    await pool.close();
  }
}

export async function fetchFornecedoresFromSql(
  config: SuppliersSqlConfig,
  params: FornecedoresSearchParams = {}
): Promise<Fornecedor[]> {
  if (config.driver === "mysql") {
    return fetchFornecedoresFromMysql(config, params);
  }

  return fetchFornecedoresFromMssql(config, params);
}
