import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

const __dirnameUpload = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirnameUpload, '..', '..');
export const previsaoAssinaturaUploadRoot = path.join(
  backendRoot,
  'var',
  'uploads',
  'previsao-assinaturas',
);

const MAX_BYTES = 15 * 1024 * 1024;

export interface IncomingPrevisaoAssinaturaPdf {
  fileName: string;
  mimeType?: string;
  contentBase64: string;
}

export interface SavedPrevisaoAssinaturaPdf {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  grupoId: string;
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function isPdfMime(mimeType: string, fileName: string): boolean {
  const mime = mimeType.trim().toLowerCase();
  const ext = path.extname(fileName).toLowerCase();
  return mime === 'application/pdf' || ext === '.pdf';
}

export function savePrevisaoAssinaturaPdf(
  file: IncomingPrevisaoAssinaturaPdf,
  grupoId = randomUUID(),
): SavedPrevisaoAssinaturaPdf {
  const originalName =
    (file.fileName || 'assinatura-justificativa.pdf').trim() ||
    'assinatura-justificativa.pdf';
  const mimeType = (file.mimeType || '').trim().toLowerCase() || 'application/pdf';
  const contentBase64 = (file.contentBase64 || '').trim();

  if (!isPdfMime(mimeType, originalName)) {
    throw new Error('Envie apenas PDF assinado (.pdf).');
  }
  if (!contentBase64) {
    throw new Error('Conteúdo do PDF vazio.');
  }

  const buffer = Buffer.from(contentBase64, 'base64');
  if (buffer.byteLength <= 0 || buffer.byteLength > MAX_BYTES) {
    throw new Error(
      `PDF inválido ou excede ${Math.round(MAX_BYTES / 1024 / 1024)}MB.`,
    );
  }

  const dir = path.join(previsaoAssinaturaUploadRoot, grupoId);
  ensureDir(dir);
  const fileName = `${Date.now()}-${randomUUID()}.pdf`;
  const absPath = path.join(dir, fileName);
  fs.writeFileSync(absPath, buffer);

  const storagePath = `/uploads/previsao-assinaturas/${grupoId}/${fileName}`.replace(
    /\\/g,
    '/',
  );
  return {
    originalName: originalName.toLowerCase().endsWith('.pdf')
      ? originalName
      : `${originalName}.pdf`,
    mimeType: 'application/pdf',
    sizeBytes: buffer.byteLength,
    storagePath,
    grupoId,
  };
}

export function resolvePrevisaoAssinaturaAbsPath(
  storagePath: string | null | undefined,
): string | null {
  if (!storagePath?.startsWith('/uploads/previsao-assinaturas/')) return null;
  const rel = storagePath
    .replace(/^\/uploads\/previsao-assinaturas\//, '')
    .replace(/\//g, path.sep);
  const abs = path.join(previsaoAssinaturaUploadRoot, rel);
  if (!fs.existsSync(abs)) return null;
  return abs;
}
