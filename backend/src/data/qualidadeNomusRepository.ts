/**
 * Repositório Nomus (MySQL) para o módulo SGQ / Qualidade.
 * Usa NOMUS_DB_URL — mesma conexão do restante do sistema.
 */

import type { RowDataPacket } from 'mysql2';
import { getNomusPool, isNomusEnabled } from '../config/nomusDb.js';
import { termoParaPadraoLikeSql } from '../utils/textoLivreBusca.js';

export interface ClienteErp {
  id: string;
  nome: string;
  razaoSocial: string;
  municipio: string;
  uf: string;
  endereco?: string;
  bairro?: string;
  telefone?: string;
  contato?: string;
  documento?: string;
}

export interface ProdutoErp {
  codigo: string;
  descricao: string;
  grupoProduto: string;
  tipoProduto: string;
  /** Quantidade do item no pedido (apenas quando filtrado por pedidoId). */
  quantidadePedido?: number;
}

export interface FornecedorErp {
  id: string;
  nome: string;
  documento?: string;
}

export interface PessoaErp {
  id: string;
  nome: string;
  documento?: string;
}

export interface DocumentoEntradaErp {
  id: string;
  /** Número fiscal no Nomus (ex.: DE38540). */
  numero: string;
  dataEmissao?: string;
  dataEntrada?: string;
  numeroNFe?: string;
  tipoMovimentacao?: string;
}

export interface PedidoVendaErp {
  pedidoId: string;
  numero: string;
  dataEmissao: string;
  clienteNome: string;
  cliente: ClienteErp | null;
}

const CLIENTES_INITIAL_LIMIT = 30;
const CLIENTES_SEARCH_LIMIT = 80;
const CLIENTES_MIN_SEARCH_CHARS = 2;

const PRODUTOS_INITIAL_LIMIT = 40;
const PRODUTOS_SEARCH_LIMIT = 100;
const PRODUTOS_MIN_SEARCH_CHARS = 2;

const FORNECEDORES_INITIAL_LIMIT = 40;
const FORNECEDORES_SEARCH_LIMIT = 100;
const FORNECEDORES_MIN_SEARCH_CHARS = 2;

const PESSOAS_INITIAL_LIMIT = 40;
const PESSOAS_SEARCH_LIMIT = 100;
const PESSOAS_MIN_SEARCH_CHARS = 2;

const PEDIDOS_VENDA_INITIAL_LIMIT = 20;
const PEDIDOS_VENDA_SEARCH_LIMIT = 50;
const PEDIDOS_VENDA_MIN_SEARCH_CHARS = 2;

const DOCUMENTOS_ENTRADA_INITIAL_LIMIT = 40;
const DOCUMENTOS_ENTRADA_SEARCH_LIMIT = 100;
const DOCUMENTOS_ENTRADA_MIN_SEARCH_CHARS = 2;

const DEFAULT_SUPPLIERS_BASE_QUERY = `
  SELECT
    p.id,
    p.nome,
    p.cnpjCpf AS documento
  FROM pessoa p
  WHERE p.fornecedor = 1
    AND p.ativo = 1
`;

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

function produtosIdEmpresa(): number {
  const raw = process.env.QUALIDADE_PRODUTOS_EMPRESA_ID?.trim() || '1';
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function suppliersBaseQuery(): string {
  return process.env.QUALIDADE_SUPPLIERS_QUERY?.trim() || DEFAULT_SUPPLIERS_BASE_QUERY;
}

function suppliersColId(): string {
  return process.env.QUALIDADE_SUPPLIERS_COL_ID?.trim() || 'id';
}

function suppliersColNome(): string {
  return process.env.QUALIDADE_SUPPLIERS_COL_NOME?.trim() || 'nome';
}

function suppliersColDocumento(): string {
  return process.env.QUALIDADE_SUPPLIERS_COL_DOCUMENTO?.trim() || 'documento';
}

function mapSqlRowsToClientes(rows: Record<string, unknown>[]): ClienteErp[] {
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

    const textoOpcional = (valor: unknown) => {
      const texto = String(valor ?? '').trim();
      return texto || undefined;
    };

    clientes.push({
      id: idStr,
      nome: nomeStr,
      razaoSocial: String(row.nomeRazaoSocial ?? nomeStr).trim(),
      municipio: String(row.municipio ?? '').trim(),
      uf: String(row.uf ?? '').trim().toUpperCase(),
      endereco: textoOpcional(row.endereco),
      bairro: textoOpcional(row.bairro),
      telefone: textoOpcional(row.telefone),
      contato: textoOpcional(row.contato),
      documento: textoOpcional(row.documento),
    });
  }

  return clientes;
}

