import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

const __dirnameUpload = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirnameUpload, '..', '..');

const MAX_BYTES = 15 * 1024 * 1024;

const MIME_POR_EXTENSAO: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain',
};

export interface IncomingFormularioDivergencia {
  fileName: string;
  mimeType?: string;
  contentBase64: string;
}

export interface SavedFormularioDivergencia {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
}

/**
 * Pasta fora do repositório. Stash e clean do Git não alcançam o formulário.
 * `DOUBLE_CHECKIN_FORMULARIO_DIR` sobrescreve o padrão.
 */
function resolveFormularioRoot(): string {
  const fromEnv = process.env.DOUBLE_CHECKIN_FORMULARIO_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  const repoRoot = path.resolve(backendRoot, '..');
  return path.resolve(repoRoot, '..', 'gestorpedidosSoAco-dados', 'uploads', 'double-checkin-formularios');
}

export const doubleCheckInFormularioRoot = resolveFormularioRoot();

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function nomeOriginalSeguro(fileName: string, ext: string): string {
  const base = path.basename(String(fileName || '').replace(/[\\/]/g, '')).replace(/[\u0000-\u001f]/g, '').trim();
  const limitado = (base || `formulario-divergencia${ext}`).slice(0, 180);
  return limitado.toLowerCase().endsWith(ext) ? limitado : `${limitado}${ext}`;
}

export function validarArquivoFormularioDivergencia(file: IncomingFormularioDivergencia): {
  buffer: Buffer;
  ext: string;
  mimeType: string;
  originalName: string;
} {
  const originalBruto = String(file.fileName || '').trim();
  const ext = path.extname(originalBruto).toLowerCase();
  const mimeType = MIME_POR_EXTENSAO[ext];
  if (!mimeType) {
    throw new Error('Envie PDF, imagem, Word, Excel ou TXT. O formulário de divergência não é obrigatório.');
  }
  const contentBase64 = String(file.contentBase64 || '').trim();
  if (!contentBase64) {
    throw new Error('O arquivo do formulário de divergência está vazio.');
  }
  const buffer = Buffer.from(contentBase64, 'base64');
  if (buffer.byteLength <= 0 || buffer.byteLength > MAX_BYTES) {
    throw new Error(`O formulário é inválido ou excede ${Math.round(MAX_BYTES / 1024 / 1024)} MB.`);
  }
  return {
    buffer,
    ext,
    mimeType,
    originalName: nomeOriginalSeguro(originalBruto, ext),
  };
}

export function saveDoubleCheckInFormulario(
  file: IncomingFormularioDivergencia
): SavedFormularioDivergencia {
  const validado = validarArquivoFormularioDivergencia(file);
  const grupoId = randomUUID();
  const dir = path.join(doubleCheckInFormularioRoot, grupoId);
  ensureDir(dir);
  const fileName = `${Date.now()}-${randomUUID()}${validado.ext}`;
  fs.writeFileSync(path.join(dir, fileName), validado.buffer);
  return {
    originalName: validado.originalName,
    mimeType: validado.mimeType,
    sizeBytes: validado.buffer.byteLength,
    storagePath: path.join(grupoId, fileName),
  };
}

export function resolveDoubleCheckInFormularioAbsPath(storagePath: string | null | undefined): string | null {
  if (!storagePath) return null;
  const normalizado = storagePath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalizado || normalizado.includes('..')) return null;
  const abs = path.resolve(doubleCheckInFormularioRoot, ...normalizado.split('/'));
  const root = path.resolve(doubleCheckInFormularioRoot);
  if (abs !== root && !abs.startsWith(root + path.sep)) return null;
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return null;
  return abs;
}
