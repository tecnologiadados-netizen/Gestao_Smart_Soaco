/**
 * Diagnóstico one-off: VM=0 do MP 4052 (Ressup Não Almox).
 * Somente leitura no Nomus. Remover após o diagnóstico.
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

function section(title) {
  console.log('\n' + '='.repeat(60));
  console.log(title);
  console.log('='.repeat(60));
}

async function main() {
  const url = process.env.NOMUS_DB_URL;
  if (!url?.trim()) {
    console.error('NOMUS_DB_URL não configurado');
    process.exit(1);
  }
  const pool = mysql.createPool(parseNomusUrl(url.trim()));

  // 1) Produtos
  section('1) PRODUTOS MP 4052 / PP 4543');
  const [prods] = await pool.query(`
    SELECT id, nome, descricao, ativo
    FROM produto
    WHERE REPLACE(nome, ' ', '') IN ('MP4052', 'PP4543')
       OR nome IN ('MP 4052', 'PP 4543')
    ORDER BY nome
  `);
  console.log(JSON.stringify(prods, null, 2));
  if (!prods.length) {
    console.error('Produto não encontrado');
    await pool.end();
    process.exit(1);
  }

  const ids = prods.map((p) => p.id);
  const idList = ids.join(',');
  const byCod = Object.fromEntries(prods.map((p) => [String(p.nome).trim(), p]));

  // 2) VM isolada (critério Ressup)
  section('2) VM ISOLADA (ressupNaoAlmoxVm — ativo+Original)');
  const sqlVm = readFileSync(join(__dirname, '../src/data/sql/ressupNaoAlmoxVm.sql'), 'utf-8');
  const [vmRows] = await pool.query(`
    SELECT * FROM (
      ${sqlVm.trim()}
    ) t
    WHERE t.idProduto IN (${idList})
  `);
  console.log(JSON.stringify(vmRows, null, 2));

  // 3) Presença em BOM (todas as listas vs validadas)
  section('3a) TODAS as listas onde o componente aparece (produtoqtde)');
  const [bomAll] = await pool.query(`
    SELECT
      p.nome AS cod_componente,
      lm.id AS idLista,
      lm.descricao AS lista,
      lm.padrao,
      lm.ativo,
      lm.discriminador,
      pai.nome AS cod_pai,
      pai.descricao AS desc_pai,
      CAST(REPLACE(pq.qtdeNecessaria, ',', '.') AS DECIMAL(20,6)) AS qtdeNecessaria
    FROM produtoqtde pq
    INNER JOIN listamateriais lm ON lm.id = pq.idListaMateriais
    INNER JOIN produto p ON p.id = pq.idProdutoComponente
    INNER JOIN produto pai ON pai.id = lm.idProduto
    WHERE pq.idProdutoComponente IN (${idList})
    ORDER BY p.nome, lm.ativo DESC, lm.padrao DESC, pai.nome
  `);
  console.log(`Total linhas: ${bomAll.length}`);
  console.log(JSON.stringify(bomAll.slice(0, 80), null, 2));
  if (bomAll.length > 80) console.log(`... +${bomAll.length - 80} linhas`);

  section('3b) BOM VALIDADA (padrao=1, ativo=1, Original, Produção|Precificação|Parcial)');
  const [bomVal] = await pool.query(`
    SELECT
      p.nome AS cod_componente,
      lm.id AS idLista,
      lm.descricao AS lista,
      lm.padrao,
      lm.ativo,
      lm.discriminador,
      pai.nome AS cod_pai,
      pai.descricao AS desc_pai,
      CAST(REPLACE(pq.qtdeNecessaria, ',', '.') AS DECIMAL(20,6)) AS qtdeNecessaria
    FROM produtoqtde pq
    INNER JOIN listamateriais lm ON lm.id = pq.idListaMateriais
    INNER JOIN produto p ON p.id = pq.idProdutoComponente
    INNER JOIN produto pai ON pai.id = lm.idProduto
    WHERE pq.idProdutoComponente IN (${idList})
      AND lm.padrao = 1
      AND lm.ativo = 1
      AND lm.discriminador = 'Original'
      AND (
        lm.descricao LIKE 'Lista%Produ__o'
        OR lm.descricao LIKE 'Lista%Precifica__o'
        OR lm.descricao LIKE 'Lista%Parci%'
      )
    ORDER BY p.nome, pai.nome
  `);
  console.log(`Total validadas: ${bomVal.length}`);
  console.log(JSON.stringify(bomVal, null, 2));

  // 4) Subir cadeia + cruzar vendas
  section('4a) Pais diretos (BOM validada) — vendas do PAI nos 6 meses fechados');
  const [vendasPai] = await pool.query(`
    SELECT
      pai.nome AS cod_pai,
      pai.descricao AS desc_pai,
      ROUND(SUM(ip.qtde) / 6, 2) AS media_mensal_venda_pai,
      COUNT(DISTINCT pd.id) AS qtd_pedidos,
      MIN(pd.dataEmissao) AS primeira_venda,
      MAX(pd.dataEmissao) AS ultima_venda
    FROM produtoqtde pq
    INNER JOIN listamateriais lm ON lm.id = pq.idListaMateriais
    INNER JOIN produto pai ON pai.id = lm.idProduto
    INNER JOIN itempedido ip ON ip.idProduto = pai.id
    INNER JOIN pedido pd ON pd.id = ip.idPedido
    LEFT JOIN (
      SELECT apv.idPedido, alo.opcao
      FROM atributopedidovalor apv
      LEFT JOIN atributolistaopcao alo ON alo.id = apv.idListaOpcao
      WHERE apv.idAtributo = 313
    ) requisicao ON requisicao.idPedido = pd.id
    WHERE pq.idProdutoComponente IN (${idList})
      AND lm.padrao = 1 AND lm.ativo = 1 AND lm.discriminador = 'Original'
      AND (
        lm.descricao LIKE 'Lista%Produ__o'
        OR lm.descricao LIKE 'Lista%Precifica__o'
        OR lm.descricao LIKE 'Lista%Parci%'
      )
      AND pd.idEmpresa = 1
      AND ip.status IN (2, 3, 4, 5)
      AND pd.dataEmissao >= DATE(CONCAT(
            EXTRACT(YEAR FROM DATE_ADD(CURDATE(), INTERVAL -6 MONTH)), '-',
            EXTRACT(MONTH FROM DATE_ADD(CURDATE(), INTERVAL -6 MONTH)), '-', 1))
      AND pd.dataEmissao <= LAST_DAY(DATE_ADD(CURDATE(), INTERVAL -1 MONTH))
      AND (requisicao.opcao IS NULL OR requisicao.opcao != 'Sim')
    GROUP BY pai.id, pai.nome, pai.descricao
    ORDER BY media_mensal_venda_pai DESC
  `);
  console.log(`Pais com venda direta: ${vendasPai.length}`);
  console.log(JSON.stringify(vendasPai, null, 2));

  section('4b) Explosão multi-nível: ancestrais PA até 5 níveis (critério validado)');
  const [cadeia] = await pool.query(`
    WITH RECURSIVE sobe AS (
      SELECT
        pq.idProdutoComponente AS idComponente,
        lm.idProduto AS idPai,
        1 AS nivel,
        CAST(REPLACE(pq.qtdeNecessaria, ',', '.') AS DECIMAL(20,6)) AS fator
      FROM produtoqtde pq
      INNER JOIN listamateriais lm ON lm.id = pq.idListaMateriais
      WHERE pq.idProdutoComponente IN (${idList})
        AND lm.padrao = 1 AND lm.ativo = 1 AND lm.discriminador = 'Original'
        AND (
          lm.descricao LIKE 'Lista%Produ__o'
          OR lm.descricao LIKE 'Lista%Precifica__o'
          OR lm.descricao LIKE 'Lista%Parci%'
        )

      UNION ALL

      SELECT
        s.idComponente,
        lm.idProduto AS idPai,
        s.nivel + 1,
        s.fator * CAST(REPLACE(pq.qtdeNecessaria, ',', '.') AS DECIMAL(20,6))
      FROM sobe s
      INNER JOIN produtoqtde pq ON pq.idProdutoComponente = s.idPai
      INNER JOIN listamateriais lm ON lm.id = pq.idListaMateriais
      WHERE s.nivel < 5
        AND lm.padrao = 1 AND lm.ativo = 1 AND lm.discriminador = 'Original'
        AND (
          lm.descricao LIKE 'Lista%Produ__o'
          OR lm.descricao LIKE 'Lista%Precifica__o'
          OR lm.descricao LIKE 'Lista%Parci%'
        )
    )
    SELECT
      c.nome AS cod_componente,
      s.nivel,
      pai.nome AS cod_ancestral,
      pai.descricao AS desc_ancestral,
      ROUND(s.fator, 6) AS fator_bom,
      ROUND(COALESCE(v.media_mensal, 0), 2) AS media_mensal_venda_ancestral,
      ROUND(COALESCE(v.media_mensal, 0) * s.fator, 2) AS contribuicao_vm
    FROM sobe s
    INNER JOIN produto c ON c.id = s.idComponente
    INNER JOIN produto pai ON pai.id = s.idPai
    LEFT JOIN (
      SELECT
        ip.idProduto,
        SUM(ip.qtde) / 6 AS media_mensal
      FROM itempedido ip
      INNER JOIN pedido pd ON pd.id = ip.idPedido
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
      GROUP BY ip.idProduto
    ) v ON v.idProduto = s.idPai
    ORDER BY c.nome, s.nivel, contribuicao_vm DESC, pai.nome
  `);
  console.log(`Ancestrais na cadeia: ${cadeia.length}`);
  const comVenda = cadeia.filter((r) => Number(r.media_mensal_venda_ancestral) > 0);
  console.log(`Com venda no ancestral: ${comVenda.length}`);
  console.log(JSON.stringify(cadeia.slice(0, 100), null, 2));
  if (cadeia.length > 100) console.log(`... +${cadeia.length - 100} linhas`);

  // 5) Comparar com critério programação (só padrao=1)
  section('5) VM critério PROGRAMAÇÃO (só padrao=1, sem ativo/discriminador)');
  const [vmProg] = await pool.query(`
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
        ON lm.idProduto = ip.idProduto AND lm.padrao = 1
        AND (
          lm.descricao LIKE 'Lista%Produ__o'
          OR lm.descricao LIKE 'Lista%Precifica__o'
          OR lm.descricao LIKE 'Lista%Parci%'
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
        ON lm.idProduto = e.idComponente AND lm.padrao = 1
        AND (
          lm.descricao LIKE 'Lista%Produ__o'
          OR lm.descricao LIKE 'Lista%Precifica__o'
          OR lm.descricao LIKE 'Lista%Parci%'
        )
      INNER JOIN produtoqtde pq ON pq.idListaMateriais = lm.id
    )
    SELECT
      p.nome,
      p.id AS idProduto,
      ROUND(SUM(e.media_mensal), 2) AS VM_prog
    FROM explosao_venda e
    INNER JOIN produto p ON p.id = e.idComponente
    WHERE e.idComponente IN (${idList})
    GROUP BY p.id, p.nome
  `);
  console.log(JSON.stringify(vmProg, null, 2));

  // Resumo listas sem filtro de descrição (para ver se lista tem outro nome)
  section('6) Resumo status das listas (sem filtro descrição)');
  const [resumoListas] = await pool.query(`
    SELECT
      p.nome AS componente,
      lm.padrao,
      lm.ativo,
      lm.discriminador,
      CASE
        WHEN lm.descricao LIKE 'Lista%Produ__o' THEN 'Producao'
        WHEN lm.descricao LIKE 'Lista%Precifica__o' THEN 'Precificacao'
        WHEN lm.descricao LIKE 'Lista%Parci%' THEN 'Parcial'
        ELSE 'OUTRO'
      END AS tipo_lista,
      COUNT(*) AS qtd_ocorrencias,
      COUNT(DISTINCT lm.idProduto) AS qtd_pais
    FROM produtoqtde pq
    INNER JOIN listamateriais lm ON lm.id = pq.idListaMateriais
    INNER JOIN produto p ON p.id = pq.idProdutoComponente
    WHERE pq.idProdutoComponente IN (${idList})
    GROUP BY p.nome, lm.padrao, lm.ativo, lm.discriminador, tipo_lista
    ORDER BY p.nome, lm.ativo DESC, lm.padrao DESC
  `);
  console.log(JSON.stringify(resumoListas, null, 2));

  section('VEREDITO RÁPIDO');
  console.log({
    produtos: byCod,
    vmRessup: vmRows,
    vmProg,
    bomValidadas: bomVal.length,
    paisComVendaDireta: vendasPai.length,
    ancestraisComVenda: comVenda.length,
    somaContribuicaoVm: comVenda.reduce((a, r) => a + Number(r.contribuicao_vm || 0), 0),
  });

  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
