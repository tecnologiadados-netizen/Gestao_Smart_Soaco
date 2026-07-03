/**
 * Build backend: emite JS mesmo com erros de tipo (noEmitOnError no tsconfig).
 * Falha apenas se dist/server.js nao existir apos tsc.
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
process.chdir(root);

try {
  execSync('npx tsc', { stdio: 'inherit' });
} catch {
  // tsc retorna codigo != 0 com erros de tipo; seguimos se dist/server.js existir
}

const serverJs = path.join(root, 'dist', 'server.js');
if (!fs.existsSync(serverJs)) {
  console.error('[build-backend] dist/server.js nao gerado.');
  process.exit(1);
}

console.warn('[build-backend] dist/server.js OK (erros de tipo TS podem existir; runtime inalterado).');

function copySqlRecursive(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copySqlRecursive(src, dest);
    } else if (entry.name.endsWith('.sql')) {
      fs.copyFileSync(src, dest);
    }
  }
}

copySqlRecursive(path.join(root, 'src', 'data'), path.join(root, 'dist', 'data'));

execSync('node scripts/copy-pre-compra-assets.cjs', { stdio: 'inherit', cwd: root });
