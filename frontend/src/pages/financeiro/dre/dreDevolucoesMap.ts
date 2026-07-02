import type { DreEstruturaNo } from './ArvoreContasDre';
import type { DreDevolucoesLinha } from '../../../api/financeiro';
import { mapaSinalPorPathKey } from './dreSaidasSoAcoMap';
import { DFC_ID_EMPRESA_ACO, DFC_ID_EMPRESA_MOVEIS } from '../dfc/dfcEmpresas';

const CODIGO_POR_EMPRESA: Record<number, string> = {
  [DFC_ID_EMPRESA_ACO]: '2.1.1.1',
  [DFC_ID_EMPRESA_MOVEIS]: '2.1.1.2',
};

function encontrarNoPorCodigo(nodes: DreEstruturaNo[], codigo: string): DreEstruturaNo | null {
  for (const n of nodes) {
    if (n.codigo === codigo) return n;
    const achado = encontrarNoPorCodigo(n.children ?? [], codigo);
    if (achado) return achado;
  }
  return null;
}

/** Agrega devoluções Nomus (valorTotal, dataEmissao) em 2.1.1.1 / 2.1.1.2. */
export function montarValoresDevolucoesPorPathKey(
  roots: DreEstruturaNo[],
  linhas: DreDevolucoesLinha[],
  periodos: string[],
  granularidade: 'dia' | 'mes',
): Map<string, Record<string, number>> {
  const out = new Map<string, Record<string, number>>();
  const sinais = mapaSinalPorPathKey(roots);

  for (const row of linhas) {
    const codigo = CODIGO_POR_EMPRESA[row.idEmpresaEntrada];
    if (!codigo) continue;
    const no = encontrarNoPorCodigo(roots, codigo);
    if (!no) continue;

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

    const sinal = sinais.get(no.pathKey) ?? -1;
    const porP = out.get(no.pathKey) ?? {};
    for (const k of chaves) {
      porP[k] = (porP[k] ?? 0) + row.valorTotal * sinal;
    }
    out.set(no.pathKey, porP);
  }

  for (const [pathKey, porP] of out) {
    for (const k of Object.keys(porP)) {
      porP[k] = Math.round(porP[k] * 100) / 100;
    }
    out.set(pathKey, porP);
  }

  return out;
}
