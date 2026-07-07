/**
 * Fragmentos SQL compartilhados (compras / consulta de estoque PCP).
 */

/** Tipos de produto no escopo da Consulta de Estoque (Só Aço). */
export const TIPOS_PRODUTO_CONSULTA_ESTOQUE = [10, 16, 21, 6, 11, 8, 15] as const;

export const TIPOS_PRODUTO_CONSULTA_SQL = TIPOS_PRODUTO_CONSULTA_ESTOQUE.join(', ');

/** pd.idEmpresa Nomus — Só Aço Industrial (módulo PCP). */
export const PCP_ID_EMPRESA_SO_ACO = 1;

/** Atributos de produto no Nomus (atributoprodutovalor / atributolistaopcao). */
export const NOMUS_ATRIBUTO_COLETA = 650;

/**
 * Coletas Ressup Não Almox em que o setor 2 (almox secundário) não entra no saldo.
 * Exceções (mantêm setor 2): FUNDÍVEIS, TANQUES DE RESFRIADORES.
 */
export const COLETAS_EXCLUIR_SETOR2_ALMOX = [
  'ISOPOR',
  'LAMIPRO/POLIPROPLENO',
  'AGLOMERADOS E COMPENSADOS',
] as const;

const SQL_COLETAS_EXCLUIR_SETOR2_IN = COLETAS_EXCLUIR_SETOR2_ALMOX.map((c) =>
  `'${c.replace(/'/g, "''")}'`
).join(', ');

/** Condição SQL: coleta do produto permite incluir setor 2 no saldo (usar dentro de saldo_por_setor, alias us). */
export const SQL_COND_SETOR2_NAO_EXCLUIDO_POR_COLETA = `Coalesce(us.coleta, '') Not In (${SQL_COLETAS_EXCLUIR_SETOR2_IN})`;

const SQL_JOIN_ATTR_COLETA_PRODUTO = `
    Left Join (
      Select apv.idProduto, alo.opcao
      From atributoprodutovalor apv
      Left Join atributolistaopcao alo On alo.id = apv.idListaOpcao
      Where apv.idAtributo = ${NOMUS_ATRIBUTO_COLETA}
    ) attr_coleta On attr_coleta.idProduto = sep.idProduto`;
export const NOMUS_ATRIBUTO_DIA_COMPRA = 651;
/** Comprador responsável pelo produto (pendências compras). */
export const NOMUS_ATRIBUTO_COMPRADOR = 674;
export const NOMUS_ATRIBUTO_COMPRA_RECORRENTE = 675;
export const NOMUS_ATRIBUTO_ITEM_CRITICO = 713;

/** Join atributo comprador (674) no alias `p`. */
export const SQL_JOIN_ATTR_COMPRADOR_PRODUTO = `
Left Join (
  Select apv.idProduto, alo.opcao
  From atributoprodutovalor apv
  Left Join atributolistaopcao alo On alo.id = apv.idListaOpcao
  Where apv.idAtributo = ${NOMUS_ATRIBUTO_COMPRADOR}
) attr_comprador On attr_comprador.idProduto = p.id`;

/** Restringe pedidos de empenho à empresa Só Aço Industrial. */
export const SQL_FILTRO_PEDIDO_EMPRESA_PCP = ` And pd.idEmpresa = ${PCP_ID_EMPRESA_SO_ACO}`;

/** idTipoPedido Nomus — Produção para estoque (sempre incluído no empenho bruto). */
export const PCP_ID_TIPO_PEDIDO_PRODUCAO_ESTOQUE = 5;

const SQL_NOT_EXISTS_REQUISICAO_ATTR313 = `
    And Not Exists (
      Select 1
      From atributopedidovalor apvreq
      Left Join atributolistaopcao aloreq On aloreq.id = apvreq.idListaOpcao
      Where apvreq.idPedido = pd.id
        And apvreq.idAtributo = 313
        And Coalesce(aloreq.opcao, '') = 'Sim'
    )`;

