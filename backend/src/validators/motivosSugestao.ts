import { z } from 'zod';

export const criarMotivoSugestaoSchema = z.object({
  descricao: z.string().min(1, 'Descrição é obrigatória').max(200),
});

export const atualizarMotivoSugestaoSchema = z.object({
  descricao: z.string().min(1, 'Descrição é obrigatória').max(200),
  senha: z.string().min(1, 'Senha é obrigatória para confirmar a edição'),
});

export const excluirMotivoSugestaoSchema = z.object({
  senha: z.string().min(1, 'Senha é obrigatória para confirmar a exclusão'),
});
