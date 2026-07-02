import 'dotenv/config';
import { getNomusPool } from '../src/config/nomusDb.js';

const pool = getNomusPool()!;

const [links] = await pool.query(`
  SELECT ideipv.idItemPedidoVenda, pd.nome, ip.id
  FROM itemdocumentoestoque_itempedidovenda ideipv
  LEFT JOIN itempedido ip ON ip.id = ideipv.idItemPedidoVenda
  LEFT JOIN pedido pd ON pd.id = ip.idPedido
  WHERE ideipv.idItemDocumentoEstoque = 502855
`);

const [notExists] = await pool.query(`
  SELECT ide.id
  FROM itemdocumentoestoque ide
  WHERE ide.id = 502855
    AND NOT EXISTS (
      SELECT 1
      FROM itemdocumentoestoque_itempedidovenda ideipv_sm
      INNER JOIN itempedido ip_sm ON ip_sm.id = ideipv_sm.idItemPedidoVenda
      INNER JOIN pedido pd_sm ON pd_sm.id = ip_sm.idPedido
      INNER JOIN (
        SELECT apv.idPedido FROM atributopedidovalor apv
        WHERE apv.idAtributo = 592 AND apv.idListaOpcao = 2377
      ) vor_sm ON vor_sm.idPedido = pd_sm.id
      INNER JOIN (
        SELECT apv.idPedido, alo.opcao FROM atributopedidovalor apv
        LEFT JOIN atributolistaopcao alo ON alo.id = apv.idListaOpcao
        WHERE apv.idAtributo = 313
      ) req_sm ON req_sm.idPedido = pd_sm.id
      WHERE ideipv_sm.idItemDocumentoEstoque = ide.id
        AND pd_sm.dataEmissao >= '2024-01-01' AND pd_sm.idEmpresa = 1
        AND req_sm.opcao <> 'Sim'
    )
`);

console.log('links:', links);
console.log('passes NOT EXISTS:', notExists);
