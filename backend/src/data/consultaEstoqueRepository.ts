/**
 * Consulta de Estoque (PCP) — leitura Nomus em etapas (filtros → grade agregada → detalhes sob demanda).
 */

import { getNomusPool, isNomusEnabled } from '../config/nomusDb.js';
import { listarPcPendDetalhesPorProduto } from './comprasRepository.js';
import { obterPrevisaoAtualizadaPorIdsPedido } from './pedidosRepository.js';
import { loadBomListaMateriaisAcabadoSemProdutoSql } from './bomListaMateriaisSql.js';
import {
  buildEmpenhoLiquidoBatchSql,
  buildEmpenhoLiquidoBatchSqlPorPedido,
} from './sqlRegistroColetaPrecos.js';
import {
  COLETAS_EXCLUIR_SETOR2_ALMOX,
  NOMUS_ATRIBUTO_COLETA,
  OPCAO_FILTRO_VAZIO,
  SQL_JOIN_COTACAO_AGREGADA,
  SQL_JOIN_PC_PEND_AGREGADA,
  SQL_JOINS_ATRIBUTOS_FILTRO,
  SQL_SALDO_AGREGADO_PARA_PRODUTOS_FILTRADOS,
  STATUS_COTACAO_AGPAG_SQL,
  TIPOS_PRODUTO_CONSULTA_SQL,
} from './sql/sqlComprasEstoqueFragments.js';
import { termoParaPadraoLikeSql } from '../utils/textoLivreBusca.js';

export const CONSULTA_ESTOQUE_MAX_ROWS = 150;

const OPCOES_FILTRO_CACHE_TTL_MS = 5 * 60 * 1000;
let opcoesFiltroCache: { expiresAt: number; data: OpcoesFiltroConsultaEstoque } | null = null;

export type ModoPedidoConsultaEstoque = 'diretos' | 'componentes';
export type EmpenhoEscopoConsultaEstoque = 'pedido' | 'todos';

export interface FiltrosConsultaEstoque {
  codigos?: string[];
  descricoes?: string[];
  tipos?: string[];
  grupos?: string[];
  coletas?: string[];
  setoresProducao?: string[];
  subgrupo1?: string[];
  subgrupo2?: string[];
  idPedido?: number;
  modoPedido?: ModoPedidoConsultaEstoque;
  empenhoEscopo?: EmpenhoEscopoConsultaEstoque;
}

export interface PedidoGerenciadorTypeaheadItem {
  id: number;
  nome: string;
  cliente: string | null;
  dataEmissao: string;
}

export interface ConsultaEstoqueRow {
  idProduto: number;
  codigo: string;
  descricao: string;
  unidadeMedida: string;
  tipoProduto: string;
  saldo: number;
  empenho: number;
  solicitacao: number;
  cotacao: number;
  pedidoCompra: number;
  saldoProjetado: number;
}

export interface OpcoesFiltroConsultaEstoque {
  codigos: string[];
  descricoes: string[];
  tipos: string[];
  grupos: string[];
  coletas: string[];
  setoresProducao: string[];
  subgrupo1: string[];
  subgrupo2: string[];
}

export type CampoFiltroConsultaEstoque =
  | 'codigos'
  | 'descricoes'
  | 'tipos'
  | 'grupos'
  | 'coletas'
  | 'setoresProducao'
  | 'subgrupo1'
  | 'subgrupo2';

export interface SaldoSetorDetalheRow {
  idSetor: number;
  setor: string;
  saldo: number;
}

export interface ScDetalheRow {
  codigo: number;
  usuario: string;
  dataEmissao: string | null;
  dataNecessidade: string | null;
  saldo: number;
}

export interface CotacaoDetalheRow {
  cotacao: string;
  dataEmissao: string | null;
  comprador: string;
  scCodigos: string;
  qtde: number;
}

/** Saldo aberto da SC: quantidade bruta com regras de cotação x compra. */
export function calcularSaldoSc(
  qtdeSolicitada: number,
  qtdeComprada: number,
  qtdeEmCotacao: number
): number {
  const sol = Math.max(0, qtdeSolicitada);
  const comp = Math.max(0, qtdeComprada);
  const cot = Math.max(0, qtdeEmCotacao);
  if (cot > 0 && comp > 0) return Math.max(0, sol - comp);
  if (cot > 0) return Math.max(0, sol - cot);
  return Math.max(0, sol - comp);
}

const SQL_SC_QTDE_COMPRADA_SUB = `
  Select idSolicitacaoCompra, Sum(qtdeAtendida) As qtdeAtendida
  From solicitacaocompraitempedidocompra
  Group By idSolicitacaoCompra`;

const SQL_SC_QTDE_COTACAO_SUB = `
  Select scicc.idSolicitacaoCompra, Sum(scicc.qtdeAtendida) As qtdeEmCotacao
  From solicitacaocompra_itemcotacaocompra scicc
  Inner Join itemcotacaocompra icc On icc.id = scicc.idItemCotacaoCompra
  Inner Join cotacaocompra cc On cc.id = icc.idCotacaoCompra
  Where cc.status In (${STATUS_COTACAO_AGPAG_SQL})
  Group By scicc.idSolicitacaoCompra`;

function escapeLike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
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

function attrExpr(alias: string): string {
  return `Coalesce(Nullif(Trim(${alias}.opcao), ''), '${OPCAO_FILTRO_VAZIO}')`;
}

const SQL_FROM_PRODUTO_JOINS = `
From produto p
Inner Join produtoempresa pe On pe.idProduto = p.id And pe.idEmpresa = 1
Left Join tipoproduto tp On p.idTipoProduto = tp.id
Left Join grupoproduto gp On p.idGrupoProduto = gp.id`;

const SQL_WHERE_PRODUTO_CONSULTA = `
Where p.ativo = 1
  And p.idTipoProduto In (${TIPOS_PRODUTO_CONSULTA_SQL})`;

/** From + where (sem joins de atributo). */
const SQL_FROM_PRODUTO_BASE = `${SQL_FROM_PRODUTO_JOINS}${SQL_WHERE_PRODUTO_CONSULTA}`;

