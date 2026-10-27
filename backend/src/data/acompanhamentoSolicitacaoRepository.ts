/**
 * PCP — acompanhamento da solicitação até a pré-entrada.
 *
 * A etapa Solicitado olha só solicitação Liberada sem pedido.
 * Comprado e Pré-entrada nascem do pedido / documento: a solicitação de origem
 * já pode estar Encerrada depois que o pedido é vinculado.
 */

import {
  formatNomusErroConexao,
  getNomusPool,
  isNomusEnabled,
  isNomusPoolDeadError,
  isNomusTransientConnectionError,
  nomusQueryWithRetry,
  resetNomusPool,
} from '../config/nomusDb.js';
import { PCP_ID_EMPRESA_SO_ACO } from './sql/sqlComprasEstoqueFragments.js';
import { RECEBIMENTO_ID_TIPO_PRE_ENTRADA } from './recebimentoNomusRepository.js';

/** Nomus `solicitacaocompra.status` = Liberada. */
export const SC_STATUS_LIBERADA = 6;

/** Nomus `itempedidocompra.status`: Liberado (2) ou Atendido parcialmente (3). */
export const IPC_STATUS_ABERTO_SQL = '2, 3';

/**
 * No item de pedido de compra, status 1 é Atendido totalmente.
 * Aguardando liberação (4), corte (5) e cancelado (6) não entram como pré-entrada.
 */
export const IPC_STATUS_EXCLUIDO_ENCERRADO_SQL = '5, 6';

/** Solicitação Liberada, da empresa, sem nenhum pedido vinculado. */
export const SQL_SC_LIBERADA_SEM_PEDIDO = `
sc.status = ${SC_STATUS_LIBERADA}
AND sc.lixeira IS NULL
AND sc.idEmpresa = ${PCP_ID_EMPRESA_SO_ACO}
AND NOT EXISTS (
  SELECT 1
  FROM solicitacaocompraitempedidocompra scipc
  WHERE scipc.idSolicitacaoCompra = sc.id
)
`.trim();

/**
 * Existe solicitação da empresa ligada ao item do pedido.
 * Não filtra status: depois do vínculo a solicitação sai de Liberada e fica Encerrada.
 */
export const SQL_EXISTS_SC_DA_EMPRESA = `
EXISTS (
  SELECT 1
  FROM solicitacaocompraitempedidocompra scipc
  INNER JOIN solicitacaocompra sc ON sc.id = scipc.idSolicitacaoCompra
  WHERE scipc.idItemPedidoCompra = ipc.id
    AND sc.idEmpresa = ${PCP_ID_EMPRESA_SO_ACO}
    AND sc.lixeira IS NULL
)
`.trim();

/** Pedido em aberto com saldo, tenha a solicitação o status que tiver. */
export const SQL_IPC_COMPRADO = `
ipc.status IN (${IPC_STATUS_ABERTO_SQL})
AND ROUND(ipc.qtde - IFNULL(ipc.qtdeAtendida, 0), 2) > 0
AND ${SQL_EXISTS_SC_DA_EMPRESA}
`.trim();

/** Pedido atendido totalmente (saldo zerado) e ainda não cancelado/cortado.
 * Não exige solicitação: no mesmo pedido, há item que chega só pela pré-entrada. */
export const SQL_IPC_ATENDIDO = `
ipc.status = 1
AND ipc.qtde > 0
AND ROUND(ipc.qtde - IFNULL(ipc.qtdeAtendida, 0), 2) <= 0
`.trim();

export const SQL_DOC_PRE_ENTRADA = `
de.idTipoMovimentacao = ${RECEBIMENTO_ID_TIPO_PRE_ENTRADA}
AND de.idEmpresaEntrada = ${PCP_ID_EMPRESA_SO_ACO}
AND ide.discriminador = 'ItemDocumentoEntrada'
`.trim();

const SQL_GRADE_SOLICITADO = `
SELECT
  sc.idProduto AS idProduto,
  SUM(ROUND(sc.quantidade, 2)) AS qtde,
  DATE_FORMAT(MIN(CAST(sc.dataEmissao AS DATE)), '%Y-%m-%d') AS emissao,
  DATE_FORMAT(MIN(CAST(sc.dataNecessidade AS DATE)), '%Y-%m-%d') AS necessidade,
  GROUP_CONCAT(DISTINCT sc.id ORDER BY sc.id SEPARATOR '\n') AS solicitacoes
FROM solicitacaocompra sc
WHERE ${SQL_SC_LIBERADA_SEM_PEDIDO}
  AND ROUND(sc.quantidade, 2) > 0
GROUP BY sc.idProduto
`.trim();

const SQL_GRADE_COMPRADO = `
SELECT
  ipc.idProduto AS idProduto,
  SUM(ROUND(ipc.qtde - IFNULL(ipc.qtdeAtendida, 0), 2)) AS qtde,
  DATE_FORMAT(MIN(CAST(pc.dataEmissao AS DATE)), '%Y-%m-%d') AS emissao,
  GROUP_CONCAT(DISTINCT NULLIF(TRIM(pc.nome), '') ORDER BY NULLIF(TRIM(pc.nome), '') SEPARATOR '\n') AS pedidos
FROM itempedidocompra ipc
INNER JOIN pedidocompra pc ON pc.id = ipc.idPedidoCompra
WHERE ${SQL_IPC_COMPRADO}
GROUP BY ipc.idProduto
`.trim();

/** Solicitação da empresa ligada ao item do pedido, para exibir o vínculo sem multiplicar a quantidade. */
const SQL_JOIN_SC_VINCULO = `
LEFT JOIN solicitacaocompraitempedidocompra scipc_v ON scipc_v.idItemPedidoCompra = ipc.id
LEFT JOIN solicitacaocompra sc_v
  ON sc_v.id = scipc_v.idSolicitacaoCompra
 AND sc_v.idEmpresa = ${PCP_ID_EMPRESA_SO_ACO}
 AND sc_v.lixeira IS NULL
`.trim();

/** Números de solicitação do pedido em aberto. Join à parte para não multiplicar o saldo. */
const SQL_BUSCA_SC_COMPRADO = `
SELECT
  ipc.idProduto AS idProduto,
  GROUP_CONCAT(DISTINCT sc_v.id ORDER BY sc_v.id SEPARATOR '\n') AS solicitacoes
FROM itempedidocompra ipc
${SQL_JOIN_SC_VINCULO}
WHERE ${SQL_IPC_COMPRADO}
  AND sc_v.id IS NOT NULL
GROUP BY ipc.idProduto
`.trim();

