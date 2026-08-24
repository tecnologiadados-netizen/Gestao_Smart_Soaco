/**
 * Testes backend com SQLite local (CI e maquinas sem .env/DB_URL).
 * Evita depender de alterar .github/workflows (escopo workflow no token).
 */
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
process.chdir(root);

if (!process.env.DB_URL || !String(process.env.DB_URL).trim()) {
  process.env.DB_URL = 'file:./prisma/vitest.db';
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    env: process.env,
    shell: true,
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run('npx', ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss']);
run('npx', ['vitest', 'run']);
