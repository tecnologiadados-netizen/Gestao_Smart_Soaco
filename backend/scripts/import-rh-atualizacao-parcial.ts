/**
 * Importa um backup PARCIAL do people-s-rh (faltas/atestados, sanções e cadastros de faltas),
 * substituindo apenas essas tabelas no SQLite do Gestor.
 *
 * Uso:
 *   npx tsx scripts/import-rh-atualizacao-parcial.ts --file ../migration-export/people-s-rh-atualizacao-....json
 *   npx tsx scripts/import-rh-atualizacao-parcial.ts --file ... --apply
 */

import { readFileSync } from 'fs';
import { isAbsolute, join } from 'path';
import { prisma } from '../src/config/prisma.js';

type LegacyRow = Record<string, unknown>;
type LegacyTables = Record<string, LegacyRow[]>;

type PrismaBatchDelegate = {
  deleteMany: (args?: unknown) => Promise<unknown>;
  createMany: (args: { data: unknown[] }) => Promise<unknown>;
  count: (args?: unknown) => Promise<number>;
};

const IMPORT_STEPS: Array<{ sourceKey: string; model: string }> = [
  { sourceKey: 'faltas_cad_periodos', model: 'rhFaltasCadPeriodos' },
  { sourceKey: 'faltas_cad_tipos', model: 'rhFaltasCadTipos' },
  { sourceKey: 'faltas_cad_cids', model: 'rhFaltasCadCids' },
  { sourceKey: 'faltas_cad_tipos_sancoes', model: 'rhFaltasCadTiposSancoes' },
  { sourceKey: 'faltas_cad_categorias_documentos', model: 'rhFaltasCadCategoriasDocumentos' },
  { sourceKey: 'faltas_atestados', model: 'rhFaltasAtestados' },
  { sourceKey: 'sancoes_disciplinares', model: 'rhSancoesDisciplinares' },
];

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

function mapSnakeRow(row: LegacyRow): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[snakeToCamel(key)] = value;
  }
  for (const [key, value] of Object.entries(out)) {
    const isDateField = key.endsWith('At') || key === 'data' || key === 'dataAplicacao';
    if (!isDateField) continue;
    if (typeof value === 'string' || value instanceof Date || value == null) {
      out[key] = value == null ? null : parseLegacyDate(value);
    }
  }
  return out;
}

function delegate(model: string): PrismaBatchDelegate {
  return (prisma as unknown as Record<string, PrismaBatchDelegate>)[model];
}

async function batchInsert(model: string, rows: Record<string, unknown>[], batchSize = 250): Promise<number> {
  const d = delegate(model);
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    await d.createMany({ data: chunk });
    inserted += chunk.length;
  }
  return inserted;
}

async function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const fileIdx = argv.indexOf('--file');
  if (fileIdx < 0 || !argv[fileIdx + 1]) {
    throw new Error('Informe o arquivo: --file <caminho do people-s-rh-atualizacao-*.json>');
  }
  const filePath = isAbsolute(argv[fileIdx + 1]!) ? argv[fileIdx + 1]! : join(process.cwd(), argv[fileIdx + 1]!);

  console.log('=== Atualização parcial RH (faltas, sanções e cadastros) ===');
  console.log(`Arquivo: ${filePath}`);
  console.log(`Modo: ${apply ? 'APLICAR' : 'dry-run (use --apply para gravar)'}`);
  console.log('');

  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as {
    exportedAt?: string;
    includedTables?: string[];
    tables?: LegacyTables;
  };
  if (!parsed.tables || typeof parsed.tables !== 'object') {
    throw new Error('Backup inválido: falta objeto tables');
  }
  if (parsed.exportedAt) console.log(`Exportado em: ${parsed.exportedAt}`);

  const tables = parsed.tables;

  // Diagnóstico de órfãos: inconsistências/enquadramentos que apontam para faltas que deixarão de existir.
  const novasFaltasIds = new Set(
    (tables.faltas_atestados ?? []).map((r) => String(r.id ?? '')).filter(Boolean),
  );
  const [inconsistencias, enquadramentos] = await Promise.all([
    prisma.rhFaltasAusenciaInconsistencias.findMany({ select: { id: true, faltaId: true } }),
    prisma.rhFaltasAlertaEnquadramentos.findMany({ select: { id: true, faltaId: true } }),
  ]);
  const inconsistenciasOrfas = inconsistencias.filter((i) => !novasFaltasIds.has(i.faltaId));
  const enquadramentosOrfaos = enquadramentos.filter((e) => !novasFaltasIds.has(e.faltaId));
  console.log(
    `Inconsistências de ausência: ${inconsistencias.length} no banco, ${inconsistenciasOrfas.length} ficariam órfãs (falta não existe no novo backup)`,
  );
  console.log(
    `Enquadramentos de alerta: ${enquadramentos.length} no banco, ${enquadramentosOrfaos.length} ficariam órfãos`,
  );

  let total = 0;
  for (const step of IMPORT_STEPS) {
    const source = tables[step.sourceKey];
    const rows = Array.isArray(source) ? source : [];
    const mapped = rows.map(mapSnakeRow);
    const atual = await delegate(step.model).count();
    console.log(`[import] ${step.sourceKey} → ${step.model}: banco atual ${atual} → backup ${mapped.length}`);
    if (!apply) continue;
    await delegate(step.model).deleteMany();
    total += await batchInsert(step.model, mapped);
  }

  if (apply) {
    // Remove vínculos órfãos para não exibir alertas de faltas que não existem mais.
    if (inconsistenciasOrfas.length > 0) {
      await prisma.rhFaltasAusenciaInconsistencias.deleteMany({
        where: { id: { in: inconsistenciasOrfas.map((i) => i.id) } },
      });
      console.log(`[limpeza] ${inconsistenciasOrfas.length} inconsistência(s) órfã(s) removida(s)`);
    }
    if (enquadramentosOrfaos.length > 0) {
      await prisma.rhFaltasAlertaEnquadramentos.deleteMany({
        where: { id: { in: enquadramentosOrfaos.map((e) => e.id) } },
      });
      console.log(`[limpeza] ${enquadramentosOrfaos.length} enquadramento(s) órfão(s) removido(s)`);
    }
  }

  console.log('');
  console.log(apply ? `Concluído. Linhas gravadas: ${total}` : 'Dry-run: nenhuma alteração gravada.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
