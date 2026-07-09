/**
 * Watchdog do Vite interno (5190): reinicia só se a porta responder erro persistente.
 * Ignora ECONNREFUSED (Vite reiniciando) e período de graça após queda.
 */
const INTERVAL_MS = 45 * 1000;
const PORT = 5190;
const URL = `http://127.0.0.1:${PORT}/`;
const MAX_CONSECUTIVE_FAILURES = 6;
const FETCH_TIMEOUT_MS = 15_000;
const RESTART_GRACE_MS = 60 * 1000;
let consecutiveFailures = 0;
let restartGraceUntil = 0;

/** run-vite-loop já reinicia o Vite; matar a porta aqui causa loop com outras instâncias. */
function nudgeViteRestart() {
  console.warn('[watchdog-vite] Vite 5190 indisponível — run-vite-loop deve reiniciar o processo.');
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

async function checkVite() {
  try {
    const res = await fetch(URL, { method: 'GET', signal: timeoutSignal(FETCH_TIMEOUT_MS) });
    return res.status < 500 ? 'ok' : 'bad';
  } catch (err) {
    if (isConnRefused(err)) return 'restarting';
    return 'bad';
  }
}

async function runCheck() {
  if (Date.now() < restartGraceUntil) {
    return;
  }

  const result = await checkVite();

  if (result === 'ok') {
    if (consecutiveFailures > 0) {
      console.log('[watchdog-vite] Vite 5190 respondeu novamente.');
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
  console.warn(`[watchdog-vite] ${URL} sem resposta (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}).`);
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    console.warn('[watchdog-vite] Vite 5190 falhou várias vezes seguidas.');
    nudgeViteRestart();
    restartGraceUntil = Date.now() + RESTART_GRACE_MS;
    consecutiveFailures = 0;
  }
}

function main() {
  const FIRST_CHECK_DELAY_MS = 75 * 1000;
  console.log('[watchdog-vite] Ativo: testando', URL, 'a cada', INTERVAL_MS / 1000, 's.');
  setTimeout(() => {
    runCheck();
    setInterval(runCheck, INTERVAL_MS);
  }, FIRST_CHECK_DELAY_MS);
}

main();
