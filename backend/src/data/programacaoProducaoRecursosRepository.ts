import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VAR_DIR = join(__dirname, '..', '..', 'var', 'programacao-producao-catalog');
const RECURSOS_FILE = join(VAR_DIR, 'recursos.json');

export type ProgramacaoProducaoRecurso = {
  cod: string;
  nome: string;
  criadoPorLogin: string;
  criadoPorNome: string | null;
  atualizadoPorLogin: string;
  atualizadoPorNome: string | null;
  createdAt: string;
  updatedAt: string;
};

type RecursosStore = {
  recursos: ProgramacaoProducaoRecurso[];
};

function ensureVarDir(): void {
  if (!existsSync(VAR_DIR)) mkdirSync(VAR_DIR, { recursive: true });
}

function readStore(): RecursosStore {
  ensureVarDir();
  if (!existsSync(RECURSOS_FILE)) return { recursos: [] };
  try {
    const raw = JSON.parse(readFileSync(RECURSOS_FILE, 'utf-8')) as Partial<RecursosStore>;
    const recursos = Array.isArray(raw.recursos) ? raw.recursos : [];
    return { recursos: recursos.filter((r) => r && typeof r.cod === 'string' && typeof r.nome === 'string') };
  } catch {
    return { recursos: [] };
  }
}

function writeStore(store: RecursosStore): void {
  ensureVarDir();
  writeFileSync(RECURSOS_FILE, `${JSON.stringify(store, null, 2)}\n`, 'utf-8');
}

function normalizarNome(nome: string): string {
  return nome.trim().replace(/\s+/g, ' ');
}

function gerarProximoCod(recursos: ProgramacaoProducaoRecurso[]): string {
  let max = 0;
  for (const r of recursos) {
    const m = /^R(\d+)$/i.exec(r.cod.trim());
    if (m) {
      const n = parseInt(m[1]!, 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return `R${String(max + 1).padStart(3, '0')}`;
}

export function listProgramacaoProducaoRecursos(): ProgramacaoProducaoRecurso[] {
  return [...readStore().recursos].sort((a, b) => a.cod.localeCompare(b.cod, 'pt-BR'));
}

export function createProgramacaoProducaoRecurso(
  nome: string,
  usuario: { login: string; nome: string | null }
): ProgramacaoProducaoRecurso {
  const texto = normalizarNome(nome);
  if (!texto) throw new Error('Informe o nome do recurso.');
  const store = readStore();
  const dup = store.recursos.some((r) => r.nome.toLowerCase() === texto.toLowerCase());
  if (dup) throw new Error('Já existe um recurso com este nome.');
  const now = new Date().toISOString();
  const recurso: ProgramacaoProducaoRecurso = {
    cod: gerarProximoCod(store.recursos),
    nome: texto,
    criadoPorLogin: usuario.login,
    criadoPorNome: usuario.nome,
    atualizadoPorLogin: usuario.login,
    atualizadoPorNome: usuario.nome,
    createdAt: now,
    updatedAt: now,
  };
  store.recursos.push(recurso);
  writeStore(store);
  return recurso;
}

export function updateProgramacaoProducaoRecurso(
  cod: string,
  nome: string,
  usuario: { login: string; nome: string | null }
): ProgramacaoProducaoRecurso {
  const key = cod.trim();
  if (!key) throw new Error('Código do recurso inválido.');
  const texto = normalizarNome(nome);
  if (!texto) throw new Error('Informe o nome do recurso.');
  const store = readStore();
  const idx = store.recursos.findIndex((r) => r.cod === key);
  if (idx < 0) throw new Error('Recurso não encontrado.');
  const dup = store.recursos.some((r, i) => i !== idx && r.nome.toLowerCase() === texto.toLowerCase());
  if (dup) throw new Error('Já existe um recurso com este nome.');
  const prev = store.recursos[idx]!;
  const atualizado: ProgramacaoProducaoRecurso = {
    ...prev,
    nome: texto,
    atualizadoPorLogin: usuario.login,
    atualizadoPorNome: usuario.nome,
    updatedAt: new Date().toISOString(),
  };
  store.recursos[idx] = atualizado;
  writeStore(store);
  return atualizado;
}

export function deleteProgramacaoProducaoRecurso(cod: string): void {
  const key = cod.trim();
  if (!key) throw new Error('Código do recurso inválido.');
  const store = readStore();
  const next = store.recursos.filter((r) => r.cod !== key);
  if (next.length === store.recursos.length) throw new Error('Recurso não encontrado.');
  writeStore({ recursos: next });
}
