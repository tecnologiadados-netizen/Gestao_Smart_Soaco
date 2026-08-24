/**
 * Disponibilidade de materiais para o Calendário de produção:
 * consumo = BOM (folha) × qtde líquida do calendário por data;
 * saldo inicial = somente almox secundário (setor 2);
 * entrada = PC pendente por dataEntrega (atrasado → hoje);
 * escopo = almox secundário ∩ ¬Matéria Prima ∩ allowlist (lista válida + vínculo setor).
 */

import type { Pool } from 'mysql2/promise';
import { nomusQueryWithRetry } from '../config/nomusDb.js';
import { loadBomListaMateriaisAcabadoSql, loadComponentesEscopoCalendarioMateriaisSql } from '../data/bomListaMateriaisSql.js';
import { calcularSaldoSc } from '../data/consultaEstoqueRepository.js';
import { RESSUP_NAO_ALMOX_ATTR_TIPO_MATERIAL } from '../data/ressupNaoAlmoxRepository.js';
import { STATUS_COTACAO_AGPAG_SQL } from '../data/sql/sqlComprasEstoqueFragments.js';
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
  /** Rota/carrada da linha (coluna "Carrada" do sequenciamento) — origem do consumo. */
  carrada?: string;
};

/** Linha de Pré Compra (cotação status 1–3) congelada / detalhe. */
export type AgPagLinhaCongelada = {
  idProduto: number;
  cotacao: string;
  dataEmissao: string | null;
  comprador: string;
  scCodigos: string;
  qtde: number;
};

/** Linha de Solicitação de Compra aberta congelada / detalhe. */
export type ScLinhaCongelada = {
  idProduto: number;
  codigo: number;
  usuario: string;
  dataEmissao: string | null;
  dataNecessidade: string | null;
  saldo: number;
};

/**
 * Fonte exibida na coluna Entrada PC do modal Materiais do dia.
 * Prioridade (quando entrada do dia = 0): pc_aberta → ag_pag → solicitacao → nenhuma.
 * Com entrada do dia > 0: sempre `entrada_dia` (número), sem misturar outras fontes.
 */
export type EntradaPcFonte = 'entrada_dia' | 'pc_aberta' | 'ag_pag' | 'solicitacao' | 'nenhuma';

export type EntradaPcExibicao = {
  fonte: EntradaPcFonte;
  /** Texto único da célula (nunca combina fontes). */
  texto: string;
  clicavel: boolean;
};

/**
 * Entradas do motor congeladas no momento do Gravar da sequência.
 * Com ela o cálculo roda sem tocar no Nomus, mantendo semáforos e modais estáticos.
 */
export type BaseMateriaisCongelada = {
  version: 1;
  capturadoEm: string;
  /** Data de referência do "PC atrasado → hoje" e do início do eixo no momento da captura. */
  hoje: string;
  idPorCodigoPa: Record<string, number>;
  /** BOM folha já filtrada (almox secundário, sem Matéria Prima, allowlist dwlc_componentes). */
  bom: { idPa: number; idComp: number; cod: string; desc: string; qtdePorPa: number }[];
  saldoPorIdComp: Record<string, number>;
  /** PC pendente linha a linha — alimenta a entrada diária e o modal "PC Pend". */
  pcLinhas: {
    idProduto: number;
    pedidoCompra: string;
    /** Data no eixo do calendário (atrasado/NULL → hoje), ISO YYYY-MM-DD. */
    dataEntrega: string;
    /**
     * Data original formatada como na Consulta de Estoque (`dd/mm/yyyy` ou null).
     * Ausente em snapshots legados — o endpoint do modal cai no ISO formatado.
     */
    dataEntregaExibicao?: string | null;
    qtde: number;
  }[];
  /**
   * Pré Compra abertas no momento do Gravar (opcional em snapshots legados).
   * Só alimenta a coluna Entrada PC / modal — não entra no cálculo de falta.
   */
  agPagLinhas?: AgPagLinhaCongelada[];
  /**
   * SCs abertas com saldo > 0 no momento do Gravar (opcional em snapshots legados).
   * Só alimenta a coluna Entrada PC / modal — não entra no cálculo de falta.
   */
  scLinhas?: ScLinhaCongelada[];
};

export type StatusPorDataRow = {
  data: string;
  status: StatusMaterialDia;
  qtdeMateriaisFalta: number;
  qtdeMateriaisAtencao: number;
};

