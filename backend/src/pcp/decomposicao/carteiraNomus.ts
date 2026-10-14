import type { RowDataPacket } from 'mysql2';
import { getNomusPool, isNomusEnabled } from '../../config/nomusDb.js';
import { termoParaPadraoLikeSql } from '../../utils/textoLivreBusca.js';

export type VendaCarteira = {
  qtdePedida: number;
  pendente: number;
};

export type ProdutoNomusBusca = {
  codigo: string;
  descricao: string;
};

export type MateriaPrimaPp = {
  codigoFilho: string;
  codigo: string;
  descricao: string;
};

const ROTAS_FORA_DA_CARTEIRA = [
  '2-Retirada na So Moveis',
  '1-Retirada na So Aço',
  '3-Entrega em Grande Teresina',
  '5-Requisicao',
];

function chaveCodigo(codigo: string): string {
  return codigo.trim().toUpperCase();
}

function numero(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Mesma classificação do Gerenciador quando o item ainda não tem observação de romaneio.
 * Itens da empresa 2 nessas rotas locais não entram na carteira.
 */
const SQL_CATEGORIA_SEM_ROMANEIO = `
  CASE
    WHEN me.opcao = 'Retirada na Só Móveis' THEN '2-Retirada na So Moveis'
    WHEN me.opcao = 'Retirada na Só Aço' THEN '1-Retirada na So Aço'
    WHEN IFNULL(m.nome, mc.nome) = 'Teresina' AND aloreq.opcao = 'Sim' THEN '5-Requisicao'
    WHEN IFNULL(m.nome, mc.nome) IN ('Timon', 'Teresina', 'Nazaria', 'Demerval Lobão', 'Curralinhos')
      AND aloreq.opcao = 'Não' THEN '3-Entrega em Grande Teresina'
    ELSE '4-Inserir em Romaneio'
  END
`;

const SQL_JOINS_CATEGORIA = `
  LEFT JOIN pessoa pe ON pe.id = pd.idCliente
  LEFT JOIN endereco ed ON ed.id = pd.idEnderecoLocalEntrega
  LEFT JOIN municipio m ON m.id = ed.idMunicipio
  LEFT JOIN municipio mc ON mc.id = pe.idMunicipio
  LEFT JOIN (
    SELECT apv.idPedido, alo.opcao
    FROM atributopedidovalor apv
    LEFT JOIN atributolistaopcao alo ON alo.id = apv.idListaOpcao
    WHERE apv.idAtributo = 591
  ) me ON me.idPedido = pd.id
  LEFT JOIN (
    SELECT pd2.id, aloreq.opcao
    FROM pedido pd2
    LEFT JOIN atributopedidovalor apvreq ON apvreq.idPedido = pd2.id
    LEFT JOIN atributolistaopcao aloreq ON aloreq.id = apvreq.idListaOpcao
    WHERE apvreq.idAtributo = 313
  ) aloreq ON aloreq.id = pd.id
  LEFT JOIN (
    SELECT ipd.id AS idPedidoVenda, SUM(COALESCE(ide.qtde, 0)) AS qtdDevolvida
    FROM itemdocumentoestoque ide
    LEFT JOIN itemdocumentoestoque_itempedidovenda ideipv
      ON ideipv.idItemDocumentoEstoque = ide.idItemOrigemDevolucao
    LEFT JOIN itempedido ipd ON ipd.id = ideipv.idItemPedidoVenda
    LEFT JOIN tipomovimentacao tm ON ide.idTipoMovimentacao = tm.id
    WHERE tm.id IN (52, 55)
      AND ide.idItemOrigemDevolucao IS NOT NULL
      AND ipd.status IN (2, 3)
    GROUP BY ipd.id
  ) devol ON devol.idPedidoVenda = ip.id
`;

function filtroEmpresa2(): string {
  const lista = ROTAS_FORA_DA_CARTEIRA.map(() => '?').join(', ');
  return `
    AND (
      pd.idEmpresa <> 2
      OR EXISTS (
        SELECT 1
        FROM itempedidoromaneio ipr
        INNER JOIN documentoestoque de ON de.id = ipr.idRomaneio
        WHERE ipr.idItemPedido = ip.id
          AND de.observacoes IS NOT NULL
          AND TRIM(de.observacoes) <> ''
          AND de.observacoes NOT IN (${lista})
      )
      OR (
        NOT EXISTS (
          SELECT 1
          FROM itempedidoromaneio ipr
          INNER JOIN documentoestoque de ON de.id = ipr.idRomaneio
          WHERE ipr.idItemPedido = ip.id
            AND de.observacoes IS NOT NULL
            AND TRIM(de.observacoes) <> ''
        )
        AND ${SQL_CATEGORIA_SEM_ROMANEIO} NOT IN (${lista})
      )
    )
  `;
}

export async function somarCarteiraPorCodigo(
  codigos: string[]
): Promise<{ disponivel: boolean; vendas: Map<string, VendaCarteira>; erro?: string }> {
  const unicos = [...new Set(codigos.map((c) => c.trim()).filter(Boolean))];
  if (unicos.length === 0) return { disponivel: true, vendas: new Map() };

  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) {
    return { disponivel: false, vendas: new Map(), erro: 'NOMUS indisponível' };
  }

  const marcas = unicos.map(() => '?').join(', ');
  const rotas = [...ROTAS_FORA_DA_CARTEIRA, ...ROTAS_FORA_DA_CARTEIRA];
  const sql = `
    SELECT
      TRIM(p.nome) AS codigo,
      SUM(ip.qtde) AS qtdePedida,
      SUM((ip.qtde - IFNULL(ip.qtdeAtendida, 0)) + IFNULL(devol.qtdDevolvida, 0)) AS pendente
    FROM itempedido ip
    INNER JOIN pedido pd ON pd.id = ip.idPedido
    INNER JOIN produto p ON p.id = ip.idProduto
    ${SQL_JOINS_CATEGORIA}
    WHERE ip.status IN (2, 3)
      AND pd.idEmpresa IN (1, 2)
      AND TRIM(p.nome) IN (${marcas})
      ${filtroEmpresa2()}
    GROUP BY TRIM(p.nome)
  `;

  try {
    const [rows] = await pool.query<RowDataPacket[]>(sql, [...unicos, ...rotas]);
    const vendas = new Map<string, VendaCarteira>();
    for (const row of rows) {
      const codigo = String(row.codigo ?? '').trim();
      if (!codigo) continue;
      vendas.set(chaveCodigo(codigo), {
        qtdePedida: numero(row.qtdePedida),
        pendente: numero(row.pendente),
      });
    }
    return { disponivel: true, vendas };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[decomposicao] carteira Nomus:', msg);
    return { disponivel: false, vendas: new Map(), erro: msg };
  }
}

