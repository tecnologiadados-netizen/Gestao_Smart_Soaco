/**
 * Componentes Recurso 1000 (Perfiladeira 124) para o Calendário de produção.
 * Independente do semáforo de almox secundário.
 */

import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import type { Pool } from 'mysql2/promise';
import { prisma } from '../config/prisma.js';
import { nomusQueryWithRetry } from '../config/nomusDb.js';
import { loadProgramacaoProducaoCatalogo } from '../data/programacaoProducaoCatalogRepository.js';
import { obterMetodosRessuprimentoPorIds } from './calendarioMetodoRessuprimentoService.js';
import { METODO_RESSUPRIMENTO_VAZIO } from '../utils/metodoRessuprimentoProduto.js';
import { normalizarDataIsoCalendario } from '../utils/disponibilidadeMateriaisCalendarioDerivados.js';
import {
  agregarCelulasRecurso1000,
  agregarComponentesDiaRecurso1000,
  agregarConsumoRecurso1000,
  alocarFaltaRecurso1000,
  projetarSaldoRecurso1000,
  statusCelulasRecurso1000,
  type BomPaRecurso1000,
  type DemandaCalendarioRecurso1000,
} from '../utils/calendarioRecurso1000Agregar.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IDS_CHUNK = 150;
const PA_CHUNK = 40;
const ESTOQUE_PROCESSO_VAZIO = {
  perfiladeira: 0,
  corteDobra: 0,
  solda: 0,
  pintura: 0,
  montagem: 0,
};

export type DemandaCalendarioLinha = {
  codigoPa: string;
  qtde: number;
  dataIso: string;
  pd?: string;
  setor?: string;
  carrada?: string;
};

export type EstoqueEmProcessoCalendario = {
  perfiladeira: number;
  corteDobra: number;
  solda: number;
  pintura: number;
  montagem: number;
};

export type ProgramacaoFonteCalendario = {
  id: string;
  name: string;
  updatedAt: string;
};

export type EstoqueRecurso1000Calendario = {
  estoquePaNomus: number;
  estoqueEmProcesso: EstoqueEmProcessoCalendario;
  estoqueProducao: number;
  /** Snapshot da programação (PA + processo), antes do consumo do calendário. */
  estoqueTotal: number;
  /** Saldo disponível no início deste dia, após consumo dos dias anteriores. */
  estoqueInicioDia: number;
  consumidoAntes: number;
};

let sqlCache: string | null = null;

