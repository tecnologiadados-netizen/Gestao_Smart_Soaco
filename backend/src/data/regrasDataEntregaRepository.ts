/**
 * Versões das regras de data de entrega (SQLite) — vigência por data de emissão do pedido.
 */

import { prisma } from '../config/prisma.js';
import {
  DEFAULT_REGRA_DATA_ENTREGA,
  type RegraDataEntregaConfig,
} from '../config/regrasDataEntrega.js';

export interface RegraDataEntregaVersaoDto {
  id: number;
  vigenteApartirDe: string;
  payload: RegraDataEntregaConfig;
  criadoPorLogin: string;
  criadoPorNome: string | null;
  createdAt: string;
}

type VersaoInterna = {
  id: number;
  vigenteApartirDe: Date;
  payload: RegraDataEntregaConfig;
  criadoPorLogin: string;
  criadoPorNome: string | null;
  createdAt: Date;
};

let cacheVersoes: { rows: VersaoInterna[]; expiresAt: number } | null = null;
const CACHE_VERSOES_TTL_MS = 60_000;

function getDateOnlyTimestamp(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  if (typeof v === 'boolean') return v;
  return fallback;
}

/** Mescla JSON parcial com o padrão do sistema. */
export function mergeRegraDataEntregaParcial(raw: unknown): RegraDataEntregaConfig {
  const d = DEFAULT_REGRA_DATA_ENTREGA;
  if (!raw || typeof raw !== 'object') return { carrada: { ...d.carrada } };
  const o = raw as Record<string, unknown>;
  const c = (o.carrada && typeof o.carrada === 'object' ? o.carrada : {}) as Record<string, unknown>;
  const valorCorte = Math.max(0, num(c.valorCorte, d.carrada.valorCorte));
  const diasAbaixo = Math.max(1, Math.round(num(c.diasAbaixoCorte, d.carrada.diasAbaixoCorte)));
  const diasAcima = Math.max(1, Math.round(num(c.diasIgualOuAcimaCorte, d.carrada.diasIgualOuAcimaCorte)));
  return {
    carrada: {
      baseData: 'emissao',
      valorCorte,
      diasAbaixoCorte: diasAbaixo,
      diasIgualOuAcimaCorte: diasAcima,
      incluiInserirRomaneio: bool(c.incluiInserirRomaneio, d.carrada.incluiInserirRomaneio),
    },
  };
}

export function validarRegraDataEntregaParaSalvar(config: RegraDataEntregaConfig): string | null {
  const c = config.carrada;
  if (c.valorCorte < 0) return 'O valor de corte (R$) não pode ser negativo.';
  if (c.diasAbaixoCorte < 1 || c.diasAbaixoCorte > 730) {
    return 'Dias abaixo do corte deve estar entre 1 e 730.';
  }
  if (c.diasIgualOuAcimaCorte < 1 || c.diasIgualOuAcimaCorte > 730) {
    return 'Dias igual ou acima do corte deve estar entre 1 e 730.';
  }
  return null;
}

function parsePayload(json: string): RegraDataEntregaConfig {
  try {
    return mergeRegraDataEntregaParcial(JSON.parse(json) as unknown);
  } catch {
    return mergeRegraDataEntregaParcial(null);
  }
}

function toDto(row: VersaoInterna): RegraDataEntregaVersaoDto {
  return {
    id: row.id,
    vigenteApartirDe: row.vigenteApartirDe.toISOString(),
    payload: row.payload,
    criadoPorLogin: row.criadoPorLogin,
    criadoPorNome: row.criadoPorNome,
    createdAt: row.createdAt.toISOString(),
  };
}

export function invalidarRegrasCache(): void {
  cacheVersoes = null;
}

async function carregarVersoesInternas(): Promise<VersaoInterna[]> {
  const now = Date.now();
  if (cacheVersoes && cacheVersoes.expiresAt > now) {
    return cacheVersoes.rows;
  }
  const rows = await prisma.regraDataEntregaVersao.findMany({
    orderBy: { vigenteApartirDe: 'asc' },
  });
  const parsed: VersaoInterna[] = rows.map((r) => ({
    id: r.id,
    vigenteApartirDe: r.vigenteApartirDe,
    payload: parsePayload(r.payload),
    criadoPorLogin: r.criadoPorLogin,
    criadoPorNome: r.criadoPorNome,
    createdAt: r.createdAt,
  }));
  cacheVersoes = { rows: parsed, expiresAt: now + CACHE_VERSOES_TTL_MS };
  return parsed;
}

