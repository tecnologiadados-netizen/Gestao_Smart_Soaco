import fs from 'fs';
import path from 'path';
import { createHash, randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

const __dirnameUpload = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirnameUpload, '..', '..', '..');
export const rhUploadRoot = path.join(backendRoot, 'var', 'uploads', 'rh');

export const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024;

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function sanitizeStorageSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'arquivo';
}

export function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function rhStoragePath(matricula: string, documentId: string, originalName: string): string {
  const fileName = sanitizeStorageSegment(originalName);
  return `/uploads/rh/${matricula}/${documentId}/${fileName}`.replace(/\\/g, '/');
}

export function rhCoverStoragePath(documentId: string): string {
  return `/uploads/rh/covers/${documentId}.webp`.replace(/\\/g, '/');
}

export function saveRhFile(relativePath: string, buffer: Buffer): string {
  const rel = relativePath.replace(/^\/uploads\/rh\//, '').replace(/\//g, path.sep);
  const abs = path.join(rhUploadRoot, rel);
  ensureDir(path.dirname(abs));
  fs.writeFileSync(abs, buffer);
  return `/uploads/rh/${rel.replace(/\\/g, '/')}`;
}

export function readRhFileAsBuffer(storagePath: string): Buffer | null {
  if (!storagePath?.startsWith('/uploads/rh/')) return null;
  const rel = storagePath.replace(/^\/uploads\/rh\//, '').replace(/\//g, path.sep);
  const abs = path.join(rhUploadRoot, rel);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs);
}

export function deleteRhFileIfExists(storagePath: string | null | undefined): void {
  if (!storagePath?.startsWith('/uploads/rh/')) return;
  const rel = storagePath.replace(/^\/uploads\/rh\//, '').replace(/\//g, path.sep);
  const abs = path.join(rhUploadRoot, rel);
  if (fs.existsSync(abs)) fs.unlinkSync(abs);
}

export function newDocumentId(): string {
  return randomUUID();
}
