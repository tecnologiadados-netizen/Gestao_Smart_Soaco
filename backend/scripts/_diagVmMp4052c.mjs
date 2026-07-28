/**
 * Diagnóstico: PP 4543 explode para MP 4052?
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
    connectTimeout: 30000,
  };
}

async function main() {
  const pool = mysql.createPool(parseNomusUrl(process.env.NOMUS_DB_URL.trim()));

  console.log('=== Listas do PP 4543 (id 2152) ===');
  const [listas] = await pool.query(`
    SELECT lm.id, lm.descricao, lm.padrao, lm.ativo, lm.discriminador
    FROM listamateriais lm
    WHERE lm.idProduto = 2152
    ORDER BY lm.ativo DESC, lm.padrao DESC, lm.descricao
  `);
  console.log(JSON.stringify(listas, null, 2));

  console.log('\n=== Componentes nas listas validadas do PP 4543 ===');
  const [comps] = await pool.query(`
    SELECT
      lm.id AS idLista,
      lm.descricao,
      lm.padrao,
      lm.ativo,
      lm.discriminador,
      c.nome AS componente,
      c.id AS idComponente,
      CAST(REPLACE(pq.qtdeNecessaria, ',', '.') AS DECIMAL(20,6)) AS qtde
    FROM listamateriais lm
    INNER JOIN produtoqtde pq ON pq.idListaMateriais = lm.id
    INNER JOIN produto c ON c.id = pq.idProdutoComponente
    WHERE lm.idProduto = 2152
      AND lm.padrao = 1 AND lm.ativo = 1 AND lm.discriminador = 'Original'
      AND (
        lm.descricao LIKE 'Lista%Produ__o'
        OR lm.descricao LIKE 'Lista%Precifica__o'
        OR lm.descricao LIKE 'Lista%Parci%'
      )
    ORDER BY lm.descricao, c.nome
  `);
  console.log(JSON.stringify(comps, null, 2));

  console.log('\n=== MP 4052 aparece como filho do PP 4543 em QUALQUER lista? ===');
  const [filho] = await pool.query(`
    SELECT
      lm.id, lm.descricao, lm.padrao, lm.ativo, lm.discriminador,
      CAST(REPLACE(pq.qtdeNecessaria, ',', '.') AS DECIMAL(20,6)) AS qtde
    FROM listamateriais lm
    INNER JOIN produtoqtde pq ON pq.idListaMateriais = lm.id AND pq.idProdutoComponente = 6585
    WHERE lm.idProduto = 2152
  `);
  console.log(JSON.stringify(filho, null, 2));

  console.log('\n=== Qualquer lista do PP 4543 (todos componentes, lista padrao ativa) ===');
  const [allPadrao] = await pool.query(`
    SELECT
      lm.descricao, lm.padrao, lm.ativo, lm.discriminador,
      c.nome AS componente,
      CAST(REPLACE(pq.qtdeNecessaria, ',', '.') AS DECIMAL(20,6)) AS qtde
    FROM listamateriais lm
    INNER JOIN produtoqtde pq ON pq.idListaMateriais = lm.id
    INNER JOIN produto c ON c.id = pq.idProdutoComponente
    WHERE lm.idProduto = 2152 AND lm.padrao = 1
    ORDER BY lm.ativo DESC, lm.descricao, c.nome
  `);
  console.log(JSON.stringify(allPadrao, null, 2));

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
