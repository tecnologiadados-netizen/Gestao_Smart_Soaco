/**
 * Integração Nomus para Compras – produtos para coleta de preços.
 * SQL fornecido; filtros aplicados no servidor para performance.
 */

import { getNomusPool } from '../config/nomusDb.js';
import { termoParaPadraoLikeSql } from '../utils/textoLivreBusca.js';
import {
  buildSqlRegistroColetaComEmpenho,
  buildEmpenhoRessupDetalheSql,
  buildRessupOpenPorPaPedidoSql,
  buildRessupDiretoPorPedidoSql,
} from './sqlRegistroColetaPrecos.js';
import { lookupMetaPedidoEmpenho, lookupPrevisaoPorPedidos } from './consultaEstoqueRepository.js';
import { obterSaldoPaExplosao } from './ressupNaoAlmoxRepository.js';
import { PCP_ID_TIPO_PEDIDO_PRODUCAO_ESTOQUE } from './sql/sqlComprasEstoqueFragments.js';
import { cmpPedidosEmpenho } from '../utils/empenhoPrioridadePedido.js';

const SQL_BASE = `
Select
  p.id As idProduto,
  sco.id As codigoSolicitacao,
  sco.quantidadesolicitada As qtdeSolicitada,
  p.nome As codigoProduto,
  Upper(p.descricao) As descricaoProduto,
  umed.abreviatura As unidadeMedida,
  tp.descricao As tipoProduto,
  gp.nome As grupoProduto,
  fp.id As idFamiliaProduto,
  fp.nome As familiaProduto,
  If((p.ativo = 1), 'Sim', 'Não') As produtoAtivo,
  um.idFornecedor As idFornecedor,
  um.nomefornecedor As ultimoFornecedor,
  Coalesce(nc.opcao, 'A DEFINIR') As nomeColeta,
  Coalesce(ds.opcao, 'A Definir') As diaSemana
From
  produto p
Left Join unidademedida umed On
  p.idUnidadeMedida = umed.id
Left Join tipoproduto tp On
  p.idTipoProduto = tp.id
Left Join grupoproduto gp On
  p.idGrupoProduto = gp.id
Left Join familiaproduto fp On
  p.idFamiliaProduto = fp.id
Left Join
  (
    Select
      b.idProduto,
      c.idItemDocumentoEstoque,
      c.idItemPedidoCompra,
      c.qtde As quantidade,
      c.idprod,
      c.valorunitario As valorunitario,
      c.dataentrada As dataentrada,
      c.datapedidocompra As datapedidocompra,
      c.idFornecedor,
      c.nomefornecedor As nomefornecedor
    From
      (
        Select distinct
          pc.dataEmissao,
          a.idItemDocumentoEstoque As idmax,
          b.idProduto,
          p.nome
        From
          itemdocumentoestoque_itempedidocompra a
        Left Join itemdocumentoestoque b On
          a.idItemDocumentoEstoque = b.id
        Left Join itempedidocompra ipc On
          ipc.id = a.idItemPedidoCompra
        Left Join pedidocompra pc On
          pc.id = ipc.idPedidoCompra
        Left Join produto p On
          p.id = ipc.idProduto
        Inner Join (
          Select
            b2.idProduto,
            Max(pc2.dataEmissao) As dataMaxima,
            Max(a2.idItemDocumentoEstoque) As idMaximo
          From
            itemdocumentoestoque_itempedidocompra a2
          Left Join itemdocumentoestoque b2 On
            a2.idItemDocumentoEstoque = b2.id
          Left Join itempedidocompra ipc2 On
            ipc2.id = a2.idItemPedidoCompra
          Left Join pedidocompra pc2 On
            pc2.id = ipc2.idPedidoCompra
          Group By
            b2.idProduto
        ) As ultima_data On
          (b.idProduto = ultima_data.idProduto)
          And (pc.dataEmissao = ultima_data.dataMaxima)
          And (a.idItemDocumentoEstoque = ultima_data.idMaximo)
      ) b
    Left Join (
      Select
        a.idItemDocumentoEstoque As idgeral,
        a.idItemDocumentoEstoque,
        a.idItemPedidoCompra,
        round((Sum(a.qtde)), 2) As qtde,
        round(e.valorUnitario, 2) As valorunitario,
        c.idProduto As idprod,
        g.nome As nomeprod,
        Date_Format(f.dataEntrada, "%d/%m/%Y") As dataentrada,
        Date_Format(d.dataEmissao, "%d/%m/%Y") As datapedidocompra,
        h.id As idFornecedor,
        h.nome As nomefornecedor
      From
        itemdocumentoestoque_itempedidocompra a
      Left Join movimentacaoproducao b On
        a.idItemDocumentoEstoque = b.id
      Left Join itempedidocompra c On
        a.idItemPedidoCompra = c.id
      Left Join pedidocompra d On
        c.idPedidoCompra = d.id
      Left Join itemdocumentoestoque e On
        a.idItemDocumentoEstoque = e.id
      Left Join documentoestoque f On
        e.idDocumentoEntrada = f.id
      Left Join produto g On
        c.idProduto = g.id
      Left Join pessoa h On
        f.idParceiro = h.id
      Group By
        a.idItemDocumentoEstoque
    ) c On
      b.idmax = c.idgeral
  ) um On
  um.idProduto = p.id
Left Join (
  Select
    apv.idProduto,
    apv.idAtributo,
    alo.opcao,
    apv.idListaOpcao
  From
    atributoprodutovalor apv
  Left Join atributolistaopcao alo On
    alo.id = apv.idListaOpcao
  Where
    apv.idAtributo = 650
) nc On
  nc.idProduto = p.id
Left Join (
  Select
    apv.idProduto,
    apv.idAtributo,
    alo.opcao,
    apv.idListaOpcao
  From
    atributoprodutovalor apv
  Left Join atributolistaopcao alo On
    alo.id = apv.idListaOpcao
  Where
    apv.idAtributo = 651
) ds On
  ds.idProduto = p.id
Left Join (
  Select
    a3.idProduto,
    a3.id,
    (Sum(a3.quantidade) - Coalesce(Sum(scipc.qtdeAtendida), 0)) As quantidadesolicitada
  From
    solicitacaocompra a3
  Left Join solicitacaocompraitempedidocompra scipc On
    a3.id = scipc.idSolicitacaoCompra
  Where
    (a3.status In (2, 6))
    And (a3.lixeira Is Null)
  Group By
    a3.idProduto,
    a3.id
) sco On
  sco.idProduto = p.id
Where
  (p.idTipoProduto In (5, 13, 14, 6, 10, 16, 21, 22))
  And (p.ativo = 1)
`.trim();