const SQL_GRADE_PRE_ENTRADA = `
SELECT
  pre.idProduto AS idProduto,
  SUM(pre.qtde) AS qtde,
  DATE_FORMAT(MIN(pre.dataEmissao), '%Y-%m-%d') AS emissao
FROM (
  SELECT
    ide.id AS idItem,
    ide.idProduto AS idProduto,
    ROUND(ide.qtde, 2) AS qtde,
    CAST(de.dataEmissao AS DATE) AS dataEmissao
  FROM itemdocumentoestoque ide
  INNER JOIN documentoestoque de ON de.id = ide.idDocumentoEstoque
  INNER JOIN itemdocumentoestoque_itempedidocompra ideipc ON ideipc.idItemDocumentoEstoque = ide.id
  INNER JOIN itempedidocompra ipc ON ipc.id = ideipc.idItemPedidoCompra
  WHERE ${SQL_DOC_PRE_ENTRADA}
    AND ${SQL_IPC_ATENDIDO}
    AND ROUND(ide.qtde, 2) > 0
  GROUP BY ide.id, ide.idProduto, ide.qtde, CAST(de.dataEmissao AS DATE)
) pre
GROUP BY pre.idProduto
`.trim();

/** Documento, pedido e solicitação da pré-entrada, só para a busca. A quantidade continua na grade. */
const SQL_BUSCA_PRE_ENTRADA = `
SELECT
  ide.idProduto AS idProduto,
  GROUP_CONCAT(
    DISTINCT NULLIF(TRIM(CAST(de.numeroDocumentoFiscal AS CHAR)), '')
    ORDER BY NULLIF(TRIM(CAST(de.numeroDocumentoFiscal AS CHAR)), '')
    SEPARATOR '\n'
  ) AS documentos,
  GROUP_CONCAT(DISTINCT NULLIF(TRIM(pc.nome), '') ORDER BY NULLIF(TRIM(pc.nome), '') SEPARATOR '\n') AS pedidos,
  GROUP_CONCAT(DISTINCT sc_v.id ORDER BY sc_v.id SEPARATOR '\n') AS solicitacoes
FROM itemdocumentoestoque ide
INNER JOIN documentoestoque de ON de.id = ide.idDocumentoEstoque
INNER JOIN itemdocumentoestoque_itempedidocompra ideipc ON ideipc.idItemDocumentoEstoque = ide.id
INNER JOIN itempedidocompra ipc ON ipc.id = ideipc.idItemPedidoCompra
INNER JOIN pedidocompra pc ON pc.id = ipc.idPedidoCompra
${SQL_JOIN_SC_VINCULO}
WHERE ${SQL_DOC_PRE_ENTRADA}
  AND ${SQL_IPC_ATENDIDO}
  AND ROUND(ide.qtde, 2) > 0
GROUP BY ide.idProduto
`.trim();

const SQL_DETALHE_SOLICITADO = `
SELECT
  sc.id AS idSolicitacao,
  u.nome AS usuario,
  DATE_FORMAT(CAST(sc.dataEmissao AS DATE), '%d/%m/%Y') AS dataEmissao,
  DATE_FORMAT(CAST(sc.dataNecessidade AS DATE), '%d/%m/%Y') AS dataNecessidade,
  ROUND(sc.quantidade, 2) AS qtde
FROM solicitacaocompra sc
LEFT JOIN usuario u ON u.id = sc.idUsuario
WHERE sc.idProduto = ?
  AND ${SQL_SC_LIBERADA_SEM_PEDIDO}
  AND ROUND(sc.quantidade, 2) > 0
ORDER BY sc.dataNecessidade, sc.id
`.trim();

const SQL_DETALHE_COMPRADO = `
SELECT
  ipc.id AS idItem,
  GROUP_CONCAT(DISTINCT sc_v.id ORDER BY sc_v.id SEPARATOR ', ') AS solicitacoes,
  MAX(pc.id) AS idPedido,
  MAX(pc.nome) AS pedido,
  MAX(forn.nome) AS fornecedor,
  MAX(
    CASE
      WHEN ipc.dataEntrega IS NULL THEN NULL
      ELSE DATE_FORMAT(CAST(ipc.dataEntrega AS DATE), '%d/%m/%Y')
    END
  ) AS dataEntrega,
  ROUND(MAX(ipc.qtde) - IFNULL(MAX(ipc.qtdeAtendida), 0), 2) AS qtde
FROM itempedidocompra ipc
INNER JOIN pedidocompra pc ON pc.id = ipc.idPedidoCompra
LEFT JOIN pessoa forn ON forn.id = pc.idFornecedor
${SQL_JOIN_SC_VINCULO}
WHERE ipc.idProduto = ?
  AND ${SQL_IPC_COMPRADO}
GROUP BY ipc.id
ORDER BY dataEntrega IS NULL, dataEntrega, pedido, ipc.id
`.trim();

const SQL_DETALHE_PRE_ENTRADA = `
SELECT
  ide.id AS idItem,
  MAX(de.id) AS idDocumento,
  de.numeroDocumentoFiscal AS numeroDocumento,
  MAX(nfe.numero) AS numeroNfe,
  GROUP_CONCAT(DISTINCT sc_v.id ORDER BY sc_v.id SEPARATOR ', ') AS solicitacoes,
  MAX(forn.nome) AS fornecedor,
  MAX(DATE_FORMAT(CAST(de.dataEmissao AS DATE), '%d/%m/%Y')) AS dataEmissao,
  GROUP_CONCAT(DISTINCT NULLIF(TRIM(pc.nome), '') ORDER BY pc.nome SEPARATOR ', ') AS pedidos,
  GROUP_CONCAT(DISTINCT CONCAT(pc.id, '|', IFNULL(TRIM(pc.nome), '')) ORDER BY pc.nome SEPARATOR '\n') AS pedidosRef,
  ROUND(ide.qtde, 2) AS qtde
FROM itemdocumentoestoque ide
INNER JOIN documentoestoque de ON de.id = ide.idDocumentoEstoque
INNER JOIN itemdocumentoestoque_itempedidocompra ideipc ON ideipc.idItemDocumentoEstoque = ide.id
INNER JOIN itempedidocompra ipc ON ipc.id = ideipc.idItemPedidoCompra
INNER JOIN pedidocompra pc ON pc.id = ipc.idPedidoCompra
${SQL_JOIN_SC_VINCULO}
LEFT JOIN pessoa forn ON forn.id = de.idParceiro
LEFT JOIN nfe ON nfe.idDocumentoEstoque = de.id
WHERE ide.idProduto = ?
  AND ${SQL_DOC_PRE_ENTRADA}
  AND ${SQL_IPC_ATENDIDO}
  AND ROUND(ide.qtde, 2) > 0
GROUP BY ide.id, de.numeroDocumentoFiscal, ide.qtde
ORDER BY MAX(de.id) DESC, ide.id
`.trim();

