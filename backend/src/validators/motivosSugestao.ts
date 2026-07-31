import { z } from 'zod';

const motivoBaseSchema = z.object({
  descricao: z.string().min(1, 'Descrição é obrigatória').max(200),
  abonada: z.boolean(),
  aplicacao_nao_abonada: z.enum(['montagem', 'producao', 'ambos']).nullable().optional(),
}).superRefine((data, ctx) => {
  if (!data.abonada && !data.aplicacao_nao_abonada) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['aplicacao_nao_abonada'],
      message: 'Defina onde a justificativa não será abonada.',
    });
  }
});

export const criarMotivoSugestaoSchema = motivoBaseSchema;

export const atualizarMotivoSugestaoSchema = motivoBaseSchema.and(z.object({
  senha: z.string().min(1, 'Senha é obrigatória para confirmar a edição'),
}));

export const excluirMotivoSugestaoSchema = z.object({
  senha: z.string().min(1, 'Senha é obrigatória para confirmar a exclusão'),
});
