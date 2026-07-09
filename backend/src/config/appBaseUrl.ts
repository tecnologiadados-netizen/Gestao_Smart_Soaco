/**
 * URL pública do sistema para links em e-mails (SGQ, etc.).
 * Produção: defina APP_BASE_URL no .env (ex.: https://gsmartsoaco.com.br).
 */
export function resolveAppBaseUrl(): string {
  const fromEnv = process.env.APP_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  if (process.env.NODE_ENV === 'production') {
    return 'https://gsmartsoaco.com.br';
  }
  return 'http://localhost:5180';
}
