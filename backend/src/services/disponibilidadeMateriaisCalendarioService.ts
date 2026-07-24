/**
 * Disponibilidade de materiais para o Calendário de produção:
 * consumo = BOM (folha) × qtde líquida do calendário por data;
 * saldo inicial = somente almox secundário (setor 2);
 * entrada = PC pendente por dataEntrega (atrasado → hoje).
 */

import type { Pool } from 'mysql2/promise';
import { nomusQueryWithRetry } from '../config/nomusDb.js';
import { loadBomListaMateriaisAcabadoSql } from '../data/bomListaMateriaisSql.js';
import { RESSUP_NAO_ALMOX_ATTR_TIPO_MATERIAL } from '../data/ressupNaoAlmoxRepository.js';
import { mppDiaIsoDataPrevisao } from '../controllers/mppController.js';
import {
  arred2,
  normalizarDataIsoCalendario,
  primeiroIndiceRuptura,
  saldosENecessidadesDisponibilidade,
  statusCelulaMaterialDia,
  statusDiaAgregado,
  type StatusMaterialDia,
} from '../utils/disponibilidadeMateriaisCalendarioDerivados.js';

const SETOR_ALMOX_SECUNDARIO = 2;
/** Valor exato do atributo Nomus 540 (tipo de material) a excluir do escopo do calendário. */
const TIPO_MATERIAL_MATERIA_PRIMA = 'Matéria Prima';
const MAX_DIAS = 400;
const BOM_CHUNK = 40;
/** Chunk para IN (?) em saldo/PC/filtros — evita pacotes grandes e ECONNRESET. */
const IDS_CHUNK = 150;

export type DemandaCalendarioLinha = {
  codigoPa: string;
  qtde: number;
  dataIso: string;
  pd?: string;
  setor?: string;
};

export type StatusPorDataRow = {
  data: string;
  status: StatusMaterialDia;
  qtdeMateriaisFalta: number;
  qtdeMateriaisAtencao: number;
};

export type MaterialCriticoRow = {
  idProduto: number;
  codigo: string;
  descricao: string;
  primeiraDataFalta: string;
  faltaNaPrimeiraData: number;
};

export type MaterialDiaRow = {
  idProduto: number;
  codigo: string;
  descricao: string;
  necessidadeDia: number;
  saldoInicio: number;
  entradaDia: number;
  falta: number;
  status: StatusMaterialDia;
};

export type HorizonteDiaRow = {
  data: string;
  consumo: number;
  entrada: number;
  saldoInicio: number;
  faltaAcum: number;
  status: StatusMaterialDia;
};

export type OrigemConsumoRow = {
  dataIso: string;
  codigoPa: string;
  qtdePa: number;
  qtdeComponente: number;
  pd: string;
  setor: string;
};

export type DisponibilidadeSintetico = {
  consultadoEm: string;
  datas: string[];
  statusPorData: StatusPorDataRow[];
  materiaisCriticos: MaterialCriticoRow[];
  /** Quantos componentes de almox secundário entraram no horizonte. */
  qtdeMateriaisEscopo: number;
};

type ItemInterno = {
  idProduto: number;
  codigo: string;
  descricao: string;
  saldoInicial: number;
  consumoPorDia: Map<string, number>;
  entradaPorDia: Map<string, number>;
  origens: OrigemConsumoRow[];
};

type EngineResult = {
  consultadoEm: string;
  datas: string[];
  statusPorData: StatusPorDataRow[];
  materiaisCriticos: MaterialCriticoRow[];
  qtdeMateriaisEscopo: number;
  itens: ItemInterno[];
};

function isoDateOnlyValid(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function hojeIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addOneDayIso(iso: string): string {
  const [y, mo, da] = iso.split('-').map(Number);
  const dt = new Date(y, mo - 1, da);
  dt.setDate(dt.getDate() + 1);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function enumerateDaysInclusive(inicioIso: string, fimIso: string): string[] {
  if (inicioIso > fimIso) return [];
  const out: string[] = [];
  let cur = inicioIso;
  let guard = 0;
  while (cur <= fimIso && guard++ < MAX_DIAS + 5) {
    out.push(cur);
    if (cur === fimIso) break;
    cur = addOneDayIso(cur);
  }
  return out;
}

function num(v: unknown): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v).trim().replace(/\s/g, '');
  if (!s) return 0;
  let n = Number(s);
  if (Number.isFinite(n)) return n;
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
    n = Number(s);
  }
  return Number.isFinite(n) ? n : 0;
}