/** Solicitações da empresa ligadas ao item do pedido `ipc`, para o modal do documento. */
const SQL_SUB_SC_DO_IPC = `
(
  SELECT GROUP_CONCAT(DISTINCT sc_s.id ORDER BY sc_s.id SEPARATOR ', ')
  FROM solicitacaocompraitempedidocompra scipc_s
  INNER JOIN solicitacaocompra sc_s ON sc_s.id = scipc_s.idSolicitacaoCompra
  WHERE scipc_s.idItemPedidoCompra = ipc.id
    AND sc_s.idEmpresa = ${PCP_ID_EMPRESA_SO_ACO}
    AND sc_s.lixeira IS NULL
)
`.trim();

/** Item do pedido `ipc` com documento de pré-entrada (173) vinculado. */
const SQL_EXISTS_PRE_ENTRADA_DO_IPC = `
EXISTS (
  SELECT 1
  FROM itemdocumentoestoque_itempedidocompra ideipc
  INNER JOIN itemdocumentoestoque ide ON ide.id = ideipc.idItemDocumentoEstoque
  INNER JOIN documentoestoque de ON de.id = ide.idDocumentoEstoque
  WHERE ideipc.idItemPedidoCompra = ipc.id
    AND ${SQL_DOC_PRE_ENTRADA}
    AND ROUND(ide.qtde, 2) > 0
)
`.trim();

/**
 * Status do item do pedido no caminho. Comprado e Pré-entrada usam os mesmos
 * recortes da grade; o resto explica por que o item não está na grade.
 */
export const SQL_STATUS_ITEM_PEDIDO = `
CASE
  WHEN ${SQL_IPC_COMPRADO} THEN 'comprado'
  WHEN ${SQL_IPC_ATENDIDO} AND ${SQL_EXISTS_PRE_ENTRADA_DO_IPC} THEN 'pre_entrada'
  WHEN ipc.status IN (${IPC_STATUS_EXCLUIDO_ENCERRADO_SQL}) THEN 'cancelado'
  WHEN ipc.status IN (${IPC_STATUS_ABERTO_SQL})
   AND ROUND(ipc.qtde - IFNULL(ipc.qtdeAtendida, 0), 2) > 0 THEN 'aberto_fora_grade'
  WHEN ROUND(ipc.qtde - IFNULL(ipc.qtdeAtendida, 0), 2) > 0 THEN 'encerrado'
  ELSE 'recebido'
END
`.trim();

/** Itens de pedido Liberado (2) ou Atendido parcialmente (3), com saldo. */
export const IPC_STATUS_DATA_ENTREGA_SQL = '2, 3';

/** Janela do alerta: entrega vencida, sem data ou vencendo nos próximos dias. */
export const DATA_ENTREGA_DIAS_ALERTA = 7;

const SQL_DATA_ENTREGA_NA_JANELA = `
(ipc.dataEntrega IS NULL
 OR CAST(ipc.dataEntrega AS DATE) <= DATE_ADD(CURDATE(), INTERVAL ${DATA_ENTREGA_DIAS_ALERTA} DAY))
`.trim();

const SQL_IPC_LIBERADO_OU_PARCIAL = `
ipc.status IN (${IPC_STATUS_DATA_ENTREGA_SQL})
AND ROUND(ipc.qtde - IFNULL(ipc.qtdeAtendida, 0), 2) > 0
`.trim();

/** Status aceitos na aba: Liberado, Parcial ou Atendido totalmente com pré-entrada. */
export const SQL_IPC_ELEGIVEL_DATAS_ENTREGA = `
(
  (${SQL_IPC_LIBERADO_OU_PARCIAL})
  OR (${SQL_IPC_ATENDIDO} AND ${SQL_EXISTS_PRE_ENTRADA_DO_IPC})
)
`.trim();

/**
 * Item cuja data de entrega precisa ser atualizada: Liberado/parcial com saldo,
 * ou atendido totalmente com pré-entrada; e entrega vencida, vazia ou na janela.
 * Marca o item no modal do pedido. A lista por pedido (SQL_DATAS_ENTREGA_PEDIDOS)
 * aplica os mesmos fragmentos em UNION, partindo do documento 173 para não varrer
 * o histórico de itens atendidos.
 */
export const SQL_IPC_DATA_ENTREGA_A_ATUALIZAR = `
${SQL_IPC_ELEGIVEL_DATAS_ENTREGA}
AND ${SQL_DATA_ENTREGA_NA_JANELA}
`.trim();

const SQL_DATAS_ENTREGA_PEDIDOS = `
SELECT
  a.idPedido AS idPedido,
  MAX(pc.nome) AS pedido,
  MAX(forn.nome) AS fornecedor,
  MAX(DATE_FORMAT(CAST(pc.dataEmissao AS DATE), '%d/%m/%Y')) AS dataEmissao,
  COUNT(*) AS itens,
  SUM(CASE WHEN a.situacao = 'liberado' THEN 1 ELSE 0 END) AS liberados,
  SUM(CASE WHEN a.situacao = 'parcial' THEN 1 ELSE 0 END) AS parciais,
  SUM(CASE WHEN a.situacao = 'pre_entrada' THEN 1 ELSE 0 END) AS preEntradas,
  SUM(CASE WHEN a.dataEntrega IS NULL THEN 1 ELSE 0 END) AS semData,
  MIN(DATEDIFF(a.dataEntrega, CURDATE())) AS menorDias,
  DATE_FORMAT(MIN(a.dataEntrega), '%d/%m/%Y') AS menorDataEntrega
FROM (
  SELECT
    ipc.id AS idItem,
    ipc.idPedidoCompra AS idPedido,
    CAST(ipc.dataEntrega AS DATE) AS dataEntrega,
    CASE WHEN ipc.status = 2 THEN 'liberado' ELSE 'parcial' END AS situacao
  FROM itempedidocompra ipc
  WHERE ${SQL_IPC_LIBERADO_OU_PARCIAL}
    AND ${SQL_DATA_ENTREGA_NA_JANELA}
  UNION ALL
  SELECT DISTINCT
    ipc.id AS idItem,
    ipc.idPedidoCompra AS idPedido,
    CAST(ipc.dataEntrega AS DATE) AS dataEntrega,
    'pre_entrada' AS situacao
  FROM documentoestoque de
  INNER JOIN itemdocumentoestoque ide ON ide.idDocumentoEstoque = de.id
  INNER JOIN itemdocumentoestoque_itempedidocompra ideipc ON ideipc.idItemDocumentoEstoque = ide.id
  INNER JOIN itempedidocompra ipc ON ipc.id = ideipc.idItemPedidoCompra
  WHERE ${SQL_DOC_PRE_ENTRADA}
    AND ROUND(ide.qtde, 2) > 0
    AND ${SQL_IPC_ATENDIDO}
    AND ${SQL_DATA_ENTREGA_NA_JANELA}
) a
INNER JOIN pedidocompra pc ON pc.id = a.idPedido
LEFT JOIN pessoa forn ON forn.id = pc.idFornecedor
GROUP BY a.idPedido
`.trim();

