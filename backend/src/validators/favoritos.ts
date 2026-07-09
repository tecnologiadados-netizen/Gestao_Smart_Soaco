import { z } from 'zod';

export const criarFavoritoSchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório.').max(120),
  rota: z.string().trim().min(1),
  filtros: z.record(z.string(), z.string()),
});

export const atualizarFavoritoSchema = z.object({
  nome: z.string().trim().min(1).max(120).optional(),
  filtros: z.record(z.string(), z.string()).optional(),
  ordem: z.number().int().min(0).optional(),
});