function normalizarDemanda(raw: DemandaCalendarioLinha[]): DemandaCalendarioLinha[] {
  const out: DemandaCalendarioLinha[] = [];
  for (const r of raw) {
    const codigoPa = String(r.codigoPa ?? '').trim();
    const dataIso = normalizarDataIsoCalendario(r.dataIso);
    const qtde = num(r.qtde);
    if (!codigoPa || !dataIso || qtde <= 0) continue;
    out.push({
      codigoPa,
      dataIso,
      qtde,
      pd: String(r.pd ?? '').trim(),
      setor: String(r.setor ?? '').trim(),
    });
  }
  return out;
}

async function resolverIdsPorCodigoPa(
  pool: Pool,
  codigos: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (codigos.length === 0) return map;
  for (let i = 0; i < codigos.length; i += IDS_CHUNK) {
    const chunk = codigos.slice(i, i + IDS_CHUNK);
    const placeholders = chunk.map(() => '?').join(', ');
    const sql = `
    SELECT id, nome
    FROM produto
    WHERE nome IN (${placeholders})
      AND idTipoProduto IN (8, 15)
      AND ativo = 1
  `;
    const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, sql, chunk);
    for (const r of Array.isArray(rows) ? rows : []) {
      const nome = String(r.nome ?? '').trim();
      const id = Number(r.id);
      if (nome && Number.isFinite(id) && id > 0 && !map.has(nome)) map.set(nome, id);
    }
  }
  return map;
}

type BomRow = {
  idPa: number;
  codigoPa: string;
  idComponente: number;
  codigoComponente: string;
  descricaoComponente: string;
  qtdePorPa: number;
};

async function carregarBomFolhaPorPas(pool: Pool, idPas: number[]): Promise<BomRow[]> {
  if (idPas.length === 0) return [];
  const base = loadBomListaMateriaisAcabadoSql();
  const out: BomRow[] = [];

  for (let i = 0; i < idPas.length; i += BOM_CHUNK) {
    const chunk = idPas.slice(i, i + BOM_CHUNK);
    const ph = chunk.map(() => '?').join(', ');
    // Substitui exatamente o filtro de 1 PA pelo lote (evita outros WHERE do SQL).
    const sql = base.replace(
      /Where \(pq\.idProduto = \?\)\s+And\s+/i,
      `Where pq.idProduto IN (${ph}) And `
    );
    const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, sql, chunk);
    for (const r of Array.isArray(rows) ? rows : []) {
      const idPa = Number(r.idprodutopai);
      const idComponente = Number(r.idcomponente);
      const qtdePorPa = num(r.qtd);
      if (!Number.isFinite(idPa) || idPa <= 0) continue;
      if (!Number.isFinite(idComponente) || idComponente <= 0) continue;
      if (qtdePorPa <= 0) continue;
      out.push({
        idPa,
        codigoPa: String(r.codigopai ?? '').trim(),
        idComponente,
        codigoComponente: String(r.codigocomponente ?? '').trim(),
        descricaoComponente: String(r.componente ?? '').trim(),
        qtdePorPa,
      });
    }
  }
  return out;
}

/** Componentes com vínculo ao almox secundário (setor 2). */
async function filtrarIdsComSetor2(pool: Pool, ids: number[]): Promise<Set<number>> {
  const set = new Set<number>();
  if (ids.length === 0) return set;
  for (let i = 0; i < ids.length; i += IDS_CHUNK) {
    const chunk = ids.slice(i, i + IDS_CHUNK);
    const placeholders = chunk.map(() => '?').join(', ');
    const sql = `
    SELECT DISTINCT pe.idProduto AS idProduto
    FROM produtoempresa pe
    INNER JOIN produtoempresa_setorestoque pese ON pese.idProdutoEmpresa = pe.id
    WHERE pe.idEmpresa = 1
      AND pese.idSetorEstoque = ${SETOR_ALMOX_SECUNDARIO}
      AND pe.idProduto IN (${placeholders})
  `;
    const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, sql, chunk);
    for (const r of Array.isArray(rows) ? rows : []) {
      const id = Number(r.idProduto);
      if (Number.isFinite(id) && id > 0) set.add(id);
    }
  }
  return set;
}

/**
 * IDs com atributo "tipo de material" = Matéria Prima (attr 540).
 * Produto sem o atributo não entra no set (permanece no escopo).
 */
