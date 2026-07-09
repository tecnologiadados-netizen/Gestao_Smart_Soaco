/**
 * Pendências compras — prioridade fixa manual (SQLite local, por comprador).
 */

import { prisma } from '../config/prisma.js';

export type PendenciasComprasPrioridadeFixaRow = {
  idProduto: number;
  prioridade: number;
};

export type PendenciasComprasPrioridadeFixaHistoricoRow = {
  id: number;
  prioridadeAnterior: number | null;
  prioridadeNova: number | null;
  usuarioLogin: string;
  criadoEm: string;
};

export async function listarPrioridadesFixasPorComprador(
  comprador: string
): Promise<PendenciasComprasPrioridadeFixaRow[]> {
  const rows = await prisma.pendenciasComprasPrioridadeFixa.findMany({
    where: { comprador },
    select: { idProduto: true, prioridade: true },
  });
  return rows.map((r) => ({
    idProduto: r.idProduto,
    prioridade: r.prioridade,
  }));
}

async function registrarHistoricoPrioridadeFixa(input: {
  comprador: string;
  idProduto: number;
  prioridadeAnterior: number | null;
  prioridadeNova: number | null;
  usuarioLogin: string;
}): Promise<void> {
  if (input.prioridadeAnterior === input.prioridadeNova) return;
  await prisma.pendenciasComprasPrioridadeFixaHistorico.create({
    data: {
      comprador: input.comprador,
      idProduto: input.idProduto,
      prioridadeAnterior: input.prioridadeAnterior,
      prioridadeNova: input.prioridadeNova,
      usuarioLogin: input.usuarioLogin,
    },
  });
}

export async function upsertPrioridadeFixa(input: {
  comprador: string;
  idProduto: number;
  prioridade: number;
  usuarioLogin: string;
}): Promise<void> {
  const existente = await prisma.pendenciasComprasPrioridadeFixa.findUnique({
    where: {
      comprador_idProduto: {
        comprador: input.comprador,
        idProduto: input.idProduto,
      },
    },
    select: { prioridade: true },
  });

  const prioridadeAnterior = existente?.prioridade ?? null;

  await prisma.pendenciasComprasPrioridadeFixa.upsert({
    where: {
      comprador_idProduto: {
        comprador: input.comprador,
        idProduto: input.idProduto,
      },
    },
    update: { prioridade: input.prioridade },
    create: {
      comprador: input.comprador,
      idProduto: input.idProduto,
      prioridade: input.prioridade,
    },
  });

  await registrarHistoricoPrioridadeFixa({
    comprador: input.comprador,
    idProduto: input.idProduto,
    prioridadeAnterior,
    prioridadeNova: input.prioridade,
    usuarioLogin: input.usuarioLogin,
  });
}

export async function removerPrioridadeFixa(input: {
  comprador: string;
  idProduto: number;
  usuarioLogin: string;
}): Promise<void> {
  const existente = await prisma.pendenciasComprasPrioridadeFixa.findUnique({
    where: {
      comprador_idProduto: {
        comprador: input.comprador,
        idProduto: input.idProduto,
      },
    },
    select: { prioridade: true },
  });

  if (!existente) return;

  await prisma.pendenciasComprasPrioridadeFixa.delete({
    where: {
      comprador_idProduto: {
        comprador: input.comprador,
        idProduto: input.idProduto,
      },
    },
  });

  await registrarHistoricoPrioridadeFixa({
    comprador: input.comprador,
    idProduto: input.idProduto,
    prioridadeAnterior: existente.prioridade,
    prioridadeNova: null,
    usuarioLogin: input.usuarioLogin,
  });
}

export async function listarHistoricoPrioridadeFixa(
  comprador: string,
  idProduto: number
): Promise<PendenciasComprasPrioridadeFixaHistoricoRow[]> {
  const rows = await prisma.pendenciasComprasPrioridadeFixaHistorico.findMany({
    where: { comprador, idProduto },
    orderBy: { criadoEm: 'desc' },
    select: {
      id: true,
      prioridadeAnterior: true,
      prioridadeNova: true,
      usuarioLogin: true,
      criadoEm: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    prioridadeAnterior: r.prioridadeAnterior,
    prioridadeNova: r.prioridadeNova,
    usuarioLogin: r.usuarioLogin,
    criadoEm: r.criadoEm.toISOString(),
  }));
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