const SQL_DOC_PEDIDO_CABECALHO = `
SELECT
  pc.id AS id,
  pc.nome AS numero,
  forn.nome AS fornecedor,
  DATE_FORMAT(CAST(pc.dataEmissao AS DATE), '%d/%m/%Y') AS dataEmissao
FROM pedidocompra pc
LEFT JOIN pessoa forn ON forn.id = pc.idFornecedor
WHERE pc.id = ?
`.trim();

export function buildSqlDocPedidoItens(somenteElegiveisDataEntrega: boolean): string {
  const filtroEscopo = somenteElegiveisDataEntrega
    ? `AND ${SQL_IPC_ELEGIVEL_DATAS_ENTREGA}`
    : '';
  return `
SELECT
  ipc.id AS idItem,
  ipc.idProduto AS idProduto,
  p.nome AS codigo,
  p.descricao AS descricao,
  COALESCE(NULLIF(TRIM(umed.abreviatura), ''), NULLIF(TRIM(umed.nome), ''), '') AS unidadeMedida,
  ROUND(ipc.qtde, 2) AS qtde,
  ROUND(IFNULL(ipc.qtdeAtendida, 0), 2) AS qtdeAtendida,
  ROUND(ipc.qtde - IFNULL(ipc.qtdeAtendida, 0), 2) AS saldo,
  CASE
    WHEN ipc.dataEntrega IS NULL THEN NULL
    ELSE DATE_FORMAT(CAST(ipc.dataEntrega AS DATE), '%d/%m/%Y')
  END AS dataEntrega,
  DATE_FORMAT(CAST(ipc.dataEntrega AS DATE), '%Y-%m-%d') AS dataEntregaYmd,
  DATEDIFF(CAST(ipc.dataEntrega AS DATE), CURDATE()) AS diasEntrega,
  CASE WHEN ${SQL_IPC_DATA_ENTREGA_A_ATUALIZAR} THEN 1 ELSE 0 END AS alertaDataEntrega,
  ${SQL_STATUS_ITEM_PEDIDO} AS status,
  ${SQL_SUB_SC_DO_IPC} AS solicitacoes
FROM itempedidocompra ipc
INNER JOIN produto p ON p.id = ipc.idProduto
LEFT JOIN unidademedida umed ON umed.id = p.idUnidadeMedida
WHERE ipc.idPedidoCompra = ?
  ${filtroEscopo}
ORDER BY p.nome, ipc.id
`.trim();
}

/** Pré-entradas (tipo 173) ligadas aos itens do pedido. Uma linha por item de documento × item de pedido. */
const SQL_DOC_PEDIDO_PRE_ENTRADAS = `
SELECT DISTINCT
  ipc.id AS idItemPedido,
  ide.id AS idItemDocumento,
  ROUND(ide.qtde, 2) AS qtde,
  de.id AS idDocumento,
  de.numeroDocumentoFiscal AS numeroDocumento
FROM itempedidocompra ipc
INNER JOIN itemdocumentoestoque_itempedidocompra ideipc ON ideipc.idItemPedidoCompra = ipc.id
INNER JOIN itemdocumentoestoque ide ON ide.id = ideipc.idItemDocumentoEstoque
INNER JOIN documentoestoque de ON de.id = ide.idDocumentoEstoque
WHERE ipc.idPedidoCompra = ?
  AND ${SQL_DOC_PRE_ENTRADA}
  AND ROUND(ide.qtde, 2) > 0
`.trim();

const SQL_DOC_PRE_CABECALHO = `
SELECT
  de.id AS id,
  de.numeroDocumentoFiscal AS numero,
  de.idTipoMovimentacao AS idTipoMovimentacao,
  forn.nome AS fornecedor,
  DATE_FORMAT(CAST(de.dataEmissao AS DATE), '%d/%m/%Y') AS dataEmissao,
  (SELECT MAX(nfe.numero) FROM nfe WHERE nfe.idDocumentoEstoque = de.id) AS numeroNfe
FROM documentoestoque de
LEFT JOIN pessoa forn ON forn.id = de.idParceiro
WHERE de.id = ?
  AND de.idEmpresaEntrada = ${PCP_ID_EMPRESA_SO_ACO}
`.trim();

/**
 * Item do documento: entra na grade como Pré-entrada só com o mesmo recorte de
 * SQL_GRADE_PRE_ENTRADA (documento 173 + item de pedido atendido).
 */
const SQL_DOC_PRE_ITENS = `
SELECT
  ide.id AS idItem,
  ide.idProduto AS idProduto,
  p.nome AS codigo,
  p.descricao AS descricao,
  COALESCE(NULLIF(TRIM(umed.abreviatura), ''), NULLIF(TRIM(umed.nome), ''), '') AS unidadeMedida,
  ROUND(ide.qtde, 2) AS qtde,
  CASE
    WHEN ${SQL_DOC_PRE_ENTRADA} AND ROUND(ide.qtde, 2) > 0 AND EXISTS (
      SELECT 1
      FROM itemdocumentoestoque_itempedidocompra ideipc
      INNER JOIN itempedidocompra ipc ON ipc.id = ideipc.idItemPedidoCompra
      WHERE ideipc.idItemDocumentoEstoque = ide.id
        AND ${SQL_IPC_ATENDIDO}
    ) THEN 'pre_entrada'
    WHEN de.idTipoMovimentacao = ${RECEBIMENTO_ID_TIPO_PRE_ENTRADA} THEN 'pre_entrada_fora_grade'
    ELSE 'recebido'
  END AS status
FROM itemdocumentoestoque ide
INNER JOIN documentoestoque de ON de.id = ide.idDocumentoEstoque
INNER JOIN produto p ON p.id = ide.idProduto
LEFT JOIN unidademedida umed ON umed.id = p.idUnidadeMedida
WHERE ide.idDocumentoEstoque = ?
  AND ide.discriminador = 'ItemDocumentoEntrada'
ORDER BY p.nome, ide.id
`.trim();

