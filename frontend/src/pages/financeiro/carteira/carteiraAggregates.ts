import type { CarteiraFinanceiraLinha, CarteiraFinanceiraResumo } from '../../../api/financeiro';

export type MetricasAgg = {
  chave: string;
  saldoAReceber: number;
  saldoAFaturar: number;
  saldoRomaneado: number;
  qtdPedidos: number;
};

function aggBy(
  linhas: CarteiraFinanceiraLinha[],
  keyFn: (l: CarteiraFinanceiraLinha) => string
): MetricasAgg[] {
  const map = new Map<string, MetricasAgg & { pds: Set<string> }>();
  for (const l of linhas) {
    const chave = keyFn(l).trim() || '(sem valor)';
    let row = map.get(chave);
    if (!row) {
      row = {
        chave,
        saldoAReceber: 0,
        saldoAFaturar: 0,
        saldoRomaneado: 0,
        qtdPedidos: 0,
        pds: new Set(),
      };
      map.set(chave, row);
    }
    row.saldoAReceber += l['Saldo a Faturar Real'] || 0;
    row.saldoAFaturar += l['Valor Pendente'] || 0;
    row.saldoRomaneado += l['Valor Romaneado'] || 0;
    row.pds.add(l.PD ?? String(l.id));
  }
  return [...map.values()]
    .map(({ pds, ...rest }) => ({ ...rest, qtdPedidos: pds.size }))
    .sort((a, b) => b.saldoAReceber - a.saldoAReceber);
}

export function aggPorUf(linhas: CarteiraFinanceiraLinha[]): MetricasAgg[] {
  return aggBy(linhas, (l) => l.UF ?? '');
}

export function aggPorCarrada(linhas: CarteiraFinanceiraLinha[], topN = 10): MetricasAgg[] {
  const all = aggBy(linhas, (l) => l.Observacoes ?? '');
  if (all.length <= topN) return all;
  const top = all.slice(0, topN);
  const outros = all.slice(topN);
  return [
    ...top,
    {
      chave: 'Outros',
      saldoAReceber: outros.reduce((s, x) => s + x.saldoAReceber, 0),
      saldoAFaturar: outros.reduce((s, x) => s + x.saldoAFaturar, 0),
      saldoRomaneado: outros.reduce((s, x) => s + x.saldoRomaneado, 0),
      qtdPedidos: outros.reduce((s, x) => s + x.qtdPedidos, 0),
    },
  ];
}

export function aggPorCliente(linhas: CarteiraFinanceiraLinha[], topN = 15): MetricasAgg[] {
  return aggBy(linhas, (l) => l.Cliente ?? '').slice(0, topN);
}

export function aggPorCondicao(linhas: CarteiraFinanceiraLinha[]): MetricasAgg[] {
  return aggBy(linhas, (l) => l['Condicao de pagamento do pedido de venda'] ?? '');
}

export function aggPorStatus(linhas: CarteiraFinanceiraLinha[]): MetricasAgg[] {
  return aggBy(linhas, (l) => l.StatusPedido ?? '');
}

export function calcResumoLocal(linhas: CarteiraFinanceiraLinha[]): CarteiraFinanceiraResumo {
  let saldoAReceber = 0;
  let saldoAFaturar = 0;
  let saldoRomaneado = 0;
  const pds = new Set<string>();
  const atrasados = new Set<string>();
  for (const l of linhas) {
    saldoAReceber += l['Saldo a Faturar Real'] || 0;
    saldoAFaturar += l['Valor Pendente'] || 0;
    saldoRomaneado += l['Valor Romaneado'] || 0;
    const pd = l.PD ?? String(l.id);
    pds.add(pd);
    if (l.StatusPedido === 'Atrasado') atrasados.add(pd);
  }
  const totalPedidos = pds.size;
  const pedidosAtrasados = atrasados.size;
  return {
    saldoAReceber,
    saldoAFaturar,
    saldoRomaneado,
    totalPedidos,
    pedidosAtrasados,
    pctAtrasados: totalPedidos > 0 ? (pedidosAtrasados / totalPedidos) * 100 : 0,
    ticketMedio: totalPedidos > 0 ? saldoAReceber / totalPedidos : 0,
  };
}
