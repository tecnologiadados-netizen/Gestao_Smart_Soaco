/**
 * Reimporta apenas rh_organico_fotos a partir de migration-export/fotos.
 * Não apaga orgânico, faltas nem demais tabelas RH.
 *
 * Uso:
 *   npx tsx scripts/reimport-rh-fotos.ts
 *   npx tsx scripts/reimport-rh-fotos.ts --apply
 *   npx tsx scripts/reimport-rh-fotos.ts --dir ../migration-export --apply
 */
import { randomUUID } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../src/config/prisma.js';
import { fileBufferToOrganicoFotoPayload } from '../src/rh/utils/organicoFotoBase64.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

function parseArgs(argv: string[]) {
  const apply = argv.includes('--apply');
  const dirIdx = argv.indexOf('--dir');
  const exportDir =
    dirIdx >= 0 && argv[dirIdx + 1]
      ? join(process.cwd(), argv[dirIdx + 1]!)
      : join(__dirname, '../../migration-export');
  return { apply, exportDir };
}

async function main() {
  const { apply, exportDir } = parseArgs(process.argv.slice(2));
  const manifestPath = join(exportDir, 'fotos', 'manifest.json');
  if (!existsSync(manifestPath)) {
    throw new Error(`manifest não encontrado: ${manifestPath}`);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as FotoManifest;
  const items = Array.isArray(manifest.items) ? manifest.items : [];
  let ok = 0;
  let missing = 0;

  console.log(`[fotos] ${items.length} entrada(s) — modo ${apply ? 'APLICAR' : 'dry-run'}`);
  if (apply) await prisma.rhOrganicoFotos.deleteMany();

  for (const item of items) {
    const rel = String(item.file ?? '').replace(/\\/g, '/');
    const filePath = join(exportDir, rel);
    if (!existsSync(filePath)) {
      missing += 1;
      console.warn(`  ausente: ${rel}`);
      continue;
    }

    const buffer = readFileSync(filePath);
    const { payload, mimeType } = fileBufferToOrganicoFotoPayload(
      buffer,
      item.mimeType ? String(item.mimeType) : 'image/jpeg',
    );
    if (!payload) {
      missing += 1;
      console.warn(`  inválida: ${rel}`);
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
        mimeType: mimeType ?? 'image/jpeg',
        updatedBy: item.updatedBy ? String(item.updatedBy) : 'migration-import',
        updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
      },
    });
  }

  console.log(`[fotos] ${ok} ok, ${missing} ausente(s)/inválida(s)`);
  if (!apply) console.log('Nenhuma alteração gravada. Use --apply para gravar.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
