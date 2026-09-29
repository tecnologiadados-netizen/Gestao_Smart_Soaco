import fs from 'fs';
import path from 'path';
import { createHash, randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

const __dirnameUpload = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirnameUpload, '..', '..', '..');

/** Cópia antiga, dentro do repositório. `git stash -u` já varreu esta pasta. */
export const legacyRhUploadRoot = path.join(backendRoot, 'var', 'uploads', 'rh');

/**
 * Pasta canônica, irmã do repositório (`C:\gestorpedidosSoAco-dados\uploads\rh`).
 * Fica fora do Git: stash, reset e clean no projeto não alcançam os atestados.
 * `RH_UPLOAD_DIR` sobrescreve o padrão.
 */
function resolveRhUploadRoot(): string {
  const fromEnv = process.env.RH_UPLOAD_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  const repoRoot = path.resolve(backendRoot, '..');
  return path.resolve(repoRoot, '..', 'gestorpedidosSoAco-dados', 'uploads', 'rh');
}

export const rhUploadRoot = resolveRhUploadRoot();

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

function relativeFromStoragePath(storagePath: string): string | null {
  if (!storagePath?.startsWith('/uploads/rh/')) return null;
  return storagePath.replace(/^\/uploads\/rh\//, '').replace(/\//g, path.sep);
}

function candidateAbsPaths(storagePath: string): string[] {
  const rel = relativeFromStoragePath(storagePath);
  if (!rel) return [];
  const primary = path.join(rhUploadRoot, rel);
  const legacy = path.join(legacyRhUploadRoot, rel);
  return path.resolve(primary) === path.resolve(legacy) ? [primary] : [primary, legacy];
}

export function rhFileExists(storagePath: string | null | undefined): boolean {
  if (!storagePath) return false;
  return candidateAbsPaths(storagePath).some((abs) => fs.existsSync(abs));
}

export function readRhFileAsBuffer(storagePath: string): Buffer | null {
  for (const abs of candidateAbsPaths(storagePath)) {
    if (fs.existsSync(abs)) return fs.readFileSync(abs);
  }
  return null;
}

export function deleteRhFileIfExists(storagePath: string | null | undefined): void {
  if (!storagePath) return;
  for (const abs of candidateAbsPaths(storagePath)) {
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  }
}

function copyMissingFiles(srcDir: string, destDir: string): number {
  if (!fs.existsSync(srcDir)) return 0;
  let copied = 0;
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const from = path.join(srcDir, entry.name);
    const to = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copied += copyMissingFiles(from, to);
      continue;
    }
    if (!entry.isFile() || fs.existsSync(to)) continue;
    ensureDir(path.dirname(to));
    fs.copyFileSync(from, to);
    copied += 1;
  }
  return copied;
}

/** Copia para a pasta externa o que ainda só existe dentro do repositório. Não apaga a origem. */
export function migrateLegacyRhUploads(): number {
  if (path.resolve(legacyRhUploadRoot) === path.resolve(rhUploadRoot)) return 0;
  ensureDir(rhUploadRoot);
  return copyMissingFiles(legacyRhUploadRoot, rhUploadRoot);
}

export function newDocumentId(): string {
  return randomUUID();
}
