/**
 * Motivos de alteração sugeridos (lista dinâmica para o popup de ajuste).
 */

import { prisma } from '../config/prisma.js';

export interface MotivoSugestaoRow {
  id: number;
  descricao: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function listarMotivosSugestao(): Promise<MotivoSugestaoRow[]> {
  return prisma.motivoSugestao.findMany({
    orderBy: { descricao: 'asc' },
  });
}

export async function criarMotivoSugestao(descricao: string): Promise<MotivoSugestaoRow> {
  const trimmed = descricao.trim();
  if (!trimmed) throw new Error('Descrição é obrigatória.');
  return prisma.motivoSugestao.create({
    data: { descricao: trimmed },
  });
}

export async function atualizarMotivoSugestao(
  id: number,
  descricao: string
): Promise<MotivoSugestaoRow> {
  const trimmed = descricao.trim();
  if (!trimmed) throw new Error('Descrição é obrigatória.');
  return prisma.motivoSugestao.update({
    where: { id },
    data: { descricao: trimmed },
  });
}

export async function excluirMotivoSugestao(id: number): Promise<void> {
  await prisma.motivoSugestao.delete({ where: { id } });
}