/** Semáforo por célula (setor × data) — mesma regra do modal filtrado por setor. */
export type StatusPorCelulaRow = {
  setor: string;
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
  consumoDia: number;
  saldoInicio: number;
  /** Entrada numérica do dia (motor) — base do cálculo de falta; não misturar com avisos. */
  entradaDia: number;
  falta: number;
  status: StatusMaterialDia;
  /** Origem do consumo do dia (mesma fonte da célula, garante grade == modal). */
  origens: OrigemConsumoRow[];
  /** Texto prioritário da coluna Entrada PC (não altera falta). */
  entradaPc: EntradaPcExibicao;
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
  carrada: string;
  pd: string;
  qtdeComponente: number;
  /** Setor de produção da demanda (célula do calendário). */
  setor: string;
};

export type DisponibilidadeSintetico = {
  consultadoEm: string;
  datas: string[];
  statusPorData: StatusPorDataRow[];
  /** Status por setor×data (bolinha ao lado da qtde na grade). */
  statusPorCelula: StatusPorCelulaRow[];
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
  statusPorCelula: StatusPorCelulaRow[];
  materiaisCriticos: MaterialCriticoRow[];
  qtdeMateriaisEscopo: number;
  itens: ItemInterno[];
  /** Linhas analíticas para prioridade/modais da coluna Entrada PC (não afetam falta). */
  pcLinhas: PcLinhaPendente[];
  agPagLinhas: AgPagLinhaCongelada[];
  scLinhas: ScLinhaCongelada[];
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
      carrada: String(r.carrada ?? '').trim(),
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
    WHERE nome COLLATE utf8mb4_general_ci IN (${placeholders})
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
      AND alo.opcao COLLATE utf8mb4_general_ci = ?
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

/**
 * Allowlist: componente de lista válida (Produção/Precificação/Parcial) com vínculo
 * ao Almoxarifado Material Secundário — mesma regra da consulta de escopo do calendário.
 */
async function filtrarIdsEscopoCalendarioMateriais(pool: Pool, ids: number[]): Promise<Set<number>> {
  const set = new Set<number>();
  if (ids.length === 0) return set;
  for (let i = 0; i < ids.length; i += IDS_CHUNK) {
    const chunk = ids.slice(i, i + IDS_CHUNK).filter((id) => Number.isFinite(id) && id > 0);
    if (chunk.length === 0) continue;
    const sql = loadComponentesEscopoCalendarioMateriaisSql(chunk);
    const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, sql, []);
    for (const r of Array.isArray(rows) ? rows : []) {
      const id = Number(r.idProduto);
      if (Number.isFinite(id) && id > 0) set.add(id);
    }
  }
  return set;
}

/** Aplica filtros de escopo do calendário: almox secundário, sem Matéria Prima, allowlist BOM. */
async function filtrarBomEscopoCalendario(pool: Pool, bomRows: BomRow[]): Promise<BomRow[]> {
  const idsCompAll = [...new Set(bomRows.map((b) => b.idComponente))];
  const idsSetor2 = await filtrarIdsComSetor2(pool, idsCompAll);
  const idsCandidatos = [...idsSetor2];
  const [idsMateriaPrima, idsEscopo] = await Promise.all([
    filtrarIdsMateriaPrima(pool, idsCandidatos),
    filtrarIdsEscopoCalendarioMateriais(pool, idsCandidatos),
  ]);
  return bomRows.filter(
    (b) =>
      idsSetor2.has(b.idComponente) &&
      idsEscopo.has(b.idComponente) &&
      !idsMateriaPrima.has(b.idComponente) &&
      !!b.codigoComponente
  );
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

type PcLinhaPendente = {
  idProduto: number;
  pedidoCompra: string;
  /** Data no eixo (atrasado/NULL → hoje), ISO. */
  dataEntrega: string;
  /** Data original `dd/mm/yyyy` (igual Consulta de Estoque); null se ERP sem data. */
  dataEntregaExibicao: string | null;
  qtde: number;
};

/** PC pendente linha a linha (não agrega em MIN) — atrasado/NULL → hoje no eixo. */
async function pcPendentePorProduto(
  pool: Pool,
  ids: number[],
  hoje: string
): Promise<PcLinhaPendente[]> {
  const out: PcLinhaPendente[] = [];
  if (ids.length === 0) return out;
  for (let i = 0; i < ids.length; i += IDS_CHUNK) {
    const chunk = ids.slice(i, i + IDS_CHUNK);
    const placeholders = chunk.map(() => '?').join(', ');
    const sql = `
    SELECT
      i.idProduto AS idProduto,
      pc.nome AS pedidoCompra,
      CASE
        WHEN i.dataEntrega IS NULL THEN CURDATE()
        WHEN CAST(i.dataEntrega AS DATE) < CURDATE() THEN CURDATE()
        ELSE CAST(i.dataEntrega AS DATE)
      END AS dataEntregaEixo,
      CASE
        WHEN i.dataEntrega IS NULL THEN NULL
        ELSE DATE_FORMAT(CAST(i.dataEntrega AS DATE), '%d/%m/%Y')
      END AS dataEntregaExibicao,
      ROUND(COALESCE(i.qtde, 0) - COALESCE(i.qtdeAtendida, 0), 2) AS qtde
    FROM itempedidocompra i
    LEFT JOIN pedidocompra pc ON pc.id = i.idPedidoCompra
    WHERE i.status IN (2, 3, 4)
      AND (COALESCE(i.qtde, 0) - COALESCE(i.qtdeAtendida, 0)) > 0
      AND i.idProduto IN (${placeholders})
  `;
    const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, sql, chunk);
    for (const r of Array.isArray(rows) ? rows : []) {
      const id = Number(r.idProduto);
      if (!Number.isFinite(id) || id <= 0) continue;
      const q = arred2(num(r.qtde));
      if (q <= 0) continue;
      const exib =
        r.dataEntregaExibicao != null && String(r.dataEntregaExibicao).trim() !== ''
          ? String(r.dataEntregaExibicao).trim()
          : null;
      out.push({
        idProduto: id,
        pedidoCompra: String(r.pedidoCompra ?? '').trim(),
        dataEntrega: diaEntradaPc(r.dataEntregaEixo, hoje),
        dataEntregaExibicao: exib,
        qtde: q,
      });
    }
  }
  return out;
}

