import type { DreEstruturaNo } from './ArvoreContasDre';
import { nomeGrupoProdutoDre, normalizarGrupoProduto } from './dreMkpVariacoes';

export type DreReceitaIndiretaBrutoLinha = {
  mes: number;
  ano: number;
  valorTotal: number;
};

export type DreReceitaIndiretaLiquidoLinha = {
  mes: number;
  ano: number;
  grupoProduto: string;
  valorLiquido: number;
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

function noFaturamentoIndiretoLiquido(secaoVendas: DreEstruturaNo): DreEstruturaNo | null {
  const soAco = secaoVendas.children?.find((c) => c.codigo === '1.1.1');
  return soAco?.children?.find((c) => c.codigo === '1.3') ?? null;
}

function mapaPathKeyPorGrupoIndireto(secaoVendas: DreEstruturaNo): Map<string, string> {
  const map = new Map<string, string>();
  const fatIndireto = noFaturamentoIndiretoLiquido(secaoVendas);
  for (const ch of fatIndireto?.children ?? []) {
    if (ch.tipo !== 'A') continue;
    map.set(normalizarGrupoProduto(ch.nome), ch.pathKey);
  }
  return map;
}

export function montarValoresReceitaIndiretaPorPathKey(
  roots: DreEstruturaNo[],
  brutoLinhas: DreReceitaIndiretaBrutoLinha[],
  liquidoLinhas: DreReceitaIndiretaLiquidoLinha[],
  periodos: string[],
  granularidade: 'dia' | 'mes',
): Map<string, Record<string, number>> {
  const out = new Map<string, Record<string, number>>();
  const secao = encontrarNoPorCodigo(roots, '1.1');
  if (!secao) return out;

  const noBruto = encontrarNoPorCodigo(roots, '1.2');
  if (noBruto) {
    const porBruto: Record<string, number> = {};
    for (const row of brutoLinhas) {
      const chaves = chavesPeriodoParaMes(row.ano, row.mes, periodos, granularidade);
      acumularValor(porBruto, chaves, row.valorTotal);
    }
    if (Object.keys(porBruto).length) out.set(noBruto.pathKey, porBruto);
  }

  const porGrupoPath = mapaPathKeyPorGrupoIndireto(secao);
  const acumGrupo = new Map<string, Record<string, number>>();

  for (const row of liquidoLinhas) {
    const chaves = chavesPeriodoParaMes(row.ano, row.mes, periodos, granularidade);
    if (!chaves.length) continue;

    const pathGrupo = porGrupoPath.get(normalizarGrupoProduto(nomeGrupoProdutoDre(row.grupoProduto)));
    if (!pathGrupo) continue;

    let porP = acumGrupo.get(pathGrupo);
    if (!porP) {
      porP = {};
      acumGrupo.set(pathGrupo, porP);
    }
    acumularValor(porP, chaves, row.valorLiquido);
  }

  for (const [pathKey, porP] of acumGrupo) {
    out.set(pathKey, porP);
  }

  return out;
}

export function mesclarValoresNomusPorPathKey(
  ...mapas: (Map<string, Record<string, number>> | undefined)[]
): Map<string, Record<string, number>> | undefined {
  const merged = new Map<string, Record<string, number>>();
  let temValor = false;
  for (const map of mapas) {
    if (!map?.size) continue;
    for (const [pathKey, porP] of map) {
      temValor = true;
      const alvo = merged.get(pathKey) ?? {};
      for (const [p, v] of Object.entries(porP)) {
        alvo[p] = (alvo[p] ?? 0) + v;
      }
      merged.set(pathKey, alvo);
    }
  }
  return temValor ? merged : undefined;
}