/**
 * Filtro do toggle "Considerar requisições" nos blocos de empenho (pab/pac/empd/open).
 * PD Estoque (tipo 5) NUNCA é excluído — só pedidos com attr. Requisitado (313) = Sim.
 */
export function sqlFiltroRequisicoesEmpenho(considerarRequisicoes: boolean): string {
  return considerarRequisicoes ? '' : SQL_NOT_EXISTS_REQUISICAO_ATTR313;
}

/** Cotação (Ag Pag): Preparação, Coleta de preços, Decisão de compra. */
export const STATUS_COTACAO_AGPAG_SQL = '1, 2, 3';

export const OPCAO_FILTRO_VAZIO = '(vazio)';

/** Soma de qtde em cotação por produto (status 1–3). */
export const SQL_JOIN_COTACAO_AGREGADA = `
Left Join (
  Select
    icc.idProduto,
    Sum(icc.qtde) As qtde
  From itemcotacaocompra icc
  Inner Join cotacaocompra cc On cc.id = icc.idCotacaoCompra
  Where cc.status In (${STATUS_COTACAO_AGPAG_SQL})
  Group By icc.idProduto
) cot_agg On cot_agg.idProduto = p.id`;

/** Saldo bruto de SC abertas (status 2, 6) por produto. */
export const SQL_JOIN_SC_BRUTO_AGREGADA = `
Left Join (
  Select
    a3.idProduto,
    Sum((a3.quantidade) - Coalesce(ate.qtdeAtendida, 0)) As qtde_bruta
  From solicitacaocompra a3
  Left Join (
    Select
      idSolicitacaoCompra,
      Sum(qtdeAtendida) As qtdeAtendida
    From solicitacaocompraitempedidocompra
    Group By idSolicitacaoCompra
  ) ate On ate.idSolicitacaoCompra = a3.id
  Where a3.status In (2, 6) And a3.lixeira Is Null
  Group By a3.idProduto
) sc_bruto On sc_bruto.idProduto = p.id`;

/**
 * Solicitação líquida agregada por produto (sem vínculo SC↔cotação no Nomus):
 * MAX(0, SUM(SC abertas) − SUM(cotação status 1–3)).
 */
export const SQL_JOIN_SOLICITACAO_LIQUIDA = `
Left Join (
  Select
    p2.id As idProduto,
    Greatest(
      0,
      Coalesce(sc_bruto.qtde_bruta, 0) - Coalesce(cot_agg.qtde, 0)
    ) As solicitacao
  From produto p2
  Left Join (
    Select
      a3.idProduto,
      Sum((a3.quantidade) - Coalesce(ate.qtdeAtendida, 0)) As qtde_bruta
    From solicitacaocompra a3
    Left Join (
      Select idSolicitacaoCompra, Sum(qtdeAtendida) As qtdeAtendida
      From solicitacaocompraitempedidocompra
      Group By idSolicitacaoCompra
    ) ate On ate.idSolicitacaoCompra = a3.id
    Where a3.status In (2, 6) And a3.lixeira Is Null
    Group By a3.idProduto
  ) sc_bruto On sc_bruto.idProduto = p2.id
  Left Join (
    Select icc.idProduto, Sum(icc.qtde) As qtde
    From itemcotacaocompra icc
    Inner Join cotacaocompra cc On cc.id = icc.idCotacaoCompra
    Where cc.status In (${STATUS_COTACAO_AGPAG_SQL})
    Group By icc.idProduto
  ) cot_agg On cot_agg.idProduto = p2.id
) sc_liq On sc_liq.idProduto = p.id`;

/** PC pendente agregado (status 2, 3, 4). */
export const SQL_JOIN_PC_PEND_AGREGADA = `
Left Join (
  Select
    ipc.idProduto,
    Sum(ipc.qtde - IfNull(ipc.qtdeAtendida, 0)) As qtde
  From itempedidocompra ipc
  Where ipc.status In (2, 3, 4)
    And (ipc.qtde - IfNull(ipc.qtdeAtendida, 0)) > 0
  Group By ipc.idProduto
) pc_agg On pc_agg.idProduto = p.id`;

