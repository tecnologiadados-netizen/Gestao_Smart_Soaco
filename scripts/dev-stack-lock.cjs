/**
 * Trava de instância única para npm run dev — evita que um segundo dev mate a stack em execução.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { DEV_PORTS, portsInUse } = require('./port-utils.cjs');

const root = path.resolve(__dirname, '..');
const LOCK_FILE = path.join(root, '.dev-stack.lock');

function isPidAlive(pid) {
  if (!pid || !Number.isFinite(pid) || pid <= 0) return false;
  try {
    if (process.platform === 'win32') {
      const out = execSync(`tasklist /FI "PID eq ${pid}" /NH`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      return out.includes(String(pid));
    }
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readLock() {
  try {
    if (!fs.existsSync(LOCK_FILE)) return null;
    const raw = fs.readFileSync(LOCK_FILE, 'utf8').trim();
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeLock(meta) {
  const payload = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    ...meta,
  };
  fs.writeFileSync(LOCK_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payload;
}

function releaseLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE);
  } catch {
    /* ignore */
  }
}

/** Remove trava se o PID dono não existe mais. */
function clearStaleLock() {
  const lock = readLock();
  if (!lock) return false;
  if (isPidAlive(lock.pid)) return false;
  releaseLock();
  return true;
}

/**
 * Tenta adquirir a trava. Retorna false se outra stack válida já estiver ativa.
 * @param {{ force?: boolean, mode?: string }} options — force=true ignora trava (dev:start).
 */
function acquireLock(options = {}) {
  const force = options.force === true;
  clearStaleLock();

  const existing = readLock();
  if (existing && isPidAlive(existing.pid) && !force) {
    console.error(
      `[dev-stack] Stack já em execução (PID ${existing.pid}, desde ${existing.startedAt}).`
    );
    console.error('[dev-stack] Reinício limpo: npm run dev:start');
    console.error('[dev-stack] Encerrar: npm run dev:stop');
    return false;
  }

  const busy = portsInUse(DEV_PORTS);
  if (busy.length > 0 && !force) {
    console.error(`[dev-stack] Portas em uso (${busy.join(', ')}) sem trava válida.`);
    console.error('[dev-stack] Reinício controlado: npm run dev:start');
    return false;
  }

  if (force) releaseLock();

  writeLock({
    mode: options.mode || (process.env.DEV_STABLE === '1' ? 'stable' : 'dev'),
    watchdog: process.env.DEV_WATCHDOG !== '0',
  });
  return true;
}

module.exports = {
  LOCK_FILE,
  readLock,
  writeLock,
  releaseLock,
  acquireLock,
  clearStaleLock,
  isPidAlive,
};