/** Normaliza a data de entrega do PC no eixo: inválida/atrasada → hoje. */
function diaEntradaPc(valor: unknown, hoje: string): string {
  let dia = mppDiaIsoDataPrevisao(valor);
  if (!dia || !isoDateOnlyValid(dia)) dia = hoje;
  if (dia < hoje) dia = hoje;
  return dia;
}

function agruparEntradasPcPorDia(
  linhas: PcLinhaPendente[],
  hoje: string
): Map<number, Map<string, number>> {
  const map = new Map<number, Map<string, number>>();
  for (const l of linhas) {
    const dia = diaEntradaPc(l.dataEntrega, hoje);
    let m = map.get(l.idProduto);
    if (!m) {
      m = new Map();
      map.set(l.idProduto, m);
    }
    m.set(dia, arred2((m.get(dia) ?? 0) + l.qtde));
  }
  return map;
}

function fmtDataBrIso(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function fmtNumEntradaPc(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * Resolve o texto único da coluna Entrada PC (Materiais do dia).
 * Quando há entrada no dia, mostra o número; senão prioriza PC aberto → Pré Compra → SC → 0.
 * Não altera o cálculo de falta (usa só `entradaDia` numérico do motor).
 */
export function resolverEntradaPcExibicao(args: {
  entradaDia: number;
  pcLinhas: { dataEntrega: string; qtde: number }[];
  temAgPag: boolean;
  temSolicitacao: boolean;
}): EntradaPcExibicao {
  const entrada = arred2(args.entradaDia);
  if (entrada > 0) {
    return { fonte: 'entrada_dia', texto: fmtNumEntradaPc(entrada), clicavel: true };
  }

  const pcs = args.pcLinhas.filter((l) => arred2(l.qtde) > 0 && !!String(l.dataEntrega ?? '').trim());
  if (pcs.length > 0) {
    let dataMin = pcs[0]!.dataEntrega;
    for (const p of pcs) {
      if (p.dataEntrega < dataMin) dataMin = p.dataEntrega;
    }
    const qtde = arred2(
      pcs.filter((p) => p.dataEntrega === dataMin).reduce((s, p) => s + arred2(p.qtde), 0)
    );
    return {
      fonte: 'pc_aberta',
      texto: `${fmtDataBrIso(dataMin)} - ${fmtNumEntradaPc(qtde)}`,
      clicavel: true,
    };
  }

  if (args.temAgPag) {
    return { fonte: 'ag_pag', texto: 'Pré Compra', clicavel: true };
  }
  if (args.temSolicitacao) {
    return { fonte: 'solicitacao', texto: 'Solicitação de Compra', clicavel: true };
  }
  return { fonte: 'nenhuma', texto: '0', clicavel: false };
}

/** Pré Compra abertas (cotação status 1–3) linha a linha — mesma regra do detalhe Consulta de Estoque. */
async function agPagAbertasPorProduto(pool: Pool, ids: number[]): Promise<AgPagLinhaCongelada[]> {
  const out: AgPagLinhaCongelada[] = [];
  if (ids.length === 0) return out;
  for (let i = 0; i < ids.length; i += IDS_CHUNK) {
    const chunk = ids.slice(i, i + IDS_CHUNK);
    const placeholders = chunk.map(() => '?').join(', ');
    const sql = `
    SELECT
      icc.idProduto AS idProduto,
      cc.nome AS cotacao,
      DATE_FORMAT(CAST(cc.dataEmissao AS DATE), '%d/%m/%Y') AS dataEmissao,
      COALESCE(NULLIF(TRIM(u.nome), ''), NULLIF(TRIM(f.nome), ''), NULLIF(TRIM(pe.nome), ''), '—') AS comprador,
      COALESCE(GROUP_CONCAT(DISTINCT CAST(sc.id AS CHAR) ORDER BY sc.id SEPARATOR ','), '') AS scCodigos,
      ROUND(icc.qtde, 2) AS qtde
    FROM itemcotacaocompra icc
    INNER JOIN cotacaocompra cc ON cc.id = icc.idCotacaoCompra
    LEFT JOIN usuario u ON u.id = cc.idComprador
    LEFT JOIN funcionario f ON f.id = u.idFuncionario
    LEFT JOIN pessoa pe ON pe.id = cc.idComprador
    LEFT JOIN solicitacaocompra_itemcotacaocompra scicc ON scicc.idItemCotacaoCompra = icc.id
    LEFT JOIN solicitacaocompra sc ON sc.id = scicc.idSolicitacaoCompra
    WHERE icc.idProduto IN (${placeholders})
      AND cc.status IN (${STATUS_COTACAO_AGPAG_SQL})
    GROUP BY icc.id, icc.idProduto, cc.id, cc.nome, cc.dataEmissao, icc.qtde, u.nome, f.nome, pe.nome
    ORDER BY icc.idProduto, cc.dataEmissao, cc.nome
  `;
    const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, sql, chunk);
    for (const r of Array.isArray(rows) ? rows : []) {
      const idProduto = Number(r.idProduto);
      const qtde = arred2(num(r.qtde));
      if (!Number.isFinite(idProduto) || idProduto <= 0 || qtde <= 0) continue;
      out.push({
        idProduto,
        cotacao: String(r.cotacao ?? '').trim() || '—',
        dataEmissao: r.dataEmissao != null && String(r.dataEmissao).trim() !== '' ? String(r.dataEmissao) : null,
        comprador: String(r.comprador ?? '').trim() || '—',
        scCodigos: String(r.scCodigos ?? '').trim(),
        qtde,
      });
    }
  }
  return out;
}

/** SCs abertas (status 2/6) com saldo > 0 — mesma regra do detalhe Consulta de Estoque. */
async function scAbertasPorProduto(pool: Pool, ids: number[]): Promise<ScLinhaCongelada[]> {
  const out: ScLinhaCongelada[] = [];
  if (ids.length === 0) return out;
  for (let i = 0; i < ids.length; i += IDS_CHUNK) {
    const chunk = ids.slice(i, i + IDS_CHUNK);
    const placeholders = chunk.map(() => '?').join(', ');
    const sql = `
    SELECT
      sc.idProduto AS idProduto,
      sc.id AS codigo,
      u.nome AS usuario,
      DATE_FORMAT(CAST(sc.dataEmissao AS DATE), '%d/%m/%Y') AS dataEmissao,
      DATE_FORMAT(CAST(sc.dataNecessidade AS DATE), '%d/%m/%Y') AS dataNecessidade,
      ROUND(GREATEST(0, sc.quantidade), 2) AS qtdeSolicitada,
      ROUND(COALESCE(ate.qtdeAtendida, 0), 2) AS qtdeComprada,
      ROUND(COALESCE(cot.qtdeEmCotacao, 0), 2) AS qtdeEmCotacao
    FROM solicitacaocompra sc
    LEFT JOIN usuario u ON u.id = sc.idUsuario
    LEFT JOIN (
      SELECT idSolicitacaoCompra, SUM(qtdeAtendida) AS qtdeAtendida
      FROM solicitacaocompraitempedidocompra
      GROUP BY idSolicitacaoCompra
    ) ate ON ate.idSolicitacaoCompra = sc.id
    LEFT JOIN (
      SELECT scicc.idSolicitacaoCompra, SUM(scicc.qtdeAtendida) AS qtdeEmCotacao
      FROM solicitacaocompra_itemcotacaocompra scicc
      INNER JOIN itemcotacaocompra icc ON icc.id = scicc.idItemCotacaoCompra
      INNER JOIN cotacaocompra cc ON cc.id = icc.idCotacaoCompra
      WHERE cc.status IN (${STATUS_COTACAO_AGPAG_SQL})
      GROUP BY scicc.idSolicitacaoCompra
    ) cot ON cot.idSolicitacaoCompra = sc.id
    WHERE sc.idProduto IN (${placeholders})
      AND sc.status IN (2, 6)
      AND sc.lixeira IS NULL
    ORDER BY sc.idProduto, sc.dataNecessidade, sc.id
  `;
    const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, sql, chunk);
    for (const r of Array.isArray(rows) ? rows : []) {
      const idProduto = Number(r.idProduto);
      if (!Number.isFinite(idProduto) || idProduto <= 0) continue;
      const saldo = calcularSaldoSc(
        num(r.qtdeSolicitada),
        num(r.qtdeComprada),
        num(r.qtdeEmCotacao)
      );
      if (!(saldo > 0)) continue;
      out.push({
        idProduto,
        codigo: Number(r.codigo ?? 0),
        usuario: String(r.usuario ?? '').trim() || '—',
        dataEmissao: r.dataEmissao != null && String(r.dataEmissao).trim() !== '' ? String(r.dataEmissao) : null,
        dataNecessidade:
          r.dataNecessidade != null && String(r.dataNecessidade).trim() !== ''
            ? String(r.dataNecessidade)
            : null,
        saldo: arred2(saldo),
      });
    }
  }
  return out;
}

