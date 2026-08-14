import type { ConsultaEstoqueRow } from './consultaEstoqueRepository.js';

/** Status de cobertura (régua v1 — somente campos da Consulta de Estoque). */
export type StatusCoberturaEstoque =
  | 'ruptura_projetada'
  | 'zerado_projetado'
  | 'cobertura_fragil'
  | 'nivelado'
  | 'excesso_parado';

export const STATUS_COBERTURA_ORDEM: StatusCoberturaEstoque[] = [
  'ruptura_projetada',
  'zerado_projetado',
  'cobertura_fragil',
  'nivelado',
  'excesso_parado',
];

export const LABELS_STATUS_COBERTURA: Record<StatusCoberturaEstoque, string> = {
  ruptura_projetada: 'Ruptura projetada',
  zerado_projetado: 'Zerado projetado',
  cobertura_fragil: 'Cobertura frágil',
  nivelado: 'Nivelado',
  excesso_parado: 'Excesso / parado',
};

/**
 * Classifica o item com a mesma fonte da Consulta (saldo, empenho, saldoProjetado).
 * Régua v1 do painel de cobertura.
 */
export function classificarCoberturaEstoque(row: {
  saldo: number;
  empenho: number;
  saldoProjetado: number;
}): StatusCoberturaEstoque {
  const saldo = Number(row.saldo) || 0;
  const empenho = Number(row.empenho) || 0;
  const saldoProjetado = Number(row.saldoProjetado) || 0;

  if (saldoProjetado < 0) return 'ruptura_projetada';
  if (saldoProjetado === 0) return 'zerado_projetado';

  // saldoProjetado > 0
  if (saldo < empenho) return 'cobertura_fragil';
  if (empenho === 0 && saldo > 0) return 'excesso_parado';
  if (empenho > 0 && saldo / empenho > 3) return 'excesso_parado';
  if (empenho > 0 && saldo >= empenho && saldo / empenho <= 3) return 'nivelado';

  return 'nivelado';
}

export type CoberturaEstoqueLinha = ConsultaEstoqueRow & {
  status: StatusCoberturaEstoque;
};

export type TotaisStatusCobertura = {
  status: StatusCoberturaEstoque;
  label: string;
  itens: number;
  saldo: number;
  empenho: number;
  saldoProjetado: number;
};

export type DistribuicaoDimensao = {
  chave: string;
  itens: number;
  saldoProjetado: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function emptyTotais(): TotaisStatusCobertura[] {
  return STATUS_COBERTURA_ORDEM.map((status) => ({
    status,
    label: LABELS_STATUS_COBERTURA[status],
    itens: 0,
    saldo: 0,
    empenho: 0,
    saldoProjetado: 0,
  }));
}

export function agregarCoberturaEstoque(
  rows: ConsultaEstoqueRow[],
  opts?: { topN?: number; statusFiltro?: StatusCoberturaEstoque | null }
): {
  totalItens: number;
  totais: TotaisStatusCobertura[];
  distribuicaoTipo: DistribuicaoDimensao[];
  topCriticos: CoberturaEstoqueLinha[];
  topExcesso: CoberturaEstoqueLinha[];
  itens: CoberturaEstoqueLinha[];
} {
  const topN = opts?.topN ?? 15;
  const statusFiltro = opts?.statusFiltro ?? null;

  const comStatus: CoberturaEstoqueLinha[] = rows.map((r) => ({
    ...r,
    status: classificarCoberturaEstoque(r),
  }));

  const totaisMap = new Map<StatusCoberturaEstoque, TotaisStatusCobertura>();
  for (const t of emptyTotais()) totaisMap.set(t.status, { ...t });

  const tipoMap = new Map<string, DistribuicaoDimensao>();

  for (const row of comStatus) {
    const t = totaisMap.get(row.status)!;
    t.itens += 1;
    t.saldo = round2(t.saldo + row.saldo);
    t.empenho = round2(t.empenho + row.empenho);
    t.saldoProjetado = round2(t.saldoProjetado + row.saldoProjetado);

    const tipo = row.tipoProduto?.trim() || '(sem tipo)';
    const d = tipoMap.get(tipo) ?? { chave: tipo, itens: 0, saldoProjetado: 0 };
    d.itens += 1;
    d.saldoProjetado = round2(d.saldoProjetado + row.saldoProjetado);
    tipoMap.set(tipo, d);
  }

  const topCriticos = [...comStatus]
    .filter((r) => r.status === 'ruptura_projetada' || r.status === 'zerado_projetado')
    .sort((a, b) => a.saldoProjetado - b.saldoProjetado || a.codigo.localeCompare(b.codigo))
    .slice(0, topN);

  const topExcesso = [...comStatus]
    .filter((r) => r.status === 'excesso_parado')
    .sort((a, b) => b.saldo - a.saldo || b.saldoProjetado - a.saldoProjetado)
    .slice(0, topN);

  // Fallback: se poucos excesso_parado, ranking pelos maiores saldos positivos
  const topExcessoFinal =
    topExcesso.length > 0
      ? topExcesso
      : [...comStatus]
          .filter((r) => r.saldoProjetado > 0)
          .sort((a, b) => b.saldoProjetado - a.saldoProjetado)
          .slice(0, topN);

  const itens = statusFiltro
    ? comStatus.filter((r) => r.status === statusFiltro)
    : comStatus;

  return {
    totalItens: comStatus.length,
    totais: STATUS_COBERTURA_ORDEM.map((s) => totaisMap.get(s)!),
    distribuicaoTipo: [...tipoMap.values()].sort(
      (a, b) => b.itens - a.itens || a.chave.localeCompare(b.chave)
    ),
    topCriticos,
    topExcesso: topExcessoFinal,
    itens: itens
      .slice()
      .sort((a, b) => a.saldoProjetado - b.saldoProjetado || a.codigo.localeCompare(b.codigo)),
  };
}