async function filtrarIdsMateriaPrima(pool: Pool, ids: number[]): Promise<Set<number>> {
  const set = new Set<number>();
  if (ids.length === 0) return set;
  for (let i = 0; i < ids.length; i += IDS_CHUNK) {
    const chunk = ids.slice(i, i + IDS_CHUNK);
    const placeholders = chunk.map(() => '?').join(', ');
    const sql = `
    SELECT DISTINCT apv.idProduto AS idProduto
    FROM atributoprodutovalor apv
    INNER JOIN atributolistaopcao alo ON alo.id = apv.idListaOpcao
    WHERE apv.idAtributo = ${RESSUP_NAO_ALMOX_ATTR_TIPO_MATERIAL}
      AND alo.opcao = ?
      AND apv.idProduto IN (${placeholders})
  `;
    const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(
      pool,
      sql,
      [TIPO_MATERIAL_MATERIA_PRIMA, ...chunk]
    );
    for (const r of Array.isArray(rows) ? rows : []) {
      const id = Number(r.idProduto);
      if (Number.isFinite(id) && id > 0) set.add(id);
    }
  }
  return set;
}

async function saldoSetor2PorIds(pool: Pool, ids: number[]): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (ids.length === 0) return map;
  for (let i = 0; i < ids.length; i += IDS_CHUNK) {
    const chunk = ids.slice(i, i + IDS_CHUNK);
    const placeholders = chunk.map(() => '?').join(', ');
    const sql = `
    SELECT
      sp.idProduto AS idProduto,
      CASE
        WHEN sp.saldoSetorFinal <= 0 THEN 0
        ELSE ROUND(sp.saldoSetorFinal, 2)
      END AS saldo
    FROM saldoestoque_produto sp
    INNER JOIN (
      SELECT idProduto, MAX(dataMovimentacao) AS maxData
      FROM saldoestoque_produto
      WHERE idEmpresa = 1
        AND idSetorEstoque = ${SETOR_ALMOX_SECUNDARIO}
        AND idProduto IN (${placeholders})
      GROUP BY idProduto
    ) ult
      ON ult.idProduto = sp.idProduto
     AND sp.dataMovimentacao = ult.maxData
    WHERE sp.idEmpresa = 1
      AND sp.idSetorEstoque = ${SETOR_ALMOX_SECUNDARIO}
  `;
    const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, sql, chunk);
    for (const r of Array.isArray(rows) ? rows : []) {
      const id = Number(r.idProduto);
      if (!Number.isFinite(id) || id <= 0) continue;
      map.set(id, arred2(num(r.saldo)));
    }
  }
  return map;
}

/** PC pendente linha a linha (não agrega em MIN) — atrasado/NULL → hoje. */
async function entradasPcPorProdutoDia(
  pool: Pool,
  ids: number[],
  hoje: string
): Promise<Map<number, Map<string, number>>> {
  const map = new Map<number, Map<string, number>>();
  if (ids.length === 0) return map;
  for (let i = 0; i < ids.length; i += IDS_CHUNK) {
    const chunk = ids.slice(i, i + IDS_CHUNK);
    const placeholders = chunk.map(() => '?').join(', ');
    const sql = `
    SELECT
      i.idProduto AS idProduto,
      CASE
        WHEN i.dataEntrega IS NULL THEN CURDATE()
        WHEN CAST(i.dataEntrega AS DATE) < CURDATE() THEN CURDATE()
        ELSE CAST(i.dataEntrega AS DATE)
      END AS dataEntrega,
      ROUND(COALESCE(i.qtde, 0) - COALESCE(i.qtdeAtendida, 0), 2) AS qtde
    FROM itempedidocompra i
    WHERE i.status IN (2, 3, 4)
      AND (COALESCE(i.qtde, 0) - COALESCE(i.qtdeAtendida, 0)) > 0
      AND i.idProduto IN (${placeholders})
  `;
    const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, sql, chunk);
    for (const r of Array.isArray(rows) ? rows : []) {
      const id = Number(r.idProduto);
      if (!Number.isFinite(id) || id <= 0) continue;
      let dia = mppDiaIsoDataPrevisao(r.dataEntrega);
      if (!dia || !isoDateOnlyValid(dia)) dia = hoje;
      if (dia < hoje) dia = hoje;
      const q = arred2(num(r.qtde));
      if (q <= 0) continue;
      if (!map.has(id)) map.set(id, new Map());
      const m = map.get(id)!;
      m.set(dia, arred2((m.get(dia) ?? 0) + q));
    }
  }
  return map;
}

