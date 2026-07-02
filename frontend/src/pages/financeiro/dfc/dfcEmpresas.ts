/** Empresas Nomus (pd.idEmpresa) usadas na DFC e no saldo a faturar. */
export const DFC_ID_EMPRESA_ACO = 1;
export const DFC_ID_EMPRESA_MOVEIS = 2;
export const DFC_ID_EMPRESA_REFRIGERACAO = 3;
export const DFC_ID_EMPRESA_RN_MARQUES = 4;

/** Projeção de Receitas (saldo a faturar) — pd.idEmpresa Só Aço; exibida quando incluída no filtro. */
export function projecaoReceitasAplicaParaEmpresas(idEmpresas: number[]): boolean {
  return idEmpresas.includes(DFC_ID_EMPRESA_ACO);
}

/** Opções para seleção múltipla (um id por botão). */
/** Todas as empresas carregadas no Aplicar (Nomus + Shop9). */
export const DFC_EMPRESAS_TODAS: number[] = [
  DFC_ID_EMPRESA_ACO,
  DFC_ID_EMPRESA_MOVEIS,
  DFC_ID_EMPRESA_REFRIGERACAO,
  DFC_ID_EMPRESA_RN_MARQUES,
];

export const DFC_EMPRESA_OPCOES: { label: string; id: number }[] = [
  { label: 'Só Aço', id: DFC_ID_EMPRESA_ACO },
  { label: 'Só Móveis', id: DFC_ID_EMPRESA_MOVEIS },
  { label: 'Só Refrigeração', id: DFC_ID_EMPRESA_REFRIGERACAO },
  { label: 'RN Marques', id: DFC_ID_EMPRESA_RN_MARQUES },
];

export const EMPRESA_LABELS: Record<number, string> = {
  [DFC_ID_EMPRESA_ACO]: 'Só Aço',
  [DFC_ID_EMPRESA_MOVEIS]: 'Só Móveis',
  [DFC_ID_EMPRESA_REFRIGERACAO]: 'Só Refrigeração',
  [DFC_ID_EMPRESA_RN_MARQUES]: 'RN Marques',
};

export function labelEmpresaDfc(id: number): string {
  return EMPRESA_LABELS[id] ?? `Empresa ${id}`;
}

// ── Resolução de empresa (espelha backend dfcShop9Empresa.ts) ─────────────────

type LinhaEmpresaDfc = {
  empresa?: string | null;
  idEmpresa?: number | null;
};

const ALIASES_POR_ID: Record<number, readonly string[]> = {
  [DFC_ID_EMPRESA_ACO]: ['so aco industrial', 'só aço industrial', 'so aco', 'só aço'],
  [DFC_ID_EMPRESA_MOVEIS]: ['so moveis', 'só móveis'],
  [DFC_ID_EMPRESA_REFRIGERACAO]: ['so refrigeracao', 'so refrigeração', 'refrigeracao', 'refrigeração'],
  [DFC_ID_EMPRESA_RN_MARQUES]: ['r n marques', 'rn marques'],
};

const MATCH_EMPRESA_POR_ID: Record<number, RegExp[]> = {
  [DFC_ID_EMPRESA_ACO]: [/a[cç]o\s*industrial/i, /s[oó]\s*a[cç]o/i, /\bso\s*aco\b/i],
  [DFC_ID_EMPRESA_MOVEIS]: [/s[oó]\s*m[oó]veis/i, /\bso\s*moveis\b/i],
  [DFC_ID_EMPRESA_REFRIGERACAO]: [/so\s*refrigera/i, /refrigera[cç][aã]o/i],
  [DFC_ID_EMPRESA_RN_MARQUES]: [/r\s*n\s*marques/i, /rn\s*marques/i, /marques\s*araujo/i],
};

const ORDEM_MATCH_IDS = [DFC_ID_EMPRESA_REFRIGERACAO, DFC_ID_EMPRESA_RN_MARQUES, DFC_ID_EMPRESA_MOVEIS, DFC_ID_EMPRESA_ACO] as const;

function normalizarTextoEmpresa(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function textoCasaAlias(texto: string, nomusId: number): boolean {
  const norm = normalizarTextoEmpresa(texto);
  if (!norm || norm === 'nao cadastrado') return false;
  const aliases = ALIASES_POR_ID[nomusId];
  if (aliases?.some((a) => norm === a || norm.includes(a) || a.includes(norm))) return true;
  return MATCH_EMPRESA_POR_ID[nomusId]?.some((rx) => rx.test(texto)) ?? false;
}

/** Resolve qual empresa DFC (1–4) a linha representa, priorizando o texto `empresa`. */
export function resolverIdEmpresaDfc(row: LinhaEmpresaDfc): number | null {
  const emp = String(row.empresa ?? '').trim();
  const textos = emp ? [emp] : [];
  for (const id of ORDEM_MATCH_IDS) {
    if (textos.some((t) => textoCasaAlias(t, id))) return id;
  }
  const idNomus = row.idEmpresa != null && DFC_EMPRESAS_TODAS.includes(Math.trunc(Number(row.idEmpresa)))
    ? Math.trunc(Number(row.idEmpresa))
    : null;
  if (idNomus != null && textos.length === 0) return idNomus;
  if (idNomus != null && textos.every((t) => textoCasaAlias(t, idNomus))) return idNomus;
  return null;
}

/**
 * Filtra linha por empresas selecionadas na DFC.
 * Prioriza o nome (`empresa`) — o id bruto do Nomus nem sempre coincide com 1–4 da interface.
 */
export function linhaMatchesEmpresasDfc(row: LinhaEmpresaDfc, idEmpresas: number[]): boolean {
  if (idEmpresas.length === 0) return true;
  const emp = String(row.empresa ?? '').trim();
  if (emp) {
    const idTexto = resolverIdEmpresaDfc({ empresa: emp });
    if (idTexto != null) return idEmpresas.includes(idTexto);
  }
  const id = resolverIdEmpresaDfc(row);
  return id != null && idEmpresas.includes(id);
}