function resolveSqlPath(): string {
  const candidates = [
    join(__dirname, '..', 'data', 'calendarioRecurso1000Explosao.sql'),
    join(process.cwd(), 'src', 'data', 'calendarioRecurso1000Explosao.sql'),
    join(process.cwd(), 'dist', 'data', 'calendarioRecurso1000Explosao.sql'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error('calendarioRecurso1000Explosao.sql não encontrado.');
}

function getExplosaoSql(ids: number[]): string {
  if (!sqlCache) sqlCache = readFileSync(resolveSqlPath(), 'utf-8').trim();
  const idsSql = ids.map((id) => String(Math.floor(id))).join(', ');
  return sqlCache.replace(/__IDS__/g, idsSql);
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normCod(s: string): string {
  return String(s ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

function normCodKey(s: string): string {
  return normCod(s).toUpperCase();
}

function somaProcesso(e: EstoqueEmProcessoCalendario): number {
  return e.perfiladeira + e.corteDobra + e.solda + e.pintura + e.montagem;
}

function parseProcesso(raw: unknown): EstoqueEmProcessoCalendario {
  if (!raw || typeof raw !== 'object') return { ...ESTOQUE_PROCESSO_VAZIO };
  const o = raw as Record<string, unknown>;
  return {
    perfiladeira: Math.max(0, num(o.perfiladeira)),
    corteDobra: Math.max(0, num(o.corteDobra)),
    solda: Math.max(0, num(o.solda)),
    pintura: Math.max(0, num(o.pintura)),
    montagem: Math.max(0, num(o.montagem)),
  };
}

export function normalizarDemandaRecurso1000(raw: DemandaCalendarioLinha[]): DemandaCalendarioRecurso1000[] {
  const out: DemandaCalendarioRecurso1000[] = [];
  for (const r of raw) {
    const codigoPa = String(r.codigoPa ?? '').trim();
    const dataIso = normalizarDataIsoCalendario(r.dataIso);
    const qtde = num(r.qtde);
    if (!codigoPa || !dataIso || qtde <= 0) continue;
    out.push({
      codigoPa,
      dataIso,
      qtde,
      setor: String(r.setor ?? '').trim(),
      pd: String(r.pd ?? '').trim(),
      carrada: String(r.carrada ?? '').trim(),
    });
  }
  return out;
}

async function resolverIdsPorCodigoPa(pool: Pool, codigos: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const uniq = [...new Set(codigos.map(normCod).filter(Boolean))];
  if (uniq.length === 0) return map;
  for (let i = 0; i < uniq.length; i += IDS_CHUNK) {
    const chunk = uniq.slice(i, i + IDS_CHUNK);
    const placeholders = chunk.map(() => '?').join(', ');
    const sql = `
    SELECT id, nome
    FROM produto
    WHERE nome COLLATE utf8mb4_general_ci IN (${placeholders})
      AND ativo = 1
  `;
    const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, sql, chunk);
    for (const r of Array.isArray(rows) ? rows : []) {
      const nome = String(r.nome ?? '').trim();
      const id = Number(r.id);
      if (nome && Number.isFinite(id) && id > 0 && !map.has(normCodKey(nome))) {
        map.set(normCodKey(nome), id);
      }
    }
  }
  return map;
}

async function carregarBomRecurso1000(pool: Pool, idPas: number[]): Promise<BomPaRecurso1000[]> {
  if (idPas.length === 0) return [];
  const out: BomPaRecurso1000[] = [];
  const visto = new Set<string>();
  for (let i = 0; i < idPas.length; i += PA_CHUNK) {
    const chunk = idPas.slice(i, i + PA_CHUNK);
    const sql = getExplosaoSql(chunk);
    const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, sql, []);
    for (const r of Array.isArray(rows) ? rows : []) {
      const codigoPa = String(r.codigo_pa ?? '').trim();
      const idComponente = num(r.id_componente);
      const qtdePorPa = num(r.qtde_por_pa);
      if (!codigoPa || !(idComponente > 0) || !(qtdePorPa > 0)) continue;
      const key = `${normCodKey(codigoPa)}\0${idComponente}`;
      if (visto.has(key)) continue;
      visto.add(key);
      out.push({
        codigoPa,
        idComponente,
        codigoComponente: String(r.cod_componente ?? '').trim(),
        descricaoComponente: String(r.descricao_componente ?? '').trim(),
        qtdePorPa,
      });
    }
  }
  return out;
}

type LinhaEstoqueProg = {
  descSimp: string | null;
  estoquePaNomus: number;
  estoqueEmProcesso: EstoqueEmProcessoCalendario;
};

async function loadUltimaProgramacaoEstoque(): Promise<{
  fonte: ProgramacaoFonteCalendario | null;
  porCodigo: Map<string, LinhaEstoqueProg>;
}> {
  const row = await prisma.programacaoProducaoRegistro.findFirst({
    orderBy: { updatedAt: 'desc' },
    select: { uid: true, name: true, updatedAt: true, dadosJson: true },
  });
  if (!row) return { fonte: null, porCodigo: new Map() };
  const fonte: ProgramacaoFonteCalendario = {
    id: row.uid,
    name: row.name,
    updatedAt: row.updatedAt.toISOString(),
  };
  const porCodigo = new Map<string, LinhaEstoqueProg>();
  try {
    const dados = JSON.parse(row.dadosJson) as { linhas?: unknown };
    const linhas = Array.isArray(dados.linhas) ? dados.linhas : [];
    for (const raw of linhas) {
      if (!raw || typeof raw !== 'object') continue;
      const l = raw as Record<string, unknown>;
      const cod = normCod(String(l.cod_componente ?? ''));
      if (!cod) continue;
      const descSimp =
        typeof l.descricao_simplificada === 'string' && l.descricao_simplificada.trim()
          ? l.descricao_simplificada.trim()
          : null;
      porCodigo.set(normCodKey(cod), {
        descSimp,
        estoquePaNomus: num(l.estoque_atual_componente),
        estoqueEmProcesso: parseProcesso(l.estoque_em_processo),
      });
    }
  } catch {
    /* JSON inválido: segue só com catálogo */
  }
  return { fonte, porCodigo };
}

function descSimpCatalogo(cod: string, cat: Record<string, string>): string | null {
  const exact = cat[normCod(cod)];
  if (exact?.trim()) return exact.trim();
  const key = normCodKey(cod);
  if (cat[key]?.trim()) return cat[key].trim();
  for (const [k, v] of Object.entries(cat)) {
    if (normCodKey(k) === key && v?.trim()) return v.trim();
  }
  return null;
}

function montarEstoque(
  linha: LinhaEstoqueProg | undefined,
  proj?: { saldoInicio: number; consumidoAntes: number }
): EstoqueRecurso1000Calendario {
  const ep = linha?.estoqueEmProcesso ?? { ...ESTOQUE_PROCESSO_VAZIO };
  const pa = linha?.estoquePaNomus ?? 0;
  const prod = somaProcesso(ep);
  const total = pa + prod;
  return {
    estoquePaNomus: pa,
    estoqueEmProcesso: ep,
    estoqueProducao: prod,
    estoqueTotal: total,
    estoqueInicioDia: proj?.saldoInicio ?? total,
    consumidoAntes: proj?.consumidoAntes ?? 0,
  };
}

function codigoPorIdComponente(bom: BomPaRecurso1000[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const b of bom) {
    if (!map.has(b.idComponente)) map.set(b.idComponente, b.codigoComponente);
  }
  return map;
}

async function carregarBomDaDemanda(
  pool: Pool,
  demanda: DemandaCalendarioRecurso1000[]
): Promise<BomPaRecurso1000[]> {
  const codigos = [...new Set(demanda.map((d) => d.codigoPa))];
  const idsMap = await resolverIdsPorCodigoPa(pool, codigos);
  const idPas = [...new Set([...idsMap.values()])];
  return carregarBomRecurso1000(pool, idPas);
}

async function filtrarBomPorMetodo(
  pool: Pool,
  bom: BomPaRecurso1000[],
  metodos: string[]
): Promise<{ bom: BomPaRecurso1000[]; metodoPorId: Map<number, string> }> {
  const ids = [...new Set(bom.map((b) => b.idComponente))];
  const metodoPorId = await obterMetodosRessuprimentoPorIds(pool, ids);
  if (metodos.length === 0) return { bom, metodoPorId };
  const selecionados = new Set(metodos);
  return {
    bom: bom.filter((b) =>
      selecionados.has(metodoPorId.get(b.idComponente) ?? METODO_RESSUPRIMENTO_VAZIO)
    ),
    metodoPorId,
  };
}

export async function obterSinteticoRecurso1000(
  pool: Pool,
  demandaRaw: DemandaCalendarioLinha[],
  metodosRessup: string[] = []
): Promise<
  | {
      ok: true;
      data: {
        consultadoEm: string;
        celulas: { setor: string; data: string; status: 'ok' | 'falta' }[];
        datas: string[];
        programacao: ProgramacaoFonteCalendario | null;
      };
    }
  | { ok: false; error: string }
> {
  const demanda = normalizarDemandaRecurso1000(demandaRaw);
  if (demanda.length === 0) {
    return {
      ok: true,
      data: {
        consultadoEm: new Date().toISOString(),
        celulas: [],
        datas: [],
        programacao: null,
      },
    };
  }
  const [bomRaw, prog] = await Promise.all([
    carregarBomDaDemanda(pool, demanda),
    loadUltimaProgramacaoEstoque(),
  ]);
  const { bom } = await filtrarBomPorMetodo(pool, bomRaw, metodosRessup);
  const agg = agregarCelulasRecurso1000(bom, demanda);
  const consumo = agregarConsumoRecurso1000(bom, demanda);
  const saldoPorId = new Map<number, number>();
  const codigoPorId = codigoPorIdComponente(bom);
  for (const [id, cod] of codigoPorId) {
    saldoPorId.set(id, montarEstoque(prog.porCodigo.get(normCodKey(cod))).estoqueTotal);
  }
  const celulas = statusCelulasRecurso1000(consumo, saldoPorId, agg.celulas);
  return {
    ok: true,
    data: {
      consultadoEm: new Date().toISOString(),
      celulas,
      datas: agg.datas,
      programacao: prog.fonte,
    },
  };
}

export async function obterDiaRecurso1000(
  pool: Pool,
  demandaRaw: DemandaCalendarioLinha[],
  dataIsoRaw: string,
  setor?: string | null,
  metodosRessup: string[] = []
): Promise<
  | {
      ok: true;
      data: {
        consultadoEm: string;
        dataIso: string;
        setor: string | null;
        programacao: ProgramacaoFonteCalendario | null;
        componentes: {
          idComponente: number;
          codigo: string;
          descricao: string;
          descSimp: string | null;
          metodoRessuprimento: string;
          consumoDia: number;
          falta: number;
          origens: { dataIso: string; carrada: string; pd: string; qtdeComponente: number; setor: string }[];
          estoque: EstoqueRecurso1000Calendario;
        }[];
      };
    }
  | { ok: false; error: string }
> {
  const dataIso = normalizarDataIsoCalendario(dataIsoRaw);
  if (!dataIso) return { ok: false, error: 'Data inválida.' };
  const demanda = normalizarDemandaRecurso1000(demandaRaw);
  const [bomRaw, prog] = await Promise.all([
    carregarBomDaDemanda(pool, demanda),
    loadUltimaProgramacaoEstoque(),
  ]);
  const { bom, metodoPorId } = await filtrarBomPorMetodo(pool, bomRaw, metodosRessup);
  const catalogo = loadProgramacaoProducaoCatalogo().descricoes;
  const rows = agregarComponentesDiaRecurso1000(bom, demanda, dataIso, setor).filter((r) =>
    r.origens.some((o) => o.dataIso === dataIso)
  );
  const consumoAgg = agregarConsumoRecurso1000(bom, demanda);
  const componentes = rows.map((r) => {
    const key = normCodKey(r.codigo);
    const linha = prog.porCodigo.get(key);
    const descCat = descSimpCatalogo(r.codigo, catalogo);
    const descSimp = linha?.descSimp?.trim() || descCat;
    const snapshot = montarEstoque(linha);
    const cons = consumoAgg.porId.get(r.idComponente);
    const proj = projetarSaldoRecurso1000(
      cons?.consumoPorDia ?? new Map(),
      consumoAgg.datas,
      snapshot.estoqueTotal,
      dataIso
    );
    const estoque = montarEstoque(linha, proj);
    const consumoDia = r.qtde;
    const falta = alocarFaltaRecurso1000(
      proj.faltaAcum,
      consumoDia,
      proj.consumoAcumTotal
    );
    return {
      idComponente: r.idComponente,
      codigo: r.codigo,
      descricao: r.descricao,
      descSimp,
      metodoRessuprimento:
        metodoPorId.get(r.idComponente) ?? METODO_RESSUPRIMENTO_VAZIO,
      consumoDia,
      falta,
      origens: r.origens,
      estoque,
    };
  });
  return {
    ok: true,
    data: {
      consultadoEm: new Date().toISOString(),
      dataIso,
      setor: String(setor ?? '').trim() || null,
      programacao: prog.fonte,
      componentes,
    },
  };
}
