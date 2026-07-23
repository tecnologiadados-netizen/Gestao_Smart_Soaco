/**
 * Abate saldo de estoque por código na ordem cronológica da data base (ASC).
 * Mesma regra da Programação Setorial (PDF / grade).
 */

export type ItemAposAbateEstoque<T> = T & {
  originalQty: number;
  qtyToProduce: number;
  fulfilledByStock: number;
};

export type AbaterSaldoEstoqueOpts<T> = {
  getCod: (item: T) => string;
  getRequestedQty: (item: T) => number;
  /** Timestamp ms para ordenação ASC; empates preservam ordem de entrada. */
  getSortTime: (item: T) => number;
};

/** Parse dd/MM/yyyy ou yyyy-MM-dd → Date (local). Inválido → epoch. */
export function parseDataBaseProgramacao(dateStr: string | null | undefined): Date {
  if (!dateStr) return new Date(0);
  const s = String(dateStr).trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const d = Number(m[1]);
    const mm = Number(m[2]);
    const y = Number(m[3]);
    const dt = new Date(y, mm - 1, d);
    if (!Number.isNaN(dt.getTime())) return dt;
  }
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) {
    const y = Number(m2[1]);
    const mm = Number(m2[2]);
    const d = Number(m2[3]);
    const dt = new Date(y, mm - 1, d);
    if (!Number.isNaN(dt.getTime())) return dt;
  }
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? new Date(0) : dt;
}

/**
 * Consome estoque pedido a pedido (data ASC). Não muta `stockByCod` original.
 * Retorna itens com qtyToProduce e o mapa de saldo remanescente.
 */
export function abaterSaldoEstoquePorDataAsc<T>(
  items: T[],
  stockByCod: Record<string, number>,
  opts: AbaterSaldoEstoqueOpts<T>
): {
  items: ItemAposAbateEstoque<T>[];
  stockRemaining: Record<string, number>;
} {
  const indexed = items.map((item, index) => ({ item, index }));
  indexed.sort((a, b) => {
    const ta = opts.getSortTime(a.item);
    const tb = opts.getSortTime(b.item);
    if (ta !== tb) return ta - tb;
    return a.index - b.index;
  });

  const stockRemaining: Record<string, number> = { ...stockByCod };
  const result: ItemAposAbateEstoque<T>[] = [];

  for (const { item } of indexed) {
    const cod = opts.getCod(item);
    const requested = opts.getRequestedQty(item);
    let available = stockRemaining[cod] || 0;

    let usedFromStock = 0;
    if (available > 0 && requested > 0) {
      usedFromStock = Math.min(requested, available);
      stockRemaining[cod] = available - usedFromStock;
    }

    const qtyToProduce = Math.ceil(Math.max(0, requested - usedFromStock));
    result.push({
      ...item,
      originalQty: requested,
      qtyToProduce,
      fulfilledByStock: usedFromStock,
    });
  }

  return { items: result, stockRemaining };
}

/** Chave estável para casar planning ↔ snapshot: idPedido|cod|observacoes */
export function chaveItemProgramacaoEstoque(
  idPedido: string,
  cod: string,
  observacoes: string
): string {
  return `${String(idPedido ?? '').trim()}|${String(cod ?? '').trim()}|${String(observacoes ?? '').trim()}`;
}

export function chaveFromPlanningItem(item: {
  idChave?: string;
  id?: string;
  Cod?: string;
  Observacoes?: string;
}): string {
  const id = String(item.idChave ?? item.id ?? '').trim();
  const cod = String(item.Cod ?? '').trim();
  const obs = String(item.Observacoes ?? '').trim();
  return chaveItemProgramacaoEstoque(id, cod, obs);
}

export function chaveFromSnapshotLinha(row: Record<string, unknown>): string {
  const id = String(row.id_pedido ?? row.idChave ?? '').trim();
  const cod = String(row.Cod ?? row.cod ?? '').trim();
  const obs = String(row.Observacoes ?? row['Observacoes '] ?? row['Observações'] ?? '').trim();
  return chaveItemProgramacaoEstoque(id, cod, obs);
}

export type PlanningItemEstoque = {
  idChave?: string;
  id?: string;
  Cod?: string;
  Observacoes?: string;
  DataBaseIso?: string;
  DataBase?: string;
  Previsao?: string;
  'Qtde Pendente Real'?: number;
  [key: string]: unknown;
};

/**
 * Abate o planning completo e devolve:
 * - fila por chave de qtyToProduce (1 valor por linha do planning; consumo 1:1 no snapshot)
 * - saldo remanescente (para 2ª passada em linhas só-snapshot)
 */
export function processarPlanningComEstoque(
  planning: PlanningItemEstoque[],
  stockByCod: Record<string, number>
): {
  filaQtyPorChave: Map<string, number[]>;
  stockRemaining: Record<string, number>;
  processed: ItemAposAbateEstoque<PlanningItemEstoque>[];
} {
  const { items: processed, stockRemaining } = abaterSaldoEstoquePorDataAsc(planning, stockByCod, {
    getCod: (item) => String(item.Cod ?? '').trim(),
    getRequestedQty: (item) => Number(item['Qtde Pendente Real'] ?? 0) || 0,
    getSortTime: (item) =>
      parseDataBaseProgramacao(String(item.DataBase ?? item.DataBaseIso ?? item.Previsao ?? '')).getTime(),
  });

  const filaQtyPorChave = new Map<string, number[]>();
  for (const item of processed) {
    const key = chaveFromPlanningItem(item);
    if (!key || key === '||') continue;
    const fila = filaQtyPorChave.get(key) ?? [];
    fila.push(item.qtyToProduce);
    filaQtyPorChave.set(key, fila);
  }

  return { filaQtyPorChave, stockRemaining, processed };
}