/** Versão vigente para pedidos emitidos a partir de hoje (maior vigenteApartirDe <= hoje). */
export async function obterVersaoVigenteHoje(): Promise<RegraDataEntregaVersaoDto | null> {
  const versoes = await carregarVersoesInternas();
  const hojeTs = getDateOnlyTimestamp(new Date());
  let best: VersaoInterna | null = null;
  for (const v of versoes) {
    const vTs = getDateOnlyTimestamp(v.vigenteApartirDe);
    if (vTs <= hojeTs && (!best || vTs > getDateOnlyTimestamp(best.vigenteApartirDe))) {
      best = v;
    }
  }
  return best ? toDto(best) : null;
}

export async function listarVersoesRegrasDataEntrega(): Promise<RegraDataEntregaVersaoDto[]> {
  const versoes = await carregarVersoesInternas();
  return versoes.map(toDto).reverse();
}

export function resolverConfigPorEmissao(
  versoes: VersaoInterna[],
  emissao: Date
): RegraDataEntregaConfig | null {
  const emTs = getDateOnlyTimestamp(emissao);
  let best: VersaoInterna | null = null;
  for (const v of versoes) {
    const vTs = getDateOnlyTimestamp(v.vigenteApartirDe);
    if (vTs <= emTs && (!best || vTs > getDateOnlyTimestamp(best.vigenteApartirDe))) {
      best = v;
    }
  }
  return best ? best.payload : null;
}

export function calcularDataLimiteCarrada(
  emissao: Date,
  valorPedidoTotal: number,
  config: RegraDataEntregaConfig | null
): { dataLimite: Date; dias: number; usouPadraoSistema: boolean } {
  const em = new Date(emissao);
  em.setHours(0, 0, 0, 0);
  const usouPadraoSistema = !config;
  const c = (config ?? DEFAULT_REGRA_DATA_ENTREGA).carrada;
  const dias =
    valorPedidoTotal >= c.valorCorte ? c.diasIgualOuAcimaCorte : c.diasAbaixoCorte;
  const dataLimite = new Date(em);
  dataLimite.setDate(dataLimite.getDate() + dias);
  return { dataLimite, dias, usouPadraoSistema };
}

/** Texto de motivo para histórico sintético da regra de carrada. */
export function textoMotivoRegraCarrada(
  dias: number,
  valorPedidoTotal: number,
  valorCorte: number,
  usouPadraoSistema: boolean
): string {
  const faixa = valorPedidoTotal >= valorCorte ? 'valor ≥ corte' : 'valor < corte';
  const origem = usouPadraoSistema ? 'padrão do sistema (sem versão vigente)' : 'versão vigente na emissão';
  return `Regra de carrada (emissão + ${dias} dias — ${faixa}; ${origem})`;
}

export function isTipoFCarradaParaRegra(tipoF: string, incluiInserirRomaneio: boolean): boolean {
  const t = tipoF.trim();
  if (t === 'Carradas') return true;
  if (incluiInserirRomaneio && t === 'Inserir em Romaneio') return true;
  return false;
}

export async function obterVersoesParaClassificacao(): Promise<VersaoInterna[]> {
  return carregarVersoesInternas();
}

export async function criarVersaoRegraDataEntrega(input: {
  config: RegraDataEntregaConfig;
  vigenteApartirDe: Date;
  criadoPorLogin: string;
  criadoPorNome?: string | null;
}): Promise<RegraDataEntregaVersaoDto> {
  const err = validarRegraDataEntregaParaSalvar(input.config);
  if (err) throw new Error(err);

  const vigente = new Date(input.vigenteApartirDe);
  vigente.setHours(0, 0, 0, 0);

  const row = await prisma.regraDataEntregaVersao.create({
    data: {
      vigenteApartirDe: vigente,
      payload: JSON.stringify(input.config),
      criadoPorLogin: input.criadoPorLogin.trim(),
      criadoPorNome: input.criadoPorNome?.trim() || null,
    },
  });

  invalidarRegrasCache();

  return toDto({
    id: row.id,
    vigenteApartirDe: row.vigenteApartirDe,
    payload: input.config,
    criadoPorLogin: row.criadoPorLogin,
    criadoPorNome: row.criadoPorNome,
    createdAt: row.createdAt,
  });
}
