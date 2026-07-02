import { DFC_EMPRESAS_TODAS } from '../dfc/dfcEmpresas';
import type { DreEstruturaNo } from './ArvoreContasDre';
import type { DreRateioConfig, DreRateioProLaborePct, DreRateioRegra } from './dreRateioEmpresas';
import { CODIGO_PRO_LABORE_PADRAO, PATH_KEY_PRO_LABORE_PADRAO } from './dreRateioEmpresas';
import { filhosSaoRateioEmpresa, mapearFilhosParaEmpresas } from './dreRateioEmpresaFilhos';
import { somaFatiaRateioEmpresasFiltro } from './dreRateioEmpresasDisplay';
import { rateioProporcional } from './dreSimplesNacionalRateio';

export const CODIGO_PRO_LABORE = CODIGO_PRO_LABORE_PADRAO;

export const CODIGOS_PRO_LABORE_FILHOS = [
  '13.1.12.1',
  '13.1.12.2',
  '13.1.12.3',
  '13.1.12.4',
] as const;

function encontrarNoPorCodigo(nodes: DreEstruturaNo[], codigo: string): DreEstruturaNo | null {
  for (const n of nodes) {
    if (n.codigo === codigo) return n;
    const achado = encontrarNoPorCodigo(n.children ?? [], codigo);
    if (achado) return achado;
  }
  return null;
}

function encontrarNoPorPathKey(nodes: DreEstruturaNo[], pathKey: string): DreEstruturaNo | null {
  for (const n of nodes) {
    if (n.pathKey === pathKey) return n;
    const achado = encontrarNoPorPathKey(n.children ?? [], pathKey);
    if (achado) return achado;
  }
  return null;
}

function partesPorEmpresa(total: number, percentuais: DreRateioProLaborePct): Record<number, number> {
  const pesos = DFC_EMPRESAS_TODAS.map((id) => Math.max(0, percentuais[id] ?? 0));
  const valores = rateioProporcional(total, pesos);
  return Object.fromEntries(DFC_EMPRESAS_TODAS.map((id, i) => [id, valores[i] ?? 0]));
}

function distribuirParaFilhasEmpresa(
  out: Map<string, Record<string, number>>,
  filhosMap: Map<number, DreEstruturaNo>,
  periodos: string[],
  totalPorPeriodo: Record<string, number>,
  percentuais: DreRateioProLaborePct,
  idEmpresas: number[],
): void {
  for (const filho of filhosMap.values()) {
    if (!out.has(filho.pathKey)) {
      out.set(filho.pathKey, Object.fromEntries(periodos.map((p) => [p, 0])));
    }
  }

  for (const p of periodos) {
    const total = totalPorPeriodo[p] ?? 0;
    if (Math.abs(total) < 0.005) continue;

    const partes = partesPorEmpresa(total, percentuais);
    for (const [idEmp, filho] of filhosMap.entries()) {
      const valor =
        idEmpresas.length === 0 || idEmpresas.includes(idEmp) ? (partes[idEmp] ?? 0) : 0;
      const cur = out.get(filho.pathKey)!;
      cur[p] = (cur[p] ?? 0) + valor;
    }
  }
}

function aplicarRateioPlanoContas(
  saidasMap: Map<string, Record<string, number>>,
  roots: DreEstruturaNo[],
  periodos: string[],
  regra: DreRateioRegra,
  idEmpresas: number[],
  saidasPoolPlanoContas?: Map<string, Record<string, number>>,
): Map<string, Record<string, number>> {
  const origem = regra.origem;
  if (origem.tipo !== 'plano_contas') return saidasMap;

  const noPai =
    encontrarNoPorPathKey(roots, origem.pathKey) ?? encontrarNoPorCodigo(roots, origem.codigo);
  if (!noPai) return saidasMap;

  const filhos = noPai.children ?? [];
  const filhosMap = mapearFilhosParaEmpresas(filhos);
  if (!filhosMap || !filhosSaoRateioEmpresa(filhos)) return saidasMap;

  // Pró-labore (e demais rateios por plano de contas) somam TODAS as empresas
  // (Nomus + Shop9), independentemente do filtro; a fatia por empresa é recortada
  // ao final. Sem pool completo, cai para o total do filtro (retrocompatível).
  const totalPai = saidasPoolPlanoContas?.get(noPai.pathKey) ?? saidasMap.get(noPai.pathKey);
  if (!totalPai) return saidasMap;

  const out = new Map(saidasMap);
  out.delete(noPai.pathKey);
  distribuirParaFilhasEmpresa(out, filhosMap, periodos, totalPai, regra.percentuais, idEmpresas);
  return out;
}

