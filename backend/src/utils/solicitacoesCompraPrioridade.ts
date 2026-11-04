/**
 * Prioridade automática das solicitações de compra, no mesmo critério da planilha
 * SQL_Itens_SC (macro Prioridade_Por_Grupo):
 * cada coleta é um grupo; o grupo 1 é a coleta cuja necessidade mais cedo chega primeiro;
 * empate de data desempata pelo nome da coleta; dentro do grupo, a necessidade mais
 * cedo vem antes e, na mesma data, a solicitação de menor id.
 */

export type SolicitacaoParaPrioridade = {
  idSolicitacao: number;
  nomeColeta: string;
  /** ISO YYYY-MM-DD, ou null quando a SC não tem data de necessidade. */
  dataNecessidade: string | null;
};

export type SolicitacaoPriorizada<T> = T & {
  nomeColeta: string;
  prioridade: number;
  /** Necessidade mais cedo da coleta neste conjunto. */
  necessidadeColeta: string | null;
};

const SEM_DATA = '9999-12-31';

export function nomeColetaSolicitacao(nome: string | null | undefined): string {
  const t = String(nome ?? '').trim();
  return t || 'A DEFINIR';
}

function compararData(a: string | null, b: string | null): number {
  const da = a ?? SEM_DATA;
  const db = b ?? SEM_DATA;
  if (da === db) return 0;
  return da < db ? -1 : 1;
}

export function priorizarSolicitacoesCompra<T extends SolicitacaoParaPrioridade>(
  linhas: T[]
): SolicitacaoPriorizada<T>[] {
  const minPorColeta = new Map<string, string | null>();
  for (const linha of linhas) {
    const coleta = nomeColetaSolicitacao(linha.nomeColeta);
    if (!minPorColeta.has(coleta)) {
      minPorColeta.set(coleta, linha.dataNecessidade);
      continue;
    }
    const atual = minPorColeta.get(coleta) ?? null;
    if (linha.dataNecessidade && (!atual || linha.dataNecessidade < atual)) {
      minPorColeta.set(coleta, linha.dataNecessidade);
    }
  }

  const coletas = [...minPorColeta.entries()].sort((a, b) => {
    const porData = compararData(a[1], b[1]);
    if (porData !== 0) return porData;
    return a[0].localeCompare(b[0], 'pt-BR');
  });
  const rank = new Map(coletas.map(([nome], indice) => [nome, indice + 1]));

  return linhas
    .map((linha) => {
      const coleta = nomeColetaSolicitacao(linha.nomeColeta);
      return {
        ...linha,
        nomeColeta: coleta,
        prioridade: rank.get(coleta) ?? coletas.length + 1,
        necessidadeColeta: minPorColeta.get(coleta) ?? null,
      };
    })
    .sort((a, b) => {
      if (a.prioridade !== b.prioridade) return a.prioridade - b.prioridade;
      const porData = compararData(a.dataNecessidade, b.dataNecessidade);
      if (porData !== 0) return porData;
      return a.idSolicitacao - b.idSolicitacao;
    });
}
