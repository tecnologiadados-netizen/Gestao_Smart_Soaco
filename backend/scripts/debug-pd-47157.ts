import 'dotenv/config';
import { getNomusPool, isNomusEnabled } from '../src/config/nomusDb.js';

async function main() {
  if (!isNomusEnabled()) {
    console.log('Nomus off');
    return;
  }
  const pool = getNomusPool();
  if (!pool) return;

  const [rows] = await pool.query(`
    SELECT
      ide.id AS ideId,
      pd.nome AS pedido,
      ip.id AS idItemPedido,
      de.numeroDocumentoFiscal AS nf,
      p.nome AS produto,
      ide.valorTotal,
      vor.idListaOpcao AS vor592,
      req.opcao AS req313,
      IF(psm.idItemPedido IS NOT NULL, 'So Moveis', 'So Aco') AS idItemPedidoSM
    FROM itemdocumentoestoque ide
    LEFT JOIN documentoestoque de ON ide.idDocumentoSaida = de.id
    LEFT JOIN produto p ON p.id = ide.idProduto
    LEFT JOIN itemdocumentoestoque_itempedidovenda ideipv ON ideipv.idItemDocumentoEstoque = ide.id
    LEFT JOIN itempedido ip ON ip.id = ideipv.idItemPedidoVenda
    LEFT JOIN pedido pd ON pd.id = ip.idPedido
    LEFT JOIN (
      SELECT apv.idPedido, apv.idListaOpcao
      FROM atributopedidovalor apv WHERE apv.idAtributo = 592
    ) vor ON vor.idPedido = pd.id
    LEFT JOIN (
      SELECT apv.idPedido, alo.opcao
      FROM atributopedidovalor apv
      LEFT JOIN atributolistaopcao alo ON alo.id = apv.idListaOpcao
      WHERE apv.idAtributo = 313
    ) req ON req.idPedido = pd.id
    LEFT JOIN (
      SELECT ip.id AS idItemPedido
      FROM itempedido ip
      LEFT JOIN pedido pd ON pd.id = ip.idPedido
      LEFT JOIN (
        SELECT apv.idPedido, apv.idListaOpcao FROM atributopedidovalor apv WHERE apv.idAtributo = 592
      ) vor ON vor.idPedido = pd.id
      LEFT JOIN (
        SELECT apv.idPedido, alo.opcao
        FROM atributopedidovalor apv
        LEFT JOIN atributolistaopcao alo ON alo.id = apv.idListaOpcao
        WHERE apv.idAtributo = 313
      ) req ON req.idPedido = pd.id
      WHERE pd.dataEmissao >= '2024-01-01' AND pd.idEmpresa = 1
        AND vor.idListaOpcao = 2377 AND req.opcao <> 'Sim'
    ) psm ON psm.idItemPedido = ip.id
    WHERE pd.nome LIKE '%47157%' OR de.numeroDocumentoFiscal = 133868
  `);
  console.log(JSON.stringify(rows, null, 2));
}

main().catch(console.error);