/**
 * Saldo disponível por produto (regras por tipo / vínculo setor 2).
 */
export const SQL_JOIN_SALDO_CONSULTA = `
Left Join (
  With ultimo_saldo_setor As (
    Select
      sep.idProduto,
      sep.idSetorEstoque,
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
    ${SQL_JOIN_ATTR_COLETA_PRODUTO}
    Where se.idEmpresa = 1 And p.ativo = 1
  ),
  vinculo_setor2 As (
    Select Distinct pe.idProduto
    From produtoempresa pe
    Inner Join produtoempresa_setorestoque pese On pese.idProdutoEmpresa = pe.id
    Where pe.idEmpresa = 1 And pese.idSetorEstoque = 2
  ),
  saldo_por_setor As (
    Select us.idProduto, us.saldo
    From ultimo_saldo_setor us
    Left Join vinculo_setor2 v2 On v2.idProduto = us.idProduto
    Where us.rn = 1
      And (
        (us.idTipoProduto = 8 And us.idSetorEstoque = 5)
        Or (us.idTipoProduto = 15 And us.idSetorEstoque = 24)
        Or (
          us.idTipoProduto In (${TIPOS_PRODUTO_CONSULTA_SQL})
          And us.idTipoProduto Not In (8, 15)
          And v2.idProduto Is Not Null
          And us.idSetorEstoque = 2
          And ${SQL_COND_SETOR2_NAO_EXCLUIDO_POR_COLETA}
        )
        Or (
          us.idTipoProduto In (${TIPOS_PRODUTO_CONSULTA_SQL})
          And us.idTipoProduto Not In (8, 15)
          And v2.idProduto Is Null
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
  )
  Select idProduto, Sum(saldo) As saldo
  From saldo_por_setor
  Group By idProduto
) saldo_agg On saldo_agg.idProduto = p.id`;

/**
 * Empenho agregado leve (somente itens de pedido de venda diretos — sem explosão BOM).
 * Usado na grade; detalhe de empenho usa BOM completo sob demanda.
 */
export function sqlJoinEmpenhoLeve(considerarRequisicoes: boolean): string {
  const reqFilter = sqlFiltroRequisicoesEmpenho(considerarRequisicoes);
  return `
Left Join (
  Select
    ip.idProduto,
    Sum(
      If((ip.qtde >= ip.qtdeAtendida), (ip.qtde - ip.qtdeAtendida), 0)
      + IfNull((
        Select Sum(ide.qtde)
        From itemdocumentoestoque ide
        Inner Join itemdocumentoestoque_itempedidovenda ideipv
          On ide.idItemOrigemDevolucao = ideipv.idItemDocumentoEstoque
        Where ideipv.idItemPedidoVenda = ip.id
      ), 0)
    ) As qtdempenhada
  From itempedido ip
  Inner Join pedido pd On pd.id = ip.idPedido
  Where ip.status In (2, 3)
    ${SQL_FILTRO_PEDIDO_EMPRESA_PCP}
    ${reqFilter}
  Group By ip.idProduto
) emp On emp.idProduto = p.id`;
}

/** Empenho venda direta (sem BOM) para lote de produtos. */
export function sqlJoinEmpenhoDiretoBatch(
  considerarRequisicoes: boolean,
  joinAlias = 'p.id'
): string {
  const reqFilter = sqlFiltroRequisicoesEmpenho(considerarRequisicoes);
  return `
Left Join (
  Select
    ip.idProduto,
    Round(Sum(
      If((ip.qtde >= ip.qtdeAtendida), (ip.qtde - ip.qtdeAtendida), 0)
      + IfNull((
        Select Sum(ide.qtde)
        From itemdocumentoestoque ide
        Inner Join itemdocumentoestoque_itempedidovenda ideipv
          On ide.idItemOrigemDevolucao = ideipv.idItemDocumentoEstoque
        Where ideipv.idItemPedidoVenda = ip.id
      ), 0)
    ), 2) As qtdempenhada
  From itempedido ip
  Inner Join pedido pd On pd.id = ip.idPedido
  Where ip.status In (2, 3)
    ${SQL_FILTRO_PEDIDO_EMPRESA_PCP}
    ${reqFilter}
  Group By ip.idProduto
) emp_dir On emp_dir.idProduto = ${joinAlias}`;
}

