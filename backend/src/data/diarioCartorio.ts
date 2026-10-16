/**
 * Apontamento "em cartório" do Diário. Casa com o título por origem + código
 * e grava só no SQLite local — Nomus e Shop9 não são alterados.
 */

import { prisma } from '../config/prisma.js';
import type { DiarioContaPagarLinha } from './diarioContasPagarRepository.js';

export const CARTORIO_MAX = 500;

function chave(origem: string, codigo: number): string {
  return `${origem}:${codigo}`;
}

export async function aplicarCartoriosDiario(linhas: DiarioContaPagarLinha[]): Promise<void> {
  if (linhas.length === 0) return;
  try {
    const rows = await prisma.diarioCartorio.findMany({
      select: { origem: true, codigo: true },
    });
    const marcados = new Set(rows.map((r) => chave(r.origem, r.codigo)));
    for (const linha of linhas) {
      linha.emCartorio = marcados.has(chave(linha.origem, linha.codigo));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[diarioCartorio] leitura:', msg);
    for (const linha of linhas) linha.emCartorio = false;
  }
}

export async function aplicarCartorioDiario(input: {
  itens: Array<{ origem: 'Nomus' | 'Shop9'; codigo: number }>;
  emCartorio: boolean;
  usuario: string;
}): Promise<{ atualizados: number; emCartorio: boolean }> {
  const vistos = new Map<string, { origem: 'Nomus' | 'Shop9'; codigo: number }>();
  for (const item of input.itens) {
    if ((item.origem !== 'Nomus' && item.origem !== 'Shop9') || !Number.isInteger(item.codigo) || item.codigo <= 0) {
      continue;
    }
    vistos.set(chave(item.origem, item.codigo), { origem: item.origem, codigo: item.codigo });
  }
  const unicos = [...vistos.values()];
  if (unicos.length === 0) {
    throw new Error('Marque ao menos um título identificado para apontar o cartório.');
  }
  if (unicos.length > CARTORIO_MAX) {
    throw new Error(`Selecione no máximo ${CARTORIO_MAX} títulos por vez.`);
  }
  const agora = new Date();
  const usuario = (input.usuario || '?').slice(0, 80);
  if (input.emCartorio) {
    await prisma.$transaction(
      unicos.map((item) =>
        prisma.diarioCartorio.upsert({
          where: { origem_codigo: { origem: item.origem, codigo: item.codigo } },
          create: { origem: item.origem, codigo: item.codigo, usuario, atualizadoEm: agora },
          update: { usuario, atualizadoEm: agora },
        }),
      ),
    );
  } else {
    await prisma.diarioCartorio.deleteMany({
      where: {
        OR: unicos.map((item) => ({ origem: item.origem, codigo: item.codigo })),
      },
    });
  }
  return { atualizados: unicos.length, emCartorio: input.emCartorio };
}
