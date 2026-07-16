/**
 * Utilitários para liberar portas e encerrar a stack dev deste projeto (Windows/Linux).
 * Evita loop infinito: matar só o listener Vite deixa run-vite-loop recriar o processo.
 */
const { execSync } = require('child_process');
const path = require('path');
const { DEV_PORTS, KILL_PORTS } = require('./dev-ports.cjs');

/**
 * Marcador legado (quando o projeto ficava em `C:\gestorpedidosSoAco`). Mantido apenas como
 * dica adicional — a identificação principal é feita pelo CAMINHO REAL da raiz do projeto,
 * para funcionar independentemente do nome da pasta em que o repositório foi clonado.
 */
const PROJECT_MARKER = 'gestorpedidosSoAco';

/** Raiz real deste checkout e o nome da pasta — usados para casar processos deste projeto. */
const PROJECT_ROOT = path.resolve(__dirname, '..');

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
  const c = cmd.replace(/\\/g, '/').toLowerCase();
  const rootNorm = projectRootNorm || normalizePath(PROJECT_ROOT);
  const dirName = path.basename(PROJECT_ROOT).toLowerCase();

  // Só encerramos processos DESTE projeto. Identificação principal: caminho real da raiz
  // aparece na linha de comando (node vite.js, tsx, concurrently, scripts .cjs). Marcador
  // legado e nome da pasta ficam como dica extra, mas o caminho é o que garante robustez.
  const belongsToProject =
    (!!rootNorm && c.includes(rootNorm)) ||
    (!!dirName && c.includes(`/${dirName}/`)) ||
    c.includes(PROJECT_MARKER.toLowerCase());
  if (!belongsToProject) return false;

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

/**
 * Lista processos via PowerShell/CIM (confiável no Windows 11 moderno, onde o `wmic`
 * foi descontinuado e pode devolver lista incompleta ou vazia).
 */
function listWindowsProcessesPowerShell() {
  try {
    const script =
      "$ErrorActionPreference='SilentlyContinue';" +
      '@(Get-CimInstance Win32_Process | Select-Object ProcessId,CommandLine) | ' +
      'ConvertTo-Json -Compress -Depth 2';
    const raw = execSync(`powershell -NoProfile -NonInteractive -Command "${script}"`, {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    if (!raw || !raw.trim()) return null;
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    const procs = arr
      .map((p) => ({ pid: Number(p.ProcessId), cmd: p.CommandLine || '' }))
      .filter((p) => Number.isFinite(p.pid) && p.pid > 0);
    return procs.length > 0 ? procs : null;
  } catch {
    return null;
  }
}

/** Fallback legado via `wmic` (mquinas antigas sem o CIM acessível). */
function listWindowsProcessesWmic() {
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

function listWindowsProcesses() {
  return listWindowsProcessesPowerShell() || listWindowsProcessesWmic();
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
  KILL_PORTS,
  ensurePortsFree,
  killDevStackProcesses,
  killPort,
  getPidsOnPort,
  portsInUse,
  sleep,
  isDevStackCommandLine,
  listWindowsProcesses,
};
