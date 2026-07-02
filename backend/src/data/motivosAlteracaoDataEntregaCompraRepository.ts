/**
 * Motivos da alteração da data de entrega do pedido de compra (Integração).
 * Cadastro separado dos motivos da aba Pedidos.
 */

import { prisma } from '../config/prisma.js';

export interface MotivoAlteracaoDataEntregaCompraRow {
  id: number;
  descricao: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function listarMotivosAlteracaoDataEntregaCompra(): Promise<MotivoAlteracaoDataEntregaCompraRow[]> {
  return prisma.motivoAlteracaoDataEntregaCompra.findMany({
    orderBy: { descricao: 'asc' },
  });
}

export async function criarMotivoAlteracaoDataEntregaCompra(descricao: string): Promise<MotivoAlteracaoDataEntregaCompraRow> {
  const trimmed = descricao.trim();
  if (!trimmed) throw new Error('Descrição é obrigatória.');
  return prisma.motivoAlteracaoDataEntregaCompra.create({
    data: { descricao: trimmed },
  });
}

export async function atualizarMotivoAlteracaoDataEntregaCompra(
  id: number,
  descricao: string
): Promise<MotivoAlteracaoDataEntregaCompraRow> {
  const trimmed = descricao.trim();
  if (!trimmed) throw new Error('Descrição é obrigatória.');
  return prisma.motivoAlteracaoDataEntregaCompra.update({
    where: { id },
    data: { descricao: trimmed },
  });
}

export async function excluirMotivoAlteracaoDataEntregaCompra(id: number): Promise<void> {
  await prisma.motivoAlteracaoDataEntregaCompra.delete({ where: { id } });
}
