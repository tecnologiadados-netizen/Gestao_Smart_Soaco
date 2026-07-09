/**
 * Utilitários para liberar portas e encerrar a stack dev deste projeto (Windows/Linux).
 * Evita loop infinito: matar só o listener Vite deixa run-vite-loop recriar o processo.
 */
const { execSync } = require('child_process');
const path = require('path');

// Portas fixas da stack dev (evita colisões com múltiplas instâncias).
// API (backend): 4000
// Frontend (Vite): 5190
const DEV_PORTS = [4000, 5190];
const PROJECT_MARKER = 'gestorpedidosSoAco';

const DEV_CMD_PATTERNS = [
  /run-vite-loop\.cjs/i,
  /run-backend-loop\.cjs/i,
  /watchdog-backend\.cjs/i,
  /watchdog-vite-interno\.cjs/i,
  /concurrently/i,
  /tsx watch src[\\/]server\.ts/i,
  /vite[\\/]bin[\\/]vite\.js/i,
  /npm run dev:frontend/i,
  /npm run dev:backend/i,
  /npm run dev:fe-all/i,
  /cross-env APP_PORT=4000/i,
];

function sleep(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* sync wait */
  }
}

function normalizePath(p) {
  return path.resolve(p).replace(/\\/g, '/').toLowerCase();
}

function isDevStackCommandLine(cmd, projectRootNorm) {
  if (!cmd) return false;
  const c = cmd.replace(/\\/g, '/');
  if (!c.toLowerCase().includes(PROJECT_MARKER.toLowerCase())) return false;
  if (projectRootNorm && !c.toLowerCase().includes(projectRootNorm)) return false;
  return DEV_CMD_PATTERNS.some((re) => re.test(c));
}

function getPidsOnPortWin(port) {
  try {
    const out = execSync('netstat -ano -p tcp', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    const pids = new Set();
    const needle = `:${port}`;
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes('LISTENING')) continue;
      if (!line.includes(needle)) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parseInt(parts[parts.length - 1], 10);
      if (Number.isFinite(pid) && pid > 0) pids.add(pid);
    }
    return [...pids];
  } catch {
    return [];
  }
}

function getPidsOnPortUnix(port) {
  try {
    const out = execSync(`lsof -ti :${port} -sTCP:LISTEN`, { encoding: 'utf8' }).trim();
    if (!out) return [];
    return out
      .split(/\s+/)
      .map((x) => parseInt(x, 10))
      .filter((n) => Number.isFinite(n) && n > 0);
  } catch {
    return [];
  }
}

function getPidsOnPort(port) {
  return process.platform === 'win32' ? getPidsOnPortWin(port) : getPidsOnPortUnix(port);
}

function killPid(pid, excludePids = new Set()) {
  if (!pid || excludePids.has(pid)) return false;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
    } else {
      execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
    }
    return true;
  } catch {
    return false;
  }
}

function listWindowsProcesses() {
  try {
    const raw = execSync('wmic process get ProcessId,CommandLine /format:list', {
      encoding: 'utf8',
      maxBuffer: 25 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    const procs = [];
    let cmd = '';
    for (const line of raw.split(/\r?\n/)) {
      if (line.startsWith('CommandLine=')) {
        cmd = line.slice('CommandLine='.length);
      } else if (line.startsWith('ProcessId=')) {
        const pid = parseInt(line.slice('ProcessId='.length), 10);
        if (Number.isFinite(pid) && pid > 0) {
          procs.push({ pid, cmd });
        }
        cmd = '';
      }
    }
    return procs;
  } catch {
    return [];
  }
}

function listUnixDevProcesses(projectRootNorm) {
  try {
    const raw = execSync('ps -eo pid=,command=', { encoding: 'utf8', maxBuffer: 25 * 1024 * 1024 });
    const procs = [];
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*(\d+)\s+(.*)$/);
      if (!m) continue;
      const pid = parseInt(m[1], 10);
      const cmd = m[2];
      if (isDevStackCommandLine(cmd, projectRootNorm)) procs.push({ pid, cmd });
    }
    return procs;
  } catch {
    return [];
  }
}

/** Encerra loops Vite/backend, concurrently e watchdogs deste projeto. */
function killDevStackProcesses(options = {}) {
  const root = path.resolve(options.projectRoot || path.join(__dirname, '..'));
  const rootNorm = normalizePath(root);
  const exclude = new Set(options.excludePids || [process.pid]);
  let killed = 0;

  const candidates =
    process.platform === 'win32'
      ? listWindowsProcesses().filter((p) => isDevStackCommandLine(p.cmd, rootNorm))
      : listUnixDevProcesses(rootNorm);

  for (const { pid } of candidates) {
    if (killPid(pid, exclude)) killed += 1;
  }

  if (killed > 0) sleep(800);
  return killed;
}

/** Mata processos que escutam em uma porta. */
function killPort(port, options = {}) {
  const exclude = new Set(options.excludePids || [process.pid]);
  let killed = 0;
  for (const pid of getPidsOnPort(port)) {
    if (killPid(pid, exclude)) killed += 1;
  }
  return killed;
}

function portsInUse(ports = DEV_PORTS) {
  return ports.filter((p) => getPidsOnPort(p).length > 0);
}

/** Garante portas livres: encerra listeners nas portas, com retentativas. */
function ensurePortsFree(options = {}) {
  const ports = options.ports || DEV_PORTS;
  const maxAttempts = options.maxAttempts || 4;
  const excludePids = new Set(options.excludePids || [process.pid]);
  /** Só use true em parada forçada; matar a stack inteira derruba concurrently/npm run dev em execução. */
  const killDevStack = options.killDevStack === true;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (killDevStack) {
      killDevStackProcesses({ projectRoot: options.projectRoot, excludePids: [...excludePids] });
    }

    for (const port of ports) {
      killPort(port, { excludePids: [...excludePids] });
    }

    sleep(attempt === 1 ? 1200 : 800);

    const busy = portsInUse(ports);
    if (busy.length === 0) {
      return { ok: true, attempts: attempt, busy: [] };
    }

    if (attempt < maxAttempts) {
      console.warn(`[port-utils] Portas ainda em uso (${busy.join(', ')}). Tentativa ${attempt}/${maxAttempts}...`);
    }
  }

  return { ok: false, attempts: maxAttempts, busy: portsInUse(ports) };
}

module.exports = {
  DEV_PORTS,
  ensurePortsFree,
  killDevStackProcesses,
  killPort,
  getPidsOnPort,
  portsInUse,
  sleep,
  isDevStackCommandLine,
  listWindowsProcesses,
};
