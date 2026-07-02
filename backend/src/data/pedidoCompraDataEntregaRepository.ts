/**
 * Integração Nomus: Pedido de Compra – alteração da data de entrega.
 * Consulta read-only; filtros aplicados no servidor.
 */

import { getNomusPool, isNomusEnabled } from '../config/nomusDb.js';

const SQL_BASE = `
SELECT DISTINCT
  pc.id AS idPedidoCompra,
  ipc.id AS idItemPedidoCompra,
  pc.nome AS Pedido,
  pc.dataEmissao AS DataEmissao,
  p.nome AS CodigoProduto,
  p.descricao AS DescricaoProduto,
  pc.idFornecedor AS idFornecedor,
  f.nome AS Fornecedor,
  ipc.dataEntrega AS DataEntrega
FROM pedidocompra pc
LEFT JOIN pessoa f ON f.id = pc.idFornecedor
LEFT JOIN itempedidocompra ipc ON ipc.idPedidoCompra = pc.id
LEFT JOIN produto p ON p.id = ipc.idProduto
WHERE (pc.dataEmissao >= ?) AND (ipc.status NOT IN (1, 5, 6))
`;

export interface FiltrosPedidoCompraDataEntrega {
  data_emissao_ini?: string;
  data_emissao_fim?: string;
  data_entrega_ini?: string;
  data_entrega_fim?: string;
  pedido?: string;
  fornecedor?: string;
  codigo_produto?: string;
  descricao_produto?: string;
}

/** Colunas exibidas na grade (sem IDs). */
const COLUNAS_EXIBICAO = ['Pedido', 'DataEmissao', 'CodigoProduto', 'DescricaoProduto', 'Fornecedor', 'DataEntrega'];

function parseMulti(val: string | undefined): string[] {
  if (!val?.trim()) return [];
  return val.split(',').map((s) => s.trim()).filter(Boolean);
}

