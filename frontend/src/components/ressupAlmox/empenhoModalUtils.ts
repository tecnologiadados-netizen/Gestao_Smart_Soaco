import type { RessupEmpenhoPedidoLinha } from '../../api/compras';
import { cmpPedidosEmpenho } from '../../utils/empenhoPrioridadePedido';

export const RUPTURA_ROW_CLASS =
  'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/50';

export const RUPTURA_CELL_CLASS = 'text-red-700 dark:text-red-300';

export type LinhaEmpenhoSaldoProjetado = RessupEmpenhoPedidoLinha & {
  saldoProjetado: number;
  ruptura: boolean;
};

/** Data de produção ASC → carrada → pedido ASC (mesma regra do backend). */
export function ordenarLinhasEmpenho(linhas: RessupEmpenhoPedidoLinha[]): RessupEmpenhoPedidoLinha[] {
  return [...linhas].sort((a, b) =>
    cmpPedidosEmpenho(
      { pedido: a.pedido, dataEntrega: a.dataEntrega, rota: a.rota ?? '' },
      { pedido: b.pedido, dataEntrega: b.dataEntrega, rota: b.rota ?? '' }
    )
  );
}

/**
 * Saldo projetado em cascata: estoque atual − Emp Bruto de cada linha (ordem do backend).
 * Marca ruptura na primeira linha em que saldo ≤ 0 com bruto > 0.
 */
export function calcularSaldoProjetadoPorPedido(
  linhas: RessupEmpenhoPedidoLinha[],
  saldoAtual: number
): LinhaEmpenhoSaldoProjetado[] {
  let running = saldoAtual;
  let rupturaMarcada = false;
  return linhas.map((l) => {
    const bruto = Number(l.bruto) || 0;
    running = Math.round((running - bruto) * 100) / 100;
    const ruptura = !rupturaMarcada && running <= 0 && bruto > 0;
    if (ruptura) rupturaMarcada = true;
    return { ...l, saldoProjetado: running, ruptura };
  });
}

/** Texto da dica do empenho líquido (grade / Qtde Emp). */
export const DICA_EMPENHO_LIQ_GRADE =
  'Valor da grade: bruto menos cobertura pelo estoque em PA (setores 5/24).';
