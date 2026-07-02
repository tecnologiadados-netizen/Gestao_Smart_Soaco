import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VAR_DIR = join(__dirname, '..', '..', 'var', 'programacao-producao-catalog');
const OVERRIDES_FILE = join(VAR_DIR, 'overrides.json');

export type BobinaAlternativaCatalogEntry = {
  codigo_mp?: string;
  alternativas: string[];
};

export type ProgramacaoProducaoCatalogOverrides = {
  bobinas: Record<string, BobinaAlternativaCatalogEntry>;
  descricoes: Record<string, string>;
};

function normalizarCodComponente(cod: string): string {
  return cod.trim().replace(/\s+/g, ' ');
}

function resolveSeedPath(filename: string): string | null {
  const candidates = [
    join(process.cwd(), 'frontend', 'src', 'data', filename),
    join(process.cwd(), '..', 'frontend', 'src', 'data', filename),
    join(__dirname, '..', '..', '..', 'frontend', 'src', 'data', filename),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

function readSeedJson<T>(filename: string): T {
  const path = resolveSeedPath(filename);
  if (!path) return {} as T;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch {
    return {} as T;
  }
}

function ensureVarDir(): void {
  if (!existsSync(VAR_DIR)) mkdirSync(VAR_DIR, { recursive: true });
}

function readOverrides(): ProgramacaoProducaoCatalogOverrides {
  ensureVarDir();
  if (!existsSync(OVERRIDES_FILE)) {
    return { bobinas: {}, descricoes: {} };
  }
  try {
    const raw = JSON.parse(readFileSync(OVERRIDES_FILE, 'utf-8')) as Partial<ProgramacaoProducaoCatalogOverrides>;
    return {
      bobinas: raw.bobinas && typeof raw.bobinas === 'object' ? raw.bobinas : {},
      descricoes: raw.descricoes && typeof raw.descricoes === 'object' ? raw.descricoes : {},
    };
  } catch {
    return { bobinas: {}, descricoes: {} };
  }
}

function writeOverrides(overrides: ProgramacaoProducaoCatalogOverrides): void {
  ensureVarDir();
  writeFileSync(OVERRIDES_FILE, `${JSON.stringify(overrides, null, 2)}\n`, 'utf-8');
}

function mergeCatalogs(): {
  bobinas: Record<string, BobinaAlternativaCatalogEntry>;
  descricoes: Record<string, string>;
} {
  const baseBobinas = readSeedJson<Record<string, BobinaAlternativaCatalogEntry>>(
    'programacaoProducaoBobinasAlternativas.json'
  );
  const baseDesc = readSeedJson<Record<string, string>>(
    'programacaoProducaoDescricoesSimplificadas.json'
  );
  const overrides = readOverrides();
  return {
    bobinas: { ...baseBobinas, ...overrides.bobinas },
    descricoes: { ...baseDesc, ...overrides.descricoes },
  };
}

export function loadProgramacaoProducaoCatalogo(): {
  bobinas: Record<string, BobinaAlternativaCatalogEntry>;
  descricoes: Record<string, string>;
} {
  return mergeCatalogs();
}

export function saveCatalogoDescricaoSimplificada(
  codComponente: string,
  descricao: string | null
): { descricoes: Record<string, string> } {
  const key = normalizarCodComponente(codComponente);
  if (!key) throw new Error('Código do componente inválido.');
  const overrides = readOverrides();
  const texto = descricao?.trim() ?? '';
  if (texto) {
    overrides.descricoes[key] = texto;
  } else {
    delete overrides.descricoes[key];
  }
  writeOverrides(overrides);
  return { descricoes: mergeCatalogs().descricoes };
}

export function saveCatalogoBobinasAlternativas(
  codComponente: string,
  entry: BobinaAlternativaCatalogEntry
): { bobinas: Record<string, BobinaAlternativaCatalogEntry> } {
  const key = normalizarCodComponente(codComponente);
  if (!key) throw new Error('Código do componente inválido.');
  const alternativas = (entry.alternativas ?? [])
    .map((c) => c?.trim())
    .filter((c): c is string => Boolean(c));
  const codigo_mp = entry.codigo_mp?.trim() || undefined;
  const overrides = readOverrides();
  overrides.bobinas[key] = {
    ...(codigo_mp ? { codigo_mp } : {}),
    alternativas,
  };
  writeOverrides(overrides);
  return { bobinas: mergeCatalogs().bobinas };
}