/** Filtros via EXISTS — evita 4 joins de atributo na consulta da grade. */
function buildFiltroConditions(
  filtros: FiltrosConsultaEstoque,
  omitir?: CampoFiltroConsultaEstoque
): { conditions: string[]; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  const addAttrExists = (atributoId: number, terms: string[]) => {
    if (terms.length === 0) return;
    const ors: string[] = [];
    for (const t of terms) {
      if (t === OPCAO_FILTRO_VAZIO) {
        ors.push(`(
          Not Exists (
            Select 1 From atributoprodutovalor apv0
            Where apv0.idProduto = p.id And apv0.idAtributo = ?
          )
          Or Exists (
            Select 1 From atributoprodutovalor apv0
            Left Join atributolistaopcao alo0 On alo0.id = apv0.idListaOpcao
            Where apv0.idProduto = p.id And apv0.idAtributo = ?
              And (alo0.opcao Is Null Or Trim(alo0.opcao) = '')
          )
        )`);
        params.push(atributoId, atributoId);
      } else {
        ors.push(`Exists (
          Select 1 From atributoprodutovalor apv0
          Left Join atributolistaopcao alo0 On alo0.id = apv0.idListaOpcao
          Where apv0.idProduto = p.id And apv0.idAtributo = ?
            And alo0.opcao Like ?
        )`);
        params.push(atributoId, `%${escapeLike(t)}%`);
      }
    }
    conditions.push(`(${ors.join(' Or ')})`);
  };

  const codigos = omitir === 'codigos' ? [] : dedupTermos(filtros.codigos);
  if (codigos.length > 0) {
    const ors: string[] = [];
    for (const c of codigos) {
      ors.push('(p.nome Like ? Or Cast(p.id As Char) = ?)');
      params.push(termoParaPadraoLikeSql(c), c);
    }
    conditions.push(`(${ors.join(' Or ')})`);
  }

  const descricoes = omitir === 'descricoes' ? [] : dedupTermos(filtros.descricoes);
  if (descricoes.length > 0) {
    const ors: string[] = [];
    for (const d of descricoes) {
      ors.push('Upper(p.descricao) Like ?');
      params.push(termoParaPadraoLikeSql(d.toUpperCase()));
    }
    conditions.push(`(${ors.join(' Or ')})`);
  }

  const tipos = omitir === 'tipos' ? [] : dedupTermos(filtros.tipos);
  if (tipos.length > 0) {
    const ors: string[] = [];
    for (const t of tipos) {
      if (t === OPCAO_FILTRO_VAZIO) {
        ors.push('(tp.descricao Is Null Or Trim(tp.descricao) = \'\')');
      } else {
        ors.push('tp.descricao Like ?');
        params.push(`%${escapeLike(t)}%`);
      }
    }
    conditions.push(`(${ors.join(' Or ')})`);
  }

  const grupos = omitir === 'grupos' ? [] : dedupTermos(filtros.grupos);
  if (grupos.length > 0) {
    const ors: string[] = [];
    for (const g of grupos) {
      if (g === OPCAO_FILTRO_VAZIO) {
        ors.push('(gp.nome Is Null Or Trim(gp.nome) = \'\')');
      } else {
        ors.push('gp.nome Like ?');
        params.push(`%${escapeLike(g)}%`);
      }
    }
    conditions.push(`(${ors.join(' Or ')})`);
  }

  if (omitir !== 'coletas') addAttrExists(650, dedupTermos(filtros.coletas));
  if (omitir !== 'setoresProducao') addAttrExists(679, dedupTermos(filtros.setoresProducao));
  if (omitir !== 'subgrupo1') addAttrExists(398, dedupTermos(filtros.subgrupo1));
  if (omitir !== 'subgrupo2') addAttrExists(399, dedupTermos(filtros.subgrupo2));

  const idPedido = filtros.idPedido;
  const modoPedido = filtros.modoPedido;
  if (idPedido != null && idPedido > 0 && modoPedido) {
    if (modoPedido === 'diretos') {
      conditions.push(`Exists (
        Select 1 From itempedido ip_ped
        Where ip_ped.idPedido = ? And ip_ped.status In (2, 3) And ip_ped.idProduto = p.id
      )`);
      params.push(idPedido);
    } else {
      const bomSql = loadBomListaMateriaisAcabadoSemProdutoSql();
      conditions.push(`Exists (
        Select 1 From itempedido ip_ped
        Inner Join (${bomSql}) bom On bom.idprodutopai = ip_ped.idProduto
        Where ip_ped.idPedido = ? And ip_ped.status In (2, 3) And bom.idcomponente = p.id
      )`);
      params.push(idPedido);
    }
  }

  return { conditions, params };
}

/**
 * Grade: produtos filtrados + agregados (empenho BOM em consulta separada por ids).
 */
function buildConsultaSql(filtros: FiltrosConsultaEstoque): { sql: string; params: unknown[] } {
  const { conditions, params } = buildFiltroConditions(filtros);
  const whereExtra = conditions.length ? ` And ${conditions.join(' And ')}` : '';

  const cotJoin = SQL_JOIN_COTACAO_AGREGADA.replace(
    /Where cc\.status In/,
    'Where icc.idProduto In (Select id From produtos_filtrados) And cc.status In'
  ).replace(/On cot_agg\.idProduto = p\.id/, 'On cot_agg.idProduto = pf_outer.id');

  const pcJoin = SQL_JOIN_PC_PEND_AGREGADA.replace(
    /Where ipc\.status In/,
    'Where ipc.idProduto In (Select id From produtos_filtrados) And ipc.status In'
  ).replace(/On pc_agg\.idProduto = p\.id/, 'On pc_agg.idProduto = pf_outer.id');

  const sql = `
With produtos_filtrados As (
  Select
    p.id,
    p.nome,
    Upper(p.descricao) As descricao,
    umed.abreviatura As unidadeMedida,
    tp.descricao As tipoProduto,
    p.idTipoProduto
  From produto p
  Inner Join produtoempresa pe On pe.idProduto = p.id And pe.idEmpresa = 1
  Left Join unidademedida umed On p.idUnidadeMedida = umed.id
  Left Join tipoproduto tp On p.idTipoProduto = tp.id
  Left Join grupoproduto gp On p.idGrupoProduto = gp.id
  Where p.ativo = 1
    And p.idTipoProduto In (${TIPOS_PRODUTO_CONSULTA_SQL})
    ${whereExtra}
)
Select
  pf_outer.id As idProduto,
  pf_outer.nome As codigo,
  pf_outer.descricao,
  pf_outer.unidadeMedida,
  pf_outer.tipoProduto,
  Round(Coalesce(saldo_agg.saldo, 0), 2) As saldo,
  Round(Coalesce(cot_agg.qtde, 0), 2) As cotacao,
  Round(Coalesce(pc_agg.qtde, 0), 2) As pedidoCompra
From produtos_filtrados pf_outer
${SQL_SALDO_AGREGADO_PARA_PRODUTOS_FILTRADOS}
${cotJoin}
${pcJoin}
Order By pf_outer.nome
`.trim();

  return { sql, params };
}

