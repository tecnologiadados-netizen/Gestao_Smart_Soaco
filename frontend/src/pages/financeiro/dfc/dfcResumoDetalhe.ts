import type { DfcAgendamentoDetalheLinha } from '../../../api/financeiro';
import type { DfcPrioridade } from '../../../api/dfcPrioridade';
import { labelEmpresaDfc } from './dfcEmpresas';

export const LIMIAR_DESTAQUE_APAGAR = 100_000;

export function prioridadeEfetivaDetalhe(
  row: Pick<DfcAgendamentoDetalheLinha, 'idEmpresa' | 'tipoRef' | 'id' | 'idContaFinanceiro'>,
  prioridadesContasMap: Record<string, DfcPrioridade>,
  prioridadesLancsMap: Record<string, DfcPrioridade>,
): DfcPrioridade | null {
  const kl = `${row.idEmpresa}#${row.tipoRef}#${row.id}`;
  if (prioridadesLancsMap[kl] != null) return prioridadesLancsMap[kl];
  if (row.idContaFinanceiro != null) {
    const kc = `${row.idEmpresa}#${row.idContaFinanceiro}`;
    if (prioridadesContasMap[kc] != null) return prioridadesContasMap[kc];
  }
  return null;
}

export function bucketLinhaDetalhe(
  row: DfcAgendamentoDetalheLinha,
  granularidade: 'dia' | 'mes',
): string | null {
  const ymd =
    row.situacao === 'Realizado'
      ? row.dataBaixa?.slice(0, 10)
      : row.dataVencimento?.slice(0, 10);
  if (!ymd) return null;
  return granularidade === 'mes' ? ymd.slice(0, 7) : ymd;
}

export function linhaNoPeriodosResumo(
  row: DfcAgendamentoDetalheLinha,
  periodos: string[],
  granularidade: 'dia' | 'mes',
): boolean {
  const b = bucketLinhaDetalhe(row, granularidade);
  return b != null && periodos.includes(b);
}

export type ResumoAggItem = { label: string; valor: number };

export function agregarPorCampo(
  linhas: DfcAgendamentoDetalheLinha[],
  campo: (r: DfcAgendamentoDetalheLinha) => string,
  top = 12,
): ResumoAggItem[] {
  const map = new Map<string, number>();
  for (const r of linhas) {
    const k = campo(r).trim() || '(sem identificação)';
    map.set(k, (map.get(k) ?? 0) + r.valorBaixado);
  }
  return [...map.entries()]
    .map(([label, valor]) => ({ label, valor: Math.round(valor * 100) / 100 }))
    .filter((x) => x.valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, top);
}

export function agregarPorEmpresa(linhas: DfcAgendamentoDetalheLinha[]): ResumoAggItem[] {
  return agregarPorCampo(linhas, (r) => r.empresa?.trim() || labelEmpresaDfc(r.idEmpresa));
}

export function agregarPorPlano(linhas: DfcAgendamentoDetalheLinha[]): ResumoAggItem[] {
  return agregarPorCampo(linhas, (r) => r.planoContas?.trim() || '(sem plano)');
}

export function agregarPorFornecedor(linhas: DfcAgendamentoDetalheLinha[]): ResumoAggItem[] {
  return agregarPorCampo(linhas, (r) => r.nome?.trim() || '(sem favorecido)');
}
