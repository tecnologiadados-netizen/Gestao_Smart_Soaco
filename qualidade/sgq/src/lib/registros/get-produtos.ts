import catalogoJson from "@/lib/mock-data/produtos-catalogo-rnc.json";
import {
  PRODUTOS_INITIAL_LIMIT,
  PRODUTOS_SEARCH_LIMIT,
} from "@/lib/registros/produtos-constants";
import {
  fetchProdutosFromSql,
  getProdutosSqlConfig,
  type GetProdutosOptions,
} from "@/lib/registros/produtos-sql";
import type { ProdutoErp } from "@/types/produto-erp";

const catalogoMock = catalogoJson as ProdutoErp[];

export type { GetProdutosOptions };

function normalizarCodigo(codigo: string): string {
  return codigo.trim().toUpperCase().replace(/\s+/g, " ");
}

function filtrarCatalogoMock(options: GetProdutosOptions): ProdutoErp[] {
  const limit = Math.min(
    options.limit ?? PRODUTOS_INITIAL_LIMIT,
    PRODUTOS_SEARCH_LIMIT
  );

  if (options.codigo?.trim()) {
    const codigo = normalizarCodigo(options.codigo);
    const exato = catalogoMock.find(
      (p) => normalizarCodigo(p.codigo) === codigo
    );
    return exato ? [exato] : [];
  }

  const q = options.q?.trim().toLowerCase() ?? "";
  if (!q) {
    return catalogoMock.slice(0, limit);
  }

  return catalogoMock
    .filter((p) => {
      const codigo = p.codigo.toLowerCase();
      const descricao = p.descricao.toLowerCase();
      const grupo = p.grupoProduto.toLowerCase();
      return codigo.includes(q) || descricao.includes(q) || grupo.includes(q);
    })
    .slice(0, limit);
}

/**
 * Busca produtos no ERP Nomus (dw_saldoestoque + setorestoque).
 * Regras: produto ativo, setor ativo, empresa configurada e setor com saldo disponível.
 */
export async function getProdutos(
  options: GetProdutosOptions = {}
): Promise<ProdutoErp[]> {
  const sqlConfig = getProdutosSqlConfig();

  if (!sqlConfig) {
    return filtrarCatalogoMock(options);
  }

  try {
    return await fetchProdutosFromSql(sqlConfig, options);
  } catch {
    return filtrarCatalogoMock(options);
  }
}

export async function getProdutoPorCodigo(
  codigo: string
): Promise<ProdutoErp | null> {
  const lista = await getProdutos({ codigo, limit: 1 });
  return lista[0] ?? null;
}

export function getCatalogoSource(): "mock" | "erp" {
  return getProdutosSqlConfig() ? "erp" : "mock";
}
