/**
 * DRE Rateio — config persistida em backend/var/dre-rateio.json (não sobrescrita pelo deploy/git).
 * Espelha a estrutura do localStorage `dre-rateio-v3` do frontend.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VAR_DIR = join(__dirname, '..', '..', 'var');
const RATEIO_FILE = join(VAR_DIR, 'dre-rateio.json');

export type DreRateioPercentuais = Record<string, number>;

export type DreRateioOrigemPlanoContas = {
  tipo: 'plano_contas';
  pathKey: string;
  codigo: string;
  nome: string;
};

export type DreRateioOrigemFornecedores = {
  tipo: 'fornecedores';
  pathKeyConta: string;
  codigoConta: string;
  nomeConta: string;
  nomes: string[];
};

export type DreRateioOrigem = DreRateioOrigemPlanoContas | DreRateioOrigemFornecedores;

export type DreRateioRegra = {
  id: string;
  origem: DreRateioOrigem;
  percentuais: DreRateioPercentuais;
};

export type DreRateioConfigArquivo = {
  regras: DreRateioRegra[];
  atualizadoEm?: string;
};

function ensureVarDir(): void {
  if (!existsSync(VAR_DIR)) mkdirSync(VAR_DIR, { recursive: true });
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

function parsePercentuais(raw: unknown): DreRateioPercentuais {
  const out: DreRateioPercentuais = {};
  if (!isRecord(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    const id = String(Math.trunc(Number(k)));
    const n = Number(v);
    if (!Number.isFinite(Number(k)) || Number(k) <= 0 || !Number.isFinite(n)) continue;
    out[id] = Math.round(n * 100) / 100;
  }
  return out;
}

function parseOrigem(raw: unknown): DreRateioOrigem | null {
  if (!isRecord(raw)) return null;
  const tipo = String(raw.tipo ?? '');
  if (tipo === 'plano_contas') {
    const pathKey = String(raw.pathKey ?? '').trim();
    const codigo = String(raw.codigo ?? '').trim();
    const nome = String(raw.nome ?? '').trim();
    if (!pathKey || !codigo) return null;
    return { tipo: 'plano_contas', pathKey, codigo, nome: nome || codigo };
  }
  if (tipo === 'fornecedores') {
    const pathKeyConta = String(raw.pathKeyConta ?? '').trim();
    const codigoConta = String(raw.codigoConta ?? '').trim();
    const nomeConta = String(raw.nomeConta ?? '').trim();
    const nomes = Array.isArray(raw.nomes)
      ? [...new Set(raw.nomes.map((n) => String(n ?? '').trim()).filter(Boolean))]
      : [];
    if (!pathKeyConta || !codigoConta || nomes.length === 0) return null;
    return {
      tipo: 'fornecedores',
      pathKeyConta,
      codigoConta,
      nomeConta: nomeConta || codigoConta,
      nomes,
    };
  }
  return null;
}

function parseRegra(raw: unknown): DreRateioRegra | null {
  if (!isRecord(raw)) return null;
  const id = String(raw.id ?? '').trim();
  const origem = parseOrigem(raw.origem);
  const percentuais = parsePercentuais(raw.percentuais);
  if (!id || !origem || Object.keys(percentuais).length === 0) return null;
  return { id, origem, percentuais };
}

function normalizarConfig(raw: unknown): DreRateioConfigArquivo {
  if (!isRecord(raw) || !Array.isArray(raw.regras)) {
    return { regras: [] };
  }
  const regras = raw.regras.map(parseRegra).filter((r): r is DreRateioRegra => r != null);
  return {
    regras,
    atualizadoEm: typeof raw.atualizadoEm === 'string' ? raw.atualizadoEm : undefined,
  };
}

/** true se o arquivo ainda não existe na VPS/local. */
export function existeArquivoRateioDre(): boolean {
  return existsSync(RATEIO_FILE);
}

export function lerDreRateioConfig(): DreRateioConfigArquivo {
  ensureVarDir();
  if (!existsSync(RATEIO_FILE)) {
    return { regras: [] };
  }
  try {
    const raw = JSON.parse(readFileSync(RATEIO_FILE, 'utf-8')) as unknown;
    return normalizarConfig(raw);
  } catch (e) {
    console.error('[lerDreRateioConfig]', e instanceof Error ? e.message : e);
    return { regras: [] };
  }
}

export function salvarDreRateioConfig(config: unknown): DreRateioConfigArquivo {
  ensureVarDir();
  const normalizado = normalizarConfig(config);
  const payload: DreRateioConfigArquivo = {
    regras: normalizado.regras,
    atualizadoEm: new Date().toISOString(),
  };
  writeFileSync(RATEIO_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
  return payload;
}

/**
 * Grava só se o arquivo ainda não existir ou estiver sem regras.
 * Usado na migração automática a partir do localStorage do navegador de produção.
 */
export function salvarDreRateioConfigSeVazio(config: unknown): {
  gravado: boolean;
  config: DreRateioConfigArquivo;
} {
  const atual = lerDreRateioConfig();
  if (existeArquivoRateioDre() && atual.regras.length > 0) {
    return { gravado: false, config: atual };
  }
  return { gravado: true, config: salvarDreRateioConfig(config) };
}
