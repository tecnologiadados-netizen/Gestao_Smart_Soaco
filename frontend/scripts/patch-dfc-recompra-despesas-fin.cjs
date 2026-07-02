/**
 * Move "Recompra de Título" (id 323) → DESPESAS FINANCEIRAS (Saídas, Fluxo Financeiro).
 * Uso: node scripts/patch-dfc-recompra-despesas-fin.cjs
 */
const fs = require('fs');
const path = require('path');

const ARVORE = path.join(__dirname, '../src/pages/financeiro/dfc/estruturaDfcArvore.json');
const MOVE_ID = 323;

function remapMacro(node, macro) {
  node.macro = macro;
  (node.children || []).forEach((c) => remapMacro(c, macro));
}

function assignPathKeys(node, basePath) {
  node.pathKey = basePath;
  (node.children || []).forEach((ch, i) => assignPathKeys(ch, `${basePath}/${i}`));
}

function findAndRemoveById(nodes, id) {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.id === id) {
      const [removed] = nodes.splice(i, 1);
      return removed;
    }
    if (n.children?.length) {
      const found = findAndRemoveById(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

const data = JSON.parse(fs.readFileSync(ARVORE, 'utf8'));
const fin = data.roots.find((r) => r.macro === 'FINANCIAMENTOS');
if (!fin) throw new Error('Raiz FINANCIAMENTOS não encontrada.');

const saidas = fin.children.find((c) => c.nome === 'Saídas');
const df = saidas?.children?.find((c) => c.nome === 'DESPESAS FINANCEIRAS');
if (!saidas || !df) throw new Error('Saídas / DESPESAS FINANCEIRAS não encontrados.');

let node = findAndRemoveById(data.roots, MOVE_ID);
if (!node) {
  node = df.children.find((c) => c.id === MOVE_ID);
  if (!node) throw new Error(`Conta id=${MOVE_ID} não encontrada na árvore.`);
} else if (!df.children.some((c) => c.id === MOVE_ID)) {
  node = JSON.parse(JSON.stringify(node));
  remapMacro(node, 'FINANCIAMENTOS');
  node.codigo = '8.2.9';
  df.children.push(node);
}

data.roots.forEach((r, i) => assignPathKeys(r, `M${i}`));
data.geradoEm = new Date().toISOString();
fs.writeFileSync(ARVORE, JSON.stringify(data, null, 0));
console.log('OK → Recompra de Título em DESPESAS FINANCEIRAS (Fluxo Financeiro / Saídas)');
