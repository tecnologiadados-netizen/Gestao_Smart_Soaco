/**
 * Importa o pacote migration-export (people-s-rh) para o SQLite do Gestor.
 *
 * Uso:
 *   npx tsx scripts/import-rh-migration-export.ts
 *   npx tsx scripts/import-rh-migration-export.ts --apply
 *   npx tsx scripts/import-rh-migration-export.ts --dir ../migration-export --apply
 *   npx tsx scripts/import-rh-migration-export.ts --apply --import-permissions
 */

import { randomUUID } from 'crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
} from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../src/config/prisma.js';
import { seedRhDefaults } from '../src/rh/seedRhDefaults.js';
import { fileBufferToOrganicoFotoPayload } from '../src/rh/utils/organicoFotoBase64.js';
import { rhUploadRoot } from '../src/rh/utils/rhUpload.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');

type LegacyRow = Record<string, unknown>;
type LegacyTables = Record<string, LegacyRow[]>;

type PrismaBatchDelegate = {
  deleteMany: (args?: unknown) => Promise<unknown>;
  createMany: (args: { data: unknown[] }) => Promise<unknown>;
};

type ImportStep = {
  sourceKey: string;
  model: string;
  map?: (row: LegacyRow) => Record<string, unknown>;
};

function parseArgs(argv: string[]) {
  const apply = argv.includes('--apply');
  const importPermissions = argv.includes('--import-permissions');
  const skipDocs = argv.includes('--skip-docs');
  const skipFotos = argv.includes('--skip-fotos');
  const dirIdx = argv.indexOf('--dir');
  const exportDir =
    dirIdx >= 0 && argv[dirIdx + 1]
      ? argv[dirIdx + 1]!
      : join(repoRoot, 'migration-export');
  return { apply, importPermissions, skipDocs, skipFotos, exportDir: join(exportDir) };
}

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function parseLegacyDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T12:00:00.000Z`);
  const normalized = raw.replace(/(\.\d{1,2})(?=[+-]|Z|$)/, (match) => {
    const digits = match.slice(1);
    return `.${digits.padEnd(3, '0')}`;
  });
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Data inválida: ${raw}`);
  }
  return parsed;
}

function withParsedDates(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  for (const [key, value] of Object.entries(out)) {
    const isDateField =
      key.endsWith('At') ||
      key.endsWith('Em') ||
      key === 'admissao' ||
      key === 'data' ||
      key === 'dataAdmissao' ||
      key === 'dataAplicacao' ||
      key === 'dataEvento' ||
      key === 'dataAusencia' ||
      key === 'dataReferencia' ||
      key === 'occurredAt' ||
      key === 'deletedAt' ||
      key === 'hiddenAt';
    if (!isDateField) continue;
    if (typeof value === 'string' || value instanceof Date || value == null) {
      out[key] = value == null ? null : parseLegacyDate(value);
    }
  }
  return out;
}

function mapSnakeRow(row: LegacyRow, rename: Record<string, string> = {}, omit: string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (omit.includes(key)) continue;
    out[rename[key] ?? snakeToCamel(key)] = value;
  }
  return withParsedDates(out);
}

