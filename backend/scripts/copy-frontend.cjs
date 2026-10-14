/**
 * Copia o build do frontend (frontend/dist) para backend/public.
 * Uso: node scripts/copy-frontend.cjs (a partir da pasta backend)
 */
const fs = require('fs');
const path = require('path');

const backendDir = path.join(__dirname, '..');
const src = path.join(backendDir, '..', 'frontend', 'dist');
const dest = path.join(backendDir, 'public');

if (!fs.existsSync(src)) {
  console.error('Pasta frontend/dist não encontrada. Rode antes: cd frontend && npm run build');
  process.exit(1);
}
fs.mkdirSync(dest, { recursive: true });
const destAssets = path.join(dest, 'assets');
const srcAssets = path.join(src, 'assets');
// Quem deixou o sistema aberto ainda pede o JS com o hash anterior.
// Apagar a pasta inteira faz a tela (ex.: Orgânico) falhar até um F5.
const DIAS_PRESERVAR_ASSETS = 14;
const preservarAteMs = DIAS_PRESERVAR_ASSETS * 24 * 60 * 60 * 1000;

function listarArquivos(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listarArquivos(full, acc);
    else acc.push(full);
  }
  return acc;
}

const mtimeAnterior = new Map();
for (const file of listarArquivos(destAssets)) {
  try {
    mtimeAnterior.set(file, fs.statSync(file).mtimeMs);
  } catch {
    // arquivo sumiu entre a listagem e o stat
  }
}

fs.cpSync(src, dest, { recursive: true });

const novos = new Set(listarArquivos(srcAssets).map((file) => path.relative(srcAssets, file)));
const agora = Date.now();
let preservados = 0;
let removidos = 0;
for (const file of listarArquivos(destAssets)) {
  const rel = path.relative(destAssets, file);
  if (novos.has(rel)) continue;
  const mtime = mtimeAnterior.get(file) ?? agora;
  if (agora - mtime > preservarAteMs) {
    fs.rmSync(file, { force: true });
    removidos += 1;
  } else {
    preservados += 1;
  }
}
console.log(
  `Assets de deploys anteriores: ${preservados} preservados, ${removidos} removidos (>${DIAS_PRESERVAR_ASSETS} dias).`,
);
const indexHtml = fs.readFileSync(path.join(dest, 'index.html'), 'utf8');
const refs = [...indexHtml.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
const missing = refs.filter((rel) => !fs.existsSync(path.join(dest, rel)));
if (missing.length) {
  console.error('Frontend copiado, mas o index.html aponta para arquivos ausentes:', missing.join(', '));
  process.exit(1);
}
console.log('Frontend copiado para backend/public');
