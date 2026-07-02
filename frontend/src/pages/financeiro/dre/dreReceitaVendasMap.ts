import type { DreEstruturaNo } from './ArvoreContasDre';
import { nomeGrupoProdutoDre, normalizarGrupoProduto } from './dreMkpVariacoes';

export type DreReceitaVendasLinha = {
  mes: number;
  ano: number;
  grupoProduto: string;
  idItemPedidoSM: string;
  valorTotal: number;
  totalDesconto?: number;
};

function encontrarNoPorCodigo(nodes: DreEstruturaNo[], codigo: string): DreEstruturaNo | null {
  for (const n of nodes) {
    if (n.codigo === codigo) return n;
    const achado = encontrarNoPorCodigo(n.children ?? [], codigo);
    if (achado) return achado;
  }
  return null;
}

function chavesPeriodoParaMes(
  ano: number,
  mes: number,
  periodos: string[],
  granularidade: 'dia' | 'mes',
): string[] {
  const mesKey = `${ano}-${String(mes).padStart(2, '0')}`;
  if (granularidade === 'mes') {
    return periodos.includes(mesKey) ? [mesKey] : [];
  }
  const prefix = `${mesKey}-`;
  return periodos.filter((p) => p.startsWith(prefix));
}

function acumularValor(
  alvo: Record<string, number>,
  chaves: string[],
  valor: number,
): void {
  if (!chaves.length || valor === 0) return;
  const parte = valor / chaves.length;
  for (const k of chaves) {
    alvo[k] = (alvo[k] ?? 0) + parte;
  }
}

/** Grupos de produto ficam em 1.1 → Só Aço (1.1.1) → Faturamento Direto (1.1.2). */
function noFaturamentoDireto(secaoVendas: DreEstruturaNo): DreEstruturaNo | null {
  const soAco = secaoVendas.children?.find((c) => c.codigo === '1.1.1');
  return soAco?.children?.find((c) => c.codigo === '1.1.2') ?? null;
}

function mapaPathKeyPorGrupo(secaoVendas: DreEstruturaNo): Map<string, string> {
  const map = new Map<string, string>();
  const fatDireto = noFaturamentoDireto(secaoVendas);
  for (const ch of fatDireto?.children ?? []) {
    if (ch.tipo !== 'A') continue;
    map.set(normalizarGrupoProduto(ch.nome), ch.pathKey);
  }
  return map;
}

/**
 * Preenche «Receita de vendas de produtos» (1.1): linhas por grupoProduto (Só Aço)
 * e totais em Só Aço / Faturamento Direto.
 */
export function montarValoresReceitaVendasPorPathKey(
  roots: DreEstruturaNo[],
  linhas: DreReceitaVendasLinha[],
  periodos: string[],
  granularidade: 'dia' | 'mes',
): Map<string, Record<string, number>> {
  const out = new Map<string, Record<string, number>>();
  const secao = encontrarNoPorCodigo(roots, '1.1');
  if (!secao) return out;

  const porGrupoPath = mapaPathKeyPorGrupo(secao);
  const acumGrupo = new Map<string, Record<string, number>>();

  for (const row of linhas) {
    if (String(row.idItemPedidoSM ?? '').trim() !== 'So Aco') continue;
    const chaves = chavesPeriodoParaMes(row.ano, row.mes, periodos, granularidade);
    if (!chaves.length) continue;

    const pathGrupo = porGrupoPath.get(normalizarGrupoProduto(nomeGrupoProdutoDre(row.grupoProduto)));
    if (!pathGrupo) continue;

    let porP = acumGrupo.get(pathGrupo);
    if (!porP) {
      porP = {};
      acumGrupo.set(pathGrupo, porP);
    }
    acumularValor(porP, chaves, row.valorTotal);
  }

  for (const [pathKey, porP] of acumGrupo) {
    out.set(pathKey, porP);
  }

  return out;
}

/**
 * 1.1.1 Só Aço = 1.1.2 Faturamento Direto + 1.3 Faturamento Indireto Líquido (MKP).
 * Não inclui 1.2 Faturamento Indireto Bruto.
 */
export function somarPeriodosNoSoAco(
  somas: Map<string, Record<string, number>>,
  noSoAco: DreEstruturaNo,
  periodos: string[],
): Record<string, number> {
  const noFatDireto = (noSoAco.children ?? []).find((c) => c.codigo === '1.1.2');
  const noFatIndiretoLiquido = (noSoAco.children ?? []).find((c) => c.codigo === '1.3');
  const porSoAco: Record<string, number> = {};
  for (const p of periodos) {
    porSoAco[p] =
      (noFatDireto ? (somas.get(noFatDireto.pathKey)?.[p] ?? 0) : 0) +
      (noFatIndiretoLiquido ? (somas.get(noFatIndiretoLiquido.pathKey)?.[p] ?? 0) : 0);
  }
  return porSoAco;
}

/** Recalcula totais de Faturamento Direto, Só Aço (1.1.2 + 1.3) e seção 1.1 a partir dos grupos. */
export function ajustarRollupSecaoReceitaVendas(
  roots: DreEstruturaNo[],
  somas: Map<string, Record<string, number>>,
  periodos: string[],
): void {
  const secao = encontrarNoPorCodigo(roots, '1.1');
  if (!secao) return;

  const noSoAco = secao.children?.find((c) => c.codigo === '1.1.1');
  const noFatDireto = noFaturamentoDireto(secao);
  const linhasProduto = (noFatDireto?.children ?? []).filter((c) => c.tipo === 'A');

  const porFat: Record<string, number> = {};
  for (const p of periodos) {
    porFat[p] = linhasProduto.reduce((s, ch) => s + (somas.get(ch.pathKey)?.[p] ?? 0), 0);
  }
  if (noFatDireto) somas.set(noFatDireto.pathKey, porFat);

  if (noSoAco) {
    somas.set(noSoAco.pathKey, somarPeriodosNoSoAco(somas, noSoAco, periodos));
  }

  const porSecao: Record<string, number> = {};
  for (const p of periodos) {
    porSecao[p] = (secao.children ?? []).reduce((s, ch) => s + (somas.get(ch.pathKey)?.[p] ?? 0), 0);
  }
  somas.set(secao.pathKey, porSecao);
}
