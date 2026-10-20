import type { RowDataPacket } from 'mysql2';
import { getNomusPool, isNomusEnabled } from '../../config/nomusDb.js';
import { classificarSetor, qtdePendenteReal, type SetorGondola } from './regras.js';

export type ItemCarteiraGondola = {
  idItem: number;
  pedido: string;
  cliente: string;
  codigo: string;
  descricao: string;
  setor: SetorGondola;
  dataEntrega: string;
  status: string;
  qtdePedida: number;
  qtdeAtendida: number;
  pendente: number;
  qtdeRomaneada: number;
  qtdePendenteReal: number;
  observacoes: string;
};

const ROTAS_FORA_DA_CARTEIRA = [
  '2-Retirada na So Moveis',
  '1-Retirada na So Aço',
  '3-Entrega em Grande Teresina',
  '5-Requisicao',
];

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

function numero(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function dataIso(valor: unknown): string {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    const ano = valor.getFullYear();
    const mes = String(valor.getMonth() + 1).padStart(2, '0');
    const dia = String(valor.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }
  const texto = String(valor ?? '').trim();
  return texto.length >= 10 ? texto.slice(0, 10) : texto;
}

function nomeStatus(status: number): string {
  if (status === 2) return 'Liberado';
  if (status === 3) return 'Atendido parcialmente';
  return String(status);
}

const SQL_ITENS = `
  SELECT
    ip.id AS idItem,
    TRIM(pd.nome) AS pedido,
    TRIM(pe.nome) AS cliente,
    TRIM(p.nome) AS codigo,
    TRIM(p.descricao) AS descricao,
    TRIM(sp.opcao) AS setor,
    ip.dataEntrega AS dataEntrega,
    ip.status AS statusItem,
    ip.qtde AS qtdePedida,
    IFNULL(ip.qtdeAtendida, 0) AS qtdeAtendida,
    (ip.qtde - IFNULL(ip.qtdeAtendida, 0)) + IFNULL(devol.qtdDevolvida, 0) AS pendente,
    IFNULL(prm.qtdeVinculada, 0) AS qtdeRomaneada,
    CASE
      WHEN (obs.observacoes IS NULL AND me.opcao = 'Retirada na Só Móveis') THEN '2-Retirada na So Moveis'
      WHEN (obs.observacoes IS NULL AND me.opcao = 'Retirada na Só Aço') THEN '1-Retirada na So Aço'
      WHEN (obs.observacoes IS NULL AND IFNULL(m.nome, mc.nome) = 'Teresina' AND aloreq.opcao = 'Sim') THEN '5-Requisicao'
      WHEN (obs.observacoes IS NULL AND IFNULL(m.nome, mc.nome) IN ('Timon', 'Teresina', 'Nazaria', 'Demerval Lobão', 'Curralinhos') AND aloreq.opcao = 'Não') THEN '3-Entrega em Grande Teresina'
      WHEN obs.observacoes IS NULL THEN '4-Inserir em Romaneio'
      ELSE obs.observacoes
    END AS observacoes
  FROM itempedido ip
  INNER JOIN pedido pd ON pd.id = ip.idPedido
  INNER JOIN produto p ON p.id = ip.idProduto
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
  LEFT JOIN (
    SELECT apv.idProduto, alo.opcao
    FROM atributoprodutovalor apv
    LEFT JOIN atributolistaopcao alo ON alo.id = apv.idListaOpcao
    WHERE apv.idAtributo = 679
  ) sp ON sp.idProduto = p.id
  LEFT JOIN (
    SELECT ipr.idItemPedido, SUM(COALESCE(ipr.qtdeVinculada, 0)) AS qtdeVinculada
    FROM itempedidoromaneio ipr
    GROUP BY ipr.idItemPedido
  ) prm ON prm.idItemPedido = ip.id
  LEFT JOIN (
    SELECT
      ipr.idItemPedido,
      SUBSTRING_INDEX(GROUP_CONCAT(de.observacoes ORDER BY de.id DESC SEPARATOR '|||'), '|||', 1) AS observacoes
    FROM itempedidoromaneio ipr
    INNER JOIN documentoestoque de ON de.id = ipr.idRomaneio
    WHERE de.observacoes IS NOT NULL AND TRIM(de.observacoes) <> ''
    GROUP BY ipr.idItemPedido
  ) obs ON obs.idItemPedido = ip.id
  WHERE ip.status IN (2, 3)
    AND pd.idEmpresa IN (1, 2)
    AND (
      sp.opcao LIKE '%gondol%'
      OR (sp.opcao LIKE '%porta%' AND sp.opcao LIKE '%palet%')
    )
    ${filtroEmpresa2()}
  ORDER BY pd.nome ASC, p.nome ASC, ip.id ASC
`;

function mapear(row: RowDataPacket): ItemCarteiraGondola | null {
  const setor = classificarSetor(String(row.setor ?? ''));
  if (!setor) return null;
  const observacoes = String(row.observacoes ?? '').trim();
  if (observacoes === '5-Requisicao') return null;
  const pendente = numero(row.pendente);
  const qtdeRomaneada = numero(row.qtdeRomaneada);
  const statusItem = numero(row.statusItem);
  return {
    idItem: numero(row.idItem),
    pedido: String(row.pedido ?? '').trim(),
    cliente: String(row.cliente ?? '').trim(),
    codigo: String(row.codigo ?? '').trim(),
    descricao: String(row.descricao ?? '').trim(),
    setor,
    dataEntrega: dataIso(row.dataEntrega),
    status: nomeStatus(statusItem),
    qtdePedida: numero(row.qtdePedida),
    qtdeAtendida: numero(row.qtdeAtendida),
    pendente,
    qtdeRomaneada,
    qtdePendenteReal: qtdePendenteReal(observacoes, pendente, qtdeRomaneada),
    observacoes,
  };
}

async function consultar(idItem?: number): Promise<{
  disponivel: boolean;
  itens: ItemCarteiraGondola[];
  erro?: string;
}> {
  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) {
    return { disponivel: false, itens: [], erro: 'NOMUS indisponível' };
  }
  const rotas = [...ROTAS_FORA_DA_CARTEIRA, ...ROTAS_FORA_DA_CARTEIRA];
  const sql = idItem ? SQL_ITENS.replace('ORDER BY pd.nome', 'AND ip.id = ?\n  ORDER BY pd.nome') : SQL_ITENS;
  const params = idItem ? [...rotas, idItem] : rotas;
  try {
    const [rows] = await pool.query<RowDataPacket[]>(sql, params);
    const itens = rows.map(mapear).filter((item): item is ItemCarteiraGondola => item != null && item.idItem > 0);
    return { disponivel: true, itens };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[gondolas] carteira:', msg);
    return { disponivel: false, itens: [], erro: msg };
  }
}

export function listarItensCarteira() {
  return consultar();
}

export async function buscarItemCarteira(idItem: number): Promise<{
  disponivel: boolean;
  item: ItemCarteiraGondola | null;
  erro?: string;
}> {
  const lista = await consultar(idItem);
  if (!lista.disponivel) return { disponivel: false, item: null, erro: lista.erro };
  return { disponivel: true, item: lista.itens[0] ?? null };
}
