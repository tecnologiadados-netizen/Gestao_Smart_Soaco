import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { chavePreferenciaFicha } from './regras.js';

export type PreferenciaFicha = 'nomus' | 'planilha';

export async function preferenciasFicha(codigos: string[]): Promise<Map<string, PreferenciaFicha>> {
  const chaves = [...new Set(codigos.map(chavePreferenciaFicha).filter(Boolean))];
  const mapa = new Map<string, PreferenciaFicha>();
  if (chaves.length === 0) return mapa;
  const rows = await prisma.$queryRaw<{ codigo: string; origem: string }[]>(
    Prisma.sql`SELECT codigo, origem FROM gondola_preferencia_ficha WHERE codigo IN (${Prisma.join(chaves)})`
  );
  for (const row of rows) {
    if (row.origem === 'nomus' || row.origem === 'planilha') mapa.set(row.codigo, row.origem);
  }
  return mapa;
}

export async function preferenciaFicha(codigo: string): Promise<PreferenciaFicha | null> {
  return (await preferenciasFicha([codigo])).get(chavePreferenciaFicha(codigo)) ?? null;
}

export async function salvarPreferenciasFicha(
  escolhas: { codigo: string; origem: PreferenciaFicha }[],
  login: string | null
): Promise<void> {
  const agora = new Date().toISOString();
  for (const escolha of escolhas) {
    const codigo = chavePreferenciaFicha(escolha.codigo);
    if (!codigo) continue;
    await prisma.$executeRaw`
      INSERT INTO gondola_preferencia_ficha (codigo, origem, atualizado_por_login, atualizado_em)
      VALUES (${codigo}, ${escolha.origem}, ${login}, ${agora})
      ON CONFLICT(codigo) DO UPDATE SET
        origem = excluded.origem,
        atualizado_por_login = excluded.atualizado_por_login,
        atualizado_em = excluded.atualizado_em
    `;
  }
}
