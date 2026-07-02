/**
 * Gera PDF de cotação via subprocess Python + Microsoft Word.
 */
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink } from 'fs/promises';
import { mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Lock serial — Word COM não suporta conversões paralelas. */
let pdfQueue: Promise<unknown> = Promise.resolve();

function resolveBackendRoot(): string {
  // src/services → backend root; dist/services → dist root (assets copiados no build)
  const fromServices = join(__dirname, '..', '..');
  return fromServices;
}

function resolvePythonExecutable(): string {
  return process.env.PRE_COMPRA_PYTHON?.trim() || 'python';
}

function resolveScriptPath(): string {
  return join(resolveBackendRoot(), 'python', 'pre_compra', 'generate_pdf_cli.py');
}

function resolveTemplatePath(): string {
  return join(resolveBackendRoot(), 'assets', 'pre-compra', 'formulario_cotacao.docx');
}

const PDF_TIMEOUT_MS = 120_000;

export async function gerarPdfPreCompra(data: Record<string, unknown>): Promise<Buffer> {
  const run = async (): Promise<Buffer> => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'pre-compra-pdf-'));
    const jsonPath = join(tmpDir, 'input.json');
    const pdfPath = join(tmpDir, 'output.pdf');

    try {
      await writeFile(jsonPath, JSON.stringify(data), 'utf-8');

      const python = resolvePythonExecutable();
      const script = resolveScriptPath();

      await execFileAsync(python, [script, jsonPath, pdfPath], {
        timeout: PDF_TIMEOUT_MS,
        windowsHide: true,
        cwd: dirname(script),
      });

      return await readFile(pdfPath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Não foi possível gerar o PDF. Verifique Python (${resolvePythonExecutable()}), ` +
          `dependências (pip install -r backend/python/pre_compra/requirements.txt) e Microsoft Word. ` +
          `Template: ${resolveTemplatePath()}. Detalhe: ${msg}`
      );
    } finally {
      await unlink(jsonPath).catch(() => {});
      await unlink(pdfPath).catch(() => {});
    }
  };

  const task = pdfQueue.then(run, run);
  pdfQueue = task.catch(() => {});
  return task;
}
