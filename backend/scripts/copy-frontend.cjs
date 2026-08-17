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
if (fs.existsSync(destAssets)) {
  fs.rmSync(destAssets, { recursive: true, force: true });
}
fs.cpSync(src, dest, { recursive: true });
const indexHtml = fs.readFileSync(path.join(dest, 'index.html'), 'utf8');
const refs = [...indexHtml.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
const missing = refs.filter((rel) => !fs.existsSync(path.join(dest, rel)));
if (missing.length) {
  console.error('Frontend copiado, mas o index.html aponta para arquivos ausentes:', missing.join(', '));
  process.exit(1);
}
console.log('Frontend copiado para backend/public');
