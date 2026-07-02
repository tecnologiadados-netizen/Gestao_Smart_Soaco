/**
 * Limpeza do nome do plano (Plano_Contas3.Nome) — espelha etapas do Power Query DRE Shop9.
 */
export function limparNomePlanoShop9Dre(nome: string): string {
  let s = String(nome ?? '');
  s = s.split('(').join('');
  s = s.split(')').join('');
  s = s.replace(/INATIVA /g, '');
  s = s.replace(/  INATIVA/g, '');
  s = s.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
  s = s.replace(/ INATIV/g, '');
  return s.trim();
}

/** Uma linha por fc.Ordem (evita fan-out de JOIN no SQL Shop9). */
export function deduplicarLinhasShop9SaidasDre<T extends { ordem: number }>(rows: T[]): T[] {
  const byOrdem = new Map<number, T>();
  for (const r of rows) {
    if (r.ordem > 0 && !byOrdem.has(r.ordem)) byOrdem.set(r.ordem, r);
  }
  return byOrdem.size > 0 ? [...byOrdem.values()] : rows;
}

export function ehPlanoSimplesNacionalShop9Dre(nomePlano: string): boolean {
  const n = String(nomePlano ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
  return n.includes('simples');
}