function aplicarRateioFornecedores(
  saidasMap: Map<string, Record<string, number>>,
  roots: DreEstruturaNo[],
  periodos: string[],
  regra: DreRateioRegra,
  idEmpresas: number[],
  fornecedorTotaisPorPeriodo?: Record<string, number>,
): Map<string, Record<string, number>> {
  const origem = regra.origem;
  if (origem.tipo !== 'fornecedores' || origem.nomes.length === 0 || !fornecedorTotaisPorPeriodo) {
    return saidasMap;
  }

  const noConta =
    encontrarNoPorPathKey(roots, origem.pathKeyConta) ??
    encontrarNoPorCodigo(roots, origem.codigoConta);
  if (!noConta) return saidasMap;

  const totalConta = saidasMap.get(noConta.pathKey);
  if (!totalConta) return saidasMap;

  const filhos = noConta.children ?? [];
  const filhosMap = mapearFilhosParaEmpresas(filhos);
  const out = new Map(saidasMap);

  if (filhosMap && filhosSaoRateioEmpresa(filhos)) {
    const rateioPorPeriodo: Record<string, number> = {};
    const restantePorPeriodo: Record<string, number> = {};

    for (const p of periodos) {
      const total = totalConta[p] ?? 0;
      const fornec = fornecedorTotaisPorPeriodo[p] ?? 0;
      const fornecClamped = Math.min(Math.abs(fornec), Math.abs(total)) * (total < 0 ? -1 : 1);
      restantePorPeriodo[p] = total - fornecClamped;
      rateioPorPeriodo[p] = fornecClamped;
    }

    const modelado: Record<string, number> = { ...(out.get(noConta.pathKey) ?? totalConta) };
    for (const p of periodos) {
      const rest = restantePorPeriodo[p] ?? 0;
      if (Math.abs(rest) < 0.005) {
        delete modelado[p];
      } else {
        modelado[p] = rest;
      }
    }
    if (Object.keys(modelado).length > 0) out.set(noConta.pathKey, modelado);
    else out.delete(noConta.pathKey);

    distribuirParaFilhasEmpresa(out, filhosMap, periodos, rateioPorPeriodo, regra.percentuais, idEmpresas);
    return out;
  }

  // Linha única (ex.: 13.1.1 Salários): ajuste no bloco final de aplicarRateioNasSaidas.
  return saidasMap;
}

function aplicarRegraRateio(
  saidasMap: Map<string, Record<string, number>>,
  roots: DreEstruturaNo[],
  periodos: string[],
  regra: DreRateioRegra,
  idEmpresas: number[],
  fornecedorTotaisPorPeriodo?: Record<string, number>,
  saidasPoolPlanoContas?: Map<string, Record<string, number>>,
): Map<string, Record<string, number>> {
  if (regra.origem.tipo === 'fornecedores') {
    const noConta =
      encontrarNoPorPathKey(roots, regra.origem.pathKeyConta) ??
      encontrarNoPorCodigo(roots, regra.origem.codigoConta);
    if (!noConta || !filhosSaoRateioEmpresa(noConta.children ?? [])) {
      return saidasMap;
    }
    return aplicarRateioFornecedores(
      saidasMap,
      roots,
      periodos,
      regra,
      idEmpresas,
      fornecedorTotaisPorPeriodo,
    );
  }
  return aplicarRateioPlanoContas(saidasMap, roots, periodos, regra, idEmpresas, saidasPoolPlanoContas);
}

/**
 * Aplica todas as regras de rateio entre empresas (plano de contas e/ou fornecedores).
 */
