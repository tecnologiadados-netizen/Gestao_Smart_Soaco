import catalogo from '../data/programacaoProducaoGruposProduto.json';
import type { LinhaProgramacaoProducao } from '../components/programacao-producao/types';
import { normalizarCodComponente } from './programacaoProducaoDescricaoSimplificada';

const MAP = catalogo as Record<string, string>;

export function grupoProdutoDoCatalogo(cod: string): string | null {
  const key = normalizarCodComponente(cod);
  const v = MAP[key];
  return v?.trim() ? v.trim() : null;
}

export function aplicarGrupoProdutoCatalogo(linha: LinhaProgramacaoProducao): LinhaProgramacaoProducao {
  if (linha.grupo_produto?.trim()) return linha;
  const fromCat = grupoProdutoDoCatalogo(linha.cod_componente);
  if (!fromCat) return linha;
  return { ...linha, grupo_produto: fromCat };
}
