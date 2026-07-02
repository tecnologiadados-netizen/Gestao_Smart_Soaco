/**
 * Agrega saldos bancários por coluna da grade DFC (dia ou mês).
 */

import type { DfcSaldoBancarioLinha } from './dfcSaldosBancariosRepository.js';

export type DfcSaldoBancarioContaGrade = {
  idContaBancaria: number;
  nomeContaBancaria: string;
  idEmpresa: number;
  saldosIniciaisPorPeriodo: Record<string, number>;
  saldosFinaisPorPeriodo: Record<string, number>;
};

function parseYmd(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt;
}

function ymdFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function listarPeriodos(dataInicio: string, dataFim: string, granularidade: 'dia' | 'mes'): string[] {
  const ini = parseYmd(dataInicio);
  const fim = parseYmd(dataFim);
  if (!ini || !fim || fim < ini) return [];

  if (granularidade === 'mes') {
    const out: string[] = [];
    const cur = new Date(ini.getFullYear(), ini.getMonth(), 1);
    const endM = new Date(fim.getFullYear(), fim.getMonth(), 1);
    while (cur <= endM) {
      out.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
      cur.setMonth(cur.getMonth() + 1);
    }
    return out;
  }

  const out: string[] = [];
  for (let cur = new Date(ini); cur <= fim; cur = addDays(cur, 1)) {
    out.push(ymdFromDate(cur));
  }
  return out;
}

function filtrarLinhas(
  linhas: DfcSaldoBancarioLinha[],
  idEmpresas: number[],
  contasBancarias: string[],
): DfcSaldoBancarioLinha[] {
  const empSet = idEmpresas.length > 0 ? new Set(idEmpresas) : null;
  const cbSet =
    contasBancarias.length > 0 ? new Set(contasBancarias.map((n) => n.trim()).filter(Boolean)) : null;
  return linhas.filter((l) => {
    if (empSet && !empSet.has(l.idEmpresa)) return false;
    if (cbSet && !cbSet.has(l.nomeContaBancaria.trim())) return false;
    return true;
  });
}