/** Retorna YYYY-MM-DD sem deslocar por timezone (evita dia a menos na gravação no MySQL). */
function toSqlDateOnly(s: string): string | null {
  if (!s?.trim()) return null;
  const trimmed = s.trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface RowPedidoCompraDataEntrega {
  idItemPedidoCompra: number;
  Pedido: string;
  DataEmissao: string;
  CodigoProduto: string;
  DescricaoProduto: string;
  Fornecedor: string;
  DataEntrega: string;
  [key: string]: unknown;
}

export interface FiltrosOpcoesPedidoCompra {
  pedidos: string[];
  fornecedores: string[];
  codigosProduto: string[];
  descricoesProduto: string[];
}

/**
 * Lista itens de pedido de compra para alteração de data de entrega.
 * Retorna apenas colunas para exibição (sem IDs).
 */
export async function listarPedidoCompraDataEntrega(
  filtros: FiltrosPedidoCompraDataEntrega = {}
): Promise<{ data: RowPedidoCompraDataEntrega[]; erro?: string }> {
  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) {
    return { data: [], erro: 'NOMUS_DB_URL não configurado' };
  }

  const dataEmissaoIni = filtros.data_emissao_ini?.trim() || '2024-01-01';
  const params: unknown[] = [dataEmissaoIni];
  const conditions: string[] = ['(pc.dataEmissao >= ?)', '(ipc.status NOT IN (1, 5, 6))'];

  if (filtros.data_emissao_fim) {
    const fim = toSqlDateOnly(filtros.data_emissao_fim);
    if (fim) {
      conditions.push('(pc.dataEmissao <= ?)');
      params.push(fim);
    }
  }
  if (filtros.data_entrega_ini) {
    const ini = toSqlDateOnly(filtros.data_entrega_ini);
    if (ini) {
      conditions.push('(ipc.dataEntrega >= ?)');
      params.push(ini);
    }
  }
  if (filtros.data_entrega_fim) {
    const fim = toSqlDateOnly(filtros.data_entrega_fim);
    if (fim) {
      conditions.push('(ipc.dataEntrega <= ?)');
      params.push(fim);
    }
  }

  const pedidos = parseMulti(filtros.pedido);
  if (pedidos.length > 0) {
    conditions.push(`(pc.nome IN (${pedidos.map(() => '?').join(',')}))`);
    params.push(...pedidos);
  }
  const fornecedores = parseMulti(filtros.fornecedor);
  if (fornecedores.length > 0) {
    conditions.push(`(f.nome IN (${fornecedores.map(() => '?').join(',')}))`);
    params.push(...fornecedores);
  }
  const codigos = parseMulti(filtros.codigo_produto);
  if (codigos.length > 0) {
    conditions.push(`(p.nome IN (${codigos.map(() => '?').join(',')}))`);
    params.push(...codigos);
  }
  const descricoes = parseMulti(filtros.descricao_produto);
  if (descricoes.length > 0) {
    conditions.push(`(p.descricao IN (${descricoes.map(() => '?').join(',')}))`);
    params.push(...descricoes);
  }

  const whereClause = conditions.join(' AND ');
  const sql = SQL_BASE.replace(
    'WHERE (pc.dataEmissao >= ?) AND (ipc.status NOT IN (1, 5, 6))',
    `WHERE ${whereClause}`
  );

  try {
    const [rows] = await pool.query<Record<string, unknown>[]>(sql, params);
    const list = (Array.isArray(rows) ? rows : []) as Record<string, unknown>[];

    const data: RowPedidoCompraDataEntrega[] = list.map((r) => {
      const raw = r as Record<string, unknown>;
      const idItem = raw.idItemPedidoCompra ?? raw.iditempedidocompra;
      const out: RowPedidoCompraDataEntrega = {
        idItemPedidoCompra: idItem != null ? Number(idItem) : 0,
        Pedido: String(raw.Pedido ?? raw.pedido ?? ''),
        DataEmissao: raw.DataEmissao != null || raw.dataEmissao != null ? formatDate((raw.DataEmissao ?? raw.dataEmissao) as string) : '',
        CodigoProduto: String(raw.CodigoProduto ?? raw.codigoProduto ?? ''),
        DescricaoProduto: String(raw.DescricaoProduto ?? raw.descricaoProduto ?? ''),
        Fornecedor: String(raw.Fornecedor ?? raw.fornecedor ?? ''),
        DataEntrega: raw.DataEntrega != null || raw.dataEntrega != null ? formatDate((raw.DataEntrega ?? raw.dataEntrega) as string) : '',
      };
      return out;
    });

    return { data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[pedidoCompraDataEntrega]', msg);
    return { data: [], erro: msg };
  }
}

/** Formata data do Nomus como YYYY-MM-DD sem deslocar por UTC (evita dia a menos). */
function formatDate(val: unknown): string {
  if (val == null) return '';
  const s = typeof val === 'string' ? val.trim() : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = val instanceof Date ? val : new Date(val as string);
  if (Number.isNaN(d.getTime())) return typeof val === 'string' ? val : '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Retorna listas distintas para os filtros multi-select (Pedido, Fornecedor, Código produto).
 */
export async function obterFiltrosOpcoesPedidoCompra(): Promise<{
  pedidos: string[];
  fornecedores: string[];
  codigosProduto: string[];
  descricoesProduto: string[];
  erro?: string;
}> {
  const result = await listarPedidoCompraDataEntrega({ data_emissao_ini: '2024-01-01' });
  if (result.erro) {
    return { pedidos: [], fornecedores: [], codigosProduto: [], descricoesProduto: [], erro: result.erro };
  }

  const pedidosSet = new Set<string>();
  const fornecedoresSet = new Set<string>();
  const codigosSet = new Set<string>();
  const descricoesSet = new Set<string>();

  for (const row of result.data) {
    if (row.Pedido) pedidosSet.add(row.Pedido);
    if (row.Fornecedor) fornecedoresSet.add(row.Fornecedor);
    if (row.CodigoProduto) codigosSet.add(row.CodigoProduto);
    if (row.DescricaoProduto) descricoesSet.add(row.DescricaoProduto);
  }

  return {
    pedidos: [...pedidosSet].sort(),
    fornecedores: [...fornecedoresSet].sort(),
    codigosProduto: [...codigosSet].sort(),
    descricoesProduto: [...descricoesSet].sort(),
  };
}

const SQL_UPDATE_DATA_ENTREGA = `
UPDATE itempedidocompra
SET dataEntrega = ?
WHERE id = ?
`;

const SQL_UPDATE_DATA_ENTREGA_SNAKE = `
UPDATE itempedidocompra
SET data_entrega = ?
WHERE id = ?
`;

/**
 * Atualiza a data de entrega de um item de pedido de compra no Nomus.
 * Tenta dataEntrega; se der "Unknown column", tenta data_entrega.
 * Usa execute() (prepared) e commit explícito.
 */
export async function atualizarDataEntregaItemPedidoCompra(
  idItemPedidoCompra: number,
  dataEntregaNova: string
): Promise<{ erro?: string }> {
  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) {
    return { erro: 'NOMUS_DB_URL não configurado' };
  }

  if (!Number.isInteger(idItemPedidoCompra) || idItemPedidoCompra <= 0) {
    return { erro: 'idItemPedidoCompra inválido' };
  }

  const dataSql = toSqlDateOnly(dataEntregaNova);
  if (!dataSql) {
    return { erro: 'Data de entrega inválida' };
  }

  const params = [dataSql, idItemPedidoCompra] as [string, number];
  let connection: Awaited<ReturnType<typeof pool.getConnection>> | null = null;

  const runUpdate = async (sql: string): Promise<number> => {
    if (!connection) return 0;
    const [result] = await connection.execute(sql, params);
    const header = result as { affectedRows?: number };
    return header?.affectedRows ?? 0;
  };

  try {
    connection = await pool.getConnection();
    let affected = 0;
    let usedSnake = false;
    try {
      affected = await runUpdate(SQL_UPDATE_DATA_ENTREGA);
    } catch (firstErr) {
      const firstMsg = firstErr instanceof Error ? firstErr.message : String(firstErr);
      if (/Unknown column|unknown column|dataEntrega/i.test(firstMsg)) {
        try {
          affected = await runUpdate(SQL_UPDATE_DATA_ENTREGA_SNAKE);
          usedSnake = true;
        } catch (_) {
          throw firstErr;
        }
      } else {
        throw firstErr;
      }
    }
    if (affected > 0) {
      try {
        await connection.commit();
      } catch (commitErr) {
        console.error('[Nomus UPDATE] commit falhou:', commitErr);
        throw commitErr;
      }
      console.log(
        '[Nomus UPDATE itempedidocompra] id=%s data=%s affectedRows=%s coluna=%s',
        idItemPedidoCompra,
        dataSql,
        affected,
        usedSnake ? 'data_entrega' : 'dataEntrega'
      );
      return {};
    }
    return { erro: 'Nenhum registro atualizado (id pode não existir)' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: string }).code;
    console.error('[pedidoCompraDataEntrega] atualizarDataEntrega:', code || '', msg);
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }
    return { erro: msg };
  } finally {
    connection?.release();
  }
}
