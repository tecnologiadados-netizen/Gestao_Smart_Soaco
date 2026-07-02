import type { ProgramacaoProducaoRecurso } from '../components/programacao-producao/types';
import type { BobinaAlternativaCatalogEntry } from './programacaoProducaoBobinaAlternativa';

let runtimeBobinas: Record<string, BobinaAlternativaCatalogEntry> | null = null;
let runtimeDescricoes: Record<string, string> | null = null;
let runtimeRecursos: ProgramacaoProducaoRecurso[] | null = null;

export function aplicarCatalogoProgramacaoProducao(data: {
  bobinas?: Record<string, BobinaAlternativaCatalogEntry>;
  descricoes?: Record<string, string>;
  recursos?: ProgramacaoProducaoRecurso[];
}): void {
  if (data.bobinas) runtimeBobinas = { ...data.bobinas };
  if (data.descricoes) runtimeDescricoes = { ...data.descricoes };
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