function montarDatasCalendario(demanda: DemandaCalendarioLinha[], hoje: string): string[] {
  let min = hoje;
  let max = hoje;
  for (const d of demanda) {
    if (d.dataIso < min) min = d.dataIso;
    if (d.dataIso > max) max = d.dataIso;
  }
  // Inclui hoje para receber PCs atrasados mesmo se produção começa depois.
  if (min > hoje) min = hoje;
  const datas = enumerateDaysInclusive(min, max);
  return datas.length > MAX_DIAS ? datas.slice(0, MAX_DIAS) : datas;
}

export async function computarEngineDisponibilidade(
  pool: Pool,
  demandaRaw: DemandaCalendarioLinha[]
): Promise<{ ok: true; data: EngineResult } | { ok: false; error: string }> {
  const demanda = normalizarDemanda(demandaRaw);
  const consultadoEm = new Date().toISOString();
  const hoje = hojeIsoLocal();

  if (demanda.length === 0) {
    return {
      ok: true,
      data: {
        consultadoEm,
        datas: [],
        statusPorData: [],
        materiaisCriticos: [],
        qtdeMateriaisEscopo: 0,
        itens: [],
      },
    };
  }

  const datas = montarDatasCalendario(demanda, hoje);
  if (datas.length === 0) {
    return { ok: false, error: 'Intervalo de datas inválido.' };
  }
  const setDias = new Set(datas);

  const codigosPa = [...new Set(demanda.map((d) => d.codigoPa))];
  const idPorCodigoPa = await resolverIdsPorCodigoPa(pool, codigosPa);
  const idPas = [...new Set([...idPorCodigoPa.values()])];

  const bomRows = await carregarBomFolhaPorPas(pool, idPas);
  const idsCompAll = [...new Set(bomRows.map((b) => b.idComponente))];
  const idsSetor2 = await filtrarIdsComSetor2(pool, idsCompAll);
  const idsMateriaPrima = await filtrarIdsMateriaPrima(pool, [...idsSetor2]);
  const bomSec = bomRows.filter(
    (b) =>
      idsSetor2.has(b.idComponente) &&
      !idsMateriaPrima.has(b.idComponente) &&
      b.codigoComponente
  );

  // BOM por PA id
  const bomPorPa = new Map<number, BomRow[]>();
  for (const b of bomSec) {
    if (!bomPorPa.has(b.idPa)) bomPorPa.set(b.idPa, []);
    bomPorPa.get(b.idPa)!.push(b);
  }

  const itensMap = new Map<number, ItemInterno>();
  const ensureItem = (b: BomRow): ItemInterno => {
    let it = itensMap.get(b.idComponente);
    if (!it) {
      it = {
        idProduto: b.idComponente,
        codigo: b.codigoComponente,
        descricao: b.descricaoComponente,
        saldoInicial: 0,
        consumoPorDia: new Map(),
        entradaPorDia: new Map(),
        origens: [],
      };
      itensMap.set(b.idComponente, it);
    } else if (b.descricaoComponente.length > it.descricao.length) {
      it.descricao = b.descricaoComponente;
    }
    return it;
  };

  for (const d of demanda) {
    const idPa = idPorCodigoPa.get(d.codigoPa);
    if (idPa == null) continue;
    const comps = bomPorPa.get(idPa);
    if (!comps?.length) continue;
    for (const b of comps) {
      const consumo = arred2(b.qtdePorPa * d.qtde);
      if (consumo <= 0) continue;
      const it = ensureItem(b);
      if (setDias.has(d.dataIso)) {
        it.consumoPorDia.set(d.dataIso, arred2((it.consumoPorDia.get(d.dataIso) ?? 0) + consumo));
      }
      it.origens.push({
        dataIso: d.dataIso,
        codigoPa: d.codigoPa,
        qtdePa: d.qtde,
        qtdeComponente: consumo,
        pd: d.pd ?? '',
        setor: d.setor ?? '',
      });
    }
  }

  const idsItens = [...itensMap.keys()];
  const [saldos, entradas] = await Promise.all([
    saldoSetor2PorIds(pool, idsItens),
    entradasPcPorProdutoDia(pool, idsItens, hoje),
  ]);

  for (const [id, it] of itensMap) {
    it.saldoInicial = saldos.get(id) ?? 0;
    const ent = entradas.get(id);
    if (ent) {
      for (const [dia, q] of ent) {
        if (!setDias.has(dia)) {
          // PC fora do eixo: se antes do início, joga no 1º dia; se depois, ignora no carry
          // (ainda conta se dia está no eixo). Entradas após o fim não afetam o horizonte.
          if (datas.length && dia < datas[0]!) {
            const d0 = datas[0]!;
            it.entradaPorDia.set(d0, arred2((it.entradaPorDia.get(d0) ?? 0) + q));
          }
          continue;
        }
        it.entradaPorDia.set(dia, arred2((it.entradaPorDia.get(dia) ?? 0) + q));
      }
    }
  }

  const itens = [...itensMap.values()].sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR'));

  // Status por data + materiais críticos
  const statusPorData: StatusPorDataRow[] = [];
  const materiaisCriticos: MaterialCriticoRow[] = [];

  type CalcItem = {
    item: ItemInterno;
    saldosInicio: number[];
    nAcum: number[];
    statuses: StatusMaterialDia[];
  };
  const calcs: CalcItem[] = [];

  for (const item of itens) {
    const diasCel = datas.map((data) => ({
      consumo: item.consumoPorDia.get(data) ?? 0,
      entrada: item.entradaPorDia.get(data) ?? 0,
    }));
    const { saldosInicio, nAcum } = saldosENecessidadesDisponibilidade(diasCel, {
      saldoInicial: item.saldoInicial,
    });
    const statuses = diasCel.map((cel, i) =>
      statusCelulaMaterialDia(cel.consumo, saldosInicio[i]!, cel.entrada, nAcum[i]!)
    );
    calcs.push({ item, saldosInicio, nAcum, statuses });

    const idx = primeiroIndiceRuptura(nAcum);
    if (idx >= 0) {
      materiaisCriticos.push({
        idProduto: item.idProduto,
        codigo: item.codigo,
        descricao: item.descricao,
        primeiraDataFalta: datas[idx]!,
        faltaNaPrimeiraData: arred2(nAcum[idx]!),
      });
    }
  }

  for (let i = 0; i < datas.length; i++) {
    // Semáforo alinhado ao modal: só materiais com falta (nAcum > 0) no dia.
    const relevantes: StatusMaterialDia[] = [];
    let falta = 0;
    for (const c of calcs) {
      const n = c.nAcum[i] ?? 0;
      if (!(n > 0)) continue;
      relevantes.push('falta');
      falta += 1;
    }
    statusPorData.push({
      data: datas[i]!,
      status: relevantes.length ? statusDiaAgregado(relevantes) : 'ok',
      qtdeMateriaisFalta: falta,
      qtdeMateriaisAtencao: 0,
    });
  }

  materiaisCriticos.sort((a, b) => {
    const dc = a.descricao.localeCompare(b.descricao, 'pt-BR', { sensitivity: 'base' });
    if (dc !== 0) return dc;
    return a.codigo.localeCompare(b.codigo, 'pt-BR');
  });

  return {
    ok: true,
    data: {
      consultadoEm,
      datas,
      statusPorData,
      materiaisCriticos,
      qtdeMateriaisEscopo: itens.length,
      itens,
    },
  };
}

