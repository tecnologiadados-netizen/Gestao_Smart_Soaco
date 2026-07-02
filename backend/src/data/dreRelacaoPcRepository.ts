/**
 * Relação PC DRE — estrutura de saídas, catálogos Nomus/Shop9 e relações efetivas.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getNomusPool, isNomusEnabled } from '../config/nomusDb.js';
import { getShop9Pool, isShop9Enabled } from '../config/shop9Db.js';
import {
  invalidarMapasDrePlanoContas,
  listarContasSaidasDre,
  mapaIdsContaPorPathKeyDreBase,
  resolverPathKeyDreSaidasBase,
  type DreContaSaida,
} from './drePlanoContasMap.js';
import {
  patchDreRelacaoPcPathKey,
  salvarDreRelacaoPcOverrides,
  lerDreRelacaoPcOverrides,
  type DreRelacaoPcOverrides,
} from './dreRelacaoPcOverrides.js';

export type DreRelacaoPcPlanoNomus = { id: number; nome: string };
export type DreRelacaoPcPlanoShop9 = { ordem: number; nome: string };

export type DreRelacaoPcVinculoNomus = {
  id: number;
  nome: string;
  origem: 'automatico' | 'manual';
};

export type DreRelacaoPcVinculoShop9 = {
  ordem: number;
  nome: string;
  origem: 'automatico' | 'manual';
};

export type DreRelacaoPcConta = DreContaSaida & {
  nomus: DreRelacaoPcVinculoNomus[];
  shop9: DreRelacaoPcVinculoShop9[];
  nomusIdsAdicionais: number[];
  nomusIdsExcluidos: number[];
  shop9OrdensAdicionais: number[];
  shop9OrdensExcluidos: number[];
};

export type DreRelacaoPcPayload = {
  contas: DreRelacaoPcConta[];
  catalogoNomus: DreRelacaoPcPlanoNomus[];
  catalogoShop9: DreRelacaoPcPlanoShop9[];
  overrides: DreRelacaoPcOverrides;
  fonteNomus: 'live' | 'json';
  fonteShop9: 'live' | 'indisponivel';
  erroNomus?: string;
  erroShop9?: string;
};

function caminhosArquivo(rel: string): string[] {
  return [
    join(process.cwd(), rel),
    join(process.cwd(), '..', rel),
    join(process.cwd(), 'dist', '..', rel),
  ];
}

function lerJson<T>(rel: string): T | null {
  for (const p of caminhosArquivo(rel)) {
    if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf-8')) as T;
  }
  return null;
}

function carregarPlanosNomusJson(): DreRelacaoPcPlanoNomus[] {
  const raw = lerJson<{ id: number; nome: string }[]>('frontend/src/pages/financeiro/dfc/planoContasAtivoDfc.json');
  if (!raw) return [];
  return raw
    .filter((p) => p.id > 0 && p.nome?.trim())
    .map((p) => ({ id: p.id, nome: p.nome.trim() }))
    .sort((a, b) => a.id - b.id);
}

export async function carregarCatalogoNomus(): Promise<{
  planos: DreRelacaoPcPlanoNomus[];
  fonte: 'live' | 'json';
  erro?: string;
}> {
  if (isNomusEnabled()) {
    const pool = getNomusPool();
    if (pool) {
      try {
        const [rows] = await pool.query(
          'SELECT c.id, c.nome FROM contafinanceiro c WHERE c.ativo = 1 ORDER BY c.id',
        );
        const list = (rows as { id: unknown; nome: unknown }[])
          .map((r) => ({
            id: Math.trunc(Number(r.id)),
            nome: String(r.nome ?? '').trim(),
          }))
          .filter((p) => p.id > 0 && p.nome);
        if (list.length) return { planos: list, fonte: 'live' };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { planos: carregarPlanosNomusJson(), fonte: 'json', erro: msg };
      }
    }
  }
  return { planos: carregarPlanosNomusJson(), fonte: 'json' };
}

export async function carregarCatalogoShop9(): Promise<{
  planos: DreRelacaoPcPlanoShop9[];
  fonte: 'live' | 'indisponivel';
  erro?: string;
}> {
  if (!isShop9Enabled()) {
    return { planos: [], fonte: 'indisponivel', erro: 'Shop9: SHOP9_DB_* não configurado' };
  }
  const pool = await getShop9Pool();
  if (!pool) {
    return { planos: [], fonte: 'indisponivel', erro: 'Shop9: falha ao conectar' };
  }
  try {
    const result = await pool.query(
      'SELECT pc.Ordem, pc.Nome FROM Plano_Contas3 pc WHERE pc.Inativo = 0 ORDER BY pc.Ordem',
    );
    const list = (Array.isArray(result.recordset) ? result.recordset : [])
      .map((r: Record<string, unknown>) => ({
        ordem: Math.trunc(Number(r.Ordem ?? r.ordem)),
        nome: String(r.Nome ?? r.nome ?? '').trim(),
      }))
      .filter((p) => p.ordem > 0 && p.nome);
    return { planos: list, fonte: 'live' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { planos: [], fonte: 'indisponivel', erro: msg };
  }
}

function mapaNomusNomes(plans: DreRelacaoPcPlanoNomus[]): Map<number, string> {
  return new Map(plans.map((p) => [p.id, p.nome]));
}

function mapaShop9Nomes(plans: DreRelacaoPcPlanoShop9[]): Map<number, string> {
  return new Map(plans.map((p) => [p.ordem, p.nome]));
}

function mapaShop9Automatico(catalogo: DreRelacaoPcPlanoShop9[], overrides: DreRelacaoPcOverrides): Map<string, number[]> {
  const manualOrdens = new Set<number>();
  for (const ordens of Object.values(overrides.shop9OrdensAdicionais)) {
    for (const o of ordens) manualOrdens.add(o);
  }
  const out = new Map<string, number[]>();
  for (const p of catalogo) {
    if (manualOrdens.has(p.ordem)) continue;
    const pk = resolverPathKeyDreSaidasBase(p.ordem, p.nome);
    if (!pk) continue;
    const excl = overrides.shop9OrdensExcluidos[pk];
    if (excl?.includes(p.ordem)) continue;
    const cur = out.get(pk) ?? [];
    cur.push(p.ordem);
    out.set(pk, cur);
  }
  for (const cur of out.values()) cur.sort((a, b) => a - b);
  return out;
}

function ordensShop9EfetivasPorPathKey(
  pathKey: string,
  shop9Auto: Map<string, number[]>,
  overrides: DreRelacaoPcOverrides,
): number[] {
  const pk = pathKey.trim();
  if (!pk) return [];
  const excl = new Set(overrides.shop9OrdensExcluidos[pk] ?? []);
  const ordens = [...(shop9Auto.get(pk) ?? []), ...(overrides.shop9OrdensAdicionais[pk] ?? [])].filter(
    (o) => o > 0 && !excl.has(o),
  );
  return [...new Set(ordens)].sort((a, b) => a - b);
}

/** Catálogo Shop9 por pathKey DRE (automático + manual, sem recorte de filtro da grade). */
export async function mapaShop9OrdensCatalogoPorPathKeyDre(): Promise<Record<string, number[]>> {
  const overrides = lerDreRelacaoPcOverrides();
  const shop9Res = await carregarCatalogoShop9();
  const shop9Auto = mapaShop9Automatico(shop9Res.planos, overrides);
  const out: Record<string, number[]> = {};
  for (const conta of listarContasSaidasDre()) {
    const ordens = ordensShop9EfetivasPorPathKey(conta.pathKey, shop9Auto, overrides);
    if (ordens.length > 0) out[conta.pathKey] = ordens;
  }
  return out;
}

