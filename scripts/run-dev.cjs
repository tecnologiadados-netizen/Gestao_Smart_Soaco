/**
 * Sobe a stack dev com trava de instância única (não mata stack anterior).
 * Watchdogs opcionais (DEV_WATCHDOG=0). Backend estável opcional (DEV_STABLE=1).
 */
const { spawn, execSync } = require('child_process');
const path = require('path');
const { acquireLock, releaseLock } = require('./dev-stack-lock.cjs');
const { appendDevLog } = require('./dev-log.cjs');

const root = path.resolve(__dirname, '..');
const force = process.env.DEV_FORCE === '1';
const watchdog = process.env.DEV_WATCHDOG !== '0';
const stable = process.env.DEV_STABLE === '1';

if (!acquireLock({ force, mode: stable ? 'stable' : 'dev' })) {
  process.exit(1);
}

const modeLabel = stable ? 'stable' : 'dev';
appendDevLog(
  'run-dev',
  `Stack iniciando (modo=${modeLabel}, watchdog=${watchdog}, force=${force}, pid=${process.pid})`
);

const npmScript = watchdog ? 'dev:core' : 'dev:core:quiet';

let child = null;
let exiting = false;

function shutdown(code) {
  if (exiting) return;
  exiting = true;
  appendDevLog('run-dev', `Encerrando stack (código=${code ?? 0})`);
  releaseLock();
  if (child && child.pid) {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore' });
      } else {
        child.kill('SIGTERM');
      }
    } catch {
      /* ignore */
    }
  }
  process.exit(code ?? 0);
}

child = spawn('npm', ['run', npmScript, '--ignore-scripts'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    DEV_STABLE: stable ? '1' : process.env.DEV_STABLE,
  },
});

child.on('exit', (code, signal) => {
  appendDevLog('run-dev', `dev:core saiu`, `code=${code} signal=${signal || ''}`);
  if (exiting) return;
  releaseLock();
  process.exit(code ?? 0);
});

process.on('SIGINT', () => shutdown(130));
process.on('SIGTERM', () => shutdown(143));
process.on('exit', () => {
  if (!exiting) releaseLock();
});

console.log(
  `[run-dev] Modo ${modeLabel}${watchdog ? '' : ' (sem watchdog)'} — trava ativa (PID ${process.pid}).`
);
console.log('[run-dev] Reinício limpo: npm run dev:start | Parar: npm run dev:stop');