export type SnapshotLinhaParaAbate = {
  row: Record<string, unknown>;
  /** Data base ASC para a 2ª passada (só-snapshot). Preferir ISO yyyy-MM-dd. */
  dataBaseSort: string;
};

/**
 * Para cada linha do snapshot:
 * - se há qty na fila do planning para a chave → consome 1 valor
 * - chave já esgotada (duplicata no snapshot) → 0
 * - chave inexistente no planning → abate com saldo remanescente (data ASC)
 */
export function qtdeLiquidaPorLinhaSnapshot(
  linhasSnapshot: SnapshotLinhaParaAbate[],
  filaQtyPorChavePlanning: Map<string, number[]>,
  stockRemainingAposPlanning: Record<string, number>
): Map<number, number> {
  const result = new Map<number, number>();
  const unmatched: { index: number; cod: string; requested: number; sortTime: number }[] = [];
  /** Cópia rasa das filas para não mutar o mapa do caller. */
  const filas = new Map<string, number[]>();
  for (const [k, v] of filaQtyPorChavePlanning) {
    filas.set(k, [...v]);
  }

  for (let i = 0; i < linhasSnapshot.length; i++) {
    const { row, dataBaseSort } = linhasSnapshot[i];
    const key = chaveFromSnapshotLinha(row);
    if (filas.has(key)) {
      const fila = filas.get(key)!;
      if (fila.length > 0) {
        result.set(i, fila.shift()!);
      } else {
        result.set(i, 0);
      }
      continue;
    }
    const requested = Number(row['Qtde Pendente Real'] ?? row['qtde pendente real'] ?? 0) || 0;
    const cod = String(row.Cod ?? row.cod ?? '').trim();
    unmatched.push({
      index: i,
      cod,
      requested,
      sortTime: parseDataBaseProgramacao(dataBaseSort).getTime(),
    });
  }

  unmatched.sort((a, b) => {
    if (a.sortTime !== b.sortTime) return a.sortTime - b.sortTime;
    return a.index - b.index;
  });

  const stockRemaining = { ...stockRemainingAposPlanning };
  for (const u of unmatched) {
    let available = stockRemaining[u.cod] || 0;
    let usedFromStock = 0;
    if (available > 0 && u.requested > 0) {
      usedFromStock = Math.min(u.requested, available);
      stockRemaining[u.cod] = available - usedFromStock;
    }
    result.set(u.index, Math.ceil(Math.max(0, u.requested - usedFromStock)));
  }

  return result;
}

/**
 * Pipeline completo: planning abate global + qtde líquida por índice de linha do snapshot.
 */
export function montarQtdeLiquidaCalendario(
  planning: PlanningItemEstoque[],
  stockByCod: Record<string, number>,
  linhasSnapshot: SnapshotLinhaParaAbate[]
): Map<number, number> {
  const { filaQtyPorChave, stockRemaining } = processarPlanningComEstoque(planning, stockByCod);
  return qtdeLiquidaPorLinhaSnapshot(linhasSnapshot, filaQtyPorChave, stockRemaining);
}

/** Data base ISO (produção → previsão) para ordenação do abate a partir da linha do snapshot. */
export function dataBaseSortLinhaSnapshot(row: Record<string, unknown>): string {
  const rawProd = row['data_producao'] ?? row['Data de producao'] ?? row['Data de produção'];
  if (rawProd != null && String(rawProd).trim()) {
    const s = String(rawProd).trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    const mBr = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (mBr) return `${mBr[3]}-${mBr[2]}-${mBr[1]}`;
  }
  const previsaoRaw =
    row['previsao_entrega_atualizada'] ??
    row['Previsão de entrega atualizada'] ??
    row['previsao_entrega'] ??
    row['Previsão de entrega'];
  if (previsaoRaw != null && String(previsaoRaw).trim()) {
    const s = String(previsaoRaw).trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    const mBr = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (mBr) return `${mBr[3]}-${mBr[2]}-${mBr[1]}`;
  }
  return '';
}

/** Converte linhas do snapshot do sequenciamento no formato de planning para o abate. */
export function linhasSnapshotParaPlanningEstoque(
  linhas: Record<string, unknown>[]
): PlanningItemEstoque[] {
  return linhas.map((row) => {
    const iso = dataBaseSortLinhaSnapshot(row);
    let dataBaseBr = '';
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) dataBaseBr = `${m[3]}/${m[2]}/${m[1]}`;
    return {
      idChave: String(row.id_pedido ?? row.idChave ?? '').trim(),
      id: String(row.id_pedido ?? row.id ?? '').trim(),
      Cod: String(row.Cod ?? row.cod ?? '').trim(),
      Observacoes: String(
        row.Observacoes ?? row['Observacoes '] ?? row['Observações'] ?? ''
      ).trim(),
      DataBaseIso: iso,
      DataBase: dataBaseBr || iso,
      Previsao: dataBaseBr || iso,
      'Qtde Pendente Real': Number(row['Qtde Pendente Real'] ?? row['qtde pendente real'] ?? 0) || 0,
    };
  });
}

/**
 * Abate usando só o universo do snapshot (linhas + estoque congelado no mesmo momento).
 * Índice do Map = índice em `linhas`.
 */
export function montarQtdeLiquidaDoSnapshot(
  linhas: Record<string, unknown>[],
  estoquePorCod: Record<string, number>
): Map<number, number> {
  const planning = linhasSnapshotParaPlanningEstoque(linhas);
  const snapshotLinhas = linhas.map((row) => ({
    row,
    dataBaseSort: dataBaseSortLinhaSnapshot(row),
  }));
  return montarQtdeLiquidaCalendario(planning, estoquePorCod, snapshotLinhas);
}