function mapSqlRowsToProdutos(rows: Record<string, unknown>[]): ProdutoErp[] {
  const produtos: ProdutoErp[] = [];
  const vistos = new Set<string>();

  for (const row of rows) {
    const codigo = row.codigoProduto;
    if (codigo == null) continue;

    const codigoStr = String(codigo).trim();
    if (!codigoStr || vistos.has(codigoStr)) continue;
    vistos.add(codigoStr);

    const qtdeRaw = row.quantidadePedido;
    const qtdeNum =
      qtdeRaw == null || qtdeRaw === ''
        ? undefined
        : Math.max(0, Math.floor(Number(qtdeRaw)));

    produtos.push({
      codigo: codigoStr,
      descricao: String(row.descricaoProduto ?? '').trim(),
      grupoProduto: String(row.grupoProduto ?? '').trim(),
      tipoProduto: String(row.tipoProduto ?? '').trim(),
      ...(qtdeNum != null && Number.isFinite(qtdeNum)
        ? { quantidadePedido: qtdeNum }
        : {}),
    });
  }

  return produtos;
}

function mapSqlRowsToFornecedores(rows: Record<string, unknown>[]): FornecedorErp[] {
  const fornecedores: FornecedorErp[] = [];
  const seenIds = new Set<string>();
  const colId = suppliersColId();
  const colNome = suppliersColNome();
  const colDocumento = suppliersColDocumento();

  for (const row of rows) {
    const id = row[colId];
    const nome = row[colNome];
    if (id == null || nome == null) continue;

    const idStr = String(id).trim();
    const nomeStr = String(nome).trim();
    if (!idStr || !nomeStr || seenIds.has(idStr)) continue;
    seenIds.add(idStr);

    const documento = row[colDocumento];
    fornecedores.push({
      id: idStr,
      nome: nomeStr,
      documento: documento != null && String(documento).trim() ? String(documento) : undefined,
    });
  }

  return fornecedores;
}

export interface GetClientesOptions {
  q?: string;
  id?: string;
  limit?: number;
}

export interface GetProdutosOptions {
  q?: string;
  codigo?: string;
  /** Quando informado, lista apenas produtos presentes no `itempedido` deste pedido Nomus. */
  pedidoId?: string;
  limit?: number;
}

export interface GetFornecedoresOptions {
  q?: string;
  limit?: number;
}

export async function buscarClientesNomus(
  options: GetClientesOptions = {}
): Promise<{ clientes: ClienteErp[]; source: 'erp' | 'indisponivel' }> {
  const pool = getNomusPool();
  if (!pool) return { clientes: [], source: 'indisponivel' };

  const limit = Math.min(Math.max(options.limit ?? CLIENTES_INITIAL_LIMIT, 1), CLIENTES_SEARCH_LIMIT);
  const where = clientesWhereClause();

  if (options.id?.trim()) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `${CLIENTES_SELECT} ${CLIENTES_FROM} ${where} AND p.id = ? LIMIT 1`,
      [options.id.trim()]
    );
    return { clientes: mapSqlRowsToClientes(rows as Record<string, unknown>[]), source: 'erp' };
  }

  const q = options.q?.trim() ?? '';
  if (q.length >= CLIENTES_MIN_SEARCH_CHARS) {
    const like = `%${q}%`;
    const [rows] = await pool.query<RowDataPacket[]>(
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
    return { clientes: mapSqlRowsToClientes(rows as Record<string, unknown>[]), source: 'erp' };
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `${CLIENTES_SELECT} ${CLIENTES_FROM} ${where}
     ORDER BY p.nome ASC
     LIMIT ?`,
    [limit]
  );
  return { clientes: mapSqlRowsToClientes(rows as Record<string, unknown>[]), source: 'erp' };
}

