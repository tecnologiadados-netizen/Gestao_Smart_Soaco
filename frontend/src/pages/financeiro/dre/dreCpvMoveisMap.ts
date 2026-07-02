import type { DreEstruturaNo } from './ArvoreContasDre';
import type { DreCpvMoveisDiretoLinha } from '../../../api/financeiro';
import { mapaSinalPorPathKey } from './dreSaidasSoAcoMap';

function encontrarNoPorCodigo(nodes: DreEstruturaNo[], codigo: string): DreEstruturaNo | null {
  for (const n of nodes) {
    if (n.codigo === codigo) return n;
    const achado = encontrarNoPorCodigo(n.children ?? [], codigo);
    if (achado) return achado;
  }
  return null;
}

/** Agrega custo CPV direto Só Móveis (Nomus + Shop9) em 6.2.1, com sinal da árvore (negativo). */
export function montarValoresCpvMoveisDiretoPorPathKey(
  roots: DreEstruturaNo[],
  linhas: DreCpvMoveisDiretoLinha[],
  periodos: string[],
  granularidade: 'dia' | 'mes',
): Map<string, Record<string, number>> {
  const out = new Map<string, Record<string, number>>();
  const no621 = encontrarNoPorCodigo(roots, '6.2.1');
  if (!no621) return out;

  const sinais = mapaSinalPorPathKey(roots);
  const sinal = sinais.get(no621.pathKey) ?? -1;
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
      porP[k] = (porP[k] ?? 0) + row.custoTotal * sinal;
    }
  }

  if (Object.keys(porP).length) {
    for (const k of Object.keys(porP)) {
      porP[k] = Math.round(porP[k] * 100) / 100;
    }
    out.set(no621.pathKey, porP);
  }
  return out;
}
