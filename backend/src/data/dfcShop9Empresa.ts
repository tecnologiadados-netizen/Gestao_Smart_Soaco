/**
 * Filtro de empresas DFC (Nomus + Shop9) por texto `empresa` / centro de custo / filial.
 */

export const DFC_NOMUS_EMPRESA_ACO = 1;
export const DFC_NOMUS_EMPRESA_MOVEIS = 2;
export const DFC_NOMUS_EMPRESA_REFRIGERACAO = 3;
export const DFC_NOMUS_EMPRESA_RN_MARQUES = 4;

export type Shop9LinhaEmpresa = {
  empresa?: string | null;
  centrocusto?: string | null;
  nomeFilial?: string | null;
  ordemFilial?: number | null;
  /** idEmpresa Nomus (1–4) ou Ordem_Filial Shop9 (1, 6…). */
  idEmpresa?: number | null;
};

export type DfcEmpresaDef = {
  id: number;
  label: string;
  matchEmpresa: RegExp[];
};

/** Nomes vindos do ERP → id usado nos filtros da DFC. */
const ALIASES_POR_ID: Record<number, readonly string[]> = {
  [DFC_NOMUS_EMPRESA_ACO]: [
    'so aco industrial',
    'só aço industrial',
    'so aco',
    'só aço',
  ],
  [DFC_NOMUS_EMPRESA_MOVEIS]: ['so moveis', 'só móveis'],
  [DFC_NOMUS_EMPRESA_REFRIGERACAO]: [
    'so refrigeracao',
    'so refrigeração',
    'refrigeracao',
    'refrigeração',
  ],
  [DFC_NOMUS_EMPRESA_RN_MARQUES]: ['r n marques', 'rn marques'],
};

export const DFC_EMPRESAS_DEFS: DfcEmpresaDef[] = [
  {
    id: DFC_NOMUS_EMPRESA_ACO,
    label: 'Só Aço',
    matchEmpresa: [/a[cç]o\s*industrial/i, /s[oó]\s*a[cç]o/i, /\bso\s*aco\b/i],
  },
  {
    id: DFC_NOMUS_EMPRESA_MOVEIS,
    label: 'Só Móveis',
    matchEmpresa: [/s[oó]\s*m[oó]veis/i, /\bso\s*moveis\b/i],
  },
  {
    id: DFC_NOMUS_EMPRESA_REFRIGERACAO,
    label: 'Só Refrigeração',
    matchEmpresa: [/so\s*refrigera/i, /refrigera[cç][aã]o/i],
  },
  {
    id: DFC_NOMUS_EMPRESA_RN_MARQUES,
    label: 'RN Marques',
    matchEmpresa: [/r\s*n\s*marques/i, /rn\s*marques/i, /marques\s*araujo/i],
  },
];

const DEF_BY_ID = new Map(DFC_EMPRESAS_DEFS.map((d) => [d.id, d]));

/** Ordem: nomes mais específicos antes (refrigeração / marques antes de aço). */
const ORDEM_MATCH_IDS = [3, 4, 2, 1] as const;

/** Filial Shop9 (Ordem_Filial) → id empresa Nomus na DFC/DRE. */
export const SHOP9_FILIAL_NOMUS: Record<number, number> = {
  1: DFC_NOMUS_EMPRESA_ACO,
  6: DFC_NOMUS_EMPRESA_MOVEIS,
};

/** Filiais Shop9 a consultar conforme ids Nomus selecionados (1=Só Aço, 2=Só Móveis). */
export function filiaisShop9ParaIdsNomus(idEmpresas: number[]): number[] {
  const norm = new Set(normalizarIdsEmpresasDfc(idEmpresas));
  const filiais: number[] = [];
  for (const [filial, nomusId] of Object.entries(SHOP9_FILIAL_NOMUS)) {
    if (norm.has(nomusId)) filiais.push(Number(filial));
  }
  return filiais;
}

/** Empresas cujas saídas DRE vêm do Shop9 (Financeiro_Contas por competência). */
export const DRE_SHOP9_SAIDAS_EMPRESAS: readonly number[] = [
  DFC_NOMUS_EMPRESA_ACO,
  DFC_NOMUS_EMPRESA_REFRIGERACAO,
  DFC_NOMUS_EMPRESA_RN_MARQUES,
];

export function empresasComSaidasShop9Dre(idEmpresas: number[]): number[] {
  const norm = normalizarIdsEmpresasDfc(idEmpresas);
  return norm.filter((id) => DRE_SHOP9_SAIDAS_EMPRESAS.includes(id));
}

/** Filial Shop9 — despesas DRE da R N Marques (Financeiro_Contas). */
export const SHOP9_FILIAL_RN_MARQUES_DRE = 6;

/** Filiais Shop9 para saídas DRE (Refrigeração/RN: filial 1 + CC; RN também filial 6). */
export function filiaisShop9SaidasDre(idEmpresas: number[]): number[] {
  const emp = empresasComSaidasShop9Dre(idEmpresas);
  const set = new Set<number>();
  for (const id of emp) {
    if (
      id === DFC_NOMUS_EMPRESA_ACO ||
      id === DFC_NOMUS_EMPRESA_REFRIGERACAO ||
      id === DFC_NOMUS_EMPRESA_RN_MARQUES
    ) {
      set.add(1);
    }
    if (id === DFC_NOMUS_EMPRESA_RN_MARQUES) {
      set.add(SHOP9_FILIAL_RN_MARQUES_DRE);
    }
  }
  return [...set];
}