/** Ordens Shop9 (Plano_Contas3) vinculadas a um pathKey DRE (automático + manual). */
export async function listarOrdensShop9PorPathKeyDre(pathKey: string): Promise<number[]> {
  const pk = pathKey.trim();
  if (!pk) return [];
  const overrides = lerDreRelacaoPcOverrides();
  const shop9Res = await carregarCatalogoShop9();
  const shop9Auto = mapaShop9Automatico(shop9Res.planos, overrides);
  return ordensShop9EfetivasPorPathKey(pk, shop9Auto, overrides);
}

function montarContasRelacao(
  contas: DreContaSaida[],
  overrides: DreRelacaoPcOverrides,
  nomusBase: Record<string, number[]>,
  shop9Auto: Map<string, number[]>,
  nomusNomes: Map<number, string>,
  shop9Nomes: Map<number, string>,
): DreRelacaoPcConta[] {
  const manualShop9PorPk = overrides.shop9OrdensAdicionais;
  const exclShop9PorPk = overrides.shop9OrdensExcluidos;

  return contas.map((conta) => {
    const pk = conta.pathKey;

    const nomus: DreRelacaoPcVinculoNomus[] = (nomusBase[pk] ?? []).map((id) => ({
      id,
      nome: nomusNomes.get(id) ?? `(id ${id})`,
      origem: 'automatico' as const,
    }));
    nomus.sort((a, b) => a.id - b.id);

    const ordensAuto = shop9Auto.get(pk) ?? [];
    const ordensManual = manualShop9PorPk[pk] ?? [];
    const shop9: DreRelacaoPcVinculoShop9[] = [];
    const ordensVistas = new Set<number>();

    for (const ordem of ordensAuto) {
      ordensVistas.add(ordem);
      shop9.push({
        ordem,
        nome: shop9Nomes.get(ordem) ?? `(ordem ${ordem})`,
        origem: 'automatico',
      });
    }
    for (const ordem of ordensManual) {
      if (ordensVistas.has(ordem)) continue;
      ordensVistas.add(ordem);
      shop9.push({
        ordem,
        nome: shop9Nomes.get(ordem) ?? `(ordem ${ordem})`,
        origem: 'manual',
      });
    }
    shop9.sort((a, b) => a.ordem - b.ordem);

    return {
      ...conta,
      nomus,
      shop9,
      nomusIdsAdicionais: [],
      nomusIdsExcluidos: [],
      shop9OrdensAdicionais: [...ordensManual],
      shop9OrdensExcluidos: [...(exclShop9PorPk[pk] ?? [])],
    };
  });
}