function mapConsultaRow(
  r: Record<string, unknown>,
  extras: { empenho?: number; solicitacao?: number } = {}
): ConsultaEstoqueRow {
  const saldo = Number(r.saldo ?? 0);
  const empenho = extras.empenho ?? 0;
  const solicitacao = extras.solicitacao ?? Number(r.solicitacao ?? 0);
  const cotacao = Number(r.cotacao ?? 0);
  const pedidoCompra = Number(r.pedidoCompra ?? 0);
  const saldoProjetado = saldo - empenho + solicitacao + cotacao + pedidoCompra;
  return {
    idProduto: Number(r.idProduto ?? 0),
    codigo: String(r.codigo ?? '').trim(),
    descricao: String(r.descricao ?? '').trim(),
    unidadeMedida: String(r.unidadeMedida ?? '').trim(),
    tipoProduto: String(r.tipoProduto ?? '').trim(),
    saldo,
    empenho,
    solicitacao,
    cotacao,
    pedidoCompra,
    saldoProjetado: Math.round(saldoProjetado * 100) / 100,
  };
}

async function queryDistinct(
  pool: NonNullable<ReturnType<typeof getNomusPool>>,
  selectExpr: string,
  filtros: FiltrosConsultaEstoque,
  omitir: CampoFiltroConsultaEstoque,
  comJoinAtributos = false
): Promise<string[]> {
  const { conditions, params } = buildFiltroConditions(filtros, omitir);
  const whereExtra = conditions.length ? ` And ${conditions.join(' And ')}` : '';
  const joinsAttr = comJoinAtributos ? SQL_JOINS_ATRIBUTOS_FILTRO : '';
  const sql = `Select Distinct ${selectExpr} As v ${SQL_FROM_PRODUTO_JOINS}${joinsAttr}${SQL_WHERE_PRODUTO_CONSULTA}${whereExtra} Order By v Limit 8000`;
  try {
    const [rows] = (await pool.query(sql, params)) as [Record<string, unknown>[], unknown];
    return (Array.isArray(rows) ? rows : [])
      .map((r) => String(r.v ?? '').trim())
      .filter((v) => v.length > 0);
  } catch (err) {
    console.error(
      `[consultaEstoqueRepository] queryDistinct(${omitir}):`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

const EMPTY_OPCOES: OpcoesFiltroConsultaEstoque = {
  codigos: [],
  descricoes: [],
  tipos: [],
  grupos: [],
  coletas: [],
  setoresProducao: [],
  subgrupo1: [],
  subgrupo2: [],
};

/** Opções iniciais (catálogo leve; código/descrição via typeahead no ERP). */
export async function listarOpcoesFiltroConsultaEstoque(): Promise<{
  data: OpcoesFiltroConsultaEstoque;
  erro?: string;
}> {
  const now = Date.now();
  if (opcoesFiltroCache && opcoesFiltroCache.expiresAt > now && opcoesFiltroCache.data.tipos.length > 0) {
    return { data: opcoesFiltroCache.data };
  }

  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) {
    return { data: EMPTY_OPCOES, erro: 'NOMUS_DB_URL não configurado' };
  }
  try {
    const filtrosVazios: FiltrosConsultaEstoque = {};
    const tiposP = queryDistinct(
      pool,
      `Coalesce(Nullif(Trim(tp.descricao), ''), '${OPCAO_FILTRO_VAZIO}')`,
      filtrosVazios,
      'tipos'
    );
    const gruposP = queryDistinct(
      pool,
      `Coalesce(Nullif(Trim(gp.nome), ''), '${OPCAO_FILTRO_VAZIO}')`,
      filtrosVazios,
      'grupos'
    );
    const coletasP = queryDistinct(pool, attrExpr('attr_coleta'), filtrosVazios, 'coletas', true);
    const setoresP = queryDistinct(pool, attrExpr('attr_setor'), filtrosVazios, 'setoresProducao', true);
    const sg1P = queryDistinct(pool, attrExpr('attr_sg1'), filtrosVazios, 'subgrupo1', true);
    const sg2P = queryDistinct(pool, attrExpr('attr_sg2'), filtrosVazios, 'subgrupo2', true);

    const [tipos, grupos, coletas, setores, sg1, sg2] = await Promise.all([
      tiposP,
      gruposP,
      coletasP,
      setoresP,
      sg1P,
      sg2P,
    ]);
    const data: OpcoesFiltroConsultaEstoque = {
      codigos: [],
      descricoes: [],
      tipos,
      grupos,
      coletas,
      setoresProducao: setores,
      subgrupo1: sg1,
      subgrupo2: sg2,
    };
    opcoesFiltroCache = { data, expiresAt: now + OPCOES_FILTRO_CACHE_TTL_MS };
    return { data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[consultaEstoqueRepository] listarOpcoesFiltro:', msg);
    return { data: EMPTY_OPCOES, erro: msg };
  }
}

/** Cascata server-side: recalcula listas conforme filtros já escolhidos. */
export async function listarOpcoesFiltroCascata(
  filtros: FiltrosConsultaEstoque
): Promise<{ data: OpcoesFiltroConsultaEstoque; erro?: string }> {
  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) {
    return { data: EMPTY_OPCOES, erro: 'NOMUS_DB_URL não configurado' };
  }
  try {
    const [tipos, grupos, coletas, setores, sg1, sg2] = await Promise.all([
      queryDistinct(
        pool,
        `Coalesce(Nullif(Trim(tp.descricao), ''), '${OPCAO_FILTRO_VAZIO}')`,
        filtros,
        'tipos'
      ),
      queryDistinct(
        pool,
        `Coalesce(Nullif(Trim(gp.nome), ''), '${OPCAO_FILTRO_VAZIO}')`,
        filtros,
        'grupos'
      ),
      queryDistinct(pool, attrExpr('attr_coleta'), filtros, 'coletas', true),
      queryDistinct(pool, attrExpr('attr_setor'), filtros, 'setoresProducao', true),
      queryDistinct(pool, attrExpr('attr_sg1'), filtros, 'subgrupo1', true),
      queryDistinct(pool, attrExpr('attr_sg2'), filtros, 'subgrupo2', true),
    ]);
    return {
      data: {
        codigos: [],
        descricoes: [],
        tipos,
        grupos,
        coletas,
        setoresProducao: setores,
        subgrupo1: sg1,
        subgrupo2: sg2,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { data: EMPTY_OPCOES, erro: msg };
  }
}

const BUSCA_LIMITE = 80;

/** Busca typeahead de código ou descrição (não carrega catálogo inteiro no browser). */
export async function buscarOpcoesFiltroCampo(
  campo: 'codigo' | 'descricao',
  termo: string,
  filtros: FiltrosConsultaEstoque
): Promise<{ data: string[]; erro?: string }> {
  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) {
    return { data: [], erro: 'NOMUS_DB_URL não configurado' };
  }
  const q = termo.trim();
  if (q.length < 2) {
    return { data: [] };
  }

  const omitir: CampoFiltroConsultaEstoque = campo === 'codigo' ? 'codigos' : 'descricoes';
  const { conditions, params } = buildFiltroConditions(filtros, omitir);
  const whereExtra = conditions.length ? ` And ${conditions.join(' And ')}` : '';

  const buscaSql =
    campo === 'codigo'
      ? ` And (p.nome Like ? Or Cast(p.id As Char) = ?)`
      : ` And Upper(p.descricao) Like ?`;
  const buscaParams =
    campo === 'codigo'
      ? [termoParaPadraoLikeSql(q), q]
      : [termoParaPadraoLikeSql(q.toUpperCase())];

  const selectExpr = campo === 'codigo' ? 'p.nome' : 'Upper(p.descricao)';
  const sql = `Select Distinct ${selectExpr} As v ${SQL_FROM_PRODUTO_BASE}${whereExtra}${buscaSql} Order By v Limit ${BUSCA_LIMITE}`;

  try {
    const [rows] = (await pool.query(sql, [...params, ...buscaParams])) as [
      Record<string, unknown>[],
      unknown,
    ];
    const data = (Array.isArray(rows) ? rows : [])
      .map((r) => String(r.v ?? '').trim())
      .filter(Boolean);
    return { data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { data: [], erro: msg };
  }
}

/**
 * Empenho líquido em lote (mesma regra do Ressup/Coletas: abate PA pronto setores 5/24).
 */
async function consultarEmpenhoLiquidoPorIds(
  ids: number[],
  considerarRequisicoes: boolean,
  opts?: {
    idPedido?: number;
    modoPedido?: ModoPedidoConsultaEstoque;
    empenhoEscopo?: EmpenhoEscopoConsultaEstoque;
  }
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (ids.length === 0) return map;

  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) return map;

  const usarEmpenhoPedido =
    opts?.empenhoEscopo === 'pedido' &&
    opts.idPedido != null &&
    opts.idPedido > 0 &&
    opts.modoPedido != null;

  try {
    let sql: string;
    let params: unknown[];
    if (usarEmpenhoPedido) {
      sql = buildEmpenhoLiquidoBatchSqlPorPedido(
        considerarRequisicoes,
        ids.length,
        opts.modoPedido!
      );
      if (opts.modoPedido === 'diretos') {
        params = [opts.idPedido, ...ids];
      } else {
        const pdBinds = (sql.match(/pd\.id = \?/gi) ?? []).length;
        params = [...Array(pdBinds).fill(opts.idPedido), ...ids, ...ids, ...ids];
      }
    } else {
      sql = buildEmpenhoLiquidoBatchSql(considerarRequisicoes, ids.length);
      params = [...ids, ...ids, ...ids];
    }
    const [rows] = (await pool.query(sql, params)) as [Record<string, unknown>[], unknown];
    for (const r of Array.isArray(rows) ? rows : []) {
      const id = Number(r.idProduto ?? 0);
      if (id <= 0) continue;
      map.set(id, Math.round(Number(r.empenho ?? 0) * 100) / 100);
    }
    for (const id of ids) {
      if (!map.has(id)) map.set(id, 0);
    }
  } catch (err) {
    console.error(
      '[consultaEstoqueRepository] consultarEmpenhoLiquidoPorIds:',
      err instanceof Error ? err.message : err
    );
    for (const id of ids) {
      if (!map.has(id)) map.set(id, 0);
    }
  }
  return map;
}

/**
 * Soma do Saldo das SCs abertas (status 2/6) por produto — espelha o modal de solicitação.
 */
export async function consultarSolicitacaoSaldoPorIds(ids: number[]): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (ids.length === 0) return map;

  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) return map;

  const placeholders = ids.map(() => '?').join(', ');

  const sql = `
With sc_base As (
  Select
    sc.idProduto,
    Greatest(0, sc.quantidade) As qtdeSolicitada,
    Coalesce(ate.qtdeAtendida, 0) As qtdeComprada,
    Coalesce(cot.qtdeEmCotacao, 0) As qtdeEmCotacao
  From solicitacaocompra sc
  Left Join (${SQL_SC_QTDE_COMPRADA_SUB}) ate On ate.idSolicitacaoCompra = sc.id
  Left Join (${SQL_SC_QTDE_COTACAO_SUB}) cot On cot.idSolicitacaoCompra = sc.id
  Where sc.idProduto In (${placeholders})
    And sc.status In (2, 6)
    And sc.lixeira Is Null
)
Select
  idProduto,
  Round(Sum(
    Case
      When qtdeEmCotacao > 0 And qtdeComprada > 0 Then Greatest(0, qtdeSolicitada - qtdeComprada)
      When qtdeEmCotacao > 0 Then Greatest(0, qtdeSolicitada - qtdeEmCotacao)
      Else Greatest(0, qtdeSolicitada - qtdeComprada)
    End
  ), 2) As solicitacao
From sc_base
Group By idProduto
`.trim();

  try {
    const [rows] = (await pool.query(sql, ids)) as [Record<string, unknown>[], unknown];
    for (const r of Array.isArray(rows) ? rows : []) {
      const id = Number(r.idProduto ?? 0);
      if (id <= 0) continue;
      map.set(id, Number(r.solicitacao ?? 0));
    }
    for (const id of ids) {
      if (!map.has(id)) map.set(id, 0);
    }
  } catch (err) {
    console.error(
      '[consultaEstoqueRepository] consultarSolicitacaoSaldoPorIds:',
      err instanceof Error ? err.message : err
    );
  }
  return map;
}

export function filtrosConsultaTemAlgum(filtros: FiltrosConsultaEstoque): boolean {
  return (
    (filtros.idPedido != null && filtros.idPedido > 0) ||
    dedupTermos(filtros.codigos).length > 0 ||
    dedupTermos(filtros.descricoes).length > 0 ||
    dedupTermos(filtros.tipos).length > 0 ||
    dedupTermos(filtros.grupos).length > 0 ||
    dedupTermos(filtros.coletas).length > 0 ||
    dedupTermos(filtros.setoresProducao).length > 0 ||
    dedupTermos(filtros.subgrupo1).length > 0 ||
    dedupTermos(filtros.subgrupo2).length > 0
  );
}

export function validarFiltrosPedidoConsultaEstoque(filtros: FiltrosConsultaEstoque): string | null {
  const temPedido = filtros.idPedido != null && filtros.idPedido > 0;
  if (!temPedido) return null;
  if (!filtros.modoPedido) return 'Selecione como visualizar os produtos do pedido.';
  if (!filtros.empenhoEscopo) return 'Selecione como calcular o empenho.';
  return null;
}

export async function consultarEstoque(params: {
  filtros: FiltrosConsultaEstoque;
  considerarRequisicoes: boolean;
  confirmLarge?: boolean;
}): Promise<{
  data: ConsultaEstoqueRow[];
  total: number;
  truncated: boolean;
  erro?: string;
}> {
  if (!filtrosConsultaTemAlgum(params.filtros)) {
    return { data: [], total: 0, truncated: false, erro: 'Informe ao menos um filtro.' };
  }

  const erroPedido = validarFiltrosPedidoConsultaEstoque(params.filtros);
  if (erroPedido) {
    return { data: [], total: 0, truncated: false, erro: erroPedido };
  }

  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) {
    return { data: [], total: 0, truncated: false, erro: 'NOMUS_DB_URL não configurado' };
  }

  const { sql, params: sqlParams } = buildConsultaSql(params.filtros);

  try {
    const [rows] = (await pool.query(sql, sqlParams)) as [Record<string, unknown>[], unknown];
    const baseRows = Array.isArray(rows) ? rows : [];
    const total = baseRows.length;
    const truncated = total > CONSULTA_ESTOQUE_MAX_ROWS && !params.confirmLarge;
    const slice = truncated ? baseRows.slice(0, CONSULTA_ESTOQUE_MAX_ROWS) : baseRows;

    const ids = slice.map((r) => Number(r.idProduto ?? 0)).filter((id) => id > 0);
    const [empenhoMap, solicitacaoMap] = await Promise.all([
      consultarEmpenhoLiquidoPorIds(ids, params.considerarRequisicoes, {
        idPedido: params.filtros.idPedido,
        modoPedido: params.filtros.modoPedido,
        empenhoEscopo: params.filtros.empenhoEscopo,
      }),
      consultarSolicitacaoSaldoPorIds(ids),
    ]);

    const all = slice.map((r) => {
      const id = Number(r.idProduto ?? 0);
      return mapConsultaRow(r, {
        empenho: empenhoMap.get(id) ?? 0,
        solicitacao: solicitacaoMap.get(id) ?? 0,
      });
    });
    return { data: all, total, truncated };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[consultaEstoqueRepository] consultarEstoque:', msg);
    return { data: [], total: 0, truncated: false, erro: msg };
  }
}

