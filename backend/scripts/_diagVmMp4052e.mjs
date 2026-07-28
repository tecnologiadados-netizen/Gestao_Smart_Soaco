/**
 * Explosão direcionada: só a partir de PAs que contêm PP 4543, desce 2 níveis.
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

  // Nível 1: venda → PP 4543
  const [n1] = await pool.query(`
    SELECT
      ROUND(SUM(ip.qtde) / 6 * CAST(REPLACE(pq.qtdeNecessaria, ',', '.') AS DECIMAL(20,6)), 2) AS vm_pp
    FROM itempedido ip
    INNER JOIN pedido pd ON pd.id = ip.idPedido
    INNER JOIN listamateriais lm
      ON lm.idProduto = ip.idProduto AND lm.padrao = 1 AND lm.ativo = 1 AND lm.discriminador = 'Original'
      AND (
        lm.descricao LIKE 'Lista%Produ__o'
        OR lm.descricao LIKE 'Lista%Precifica__o'
        OR lm.descricao LIKE 'Lista%Parci%'
      )
    INNER JOIN produtoqtde pq ON pq.idListaMateriais = lm.id AND pq.idProdutoComponente = 2152
    LEFT JOIN (
      SELECT apv.idPedido, alo.opcao
      FROM atributopedidovalor apv
      LEFT JOIN atributolistaopcao alo ON alo.id = apv.idListaOpcao
      WHERE apv.idAtributo = 313
    ) requisicao ON requisicao.idPedido = pd.id
    WHERE pd.idEmpresa = 1 AND ip.status IN (2,3,4,5)
      AND pd.dataEmissao >= DATE(CONCAT(
            EXTRACT(YEAR FROM DATE_ADD(CURDATE(), INTERVAL -6 MONTH)), '-',
            EXTRACT(MONTH FROM DATE_ADD(CURDATE(), INTERVAL -6 MONTH)), '-', 1))
      AND pd.dataEmissao <= LAST_DAY(DATE_ADD(CURDATE(), INTERVAL -1 MONTH))
      AND (requisicao.opcao IS NULL OR requisicao.opcao != 'Sim')
  `);
  console.log('VM nível1 PP 4543 (só PAs com lista Produção/Precif/Parcial):', n1);

  // Nível 2 manual: VM_PP * qtde MP na Lista Padrão do PP
  const [n2] = await pool.query(`
    SELECT
      ROUND(
        (
          SELECT SUM(ip.qtde) / 6 * CAST(REPLACE(pq.qtdeNecessaria, ',', '.') AS DECIMAL(20,6))
          FROM itempedido ip
          INNER JOIN pedido pd ON pd.id = ip.idPedido
          INNER JOIN listamateriais lm
            ON lm.idProduto = ip.idProduto AND lm.padrao = 1 AND lm.ativo = 1 AND lm.discriminador = 'Original'
            AND (
              lm.descricao LIKE 'Lista%Produ__o'
              OR lm.descricao LIKE 'Lista%Precifica__o'
              OR lm.descricao LIKE 'Lista%Parci%'
            )
          INNER JOIN produtoqtde pq ON pq.idListaMateriais = lm.id AND pq.idProdutoComponente = 2152
          LEFT JOIN (
            SELECT apv.idPedido, alo.opcao
            FROM atributopedidovalor apv
            LEFT JOIN atributolistaopcao alo ON alo.id = apv.idListaOpcao
            WHERE apv.idAtributo = 313
          ) requisicao ON requisicao.idPedido = pd.id
          WHERE pd.idEmpresa = 1 AND ip.status IN (2,3,4,5)
            AND pd.dataEmissao >= DATE(CONCAT(
                  EXTRACT(YEAR FROM DATE_ADD(CURDATE(), INTERVAL -6 MONTH)), '-',
                  EXTRACT(MONTH FROM DATE_ADD(CURDATE(), INTERVAL -6 MONTH)), '-', 1))
            AND pd.dataEmissao <= LAST_DAY(DATE_ADD(CURDATE(), INTERVAL -1 MONTH))
            AND (requisicao.opcao IS NULL OR requisicao.opcao != 'Sim')
        )
        *
        (
          SELECT CAST(REPLACE(pq2.qtdeNecessaria, ',', '.') AS DECIMAL(20,6))
          FROM listamateriais lm2
          INNER JOIN produtoqtde pq2 ON pq2.idListaMateriais = lm2.id AND pq2.idProdutoComponente = 6585
          WHERE lm2.idProduto = 2152 AND lm2.padrao = 1 AND lm2.ativo = 1
          LIMIT 1
        )
      , 2) AS vm_mp_via_pp_lista_padrao
  `);
  console.log('VM MP 4052 se herdasse via Lista Padrão do PP (nível1 PA→PP apenas):', n2);

  // Por que CTE completa com Lista Padrão não trouxe MP? Checar se há MULTIPLAS listas padrao=1 no PP
  const [listasPp] = await pool.query(`
    SELECT lm.id, lm.descricao, lm.padrao, lm.ativo, lm.discriminador,
      (SELECT COUNT(*) FROM produtoqtde pq WHERE pq.idListaMateriais = lm.id) AS qtd_comp
    FROM listamateriais lm WHERE lm.idProduto = 2152
  `);
  console.log('Todas listas PP 4543:', listasPp);

  // CTE só a partir do idProdutoOrigem que contém PP — forçar descida 1 passo com Lista Padrão
  const [cte] = await pool.query(`
    WITH RECURSIVE e AS (
      SELECT
        2152 AS idComponente,
        CAST(56.33 AS DECIMAL(20,6)) AS media_mensal,
        0 AS nivel
      UNION ALL
      SELECT
        pq.idProdutoComponente,
        e.media_mensal * CAST(REPLACE(pq.qtdeNecessaria, ',', '.') AS DECIMAL(20,6)),
        e.nivel + 1
      FROM e
      INNER JOIN listamateriais lm
        ON lm.idProduto = e.idComponente AND lm.padrao = 1 AND lm.ativo = 1 AND lm.discriminador = 'Original'
      INNER JOIN produtoqtde pq ON pq.idListaMateriais = lm.id
      WHERE e.nivel < 3
    )
    SELECT p.nome, ROUND(SUM(e.media_mensal), 2) AS vm, MAX(e.nivel) AS max_nivel
    FROM e
    INNER JOIN produto p ON p.id = e.idComponente
    GROUP BY p.id, p.nome
    ORDER BY max_nivel, p.nome
  `);
  console.log('Descida forçada a partir PP (qualquer lista padrao ativa Original):', cte);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
