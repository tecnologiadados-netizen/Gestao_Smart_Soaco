import type { LinhaProgramacaoProducao } from '../components/programacao-producao/types';
import { textoResumoOpsNomus } from './programacaoProducaoOpsNomus';
import {
  calcQtdeMpKg,
  formatNum,
  somaEstoqueProcesso,
  somaEstoqueTotal,
  somaQtdeProduzir,
} from '../components/programacao-producao/programacaoProducaoCalculos';

export const PP_COL_DEFS = [
  { key: 'cod_componente', label: 'Código' },
  { key: 'descricao_componente', label: 'Descrição' },
  { key: 'descricao_simplificada', label: 'Desc Simpl' },
  { key: 'peso_unitario_bobina', label: 'Peso Unit' },
  { key: 'estoque', label: 'Estoque' },
  { key: 'empenho_componente', label: 'Empenho' },
  { key: 'venda_media_componente', label: 'VM' },
  { key: 'cod_bobina', label: 'Cód MP' },
  { key: 'descricao_bobina', label: 'Descrição MP' },
  { key: 'estoque_atual_bobina', label: 'Estoque MP' },
  { key: 'estoque_mp_alternativa', label: 'Estoque MP Alter' },
  { key: 'cod_bobina_alternativa', label: 'Cód MP Alter' },
  { key: 'descricao_bobina_alternativa', label: 'Descrição Mp Alter' },
  { key: 'saldo_projetado', label: 'Saldo Projetado' },
  { key: 'kg_bobina_necessario', label: 'Qtde MP Faltante' },
  { key: 'cobertura_meses', label: 'Cobertura' },
  { key: 'sequencia', label: 'Sequência' },
  { key: 'qtde_produzir', label: 'Qtde Produzir' },
  { key: 'qtde_mp', label: 'Qtde MP' },
  { key: 'ordem_producao_nomus', label: 'OP Nomus' },
] as const;

export type PpColKey = (typeof PP_COL_DEFS)[number]['key'];

const NUMERIC_COLS = new Set<PpColKey>([
  'peso_unitario_bobina',
  'estoque',
  'empenho_componente',
  'venda_media_componente',
  'estoque_atual_bobina',
  'estoque_mp_alternativa',
  'kg_bobina_necessario',
  'saldo_projetado',
  'cobertura_meses',
  'sequencia',
  'qtde_produzir',
  'qtde_mp',
]);

export function isPpColNumeric(key: string): boolean {
  return NUMERIC_COLS.has(key as PpColKey);
}

/** Células de texto com quebra de linha (como Descrição MP). */
export function ppColUsesTextWrap(key: string): boolean {
  return !isPpColNumeric(key as PpColKey);
}

export const PP_CELL_WRAP_CLASS =
  'block w-full min-w-0 whitespace-normal break-words leading-snug hyphens-auto';

export const PP_TH_LABEL_CLASS =
  'min-w-0 flex-1 whitespace-normal break-words leading-tight text-[11px] sm:text-xs cursor-default';

export function getPpOrderLabels(colId: string): { asc: string; desc: string } {
  if (isPpColNumeric(colId)) {
    return { asc: 'Menor para maior', desc: 'Maior para menor' };
  }
  return { asc: 'A↧ Classificar de A a Z', desc: 'Z↧ Classificar de Z a A' };
}

export function getPpCellText(linha: LinhaProgramacaoProducao, colId: string): string {
  switch (colId as PpColKey) {
    case 'cod_componente':
      return linha.cod_componente ?? '';
    case 'descricao_componente':
      return linha.descricao_componente ?? '';
    case 'descricao_simplificada':
      return linha.descricao_simplificada?.trim() || '—';
    case 'grupo_produto':
      return linha.grupo_produto?.trim() || '—';
    case 'peso_unitario_bobina':
      return formatNum(linha.peso_unitario_bobina);
    case 'estoque':
      return formatNum(somaEstoqueTotal(linha));
    case 'empenho_componente':
      return formatNum(linha.empenho_componente);
    case 'venda_media_componente':
      return formatNum(linha.venda_media_componente);
    case 'cod_bobina':
      return linha.cod_bobina ?? '—';
    case 'descricao_bobina':
      return linha.descricao_bobina ?? '—';
    case 'estoque_atual_bobina':
      return formatNum(linha.estoque_atual_bobina);
    case 'estoque_mp_alternativa':
      return formatNum(linha.estoque_mp_alternativa);
    case 'cod_bobina_alternativa':
      return linha.cod_bobina_alternativa?.trim() || '—';
    case 'descricao_bobina_alternativa':
      return linha.descricao_bobina_alternativa?.trim() || '—';
    case 'kg_bobina_necessario':
      return formatNum(linha.kg_bobina_necessario);
    case 'saldo_projetado':
      return formatNum(linha.saldo_projetado);
    case 'cobertura_meses':
      return formatNum(linha.cobertura_meses);
    case 'sequencia': {
      const n = linha.sequencia;
      return n != null && n > 0 ? formatNum(n, 0) : '—';
    }
    case 'qtde_produzir':
      return formatNum(somaQtdeProduzir(linha.qtde_produzir));
    case 'qtde_mp':
      return formatNum(calcQtdeMpKg(linha));
    case 'ordem_producao_nomus':
      return textoResumoOpsNomus(linha);
    default:
      return '—';
  }
}

export function getPpSortValue(linha: LinhaProgramacaoProducao, colId: string): string | number {
  switch (colId as PpColKey) {
    case 'peso_unitario_bobina':
      return linha.peso_unitario_bobina ?? -Infinity;
    case 'estoque':
      return somaEstoqueTotal(linha);
    case 'empenho_componente':
      return linha.empenho_componente;
    case 'venda_media_componente':
      return linha.venda_media_componente;
    case 'estoque_atual_bobina':
      return linha.estoque_atual_bobina ?? -Infinity;
    case 'estoque_mp_alternativa':
      return linha.estoque_mp_alternativa ?? -Infinity;
    case 'kg_bobina_necessario':
      return linha.kg_bobina_necessario ?? -Infinity;
    case 'saldo_projetado':
      return linha.saldo_projetado ?? -Infinity;
    case 'cobertura_meses':
      return linha.cobertura_meses ?? -Infinity;
    case 'sequencia':
      return linha.sequencia != null && linha.sequencia > 0 ? linha.sequencia : NaN;
    case 'qtde_produzir':
      return somaQtdeProduzir(linha.qtde_produzir);
    case 'qtde_mp':
      return calcQtdeMpKg(linha);
    default:
      return getPpCellText(linha, colId);
  }
}

export const PP_SORT_DEFAULT = [{ id: 'cod_componente', dir: 'asc' as const }];

export const PP_STORAGE_COL_OCULTAS = 'programacaoProducao.colunasOcultas.v3';

export function loadPpColunasOcultas(): string[] {
  try {
    const s = sessionStorage.getItem(PP_STORAGE_COL_OCULTAS);
    if (!s) return [];
    const p = JSON.parse(s) as unknown;
    return Array.isArray(p) ? p.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function gruposProdutoUnicos(linhas: LinhaProgramacaoProducao[]): string[] {
  const set = new Set<string>();
  for (const l of linhas) {
    const g = l.grupo_produto?.trim();
    if (g) set.add(g);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
