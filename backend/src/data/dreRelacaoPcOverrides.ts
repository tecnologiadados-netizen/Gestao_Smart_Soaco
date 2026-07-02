import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VAR_DIR = join(__dirname, '..', '..', 'var');
const OVERRIDES_FILE = join(VAR_DIR, 'dre-relacao-pc.json');

export type DreRelacaoPcOverrides = {
  /** pathKey DRE → ids Nomus (contafinanceiro.id) adicionados manualmente */
  nomusIdsAdicionais: Record<string, number[]>;
  /** pathKey DRE → ids Nomus removidos do mapeamento automático */
  nomusIdsExcluidos: Record<string, number[]>;
  /** pathKey DRE → ordens Shop9 (Plano_Contas3.Ordem) adicionadas manualmente */
  shop9OrdensAdicionais: Record<string, number[]>;
  /** pathKey DRE → ordens Shop9 removidas do mapeamento automático */
  shop9OrdensExcluidos: Record<string, number[]>;
};

const VAZIO: DreRelacaoPcOverrides = {
  nomusIdsAdicionais: {},
  nomusIdsExcluidos: {},
  shop9OrdensAdicionais: {},
  shop9OrdensExcluidos: {},
};

function ensureVarDir(): void {
  if (!existsSync(VAR_DIR)) mkdirSync(VAR_DIR, { recursive: true });
}

function uniqNums(arr: unknown): number[] {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.map((n) => Math.trunc(Number(n))).filter((n) => Number.isFinite(n) && n > 0))].sort(
    (a, b) => a - b,
  );
}

function normalizarMapaIds(raw: unknown): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [pk, ids] of Object.entries(raw as Record<string, unknown>)) {
    const key = pk.trim();
    if (!key) continue;
    const list = uniqNums(ids);
    if (list.length) out[key] = list;
  }
  return out;
}

function normalizarOverrides(raw: Partial<DreRelacaoPcOverrides> & { shop9OrdemParaPathKey?: unknown }): DreRelacaoPcOverrides {
  const next: DreRelacaoPcOverrides = {
    nomusIdsAdicionais: normalizarMapaIds(raw.nomusIdsAdicionais),
    nomusIdsExcluidos: normalizarMapaIds(raw.nomusIdsExcluidos),
    shop9OrdensAdicionais: normalizarMapaIds(raw.shop9OrdensAdicionais),
    shop9OrdensExcluidos: normalizarMapaIds(raw.shop9OrdensExcluidos),
  };

  // Migra formato legado shop9OrdemParaPathKey → shop9OrdensAdicionais
  if (raw.shop9OrdemParaPathKey && typeof raw.shop9OrdemParaPathKey === 'object') {
    for (const [ordemStr, pk] of Object.entries(raw.shop9OrdemParaPathKey as Record<string, string>)) {
      const ordem = Math.trunc(Number(ordemStr));
      const pathKey = String(pk ?? '').trim();
      if (ordem <= 0 || !pathKey) continue;
      const cur = next.shop9OrdensAdicionais[pathKey] ?? [];
      if (!cur.includes(ordem)) cur.push(ordem);
      next.shop9OrdensAdicionais[pathKey] = cur.sort((a, b) => a - b);
    }
  }

  return next;
}

export function lerDreRelacaoPcOverrides(): DreRelacaoPcOverrides {
  ensureVarDir();
  if (!existsSync(OVERRIDES_FILE)) return { ...VAZIO };
  try {
    const raw = JSON.parse(readFileSync(OVERRIDES_FILE, 'utf-8')) as Partial<DreRelacaoPcOverrides> & {
      shop9OrdemParaPathKey?: unknown;
      shop9OrdensExcluidas?: unknown;
    };
    const norm = normalizarOverrides(raw);
    if (Array.isArray(raw.shop9OrdensExcluidas) && raw.shop9OrdensExcluidas.length) {
      // legado global — ignorado na leitura (reconfigurar no modal)
    }
    return norm;
  } catch {
    return { ...VAZIO };
  }
}

export function salvarDreRelacaoPcOverrides(overrides: DreRelacaoPcOverrides): void {
  ensureVarDir();
  const normalizado = normalizarOverrides(overrides);
  writeFileSync(OVERRIDES_FILE, `${JSON.stringify(normalizado, null, 2)}\n`, 'utf-8');
}

/** Mapa ordem Shop9 → pathKey DRE (somente vínculos manuais). */
export function mapaShop9OrdemParaPathKeyManual(overrides: DreRelacaoPcOverrides): Map<number, string> {
  const out = new Map<number, string>();
  for (const [pk, ordens] of Object.entries(overrides.shop9OrdensAdicionais)) {
    for (const ordem of ordens) out.set(ordem, pk);
  }
  return out;
}

export function patchDreRelacaoPcPathKey(
  pathKey: string,
  patch: {
    nomusIdsAdicionais?: number[];
    nomusIdsExcluidos?: number[];
    shop9OrdensAdicionais?: number[];
    shop9OrdensExcluidos?: number[];
  },
): DreRelacaoPcOverrides {
  const pk = pathKey.trim();
  if (!pk) throw new Error('pathKey inválido');

  const cur = lerDreRelacaoPcOverrides();
  const next: DreRelacaoPcOverrides = {
    nomusIdsAdicionais: { ...cur.nomusIdsAdicionais },
    nomusIdsExcluidos: { ...cur.nomusIdsExcluidos },
    shop9OrdensAdicionais: { ...cur.shop9OrdensAdicionais },
    shop9OrdensExcluidos: { ...cur.shop9OrdensExcluidos },
  };

  const setLista = (map: Record<string, number[]>, lista?: number[]) => {
    if (lista === undefined) return;
    const nums = uniqNums(lista);
    if (nums.length) map[pk] = nums;
    else delete map[pk];
  };

  setLista(next.nomusIdsAdicionais, patch.nomusIdsAdicionais);
  setLista(next.nomusIdsExcluidos, patch.nomusIdsExcluidos);
  setLista(next.shop9OrdensAdicionais, patch.shop9OrdensAdicionais);
  setLista(next.shop9OrdensExcluidos, patch.shop9OrdensExcluidos);

  if (patch.nomusIdsAdicionais !== undefined) {
    for (const id of patch.nomusIdsAdicionais) {
      for (const [outraPk, ids] of Object.entries(next.nomusIdsAdicionais)) {
        if (outraPk === pk) continue;
        const filtrado = ids.filter((x) => x !== id);
        if (filtrado.length) next.nomusIdsAdicionais[outraPk] = filtrado;
        else delete next.nomusIdsAdicionais[outraPk];
      }
    }
  }

  if (patch.shop9OrdensAdicionais !== undefined) {
    for (const ordem of patch.shop9OrdensAdicionais) {
      for (const [outraPk, ordens] of Object.entries(next.shop9OrdensAdicionais)) {
        if (outraPk === pk) continue;
        const filtrado = ordens.filter((x) => x !== ordem);
        if (filtrado.length) next.shop9OrdensAdicionais[outraPk] = filtrado;
        else delete next.shop9OrdensAdicionais[outraPk];
      }
    }
  }

  salvarDreRelacaoPcOverrides(next);
  return next;
}
