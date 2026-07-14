import { calcularMediaFornecedorUltimosMeses } from "@qualidade/lib/avaliacao-fornecedor/calcular-media-fornecedor";
import type { MediaFornecedorPeriodo } from "@qualidade/lib/avaliacao-fornecedor/calcular-media-fornecedor";
import { resolverNomeAvaliador } from "@qualidade/lib/avaliacao-fornecedor/resolver-nome-avaliador";
import { formatarData } from "@qualidade/lib/utils/dates";
import {
  getDataAvaliacao,
  type AvaliacaoFornecedor,
} from "@qualidade/types/avaliacao-fornecedor";

export interface AvaliacaoDetalheViewModel {
  avaliacao: AvaliacaoFornecedor;
  avaliadorNome: string;
  dataAvaliacao: string;
  dataReferenciaFormatada: string;
  dataAvaliacaoFormatada: string;
  fornecedorAprovadoLabel: string | null;
  descricaoNotaDocumento?: string;
  mediaSeisMeses: MediaFornecedorPeriodo;
  descricaoMediaSeisMeses: string;
}

export function montarDetalheAvaliacao(
  avaliacao: AvaliacaoFornecedor,
  avaliacoes: AvaliacaoFornecedor[],
  users: Array<{ id: string; nome: string }>
): AvaliacaoDetalheViewModel {
  const dataAvaliacao = getDataAvaliacao(avaliacao);
  const mediaSeisMeses = calcularMediaFornecedorUltimosMeses(
    avaliacoes,
    avaliacao.fornecedorId,
    dataAvaliacao,
    6
  );

  const descricaoMediaSeisMeses =
    mediaSeisMeses.quantidade > 0
      ? `${mediaSeisMeses.quantidade} avaliação(ões) de ${formatarData(mediaSeisMeses.periodoInicio)} a ${formatarData(mediaSeisMeses.periodoFim)}`
      : "Sem avaliações no período";

  return {
    avaliacao,
    avaliadorNome: resolverNomeAvaliador(avaliacao.avaliadorId, users),
    dataAvaliacao,
    dataReferenciaFormatada: avaliacao.dataReferencia
      ? formatarData(avaliacao.dataReferencia)
      : "—",
    dataAvaliacaoFormatada: formatarData(dataAvaliacao),
    fornecedorAprovadoLabel:
      typeof avaliacao.fornecedorAprovado === "boolean"
        ? avaliacao.fornecedorAprovado
          ? "Sim"
          : "Não"
        : null,
    descricaoNotaDocumento: avaliacao.numeroDocumento
      ? `Documento ${avaliacao.numeroDocumento}`
      : undefined,
    mediaSeisMeses,
    descricaoMediaSeisMeses,
  };
}
