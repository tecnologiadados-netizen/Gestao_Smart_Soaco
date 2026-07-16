/**
 * Copia os modelos oficiais de planilha (raiz do repositório) para
 * frontend/public e backend/public — servidos em /modelo-*.xlsx.
 *
 * Rode após atualizar qualquer modelo na raiz:
 *   node scripts/sync-modelos-xlsx.mjs
 */
import { copyFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(__dirname, "..");
const repoRoot = join(frontendRoot, "..");

const MODELOS = [
  "modelo-organico.xlsx",
  "modelo-faltas-atestados.xlsx",
  "modelo-sancoes-disciplinares.xlsx",
  "modelo-absenteismo-por-horas.xlsx",
];

const TARGET_DIRS = [
  join(frontendRoot, "public"),
  join(repoRoot, "backend", "public"),
];

for (const dir of TARGET_DIRS) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

for (const name of MODELOS) {
  const src = join(repoRoot, name);
  if (!existsSync(src)) {
    console.error(`Arquivo não encontrado na raiz: ${name}`);
    process.exit(1);
  }
  for (const dir of TARGET_DIRS) {
    const dest = join(dir, name);
    copyFileSync(src, dest);
    console.log(`OK: ${name} -> ${dest}`);
  }
}

console.log(`\n${MODELOS.length} modelo(s) sincronizado(s).`);
