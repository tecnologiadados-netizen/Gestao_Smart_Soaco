/**
 * Grava a primeira vez que o Double Check lê uma NF vinculada divergente do pedido.
 * O retrato permanece se o conferente desfizer o vínculo.
 */
import { prisma } from '../config/prisma.js';
import { getNomusPool, isNomusEnabled, nomusQueryWithRetry } from '../config/nomusDb.js';
import type { DoubleCheckInComparativoLinha } from './doubleCheckInRepository.js';
import { classificarNaturezaDivergencia } from '../services/doubleCheckInNatureza.js';
import { SEM_COMPRADOR } from './gestaoEntradasComprador.js';

const CAMPOS_LINHA = [
  { campo: 'valor_unitario' as const, flag: 'divergValorUnitario' as const },
  { campo: 'qtde' as const, flag: 'divergQtde' as const },
  { campo: 'ipi' as const, flag: 'divergIpi' as const },
  { campo: 'condicao_pagamento' as const, flag: 'divergCondicaoPagamento' as const },
];

export type CompradorItemPedido = {
  idPedidoCompra: number;
  nomePedidoCompra: string;
  nomeComprador: string;
};

function chaveSnapshot(item: {
  idDocumentoEstoque: number;
  idItemDocumentoEstoque: number;
  idItemPedidoCompra: number;
  campo: string;
}): string {
  return `${item.idDocumentoEstoque}:${item.idItemDocumentoEstoque}:${item.idItemPedidoCompra}:${item.campo}`;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Comprador da cotação que originou o item do pedido. */
export async function buscarCompradorPorItemPedido(
  idsItemPedido: number[]
): Promise<Map<number, CompradorItemPedido>> {
  const map = new Map<number, CompradorItemPedido>();
  const ids = [...new Set(idsItemPedido.filter((id) => Number.isFinite(id) && id > 0))];
  if (ids.length === 0 || !isNomusEnabled()) return map;
  const pool = getNomusPool();
  if (!pool) return map;

  for (const parte of chunk(ids, 400)) {
    const ph = parte.map(() => '?').join(', ');
    const sql = `
SELECT
  ipc.id AS idItemPedidoCompra,
  pc.id AS idPedidoCompra,
  pc.nome AS nomePedidoCompra,
  COALESCE(
    NULLIF(TRIM(u.nome), ''),
    NULLIF(TRIM(f.nome), ''),
    NULLIF(TRIM(p.nome), ''),
    (
      SELECT COALESCE(NULLIF(TRIM(uc.nome), ''), NULLIF(TRIM(fc.nome), ''), NULLIF(TRIM(pcot.nome), ''))
      FROM solicitacaocompraitempedidocompra scipc
      JOIN solicitacaocompra_itemcotacaocompra scicc
        ON scicc.idSolicitacaoCompra = scipc.idSolicitacaoCompra
      JOIN itemcotacaocompra icc ON icc.id = scicc.idItemCotacaoCompra
      JOIN cotacaocompra c ON c.id = icc.idCotacaoCompra
      LEFT JOIN usuario uc ON uc.id = c.idComprador
      LEFT JOIN funcionario fc ON fc.id = uc.idFuncionario
      LEFT JOIN pessoa pcot ON pcot.id = c.idComprador
      WHERE scipc.idItemPedidoCompra = ipc.id
        AND COALESCE(NULLIF(TRIM(uc.nome), ''), NULLIF(TRIM(fc.nome), ''), NULLIF(TRIM(pcot.nome), '')) IS NOT NULL
      ORDER BY c.id
      LIMIT 1
    )
  ) AS nomeComprador
FROM itempedidocompra ipc
JOIN pedidocompra pc ON pc.id = ipc.idPedidoCompra
LEFT JOIN usuario u ON u.id = pc.idComprador
LEFT JOIN funcionario f ON f.id = u.idFuncionario
LEFT JOIN pessoa p ON p.id = pc.idComprador
WHERE ipc.id IN (${ph})
`.trim();
    const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, sql, parte);
    for (const row of Array.isArray(rows) ? rows : []) {
      const idItem = Number(row.idItemPedidoCompra);
      const idPedido = Number(row.idPedidoCompra);
      if (!Number.isFinite(idItem) || idItem <= 0 || !Number.isFinite(idPedido) || idPedido <= 0) continue;
      const nomePedido = String(row.nomePedidoCompra ?? '').trim();
      const nomeComprador = String(row.nomeComprador ?? '').trim();
      map.set(idItem, {
        idPedidoCompra: Math.trunc(idPedido),
        nomePedidoCompra: nomePedido || `PC ${Math.trunc(idPedido)}`,
        nomeComprador: nomeComprador || SEM_COMPRADOR,
      });
    }
  }
  return map;
}