/**
 * Captura as entradas do motor (BOM, saldo do almox secundário, PC, Pré Compra e SC) para congelar
 * junto ao snapshot da sequência. `codigosPa` deve conter todos os PAs das linhas gravadas.
 */
export async function capturarBaseMateriaisCongelada(
  pool: Pool,
  codigosPa: string[]
): Promise<BaseMateriaisCongelada> {
  const hoje = hojeIsoLocal();
  const codigos = [...new Set(codigosPa.map((c) => String(c ?? '').trim()).filter(Boolean))];
  const idPorCodigoPa = await resolverIdsPorCodigoPa(pool, codigos);
  const idPas = [...new Set([...idPorCodigoPa.values()])];

  const bomRows = await carregarBomFolhaPorPas(pool, idPas);
  const bomSec = await filtrarBomEscopoCalendario(pool, bomRows);

  const idsItens = [...new Set(bomSec.map((b) => b.idComponente))];
  const [saldos, pcLinhas, agPagLinhas, scLinhas] = await Promise.all([
    saldoSetor2PorIds(pool, idsItens),
    pcPendentePorProduto(pool, idsItens, hoje),
    agPagAbertasPorProduto(pool, idsItens),
    scAbertasPorProduto(pool, idsItens),
  ]);

  const saldoPorIdComp: Record<string, number> = {};
  for (const [id, saldo] of saldos) saldoPorIdComp[String(id)] = saldo;

  return {
    version: 1,
    capturadoEm: new Date().toISOString(),
    hoje,
    idPorCodigoPa: Object.fromEntries(idPorCodigoPa),
    bom: bomSec.map((b) => ({
      idPa: b.idPa,
      idComp: b.idComponente,
      cod: b.codigoComponente,
      desc: b.descricaoComponente,
      qtdePorPa: b.qtdePorPa,
    })),
    saldoPorIdComp,
    pcLinhas,
    agPagLinhas,
    scLinhas,
  };
}