export function normalizarIdsEmpresasDfc(ids?: number[]): number[] {
  const raw = ids?.length ? ids : [DFC_NOMUS_EMPRESA_ACO];
  const out = raw.filter((n) => DEF_BY_ID.has(n));
  return out.length > 0 ? [...new Set(out)] : [DFC_NOMUS_EMPRESA_ACO];
}

export function labelEmpresaDfc(id: number): string {
  return DEF_BY_ID.get(id)?.label ?? `Empresa ${id}`;
}

export function normalizarTextoEmpresa(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Centro de custo utilizável para definir empresa (≠ vazio / "Não Cadastrado"). */
export function centroCustoValidoParaEmpresa(texto: string | null | undefined): boolean {
  const norm = normalizarTextoEmpresa(String(texto ?? '').trim());
  return norm.length > 0 && norm !== 'nao cadastrado';
}

function resolverIdPorTextos(textos: string[]): number | null {
  for (const id of ORDEM_MATCH_IDS) {
    if (textos.some((t) => textoCasaComDef(t, DEF_BY_ID.get(id)!))) return id;
  }
  return null;
}

/**
 * Textos usados para resolver empresa.
 * Com centro de custo válido, só ele define a empresa (filial não compete).
 */
export function textosEmpresaParaMatch(row: Shop9LinhaEmpresa): string[] {
  const cc = String(row.centrocusto ?? '').trim();
  if (centroCustoValidoParaEmpresa(cc)) {
    return [cc];
  }

  const out: string[] = [];
  const emp = String(row.empresa ?? '').trim();
  const nf = String(row.nomeFilial ?? '').trim();
  if (emp) out.push(emp);
  if (nf && normalizarTextoEmpresa(nf) !== normalizarTextoEmpresa(emp)) out.push(nf);
  return out;
}

function textoCasaAlias(texto: string, nomusId: number): boolean {
  const norm = normalizarTextoEmpresa(texto);
  if (!norm || norm === 'nao cadastrado') return false;
  const aliases = ALIASES_POR_ID[nomusId];
  if (aliases?.some((a) => norm === a || norm.includes(a) || a.includes(norm))) return true;
  const def = DEF_BY_ID.get(nomusId);
  return def?.matchEmpresa.some((rx) => rx.test(texto)) ?? false;
}

function textoCasaComDef(texto: string, def: DfcEmpresaDef): boolean {
  return textoCasaAlias(texto, def.id);
}

function idEmpresaNomusValido(id: unknown): number | null {
  const n = Math.trunc(Number(id));
  return DEF_BY_ID.has(n) ? n : null;
}

/**
 * Resolve qual empresa Nomus (1–4) a linha representa.
 * Prioridade: centro de custo válido → empresa/filial → fallback Ordem_Filial.
 */
export function resolverIdEmpresaDfc(row: Shop9LinhaEmpresa): number | null {
  const textos = textosEmpresaParaMatch(row);
  const porTexto = resolverIdPorTextos(textos);
  if (porTexto != null) return porTexto;

  const empNorm = normalizarTextoEmpresa(String(row.empresa ?? ''));
  const filial = row.ordemFilial != null ? Math.trunc(Number(row.ordemFilial)) : 0;
  if ((!empNorm || empNorm === 'nao cadastrado') && filial > 0 && SHOP9_FILIAL_NOMUS[filial]) {
    return SHOP9_FILIAL_NOMUS[filial];
  }

  const idNomus = idEmpresaNomusValido(row.idEmpresa);
  if (idNomus != null && textos.length === 0) return idNomus;
  if (idNomus != null && textos.every((t) => textoCasaAlias(t, idNomus))) return idNomus;

  return null;
}

export function linhaMatchesDfcEmpresa(row: Shop9LinhaEmpresa, nomusId: number): boolean {
  return resolverIdEmpresaDfc(row) === nomusId;
}

/** @deprecated use textosEmpresaParaMatch */
export const textosEmpresaShop9ParaMatch = textosEmpresaParaMatch;

export function linhaShop9MatchesNomusEmpresa(row: Shop9LinhaEmpresa, nomusId: number): boolean {
  return linhaMatchesDfcEmpresa(row, nomusId);
}

export function resolverNomusIdEmpresaShop9(row: Shop9LinhaEmpresa): number | null {
  return resolverIdEmpresaDfc(row);
}

/** Resolve empresa para saídas DRE Shop9 (filial 6 → R N Marques). */
export function resolverIdEmpresaShop9SaidasDre(row: Shop9LinhaEmpresa): number | null {
  const filial = row.ordemFilial != null ? Math.trunc(Number(row.ordemFilial)) : 0;
  if (filial === SHOP9_FILIAL_RN_MARQUES_DRE) {
    return DFC_NOMUS_EMPRESA_RN_MARQUES;
  }
  return resolverIdEmpresaDfc(row);
}

export function filtrarPorEmpresasSaidasShop9Dre<T extends Shop9LinhaEmpresa>(
  rows: T[],
  idEmpresas: number[],
): T[] {
  const set = new Set(normalizarIdsEmpresasDfc(idEmpresas));
  return rows.filter((r) => {
    const id = resolverIdEmpresaShop9SaidasDre(r);
    return id != null && set.has(id);
  });
}

export function filtrarPorEmpresasSelecionadas<T extends Shop9LinhaEmpresa>(
  rows: T[],
  idEmpresas: number[],
): T[] {
  const set = new Set(normalizarIdsEmpresasDfc(idEmpresas));
  return rows.filter((r) => {
    const id = resolverIdEmpresaDfc(r);
    return id != null && set.has(id);
  });
}