/** Pedido e solicitação de cada item do documento. */
const SQL_DOC_PRE_VINCULOS = `
SELECT DISTINCT
  ide.id AS idItemDocumento,
  pc.id AS idPedido,
  pc.nome AS pedido,
  ${SQL_SUB_SC_DO_IPC} AS solicitacoes
FROM itemdocumentoestoque ide
INNER JOIN itemdocumentoestoque_itempedidocompra ideipc ON ideipc.idItemDocumentoEstoque = ide.id
INNER JOIN itempedidocompra ipc ON ipc.id = ideipc.idItemPedidoCompra
INNER JOIN pedidocompra pc ON pc.id = ipc.idPedidoCompra
WHERE ide.idDocumentoEstoque = ?
`.trim();

export type EtapaAcompanhamento = 'solicitado' | 'comprado' | 'pre_entrada';

export type LinhaAcompanhamento = {
  idProduto: number;
  codigo: string;
  descricao: string;
  unidadeMedida: string;
  qtdeSolicitado: number;
  qtdeComprado: number;
  qtdePreEntrada: number;
  /** Mais antiga ainda na etapa, YYYY-MM-DD. */
  emissaoSolicitacao: string | null;
  necessidadeSolicitacao: string | null;
  emissaoPedido: string | null;
  emissaoPreEntrada: string | null;
  /** Números ainda no pipeline, um por linha. Servem só à busca da grade. */
  solicitacoes: string;
  pedidos: string;
  documentos: string;
};

export type AggSolicitado = {
  qtde: number;
  emissao: string | null;
  necessidade: string | null;
  solicitacoes?: string;
};
export type AggComprado = { qtde: number; emissao: string | null; pedidos?: string; solicitacoes?: string };
export type AggPreEntrada = {
  qtde: number;
  emissao: string | null;
  documentos?: string;
  pedidos?: string;
  solicitacoes?: string;
};

export type LinhaDetalheSolicitado = {
  idSolicitacao: number;
  usuario: string | null;
  dataEmissao: string | null;
  dataNecessidade: string | null;
  qtde: number;
};

export type LinhaDetalheComprado = {
  idItem: number;
  solicitacoes: string | null;
  idPedido: number;
  pedido: string;
  fornecedor: string | null;
  dataEntrega: string | null;
  qtde: number;
};

export type LinhaDetalhePreEntrada = {
  idItem: number;
  idDocumento: number;
  numeroDocumento: string | null;
  numeroNfe: string | null;
  solicitacoes: string | null;
  fornecedor: string | null;
  dataEmissao: string | null;
  pedidos: string | null;
  pedidosRef: RefDocumento[];
  qtde: number;
  situacao: 'Pré-entrada';
};

export type RefDocumento = { id: number; numero: string };

export type TipoDocumentoAcompanhamento = 'pedido' | 'pre_entrada';

/**
 * Situação do item dentro do documento. `comprado` e `pre_entrada` são as
 * etapas da grade; os demais explicam por que o item não aparece nela.
 */
export type StatusItemDocumento =
  | 'comprado'
  | 'pre_entrada'
  | 'aberto_fora_grade'
  | 'pre_entrada_fora_grade'
  | 'encerrado'
  | 'recebido'
  | 'cancelado';

export type ItemDocumentoAcompanhamento = {
  idItem: number;
  idProduto: number;
  codigo: string;
  descricao: string;
  unidadeMedida: string;
  /** Pedido: quantidade pedida. Pré-entrada: quantidade do item no documento. */
  qtde: number;
  /** Só no pedido. */
  qtdeAtendida: number | null;
  saldo: number | null;
  dataEntrega: string | null;
  /** Só no pedido: YYYY-MM-DD, para a alteração da data. */
  dataEntregaYmd: string | null;
  /** Dias até a entrega (negativo = atrasada). Null sem data. */
  diasEntrega: number | null;
  /** Mesma regra da lista "Datas de entrega a atualizar". */
  alertaDataEntrega: boolean;
  status: StatusItemDocumento;
  /** Quantidade que este item soma na etapa da grade (0 quando fora da grade). */
  qtdeCaminho: number;
  solicitacoes: string | null;
  pedidos: RefDocumento[];
  preEntradas: RefDocumento[];
};

export type PedidoDataEntregaAtualizar = {
  idPedido: number;
  pedido: string;
  fornecedor: string | null;
  dataEmissao: string | null;
  /** Itens do pedido com data a atualizar (soma dos três abaixo). */
  itens: number;
  liberados: number;
  parciais: number;
  preEntradas: number;
  semData: number;
  /** Menor prazo entre os itens com data (negativo = atrasado). */
  menorDias: number | null;
  /** Data de entrega mais antiga entre os itens com data (dd/mm/aaaa). */
  menorDataEntrega: string | null;
};

export type DocumentoAcompanhamento = {
  tipo: TipoDocumentoAcompanhamento;
  id: number;
  numero: string;
  fornecedor: string | null;
  dataEmissao: string | null;
  numeroNfe: string | null;
  /** Pré-entrada já efetivada (documento saiu do tipo 173). */
  efetivado: boolean;
  itens: ItemDocumentoAcompanhamento[];
};

type ProdutoBase = {
  idProduto: number;
  codigo: string;
  descricao: string;
  unidadeMedida: string;
};

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function intOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Junta números de busca sem repetir, separados por quebra de linha. */
export function unirTokensBusca(...partes: Array<string | null | undefined>): string {
  const vistos = new Set<string>();
  const tokens: string[] = [];
  for (const parte of partes) {
    if (!parte) continue;
    for (const bruto of parte.split(/[\n,]+/)) {
      const token = bruto.trim();
      if (!token) continue;
      const chave = token.toLocaleLowerCase('pt-BR');
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      tokens.push(token);
    }
  }
  tokens.sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' }));
  return tokens.join('\n');
}

export function montarLinhasPipeline(
  produtos: ProdutoBase[],
  solicitado: Map<number, AggSolicitado>,
  comprado: Map<number, AggComprado>,
  preEntrada: Map<number, AggPreEntrada>
): LinhaAcompanhamento[] {
  const linhas: LinhaAcompanhamento[] = [];
  for (const p of produtos) {
    const sol = solicitado.get(p.idProduto);
    const comp = comprado.get(p.idProduto);
    const pre = preEntrada.get(p.idProduto);
    const qtdeSolicitado = round2(sol?.qtde ?? 0);
    const qtdeComprado = round2(comp?.qtde ?? 0);
    const qtdePreEntrada = round2(pre?.qtde ?? 0);
    if (qtdeSolicitado <= 0 && qtdeComprado <= 0 && qtdePreEntrada <= 0) continue;
    linhas.push({
      idProduto: p.idProduto,
      codigo: p.codigo,
      descricao: p.descricao,
      unidadeMedida: p.unidadeMedida,
      qtdeSolicitado,
      qtdeComprado,
      qtdePreEntrada,
      emissaoSolicitacao: qtdeSolicitado > 0 ? (sol?.emissao ?? null) : null,
      necessidadeSolicitacao: qtdeSolicitado > 0 ? (sol?.necessidade ?? null) : null,
      emissaoPedido: qtdeComprado > 0 ? (comp?.emissao ?? null) : null,
      emissaoPreEntrada: qtdePreEntrada > 0 ? (pre?.emissao ?? null) : null,
      solicitacoes: unirTokensBusca(sol?.solicitacoes, comp?.solicitacoes, pre?.solicitacoes),
      pedidos: unirTokensBusca(comp?.pedidos, pre?.pedidos),
      documentos: unirTokensBusca(pre?.documentos),
    });
  }
  linhas.sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR'));
  return linhas;
}

