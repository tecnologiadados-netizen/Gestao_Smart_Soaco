/**
 * Pedidos: base lida do Nomus (MySQL, somente leitura). Ajustes no SQLite local.
 */

import mysql from 'mysql2';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { getNomusPool, isNomusEnabled } from '../config/nomusDb.js';
import { setLastSyncErp } from '../config/statusApp.js';
import { geocodeMunicipio, geocodeFromCache, chaveLocal } from '../services/geocode.js';
import { aplicarSinalizacaoCardPedidos, carregarCardsComunicador, pedidoLinhaAlocadaComunicador } from '../services/sycroOrderPedidoSinalizacao.js';
import {
  criarMatcherTextoLivre,
  normalizarTextoBusca,
  termoParaPadraoLikeSql,
} from '../utils/textoLivreBusca.js';
import { aplicarTiposEntregaFuturaSql } from '../config/pcpEntregaFutura.js';
import {
  calcularDataLimiteCarrada,
  isTipoFCarradaParaRegra,
  obterVersoesParaClassificacao,
  resolverConfigPorEmissao,
} from './regrasDataEntregaRepository.js';
import type { RegraDataEntregaConfig } from '../config/regrasDataEntrega.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SQL_FILE = 'sqlBasePedidosNomus.sql';
const SQL_FILE_ENCERRADOS = 'sqlPedidosEncerradosNomus.sql';

function resolveSqlPath(fileName: string): string {
  const candidates = [
    join(__dirname, fileName),
    join(process.cwd(), 'src', 'data', fileName),
    join(process.cwd(), 'dist', 'data', fileName),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error(
    `Arquivo ${fileName} não encontrado. Procurou em: ${candidates.join(', ')}. Execute npm run build no backend.`
  );
}

const SQL_BASE_NOMUS = aplicarTiposEntregaFuturaSql(readFileSync(resolveSqlPath(SQL_FILE), 'utf-8').trim());
const SQL_PEDIDOS_ENCERRADOS_NOMUS = aplicarTiposEntregaFuturaSql(
  readFileSync(resolveSqlPath(SQL_FILE_ENCERRADOS), 'utf-8').trim()
);

export interface FiltrosPedidos {
  cliente?: string;
  observacoes?: string;
  pd?: string;
  cod?: string;
  data_emissao_ini?: string;
  data_emissao_fim?: string;
  data_entrega_ini?: string;
  data_entrega_fim?: string;
  data_previsao_anterior_ini?: string;
  data_previsao_anterior_fim?: string;
  data_ini?: string;
  data_fim?: string;
  atrasados?: boolean;
  grupo_produto?: string;
  subgrupo1?: string;
  subgrupo2?: string;
  setor_producao?: string;
  uf?: string;
  municipio_entrega?: string;
  motivo?: string;
  vendedor?: string;
  tipo_f?: string;
  status?: string;
  metodo?: string;
  forma_pagamento?: string;
  descricao_produto?: string;
  a_vista?: string;
  requisicao_loja?: string;
  /** Faixa de aging para drill-down do Dash Entregas (em_dia, atraso_1_7, …). */
  faixa_atraso?: string;
  /** Quando true, exclui pedidos classificados como requisição (Dash Entregas). */
  excluir_requisicao?: boolean;
  page?: number;
  limit?: number;
  /** Níveis de classificação para ordenar a lista antes da paginação (ex.: [{ id: 'previsao_atual', dir: 'asc' }, ...]). */
  sort_levels?: { id: string; dir: 'asc' | 'desc' }[];
}

export interface PedidoRow {
  id_pedido: string;
  cliente: string;
  produto: string;
  qtd: number;
  previsao_entrega: Date;
  previsao_entrega_atualizada: Date;
  /** Penúltimo registro do histórico de alterações (previsão antes da última). Exibido como "Previsão anterior". */
  previsao_anterior?: Date;
  [key: string]: unknown;
}

export interface ObservacaoResumo {
  observacao: string;
  quantidade: number;
}

/** Replica a coluna Status do Power Query (M): Atrasado / Em dia conforme TipoF, datas e Valor Pedido Total. */
function computarStatus(row: Record<string, unknown>): 'Atrasado' | 'Em dia' {
  const tipoF = String((row['TipoF'] ?? row['tipoF']) ?? '').toUpperCase();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const dataEntregaRaw = row['Data de entrega'] ?? row['Data de Entrega'] ?? row['dataParametro'];
  const dataEntrega =
    dataEntregaRaw != null ? new Date(dataEntregaRaw as string | Date) : null;
  if (dataEntrega) dataEntrega.setHours(0, 0, 0, 0);

  const emissaoRaw = row['Emissao'] ?? row['emissao'];
  const emissao = emissaoRaw != null ? new Date(emissaoRaw as string | Date) : null;
  if (emissao) emissao.setHours(0, 0, 0, 0);

  const valorRaw = row['Valor Pedido Total'] ?? row['Valor pedido total'];
  const valor = valorRaw != null ? Number(valorRaw) : NaN;
  const valorNum = Number.isNaN(valor) ? 0 : valor;

  const temReqOuGrande =
    tipoF.includes('REQUISICAO') ||
    tipoF.includes('REQUISIÇÃO') ||
    tipoF.includes('RETIRADA') ||
    tipoF.includes('GRANDE');

  if (temReqOuGrande && dataEntrega && dataEntrega.getTime() < hoje.getTime()) return 'Atrasado';
  if (!temReqOuGrande && valorNum >= 30000 && dataEntrega && dataEntrega.getTime() < hoje.getTime()) return 'Atrasado';
  if (!temReqOuGrande && valorNum < 30000 && emissao) {
    const emissaoMais45 = new Date(emissao);
    emissaoMais45.setDate(emissaoMais45.getDate() + 45);
    if (emissaoMais45.getTime() < hoje.getTime()) return 'Atrasado';
  }
  return 'Em dia';
}

/** Status exibido na coluna Status da grade (StatusPedido do ERP ou fallback computarStatus). */
function statusPedidoGrade(p: PedidoRow): string {
  const raw = p['Status'] ?? p['StatusPedido'] ?? p['statusPedido'];
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return computarStatus(p as Record<string, unknown>);
}

function pedidoGradeEstaAtrasado(p: PedidoRow): boolean {
  return statusPedidoGrade(p) === 'Atrasado';
}

/** Dias de atraso com base na previsão atualizada (0 quando em dia). */
function getDiasAtrasoPedido(p: PedidoRow, hoje: Date): number {
  if (!pedidoGradeEstaAtrasado(p)) return 0;
  const d = new Date(p.previsao_entrega_atualizada);
  d.setHours(0, 0, 0, 0);
  const h = new Date(hoje);
  h.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((h.getTime() - d.getTime()) / (24 * 60 * 60 * 1000)));
}

function pedidoNaFaixaAtraso(p: PedidoRow, faixa: string, hoje: Date): boolean {
  const f = faixa.trim().toLowerCase();
  if (f === 'em_dia') return !pedidoGradeEstaAtrasado(p);
  if (!pedidoGradeEstaAtrasado(p)) return false;
  const dias = getDiasAtrasoPedido(p, hoje);
  switch (f) {
    case 'atraso_1_7':
      return dias >= 1 && dias <= 7;
    case 'atraso_8_15':
      return dias >= 8 && dias <= 15;
    case 'atraso_16_30':
      return dias >= 16 && dias <= 30;
    case 'atraso_31_60':
      return dias >= 31 && dias <= 60;
    case 'atraso_60_mais':
      return dias >= 61;
    default:
      return true;
  }
}

/**
 * Chave canônica pedido+item (ignora prefixo da carrada/romaneio e normaliza item: 0645 e 645 -> mesmo grupo).
 * Ex.: "12345-179648-3255" e "0000000-179648-3255" -> "179648-3255".
 * Assim o histórico SQLite permanece associado à linha lógica quando o vínculo com a carrada muda no ERP.
 */
function chavePedidoItem(id: string): string {
  const parts = String(id ?? '').trim().split('-');
  if (parts.length >= 3) {
    const pedido = parts[parts.length - 2]!.trim();
    const itemStr = parts[parts.length - 1]!.trim();
    const numItem = parseInt(itemStr, 10);
    const itemCanonico = Number.isNaN(numItem) ? itemStr : String(numItem);
    return `${pedido}-${itemCanonico}`;
  }
  if (parts.length === 2) return parts.join('-').trim();
  return String(id ?? '').trim();
}

/**
 * Normaliza nome de rota/observação para chave de comparação (override por rota).
 * Igual à `normalizeRotaNameStr` do frontend (`utils/rotaCarrada.ts`).
 * Vazio -> '' (representa ajuste base; quando persistido na coluna `rota`, gravamos NULL).
 */
export function normalizeRotaForChave(rota: string | null | undefined): string {
  return String(rota ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

/** Último e penúltimo ajuste por idChave (para Previsão atual e Previsão anterior). */
type AjusteInfo = {
  ultimo: { previsao_nova: Date; motivo: string | null; observacao: string | null; previsao_confiavel: boolean };
  penultimo: Date | null;
  /** Origem do ajuste exibido como "atual". */
  origem: 'override' | 'base';
  /**
   * Aviso de "carrada migrada": rotas em que existe override para o mesmo (PD, item) mas
   * que NÃO aparecem mais na leitura atual do Nomus. O frontend exibe badge na linha.
   */
  carradaMigrada?: { rota: string; previsao: Date }[];
};

/** Linha bruta do SQLite (datas podem vir como string, número ou timestamp ms). */
type AjusteRow = {
  id: number;
  id_pedido: string;
  rota: string | null;
  previsao_nova: unknown;
  motivo: string;
  observacao: string | null;
  data_ajuste: unknown;
  previsao_confiavel: boolean;
};

/** Item de entrada para o lookup hierárquico: idChave (idRomaneio-idPedido-idProduto) + rota da linha. */
type LinhaLookup = { idChave: string; rota: string };

/**
 * Busca último e penúltimo ajuste por (idChave, rota) com regra hierárquica:
 *   1) Existe ajuste com `rota = rota_da_linha`?     -> usa (origem: 'override').
 *   2) Senão, existe ajuste base (`rota = NULL`)?    -> usa (origem: 'base').
 *   3) Senão, mapa não contém o idChave (caller usa `dataParametro`).
 *
 * Também detecta "carrada migrada": para cada (PD, item), se existem overrides em rotas que
 * NÃO aparecem mais na leitura atual do Nomus, anexa um aviso a TODAS as linhas desse (PD, item).
 */
async function obterUltimoEPenultimoPorPedido(linhas: LinhaLookup[]): Promise<Map<string, AjusteInfo>> {
  if (linhas.length === 0) return new Map();
  const result = new Map<string, AjusteInfo>();
  try {
    const todos = await prisma.pedidoPrevisaoAjuste.findMany({
      select: {
        id: true,
        id_pedido: true,
        rota: true,
        previsao_nova: true,
        motivo: true,
        observacao: true,
        data_ajuste: true,
        previsao_confiavel: true,
      },
      orderBy: [{ data_ajuste: 'desc' }, { id: 'desc' }],
    });

    // Agrupa ajustes por canon pedido+item, separando base (rota = NULL) e overrides por rota normalizada.
    const baseByCanon = new Map<string, AjusteRow[]>();
    const overrideByCanonRota = new Map<string, Map<string, AjusteRow[]>>();
    for (const a of todos) {
      const idNorm = String(a.id_pedido ?? '').trim();
      if (!idNorm) continue;
      const canon = chavePedidoItem(idNorm);
      const rotaNorm = normalizeRotaForChave(a.rota);
      if (!rotaNorm) {
        const list = baseByCanon.get(canon) ?? [];
        list.push(a as AjusteRow);
        baseByCanon.set(canon, list);
      } else {
        let byRota = overrideByCanonRota.get(canon);
        if (!byRota) {
          byRota = new Map<string, AjusteRow[]>();
          overrideByCanonRota.set(canon, byRota);
        }
        const list = byRota.get(rotaNorm) ?? [];
        list.push(a as AjusteRow);
        byRota.set(rotaNorm, list);
      }
    }

    const sortDesc = (list: AjusteRow[]) => {
      list.sort((x, y) => {
        const tx = parseDateFromDb(x.data_ajuste).getTime();
        const ty = parseDateFromDb(y.data_ajuste).getTime();
        if (ty !== tx) return ty - tx;
        return (y.id ?? 0) - (x.id ?? 0);
      });
    };
    for (const list of baseByCanon.values()) sortDesc(list);
    for (const byRota of overrideByCanonRota.values()) {
      for (const list of byRota.values()) sortDesc(list);
    }

    // Conjunto de rotas atualmente presentes na grade para cada canon.
    const rotasAtuaisPorCanon = new Map<string, Set<string>>();
    for (const linha of linhas) {
      const canon = chavePedidoItem(String(linha.idChave ?? '').trim());
      if (!canon) continue;
      const rotaNorm = normalizeRotaForChave(linha.rota);
      const set = rotasAtuaisPorCanon.get(canon) ?? new Set<string>();
      if (rotaNorm) set.add(rotaNorm);
      rotasAtuaisPorCanon.set(canon, set);
    }

    // Pré-calcula aviso de "carrada migrada" por canon: overrides em rotas que não aparecem mais.
    const avisoPorCanon = new Map<string, { rota: string; previsao: Date }[]>();
    for (const [canon, byRota] of overrideByCanonRota) {
      const rotasAtuais = rotasAtuaisPorCanon.get(canon) ?? new Set<string>();
      const orfas: { rota: string; previsao: Date }[] = [];
      for (const [rotaNorm, list] of byRota) {
        if (rotasAtuais.has(rotaNorm)) continue;
        const head = list[0];
        if (!head) continue;
        orfas.push({ rota: rotaNorm, previsao: parseDateFromDb(head.previsao_nova) });
      }
      if (orfas.length > 0) avisoPorCanon.set(canon, orfas);
    }

    for (const linha of linhas) {
      const idChave = String(linha.idChave ?? '').trim();
      if (!idChave) continue;
      const canon = chavePedidoItem(idChave);
      const rotaNorm = normalizeRotaForChave(linha.rota);
      const overrides = rotaNorm ? overrideByCanonRota.get(canon)?.get(rotaNorm) ?? [] : [];
      const bases = baseByCanon.get(canon) ?? [];

      let info: AjusteInfo | null = null;
      if (overrides.length > 0) {
        const ultimo = overrides[0]!;
        let penultimoRaw: Date | string | null = overrides[1]?.previsao_nova ?? null;
        if (penultimoRaw == null && bases.length > 0) {
          const baseHead = bases[0]!;
          if (baseHead.previsao_nova !== ultimo.previsao_nova) {
            penultimoRaw = baseHead.previsao_nova;
          }
        }
        info = {
          ultimo: {
            previsao_nova: parseDateFromDb(ultimo.previsao_nova),
            motivo: ultimo.motivo,
            observacao: ultimo.observacao ?? null,
            previsao_confiavel: ultimo.previsao_confiavel !== false,
          },
          penultimo: penultimoRaw != null ? parseDateFromDb(penultimoRaw) : null,
          origem: 'override',
        };
      } else if (bases.length > 0) {
        const ultimo = bases[0]!;
        const penultimo = bases[1]?.previsao_nova ?? null;
        info = {
          ultimo: {
            previsao_nova: parseDateFromDb(ultimo.previsao_nova),
            motivo: ultimo.motivo,
            observacao: ultimo.observacao ?? null,
            previsao_confiavel: ultimo.previsao_confiavel !== false,
          },
          penultimo: penultimo != null ? parseDateFromDb(penultimo) : null,
          origem: 'base',
        };
      }
      if (info) {
        const aviso = avisoPorCanon.get(canon);
        if (aviso) info.carradaMigrada = aviso;
        result.set(idChave, info);
      } else {
        const aviso = avisoPorCanon.get(canon);
        if (aviso) {
          // Linha ainda não tem ajuste, mas houve override em rota órfã para o mesmo (PD, item).
          result.set(idChave, {
            ultimo: { previsao_nova: new Date(0), motivo: null, observacao: null, previsao_confiavel: true },
            penultimo: null,
            origem: 'base',
            carradaMigrada: aviso,
          });
        }
      }
    }
  } catch (err) {
    console.error('[obterUltimoEPenultimoPorPedido] Prisma falhou:', err instanceof Error ? err.message : err);
  }
  return result;
}

/**
 * Data de produção mais recente por idChave (histórico append-only em pedido_data_producao).
 * Usa a mesma chave canônica pedido+item (chavePedidoItem) do ajuste de previsão, de modo que a
 * data acompanha a linha lógica mesmo quando o vínculo com a carrada muda no ERP.
 */
async function obterDataProducaoPorPedido(linhas: LinhaLookup[]): Promise<Map<string, Date>> {
  const result = new Map<string, Date>();
  if (linhas.length === 0) return result;
  try {
    const rows = await prisma.pedidoDataProducao.findMany({
      select: { id: true, id_pedido: true, data_producao: true, data_registro: true },
      orderBy: [{ data_registro: 'desc' }, { id: 'desc' }],
    });
    // canon (pedido+item) -> data de produção mais recente
    const porCanon = new Map<string, Date>();
    for (const r of rows) {
      const canon = chavePedidoItem(String(r.id_pedido ?? '').trim());
      if (!canon || porCanon.has(canon)) continue;
      porCanon.set(canon, parseDateFromDb(r.data_producao));
    }
    for (const linha of linhas) {
      const idChave = String(linha.idChave ?? '').trim();
      if (!idChave) continue;
      const d = porCanon.get(chavePedidoItem(idChave));
      if (d) result.set(idChave, d);
    }
  } catch (err) {
    console.error('[obterDataProducaoPorPedido] Prisma falhou:', err instanceof Error ? err.message : err);
  }
  return result;
}

/** Mapeia linha do Nomus para formato do app; aplica último e penúltimo ajuste (SQLite). Retorna todos os campos do banco (row) mais os calculados. */
function rowNomusToPedido(
  row: Record<string, unknown>,
  ajustePorId: Map<string, AjusteInfo>,
  versoesRegras: Array<{ vigenteApartirDe: Date; payload: RegraDataEntregaConfig }>,
  dataProducaoPorId?: Map<string, Date>
): PedidoRow {
  const idChave = String(row['idChave'] ?? '').trim();
  const cliente = String(row['Cliente'] ?? '');
  const produto = String(row['Descricao do produto'] ?? row['Cod'] ?? '');
  const qtde = Number(row['Qtde pedida'] ?? 0);
  let previsaoOriginal = row['dataParametro'] != null ? new Date(row['dataParametro'] as string | Date) : new Date();
  const info = ajustePorId.get(idChave);
  // Só substitui a previsão original quando há ajuste de verdade (timestamp > 0).
  const temAjusteReal = !!info && info.ultimo.previsao_nova.getTime() > 0;
  let previsaoAtualizada = temAjusteReal ? info!.ultimo.previsao_nova : previsaoOriginal;
  const motivoAjuste = temAjusteReal ? info!.ultimo.motivo : null;
  const observacaoAjuste = temAjusteReal ? info!.ultimo.observacao : null;
  const dataOriginalRaw = row['Data de entrega'] ?? row['dataParametro'];
  const previsaoAnteriorFallback =
    dataOriginalRaw != null ? new Date(dataOriginalRaw as string | Date) : previsaoOriginal;
  let previsaoAnterior = info?.penultimo ?? previsaoAnteriorFallback;
  const origemAjuste = temAjusteReal ? info!.origem : null;
  const previsaoAtualConfiavel = temAjusteReal ? info!.ultimo.previsao_confiavel : true;
  const carradaMigrada = info?.carradaMigrada ?? null;
  const dataProducao = dataProducaoPorId?.get(idChave) ?? null;

  const tipoF = String(row['TipoF'] ?? row['tipoF'] ?? '').trim();
  const emissaoRaw = row['Emissao'] ?? row['emissao'];
  const emissao = emissaoRaw != null ? new Date(emissaoRaw as string | Date) : null;
  const valorRaw = row['Valor Pedido Total'] ?? row['Valor pedido total'];
  const valorPedidoTotal = valorRaw != null && !Number.isNaN(Number(valorRaw)) ? Number(valorRaw) : 0;

  const configEmissao =
    emissao && !Number.isNaN(emissao.getTime())
      ? resolverConfigPorEmissao(versoesRegras, emissao)
      : null;
  const incluiRomaneio = configEmissao?.carrada.incluiInserirRomaneio ?? false;

  let status: 'Atrasado' | 'Em dia';
  if (emissao && isTipoFCarradaParaRegra(tipoF, incluiRomaneio)) {
    const { dataLimite } = calcularDataLimiteCarrada(emissao, valorPedidoTotal, configEmissao);
    previsaoOriginal = dataLimite;
    if (!temAjusteReal) {
      previsaoAtualizada = dataLimite;
    }
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const lim = new Date(dataLimite);
    lim.setHours(0, 0, 0, 0);
    status = lim.getTime() < hoje.getTime() ? 'Atrasado' : 'Em dia';
  } else {
    const statusSql = row['StatusPedido'] ?? row['statusPedido'];
    status =
      typeof statusSql === 'string' && statusSql.trim()
        ? (statusSql.trim() as 'Atrasado' | 'Em dia')
        : computarStatus(row);
  }

  // Todos os dados do banco (row) primeiro; em seguida campos calculados/ajustes (prioridade)
  return {
    ...row,
    id_pedido: idChave,
    cliente,
    produto,
    qtd: qtde,
    previsao_entrega: previsaoOriginal,
    previsao_entrega_atualizada: previsaoAtualizada,
    previsao_anterior: previsaoAnterior,
    motivo_ultimo_ajuste: motivoAjuste,
    observacao_ultimo_ajuste: observacaoAjuste,
    origem_ultimo_ajuste: origemAjuste,
    previsao_atual_confiavel: previsaoAtualConfiavel,
    carrada_migrada: carradaMigrada,
    data_producao: dataProducao,
    Status: status,
    dataParametro: previsaoOriginal,
  } as PedidoRow;
}

const BATCH_SIZE_AJUSTES = 500;

/** Colunas de data usadas na classificação (valor numérico para ordenar). */
const SORT_DATE_COLUMN_IDS = ['emissao', 'data_original', 'previsao_anterior', 'previsao_atual', 'data_producao'];

/** Mapeamento coluna id -> chaves no row (espelhando o frontend). */
const SORT_COLUMN_KEYS: Record<string, string[]> = {
  observacoes: ['Observacoes', 'Observacoes ', 'Observações'],
  pd: ['PD'],
  cliente: ['Cliente'],
  cod: ['Cod'],
  descricao: ['Descricao do produto'],
  setor_producao: ['Setor de Producao', 'Setor de produção'],
  stauts: ['Stauts', 'Status'],
  uf: ['UF'],
  municipio: ['Municipio de entrega'],
  qtde_pendente_real: ['Qtde Pendente Real'],
  valor_pendente_real: ['Saldo a Faturar Real', 'Valor Pendente Real'],
  emissao: ['Emissao', 'emissao'],
  data_original: ['Data de entrega', 'dataParametro'],
  data_producao: ['data_producao'],
  data_base_entrega_futura: ['Data base entrega futura'],
};

function getSortValueBackend(row: PedidoRow, colId: string): string | number {
  if (SORT_DATE_COLUMN_IDS.includes(colId)) {
    if (colId === 'previsao_atual') {
      const d = row.previsao_entrega_atualizada ?? row.previsao_entrega;
      if (d == null) return Number.MAX_SAFE_INTEGER;
      const t = d instanceof Date ? d.getTime() : new Date(d as string).getTime();
      return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
    }
    if (colId === 'previsao_anterior') {
      const d = row.previsao_anterior ?? row.previsao_entrega;
      if (d == null) return Number.MAX_SAFE_INTEGER;
      const t = d instanceof Date ? d.getTime() : new Date(d as string).getTime();
      return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
    }
    const keys = SORT_COLUMN_KEYS[colId];
    if (keys) {
      const d = getDateFromRow(row, keys);
      if (d == null) return Number.MAX_SAFE_INTEGER;
      return d.getTime();
    }
    return Number.MAX_SAFE_INTEGER;
  }
  const keys = SORT_COLUMN_KEYS[colId];
  if (keys) {
    const s = getField(row, keys);
    return s === '' ? '' : s;
  }
  return '';
}

function comparePedidosBackend(
  a: PedidoRow,
  b: PedidoRow,
  levels: { id: string; dir: 'asc' | 'desc' }[]
): number {
  for (const { id, dir } of levels) {
    const va = getSortValueBackend(a, id);
    const vb = getSortValueBackend(b, id);
    let cmp: number;
    if (typeof va === 'number' && typeof vb === 'number') {
      cmp = va - vb;
    } else {
      cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
    }
    if (cmp !== 0) return dir === 'asc' ? cmp : -cmp;
  }
  return 0;
}

function applySortPedidos(resultado: PedidoRow[], sortLevels: { id: string; dir: 'asc' | 'desc' }[]): PedidoRow[] {
  if (!Array.isArray(sortLevels) || sortLevels.length === 0) return resultado;
  return [...resultado].sort((a, b) => comparePedidosBackend(a, b, sortLevels));
}

function getField(row: PedidoRow, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim().length > 0) return String(v).trim();
  }
  return '';
}

