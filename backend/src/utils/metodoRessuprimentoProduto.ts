/** Método de ressuprimento (aba Geral do produto Nomus) → `produto.padraoSuprimento`. */

export const METODO_RESSUPRIMENTO_VAZIO = 'Não informado';

const ROTULOS: Record<number, string> = {
  1: 'Comprado',
  2: 'Fabricado',
  3: 'Como padrão fabricado',
  4: 'Como padrão comprado',
};

export const ROTULOS_METODO_RESSUPRIMENTO = [
  'Comprado',
  'Fabricado',
  'Como padrão fabricado',
  'Como padrão comprado',
  METODO_RESSUPRIMENTO_VAZIO,
] as const;

export function rotuloMetodoRessuprimento(padraoSuprimento: unknown): string {
  const n = Number(padraoSuprimento);
  if (!Number.isInteger(n)) return '';
  return ROTULOS[n] ?? '';
}

/** Item suprido por compra: Comprado (1) ou Como padrão comprado (4). */
export function padraoSuprimentoEhComprado(padraoSuprimento: unknown): boolean {
  const n = Number(padraoSuprimento);
  return n === 1 || n === 4;
}

/** Lista vinda do calendário; vazia = sem filtro extra. */
export function parseFiltroMetodosRessuprimento(raw: unknown): string[] {
  const allowed = new Set<string>(ROTULOS_METODO_RESSUPRIMENTO);
  const arr = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
  const out: string[] = [];
  const visto = new Set<string>();
  for (const item of arr) {
    const s = String(item ?? '').trim();
    if (!s || !allowed.has(s) || visto.has(s)) continue;
    visto.add(s);
    out.push(s);
  }
  return out;
}