function ymdOrNull(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v).trim());
  return m ? m[1] : null;
}

async function queryAgg(sql: string): Promise<Record<string, unknown>[]> {
  const pool = getNomusPool();
  if (!pool) throw new Error('NOMUS_DB_URL não configurado');
  let lastErr: unknown;
  for (let i = 0; i < 2; i++) {
    const active = getNomusPool();
    if (!active) throw lastErr ?? new Error('NOMUS_DB_URL não configurado');
    const conn = await active.getConnection();
    try {
      try {
        await conn.query('SET SESSION group_concat_max_len = 1048576');
      } catch {
        /* Sem permissão de sessão, a busca usa o limite padrão do servidor. */
      }
      const [rows] = await conn.query(sql);
      return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
    } catch (err) {
      lastErr = err;
      if (!isNomusTransientConnectionError(err) || i === 1) throw err;
      if (isNomusPoolDeadError(err)) await resetNomusPool();
      await new Promise((r) => setTimeout(r, 250 * (i + 1)));
    } finally {
      conn.release();
    }
  }
  throw lastErr;
}

async function mapaSolicitado(): Promise<Map<number, AggSolicitado>> {
  const map = new Map<number, AggSolicitado>();
  for (const r of await queryAgg(SQL_GRADE_SOLICITADO)) {
    const id = toInt(r.idProduto);
    const qtde = round2(toNum(r.qtde));
    if (id > 0 && qtde > 0) {
      map.set(id, {
        qtde,
        emissao: ymdOrNull(r.emissao),
        necessidade: ymdOrNull(r.necessidade),
        solicitacoes: strOrNull(r.solicitacoes) ?? '',
      });
    }
  }
  return map;
}

async function mapaComprado(): Promise<Map<number, AggComprado>> {
  const [rows, scRows] = await Promise.all([queryAgg(SQL_GRADE_COMPRADO), queryAgg(SQL_BUSCA_SC_COMPRADO)]);
  const solicitacoes = new Map<number, string>();
  for (const r of scRows) {
    const id = toInt(r.idProduto);
    const texto = strOrNull(r.solicitacoes);
    if (id > 0 && texto) solicitacoes.set(id, texto);
  }
  const map = new Map<number, AggComprado>();
  for (const r of rows) {
    const id = toInt(r.idProduto);
    const qtde = round2(toNum(r.qtde));
    if (id > 0 && qtde > 0) {
      map.set(id, {
        qtde,
        emissao: ymdOrNull(r.emissao),
        pedidos: strOrNull(r.pedidos) ?? '',
        solicitacoes: solicitacoes.get(id) ?? '',
      });
    }
  }
  return map;
}

async function mapaPreEntrada(): Promise<Map<number, AggPreEntrada>> {
  const [rows, buscaRows] = await Promise.all([
    queryAgg(SQL_GRADE_PRE_ENTRADA),
    queryAgg(SQL_BUSCA_PRE_ENTRADA),
  ]);
  const busca = new Map<number, { documentos: string; pedidos: string; solicitacoes: string }>();
  for (const r of buscaRows) {
    const id = toInt(r.idProduto);
    if (id <= 0) continue;
    busca.set(id, {
      documentos: strOrNull(r.documentos) ?? '',
      pedidos: strOrNull(r.pedidos) ?? '',
      solicitacoes: strOrNull(r.solicitacoes) ?? '',
    });
  }
  const map = new Map<number, AggPreEntrada>();
  for (const r of rows) {
    const id = toInt(r.idProduto);
    const qtde = round2(toNum(r.qtde));
    if (id > 0 && qtde > 0) {
      const extra = busca.get(id);
      map.set(id, {
        qtde,
        emissao: ymdOrNull(r.emissao),
        documentos: extra?.documentos ?? '',
        pedidos: extra?.pedidos ?? '',
        solicitacoes: extra?.solicitacoes ?? '',
      });
    }
  }
  return map;
}

async function listarProdutos(ids: number[]): Promise<ProdutoBase[]> {
  if (ids.length === 0) return [];
  const pool = getNomusPool();
  if (!pool) throw new Error('NOMUS_DB_URL não configurado');
  const ph = ids.map(() => '?').join(', ');
  const sql = `
SELECT
  p.id AS idProduto,
  p.nome AS codigo,
  p.descricao AS descricao,
  COALESCE(NULLIF(TRIM(umed.abreviatura), ''), NULLIF(TRIM(umed.nome), ''), '') AS unidadeMedida
FROM produto p
LEFT JOIN unidademedida umed ON umed.id = p.idUnidadeMedida
WHERE p.id IN (${ph})
`.trim();
  const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, sql, ids);
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    idProduto: toInt(r.idProduto),
    codigo: strOrNull(r.codigo) ?? String(toInt(r.idProduto)),
    descricao: strOrNull(r.descricao) ?? '',
    unidadeMedida: strOrNull(r.unidadeMedida) ?? '',
  }));
}

function exigirNomus(): string | null {
  if (!isNomusEnabled() || !getNomusPool()) return 'NOMUS_DB_URL não configurado';
  return null;
}

export async function listarPipelineAcompanhamento(): Promise<{
  linhas: LinhaAcompanhamento[];
  erro?: string;
}> {
  const off = exigirNomus();
  if (off) return { linhas: [], erro: off };
  try {
    const [solicitado, comprado, preEntrada] = await Promise.all([
      mapaSolicitado(),
      mapaComprado(),
      mapaPreEntrada(),
    ]);
    const ids = [...new Set([...solicitado.keys(), ...comprado.keys(), ...preEntrada.keys()])];
    const produtos = await listarProdutos(ids);
    return { linhas: montarLinhasPipeline(produtos, solicitado, comprado, preEntrada) };
  } catch (err) {
    return { linhas: [], erro: formatNomusErroConexao(err) };
  }
}

async function queryDetalhe(sql: string, idProduto: number): Promise<Record<string, unknown>[]> {
  const pool = getNomusPool();
  if (!pool) throw new Error('NOMUS_DB_URL não configurado');
  const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, sql, [idProduto]);
  return Array.isArray(rows) ? rows : [];
}

