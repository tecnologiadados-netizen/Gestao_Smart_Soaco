/** Agrega demanda do calendário × BOM Recurso 1000 (sem I/O). */

export type BomPaRecurso1000 = {
  codigoPa: string;
  idComponente: number;
  codigoComponente: string;
  descricaoComponente: string;
  qtdePorPa: number;
};

export type DemandaCalendarioRecurso1000 = {
  codigoPa: string;
  qtde: number;
  dataIso: string;
  setor?: string;
  pd?: string;
  carrada?: string;
};

export type OrigemConsumoRecurso1000 = {
  dataIso: string;
  carrada: string;
  pd: string;
  qtdeComponente: number;
  setor: string;
};

export type CelulaRecurso1000 = {
  setor: string;
  data: string;
};

function normCod(s: string): string {
  return String(s ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function arred2(n: number): number {
  return Math.round(n * 100) / 100;
}

function bomPorPa(bom: BomPaRecurso1000[]): Map<string, BomPaRecurso1000[]> {
  const map = new Map<string, BomPaRecurso1000[]>();
  for (const b of bom) {
    const k = normCod(b.codigoPa);
    if (!k || !(b.qtdePorPa > 0) || !(b.idComponente > 0)) continue;
    const arr = map.get(k);
    if (arr) arr.push(b);
    else map.set(k, [b]);
  }
  return map;
}

export function agregarCelulasRecurso1000(
  bom: BomPaRecurso1000[],
  demanda: DemandaCalendarioRecurso1000[]
): { celulas: CelulaRecurso1000[]; datas: string[] } {
  const byPa = bomPorPa(bom);
  const celulas = new Map<string, CelulaRecurso1000>();
  const datasSet = new Set<string>();
  for (const d of demanda) {
    const rows = byPa.get(normCod(d.codigoPa));
    if (!rows?.length || !(d.qtde > 0) || !d.dataIso) continue;
    const setor = String(d.setor ?? '').trim();
    let tem = false;
    for (const b of rows) {
      if (arred2(d.qtde * b.qtdePorPa) > 0) {
        tem = true;
        break;
      }
    }
    if (!tem) continue;
    datasSet.add(d.dataIso);
    const key = `${setor}\0${d.dataIso}`;
    if (!celulas.has(key)) celulas.set(key, { setor, data: d.dataIso });
  }
  return {
    celulas: [...celulas.values()],
    datas: [...datasSet].sort(),
  };
}

export type ComponenteDiaRecurso1000 = {
  idComponente: number;
  codigo: string;
  descricao: string;
  qtde: number;
  origens: OrigemConsumoRecurso1000[];
};

function chaveOrigem(o: Pick<OrigemConsumoRecurso1000, 'carrada' | 'pd' | 'setor' | 'dataIso'>): string {
  return `${o.dataIso}\0${o.setor}\0${o.carrada}\0${o.pd}`;
}

function addOrigem(list: OrigemConsumoRecurso1000[], o: OrigemConsumoRecurso1000): void {
  const k = chaveOrigem(o);
  const prev = list.find((x) => chaveOrigem(x) === k);
  if (prev) prev.qtdeComponente = arred2(prev.qtdeComponente + o.qtdeComponente);
  else list.push({ ...o });
}

export function agregarComponentesDiaRecurso1000(
  bom: BomPaRecurso1000[],
  demanda: DemandaCalendarioRecurso1000[],
  dataIso: string,
  setor?: string | null
): ComponenteDiaRecurso1000[] {
  const byPa = bomPorPa(bom);
  const setorFiltro = String(setor ?? '').trim();
  const acc = new Map<number, ComponenteDiaRecurso1000>();
  for (const d of demanda) {
    // Acumula demanda do componente até a data (inclusive) — faltas/origens carregam dias anteriores.
    if (!d.dataIso || d.dataIso > dataIso || !(d.qtde > 0)) continue;
    const setorLinha = String(d.setor ?? '').trim();
    if (setorFiltro && setorLinha !== setorFiltro) continue;
    const rows = byPa.get(normCod(d.codigoPa));
    if (!rows?.length) continue;
    for (const b of rows) {
      const qtde = arred2(d.qtde * b.qtdePorPa);
      if (!(qtde > 0)) continue;
      const prev = acc.get(b.idComponente);
      const origem: OrigemConsumoRecurso1000 = {
        dataIso: d.dataIso,
        carrada: String(d.carrada ?? '').trim(),
        pd: String(d.pd ?? '').trim(),
        qtdeComponente: qtde,
        setor: setorLinha,
      };
      if (prev) {
        prev.qtde = arred2(prev.qtde + qtde);
        addOrigem(prev.origens, origem);
      } else {
        acc.set(b.idComponente, {
          idComponente: b.idComponente,
          codigo: b.codigoComponente,
          descricao: b.descricaoComponente,
          qtde,
          origens: [origem],
        });
      }
    }
  }
  for (const row of acc.values()) {
    row.origens.sort((a, b) => {
      const dd = a.dataIso.localeCompare(b.dataIso);
      if (dd !== 0) return dd;
      const cc = a.carrada.localeCompare(b.carrada, 'pt-BR');
      if (cc !== 0) return cc;
      return a.pd.localeCompare(b.pd, 'pt-BR');
    });
  }
  return [...acc.values()].sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR'));
}

export type ConsumoRecurso1000PorId = {
  consumoPorDia: Map<string, number>;
  consumoPorCelula: Map<string, number>;
};

export type ConsumoRecurso1000Agg = {
  datas: string[];
  porId: Map<number, ConsumoRecurso1000PorId>;
};

function chaveCelula(setor: string, dataIso: string): string {
  return `${setor}\0${dataIso}`;
}

/** Consumo do componente por dia (todos os setores) e por célula. */
export function agregarConsumoRecurso1000(
  bom: BomPaRecurso1000[],
  demanda: DemandaCalendarioRecurso1000[]
): ConsumoRecurso1000Agg {
  const byPa = bomPorPa(bom);
  const porId = new Map<number, ConsumoRecurso1000PorId>();
  const datasSet = new Set<string>();
  for (const d of demanda) {
    if (!(d.qtde > 0) || !d.dataIso) continue;
    const rows = byPa.get(normCod(d.codigoPa));
    if (!rows?.length) continue;
    const setor = String(d.setor ?? '').trim();
    datasSet.add(d.dataIso);
    for (const b of rows) {
      const qtde = arred2(d.qtde * b.qtdePorPa);
      if (!(qtde > 0)) continue;
      let acc = porId.get(b.idComponente);
      if (!acc) {
        acc = { consumoPorDia: new Map(), consumoPorCelula: new Map() };
        porId.set(b.idComponente, acc);
      }
      acc.consumoPorDia.set(d.dataIso, arred2((acc.consumoPorDia.get(d.dataIso) ?? 0) + qtde));
      const ck = chaveCelula(setor, d.dataIso);
      acc.consumoPorCelula.set(ck, arred2((acc.consumoPorCelula.get(ck) ?? 0) + qtde));
    }
  }
  return { datas: [...datasSet].sort(), porId };
}

export type ProjetacaoSaldoRecurso1000 = {
  saldoInicio: number;
  consumidoAntes: number;
  consumoDiaTotal: number;
  /** Consumo global do componente de todas as datas ≤ dataAlvo. */
  consumoAcumTotal: number;
  /**
   * Necessidade acumulada (igual ao nAcum do AS, sem entradas):
   * máx(0, consumoDia − saldoInício + faltaAcum do dia anterior).
   */
  faltaAcum: number;
};

/**
 * Saldo no início do dia = estoque inicial − consumo dos dias anteriores (sem entradas).
 * Falta acumulada carrega o déficit não coberto dos dias anteriores.
 */
export function projetarSaldoRecurso1000(
  consumoPorDia: Map<string, number>,
  datasOrdenadas: string[],
  saldoInicial: number,
  dataAlvo: string
): ProjetacaoSaldoRecurso1000 {
  const inicial = Math.max(0, arred2(Number.isFinite(saldoInicial) ? saldoInicial : 0));
  const datas = [...datasOrdenadas];
  if (dataAlvo && !datas.includes(dataAlvo)) {
    datas.push(dataAlvo);
    datas.sort();
  }
  let restante = inicial;
  let consumidoAntes = 0;
  let faltaAnterior = 0;
  for (const d of datas) {
    const c = arred2(consumoPorDia.get(d) ?? 0);
    const saldoInicio = restante;
    const bruto = arred2(c - saldoInicio + faltaAnterior);
    const faltaAcum = bruto <= 0 ? 0 : bruto;
    if (d === dataAlvo) {
      return {
        saldoInicio,
        consumidoAntes,
        consumoDiaTotal: c,
        consumoAcumTotal: arred2(consumidoAntes + c),
        faltaAcum,
      };
    }
    restante = Math.max(0, arred2(saldoInicio - c));
    consumidoAntes = arred2(consumidoAntes + c);
    faltaAnterior = faltaAcum;
  }
  return {
    saldoInicio: restante,
    consumidoAntes,
    consumoDiaTotal: 0,
    consumoAcumTotal: consumidoAntes,
    faltaAcum: 0,
  };
}

/** Parcela da falta do dia proporcional ao consumo do recorte (setor). Soma ≈ falta do dia. */
export function alocarFaltaRecurso1000(
  faltaDia: number,
  consumoEscopo: number,
  consumoDiaTotal: number
): number {
  if (!(faltaDia > 0) || !(consumoEscopo > 0)) return 0;
  if (!(consumoDiaTotal > 0) || consumoEscopo >= consumoDiaTotal) return arred2(faltaDia);
  return arred2(faltaDia * (consumoEscopo / consumoDiaTotal));
}

export function statusCelulasRecurso1000(
  agg: ConsumoRecurso1000Agg,
  saldoInicialPorId: Map<number, number>,
  celulas: CelulaRecurso1000[]
): { setor: string; data: string; status: 'ok' | 'falta' }[] {
  return celulas.map((cel) => {
    const ck = chaveCelula(cel.setor, cel.data);
    let falta = false;
    for (const [id, cons] of agg.porId) {
      const consumoCel = cons.consumoPorCelula.get(ck) ?? 0;
      if (!(consumoCel > 0)) continue;
      const proj = projetarSaldoRecurso1000(
        cons.consumoPorDia,
        agg.datas,
        saldoInicialPorId.get(id) ?? 0,
        cel.data
      );
      if (alocarFaltaRecurso1000(proj.faltaAcum, consumoCel, proj.consumoDiaTotal) > 0) {
        falta = true;
        break;
      }
    }
    return { setor: cel.setor, data: cel.data, status: falta ? 'falta' : 'ok' };
  });
}
