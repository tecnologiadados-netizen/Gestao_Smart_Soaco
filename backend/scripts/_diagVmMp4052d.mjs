/**
 * Simula VM do MP 4052 se a lista do PP 4543 ("Lista Padrão") fosse aceita na explosão.
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

function parseNomusUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username || ''),
    password: decodeURIComponent(u.password || ''),
    database: (u.pathname || '/').replace(/^\//, '') || 'weberp_soaco',
    connectTimeout: 60000,
  };
}

async function main() {
  const pool = mysql.createPool(parseNomusUrl(process.env.NOMUS_DB_URL.trim()));

  // Mesmo critério Ressup, MAS aceita também "Lista Padrão" / "Lista Padrao"
  const [rows] = await pool.query(`
    WITH RECURSIVE explosao_venda AS (
      SELECT
        ip.idProduto AS idProdutoOrigem,
        ip.idProduto AS idProdutoPai,
        pq.idProdutoComponente AS idComponente,
        SUM(ip.qtde) / 6
          * CAST(REPLACE(pq.qtdeNecessaria, ',', '.') AS DECIMAL(20,6)) AS media_mensal
      FROM itempedido ip
      INNER JOIN pedido pd ON pd.id = ip.idPedido
      INNER JOIN listamateriais lm
        ON lm.idProduto = ip.idProduto AND lm.padrao = 1 AND lm.ativo = 1 AND lm.discriminador = 'Original'
        AND (
          lm.descricao LIKE 'Lista%Produ__o'
          OR lm.descricao LIKE 'Lista%Precifica__o'
          OR lm.descricao LIKE 'Lista%Parci%'
          OR lm.descricao LIKE 'Lista%Padr__o'
        )
      INNER JOIN produtoqtde pq ON pq.idListaMateriais = lm.id
      LEFT JOIN (
        SELECT apv.idPedido, alo.opcao
        FROM atributopedidovalor apv
        LEFT JOIN atributolistaopcao alo ON alo.id = apv.idListaOpcao
        WHERE apv.idAtributo = 313
      ) requisicao ON requisicao.idPedido = pd.id
      WHERE pd.idEmpresa = 1
        AND ip.status IN (2, 3, 4, 5)
        AND pd.dataEmissao >= DATE(CONCAT(
              EXTRACT(YEAR FROM DATE_ADD(CURDATE(), INTERVAL -6 MONTH)), '-',
              EXTRACT(MONTH FROM DATE_ADD(CURDATE(), INTERVAL -6 MONTH)), '-', 1))
        AND pd.dataEmissao <= LAST_DAY(DATE_ADD(CURDATE(), INTERVAL -1 MONTH))
        AND (requisicao.opcao IS NULL OR requisicao.opcao != 'Sim')
      GROUP BY ip.idProduto, pq.idProdutoComponente, pq.qtdeNecessaria

      UNION ALL

      SELECT
        e.idProdutoOrigem,
        e.idComponente AS idProdutoPai,
        pq.idProdutoComponente AS idComponente,
        e.media_mensal
          * CAST(REPLACE(pq.qtdeNecessaria, ',', '.') AS DECIMAL(20,6)) AS media_mensal
      FROM explosao_venda e
      INNER JOIN listamateriais lm
        ON lm.idProduto = e.idComponente AND lm.padrao = 1 AND lm.ativo = 1 AND lm.discriminador = 'Original'
        AND (
          lm.descricao LIKE 'Lista%Produ__o'
          OR lm.descricao LIKE 'Lista%Precifica__o'
          OR lm.descricao LIKE 'Lista%Parci%'
          OR lm.descricao LIKE 'Lista%Padr__o'
        )
      INNER JOIN produtoqtde pq ON pq.idListaMateriais = lm.id
    )
    SELECT
      p.nome AS codigo,
      ROUND(SUM(e.media_mensal), 2) AS VM_simulada
    FROM explosao_venda e
    INNER JOIN produto p ON p.id = e.idComponente
    WHERE e.idComponente IN (6585, 2152)
    GROUP BY p.id, p.nome
    ORDER BY p.nome
  `);

  console.log('VM se "Lista Padrão" fosse aceita na explosão:');
  console.log(JSON.stringify(rows, null, 2));
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