/** Linhas de PC pendente congeladas de um componente (modal "PC Pend" em snapshot). */
export function pcPendentesCongeladasDoProduto(
  base: BaseMateriaisCongelada,
  idProduto: number
): PcLinhaPendente[] {
  return base.pcLinhas
    .filter((l) => l.idProduto === idProduto)
    .map((l) => ({
      idProduto: l.idProduto,
      pedidoCompra: l.pedidoCompra,
      dataEntrega: l.dataEntrega,
      dataEntregaExibicao:
        l.dataEntregaExibicao !== undefined
          ? l.dataEntregaExibicao
          : fmtDataBrIso(l.dataEntrega) || null,
      qtde: l.qtde,
    }))
    .sort((a, b) => {
      // Ordena pela data de exibição (dd/mm/yyyy → yyyymmdd) alinhada à Consulta de Estoque.
      const ka = chaveOrdenacaoDataExibicao(a.dataEntregaExibicao) ?? a.dataEntrega;
      const kb = chaveOrdenacaoDataExibicao(b.dataEntregaExibicao) ?? b.dataEntrega;
      const dc = ka.localeCompare(kb);
      if (dc !== 0) return dc;
      return a.pedidoCompra.localeCompare(b.pedidoCompra, 'pt-BR');
    });
}

