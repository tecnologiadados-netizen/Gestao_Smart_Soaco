import { queryNomus } from '../config/nomusDb.js';
import { prisma } from '../config/prisma.js';

type Row = Record<string, unknown>;

function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const s = String(v ?? '').trim();
  if (!s) return 0;
  if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.')) || 0;
  return Number(s) || 0;
}

/**
 * Último saldo do produto no setor de saída da empresa.
 * Mesma origem da consulta de estoque (`saldoestoque_produto`), sem fixar a empresa 1.
 */
export async function saldoProdutoEmpresa(
  idProduto: number,
  idEmpresa: number,
  idSetor: number,
): Promise<{ saldo: number; vinculado: boolean }> {
  const [vincRows] = await queryNomus<Row[]>(
    `SELECT 1 AS ok
     FROM produtoempresa pe
     INNER JOIN produtoempresa_setorestoque pese ON pese.idProdutoEmpresa = pe.id
     WHERE pe.idProduto = ? AND pe.idEmpresa = ? AND pese.idSetorEstoque = ?
     LIMIT 1`,
    [idProduto, idEmpresa, idSetor],
  );
  const vinculado = Array.isArray(vincRows) && vincRows.length > 0;
  if (!vinculado) return { saldo: 0, vinculado: false };

  const [saldoRows] = await queryNomus<Row[]>(
    `SELECT CASE WHEN sep.saldoSetorFinal <= 0 THEN 0 ELSE sep.saldoSetorFinal END AS saldo
     FROM saldoestoque_produto sep
     INNER JOIN setorestoque se ON se.id = sep.idSetorEstoque
     WHERE sep.idProduto = ? AND se.idEmpresa = ? AND se.id = ?
     ORDER BY sep.dataMovimentacao DESC, sep.id DESC
     LIMIT 1`,
    [idProduto, idEmpresa, idSetor],
  );
  const saldo = Array.isArray(saldoRows) && saldoRows[0] ? num(saldoRows[0].saldo) : 0;
  return { saldo: Math.max(0, saldo), vinculado: true };
}

/** Quantidade já reservada em vendas abertas ou em espera da mesma empresa. */
export async function quantidadeReservada(
  idEmpresa: number,
  idProduto: number,
  ignorarVendaId?: number,
): Promise<number> {
  const agg = await prisma.pdvVendaItem.aggregate({
    _sum: { quantidade: true },
    where: {
      idProduto,
      venda: {
        idEmpresa,
        status: { in: ['aberta', 'espera'] },
        ...(ignorarVendaId ? { id: { not: ignorarVendaId } } : {}),
      },
    },
  });
  return agg._sum.quantidade ?? 0;
}

export async function saldoDisponivel(
  idProduto: number,
  idEmpresa: number,
  idSetor: number,
  ignorarVendaId?: number,
): Promise<{ saldo: number; vinculado: boolean; disponivel: number }> {
  const base = await saldoProdutoEmpresa(idProduto, idEmpresa, idSetor);
  const reservado = await quantidadeReservada(idEmpresa, idProduto, ignorarVendaId);
  return { ...base, disponivel: Math.max(0, base.saldo - reservado) };
}

export async function lerTributacaoPedido(idPedido: number): Promise<Map<number, number>> {
  const [rows] = await queryNomus<Row[]>(
    `SELECT ip.idProduto AS idProduto, IFNULL(t.aliquotaIPI, 0) AS aliquotaIPI
     FROM itempedido ip
     LEFT JOIN tributacao t ON t.idItemPedido = ip.id
     WHERE ip.idPedido = ?`,
    [idPedido],
  );
  const mapa = new Map<number, number>();
  for (const row of Array.isArray(rows) ? rows : []) {
    mapa.set(Number(row.idProduto), num(row.aliquotaIPI));
  }
  return mapa;
}