export function vendaDoCodigo(vendas: Map<string, VendaCarteira>, codigo: string): VendaCarteira {
  return vendas.get(chaveCodigo(codigo)) ?? { qtdePedida: 0, pendente: 0 };
}

export async function buscarProdutosNomusDecomposicao(
  termo: string
): Promise<{ disponivel: boolean; produtos: ProdutoNomusBusca[]; erro?: string }> {
  const q = termo.trim();
  if (q.length < 2) return { disponivel: true, produtos: [] };

  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) {
    return { disponivel: false, produtos: [], erro: 'NOMUS indisponível' };
  }

  const like = termoParaPadraoLikeSql(q);
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT produto.nome AS codigo, produto.descricao AS descricao
      FROM produto
      WHERE produto.ativo = 1
        AND (produto.nome LIKE ? OR produto.descricao LIKE ?)
      ORDER BY produto.nome ASC
      LIMIT 20
      `,
      [like, like]
    );
    const produtos = rows
      .map((row) => ({
        codigo: String(row.codigo ?? '').trim(),
        descricao: String(row.descricao ?? '').trim(),
      }))
      .filter((p) => p.codigo);
    return { disponivel: true, produtos };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[decomposicao] busca produto Nomus:', msg);
    return { disponivel: false, produtos: [], erro: msg };
  }
}

/**
 * Lista de materiais padrão de cada filho, restrita a Produto em processo (PP).
 * Não inclui matéria-prima comprada nem produto acabado.
 */
export async function listarMateriasPrimasPp(
  codigosFilho: string[]
): Promise<{ disponivel: boolean; materiais: MateriaPrimaPp[]; erro?: string }> {
  const codigos = [...new Set(codigosFilho.map((c) => c.trim()).filter(Boolean))].slice(0, 40);
  if (codigos.length === 0) return { disponivel: true, materiais: [] };

  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) {
    return { disponivel: false, materiais: [], erro: 'NOMUS indisponível' };
  }

  const marcas = codigos.map(() => '?').join(', ');
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT DISTINCT
        pai.nome AS codigoFilho,
        comp.nome AS codigo,
        comp.descricao AS descricao
      FROM produto pai
      INNER JOIN produtoqtde pq ON pq.idProduto = pai.id
      INNER JOIN listamateriais lm ON lm.id = pq.idListaMateriais
      INNER JOIN produto comp ON comp.id = pq.idProdutoComponente
      INNER JOIN tipoproduto tp ON tp.id = comp.idTipoProduto
      WHERE pai.ativo = 1
        AND comp.ativo = 1
        AND tp.nome = 'Produto em processo'
        AND lm.padrao = 1
        AND (
          lm.descricao LIKE 'Lista%Produ__o'
          OR lm.descricao LIKE 'Lista%Precifica__o'
          OR lm.descricao LIKE 'Lista%Parci%'
        )
        AND UPPER(TRIM(pai.nome)) IN (${marcas})
      ORDER BY pai.nome ASC, comp.nome ASC
      `,
      codigos.map((c) => c.toUpperCase())
    );
    const materiais = rows
      .map((row) => ({
        codigoFilho: String(row.codigoFilho ?? '').trim(),
        codigo: String(row.codigo ?? '').trim(),
        descricao: String(row.descricao ?? '').trim(),
      }))
      .filter((item) => item.codigoFilho && item.codigo);
    return { disponivel: true, materiais };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[decomposicao] materias primas PP:', msg);
    return { disponivel: false, materiais: [], erro: msg };
  }
}
