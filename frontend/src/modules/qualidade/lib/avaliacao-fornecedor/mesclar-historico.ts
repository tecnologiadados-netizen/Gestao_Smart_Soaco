import historicoJson from "@qualidade/lib/mock-data/avaliacoes-fornecedor-historico.json";
import type { AvaliacaoFornecedor } from "@qualidade/types/avaliacao-fornecedor";
import { getDataAvaliacao } from "@qualidade/types/avaliacao-fornecedor";

const historico = historicoJson as AvaliacaoFornecedor[];

function compararPorData(a: AvaliacaoFornecedor, b: AvaliacaoFornecedor): number {
  return getDataAvaliacao(b).localeCompare(getDataAvaliacao(a));
}

export function mesclarHistoricoImportado(
  avaliacoesAtuais: AvaliacaoFornecedor[]
): AvaliacaoFornecedor[] {
  const ids = new Set(avaliacoesAtuais.map((a) => a.id));
  const novas = historico.filter((a) => !ids.has(a.id));

  if (novas.length === 0) {
    return avaliacoesAtuais;
  }

  return [...avaliacoesAtuais, ...novas].sort(compararPorData);
}

export const TOTAL_HISTORICO_ERP = historico.length;
