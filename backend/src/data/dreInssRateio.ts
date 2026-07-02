/**
 * Rateio do INSS único do ERP (conta "INSS") entre as três folhas da DRE,
 * proporcional aos salários de cada período.
 */
import { pathKeyDrePorCodigo, normalizarNomePlano } from './drePlanoContasMap.js';

export type DreSaidasInssLinha = {
  pathKey: string;
  periodo: string;
  valor: number;
};

/** pathKey interno — não existe na árvore exibida; removido após o rateio. */
export const DRE_INSS_POOL_PATHKEY = '__DRE_INSS_POOL__';

const RATEIO_INSS_FOLHAS = [
  { codigoSalarios: '10.1.1', codigoInss: '10.1.7' },
  { codigoSalarios: '11.2.1.1', codigoInss: '11.2.1.7' },
  { codigoSalarios: '13.1.1', codigoInss: '13.1.6' },
] as const;

/** Conta Nomus «INSS» (id 308) — única origem do pool. */
const NOMUS_IDS_CONTA_INSS_POOL = new Set([308]);

/** Conta Nomus/Shop9 com nome exatamente "INSS" → pool antes do rateio. */
export function resolverPathKeyInssPoolAgregacao(
  nomePlano: string,
  idContaFinanceiro?: number | null,
): string | null {
  const id =
    idContaFinanceiro != null && Number.isFinite(Number(idContaFinanceiro))
      ? Math.trunc(Number(idContaFinanceiro))
      : null;
  if (id != null && NOMUS_IDS_CONTA_INSS_POOL.has(id)) return DRE_INSS_POOL_PATHKEY;
  const n = normalizarNomePlano(nomePlano);
  if (n === 'inss') return DRE_INSS_POOL_PATHKEY;
  return null;
}

function rateioProporcional(total: number, pesos: number[]): number[] {
  const absTotal = Math.abs(total);
  if (absTotal <= 0) return pesos.map(() => 0);
  let sumPesos = pesos.reduce((a, b) => a + b, 0);
  if (sumPesos <= 0) sumPesos = pesos.length;

  const pesosEfetivos = sumPesos > 0 && pesos.reduce((a, b) => a + b, 0) > 0 ? pesos : pesos.map(() => 1);
  const sumEf = pesosEfetivos.reduce((a, b) => a + b, 0);

  const raw = pesosEfetivos.map((p) => absTotal * (p / sumEf));
  const rounded = raw.map((v) => Math.round(v * 100) / 100);
  const diff = Math.round((absTotal - rounded.reduce((a, b) => a + b, 0)) * 100) / 100;
  if (Math.abs(diff) >= 0.01) {
    let idxMax = 0;
    for (let i = 1; i < pesosEfetivos.length; i++) {
      if (pesosEfetivos[i]! > pesosEfetivos[idxMax]!) idxMax = i;
    }
    rounded[idxMax] = Math.round((rounded[idxMax]! + diff) * 100) / 100;
  }
  const sinal = total < 0 ? -1 : 1;
  return rounded.map((v) => sinal * v);
}

type FolhaInssRateio = {
  pathKeySalarios: string;
  pathKeyInss: string;
};

function carregarFolhasInssRateio(): FolhaInssRateio[] | null {
  const folhas: FolhaInssRateio[] = [];
  for (const cfg of RATEIO_INSS_FOLHAS) {
    const pathKeySalarios = pathKeyDrePorCodigo(cfg.codigoSalarios);
    const pathKeyInss = pathKeyDrePorCodigo(cfg.codigoInss);
    if (!pathKeySalarios || !pathKeyInss) return null;
    folhas.push({ pathKeySalarios, pathKeyInss });
  }
  return folhas;
}

/**
 * Redistribui o pool INSS nas linhas 10.1.7 / 11.2.1.7 / 13.1.6
 * conforme salários 10.1.1 / 11.2.1.1 / 13.1.1 do mesmo período.
 */
export function aplicarRateioInssNasLinhasSaidas(
  linhas: DreSaidasInssLinha[],
): DreSaidasInssLinha[] {
  const folhas = carregarFolhasInssRateio();
  if (!folhas?.length) return linhas;

  const map = new Map<string, number>();
  for (const l of linhas) {
    const k = `${l.pathKey}\t${l.periodo}`;
    map.set(k, (map.get(k) ?? 0) + l.valor);
  }

  const periodos = new Set<string>();
  for (const k of map.keys()) {
    periodos.add(k.split('\t')[1]!);
  }

  for (const periodo of periodos) {
    const poolKey = `${DRE_INSS_POOL_PATHKEY}\t${periodo}`;
    const poolVal = map.get(poolKey) ?? 0;
    if (poolVal <= 0) continue;

    map.delete(poolKey);

    const pesos = folhas.map((f) => map.get(`${f.pathKeySalarios}\t${periodo}`) ?? 0);
    const partes = rateioProporcional(poolVal, pesos);

    for (let i = 0; i < folhas.length; i++) {
      const f = folhas[i]!;
      const inssKey = `${f.pathKeyInss}\t${periodo}`;
      map.set(inssKey, Math.round(((map.get(inssKey) ?? 0) + partes[i]!) * 100) / 100);
    }
  }

  const out: DreSaidasInssLinha[] = [];
  for (const [k, valor] of map) {
    if (Math.abs(valor) < 0.005) continue;
    const [pathKey, periodo] = k.split('\t');
    if (pathKey === DRE_INSS_POOL_PATHKEY) continue;
    out.push({ pathKey: pathKey!, periodo: periodo!, valor: Math.round(valor * 100) / 100 });
  }

  return out.sort((a, b) => a.pathKey.localeCompare(b.pathKey) || a.periodo.localeCompare(b.periodo));
}