const SQL_COLETAS_EXCLUIR_SETOR2_IN = COLETAS_EXCLUIR_SETOR2_ALMOX.map((c) =>
  `'${c.replace(/'/g, "''")}'`
).join(', ');

const SQL_SALDO_DETALHE = `
With ultimo_saldo_setor As (
  Select
    sep.idProduto,
    sep.idSetorEstoque,
    se.nome As setor,
    p.idTipoProduto,
    se.consideraComoSaldoDisponivel,
    Coalesce(attr_coleta.opcao, '') As coleta,
    Case When sep.saldoSetorFinal <= 0 Then 0 Else sep.saldoSetorFinal End As saldo,
    Row_Number() Over (
      Partition By sep.idProduto, sep.idSetorEstoque
      Order By sep.dataMovimentacao Desc, sep.id Desc
    ) As rn
  From saldoestoque_produto sep
  Inner Join setorestoque se On se.id = sep.idSetorEstoque
  Inner Join produto p On p.id = sep.idProduto
  Left Join (
    Select apv.idProduto, alo.opcao
    From atributoprodutovalor apv
    Left Join atributolistaopcao alo On alo.id = apv.idListaOpcao
    Where apv.idAtributo = ${NOMUS_ATRIBUTO_COLETA}
  ) attr_coleta On attr_coleta.idProduto = sep.idProduto
  Where se.idEmpresa = 1 And sep.idProduto = ?
),
vinculo_setor2 As (
  Select Exists (
    Select 1
    From produtoempresa pe
    Inner Join produtoempresa_setorestoque pese On pese.idProdutoEmpresa = pe.id
    Where pe.idProduto = ? And pe.idEmpresa = 1 And pese.idSetorEstoque = 2
  ) As tem_setor2
)
Select us.idSetorEstoque As idSetor, us.setor, us.saldo
From ultimo_saldo_setor us
Cross Join vinculo_setor2 v2
Where us.rn = 1
  And (
    (us.idTipoProduto = 8 And us.idSetorEstoque = 5)
    Or (us.idTipoProduto = 15 And us.idSetorEstoque = 24)
    Or (
      us.idTipoProduto In (${TIPOS_PRODUTO_CONSULTA_SQL})
      And us.idTipoProduto Not In (8, 15)
      And v2.tem_setor2 = 1
      And us.idSetorEstoque = 2
      And us.coleta Not In (${SQL_COLETAS_EXCLUIR_SETOR2_IN})
    )
    Or (
      us.idTipoProduto In (${TIPOS_PRODUTO_CONSULTA_SQL})
      And us.idTipoProduto Not In (8, 15)
      And v2.tem_setor2 = 0
      And us.consideraComoSaldoDisponivel = 1
      And Exists (
        Select 1
        From produtoempresa pe2
        Inner Join produtoempresa_setorestoque pese2 On pese2.idProdutoEmpresa = pe2.id
        Where pe2.idProduto = us.idProduto
          And pe2.idEmpresa = 1
          And pese2.idSetorEstoque = us.idSetorEstoque
      )
    )
    Or (
      us.idTipoProduto In (${TIPOS_PRODUTO_CONSULTA_SQL})
      And us.idTipoProduto Not In (8, 15)
      And us.idSetorEstoque In (5, 24)
    )
  )
Order By us.setor
`;

