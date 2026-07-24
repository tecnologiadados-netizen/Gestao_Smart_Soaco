/**
 * Dashboard Financeiro — agrega dados DRE existentes (sem alterar loaders).
 * Consolida RN + Só Móveis; calcula KPIs, séries, waterfall, PE e insights.
 */
import { carregarSaidasSoAcoDre, type DreSaidasSoAcoAgregado } from './dreSaidasSoAcoRepository.js';
import { queryDreReceitaVendasProdutos } from './dreReceitaVendasRepository.js';
import {
  queryDreReceitaIndiretaBruto,
  queryDreReceitaIndiretaLiquido,
} from './dreReceitaIndiretaRepository.js';
import { queryDreReceitaMoveisDireto } from './dreReceitaMoveisDiretoRepository.js';
import { carregarReceitaRefrigeracaoShop9Dre } from './dreShop9ReceitaRefrigeracaoRepository.js';
import { queryDreDevolucoes } from './dreDevolucoesRepository.js';
import { queryDreCpvSoAco } from './dreCpvSoAcoRepository.js';
import { queryDreCpvMoveisDireto } from './dreCpvMoveisDiretoRepository.js';
import {
  DRE_DASH_DESPESAS_PRINCIPAIS,
  DRE_DASH_ID_ACO,
  DRE_DASH_ID_MOVEIS,
  DRE_DASH_ID_REFRIGERACAO,
  DRE_DASH_ID_RN_MARQUES,
  DRE_DASH_PREFIXOS,
  DRE_DASH_UNIDADES_COMPARATIVO,
  GRUPO_RN_SOMOVEIS,
  resolverUnidadeDashboard,
  type DreDashUnidade,
} from './dreDashboardEmpresas.js';

export type DreDashboardParams = {
  dataInicio: string;
  dataFim: string;
  /** todas | grupo_rn_moveis | 1 | 3 | … */
  unidade?: string;
  metaEbitdaPct?: number;
  metaLucroPct?: number;
};

type TotaisMes = {
  periodo: string;
  faturamento: number;
  deducoes: number;
  impostos: number;
  cpv: number;
  despVar: number;
  pessoalOp: number;
  despOi: number;
  pessoalLog: number;
  despAdm: number;
  pessoalAdm: number;
  despCom: number;
  despTerceiros: number;
  despOp: number;
  despFin: number;
  tributos: number;
  receitaLiquida: number;
  lucroBruto: number;
  ebitda: number;
  lucroLiquido: number;
};

