import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VAR_DIR = join(__dirname, '..', '..', 'var', 'ressup-nao-almox-catalog');
const OVERRIDES_FILE = join(VAR_DIR, 'overrides.json');

export type RessupNaoAlmoxCatalogOverrides = {
  descricoes: Record<string, string>;
  fundiveis: Record<string, string>;
};

function normalizarCodProduto(cod: string): string {
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

function readOverrides(): RessupNaoAlmoxCatalogOverrides {
  ensureVarDir();
  if (!existsSync(OVERRIDES_FILE)) {
    return { descricoes: {}, fundiveis: {} };
  }
  try {
    const raw = JSON.parse(readFileSync(OVERRIDES_FILE, 'utf-8')) as Partial<RessupNaoAlmoxCatalogOverrides>;
    return {
      descricoes: raw.descricoes && typeof raw.descricoes === 'object' ? raw.descricoes : {},
      fundiveis: raw.fundiveis && typeof raw.fundiveis === 'object' ? raw.fundiveis : {},
    };
  } catch {
    return { descricoes: {}, fundiveis: {} };
  }
}

function writeOverrides(overrides: RessupNaoAlmoxCatalogOverrides): void {
  ensureVarDir();
  writeFileSync(OVERRIDES_FILE, `${JSON.stringify(overrides, null, 2)}\n`, 'utf-8');
}

function mergeCatalogs(): {
  descricoes: Record<string, string>;
  fundiveis: Record<string, string>;
} {
  const baseDesc = readSeedJson<Record<string, string>>('ressupNaoAlmoxDescricoesSimplificadas.json');
  const baseFund = readSeedJson<Record<string, string>>('ressupNaoAlmoxFundiveisPares.json');
  const overrides = readOverrides();
  return {
    descricoes: { ...baseDesc, ...overrides.descricoes },
    fundiveis: { ...baseFund, ...overrides.fundiveis },
  };
}

export function loadRessupNaoAlmoxCatalogo(): {
  descricoes: Record<string, string>;
  fundiveis: Record<string, string>;
} {
  return mergeCatalogs();
}

export function saveCatalogoDescricaoSimplificadaNaoAlmox(
  codProduto: string,
  descricao: string | null
): { descricoes: Record<string, string> } {
  const key = normalizarCodProduto(codProduto);
  if (!key) throw new Error('Código do produto inválido.');
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

export function saveCatalogoFundivelPar(
  codSemPintura: string,
  codComPintura: string | null
): { fundiveis: Record<string, string> } {
  const key = normalizarCodProduto(codSemPintura);
  if (!key) throw new Error('Código sem pintura inválido.');
  const overrides = readOverrides();
  const pintado = codComPintura?.trim() ?? '';
  if (pintado && pintado !== key) {
    overrides.fundiveis[key] = normalizarCodProduto(pintado);
  } else {
    delete overrides.fundiveis[key];
  }
  writeOverrides(overrides);
  return { fundiveis: mergeCatalogs().fundiveis };
}

/** Mapa invertido: código com pintura → código sem pintura (para deduplicar grade). */
export function buildMapCodigosPintados(fundiveis: Record<string, string>): Map<string, string> {
  const map = new Map<string, string>();
  for (const [sem, com] of Object.entries(fundiveis)) {
    const k = normalizarCodProduto(com);
    if (k) map.set(k, normalizarCodProduto(sem));
  }
  return map;
}

export { normalizarCodProduto };
