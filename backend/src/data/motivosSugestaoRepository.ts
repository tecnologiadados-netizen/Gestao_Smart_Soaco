/**
 * Motivos de alteração sugeridos (lista dinâmica para o popup de ajuste).
 */

import { prisma } from '../config/prisma.js';

export interface MotivoSugestaoRow {
  id: number;
  descricao: string;
  abonada: boolean;
  aplicacaoNaoAbonada: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type AplicacaoNaoAbonada = 'montagem' | 'producao' | 'ambos';

export type MotivoSugestaoInput = {
  descricao: string;
  abonada: boolean;
  aplicacaoNaoAbonada: AplicacaoNaoAbonada | null;
};

export async function listarMotivosSugestao(): Promise<MotivoSugestaoRow[]> {
  return prisma.motivoSugestao.findMany({
    orderBy: { descricao: 'asc' },
  });
}

export async function criarMotivoSugestao(input: MotivoSugestaoInput): Promise<MotivoSugestaoRow> {
  const trimmed = input.descricao.trim();
  if (!trimmed) throw new Error('Descrição é obrigatória.');
  return prisma.motivoSugestao.create({
    data: {
      descricao: trimmed,
      abonada: input.abonada,
      aplicacaoNaoAbonada: input.abonada ? null : input.aplicacaoNaoAbonada,
    },
  });
}

export async function atualizarMotivoSugestao(
  id: number,
  input: MotivoSugestaoInput,
): Promise<MotivoSugestaoRow> {
  const trimmed = input.descricao.trim();
  if (!trimmed) throw new Error('Descrição é obrigatória.');
  return prisma.motivoSugestao.update({
    where: { id },
    data: {
      descricao: trimmed,
      abonada: input.abonada,
      aplicacaoNaoAbonada: input.abonada ? null : input.aplicacaoNaoAbonada,
    },
  });
}

export async function excluirMotivoSugestao(id: number): Promise<void> {
  await prisma.motivoSugestao.delete({ where: { id } });
}

export async function listarDescricoesNaoAbonadas(
  area: 'montagem' | 'producao',
): Promise<string[]> {
  const rows = await prisma.motivoSugestao.findMany({
    where: {
      abonada: false,
      aplicacaoNaoAbonada: { in: [area, 'ambos'] },
    },
    select: { descricao: true },
    orderBy: { descricao: 'asc' },
  });
  return rows.map((row) => row.descricao);
}
