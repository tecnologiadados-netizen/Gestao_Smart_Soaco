/**
 * Executa o Next.js do SGQ (qualidade/sgq) na porta 3001 com reinício automático.
 */
const { spawn } = require('child_process');
const path = require('path');
const { getPidsOnPort, sleep } = require('./port-utils.cjs');

const PORT_NUM = Number(process.env.SGQ_PORT || 3001);
const root = path.resolve(__dirname, '..');
const sgqDir = path.join(root, 'qualidade', 'sgq');

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

  console.warn(`[run-sgq-loop] Porta ${PORT_NUM} em uso (PIDs: ${busy.join(', ')}). Aguardando...`);
  if (waitForPortFree(20000)) return true;

  console.warn(`[run-sgq-loop] Porta ${PORT_NUM} ainda ocupada. Nova tentativa em breve...`);
  return false;
}

function run() {
  if (!ensurePortAvailable()) {
    portBusyRetries += 1;
    if (portBusyRetries >= MAX_PORT_BUSY_RETRIES) {
      console.error(`[run-sgq-loop] Porta ${PORT_NUM} permanece ocupada. Nova tentativa em 20s...`);
      portBusyRetries = 0;
      setTimeout(run, 20000);
      return;
    }
    const waitMs = Math.min(3000 + portBusyRetries * 1000, 12000);
    setTimeout(run, waitMs);
    return;
  }

  portBusyRetries = 0;

  child = spawn('npm', ['run', 'dev'], {
    cwd: sgqDir,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, SGQ_PORT: String(PORT_NUM) },
  });

  child.on('exit', (code, signal) => {
    child = null;
    if (code === 0 && !signal) {
      process.exit(0);
      return;
    }
    console.error(
      '[run-sgq-loop] SGQ saiu. Reiniciando após porta liberar...',
      code != null ? `(código ${code})` : '',
      signal ? `(sinal ${signal})` : ''
    );
    waitForPortFree(10000);
    setTimeout(run, 1500);
  });
}

console.log(`[run-sgq-loop] Iniciando SGQ (Next.js) na porta ${PORT_NUM}.`);
setTimeout(run, 800);
