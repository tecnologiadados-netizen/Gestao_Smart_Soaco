import type { Pedido } from '../api/pedidos';
import { addDaysIso, toISODate } from '../components/sequenciamento-carradas/simulacaoCarradas';
import { isCarradaOrdemFinal } from '../components/sequenciamento-carradas/sequenciamentoCarradasUtils';
import {
  isCarradaEmFormacao,
  LABEL_CARRADA_EM_FORMACAO,
  rotaFromPedidoRow,
} from './rotaCarrada';

export type DataProducaoExibicaoGerenciador = {
  /** ISO YYYY-MM-DD para exibição/ordenação na grade. */
  dataExibicao: string;
  /** ISO YYYY-MM-DD gravada no pedido (pode estar vazia). */
  dataProducaoReal: string;
  /** ISO YYYY-MM-DD da previsão atual. */
  previsaoAtual: string;
  /** Verdadeiro quando a exibição usa previsão por falta de data de produção. */
  producaoPorPrevisao: boolean;
  /** Carrada constr/cont: entrega/previsão exibe rótulo fixo. */
  carradaEmFormacao?: boolean;
  /** Texto da previsão quando em formação (substitui a data). */
  previsaoExibicaoLabel?: string;
};

export function previsaoAtualPedido(p: Pedido): string {
  return toISODate(p.previsao_entrega_atualizada ?? p.previsao_entrega ?? '');
}

export function dataProducaoRealPedido(p: Pedido): string {
  return toISODate(p.data_producao ?? '');
}

export function rotaPedido(p: Pedido): string {
  return rotaFromPedidoRow(p as unknown as Record<string, unknown>);
}

/** Maior data de produção real entre pedidos de carradas normais (exclui especiais / em formação). */
export function maxDataProducaoPedidosNormais(pedidos: Pedido[]): string {
  let max = '';
  for (const p of pedidos) {
    const rota = rotaPedido(p);
    if (isCarradaOrdemFinal(rota) || isCarradaEmFormacao(rota)) continue;
    const d = dataProducaoRealPedido(p);
    if (d && d > max) max = d;
  }
  return max;
}

export function dataProducaoCarradaEmFormacaoApartirDe(maxDataCarradas: string): string {
  if (!maxDataCarradas) return '';
  return addDaysIso(maxDataCarradas, 30);
}

/** Data de produção exibida no Gerenciador: produção real ou fallback da previsão atual. */
export function resolverDataProducaoExibicaoGerenciador(
  p: Pedido,
  dataProducaoEmFormacao = ''
): DataProducaoExibicaoGerenciador {
  const rota = rotaPedido(p);
  const dataProducaoReal = dataProducaoRealPedido(p);
  const previsaoAtual = previsaoAtualPedido(p);

  if (isCarradaEmFormacao(rota)) {
    return {
      dataExibicao: dataProducaoEmFormacao || dataProducaoReal,
      dataProducaoReal,
      previsaoAtual: '',
      producaoPorPrevisao: false,
      carradaEmFormacao: true,
      previsaoExibicaoLabel: LABEL_CARRADA_EM_FORMACAO,
    };
  }

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