/** Formato do modal PC Pend — mesma face da Consulta de Estoque (`dd/mm/yyyy` ou null). */
export function pcPendModalLinhasDoProduto(
  base: BaseMateriaisCongelada,
  idProduto: number
): { pedidoCompra: string; qtde: number; dataEntrega: string | null }[] {
  return pcPendentesCongeladasDoProduto(base, idProduto).map((l) => ({
    pedidoCompra: l.pedidoCompra,
    qtde: l.qtde,
    dataEntrega: l.dataEntregaExibicao,
  }));
}

function chaveOrdenacaoDataExibicao(br: string | null | undefined): string | null {
  if (!br?.trim()) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br.trim());
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Pré Compra congeladas do produto (modal Pré Compra em snapshot). */
export function agPagCongeladasDoProduto(
  base: BaseMateriaisCongelada,
  idProduto: number
): AgPagLinhaCongelada[] {
  return (base.agPagLinhas ?? [])
    .filter((l) => l.idProduto === idProduto && l.qtde > 0)
    .sort((a, b) => {
      const da = a.dataEmissao ?? '';
      const db = b.dataEmissao ?? '';
      const dc = da.localeCompare(db);
      if (dc !== 0) return dc;
      return a.cotacao.localeCompare(b.cotacao, 'pt-BR');
    });
}

