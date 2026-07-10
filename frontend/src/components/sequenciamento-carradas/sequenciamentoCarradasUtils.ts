import type { SequenciamentoCarradaAgregada } from '../../api/sequenciamentoCarradas';

function getField(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim().length > 0) return String(v).trim();
  }
  return '';
}

function getNumber(row: Record<string, unknown>, keys: string[]): number {
  for (const k of keys) {
    const v = row[k];
    if (v == null) continue;
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return 0;
}

function normalizeCarradaNome(carrada: string): string {
  return carrada
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

/**
 * Carradas "especiais" sem romaneio (retirada, entrega G. Teresina, inserir em romaneio, requisição).
 * Ficam no final da grade e têm as datas bloqueadas para edição nesta tela.
 */
export function isCarradaOrdemFinal(carrada: string): boolean {
  const n = normalizeCarradaNome(carrada);
  return (
    n.includes('retirada na so aco') ||
    n.includes('retirada na so moveis') ||
    n.includes('entrega em grande teresina') ||
    n.includes('inserir em romaneio') ||
    n.includes('requisicao') ||
    n.startsWith('1-retirada') ||
    n.startsWith('2-retirada') ||
    n.startsWith('3-entrega') ||
    n.startsWith('4-inserir') ||
    n.startsWith('5-requisicao')
  );
}

function compareCodRomaneio(a: string, b: string): number {
  if (a === '—' && b === '—') return 0;
  if (a === '—') return 1;
  if (b === '—') return -1;
  const na = Number(a.replace(/\D/g, ''));
  const nb = Number(b.replace(/\D/g, ''));
  if (!Number.isNaN(na) && !Number.isNaN(nb) && String(na) !== '' && String(nb) !== '') {
    return na - nb;
  }
  return a.localeCompare(b, 'pt-BR', { numeric: true });
}

export function comparePedidoAsc(a: string, b: string): number {
  const na = Number(String(a).replace(/\D/g, ''));
  const nb = Number(String(b).replace(/\D/g, ''));
  if (!Number.isNaN(na) && !Number.isNaN(nb) && (na !== 0 || nb !== 0)) {
    return na - nb;
  }
  return a.localeCompare(b, 'pt-BR', { numeric: true });
}

export function ordenarCarradas(carradas: SequenciamentoCarradaAgregada[]): SequenciamentoCarradaAgregada[] {
  const normais = carradas.filter((c) => !isCarradaOrdemFinal(c.carrada));
  const finais = carradas.filter((c) => isCarradaOrdemFinal(c.carrada));
  const sortFn = (x: SequenciamentoCarradaAgregada, y: SequenciamentoCarradaAgregada) =>
    compareCodRomaneio(x.cod, y.cod) || x.carrada.localeCompare(y.carrada, 'pt-BR');
  normais.sort(sortFn);
  finais.sort(sortFn);
  return [...normais, ...finais];
}

export function subtotalCarradas(carradas: SequenciamentoCarradaAgregada[]) {
  const acc = carradas.reduce(
    (s, c) => ({
      saldoAFaturar: s.saldoAFaturar + c.saldoAFaturar,
      saldoEmDia: s.saldoEmDia + (c.saldoEmDia ?? 0),
      adiantamento: s.adiantamento + c.adiantamento,
      valorAVistaAte10d: s.valorAVistaAte10d + c.valorAVistaAte10d,
    }),
    { saldoAFaturar: 0, saldoEmDia: 0, adiantamento: 0, valorAVistaAte10d: 0 }
  );
  const percentualEmDia =
    acc.saldoAFaturar > 0 ? Math.round((acc.saldoEmDia / acc.saldoAFaturar) * 10000) / 100 : 0;
  return {
    saldoAFaturar: Math.round(acc.saldoAFaturar * 100) / 100,
    saldoEmDia: Math.round(acc.saldoEmDia * 100) / 100,
    percentualEmDia,
    adiantamento: Math.round(acc.adiantamento * 100) / 100,
    valorAVistaAte10d: Math.round(acc.valorAVistaAte10d * 100) / 100,
  };
}

export type CarradaSortKey =
  | 'cod'
  | 'carrada'
  | 'saldoAFaturar'
  | 'percentualEmDia'
  | 'adiantamento'
  | 'valorAVistaAte10d';

export type CarradaSortDir = 'asc' | 'desc';

export type CarradaSortLevel = { id: CarradaSortKey; dir: CarradaSortDir };

function compareCarradaPorColuna(
  a: SequenciamentoCarradaAgregada,
  b: SequenciamentoCarradaAgregada,
  key: CarradaSortKey
): number {
  if (key === 'cod') return compareCodRomaneio(a.cod, b.cod);
  if (key === 'carrada') return a.carrada.localeCompare(b.carrada, 'pt-BR');
  return (a[key] ?? 0) - (b[key] ?? 0);
}

/** Alterna regras de ordenação: clique simples substitui; Ctrl+clique acumula níveis. */
export function toggleCarradaSortLevel(
  levels: CarradaSortLevel[],
  key: CarradaSortKey,
  multi: boolean
): CarradaSortLevel[] {
  const existingIndex = levels.findIndex((l) => l.id === key);

  if (multi) {
    if (existingIndex >= 0) {
      const existing = levels[existingIndex]!;
      if (existing.dir === 'asc') {
        const next = [...levels];
        next[existingIndex] = { id: key, dir: 'desc' };
        return next;
      }
      return levels.filter((l) => l.id !== key);
    }
    return [...levels, { id: key, dir: 'asc' }];
  }

  if (existingIndex >= 0 && levels.length === 1) {
    return [{ id: key, dir: levels[0]!.dir === 'asc' ? 'desc' : 'asc' }];
  }

  return [{ id: key, dir: 'asc' }];
}

export function ordenarCarradasComSortLevels(
  carradas: SequenciamentoCarradaAgregada[],
  levels: CarradaSortLevel[]
): SequenciamentoCarradaAgregada[] {
  if (!levels.length) return ordenarCarradas(carradas);
  const copy = [...carradas];
  copy.sort((a, b) => {
    for (const level of levels) {
      const cmp = compareCarradaPorColuna(a, b, level.id);
      if (cmp !== 0) return level.dir === 'asc' ? cmp : -cmp;
    }
    return compareCodRomaneio(a.cod, b.cod);
  });
  return copy;
}

/** @deprecated Preferir ordenarCarradasComSortLevels */
export function ordenarCarradasComSort(
  carradas: SequenciamentoCarradaAgregada[],
  sortKey: CarradaSortKey | null,
  sortDir: CarradaSortDir
): SequenciamentoCarradaAgregada[] {
  if (!sortKey) return ordenarCarradas(carradas);
  return ordenarCarradasComSortLevels(carradas, [{ id: sortKey, dir: sortDir }]);
}

export function classPercentualEmDia(pct: number): string {
  if (pct >= 80) return 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300';
  return 'bg-red-500/20 text-red-700 dark:text-red-300';
}

export function formatPercentual(pct: number): string {
  return `${pct.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export function filtrarLinhasCarrada(
  linhas: Record<string, unknown>[],
  carrada: SequenciamentoCarradaAgregada
): Record<string, unknown>[] {
  return linhas.filter((row) => {
    const rm = getField(row, ['RM', 'rm']) || '—';
    const obs = getField(row, ['Observacoes', 'Observacoes ', 'Observações']) || 'Sem Rota';
    return rm === carrada.cod && obs === carrada.carrada;
  });
}

export type PedidoVendaRow = {
  pedido: string;
  cliente: string;
  emissao: string;
  municipio: string;
  uf: string;
  total: number;
};

export type ItemPedidoRow = {
  pedido: string;
  cliente: string;
  emissao: string;
  codigo: string;
  descricao: string;
  qtdeRomaneada: number;
  precoUnitario: number;
  total: number;
  status: string;
};

export type ProdutoVinculadoRow = {
  codigo: string;
  descricao: string;
  qtdeRomaneada: number;
};

export function agregarPedidosVenda(linhas: Record<string, unknown>[]): PedidoVendaRow[] {
  const map = new Map<string, PedidoVendaRow>();
  for (const row of linhas) {
    const pd = getField(row, ['PD', 'pd']) || '—';
    const existing = map.get(pd);
    const total = getNumber(row, ['Saldo a Faturar Real', 'Valor Pendente Real']);
    if (existing) {
      existing.total += total;
    } else {
      map.set(pd, {
        pedido: pd,
        cliente: getField(row, ['Cliente', 'cliente']),
        emissao: getField(row, ['Emissao', 'emissao']),
        municipio: getField(row, ['Municipio de entrega', 'Município de entrega']),
        uf: getField(row, ['UF', 'uf']),
        total,
      });
    }
  }
  return [...map.values()]
    .map((r) => ({ ...r, total: Math.round(r.total * 100) / 100 }))
    .sort((a, b) => comparePedidoAsc(a.pedido, b.pedido));
}

export function listarItensPedido(linhas: Record<string, unknown>[]): ItemPedidoRow[] {
  return linhas
    .map((row) => ({
      pedido: getField(row, ['PD', 'pd']) || '—',
      cliente: getField(row, ['Cliente', 'cliente']),
      emissao: getField(row, ['Emissao', 'emissao']),
      codigo: getField(row, ['Cod', 'cod']),
      descricao: getField(row, ['Descricao do produto', 'Descrição do produto']),
      qtdeRomaneada: getNumber(row, ['Qtde Romaneada', 'Qtde romaneada']),
      precoUnitario: getNumber(row, ['Valor Unitario com desconto + IPI do item PD']),
      total: getNumber(row, ['Saldo a Faturar Real', 'Valor Romaneado']),
      status: getField(row, ['Stauts', 'Status', 'status']),
    }))
    .sort(
      (a, b) =>
        comparePedidoAsc(a.pedido, b.pedido) ||
        a.descricao.localeCompare(b.descricao, 'pt-BR', { sensitivity: 'base' })
    );
}

function pedidoMatch(a: string, b: string): boolean {
  const na = Number(String(a).replace(/\D/g, ''));
  const nb = Number(String(b).replace(/\D/g, ''));
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== 0 && na === nb) return true;
  return a.trim().toUpperCase() === b.trim().toUpperCase();
}

export type ItemPedidoDetalheRow = {
  codigo: string;
  descricao: string;
  qtdePendenteReal: number;
};

/** Todos os itens de um pedido (PD), sem filtro de setor. */
export function listarItensPedidoPorPd(
  linhas: Record<string, unknown>[],
  pd: string
): ItemPedidoDetalheRow[] {
  return linhas
    .filter((row) => pedidoMatch(getField(row, ['PD', 'pd']), pd))
    .map((row) => ({
      codigo: getField(row, ['Cod', 'cod']) || '—',
      descricao: getField(row, ['Descricao do produto', 'Descrição do produto']),
      qtdePendenteReal: getNumber(row, ['Qtde Pendente Real', 'qtde pendente real']),
    }))
    .sort((a, b) =>
      a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true, sensitivity: 'base' })
    );
}

export function agregarProdutosVinculados(linhas: Record<string, unknown>[]): ProdutoVinculadoRow[] {
  const map = new Map<string, ProdutoVinculadoRow>();
  for (const row of linhas) {
    const codigo = getField(row, ['Cod', 'cod']) || '—';
    const qtde = getNumber(row, ['Qtde Romaneada', 'Qtde romaneada']);
    const existing = map.get(codigo);
    if (existing) {
      existing.qtdeRomaneada += qtde;
    } else {
      map.set(codigo, {
        codigo,
        descricao: getField(row, ['Descricao do produto', 'Descrição do produto']),
        qtdeRomaneada: qtde,
      });
    }
  }
  return [...map.values()].sort((a, b) =>
    a.descricao.localeCompare(b.descricao, 'pt-BR', { sensitivity: 'base' })
  );
}

export function formatDateBr(value: unknown): string {
  if (value == null || value === '') return '—';
  const s = String(value);
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('pt-BR');
}

export function formatDateTimeBr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR');
}

export function formatMoeda(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatQtde(n: number): string {
  return Math.round(n).toLocaleString('pt-BR');
}

export const SUBTOTAL_ROW_CLASS =
  'border-t-2 border-slate-300 bg-slate-100 font-semibold dark:border-slate-500 dark:bg-slate-700/60';
