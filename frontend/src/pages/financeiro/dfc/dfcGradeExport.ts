import type { DfcEstruturaNo } from './ArvoreContasDfc';

export type DfcGradeExportLinha = {
  codigo: string;
  conta: string;
  fluxo: string;
  tipo: string;
  valores: Record<string, number>;
  total: number;
};

const MACRO_LABEL: Record<string, string> = {
  OPERACIONAL: 'Operacional',
  FINANCIAMENTOS: 'Financiamentos',
  INVESTIMENTOS: 'Investimentos',
  OUTRAS: 'Outras movimentações',
  GERACAO: 'Geração',
};

export function montarLinhasExportDfc(params: {
  roots: DfcEstruturaNo[];
  somasPorPathKey: Map<string, Record<string, number>>;
  periodos: string[];
  saldosIniciaisPorPeriodo: Record<string, number>;
  saldosFinaisPorPeriodo: Record<string, number>;
}): DfcGradeExportLinha[] {
  const { roots, somasPorPathKey, periodos, saldosIniciaisPorPeriodo, saldosFinaisPorPeriodo } = params;
  const out: DfcGradeExportLinha[] = [];

  const somaPeriodos = (vals: Record<string, number>) =>
    periodos.reduce((s, p) => s + (vals[p] ?? 0), 0);

  out.push({
    codigo: '',
    conta: 'Saldos iniciais das contas bancárias',
    fluxo: '',
    tipo: 'T',
    valores: { ...saldosIniciaisPorPeriodo },
    total: somaPeriodos(saldosIniciaisPorPeriodo),
  });

  function walk(n: DfcEstruturaNo) {
    const somasNo = somasPorPathKey.get(n.pathKey) ?? {};
    const valores: Record<string, number> = {};
    for (const p of periodos) valores[p] = somasNo[p] ?? 0;
    out.push({
      codigo: n.codigo,
      conta: n.nome,
      fluxo: MACRO_LABEL[n.macro] ?? n.macro ?? '',
      tipo: n.tipo || '',
      valores,
      total: somaPeriodos(valores),
    });
    n.children?.forEach(walk);
  }
  roots.forEach(walk);

  out.push({
    codigo: '',
    conta: 'Saldos finais',
    fluxo: '',
    tipo: 'T',
    valores: { ...saldosFinaisPorPeriodo },
    total: somaPeriodos(saldosFinaisPorPeriodo),
  });

  return out;
}
