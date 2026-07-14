import { format, parseISO, subMonths } from "date-fns";
import type { AvaliacaoFornecedor } from "@qualidade/types/avaliacao-fornecedor";
import { getDataAvaliacao } from "@qualidade/types/avaliacao-fornecedor";

export interface MediaFornecedorPeriodo {
  media: number | null;
  quantidade: number;
  periodoInicio: string;
  periodoFim: string;
}

function dataIso(avaliacao: AvaliacaoFornecedor): string {
  return getDataAvaliacao(avaliacao).slice(0, 10);
}

/** Média das avaliações do fornecedor nos últimos N meses até a data de referência. */
export function calcularMediaFornecedorUltimosMeses(
  avaliacoes: AvaliacaoFornecedor[],
  fornecedorId: string,
  dataReferenciaFim: string,
  meses = 6
): MediaFornecedorPeriodo {
  const fim = dataReferenciaFim.slice(0, 10);
  if (!fim) {
    return { media: null, quantidade: 0, periodoInicio: "", periodoFim: "" };
  }

  const inicio = format(subMonths(parseISO(fim), meses), "yyyy-MM-dd");

  const noPeriodo = avaliacoes.filter((av) => {
    if (av.fornecedorId !== fornecedorId) return false;
    const data = dataIso(av);
    if (!data) return false;
    return data >= inicio && data <= fim;
  });

  if (noPeriodo.length === 0) {
    return { media: null, quantidade: 0, periodoInicio: inicio, periodoFim: fim };
  }

  const soma = noPeriodo.reduce((total, av) => total + av.media, 0);
  const media = Math.round((soma / noPeriodo.length) * 10) / 10;

  return {
    media,
    quantidade: noPeriodo.length,
    periodoInicio: inicio,
    periodoFim: fim,
  };
}
