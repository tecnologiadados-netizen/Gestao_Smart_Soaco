import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

const __dirnameUpload = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirnameUpload, '..', '..');
export const crmCreditoPdfUploadRoot = path.join(
  backendRoot,
  'var',
  'uploads',
  'crm-credito'
);

const MAX_BYTES = 15 * 1024 * 1024;

export interface IncomingCrmCreditoPdf {
  fileName: string;
  mimeType: string;
  contentBase64: string;
}

export interface SavedCrmCreditoPdf {
  fileName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function isPdfMime(mimeType: string, fileName: string): boolean {
  const mime = mimeType.trim().toLowerCase();
  const ext = path.extname(fileName).toLowerCase();
  return mime === 'application/pdf' || ext === '.pdf';
}

export function saveCrmCreditoPdfAssinado(
  pendenciaId: number,
  file: IncomingCrmCreditoPdf
): SavedCrmCreditoPdf {
  const originalName = (file.fileName || 'aprovacao-assinada.pdf').trim() || 'aprovacao-assinada.pdf';
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
      `PDF inválido ou excede ${Math.round(MAX_BYTES / 1024 / 1024)}MB.`
    );
  }

  const dir = path.join(crmCreditoPdfUploadRoot, String(pendenciaId));
  ensureDir(dir);
  const fileName = `${Date.now()}-${randomUUID()}.pdf`;
  const absPath = path.join(dir, fileName);
  fs.writeFileSync(absPath, buffer);

  const storagePath = `/uploads/crm-credito/${pendenciaId}/${fileName}`.replace(
    /\\/g,
    '/'
  );
  return {
    fileName,
    originalName: originalName.toLowerCase().endsWith('.pdf')
      ? originalName
      : `${originalName}.pdf`,
    mimeType: 'application/pdf',
    sizeBytes: buffer.byteLength,
    storagePath,
  };
}

export function resolveCrmCreditoPdfAbsPath(
  storagePath: string | null | undefined
): string | null {
  if (!storagePath?.startsWith('/uploads/crm-credito/')) return null;
  const rel = storagePath
    .replace(/^\/uploads\/crm-credito\//, '')
    .replace(/\//g, path.sep);
  const abs = path.join(crmCreditoPdfUploadRoot, rel);
  if (!fs.existsSync(abs)) return null;
  return abs;
}

export function deleteCrmCreditoPdfIfExists(
  storagePath: string | null | undefined
) {
  const abs = resolveCrmCreditoPdfAbsPath(storagePath);
  if (abs && fs.existsSync(abs)) fs.unlinkSync(abs);
}