/** SCs congeladas do produto (modal Solicitação de Compra em snapshot). */
export function scCongeladasDoProduto(
  base: BaseMateriaisCongelada,
  idProduto: number
): ScLinhaCongelada[] {
  return (base.scLinhas ?? [])
    .filter((l) => l.idProduto === idProduto && l.saldo > 0)
    .sort((a, b) => {
      const da = a.dataNecessidade ?? '';
      const db = b.dataNecessidade ?? '';
      const dc = da.localeCompare(db);
      if (dc !== 0) return dc;
      return a.codigo - b.codigo;
    });
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

/**
 * Motor de disponibilidade. Com `base` congelada não consulta o Nomus: BOM, saldos e PCs vêm do
 * snapshot e a data de referência é a da captura, mantendo o resultado estável no tempo.
 */
export async function computarEngineDisponibilidade(
  pool: Pool | null,
  demandaRaw: DemandaCalendarioLinha[],
  base?: BaseMateriaisCongelada | null
): Promise<{ ok: true; data: EngineResult } | { ok: false; error: string }> {
  const demanda = normalizarDemanda(demandaRaw);
  const consultadoEm = base ? base.capturadoEm : new Date().toISOString();
  const hoje = base ? base.hoje : hojeIsoLocal();
  if (!base && !pool) {
    return { ok: false, error: 'ERP (Nomus) não configurado.' };
  }

  if (demanda.length === 0) {
    return {
      ok: true,
      data: {
        consultadoEm,
        datas: [],
        statusPorData: [],
        statusPorCelula: [],
        materiaisCriticos: [],
        qtdeMateriaisEscopo: 0,
        itens: [],
        pcLinhas: [],
        agPagLinhas: [],
        scLinhas: [],
      },
    };
  }

  const datas = montarDatasCalendario(demanda, hoje);
  if (datas.length === 0) {
    return { ok: false, error: 'Intervalo de datas inválido.' };
  }
  const setDias = new Set(datas);

  const codigosPa = [...new Set(demanda.map((d) => d.codigoPa))];
  let idPorCodigoPa: Map<string, number>;
  let bomSec: BomRow[];
  if (base) {
    idPorCodigoPa = new Map(
      codigosPa
        .map((cod) => [cod, base.idPorCodigoPa[cod]] as const)
        .filter((e): e is readonly [string, number] => Number.isFinite(e[1]) && (e[1] as number) > 0)
        .map(([cod, id]) => [cod, id])
    );
    bomSec = base.bom.map((b) => ({
      idPa: b.idPa,
      codigoPa: '',
      idComponente: b.idComp,
      codigoComponente: b.cod,
      descricaoComponente: b.desc,
      qtdePorPa: b.qtdePorPa,
    }));
  } else {
    idPorCodigoPa = await resolverIdsPorCodigoPa(pool!, codigosPa);
    const idPas = [...new Set([...idPorCodigoPa.values()])];
    const bomRows = await carregarBomFolhaPorPas(pool!, idPas);
    bomSec = await filtrarBomEscopoCalendario(pool!, bomRows);
  }

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
        carrada: d.carrada ?? '',
        pd: d.pd ?? '',
        qtdeComponente: consumo,
        setor: d.setor ?? '',
      });
    }
  }

  const idsItens = [...itensMap.keys()];
  let saldos: Map<number, number>;
  let entradas: Map<number, Map<string, number>>;
  let pcLinhas: PcLinhaPendente[];
  let agPagLinhas: AgPagLinhaCongelada[];
  let scLinhas: ScLinhaCongelada[];
  if (base) {
    saldos = new Map(idsItens.map((id) => [id, arred2(num(base.saldoPorIdComp[String(id)]))]));
    pcLinhas = base.pcLinhas;
    agPagLinhas = base.agPagLinhas ?? [];
    scLinhas = base.scLinhas ?? [];
    entradas = agruparEntradasPcPorDia(pcLinhas, hoje);
  } else {
    const [saldosLive, pcLive, agLive, scLive] = await Promise.all([
      saldoSetor2PorIds(pool!, idsItens),
      pcPendentePorProduto(pool!, idsItens, hoje),
      agPagAbertasPorProduto(pool!, idsItens),
      scAbertasPorProduto(pool!, idsItens),
    ]);
    saldos = saldosLive;
    pcLinhas = pcLive;
    agPagLinhas = agLive;
    scLinhas = scLive;
    entradas = agruparEntradasPcPorDia(pcLinhas, hoje);
  }

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

  // Semáforo por célula: material em falta no dia ∩ consumo do setor naquele dia.
  const faltaPorCelula = new Map<string, number>();

  for (let i = 0; i < datas.length; i++) {
    // Semáforo alinhado ao modal: só materiais com falta (nAcum > 0) no dia.
    const relevantes: StatusMaterialDia[] = [];
    let falta = 0;
    const dataIso = datas[i]!;
    for (const c of calcs) {
      const n = c.nAcum[i] ?? 0;
      if (!(n > 0)) continue;
      relevantes.push('falta');
      falta += 1;
      const setoresNoDia = new Set<string>();
      for (const o of c.item.origens) {
        if (o.dataIso !== dataIso) continue;
        const setor = String(o.setor ?? '').trim();
        if (setor) setoresNoDia.add(setor);
      }
      for (const setor of setoresNoDia) {
        const key = `${setor}\0${dataIso}`;
        faltaPorCelula.set(key, (faltaPorCelula.get(key) ?? 0) + 1);
      }
    }
    statusPorData.push({
      data: dataIso,
      status: relevantes.length ? statusDiaAgregado(relevantes) : 'ok',
      qtdeMateriaisFalta: falta,
      qtdeMateriaisAtencao: 0,
    });
  }

  const statusPorCelula: StatusPorCelulaRow[] = [];
  for (const [key, qtde] of faltaPorCelula) {
    const sep = key.indexOf('\0');
    const setor = key.slice(0, sep);
    const data = key.slice(sep + 1);
    statusPorCelula.push({
      setor,
      data,
      status: 'falta',
      qtdeMateriaisFalta: qtde,
      qtdeMateriaisAtencao: 0,
    });
  }
  statusPorCelula.sort((a, b) => {
    const dc = a.data.localeCompare(b.data);
    if (dc !== 0) return dc;
    return a.setor.localeCompare(b.setor, 'pt-BR', { sensitivity: 'base' });
  });

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
      statusPorCelula,
      materiaisCriticos,
      qtdeMateriaisEscopo: itens.length,
      itens,
      pcLinhas,
      agPagLinhas,
      scLinhas,
    },
  };
}