const SQL_SETOR2_VINCULO = `
Select Exists (
  Select 1
  From produtoempresa pe
  Inner Join produtoempresa_setorestoque pese On pese.idProdutoEmpresa = pe.id
  Where pe.idProduto = ? And pe.idEmpresa = 1 And pese.idSetorEstoque = 2
) As tem_setor2
`;

const SQL_NOME_SETOR = `Select nome From setorestoque Where id = ? And idEmpresa = 1 Limit 1`;

export async function listarSaldoDetalhePorProduto(
  idProduto: number
): Promise<{ data: SaldoSetorDetalheRow[]; erro?: string }> {
  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) return { data: [], erro: 'NOMUS_DB_URL não configurado' };
  try {
    const [[saldoRows], [vincRows]] = (await Promise.all([
      pool.query(SQL_SALDO_DETALHE, [idProduto, idProduto]),
      pool.query(SQL_SETOR2_VINCULO, [idProduto]),
    ])) as [[Record<string, unknown>[], unknown], [Record<string, unknown>[], unknown]];

    const data = (Array.isArray(saldoRows) ? saldoRows : []).map((r) => ({
      idSetor: Number(r.idSetor ?? 0),
      setor: String(r.setor ?? '').trim(),
      saldo: Number(r.saldo ?? 0),
    }));

    const temSetor2 = Boolean(
      Array.isArray(vincRows) && vincRows[0] && Number((vincRows[0] as Record<string, unknown>).tem_setor2 ?? 0) === 1
    );
    if (temSetor2 && !data.some((r) => r.idSetor === 2)) {
      const [nomeRows] = (await pool.query(SQL_NOME_SETOR, [2])) as [Record<string, unknown>[], unknown];
      const setorNome = String((Array.isArray(nomeRows) ? nomeRows[0] : undefined)?.nome ?? 'Setor 2').trim();
      data.unshift({ idSetor: 2, setor: setorNome, saldo: 0 });
    }

    data.sort((a, b) => a.setor.localeCompare(b.setor, 'pt-BR'));
    return { data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { data: [], erro: msg };
  }
}