function jsonField(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function normalizeStoragePath(pathValue: string | null | undefined): string {
  const raw = String(pathValue ?? '').trim();
  if (!raw) return raw;
  if (raw.startsWith('/uploads/rh/')) return raw;
  return `/uploads/rh/${raw.replace(/^\/+/, '')}`;
}

function normalizeCoverPath(pathValue: string | null | undefined): string | null {
  const raw = String(pathValue ?? '').trim();
  if (!raw) return null;
  if (raw.startsWith('/uploads/rh/')) return raw;
  if (raw.startsWith('covers/')) return `/uploads/rh/${raw}`;
  return normalizeStoragePath(raw);
}

function delegate(model: string): PrismaBatchDelegate {
  return (prisma as unknown as Record<string, PrismaBatchDelegate>)[model];
}

function findBackupJson(exportDir: string): string {
  const candidates = readdirSync(exportDir)
    .filter((name) => name.startsWith('people-s-rh-backup') && name.endsWith('.json'))
    .sort();
  if (candidates.length === 0) {
    throw new Error(`Nenhum people-s-rh-backup-*.json em ${exportDir}`);
  }
  return join(exportDir, candidates[candidates.length - 1]!);
}

function loadBackup(exportDir: string): { path: string; tables: LegacyTables; exportedAt?: string } {
  const path = findBackupJson(exportDir);
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as {
    exportedAt?: string;
    tables?: LegacyTables;
  };
  if (!parsed.tables || typeof parsed.tables !== 'object') {
    throw new Error('Backup inválido: falta objeto tables');
  }
  return { path, tables: parsed.tables, exportedAt: parsed.exportedAt };
}

const CLEAR_MODELS = [
  'rhOrganicoLogSancaoFingerprint',
  'rhOrganicoDocumentAudit',
  'rhOrganicoDocuments',
  'rhOrganicoArchiveFolderHidden',
  'rhOrganicoArchiveFolderLocal',
  'rhOrganicoAlteracaoPendente',
  'rhOrganicoTrajetoria',
  'rhOrganicoComentarios',
  'rhOrganicoFotos',
  'rhFaltasAusenciaInconsistencias',
  'rhFaltasAlertaEnquadramentos',
  'rhFaltasAtestados',
  'rhSancoesDisciplinares',
  'rhOrganicoRepresentantes',
  'rhOrganico',
  'rhOrganicoArchiveFolderGlobal',
  'rhFaltasCadPeriodos',
  'rhFaltasCadTipos',
  'rhFaltasCadCids',
  'rhFaltasCadTiposSancoes',
  'rhFaltasCadCategoriasDocumentos',
  'rhPontualidadePontoSnapshot',
  'rhColaboradores',
  'rhCargos',
  'rhCargosInconsistencias',
  'rhCargosSalarioSetor',
  'rhCargoFaixas',
  'rhDashboardTurnover',
  'rhDashboardHeadcount',
  'rhDashboardCustoSetor',
  'rhDashboardAlertas',
  'rhRelatoriosMensais',
  'rhConfig',
  'rhReplaceSnapshots',
] as const;

const IMPORT_STEPS: ImportStep[] = [
  { sourceKey: 'config', model: 'rhConfig' },
  { sourceKey: 'cargo_faixas', model: 'rhCargoFaixas' },
  { sourceKey: 'colaboradores', model: 'rhColaboradores' },
  { sourceKey: 'cargos', model: 'rhCargos' },
  { sourceKey: 'cargos_inconsistencias', model: 'rhCargosInconsistencias' },
  { sourceKey: 'cargos_salario_setor', model: 'rhCargosSalarioSetor' },
  { sourceKey: 'dashboard_turnover', model: 'rhDashboardTurnover' },
  { sourceKey: 'dashboard_headcount', model: 'rhDashboardHeadcount' },
  { sourceKey: 'dashboard_custo_setor', model: 'rhDashboardCustoSetor' },
  { sourceKey: 'dashboard_alertas', model: 'rhDashboardAlertas' },
  { sourceKey: 'relatorios_mensais', model: 'rhRelatoriosMensais' },
  { sourceKey: 'faltas_cad_periodos', model: 'rhFaltasCadPeriodos' },
  { sourceKey: 'faltas_cad_tipos', model: 'rhFaltasCadTipos' },
  { sourceKey: 'faltas_cad_cids', model: 'rhFaltasCadCids' },
  { sourceKey: 'faltas_cad_tipos_sancoes', model: 'rhFaltasCadTiposSancoes' },
  { sourceKey: 'faltas_cad_categorias_documentos', model: 'rhFaltasCadCategoriasDocumentos' },
  { sourceKey: 'organico_archive_folder_global', model: 'rhOrganicoArchiveFolderGlobal' },
  { sourceKey: 'organico_archive_folder_local', model: 'rhOrganicoArchiveFolderLocal' },
  { sourceKey: 'organico_archive_folder_hidden', model: 'rhOrganicoArchiveFolderHidden' },
  {
    sourceKey: 'organico',
    model: 'rhOrganico',
    map: (row) =>
      withParsedDates({
        ...mapSnakeRow(row, {}, ['values']),
        valuesJson: JSON.stringify(row.values ?? []),
      }),
  },
  { sourceKey: 'organico_representantes', model: 'rhOrganicoRepresentantes' },
  { sourceKey: 'organico_trajetoria', model: 'rhOrganicoTrajetoria' },
  { sourceKey: 'organico_alteracao_pendente', model: 'rhOrganicoAlteracaoPendente' },
  { sourceKey: 'organico_comentarios', model: 'rhOrganicoComentarios' },
  { sourceKey: 'organico_log_sancao_fingerprint', model: 'rhOrganicoLogSancaoFingerprint' },
  {
    sourceKey: 'organico_documents',
    model: 'rhOrganicoDocuments',
    map: (row) => {
      const mapped = mapSnakeRow(row);
      return {
        ...mapped,
        storagePath: normalizeStoragePath(mapped.storagePath as string),
        coverStoragePath: normalizeCoverPath(mapped.coverStoragePath as string | null | undefined),
        sourcePages: jsonField(mapped.sourcePages),
      };
    },
  },
  {
    sourceKey: 'organico_document_audit',
    model: 'rhOrganicoDocumentAudit',
    map: (row) => ({
      ...mapSnakeRow(row, {}, ['details']),
      detailsJson: jsonField(row.details),
    }),
  },
  { sourceKey: 'faltas_atestados', model: 'rhFaltasAtestados' },
  { sourceKey: 'sancoes_disciplinares', model: 'rhSancoesDisciplinares' },
  {
    sourceKey: 'pontualidade_ponto_snapshot',
    model: 'rhPontualidadePontoSnapshot',
    map: (row) =>
      withParsedDates({
        ...mapSnakeRow(row, {}, ['rows']),
        rowsJson: JSON.stringify(row.rows ?? []),
      }),
  },
];

async function batchInsert(model: string, rows: Record<string, unknown>[], batchSize = 250): Promise<number> {
  const d = delegate(model);
  if (rows.length === 0) return 0;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    await d.createMany({ data: chunk });
    inserted += chunk.length;
  }
  return inserted;
}

