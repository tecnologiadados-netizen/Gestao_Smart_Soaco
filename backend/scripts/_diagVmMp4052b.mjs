/**
 * Diagnóstico follow-up: por que MP 4052 não recebe VM do PP 4543 (fundível).
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

function section(t) {
  console.log('\n' + '='.repeat(60) + '\n' + t + '\n' + '='.repeat(60));
}

async function main() {
  const pool = mysql.createPool(parseNomusUrl(process.env.NOMUS_DB_URL.trim()));

  section('Elegibilidade Não Almox — MP 4052 vs PP 4543');
  const [elig] = await pool.query(`
    SELECT
      p.id,
      p.nome AS codigo,
      tp.nome AS tipoProduto,
      tm.opcao AS tipoMaterial,
      nc.opcao AS coleta,
      CASE
        WHEN p.ativo = 1
         AND tp.nome = 'Materia prima'
         AND tm.opcao IN ('Matéria Prima', 'Embalagem', 'Material Secundário')
         AND nc.opcao IN (
           'ISOPOR','TANQUES DE RESFRIADORES','LAMIPRO/POLIPROPLENO',
           'AGLOMERADOS E COMPENSADOS','FUNDÍVEIS'
         )
        THEN 'SIM' ELSE 'NAO'
      END AS elegivel_grade
    FROM produto p
    LEFT JOIN tipoproduto tp ON p.idTipoProduto = tp.id
    LEFT JOIN (
      SELECT apv.idProduto, alo.opcao
      FROM atributoprodutovalor apv
      LEFT JOIN atributolistaopcao alo ON alo.id = apv.idListaOpcao
      WHERE apv.idAtributo = 540
    ) tm ON tm.idProduto = p.id
    LEFT JOIN (
      SELECT apv.idProduto, alo.opcao
      FROM atributoprodutovalor apv
      LEFT JOIN atributolistaopcao alo ON alo.id = apv.idListaOpcao
      WHERE apv.idAtributo = 650
    ) nc ON nc.idProduto = p.id
    WHERE p.id IN (6585, 2152)
    ORDER BY p.nome
  `);
  console.log(JSON.stringify(elig, null, 2));

  section('PAs com venda — componente na BOM é MP 4052 ou PP 4543?');
  const [compVenda] = await pool.query(`
    SELECT
      pai.nome AS cod_pai,
      ROUND(SUM(ip.qtde) / 6, 2) AS media_venda_pai,
      GROUP_CONCAT(DISTINCT c.nome ORDER BY c.nome) AS componentes_na_bom_validada,
      MAX(CASE WHEN c.nome = 'MP 4052' THEN 1 ELSE 0 END) AS tem_mp4052,
      MAX(CASE WHEN c.nome = 'PP 4543' THEN 1 ELSE 0 END) AS tem_pp4543
    FROM itempedido ip
    INNER JOIN pedido pd ON pd.id = ip.idPedido
    INNER JOIN produto pai ON pai.id = ip.idProduto
    INNER JOIN listamateriais lm
      ON lm.idProduto = pai.id AND lm.padrao = 1 AND lm.ativo = 1 AND lm.discriminador = 'Original'
      AND (
        lm.descricao LIKE 'Lista%Produ__o'
        OR lm.descricao LIKE 'Lista%Precifica__o'
        OR lm.descricao LIKE 'Lista%Parci%'
      )
    INNER JOIN produtoqtde pq ON pq.idListaMateriais = lm.id
    INNER JOIN produto c ON c.id = pq.idProdutoComponente
    LEFT JOIN (
      SELECT apv.idPedido, alo.opcao
      FROM atributopedidovalor apv
      LEFT JOIN atributolistaopcao alo ON alo.id = apv.idListaOpcao
      WHERE apv.idAtributo = 313
    ) requisicao ON requisicao.idPedido = pd.id
    WHERE c.id IN (6585, 2152)
      AND pd.idEmpresa = 1
      AND ip.status IN (2, 3, 4, 5)
      AND pd.dataEmissao >= DATE(CONCAT(
            EXTRACT(YEAR FROM DATE_ADD(CURDATE(), INTERVAL -6 MONTH)), '-',
            EXTRACT(MONTH FROM DATE_ADD(CURDATE(), INTERVAL -6 MONTH)), '-', 1))
      AND pd.dataEmissao <= LAST_DAY(DATE_ADD(CURDATE(), INTERVAL -1 MONTH))
      AND (requisicao.opcao IS NULL OR requisicao.opcao != 'Sim')
    GROUP BY pai.id, pai.nome
    ORDER BY media_venda_pai DESC
  `);
  console.log(JSON.stringify(compVenda, null, 2));

  section('Contribuição VM por componente (explosão 1 nível a partir dos PAs vendidos)');
  const [contrib] = await pool.query(`
    SELECT
      c.nome AS componente,
      ROUND(SUM(ip.qtde) / 6 * CAST(REPLACE(pq.qtdeNecessaria, ',', '.') AS DECIMAL(20,6)), 2) AS vm_nivel1,
      COUNT(DISTINCT pai.id) AS qtd_pas
    FROM itempedido ip
    INNER JOIN pedido pd ON pd.id = ip.idPedido
    INNER JOIN produto pai ON pai.id = ip.idProduto
    INNER JOIN listamateriais lm
      ON lm.idProduto = pai.id AND lm.padrao = 1 AND lm.ativo = 1 AND lm.discriminador = 'Original'
      AND (
        lm.descricao LIKE 'Lista%Produ__o'
        OR lm.descricao LIKE 'Lista%Precifica__o'
        OR lm.descricao LIKE 'Lista%Parci%'
      )
    INNER JOIN produtoqtde pq ON pq.idListaMateriais = lm.id AND pq.idProdutoComponente IN (6585, 2152)
    INNER JOIN produto c ON c.id = pq.idProdutoComponente
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
    GROUP BY c.id, c.nome
  `);
  console.log(JSON.stringify(contrib, null, 2));

  section('MP 4052 — pais validados COM vs SEM venda');
  const [mpPais] = await pool.query(`
    SELECT
      SUM(CASE WHEN COALESCE(v.media, 0) > 0 THEN 1 ELSE 0 END) AS pais_com_venda,
      SUM(CASE WHEN COALESCE(v.media, 0) = 0 THEN 1 ELSE 0 END) AS pais_sem_venda,
      COUNT(*) AS total_pais_validados
    FROM (
      SELECT DISTINCT lm.idProduto
      FROM produtoqtde pq
      INNER JOIN listamateriais lm ON lm.id = pq.idListaMateriais
      WHERE pq.idProdutoComponente = 6585
        AND lm.padrao = 1 AND lm.ativo = 1 AND lm.discriminador = 'Original'
        AND (
          lm.descricao LIKE 'Lista%Produ__o'
          OR lm.descricao LIKE 'Lista%Precifica__o'
          OR lm.descricao LIKE 'Lista%Parci%'
        )
    ) x
    LEFT JOIN (
      SELECT ip.idProduto, SUM(ip.qtde)/6 AS media
      FROM itempedido ip
      INNER JOIN pedido pd ON pd.id = ip.idPedido
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
      GROUP BY ip.idProduto
    ) v ON v.idProduto = x.idProduto
  `);
  console.log(JSON.stringify(mpPais, null, 2));

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
