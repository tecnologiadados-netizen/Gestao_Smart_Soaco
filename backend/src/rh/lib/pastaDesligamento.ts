export const NOME_PASTA_DESLIGAMENTO = 'Desligamento';

export function normalizarNomePasta(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function ehPastaDesligamento(nome: string): boolean {
  return normalizarNomePasta(nome) === normalizarNomePasta(NOME_PASTA_DESLIGAMENTO);
}