export async function buscarProdutosNomus(
  options: GetProdutosOptions = {}
): Promise<{ produtos: ProdutoErp[]; source: 'erp' | 'indisponivel' }> {
  const pool = getNomusPool();
  if (!pool) return { produtos: [], source: 'indisponivel' };

  const limit = Math.min(Math.max(options.limit ?? PRODUTOS_INITIAL_LIMIT, 1), PRODUTOS_SEARCH_LIMIT);
  const idEmpresa = produtosIdEmpresa();
  const pedidoId = options.pedidoId?.trim() ?? '';

  if (pedidoId) {
    const produtosPedidoSelect = `
      SELECT
        pr.nome AS codigoProduto,
        pr.descricao AS descricaoProduto,
        COALESCE(gp.nome, '') AS grupoProduto,
        COALESCE(tp.descricao, '') AS tipoProduto,
        SUM(ip.qtde) AS quantidadePedido
    `;
    const produtosPedidoFrom = `
      FROM itempedido ip
      INNER JOIN pedido ped ON ped.id = ip.idPedido
      INNER JOIN produto pr ON pr.id = ip.idProduto
      LEFT JOIN grupoproduto gp ON gp.id = pr.idGrupoProduto
      LEFT JOIN tipoproduto tp ON tp.id = pr.idTipoProduto
    `;
    const produtosPedidoWhere = `
      WHERE ped.id = ?
        AND ped.idEmpresa = ?
    `;
    const produtosPedidoGroup = `
      GROUP BY pr.id, pr.nome, pr.descricao, gp.nome, tp.descricao
    `;

    if (options.codigo?.trim()) {
      const codigo = options.codigo.trim();
      const codigoSemEspacos = codigo.replace(/\s+/g, '');
      const [rows] = await pool.query<RowDataPacket[]>(
        `${produtosPedidoSelect} ${produtosPedidoFrom} ${produtosPedidoWhere}
         AND (
           pr.nome = ?
           OR REPLACE(pr.nome, ' ', '') = ?
         )
         ${produtosPedidoGroup}
         ORDER BY pr.nome ASC
         LIMIT 1`,
        [pedidoId, idEmpresa, codigo, codigoSemEspacos]
      );
      return { produtos: mapSqlRowsToProdutos(rows as Record<string, unknown>[]), source: 'erp' };
    }

    const q = options.q?.trim() ?? '';
    if (q.length >= PRODUTOS_MIN_SEARCH_CHARS) {
      const like = `%${q}%`;
      const [rows] = await pool.query<RowDataPacket[]>(
        `${produtosPedidoSelect} ${produtosPedidoFrom} ${produtosPedidoWhere}
         AND (
           pr.nome LIKE ?
           OR pr.descricao LIKE ?
           OR gp.nome LIKE ?
         )
         ${produtosPedidoGroup}
         ORDER BY pr.nome ASC
         LIMIT ?`,
        [pedidoId, idEmpresa, like, like, like, limit]
      );
      return { produtos: mapSqlRowsToProdutos(rows as Record<string, unknown>[]), source: 'erp' };
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `${produtosPedidoSelect} ${produtosPedidoFrom} ${produtosPedidoWhere}
       ${produtosPedidoGroup}
       ORDER BY pr.nome ASC
       LIMIT ?`,
      [pedidoId, idEmpresa, limit]
    );
    return { produtos: mapSqlRowsToProdutos(rows as Record<string, unknown>[]), source: 'erp' };
  }

  const produtosSelect = `
    SELECT DISTINCT
      se.codigoProduto,
      se.descricaoProduto,
      se.grupoProduto,
      se.tipoProduto
  `;
  const produtosFrom = `
    FROM dw_saldoestoque se
    INNER JOIN setorestoque st
      ON se.codigoSetorEstoque = st.id
     AND se.codigoEmpresa = st.idEmpresa
  `;
  const produtosWhere = `
    WHERE se.ativoProduto = 'Sim'
      AND st.ativo = 1
      AND st.idEmpresa = ?
      AND st.consideraComoSaldoDisponivel = 1
  `;

  if (options.codigo?.trim()) {
    const codigo = options.codigo.trim();
    const codigoSemEspacos = codigo.replace(/\s+/g, '');
    const [rows] = await pool.query<RowDataPacket[]>(
      `${produtosSelect} ${produtosFrom} ${produtosWhere}
       AND (
         se.codigoProduto = ?
         OR REPLACE(se.codigoProduto, ' ', '') = ?
       )
       ORDER BY se.codigoProduto ASC
       LIMIT 1`,
      [idEmpresa, codigo, codigoSemEspacos]
    );
    return { produtos: mapSqlRowsToProdutos(rows as Record<string, unknown>[]), source: 'erp' };
  }

  const q = options.q?.trim() ?? '';
  if (q.length >= PRODUTOS_MIN_SEARCH_CHARS) {
    const like = `%${q}%`;
    const [rows] = await pool.query<RowDataPacket[]>(
      `${produtosSelect} ${produtosFrom} ${produtosWhere}
       AND (
         se.codigoProduto LIKE ?
         OR se.descricaoProduto LIKE ?
         OR se.grupoProduto LIKE ?
       )
       ORDER BY se.codigoProduto ASC
       LIMIT ?`,
      [idEmpresa, like, like, like, limit]
    );
    return { produtos: mapSqlRowsToProdutos(rows as Record<string, unknown>[]), source: 'erp' };
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `${produtosSelect} ${produtosFrom} ${produtosWhere}
     ORDER BY se.codigoProduto ASC
     LIMIT ?`,
    [idEmpresa, limit]
  );
  return { produtos: mapSqlRowsToProdutos(rows as Record<string, unknown>[]), source: 'erp' };
}

