/**
 * Política comercial do painel financeiro-comercial (SQLite key-value).
 * Escopos: indústria (Só Aço) e lojas (Só Móveis / Só Refrigeração).
 */

import { prisma } from '../config/prisma.js';
import {
  DEFAULT_POLITICA_COMERCIAL,
  type PoliticaComercialParams,
} from '../services/painelComercialConformidade.js';

const KEY_V1 = 'painel_politica_comercial_v1';
const KEY_V2 = 'painel_politica_comercial_v2';

export type PoliticaComercialEscopo = 'industria' | 'lojas';

export type PoliticasComerciaisPainel = {
  industria: PoliticaComercialParams;
  lojas: PoliticaComercialParams;
};

function num(v: unknown, d: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function parseDiasList(v: unknown, fallback: number[]): number[] {
  if (Array.isArray(v)) {
    const xs = v.map((x) => Math.round(Number(x))).filter((n) => Number.isFinite(n));
    if (xs.length) return [...new Set(xs)].sort((a, b) => a - b);
  }
  if (typeof v === 'string' && v.trim()) {
    const xs = v
      .split(/[,;/+\s]+/)
      .map((s) => Math.round(Number(s.trim())))
      .filter((n) => Number.isFinite(n));
    if (xs.length) return [...new Set(xs)].sort((a, b) => a - b);
  }
  return [...fallback];
}

/** Mescla JSON salvo com o padrão do sistema (campos faltando ou inválidos). */
export function mergePoliticaComercialParcial(raw: unknown): PoliticaComercialParams {
  const d = DEFAULT_POLITICA_COMERCIAL;
  if (!raw || typeof raw !== 'object') return { ...d };
  const o = raw as Record<string, unknown>;
  const lim1 = Math.max(1, num(o.limiteFaixa1Reais, d.limiteFaixa1Reais));
  let lim2 = num(o.limiteFaixa2Reais, d.limiteFaixa2Reais);
  if (lim2 <= lim1) lim2 = d.limiteFaixa2Reais;

  let minD = Math.round(num(o.diasCondicaoMin, d.diasCondicaoMin));
  let maxD = Math.round(num(o.diasCondicaoMax, d.diasCondicaoMax));
  if (minD < 1) minD = 1;
  if (maxD > 365) maxD = 365;
  if (maxD <= minD) {
    minD = d.diasCondicaoMin;
    maxD = d.diasCondicaoMax;
  }

  const d1 = parseDiasList(o.diasParcelasFaixa1, d.diasParcelasFaixa1).filter((n) => n >= minD && n <= maxD);
  const d2 = parseDiasList(o.diasParcelasFaixa2, d.diasParcelasFaixa2).filter((n) => n >= minD && n <= maxD);
  const d3 = parseDiasList(o.diasParcelasFaixa3, d.diasParcelasFaixa3).filter((n) => n >= minD && n <= maxD);

  let pa = num(o.pctEntradaAlvo, d.pctEntradaAlvo);
  let pt = num(o.pctEntradaTolerancia, d.pctEntradaTolerancia);
  if (pa <= 0 || pa >= 1) pa = d.pctEntradaAlvo;
  if (pt <= 0 || pt > 0.5) pt = d.pctEntradaTolerancia;

  return {
    limiteFaixa1Reais: lim1,
    limiteFaixa2Reais: lim2,
    diasParcelasFaixa1: d1.length ? d1 : [...d.diasParcelasFaixa1],
    diasParcelasFaixa2: d2.length ? d2 : [...d.diasParcelasFaixa2],
    diasParcelasFaixa3: d3.length ? d3 : [...d.diasParcelasFaixa3],
    pctEntradaAlvo: pa,
    pctEntradaTolerancia: pt,
    diasCondicaoMin: minD,
    diasCondicaoMax: maxD,
  };
}

export function validarPoliticaComercialParaSalvar(p: PoliticaComercialParams): string | null {
  if (p.limiteFaixa2Reais <= p.limiteFaixa1Reais) return 'O limite da faixa 2 (R$) deve ser maior que o da faixa 1.';
  if (p.diasCondicaoMax <= p.diasCondicaoMin) return 'Prazo final (dias) deve ser maior que o prazo inicial.';
  for (const [nome, arr] of [
    ['Faixa até limite 1', p.diasParcelasFaixa1],
    ['Faixa até limite 2', p.diasParcelasFaixa2],
    ['Faixa acima do limite 2', p.diasParcelasFaixa3],
  ] as const) {
    if (!arr.length) return `Informe ao menos um dia de parcela em: ${nome}.`;
    for (const dia of arr) {
      if (dia < p.diasCondicaoMin || dia > p.diasCondicaoMax) {
        return `${nome}: o dia ${dia} está fora do intervalo ${p.diasCondicaoMin}–${p.diasCondicaoMax}.`;
      }
    }
  }
  if (p.pctEntradaAlvo <= 0 || p.pctEntradaAlvo >= 1) return 'Entrada alvo deve estar entre 0 e 100%.';
  if (p.pctEntradaTolerancia <= 0 || p.pctEntradaTolerancia > 0.5) return 'Tolerância da entrada inválida.';
  return null;
}

function normalizarPoliticaLida(politica: PoliticaComercialParams): PoliticaComercialParams {
  // Legado: teto 180 impedia considerar parcelas 210–300 no texto da condição.
  if (politica.diasCondicaoMax === 180 && politica.diasCondicaoMin === DEFAULT_POLITICA_COMERCIAL.diasCondicaoMin) {
    return { ...politica, diasCondicaoMax: DEFAULT_POLITICA_COMERCIAL.diasCondicaoMax };
  }
  return politica;
}

async function lerPoliticaV1(): Promise<PoliticaComercialParams | null> {
  const row = await prisma.config.findUnique({ where: { key: KEY_V1 } });
  if (!row?.value?.trim()) return null;
  try {
    return normalizarPoliticaLida(mergePoliticaComercialParcial(JSON.parse(row.value) as unknown));
  } catch {
    return null;
  }
}

function padraoDuplo(base?: PoliticaComercialParams | null): PoliticasComerciaisPainel {
  const p = base ? { ...base } : { ...DEFAULT_POLITICA_COMERCIAL };
  return { industria: { ...p }, lojas: { ...p } };
}

export async function getPoliticasComerciaisPainel(): Promise<PoliticasComerciaisPainel> {
  const row = await prisma.config.findUnique({ where: { key: KEY_V2 } });
  if (row?.value?.trim()) {
    try {
      const parsed = JSON.parse(row.value) as Record<string, unknown>;
      return {
        industria: normalizarPoliticaLida(mergePoliticaComercialParcial(parsed.industria ?? parsed)),
        lojas: normalizarPoliticaLida(mergePoliticaComercialParcial(parsed.lojas ?? parsed.industria ?? parsed)),
      };
    } catch {
      /* fall through */
    }
  }
  const v1 = await lerPoliticaV1();
  return padraoDuplo(v1);
}

/** @deprecated Prefer getPoliticaComercialPainelPorEscopo — mantém compat. com v1 (indústria). */
export async function getPoliticaComercialPainelPersistida(): Promise<PoliticaComercialParams> {
  const ambas = await getPoliticasComerciaisPainel();
  return ambas.industria;
}

export async function getPoliticaComercialPainelPorEscopo(
  escopo: PoliticaComercialEscopo
): Promise<PoliticaComercialParams> {
  const ambas = await getPoliticasComerciaisPainel();
  return escopo === 'lojas' ? ambas.lojas : ambas.industria;
}

export async function savePoliticaComercialPainelPorEscopo(
  escopo: PoliticaComercialEscopo,
  politica: PoliticaComercialParams
): Promise<void> {
  const err = validarPoliticaComercialParaSalvar(politica);
  if (err) throw new Error(err);
  const atuais = await getPoliticasComerciaisPainel();
  const next: PoliticasComerciaisPainel = {
    industria: escopo === 'industria' ? politica : atuais.industria,
    lojas: escopo === 'lojas' ? politica : atuais.lojas,
  };
  const value = JSON.stringify(next);
  await prisma.config.upsert({
    where: { key: KEY_V2 },
    create: { key: KEY_V2, value },
    update: { value },
  });
}

/** @deprecated Prefer savePoliticaComercialPainelPorEscopo. */
export async function savePoliticaComercialPainel(politica: PoliticaComercialParams): Promise<void> {
  await savePoliticaComercialPainelPorEscopo('industria', politica);
}

/**
 * Indústria ← «Só Aço»; Lojas ← «Só Móveis» / «Só Refrigeração».
 * Fallback por empresaId mapeado (1/2) quando o atributo vier vazio.
 */
export function escopoPoliticaPorVendaEmpresa(
  vendaPorEmpresa: string,
  empresaId?: number
): PoliticaComercialEscopo {
  const s = (vendaPorEmpresa ?? '').trim();
  if (s === 'Só Aço') return 'industria';
  if (s === 'Só Móveis' || s === 'Só Refrigeração') return 'lojas';
  if (empresaId === 1) return 'industria';
  if (empresaId === 2) return 'lojas';
  return 'industria';
}

export function parseEscopoPolitica(raw: unknown): PoliticaComercialEscopo | null {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (s === 'industria') return 'industria';
  if (s === 'lojas' || s === 'loja') return 'lojas';
  return null;
}