export function aplicarRateioNasSaidas(
  saidasMap: Map<string, Record<string, number>>,
  roots: DreEstruturaNo[],
  periodos: string[],
  config: DreRateioConfig | null | undefined,
  idEmpresas: number[],
  fornecedorTotaisPorRegraId?: Record<string, Record<string, number>>,
  fornecedorTotaisFiltroPorRegraId?: Record<string, Record<string, number>>,
  /** Pool completo (todas as empresas) para rateio por plano de contas (ex.: Pró-labore). */
  saidasPoolPlanoContas?: Map<string, Record<string, number>>,
): Map<string, Record<string, number>> {
  if (!config?.regras?.length) return saidasMap;

  const fisicoPorPathKey = new Map(saidasMap);
  let out = saidasMap;
  for (const regra of config.regras) {
    const totais =
      regra.origem.tipo === 'fornecedores'
        ? fornecedorTotaisPorRegraId?.[regra.id]
        : undefined;
    out = aplicarRegraRateio(out, roots, periodos, regra, idEmpresas, totais, saidasPoolPlanoContas);
  }

  // Contas com rateio por fornecedor em linha única:
  // demais (físico do filtro − fornecedores rateados no filtro) + fatias de todos os rateados.
  const regrasPorPathKey = new Map<string, DreRateioRegra[]>();
  for (const regra of config.regras) {
    if (regra.origem.tipo !== 'fornecedores' || regra.origem.nomes.length === 0) continue;
    const noConta =
      encontrarNoPorPathKey(roots, regra.origem.pathKeyConta) ??
      encontrarNoPorCodigo(roots, regra.origem.codigoConta);
    if (!noConta || filhosSaoRateioEmpresa(noConta.children ?? [])) continue;
    const list = regrasPorPathKey.get(noConta.pathKey) ?? [];
    list.push(regra);
    regrasPorPathKey.set(noConta.pathKey, list);
  }

  for (const [pk, regrasPk] of regrasPorPathKey) {
    const phys = fisicoPorPathKey.get(pk) ?? {};
    const merged: Record<string, number> = {};

    for (const p of periodos) {
      const base = phys[p] ?? 0;
      if (Math.abs(base) < 0.005 && idEmpresas.length === 0) continue;

      let ratedFiltroSum = 0;
      for (const regra of regrasPk) {
        ratedFiltroSum += fornecedorTotaisFiltroPorRegraId?.[regra.id]?.[p] ?? 0;
      }

      const negativo = base <= 0;
      const ratedFiltroSigned =
        Math.abs(ratedFiltroSum) < 0.005
          ? 0
          : negativo
            ? -Math.abs(ratedFiltroSum)
            : ratedFiltroSum;
      let total = base - ratedFiltroSigned;

      if (idEmpresas.length > 0) {
        for (const regra of regrasPk) {
          const ratedAll = fornecedorTotaisPorRegraId?.[regra.id]?.[p] ?? 0;
          if (Math.abs(ratedAll) < 0.005) continue;
          const fatia = somaFatiaRateioEmpresasFiltro(ratedAll, regra.percentuais, idEmpresas);
          if (Math.abs(fatia) < 0.005) continue;
          total += negativo || total < 0 ? -Math.abs(fatia) : fatia;
        }
      }

      total = Math.round(total * 100) / 100;
      if (Math.abs(total) >= 0.005) merged[p] = total;
    }

    if (Object.keys(merged).length > 0) out.set(pk, merged);
    else out.delete(pk);
  }

  return out;
}

/** @deprecated use aplicarRateioNasSaidas */
export const aplicarRateioProLaboreNasSaidas = aplicarRateioNasSaidas;

export function ehFilhaProLabore(codigo: string): boolean {
  return (CODIGOS_PRO_LABORE_FILHOS as readonly string[]).includes(codigo);
}

export function pathKeyPaiRateioFilha(
  codigo: string,
  config: DreRateioConfig | null | undefined,
  roots: DreEstruturaNo[],
): string | null {
  if (config?.regras?.length) {
    for (const regra of config.regras) {
      if (regra.origem.tipo !== 'plano_contas') continue;
      const noPai =
        encontrarNoPorPathKey(roots, regra.origem.pathKey) ??
        encontrarNoPorCodigo(roots, regra.origem.codigo);
      if (noPai?.children?.some((f) => f.codigo === codigo)) return regra.origem.pathKey;
    }
  }
  if (ehFilhaProLabore(codigo)) return PATH_KEY_PRO_LABORE_PADRAO;
  return null;
}

export function ehContaRateioFilha(
  codigo: string,
  config: DreRateioConfig | null | undefined,
  roots: DreEstruturaNo[],
): boolean {
  return pathKeyPaiRateioFilha(codigo, config, roots) != null;
}
