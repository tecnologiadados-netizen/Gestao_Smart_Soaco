import { z } from 'zod';

const carradaSchema = z.object({
  baseData: z.literal('emissao').optional(),
  valorCorte: z.number().min(0),
  diasAbaixoCorte: z.number().int().min(1).max(730),
  diasIgualOuAcimaCorte: z.number().int().min(1).max(730),
  incluiInserirRomaneio: z.boolean().optional(),
});

export const criarRegraDataEntregaVersaoSchema = z.object({
  payload: z.object({
    carrada: carradaSchema,
  }),
  vigenteApartirDe: z.string().min(1, 'Informe a data de vigência.'),
});