export async function carregarRelacaoPc(): Promise<DreRelacaoPcPayload> {
  const overrides = lerDreRelacaoPcOverrides();
  const [nomusRes, shop9Res] = await Promise.all([carregarCatalogoNomus(), carregarCatalogoShop9()]);

  const contas = listarContasSaidasDre();
  const nomusBase = mapaIdsContaPorPathKeyDreBase();
  const shop9Auto = mapaShop9Automatico(shop9Res.planos, overrides);
  const nomusNomes = mapaNomusNomes(nomusRes.planos);
  const shop9Nomes = mapaShop9Nomes(shop9Res.planos);

  return {
    contas: montarContasRelacao(contas, overrides, nomusBase, shop9Auto, nomusNomes, shop9Nomes),
    catalogoNomus: nomusRes.planos,
    catalogoShop9: shop9Res.planos,
    overrides,
    fonteNomus: nomusRes.fonte,
    fonteShop9: shop9Res.fonte,
    erroNomus: nomusRes.erro,
    erroShop9: shop9Res.erro,
  };
}

export function salvarRelacaoPcPathKey(body: {
  pathKey: string;
  nomusIdsAdicionais?: number[];
  nomusIdsExcluidos?: number[];
  shop9OrdensAdicionais?: number[];
  shop9OrdensExcluidos?: number[];
}): DreRelacaoPcOverrides {
  const overrides = patchDreRelacaoPcPathKey(body.pathKey, {
    nomusIdsAdicionais: body.nomusIdsAdicionais,
    nomusIdsExcluidos: body.nomusIdsExcluidos,
    shop9OrdensAdicionais: body.shop9OrdensAdicionais,
    shop9OrdensExcluidos: body.shop9OrdensExcluidos,
  });
  invalidarMapasDrePlanoContas();
  return overrides;
}

export function resetarRelacaoPcOverrides(): void {
  salvarDreRelacaoPcOverrides({
    nomusIdsAdicionais: {},
    nomusIdsExcluidos: {},
    shop9OrdensAdicionais: {},
    shop9OrdensExcluidos: {},
  });
  invalidarMapasDrePlanoContas();
}