/** Mesma normalização de chave que o MPP usa (PD + Cod do Gerenciador). */
function chaveNegocioPedidoGestor(row: PedidoRow): string {
  const p = String(getField(row, ['PD', 'pd']) ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
  const c = String(getField(row, ['Cod', 'cod']) ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
  if (!p || !c) return '';
  return `${p}\x1e${c}`;
}

/**
 * TipoF (Categoria no Gerenciador): Requisição ou Inserir em Romaneio → no MPP a previsão vai para o fim da fila (2199-12-31).
 */
export function pedidoTipoFMppEmpurraPrevisaoParaFim(row: PedidoRow): boolean {
  const raw = getField(row, ['TipoF', 'tipoF']);
  const t = String(raw ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return false;
  if (t.includes('requisição') || t.includes('requisicao')) return true;
  if (t.includes('inserir em romaneio') || t.includes('inserir em romaneiro')) return true;
  return false;
}

function normalizarTextoRequisicao(s: string): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Linha classificada como requisição (TipoF ou rota/Observacoes). Excluída do Dash Entregas. */
export function pedidoEhRequisicao(row: PedidoRow): boolean {
  const tipoF = normalizarTextoRequisicao(getField(row, ['TipoF', 'tipoF']));
  if (tipoF.includes('requisicao')) return true;
  const obs = normalizarTextoRequisicao(
    getField(row, ['Observacoes', 'Observacoes ', 'Observações', 'observacoes'])
  );
  if (!obs) return false;
  if (obs.includes('requisicao')) return true;
  if (obs.startsWith('5-requisicao')) return true;
  return false;
}

/** Conjunto de chaves PD+Cod com linha do Gerenciador em uma dessas categorias (para o MPP). */
export function buildSetChavesPedidoCodMppPrevisaoFim(pedidos: PedidoRow[]): Set<string> {
  const s = new Set<string>();
  for (const row of pedidos) {
    if (!pedidoTipoFMppEmpurraPrevisaoParaFim(row)) continue;
    const k = chaveNegocioPedidoGestor(row);
    if (k) s.add(k);
  }
  return s;
}

/** Obtém data do row (suporta várias chaves; MySQL pode retornar camelCase ou como no SQL). */
function getDateFromRow(row: PedidoRow, keys: string[]): Date | null {
  for (const k of keys) {
    const v = row[k];
    if (v == null) continue;
    const d = v instanceof Date ? v : new Date(v as string);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

/** Parse YYYY-MM-DD como meia-noite local (evita problema de fuso nos filtros). */
function parseLocalDate(isoDateStr: string): Date {
  const parts = isoDateStr.trim().split('-').map(Number);
  if (parts.length >= 3 && parts[0] && parts[1] && parts[2]) {
    return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  }
  return new Date(isoDateStr);
}

/** Fim do dia local para data fim. */
function parseLocalDateEnd(isoDateStr: string): Date {
  const parts = isoDateStr.trim().split('-').map(Number);
  if (parts.length >= 3 && parts[0] && parts[1] && parts[2]) {
    return new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
  }
  const d = new Date(isoDateStr);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Comparação só pelo dia (ignora hora); retorna timestamp para comparação. */
function getDateOnlyTimestamp(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

const CACHE_PEDIDOS_TTL_MS = 90 * 1000; // 90 segundos
let cachePedidos: { data: PedidoRow[]; expiresAt: number } | null = null;
let cachePrevisaoPorPedidoId: { map: Map<number, string>; expiresAt: number } | null = null;
let cacheDataBasePorPedidoId: { map: Map<number, string>; expiresAt: number } | null = null;

/** Invalida o cache de pedidos (chamar após importação ou ajuste manual). */
export function invalidatePedidosCache(): void {
  cachePedidos = null;
  cachePrevisaoPorPedidoId = null;
  cacheDataBasePorPedidoId = null;
}

/** Mapa pd.id → previsão atual (YYYY-MM-DD). Uma carga / 90s — evita SQL do gerenciador por página. */
export async function getPrevisaoPorPedidoIdMap(): Promise<Map<number, string>> {
  const now = Date.now();
  if (cachePrevisaoPorPedidoId && cachePrevisaoPorPedidoId.expiresAt > now) {
    return cachePrevisaoPorPedidoId.map;
  }

  const acc = new Map<number, number>();

  if (cachePedidos && cachePedidos.expiresAt > now) {
    for (const p of cachePedidos.data) {
      const row = p as Record<string, unknown>;
      const pid = Number(row.id ?? row['id']);
      mergeMenorPrevisaoPorPedido(acc, pid, p.previsao_entrega_atualizada ?? p.previsao_entrega);
    }
  } else if (isNomusEnabled() && getNomusPool()) {
    const { data } = await listarPedidos({});
    for (const p of data) {
      const row = p as Record<string, unknown>;
      const pid = Number(row.id ?? row['id']);
      mergeMenorPrevisaoPorPedido(acc, pid, p.previsao_entrega_atualizada ?? p.previsao_entrega);
    }
  }

  const map = new Map<number, string>();
  for (const [pid, t] of acc) {
    map.set(pid, ymdFromTimestampMs(t));
  }
  cachePrevisaoPorPedidoId = { map, expiresAt: now + CACHE_PEDIDOS_TTL_MS };
  return map;
}

/**
 * Mapa pd.id → data base (YYYY-MM-DD): `data_producao` (preferencial) com fallback para previsão atual.
 * Uma carga / 90s — evita SQL do gerenciador por página.
 */
export async function getDataBasePorPedidoIdMap(): Promise<Map<number, string>> {
  const now = Date.now();
  if (cacheDataBasePorPedidoId && cacheDataBasePorPedidoId.expiresAt > now) {
    return cacheDataBasePorPedidoId.map;
  }

  const acc = new Map<number, number>();

  const add = (pid: number, val: unknown) => {
    mergeMenorPrevisaoPorPedido(acc, pid, val as any);
  };

  if (cachePedidos && cachePedidos.expiresAt > now) {
    for (const p of cachePedidos.data) {
      const row = p as Record<string, unknown>;
      const pid = Number(row.id ?? row['id']);
      const base = (p as any).data_producao ?? p.previsao_entrega_atualizada ?? p.previsao_entrega;
      add(pid, base);
    }
  } else if (isNomusEnabled() && getNomusPool()) {
    const { data } = await listarPedidos({});
    for (const p of data) {
      const row = p as Record<string, unknown>;
      const pid = Number(row.id ?? row['id']);
      const base = (p as any).data_producao ?? p.previsao_entrega_atualizada ?? p.previsao_entrega;
      add(pid, base);
    }
  }

  const map = new Map<number, string>();
  for (const [pid, t] of acc) {
    map.set(pid, ymdFromTimestampMs(t));
  }
  cacheDataBasePorPedidoId = { map, expiresAt: now + CACHE_PEDIDOS_TTL_MS };
  return map;
}

/** Separa valores de filtros multi-select (vírgula ou pipe, para compatibilidade entre telas). */
function splitMultiFilterParts(rawValue: string | undefined): string[] {
  if (!rawValue?.trim()) return [];
  return rawValue
    .split(/[,|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Aplica filtros e ordenação em uma lista de pedidos (usado com cache). */
function applyFiltrosPedidos(resultado: PedidoRow[], filtros: FiltrosPedidos): PedidoRow[] {
  /** Filtro multi-valor (vírgula): mantém linha se o campo bater com qualquer valor. */
  function filterByMultiText(
    list: PedidoRow[],
    rawValue: string | undefined,
    getFieldValue: (p: PedidoRow) => string
  ): PedidoRow[] {
    if (!rawValue?.trim()) return list;
    const parts = splitMultiFilterParts(rawValue);
    if (parts.length === 0) return list;
    if (parts.length === 1) {
      const match = criarMatcherTextoLivre(parts[0]!);
      return list.filter((p) => match(getFieldValue(p)));
    }
    const matchers = parts.map((t) => criarMatcherTextoLivre(t));
    return list.filter((p) => {
      const val = getFieldValue(p);
      return matchers.some((m) => m(val));
    });
  }

  /** Filtro multi-valor exato (Sim/Não): mantém linha se o campo estiver no conjunto (ignora acentos). */
  function filterByMultiExact(
    list: PedidoRow[],
    rawValue: string | undefined,
    getFieldValue: (p: PedidoRow) => string
  ): PedidoRow[] {
    if (!rawValue?.trim()) return list;
    const parts = splitMultiFilterParts(rawValue).map((s) => normalizarTextoBusca(s));
    if (parts.length === 0) return list;
    const set = new Set(parts);
    return list.filter((p) => {
      const v = normalizarTextoBusca(getFieldValue(p));
      return v && set.has(v);
    });
  }

  resultado = filterByMultiExact(resultado, filtros.cliente, (p) => p.cliente ?? '');
  resultado = filterByMultiText(resultado, filtros.observacoes, (p) =>
    getField(p, ['Observacoes', 'Observacoes ', 'observacoes', 'Observações'])
  );
  if (filtros.pd?.trim()) {
    const parts = splitMultiFilterParts(filtros.pd);
    if (parts.length > 1) {
      const set = new Set(parts.map((s) => normalizarTextoBusca(s)));
      resultado = resultado.filter((p) => {
        const pd = getField(p, ['PD', 'pd']);
        if (!pd) return false;
        const pdNorm = normalizarTextoBusca(pd);
        return set.has(pdNorm) || [...set].some((term) => pdNorm.includes(term) || term.includes(pdNorm));
      });
    } else {
      const termo = normalizarTextoBusca(filtros.pd.trim());
      resultado = resultado.filter((p) => {
        const pd = getField(p, ['PD', 'pd']);
        if (!pd) return false;
        const pdNorm = normalizarTextoBusca(pd);
        return pdNorm.includes(termo) || termo.includes(pdNorm);
      });
    }
  }
  resultado = filterByMultiExact(resultado, filtros.cod, (p) => getField(p, ['Cod', 'cod']));
  if (filtros.data_emissao_ini) {
    const ini = getDateOnlyTimestamp(parseLocalDate(filtros.data_emissao_ini));
    resultado = resultado.filter((p) => {
      const d = getDateFromRow(p, ['Emissao', 'emissao']);
      if (!d) return false;
      return getDateOnlyTimestamp(d) >= ini;
    });
  }
  if (filtros.data_emissao_fim) {
    const fim = getDateOnlyTimestamp(parseLocalDateEnd(filtros.data_emissao_fim));
    resultado = resultado.filter((p) => {
      const d = getDateFromRow(p, ['Emissao', 'emissao']);
      if (!d) return false;
      return getDateOnlyTimestamp(d) <= fim;
    });
  }
  if (filtros.data_entrega_ini) {
    const ini = getDateOnlyTimestamp(parseLocalDate(filtros.data_entrega_ini));
    resultado = resultado.filter((p) => {
      const d = getDateFromRow(p, ['Data de entrega', 'dataParametro', 'Data de Entrega']);
      if (!d) return false;
      return getDateOnlyTimestamp(d) >= ini;
    });
  }
  if (filtros.data_entrega_fim) {
    const fim = getDateOnlyTimestamp(parseLocalDateEnd(filtros.data_entrega_fim));
    resultado = resultado.filter((p) => {
      const d = getDateFromRow(p, ['Data de entrega', 'dataParametro', 'Data de Entrega']);
      if (!d) return false;
      return getDateOnlyTimestamp(d) <= fim;
    });
  }
  if (filtros.data_previsao_anterior_ini) {
    const ini = getDateOnlyTimestamp(parseLocalDate(filtros.data_previsao_anterior_ini));
    resultado = resultado.filter((p) => getDateOnlyTimestamp(new Date(p.previsao_entrega)) >= ini);
  }
  if (filtros.data_previsao_anterior_fim) {
    const fim = getDateOnlyTimestamp(parseLocalDateEnd(filtros.data_previsao_anterior_fim));
    resultado = resultado.filter((p) => getDateOnlyTimestamp(new Date(p.previsao_entrega)) <= fim);
  }
  if (filtros.data_ini) {
    const ini = getDateOnlyTimestamp(parseLocalDate(filtros.data_ini));
    resultado = resultado.filter((p) => getDateOnlyTimestamp(new Date(p.previsao_entrega_atualizada)) >= ini);
  }
  if (filtros.data_fim) {
    const fim = getDateOnlyTimestamp(parseLocalDateEnd(filtros.data_fim));
    resultado = resultado.filter((p) => getDateOnlyTimestamp(new Date(p.previsao_entrega_atualizada)) <= fim);
  }
  if (filtros.atrasados === true) {
    const hoje = getDateOnlyTimestamp(new Date());
    resultado = resultado.filter((p) => getDateOnlyTimestamp(new Date(p.previsao_entrega_atualizada)) < hoje);
  }
  resultado = filterByMultiText(resultado, filtros.grupo_produto, (p) =>
    getField(p, ['Grupo de produto', 'grupo de produto'])
  );
  resultado = filterByMultiText(resultado, filtros.subgrupo1, (p) =>
    getField(p, ['Subgrupo1', 'subgrupo1'])
  );
  resultado = filterByMultiText(resultado, filtros.subgrupo2, (p) =>
    getField(p, ['Subgrupo2', 'subgrupo2'])
  );
  resultado = filterByMultiText(resultado, filtros.setor_producao, (p) =>
    getField(p, ['Setor de Producao', 'Setor de produção'])
  );
  resultado = filterByMultiText(resultado, filtros.uf, (p) => getField(p, ['UF', 'uf']));
  resultado = filterByMultiText(resultado, filtros.municipio_entrega, (p) =>
    getField(p, ['Municipio de entrega', 'municipio de entrega'])
  );
  resultado = filterByMultiText(resultado, filtros.motivo, (p) => {
    const motivo = (p as PedidoRow & { motivo_ultimo_ajuste?: string | null }).motivo_ultimo_ajuste;
    return motivo != null ? String(motivo) : '';
  });
  resultado = filterByMultiText(resultado, filtros.vendedor, (p) =>
    getField(p, ['Vendedor/Representante', 'vendedor/representante'])
  );
  resultado = filterByMultiExact(resultado, filtros.tipo_f, (p) => getTipoFExibicao(p));
  resultado = filterByMultiExact(resultado, filtros.status, (p) => {
    let s = getField(p, ['Status', 'status']);
    if (!s) s = getField(p, ['StatusPedido', 'statusPedido']);
    if (!s) {
      const previsao = p.previsao_entrega_atualizada ?? p.previsao_entrega;
      const atrasado = previsao ? getDateOnlyTimestamp(new Date(previsao)) < getDateOnlyTimestamp(new Date()) : false;
      s = atrasado ? 'Atrasado' : 'Em dia';
    }
    return s;
  });
  resultado = filterByMultiExact(resultado, filtros.metodo, (p) =>
    getField(p, ['Metodo de Entrega', 'metodo de entrega'])
  );
  resultado = filterByMultiText(resultado, filtros.forma_pagamento, (p) =>
    getField(p, ['Forma de Pagamento', 'forma de pagamento'])
  );
  resultado = filterByMultiText(resultado, filtros.descricao_produto, (p) =>
    getField(p, ['Descricao do produto', 'descricao do produto', 'produto'])
  );
  resultado = filterByMultiExact(resultado, filtros.a_vista, (p) =>
    getField(p, ['Entrada/A vista Ate 10d', 'Entrada/A vista Ate 10d ', 'entrada/a vista ate 10d'])
  );
  resultado = filterByMultiExact(resultado, filtros.requisicao_loja, (p) =>
    getField(p, ['Requisicao de loja do grupo?', 'requisicao de loja do grupo?'])
  );
  if (filtros.faixa_atraso?.trim()) {
    const hojeFaixa = new Date();
    hojeFaixa.setHours(0, 0, 0, 0);
    resultado = resultado.filter((p) => pedidoNaFaixaAtraso(p, filtros.faixa_atraso!, hojeFaixa));
  }
  if (filtros.excluir_requisicao === true) {
    resultado = resultado.filter((p) => !pedidoEhRequisicao(p));
  }

  resultado.sort(
    (a, b) =>
      new Date(a.previsao_entrega_atualizada).getTime() - new Date(b.previsao_entrega_atualizada).getTime()
  );
  return resultado;
}

/** Lista pedidos do Nomus (read-only) + previsao_entrega_atualizada dos ajustes (SQLite). Usa cache 90s para filtros rápidos. */
export async function listarPedidos(filtros: FiltrosPedidos = {}): Promise<{
  data: PedidoRow[];
  total: number;
  erroConexao?: string;
}> {
  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) {
    return { data: [], total: 0, erroConexao: 'NOMUS_DB_URL não configurado' };
  }

  try {
    const now = Date.now();
    let resultado: PedidoRow[];

    if (cachePedidos && cachePedidos.expiresAt > now) {
      resultado = cachePedidos.data;
    } else {
      const [rows] = await pool.query(SQL_BASE_NOMUS);
      const list = (Array.isArray(rows) ? rows : []) as Record<string, unknown>[];
      const linhasLookup: LinhaLookup[] = list
        .map((r) => ({
          idChave: String(r['idChave'] ?? '').trim(),
          rota: String(r['Observacoes'] ?? r['Observações'] ?? '').trim(),
        }))
        .filter((l) => l.idChave !== '');
      const ajustePorId = await obterUltimoEPenultimoPorPedido(linhasLookup);
      const dataProducaoPorId = await obterDataProducaoPorPedido(linhasLookup);
      const versoesRegras = await obterVersoesParaClassificacao();
      resultado = list.map((r) => rowNomusToPedido(r, ajustePorId, versoesRegras, dataProducaoPorId));
      cachePedidos = { data: resultado, expiresAt: now + CACHE_PEDIDOS_TTL_MS };
      setLastSyncErp();
    }

    resultado = applyFiltrosPedidos(resultado, filtros);
    if (filtros.sort_levels?.length) {
      resultado = applySortPedidos(resultado, filtros.sort_levels);
    }
    resultado = await aplicarSinalizacaoCardPedidos(resultado);
    const total = resultado.length;
    const usePagination = filtros.page != null || filtros.limit != null;
    if (!usePagination) return { data: resultado, total };
    const page = Math.max(1, filtros.page ?? 1);
    const limit = Math.min(500, Math.max(1, filtros.limit ?? 100));
    const start = (page - 1) * limit;
    return { data: resultado.slice(start, start + limit), total };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[listarPedidos] Nomus/Prisma falhou:', msg);
    if (err instanceof Error && err.stack) console.error(err.stack);
    return { data: [], total: 0, erroConexao: msg };
  }
}

/** Resolve o nome canônico do PD no Nomus (ex.: "48466" → "PD 48466"). */
async function resolverNomePedidoEncerrados(pdTrim: string): Promise<string | null> {
  const pool = getNomusPool();
  if (!pool) return null;

  const [exactRows] = (await pool.query(
    `SELECT nome FROM pedido
     WHERE idEmpresa IN (1,2)
       AND UPPER(TRIM(nome)) = UPPER(TRIM(?))
     LIMIT 1`,
    [pdTrim],
  )) as [Array<{ nome: string }>, unknown];
  if (exactRows.length > 0) {
    const nome = String(exactRows[0].nome ?? '').trim();
    return nome || null;
  }

  const like = termoParaPadraoLikeSql(pdTrim);
  const [candidates] = (await pool.query(
    `SELECT nome FROM pedido
     WHERE idEmpresa IN (1,2)
       AND (
         nome LIKE ?
         OR REPLACE(REPLACE(UPPER(TRIM(nome)), 'PD ', ''), 'PD', '') = UPPER(TRIM(?))
       )
     ORDER BY
       CASE
         WHEN REPLACE(REPLACE(UPPER(TRIM(nome)), 'PD ', ''), 'PD', '') = UPPER(TRIM(?)) THEN 0
         WHEN UPPER(TRIM(nome)) LIKE UPPER(?) THEN 1
         ELSE 2
       END,
       dataEmissao DESC
     LIMIT 5`,
    [like, pdTrim, pdTrim, like],
  )) as [Array<{ nome: string }>, unknown];
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return String(candidates[0].nome).trim();

  const alvo = pdTrim.toUpperCase().replace(/^PD\s*/, '').trim();
  const match = candidates.find((r) => {
    const n = String(r.nome ?? '')
      .toUpperCase()
      .replace(/^PD\s*/, '')
      .trim();
    return n === alvo;
  });
  return String(match?.nome ?? candidates[0].nome).trim();
}

export interface PedidoEncerradoTypeaheadItem {
  id: number;
  nome: string;
  cliente: string | null;
  dataEmissao: string;
}

const PEDIDOS_ENCERRADOS_TYPEAHEAD_LIMITE = 40;

/** Typeahead de PDs com ao menos uma linha encerrada (status fora de Liberado/Atendido parcialmente). */
export async function buscarPedidosEncerradosTypeahead(termo: string): Promise<{
  data: PedidoEncerradoTypeaheadItem[];
  erro?: string;
}> {
  const q = termo.trim();
  if (q.length < 2) return { data: [] };

  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) {
    return { data: [], erro: 'NOMUS_DB_URL não configurado' };
  }

  const like = termoParaPadraoLikeSql(q);
  const sql = `
    SELECT DISTINCT pd.id, pd.nome, UPPER(pe.nome) AS cliente, pd.dataEmissao
    FROM pedido pd
    INNER JOIN itempedido ip ON ip.idPedido = pd.id AND ip.status NOT IN (2, 3)
    LEFT JOIN pessoa pe ON pe.id = pd.idCliente
    WHERE pd.idEmpresa IN (1, 2)
      AND (
        pd.nome LIKE ?
        OR REPLACE(REPLACE(UPPER(TRIM(pd.nome)), 'PD ', ''), 'PD', '') LIKE ?
      )
    ORDER BY pd.dataEmissao DESC, pd.id DESC
    LIMIT ${PEDIDOS_ENCERRADOS_TYPEAHEAD_LIMITE}`;

  try {
    const alvoLike = termoParaPadraoLikeSql(q.toUpperCase().replace(/^PD\s*/i, ''));
    const [rows] = (await pool.query(sql, [like, alvoLike])) as [
      Array<{ id: number; nome: string; cliente: string | null; dataEmissao: Date | string }>,
      unknown,
    ];
    const data = (Array.isArray(rows) ? rows : []).map((r) => ({
      id: Number(r.id),
      nome: String(r.nome ?? '').trim(),
      cliente: r.cliente != null ? String(r.cliente).trim() : null,
      dataEmissao:
        r.dataEmissao instanceof Date
          ? r.dataEmissao.toISOString().slice(0, 10)
          : String(r.dataEmissao ?? '').slice(0, 10),
    }));
    return { data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[buscarPedidosEncerradosTypeahead] Nomus falhou:', msg);
    return { data: [], erro: msg };
  }
}

/** Lista linhas encerradas (status ERP fora de Liberado/Atendido parcialmente) de um único PD. */
export async function listarPedidosEncerrados(pd: string): Promise<{
  data: PedidoRow[];
  total: number;
  erroConexao?: string;
}> {
  const pdTrim = pd.trim();
  if (!pdTrim) {
    return { data: [], total: 0 };
  }

  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) {
    return { data: [], total: 0, erroConexao: 'NOMUS_DB_URL não configurado' };
  }

  try {
    const pdNome = await resolverNomePedidoEncerrados(pdTrim);
    if (!pdNome) {
      return { data: [], total: 0 };
    }

    // Aliases com '?' no SQL (ex.: 'Requisicao de loja do grupo?') conflitam com placeholders do mysql2.
    const sqlEncerrados = SQL_PEDIDOS_ENCERRADOS_NOMUS.replace(
      '/*PD_ENCERRADOS_FILTER*/',
      mysql.escape(pdNome),
    );
    const [rows] = await pool.query(sqlEncerrados);
    const list = (Array.isArray(rows) ? rows : []) as Record<string, unknown>[];
    const linhasLookup: LinhaLookup[] = list
      .map((r) => ({
        idChave: String(r['idChave'] ?? '').trim(),
        rota: String(r['Observacoes'] ?? r['Observações'] ?? '').trim(),
      }))
      .filter((l) => l.idChave !== '');
    const ajustePorId = await obterUltimoEPenultimoPorPedido(linhasLookup);
    const dataProducaoPorId = await obterDataProducaoPorPedido(linhasLookup);
    const versoesRegras = await obterVersoesParaClassificacao();
    let resultado = list.map((r) => rowNomusToPedido(r, ajustePorId, versoesRegras, dataProducaoPorId));

    resultado.sort((a, b) => {
      const codCmp = getField(a, ['Cod', 'cod']).localeCompare(getField(b, ['Cod', 'cod']), undefined, {
        numeric: true,
      });
      if (codCmp !== 0) return codCmp;
      return getField(a, ['Observacoes', 'Observações']).localeCompare(
        getField(b, ['Observacoes', 'Observações']),
        undefined,
        { numeric: true }
      );
    });

    return { data: resultado, total: resultado.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[listarPedidosEncerrados] Nomus falhou:', msg);
    if (err instanceof Error && err.stack) console.error(err.stack);
    return { data: [], total: 0, erroConexao: msg };
  }
}

function ymdFromTimestampMs(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mergeMenorPrevisaoPorPedido(
  acc: Map<number, number>,
  pid: number,
  val: Date | string | null | undefined,
): void {
  if (!Number.isFinite(pid) || pid <= 0 || val == null) return;
  const t = val instanceof Date ? val.getTime() : new Date(val as string).getTime();
  if (Number.isNaN(t)) return;
  const cur = acc.get(pid);
  if (cur === undefined || t < cur) acc.set(pid, t);
}

/**
 * Previsão atual do Gerenciador por id de pedido Nomus (pd.id).
 * Subconjunto de {@link getPrevisaoPorPedidoIdMap} (cache compartilhado, sem SQL por lote de ids).
 */
export async function obterPrevisaoAtualizadaPorIdsPedido(idsPedido: number[]): Promise<Map<number, string>> {
  const idSet = new Set(idsPedido.filter((n) => Number.isFinite(n) && n > 0));
  if (idSet.size === 0) return new Map();

  const full = await getPrevisaoPorPedidoIdMap();
  const result = new Map<number, string>();
  for (const id of idSet) {
    const ymd = full.get(id);
    if (ymd) result.set(id, ymd);
  }
  return result;
}

/**
 * Data base (produção com fallback para previsão atual) por id de pedido Nomus (pd.id).
 * Subconjunto de {@link getDataBasePorPedidoIdMap} (cache compartilhado, sem SQL por lote de ids).
 */
export async function obterDataBasePorIdsPedido(idsPedido: number[]): Promise<Map<number, string>> {
  const idSet = new Set(idsPedido.filter((n) => Number.isFinite(n) && n > 0));
  if (idSet.size === 0) return new Map();

  const full = await getDataBasePorPedidoIdMap();
  const result = new Map<number, string>();
  for (const id of idSet) {
    const ymd = full.get(id);
    if (ymd) result.set(id, ymd);
  }
  return result;
}

/** Chaves para Saldo a Faturar Real no row (nomus/export). */
const KEYS_VALOR_PENDENTE_REAL = ['Saldo a Faturar Real', 'Valor Pendente Real', 'Valor Pendente', 'valor pendente real', 'valor pendente'];

function getPdPedidoRow(p: PedidoRow): string {
  return getField(p, ['PD', 'pd']).trim();
}

function getTipoFExibicao(p: PedidoRow): string {
  const t = getField(p, ['TipoF', 'tipoF']);
  if (t.trim()) return t.trim();
  const fallback = getTipoFString(p);
  return fallback.trim() || '—';
}

/** Resumo para o dashboard (total, entrega hoje, atrasados, lead time médio, totais por valor pendente real). Opcionalmente filtrado por observacoes (rota). */
export async function obterResumoDashboard(filtros: { observacoes?: string } = {}): Promise<{
  total: number;
  entregaHoje: number;
  atrasados: number;
  emDia: number;
  leadTimeMedioDias: number | null;
  totalValorPendenteReal: number;
  atrasadosValorPendenteReal: number;
  emDiaValorPendenteReal: number;
  entregaHojeValorPendenteReal: number;
  pctAtrasadoValor: number;
  totalPedidos: number;
  atrasadosPedidos: number;
  emDiaPedidos: number;
  entregaHojePedidos: number;
}> {
  const { data: pedidos } = await listarPedidos({ ...filtros, excluir_requisicao: true });
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  let entregaHoje = 0;
  let atrasados = 0;
  let emDia = 0;
  let somaDias = 0;
  let countDias = 0;
  let totalValorPendenteReal = 0;
  let atrasadosValorPendenteReal = 0;
  let emDiaValorPendenteReal = 0;
  let entregaHojeValorPendenteReal = 0;
  const pdsTotal = new Set<string>();
  const pdsAtrasados = new Set<string>();
  const pdsEmDia = new Set<string>();
  const pdsEntregaHoje = new Set<string>();

  for (const p of pedidos) {
    const valor = Math.max(0, getNumberFromRow(p, KEYS_VALOR_PENDENTE_REAL));
    totalValorPendenteReal += valor;
    const pd = getPdPedidoRow(p);
    if (pd) pdsTotal.add(pd);

    const atrasado = pedidoGradeEstaAtrasado(p);
    const previsaoAtual = new Date(p.previsao_entrega_atualizada);
    previsaoAtual.setHours(0, 0, 0, 0);
    if (previsaoAtual.getTime() === hoje.getTime()) {
      entregaHoje++;
      entregaHojeValorPendenteReal += valor;
      if (pd) pdsEntregaHoje.add(pd);
    }
    if (atrasado) {
      atrasados++;
      atrasadosValorPendenteReal += valor;
      if (pd) pdsAtrasados.add(pd);
    } else {
      emDia++;
      emDiaValorPendenteReal += valor;
      if (pd) pdsEmDia.add(pd);
    }
    const dias = diasAtePrevisaoOriginal(p, hoje);
    if (dias !== null) {
      somaDias += dias;
      countDias++;
    }
  }

  const pctAtrasadoValor =
    totalValorPendenteReal > 0
      ? Math.round((atrasadosValorPendenteReal / totalValorPendenteReal) * 100)
      : atrasados > 0
        ? Math.round((atrasados / Math.max(pedidos.length, 1)) * 100)
        : 0;

  return {
    total: pedidos.length,
    entregaHoje,
    atrasados,
    emDia,
    leadTimeMedioDias: countDias > 0 ? Math.round(somaDias / countDias) : null,
    totalValorPendenteReal,
    atrasadosValorPendenteReal,
    emDiaValorPendenteReal,
    entregaHojeValorPendenteReal,
    pctAtrasadoValor,
    totalPedidos: pdsTotal.size,
    atrasadosPedidos: pdsAtrasados.size,
    emDiaPedidos: pdsEmDia.size,
    entregaHojePedidos: pdsEntregaHoje.size,
  };
}

/** Valor numérico de uma coluna do row (suporta várias chaves). */
function getNumberFromRow(row: PedidoRow, keys: string[]): number {
  for (const k of keys) {
    const v = row[k];
    if (v == null) continue;
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return 0;
}

/** Busca valor numérico tentando chaves exatas e depois casamento case-insensitive nas chaves do row (MySQL pode devolver nomes em maiúsculas/minúsculas). */
function getNumberFromRowLoose(row: PedidoRow, keys: string[]): number {
  const exact = getNumberFromRow(row, keys);
  if (exact !== 0) return exact;
  const keyLower = keys.map((k) => k.toLowerCase());
  for (const k of Object.keys(row)) {
    if (keyLower.includes(k.toLowerCase())) {
      const v = row[k];
      if (v == null) continue;
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isNaN(n)) return n;
    }
  }
  return 0;
}

/** Retorna todos os pedidos sem paginação (para resumos/agregações). Garante totalidade dos dados. */
async function obterTodosPedidosParaResumo(filtros: FiltrosPedidos = {}): Promise<PedidoRow[]> {
  const opts: FiltrosPedidos = { ...filtros };
  if (opts.page !== undefined) delete opts.page;
  if (opts.limit !== undefined) delete opts.limit;
  const { data } = await listarPedidos(opts);
  return data;
}

/** Obtém string para classificação TipoF: coluna TipoF/tipoF ou fallback via Observacoes. */
function getTipoFString(row: PedidoRow): string {
  const t = getField(row, ['TipoF', 'tipoF']);
  if (t && String(t).trim()) return String(t).toLowerCase();
  const obs = getField(row, ['Observacoes', 'Observacoes ', 'Observações']);
  return (obs || '').toLowerCase();
}

/** Indica se a linha pertence ao TipoF "Retirada" (contém Retirada). */
function isTipoFRetirada(row: PedidoRow): boolean {
  return getTipoFString(row).includes('retirada');
}

/** Indica se a linha pertence ao TipoF "Entrega Grande Teresina". */
function isTipoFEntregaGrandeTeresina(row: PedidoRow): boolean {
  const t = getTipoFString(row);
  return t.includes('entrega') && t.includes('grande');
}

/** Indica se a linha pertence ao TipoF "Carradas" (ou Inserir em Romaneio / rota). */
function isTipoFCarradas(row: PedidoRow): boolean {
  const t = getTipoFString(row);
  return t.includes('carradas') || t.includes('inserir em romaneio') || t.includes('romaneio') || t.includes('rota');
}

export interface ResumoStatusPorTipoF {
  retirada: { total: number; emDia: number; percentual: number };
  entregaGrandeTeresina: { total: number; emDia: number; percentual: number };
  carradas: { total: number; emDia: number; percentual: number };
}

/** Resumo % Em dia por TipoF para os indicadores (Retirada, Entrega Grande Teresina, Carradas). */
export async function obterResumoStatusPorTipoF(filtros: FiltrosPedidos = {}): Promise<ResumoStatusPorTipoF> {
  const pedidos = await obterTodosPedidosParaResumo(filtros);
  let retiradaTotal = 0,
    retiradaEmDia = 0;
  let entregaTotal = 0,
    entregaEmDia = 0;
  let carradasTotal = 0,
    carradasEmDia = 0;

  for (const p of pedidos) {
    const status = (p['Status'] ?? p['status']) === 'Em dia';
    if (isTipoFRetirada(p)) {
      retiradaTotal++;
      if (status) retiradaEmDia++;
    } else if (isTipoFEntregaGrandeTeresina(p)) {
      entregaTotal++;
      if (status) entregaEmDia++;
    } else if (isTipoFCarradas(p)) {
      carradasTotal++;
      if (status) carradasEmDia++;
    }
  }

  const perc = (emDia: number, total: number) => (total > 0 ? Math.round((emDia / total) * 10000) / 100 : 0);
  return {
    retirada: { total: retiradaTotal, emDia: retiradaEmDia, percentual: perc(retiradaEmDia, retiradaTotal) },
    entregaGrandeTeresina: { total: entregaTotal, emDia: entregaEmDia, percentual: perc(entregaEmDia, entregaTotal) },
    carradas: { total: carradasTotal, emDia: carradasEmDia, percentual: perc(carradasEmDia, carradasTotal) },
  };
}

export interface LinhaTabelaStatusTipoF {
  tipoF: string;
  total: number;
  emDia: number;
  percentual: number;
}

/** Tabela detalhada por TipoF para diagnóstico: cada valor distinto de TipoF com total, emDia e %; totalGeral. */
export async function obterTabelaStatusPorTipoF(): Promise<{
  linhas: LinhaTabelaStatusTipoF[];
  totalGeral: number;
}> {
  const pedidos = await obterTodosPedidosParaResumo({});
  const mapa = new Map<string, { total: number; emDia: number }>();

  for (const p of pedidos) {
    const tipoF = getField(p, ['TipoF', 'tipoF']) || '(vazio)';
    const status = (p['Status'] ?? p['status']) === 'Em dia';
    const cur = mapa.get(tipoF) ?? { total: 0, emDia: 0 };
    cur.total++;
    if (status) cur.emDia++;
    mapa.set(tipoF, cur);
  }

  const perc = (emDia: number, total: number) => (total > 0 ? Math.round((emDia / total) * 10000) / 100 : 0);
  const linhas: LinhaTabelaStatusTipoF[] = [...mapa.entries()]
    .map(([tipoF, { total, emDia }]) => ({
      tipoF,
      total,
      emDia,
      percentual: perc(emDia, total),
    }))
    .sort((a, b) => b.total - a.total);

  return { linhas, totalGeral: pedidos.length };
}

/** Resumo financeiro para os 4 cards acima do dashboard. Usa a totalidade dos dados (sem paginação). */
export async function obterResumoFinanceiro(filtros: FiltrosPedidos = {}): Promise<{
  quantidadePedidos: number;
  quantidadePedidosCargasSeparadasMesmoClienteCidade: number;
  saldoFaturarPrazo: number;
  valorAdiantamento: number;
  saldoFaturar: number;
}> {
  const pedidos = await obterTodosPedidosParaResumo(filtros);
  const codigosPedidos = new Set<string>();
  const pedidosCargasSeparadasMesmoClienteCidade = new Set<string>();
  let saldoFaturarPrazo = 0;
  let valorAdiantamento = 0;
  let saldoFaturar = 0;

  const grupoCliCid = new Map<
    string,
    {
      rotas: Set<string>;
      pedidos: Set<string>;
    }
  >();

  for (const p of pedidos) {
    const pd = getField(p, ['PD', 'pd']);
    const cliente = String(p.cliente ?? '').trim() || '—';
    const municipio = String(getField(p, ['Municipio de entrega', 'municipio de entrega']) ?? '').trim();
    const uf = String(getField(p, ['UF', 'uf']) ?? '').trim().toUpperCase();
    const rotaRaw = String(getField(p, ['Observacoes', 'Observacoes ', 'Observações']) ?? '').trim();
    const rota = isSemRota(rotaRaw) ? 'SEM ROTA' : rotaRaw || 'SEM ROTA';

    if (municipio) {
      const key = `${cliente}||${municipio}||${uf}`;
      const cur = grupoCliCid.get(key) ?? { rotas: new Set<string>(), pedidos: new Set<string>() };
      cur.rotas.add(rota);
      if (pd) cur.pedidos.add(pd);
      grupoCliCid.set(key, cur);
    }
  }

  for (const v of grupoCliCid.values()) {
    if (v.rotas.size <= 1) continue;
    for (const pd of v.pedidos) pedidosCargasSeparadasMesmoClienteCidade.add(pd);
  }

  const keysValorPendente = ['Saldo a Faturar Real', 'Valor Pendente Real', 'Valor Pendente', 'valor pendente real', 'valor pendente'];
  const keysAdiantamentoRateio = ['valorAdiantamentoRateio', 'valor adiantamento rateio'];

  for (const p of pedidos) {
    const pd = getField(p, ['PD', 'pd']);
    if (pd) codigosPedidos.add(pd);

    const regra = getNumberFromRowLoose(p, ['regra', 'Regra']);
    const valorPendente = getNumberFromRowLoose(p, keysValorPendente);
    const adiantamentoRateio = getNumberFromRowLoose(p, keysAdiantamentoRateio);

    saldoFaturar += valorPendente;
    if (regra > 10) saldoFaturarPrazo += valorPendente;
    valorAdiantamento += adiantamentoRateio;
  }

  return {
    quantidadePedidos: codigosPedidos.size,
    quantidadePedidosCargasSeparadasMesmoClienteCidade: pedidosCargasSeparadasMesmoClienteCidade.size,
    saldoFaturarPrazo: Math.round(saldoFaturarPrazo * 100) / 100,
    valorAdiantamento: Math.round(valorAdiantamento * 100) / 100,
    saldoFaturar: Math.round(saldoFaturar * 100) / 100,
  };
}

/** Retorna segunda e sexta da semana da data (ou semana corrente se não informada). */
function getSemanaSegundaSexta(ref?: Date): { data_ini: string; data_fim: string } {
  const d = ref ?? new Date();
  const day = d.getDay();
  const seg = new Date(d);
  seg.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  const sex = new Date(seg);
  sex.setDate(seg.getDate() + 4);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    data_ini: `${seg.getFullYear()}-${pad(seg.getMonth() + 1)}-${pad(seg.getDate())}`,
    data_fim: `${sex.getFullYear()}-${pad(sex.getMonth() + 1)}-${pad(sex.getDate())}`,
  };
}

/** Lista datas (YYYY-MM-DD) entre data_ini e data_fim, apenas dias úteis (segunda a sexta). */
function listarDiasUteis(dataIni: string, dataFim: string): string[] {
  const ini = parseLocalDate(dataIni);
  const fim = parseLocalDate(dataFim);
  const out: string[] = [];
  const pad = (n: number) => String(n).padStart(2, '0');
  for (let d = new Date(ini); d <= fim; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day >= 1 && day <= 5) {
      out.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    }
  }
  return out;
}

/** Rotas que usam Valor Pendente - Adiantamento Rateio; demais usam Valor Romaneado - Adiantamento Rateio. */
function rotaUsaValorPendente(rota: string): boolean {
  const r = (rota || '').trim();
  return (
    r.startsWith('1-') ||
    r.startsWith('2-') ||
    r.startsWith('3-') ||
    r.startsWith('4-') ||
    r.startsWith('5-')
  );
}

export interface ResumoFinanceiroGradeCondicao {
  condicao: string;
  porData: Record<string, number>;
  total: number;
}

export interface ResumoFinanceiroGradeRota {
  rota: string;
  condicoes: ResumoFinanceiroGradeCondicao[];
  totalPorData: Record<string, number>;
  totalGeral: number;
}

export interface ResumoFinanceiroGradeResponse {
  datas: string[];
  rotas: ResumoFinanceiroGradeRota[];
  erroConexao?: string;
}

/**
 * MEMÓRIA DE CÁLCULO - Resumo Financeiro (grade)
 * ==============================================
 *
 * 1) Fonte dos dados
 *    - Listagem de pedidos (mesma base da aba Pedidos), sem paginação, com os mesmos filtros.
 *
 * 2) Agrupamento
 *    - Linhas: agrupado por Rota (coluna Observações) e, dentro da rota, por Condição de Pagamento.
 *    - Colunas: uma coluna por dia útil no período (segunda a sexta), mais coluna "Total Geral".
 *    - Período das colunas: data_ini e data_fim (padrão = semana corrente seg–sex).
 *
 * 3) Data usada para alocar o valor na coluna
 *    - Previsão Atual (previsao_entrega_atualizada) do registro.
 *    - Só entram na soma os registros cuja Previsão Atual está dentro do período (data_ini a data_fim).
 *
 * 4) Fórmula do valor (por linha de pedido)
 *    - Valor exibido = Valor Romaneado - ((Valor Romaneado / Valor Pendente) * Valor Adiantamento)
 *    - Onde:
 *      • Valor Romaneado: valor romaneado da linha (coluna do ERP/Nomus).
 *      • Valor Pendente: valor pendente da linha (coluna do ERP/Nomus).
 *      • Valor Adiantamento: valor total do adiantamento do pedido (coluna do ERP/Nomus).
 *    - Se Valor Pendente = 0: usa Valor Romaneado - Valor Adiantamento (evita divisão por zero).
 *    - O valor é limitado a >= 0 antes de somar (Math.max(0, valor)).
 *
 * 5) Agregação
 *    - Para cada (Rota, Condição de Pagamento, data): soma dos "Valor exibido" de todas as linhas
 *      que tenham essa rota, essa condição e Previsão Atual = data.
 *    - Total por data = soma dos valores daquela data em todas as (rota, condição).
 *    - Total Geral da linha = soma dos valores em todas as datas do período.
 *
 * 6) Exibição
 *    - Todas as rotas/condições que aparecem nos pedidos filtrados entram na grade (valor 0,00 quando não há soma).
 */
export async function obterResumoFinanceiroGrade(
  filtros: FiltrosPedidos = {}
): Promise<ResumoFinanceiroGradeResponse> {
  const { page: _p, limit: _l, data_ini: _di, data_fim: _df, ...filtrosListagem } = filtros as {
    page?: number;
    limit?: number;
    data_ini?: string;
    data_fim?: string;
    [k: string]: unknown;
  };
  const { data: pedidos, erroConexao } = await listarPedidos(filtrosListagem as FiltrosPedidos);
  if (erroConexao) {
    return { datas: [], rotas: [], erroConexao };
  }

  const dataIni = filtros.data_ini ?? getSemanaSegundaSexta().data_ini;
  const dataFim = filtros.data_fim ?? getSemanaSegundaSexta().data_fim;
  const datas = listarDiasUteis(dataIni, dataFim);
  const setDatas = new Set(datas);

  const keysValorRomaneado = ['Valor Romaneado', 'valor romaneado'];
  const keysValorPendente = ['Saldo a Faturar Real', 'Valor Pendente Real', 'Valor Pendente', 'valor pendente real', 'valor pendente'];
  const keysValorAdiantamento = ['Valor Adiantamento', 'valor adiantamento'];
  const keyCondicao = 'Condicao de pagamento do pedido de venda';

  type KeyRotaCond = string;
  const porRotaCond: Map<
    KeyRotaCond,
    { rota: string; condicao: string; porData: Record<string, number>; total: number }
  > = new Map();

  function getKey(rota: string, condicao: string): KeyRotaCond {
    return `${rota}\t${condicao}`;
  }

  /** Primeiro: registrar todas as (rota, condição) que existem nos pedidos, para que todas as rotas apareçam na grade. */
  for (const p of pedidos) {
    const rota = getField(p, ['Observacoes', 'Observacoes ', 'Observações']).trim() || 'Sem Rota';
    const condicao =
      (p[keyCondicao] != null ? String(p[keyCondicao]) : getField(p, [keyCondicao])).trim() || 'Sem Condição';
    const key = getKey(rota, condicao);
    if (!porRotaCond.has(key)) {
      const porData: Record<string, number> = {};
      for (const d of datas) porData[d] = 0;
      porRotaCond.set(key, { rota, condicao, porData, total: 0 });
    }
  }

  /** Segundo: somar valores pela Previsão Atual (previsao_entrega_atualizada) no período das colunas. */
  for (const p of pedidos) {
    const rota = getField(p, ['Observacoes', 'Observacoes ', 'Observações']).trim() || 'Sem Rota';
    const condicao =
      (p[keyCondicao] != null ? String(p[keyCondicao]) : getField(p, [keyCondicao])).trim() || 'Sem Condição';
    const rawPrevisao = p.previsao_entrega_atualizada ?? p.previsao_entrega;
    const dataPrevisao =
      rawPrevisao instanceof Date
        ? rawPrevisao
        : rawPrevisao != null
          ? new Date(rawPrevisao as string)
          : null;
    const dataStr =
      dataPrevisao && !Number.isNaN(dataPrevisao.getTime())
        ? `${dataPrevisao.getFullYear()}-${String(dataPrevisao.getMonth() + 1).padStart(2, '0')}-${String(dataPrevisao.getDate()).padStart(2, '0')}`
        : '';
    if (!dataStr || !setDatas.has(dataStr)) continue;

    const valorRomaneado = getNumberFromRowLoose(p, keysValorRomaneado);
    const valorPendente = getNumberFromRowLoose(p, keysValorPendente);
    const valorAdiantamento = getNumberFromRowLoose(p, keysValorAdiantamento);
    // Fórmula: Valor Romaneado - ((Valor Romaneado / Valor Pendente) * Valor Adiantamento)
    let valor: number;
    if (valorPendente > 0) {
      valor = valorRomaneado - (valorRomaneado / valorPendente) * valorAdiantamento;
    } else {
      valor = valorRomaneado - valorAdiantamento;
    }
    const rounded = Math.round(Math.max(0, valor) * 100) / 100;

    const key = getKey(rota, condicao);
    const row = porRotaCond.get(key);
    if (row) {
      row.porData[dataStr] = (row.porData[dataStr] ?? 0) + rounded;
      row.total += rounded;
    }
  }

  const rotasOrder = new Map<string, ResumoFinanceiroGradeRota>();
  for (const [, row] of porRotaCond) {
    let rotaRow = rotasOrder.get(row.rota);
    if (!rotaRow) {
      rotaRow = {
        rota: row.rota,
        condicoes: [],
        totalPorData: {},
        totalGeral: 0,
      };
      rotasOrder.set(row.rota, rotaRow);
    }
    rotaRow.condicoes.push({
      condicao: row.condicao,
      porData: row.porData,
      total: Math.round(row.total * 100) / 100,
    });
    for (const [d, v] of Object.entries(row.porData)) {
      rotaRow.totalPorData[d] = (rotaRow.totalPorData[d] ?? 0) + v;
    }
    rotaRow.totalGeral += row.total;
  }
  for (const rotaRow of rotasOrder.values()) {
    rotaRow.totalGeral = Math.round(rotaRow.totalGeral * 100) / 100;
    for (const k of Object.keys(rotaRow.totalPorData)) {
      rotaRow.totalPorData[k] = Math.round(rotaRow.totalPorData[k] * 100) / 100;
    }
  }

  const rotas = [...rotasOrder.values()].sort((a, b) => a.rota.localeCompare(b.rota));
  return { datas, rotas, erroConexao: undefined };
}

/** Resumo por Observacoes (quantidade de pedidos). */
export async function obterResumoObservacoes(): Promise<ObservacaoResumo[]> {
  const { data: pedidos } = await listarPedidos({});
  const contador = new Map<string, number>();
  for (const p of pedidos) {
    const obsRaw = p['Observacoes'] ?? p['Observacoes '] ?? p['Observacoes'] ?? 'Sem Observacoes';
    const obs = String(obsRaw || 'Sem Observacoes').trim() || 'Sem Observacoes';
    contador.set(obs, (contador.get(obs) ?? 0) + 1);
  }
  return [...contador.entries()]
    .map(([observacao, quantidade]) => ({ observacao, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade);
}

export interface ObservacaoValorResumo {
  observacao: string;
  quantidade: number;
  valorTotal: number;
  valorAtrasado: number;
  valorEmDia: number;
  quantidadeAtrasada: number;
}

export interface AgingFaixaResumo {
  faixa: string;
  label: string;
  valor: number;
  quantidade: number;
}

export interface ClienteAtrasadoResumo {
  cliente: string;
  valorAtrasado: number;
  quantidade: number;
}

export interface ConcentracaoResumo {
  label: string;
  valor: number;
  quantidade: number;
}

export interface DashEntregasAnalytics {
  resumo: Awaited<ReturnType<typeof obterResumoDashboard>>;
  rotas: ObservacaoValorResumo[];
  aging: AgingFaixaResumo[];
  topClientesAtrasados: ClienteAtrasadoResumo[];
  concentracao: {
    porGrupoProduto: ConcentracaoResumo[];
    porSubgrupo1: ConcentracaoResumo[];
    porSubgrupo2: ConcentracaoResumo[];
    porSetorProducao: ConcentracaoResumo[];
  };
}

const AGING_FAIXAS: { faixa: string; label: string }[] = [
  { faixa: 'em_dia', label: 'Em dia' },
  { faixa: 'atraso_1_7', label: '1–7 dias' },
  { faixa: 'atraso_8_15', label: '8–15 dias' },
  { faixa: 'atraso_16_30', label: '16–30 dias' },
  { faixa: 'atraso_31_60', label: '31–60 dias' },
  { faixa: 'atraso_60_mais', label: '60+ dias' },
];

function getObservacaoPedido(p: PedidoRow): string {
  const obsRaw = p['Observacoes'] ?? p['Observacoes '] ?? 'Sem Observacoes';
  return String(obsRaw || 'Sem Observacoes').trim() || 'Sem Observacoes';
}

/** Agregações do Dash Entregas em uma única passagem (reutiliza cache de listarPedidos). */
export async function obterDashEntregasAnalytics(): Promise<DashEntregasAnalytics> {
  const { data: pedidos } = await listarPedidos({ excluir_requisicao: true });
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const concentracaoGrupo = new Map<string, { valor: number; quantidade: number }>();
  const concentracaoSub1 = new Map<string, { valor: number; quantidade: number }>();
  const concentracaoSub2 = new Map<string, { valor: number; quantidade: number }>();
  const concentracaoSetor = new Map<string, { valor: number; quantidade: number }>();

  let entregaHoje = 0;
  let atrasados = 0;
  let emDia = 0;
  let somaDias = 0;
  let countDias = 0;
  let totalValorPendenteReal = 0;
  let atrasadosValorPendenteReal = 0;
  let emDiaValorPendenteReal = 0;
  let entregaHojeValorPendenteReal = 0;
  const pdsTotal = new Set<string>();
  const pdsAtrasados = new Set<string>();
  const pdsEmDia = new Set<string>();
  const pdsEntregaHoje = new Set<string>();

  const rotasMap = new Map<string, ObservacaoValorResumo>();
  const agingMap = new Map<string, { valor: number; quantidade: number }>(
    AGING_FAIXAS.map((f) => [f.faixa, { valor: 0, quantidade: 0 }])
  );
  const clientesMap = new Map<string, { valorAtrasado: number; quantidade: number }>();

  function addConcentracao(map: Map<string, { valor: number; quantidade: number }>, labelRaw: string, valor: number) {
    const label = labelRaw.trim() || '—';
    const cur = map.get(label) ?? { valor: 0, quantidade: 0 };
    cur.valor += valor;
    cur.quantidade++;
    map.set(label, cur);
  }

  for (const p of pedidos) {
    const valor = Math.max(0, getNumberFromRow(p, KEYS_VALOR_PENDENTE_REAL));
    totalValorPendenteReal += valor;
    const pd = getPdPedidoRow(p);
    if (pd) pdsTotal.add(pd);

    addConcentracao(concentracaoGrupo, getField(p, ['Grupo de produto', 'grupo de produto']), valor);
    addConcentracao(concentracaoSub1, getField(p, ['Subgrupo1', 'subgrupo1']), valor);
    addConcentracao(concentracaoSub2, getField(p, ['Subgrupo2', 'subgrupo2']), valor);
    addConcentracao(concentracaoSetor, getField(p, ['Setor de Producao', 'Setor de produção']), valor);

    const atrasado = pedidoGradeEstaAtrasado(p);
    const obs = getObservacaoPedido(p);

    let rota = rotasMap.get(obs);
    if (!rota) {
      rota = {
        observacao: obs,
        quantidade: 0,
        valorTotal: 0,
        valorAtrasado: 0,
        valorEmDia: 0,
        quantidadeAtrasada: 0,
      };
      rotasMap.set(obs, rota);
    }
    rota.quantidade++;
    rota.valorTotal += valor;
    if (atrasado) {
      rota.valorAtrasado += valor;
      rota.quantidadeAtrasada++;
    } else {
      rota.valorEmDia += valor;
    }

    const previsaoAtual = new Date(p.previsao_entrega_atualizada);
    previsaoAtual.setHours(0, 0, 0, 0);
    if (previsaoAtual.getTime() === hoje.getTime()) {
      entregaHoje++;
      entregaHojeValorPendenteReal += valor;
      if (pd) pdsEntregaHoje.add(pd);
    }
    if (atrasado) {
      atrasados++;
      atrasadosValorPendenteReal += valor;
      if (pd) pdsAtrasados.add(pd);
      const cliente = String(p.cliente ?? '').trim() || '—';
      const cli = clientesMap.get(cliente) ?? { valorAtrasado: 0, quantidade: 0 };
      cli.valorAtrasado += valor;
      cli.quantidade++;
      clientesMap.set(cliente, cli);
    } else {
      emDia++;
      emDiaValorPendenteReal += valor;
      if (pd) pdsEmDia.add(pd);
    }

    for (const { faixa } of AGING_FAIXAS) {
      if (pedidoNaFaixaAtraso(p, faixa, hoje)) {
        const ag = agingMap.get(faixa)!;
        ag.valor += valor;
        ag.quantidade++;
      }
    }

    const dias = diasAtePrevisaoOriginal(p, hoje);
    if (dias !== null) {
      somaDias += dias;
      countDias++;
    }
  }

  const pctAtrasadoValor =
    totalValorPendenteReal > 0
      ? Math.round((atrasadosValorPendenteReal / totalValorPendenteReal) * 100)
      : atrasados > 0
        ? Math.round((atrasados / Math.max(pedidos.length, 1)) * 100)
        : 0;

  const rotas = [...rotasMap.values()].sort((a, b) => b.valorTotal - a.valorTotal);
  const aging = AGING_FAIXAS.map(({ faixa, label }) => {
    const ag = agingMap.get(faixa)!;
    return { faixa, label, valor: ag.valor, quantidade: ag.quantidade };
  });
  const topClientesAtrasados = [...clientesMap.entries()]
    .map(([cliente, v]) => ({ cliente, valorAtrasado: v.valorAtrasado, quantidade: v.quantidade }))
    .sort((a, b) => b.valorAtrasado - a.valorAtrasado)
    .slice(0, 10);

  const buildConcentracao = (map: Map<string, { valor: number; quantidade: number }>): ConcentracaoResumo[] => {
    const rows = [...map.entries()]
      .map(([label, v]) => ({ label, valor: v.valor, quantidade: v.quantidade }))
      .sort((a, b) => b.valor - a.valor);
    const max = 12;
    if (rows.length <= max) return rows;
    const top = rows.slice(0, max - 1);
    const outros = rows.slice(max - 1).reduce(
      (acc, r) => {
        acc.valor += r.valor;
        acc.quantidade += r.quantidade;
        return acc;
      },
      { label: 'Outros', valor: 0, quantidade: 0 }
    );
    return [...top, outros];
  };

  return {
    resumo: {
      total: pedidos.length,
      entregaHoje,
      atrasados,
      emDia,
      leadTimeMedioDias: countDias > 0 ? Math.round(somaDias / countDias) : null,
      totalValorPendenteReal,
      atrasadosValorPendenteReal,
      emDiaValorPendenteReal,
      entregaHojeValorPendenteReal,
      pctAtrasadoValor,
      totalPedidos: pdsTotal.size,
      atrasadosPedidos: pdsAtrasados.size,
      emDiaPedidos: pdsEmDia.size,
      entregaHojePedidos: pdsEntregaHoje.size,
    },
    rotas,
    aging,
    topClientesAtrasados,
    concentracao: {
      porGrupoProduto: buildConcentracao(concentracaoGrupo),
      porSubgrupo1: buildConcentracao(concentracaoSub1),
      porSubgrupo2: buildConcentracao(concentracaoSub2),
      porSetorProducao: buildConcentracao(concentracaoSetor),
    },
  };
}

export interface TipoFValorResumo {
  tipoF: string;
  valor: number;
  quantidade: number;
}

function getPrevisaoOriginalPedido(row: PedidoRow): Date | null {
  const raw = row.previsao_entrega;
  if (raw == null) return null;
  const d = raw instanceof Date ? new Date(raw) : new Date(raw as string);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function diasAtePrevisaoOriginal(p: PedidoRow, hoje: Date): number | null {
  const d = getPrevisaoOriginalPedido(p);
  if (!d) return null;
  return Math.round((d.getTime() - hoje.getTime()) / (24 * 60 * 60 * 1000));
}

export interface TipoFLeadTimeResumo {
  tipoF: string;
  leadTimeMedioDias: number;
  quantidade: number;
}

/** Lead time médio (dias até previsão original) por TipoF — drill-down lead time nível 1. */
export async function obterDashEntregasLeadTimeTipoF(): Promise<TipoFLeadTimeResumo[]> {
  const { data: pedidos } = await listarPedidos({ excluir_requisicao: true });
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const map = new Map<string, { somaDias: number; count: number }>();
  for (const p of pedidos) {
    const dias = diasAtePrevisaoOriginal(p, hoje);
    if (dias === null) continue;
    const label = getTipoFExibicao(p);
    const cur = map.get(label) ?? { somaDias: 0, count: 0 };
    cur.somaDias += dias;
    cur.count++;
    map.set(label, cur);
  }
  return [...map.entries()]
    .map(([tipoF, v]) => ({
      tipoF,
      leadTimeMedioDias: Math.round(v.somaDias / v.count),
      quantidade: v.count,
    }))
    .sort((a, b) => b.leadTimeMedioDias - a.leadTimeMedioDias);
}

/** Saldo pendente por TipoF dentro de uma faixa de aging (drill-down nível 1). */
export async function obterDashEntregasAgingTipoF(faixaAtraso: string): Promise<TipoFValorResumo[]> {
  const faixa = faixaAtraso.trim().toLowerCase();
  const { data: pedidos } = await listarPedidos({ faixa_atraso: faixa, excluir_requisicao: true });
  const map = new Map<string, { valor: number; quantidade: number }>();
  for (const p of pedidos) {
    const label = getTipoFExibicao(p);
    const valor = Math.max(0, getNumberFromRow(p, KEYS_VALOR_PENDENTE_REAL));
    const cur = map.get(label) ?? { valor: 0, quantidade: 0 };
    cur.valor += valor;
    cur.quantidade++;
    map.set(label, cur);
  }
  return [...map.entries()]
    .map(([tipoF, v]) => ({ tipoF, valor: v.valor, quantidade: v.quantidade }))
    .sort((a, b) => b.valor - a.valor);
}

const MAX_DETALHES_TOOLTIP = 80;

/** Rota "4 - Inserir em Romaneio" = sem rota definida. */
function isSemRota(rota: string): boolean {
  const r = (rota || '').trim();
  return r.includes('Inserir em Romaneio') || r === '4 - Inserir em Romaneio';
}

/** Corrige UF conhecida quando o ERP envia município com estado errado (ex.: São Luís,PI → MA; Belém,AM → PA). */
function corrigirUFMunicipio(municipio: string, uf: string): string {
  const m = (municipio || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const u = (uf || '').trim().toUpperCase();
  if ((m === 'sao luis' || m === 'sao luís') && u === 'PI') return 'MA';
  if (m === 'belem' && u === 'AM') return 'PA';
  return u;
}

export type CorBolhaMapa = 'vermelho' | 'verde' | 'amarelo' | 'roxo' | 'preto';

/** Define cor da bolha (igual ao BI): preto (2+ rotas e pedidos sem rota), roxo (2+ rotas), vermelho (sem rota), amarelo (com rota mas pedidos não alocados), verde (todos mesma rota). */
function definirCorBolha(totalItens: number, countSemRota: number, numRotasDistintas: number): CorBolhaMapa {
  if (totalItens === 0) return 'verde';
  if (numRotasDistintas > 1 && countSemRota > 0) return 'preto';
  if (countSemRota === totalItens) return 'vermelho';
  if (countSemRota > 0) return 'amarelo';
  if (numRotasDistintas > 1) return 'roxo';
  return 'verde';
}

export interface TooltipDetalheRow {
  rm: string;
  rota: string;
  dataEmissao: string;
  pedido: string;
  municipio: string;
  aVista: string;
  valorPendente: number;
  codigo: string;
  produto: string;
  /** Quantidade unitária pendente (coluna Qtde Pendente Real do ERP). */
  qtdePendenteReal: number;
}

export interface MunicipioAgregadoMapa {
  municipio: string;
  uf: string;
  valorPendente: number;
  detalhes: TooltipDetalheRow[];
  cor: CorBolhaMapa;
}

/** Agregação por município com detalhes e cor da bolha (Rota, Pedido, Código, Produto, Valor Pendente). Usa todos os pedidos (sem paginação) para bater com resumo do SQL/Excel. */
async function obterAgregacaoPorMunicipioComDetalhes(filtros: FiltrosPedidos = {}): Promise<MunicipioAgregadoMapa[]> {
  const { data: pedidos } = await listarPedidos(filtros);
  const map = new Map<
    string,
    {
      municipio: string;
      uf: string;
      valor: number;
      detalhes: TooltipDetalheRow[];
      countSemRota: number;
      totalItens: number;
      rotasDistintas: Set<string>;
    }
  >();
  for (const p of pedidos) {
    const municipio = getField(p, ['Municipio de entrega', 'municipio de entrega']);
    const ufBruto = getField(p, ['UF', 'uf']);
    const uf = corrigirUFMunicipio(municipio, ufBruto);
    if (!municipio || municipio.toLowerCase().includes('retirada') || municipio.toLowerCase().includes('inserir')) continue;
    const valorRaw = p['Saldo a Faturar Real'] ?? p['Valor Pendente Real'] ?? p['Valor Pendente'] ?? 0;
    const valor = Number(valorRaw);
    if (Number.isNaN(valor)) continue;
    if (valor < 0) continue;
    const key = `${municipio.trim()}|${uf}`;
    const rm = getField(p, ['RM', 'rm']);
    const rota = getField(p, ['Observacoes', 'Observacoes ', 'Observações']);
    const emissaoRaw = p['Emissao'] ?? getField(p, ['Emissao', 'emissao']);
    const dataEmissao = emissaoRaw ? (typeof emissaoRaw === 'string' ? emissaoRaw : new Date(emissaoRaw as Date).toISOString().slice(0, 10)) : '';
    const pedido = getField(p, ['PD', 'pd']);
    const municipioRow = getField(p, ['Municipio de entrega', 'municipio de entrega']);
    const aVista = getField(p, ['Entrada/A vista Ate 10d', 'Entrada/A vista Ate 10d ', 'entrada/a vista ate 10d']);
    const codigo = getField(p, ['Cod', 'cod']);
    const produto = getField(p, ['Descricao do produto', 'descricao do produto']);
    const qtdePendenteReal = getNumberFromRowLoose(p, ['Qtde Pendente Real', 'qtde pendente real']);
    const row: TooltipDetalheRow = {
      rm,
      rota,
      dataEmissao,
      pedido,
      municipio: municipioRow,
      aVista,
      valorPendente: valor,
      codigo,
      produto,
      qtdePendenteReal,
    };
    const semRota = isSemRota(rota);
    const cur = map.get(key);
    if (cur) {
      cur.valor += valor;
      cur.totalItens += 1;
      if (cur.detalhes.length < MAX_DETALHES_TOOLTIP) cur.detalhes.push(row);
      if (semRota) cur.countSemRota += 1;
      else if (rota) cur.rotasDistintas.add(rota);
    } else {
      const rotasDistintas = new Set<string>();
      if (!semRota && rota) rotasDistintas.add(rota);
      map.set(key, {
        municipio: municipio.trim(),
        uf,
        valor,
        detalhes: [row],
        countSemRota: semRota ? 1 : 0,
        totalItens: 1,
        rotasDistintas,
      });
    }
  }
  return [...map.values()].map(({ municipio, uf, valor, detalhes, countSemRota, totalItens, rotasDistintas }) => ({
    municipio,
    uf,
    valorPendente: valor,
    detalhes,
    cor: definirCorBolha(totalItens, countSemRota, rotasDistintas.size),
  }));
}

export interface MapaMunicipioItem {
  /** Chave no formato Município,UF,Brasil (ex.: Teresina,PI,Brasil) — usada para apontar no mapa. */
  chave: string;
  municipio: string;
  uf: string;
  valorPendente: number;
  lat: number;
  lng: number;
  detalhes: TooltipDetalheRow[];
  cor: CorBolhaMapa;
}

export interface MapaMunicipiosResponse {
  itens: MapaMunicipioItem[];
  semCoordenadas: { chave: string; municipio: string; uf: string; valorPendente: number }[];
}

export interface MapaMunicipioDetalhesResponse {
  chave: string;
  municipio: string;
  uf: string;
  valorPendente: number;
  detalhes: TooltipDetalheRow[];
  /** Quantidade de linhas de pedido no município (pode ser > detalhes.length no mapa resumido). */
  totalLinhas: number;
}

export interface CargasSeparadasMesmoClienteCidadeResponse {
  /** Quantidade de pedidos (PD distintos) em cargas separadas, para o mesmo cliente e a mesma cidade. */
  quantidadePedidos: number;
  detalhes: TooltipDetalheRow[];
}

/**
 * Retorna a lista (completa) de linhas que pertencem a grupos (cliente + cidade + UF) onde existam
 * 2+ cargas (rotas/observações) distintas, e a quantidade de pedidos (PD) distintos nesses grupos.
 *
 * Observação: "SEM ROTA" conta como uma carga.
 */
export async function obterCargasSeparadasMesmoClienteCidade(
  filtros: FiltrosPedidos = {}
): Promise<CargasSeparadasMesmoClienteCidadeResponse> {
  const { data: pedidos } = await listarPedidos(filtros);

  const grupos = new Map<
    string,
    {
      rotas: Set<string>;
      pedidos: Set<string>;
    }
  >();

  for (const p of pedidos) {
    const cliente = String(p.cliente ?? '').trim() || '—';
    const municipioRow = getField(p, ['Municipio de entrega', 'municipio de entrega']);
    const ufBruto = getField(p, ['UF', 'uf']);
    const municipio = String(municipioRow ?? '').trim();
    if (!municipio || municipio.toLowerCase().includes('retirada') || municipio.toLowerCase().includes('inserir')) continue;
    const uf = corrigirUFMunicipio(municipio, String(ufBruto ?? ''));
    const obs = getField(p, ['Observacoes', 'Observacoes ', 'Observações']);
    const rotaRaw = String(obs ?? '').trim();
    const rota = isSemRota(rotaRaw) ? 'SEM ROTA' : rotaRaw || 'SEM ROTA';
    const pd = getField(p, ['PD', 'pd']);

    const key = `${cliente}||${municipio}||${uf}`;
    const cur = grupos.get(key) ?? { rotas: new Set<string>(), pedidos: new Set<string>() };
    cur.rotas.add(rota);
    if (pd) cur.pedidos.add(String(pd).trim());
    grupos.set(key, cur);
  }

  const gruposValidos = new Set<string>();
  const pedidosSet = new Set<string>();
  for (const [k, v] of grupos.entries()) {
    if (v.rotas.size <= 1) continue;
    gruposValidos.add(k);
    for (const pd of v.pedidos) pedidosSet.add(pd);
  }

  const detalhes: TooltipDetalheRow[] = [];
  const keysValorPendente = ['Saldo a Faturar Real', 'Valor Pendente Real', 'Valor Pendente', 'valor pendente real', 'valor pendente'];

  for (const p of pedidos) {
    const cliente = String(p.cliente ?? '').trim() || '—';
    const municipioRow = getField(p, ['Municipio de entrega', 'municipio de entrega']);
    const ufBruto = getField(p, ['UF', 'uf']);
    const municipio = String(municipioRow ?? '').trim();
    if (!municipio || municipio.toLowerCase().includes('retirada') || municipio.toLowerCase().includes('inserir')) continue;
    const uf = corrigirUFMunicipio(municipio, String(ufBruto ?? ''));
    const groupKey = `${cliente}||${municipio}||${uf}`;
    if (!gruposValidos.has(groupKey)) continue;

    const valor = getNumberFromRowLoose(p, keysValorPendente);
    if (!Number.isFinite(valor) || valor < 0) continue;
    const rm = getField(p, ['RM', 'rm']);
    const rota = getField(p, ['Observacoes', 'Observacoes ', 'Observações']);
    const emissaoRaw = p['Emissao'] ?? getField(p, ['Emissao', 'emissao']);
    const dataEmissao = emissaoRaw
      ? typeof emissaoRaw === 'string'
        ? emissaoRaw
        : new Date(emissaoRaw as Date).toISOString().slice(0, 10)
      : '';
    const pedido = getField(p, ['PD', 'pd']);
    const aVista = getField(p, ['Entrada/A vista Ate 10d', 'Entrada/A vista Ate 10d ', 'entrada/a vista ate 10d']);
    const codigo = getField(p, ['Cod', 'cod']);
    const produto = getField(p, ['Descricao do produto', 'descricao do produto']);
    const qtdePendenteReal = getNumberFromRowLoose(p, ['Qtde Pendente Real', 'qtde pendente real']);

    detalhes.push({
      rm,
      rota,
      dataEmissao,
      pedido,
      municipio: municipioRow,
      aVista,
      valorPendente: valor,
      codigo,
      produto,
      qtdePendenteReal,
    });
  }

  return { quantidadePedidos: pedidosSet.size, detalhes };
}

/** Detalhes completos de um município (sem limite de 80) para simulação de carga na roteirização. */
export async function obterDetalhesCompletosMunicipioMapa(
  filtros: FiltrosPedidos,
  chaveAlvo: string
): Promise<MapaMunicipioDetalhesResponse | null> {
  const chaveNorm = (chaveAlvo || '').trim();
  if (!chaveNorm) return null;
  const { data: pedidos } = await listarPedidos(filtros);
  const detalhes: TooltipDetalheRow[] = [];
  let municipio = '';
  let uf = '';
  let valorPendente = 0;
  let totalLinhas = 0;
  for (const p of pedidos) {
    const municipioRow = getField(p, ['Municipio de entrega', 'municipio de entrega']);
    const ufBruto = getField(p, ['UF', 'uf']);
    const ufCor = corrigirUFMunicipio(municipioRow, ufBruto);
    if (!municipioRow || municipioRow.toLowerCase().includes('retirada') || municipioRow.toLowerCase().includes('inserir')) {
      continue;
    }
    const chave = chaveLocal(municipioRow.trim(), ufCor);
    if (chave !== chaveNorm) continue;
    const valorRaw = p['Saldo a Faturar Real'] ?? p['Valor Pendente Real'] ?? p['Valor Pendente'] ?? 0;
    const valor = Number(valorRaw);
    if (Number.isNaN(valor) || valor < 0) continue;
    municipio = municipioRow.trim();
    uf = ufCor;
    valorPendente += valor;
    totalLinhas += 1;
    const rm = getField(p, ['RM', 'rm']);
    const rota = getField(p, ['Observacoes', 'Observacoes ', 'Observações']);
    const emissaoRaw = p['Emissao'] ?? getField(p, ['Emissao', 'emissao']);
    const dataEmissao = emissaoRaw
      ? typeof emissaoRaw === 'string'
        ? emissaoRaw
        : new Date(emissaoRaw as Date).toISOString().slice(0, 10)
      : '';
    const pedido = getField(p, ['PD', 'pd']);
    const aVista = getField(p, ['Entrada/A vista Ate 10d', 'Entrada/A vista Ate 10d ', 'entrada/a vista ate 10d']);
    const codigo = getField(p, ['Cod', 'cod']);
    const produto = getField(p, ['Descricao do produto', 'descricao do produto']);
    const qtdePendenteReal = getNumberFromRowLoose(p, ['Qtde Pendente Real', 'qtde pendente real']);
    detalhes.push({
      rm,
      rota,
      dataEmissao,
      pedido,
      municipio: municipioRow,
      aVista,
      valorPendente: valor,
      codigo,
      produto,
      qtdePendenteReal,
    });
  }
  if (totalLinhas === 0) return null;
  return { chave: chaveNorm, municipio, uf, valorPendente, detalhes, totalLinhas };
}

/** Agregação por município com coordenadas; cada ponto é identificado pela chave "Município,UF,Brasil". */
export async function obterMapaMunicipios(filtros: FiltrosPedidos = {}): Promise<MapaMunicipiosResponse> {
  const agregados = await obterAgregacaoPorMunicipioComDetalhes(filtros);
  const itens: MapaMunicipioItem[] = [];
  const semCoordenadas: { chave: string; municipio: string; uf: string; valorPendente: number }[] = [];
  for (const a of agregados) {
    const chave = chaveLocal(a.municipio, a.uf);
    const coords = geocodeFromCache(a.municipio, a.uf) ?? await geocodeMunicipio(a.municipio, a.uf);
    if (coords) {
      itens.push({ ...a, chave, lat: coords.lat, lng: coords.lng });
    } else {
      semCoordenadas.push({ chave, municipio: a.municipio, uf: a.uf, valorPendente: a.valorPendente });
    }
  }
  return { itens, semCoordenadas };
}

export interface FiltrosOpcoes {
  rotas: string[];
  categorias: string[];
  status: string[];
  metodos: string[];
  ufs: string[];
  municipios: string[];
  formasPagamento: string[];
  gruposProduto: string[];
  pds: string[];
  setores: string[];
  vendedores: string[];
  clientes: string[];
  codigos: string[];
}

/** Retorna valores distintos para os filtros (lista de pedidos e heatmap). */
export async function obterFiltrosOpcoes(): Promise<FiltrosOpcoes> {
  const { data: pedidos } = await listarPedidos({});
  const rotasSet = new Set<string>();
  const categoriasSet = new Set<string>();
  const statusSet = new Set<string>();
  const metodosSet = new Set<string>();
  const ufsSet = new Set<string>();
  const municipiosSet = new Set<string>();
  const formasPagamentoSet = new Set<string>();
  const gruposProdutoSet = new Set<string>();
  const pdsSet = new Set<string>();
  const setoresSet = new Set<string>();
  const vendedoresSet = new Set<string>();
  const clientesSet = new Set<string>();
  const codigosSet = new Set<string>();

  for (const p of pedidos) {
    const rota = getField(p, ['Observacoes', 'Observacoes ', 'Observações']);
    if (rota) rotasSet.add(rota);

    const cat = getField(p, ['tipoF', 'tipo_f']);
    if (cat) categoriasSet.add(cat);

    let s = getField(p, ['Status', 'status']);
    if (!s) s = getField(p, ['StatusPedido', 'statusPedido']);
    if (!s) {
      const previsao = p.previsao_entrega_atualizada ?? p.previsao_entrega;
      const atrasado = previsao ? getDateOnlyTimestamp(new Date(previsao)) < getDateOnlyTimestamp(new Date()) : false;
      s = atrasado ? 'Atrasado' : 'Em dia';
    }
    statusSet.add(s);

    const metodo = getField(p, ['Metodo de Entrega', 'metodo de entrega']);
    if (metodo) metodosSet.add(metodo);

    const uf = getField(p, ['UF', 'uf']);
    if (uf) ufsSet.add(uf);

    const municipio = getField(p, ['Municipio de entrega', 'municipio de entrega']);
    if (municipio) municipiosSet.add(municipio);

    const formaPag = getField(p, ['Forma de Pagamento', 'forma de pagamento']);
    if (formaPag) formasPagamentoSet.add(formaPag);

    const grupo = getField(p, ['Grupo de produto', 'grupo de produto']);
    if (grupo) gruposProdutoSet.add(grupo);

    const pd = getField(p, ['PD', 'pd']);
    if (pd) pdsSet.add(pd);

    const setor = getField(p, ['Setor de Producao', 'Setor de produção']);
    if (setor) setoresSet.add(setor);

    const vendedor = getField(p, ['Vendedor/Representante', 'vendedor/representante']);
    if (vendedor) vendedoresSet.add(vendedor);

    const cliente = p.cliente ?? '';
    if (cliente) clientesSet.add(cliente);

    const cod = getField(p, ['Cod', 'cod']);
    if (cod) codigosSet.add(cod);
  }

  return {
    rotas: [...rotasSet].sort(),
    categorias: [...categoriasSet].sort(),
    status: [...statusSet].sort(),
    metodos: [...metodosSet].sort(),
    ufs: [...ufsSet].sort(),
    municipios: [...municipiosSet].sort(),
    formasPagamento: [...formasPagamentoSet].sort(),
    gruposProduto: [...gruposProdutoSet].sort(),
    pds: [...pdsSet].sort(),
    setores: [...setoresSet].sort(),
    vendedores: [...vendedoresSet].sort(),
    clientes: [...clientesSet].sort(),
    codigos: [...codigosSet].sort(),
  };
}

/** Normaliza data para meio-dia UTC (evita dia a menos em fuso ao exibir). */
function toNoonUTC(d: Date): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  return new Date(Date.UTC(y, m, day, 12, 0, 0, 0));
}

/**
 * Grava ajuste no SQLite (não altera o Nomus).
 *
 * Granularidade:
 *   - `rota` omitido/null/'' -> ajuste BASE (vale em todas as rotas em que o (PD, item) aparecer).
 *   - `rota` informado       -> override APENAS naquela rota (armazenado normalizado).
 */
export async function registrarAjustePrevisao(
  idPedido: string,
  previsaoNova: Date,
  motivo: string,
  usuario: string,
  observacao?: string | null,
  rota?: string | null,
  previsaoConfiavel = true
): Promise<void> {
  const dataNormalizada = toNoonUTC(previsaoNova);
  const idNorm = (idPedido ?? '').trim();
  const rotaNorm = normalizeRotaForChave(rota);
  await prisma.$transaction(async (tx) => {
    await tx.pedidoPrevisaoAjuste.create({
      data: {
        id_pedido: idNorm,
        rota: rotaNorm ? rotaNorm : null,
        previsao_nova: dataNormalizada,
        motivo,
        observacao: observacao ?? null,
        usuario,
        previsao_confiavel: previsaoConfiavel,
      },
    });
  });
  // A lista de pedidos cacheia previsao_entrega_atualizada por 90s.
  // Sem invalidar aqui, o histórico mostra a alteração antes da coluna "Previsão atual".
  invalidatePedidosCache();
}

/**
 * Última previsão "efetiva" por (id_pedido, rota) — usada apenas para deduplicar inserts no lote.
 * Respeita a hierarquia override > base do (PD, item).
 */
async function obterUltimaPrevisaoPorChave(
  chaves: { id_pedido: string; rota: string | null }[]
): Promise<Map<string, Date>> {
  if (chaves.length === 0) return new Map();
  const rows = await prisma.pedidoPrevisaoAjuste.findMany({
    select: { id_pedido: true, rota: true, previsao_nova: true },
    orderBy: [{ data_ajuste: 'desc' }, { id: 'desc' }],
  });
  // canon -> base mais recente
  const baseByCanon = new Map<string, Date>();
  // canon -> rota_norm -> override mais recente
  const overrideByCanonRota = new Map<string, Map<string, Date>>();
  for (const r of rows) {
    const canon = chavePedidoItem(String(r.id_pedido ?? '').trim());
    if (!canon) continue;
    const rotaNorm = normalizeRotaForChave(r.rota);
    if (!rotaNorm) {
      if (!baseByCanon.has(canon)) baseByCanon.set(canon, r.previsao_nova);
    } else {
      let byRota = overrideByCanonRota.get(canon);
      if (!byRota) {
        byRota = new Map<string, Date>();
        overrideByCanonRota.set(canon, byRota);
      }
      if (!byRota.has(rotaNorm)) byRota.set(rotaNorm, r.previsao_nova);
    }
  }
  const map = new Map<string, Date>();
  for (const k of chaves) {
    const idNorm = String(k.id_pedido ?? '').trim();
    if (!idNorm) continue;
    const canon = chavePedidoItem(idNorm);
    const rotaNorm = normalizeRotaForChave(k.rota);
    const dOverride = rotaNorm ? overrideByCanonRota.get(canon)?.get(rotaNorm) : undefined;
    const dBase = baseByCanon.get(canon);
    const efetiva = dOverride ?? dBase;
    if (efetiva) {
      const mapKey = `${idNorm}|${rotaNorm}`;
      map.set(mapKey, efetiva);
    }
  }
  return map;
}

/** Mapa id_pedido (idChave) → Observações/rota atual no Gerenciador (para importação gravar override). */
export async function obterMapaRotaPorIdPedido(ids: string[]): Promise<Map<string, string>> {
  const idsNorm = [...new Set(ids.map((id) => String(id ?? '').trim()).filter(Boolean))];
  const map = new Map<string, string>();
  if (idsNorm.length === 0) return map;

  const alvoExato = new Set(idsNorm);
  const alvoCanon = new Map<string, string>();
  for (const id of idsNorm) {
    const c = chavePedidoItem(id);
    if (c && !alvoCanon.has(c)) alvoCanon.set(c, id);
  }

  const { data } = await listarPedidos({});
  for (const p of data) {
    const row = p as Record<string, unknown>;
    const id = String(p.id_pedido ?? row['idChave'] ?? '').trim();
    if (!id) continue;
    const canon = chavePedidoItem(id);
    const idAlvo = alvoExato.has(id) ? id : alvoCanon.get(canon);
    if (!idAlvo) continue;
    const rota = String(row['Observacoes'] ?? row['Observações'] ?? row['Rota'] ?? '').trim();
    if (rota) map.set(idAlvo, rota);
  }
  return map;
}

export interface AjusteLoteItem {
  id_pedido: string;
  previsao_nova: Date;
  motivo: string;
  observacao?: string | null;
  /** Quando informado, grava como override apenas para esta rota. Caso contrário, grava como base. */
  rota?: string | null;
  /** Quando false, não exibe no histórico dos cards Comunicação Interna. Default true. */
  previsao_confiavel?: boolean;
}

export interface RegistrarAjustesLoteResult {
  ok: number;
  erros: Array<{ id_pedido: string; erro: string }>;
  /** Ajustes efetivamente aplicados */
  applied?: Array<{ id_pedido: string; previsao_nova: string; motivo: string }>;
}

/**
 * Registra vários ajustes em uma única transação (createMany).
 * Ignora itens cuja previsão já é a mesma (evita linhas duplicadas no histórico).
 * Cada item pode trazer `rota` para gravar como override por rota (ou omitir para ajuste base).
 */
export async function registrarAjustesPrevisaoLote(
  ajustes: AjusteLoteItem[],
  usuario: string
): Promise<RegistrarAjustesLoteResult> {
  if (ajustes.length === 0) {
    return { ok: 0, erros: [] };
  }

  // Para deduplicar precisamos saber a previsão efetiva ATUAL por (id_pedido, rota).
  const chaves = ajustes.map((a) => ({ id_pedido: a.id_pedido, rota: a.rota ?? null }));
  const ultimaPrevisaoPorChave = await obterUltimaPrevisaoPorChave(chaves);

  const toDateOnly = (d: Date) => new Date(d).toISOString().slice(0, 10);
  const toInsert: {
    id_pedido: string;
    rota: string | null;
    previsao_nova: Date;
    motivo: string;
    observacao: string | null;
    previsao_confiavel: boolean;
  }[] = [];
  let skipped = 0;

  for (const a of ajustes) {
    const idNorm = (a.id_pedido ?? '').trim();
    const rotaNorm = normalizeRotaForChave(a.rota);
    const rotaParaGravar = rotaNorm ? rotaNorm : null;
    const nova = new Date(a.previsao_nova);
    const mapKey = `${idNorm}|${rotaNorm}`;
    const atual = ultimaPrevisaoPorChave.get(mapKey);
    if (atual && toDateOnly(atual) === toDateOnly(nova)) {
      skipped += 1;
      continue;
    }
    const observacao = a.observacao != null && String(a.observacao).trim() !== '' ? String(a.observacao).trim() : null;
    toInsert.push({
      id_pedido: idNorm,
      rota: rotaParaGravar,
      previsao_nova: toNoonUTC(nova),
      motivo: a.motivo,
      observacao,
      previsao_confiavel: a.previsao_confiavel !== false,
    });
  }

  try {
    if (toInsert.length > 0) {
      const dataAjusteRequest = new Date();
      await prisma.pedidoPrevisaoAjuste.createMany({
        data: toInsert.map((a) => ({
          id_pedido: a.id_pedido,
          rota: a.rota,
          previsao_nova: a.previsao_nova,
          motivo: a.motivo,
          observacao: a.observacao,
          usuario,
          data_ajuste: dataAjusteRequest,
          previsao_confiavel: a.previsao_confiavel,
        })),
      });
      // Mantém a grade de Gestão de Pedidos consistente imediatamente após ajuste em lote.
      invalidatePedidosCache();
    }
    const applied = toInsert.map((a) => ({
      id_pedido: a.id_pedido,
      previsao_nova: toDateOnly(a.previsao_nova),
      motivo: a.motivo,
    }));
    return { ok: toInsert.length + skipped, erros: [], applied };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao registrar ajuste em lote';
    return {
      ok: 0,
      erros: ajustes.map((a) => ({ id_pedido: a.id_pedido, erro: msg })),
    };
  }
}

export interface DataProducaoLoteItem {
  id_pedido: string;
  data_producao: Date;
}

export interface RegistrarDataProducaoLoteResult {
  ok: number;
  erros: Array<{ id_pedido: string; erro: string }>;
}

/**
 * Registra a data de produção de vários pedidos em uma transação (createMany, append-only).
 * Ignora itens cuja data de produção efetiva atual já é a mesma (evita linhas duplicadas).
 */
export async function registrarDataProducaoLote(
  itens: DataProducaoLoteItem[],
  usuario: string
): Promise<RegistrarDataProducaoLoteResult> {
  if (itens.length === 0) return { ok: 0, erros: [] };

  const toDateOnly = (d: Date) => new Date(d).toISOString().slice(0, 10);

  // Data de produção efetiva atual por canon (para deduplicar).
  const atuaisPorCanon = new Map<string, Date>();
  try {
    const rows = await prisma.pedidoDataProducao.findMany({
      select: { id: true, id_pedido: true, data_producao: true, data_registro: true },
      orderBy: [{ data_registro: 'desc' }, { id: 'desc' }],
    });
    for (const r of rows) {
      const canon = chavePedidoItem(String(r.id_pedido ?? '').trim());
      if (!canon || atuaisPorCanon.has(canon)) continue;
      atuaisPorCanon.set(canon, parseDateFromDb(r.data_producao));
    }
  } catch (err) {
    console.error('[registrarDataProducaoLote] leitura falhou:', err instanceof Error ? err.message : err);
  }

  const toInsert: { id_pedido: string; data_producao: Date }[] = [];
  let skipped = 0;
  for (const it of itens) {
    const idNorm = String(it.id_pedido ?? '').trim();
    if (!idNorm) continue;
    const nova = new Date(it.data_producao);
    if (Number.isNaN(nova.getTime())) continue;
    const atual = atuaisPorCanon.get(chavePedidoItem(idNorm));
    if (atual && toDateOnly(atual) === toDateOnly(nova)) {
      skipped += 1;
      continue;
    }
    toInsert.push({ id_pedido: idNorm, data_producao: toNoonUTC(nova) });
  }

  try {
    if (toInsert.length > 0) {
      const dataRegistro = new Date();
      await prisma.pedidoDataProducao.createMany({
        data: toInsert.map((a) => ({
          id_pedido: a.id_pedido,
          data_producao: a.data_producao,
          usuario,
          data_registro: dataRegistro,
        })),
      });
      invalidatePedidosCache();
    }
    return { ok: toInsert.length + skipped, erros: [] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao registrar data de produção em lote';
    return { ok: 0, erros: itens.map((a) => ({ id_pedido: a.id_pedido, erro: msg })) };
  }
}

/** Busca um pedido por id (lista Nomus + ajuste). Compara com id exato; se não achar, pela chave canônica pedido+item (mesma linha após mudança de carrada). */
export async function buscarPedidoPorId(idPedido: string): Promise<PedidoRow | null> {
  const idNorm = (idPedido ?? '').trim();
  const { data: pedidos } = await listarPedidos({});
  const exact = pedidos.find((p) => (p.id_pedido ?? '').trim() === idNorm);
  if (exact) return exact;
  const canon = chavePedidoItem(idNorm);
  if (!canon) return null;
  return pedidos.find((p) => chavePedidoItem(String(p.id_pedido ?? '')) === canon) ?? null;
}

function parseJsonArrayLocal(value: string | null | undefined): string[] | null {
  if (value == null || String(value).trim() === '') return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.map((x) => String(x ?? '').trim()).filter(Boolean);
  } catch {
    return null;
  }
}

function normalizePdDigitsLocal(pd: string): string {
  const s = String(pd ?? '').trim();
  const digits = s.replace(/\D+/g, '');
  return digits || s;
}

function orderNumberMatchesPd(orderNumber: string, pd: string): boolean {
  const ord = String(orderNumber ?? '').trim();
  const rowPd = String(pd ?? '').trim();
  if (!ord || !rowPd) return false;
  if (ord.toLowerCase() === rowPd.toLowerCase()) return true;
  return normalizePdDigitsLocal(ord) === normalizePdDigitsLocal(rowPd);
}

function sycroOrderCoversIdPedido(
  itemIdsJson: string | null | undefined,
  idPedidoCanon: string
): boolean {
  const ids = parseJsonArrayLocal(itemIdsJson ?? null);
  if (!ids || ids.length === 0) return true;
  return ids.some((id) => chavePedidoItem(id) === idPedidoCanon);
}

/** Eventos TAG DISPONÍVEL da Comunicação Interna vinculados a este id_pedido (por PD + itens do card). */
export async function listarEventosTagDisponivelHistorico(idPedido: string): Promise<
  {
    id: number;
    usuario: string;
    data_ajuste: Date;
    tag_disponivel: boolean;
  }[]
> {
  const idNorm = (idPedido ?? '').trim();
  if (!idNorm) return [];
  const canon = chavePedidoItem(idNorm);
  const pedido = await buscarPedidoPorId(idNorm);
  if (!pedido) return [];
  const pd = getField(pedido, ['PD', 'pd']);
  if (!pd) return [];

  const orders = await prisma.sycroOrderOrder.findMany({
    select: { id: true, order_number: true, item_ids_json: true },
  });
  const orderIds = orders
    .filter((o) => orderNumberMatchesPd(o.order_number, pd))
    .filter((o) => sycroOrderCoversIdPedido(o.item_ids_json, canon))
    .map((o) => o.id);
  if (orderIds.length === 0) return [];

  const history = await prisma.sycroOrderHistory.findMany({
    where: {
      order_id: { in: orderIds },
      action_type: { in: ['TAG_DISPONIVEL_TRUE', 'TAG_DISPONIVEL_FALSE'] },
    },
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
  });

  return history.map((h) => ({
    id: h.id,
    usuario: h.user_name?.trim() || '—',
    data_ajuste: h.created_at,
    tag_disponivel: h.action_type === 'TAG_DISPONIVEL_TRUE',
  }));
}

/** Comentários (diálogo) da Comunicação Interna vinculados ao PD deste id_pedido. */
export async function listarComentariosSycroHistorico(idPedido: string): Promise<
  {
    id: number;
    usuario: string;
    data_ajuste: Date;
    comentario: string;
    action_type: string;
  }[]
> {
  const idNorm = (idPedido ?? '').trim();
  if (!idNorm) return [];
  const pedido = await buscarPedidoPorId(idNorm);
  if (!pedido) return [];
  const pd = getField(pedido, ['PD', 'pd']);
  if (!pd) return [];

  const orders = await prisma.sycroOrderOrder.findMany({
    select: { id: true, order_number: true },
  });
  const orderIds = orders.filter((o) => orderNumberMatchesPd(o.order_number, pd)).map((o) => o.id);
  if (orderIds.length === 0) return [];

  const history = await prisma.sycroOrderHistory.findMany({
    where: {
      order_id: { in: orderIds },
      action_type: { in: ['CREATE', 'UPDATE'] },
    },
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
  });

  return history
    .filter((h) => h.observation != null && String(h.observation).trim() !== '')
    .map((h) => ({
      id: h.id,
      usuario: h.user_name?.trim() || '—',
      data_ajuste: h.created_at,
      comentario: String(h.observation).trim(),
      action_type: h.action_type,
    }));
}

/**
 * Converte valor de data vindo do SQLite para Date.
 * Aceita: ISO string, número (timestamp ms), string numérica, string com separador de milhares (ex.: 1.771.934.400.000).
 */
function parseDateFromDb(val: unknown): Date {
  if (val == null) return new Date(0);
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? new Date(0) : val;
  if (typeof val === 'number' && Number.isFinite(val)) {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? new Date(0) : d;
  }
  const s = String(val).trim();
  if (!s) return new Date(0);
  // Número com separador de milhares (ex.: 1.771.934.400.000)
  const numStr = s.replace(/\./g, '');
  if (/^\d+$/.test(numStr)) {
    const d = new Date(Number(numStr));
    return Number.isNaN(d.getTime()) ? new Date(0) : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

export type OpcoesListarHistoricoAjustes = {
  /** Quando true, retorna só ajustes com previsao_confiavel (histórico Comunicação Interna). */
  apenasPrevisaoConfiavel?: boolean;
};

/** Histórico de ajustes por pedido (SQLite). Agrupa pela chave canônica pedido+item para incluir registros gravados com id_chave antigo (outra carrada). */
export async function listarHistoricoAjustes(
  idPedido: string,
  opcoes?: OpcoesListarHistoricoAjustes
): Promise<{
  id: number;
  id_pedido: string;
  previsao_nova: Date;
  motivo: string;
  observacao: string | null;
  usuario: string;
  data_ajuste: Date;
  previsao_confiavel: boolean;
}[]> {
  const idNorm = (idPedido ?? '').trim();
  if (!idNorm) return [];
  const canon = chavePedidoItem(idNorm);

  const mapRow = (r: {
    id: number;
    id_pedido: string;
    previsao_nova: unknown;
    motivo: string;
    observacao: string | null;
    usuario: string;
    data_ajuste: unknown;
    previsao_confiavel: boolean;
  }) => ({
    id: r.id,
    id_pedido: r.id_pedido,
    previsao_nova: parseDateFromDb(r.previsao_nova),
    motivo: r.motivo,
    observacao: r.observacao,
    usuario: r.usuario,
    data_ajuste: parseDateFromDb(r.data_ajuste),
    previsao_confiavel: r.previsao_confiavel !== false,
  });

  type Row = {
    id: number;
    id_pedido: string;
    previsao_nova: unknown;
    motivo: string;
    observacao: string | null;
    usuario: string;
    data_ajuste: unknown;
    previsao_confiavel: boolean;
  };
  let rows: Row[] = [];

  try {
    const todos = await prisma.pedidoPrevisaoAjuste.findMany({
      orderBy: [{ data_ajuste: 'desc' }, { id: 'desc' }],
    });
    rows = todos
      .filter((r) => chavePedidoItem(String(r.id_pedido ?? '').trim()) === canon)
      .map((r) => ({
        id: r.id,
        id_pedido: r.id_pedido,
        previsao_nova: r.previsao_nova,
        motivo: r.motivo,
        observacao: r.observacao,
        usuario: r.usuario,
        data_ajuste: r.data_ajuste,
        previsao_confiavel: r.previsao_confiavel !== false,
      })) as Row[];
  } catch (_) {
    rows = [];
  }

  let result = rows.map(mapRow);
  if (opcoes?.apenasPrevisaoConfiavel) {
    result = result.filter((r) => r.previsao_confiavel);
  }
  return result;
}

export interface FiltrosRelatorioAlteracoes {
  data_ini?: string;
  data_fim?: string;
  id_pedido?: string;
  cliente?: string;
}

export interface RegistroAlteracaoRelatorio {
  id: number;
  id_pedido: string;
  cliente: string;
  previsao_nova: Date;
  motivo: string;
  observacao: string | null;
  usuario: string;
  data_ajuste: Date;
}

/**
 * Lista registros de alteração para relatório, com filtros por período, pedido e cliente.
 * Enriquece com nome do cliente via base Nomus.
 */
export async function listarAlteracoesParaRelatorio(
  filtros: FiltrosRelatorioAlteracoes
): Promise<RegistroAlteracaoRelatorio[]> {
  const where: { id_pedido?: string | { in: string[] }; data_ajuste?: { gte?: Date; lte?: Date } } = {};

  if (filtros.data_ini) {
    const gte = new Date(filtros.data_ini);
    gte.setHours(0, 0, 0, 0);
    where.data_ajuste = { ...where.data_ajuste, gte };
  }
  if (filtros.data_fim) {
    const lte = new Date(filtros.data_fim);
    lte.setHours(23, 59, 59, 999);
    where.data_ajuste = { ...where.data_ajuste, lte };
  }
  let clienteCanonicals: Set<string> | null = null;
  if (filtros.cliente?.trim()) {
    const { data: pedidosCliente } = await listarPedidos({ cliente: filtros.cliente.trim() });
    const idsCliente = [...new Set(pedidosCliente.map((p) => p.id_pedido))];
    if (idsCliente.length === 0) return [];
    if (filtros.id_pedido?.trim()) {
      const alvo = chavePedidoItem(filtros.id_pedido.trim());
      if (!idsCliente.some((id) => chavePedidoItem(id) === alvo)) return [];
    }
    clienteCanonicals = new Set(idsCliente.map((id) => chavePedidoItem(id)));
  }

  const ajustes = await prisma.pedidoPrevisaoAjuste.findMany({
    where,
    orderBy: { data_ajuste: 'desc' },
  });

  let filtrados = ajustes;
  if (filtros.id_pedido?.trim()) {
    const alvo = chavePedidoItem(filtros.id_pedido.trim());
    filtrados = ajustes.filter((a) => chavePedidoItem(a.id_pedido) === alvo);
  } else if (clienteCanonicals) {
    filtrados = ajustes.filter((a) => clienteCanonicals!.has(chavePedidoItem(a.id_pedido)));
  }

  const { data: pedidos } = await listarPedidos({});
  const clientePorCanon = new Map<string, string>();
  for (const p of pedidos) {
    const c = chavePedidoItem(p.id_pedido);
    if (!clientePorCanon.has(c)) clientePorCanon.set(c, p.cliente ?? '');
  }

  return filtrados.map((a) => ({
    id: a.id,
    id_pedido: a.id_pedido,
    cliente: clientePorCanon.get(chavePedidoItem(a.id_pedido)) ?? '',
    previsao_nova: a.previsao_nova,
    motivo: a.motivo,
    observacao: a.observacao,
    usuario: a.usuario,
    data_ajuste: a.data_ajuste,
  }));
}

export interface MotivoResumo {
  motivo: string;
  quantidade: number;
}

function toDateOnly(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}

/**
 * Remove do banco os registros "Importação em lote" cuja data não alterou
 * a previsão (era igual à que já estava). Assim o Dashboard não os exibe.
 */
export async function limparImportacaoSemAlteracao(): Promise<void> {
  const importacoes = await prisma.pedidoPrevisaoAjuste.findMany({
    where: { motivo: { contains: 'Importação em lote' } },
    orderBy: { data_ajuste: 'asc' },
  });
  if (importacoes.length === 0) return;

  const { data: pedidos } = await listarPedidos({});
  const originalPorCanon = new Map<string, Date>();
  for (const p of pedidos) {
    const c = chavePedidoItem(p.id_pedido);
    if (!originalPorCanon.has(c)) originalPorCanon.set(c, p.previsao_entrega);
  }

  const todosAjustes = await prisma.pedidoPrevisaoAjuste.findMany({
    orderBy: { data_ajuste: 'asc' },
    select: { id: true, id_pedido: true, previsao_nova: true, data_ajuste: true },
  });
  const todosAjustesPorCanon = new Map<
    string,
    { id: number; id_pedido: string; previsao_nova: Date; data_ajuste: Date }[]
  >();
  for (const t of todosAjustes) {
    const c = chavePedidoItem(t.id_pedido);
    const list = todosAjustesPorCanon.get(c) ?? [];
    list.push(t);
    todosAjustesPorCanon.set(c, list);
  }
  for (const [, list] of todosAjustesPorCanon) {
    list.sort((x, y) => {
      const tx = x.data_ajuste.getTime();
      const ty = y.data_ajuste.getTime();
      if (tx !== ty) return tx - ty;
      return x.id - y.id;
    });
  }

  const idsToDelete: number[] = [];
  for (const a of importacoes) {
    const c = chavePedidoItem(a.id_pedido);
    const todos = todosAjustesPorCanon.get(c) ?? [];
    const idx = todos.findIndex((x) => x.id === a.id);
    const anterior = idx <= 0 ? originalPorCanon.get(c) : todos[idx - 1]!.previsao_nova;
    const novaStr = toDateOnly(a.previsao_nova);
    const anteriorStr = anterior ? toDateOnly(anterior) : '';
    if (anteriorStr === novaStr) idsToDelete.push(a.id);
  }

  if (idsToDelete.length > 0) {
    await prisma.pedidoPrevisaoAjuste.deleteMany({ where: { id: { in: idsToDelete } } });
  }
}

/** Resumo de alterações por motivo (SQLite). Remove antes os registros de importação sem alteração real. */
export async function obterResumoMotivos(): Promise<MotivoResumo[]> {
  await limparImportacaoSemAlteracao();
  const rows = await prisma.pedidoPrevisaoAjuste.groupBy({
    by: ['motivo'],
    _count: { motivo: true },
    orderBy: { _count: { motivo: 'desc' } },
  });
  return rows.map((r) => ({
    motivo: r.motivo || '(sem motivo)',
    quantidade: r._count.motivo,
  }));
}

const KEYS_DATA_ORIGINAL_PEDIDO = ['Data de entrega', 'Data de Entrega', 'dataParametro'];

function formatarDataBrPedido(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getDataOriginalPedido(row: PedidoRow): Date | null {
  const d = getDateFromRow(row, KEYS_DATA_ORIGINAL_PEDIDO);
  if (d) {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }
  const raw = row.previsao_entrega;
  if (raw == null) return null;
  const d2 = raw instanceof Date ? new Date(raw) : new Date(raw as string);
  if (Number.isNaN(d2.getTime())) return null;
  d2.setHours(0, 0, 0, 0);
  return d2;
}

function getPrevisaoAtualPedido(row: PedidoRow): Date | null {
  const raw = row.previsao_entrega_atualizada ?? row.previsao_entrega;
  if (raw == null) return null;
  const d = raw instanceof Date ? new Date(raw) : new Date(raw as string);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function mergeMenorData(acc: Date | null, cand: Date | null): Date | null {
  if (!cand) return acc;
  if (!acc) return cand;
  return cand.getTime() < acc.getTime() ? cand : acc;
}

type PedidoEntregaVencidaAggInterno = {
  pd: string;
  cliente: string;
  valor: number;
  dataOriginal: Date | null;
  previsaoAtual: Date | null;
};

/** Linha agregada por PD para relatório WhatsApp (previsão atual vencida). */
export interface PedidoEntregaVencidaAgregado {
  pd: string;
  cliente: string;
  valor: number;
  disponivel: boolean;
  dataOriginal: string;
  segundaData: string;
}

export interface DadosPedidosEntregaVencida {
  entregaGrandeTeresina: PedidoEntregaVencidaAgregado[];
  retirada: PedidoEntregaVencidaAgregado[];
}

async function carregarIndiceDisponivelSycroPorPd(): Promise<Map<string, { disponivel: boolean; orderIds: number[] }>> {
  const orders = await prisma.sycroOrderOrder.findMany({
    select: { id: true, order_number: true, tag_disponivel: true },
  });
  const porPd = new Map<string, { disponivel: boolean; orderIds: number[] }>();
  for (const o of orders) {
    const pdNorm = normalizePdDigitsLocal(String(o.order_number ?? '').trim());
    if (!pdNorm) continue;
    const cur = porPd.get(pdNorm) ?? { disponivel: false, orderIds: [] };
    cur.orderIds.push(o.id);
    if (o.tag_disponivel === 1) cur.disponivel = true;
    porPd.set(pdNorm, cur);
  }
  return porPd;
}

async function carregarHistoricoMarcadoDisponivel(): Promise<Map<number, Date[]>> {
  const history = await prisma.sycroOrderHistory.findMany({
    where: { action_type: 'TAG_DISPONIVEL_TRUE' },
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    select: { order_id: true, created_at: true },
  });
  const map = new Map<number, Date[]>();
  for (const h of history) {
    const arr = map.get(h.order_id) ?? [];
    arr.push(h.created_at);
    map.set(h.order_id, arr);
  }
  return map;
}

/** Data em que o pedido ficou disponível no dia do envio; senão, a marcação mais recente. */
function resolverDataDisponivelPedido(
  orderIds: number[],
  historico: Map<number, Date[]>,
  hoje: Date
): Date | null {
  const hojeIni = hoje.getTime();
  const hojeFim = hojeIni + 86_400_000 - 1;
  let melhorHoje: Date | null = null;
  let melhorGeral: Date | null = null;
  for (const oid of orderIds) {
    for (const dt of historico.get(oid) ?? []) {
      const t = dt.getTime();
      if (!melhorGeral || t > melhorGeral.getTime()) melhorGeral = dt;
      if (t >= hojeIni && t <= hojeFim && (!melhorHoje || t > melhorHoje.getTime())) melhorHoje = dt;
    }
  }
  return melhorHoje ?? melhorGeral;
}

function enriquecerComDisponivel(
  row: PedidoEntregaVencidaAggInterno,
  indicePd: Map<string, { disponivel: boolean; orderIds: number[] }>,
  historico: Map<number, Date[]>,
  hoje: Date
): PedidoEntregaVencidaAgregado {
  const pdNorm = normalizePdDigitsLocal(row.pd);
  const info = pdNorm ? indicePd.get(pdNorm) : undefined;
  const disponivel = info?.disponivel === true;
  const dataOriginalStr = row.dataOriginal ? formatarDataBrPedido(row.dataOriginal) : '—';
  const previsaoStr = row.previsaoAtual ? formatarDataBrPedido(row.previsaoAtual) : '—';
  let segundaData = previsaoStr;
  if (disponivel && info?.orderIds.length) {
    const dtDisp = resolverDataDisponivelPedido(info.orderIds, historico, hoje);
    if (dtDisp) segundaData = formatarDataBrPedido(dtDisp);
  }
  const pdLabel = /^\s*pd\b/i.test(row.pd) ? row.pd.trim() : `PD ${row.pd.trim()}`;
  return {
    pd: pdLabel,
    cliente: row.cliente,
    valor: row.valor,
    disponivel,
    dataOriginal: dataOriginalStr,
    segundaData,
  };
}

/**
 * Pedidos cuja Previsão atual é hoje ou anterior,
 * tipoF Entrega Grande Teresina ou Retirada, agrupados por PD.
 * Apenas linhas alocadas em card do Comunicador de Pedidos entram na lista.
 * Disponibilidade e data de disponibilidade vêm da Comunicação PD (tag + histórico).
 */
export async function obterDadosPedidosEntregaVencida(): Promise<DadosPedidosEntregaVencida> {
  const [{ data: pedidos }, cards] = await Promise.all([listarPedidos({}), carregarCardsComunicador()]);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const mapEntrega = new Map<string, PedidoEntregaVencidaAggInterno>();
  const mapRetirada = new Map<string, PedidoEntregaVencidaAggInterno>();

  for (const p of pedidos) {
    if (!pedidoLinhaAlocadaComunicador(p, cards)) continue;

    const previsaoAtual = getPrevisaoAtualPedido(p);
    if (!previsaoAtual || previsaoAtual.getTime() > hoje.getTime()) continue;

    let map: Map<string, PedidoEntregaVencidaAggInterno> | null = null;
    if (isTipoFEntregaGrandeTeresina(p)) map = mapEntrega;
    else if (isTipoFRetirada(p)) map = mapRetirada;
    else continue;

    const pd = getField(p, ['PD', 'pd']).trim() || '—';
    const cliente = getField(p, ['Cliente', 'cliente']).trim() || '—';
    const valorLinha = getNumberFromRowLoose(p, KEYS_VALOR_PENDENTE_REAL);
    if (valorLinha <= 0) continue;

    const dataOriginal = getDataOriginalPedido(p);
    const cur = map.get(pd);
    if (cur) {
      cur.valor += valorLinha;
      cur.dataOriginal = mergeMenorData(cur.dataOriginal, dataOriginal);
      cur.previsaoAtual = mergeMenorData(cur.previsaoAtual, previsaoAtual);
    } else {
      map.set(pd, { pd, cliente, valor: valorLinha, dataOriginal, previsaoAtual });
    }
  }

  const [indicePd, historico] = await Promise.all([
    carregarIndiceDisponivelSycroPorPd(),
    carregarHistoricoMarcadoDisponivel(),
  ]);

  const finalizarLista = (lista: PedidoEntregaVencidaAggInterno[]) =>
    [...lista]
      .sort((a, b) => {
        const ta = a.dataOriginal?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const tb = b.dataOriginal?.getTime() ?? Number.MAX_SAFE_INTEGER;
        if (ta !== tb) return ta - tb;
        return a.pd.localeCompare(b.pd, 'pt-BR');
      })
      .map((r) =>
        enriquecerComDisponivel({ ...r, valor: Math.round(r.valor * 100) / 100 }, indicePd, historico, hoje)
      );

  return {
    entregaGrandeTeresina: finalizarLista([...mapEntrega.values()]),
    retirada: finalizarLista([...mapRetirada.values()]),
  };
}