export async function buscarFornecedoresNomus(
  options: GetFornecedoresOptions = {}
): Promise<{ fornecedores: FornecedorErp[]; source: 'erp' | 'indisponivel' }> {
  const pool = getNomusPool();
  if (!pool) return { fornecedores: [], source: 'indisponivel' };

  const limit = Math.min(
    Math.max(options.limit ?? FORNECEDORES_INITIAL_LIMIT, 1),
    FORNECEDORES_SEARCH_LIMIT
  );
  const baseQuery = suppliersBaseQuery();
  const nomeCol = suppliersColNome();
  const q = options.q?.trim() ?? '';

  if (q.length >= FORNECEDORES_MIN_SEARCH_CHARS) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM (${baseQuery}) AS fornecedores WHERE ${nomeCol} LIKE ? ORDER BY ${nomeCol} ASC LIMIT ?`,
      [`%${q}%`, limit]
    );
    return {
      fornecedores: mapSqlRowsToFornecedores(rows as Record<string, unknown>[]),
      source: 'erp',
    };
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM (${baseQuery}) AS fornecedores ORDER BY ${nomeCol} ASC LIMIT ?`,
    [limit]
  );
  return {
    fornecedores: mapSqlRowsToFornecedores(rows as Record<string, unknown>[]),
    source: 'erp',
  };
}

export interface GetPessoasOptions {
  q?: string;
  limit?: number;
  /** Por padrão lista funcionários (pessoa.funcionario = 1). */
  apenasFuncionarios?: boolean;
}

