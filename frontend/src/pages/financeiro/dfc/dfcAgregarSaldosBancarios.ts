import type { DfcSaldoBancarioLinha } from '../../../api/financeiro';
import { listarPeriodosDfc } from './dfcPeriodos';

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

export function agregarSaldosBancariosParaGrade(
  linhasBase: DfcSaldoBancarioLinha[],
  opts: {
    dataInicio: string;
    dataFim: string;
    granularidade: 'dia' | 'mes';
    idEmpresas: number[];
    contasBancarias: string[];
  },
): { saldosIniciais: Record<string, number>; saldosFinais: Record<string, number> } {
  const linhas = filtrarLinhas(linhasBase, opts.idEmpresas, opts.contasBancarias);
  const periodos = listarPeriodosDfc(opts.dataInicio, opts.dataFim, opts.granularidade);
  const saldosIniciais: Record<string, number> = {};
  const saldosFinais: Record<string, number> = {};

  if (periodos.length === 0) return { saldosIniciais, saldosFinais };

  const { porDiaInicial, porDiaFinal, diasComMovimento } = serieDiariaAgregada(
    linhas,
    opts.dataInicio,
    opts.dataFim,
  );

  if (opts.granularidade === 'dia') {
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
        : ultimoCalendario <= opts.dataFim
          ? ultimoCalendario
          : opts.dataFim;
    saldosFinais[mes] = porDiaFinal.get(diaRef) ?? 0;
  }

  return { saldosIniciais, saldosFinais };
}
