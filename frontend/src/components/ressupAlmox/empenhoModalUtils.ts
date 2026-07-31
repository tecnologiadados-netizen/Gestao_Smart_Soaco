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
  'Valor da grade equivale a max(0, empenho bruto − estoque em PA).';

/** Texto da dica da coluna Estoque atual (Consulta de Estoque). */
export const DICA_ESTOQUE_ATUAL_GRADE =
  'Total do saldo de estoque do somatório dos setores parametrizados. Para itens que fazem parte da BOM e estão no setor de PA compondo o produto pai, tal quantidade não está sendo somada ao estoque atual, visto que essa quantidade já está sendo considerada para resultar no empenho líquido.';

/** Setores de produto acabado (PRODUTOS ACABADOS / equivalente). */
export const SETORES_ESTOQUE_PA = [5, 24] as const;

export function isSetorEstoquePa(idSetor: number): boolean {
  return (SETORES_ESTOQUE_PA as readonly number[]).includes(idSetor);
}

/**
 * Tip do card Estoque em PA no Empenho (estoque×BOM em unidades do componente).
 * Abatido integralmente do empenho bruto (piso 0) para obter o empenho líquido.
 */
export const DICA_ESTOQUE_PA =
  'Estoque de produtos acabados convertido em unidades do componente via BOM (setores 5 e 24). Subtraído do empenho bruto para obter o empenho líquido (mínimo 0).';

/** Tip do card Estoque em PA no modal Estoque atual (saldo próprio nos setores 5/24). */
export const DICA_ESTOQUE_PA_SALDO =
  'Estoque de produtos acabados (setores 5 e 24).';