async function clearRhData(apply: boolean): Promise<void> {
  console.log('[clear] Tabelas RH de dados (mantém regras de alerta e rh_grupo_permissao)…');
  for (const model of CLEAR_MODELS) {
    const count = apply ? await delegate(model).deleteMany() : 0;
    if (apply) console.log(`  ${model}: limpo`);
    else console.log(`  ${model}: (dry-run)`);
    void count;
  }
}

async function importTables(tables: LegacyTables, apply: boolean): Promise<number> {
  let total = 0;
  for (const step of IMPORT_STEPS) {
    const source = tables[step.sourceKey];
    const rows = Array.isArray(source) ? source : [];
    const mapped = rows.map((row) => (step.map ? step.map(row) : mapSnakeRow(row)));
    console.log(`[import] ${step.sourceKey} → ${step.model}: ${mapped.length} linha(s)`);
    if (!apply || mapped.length === 0) continue;
    await delegate(step.model).deleteMany();
    const inserted = await batchInsert(step.model, mapped);
    total += inserted;
  }
  return total;
}

function countFilesRecursive(dir: string): number {
  if (!existsSync(dir)) return 0;
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) count += countFilesRecursive(full);
    else count += 1;
  }
  return count;
}

function copyTree(src: string, dest: string, apply: boolean): number {
  if (!existsSync(src)) return 0;
  let copied = 0;
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    if (entry.isDirectory()) {
      if (apply) mkdirSync(to, { recursive: true });
      copied += copyTree(from, to, apply);
    } else {
      copied += 1;
      if (apply) {
        mkdirSync(dirname(to), { recursive: true });
        copyFileSync(from, to);
      }
    }
  }
  return copied;
}

async function copyDocuments(exportDir: string, apply: boolean): Promise<number> {
  const srcRoot = join(exportDir, 'documentos');
  if (!existsSync(srcRoot)) {
    console.warn('[docs] Pasta documentos/ não encontrada — pulando cópia de arquivos.');
    return 0;
  }
  const fileCount = countFilesRecursive(srcRoot);
  console.log(`[docs] ${fileCount} arquivo(s) em documentos/ → ${rhUploadRoot}`);
  if (apply) mkdirSync(rhUploadRoot, { recursive: true });
  return copyTree(srcRoot, rhUploadRoot, apply);
}

type FotoManifest = {
  items: Array<{
    matricula: string;
    nome: string;
    file: string;
    mimeType?: string | null;
    updatedAt?: string | null;
    updatedBy?: string | null;
  }>;
};

