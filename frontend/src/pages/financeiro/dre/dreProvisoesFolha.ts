import type { DreEstruturaNo } from './ArvoreContasDre';
import { calcularFaturamentoIndiretoMoveisPorPeriodo, somarPeriodosNoSoMoveis } from './dreReceitaMoveisMap';
import { somarPeriodosNoSoAco } from './dreReceitaVendasMap';

/** Fórmulas de provisão sobre a linha de salários da mesma folha. */
export type FormulaProvisaoFolha = 'DECIMO' | 'FERIAS' | 'TERCO_FERIAS' | 'FGTS_FERIAS';

export type ProvisaoFolhaConfig = {
  codigoSalarios: string;
  codigoProvisao: string;
  formula: FormulaProvisaoFolha;
};

/** Operacional (10.1), Logística (11.2.1) e Administrativo (13.1). */
export const PROVISOES_FOLHA_DRE: ProvisaoFolhaConfig[] = [
  { codigoSalarios: '10.1.1', codigoProvisao: '10.1.2', formula: 'DECIMO' },
  { codigoSalarios: '10.1.1', codigoProvisao: '10.1.3', formula: 'FERIAS' },
  { codigoSalarios: '10.1.1', codigoProvisao: '10.1.4', formula: 'TERCO_FERIAS' },
  { codigoSalarios: '10.1.1', codigoProvisao: '10.1.6', formula: 'FGTS_FERIAS' },
  { codigoSalarios: '11.2.1.1', codigoProvisao: '11.2.1.2', formula: 'DECIMO' },
  { codigoSalarios: '11.2.1.1', codigoProvisao: '11.2.1.3', formula: 'FERIAS' },
  { codigoSalarios: '11.2.1.1', codigoProvisao: '11.2.1.4', formula: 'TERCO_FERIAS' },
  { codigoSalarios: '11.2.1.1', codigoProvisao: '11.2.1.6', formula: 'FGTS_FERIAS' },
  { codigoSalarios: '13.1.1', codigoProvisao: '13.1.9', formula: 'DECIMO' },
  { codigoSalarios: '13.1.1', codigoProvisao: '13.1.8', formula: 'FERIAS' },
  { codigoSalarios: '13.1.1', codigoProvisao: '13.1.16', formula: 'TERCO_FERIAS' },
  { codigoSalarios: '13.1.1', codigoProvisao: '13.1.11', formula: 'FGTS_FERIAS' },
];

/** Percentual de INSS aplicado sobre a Provisão de Férias. */
const PERCENTUAL_INSS_FERIAS = 0.26;

/**
 * Provisão INSS Férias = 26% × Provisão Férias da mesma folha.
 * Operacional (10.1.5 ← 10.1.3), Logística (11.2.1.5 ← 11.2.1.3) e Administrativo (13.1.10 ← 13.1.8).
 */
export const PROVISOES_INSS_FERIAS_DRE: { codigoFerias: string; codigoProvisao: string }[] = [
  { codigoFerias: '10.1.3', codigoProvisao: '10.1.5' },
  { codigoFerias: '11.2.1.3', codigoProvisao: '11.2.1.5' },
  { codigoFerias: '13.1.8', codigoProvisao: '13.1.10' },
];

const CODIGOS_PROVISAO_CALCULADA = new Set([
  ...PROVISOES_FOLHA_DRE.map((p) => p.codigoProvisao),
  ...PROVISOES_INSS_FERIAS_DRE.map((p) => p.codigoProvisao),
]);

export function isProvisaoCalculadaDre(codigo: string): boolean {
  return CODIGOS_PROVISAO_CALCULADA.has(codigo.trim());
}

function calcularValorProvisao(salario: number, formula: FormulaProvisaoFolha): number {
  if (!Number.isFinite(salario) || salario === 0) return 0;
  switch (formula) {
    case 'DECIMO':
      return salario / 12;
    case 'FERIAS':
      return salario / 12;
    case 'TERCO_FERIAS':
      return salario / 36;
    case 'FGTS_FERIAS':
      return salario * 0.08;
    default:
      return 0;
  }
}

function encontrarPathKeyPorCodigo(nodes: DreEstruturaNo[], codigo: string): string | null {
  for (const n of nodes) {
    if (n.codigo === codigo) return n.pathKey;
    const achado = encontrarPathKeyPorCodigo(n.children ?? [], codigo);
    if (achado) return achado;
  }
  return null;
}

function rollupSubarvore(
  n: DreEstruturaNo,
  somas: Map<string, Record<string, number>>,
  periodos: string[],
  roots: DreEstruturaNo[],
) {
  if (n.codigo === '1.4.2') {
    somas.set(n.pathKey, calcularFaturamentoIndiretoMoveisPorPeriodo(somas, roots, periodos));
    return;
  }
  const filhos = n.children ?? [];
  for (const ch of filhos) rollupSubarvore(ch, somas, periodos, roots);
  if (!filhos.length) return;
  if (n.codigo === '1.1.1') {
    somas.set(n.pathKey, somarPeriodosNoSoAco(somas, n, periodos));
    return;
  }
  if (n.codigo === '1.4') {
    somas.set(n.pathKey, somarPeriodosNoSoMoveis(somas, n, periodos));
    return;
  }
  const porP: Record<string, number> = {};
  for (const p of periodos) {
    porP[p] = filhos.reduce((s, ch) => s + (somas.get(ch.pathKey)?.[p] ?? 0), 0);
  }
  somas.set(n.pathKey, porP);
}

/** Aplica provisões (13º, férias, 1/3, FGTS férias) sobre salários e recompõe totais da árvore. */
export function aplicarProvisoesCalculadasFolha(
  roots: DreEstruturaNo[],
  somas: Map<string, Record<string, number>>,
  periodos: string[],
): void {
  const pathSalarios = new Map<string, string>();
  const pathProvisao = new Map<string, ProvisaoFolhaConfig>();

  for (const cfg of PROVISOES_FOLHA_DRE) {
    const pkSal = encontrarPathKeyPorCodigo(roots, cfg.codigoSalarios);
    const pkProv = encontrarPathKeyPorCodigo(roots, cfg.codigoProvisao);
    if (pkSal && pkProv) {
      pathSalarios.set(pkProv, pkSal);
      pathProvisao.set(pkProv, cfg);
    }
  }

  for (const [pkProv, cfg] of pathProvisao) {
    const pkSal = pathSalarios.get(pkProv);
    if (!pkSal) continue;
    const salarios = somas.get(pkSal) ?? {};
    const porP: Record<string, number> = {};
    for (const p of periodos) {
      const base = salarios[p] ?? 0;
      porP[p] = Math.round(calcularValorProvisao(base, cfg.formula) * 100) / 100;
    }
    somas.set(pkProv, porP);
  }

  // INSS Férias = 26% × Provisão Férias (já calculada acima).
  for (const cfg of PROVISOES_INSS_FERIAS_DRE) {
    const pkFerias = encontrarPathKeyPorCodigo(roots, cfg.codigoFerias);
    const pkProv = encontrarPathKeyPorCodigo(roots, cfg.codigoProvisao);
    if (!pkFerias || !pkProv) continue;
    const ferias = somas.get(pkFerias) ?? {};
    const porP: Record<string, number> = {};
    for (const p of periodos) {
      porP[p] = Math.round((ferias[p] ?? 0) * PERCENTUAL_INSS_FERIAS * 100) / 100;
    }
    somas.set(pkProv, porP);
  }

  for (const r of roots) rollupSubarvore(r, somas, periodos, roots);
}
