import { z } from 'zod';

export const criarMovimentacaoLojaKitSchema = z.object({
  /** Kit local (Filtro/Engate) que movimenta o estoque. */
  produtoId: z.number().int().positive(),
  tipo: z.enum(['entrada', 'saida']),
  quantidade: z.number().int().positive(),
  /** Número do PD no Nomus (ex.: "PD 12345"). */
  pd: z.string().trim().min(1).max(80),
  /** Número do documento de saída no Nomus. */
  documentoSaida: z.string().trim().min(1).max(80),
  /** Código do produto do documento/pedido (referência). */
  produtoPedidoCodigo: z.string().trim().min(1).max(80),
  produtoPedidoDescricao: z.string().trim().max(255).optional().nullable(),
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
