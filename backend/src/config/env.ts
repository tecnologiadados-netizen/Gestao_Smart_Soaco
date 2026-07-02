import { z } from 'zod';

const envSchema = z.object({
  DB_URL: z.string().min(1, 'DB_URL é obrigatória'),
  APP_PORT: z.string().default('4000').transform(Number),
  JWT_SECRET: z.string().min(8, 'JWT_SECRET deve ter pelo menos 8 caracteres'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Variáveis de ambiente inválidas:', parsed.error.flatten());
    throw new Error('Configuração inválida. Verifique .env');
  }
  return parsed.data;
}
