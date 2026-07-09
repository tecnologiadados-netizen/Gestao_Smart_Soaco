import type { ClienteErp } from "@/types/cliente-erp";
import {
  CLIENTES_INITIAL_LIMIT,
  CLIENTES_MIN_SEARCH_CHARS,
  CLIENTES_SEARCH_LIMIT,
} from "@/lib/registros/clientes-constants";

export interface GetClientesOptions {
  q?: string;
  id?: string;
  limit?: number;
}

export interface ClientesMysqlConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

const CLIENTES_TELEFONE_SUBQUERY = `
  (
    SELECT GROUP_CONCAT(telefone_fmt SEPARATOR ' / ')
    FROM (
      SELECT
        CONCAT(
          IF(t.DDD IS NULL OR TRIM(t.DDD) = '', '', CONCAT(TRIM(t.DDD), ' - ')),
          TRIM(t.numero)
        ) AS telefone_fmt
      FROM telefone t
      WHERE t.idEntidade = p.id
        AND t.discriminador = 'P'
        AND TRIM(t.numero) <> ''
      ORDER BY t.telefonePrincipal DESC, t.id ASC
      LIMIT 2
    ) tel
  ) AS telefone
`;

const CLIENTES_CONTATO_SUBQUERY = `
  (
    SELECT c.nome
    FROM pessoa_contato pc
    INNER JOIN contato c ON c.id = pc.idContato
    WHERE pc.idParceiro = p.id
      AND TRIM(c.nome) <> ''
    ORDER BY pc.idContato ASC
    LIMIT 1
  ) AS contato
`;

const CLIENTES_SELECT = `
  SELECT
    p.id,
    p.nome,
    p.nomeRazaoSocial,
    p.uf,
    p.endereco,
    p.bairroDistrito AS bairro,
    m.nome AS municipio,
    ${CLIENTES_TELEFONE_SUBQUERY},
    ${CLIENTES_CONTATO_SUBQUERY},
    IF(p.tipoPessoa = 1, p.cnpjCpf, p.cpf) AS documento
`;

const CLIENTES_FROM = `
  FROM pessoa p
  LEFT JOIN municipio m ON m.id = p.idMunicipio
`;

function clientesWhereClause(): string {
  return `
    WHERE p.cliente = 1
      AND p.ativo = 1
  `;
}

export function getClientesSqlConfig(): ClientesMysqlConfig | null {
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
  };
}

export function mapSqlRowsToClientes(
  rows: Record<string, unknown>[]
): ClienteErp[] {
  const clientes: ClienteErp[] = [];
  const vistos = new Set<string>();

  for (const row of rows) {
    const id = row.id;
    const nome = row.nome;
    if (id == null || nome == null) continue;

    const idStr = String(id).trim();
    const nomeStr = String(nome).trim();
    if (!idStr || !nomeStr || vistos.has(idStr)) continue;
    vistos.add(idStr);

    const documento = row.documento;

    const textoOpcional = (valor: unknown) => {
      const texto = String(valor ?? "").trim();
      return texto || undefined;
    };

    clientes.push({
      id: idStr,
      nome: nomeStr,
      razaoSocial: String(row.nomeRazaoSocial ?? nomeStr).trim(),
      municipio: String(row.municipio ?? "").trim(),
      uf: String(row.uf ?? "").trim().toUpperCase(),
      endereco: textoOpcional(row.endereco),
      bairro: textoOpcional(row.bairro),
      telefone: textoOpcional(row.telefone),
      contato: textoOpcional(row.contato),
      documento:
        documento != null && String(documento).trim()
          ? String(documento).trim()
          : undefined,
    });
  }

  return clientes;
}

function normalizeLimit(limit?: number): number {
  return Math.min(
    Math.max(limit ?? CLIENTES_INITIAL_LIMIT, 1),
    CLIENTES_SEARCH_LIMIT
  );
}

/**
 * Busca clientes ativos no ERP (pessoa, municipio, telefone e contato).
 */
export async function fetchClientesFromSql(
  config: ClientesMysqlConfig,
  options: GetClientesOptions = {}
): Promise<ClienteErp[]> {
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

  const where = clientesWhereClause();

  try {
    if (options.id?.trim()) {
      const [rows] = await connection.query(
        `${CLIENTES_SELECT} ${CLIENTES_FROM} ${where} AND p.id = ? LIMIT 1`,
        [options.id.trim()]
      );
      return mapSqlRowsToClientes(rows as Record<string, unknown>[]);
    }

    const q = options.q?.trim() ?? "";
    if (q.length >= CLIENTES_MIN_SEARCH_CHARS) {
      const like = `%${q}%`;
      const [rows] = await connection.query(
        `${CLIENTES_SELECT} ${CLIENTES_FROM} ${where}
         AND (
           p.nome LIKE ?
           OR p.nomeRazaoSocial LIKE ?
           OR p.cnpjCpf LIKE ?
           OR p.cpf LIKE ?
         )
         ORDER BY p.nome ASC
         LIMIT ?`,
        [like, like, like, like, limit]
      );
      return mapSqlRowsToClientes(rows as Record<string, unknown>[]);
    }

    const [rows] = await connection.query(
      `${CLIENTES_SELECT} ${CLIENTES_FROM} ${where}
       ORDER BY p.nome ASC
       LIMIT ?`,
      [limit]
    );
    return mapSqlRowsToClientes(rows as Record<string, unknown>[]);
  } finally {
    await connection.end();
  }
}
