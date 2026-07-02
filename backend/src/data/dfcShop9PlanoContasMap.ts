/**
 * Mapeia plano de contas Shop9 → idContaFinanceiro da árvore DFC.
 * Shop9: exclusivamente por nome (Plano_Contas3.Nome ↔ estruturaDfcArvore).
 * Nomus: planoContasAtivoDfc.json (nome + id Nomus).
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

type PlanoAtivo = { id: number; nome: string; classificacao?: string };

type ArvoreDfcNode = {
  id?: number;
  nome?: string;
  tipo?: string;
  children?: ArvoreDfcNode[];
};

/** idContaFinanceiro — «Receitas de Vendas de Produto» (1.1.1). */
export const DFC_ID_RECEITA_VENDAS_PRODUTO = 2;

/**
 * Planos Shop9 (Codigo) — o SQL já renomeia planoContas para «Receitas de Vendas de Produto».
 * Mantido para testes/scripts que filtram por código bruto.
 */
export const SHOP9_CODIGOS_RECEITA_VENDAS_PRODUTO = new Set([
  10000, 10001, 10002, 10003, 10004, 10005, 10006, 10007, 10010, 10011, 10012,
]);

export function shop9CodigoEhReceitaVendasProduto(idPlanoContas: unknown): boolean {
  const cod = Number(idPlanoContas);
  return Number.isFinite(cod) && SHOP9_CODIGOS_RECEITA_VENDAS_PRODUTO.has(Math.trunc(cod));
}

/** Nomes Shop9 que devem casar com conta analítica da árvore DFC. */
const ALIASES_PLANO_SHOP9_PARA_ARVORE: Record<string, string> = {
  'devolucao de pagamento': 'Devolução de Pagamento',
  'devolucao de pagamentos': 'Devolução de Pagamento',
};

function normalizarNome(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Mapa nome → id para contas analíticas (tipo A) da árvore DFC. */
let mapShop9NomeArvore: Map<string, number> | null = null;

/** Mapa Nomus (agendamentos / LP) — planoContasAtivoDfc.json. */
let mapNomusByNome: Map<string, number> | null = null;
let mapNomusByCodigo: Map<number, number> | null = null;

function caminhosArquivo(rel: string): string[] {
  return [
    join(process.cwd(), rel),
    join(process.cwd(), '..', rel),
    join(process.cwd(), 'dist', '..', rel),
  ];
}

function lerJsonSeExistir<T>(rel: string): T | null {
  for (const p of caminhosArquivo(rel)) {
    if (existsSync(p)) {
      return JSON.parse(readFileSync(p, 'utf-8')) as T;
    }
  }
  return null;
}

function carregarPlanosNomus(): PlanoAtivo[] {
  return lerJsonSeExistir<PlanoAtivo[]>('frontend/src/pages/financeiro/dfc/planoContasAtivoDfc.json') ?? [];
}

function carregarArvoreDfc(): ArvoreDfcNode[] {
  const raw = lerJsonSeExistir<ArvoreDfcNode[] | { roots?: ArvoreDfcNode[] }>(
    'frontend/src/pages/financeiro/dfc/estruturaDfcArvore.json',
  );
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return Array.isArray(raw.roots) ? raw.roots : [];
}

function buildMapNomeArvoreDfc(): Map<string, number> {
  const byNome = new Map<string, number>();
  function walk(nodes: ArvoreDfcNode[]): void {
    for (const n of nodes) {
      const id = Number(n.id);
      const nome = String(n.nome ?? '').trim();
      if (n.tipo === 'A' && Number.isFinite(id) && id > 0 && nome) {
        byNome.set(normalizarNome(nome), Math.trunc(id));
      }
      if (n.children?.length) walk(n.children);
    }
  }
  walk(carregarArvoreDfc());
  return byNome;
}

function buildMapsNomus(): { byNome: Map<string, number>; byCodigo: Map<number, number> } {
  const planos = carregarPlanosNomus();
  const byNome = new Map<string, number>();
  const byCodigo = new Map<number, number>();
  for (const p of planos) {
    if (p.id > 0 && p.nome) {
      byNome.set(normalizarNome(p.nome), p.id);
    }
  }
  for (const p of planos) {
    if (p.id > 0) byCodigo.set(p.id, p.id);
  }
  return { byNome, byCodigo };
}

function ensureMapShop9Arvore(): void {
  if (mapShop9NomeArvore) return;
  mapShop9NomeArvore = buildMapNomeArvoreDfc();
}

function ensureMapsNomus(): void {
  if (mapNomusByNome && mapNomusByCodigo) return;
  const { byNome, byCodigo } = buildMapsNomus();
  mapNomusByNome = byNome;
  mapNomusByCodigo = byCodigo;
}

/** Nomus — nome no plano ativo e, se não achar, id Nomus (contafinanceiro). */
export function resolverIdContaFinanceiroDfc(idPlanoContas: unknown, planoContas: unknown): number | null {
  ensureMapsNomus();
  const nome = String(planoContas ?? '').trim();
  if (nome) {
    const hitNome = mapNomusByNome!.get(normalizarNome(nome));
    if (hitNome != null) return hitNome;
  }
  const cod = Number(idPlanoContas);
  if (Number.isFinite(cod) && cod > 0) {
    const hit = mapNomusByCodigo!.get(Math.trunc(cod));
    if (hit != null) return hit;
  }
  return null;
}

/**
 * Shop9 — somente `planoContas` (Nome do Plano_Contas3, ou alias do SQL) × árvore DFC.
 * Não usa Codigo Shop9 nem id Nomus.
 */
export function resolverIdContaFinanceiroShop9(
  _tipoConta: string,
  _idPlanoContas: unknown,
  planoContas: unknown,
): number | null {
  ensureMapShop9Arvore();
  const nome = String(planoContas ?? '').trim();
  if (!nome) return null;
  const key = normalizarNome(nome);
  const canonico = ALIASES_PLANO_SHOP9_PARA_ARVORE[key] ?? nome;
  return mapShop9NomeArvore!.get(normalizarNome(canonico)) ?? null;
}

/** Invalida cache de mapas (útil em testes). */
export function invalidarMapasPlanoContasDfc(): void {
  mapShop9NomeArvore = null;
  mapNomusByNome = null;
  mapNomusByCodigo = null;
}