export interface FiltrosProdutosColeta {
  codigo?: string;
  descricao?: string;
  familia?: string;
  fornecedor?: string;
  coleta?: string;
  diaSemana?: string;
  apenasComSolicitacao?: boolean;
  /** Multi-valor (OR entre termos) para os campos de filtro mais usados em multi-select.
   *  Quando preenchidos, têm preferência sobre `codigo`, `descricao` e `coleta`. */
  codigos?: string[];
  descricoes?: string[];
  coletas?: string[];
  diasSemana?: string[];
}

export interface ProdutoColetaRow {
  idProduto: number;
  codigoSolicitacao: number | null;
  qtdeSolicitada: number | null;
  codigoProduto: string;
  descricaoProduto: string;
  unidadeMedida: string;
  tipoProduto: string;
  grupoProduto: string;
  idFamiliaProduto: number | null;
  familiaProduto: string;
  produtoAtivo: string;
  idFornecedor: number | null;
  ultimoFornecedor: string;
  nomeColeta: string;
  diaSemana: string;
}

/** Normaliza arrays de termos: trim, remove vazios e deduplica. */
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

/** Monta SQL com filtros opcionais (parâmetros preparados).
 *  Suporta multi-valor (`codigos`, `descricoes`, `coletas`) — OR entre termos do mesmo campo. */
function buildSqlAndParams(filtros: FiltrosProdutosColeta): { sql: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  const codigos = dedupTermos(filtros.codigos);
  const descricoes = dedupTermos(filtros.descricoes);
  const coletas = dedupTermos(filtros.coletas);

  if (codigos.length > 0) {
    const ors: string[] = [];
    for (const c of codigos) {
      ors.push('(p.nome LIKE ? OR CAST(p.id AS CHAR) = ?)');
      params.push(termoParaPadraoLikeSql(c), c);
    }
    conditions.push(`(${ors.join(' Or ')})`);
  } else if (filtros.codigo?.trim()) {
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
  } else if (filtros.descricao?.trim()) {
    const d = filtros.descricao.trim().toUpperCase();
    conditions.push('Upper(p.descricao) LIKE ?');
    params.push(termoParaPadraoLikeSql(d));
  }

  if (filtros.familia?.trim()) {
    const f = filtros.familia.trim();
    conditions.push('fp.nome LIKE ?');
    params.push(termoParaPadraoLikeSql(f));
  }
  if (filtros.fornecedor?.trim()) {
    const fo = filtros.fornecedor.trim();
    conditions.push('um.nomefornecedor LIKE ?');
    params.push(termoParaPadraoLikeSql(fo));
  }

  if (coletas.length > 0) {
    const ors: string[] = [];
    for (const co of coletas) {
      ors.push('Coalesce(nc.opcao, \'A DEFINIR\') LIKE ?');
      params.push(termoParaPadraoLikeSql(co));
    }
    conditions.push(`(${ors.join(' Or ')})`);
  } else if (filtros.coleta?.trim()) {
    const co = filtros.coleta.trim();
    conditions.push('Coalesce(nc.opcao, \'A DEFINIR\') LIKE ?');
    params.push(termoParaPadraoLikeSql(co));
  }

  if (filtros.diaSemana?.trim()) {
    const ds = filtros.diaSemana.trim();
    conditions.push('Coalesce(ds.opcao, \'A Definir\') LIKE ?');
    params.push(termoParaPadraoLikeSql(ds));
  }
  if (filtros.apenasComSolicitacao === true) {
    conditions.push('(sco.quantidadesolicitada Is Not Null And sco.quantidadesolicitada > 0)');
  }

  const whereExtra = conditions.length ? ` And ${conditions.join(' And ')}` : '';
  const sql = `${SQL_BASE}${whereExtra}`;
  return { sql, params };
}

/**
 * Lista produtos para coleta de preços a partir do Nomus.
 * Filtros aplicados no SQL para performance.
 */
export interface OpcoesFiltroRessupAlmox {
  codigos: string[];
  descricoes: string[];
  coletas: string[];
  diasSemana: string[];
  /** @deprecated Não enviado na carga inicial — cascata/typeahead no servidor. */
  items: { codigo: string; descricao: string; coleta: string }[];
}

export interface FiltrosRessupAlmox {
  codigo?: string;
  descricao?: string;
  coleta?: string;
  diaSemana?: string;
  codigos?: string[];
  descricoes?: string[];
  coletas?: string[];
  diasSemana?: string[];
}

const BUSCA_OPCOES_RESSUP_ALMOX_LIMITE = 80;
const OPCOES_FILTRO_RESSUP_ALMOX_CACHE_TTL_MS = 5 * 60 * 1000;

const SQL_JOIN_COLETA_RESSUP_ALMOX = `
  Left Join (
    Select apv.idProduto, alo.opcao
    From atributoprodutovalor apv
    Left Join atributolistaopcao alo On alo.id = apv.idListaOpcao
    Where apv.idAtributo = 650
  ) nc On nc.idProduto = p.id
`.trim();

const SQL_JOIN_DIA_COMPRA_RESSUP_ALMOX = `
  Left Join (
    Select apv.idProduto, alo.opcao
    From atributoprodutovalor apv
    Left Join atributolistaopcao alo On alo.id = apv.idListaOpcao
    Where apv.idAtributo = 651
  ) ds On ds.idProduto = p.id
`.trim();

/** FROM leve para filtros (sem join de fornecedor/solicitação). */
const SQL_FROM_RESSUP_ALMOX = `
From produto p
${SQL_JOIN_COLETA_RESSUP_ALMOX}
${SQL_JOIN_DIA_COMPRA_RESSUP_ALMOX}
Where (p.idTipoProduto In (5, 13, 14, 6, 10, 16, 21, 22)) And (p.ativo = 1)
`.trim();

let opcoesFiltroRessupAlmoxCache: { data: OpcoesFiltroRessupAlmox; expiresAt: number } | null = null;