/**
 * Insere só o que ainda não foi apontado. Falha de gravação não interrompe a consulta.
 */
export async function registrarDivergenciasApontadas(
  linhasPorDocumento: Map<number, DoubleCheckInComparativoLinha[]>
): Promise<void> {
  try {
    type Candidato = {
      idDocumentoEstoque: number;
      idItemDocumentoEstoque: number;
      idItemPedidoCompra: number;
      idPedidoCompra: number;
      nomePedidoCompra: string;
      campo: string;
      natureza: string;
    };
    const porChave = new Map<string, Candidato>();
    for (const [idDocumento, linhas] of linhasPorDocumento) {
      if (!Number.isFinite(idDocumento) || idDocumento <= 0) continue;
      for (const linha of linhas) {
        if (linha.idPedidoCompra == null || linha.idPedidoCompra <= 0) continue;
        if (linha.idItemPedidoCompra <= 0 || linha.idItemDocumentoEstoque <= 0) continue;
        for (const spec of CAMPOS_LINHA) {
          if (!linha[spec.flag]) continue;
          const candidato: Candidato = {
            idDocumentoEstoque: idDocumento,
            idItemDocumentoEstoque: linha.idItemDocumentoEstoque,
            idItemPedidoCompra: linha.idItemPedidoCompra,
            idPedidoCompra: linha.idPedidoCompra,
            nomePedidoCompra: linha.nomePedidoCompra?.trim() || `PC ${linha.idPedidoCompra}`,
            campo: spec.campo,
            natureza: classificarNaturezaDivergencia({ linha, campo: spec.campo }),
          };
          porChave.set(chaveSnapshot(candidato), candidato);
        }
      }
    }
    const candidatos = [...porChave.values()];
    if (candidatos.length === 0) return;

    const idsDoc = [...new Set(candidatos.map((item) => item.idDocumentoEstoque))];
    const existentes = new Set<string>();
    for (const parte of chunk(idsDoc, 800)) {
      const rows = await prisma.doubleCheckInDivergenciaApontada.findMany({
        where: { idDocumentoEstoque: { in: parte } },
        select: {
          idDocumentoEstoque: true,
          idItemDocumentoEstoque: true,
          idItemPedidoCompra: true,
          campo: true,
        },
      });
      for (const row of rows) existentes.add(chaveSnapshot(row));
    }
    const novos = candidatos.filter((item) => !existentes.has(chaveSnapshot(item)));
    if (novos.length === 0) return;

    let compradores = new Map<number, CompradorItemPedido>();
    try {
      compradores = await buscarCompradorPorItemPedido(novos.map((item) => item.idItemPedidoCompra));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[divergenciaApontada] comprador:', msg);
    }

    await prisma.doubleCheckInDivergenciaApontada.createMany({
      data: novos.map((item) => {
        const comprador = compradores.get(item.idItemPedidoCompra);
        return {
          idDocumentoEstoque: item.idDocumentoEstoque,
          idItemDocumentoEstoque: item.idItemDocumentoEstoque,
          idItemPedidoCompra: item.idItemPedidoCompra,
          idPedidoCompra: comprador?.idPedidoCompra ?? item.idPedidoCompra,
          nomePedidoCompra: comprador?.nomePedidoCompra || item.nomePedidoCompra,
          nomeComprador: comprador?.nomeComprador ?? SEM_COMPRADOR,
          campo: item.campo,
          natureza: item.natureza,
        };
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[divergenciaApontada] registrar:', msg);
  }
}
