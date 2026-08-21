/**
 * Sobe o stack de DEV ISOLADO (não mexe na produção :4000).
 * API 4001 + Vite 5181. Uso: npm run dev:isolado
 */
const { spawn } = require('child_process');
const path = require('path');
const { execSync } = require('child_process');
const { ensurePortsFree, sleep } = require('./port-utils.cjs');
const { releaseLock } = require('./dev-stack-lock.cjs');
const { appendDevLog } = require('./dev-log.cjs');

const root = path.resolve(__dirname, '..');
const BACKEND_PORT = '4001';
const FRONTEND_PORT = '5181';

const isoladoEnv = {
  ...process.env,
  DEV_BACKEND_PORT: BACKEND_PORT,
  DEV_FRONTEND_PORT: FRONTEND_PORT,
  APP_PORT: BACKEND_PORT,
  VITE_API_PROXY_TARGET: `http://127.0.0.1:${BACKEND_PORT}`,
  DEV_FORCE: '1',
  DEV_WATCHDOG: '0',
  NODE_ENV: 'development',
};

appendDevLog('start-dev-isolado', `Reinício isolado :${BACKEND_PORT}/:${FRONTEND_PORT}`);

console.log(`[start-dev-isolado] Liberando só as portas ${BACKEND_PORT} e ${FRONTEND_PORT} (produção :4000 intacta)...`);
releaseLock();
const result = ensurePortsFree({
  ports: [Number(BACKEND_PORT), Number(FRONTEND_PORT)],
  maxAttempts: 6,
  killDevStack: true,
});
if (!result.ok) {
  console.error('[start-dev-isolado] Portas ainda ocupadas:', result.busy.join(', '));
  process.exit(1);
}

sleep(1500);
console.log(`[start-dev-isolado] Subindo API :${BACKEND_PORT} + Vite :${FRONTEND_PORT}`);
console.log('[start-dev-isolado] Abra: http://localhost:5181/producao/camasi');

const child = spawn('npm', ['run', 'dev:core:quiet', '--ignore-scripts'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: isoladoEnv,
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
