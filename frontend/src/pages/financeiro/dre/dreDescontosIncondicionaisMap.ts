import type { DreEstruturaNo } from './ArvoreContasDre';
import type { DreReceitaMoveisDiretoLinha } from '../../../api/financeiro';
import type { DreReceitaVendasLinha } from './dreReceitaVendasMap';
import { mapaSinalPorPathKey } from './dreSaidasSoAcoMap';

const CODIGO_SO_ACO = '2.1.3.1';
const CODIGO_SO_MOVEIS = '2.1.3.2';

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

function arredondarPorPeriodo(porP: Record<string, number>): void {
  for (const k of Object.keys(porP)) {
    porP[k] = Math.round(porP[k] * 100) / 100;
  }
}

function acumularDescontoNo(
  roots: DreEstruturaNo[],
  codigo: string,
  porP: Record<string, number>,
  desconto: number,
  chaves: string[],
): void {
  const no = encontrarNoPorCodigo(roots, codigo);
  if (!no || !chaves.length || !(desconto > 0)) return;
  const sinal = mapaSinalPorPathKey(roots).get(no.pathKey) ?? -1;
  acumularValor(porP, chaves, desconto * sinal);
}

/** Agrega ide.valorDesconto (totalDesconto) da receita Só Aço em 2.1.3.1. */
function montarDescontosSoAco(
  roots: DreEstruturaNo[],
  linhas: DreReceitaVendasLinha[],
  periodos: string[],
  granularidade: 'dia' | 'mes',
): Map<string, Record<string, number>> {
  const out = new Map<string, Record<string, number>>();
  const no = encontrarNoPorCodigo(roots, CODIGO_SO_ACO);
  if (!no) return out;

  const porP: Record<string, number> = {};
  for (const row of linhas) {
    if (String(row.idItemPedidoSM ?? '').trim() !== 'So Aco') continue;
    const chaves = chavesPeriodoParaMes(row.ano, row.mes, periodos, granularidade);
    acumularDescontoNo(roots, CODIGO_SO_ACO, porP, row.totalDesconto ?? 0, chaves);
  }

  arredondarPorPeriodo(porP);
  if (Object.keys(porP).length) out.set(no.pathKey, porP);
  return out;
}

/** Agrega ide.valorDesconto (totalDesconto) do faturamento direto Só Móveis em 2.1.3.2. */
function montarDescontosSoMoveis(
  roots: DreEstruturaNo[],
  linhas: DreReceitaMoveisDiretoLinha[],
  periodos: string[],
  granularidade: 'dia' | 'mes',
): Map<string, Record<string, number>> {
  const out = new Map<string, Record<string, number>>();
  const no = encontrarNoPorCodigo(roots, CODIGO_SO_MOVEIS);
  if (!no) return out;

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
    acumularDescontoNo(roots, CODIGO_SO_MOVEIS, porP, row.totalDesconto ?? 0, chaves);
  }

  arredondarPorPeriodo(porP);
  if (Object.keys(porP).length) out.set(no.pathKey, porP);
  return out;
}

/** 2.1.3.1 (Só Aço) + 2.1.3.2 (Só Móveis) — descontos incondicionais Nomus. */
export function montarValoresDescontosIncondicionaisPorPathKey(
  roots: DreEstruturaNo[],
  linhasSoAco: DreReceitaVendasLinha[],
  linhasSoMoveis: DreReceitaMoveisDiretoLinha[],
  periodos: string[],
  granularidade: 'dia' | 'mes',
): Map<string, Record<string, number>> {
  const out = new Map<string, Record<string, number>>();

  for (const [pathKey, porP] of montarDescontosSoAco(roots, linhasSoAco, periodos, granularidade)) {
    out.set(pathKey, porP);
  }
  for (const [pathKey, porP] of montarDescontosSoMoveis(roots, linhasSoMoveis, periodos, granularidade)) {
    out.set(pathKey, porP);
  }

  return out;
}