function serieDiariaConta(
  linhasConta: DfcSaldoBancarioLinha[],
  dataInicio: string,
  dataFim: string,
): {
  porDiaInicial: Map<string, number>;
  porDiaFinal: Map<string, number>;
  diasComMovimento: Set<string>;
} {
  const mapa = new Map<string, DfcSaldoBancarioLinha>();
  for (const l of linhasConta) mapa.set(l.dataLancamento, l);

  const porDiaInicial = new Map<string, number>();
  const porDiaFinal = new Map<string, number>();
  const diasComMovimento = new Set<string>();

  const ini = parseYmd(dataInicio);
  const fim = parseYmd(dataFim);
  if (!ini || !fim || fim < ini) {
    return { porDiaInicial, porDiaFinal, diasComMovimento };
  }

  let last = 0;
  for (const [d, r] of [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (d < dataInicio) last = r.saldoFinal;
  }

  for (let cur = new Date(ini); cur <= fim; cur = addDays(cur, 1)) {
    const ymd = ymdFromDate(cur);
    const row = mapa.get(ymd);
    if (row) {
      porDiaInicial.set(ymd, row.saldoInicial);
      porDiaFinal.set(ymd, row.saldoFinal);
      last = row.saldoFinal;
      if (row.valorLancamento !== 0) diasComMovimento.add(ymd);
    } else {
      porDiaInicial.set(ymd, last);
      porDiaFinal.set(ymd, last);
    }
  }

  return { porDiaInicial, porDiaFinal, diasComMovimento };
}

function serieDiariaAgregada(
  linhas: DfcSaldoBancarioLinha[],
  dataInicio: string,
  dataFim: string,
): {
  porDiaInicial: Map<string, number>;
  porDiaFinal: Map<string, number>;
  diasComMovimento: Set<string>;
} {
  const porConta = new Map<number, Map<string, DfcSaldoBancarioLinha>>();
  for (const l of linhas) {
    if (!porConta.has(l.idContaBancaria)) porConta.set(l.idContaBancaria, new Map());
    porConta.get(l.idContaBancaria)!.set(l.dataLancamento, l);
  }

  const ini = parseYmd(dataInicio);
  const fim = parseYmd(dataFim);
  const porDiaInicial = new Map<string, number>();
  const porDiaFinal = new Map<string, number>();
  const diasComMovimento = new Set<string>();

  if (!ini || !fim || fim < ini) {
    return { porDiaInicial, porDiaFinal, diasComMovimento };
  }

  for (const l of linhas) {
    if (l.valorLancamento !== 0 && l.dataLancamento >= dataInicio && l.dataLancamento <= dataFim) {
      diasComMovimento.add(l.dataLancamento);
    }
  }

  for (let cur = new Date(ini); cur <= fim; cur = addDays(cur, 1)) {
    const ymd = ymdFromDate(cur);
    let somaIni = 0;
    let somaFin = 0;
    for (const mapa of porConta.values()) {
      const row = mapa.get(ymd);
      if (row) {
        somaIni += row.saldoInicial;
        somaFin += row.saldoFinal;
      } else {
        let prev = 0;
        for (const [d, r] of mapa) {
          if (d < ymd) prev = r.saldoFinal;
        }
        somaIni += prev;
        somaFin += prev;
      }
    }
    porDiaInicial.set(ymd, somaIni);
    porDiaFinal.set(ymd, somaFin);
  }

  return { porDiaInicial, porDiaFinal, diasComMovimento };
}

function mapDiarioParaPeriodos(
  porDiaInicial: Map<string, number>,
  porDiaFinal: Map<string, number>,
  diasComMovimento: Set<string>,
  periodos: string[],
  granularidade: 'dia' | 'mes',
  dataFim: string,
): { saldosIniciais: Record<string, number>; saldosFinais: Record<string, number> } {
  const saldosIniciais: Record<string, number> = {};
  const saldosFinais: Record<string, number> = {};

  if (granularidade === 'dia') {
    for (const p of periodos) {
      saldosIniciais[p] = porDiaInicial.get(p) ?? 0;
      saldosFinais[p] = porDiaFinal.get(p) ?? 0;
    }
    return { saldosIniciais, saldosFinais };
  }

  for (const mes of periodos) {
    const diasNoMes = [...porDiaFinal.keys()].filter((d) => d.slice(0, 7) === mes);
    if (diasNoMes.length === 0) continue;

    const primeiroDia = diasNoMes.reduce((a, b) => (a < b ? a : b));
    saldosIniciais[mes] = porDiaInicial.get(primeiroDia) ?? 0;

    const movNoMes = diasNoMes.filter((d) => diasComMovimento.has(d));
    const [y, mo] = mes.split('-').map(Number);
    const ultimoCalendario = ymdFromDate(new Date(y, mo, 0));
    const diaRef =
      movNoMes.length > 0
        ? movNoMes.reduce((a, b) => (a > b ? a : b))
        : ultimoCalendario <= dataFim
          ? ultimoCalendario
          : dataFim;
    saldosFinais[mes] = porDiaFinal.get(diaRef) ?? 0;
  }

  return { saldosIniciais, saldosFinais };
}

export function agregarSaldosBancariosParaGrade(
  linhasBase: DfcSaldoBancarioLinha[],
  opts: {
    dataInicio: string;
    dataFim: string;
    granularidade: 'dia' | 'mes';
    idEmpresas: number[];
    contasBancarias: string[];
  },
): {
  saldosIniciais: Record<string, number>;
  saldosFinais: Record<string, number>;
  saldosPorConta: DfcSaldoBancarioContaGrade[];
} {
  const linhas = filtrarLinhas(linhasBase, opts.idEmpresas, opts.contasBancarias);
  const periodos = listarPeriodos(opts.dataInicio, opts.dataFim, opts.granularidade);
  const saldosIniciais: Record<string, number> = {};
  const saldosFinais: Record<string, number> = {};
  const saldosPorConta: DfcSaldoBancarioContaGrade[] = [];

  if (periodos.length === 0) {
    return { saldosIniciais, saldosFinais, saldosPorConta };
  }

  const totalDiario = serieDiariaAgregada(linhas, opts.dataInicio, opts.dataFim);
  const total = mapDiarioParaPeriodos(
    totalDiario.porDiaInicial,
    totalDiario.porDiaFinal,
    totalDiario.diasComMovimento,
    periodos,
    opts.granularidade,
    opts.dataFim,
  );
  Object.assign(saldosIniciais, total.saldosIniciais);
  Object.assign(saldosFinais, total.saldosFinais);

  const porIdConta = new Map<number, DfcSaldoBancarioLinha[]>();
  for (const l of linhas) {
    const arr = porIdConta.get(l.idContaBancaria) ?? [];
    arr.push(l);
    porIdConta.set(l.idContaBancaria, arr);
  }

  for (const [, linhasConta] of porIdConta) {
    const meta = linhasConta[0];
    if (!meta) continue;
    const diario = serieDiariaConta(linhasConta, opts.dataInicio, opts.dataFim);
    const porPeriodo = mapDiarioParaPeriodos(
      diario.porDiaInicial,
      diario.porDiaFinal,
      diario.diasComMovimento,
      periodos,
      opts.granularidade,
      opts.dataFim,
    );
    saldosPorConta.push({
      idContaBancaria: meta.idContaBancaria,
      nomeContaBancaria: meta.nomeContaBancaria,
      idEmpresa: meta.idEmpresa,
      saldosIniciaisPorPeriodo: porPeriodo.saldosIniciais,
      saldosFinaisPorPeriodo: porPeriodo.saldosFinais,
    });
  }

  saldosPorConta.sort((a, b) =>
    a.nomeContaBancaria.localeCompare(b.nomeContaBancaria, 'pt-BR', { sensitivity: 'base' }),
  );

  return { saldosIniciais, saldosFinais, saldosPorConta };
}