async function lookupRotaPorPedidos(
  pool: NonNullable<ReturnType<typeof getNomusPool>>,
  idsPedido: number[]
): Promise<Map<number, string>> {
  const meta = await lookupMetaPedidoEmpenho(pool, idsPedido);
  const map = new Map<number, string>();
  for (const [id, m] of meta) map.set(id, m.rota);
  return map;
}

export type MetaPedidoEmpenho = {
  rota: string;
  temRomaneio: boolean;
  idTipoPedido: number;
  requisitado313: boolean;
};

/** Metadados do pedido para ordenação waterfall e cards segmentados. */
export async function lookupMetaPedidoEmpenho(
  pool: NonNullable<ReturnType<typeof getNomusPool>>,
  idsPedido: number[]
): Promise<Map<number, MetaPedidoEmpenho>> {
  const map = new Map<number, MetaPedidoEmpenho>();
  if (idsPedido.length === 0) return map;
  const placeholders = idsPedido.map(() => '?').join(', ');
  const sql = `
Select
  pd.id As idPedido,
  pd.idTipoPedido,
  Max(Case When prm.idRomaneio Is Not Null Then 1 Else 0 End) As temRomaneio,
  Max(Case When Coalesce(aloreq.opcao, '') = 'Sim' Then 1 Else 0 End) As requisitado313,
  Max(
    Nullif(
      Trim(
        Coalesce(
          de.observacoes,
          Case
            When me.opcao In ('Retirada na Só Móveis', 'Retirada na Só Aço') Then 'Retirada'
            When aloreq.opcao = 'Sim' Then 'Requisição'
            When (IfNull(m.nome, mc.nome) In ('Timon', 'Teresina', 'Nazaria', 'Demerval Lobão', 'Curralinhos'))
              And (aloreq.opcao = 'Não' Or aloreq.opcao Is Null) Then 'Entrega G The'
            Else 'Inserir em romaneio'
          End
        )
      ),
      ''
    )
  ) As rota
From pedido pd
Inner Join itempedido ip On ip.idPedido = pd.id
Left Join itempedidoromaneio prm On prm.idItemPedido = ip.id
Left Join documentoestoque de On de.id = prm.idRomaneio
Left Join atributopedidovalor apv_me On apv_me.idPedido = pd.id And apv_me.idAtributo = 591
Left Join atributolistaopcao me On me.id = apv_me.idListaOpcao
Left Join atributopedidovalor apv_req On apv_req.idPedido = pd.id And apv_req.idAtributo = 313
Left Join atributolistaopcao aloreq On aloreq.id = apv_req.idListaOpcao
Left Join pessoa pe2 On pe2.id = pd.idCliente
Left Join municipio mc On mc.id = pe2.idMunicipio
Left Join endereco ed On ed.id = pd.idEnderecoLocalEntrega
Left Join municipio m On m.id = ed.idMunicipio
Where pd.id In (${placeholders})
Group By pd.id, pd.idTipoPedido
`.trim();
  try {
    const [rows] = (await pool.query(sql, idsPedido)) as [Record<string, unknown>[], unknown];
    for (const r of Array.isArray(rows) ? rows : []) {
      const id = Number(r.idPedido ?? 0);
      if (id <= 0) continue;
      map.set(id, {
        rota: String(r.rota ?? '').trim(),
        temRomaneio: Number(r.temRomaneio ?? 0) === 1,
        idTipoPedido: Number(r.idTipoPedido ?? 0),
        requisitado313: Number(r.requisitado313 ?? 0) === 1,
      });
    }
  } catch (err) {
    console.error(
      '[consultaEstoqueRepository] lookupMetaPedidoEmpenho:',
      err instanceof Error ? err.message : err
    );
  }
  return map;
}