function buildOptionalFiltersRessupAlmox(
  filtros: FiltrosRessupAlmox,
  omitir?: 'codigo' | 'descricao' | 'coleta' | 'diaSemana'
): { conditions: string[]; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  const codigos = omitir === 'codigo' ? [] : dedupTermos(filtros.codigos);
  const descricoes = omitir === 'descricao' ? [] : dedupTermos(filtros.descricoes);
  const coletas = omitir === 'coleta' ? [] : dedupTermos(filtros.coletas);
  const diasSemana = omitir === 'diaSemana' ? [] : dedupTermos(filtros.diasSemana);

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
    const ors: string[] = [];
    for (const co of coletas) {
      ors.push("Coalesce(nc.opcao, 'A DEFINIR') = ?");
      params.push(co);
    }
    conditions.push(`(${ors.join(' Or ')})`);
  } else if (omitir !== 'coleta' && filtros.coleta?.trim()) {
    const co = filtros.coleta.trim();
    conditions.push("Coalesce(nc.opcao, 'A DEFINIR') LIKE ?");
    params.push(termoParaPadraoLikeSql(co));
  }

  if (diasSemana.length > 0) {
    const ors: string[] = [];
    for (const ds of diasSemana) {
      ors.push("Coalesce(ds.opcao, 'A Definir') = ?");
      params.push(ds);
    }
    conditions.push(`(${ors.join(' Or ')})`);
  } else if (omitir !== 'diaSemana' && filtros.diaSemana?.trim()) {
    const ds = filtros.diaSemana.trim();
    conditions.push("Coalesce(ds.opcao, 'A Definir') LIKE ?");
    params.push(termoParaPadraoLikeSql(ds));
  }

  return { conditions, params };
}

