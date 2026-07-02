import catalogo from '../data/programacaoProducaoBobinasAlternativas.json';
import type {
  BobinaAlternativaItem,
  LinhaProgramacaoProducao,
} from '../components/programacao-producao/types';
import { normalizarCodComponente } from './programacaoProducaoDescricaoSimplificada';
import { getCatalogoBobinasRuntime } from './programacaoProducaoCatalogoRuntime';

export type BobinaAlternativaCatalogEntry = {
  codigo_mp?: string;
  alternativas: string[];
};

const MAP_BUNDLED = catalogo as Record<string, BobinaAlternativaCatalogEntry>;

/** Incrementar ao corrigir o catálogo para reaplicar alternativas em programações salvas. */
export const CATALOGO_BOBINAS_ALTERNATIVAS_V = 2;

function mapBobinasAtivo(): Record<string, BobinaAlternativaCatalogEntry> {
  return getCatalogoBobinasRuntime() ?? MAP_BUNDLED;
}

export function catalogoBobinaAlternativa(codComponente: string): BobinaAlternativaCatalogEntry | null {
  const key = normalizarCodComponente(codComponente);
  return mapBobinasAtivo()[key] ?? null;
}

export function bobinasAlternativasParaCatalogo(
  codComponente: string,
  itens: BobinaAlternativaItem[]
): BobinaAlternativaCatalogEntry {
  const base = catalogoBobinaAlternativa(codComponente);
  return {
    codigo_mp: base?.codigo_mp,
    alternativas: itens.map((b) => b.cod.trim()).filter(Boolean),
  };
}

export function itensFromCodigos(cods: string[]): BobinaAlternativaItem[] {
  return cods
    .map((c) => c?.trim())
    .filter((c): c is string => Boolean(c))
    .map((cod) => ({ cod, descricao: null, idProduto: null }));
}

export function bobinasAlternativasDoCatalogo(codComponente: string): BobinaAlternativaItem[] {
  const entry = catalogoBobinaAlternativa(codComponente);
  if (!entry?.alternativas?.length) return [];
  return itensFromCodigos(entry.alternativas);
}

/** Mantém cod/descricao da grade alinhados ao Alter 1 (primeiro da lista). */
export function syncBobinaAlternativaDisplay(linha: LinhaProgramacaoProducao): LinhaProgramacaoProducao {
  const first = linha.bobinas_alternativas?.[0];
  const cod = first?.cod?.trim() || null;
  const desc = first?.descricao?.trim() || null;
  if (linha.cod_bobina_alternativa === cod && linha.descricao_bobina_alternativa === desc) return linha;
  return {
    ...linha,
    cod_bobina_alternativa: cod,
    descricao_bobina_alternativa: desc,
  };
}

export function aplicarBobinasAlternativasCatalogo(
  linha: LinhaProgramacaoProducao
): LinhaProgramacaoProducao {
  if (linha.bobinas_alternativas?.length) return syncBobinaAlternativaDisplay(linha);
  const fromCat = bobinasAlternativasDoCatalogo(linha.cod_componente);
  if (!fromCat.length) return linha;
  return syncBobinaAlternativaDisplay({ ...linha, bobinas_alternativas: fromCat });
}

function codsAlternativas(linha: LinhaProgramacaoProducao): string {
  return (linha.bobinas_alternativas ?? []).map((b) => b.cod.trim()).join('|');
}

/** Converte dados antigos (só cod/desc na grade) para lista ordenada. */
export function normalizarBobinasAlternativasLinha(
  linha: LinhaProgramacaoProducao,
  opts?: { forceCatalog?: boolean }
): LinhaProgramacaoProducao {
  const fromCat = bobinasAlternativasDoCatalogo(linha.cod_componente);
  if (fromCat.length) {
    const catCods = fromCat.map((b) => b.cod).join('|');
    if (opts?.forceCatalog || !linha.bobinas_alternativas?.length || codsAlternativas(linha) !== catCods) {
      return syncBobinaAlternativaDisplay({ ...linha, bobinas_alternativas: fromCat });
    }
    return syncBobinaAlternativaDisplay(linha);
  }
  if (linha.bobinas_alternativas?.length) {
    return syncBobinaAlternativaDisplay(linha);
  }
  if (linha.cod_bobina_alternativa?.trim()) {
    return syncBobinaAlternativaDisplay({
      ...linha,
      bobinas_alternativas: [
        {
          cod: linha.cod_bobina_alternativa.trim(),
          descricao: linha.descricao_bobina_alternativa?.trim() || null,
          idProduto: null,
        },
      ],
    });
  }
  return linha;
}

export function aplicarBobinasAlternativasNasLinhas(
  linhas: LinhaProgramacaoProducao[],
  opts?: { forceCatalog?: boolean }
): LinhaProgramacaoProducao[] {
  return linhas.map((l) => normalizarBobinasAlternativasLinha(l, opts));
}

/** Normaliza código MP para comparação (espaços / maiúsculas). */
export function normalizarCodMp(cod: string): string {
  return cod.trim().replace(/\s+/g, ' ').toUpperCase();
}

/** Valida duplicatas entre alternativas e coincidência com bobina principal. */
export function validarBobinasAlternativasLinha(
  linha: LinhaProgramacaoProducao,
  itens?: BobinaAlternativaItem[]
): string | null {
  const principal = linha.cod_bobina?.trim();
  const principalNorm = principal ? normalizarCodMp(principal) : null;
  const list = itens ?? linha.bobinas_alternativas ?? [];
  const vistos = new Set<string>();

  for (const b of list) {
    const c = b.cod?.trim();
    if (!c) continue;
    const norm = normalizarCodMp(c);
    if (vistos.has(norm)) {
      return `Código alternativo ${c} repetido. Corrija as bobinas alternativas.`;
    }
    if (principalNorm && norm === principalNorm) {
      return `O código ${c} não pode ser igual à bobina principal (MP).`;
    }
    vistos.add(norm);
  }
  return null;
}

export function mesclarDescricoesBobinas(
  itens: BobinaAlternativaItem[],
  porCodigo: Map<string, { descricao: string | null; idProduto: number | null }>
): BobinaAlternativaItem[] {
  return itens.map((item) => {
    const key = item.cod.trim();
    const found = porCodigo.get(key);
    if (!found) return item;
    return {
      cod: key,
      descricao: found.descricao ?? item.descricao,
      idProduto: found.idProduto ?? item.idProduto,
    };
  });
}