export async function lookupPrevisaoPorPedidos(
  pool: NonNullable<ReturnType<typeof getNomusPool>>,
  linhas: { idPedido: number; pedido: string }[]
): Promise<Map<string, { dataEntrega: string | null; rota: string; temRomaneio: boolean }>> {
  const result = new Map<string, { dataEntrega: string | null; rota: string; temRomaneio: boolean }>();
  if (linhas.length === 0) return result;

  const ids = [...new Set(linhas.map((l) => l.idPedido).filter((id) => id > 0))];
  const [previsaoPorId, metaPorId] = await Promise.all([
    obterPrevisaoAtualizadaPorIdsPedido(ids),
    lookupMetaPedidoEmpenho(pool, ids),
  ]);

  for (const l of linhas) {
    const key = l.pedido.trim().toUpperCase();
    if (!key) continue;
    const ymd = previsaoPorId.get(l.idPedido) ?? null;
    const meta = metaPorId.get(l.idPedido);
    result.set(key, {
      dataEntrega: ymd,
      rota: meta?.rota ?? '',
      temRomaneio: meta?.temRomaneio ?? false,
    });
  }
  return result;
}

const SQL_SC_DETALHE = `
Select
  sc.id As codigo,
  u.nome As usuario,
  Date_Format(Cast(sc.dataEmissao As Date), '%d/%m/%Y') As dataEmissao,
  Date_Format(Cast(sc.dataNecessidade As Date), '%d/%m/%Y') As dataNecessidade,
  Round(Greatest(0, sc.quantidade), 2) As qtdeSolicitada,
  Round(Coalesce(ate.qtdeAtendida, 0), 2) As qtdeComprada,
  Round(Coalesce(cot.qtdeEmCotacao, 0), 2) As qtdeEmCotacao
From solicitacaocompra sc
Left Join usuario u On u.id = sc.idUsuario
Left Join (${SQL_SC_QTDE_COMPRADA_SUB}) ate On ate.idSolicitacaoCompra = sc.id
Left Join (${SQL_SC_QTDE_COTACAO_SUB}) cot On cot.idSolicitacaoCompra = sc.id
Where sc.idProduto = ?
  And sc.status In (2, 6)
  And sc.lixeira Is Null
Order By sc.dataNecessidade, sc.id
`;

export async function listarScDetalhePorProduto(
  idProduto: number
): Promise<{ data: ScDetalheRow[]; erro?: string }> {
  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) return { data: [], erro: 'NOMUS_DB_URL não configurado' };

  try {
    const [scRows] = (await pool.query(SQL_SC_DETALHE, [idProduto])) as [
      Record<string, unknown>[],
      unknown,
    ];
    const data: ScDetalheRow[] = (Array.isArray(scRows) ? scRows : []).map((r) => {
      const qtdeSolicitada = Number(r.qtdeSolicitada ?? 0);
      const qtdeComprada = Number(r.qtdeComprada ?? 0);
      const qtdeEmCotacao = Number(r.qtdeEmCotacao ?? 0);
      return {
        codigo: Number(r.codigo ?? 0),
        usuario: String(r.usuario ?? '').trim() || '—',
        dataEmissao: r.dataEmissao != null ? String(r.dataEmissao) : null,
        dataNecessidade: r.dataNecessidade != null ? String(r.dataNecessidade) : null,
        saldo: calcularSaldoSc(qtdeSolicitada, qtdeComprada, qtdeEmCotacao),
      };
    });

    return { data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { data: [], erro: msg };
  }
}

const SQL_COTACAO_DETALHE = `
Select
  cc.nome As cotacao,
  Date_Format(Cast(cc.dataEmissao As Date), '%d/%m/%Y') As dataEmissao,
  Coalesce(Nullif(Trim(u.nome), ''), Nullif(Trim(f.nome), ''), Nullif(Trim(p.nome), ''), '—') As comprador,
  Coalesce(
  Group_Concat(Distinct Cast(sc.id As Char) Order By sc.id Separator ','),
  ''
  ) As scCodigos,
  Round(icc.qtde, 2) As qtde
From itemcotacaocompra icc
Inner Join cotacaocompra cc On cc.id = icc.idCotacaoCompra
Left Join usuario u On u.id = cc.idComprador
Left Join funcionario f On f.id = u.idFuncionario
Left Join pessoa p On p.id = cc.idComprador
Left Join solicitacaocompra_itemcotacaocompra scicc On scicc.idItemCotacaoCompra = icc.id
Left Join solicitacaocompra sc On sc.id = scicc.idSolicitacaoCompra
Where icc.idProduto = ?
  And cc.status In (${STATUS_COTACAO_AGPAG_SQL})
Group By cc.id, cc.nome, cc.dataEmissao, icc.qtde, u.nome, f.nome, p.nome
Order By cc.dataEmissao, cc.nome
`;

