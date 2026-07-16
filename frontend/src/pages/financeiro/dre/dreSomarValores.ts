import type { DreEstruturaNo } from './ArvoreContasDre';
import {
  ajustarRollupSecaoReceitaMoveis,
  aplicarFiltroEmpresaReceitaNomus,
  calcularFaturamentoIndiretoMoveisPorPeriodo,
  somarPeriodosNoSoMoveis,
} from './dreReceitaMoveisMap';
import { ajustarRollupSecaoReceitaVendas, somarPeriodosNoSoAco } from './dreReceitaVendasMap';
import { aplicarProvisoesCalculadasFolha } from './dreProvisoesFolha';

/** Totais por codigo de seção (nível raiz 1, 2, 4, …). */
function somaPorCodigo(
  somas: Map<string, Record<string, number>>,
  roots: DreEstruturaNo[],
  codigo: string,
  periodos: string[],
): Record<string, number> {
  const no = roots.find((r) => r.codigo === codigo);
  if (!no) return Object.fromEntries(periodos.map((p) => [p, 0]));
  return somas.get(no.pathKey) ?? Object.fromEntries(periodos.map((p) => [p, 0]));
}

function combinar(
  periodos: string[],
  ops: Array<{ sinal: 1 | -1; vals: Record<string, number> }>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of periodos) {
    out[p] = ops.reduce((acc, o) => acc + o.sinal * (o.vals[p] ?? 0), 0);
  }
  return out;
}

function somaPeriodoContas(
  ids: number[],
  periodo: string,
  valoresPorConta: Record<number, Record<string, number>>,
  sinalNo: number,
): number {
  let s = 0;
  for (const id of ids) {
    s += (valoresPorConta[id]?.[periodo] ?? 0) * sinalNo;
  }
  return s;
}

/** Monta mapa pathKey → valores por período (rollup + linhas calculadas). */
export function montarSomasDrePorPathKey(
  roots: DreEstruturaNo[],
  idsPorPathKey: Map<string, number[]>,
  periodos: string[],
  valoresPorConta: Record<number, Record<string, number>>,
  valoresPorPathKeyExterno?: Map<string, Record<string, number>>,
  filtroReceitaEmpresas?: { incluirAco: boolean; incluirMoveis: boolean },
): Map<string, Record<string, number>> {
  const out = new Map<string, Record<string, number>>();

  function visit(n: DreEstruturaNo) {
    n.children?.forEach(visit);
    const porP: Record<string, number> = {};
    const filhos = n.children ?? [];

    if (n.tipo === 'T' && n.calcId) {
      const calc = calcularLinhaTotal(n.calcId, roots, out, periodos);
      for (const p of periodos) porP[p] = calc[p] ?? 0;
    } else if (n.codigo === '1.4.2') {
      Object.assign(porP, calcularFaturamentoIndiretoMoveisPorPeriodo(out, roots, periodos));
    } else if (filhos.length > 0) {
      if (n.codigo === '1.1.1') {
        Object.assign(porP, somarPeriodosNoSoAco(out, n, periodos));
      } else if (n.codigo === '1.4') {
        Object.assign(porP, somarPeriodosNoSoMoveis(out, n, periodos));
      } else {
        for (const p of periodos) {
          porP[p] = filhos.reduce((s, ch) => s + (out.get(ch.pathKey)?.[p] ?? 0), 0);
        }
      }
    } else if (n.tipo === 'A') {
      const ext = valoresPorPathKeyExterno?.get(n.pathKey);
      if (ext) {
        for (const p of periodos) porP[p] = ext[p] ?? 0;
      } else {
        const ids = idsPorPathKey.get(n.pathKey) ?? (n.id != null && n.id > 0 ? [n.id] : []);
        const sinal = n.sinal ?? -1;
        for (const p of periodos) {
          porP[p] = somaPeriodoContas(ids, p, valoresPorConta, sinal);
        }
      }
    }

    out.set(n.pathKey, porP);
  }

  roots.forEach(visit);

  if (valoresPorPathKeyExterno?.size) {
    ajustarRollupSecaoReceitaVendas(roots, out, periodos);
    ajustarRollupSecaoReceitaMoveis(roots, out, periodos);
    const receitaBruta = encontrarNoPorCodigo(roots, '1');
    if (receitaBruta) rollupNo(receitaBruta, out, periodos);
  }

  aplicarProvisoesCalculadasFolha(roots, out, periodos);

  if (valoresPorPathKeyExterno?.size) {
    ajustarRollupSecaoReceitaVendas(roots, out, periodos);
    ajustarRollupSecaoReceitaMoveis(roots, out, periodos);
    const receitaBruta = encontrarNoPorCodigo(roots, '1');
    if (receitaBruta) rollupNo(receitaBruta, out, periodos);
  }

  if (filtroReceitaEmpresas) {
    aplicarFiltroEmpresaReceitaNomus(
      roots,
      out,
      periodos,
      filtroReceitaEmpresas.incluirAco,
      filtroReceitaEmpresas.incluirMoveis,
    );
  }

  recalcularLinhasTotais(roots, roots, out, periodos);

  return out;
}