function mesKey(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}`;
}

function listarMeses(dataInicio: string, dataFim: string): string[] {
  const out: string[] = [];
  const [yi, mi] = dataInicio.split('-').map(Number);
  const [yf, mf] = dataFim.split('-').map(Number);
  if (!yi || !mi || !yf || !mf) return out;
  let y = yi;
  let m = mi;
  while (y < yf || (y === yf && m <= mf)) {
    out.push(mesKey(y, m));
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function addMes(map: Record<string, number>, periodo: string, valor: number): void {
  if (!periodo || !Number.isFinite(valor) || valor === 0) return;
  map[periodo] = (map[periodo] ?? 0) + valor;
}

function sumPrefix(
  linhas: DreSaidasSoAcoAgregado[],
  prefix: string,
  periodo: string,
): number {
  let s = 0;
  for (const l of linhas) {
    if (l.periodo !== periodo) continue;
    if (l.pathKey === prefix || l.pathKey.startsWith(`${prefix}/`)) {
      s += Math.abs(l.valor);
    }
  }
  return s;
}

function sumPrefixMeses(
  linhas: DreSaidasSoAcoAgregado[],
  prefix: string,
  periodos: ReadonlySet<string>,
): number {
  let s = 0;
  for (const l of linhas) {
    if (!periodos.has(l.periodo)) continue;
    if (l.pathKey === prefix || l.pathKey.startsWith(`${prefix}/`)) {
      s += Math.abs(l.valor);
    }
  }
  return s;
}

/** Pizza de principais despesas + detalhe (filhos de 1º nível da árvore DRE). */
function montarDespesasPrincipais(saidas: DreSaidasSoAcoAgregado[], meses: string[]) {
  const periodos = new Set(meses);
  const fatias = DRE_DASH_DESPESAS_PRINCIPAIS.map((g) => {
    const valor = Math.round(sumPrefixMeses(saidas, g.pathKey, periodos) * 100) / 100;
    const detalhes = g.filhos
      .map((f) => {
        const v = Math.round(sumPrefixMeses(saidas, f.pathKey, periodos) * 100) / 100;
        return {
          codigo: f.codigo,
          label: f.label,
          pathKey: f.pathKey,
          valor: -v,
          pctGrupo: null as number | null,
        };
      })
      .filter((d) => d.valor !== 0)
      .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));

    const somaFilhos = detalhes.reduce((acc, d) => acc + Math.abs(d.valor), 0);
    for (const d of detalhes) {
      d.pctGrupo = somaFilhos > 0 ? (Math.abs(d.valor) / somaFilhos) * 100 : null;
    }

    return {
      id: g.id,
      codigo: g.codigo,
      label: g.label,
      pathKey: g.pathKey,
      valor: -valor,
      pctTotal: null as number | null,
      detalhes,
    };
  }).filter((f) => f.valor !== 0);

  const total = fatias.reduce((acc, f) => acc + Math.abs(f.valor), 0);
  for (const f of fatias) {
    f.pctTotal = total > 0 ? (Math.abs(f.valor) / total) * 100 : null;
  }

  return { total: -total, fatias };
}

function pctVar(atual: number, base: number): number | null {
  if (!Number.isFinite(atual) || !Number.isFinite(base) || base === 0) return null;
  return ((atual - base) / Math.abs(base)) * 100;
}

function margem(valor: number, fat: number): number | null {
  if (!Number.isFinite(fat) || fat === 0) return null;
  return (valor / fat) * 100;
}

function shiftMes(periodo: string, delta: number): string | null {
  const [y, m] = periodo.split('-').map(Number);
  if (!y || !m) return null;
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return mesKey(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

async function carregarReceitaPorMes(
  dataInicio: string,
  dataFim: string,
  ids: number[],
): Promise<Record<string, number>> {
  const map: Record<string, number> = {};
  const wantsAco = ids.includes(DRE_DASH_ID_ACO);
  const wantsMoveis = ids.includes(DRE_DASH_ID_MOVEIS);
  const wantsShop9 =
    ids.includes(DRE_DASH_ID_REFRIGERACAO) || ids.includes(DRE_DASH_ID_RN_MARQUES);

  const tasks: Promise<void>[] = [];

  if (wantsAco) {
    tasks.push(
      (async () => {
        const [vendas, bruto, liquido] = await Promise.all([
          queryDreReceitaVendasProdutos({ dataInicio, dataFim, idEmpresaSaida: DRE_DASH_ID_ACO }),
          queryDreReceitaIndiretaBruto({ dataInicio, dataFim, idEmpresaSaida: DRE_DASH_ID_ACO }),
          queryDreReceitaIndiretaLiquido({ dataInicio, dataFim, idEmpresaSaida: DRE_DASH_ID_ACO }),
        ]);
        for (const r of vendas.linhas ?? []) {
          addMes(map, mesKey(r.ano, r.mes), r.valorTotal);
        }
        // 1.1.1 ≈ direto + líquido MKP; 1.2 bruto não entra no total Só Aço — margem vai a Móveis.
        for (const r of liquido.linhas ?? []) {
          addMes(map, mesKey(r.ano, r.mes), r.valorLiquido);
        }
        void bruto;
      })(),
    );
  }

  if (wantsMoveis) {
    tasks.push(
      (async () => {
        const [direto, bruto, liquido] = await Promise.all([
          queryDreReceitaMoveisDireto({ dataInicio, dataFim, idEmpresaSaida: DRE_DASH_ID_MOVEIS }),
          queryDreReceitaIndiretaBruto({ dataInicio, dataFim, idEmpresaSaida: DRE_DASH_ID_ACO }),
          queryDreReceitaIndiretaLiquido({ dataInicio, dataFim, idEmpresaSaida: DRE_DASH_ID_ACO }),
        ]);
        for (const r of direto.linhas ?? []) {
          addMes(map, mesKey(r.ano, r.mes), r.valorTotal);
        }
        // 1.4.2 ≈ bruto − líquido (quando Aço não está no filtro, ainda assim a margem é de Móveis)
        if (!wantsAco) {
          const brutoMes: Record<string, number> = {};
          const liqMes: Record<string, number> = {};
          for (const r of bruto.linhas ?? []) addMes(brutoMes, mesKey(r.ano, r.mes), r.valorTotal);
          for (const r of liquido.linhas ?? []) addMes(liqMes, mesKey(r.ano, r.mes), r.valorLiquido);
          for (const p of new Set([...Object.keys(brutoMes), ...Object.keys(liqMes)])) {
            addMes(map, p, (brutoMes[p] ?? 0) - (liqMes[p] ?? 0));
          }
        } else {
          const brutoMes: Record<string, number> = {};
          const liqMes: Record<string, number> = {};
          for (const r of bruto.linhas ?? []) addMes(brutoMes, mesKey(r.ano, r.mes), r.valorTotal);
          for (const r of liquido.linhas ?? []) addMes(liqMes, mesKey(r.ano, r.mes), r.valorLiquido);
          for (const p of new Set([...Object.keys(brutoMes), ...Object.keys(liqMes)])) {
            addMes(map, p, (brutoMes[p] ?? 0) - (liqMes[p] ?? 0));
          }
        }
      })(),
    );
  }

  if (wantsShop9) {
    const shopIds = ids.filter(
      (id) => id === DRE_DASH_ID_REFRIGERACAO || id === DRE_DASH_ID_RN_MARQUES,
    );
    tasks.push(
      (async () => {
        const res = await carregarReceitaRefrigeracaoShop9Dre({
          dataInicio,
          dataFim,
          idEmpresas: shopIds,
          granularidade: 'mes',
        });
        for (const l of res.linhas ?? []) {
          // Receita Shop9 pathKeys sob D/0 (1.5 / 1.6)
          if (l.pathKey.startsWith('D/0/') || l.pathKey === 'D/0') {
            addMes(map, l.periodo, Math.abs(l.valor));
          }
        }
      })(),
    );
  }

  await Promise.all(tasks);
  return map;
}

async function carregarCpvPorMes(
  dataInicio: string,
  dataFim: string,
  ids: number[],
): Promise<Record<string, number>> {
  const map: Record<string, number> = {};
  const tasks: Promise<void>[] = [];

  if (ids.includes(DRE_DASH_ID_ACO)) {
    tasks.push(
      (async () => {
        const cpv = await queryDreCpvSoAco({
          dataInicio,
          dataFim,
          idEmpresaSaida: DRE_DASH_ID_ACO,
        });
        for (const r of cpv.direto ?? []) addMes(map, mesKey(r.ano, r.mes), r.custoTotal);
        for (const r of cpv.indireto ?? []) addMes(map, mesKey(r.ano, r.mes), r.custoTotal);
      })(),
    );
  }

  if (ids.includes(DRE_DASH_ID_MOVEIS)) {
    tasks.push(
      (async () => {
        const [cpvMoveis, cpvMargem] = await Promise.all([
          queryDreCpvMoveisDireto({ dataInicio, dataFim, idEmpresaSaida: DRE_DASH_ID_MOVEIS }),
          queryDreCpvSoAco({ dataInicio, dataFim, idEmpresaSaida: DRE_DASH_ID_ACO }),
        ]);
        for (const r of cpvMoveis.linhas ?? []) addMes(map, mesKey(r.ano, r.mes), r.custoTotal);
        if (!ids.includes(DRE_DASH_ID_ACO)) {
          for (const r of cpvMargem.indiretoSemMkp ?? []) {
            addMes(map, mesKey(r.ano, r.mes), r.custoTotal);
          }
        } else {
          for (const r of cpvMargem.indiretoSemMkp ?? []) {
            addMes(map, mesKey(r.ano, r.mes), r.custoTotal);
          }
        }
      })(),
    );
  }

  const shopIds = ids.filter(
    (id) => id === DRE_DASH_ID_REFRIGERACAO || id === DRE_DASH_ID_RN_MARQUES,
  );
  if (shopIds.length) {
    tasks.push(
      (async () => {
        const res = await carregarReceitaRefrigeracaoShop9Dre({
          dataInicio,
          dataFim,
          idEmpresas: shopIds,
          granularidade: 'mes',
        });
        for (const l of res.linhas ?? []) {
          if (l.pathKey.startsWith('D/5/') || l.pathKey === 'D/5') {
            addMes(map, l.periodo, Math.abs(l.valor));
          }
        }
      })(),
    );
  }

  await Promise.all(tasks);
  return map;
}

async function carregarDeducoesPorMes(
  dataInicio: string,
  dataFim: string,
  ids: number[],
): Promise<Record<string, number>> {
  const map: Record<string, number> = {};
  const tasks: Promise<void>[] = [];

  const idEmpresasNomus = ids.filter((id) => id === DRE_DASH_ID_ACO || id === DRE_DASH_ID_MOVEIS);
  if (idEmpresasNomus.length) {
    tasks.push(
      (async () => {
        const res = await queryDreDevolucoes({ dataInicio, dataFim, idEmpresas: idEmpresasNomus });
        for (const r of res.linhas ?? []) {
          if (!ids.includes(r.idEmpresaEntrada)) continue;
          addMes(map, mesKey(r.ano, r.mes), Math.abs(r.valorTotal));
        }
      })(),
    );
  }

  // Descontos incondicionais Nomus (mesma base da DRE 2.1.3.x)
  if (ids.includes(DRE_DASH_ID_ACO)) {
    tasks.push(
      (async () => {
        const vendas = await queryDreReceitaVendasProdutos({
          dataInicio,
          dataFim,
          idEmpresaSaida: DRE_DASH_ID_ACO,
        });
        for (const r of vendas.linhas ?? []) {
          addMes(map, mesKey(r.ano, r.mes), Math.abs(r.totalDesconto ?? 0));
        }
      })(),
    );
  }
  if (ids.includes(DRE_DASH_ID_MOVEIS)) {
    tasks.push(
      (async () => {
        const direto = await queryDreReceitaMoveisDireto({
          dataInicio,
          dataFim,
          idEmpresaSaida: DRE_DASH_ID_MOVEIS,
        });
        for (const r of direto.linhas ?? []) {
          addMes(map, mesKey(r.ano, r.mes), Math.abs(r.totalDesconto ?? 0));
        }
      })(),
    );
  }

  // Descontos / devoluções Shop9 (pathKeys sob D/1 na DRE)
  const shopIds = ids.filter(
    (id) => id === DRE_DASH_ID_REFRIGERACAO || id === DRE_DASH_ID_RN_MARQUES,
  );
  if (shopIds.length) {
    tasks.push(
      (async () => {
        const res = await carregarReceitaRefrigeracaoShop9Dre({
          dataInicio,
          dataFim,
          idEmpresas: shopIds,
          granularidade: 'mes',
        });
        for (const l of res.linhas ?? []) {
          if (l.pathKey === 'D/1' || l.pathKey.startsWith('D/1/')) {
            addMes(map, l.periodo, Math.abs(l.valor));
          }
        }
      })(),
    );
  }

  await Promise.all(tasks);
  return map;
}

type FormulaProvisaoDash = 'DECIMO' | 'FERIAS' | 'TERCO_FERIAS' | 'FGTS_FERIAS';

/** Espelha dreProvisoesFolha.ts — pathKeys da estrutura DRE. */
const PROVISOES_FOLHA_DASH: {
  pathSalarios: string;
  pathProvisao: string;
  formula: FormulaProvisaoDash;
}[] = [
  // Operacional 10.1
  { pathSalarios: 'D/7/0/0', pathProvisao: 'D/7/0/1', formula: 'DECIMO' },
  { pathSalarios: 'D/7/0/0', pathProvisao: 'D/7/0/2', formula: 'FERIAS' },
  { pathSalarios: 'D/7/0/0', pathProvisao: 'D/7/0/3', formula: 'TERCO_FERIAS' },
  { pathSalarios: 'D/7/0/0', pathProvisao: 'D/7/0/5', formula: 'FGTS_FERIAS' },
  // Logística 11.2.1
  { pathSalarios: 'D/8/1/0/0', pathProvisao: 'D/8/1/0/1', formula: 'DECIMO' },
  { pathSalarios: 'D/8/1/0/0', pathProvisao: 'D/8/1/0/2', formula: 'FERIAS' },
  { pathSalarios: 'D/8/1/0/0', pathProvisao: 'D/8/1/0/3', formula: 'TERCO_FERIAS' },
  { pathSalarios: 'D/8/1/0/0', pathProvisao: 'D/8/1/0/5', formula: 'FGTS_FERIAS' },
  // Administrativo 13.1
  { pathSalarios: 'D/10/0/0', pathProvisao: 'D/10/0/8', formula: 'DECIMO' },
  { pathSalarios: 'D/10/0/0', pathProvisao: 'D/10/0/7', formula: 'FERIAS' },
  { pathSalarios: 'D/10/0/0', pathProvisao: 'D/10/0/11', formula: 'TERCO_FERIAS' },
  { pathSalarios: 'D/10/0/0', pathProvisao: 'D/10/0/10', formula: 'FGTS_FERIAS' },
];

const PROVISOES_INSS_FERIAS_DASH: { pathFerias: string; pathProvisao: string }[] = [
  { pathFerias: 'D/7/0/2', pathProvisao: 'D/7/0/4' },
  { pathFerias: 'D/8/1/0/2', pathProvisao: 'D/8/1/0/4' },
  { pathFerias: 'D/10/0/7', pathProvisao: 'D/10/0/9' },
];

const PATHS_PROVISAO_CALCULADA = new Set([
  ...PROVISOES_FOLHA_DASH.map((p) => p.pathProvisao),
  ...PROVISOES_INSS_FERIAS_DASH.map((p) => p.pathProvisao),
]);

function calcularValorProvisaoDash(salario: number, formula: FormulaProvisaoDash): number {
  if (!Number.isFinite(salario) || salario === 0) return 0;
  switch (formula) {
    case 'DECIMO':
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

/**
 * Aplica provisões calculadas de folha (como na DRE) nas saídas do dashboard,
 * sobrescrevendo folhas de provisão para não misturar com lançamentos avulsos.
 */
function aplicarProvisoesFolhaNasSaidas(
  saidas: DreSaidasSoAcoAgregado[],
  periodos: string[],
): DreSaidasSoAcoAgregado[] {
  const filtradas = saidas.filter((l) => !PATHS_PROVISAO_CALCULADA.has(l.pathKey));
  const salarioPorPeriodo = (pathKey: string): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const l of filtradas) {
      if (l.pathKey !== pathKey) continue;
      out[l.periodo] = (out[l.periodo] ?? 0) + Math.abs(l.valor);
    }
    return out;
  };

  const extras: DreSaidasSoAcoAgregado[] = [];
  const feriasPorPath: Record<string, Record<string, number>> = {};

  for (const cfg of PROVISOES_FOLHA_DASH) {
    const salarios = salarioPorPeriodo(cfg.pathSalarios);
    const porP: Record<string, number> = {};
    for (const p of periodos) {
      const v = Math.round(calcularValorProvisaoDash(salarios[p] ?? 0, cfg.formula) * 100) / 100;
      if (v === 0) continue;
      porP[p] = v;
      extras.push({ pathKey: cfg.pathProvisao, periodo: p, valor: v });
    }
    if (cfg.formula === 'FERIAS') feriasPorPath[cfg.pathProvisao] = porP;
  }

  for (const cfg of PROVISOES_INSS_FERIAS_DASH) {
    const ferias =
      feriasPorPath[cfg.pathFerias] ??
      (() => {
        const m: Record<string, number> = {};
        for (const e of extras) {
          if (e.pathKey !== cfg.pathFerias) continue;
          m[e.periodo] = (m[e.periodo] ?? 0) + e.valor;
        }
        return m;
      })();
    for (const p of periodos) {
      const v = Math.round((ferias[p] ?? 0) * 0.26 * 100) / 100;
      if (v === 0) continue;
      extras.push({ pathKey: cfg.pathProvisao, periodo: p, valor: v });
    }
  }

  return [...filtradas, ...extras];
}

function montarTotaisMes(
  periodo: string,
  receita: number,
  deducoes: number,
  cpv: number,
  saidas: DreSaidasSoAcoAgregado[],
): TotaisMes {
  const impostos = sumPrefix(saidas, DRE_DASH_PREFIXOS.impostos, periodo);
  const despVar = sumPrefix(saidas, DRE_DASH_PREFIXOS.despVar, periodo);
  const pessoalOp = sumPrefix(saidas, DRE_DASH_PREFIXOS.pessoalOp, periodo);
  const despOi = sumPrefix(saidas, DRE_DASH_PREFIXOS.despOi, periodo);
  const pessoalLog = sumPrefix(saidas, DRE_DASH_PREFIXOS.pessoalLog, periodo);
  const despAdm = sumPrefix(saidas, DRE_DASH_PREFIXOS.despAdm, periodo);
  const pessoalAdmFolha = sumPrefix(saidas, DRE_DASH_PREFIXOS.pessoalAdm, periodo);
  const pessoalAdmVar = sumPrefix(saidas, DRE_DASH_PREFIXOS.pessoalAdmVar, periodo);
  const pessoalAdm = pessoalAdmFolha + pessoalAdmVar;
  const despCom = sumPrefix(saidas, DRE_DASH_PREFIXOS.despCom, periodo);
  const despTerceiros = sumPrefix(saidas, DRE_DASH_PREFIXOS.despTerceiros, periodo);
  const despFin = sumPrefix(saidas, DRE_DASH_PREFIXOS.despFin, periodo);
  const tributos = sumPrefix(saidas, DRE_DASH_PREFIXOS.tributos, periodo);
  const despOp = despAdm + despCom + despTerceiros;

  // Fórmulas alinhadas a dreSomarValores (sinais: deduções já como valores positivos a subtrair)
  const receitaLiquida = receita - deducoes - impostos;
  const lucroBruto = receitaLiquida - cpv - despVar - pessoalOp - despOi;
  const ebitda = lucroBruto - despAdm - despCom - despTerceiros;
  const lucroLiquido = ebitda - despFin - tributos;

  return {
    periodo,
    faturamento: receita,
    deducoes,
    impostos,
    cpv,
    despVar,
    pessoalOp,
    despOi,
    pessoalLog,
    despAdm,
    pessoalAdm,
    despCom,
    despTerceiros,
    despOp,
    despFin,
    tributos,
    receitaLiquida,
    lucroBruto,
    ebitda,
    lucroLiquido,
  };
}

async function carregarTotaisUnidade(
  dataInicio: string,
  dataFim: string,
  unidade: DreDashUnidade,
): Promise<{ meses: string[]; porMes: Record<string, TotaisMes>; saidas: DreSaidasSoAcoAgregado[] }> {
  const ids = unidade.idEmpresas;
  const meses = listarMeses(dataInicio, dataFim);

  const [saidasRes, receitaMap, cpvMap, deducoesMap] = await Promise.all([
    carregarSaidasSoAcoDre({ dataInicio, dataFim, idEmpresas: ids, granularidade: 'mes' }),
    carregarReceitaPorMes(dataInicio, dataFim, ids),
    carregarCpvPorMes(dataInicio, dataFim, ids),
    carregarDeducoesPorMes(dataInicio, dataFim, ids),
  ]);

  const saidasBrutas = saidasRes.linhas ?? [];
  const saidas = aplicarProvisoesFolhaNasSaidas(saidasBrutas, meses);
  const porMes: Record<string, TotaisMes> = {};
  for (const p of meses) {
    porMes[p] = montarTotaisMes(
      p,
      receitaMap[p] ?? 0,
      deducoesMap[p] ?? 0,
      cpvMap[p] ?? 0,
      saidas,
    );
  }
  return { meses, porMes, saidas };
}

function somarPeriodo(porMes: Record<string, TotaisMes>, periodos: string[]): TotaisMes {
  const acc = montarTotaisMes('_', 0, 0, 0, []);
  acc.periodo = periodos.join(',');
  for (const p of periodos) {
    const t = porMes[p];
    if (!t) continue;
    acc.faturamento += t.faturamento;
    acc.deducoes += t.deducoes;
    acc.impostos += t.impostos;
    acc.cpv += t.cpv;
    acc.despVar += t.despVar;
    acc.pessoalOp += t.pessoalOp;
    acc.despOi += t.despOi;
    acc.pessoalLog += t.pessoalLog;
    acc.despAdm += t.despAdm;
    acc.pessoalAdm += t.pessoalAdm;
    acc.despCom += t.despCom;
    acc.despTerceiros += t.despTerceiros;
    acc.despOp += t.despOp;
    acc.despFin += t.despFin;
    acc.tributos += t.tributos;
    acc.receitaLiquida += t.receitaLiquida;
    acc.lucroBruto += t.lucroBruto;
    acc.ebitda += t.ebitda;
    acc.lucroLiquido += t.lucroLiquido;
  }
  return acc;
}

function calcularAnalise(
  atual: TotaisMes,
  metaEbitdaPct: number,
  metaLucroPct: number,
) {
  const fat = atual.faturamento;
  const cpvPct = fat > 0 ? atual.cpv / fat : 0;
  const fixo = Math.abs(
    atual.deducoes +
      atual.impostos +
      atual.despVar +
      atual.pessoalOp +
      atual.despOi +
      atual.despAdm +
      atual.despCom +
      atual.despTerceiros +
      atual.despFin +
      atual.tributos,
  );
  const contrib = 1 - cpvPct;
  const pontoEquilibrio = contrib > 0.001 ? fixo / contrib : null;

  const mE = metaEbitdaPct / 100;
  const mL = metaLucroPct / 100;
  const denE = contrib - mE;
  const denL = contrib - mL;
  const faturamentoMetaEbitda = denE > 0.001 ? fixo / denE : null;
  const faturamentoMetaLucro = denL > 0.001 ? fixo / denL : null;

  return {
    pontoEquilibrio,
    faturamentoMetaEbitda,
    faturamentoMetaLucro,
    metaEbitdaPct,
    metaLucroPct,
    premissas: {
      cpvPct: cpvPct * 100,
      custosFixos: fixo,
      margemContribuicaoPct: contrib * 100,
      descricao:
        'Variável ≈ CPV/CMV ÷ Faturamento. Fixo ≈ demais custos do período (deduções, impostos, despesas e pessoal). PE = Fixo / (1 − CPV%). Faturamento-meta = Fixo / (1 − CPV% − meta%).',
    },
  };
}

function gerarInsights(
  porMes: Record<string, TotaisMes>,
  meses: string[],
  atual: TotaisMes,
  comparativoEmpresas: { label: string; lucroLiquido: number; margemLiquida: number | null }[],
): { severidade: 'positivo' | 'atencao' | 'critico'; titulo: string; texto: string }[] {
  const insights: { severidade: 'positivo' | 'atencao' | 'critico'; titulo: string; texto: string }[] = [];
  if (meses.length === 0) return insights;

  const ultimo = meses[meses.length - 1]!;
  const ant = shiftMes(ultimo, -1);
  const tUlt = porMes[ultimo];
  const tAnt = ant ? porMes[ant] : null;

  if (tUlt && tAnt) {
    const vars: { nome: string; v: number | null; inverso?: boolean }[] = [
      { nome: 'Faturamento', v: pctVar(tUlt.faturamento, tAnt.faturamento) },
      { nome: 'EBITDA', v: pctVar(tUlt.ebitda, tAnt.ebitda) },
      { nome: 'Lucro Líquido', v: pctVar(tUlt.lucroLiquido, tAnt.lucroLiquido) },
      { nome: 'CPV/CMV', v: pctVar(tUlt.cpv, tAnt.cpv), inverso: true },
      { nome: 'Despesas Operacionais', v: pctVar(tUlt.despOp, tAnt.despOp), inverso: true },
    ];
    const validas = vars.filter((x) => x.v != null) as { nome: string; v: number; inverso?: boolean }[];
    if (validas.length) {
      const melhor = [...validas].sort((a, b) => (b.inverso ? -b.v : b.v) - (a.inverso ? -a.v : a.v))[0]!;
      const pior = [...validas].sort((a, b) => (a.inverso ? -a.v : a.v) - (b.inverso ? -b.v : b.v))[0]!;
      insights.push({
        severidade: (melhor.inverso ? -melhor.v : melhor.v) >= 0 ? 'positivo' : 'atencao',
        titulo: 'Maior variação MoM positiva',
        texto: `${melhor.nome} variou ${melhor.v.toFixed(1)}% vs mês anterior.`,
      });
      insights.push({
        severidade: (pior.inverso ? -pior.v : pior.v) < 0 ? 'critico' : 'atencao',
        titulo: 'Maior variação MoM negativa',
        texto: `${pior.nome} variou ${pior.v.toFixed(1)}% vs mês anterior.`,
      });
    }
  }

  // CPV% vs média 6 meses
  const ult6 = meses.slice(-6);
  if (ult6.length >= 3 && tUlt && tUlt.faturamento > 0) {
    const cpvAtual = (tUlt.cpv / tUlt.faturamento) * 100;
    const medias = ult6
      .map((p) => {
        const t = porMes[p];
        return t && t.faturamento > 0 ? (t.cpv / t.faturamento) * 100 : null;
      })
      .filter((n): n is number => n != null);
    if (medias.length) {
      const media = medias.reduce((a, b) => a + b, 0) / medias.length;
      const delta = cpvAtual - media;
      if (delta > 2) {
        insights.push({
          severidade: 'critico',
          titulo: 'CPV/CMV % acima da média',
          texto: `CPV/CMV está em ${cpvAtual.toFixed(1)}% do faturamento (+${delta.toFixed(1)} p.p. vs média dos últimos ${medias.length} meses).`,
        });
      }
    }
  }

  // Pessoal vs faturamento
  if (tUlt && tAnt && tAnt.faturamento > 0) {
    const pessoalUlt = tUlt.pessoalOp + tUlt.pessoalLog + tUlt.pessoalAdm;
    const pessoalAnt = tAnt.pessoalOp + tAnt.pessoalLog + tAnt.pessoalAdm;
    const gFat = pctVar(tUlt.faturamento, tAnt.faturamento);
    const gPes = pctVar(pessoalUlt, pessoalAnt);
    if (gFat != null && gPes != null && gPes > gFat + 0.5) {
      insights.push({
        severidade: 'atencao',
        titulo: 'Pessoal cresce acima do faturamento',
        texto: `Despesas com pessoal (+${gPes.toFixed(1)}%) superaram o crescimento do faturamento (+${gFat.toFixed(1)}%).`,
      });
    }
  }

  // Segmento pessoal que mais cresceu
  if (tUlt && tAnt) {
    const segs = [
      { n: 'Operacional', a: tUlt.pessoalOp, b: tAnt.pessoalOp },
      { n: 'Logística', a: tUlt.pessoalLog, b: tAnt.pessoalLog },
      { n: 'Administrativo', a: tUlt.pessoalAdm, b: tAnt.pessoalAdm },
    ]
      .map((s) => ({ n: s.n, v: pctVar(s.a, s.b) }))
      .filter((s) => s.v != null) as { n: string; v: number }[];
    if (segs.length) {
      const top = [...segs].sort((a, b) => b.v - a.v)[0]!;
      insights.push({
        severidade: top.v > 5 ? 'atencao' : 'positivo',
        titulo: 'Segmento de pessoal em destaque',
        texto: `${top.n} variou ${top.v.toFixed(1)}% vs mês anterior.`,
      });
    }
  }

  // Melhor margem líquida entre empresas
  const comMargem = comparativoEmpresas.filter((c) => c.margemLiquida != null);
  if (comMargem.length) {
    const best = [...comMargem].sort((a, b) => (b.margemLiquida ?? 0) - (a.margemLiquida ?? 0))[0]!;
    insights.push({
      severidade: 'positivo',
      titulo: 'Melhor margem líquida',
      texto: `${best.label} lidera com margem líquida de ${(best.margemLiquida ?? 0).toFixed(1)}% no período.`,
    });
  }

  // Tendência EBITDA 3 meses
  if (meses.length >= 3) {
    const m3 = meses.slice(-3);
    const vals = m3.map((p) => porMes[p]?.ebitda ?? 0);
    if (vals[0]! > vals[1]! && vals[1]! > vals[2]!) {
      insights.push({
        severidade: 'critico',
        titulo: 'Tendência de queda no EBITDA',
        texto: 'EBITDA caiu por 3 meses consecutivos.',
      });
    }
  }

  // Melhor / pior mês LL no ano
  const doAno = meses.filter((p) => p.startsWith(ultimo.slice(0, 4)));
  if (doAno.length >= 2) {
    const ranked = doAno
      .map((p) => ({ p, ll: porMes[p]?.lucroLiquido ?? 0 }))
      .sort((a, b) => b.ll - a.ll);
    insights.push({
      severidade: 'positivo',
      titulo: 'Melhor mês de Lucro Líquido',
      texto: `${ranked[0]!.p}: R$ ${ranked[0]!.ll.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
    });
    insights.push({
      severidade: 'atencao',
      titulo: 'Pior mês de Lucro Líquido',
      texto: `${ranked[ranked.length - 1]!.p}: R$ ${ranked[ranked.length - 1]!.ll.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
    });
  }

  void atual;
  return insights;
}

export async function montarDreDashboard(params: DreDashboardParams) {
  const unidade = resolverUnidadeDashboard(params.unidade);
  const metaEbitdaPct = Number.isFinite(params.metaEbitdaPct) ? Number(params.metaEbitdaPct) : 12;
  const metaLucroPct = Number.isFinite(params.metaLucroPct) ? Number(params.metaLucroPct) : 3;

  const { dataInicio, dataFim } = params;
  const { meses, porMes, saidas } = await carregarTotaisUnidade(dataInicio, dataFim, unidade);

  // Estender 12m para evolução / YoY (buscar histórico se necessário)
  const fimUlt = meses[meses.length - 1] ?? dataFim.slice(0, 7);
  const inicio12 = shiftMes(fimUlt, -11) ?? dataInicio.slice(0, 7);
  const dataInicioHist = `${inicio12}-01`;
  const precisaHist = dataInicioHist < dataInicio;
  let porMesHist = porMes;
  let mesesHist = meses;
  if (precisaHist) {
    const hist = await carregarTotaisUnidade(dataInicioHist, dataFim, unidade);
    porMesHist = { ...hist.porMes, ...porMes };
    mesesHist = listarMeses(dataInicioHist, dataFim);
  }

  const atual = somarPeriodo(porMes, meses);
  const ultimoMes = meses[meses.length - 1];
  const mesAnt = ultimoMes ? shiftMes(ultimoMes, -1) : null;
  const mesYoy = ultimoMes ? shiftMes(ultimoMes, -12) : null;
  const tUlt = ultimoMes ? porMesHist[ultimoMes] : null;
  const tMom = mesAnt ? porMesHist[mesAnt] : null;
  const tYoy = mesYoy ? porMesHist[mesYoy] : null;

  /** Valores do card = totais do período filtrado; MoM/YoY = último mês vs anterior / ano ant. */
  const kpiBase = atual;

  const kpis = [
    {
      id: 'faturamento',
      label: 'Faturamento Bruto',
      valor: kpiBase.faturamento,
      momPct: tUlt && tMom ? pctVar(tUlt.faturamento, tMom.faturamento) : null,
      yoyPct: tUlt && tYoy ? pctVar(tUlt.faturamento, tYoy.faturamento) : null,
      pctFaturamento: 100,
      inverso: false,
    },
    {
      id: 'cpv',
      label: 'CPV/CMV',
      valor: -Math.abs(kpiBase.cpv),
      momPct: tUlt && tMom ? pctVar(tUlt.cpv, tMom.cpv) : null,
      yoyPct: tUlt && tYoy ? pctVar(tUlt.cpv, tYoy.cpv) : null,
      pctFaturamento: margem(kpiBase.cpv, kpiBase.faturamento),
      inverso: true,
    },
    {
      id: 'lucroBruto',
      label: 'Lucro Bruto',
      valor: kpiBase.lucroBruto,
      momPct: tUlt && tMom ? pctVar(tUlt.lucroBruto, tMom.lucroBruto) : null,
      yoyPct: tUlt && tYoy ? pctVar(tUlt.lucroBruto, tYoy.lucroBruto) : null,
      pctFaturamento: margem(kpiBase.lucroBruto, kpiBase.faturamento),
      inverso: false,
    },
    {
      id: 'despOp',
      label: 'Despesas Operacionais',
      valor: -Math.abs(kpiBase.despOp),
      momPct: tUlt && tMom ? pctVar(tUlt.despOp, tMom.despOp) : null,
      yoyPct: tUlt && tYoy ? pctVar(tUlt.despOp, tYoy.despOp) : null,
      pctFaturamento: margem(kpiBase.despOp, kpiBase.faturamento),
      inverso: true,
    },
    {
      id: 'pessoal',
      label: 'Despesas com Pessoal',
      valor: -(kpiBase.pessoalOp + kpiBase.pessoalLog + kpiBase.pessoalAdm),
      momPct:
        tUlt && tMom
          ? pctVar(
              tUlt.pessoalOp + tUlt.pessoalLog + tUlt.pessoalAdm,
              tMom.pessoalOp + tMom.pessoalLog + tMom.pessoalAdm,
            )
          : null,
      yoyPct:
        tUlt && tYoy
          ? pctVar(
              tUlt.pessoalOp + tUlt.pessoalLog + tUlt.pessoalAdm,
              tYoy.pessoalOp + tYoy.pessoalLog + tYoy.pessoalAdm,
            )
          : null,
      pctFaturamento: margem(
        kpiBase.pessoalOp + kpiBase.pessoalLog + kpiBase.pessoalAdm,
        kpiBase.faturamento,
      ),
      inverso: true,
      breakdown: (() => {
        const total = kpiBase.pessoalOp + kpiBase.pessoalLog + kpiBase.pessoalAdm;
        const pct = (v: number) => (total > 0 ? (v / total) * 100 : null);
        return {
          operacional: { valor: -kpiBase.pessoalOp, pctTotal: pct(kpiBase.pessoalOp) },
          logistica: { valor: -kpiBase.pessoalLog, pctTotal: pct(kpiBase.pessoalLog) },
          administrativo: { valor: -kpiBase.pessoalAdm, pctTotal: pct(kpiBase.pessoalAdm) },
        };
      })(),
    },
    {
      id: 'ebitda',
      label: 'EBITDA',
      valor: kpiBase.ebitda,
      momPct: tUlt && tMom ? pctVar(tUlt.ebitda, tMom.ebitda) : null,
      yoyPct: tUlt && tYoy ? pctVar(tUlt.ebitda, tYoy.ebitda) : null,
      pctFaturamento: margem(kpiBase.ebitda, kpiBase.faturamento),
      inverso: false,
    },
    {
      id: 'lucroLiquido',
      label: 'Lucro Líquido',
      valor: kpiBase.lucroLiquido,
      momPct: tUlt && tMom ? pctVar(tUlt.lucroLiquido, tMom.lucroLiquido) : null,
      yoyPct: tUlt && tYoy ? pctVar(tUlt.lucroLiquido, tYoy.lucroLiquido) : null,
      pctFaturamento: margem(kpiBase.lucroLiquido, kpiBase.faturamento),
      inverso: false,
    },
  ];

  const evolucao12m = mesesHist.slice(-12).map((p) => {
    const t = porMesHist[p]!;
    const ant = shiftMes(p, -12);
    const tAnt = ant ? porMesHist[ant] : null;
    return {
      periodo: p,
      faturamento: t?.faturamento ?? 0,
      lucroBruto: t?.lucroBruto ?? 0,
      ebitda: t?.ebitda ?? 0,
      lucroLiquido: t?.lucroLiquido ?? 0,
      faturamentoAnoAnt: tAnt?.faturamento ?? null,
      lucroBrutoAnoAnt: tAnt?.lucroBruto ?? null,
      ebitdaAnoAnt: tAnt?.ebitda ?? null,
      lucroLiquidoAnoAnt: tAnt?.lucroLiquido ?? null,
    };
  });

  // Carregar YoY histórico se faltar
  const precisaYoy = evolucao12m.some((e) => e.faturamentoAnoAnt == null && e.periodo);
  if (precisaYoy && evolucao12m.length) {
    const primeiro = evolucao12m[0]!.periodo;
    const yoyIni = shiftMes(primeiro, -12);
    if (yoyIni) {
      const yoyData = await carregarTotaisUnidade(`${yoyIni}-01`, dataFim, unidade);
      for (const e of evolucao12m) {
        const ant = shiftMes(e.periodo, -12);
        if (!ant) continue;
        const t = yoyData.porMes[ant] ?? porMesHist[ant];
        if (t) {
          e.faturamentoAnoAnt = t.faturamento;
          e.lucroBrutoAnoAnt = t.lucroBruto;
          e.ebitdaAnoAnt = t.ebitda;
          e.lucroLiquidoAnoAnt = t.lucroLiquido;
        }
      }
      Object.assign(porMesHist, yoyData.porMes);
    }
  }

  const margens = mesesHist.slice(-12).map((p) => {
    const t = porMesHist[p];
    const fat = t?.faturamento ?? 0;
    return {
      periodo: p,
      margemBruta: margem(t?.lucroBruto ?? 0, fat),
      margemEbitda: margem(t?.ebitda ?? 0, fat),
      margemLiquida: margem(t?.lucroLiquido ?? 0, fat),
    };
  });

  const pessoalSerie = meses.map((p) => {
    const t = porMes[p]!;
    return {
      periodo: p,
      operacional: -(t?.pessoalOp ?? 0),
      logistica: -(t?.pessoalLog ?? 0),
      administrativo: -(t?.pessoalAdm ?? 0),
    };
  });

  // Comparativo empresas no período selecionado
  const comparativo = await Promise.all(
    DRE_DASH_UNIDADES_COMPARATIVO.map(async (u) => {
      const { porMes: pm, meses: ms } = await carregarTotaisUnidade(dataInicio, dataFim, u);
      const s = somarPeriodo(pm, ms);
      return {
        unidadeId: u.id,
        label: u.label,
        faturamento: s.faturamento,
        cpv: -s.cpv,
        lucroBruto: s.lucroBruto,
        despOp: -s.despOp,
        ebitda: s.ebitda,
        lucroLiquido: s.lucroLiquido,
        margemLiquida: margem(s.lucroLiquido, s.faturamento),
      };
    }),
  );

  const waterfall = [
    { id: 'faturamento', label: 'Faturamento Bruto', valor: atual.faturamento, tipo: 'total' as const },
    { id: 'cpv', label: '(−) CPV/CMV', valor: -atual.cpv, tipo: 'despesa' as const },
    { id: 'lucroBruto', label: 'Lucro Bruto', valor: atual.lucroBruto, tipo: 'total' as const },
    { id: 'despOp', label: '(−) Despesas Operacionais', valor: -atual.despOp, tipo: 'despesa' as const },
    { id: 'ebitda', label: 'EBITDA', valor: atual.ebitda, tipo: 'total' as const },
    { id: 'lucroLiquido', label: 'Lucro Líquido', valor: atual.lucroLiquido, tipo: 'total' as const },
  ];

  const analise = calcularAnalise(atual, metaEbitdaPct, metaLucroPct);
  const despesasPrincipais = montarDespesasPrincipais(saidas, meses);
  const insights = gerarInsights(
    porMesHist,
    mesesHist,
    atual,
    comparativo.map((c) => ({
      label: c.label,
      lucroLiquido: c.lucroLiquido,
      margemLiquida: c.margemLiquida,
    })),
  );

  const vazio = meses.every((p) => {
    const t = porMes[p];
    return !t || (t.faturamento === 0 && t.cpv === 0 && t.despOp === 0 && t.ebitda === 0);
  });

  return {
    unidade: { id: unidade.id, label: unidade.label, idEmpresas: unidade.idEmpresas },
    dataInicio,
    dataFim,
    periodos: meses,
    vazio,
    kpis,
    series: {
      evolucao12m,
      margens,
      pessoal: pessoalSerie,
      empresas: comparativo,
    },
    waterfall,
    despesasPrincipais,
    analise,
    insights,
    grupoRnSomoveis: [...GRUPO_RN_SOMOVEIS],
  };
}
