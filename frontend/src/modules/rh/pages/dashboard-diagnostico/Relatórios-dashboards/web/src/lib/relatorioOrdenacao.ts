/** Ordem dos blocos na planilha exportada. */
export type OrdenacaoExportRelatorio = 'atual' | 'diasDesc'

export type OpcoesOrdenacaoExport = {
  ordenacao: OrdenacaoExportRelatorio
  /** Chaves na ordem exibida no painel (nome do médico ou matrícula do colaborador). */
  ordemAtualChaves?: string[]
}

export function ordenarPorDiasPerdidosDesc<T extends { diasPerdidos: number }>(
  secoes: T[],
  getNome: (s: T) => string,
): T[] {
  return [...secoes].sort(
    (a, b) =>
      b.diasPerdidos - a.diasPerdidos || getNome(a).localeCompare(getNome(b), 'pt-BR', { sensitivity: 'base' }),
  )
}

export function ordenarPelaOrdemAtualPainel<T>(
  secoes: T[],
  getChave: (s: T) => string,
  ordemChaves: string[],
): T[] {
  if (!ordemChaves.length) return secoes
  const byChave = new Map<string, T>()
  for (const s of secoes) byChave.set(getChave(s), s)
  const out: T[] = []
  const usados = new Set<string>()
  for (const k of ordemChaves) {
    const item = byChave.get(k)
    if (item) {
      out.push(item)
      usados.add(k)
    }
  }
  for (const s of secoes) {
    const k = getChave(s)
    if (!usados.has(k)) out.push(s)
  }
  return out
}

export function aplicarOrdenacaoExport<T extends { diasPerdidos: number }>(
  secoes: T[],
  getChave: (s: T) => string,
  getNome: (s: T) => string,
  opcoes?: OpcoesOrdenacaoExport,
): T[] {
  const ordenacao = opcoes?.ordenacao ?? 'diasDesc'
  if (ordenacao === 'atual' && opcoes?.ordemAtualChaves?.length) {
    return ordenarPelaOrdemAtualPainel(secoes, getChave, opcoes.ordemAtualChaves)
  }
  return ordenarPorDiasPerdidosDesc(secoes, getNome)
}
