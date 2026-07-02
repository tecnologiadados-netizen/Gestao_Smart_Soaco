/**
 * Sobe o stack dev de forma limpa: encerra instâncias antigas, espera portas livres, inicia sem predev.
 * Uso: node scripts/start-dev.cjs   ou   npm run dev:start
 */
const { spawn } = require('child_process');
const path = require('path');
const { execSync } = require('child_process');
const { ensurePortsFree, sleep, DEV_PORTS } = require('./port-utils.cjs');
const { releaseLock } = require('./dev-stack-lock.cjs');
const { appendDevLog } = require('./dev-log.cjs');

const root = path.resolve(__dirname, '..');

appendDevLog('start-dev', 'Reinício limpo solicitado');

console.log('[start-dev] Encerrando stack anterior...');
releaseLock();
const result = ensurePortsFree({ ports: DEV_PORTS, maxAttempts: 6, killDevStack: true });
if (!result.ok) {
  console.error('[start-dev] Portas ainda ocupadas:', result.busy.join(', '));
  process.exit(1);
}

sleep(3500);
console.log('[start-dev] Iniciando stack (DEV_FORCE=1, portas já liberadas)...');

const child = spawn('npm', ['run', 'dev', '--ignore-scripts'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, DEV_FORCE: '1' },
});

child.on('exit', (code) => process.exit(code ?? 0));

process.on('SIGINT', () => {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore' });
    } else {
      child.kill('SIGINT');
    }
  } catch {
    /* ignore */
  }
});