/** Compacta origens por (data, carrada, pd, setor); `filtroData`/`filtroSetor` restringem. */
function agregarOrigens(
  origens: OrigemConsumoRow[],
  filtroData?: string,
  filtroSetor?: string
): OrigemConsumoRow[] {
  const setorNorm = filtroSetor != null ? String(filtroSetor).trim() : '';
  const map = new Map<string, OrigemConsumoRow>();
  for (const o of origens) {
    if (filtroData && o.dataIso !== filtroData) continue;
    if (setorNorm && String(o.setor ?? '').trim() !== setorNorm) continue;
    const setor = String(o.setor ?? '').trim();
    const key = `${o.dataIso}\0${o.carrada}\0${o.pd}\0${setor}`;
    const prev = map.get(key);
    if (prev) {
      prev.qtdeComponente = arred2(prev.qtdeComponente + o.qtdeComponente);
    } else {
      map.set(key, { ...o, setor, qtdeComponente: arred2(o.qtdeComponente) });
    }
  }
  return [...map.values()].sort((a, b) => {
    const dc = a.dataIso.localeCompare(b.dataIso);
    if (dc !== 0) return dc;
    const sc = a.setor.localeCompare(b.setor, 'pt-BR', { sensitivity: 'base' });
    if (sc !== 0) return sc;
    const cc = a.carrada.localeCompare(b.carrada, 'pt-BR', { sensitivity: 'base' });
    if (cc !== 0) return cc;
    return a.pd.localeCompare(b.pd, 'pt-BR');
  });
}

export async function obterDisponibilidadeSintetica(
  pool: Pool | null,
  demanda: DemandaCalendarioLinha[],
  base?: BaseMateriaisCongelada | null
): Promise<{ ok: true; data: DisponibilidadeSintetico } | { ok: false; error: string }> {
  const r = await computarEngineDisponibilidade(pool, demanda, base);
  if (!r.ok) return r;
  return {
    ok: true,
    data: {
      consultadoEm: r.data.consultadoEm,
      datas: r.data.datas,
      statusPorData: r.data.statusPorData,
      statusPorCelula: r.data.statusPorCelula,
      materiaisCriticos: r.data.materiaisCriticos,
      qtdeMateriaisEscopo: r.data.qtdeMateriaisEscopo,
    },
  };
}

export async function obterMateriaisDoDia(
  pool: Pool | null,
  demanda: DemandaCalendarioLinha[],
  dataRaw: string,
  base?: BaseMateriaisCongelada | null,
  /** Quando informado, só materiais com consumo do setor na data (bolinha da célula). */
  setorFiltroRaw?: string | null
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
  const setorFiltro = String(setorFiltroRaw ?? '').trim();
  const r = await computarEngineDisponibilidade(pool, demanda, base);
  if (!r.ok) return r;
  const idx = r.data.datas.indexOf(dataIso);
  if (idx < 0) {
    return {
      ok: true,
      data: { consultadoEm: r.data.consultadoEm, dataIso, materiais: [] },
    };
  }

  const materiais: MaterialDiaRow[] = [];
  const agPorProduto = new Set(r.data.agPagLinhas.map((l) => l.idProduto));
  const scPorProduto = new Set(r.data.scLinhas.map((l) => l.idProduto));
  const pcsPorProduto = new Map<number, PcLinhaPendente[]>();
  for (const l of r.data.pcLinhas) {
    let arr = pcsPorProduto.get(l.idProduto);
    if (!arr) {
      arr = [];
      pcsPorProduto.set(l.idProduto, arr);
    }
    arr.push(l);
  }

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
    if (!(falta > 0)) continue;
    const origens = agregarOrigens(item.origens, dataIso, setorFiltro || undefined);
    if (setorFiltro) {
      if (origens.length === 0) continue;
    } else if (!(consumo > 0)) {
      continue;
    }
    const status = statusCelulaMaterialDia(consumo, saldoInicio, entrada, falta);
    const entradaPc = resolverEntradaPcExibicao({
      entradaDia: entrada,
      pcLinhas: pcsPorProduto.get(item.idProduto) ?? [],
      temAgPag: agPorProduto.has(item.idProduto),
      temSolicitacao: scPorProduto.has(item.idProduto),
    });
    const consumoExibicao = setorFiltro
      ? arred2(origens.reduce((s, o) => s + o.qtdeComponente, 0))
      : arred2(consumo);
    materiais.push({
      idProduto: item.idProduto,
      codigo: item.codigo,
      descricao: item.descricao,
      consumoDia: consumoExibicao,
      saldoInicio: arred2(saldoInicio),
      entradaDia: arred2(entrada),
      falta: arred2(falta),
      status,
      origens,
      entradaPc,
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
  pool: Pool | null,
  demanda: DemandaCalendarioLinha[],
  codigoComponente: string,
  base?: BaseMateriaisCongelada | null
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

  const r = await computarEngineDisponibilidade(pool, demanda, base);
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

  const origens = agregarOrigens(item.origens);

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
