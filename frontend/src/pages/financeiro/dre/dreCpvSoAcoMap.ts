import type { DreEstruturaNo } from './ArvoreContasDre';
import { mapaSinalPorPathKey } from './dreSaidasSoAcoMap';
import { nomeGrupoProdutoDre, normalizarGrupoProduto } from './dreMkpVariacoes';

export type DreCpvSoAcoLinha = {
  mes: number;
  ano: number;
  grupoProduto: string;
  custoTotal: number;
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

function acumularValor(alvo: Record<string, number>, chaves: string[], valor: number): void {
  if (!chaves.length || valor === 0) return;
  const parte = valor / chaves.length;
  for (const k of chaves) {
    alvo[k] = (alvo[k] ?? 0) + parte;
  }
}

function mapaPathKeyPorGrupo(secao: DreEstruturaNo): Map<string, string> {
  const map = new Map<string, string>();
  for (const ch of secao.children ?? []) {
    if (ch.tipo !== 'A') continue;
    map.set(normalizarGrupoProduto(ch.nome), ch.pathKey);
  }
  return map;
}

function montarPorSecao(
  secao: DreEstruturaNo | null,
  linhas: DreCpvSoAcoLinha[],
  periodos: string[],
  granularidade: 'dia' | 'mes',
): Map<string, Record<string, number>> {
  const out = new Map<string, Record<string, number>>();
  if (!secao) return out;

  const porGrupoPath = mapaPathKeyPorGrupo(secao);
  const acumGrupo = new Map<string, Record<string, number>>();

  for (const row of linhas) {
    const chaves = chavesPeriodoParaMes(row.ano, row.mes, periodos, granularidade);
    if (!chaves.length) continue;

    const pathGrupo = porGrupoPath.get(normalizarGrupoProduto(nomeGrupoProdutoDre(row.grupoProduto)));
    if (!pathGrupo) continue;

    let porP = acumGrupo.get(pathGrupo);
    if (!porP) {
      porP = {};
      acumGrupo.set(pathGrupo, porP);
    }
    acumularValor(porP, chaves, row.custoTotal);
  }

  for (const [pathKey, porP] of acumGrupo) {
    out.set(pathKey, porP);
  }
  return out;
}

/** Preenche 6.1.1 CPV Direto, 6.1.2 CPV Indireto (com MKP) e 6.2.2 margem MKP (bruto − líquido). */
export function montarValoresCpvSoAcoPorPathKey(
  roots: DreEstruturaNo[],
  diretoLinhas: DreCpvSoAcoLinha[],
  indiretoComMkpLinhas: DreCpvSoAcoLinha[],
  indiretoSemMkpLinhas: DreCpvSoAcoLinha[],
  periodos: string[],
  granularidade: 'dia' | 'mes',
): Map<string, Record<string, number>> {
  const out = new Map<string, Record<string, number>>();
  const cpvSoAco = encontrarNoPorCodigo(roots, '6.1');
  const cmvMoveis = encontrarNoPorCodigo(roots, '6.2');
  const sinais = mapaSinalPorPathKey(roots);

  const aplicarSinal = (pathKey: string, porP: Record<string, number>) => {
    const sinal = sinais.get(pathKey) ?? -1;
    const signed: Record<string, number> = {};
    for (const [p, v] of Object.entries(porP)) {
      signed[p] = v * sinal;
    }
    out.set(pathKey, signed);
  };

  if (cpvSoAco) {
    const noDireto = cpvSoAco.children?.find((c) => c.codigo === '6.1.1') ?? null;
    const noIndireto = cpvSoAco.children?.find((c) => c.codigo === '6.1.2') ?? null;
    for (const [pathKey, porP] of montarPorSecao(noDireto, diretoLinhas, periodos, granularidade)) {
      aplicarSinal(pathKey, porP);
    }
    for (const [pathKey, porP] of montarPorSecao(noIndireto, indiretoComMkpLinhas, periodos, granularidade)) {
      aplicarSinal(pathKey, porP);
    }
  }

  if (cmvMoveis) {
    const noIndireto622 = cmvMoveis.children?.find((c) => c.codigo === '6.2.2') ?? null;
    for (const [pathKey, porP] of montarPorSecao(noIndireto622, indiretoSemMkpLinhas, periodos, granularidade)) {
      aplicarSinal(pathKey, porP);
    }
  }

  return out;
}
