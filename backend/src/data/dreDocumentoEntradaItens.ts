/**
 * Itens da nota / documento de entrada ligados a um lançamento da DRE.
 * Nomus: agendamentofinanceiro.idDocumentoEntrada.
 * Shop9: Financeiro_Contas.Codigo_Sequencia → movimento com produtos.
 */
import type { DfcAgendamentoDetalheRow } from './dfcAgendamentoRepository.js';
import { getNomusPool, isNomusEnabled } from '../config/nomusDb.js';
import { getShop9Pool, isShop9Enabled } from '../config/shop9Db.js';

export type DreDocumentoEntradaItem = {
  id: number;
  produto: string | null;
  grupo: string | null;
  qtde: number | null;
  valorTotal: number | null;
};

function idsSql(ids: number[]): string {
  return [...new Set(ids.map((n) => Math.trunc(n)).filter((n) => n > 0))].join(', ');
}

function texto(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function marcarNomusComItensDocumento(detalhes: DfcAgendamentoDetalheRow[]): Promise<void> {
  const ids = idsSql(detalhes.filter((d) => d.tipoRef === 'A' && d.origem !== 'Shop9').map((d) => d.id));
  if (!ids || !isNomusEnabled()) return;
  const pool = getNomusPool();
  if (!pool) return;
  const [raw] = await pool.query(`
    SELECT af.id AS id
    FROM agendamentofinanceiro af
    INNER JOIN itemdocumentoestoque ide ON ide.idDocumentoEstoque = af.idDocumentoEntrada
    WHERE af.idDocumentoEntrada IS NOT NULL
      AND af.id IN (${ids})
    GROUP BY af.id
  `);
  const com = new Set(
    (Array.isArray(raw) ? raw : []).map((r) => Math.trunc(Number((r as { id: unknown }).id))),
  );
  for (const d of detalhes) {
    if (d.tipoRef === 'A' && d.origem !== 'Shop9' && com.has(d.id)) d.temItensDocumento = true;
  }
}

export async function marcarShop9ComItensDocumento(detalhes: DfcAgendamentoDetalheRow[]): Promise<void> {
  const ids = idsSql(detalhes.filter((d) => d.origem === 'Shop9').map((d) => d.id));
  if (!ids || !isShop9Enabled()) return;
  const pool = await getShop9Pool();
  if (!pool) return;
  const result = await pool.query(`
    SELECT DISTINCT fc.Ordem AS ordem
    FROM Financeiro_Contas fc
    INNER JOIN Movimento m
      ON m.Sequencia = fc.Codigo_Sequencia
     AND ISNULL(fc.Codigo_Sequencia, 0) <> 0
     AND fc.Ordem_Filial = m.Ordem_Filial
    INNER JOIN Movimento_Prod_Serv mps ON mps.Ordem_Movimento = m.Ordem
    WHERE fc.Ordem IN (${ids})
  `);
  const list = (Array.isArray(result.recordset) ? result.recordset : []) as { ordem?: unknown }[];
  const com = new Set(list.map((r) => Math.trunc(Number(r.ordem))));
  for (const d of detalhes) {
    if (d.origem === 'Shop9' && com.has(d.id)) d.temItensDocumento = true;
  }
}

export async function queryDreNomusDocumentoItens(
  idAgendamento: number,
): Promise<{ itens: DreDocumentoEntradaItem[]; nota: string | null; erro?: string }> {
  if (!isNomusEnabled()) return { itens: [], nota: null, erro: 'Nomus indisponível' };
  const pool = getNomusPool();
  if (!pool) return { itens: [], nota: null, erro: 'Nomus indisponível' };
  const id = Math.trunc(idAgendamento);
  if (!(id > 0)) return { itens: [], nota: null };
  try {
    const [raw] = await pool.query(`
      SELECT
        ide.id AS idItem,
        COALESCE(pd.descricao, pd.nome, ide.nomeItem, ide.xProdXml) AS produto,
        COALESCE(gp.nome, 'Outros') AS grupoProduto,
        ide.qtde AS qtde,
        ide.valorTotal AS valorTotal,
        (
          SELECT nfe.numero
          FROM nfe
          WHERE nfe.idDocumentoEstoque = de.id
          ORDER BY nfe.id DESC
          LIMIT 1
        ) AS numeroNfe,
        de.numeroDocumentoFiscal AS numeroDocumento
      FROM agendamentofinanceiro af
      INNER JOIN documentoestoque de ON de.id = af.idDocumentoEntrada
      INNER JOIN itemdocumentoestoque ide ON ide.idDocumentoEstoque = de.id
      LEFT JOIN produto pd ON pd.id = ide.idProduto
      LEFT JOIN grupoproduto gp ON gp.id = pd.idGrupoProduto
      WHERE af.id = ${id}
        AND af.idDocumentoEntrada IS NOT NULL
      ORDER BY ide.valorTotal DESC, ide.id
    `);
    const rows = Array.isArray(raw) ? raw : [];
    const itens: DreDocumentoEntradaItem[] = rows.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: Math.trunc(Number(row.idItem)) || 0,
        produto: texto(row.produto),
        grupo: texto(row.grupoProduto),
        qtde: num(row.qtde),
        valorTotal: num(row.valorTotal),
      };
    });
    const primeiro = rows[0] as Record<string, unknown> | undefined;
    const nota = primeiro ? texto(primeiro.numeroNfe) || texto(primeiro.numeroDocumento) : null;
    return { itens, nota };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { itens: [], nota: null, erro: msg };
  }
}

export async function queryDreShop9DocumentoItens(
  ordemFinanceira: number,
): Promise<{ itens: DreDocumentoEntradaItem[]; nota: string | null; erro?: string }> {
  if (!isShop9Enabled()) return { itens: [], nota: null, erro: 'Shop9 indisponível' };
  const pool = await getShop9Pool();
  if (!pool) return { itens: [], nota: null, erro: 'Shop9 indisponível' };
  const id = Math.trunc(ordemFinanceira);
  if (!(id > 0)) return { itens: [], nota: null };
  try {
    const result = await pool.query(`
      SELECT
        ROW_NUMBER() OVER (ORDER BY ps.Nome, mps.Ordem_Prod_Serv) AS idItem,
        ps.Nome AS produto,
        mps.Quantidade AS qtde,
        COALESCE(mps.Preco_Total_Com_Desconto, mps.Preco_Total_Sem_Desconto) AS valorTotal
      FROM Financeiro_Contas fc
      INNER JOIN Movimento m
        ON m.Sequencia = fc.Codigo_Sequencia
       AND ISNULL(fc.Codigo_Sequencia, 0) <> 0
       AND fc.Ordem_Filial = m.Ordem_Filial
      INNER JOIN Movimento_Prod_Serv mps ON mps.Ordem_Movimento = m.Ordem
      LEFT JOIN Prod_Serv ps ON ps.Ordem = mps.Ordem_Prod_Serv
      WHERE fc.Ordem = ${id}
      ORDER BY COALESCE(mps.Preco_Total_Com_Desconto, mps.Preco_Total_Sem_Desconto) DESC, ps.Nome
    `);
    const rows = (Array.isArray(result.recordset) ? result.recordset : []) as Record<string, unknown>[];
    const itens: DreDocumentoEntradaItem[] = rows.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: Math.trunc(Number(row.idItem)) || 0,
        produto: texto(row.produto),
        grupo: null,
        qtde: num(row.qtde),
        valorTotal: num(row.valorTotal),
      };
    });
    return { itens, nota: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { itens: [], nota: null, erro: msg };
  }
}