async function importFotos(exportDir: string, apply: boolean): Promise<{ ok: number; missing: number }> {
  const manifestPath = join(exportDir, 'fotos', 'manifest.json');
  if (!existsSync(manifestPath)) {
    console.warn('[fotos] manifest.json não encontrado — pulando.');
    return { ok: 0, missing: 0 };
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as FotoManifest;
  const items = Array.isArray(manifest.items) ? manifest.items : [];
  let ok = 0;
  let missing = 0;

  console.log(`[fotos] ${items.length} entrada(s) no manifest`);
  if (apply) await prisma.rhOrganicoFotos.deleteMany();

  for (const item of items) {
    const rel = String(item.file ?? '').replace(/\\/g, '/');
    const filePath = join(exportDir, rel);
    if (!existsSync(filePath)) {
      missing += 1;
      console.warn(`  foto ausente: ${rel}`);
      continue;
    }

    const buffer = readFileSync(filePath);
    const { payload, mimeType: detectedMime } = fileBufferToOrganicoFotoPayload(
      buffer,
      item.mimeType ? String(item.mimeType) : 'image/jpeg',
    );
    if (!payload) {
      missing += 1;
      console.warn(`  foto vazia/inválida: ${rel}`);
      continue;
    }
    ok += 1;
    if (!apply) continue;

    await prisma.rhOrganicoFotos.create({
      data: {
        id: randomUUID(),
        colaboradorMatricula: String(item.matricula),
        colaboradorNome: String(item.nome ?? ''),
        fotoBase64: payload,
        mimeType: detectedMime ?? (item.mimeType ? String(item.mimeType) : 'image/jpeg'),
        updatedBy: item.updatedBy ? String(item.updatedBy) : 'migration-import',
        updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
      },
    });
  }

  return { ok, missing };
}

async function importLegacyPermissions(tables: LegacyTables, apply: boolean): Promise<number> {
  const groups = tables.app_user_groups;
  if (!Array.isArray(groups) || groups.length === 0) {
    console.log('[perms] Nenhum app_user_groups no backup.');
    return 0;
  }

  const gestorGrupos = await prisma.grupoUsuario.findMany({ select: { id: true, nome: true } });
  const byName = new Map(gestorGrupos.map((g) => [g.nome.trim().toLowerCase(), g.id]));
  let linked = 0;

  for (const legacy of groups) {
    const name = String(legacy.name ?? '').trim().toLowerCase();
    const grupoId = byName.get(name);
    if (!grupoId) {
      console.warn(`  [perms] Grupo legado "${legacy.name}" sem correspondência em grupo_usuario — ignorado`);
      continue;
    }
    const permissions = legacy.permissions ?? {};
    console.log(`  [perms] ${legacy.name} → grupo_usuario id=${grupoId}`);
    linked += 1;
    if (!apply) continue;
    await prisma.rhGrupoPermissao.upsert({
      where: { grupoId },
      create: {
        grupoId,
        permissions: JSON.stringify(permissions),
      },
      update: {
        permissions: JSON.stringify(permissions),
      },
    });
  }

  return linked;
}

function summarizeBackup(tables: LegacyTables): void {
  console.log('\nResumo do backup:');
  for (const step of IMPORT_STEPS) {
    const n = Array.isArray(tables[step.sourceKey]) ? tables[step.sourceKey]!.length : 0;
    if (n > 0) console.log(`  ${step.sourceKey}: ${n}`);
  }
  if (Array.isArray(tables.faltas_cadastros) && tables.faltas_cadastros.length > 0) {
    console.log(`  faltas_cadastros: ${tables.faltas_cadastros.length} (legado — ignorado)`);
  }
  if (Array.isArray(tables.app_users)) console.log(`  app_users: ${tables.app_users.length} (auth legado — ignorado)`);
  if (Array.isArray(tables.app_user_groups)) console.log(`  app_user_groups: ${tables.app_user_groups.length}`);
}

async function main() {
  const { apply, importPermissions, skipDocs, skipFotos, exportDir } = parseArgs(process.argv.slice(2));

  console.log('=== Importação RH — migration-export ===');
  console.log(`Pasta: ${exportDir}`);
  console.log(`Modo: ${apply ? 'APLICAR' : 'dry-run (use --apply para gravar)'}`);
  console.log('');

  const { path: backupPath, tables, exportedAt } = loadBackup(exportDir);
  console.log(`Backup: ${backupPath}`);
  if (exportedAt) console.log(`Exportado em: ${exportedAt}`);
  summarizeBackup(tables);

  await clearRhData(apply);
  const rowsImported = await importTables(tables, apply);

  let docsCopied = 0;
  if (!skipDocs) docsCopied = await copyDocuments(exportDir, apply);

  let fotos = { ok: 0, missing: 0 };
  if (!skipFotos) fotos = await importFotos(exportDir, apply);

  let permsLinked = 0;
  if (importPermissions) permsLinked = await importLegacyPermissions(tables, apply);

  if (apply) {
    await seedRhDefaults();
    console.log('[seed] rh_faltas_alerta_regras + rh_grupo_permissao (defaults onde faltam)');
  }

  console.log('\n=== Resultado ===');
  console.log(`Linhas tabulares: ${rowsImported}`);
  console.log(`Documentos copiados: ${docsCopied}`);
  console.log(`Fotos: ${fotos.ok} importada(s), ${fotos.missing} ausente(s)`);
  if (importPermissions) console.log(`Permissões vinculadas: ${permsLinked}`);
  if (!apply) {
    console.log('\nNenhuma alteração gravada. Rode com --apply para importar de verdade.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
