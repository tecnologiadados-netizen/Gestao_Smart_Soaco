/**
 * Pendências compras — prioridade fixa manual (SQLite local, por usuário + comprador).
 */

import { prisma } from '../config/prisma.js';

export type PendenciasComprasPrioridadeFixaRow = {
  idProduto: number;
  prioridade: number;
};

export async function listarPrioridadesFixasPorUsuarioComprador(
  usuario: string,
  comprador: string
): Promise<PendenciasComprasPrioridadeFixaRow[]> {
  const rows = await prisma.pendenciasComprasPrioridadeFixa.findMany({
    where: { usuario, comprador },
    select: { idProduto: true, prioridade: true },
  });
  return rows.map((r) => ({
    idProduto: r.idProduto,
    prioridade: r.prioridade,
  }));
}

export async function upsertPrioridadeFixa(input: {
  usuario: string;
  comprador: string;
  idProduto: number;
  prioridade: number;
}): Promise<void> {
  await prisma.pendenciasComprasPrioridadeFixa.upsert({
    where: {
      usuario_comprador_idProduto: {
        usuario: input.usuario,
        comprador: input.comprador,
        idProduto: input.idProduto,
      },
    },
    update: { prioridade: input.prioridade },
    create: {
      usuario: input.usuario,
      comprador: input.comprador,
      idProduto: input.idProduto,
      prioridade: input.prioridade,
    },
  });
}

export async function removerPrioridadeFixa(input: {
  usuario: string;
  comprador: string;
  idProduto: number;
}): Promise<void> {
  await prisma.pendenciasComprasPrioridadeFixa.deleteMany({
    where: {
      usuario: input.usuario,
      comprador: input.comprador,
      idProduto: input.idProduto,
    },
  });
}

export function prioridadesFixasParaMapa(
  rows: PendenciasComprasPrioridadeFixaRow[]
): Map<number, number> {
  const map = new Map<number, number>();
  for (const r of rows) {
    map.set(r.idProduto, r.prioridade);
  }
  return map;
}
