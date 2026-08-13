import { z } from 'zod';

export const criarMovimentacaoLojaKitSchema = z
  .object({
    /** Kit local (Filtro/Engate). Omitir quando kitCompleto = true. */
    produtoId: z.number().int().positive().optional(),
    /** Lança a quantidade em cada item (Filtro e Engate). */
    kitCompleto: z.boolean().optional().default(false),
    tipo: z.enum(['entrada', 'saida']),
    quantidade: z.number().int().positive(),
    /** Número do PD no Nomus (entrada). */
    pd: z.string().trim().max(80).optional().nullable(),
    /** Número do documento de saída no Nomus (entrada). */
    documentoSaida: z.string().trim().max(80).optional().nullable(),
    /** Id do documento no Nomus (para validar quantidade do pedido). */
    documentoId: z.string().trim().min(1).max(80).optional(),
    /** Sequência Shop9 (saída) — Movimento.Sequencia. */
    sequenciaShop9: z.number().int().positive().optional(),
    /** Ordem interna Shop9 (saída) — Movimento.Ordem. */
    ordemMovimentoShop9: z.number().int().positive().optional(),
    /** Quem entregou / conferiu (obrigatório na saída). */
    conferenteNome: z
      .enum([
        'FRANCISCO CASSIO PEREIRA DA SILVA',
        'JOAO VICTOR DOS SANTOS NASCIMENTO',
        'IRAN RIBEIRO BOMFIM',
      ])
      .optional()
      .nullable(),
    produtoPedidoCodigo: z.string().trim().min(1).max(80),
    produtoPedidoDescricao: z.string().trim().max(255).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (!data.kitCompleto && data.produtoId == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe o kit ou marque kit completo.',
        path: ['produtoId'],
      });
    }
    if (data.tipo === 'entrada') {
      if (!data.pd?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe o pedido vinculado.',
          path: ['pd'],
        });
      }
      if (!data.documentoSaida?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe o documento de saída.',
          path: ['documentoSaida'],
        });
      }
    } else {
      if (data.ordemMovimentoShop9 == null && data.sequenciaShop9 == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe a sequência Shop9.',
          path: ['sequenciaShop9'],
        });
      }
      if (!data.conferenteNome?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe o responsável pela entrega / conferente.',
          path: ['conferenteNome'],
        });
      }
    }
  });

export const criarInventarioLojaKitSchema = z.object({
  observacao: z.string().trim().max(2000).optional().nullable(),
  itens: z
    .array(
      z.object({
        produtoId: z.number().int().positive(),
        qtdContada: z.number().int().min(0),
      }),
    )
    .min(1),
});

export type CriarMovimentacaoLojaKitInput = z.infer<typeof criarMovimentacaoLojaKitSchema>;
export type CriarInventarioLojaKitInput = z.infer<typeof criarInventarioLojaKitSchema>;
