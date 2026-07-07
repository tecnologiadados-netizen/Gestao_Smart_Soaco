import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

const __dirnameUpload = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirnameUpload, '..', '..');
export const qualidadeUploadRoot = path.join(backendRoot, 'var', 'uploads', 'qualidade');

const MAX_BYTES = 15 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.ms-excel',
  'text/plain',
]);

export interface IncomingQualidadeAnexo {
  fileName: string;
  mimeType: string;
  contentBase64: string;
  sizeBytes?: number;
}

export interface SavedQualidadeAnexo {
  fileName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  publicUrl: string;
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function saveQualidadeAnexo(
  subdir: string,
  file: IncomingQualidadeAnexo
): SavedQualidadeAnexo {
  const originalName = (file.fileName || 'arquivo').trim() || 'arquivo';
  const mimeType = (file.mimeType || '').trim().toLowerCase();
  const contentBase64 = (file.contentBase64 || '').trim();

  if (!ALLOWED_MIME.has(mimeType)) {
    throw new Error(`Tipo de arquivo não permitido: ${mimeType || originalName}`);
  }
  if (!contentBase64) {
    throw new Error(`Conteúdo vazio no anexo: ${originalName}`);
  }

  const buffer = Buffer.from(contentBase64, 'base64');
  if (buffer.byteLength <= 0 || buffer.byteLength > MAX_BYTES) {
    throw new Error(
      `Anexo inválido ou excede ${Math.round(MAX_BYTES / 1024 / 1024)}MB: ${originalName}`
    );
  }

  const safeExt = path.extname(originalName).replace(/[^a-zA-Z0-9.]/g, '').slice(0, 12);
  const fileName = `${Date.now()}-${randomUUID()}${safeExt || ''}`;
  const dir = path.join(qualidadeUploadRoot, subdir);
  ensureDir(dir);
  const absPath = path.join(dir, fileName);
  fs.writeFileSync(absPath, buffer);

  const storagePath = `/uploads/qualidade/${subdir}/${fileName}`.replace(/\\/g, '/');
  return {
    fileName,
    originalName,
    mimeType,
    sizeBytes: buffer.byteLength,
    storagePath,
    publicUrl: storagePath,
  };
}

export function readQualidadeAnexoAsDataUrl(storagePath: string): string | null {
  if (!storagePath) return null;
  const rel = storagePath.replace(/^\/uploads\/qualidade\//, '').replace(/\//g, path.sep);
  const abs = path.join(qualidadeUploadRoot, rel);
  if (!fs.existsSync(abs)) return null;
  const buf = fs.readFileSync(abs);
  const ext = path.extname(abs).toLowerCase();
  const mime =
    ext === '.pdf'
      ? 'application/pdf'
      : ext === '.png'
        ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg'
          ? 'image/jpeg'
          : 'application/octet-stream';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

export function deleteQualidadeAnexoIfExists(storagePath: string | null | undefined) {
  if (!storagePath?.startsWith('/uploads/qualidade/')) return;
  const rel = storagePath.replace(/^\/uploads\/qualidade\//, '').replace(/\//g, path.sep);
  const abs = path.join(qualidadeUploadRoot, rel);
  if (fs.existsSync(abs)) fs.unlinkSync(abs);
}
