/**
 * Watchdog do backend: testa /auth/ping periodicamente.
 * Só reinicia (libera porta 4000) se o processo estiver travado — não durante
 * reinício normal do tsx watch (ECONNREFUSED) nem logo após detectar queda.
 */
const INTERVAL_MS = 45 * 1000;
const API_BASE = 'http://127.0.0.1:4000';
const PING_URL = `${API_BASE}/auth/ping`;
const PORT = 4000;
const MAX_CONSECUTIVE_FAILURES = 6;
const PING_TIMEOUT_MS = 20_000;
const RESTART_GRACE_MS = 90 * 1000;
let consecutiveFailures = 0;
let restartGraceUntil = 0;

function killPort(port) {
  const { killPort: killPortUtil } = require('./port-utils.cjs');
  killPortUtil(port);
  console.warn(`[watchdog] Porta ${port} liberada. Backend será reiniciado pelo run-backend-loop.`);
}

function timeoutSignal(ms) {
  if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
    return AbortSignal.timeout(ms);
  }
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

function isConnRefused(err) {
  const code = err?.cause?.code ?? err?.code;
  return code === 'ECONNREFUSED' || code === 'ECONNRESET';
}

async function checkPing() {
  try {
    const res = await fetch(PING_URL, { method: 'GET', signal: timeoutSignal(PING_TIMEOUT_MS) });
    return res.ok ? 'ok' : 'bad';
  } catch (err) {
    if (isConnRefused(err)) return 'restarting';
    return 'bad';
  }
}

async function runCheck() {
  if (Date.now() < restartGraceUntil) {
    return;
  }

  const result = await checkPing();

  if (result === 'ok') {
    if (consecutiveFailures > 0) {
      console.log('[watchdog] Backend respondeu novamente. Zerando contador de falhas.');
    }
    consecutiveFailures = 0;
    return;
  }

  if (result === 'restarting') {
    restartGraceUntil = Date.now() + RESTART_GRACE_MS;
    consecutiveFailures = 0;
    return;
  }

  consecutiveFailures += 1;
  console.warn(`[watchdog] /auth/ping indisponível (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}).`);
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    console.warn('[watchdog] Backend possivelmente travado. Reiniciando...');
    try {
      require('./dev-log.cjs').appendDevLog('watchdog-backend', 'Matando porta 4000 após falhas consecutivas de ping');
    } catch {
      /* ignore */
    }
    killPort(PORT);
    restartGraceUntil = Date.now() + RESTART_GRACE_MS;
    consecutiveFailures = 0;
  }
}

function main() {
  const FIRST_CHECK_DELAY_MS = 60 * 1000;
  console.log(
    '[watchdog] Ativo: ping em',
    PING_URL,
    'a cada',
    INTERVAL_MS / 1000,
    's (ignora reinício do tsx).'
  );
  setTimeout(() => {
    runCheck();
    setInterval(runCheck, INTERVAL_MS);
  }, FIRST_CHECK_DELAY_MS);
}

main();
