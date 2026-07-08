import type { ProgramacaoProducaoRecurso } from '../components/programacao-producao/types';
import type { BobinaAlternativaCatalogEntry } from './programacaoProducaoBobinaAlternativa';
import type { MedidasPecaCatalogEntry } from '../components/programacao-producao/types';

let runtimeBobinas: Record<string, BobinaAlternativaCatalogEntry> | null = null;
let runtimeDescricoes: Record<string, string> | null = null;
let runtimeMedidasPeca: Record<string, MedidasPecaCatalogEntry> | null = null;
let runtimeRecursos: ProgramacaoProducaoRecurso[] | null = null;

export function aplicarCatalogoProgramacaoProducao(data: {
  bobinas?: Record<string, BobinaAlternativaCatalogEntry>;
  descricoes?: Record<string, string>;
  medidasPeca?: Record<string, MedidasPecaCatalogEntry>;
  recursos?: ProgramacaoProducaoRecurso[];
}): void {
  if (data.bobinas) runtimeBobinas = { ...data.bobinas };
  if (data.descricoes) runtimeDescricoes = { ...data.descricoes };
  if (data.medidasPeca) runtimeMedidasPeca = { ...data.medidasPeca };
  if (data.recursos) runtimeRecursos = [...data.recursos];
}

export function getCatalogoRecursosRuntime(): ProgramacaoProducaoRecurso[] | null {
  return runtimeRecursos;
}

export function patchCatalogoRecursosRuntime(recursos: ProgramacaoProducaoRecurso[]): void {
  runtimeRecursos = [...recursos];
}

export function getCatalogoBobinasRuntime(): Record<string, BobinaAlternativaCatalogEntry> | null {
  return runtimeBobinas;
}

export function getCatalogoDescricoesRuntime(): Record<string, string> | null {
  return runtimeDescricoes;
}

export function getCatalogoMedidasPecaRuntime(): Record<string, MedidasPecaCatalogEntry> | null {
  return runtimeMedidasPeca;
}

export function patchCatalogoMedidasPecaRuntime(
  codComponente: string,
  entry: MedidasPecaCatalogEntry | null
): void {
  const key = codComponente.trim().replace(/\s+/g, ' ');
  if (!runtimeMedidasPeca) runtimeMedidasPeca = {};
  if (!entry || (entry.med1 == null && entry.med2 == null)) {
    delete runtimeMedidasPeca[key];
  } else {
    runtimeMedidasPeca[key] = entry;
  }
}

export function patchCatalogoBobinaRuntime(
  codComponente: string,
  entry: BobinaAlternativaCatalogEntry
): void {
  const key = codComponente.trim().replace(/\s+/g, ' ');
  if (!runtimeBobinas) runtimeBobinas = {};
  runtimeBobinas[key] = entry;
}

export function patchCatalogoDescricaoRuntime(codComponente: string, descricao: string | null): void {
  const key = codComponente.trim().replace(/\s+/g, ' ');
  if (!runtimeDescricoes) runtimeDescricoes = {};
  const texto = descricao?.trim() ?? '';
  if (texto) runtimeDescricoes[key] = texto;
  else delete runtimeDescricoes[key];
}