export async function obterDisponibilidadeSintetica(
  pool: Pool,
  demanda: DemandaCalendarioLinha[]
): Promise<{ ok: true; data: DisponibilidadeSintetico } | { ok: false; error: string }> {
  const r = await computarEngineDisponibilidade(pool, demanda);
  if (!r.ok) return r;
  return {
    ok: true,
    data: {
      consultadoEm: r.data.consultadoEm,
      datas: r.data.datas,
      statusPorData: r.data.statusPorData,
      materiaisCriticos: r.data.materiaisCriticos,
      qtdeMateriaisEscopo: r.data.qtdeMateriaisEscopo,
    },
  };
}

export async function obterMateriaisDoDia(
  pool: Pool,
  demanda: DemandaCalendarioLinha[],
  dataRaw: string
): Promise<
  | {
      ok: true;
      data: { consultadoEm: string; dataIso: string; materiais: MaterialDiaRow[] };
    }
  | { ok: false; error: string }
> {
  const dataIso = normalizarDataIsoCalendario(dataRaw);
  if (!dataIso) {
    return {
      ok: false,
      error: `Data inválida (“${String(dataRaw ?? '').trim() || 'vazia'}”). Use YYYY-MM-DD.`,
    };
  }
  const r = await computarEngineDisponibilidade(pool, demanda);
  if (!r.ok) return r;
  const idx = r.data.datas.indexOf(dataIso);
  if (idx < 0) {
    return {
      ok: true,
      data: { consultadoEm: r.data.consultadoEm, dataIso, materiais: [] },
    };
  }

  const materiais: MaterialDiaRow[] = [];
  for (const item of r.data.itens) {
    const diasCel = r.data.datas.map((d) => ({
      consumo: item.consumoPorDia.get(d) ?? 0,
      entrada: item.entradaPorDia.get(d) ?? 0,
    }));
    const { saldosInicio, nAcum } = saldosENecessidadesDisponibilidade(diasCel, {
      saldoInicial: item.saldoInicial,
    });
    const consumo = diasCel[idx]!.consumo;
    const entrada = diasCel[idx]!.entrada;
    const saldoInicio = saldosInicio[idx]!;
    const falta = nAcum[idx]!;
    if (!(falta > 0) || !(consumo > 0)) continue;
    const status = statusCelulaMaterialDia(consumo, saldoInicio, entrada, falta);
    materiais.push({
      idProduto: item.idProduto,
      codigo: item.codigo,
      descricao: item.descricao,
      necessidadeDia: arred2(consumo),
      saldoInicio: arred2(saldoInicio),
      entradaDia: arred2(entrada),
      falta: arred2(falta),
      status,
    });
  }

  materiais.sort((a, b) => {
    const dc = a.descricao.localeCompare(b.descricao, 'pt-BR', { sensitivity: 'base' });
    if (dc !== 0) return dc;
    return a.codigo.localeCompare(b.codigo, 'pt-BR');
  });

  return {
    ok: true,
    data: { consultadoEm: r.data.consultadoEm, dataIso, materiais },
  };
}

