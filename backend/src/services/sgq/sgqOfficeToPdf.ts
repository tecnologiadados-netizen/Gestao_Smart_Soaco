import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveQualidadeStorageAbsPath } from '../../utils/qualidadeUpload.js';

const OFFICE_EXT = new Set(['.xlsx', '.xls', '.csv', '.docx', '.doc', '.pptx', '.ppt']);
const NATIVE_EXT = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg']);

const __dirnameLocal = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = path.resolve(__dirnameLocal, '../../../scripts/sgq-office-to-pdf.ps1');
const CONVERT_TIMEOUT_MS = 120_000;

let queue: Promise<unknown> = Promise.resolve();

function withOfficeLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function runPowershell(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      'powershell.exe',
      [
        '-NoProfile',
        '-STA',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        SCRIPT_PATH,
        '-In',
        inputPath,
        '-Out',
        outputPath,
      ],
      { windowsHide: true, timeout: CONVERT_TIMEOUT_MS },
      (err, stdout, stderr) => {
        if (err) {
          const detail = String(stderr || stdout || err.message).trim();
          reject(new Error(detail || 'Falha ao converter o documento para visualização.'));
          return;
        }
        resolve();
      }
    );
    child.on('error', reject);
  });
}

export function isNativePreviewExt(ext: string): boolean {
  return NATIVE_EXT.has(ext.toLowerCase());
}

export function isOfficePreviewExt(ext: string): boolean {
  return OFFICE_EXT.has(ext.toLowerCase());
}

export async function ensureQualidadePreviewPdf(storagePath: string): Promise<string> {
  const abs = resolveQualidadeStorageAbsPath(storagePath);
  if (!abs || !fs.existsSync(abs)) {
    throw new Error('Arquivo indisponível no servidor.');
  }

  const ext = path.extname(abs).toLowerCase();
  if (ext === '.pdf') {
    return storagePath;
  }
  if (!isOfficePreviewExt(ext)) {
    throw new Error('Este formato não tem visualização nativa no navegador.');
  }

  const previewAbs = `${abs}.preview.pdf`;
  const previewUrl = `${storagePath}.preview.pdf`;
  const srcStat = fs.statSync(abs);
  if (fs.existsSync(previewAbs)) {
    const prevStat = fs.statSync(previewAbs);
    if (prevStat.size > 0 && prevStat.mtimeMs >= srcStat.mtimeMs) {
      return previewUrl;
    }
  }

  const tmpAbs = `${previewAbs}.${process.pid}.tmp.pdf`;
  if (fs.existsSync(tmpAbs)) fs.unlinkSync(tmpAbs);

  await withOfficeLock(async () => {
    try {
      await runPowershell(abs, tmpAbs);
      if (!fs.existsSync(tmpAbs) || fs.statSync(tmpAbs).size < 100) {
        throw new Error('Não foi possível gerar a visualização do documento.');
      }
      fs.renameSync(tmpAbs, previewAbs);
    } catch (err) {
      if (fs.existsSync(tmpAbs)) fs.unlinkSync(tmpAbs);
      throw err;
    }
  });

  return previewUrl;
}
