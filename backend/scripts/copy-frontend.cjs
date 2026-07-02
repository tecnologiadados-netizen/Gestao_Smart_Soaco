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
fs.cpSync(src, dest, { recursive: true });
console.log('Frontend copiado para backend/public');