export async function obterHorizonteItem(
  pool: Pool,
  demanda: DemandaCalendarioLinha[],
  codigoComponente: string
): Promise<
  | {
      ok: true;
      data: {
        consultadoEm: string;
        idProduto: number;
        codigo: string;
        descricao: string;
        saldoInicial: number;
        dias: HorizonteDiaRow[];
        origens: OrigemConsumoRow[];
      };
    }
  | { ok: false; error: string }
> {
  const codigo = String(codigoComponente ?? '').trim();
  if (!codigo) return { ok: false, error: 'codigoComponente obrigatório.' };

  const r = await computarEngineDisponibilidade(pool, demanda);
  if (!r.ok) return r;

  const item = r.data.itens.find((i) => i.codigo === codigo);
  if (!item) {
    return { ok: false, error: `Componente ${codigo} sem consumo no escopo do calendário.` };
  }

  const diasCel = r.data.datas.map((d) => ({
    consumo: item.consumoPorDia.get(d) ?? 0,
    entrada: item.entradaPorDia.get(d) ?? 0,
  }));
  const { saldosInicio, nAcum } = saldosENecessidadesDisponibilidade(diasCel, {
    saldoInicial: item.saldoInicial,
  });

  const dias: HorizonteDiaRow[] = r.data.datas.map((data, i) => {
    const consumo = diasCel[i]!.consumo;
    const entrada = diasCel[i]!.entrada;
    const saldoInicio = saldosInicio[i]!;
    const faltaAcum = nAcum[i]!;
    return {
      data,
      consumo: arred2(consumo),
      entrada: arred2(entrada),
      saldoInicio: arred2(saldoInicio),
      faltaAcum: arred2(faltaAcum),
      status: statusCelulaMaterialDia(consumo, saldoInicio, entrada, faltaAcum),
    };
  });

  // Compacta origens por (data, pa, pd, setor)
  const origMap = new Map<string, OrigemConsumoRow>();
  for (const o of item.origens) {
    const key = `${o.dataIso}\0${o.codigoPa}\0${o.pd}\0${o.setor}`;
    const prev = origMap.get(key);
    if (prev) {
      prev.qtdePa = arred2(prev.qtdePa + o.qtdePa);
      prev.qtdeComponente = arred2(prev.qtdeComponente + o.qtdeComponente);
    } else {
      origMap.set(key, { ...o });
    }
  }
  const origens = [...origMap.values()].sort((a, b) => {
    const dc = a.dataIso.localeCompare(b.dataIso);
    if (dc !== 0) return dc;
    return a.codigoPa.localeCompare(b.codigoPa, 'pt-BR');
  });

  return {
    ok: true,
    data: {
      consultadoEm: r.data.consultadoEm,
      idProduto: item.idProduto,
      codigo: item.codigo,
      descricao: item.descricao,
      saldoInicial: arred2(item.saldoInicial),
      dias,
      origens,
    },
  };
}