function mapSqlRowsToPessoas(rows: Record<string, unknown>[]): PessoaErp[] {
  const pessoas: PessoaErp[] = [];
  const vistos = new Set<string>();

  for (const row of rows) {
    const id = String(row.id ?? '').trim();
    const nome = String(row.nome ?? '').trim();
    if (!id || !nome || vistos.has(id)) continue;
    vistos.add(id);
    const documento = String(row.documento ?? '').trim();
    pessoas.push({
      id,
      nome,
      documento: documento || undefined,
    });
  }

  return pessoas;
}

/** Busca pessoas no Nomus (por padrão funcionários ativos). */
export async function buscarPessoasNomus(
  options: GetPessoasOptions = {}
): Promise<{ pessoas: PessoaErp[]; source: 'erp' | 'indisponivel' }> {
  const pool = getNomusPool();
  if (!pool) return { pessoas: [], source: 'indisponivel' };

  const limit = Math.min(
    Math.max(options.limit ?? PESSOAS_INITIAL_LIMIT, 1),
    PESSOAS_SEARCH_LIMIT
  );
  const apenasFuncionarios = options.apenasFuncionarios !== false;

  const select = `
    SELECT
      p.id,
      p.nome,
      IF(p.tipoPessoa = 1, p.cnpjCpf, p.cpf) AS documento
    FROM pessoa p
    WHERE p.ativo = 1
      ${apenasFuncionarios ? 'AND p.funcionario = 1' : ''}
  `;

  const q = options.q?.trim() ?? '';
  if (q.length >= PESSOAS_MIN_SEARCH_CHARS) {
    const like = `%${q}%`;
    const [rows] = await pool.query<RowDataPacket[]>(
      `${select}
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
    return { pessoas: mapSqlRowsToPessoas(rows as Record<string, unknown>[]), source: 'erp' };
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `${select}
     ORDER BY p.nome ASC
     LIMIT ?`,
    [limit]
  );
  return { pessoas: mapSqlRowsToPessoas(rows as Record<string, unknown>[]), source: 'erp' };
}

export interface GetPedidosVendaOptions {
  q?: string;
  limit?: number;
}

function pedidosVendaIdEmpresa(): number {
  const raw = process.env.QUALIDADE_PEDIDOS_EMPRESA_ID?.trim() || '1';
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Subquery de telefone do cliente do pedido (alias `cli`). */
const PEDIDO_CLIENTE_TELEFONE_SUBQUERY = `
  (
    SELECT GROUP_CONCAT(telefone_fmt SEPARATOR ' / ')
    FROM (
      SELECT
        CONCAT(
          IF(t.DDD IS NULL OR TRIM(t.DDD) = '', '', CONCAT(TRIM(t.DDD), ' - ')),
          TRIM(t.numero)
        ) AS telefone_fmt
      FROM telefone t
      WHERE t.idEntidade = cli.id
        AND t.discriminador = 'P'
        AND TRIM(t.numero) <> ''
      ORDER BY t.telefonePrincipal DESC, t.id ASC
      LIMIT 2
    ) tel
  ) AS telefone
`;

const PEDIDO_CLIENTE_CONTATO_SUBQUERY = `
  (
    SELECT c.nome
    FROM pessoa_contato pc
    INNER JOIN contato c ON c.id = pc.idContato
    WHERE pc.idParceiro = cli.id
      AND TRIM(c.nome) <> ''
    ORDER BY pc.idContato ASC
    LIMIT 1
  ) AS contato
`;

const PEDIDOS_VENDA_SELECT = `
  SELECT
    p.id AS pedidoId,
    p.nome AS numero,
    DATE_FORMAT(p.dataEmissao, '%Y-%m-%d') AS dataEmissao,
    cli.id AS clienteId,
    cli.nome AS clienteNome,
    cli.nomeRazaoSocial AS clienteRazaoSocial,
    cli.uf,
    cli.endereco,
    cli.bairroDistrito AS bairro,
    m.nome AS municipio,
    ${PEDIDO_CLIENTE_TELEFONE_SUBQUERY},
    ${PEDIDO_CLIENTE_CONTATO_SUBQUERY},
    IF(cli.tipoPessoa = 1, cli.cnpjCpf, cli.cpf) AS documento
`;

const PEDIDOS_VENDA_FROM = `
  FROM pedido p
  LEFT JOIN pessoa cli ON cli.id = p.idCliente
  LEFT JOIN municipio m ON m.id = cli.idMunicipio
`;

function mapSqlRowsToPedidosVenda(rows: Record<string, unknown>[]): PedidoVendaErp[] {
  const pedidos: PedidoVendaErp[] = [];
  const vistos = new Set<string>();

  const textoOpcional = (valor: unknown) => {
    const texto = String(valor ?? '').trim();
    return texto || undefined;
  };

  for (const row of rows) {
    const numero = String(row.numero ?? '').trim();
    const pedidoId = String(row.pedidoId ?? '').trim();
    if (!numero || vistos.has(pedidoId)) continue;
    vistos.add(pedidoId);

    const clienteId = String(row.clienteId ?? '').trim();
    const clienteNome = String(row.clienteNome ?? '').trim();
    const cliente: ClienteErp | null = clienteId && clienteNome
      ? {
          id: clienteId,
          nome: clienteNome,
          razaoSocial: String(row.clienteRazaoSocial ?? clienteNome).trim(),
          municipio: String(row.municipio ?? '').trim(),
          uf: String(row.uf ?? '').trim().toUpperCase(),
          endereco: textoOpcional(row.endereco),
          bairro: textoOpcional(row.bairro),
          telefone: textoOpcional(row.telefone),
          contato: textoOpcional(row.contato),
          documento: textoOpcional(row.documento),
        }
      : null;

    pedidos.push({
      pedidoId,
      numero,
      dataEmissao: String(row.dataEmissao ?? '').trim(),
      clienteNome,
      cliente,
    });
  }

  return pedidos;
}

/** Busca pedidos de venda (tabela `pedido`) por número, trazendo os dados do cliente vinculado. */
export async function buscarPedidosVendaNomus(
  options: GetPedidosVendaOptions = {}
): Promise<{ pedidos: PedidoVendaErp[]; source: 'erp' | 'indisponivel' }> {
  const pool = getNomusPool();
  if (!pool) return { pedidos: [], source: 'indisponivel' };

  const limit = Math.min(
    Math.max(options.limit ?? PEDIDOS_VENDA_INITIAL_LIMIT, 1),
    PEDIDOS_VENDA_SEARCH_LIMIT
  );
  const idEmpresa = pedidosVendaIdEmpresa();
  const q = options.q?.trim() ?? '';

  if (q.length >= PEDIDOS_VENDA_MIN_SEARCH_CHARS) {
    const like = `%${q}%`;
    const [rows] = await pool.query<RowDataPacket[]>(
      `${PEDIDOS_VENDA_SELECT} ${PEDIDOS_VENDA_FROM}
       WHERE p.idEmpresa = ?
         AND (p.nome LIKE ? OR p.nome = ?)
       ORDER BY p.dataEmissao DESC, p.id DESC
       LIMIT ?`,
      [idEmpresa, like, q, limit]
    );
    return { pedidos: mapSqlRowsToPedidosVenda(rows as Record<string, unknown>[]), source: 'erp' };
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `${PEDIDOS_VENDA_SELECT} ${PEDIDOS_VENDA_FROM}
     WHERE p.idEmpresa = ?
     ORDER BY p.dataEmissao DESC, p.id DESC
     LIMIT ?`,
    [idEmpresa, limit]
  );
  return { pedidos: mapSqlRowsToPedidosVenda(rows as Record<string, unknown>[]), source: 'erp' };
}

export interface GetDocumentosEntradaOptions {
  fornecedorId: string;
  q?: string;
  limit?: number;
}

function formatDateSql(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const raw = String(value).trim();
  if (!raw) return undefined;
  // MySQL DATETIME / DATE string
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : undefined;
}

function mapSqlRowsToDocumentosEntrada(
  rows: Record<string, unknown>[]
): DocumentoEntradaErp[] {
  const docs: DocumentoEntradaErp[] = [];
  const vistos = new Set<string>();

  for (const row of rows) {
    const id = String(row.id ?? '').trim();
    const numero = String(row.numero ?? '').trim();
    if (!id || !numero || vistos.has(id)) continue;
    vistos.add(id);

    const numeroNFe = String(row.numeroNFe ?? '').trim();
    const tipoMovimentacao = String(row.tipoMovimentacao ?? '').trim();

    docs.push({
      id,
      numero,
      dataEmissao: formatDateSql(row.dataEmissao),
      dataEntrada: formatDateSql(row.dataEntrada),
      numeroNFe: numeroNFe || undefined,
      tipoMovimentacao: tipoMovimentacao || undefined,
    });
  }

  return docs;
}

/**
 * Documentos de entrada (DE…) do Nomus vinculados ao fornecedor (pessoa.idParceiro).
 * Natureza 3 e 4 = compra / entrada; exclui devoluções (natureza 5) mesmo com prefixo DE.
 */
export async function buscarDocumentosEntradaNomus(
  options: GetDocumentosEntradaOptions
): Promise<{ documentos: DocumentoEntradaErp[]; source: 'erp' | 'indisponivel' }> {
  const pool = getNomusPool();
  if (!pool) return { documentos: [], source: 'indisponivel' };

  const fornecedorId = Number(String(options.fornecedorId ?? '').trim());
  if (!Number.isFinite(fornecedorId) || fornecedorId <= 0) {
    return { documentos: [], source: 'erp' };
  }

  const limit = Math.min(
    Math.max(options.limit ?? DOCUMENTOS_ENTRADA_INITIAL_LIMIT, 1),
    DOCUMENTOS_ENTRADA_SEARCH_LIMIT
  );

  const select = `
    SELECT
      de.id,
      de.numeroDocumentoFiscal AS numero,
      de.dataEmissao,
      de.dataEntrada,
      de.numeroNFe,
      tm.nome AS tipoMovimentacao
    FROM documentoestoque de
    INNER JOIN tipomovimentacao tm ON tm.id = de.idTipoMovimentacao
    WHERE de.idParceiro = ?
      AND tm.natureza IN (3, 4)
      AND de.numeroDocumentoFiscal IS NOT NULL
      AND TRIM(de.numeroDocumentoFiscal) <> ''
      AND de.numeroDocumentoFiscal LIKE 'DE%'
  `;

  const q = options.q?.trim() ?? '';
  if (q.length >= DOCUMENTOS_ENTRADA_MIN_SEARCH_CHARS) {
    const like = termoParaPadraoLikeSql(q);
    const [rows] = await pool.query<RowDataPacket[]>(
      `${select}
       AND de.numeroDocumentoFiscal LIKE ?
       ORDER BY COALESCE(de.dataEntrada, de.dataEmissao) DESC, de.id DESC
       LIMIT ?`,
      [fornecedorId, like, limit]
    );
    return {
      documentos: mapSqlRowsToDocumentosEntrada(rows as Record<string, unknown>[]),
      source: 'erp',
    };
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `${select}
     ORDER BY COALESCE(de.dataEntrada, de.dataEmissao) DESC, de.id DESC
     LIMIT ?`,
    [fornecedorId, limit]
  );
  return {
    documentos: mapSqlRowsToDocumentosEntrada(rows as Record<string, unknown>[]),
    source: 'erp',
  };
}

export function qualidadeNomusDisponivel(): boolean {
  return isNomusEnabled();
}
