/**
 * Cria ou atualiza os grupos "RH - Gestão" e "RH - Operacional" com permissões
 * do arquivo migration-export/permissoes-grupos-rh.json.
 *
 * Uso:
 *   npx tsx scripts/seed-rh-grupos-permissoes.ts
 *   npx tsx scripts/seed-rh-grupos-permissoes.ts --apply
 *   npx tsx scripts/seed-rh-grupos-permissoes.ts --dir ../migration-export --apply
 */

import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../src/config/prisma.js';
import { PERMISSOES } from '../src/config/permissoes.js';
import { normalizeRhPermissions } from '../src/rh/lib/rh-permissions.js';
import { setGrupoPermissions } from '../src/rh/services/rhPermissionsService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');

type LegacyRhGroup = {
  name: string;
  description?: string;
  permissions: unknown;
};

function parseArgs(argv: string[]) {
  const apply = argv.includes('--apply');
  const dirIdx = argv.indexOf('--dir');
  const exportDir =
    dirIdx >= 0 && argv[dirIdx + 1]
      ? argv[dirIdx + 1]!
      : join(repoRoot, 'migration-export');
  return { apply, exportDir: join(exportDir) };
}

function parsePermissoesGestao(json: string): string[] {
  try {
    const arr = JSON.parse(json) as string[];
    return Array.isArray(arr) ? arr.filter((p) => typeof p === 'string') : [];
  } catch {
    return [];
  }
}

function mergePermissoesGestao(current: string[], required: string[]): string[] {
  const set = new Set(current);
  for (const code of required) set.add(code);
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function loadRhGroups(exportDir: string): LegacyRhGroup[] {
  const path = join(exportDir, 'permissoes-grupos-rh.json');
  if (!existsSync(path)) {
    throw new Error(`Arquivo não encontrado: ${path}`);
  }
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as LegacyRhGroup[];
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('permissoes-grupos-rh.json inválido ou vazio');
  }
  return parsed;
}

async function upsertRhGroup(entry: LegacyRhGroup, apply: boolean): Promise<void> {
  const name = String(entry.name ?? '').trim();
  if (!name) throw new Error('Entrada sem nome de grupo');

  const description = String(entry.description ?? '').trim() || null;
  const rhPerms = normalizeRhPermissions(entry.permissions);
  const gestaoRequired = [PERMISSOES.RH_VER];

  const existing = await prisma.grupoUsuario.findUnique({ where: { nome: name } });

  if (!existing) {
    console.log(`  [+] Criar grupo "${name}"`);
    if (!apply) return;

    const grupo = await prisma.grupoUsuario.create({
      data: {
        nome: name,
        descricao: description,
        permissoes: JSON.stringify(gestaoRequired),
        ativo: true,
      },
    });
    await setGrupoPermissions(grupo.id, rhPerms);
    console.log(`      id=${grupo.id}, rh.ver + permissões RH gravadas`);
    return;
  }

  const merged = mergePermissoesGestao(parsePermissoesGestao(existing.permissoes), gestaoRequired);
  const needsGestaoUpdate = merged.length !== parsePermissoesGestao(existing.permissoes).length;
  const needsDescUpdate = (existing.descricao ?? '') !== (description ?? '');

  console.log(`  [~] Atualizar grupo "${name}" (id=${existing.id})`);
  if (!apply) return;

  if (needsGestaoUpdate || needsDescUpdate) {
    await prisma.grupoUsuario.update({
      where: { id: existing.id },
      data: {
        ...(needsDescUpdate ? { descricao: description } : {}),
        ...(needsGestaoUpdate ? { permissoes: JSON.stringify(merged) } : {}),
      },
    });
  }

  await setGrupoPermissions(existing.id, rhPerms);
  console.log(`      permissões RH atualizadas${needsGestaoUpdate ? ', rh.ver garantido' : ''}`);
}

async function main() {
  const { apply, exportDir } = parseArgs(process.argv.slice(2));

  console.log('=== Seed grupos RH (Gestão Smart) ===');
  console.log(`Pasta: ${exportDir}`);
  console.log(`Modo: ${apply ? 'APLICAR' : 'dry-run (use --apply para gravar)'}`);
  console.log('');

  const entries = loadRhGroups(exportDir);
  console.log(`${entries.length} grupo(s) no JSON:`);
  for (const entry of entries) {
    console.log(`  - ${entry.name}`);
  }
  console.log('');

  for (const entry of entries) {
    await upsertRhGroup(entry, apply);
  }

  if (!apply) {
    console.log('\nNenhuma alteração gravada. Rode com --apply para criar/atualizar os grupos.');
  } else {
    console.log('\nConcluído.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
