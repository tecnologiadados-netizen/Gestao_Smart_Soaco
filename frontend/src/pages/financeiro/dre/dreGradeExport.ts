import type { DreEstruturaNo } from './ArvoreContasDre';
import { calcularAnaliseHorizontal, calcularAnaliseVertical } from './dreAnalises';
import { formatarVariacaoMkp, variacaoMkpPorGrupo } from './dreMkpVariacoes';

export type DreGradeExportLinha = {
  codigo: string;
  conta: string;
  tipo: string;
  valores: Record<string, number>;
  avPorPeriodo: Record<string, number | null>;
  ahPorPeriodo: Record<string, number | null>;
  total: number;
  avTotal: number | null;
  media: number;
  avMedia: number | null;
  mkpPct: number | null;
  mkpRotulo: string;
};

export function contarMesesPeriodoExport(periodos: string[], granularidade: 'dia' | 'mes'): number {
  if (periodos.length === 0) return 0;
  if (granularidade === 'mes') return periodos.length;
  return new Set(periodos.map((p) => p.slice(0, 7))).size;
}

export function montarLinhasExportDre(params: {
  roots: DreEstruturaNo[];
  somasPorPathKey: Map<string, Record<string, number>>;
  periodos: string[];
  receitaBrutaPorPeriodo: Record<string, number>;
  receitaBrutaTotal: number;
  nMesesPeriodo: number;
  mkpAtivo: boolean;
}): DreGradeExportLinha[] {
  const {
    roots,
    somasPorPathKey,
    periodos,
    receitaBrutaPorPeriodo,
    receitaBrutaTotal,
    nMesesPeriodo,
    mkpAtivo,
  } = params;
  const out: DreGradeExportLinha[] = [];

  function walk(n: DreEstruturaNo) {
    const somasNo = somasPorPathKey.get(n.pathKey) ?? {};
    const valores: Record<string, number> = {};
    const avPorPeriodo: Record<string, number | null> = {};
    const ahPorPeriodo: Record<string, number | null> = {};
    let prev: number | null = null;
    for (const p of periodos) {
      const v = somasNo[p] ?? 0;
      valores[p] = v;
      avPorPeriodo[p] = calcularAnaliseVertical(v, receitaBrutaPorPeriodo[p] ?? 0);
      ahPorPeriodo[p] = prev == null ? null : calcularAnaliseHorizontal(v, prev);
      prev = v;
    }
    const total = periodos.reduce((s, p) => s + (valores[p] ?? 0), 0);
    const media = nMesesPeriodo > 0 ? total / nMesesPeriodo : 0;
    const receitaBrutaMedia = nMesesPeriodo > 0 ? receitaBrutaTotal / nMesesPeriodo : 0;
    const mkpPct = mkpAtivo ? variacaoMkpPorGrupo(n.nome) : null;
    const exibirMkp = mkpPct != null && n.codigo.startsWith('1.3.');
    out.push({
      codigo: n.codigo,
      conta: n.nome,
      tipo: n.tipo || '',
      valores,
      avPorPeriodo,
      ahPorPeriodo,
      total,
      avTotal: calcularAnaliseVertical(total, receitaBrutaTotal),
      media,
      avMedia: calcularAnaliseVertical(media, receitaBrutaMedia),
      mkpPct: exibirMkp ? mkpPct : null,
      mkpRotulo: exibirMkp && mkpPct != null ? formatarVariacaoMkp(mkpPct) : '',
    });
    n.children?.forEach(walk);
  }

  roots.forEach(walk);
  return out;
}
