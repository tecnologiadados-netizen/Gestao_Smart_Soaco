import type { Pedido } from '../api/pedidos';
import { toISODate } from '../components/sequenciamento-carradas/simulacaoCarradas';

export type DataProducaoExibicaoGerenciador = {
  /** ISO YYYY-MM-DD para exibição/ordenação na grade. */
  dataExibicao: string;
  /** ISO YYYY-MM-DD gravada no pedido (pode estar vazia). */
  dataProducaoReal: string;
  /** ISO YYYY-MM-DD da previsão atual. */
  previsaoAtual: string;
  /** Verdadeiro quando a exibição usa previsão por falta de data de produção. */
  producaoPorPrevisao: boolean;
};

export function previsaoAtualPedido(p: Pedido): string {
  return toISODate(p.previsao_entrega_atualizada ?? p.previsao_entrega ?? '');
}

export function dataProducaoRealPedido(p: Pedido): string {
  return toISODate(p.data_producao ?? '');
}

/** Data de produção exibida no Gerenciador: produção real ou fallback da previsão atual. */
export function resolverDataProducaoExibicaoGerenciador(p: Pedido): DataProducaoExibicaoGerenciador {
  const dataProducaoReal = dataProducaoRealPedido(p);
  const previsaoAtual = previsaoAtualPedido(p);
  if (dataProducaoReal) {
    return {
      dataExibicao: dataProducaoReal,
      dataProducaoReal,
      previsaoAtual,
      producaoPorPrevisao: false,
    };
  }
  if (previsaoAtual) {
    return {
      dataExibicao: previsaoAtual,
      dataProducaoReal: '',
      previsaoAtual,
      producaoPorPrevisao: true,
    };
  }
  return {
    dataExibicao: '',
    dataProducaoReal: '',
    previsaoAtual: '',
    producaoPorPrevisao: false,
  };
}
