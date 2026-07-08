import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirnameService = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirnameService, '..', '..');

/** Word COM não suporta conversões paralelas. */
let pdfQueue: Promise<unknown> = Promise.resolve();

function resolvePythonExecutable(): string {
  const fromEnv = process.env.PYTHON_PATH?.trim().replace(/^"|"$/g, '');
  if (fromEnv) return fromEnv;

  const candidates = [
    'C:\\Program Files\\Python312\\python.exe',
    'C:\\Program Files\\Python311\\python.exe',
    'python',
  ];
  for (const cmd of candidates) {
    if (cmd === 'python' || existsSync(cmd)) return cmd;
  }
  return 'python';
}

function resolveScriptPath(relative: string): string {
  const primary = path.join(backendRoot, relative);
  if (existsSync(primary)) return primary;

  const fallback = path.join(backendRoot, '..', relative);
  if (existsSync(fallback)) return fallback;

  return primary;
}

function executarPython(
  scriptRelative: string,
  payload: string,
  outputPath: string
): Promise<{ stderr: string; code: number | null }> {
  const scriptPath = resolveScriptPath(scriptRelative);
  const pythonCmd = resolvePythonExecutable();

  return new Promise((resolve, reject) => {
    const child = spawn(pythonCmd, [scriptPath, '--output', outputPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
      },
    });

    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => {
      reject(
        new Error(
          `Python não encontrado (${pythonCmd}). Configure PYTHON_PATH no .env. Detalhe: ${err.message}`
        )
      );
    });
    child.on('close', (code) => resolve({ stderr, code }));
    child.stdin.write(payload, 'utf8');
    child.stdin.end();
  });
}

function extrairErroPython(stderr: string): string {
  const linhas = stderr
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^\d+%\|/.test(l) && !l.startsWith('|'));
  const texto = linhas.join(' ').trim();
  return texto || stderr.trim();
}

async function gerarPdf(
  scriptRelative: string,
  payload: Record<string, unknown>,
  tempPrefix: string
): Promise<Buffer> {
  let tempDir: string | undefined;
  try {
    tempDir = await mkdtemp(path.join(tmpdir(), tempPrefix));
    const outputPath = path.join(tempDir, 'relatorio.pdf');

    const { stderr, code } = await executarPython(
      scriptRelative,
      JSON.stringify(payload),
      outputPath
    );
    if (code !== 0) {
      const detalhe = extrairErroPython(stderr);
      throw new Error(detalhe || 'Falha ao gerar o PDF.');
    }

    return await readFile(outputPath);
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}

function enfileirar<T>(fn: () => Promise<T>): Promise<T> {
  const task = pdfQueue.then(fn, fn);
  pdfQueue = task.catch(() => {});
  return task;
}

export function gerarRncPdfBuffer(registro: unknown): Promise<Buffer> {
  return enfileirar(() =>
    gerarPdf('scripts/sgq/rnc-pdf/generate_rnc_pdf.py', { registro }, 'rnc-pdf-')
  );
}

export function gerarRccPdfBuffer(
  registro: unknown,
  versao: 'cliente' | 'empresa'
): Promise<Buffer> {
  return enfileirar(() =>
    gerarPdf('scripts/sgq/rcc-pdf/generate_rcc_pdf.py', { versao, registro }, 'rcc-pdf-')
  );
}
