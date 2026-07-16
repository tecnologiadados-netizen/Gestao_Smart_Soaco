import type { CarradaDataInvalida } from './simulacaoCarradas';

export type DataComumGrupo = string | 'misto' | '';

export type DatasComunsGrupo = {
  dataProducao: DataComumGrupo;
  dataEntrega: DataComumGrupo;
};

export type GrupoInvalidasPorPedido = {
  pedidoChave: string;
  pedido: string;
  cliente: string;
  carrada: string;
  itens: CarradaDataInvalida[];
  datasComuns: DatasComunsGrupo;
};

function valorUnicoCampo(
  itens: CarradaDataInvalida[],
  campo: 'dataProducao' | 'dataEntrega'
): DataComumGrupo {
  const valores = [...new Set(itens.map((i) => i[campo] || ''))];
  if (valores.length === 0) return '';
  if (valores.length === 1) return valores[0]!;
  return 'misto';
}

/** Valor comum de produção/entrega entre itens do mesmo PD (ou 'misto'). */
export function datasComunsDoGrupo(itens: CarradaDataInvalida[]): DatasComunsGrupo {
  return {
    dataProducao: valorUnicoCampo(itens, 'dataProducao'),
    dataEntrega: valorUnicoCampo(itens, 'dataEntrega'),
  };
}

/** Chave estável para agrupar linhas do mesmo PD. */
export function chavePedidoGrupo(pedido: string | undefined): string {
  const s = String(pedido ?? '').trim();
  const n = Number(s.replace(/\D/g, ''));
  if (!Number.isNaN(n) && n !== 0) return String(n);
  return s.toUpperCase() || '—';
}

/** Agrupa itens de pedido (idPedido) exibidos na grade. */
export function agruparInvalidasPorPedido(rows: CarradaDataInvalida[]): GrupoInvalidasPorPedido[] {
  const map = new Map<string, CarradaDataInvalida[]>();
  const ordem: string[] = [];

  for (const row of rows) {
    if (!row.idPedido) continue;
    const chave = chavePedidoGrupo(row.pedido);
    let list = map.get(chave);
    if (!list) {
      list = [];
      map.set(chave, list);
      ordem.push(chave);
    }
    list.push(row);
  }

  const grupos: GrupoInvalidasPorPedido[] = [];
  for (const chave of ordem) {
    const itens = map.get(chave)!;
    const first = itens[0]!;
    grupos.push({
      pedidoChave: chave,
      pedido: first.pedido ?? '—',
      cliente: first.cliente ?? '',
      carrada: first.carrada,
      itens,
      datasComuns: datasComunsDoGrupo(itens),
    });
  }
  return grupos;
}

/** Verdadeiro se o item tem data diferente de outro item do mesmo grupo. */
export function itemCampoDiverge(
  item: CarradaDataInvalida,
  itens: CarradaDataInvalida[],
  campo: 'dataProducao' | 'dataEntrega'
): boolean {
  if (itens.length <= 1) return false;
  const v = item[campo] || '';
  return itens.some((other) => other.key !== item.key && (other[campo] || '') !== v);
}

export function valorInputGrupo(comum: DataComumGrupo): string {
  return comum === 'misto' || comum === '' ? '' : comum;
}