export async function listarDetalheAcompanhamento(
  idProduto: number,
  etapa: EtapaAcompanhamento
): Promise<{
  linhas: LinhaDetalheSolicitado[] | LinhaDetalheComprado[] | LinhaDetalhePreEntrada[];
  erro?: string;
}> {
  if (!Number.isFinite(idProduto) || idProduto <= 0) {
    return { linhas: [], erro: 'Produto inválido.' };
  }
  const off = exigirNomus();
  if (off) return { linhas: [], erro: off };
  try {
    if (etapa === 'solicitado') {
      const rows = await queryDetalhe(SQL_DETALHE_SOLICITADO, idProduto);
      const linhas: LinhaDetalheSolicitado[] = rows.map((r) => ({
        idSolicitacao: toInt(r.idSolicitacao),
        usuario: strOrNull(r.usuario),
        dataEmissao: strOrNull(r.dataEmissao),
        dataNecessidade: strOrNull(r.dataNecessidade),
        qtde: round2(toNum(r.qtde)),
      }));
      return { linhas };
    }
    if (etapa === 'comprado') {
      const rows = await queryDetalhe(SQL_DETALHE_COMPRADO, idProduto);
      const linhas: LinhaDetalheComprado[] = rows.map((r) => ({
        idItem: toInt(r.idItem),
        solicitacoes: strOrNull(r.solicitacoes),
        idPedido: toInt(r.idPedido),
        pedido: strOrNull(r.pedido) ?? '—',
        fornecedor: strOrNull(r.fornecedor),
        dataEntrega: strOrNull(r.dataEntrega),
        qtde: round2(toNum(r.qtde)),
      }));
      return { linhas };
    }
    const rows = await queryDetalhe(SQL_DETALHE_PRE_ENTRADA, idProduto);
    const linhas: LinhaDetalhePreEntrada[] = rows.map((r) => ({
      idItem: toInt(r.idItem),
      idDocumento: toInt(r.idDocumento),
      numeroDocumento: strOrNull(r.numeroDocumento),
      numeroNfe: strOrNull(r.numeroNfe),
      solicitacoes: strOrNull(r.solicitacoes),
      fornecedor: strOrNull(r.fornecedor),
      dataEmissao: strOrNull(r.dataEmissao),
      pedidos: strOrNull(r.pedidos),
      pedidosRef: parseRefsDocumento(r.pedidosRef),
      qtde: round2(toNum(r.qtde)),
      situacao: 'Pré-entrada',
    }));
    return { linhas };
  } catch (err) {
    return { linhas: [], erro: formatNomusErroConexao(err) };
  }
}

/** Lê `id|numero` separados por quebra de linha (GROUP_CONCAT). */
export function parseRefsDocumento(v: unknown): RefDocumento[] {
  const texto = strOrNull(v);
  if (!texto) return [];
  const vistos = new Set<number>();
  const refs: RefDocumento[] = [];
  for (const linha of texto.split('\n')) {
    const sep = linha.indexOf('|');
    if (sep <= 0) continue;
    const id = toInt(linha.slice(0, sep));
    if (id <= 0 || vistos.has(id)) continue;
    vistos.add(id);
    refs.push({ id, numero: linha.slice(sep + 1).trim() || String(id) });
  }
  return refs;
}

const STATUS_ITEM_DOCUMENTO = new Set<StatusItemDocumento>([
  'comprado',
  'pre_entrada',
  'aberto_fora_grade',
  'pre_entrada_fora_grade',
  'encerrado',
  'recebido',
  'cancelado',
]);

function statusItem(v: unknown): StatusItemDocumento {
  const s = String(v ?? '') as StatusItemDocumento;
  return STATUS_ITEM_DOCUMENTO.has(s) ? s : 'recebido';
}

function pushRef(lista: RefDocumento[], id: number, numero: string | null): void {
  if (id <= 0 || lista.some((r) => r.id === id)) return;
  lista.push({ id, numero: numero ?? String(id) });
}

export type LinhaPreEntradaDoPedido = {
  idItemPedido: number;
  idItemDocumento: number;
  qtde: number;
  idDocumento: number;
  numeroDocumento: string | null;
};

/**
 * Monta os itens do pedido. Na pré-entrada, a quantidade em caminho é a soma dos
 * itens de documento 173 (cada um uma vez), como em SQL_GRADE_PRE_ENTRADA.
 */
export function montarItensPedido(
  rows: Record<string, unknown>[],
  preEntradas: LinhaPreEntradaDoPedido[]
): ItemDocumentoAcompanhamento[] {
  const porItem = new Map<number, LinhaPreEntradaDoPedido[]>();
  for (const pe of preEntradas) {
    const lista = porItem.get(pe.idItemPedido) ?? [];
    lista.push(pe);
    porItem.set(pe.idItemPedido, lista);
  }
  return rows.map((r) => {
    const idItem = toInt(r.idItem);
    const status = statusItem(r.status);
    const saldo = round2(toNum(r.saldo));
    const docs = porItem.get(idItem) ?? [];
    const refs: RefDocumento[] = [];
    const itensDoc = new Map<number, number>();
    for (const d of docs) {
      pushRef(refs, d.idDocumento, d.numeroDocumento);
      itensDoc.set(d.idItemDocumento, d.qtde);
    }
    let qtdeCaminho = 0;
    if (status === 'comprado') qtdeCaminho = saldo;
    else if (status === 'pre_entrada') {
      qtdeCaminho = round2([...itensDoc.values()].reduce((acc, q) => acc + q, 0));
    }
    return {
      idItem,
      idProduto: toInt(r.idProduto),
      codigo: strOrNull(r.codigo) ?? String(toInt(r.idProduto)),
      descricao: strOrNull(r.descricao) ?? '',
      unidadeMedida: strOrNull(r.unidadeMedida) ?? '',
      qtde: round2(toNum(r.qtde)),
      qtdeAtendida: round2(toNum(r.qtdeAtendida)),
      saldo,
      dataEntrega: strOrNull(r.dataEntrega),
      dataEntregaYmd: ymdOrNull(r.dataEntregaYmd),
      diasEntrega: intOrNull(r.diasEntrega),
      alertaDataEntrega: toInt(r.alertaDataEntrega) === 1,
      status,
      qtdeCaminho,
      solicitacoes: strOrNull(r.solicitacoes),
      pedidos: [],
      preEntradas: refs,
    };
  });
}

export type VinculoItemPreEntrada = {
  idItemDocumento: number;
  idPedido: number;
  pedido: string | null;
  solicitacoes: string | null;
};

