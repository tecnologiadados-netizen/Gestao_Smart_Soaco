/**
 * Deve ser o primeiro import do server.ts para garantir que .env seja
 * carregado antes de qualquer módulo que leia process.env.
 * override: false — evita que .env sobrescreva APP_PORT quando o processo
 * foi iniciado pela raiz com "npm run dev" (run-backend-loop passa APP_PORT=4000).
 * Assim o proxy do Vite (localhost:4000) e o wait-on encontram o backend.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: envPath, override: false });
