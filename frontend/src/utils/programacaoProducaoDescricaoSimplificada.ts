import catalogo from '../data/programacaoProducaoDescricoesSimplificadas.json';
import type { LinhaProgramacaoProducao } from '../components/programacao-producao/types';
import { getCatalogoDescricoesRuntime } from './programacaoProducaoCatalogoRuntime';

const MAP_BUNDLED = catalogo as Record<string, string>;

function mapDescricoesAtivo(): Record<string, string> {
  return getCatalogoDescricoesRuntime() ?? MAP_BUNDLED;
}

/** Normaliza código do componente para lookup (trim + espaços simples). */
export function normalizarCodComponente(cod: string): string {
  return cod.trim().replace(/\s+/g, ' ');
}

export function descricaoSimplificadaDoCatalogo(cod: string): string | null {
  const key = normalizarCodComponente(cod);
  const v = mapDescricoesAtivo()[key];
  return v?.trim() ? v.trim() : null;
}

export function aplicarDescricaoSimplificadaCatalogo(linha: LinhaProgramacaoProducao): LinhaProgramacaoProducao {
  if (linha.descricao_simplificada?.trim()) return linha;
  const fromCat = descricaoSimplificadaDoCatalogo(linha.cod_componente);
  if (!fromCat) return linha;
  return { ...linha, descricao_simplificada: fromCat };
}

export function aplicarDescricoesSimplificadasNasLinhas(
  linhas: LinhaProgramacaoProducao[]
): LinhaProgramacaoProducao[] {
  return linhas.map(aplicarDescricaoSimplificadaCatalogo);
}
