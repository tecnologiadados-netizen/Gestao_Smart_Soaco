/**
 * Copia assets e scripts Python do Pré Compra para dist/ (produção).
 * Uso: node scripts/copy-pre-compra-assets.cjs (a partir da pasta backend)
 */
const fs = require('fs');
const path = require('path');

const backendDir = path.join(__dirname, '..');
const distDir = path.join(backendDir, 'dist');

const copies = [
  { from: path.join(backendDir, 'assets', 'pre-compra'), to: path.join(distDir, 'assets', 'pre-compra') },
  { from: path.join(backendDir, 'python', 'pre_compra'), to: path.join(distDir, 'python', 'pre_compra') },
];

for (const { from, to } of copies) {
  if (!fs.existsSync(from)) {
    console.warn('[copy-pre-compra-assets] Origem não encontrada:', from);
    continue;
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
  console.log('[copy-pre-compra-assets]', from, '→', to);
}
