import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirnameService = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirnameService, '..', '..');

function executarPython(
  scriptRelative: string,
  payload: string,
  outputPath: string
): Promise<{ stderr: string; code: number | null }> {
  const scriptPath = path.join(backendRoot, scriptRelative);
  const pythonCmd = process.env.PYTHON_PATH || 'python';

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
    child.on('error', reject);
    child.on('close', (code) => resolve({ stderr, code }));
    child.stdin.write(payload, 'utf8');
    child.stdin.end();
  });
}

export async function gerarRncPdfBuffer(registro: unknown): Promise<Buffer> {
  let tempDir: string | undefined;
  try {
    tempDir = await mkdtemp(path.join(tmpdir(), 'rnc-pdf-'));
    const outputPath = path.join(tempDir, 'relatorio.pdf');
    const payload = JSON.stringify({ registro });

    const { stderr, code } = await executarPython(
      'scripts/sgq/rnc-pdf/generate_rnc_pdf.py',
      payload,
      outputPath
    );
    if (code !== 0) {
      throw new Error(stderr.trim() || 'Falha ao executar o gerador Python do RNC.');
    }

    return await readFile(outputPath);
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}

export async function gerarRccPdfBuffer(
  registro: unknown,
  versao: 'cliente' | 'empresa'
): Promise<Buffer> {
  let tempDir: string | undefined;
  try {
    tempDir = await mkdtemp(path.join(tmpdir(), 'rcc-pdf-'));
    const outputPath = path.join(tempDir, 'relatorio.pdf');
    const payload = JSON.stringify({ versao, registro });

    const { stderr, code } = await executarPython(
      'scripts/sgq/rcc-pdf/generate_rcc_pdf.py',
      payload,
      outputPath
    );
    if (code !== 0) {
      throw new Error(stderr.trim() || 'Falha ao executar o gerador Python do RCC.');
    }

    return await readFile(outputPath);
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}
