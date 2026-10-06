import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

const __dirnameUpload = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirnameUpload, '..', '..');

/** Pasta antiga dentro do repositório, vulnerável a reset/stash/deploy. */
export const legacyQualidadeUploadRoot = path.join(
  backendRoot,
  'var',
  'uploads',
  'qualidade'
);

/**
 * Pasta canônica fora do repositório. Deploys e operações do Git não alcançam
 * os documentos da Qualidade. `QUALIDADE_UPLOAD_DIR` sobrescreve o padrão.
 */
function resolveQualidadeUploadRoot(): string {
  const fromEnv = process.env.QUALIDADE_UPLOAD_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  const repoRoot = path.resolve(backendRoot, '..');
  return path.resolve(
    repoRoot,
    '..',
    'gestorpedidosSoAco-dados',
    'uploads',
    'qualidade'
  );
}

export const qualidadeUploadRoot = resolveQualidadeUploadRoot();

const MAX_BYTES = 25 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'text/plain',
  'text/csv',
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

/** Copia arquivos legados para a pasta externa sem apagar nem sobrescrever a origem. */
export function migrateLegacyQualidadeUploads(): number {
  if (
    path.resolve(legacyQualidadeUploadRoot) ===
    path.resolve(qualidadeUploadRoot)
  ) {
    return 0;
  }
  ensureDir(qualidadeUploadRoot);
  return copyMissingFiles(legacyQualidadeUploadRoot, qualidadeUploadRoot);
}

const EXT_MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.doc': 'application/msword',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx':
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx':
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
};

function resolveMimeType(fileName: string, mimeType: string): string {
  const normalized = (mimeType || '').trim().toLowerCase();
  if (normalized && normalized !== 'application/octet-stream' && ALLOWED_MIME.has(normalized)) {
    return normalized;
  }
  const ext = path.extname(fileName).toLowerCase();
  return EXT_MIME[ext] ?? normalized;
}

export function saveQualidadeAnexo(
  subdir: string,
  file: IncomingQualidadeAnexo
): SavedQualidadeAnexo {
  const originalName = (file.fileName || 'arquivo').trim() || 'arquivo';
  const mimeType = resolveMimeType(originalName, file.mimeType || '');
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

/**
 * Evita duplicar arquivo no disco quando o sync reenvia o mesmo conteúdo
 * (ex.: bootstrap devolveu dataUrl e o cliente reenviou no próximo PUT).
 */
export function saveQualidadeAnexoIfChanged(
  subdir: string,
  file: IncomingQualidadeAnexo,
  existingStoragePath: string | null | undefined
): SavedQualidadeAnexo {
  const contentBase64 = (file.contentBase64 || '').trim();
  if (existingStoragePath?.startsWith('/uploads/qualidade/') && contentBase64) {
    const rel = existingStoragePath
      .replace(/^\/uploads\/qualidade\//, '')
      .replace(/\//g, path.sep);
    const abs = path.join(qualidadeUploadRoot, rel);
    if (fs.existsSync(abs)) {
      try {
        const incoming = Buffer.from(contentBase64, 'base64');
        const existing = fs.readFileSync(abs);
        if (incoming.byteLength > 0 && existing.equals(incoming)) {
          const originalName = (file.fileName || 'arquivo').trim() || 'arquivo';
          const mimeType = resolveMimeType(originalName, file.mimeType || '');
          return {
            fileName: path.basename(abs),
            originalName,
            mimeType,
            sizeBytes: existing.byteLength,
            storagePath: existingStoragePath,
            publicUrl: existingStoragePath,
          };
        }
      } catch {
        /* grava novo abaixo */
      }
    }
  }
  return saveQualidadeAnexo(subdir, file);
}

export function resolveQualidadeStorageAbsPath(storagePath: string): string | null {
  const raw = (storagePath || '').trim();
  if (!raw.startsWith('/uploads/qualidade/')) return null;
  const rel = raw.replace(/^\/uploads\/qualidade\//, '').replace(/\//g, path.sep);
  if (!rel || rel.includes('..') || path.isAbsolute(rel)) return null;
  const roots = [qualidadeUploadRoot, legacyQualidadeUploadRoot].filter(
    (root, index, all) =>
      all.findIndex((candidate) => path.resolve(candidate) === path.resolve(root)) === index
  );
  const candidates: string[] = [];
  for (const candidateRoot of roots) {
    const abs = path.resolve(candidateRoot, rel);
    const root = path.resolve(candidateRoot);
    const absNorm = abs.toLowerCase();
    const rootNorm = root.toLowerCase();
    if (absNorm !== rootNorm && !absNorm.startsWith(rootNorm + path.sep)) return null;
    candidates.push(abs);
  }
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0] ?? null;
}

export function readQualidadeAnexoAsDataUrl(storagePath: string): string | null {
  const abs = resolveQualidadeStorageAbsPath(storagePath);
  if (!abs || !fs.existsSync(abs)) return null;
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
  if (!rel || rel.includes('..') || path.isAbsolute(rel)) return;
  for (const root of [qualidadeUploadRoot, legacyQualidadeUploadRoot]) {
    const abs = path.resolve(root, rel);
    const rootAbs = path.resolve(root);
    if (
      abs.toLowerCase() !== rootAbs.toLowerCase() &&
      !abs.toLowerCase().startsWith(rootAbs.toLowerCase() + path.sep)
    ) {
      continue;
    }
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  }
}