export function montarItensPreEntrada(
  rows: Record<string, unknown>[],
  vinculos: VinculoItemPreEntrada[]
): ItemDocumentoAcompanhamento[] {
  const porItem = new Map<number, VinculoItemPreEntrada[]>();
  for (const v of vinculos) {
    const lista = porItem.get(v.idItemDocumento) ?? [];
    lista.push(v);
    porItem.set(v.idItemDocumento, lista);
  }
  return rows.map((r) => {
    const idItem = toInt(r.idItem);
    const status = statusItem(r.status);
    const qtde = round2(toNum(r.qtde));
    const pedidos: RefDocumento[] = [];
    const scs: string[] = [];
    for (const v of porItem.get(idItem) ?? []) {
      pushRef(pedidos, v.idPedido, v.pedido);
      if (v.solicitacoes) scs.push(v.solicitacoes);
    }
    const solicitacoes = unirTokensBusca(...scs).replace(/\n/g, ', ');
    return {
      idItem,
      idProduto: toInt(r.idProduto),
      codigo: strOrNull(r.codigo) ?? String(toInt(r.idProduto)),
      descricao: strOrNull(r.descricao) ?? '',
      unidadeMedida: strOrNull(r.unidadeMedida) ?? '',
      qtde,
      qtdeAtendida: null,
      saldo: null,
      dataEntrega: null,
      dataEntregaYmd: null,
      diasEntrega: null,
      alertaDataEntrega: false,
      status,
      qtdeCaminho: status === 'pre_entrada' ? qtde : 0,
      solicitacoes: solicitacoes || null,
      pedidos,
      preEntradas: [],
    };
  });
}

/** Sem data primeiro; depois o mais atrasado; empate pelo número do pedido. */
export function ordenarPedidosDataEntrega(lista: PedidoDataEntregaAtualizar[]): PedidoDataEntregaAtualizar[] {
  const peso = (p: PedidoDataEntregaAtualizar) => (p.semData > 0 ? Number.NEGATIVE_INFINITY : (p.menorDias ?? 0));
  return [...lista].sort((a, b) => {
    const pa = peso(a);
    const pb = peso(b);
    if (pa !== pb) return pa < pb ? -1 : 1;
    return a.pedido.localeCompare(b.pedido, 'pt-BR', { numeric: true, sensitivity: 'base' });
  });
}

export async function listarDatasEntregaAtualizar(): Promise<{
  pedidos: PedidoDataEntregaAtualizar[];
  erro?: string;
}> {
  const off = exigirNomus();
  if (off) return { pedidos: [], erro: off };
  try {
    const rows = await queryAgg(SQL_DATAS_ENTREGA_PEDIDOS);
    const pedidos = rows
      .map((r) => ({
        idPedido: toInt(r.idPedido),
        pedido: strOrNull(r.pedido) ?? String(toInt(r.idPedido)),
        fornecedor: strOrNull(r.fornecedor),
        dataEmissao: strOrNull(r.dataEmissao),
        itens: toInt(r.itens),
        liberados: toInt(r.liberados),
        parciais: toInt(r.parciais),
        preEntradas: toInt(r.preEntradas),
        semData: toInt(r.semData),
        menorDias: intOrNull(r.menorDias),
        menorDataEntrega: strOrNull(r.menorDataEntrega),
      }))
      .filter((p) => p.idPedido > 0 && p.itens > 0);
    return { pedidos: ordenarPedidosDataEntrega(pedidos) };
  } catch (err) {
    return { pedidos: [], erro: formatNomusErroConexao(err) };
  }
}

async function queryPorId(sql: string, id: number): Promise<Record<string, unknown>[]> {
  const pool = getNomusPool();
  if (!pool) throw new Error('NOMUS_DB_URL não configurado');
  const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, sql, [id]);
  return Array.isArray(rows) ? rows : [];
}

export async function obterDocumentoAcompanhamento(
  tipo: TipoDocumentoAcompanhamento,
  id: number,
  somenteElegiveisDataEntrega = false
): Promise<{ documento: DocumentoAcompanhamento | null; erro?: string; naoEncontrado?: boolean }> {
  if (!Number.isFinite(id) || id <= 0) return { documento: null, erro: 'Documento inválido.' };
  const off = exigirNomus();
  if (off) return { documento: null, erro: off };
  try {
    if (tipo === 'pedido') {
      const [cab, itens, pre] = await Promise.all([
        queryPorId(SQL_DOC_PEDIDO_CABECALHO, id),
        queryPorId(buildSqlDocPedidoItens(somenteElegiveisDataEntrega), id),
        queryPorId(SQL_DOC_PEDIDO_PRE_ENTRADAS, id),
      ]);
      const c = cab[0];
      if (!c) return { documento: null, naoEncontrado: true, erro: 'Pedido de compra não encontrado.' };
      const preEntradas: LinhaPreEntradaDoPedido[] = pre.map((r) => ({
        idItemPedido: toInt(r.idItemPedido),
        idItemDocumento: toInt(r.idItemDocumento),
        qtde: round2(toNum(r.qtde)),
        idDocumento: toInt(r.idDocumento),
        numeroDocumento: strOrNull(r.numeroDocumento),
      }));
      return {
        documento: {
          tipo,
          id,
          numero: strOrNull(c.numero) ?? String(id),
          fornecedor: strOrNull(c.fornecedor),
          dataEmissao: strOrNull(c.dataEmissao),
          numeroNfe: null,
          efetivado: false,
          itens: montarItensPedido(itens, preEntradas),
        },
      };
    }
    const [cab, itens, vinc] = await Promise.all([
      queryPorId(SQL_DOC_PRE_CABECALHO, id),
      queryPorId(SQL_DOC_PRE_ITENS, id),
      queryPorId(SQL_DOC_PRE_VINCULOS, id),
    ]);
    const c = cab[0];
    if (!c) return { documento: null, naoEncontrado: true, erro: 'Documento de entrada não encontrado.' };
    const vinculos: VinculoItemPreEntrada[] = vinc.map((r) => ({
      idItemDocumento: toInt(r.idItemDocumento),
      idPedido: toInt(r.idPedido),
      pedido: strOrNull(r.pedido),
      solicitacoes: strOrNull(r.solicitacoes),
    }));
    return {
      documento: {
        tipo,
        id,
        numero: strOrNull(c.numero) ?? String(id),
        fornecedor: strOrNull(c.fornecedor),
        dataEmissao: strOrNull(c.dataEmissao),
        numeroNfe: strOrNull(c.numeroNfe),
        efetivado: toInt(c.idTipoMovimentacao) !== RECEBIMENTO_ID_TIPO_PRE_ENTRADA,
        itens: montarItensPreEntrada(itens, vinculos),
      },
    };
  } catch (err) {
    return { documento: null, erro: formatNomusErroConexao(err) };
  }
}
