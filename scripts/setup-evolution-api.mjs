/**
 * Prepara Evolution API (Docker) para o Gestão.
 * Uso (na raiz do Gestão):
 *   node scripts/setup-evolution-api.mjs
 *
 * Requer Docker Desktop depois, para:
 *   cd %USERPROFILE%\evolution-api
 *   docker compose -f docker-compose.gestao.yaml --env-file .env.gestao up -d
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { homedir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const backendEnv = join(root, 'backend', '.env');
const targetDir = join(homedir(), 'evolution-api');
const composeSrc = join(root, 'scripts', 'docker-compose.evolution.gestao.yaml');

function readGestaoKey() {
  if (!existsSync(backendEnv)) {
    throw new Error(`Não encontrei ${backendEnv}.`);
  }
  const text = readFileSync(backendEnv, 'utf8');
  const m = text.match(/^EVOLUTION_API_KEY=(.+)$/m);
  const key = m?.[1]?.trim();
  if (!key) throw new Error('EVOLUTION_API_KEY ausente em backend/.env');
  return key;
}

function ensureClone() {
  if (existsSync(join(targetDir, 'package.json'))) {
    console.log('[ok] Evolution já existe em', targetDir);
    return;
  }
  console.log('[…] Clonando Evolution API em', targetDir);
  const r = spawnSync('git', ['clone', 'https://github.com/EvolutionAPI/evolution-api.git', targetDir], {
    stdio: 'inherit',
    shell: true,
  });
  if (r.status !== 0) throw new Error('git clone falhou');
}

function writeEnvGestao(apiKey) {
  const content = `SERVER_NAME=gestao-evolution
SERVER_TYPE=http
SERVER_PORT=8080
SERVER_URL=http://127.0.0.1:8081
CORS_ORIGIN=*
CORS_METHODS=GET,POST,PUT,DELETE
CORS_CREDENTIALS=true
LOG_LEVEL=ERROR,WARN,INFO
LOG_COLOR=true
LOG_BAILEYS=error
DEL_INSTANCE=false
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=postgresql://evolution:evolution_gestao_local@postgres:5432/evolution?schema=public
DATABASE_CONNECTION_CLIENT_NAME=gestao_soaco
DATABASE_SAVE_DATA_INSTANCE=true
DATABASE_SAVE_DATA_NEW_MESSAGE=false
DATABASE_SAVE_MESSAGE_UPDATE=false
DATABASE_SAVE_DATA_CONTACTS=false
DATABASE_SAVE_DATA_CHATS=false
DATABASE_SAVE_DATA_LABELS=false
DATABASE_SAVE_DATA_HISTORIC=false
CACHE_REDIS_ENABLED=true
CACHE_REDIS_URI=redis://redis:6379
CACHE_REDIS_PREFIX_KEY=gestao_evolution
CACHE_LOCAL_ENABLED=false
AUTHENTICATION_API_KEY=${apiKey}
AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=true
CONFIG_SESSION_PHONE_CLIENT=GestaoSmart
CONFIG_SESSION_PHONE_NAME=Chrome
LANGUAGE=pt-BR
`;
  writeFileSync(join(targetDir, '.env.gestao'), content, 'utf8');
  console.log('[ok] .env.gestao escrito (AUTHENTICATION_API_KEY sincronizada)');
}

function copyCompose() {
  if (!existsSync(composeSrc)) {
    throw new Error(`Arquivo ausente: ${composeSrc}`);
  }
  copyFileSync(composeSrc, join(targetDir, 'docker-compose.gestao.yaml'));
  console.log('[ok] docker-compose.gestao.yaml copiado');
}

function main() {
  const key = readGestaoKey();
  ensureClone();
  copyCompose();
  writeEnvGestao(key);
  console.log(`
Próximos passos:
  1) Abra o Docker Desktop e aguarde ficar Running
  2) cd "${targetDir}"
  3) docker compose -f docker-compose.gestao.yaml --env-file .env.gestao up -d
  4) curl -H "apikey: (EVOLUTION_API_KEY do backend/.env)" http://127.0.0.1:8081/instance/fetchInstances
  5) npm run dev:start  (raiz do Gestão)
  6) Menu WhatsApp → escanear QR

Guia: docs/WHATSAPP-EVOLUTION-GESTAO.md
`);
}

main();