/** Saldo agregado restrito a um conjunto de produtos (CTE `produtos_filtrados`). */
export const SQL_SALDO_AGREGADO_PARA_PRODUTOS_FILTRADOS = `
Left Join (
  With ultimo_saldo_setor As (
    Select
      sep.idProduto,
      sep.idSetorEstoque,
      pf.idTipoProduto,
      se.consideraComoSaldoDisponivel,
      Coalesce(attr_coleta.opcao, '') As coleta,
      Case When sep.saldoSetorFinal <= 0 Then 0 Else sep.saldoSetorFinal End As saldo,
      Row_Number() Over (
        Partition By sep.idProduto, sep.idSetorEstoque
        Order By sep.dataMovimentacao Desc, sep.id Desc
      ) As rn
    From saldoestoque_produto sep
    Inner Join setorestoque se On se.id = sep.idSetorEstoque
    Inner Join produtos_filtrados pf On pf.id = sep.idProduto
    ${SQL_JOIN_ATTR_COLETA_PRODUTO}
    Where se.idEmpresa = 1
  ),
  vinculo_setor2 As (
    Select Distinct pe.idProduto
    From produtoempresa pe
    Inner Join produtoempresa_setorestoque pese On pese.idProdutoEmpresa = pe.id
    Inner Join produtos_filtrados pf On pf.id = pe.idProduto
    Where pe.idEmpresa = 1 And pese.idSetorEstoque = 2
  ),
  saldo_por_setor As (
    Select us.idProduto, us.saldo
    From ultimo_saldo_setor us
    Left Join vinculo_setor2 v2 On v2.idProduto = us.idProduto
    Where us.rn = 1
      And (
        (us.idTipoProduto = 8 And us.idSetorEstoque = 5)
        Or (us.idTipoProduto = 15 And us.idSetorEstoque = 24)
        Or (
          us.idTipoProduto In (${TIPOS_PRODUTO_CONSULTA_SQL})
          And us.idTipoProduto Not In (8, 15)
          And v2.idProduto Is Not Null
          And us.idSetorEstoque = 2
          And ${SQL_COND_SETOR2_NAO_EXCLUIDO_POR_COLETA}
        )
        Or (
          us.idTipoProduto In (${TIPOS_PRODUTO_CONSULTA_SQL})
          And us.idTipoProduto Not In (8, 15)
          And v2.idProduto Is Null
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
  )
  Select idProduto, Sum(saldo) As saldo
  From saldo_por_setor
  Group By idProduto
) saldo_agg On saldo_agg.idProduto = pf_outer.id`;

/** Joins de atributos usados nos filtros da consulta de estoque. */
export const SQL_JOINS_ATRIBUTOS_FILTRO = `
Left Join (
  Select apv.idProduto, alo.opcao
  From atributoprodutovalor apv
  Left Join atributolistaopcao alo On alo.id = apv.idListaOpcao
  Where apv.idAtributo = 650
) attr_coleta On attr_coleta.idProduto = p.id
Left Join (
  Select apv.idProduto, alo.opcao
  From atributoprodutovalor apv
  Left Join atributolistaopcao alo On alo.id = apv.idListaOpcao
  Where apv.idAtributo = 679
) attr_setor On attr_setor.idProduto = p.id
Left Join (
  Select apv.idProduto, alo.opcao
  From atributoprodutovalor apv
  Left Join atributolistaopcao alo On alo.id = apv.idListaOpcao
  Where apv.idAtributo = 398
) attr_sg1 On attr_sg1.idProduto = p.id
Left Join (
  Select apv.idProduto, alo.opcao
  From atributoprodutovalor apv
  Left Join atributolistaopcao alo On alo.id = apv.idListaOpcao
  Where apv.idAtributo = 399
) attr_sg2 On attr_sg2.idProduto = p.id`;
