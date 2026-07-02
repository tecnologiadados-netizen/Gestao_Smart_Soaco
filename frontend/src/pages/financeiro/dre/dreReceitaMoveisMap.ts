import type { DreEstruturaNo } from './ArvoreContasDre';
import type { DreReceitaMoveisDiretoLinha } from '../../../api/financeiro';

function encontrarNoPorCodigo(nodes: DreEstruturaNo[], codigo: string): DreEstruturaNo | null {
  for (const n of nodes) {
    if (n.codigo === codigo) return n;
    const achado = encontrarNoPorCodigo(n.children ?? [], codigo);
    if (achado) return achado;
  }
  return null;
}

/** 1.4.2 = 1.2 Faturamento Indireto Bruto − 1.3 Faturamento Indireto Líquido (MKP). */
export function calcularFaturamentoIndiretoMoveisPorPeriodo(
  somas: Map<string, Record<string, number>>,
  roots: DreEstruturaNo[],
  periodos: string[],
): Record<string, number> {
  const noBruto = encontrarNoPorCodigo(roots, '1.2');
  const noLiquido = encontrarNoPorCodigo(roots, '1.3');
  const porP: Record<string, number> = {};
  for (const p of periodos) {
    const bruto = noBruto ? (somas.get(noBruto.pathKey)?.[p] ?? 0) : 0;
    const liquido = noLiquido ? (somas.get(noLiquido.pathKey)?.[p] ?? 0) : 0;
    porP[p] = Math.round((bruto - liquido) * 100) / 100;
  }
  return porP;
}

/** 1.4 Só Móveis = 1.4.1 Faturamento Direto + 1.4.2 Faturamento Indireto. */
export function somarPeriodosNoSoMoveis(
  somas: Map<string, Record<string, number>>,
  noSoMoveis: DreEstruturaNo,
  periodos: string[],
): Record<string, number> {
  const noDireto = (noSoMoveis.children ?? []).find((c) => c.codigo === '1.4.1');
  const noIndireto = (noSoMoveis.children ?? []).find((c) => c.codigo === '1.4.2');
  const porP: Record<string, number> = {};
  for (const p of periodos) {
    porP[p] =
      (noDireto ? (somas.get(noDireto.pathKey)?.[p] ?? 0) : 0) +
      (noIndireto ? (somas.get(noIndireto.pathKey)?.[p] ?? 0) : 0);
  }
  return porP;
}

/** Agrega receita Nomus (data emissão NF, valorTotal) em 1.4.1. */
export function montarValoresReceitaMoveisDiretoPorPathKey(
  roots: DreEstruturaNo[],
  linhas: DreReceitaMoveisDiretoLinha[],
  periodos: string[],
  granularidade: 'dia' | 'mes',
): Map<string, Record<string, number>> {
  const out = new Map<string, Record<string, number>>();
  const noDireto = encontrarNoPorCodigo(roots, '1.4.1');
  if (!noDireto) return out;

  const porP: Record<string, number> = {};

  for (const row of linhas) {
    const mesKey = `${row.ano}-${String(row.mes).padStart(2, '0')}`;
    const chaves =
      granularidade === 'mes'
        ? periodos.includes(mesKey)
          ? [mesKey]
          : []
        : periodos.includes(row.dataEmissao)
          ? [row.dataEmissao]
          : [];
    if (!chaves.length) continue;
    for (const k of chaves) {
      porP[k] = (porP[k] ?? 0) + row.valorTotal;
    }
  }

  if (Object.keys(porP).length) out.set(noDireto.pathKey, porP);
  return out;
}

/** Recalcula 1.4.2 (fórmula), 1.4 e seção 1.1 após cargas Nomus. */
export function ajustarRollupSecaoReceitaMoveis(
  roots: DreEstruturaNo[],
  somas: Map<string, Record<string, number>>,
  periodos: string[],
): void {
  const secao = encontrarNoPorCodigo(roots, '1.1');
  const noSoMoveis = secao?.children?.find((c) => c.codigo === '1.4');
  const noIndireto142 = noSoMoveis?.children?.find((c) => c.codigo === '1.4.2');
  if (!noSoMoveis) return;

  if (noIndireto142) {
    somas.set(noIndireto142.pathKey, calcularFaturamentoIndiretoMoveisPorPeriodo(somas, roots, periodos));
  }

  somas.set(noSoMoveis.pathKey, somarPeriodosNoSoMoveis(somas, noSoMoveis, periodos));

  if (secao) {
    const porSecao: Record<string, number> = {};
    for (const p of periodos) {
      porSecao[p] = (secao.children ?? []).reduce((s, ch) => s + (somas.get(ch.pathKey)?.[p] ?? 0), 0);
    }
    somas.set(secao.pathKey, porSecao);
  }
}
