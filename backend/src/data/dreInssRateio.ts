/**
 * Rateio do INSS e do FGTS únicos do ERP entre as três folhas da DRE,
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
export const DRE_FGTS_POOL_PATHKEY = '__DRE_FGTS_POOL__';

const RATEIO_INSS_FOLHAS = [
  { codigoSalarios: '10.1.1', codigoDestino: '10.1.7' },
  { codigoSalarios: '11.2.1.1', codigoDestino: '11.2.1.7' },
  { codigoSalarios: '13.1.1', codigoDestino: '13.1.6' },
] as const;

const RATEIO_FGTS_FOLHAS = [
  { codigoSalarios: '10.1.1', codigoDestino: '10.1.8' },
  { codigoSalarios: '11.2.1.1', codigoDestino: '11.2.1.8' },
  { codigoSalarios: '13.1.1', codigoDestino: '13.1.7' },
] as const;

/** Conta Nomus «INSS» (id 308, classificação 5.1.7). */
const NOMUS_ID_INSS = 308;
/** Conta Nomus «FGTS» (id 43, classificação 5.1.6). */
const NOMUS_ID_FGTS = 43;
/** Ordem_Plano_Contas3 do FGTS no Shop9. */
const SHOP9_ORDEM_FGTS = 9076;

export type OrigemEncargoFolha = 'nomus' | 'shop9';

/**
 * Conta única de INSS ou FGTS → pool, antes do mapa por nome.
 * O nome exato evita levar «FGTS Multa Rescisória» ou outro encargo parecido.
 */
export function resolverPathKeyInssPoolAgregacao(
  nomePlano: string,
  idContaFinanceiro?: number | null,
  origem: OrigemEncargoFolha = 'nomus',
): string | null {
  const id =
    idContaFinanceiro != null && Number.isFinite(Number(idContaFinanceiro))
      ? Math.trunc(Number(idContaFinanceiro))
      : null;
  const n = normalizarNomePlano(nomePlano);
  if ((origem === 'nomus' && id === NOMUS_ID_INSS) || n === 'inss') return DRE_INSS_POOL_PATHKEY;
  if (
    (origem === 'nomus' && id === NOMUS_ID_FGTS) ||
    (origem === 'shop9' && id === SHOP9_ORDEM_FGTS) ||
    n === 'fgts'
  ) {
    return DRE_FGTS_POOL_PATHKEY;
  }
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

type FolhaEncargoRateio = {
  pathKeySalarios: string;
  pathKeyDestino: string;
};

function carregarFolhasEncargo(
  folhas: readonly { codigoSalarios: string; codigoDestino: string }[],
): FolhaEncargoRateio[] | null {
  const out: FolhaEncargoRateio[] = [];
  for (const cfg of folhas) {
    const pathKeySalarios = pathKeyDrePorCodigo(cfg.codigoSalarios);
    const pathKeyDestino = pathKeyDrePorCodigo(cfg.codigoDestino);
    if (!pathKeySalarios || !pathKeyDestino) return null;
    out.push({ pathKeySalarios, pathKeyDestino });
  }
  return out;
}

function distribuirPoolEncargo(
  map: Map<string, number>,
  periodo: string,
  poolPathKey: string,
  folhas: FolhaEncargoRateio[],
): void {
  const poolKey = `${poolPathKey}\t${periodo}`;
  const poolVal = map.get(poolKey) ?? 0;
  if (poolVal <= 0) return;

  map.delete(poolKey);

  const pesos = folhas.map((f) => map.get(`${f.pathKeySalarios}\t${periodo}`) ?? 0);
  const partes = rateioProporcional(poolVal, pesos);

  for (let i = 0; i < folhas.length; i++) {
    const f = folhas[i]!;
    const destKey = `${f.pathKeyDestino}\t${periodo}`;
    map.set(destKey, Math.round(((map.get(destKey) ?? 0) + partes[i]!) * 100) / 100);
  }
}

/**
 * Redistribui os pools de INSS (10.1.7 / 11.2.1.7 / 13.1.6) e FGTS
 * (10.1.8 / 11.2.1.8 / 13.1.7) conforme os salários 10.1.1 / 11.2.1.1 / 13.1.1
 * do mesmo período.
 */
export function aplicarRateioInssNasLinhasSaidas(
  linhas: DreSaidasInssLinha[],
): DreSaidasInssLinha[] {
  const folhasInss = carregarFolhasEncargo(RATEIO_INSS_FOLHAS);
  const folhasFgts = carregarFolhasEncargo(RATEIO_FGTS_FOLHAS);
  if (!folhasInss?.length && !folhasFgts?.length) return linhas;

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
    if (folhasInss?.length) distribuirPoolEncargo(map, periodo, DRE_INSS_POOL_PATHKEY, folhasInss);
    if (folhasFgts?.length) distribuirPoolEncargo(map, periodo, DRE_FGTS_POOL_PATHKEY, folhasFgts);
  }

  const out: DreSaidasInssLinha[] = [];
  for (const [k, valor] of map) {
    if (Math.abs(valor) < 0.005) continue;
    const [pathKey, periodo] = k.split('\t');
    if (pathKey === DRE_INSS_POOL_PATHKEY || pathKey === DRE_FGTS_POOL_PATHKEY) continue;
    out.push({ pathKey: pathKey!, periodo: periodo!, valor: Math.round(valor * 100) / 100 });
  }

  return out.sort((a, b) => a.pathKey.localeCompare(b.pathKey) || a.periodo.localeCompare(b.periodo));
}
