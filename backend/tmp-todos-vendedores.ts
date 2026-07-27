import { listarPedidos } from './src/data/pedidosRepository.ts';

function getField(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

const { data } = await listarPedidos({});
const rows = (data ?? []) as Array<Record<string, unknown>>;
const set = new Set<string>();
for (const r of rows) {
  const v = getField(r, ['Vendedor/Representante', 'vendedor/representante', 'Vendedor', 'vendedor']);
  if (v) set.add(v);
}
const sorted = [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
console.log('=== TODOS VENDEDORES NO GERENCIADOR AGORA ===');
console.log('total_linhas', rows.length, 'vendedores', sorted.length);
for (const n of sorted) console.log(n);