export async function listarCotacaoDetalhePorProduto(
  idProduto: number
): Promise<{ data: CotacaoDetalheRow[]; erro?: string }> {
  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) return { data: [], erro: 'NOMUS_DB_URL não configurado' };
  try {
    const [rows] = (await pool.query(SQL_COTACAO_DETALHE, [idProduto])) as [
      Record<string, unknown>[],
      unknown,
    ];
    const data = (Array.isArray(rows) ? rows : []).map((r) => ({
      cotacao: String(r.cotacao ?? '').trim() || '—',
      dataEmissao: r.dataEmissao != null ? String(r.dataEmissao) : null,
      comprador: String(r.comprador ?? '').trim() || '—',
      scCodigos: String(r.scCodigos ?? '').trim(),
      qtde: Number(r.qtde ?? 0),
    }));
    return { data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { data: [], erro: msg };
  }
}

export { listarPcPendDetalhesPorProduto };

const PEDIDOS_GERENCIADOR_TYPEAHEAD_LIMITE = 40;

const SQL_JOINS_GERENCIADOR_PEDIDO = `
  Left Join endereco ed On ed.id = pd.idEnderecoLocalEntrega
  Left Join municipio m On ed.idMunicipio = m.id
  Left Join municipio mc On mc.id = pe.idMunicipio
  Left Join (
    Select apv.idPedido, alo.opcao
    From atributopedidovalor apv
    Left Join atributolistaopcao alo On alo.id = apv.idListaOpcao
    Where apv.idAtributo = 591
  ) me On me.idPedido = pd.id
  Left Join (
    Select apvreq.idPedido, aloreq.opcao
    From atributopedidovalor apvreq
    Left Join atributolistaopcao aloreq On aloreq.id = apvreq.idListaOpcao
    Where apvreq.idAtributo = 313
  ) aloreq On aloreq.idPedido = pd.id
  Left Join itempedidoromaneio prm On prm.idItemPedido = ip.id
  Left Join documentoestoque de On de.id = prm.idRomaneio`;

const SQL_WHERE_GERENCIADOR_PEDIDO = `
  And pd.idEmpresa In (1, 2)
  And (
    pd.idEmpresa <> 2
    Or (
      pd.idEmpresa = 2
      And (
        Case
          When (de.observacoes Is Null And me.opcao = 'Retirada na Só Móveis') Then '2-Retirada na So Moveis'
          When (de.observacoes Is Null And me.opcao = 'Retirada na Só Aço') Then '1-Retirada na So Aço'
          When (de.observacoes Is Null And IfNull(m.nome, mc.nome) = 'Teresina' And aloreq.opcao = 'Sim') Then '5-Requisicao'
          When (de.observacoes Is Null And (IfNull(m.nome, mc.nome) In ('Timon','Teresina','Nazaria','Demerval Lobão','Curralinhos')) And aloreq.opcao = 'Não') Then '3-Entrega em Grande Teresina'
          When (de.observacoes Is Null) Then '4-Inserir em Romaneio'
          Else de.observacoes
        End
      ) Not In (
        '2-Retirada na So Moveis',
        '1-Retirada na So Aço',
        '3-Entrega em Grande Teresina',
        '5-Requisicao'
      )
    )
  )`;

/** Typeahead de PDs visíveis no Gerenciador de Pedidos (mesmo universo do sqlBasePedidosNomus). */
export async function buscarPedidosGerenciadorTypeahead(termo: string): Promise<{
  data: PedidoGerenciadorTypeaheadItem[];
  erro?: string;
}> {
  const q = termo.trim();
  if (q.length < 2) return { data: [] };

  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) {
    return { data: [], erro: 'NOMUS_DB_URL não configurado' };
  }

  const like = termoParaPadraoLikeSql(q);
  const alvoLike = termoParaPadraoLikeSql(q.toUpperCase().replace(/^PD\s*/i, ''));
  const sql = `
    Select Distinct pd.id, pd.nome, Upper(pe.nome) As cliente, pd.dataEmissao
    From pedido pd
    Inner Join itempedido ip On ip.idPedido = pd.id And ip.status In (2, 3)
    Left Join pessoa pe On pe.id = pd.idCliente
    ${SQL_JOINS_GERENCIADOR_PEDIDO}
    Where (
      pd.nome Like ?
      Or Replace(Replace(Upper(Trim(pd.nome)), 'PD ', ''), 'PD', '') Like ?
    )
    ${SQL_WHERE_GERENCIADOR_PEDIDO}
    Order By pd.dataEmissao Desc, pd.id Desc
    Limit ${PEDIDOS_GERENCIADOR_TYPEAHEAD_LIMITE}`;

  try {
    const [rows] = (await pool.query(sql, [like, alvoLike])) as [
      Array<{ id: number; nome: string; cliente: string | null; dataEmissao: Date | string }>,
      unknown,
    ];
    const data = (Array.isArray(rows) ? rows : []).map((r) => ({
      id: Number(r.id),
      nome: String(r.nome ?? '').trim(),
      cliente: r.cliente != null ? String(r.cliente).trim() : null,
      dataEmissao:
        r.dataEmissao instanceof Date
          ? r.dataEmissao.toISOString().slice(0, 10)
          : String(r.dataEmissao ?? '').slice(0, 10),
    }));
    return { data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[buscarPedidosGerenciadorTypeahead] Nomus falhou:', msg);
    return { data: [], erro: msg };
  }
}