async function listarDistinctOpcaoRessupAlmox(
  pool: NonNullable<ReturnType<typeof getNomusPool>>,
  campo: 'coleta' | 'diaSemana',
  filtros: FiltrosRessupAlmox
): Promise<string[]> {
  const omitir = campo === 'coleta' ? 'coleta' : 'diaSemana';
  const expr =
    campo === 'coleta'
      ? "Coalesce(nc.opcao, 'A DEFINIR')"
      : "Coalesce(ds.opcao, 'A Definir')";
  const { conditions, params } = buildOptionalFiltersRessupAlmox(filtros, omitir);
  const cascadeSql = conditions.length > 0 ? ` And ${conditions.join(' And ')}` : '';
  const sql = `Select Distinct ${expr} As v ${SQL_FROM_RESSUP_ALMOX}${cascadeSql} Order By v`;
  const [rows] = await pool.query<Record<string, unknown>[]>(sql, params);
  return (Array.isArray(rows) ? rows : [])
    .map((r) => String(r.v ?? '').trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/**
 * Opções iniciais do Ressup Almox — somente coletas (código/descrição via typeahead no servidor).
 */
export async function listarOpcoesFiltroRessupAlmox(): Promise<{
  data: OpcoesFiltroRessupAlmox;
  erro?: string;
}> {
  const now = Date.now();
  if (
    opcoesFiltroRessupAlmoxCache &&
    opcoesFiltroRessupAlmoxCache.expiresAt > now &&
    opcoesFiltroRessupAlmoxCache.data.coletas.length > 0
  ) {
    return { data: opcoesFiltroRessupAlmoxCache.data };
  }

  const pool = getNomusPool();
  if (!pool) {
    return { data: { codigos: [], descricoes: [], coletas: [], diasSemana: [], items: [] }, erro: 'NOMUS_DB_URL não configurado' };
  }
  try {
    const [coletas, diasSemana] = await Promise.all([
      listarDistinctOpcaoRessupAlmox(pool, 'coleta', {}),
      listarDistinctOpcaoRessupAlmox(pool, 'diaSemana', {}),
    ]);
    const data: OpcoesFiltroRessupAlmox = { codigos: [], descricoes: [], coletas, diasSemana, items: [] };
    opcoesFiltroRessupAlmoxCache = { data, expiresAt: now + OPCOES_FILTRO_RESSUP_ALMOX_CACHE_TTL_MS };
    return { data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[comprasRepository] listarOpcoesFiltroRessupAlmox:', msg);
    return { data: { codigos: [], descricoes: [], coletas: [], diasSemana: [], items: [] }, erro: msg };
  }
}

/** Cascata server-side: recalcula coletas conforme código/descrição já escolhidos. */
export async function listarOpcoesFiltroCascataRessupAlmox(
  filtros: FiltrosRessupAlmox
): Promise<{ data: OpcoesFiltroRessupAlmox; erro?: string }> {
  const pool = getNomusPool();
  if (!pool) {
    return { data: { codigos: [], descricoes: [], coletas: [], diasSemana: [], items: [] }, erro: 'NOMUS_DB_URL não configurado' };
  }
  try {
    const [coletas, diasSemana] = await Promise.all([
      listarDistinctOpcaoRessupAlmox(pool, 'coleta', filtros),
      listarDistinctOpcaoRessupAlmox(pool, 'diaSemana', filtros),
    ]);
    return { data: { codigos: [], descricoes: [], coletas, diasSemana, items: [] } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[comprasRepository] listarOpcoesFiltroCascataRessupAlmox:', msg);
    return { data: { codigos: [], descricoes: [], coletas: [], diasSemana: [], items: [] }, erro: msg };
  }
}

/** Typeahead de código ou descrição (não carrega catálogo inteiro no browser). */
export async function buscarOpcoesFiltroCampoRessupAlmox(
  campo: 'codigo' | 'descricao',
  termo: string,
  filtros: FiltrosRessupAlmox
): Promise<{ data: string[]; erro?: string }> {
  const pool = getNomusPool();
  if (!pool) {
    return { data: [], erro: 'NOMUS_DB_URL não configurado' };
  }
  const q = termo.trim();
  if (q.length < 2) {
    return { data: [] };
  }

  const omitir = campo === 'codigo' ? 'codigo' : 'descricao';
  const { conditions, params: cascadeParams } = buildOptionalFiltersRessupAlmox(filtros, omitir);
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
  const sql = `Select Distinct ${selectExpr} As v ${SQL_FROM_RESSUP_ALMOX}${cascadeSql}${buscaSql} Order By v Limit ${BUSCA_OPCOES_RESSUP_ALMOX_LIMITE}`;

  try {
    const [rows] = await pool.query<Record<string, unknown>[]>(sql, [...cascadeParams, ...buscaParams]);
    const data = (Array.isArray(rows) ? rows : [])
      .map((r) => String(r.v ?? '').trim())
      .filter(Boolean);
    return { data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[comprasRepository] buscarOpcoesFiltroCampoRessupAlmox:', msg);
    return { data: [], erro: msg };
  }
}

export async function listarProdutosColeta(filtros: FiltrosProdutosColeta = {}): Promise<{
  data: ProdutoColetaRow[];
  erro?: string;
}> {
  const pool = getNomusPool();
  if (!pool) {
    return { data: [], erro: 'NOMUS_DB_URL não configurado' };
  }
  try {
    const { sql, params } = buildSqlAndParams(filtros);
    const [rows] = await pool.query<Record<string, unknown>[]>(sql, params);
    const data = (Array.isArray(rows) ? rows : []).map((r) => ({
      idProduto: r.idProduto ?? r.idproduto ?? 0,
      codigoSolicitacao: r.codigoSolicitacao != null ? Number(r.codigoSolicitacao) : (r.codigosolicitacao != null ? Number(r.codigosolicitacao) : null),
      qtdeSolicitada: r.qtdeSolicitada != null ? Number(r.qtdeSolicitada) : (r.qtdesolicitada != null ? Number(r.qtdesolicitada) : null),
      codigoProduto: r.codigoProduto ?? r.codigoproduto ?? '',
      descricaoProduto: r.descricaoProduto ?? r.descricaoproduto ?? '',
      unidadeMedida: r.unidadeMedida ?? r.unidademedida ?? null,
      tipoProduto: r.tipoProduto ?? r.tipoproduto ?? null,
      grupoProduto: r.grupoProduto ?? r.grupoproduto ?? null,
      idFamiliaProduto: r.idFamiliaProduto ?? r.idfamiliaproduto ?? null,
      familiaProduto: r.familiaProduto ?? r.familiaproduto ?? null,
      produtoAtivo: r.produtoAtivo ?? r.produtoativo ?? '',
      idFornecedor: r.idFornecedor ?? r.idfornecedor ?? null,
      ultimoFornecedor: r.ultimoFornecedor ?? r.ultimofornecedor ?? null,
      nomeColeta: r.nomeColeta ?? r.nomecoleta ?? null,
      diaSemana: r.diaSemana ?? r.diasemana ?? null,
    })) as ProdutoColetaRow[];
    return { data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[comprasRepository] listarProdutosColeta:', msg);
    return { data: [], erro: msg };
  }
}

/** Item para buscar registro: idProduto e opcionalmente idSolicitacao (retorna só a linha da solicitação escolhida). */
export interface ItemRegistroColeta {
  idProduto: number;
  idSolicitacao?: number | null;
}

function keyIdProduto(r: Record<string, unknown>): number {
  const k = Object.keys(r).find((key) => /^id\s*produto$/i.test(String(key).trim()));
  const raw = k ? r[k] : r['Id Produto'] ?? r['id produto'] ?? r.idProduto;
  return Number(raw ?? 0);
}

function keyIdSolicitacao(r: Record<string, unknown>): number | null {
  const k = Object.keys(r).find((key) => /^id\s*solicita/i.test(String(key).trim()));
  const raw = k ? r[k] : r['Id Solicitação'] ?? r['Id Solicitacao'] ?? r.idSolicitacao;
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Colapsa linhas do registro de coleta (grão produto+SC) em uma linha por produto.
 * Sobrescreve Qtd Liberada com a soma de Saldo das SCs (mapa pré-calculado).
 */
export function agregarLinhasRessupPorProduto(
  rows: Record<string, unknown>[],
  solicitacaoMap: Map<number, number>
): Record<string, unknown>[] {
  const byProd = new Map<number, Record<string, unknown>>();
  for (const row of rows) {
    const id = keyIdProduto(row);
    if (id <= 0) continue;
    if (!byProd.has(id)) {
      byProd.set(id, { ...row });
    }
  }
  const result: Record<string, unknown>[] = [];
  for (const [id, row] of byProd) {
    const sol = solicitacaoMap.get(id) ?? 0;
    row['Qtd Liberada'] = sol;
    result.push(row);
  }
  return result;
}

/**
 * Executa o SQL de registro da coleta no Nomus.
 * Aceita itens com idProduto e opcional idSolicitacao; retorna exatamente uma linha por item
 * (a linha da solicitação escolhida, evitando múltiplos registros para o mesmo produto).
 *
 * Empenho: SQL completo do Ressup Almox, com `considerarRequisicoes` sempre ativo nas coletas.
 */
export async function buscarRegistroColetaNomus(itens: ItemRegistroColeta[]): Promise<{
  rows: Record<string, unknown>[];
  erro?: string;
}> {
  if (itens.length === 0) return { rows: [] };
  const pool = getNomusPool();
  if (!pool) return { rows: [], erro: 'NOMUS_DB_URL não configurado' };
  const idProdutosUnicos = [...new Set(itens.map((i) => i.idProduto))];
  const base = buildSqlRegistroColetaComEmpenho(true, false);
  const BATCH = 30;
  try {
    const list: Record<string, unknown>[] = [];
    for (let off = 0; off < idProdutosUnicos.length; off += BATCH) {
      const batchIds = idProdutosUnicos.slice(off, off + BATCH);
      const placeholders = batchIds.map(() => '?').join(', ');
      const sql = `${base} AND p.id IN (${placeholders})`;
      const [rows] = await pool.query<Record<string, unknown>[]>(sql, batchIds);
      if (Array.isArray(rows)) list.push(...rows);
    }
    const result: Record<string, unknown>[] = [];
    const usedIndex = new Set<number>();
    for (const item of itens) {
      const sid = item.idSolicitacao ?? null;
      const idx = list.findIndex((r, i) => {
        if (usedIndex.has(i)) return false;
        const rid = keyIdProduto(r as Record<string, unknown>);
        const rsid = keyIdSolicitacao(r as Record<string, unknown>);
        if (rid !== item.idProduto) return false;
        return sid != null ? rsid === sid : true;
      });
      if (idx >= 0) {
        usedIndex.add(idx);
        result.push(list[idx] as Record<string, unknown>);
      }
    }
    return { rows: result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[comprasRepository] buscarRegistroColetaNomus:', msg);
    return { rows: [], erro: msg };
  }
}

/**
 * Opções de modo de consulta para a análise Ressup Almox.
 * - 'leve': omite o join pesado de empenho (BOM); `Qtde Empenhada` retorna 0. Muito mais rápido.
 * - 'completo': SQL_REGISTRO_COLETA_BASE completo, com Qtde Empenhada calculada via BOM (mais lento).
 */
export type RessupAlmoxModoConsulta = 'leve' | 'completo';

/**
 * Busca as linhas de registro da coleta (Nomus) aplicando os filtros de produto/coleta
 * diretamente no SQL — sem a necessidade de uma consulta prévia de lista de produtos.
 *
 * Isso elimina uma query ao Nomus em relação ao fluxo original de dois passos
 * (listarProdutosColeta → buscarRegistroColetaNomus), reduzindo o tempo de resposta.
 *
 * Aceita modo 'leve' (sem BOM/empenho, rápido) ou 'completo' (Qtde Empenhada calculada).
 */
export async function buscarRegistroColetaNomusComFiltros(
  filtros: Pick<
    FiltrosProdutosColeta,
    'codigo' | 'codigos' | 'descricao' | 'descricoes' | 'coleta' | 'coletas' | 'diaSemana' | 'diasSemana' | 'apenasComSolicitacao'
  >,
  modo: RessupAlmoxModoConsulta = 'completo',
  considerarRequisicoes = false
): Promise<{ rows: Record<string, unknown>[]; erro?: string }> {
  const pool = getNomusPool();
  if (!pool) return { rows: [], erro: 'NOMUS_DB_URL não configurado' };

  const conditions: string[] = [];
  const params: unknown[] = [];

  const codigos = dedupTermos(filtros.codigos);
  const descricoes = dedupTermos(filtros.descricoes);
  const coletas = dedupTermos(filtros.coletas);
  const diasSemana = dedupTermos(filtros.diasSemana);

  if (codigos.length > 0) {
    const ors: string[] = [];
    for (const c of codigos) {
      ors.push('(p.nome LIKE ? OR CAST(p.id AS CHAR) = ?)');
      params.push(termoParaPadraoLikeSql(c), c);
    }
    conditions.push(`(${ors.join(' Or ')})`);
  } else if (filtros.codigo?.trim()) {
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
  } else if (filtros.descricao?.trim()) {
    const d = filtros.descricao.trim().toUpperCase();
    conditions.push('Upper(p.descricao) LIKE ?');
    params.push(termoParaPadraoLikeSql(d));
  }

  if (coletas.length > 0) {
    const ors: string[] = [];
    for (const co of coletas) {
      ors.push("Coalesce(nc.opcao, 'A DEFINIR') LIKE ?");
      params.push(termoParaPadraoLikeSql(co));
    }
    conditions.push(`(${ors.join(' Or ')})`);
  } else if (filtros.coleta?.trim()) {
    const co = filtros.coleta.trim();
    conditions.push("Coalesce(nc.opcao, 'A DEFINIR') LIKE ?");
    params.push(termoParaPadraoLikeSql(co));
  }

  if (diasSemana.length > 0) {
    const ors: string[] = [];
    for (const ds of diasSemana) {
      ors.push("Coalesce(ds.opcao, 'A Definir') = ?");
      params.push(ds);
    }
    conditions.push(`(${ors.join(' Or ')})`);
  } else if (filtros.diaSemana?.trim()) {
    const ds = filtros.diaSemana.trim();
    conditions.push("Coalesce(ds.opcao, 'A Definir') LIKE ?");
    params.push(termoParaPadraoLikeSql(ds));
  }

  if (filtros.apenasComSolicitacao === true) {
    conditions.push('(sco.quantidadesolicitada Is Not Null And sco.quantidadesolicitada > 0)');
  }

  if (conditions.length === 0) {
    return { rows: [], erro: 'Nenhum filtro fornecido.' };
  }

  // Alinhado à nova coleta de preços (SQL_BASE): somente produtos ativos.
  conditions.unshift('(p.ativo = 1)');

  const base = buildSqlRegistroColetaComEmpenho(considerarRequisicoes, modo === 'leve');
  const sql = `${base} And ${conditions.join(' And ')}`;

  try {
    const [rows] = await pool.query<Record<string, unknown>[]>(sql, params);
    return { rows: Array.isArray(rows) ? rows : [] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[comprasRepository] buscarRegistroColetaNomusComFiltros:', msg);
    return { rows: [], erro: msg };
  }
}

export interface FornecedorOpcaoRow {
  id: number;
  nome: string;
  nomeRazaoSocial: string | null;
  uf: string | null;
  cnpjCpf: string | null;
}

/**
 * Lista fornecedores ativos (pessoa.fornecedor=1, ativo=1) para o popup de seleção da cotação.
 * SQL conforme definido: id, nome (cnpjCpf - nome), nomeRazaoSocial, uf, cnpjCpf.
 */
export async function listarFornecedoresAtivos(): Promise<{ data: FornecedorOpcaoRow[]; erro?: string }> {
  const pool = getNomusPool();
  if (!pool) return { data: [], erro: 'NOMUS_DB_URL não configurado' };
  try {
    const sql = `Select
  p.id,
  Concat(p.cnpjCpf, ' - ', p.nome) As nome,
  p.nomeRazaoSocial,
  p.uf,
  p.cnpjCpf
From
  pessoa p
Where
  (p.nomeRazaoSocial Is Not Null) And
  (p.fornecedor = 1) And
  (p.ativo = 1)
Order By
  p.nomeRazaoSocial`;
    const [rows] = await pool.query<Record<string, unknown>[]>(sql);
    const data = (Array.isArray(rows) ? rows : []).map((r) => ({
      id: Number(r.id ?? 0),
      nome: String(r.nome ?? r.Nome ?? '').trim(),
      nomeRazaoSocial: r.nomeRazaoSocial != null ? String(r.nomeRazaoSocial).trim() : null,
      uf: r.uf != null ? String(r.uf).trim() : null,
      cnpjCpf: r.cnpjCpf != null ? String(r.cnpjCpf).trim() : null,
    })) as FornecedorOpcaoRow[];
    return { data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[comprasRepository] listarFornecedoresAtivos:', msg);
    return { data: [], erro: msg };
  }
}

export interface OpcaoNomusRow {
  id: number;
  nome: string;
}

/**
 * Lista condições de pagamento ativas do Nomus (condicaopagamento ativo = 1).
 */
export async function listarCondicoesPagamentoNomus(): Promise<{ data: OpcaoNomusRow[]; erro?: string }> {
  const pool = getNomusPool();
  if (!pool) return { data: [], erro: 'NOMUS_DB_URL não configurado' };
  try {
    const sql = `SELECT id, nome FROM condicaopagamento c WHERE ativo = 1 ORDER BY nome`;
    const [rows] = await pool.query<Record<string, unknown>[]>(sql);
    const data = (Array.isArray(rows) ? rows : []).map((r) => ({
      id: Number(r.id ?? 0),
      nome: String(r.nome ?? '').trim(),
    })) as OpcaoNomusRow[];
    return { data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[comprasRepository] listarCondicoesPagamentoNomus:', msg);
    return { data: [], erro: msg };
  }
}

/**
 * Lista formas de pagamento ativas do Nomus (formapagamento ativo = 1).
 */
export async function listarFormasPagamentoNomus(): Promise<{ data: OpcaoNomusRow[]; erro?: string }> {
  const pool = getNomusPool();
  if (!pool) return { data: [], erro: 'NOMUS_DB_URL não configurado' };
  try {
    const sql = `SELECT id, nome FROM formapagamento f WHERE ativo = 1 ORDER BY nome`;
    const [rows] = await pool.query<Record<string, unknown>[]>(sql);
    const data = (Array.isArray(rows) ? rows : []).map((r) => ({
      id: Number(r.id ?? 0),
      nome: String(r.nome ?? '').trim(),
    })) as OpcaoNomusRow[];
    return { data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[comprasRepository] listarFormasPagamentoNomus:', msg);
    return { data: [], erro: msg };
  }
}

/** Linha de detalhe do PC pendente (Ressup Almox) — mesmo critério da coluna PC (`status` 2,3,4). */
export interface PcPendDetalheRow {
  pedidoCompra: string;
  qtde: number;
  dataEntrega: string | null;
}

const SQL_PC_PEND_DETALHES = `
SELECT
  pc.nome AS pedidoCompra,
  ROUND(ipc.qtde - IFNULL(ipc.qtdeAtendida, 0), 2) AS qtde,
  CASE
    WHEN ipc.dataEntrega IS NULL THEN NULL
    ELSE DATE_FORMAT(CAST(ipc.dataEntrega AS DATE), '%d/%m/%Y')
  END AS dataEntrega
FROM itempedidocompra ipc
INNER JOIN pedidocompra pc ON pc.id = ipc.idPedidoCompra
WHERE ipc.idProduto = ?
  AND ipc.status IN (2, 3, 4)
  AND (ipc.qtde - IFNULL(ipc.qtdeAtendida, 0)) > 0
ORDER BY ipc.dataEntrega IS NULL, ipc.dataEntrega, pc.nome
`;

/** Detalhes das linhas de pedido de compra que compõem o saldo PC Pend do produto. */
export async function listarPcPendDetalhesPorProduto(
  idProduto: number
): Promise<{ data: PcPendDetalheRow[]; erro?: string }> {
  const pool = getNomusPool();
  if (!pool) return { data: [], erro: 'NOMUS_DB_URL não configurado' };
  if (!Number.isFinite(idProduto) || idProduto <= 0) {
    return { data: [], erro: 'idProduto inválido.' };
  }
  try {
    const [rows] = await pool.query<Record<string, unknown>[]>(SQL_PC_PEND_DETALHES, [idProduto]);
    const data = (Array.isArray(rows) ? rows : []).map((r) => ({
      pedidoCompra: String(r.pedidoCompra ?? '').trim() || '—',
      qtde: Number(r.qtde ?? 0),
      dataEntrega: r.dataEntrega != null && String(r.dataEntrega).trim() !== '' ? String(r.dataEntrega) : null,
    }));
    return { data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[comprasRepository] listarPcPendDetalhesPorProduto:', msg);
    return { data: [], erro: msg };
  }
}

/** Linha (analítica) do empenho via produto acabado (BOM) que compõe o empenho da grade Ressup. */
export interface RessupEmpenhoPaRow {
  idPa: number;
  codigoPa: string;
  descricaoPa: string;
  qtdeNecessaria: number;
  /** Pedidos de venda em aberto do PA (qtde). */
  pedidosPa: number;
  /** Estoque do PA em acabados (setores 5/24) abatido da demanda. */
  estoquePa: number;
  /** Empenho líquido deste PA = max(0, qtdeNec*(pedidosPa − estoquePa)). */
  net: number;
}

export interface RessupEmpenhoDetalhe {
  /** Demanda via BOM agrupada por produto acabado (PA). */
  pas: RessupEmpenhoPaRow[];
  /** Empenho por venda direta do próprio item (pedido de venda). */
  vendaDireta: number;
  /** Σ do empenho líquido via BOM. */
  totalBom: number;
  /** Total = totalBom + vendaDireta (igual ao valor da grade). */
  total: number;
}

const arred2 = (n: number): number => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

/**
 * Arredonda uma lista de valores a 2 casas de forma que a SOMA dos arredondados seja
 * exatamente igual a `totalAlvo` (método do maior resto). Evita que a soma das linhas
 * exibidas divirja do total/grade por centavos de arredondamento.
 */
function arredDistribuido(raws: number[], totalAlvo: number): number[] {
  const vals = raws.map((r) => arred2(r));
  let residCent = Math.round((totalAlvo - vals.reduce((s, x) => s + x, 0)) * 100);
  if (residCent === 0 || vals.length === 0) return vals;
  const ordem = raws
    .map((r, i) => ({ i, frac: Math.abs(r * 100 - Math.round(r * 100)) }))
    .sort((a, b) => b.frac - a.frac);
  const step = residCent > 0 ? 0.01 : -0.01;
  let n = Math.abs(residCent);
  let k = 0;
  while (n > 0) {
    const idx = ordem[k % ordem.length].i;
    vals[idx] = arred2(vals[idx] + step);
    n--;
    k++;
  }
  return vals;
}

/**
 * Detalhe analítico do empenho das telas de Ressup (Almox / Não Almox).
 * Usa a MESMA regra/abatimento da grade (reaproveita os blocos SQL do join `emp`),
 * portanto `total` é igual ao valor exibido na coluna "Qtde Empenhada" da grade.
 */
export async function listarEmpenhoRessupDetalhePorProduto(
  idProduto: number,
  considerarRequisicoes: boolean
): Promise<{ data: RessupEmpenhoDetalhe | null; erro?: string }> {
  const pool = getNomusPool();
  if (!pool) return { data: null, erro: 'NOMUS_DB_URL não configurado' };
  if (!Number.isFinite(idProduto) || idProduto <= 0) {
    return { data: null, erro: 'idProduto inválido.' };
  }
  try {
    const sql = buildEmpenhoRessupDetalheSql(considerarRequisicoes);
    const [rows] = await pool.query<Record<string, unknown>[]>(sql, [idProduto]);
    const lista = Array.isArray(rows) ? rows : [];

    const porPa = new Map<number, RessupEmpenhoPaRow & { netRaw: number }>();
    let vendaDireta = 0;
    // Soma em precisão plena (como o Sum do SQL da grade) — arredonda só no fim.
    let totalBomRaw = 0;
    for (const r of lista) {
      vendaDireta = Number(r.venda_direta ?? 0) || 0;
      const idPa = Number(r.idPa ?? 0);
      const net = Number(r.net ?? 0) || 0;
      totalBomRaw += net;
      if (idPa <= 0) continue;
      const qtdeNec = Number(r.qtdeNecessaria ?? 0) || 0;
      const existente = porPa.get(idPa);
      if (existente) {
        existente.qtdeNecessaria += qtdeNec;
        existente.netRaw += net;
      } else {
        porPa.set(idPa, {
          idPa,
          codigoPa: String(r.codigoPa ?? '').trim(),
          descricaoPa: String(r.descricaoPa ?? '').trim(),
          qtdeNecessaria: qtdeNec,
          pedidosPa: Number(r.pedidosPa ?? 0) || 0,
          estoquePa: Number(r.estoquePa ?? 0) || 0,
          net: 0,
          netRaw: net,
        });
      }
    }

    const pas: RessupEmpenhoPaRow[] = [...porPa.values()]
      .filter((p) => p.netRaw > 0.0001)
      .sort((a, b) => b.netRaw - a.netRaw || a.codigoPa.localeCompare(b.codigoPa, 'pt-BR'))
      .map((p) => ({
        idPa: p.idPa,
        codigoPa: p.codigoPa,
        descricaoPa: p.descricaoPa,
        qtdeNecessaria: arred2(p.qtdeNecessaria),
        pedidosPa: arred2(p.pedidosPa),
        estoquePa: arred2(p.estoquePa),
        net: arred2(p.netRaw),
      }));
    const totalBom = arred2(totalBomRaw);
    const vd = arred2(vendaDireta);
    return {
      data: { pas, vendaDireta: vd, totalBom, total: arred2(totalBomRaw + vendaDireta) },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[comprasRepository] listarEmpenhoRessupDetalhePorProduto:', msg);
    return { data: null, erro: msg };
  }
}

/** Linha (analítica) do empenho do Ressup agrupada por pedido de venda. */
export interface RessupEmpenhoPedidoLinha {
  pedido: string;
  dataEntrega: string | null;
  rota: string;
  /** Empenho bruto comprometido pelo pedido (demanda via BOM + venda direta), sem abater estoque de PA. */
  bruto: number;
  /** Parte do bruto coberta pelo estoque de PA (acabados) — abatimento. */
  coberto: number;
  /** Empenho líquido do pedido (bruto − coberto). Σ líquido == valor da grade. */
  liquido: number;
}

export interface RessupEmpenhoPedidoResultado {
  linhas: RessupEmpenhoPedidoLinha[];
  vendaDireta: number;
  /** Σ bruto pedidos com attr. Requisitado (313) = Sim (exclui venda direta). */
  empenhoRequisicao: number;
  /** Σ bruto pedidos tipo Produção para estoque (idTipoPedido = 5, exclui venda direta). */
  empenhoPdEstoque: number;
  totalBruto: number;
  totalCoberto: number;
  /** Total líquido == coluna "Qtde Empenhada" da grade. */
  totalLiquido: number;
  /** Estoque PA em unidades de componente (explosão BOM) — exibido no card do modal Não Almox. */
  estoquePaExplosao?: number;
}

/**
 * Detalhe do empenho do Ressup POR PEDIDO de venda, com a MESMA regra/abatimento da grade.
 *
 * O estoque de produto acabado (PA) abate a demanda cobrindo as entregas mais próximas primeiro
 * (waterfall por data de entrega). Como o open por (PA, pedido) espelha exatamente o bloco `pab`
 * e a venda direta espelha `pac`/`empd`, a soma do empenho líquido por pedido é IGUAL ao valor
 * exibido na coluna "Qtde Empenhada" — inclusive para itens vendidos só diretamente (sem BOM).
 */
export async function listarEmpenhoRessupPorPedido(
  idProduto: number,
  considerarRequisicoes: boolean,
  modoNaoAlmox = false,
  idPedidoFiltro?: number
): Promise<{ data: RessupEmpenhoPedidoResultado | null; erro?: string }> {
  const pool = getNomusPool();
  if (!pool) return { data: null, erro: 'NOMUS_DB_URL não configurado' };
  if (!Number.isFinite(idProduto) || idProduto <= 0) {
    return { data: null, erro: 'idProduto inválido.' };
  }
  try {
    // 1) Detalhe por PA (mesma regra da grade) → qtdeNec total e estoque por produto acabado.
    const detalheSql = buildEmpenhoRessupDetalheSql(considerarRequisicoes);
    const [detRowsRaw] = (await pool.query(detalheSql, [idProduto])) as [Record<string, unknown>[], unknown];
    const detRows = Array.isArray(detRowsRaw) ? detRowsRaw : [];
    const porPa = new Map<number, { idPa: number; qtdeNecPa: number; estoquePa: number }>();
    for (const r of detRows) {
      const idPa = Number(r.idPa ?? 0);
      if (idPa <= 0) continue;
      const qtdeNec = Number(r.qtdeNecessaria ?? 0) || 0;
      const estoquePa = Number(r.estoquePa ?? 0) || 0;
      const ex = porPa.get(idPa);
      if (ex) ex.qtdeNecPa += qtdeNec;
      else porPa.set(idPa, { idPa, qtdeNecPa: qtdeNec, estoquePa });
    }
    const paIds = [...porPa.keys()];

    let estoquePaExplosao = 0;
    if (modoNaoAlmox) {
      const { saldo } = await obterSaldoPaExplosao(idProduto);
      estoquePaExplosao = saldo;
    }

    // 2) Open por (PA, pedido) + 3) venda direta por pedido (em paralelo).
    const diretoSql = buildRessupDiretoPorPedidoSql(considerarRequisicoes);
    const openSql = paIds.length ? buildRessupOpenPorPaPedidoSql(considerarRequisicoes, paIds.length) : null;
    const [diretoRes, openRes] = (await Promise.all([
      pool.query(diretoSql, [idProduto]),
      openSql ? pool.query(openSql, paIds) : Promise.resolve([[], undefined]),
    ])) as [[Record<string, unknown>[], unknown], [Record<string, unknown>[], unknown]];
    const diretoRows = Array.isArray(diretoRes[0]) ? diretoRes[0] : [];
    const openRows = Array.isArray(openRes[0]) ? openRes[0] : [];

    const filtraPedido = (idPedido: number) =>
      idPedidoFiltro == null || idPedido === idPedidoFiltro;

    const pedidoNome = new Map<number, string>();
    const openPorPa = new Map<number, { idPedido: number; pedido: string; open: number }[]>();
    for (const r of openRows) {
      const idPa = Number(r.idPa ?? 0);
      const idPedido = Number(r.idPedido ?? 0);
      const open = Number(r.saldo ?? 0) || 0;
      if (idPa <= 0 || idPedido <= 0 || open <= 0 || !filtraPedido(idPedido)) continue;
      const pedido = String(r.pedido ?? '').trim();
      pedidoNome.set(idPedido, pedido);
      const arr = openPorPa.get(idPa) ?? [];
      arr.push({ idPedido, pedido, open });
      openPorPa.set(idPa, arr);
    }
    const diretoPorPedido = new Map<number, number>();
    for (const r of diretoRows) {
      const idPedido = Number(r.idPedido ?? 0);
      const q = Number(r.saldo ?? 0) || 0;
      if (idPedido <= 0 || q <= 0 || !filtraPedido(idPedido)) continue;
      pedidoNome.set(idPedido, String(r.pedido ?? '').trim());
      diretoPorPedido.set(idPedido, (diretoPorPedido.get(idPedido) ?? 0) + q);
    }

    // Previsão (data de entrega + rota + romaneio) por pedido — também ordena o waterfall.
    const linhasPrev = [...pedidoNome.entries()].map(([idPedido, pedido]) => ({ idPedido, pedido }));
    const idsPedido = linhasPrev.map((l) => l.idPedido);
    const [previsao, metaPorId] = await Promise.all([
      lookupPrevisaoPorPedidos(pool, linhasPrev),
      lookupMetaPedidoEmpenho(pool, idsPedido),
    ]);
    const infoDe = (idPedido: number) => previsao.get((pedidoNome.get(idPedido) ?? '').toUpperCase());
    const dataDe = (idPedido: number) => infoDe(idPedido)?.dataEntrega ?? null;
    const rotaDe = (idPedido: number) => infoDe(idPedido)?.rota ?? '';
    const temRomaneioDe = (idPedido: number) => infoDe(idPedido)?.temRomaneio ?? false;

    const chaveSort = (idPedido: number) => ({
      pedido: pedidoNome.get(idPedido) || '',
      dataEntrega: dataDe(idPedido),
      rota: rotaDe(idPedido),
      temRomaneio: temRomaneioDe(idPedido),
    });

    const acc = new Map<number, { idPedido: number; brutoRaw: number; liquidoRaw: number }>();
    const addAcc = (idPedido: number, bruto: number, liquido: number) => {
      const ex = acc.get(idPedido);
      if (ex) {
        ex.brutoRaw += bruto;
        ex.liquidoRaw += liquido;
      } else {
        acc.set(idPedido, { idPedido, brutoRaw: bruto, liquidoRaw: liquido });
      }
    };

    // Waterfall: estoque de PA cobre as entregas mais próximas primeiro.
    if (modoNaoAlmox) {
      const brutoPorPedido = new Map<number, number>();
      for (const [idPa, pedidos] of openPorPa) {
        const meta = porPa.get(idPa);
        if (!meta || meta.qtdeNecPa <= 0) continue;
        for (const ped of pedidos) {
          const bruto = meta.qtdeNecPa * ped.open;
          brutoPorPedido.set(ped.idPedido, (brutoPorPedido.get(ped.idPedido) ?? 0) + bruto);
        }
      }
      const pedidosOrdenados = [...brutoPorPedido.entries()].sort((a, b) =>
        cmpPedidosEmpenho(chaveSort(a[0]), chaveSort(b[0]))
      );
      let restante = estoquePaExplosao;
      for (const [idPedido, bruto] of pedidosOrdenados) {
        const coberto = Math.min(Math.max(0, restante), bruto);
        const liquido = bruto - coberto;
        restante -= coberto;
        addAcc(idPedido, bruto, liquido);
      }
    } else {
      for (const [idPa, pedidos] of openPorPa) {
        const meta = porPa.get(idPa);
        if (!meta || meta.qtdeNecPa <= 0) continue;
        const ordenados = [...pedidos].sort((a, b) =>
          cmpPedidosEmpenho(chaveSort(a.idPedido), chaveSort(b.idPedido))
        );
        let restante = meta.estoquePa;
        for (const ped of ordenados) {
          const coberto = Math.min(Math.max(0, restante), ped.open);
          const netOpen = ped.open - coberto;
          restante -= coberto;
          addAcc(ped.idPedido, meta.qtdeNecPa * ped.open, meta.qtdeNecPa * netOpen);
        }
      }
    }
    // Venda direta não sofre abatimento: bruto == líquido.
    let vendaDiretaRaw = 0;
    for (const [idPedido, q] of diretoPorPedido) {
      addAcc(idPedido, q, q);
      vendaDiretaRaw += q;
    }

    let totalBrutoRaw = 0;
    let totalLiquidoRaw = 0;
    let empenhoRequisicaoRaw = 0;
    let empenhoPdEstoqueRaw = 0;
    for (const a of acc.values()) {
      totalBrutoRaw += a.brutoRaw;
      totalLiquidoRaw += a.liquidoRaw;
      if (diretoPorPedido.has(a.idPedido)) continue;
      const meta = metaPorId.get(a.idPedido);
      if (meta?.requisitado313) empenhoRequisicaoRaw += a.brutoRaw;
      else if (meta?.idTipoPedido === PCP_ID_TIPO_PEDIDO_PRODUCAO_ESTOQUE) empenhoPdEstoqueRaw += a.brutoRaw;
    }
    const totalBruto = arred2(totalBrutoRaw);
    const totalLiquido = arred2(totalLiquidoRaw);

    // Ordena por data/carrada/pedido e arredonda mantendo Σ linhas == total (= grade).
    const entradas = [...acc.values()]
      .filter((a) => a.brutoRaw > 0.0001 || a.liquidoRaw > 0.0001)
      .sort((a, b) => cmpPedidosEmpenho(chaveSort(a.idPedido), chaveSort(b.idPedido)));
    const brutoVals = arredDistribuido(entradas.map((a) => a.brutoRaw), totalBruto);
    const liquidoVals = arredDistribuido(entradas.map((a) => a.liquidoRaw), totalLiquido);
    const linhas: RessupEmpenhoPedidoLinha[] = entradas.map((a, i) => ({
      pedido: pedidoNome.get(a.idPedido) || '—',
      dataEntrega: dataDe(a.idPedido),
      rota: rotaDe(a.idPedido),
      bruto: brutoVals[i],
      coberto: arred2(brutoVals[i] - liquidoVals[i]),
      liquido: liquidoVals[i],
    }));

    return {
      data: {
        linhas,
        vendaDireta: arred2(vendaDiretaRaw),
        empenhoRequisicao: arred2(empenhoRequisicaoRaw),
        empenhoPdEstoque: arred2(empenhoPdEstoqueRaw),
        totalBruto,
        totalCoberto: arred2(totalBrutoRaw - totalLiquidoRaw),
        totalLiquido,
        ...(modoNaoAlmox ? { estoquePaExplosao: arred2(estoquePaExplosao) } : {}),
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[comprasRepository] listarEmpenhoRessupPorPedido:', msg);
    return { data: null, erro: msg };
  }
}
