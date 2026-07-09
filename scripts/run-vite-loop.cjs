/**
 * Executa o Vite em uma porta e reinicia automaticamente se o processo sair.
 * Evita matar outros Vites: aguarda a porta liberar antes de reiniciar.
 */
const { spawn } = require('child_process');
const path = require('path');
const { getPidsOnPort, sleep } = require('./port-utils.cjs');
const { FRONTEND_PORT } = require('./dev-ports.cjs');

const port = process.argv[2] || String(FRONTEND_PORT);
if (!port || !/^\d+$/.test(port)) {
  console.error('[run-vite-loop] Uso: node scripts/run-vite-loop.cjs <porta>');
  process.exit(1);
}

const root = path.resolve(__dirname, '..');
const frontendDir = path.join(root, 'frontend');
const PORT_NUM = Number(port);
const START_DELAY_MS = 0;

let portBusyRetries = 0;
const MAX_PORT_BUSY_RETRIES = 12;
let child = null;

function waitForPortFree(maxWaitMs = 20000) {
  const step = 500;
  let waited = 0;
  while (waited < maxWaitMs) {
    if (getPidsOnPort(PORT_NUM).length === 0) return true;
    sleep(step);
    waited += step;
  }
  return getPidsOnPort(PORT_NUM).length === 0;
}

function ensurePortAvailable() {
  const busy = getPidsOnPort(PORT_NUM);
  if (busy.length === 0) return true;

  const ownPids = new Set([process.pid, child?.pid].filter(Boolean));
  if (busy.every((pid) => ownPids.has(pid))) return true;

  console.warn(
    `[run-vite-loop:${port}] Porta ${port} em uso (PIDs: ${busy.join(', ')}). Aguardando liberar...`
  );
  if (waitForPortFree(20000)) return true;

  // Não mata processos alheios: evita loop entre várias instâncias npm run dev.
  console.warn(
    `[run-vite-loop:${port}] Porta ${port} ainda ocupada por outro processo. Nova tentativa em breve...`
  );
  return false;
}

function run() {
  if (!ensurePortAvailable()) {
    portBusyRetries += 1;
    if (portBusyRetries >= MAX_PORT_BUSY_RETRIES) {
      console.error(
        `[run-vite-loop:${port}] Porta ${port} permanece ocupada. Nova tentativa em 20s...`
      );
      portBusyRetries = 0;
      setTimeout(run, 20000);
      return;
    }
    const waitMs = Math.min(3000 + portBusyRetries * 1000, 12000);
    setTimeout(run, waitMs);
    return;
  }

  portBusyRetries = 0;

  child = spawn('npm', ['run', 'dev', '--', '--host', '0.0.0.0', '--port', port], {
    cwd: frontendDir,
    stdio: 'inherit',
    shell: true,
  });

  child.on('exit', (code, signal) => {
    child = null;
    if (code === 0 && !signal) {
      process.exit(0);
      return;
    }
    console.error(
      `[run-vite-loop:${port}] Vite saiu. Reiniciando após porta liberar...`,
      code != null ? `(código ${code})` : '',
      signal ? `(sinal ${signal})` : ''
    );
    waitForPortFree(10000);
    setTimeout(run, 1500);
  });
}

console.log(`[run-vite-loop:${port}] Iniciando Vite (reinício automático em crash).`);
setTimeout(run, START_DELAY_MS);