function encontrarNoPorCodigo(nodes: DreEstruturaNo[], codigo: string): DreEstruturaNo | null {
  for (const n of nodes) {
    if (n.codigo === codigo) return n;
    const achado = encontrarNoPorCodigo(n.children ?? [], codigo);
    if (achado) return achado;
  }
  return null;
}

function rollupNo(n: DreEstruturaNo, somas: Map<string, Record<string, number>>, periodos: string[]) {
  const filhos = n.children ?? [];
  if (!filhos.length) return;
  const porP: Record<string, number> = {};
  for (const p of periodos) {
    porP[p] = filhos.reduce((s, ch) => s + (somas.get(ch.pathKey)?.[p] ?? 0), 0);
  }
  somas.set(n.pathKey, porP);
}

function recalcularLinhasTotais(nodes: DreEstruturaNo[], roots: DreEstruturaNo[], somas: Map<string, Record<string, number>>, periodos: string[]) {
  for (const n of nodes) {
    if (n.tipo === 'T' && n.calcId) {
      somas.set(n.pathKey, calcularLinhaTotal(n.calcId, roots, somas, periodos));
    }
    recalcularLinhasTotais(n.children ?? [], roots, somas, periodos);
  }
}

/**
 * Valores de 1.3.x vêm do Nomus (fórmula indireta). O toggle MKP só exibe a coluna % na grade.
 */
export function aplicarMkpNasSomas(
  _roots: DreEstruturaNo[],
  _somas: Map<string, Record<string, number>>,
  _periodos: string[],
): void {
  /* noop — líquido MKP já calculado em dreReceitaIndiretaMap */
}

function calcularLinhaTotal(
  calcId: string,
  roots: DreEstruturaNo[],
  somas: Map<string, Record<string, number>>,
  periodos: string[],
): Record<string, number> {
  const c = (cod: string) => somaPorCodigo(somas, roots, cod, periodos);

  /** Seções de dedução/custo já vêm com sinal na árvore (negativas); somar, não subtrair de novo. */
  const deduzir = (cod: string) => ({ sinal: 1 as const, vals: c(cod) });

  switch (calcId) {
    case 'RL_ANTES_IMPOSTOS':
      return combinar(periodos, [{ sinal: 1, vals: c('1') }, deduzir('2')]);
    case 'RECEITA_LIQUIDA':
      return combinar(periodos, [
        { sinal: 1, vals: calcularLinhaTotal('RL_ANTES_IMPOSTOS', roots, somas, periodos) },
        deduzir('4'),
      ]);
    case 'LUCRO_BRUTO':
      return combinar(periodos, [
        { sinal: 1, vals: calcularLinhaTotal('RECEITA_LIQUIDA', roots, somas, periodos) },
        deduzir('6'),
        deduzir('8'),
        deduzir('10'),
        deduzir('11'),
      ]);
    case 'EBITDA':
      return combinar(periodos, [
        { sinal: 1, vals: calcularLinhaTotal('LUCRO_BRUTO', roots, somas, periodos) },
        deduzir('13'),
        deduzir('14'),
        deduzir('15'),
      ]);
    case 'LUCRO_ANTES_IMPOSTO':
      return combinar(periodos, [
        { sinal: 1, vals: calcularLinhaTotal('EBITDA', roots, somas, periodos) },
        deduzir('17'),
      ]);
    case 'LUCRO_LIQUIDO':
      return combinar(periodos, [
        { sinal: 1, vals: calcularLinhaTotal('LUCRO_ANTES_IMPOSTO', roots, somas, periodos) },
        deduzir('19'),
      ]);
    case 'LUCRO_APOS_RETIRADAS':
      return combinar(periodos, [
        { sinal: 1, vals: calcularLinhaTotal('LUCRO_LIQUIDO', roots, somas, periodos) },
        deduzir('21'),
      ]);
    default:
      return Object.fromEntries(periodos.map((p) => [p, 0]));
  }
}

export function montarMapaIdsPorPathKey(roots: DreEstruturaNo[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  function walk(n: DreEstruturaNo) {
    if (n.tipo === 'A' && n.id != null && n.id > 0) {
      map.set(n.pathKey, [n.id]);
    }
    n.children?.forEach(walk);
  }
  roots.forEach(walk);
  return map;
}

export function agregarValoresPorContaDre(
  contribuicoes: { idContaFinanceiro: number; periodo: string; valor: number }[],
): Record<number, Record<string, number>> {
  const out: Record<number, Record<string, number>> = {};
  for (const c of contribuicoes) {
    if (!out[c.idContaFinanceiro]) out[c.idContaFinanceiro] = {};
    out[c.idContaFinanceiro][c.periodo] = (out[c.idContaFinanceiro][c.periodo] ?? 0) + c.valor;
  }
  return out;
}
