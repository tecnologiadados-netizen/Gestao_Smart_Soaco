/**
 * Deve ser o primeiro import do server.ts para garantir que .env seja
 * carregado antes de qualquer módulo que leia process.env.
 *
 * Override: o arquivo backend/.env ganha de variáveis herdadas do shell (ex.: um
 * `$env:DB_URL` leftover de um script). Sem isso o Prisma abre outro SQLite,
 * o seed cria só master/admin e o login dos usuários reais falha.
 *
 * Depois preenche lacunas a partir do `.env` da raiz do monorepo (sem sobrescrever
 * o que já veio do backend/.env) — ex.: EMAIL_SETTINGS_ENCRYPTION_KEY só na raiz.
 *
 * APP_PORT do processo é preservado: `npm run dev` na raiz injeta 4000 via
 * run-backend-loop e o .env de produção às vezes traz outra porta.
 *
 * Vitest: não sobrescreve (tests/setup-env.ts define DB_URL do banco de teste).
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendEnvPath = path.resolve(__dirname, '..', '.env');
const rootEnvPath = path.resolve(__dirname, '..', '..', '.env');
const launchedByTests = Boolean(process.env.VITEST || process.env.VITEST_WORKER_ID);

if (launchedByTests) {
  dotenv.config({ path: backendEnvPath, override: false });
  dotenv.config({ path: rootEnvPath, override: false });
} else {
  const preservePort = process.env.APP_PORT;
  dotenv.config({ path: backendEnvPath, override: true });
  // Só completa chaves ausentes (não sobrescreve DB_URL etc. do backend/.env).
  dotenv.config({ path: rootEnvPath, override: false });
  if (preservePort) process.env.APP_PORT = preservePort;
}
