import { prisma } from '../config/prisma.js';
import { listarPedidos } from './pedidosRepository.js';
import { getProgramacaoSetorialEstoqueSaldo } from './programacaoSetorialRepository.js';

export const SEQUENCIAMENTO_PAYLOAD_MAX_CHARS = 24 * 1024 * 1024;

export type SequenciamentoCarradaAgregada = {
  cod: string;
  carrada: string;
  saldoAFaturar: number;
  saldoEmDia: number;
  percentualEmDia: number;
  adiantamento: number;
  valorAVistaAte10d: number;
};

export type SequenciamentoCarradasPayloadV1 = {
  version: 1;
  geradoEm: string;
  carradas: SequenciamentoCarradaAgregada[];
  linhas: Record<string, unknown>[];
  /** Saldo de estoque por código no momento de `geradoEm` (opcional em snapshots legados). */
  estoquePorCod?: Record<string, number>;
};

/** Estado da simulação (datas editadas e ordem manual das carradas) gravado junto ao snapshot. */
export type SequenciamentoSimulacaoItem = {
  chave: string;
  cod: string;
  carrada: string;
  dataProducao?: string | null;
  dataEntrega?: string | null;
};

export type SequenciamentoSimulacao = {
  ordem: string[];
  itens: SequenciamentoSimulacaoItem[];
  /** Prioridade manual por chave de carrada (maior = mais acima). */
  prioridades?: Record<string, number>;
  /** Rascunho de motivos por id_pedido (registro de motivos do fluxo de confirmação). */
  motivos?: Record<string, string>;
};

export type SequenciamentoSnapshotStatus = 'rascunho' | 'concluido';

export type SequenciamentoCarradasPayloadV2 = {
  version: 2;
  geradoEm: string;
  carradas: SequenciamentoCarradaAgregada[];
  linhas: Record<string, unknown>[];
  /** Saldo de estoque por código no momento de `geradoEm` (opcional em snapshots legados). */
  estoquePorCod?: Record<string, number>;
  simulacao?: SequenciamentoSimulacao | null;
};

export type SequenciamentoCarradasPayload =
  | SequenciamentoCarradasPayloadV1
  | SequenciamentoCarradasPayloadV2;

type PedidoRow = Record<string, unknown>;

function getField(row: PedidoRow, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim().length > 0) return String(v).trim();
  }
  return '';
}

function getNumberFromRow(row: PedidoRow, keys: string[]): number {
  for (const k of keys) {
    const v = row[k];
    if (v == null) continue;
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return 0;
}

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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function serializeRow(row: PedidoRow): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v instanceof Date) out[k] = v.toISOString();
    else out[k] = v;
  }
  return out;
}

function agregarCarradas(pedidos: PedidoRow[]): SequenciamentoCarradaAgregada[] {
  const keysSaldo = ['Saldo a Faturar Real', 'Valor Pendente Real'];
  const keysAdiantamento = ['valorAdiantamentoRateio', 'Valor Adiantamento'];
  const keysAVista = ['Valor a Vista Ate 10d'];

  const map = new Map<
    string,
    {
      cod: string;
      carrada: string;
      saldoAFaturar: number;
      saldoEmDia: number;
      adiantamento: number;
      valorAVistaAte10d: number;
    }
  >();

  for (const p of pedidos) {
    const rmRaw = getField(p, ['RM', 'rm']);
    const cod = rmRaw || '—';
    const carrada = getField(p, ['Observacoes', 'Observacoes ', 'Observações']) || 'Sem Rota';
    const key = `${cod}\x1e${carrada}`;

    let row = map.get(key);
    if (!row) {
      row = { cod, carrada, saldoAFaturar: 0, saldoEmDia: 0, adiantamento: 0, valorAVistaAte10d: 0 };
      map.set(key, row);
    }

    const saldo = getNumberFromRowLoose(p, keysSaldo);
    const statusEntrega = getField(p, ['Status', 'status']);
    const emDia = statusEntrega === 'Em dia';

    row.saldoAFaturar += saldo;
    if (emDia) row.saldoEmDia += saldo;
    row.adiantamento += getNumberFromRowLoose(p, keysAdiantamento);
    row.valorAVistaAte10d += getNumberFromRowLoose(p, keysAVista);
  }

  return ordenarCarradasAgregadas(
    [...map.values()].map((r) => {
      const percentualEmDia =
        r.saldoAFaturar > 0 ? Math.round((r.saldoEmDia / r.saldoAFaturar) * 10000) / 100 : 0;
      return {
        cod: r.cod,
        carrada: r.carrada,
        saldoAFaturar: round2(r.saldoAFaturar),
        saldoEmDia: round2(r.saldoEmDia),
        percentualEmDia,
        adiantamento: round2(r.adiantamento),
        valorAVistaAte10d: round2(r.valorAVistaAte10d),
      };
    })
  );
}

function normalizeCarradaNome(carrada: string): string {
  return carrada
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

/** Carradas sem romaneio (retirada, entrega G. The, inserir em romaneio, requisição) ficam no final. */
function isCarradaOrdemFinal(carrada: string): boolean {
  const n = normalizeCarradaNome(carrada);
  return (
    n.includes('retirada na so aco') ||
    n.includes('retirada na so moveis') ||
    n.includes('entrega em grande teresina') ||
    n.includes('inserir em romaneio') ||
    n.includes('requisicao') ||
    n.startsWith('1-retirada') ||
    n.startsWith('2-retirada') ||
    n.startsWith('3-entrega') ||
    n.startsWith('4-inserir') ||
    n.startsWith('5-requisicao')
  );
}

function compareCodRomaneio(a: string, b: string): number {
  if (a === '—' && b === '—') return 0;
  if (a === '—') return 1;
  if (b === '—') return -1;
  const na = Number(a.replace(/\D/g, ''));
  const nb = Number(b.replace(/\D/g, ''));
  if (!Number.isNaN(na) && !Number.isNaN(nb) && String(na) !== '' && String(nb) !== '') {
    return na - nb;
  }
  return a.localeCompare(b, 'pt-BR', { numeric: true });
}

export function ordenarCarradasAgregadas(carradas: SequenciamentoCarradaAgregada[]): SequenciamentoCarradaAgregada[] {
  const normais = carradas.filter((c) => !isCarradaOrdemFinal(c.carrada));
  const finais = carradas.filter((c) => isCarradaOrdemFinal(c.carrada));
  const sortFn = (x: SequenciamentoCarradaAgregada, y: SequenciamentoCarradaAgregada) =>
    compareCodRomaneio(x.cod, y.cod) || x.carrada.localeCompare(y.carrada, 'pt-BR');
  normais.sort(sortFn);
  finais.sort(sortFn);
  return [...normais, ...finais];
}

async function gerarCodSnapshot(): Promise<string> {
  // Não usar count()+1: exclusões deixam buracos e o próximo cod colide com um existente.
  const rows = await prisma.sequenciamentoCarradasSnapshot.findMany({ select: { cod: true } });
  let maxN = 0;
  for (const r of rows) {
    const m = /^PSC(\d+)$/i.exec(String(r.cod ?? '').trim());
    if (m) maxN = Math.max(maxN, parseInt(m[1]!, 10));
  }
  return `PSC${String(maxN + 1).padStart(4, '0')}`;
}

function isUniqueCodConstraintError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; meta?: { target?: string | string[] }; message?: string };
  if (e.code !== 'P2002') return false;
  const target = e.meta?.target;
  if (Array.isArray(target)) return target.includes('cod');
  if (typeof target === 'string') return target.includes('cod');
  return String(e.message ?? '').toLowerCase().includes('cod');
}

export function validarPayloadSequenciamento(raw: unknown): { ok: true; payload: SequenciamentoCarradasPayload } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Payload inválido.' };
  const p = raw as Record<string, unknown>;
  if (p.version !== 1 && p.version !== 2) return { ok: false, error: 'Versão de payload não suportada.' };
  if (!Array.isArray(p.carradas)) return { ok: false, error: 'Payload sem carradas.' };
  if (!Array.isArray(p.linhas)) return { ok: false, error: 'Payload sem linhas.' };
  return { ok: true, payload: p as unknown as SequenciamentoCarradasPayload };
}

/** Normaliza o estado de simulação recebido do cliente (defensivo contra payload malformado). */
export function sanitizarSimulacao(raw: unknown): SequenciamentoSimulacao | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const ordem = Array.isArray(r.ordem) ? r.ordem.filter((x): x is string => typeof x === 'string') : [];
  const itensRaw = Array.isArray(r.itens) ? r.itens : [];
  const itens: SequenciamentoSimulacaoItem[] = [];
  for (const it of itensRaw) {
    if (!it || typeof it !== 'object') continue;
    const o = it as Record<string, unknown>;
    const chave = typeof o.chave === 'string' ? o.chave : '';
    if (!chave) continue;
    itens.push({
      chave,
      cod: typeof o.cod === 'string' ? o.cod : '',
      carrada: typeof o.carrada === 'string' ? o.carrada : '',
      dataProducao: typeof o.dataProducao === 'string' ? o.dataProducao : null,
      dataEntrega: typeof o.dataEntrega === 'string' ? o.dataEntrega : null,
    });
  }
  const motivos: Record<string, string> = {};
  if (r.motivos && typeof r.motivos === 'object' && !Array.isArray(r.motivos)) {
    for (const [k, v] of Object.entries(r.motivos as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) motivos[k] = v;
    }
  }
  const prioridades: Record<string, number> = {};
  if (r.prioridades && typeof r.prioridades === 'object' && !Array.isArray(r.prioridades)) {
    for (const [k, v] of Object.entries(r.prioridades as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) prioridades[k] = Math.floor(v);
    }
  }
  const temMotivos = Object.keys(motivos).length > 0;
  const temPrioridades = Object.keys(prioridades).length > 0;
  if (ordem.length === 0 && itens.length === 0 && !temMotivos && !temPrioridades) return null;
  return {
    ordem,
    itens,
    ...(temMotivos ? { motivos } : {}),
    ...(temPrioridades ? { prioridades } : {}),
  };
}

export async function montarPayloadSequenciamento(): Promise<{
  payload: SequenciamentoCarradasPayloadV1;
  erroConexao?: boolean;
}> {
  const [pedidosRes, estoqueRes] = await Promise.all([
    listarPedidos({}),
    getProgramacaoSetorialEstoqueSaldo(),
  ]);
  const { data: pedidos, erroConexao } = pedidosRes;
  const linhas = pedidos.map((p) => serializeRow(p as PedidoRow));
  const carradas = agregarCarradas(pedidos as PedidoRow[]);
  const estoquePorCod: Record<string, number> = {};
  for (const row of estoqueRes.data ?? []) {
    const cod = String(row.cod ?? '').trim();
    if (!cod) continue;
    const saldo = Number(row.saldoSetorFinal ?? 0) || 0;
    estoquePorCod[cod] = saldo > 0 ? saldo : 0;
  }
  return {
    payload: {
      version: 1,
      geradoEm: new Date().toISOString(),
      carradas,
      linhas,
      estoquePorCod,
    },
    erroConexao,
  };
}

const KEY_SEP = '\x1e';

function carradaKeyRepo(cod: string, carrada: string): string {
  return `${cod}${KEY_SEP}${carrada}`;
}

function toISODateRepo(value: unknown): string {
  if (value == null || value === '') return '';
  const s = String(value);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function linhaCarradaKeyRepo(row: Record<string, unknown>): string {
  const cod = getField(row as PedidoRow, ['RM', 'rm']) || '—';
  const carrada = getField(row as PedidoRow, ['Observacoes', 'Observacoes ', 'Observações']) || 'Sem Rota';
  return carradaKeyRepo(cod, carrada);
}

type BaselineRepo = { dataProducao: string; dataEntrega: string };

function computarBaselinesRepo(linhas: Record<string, unknown>[]): Map<string, BaselineRepo> {
  const acc = new Map<string, { entrega: Set<string>; producao: Set<string> }>();
  for (const row of linhas) {
    const key = linhaCarradaKeyRepo(row);
    let cur = acc.get(key);
    if (!cur) {
      cur = { entrega: new Set(), producao: new Set() };
      acc.set(key, cur);
    }
    const entrega = toISODateRepo(row['previsao_entrega_atualizada'] ?? row['previsao_entrega']);
    if (entrega) cur.entrega.add(entrega);
    const producao = toISODateRepo(row['data_producao']);
    if (producao) cur.producao.add(producao);
  }
  const out = new Map<string, BaselineRepo>();
  for (const [key, v] of acc) {
    const entregas = [...v.entrega];
    const producoes = [...v.producao];
    out.set(key, {
      dataEntrega: entregas.length === 1 ? entregas[0]! : '',
      dataProducao: producoes.length === 1 ? producoes[0]! : '',
    });
  }
  return out;
}

/** Simulação do snapshot concluído mais recente (nunca usa rascunho). */
export async function obterSimulacaoUltimoSnapshotConcluido(): Promise<SequenciamentoSimulacao | null> {
  const row = await prisma.sequenciamentoCarradasSnapshot.findFirst({
    where: { status: 'concluido' },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    select: { status: true, payload: true },
  });
  if (!row?.payload || row.status !== 'concluido') return null;
  try {
    const parsed = JSON.parse(row.payload) as unknown;
    const val = validarPayloadSequenciamento(parsed);
    if (!val.ok) return null;
    if (val.payload.version === 2) {
      const sim = sanitizarSimulacao((val.payload as SequenciamentoCarradasPayloadV2).simulacao);
      if (
        sim &&
        (sim.itens.length > 0 ||
          sim.ordem.length > 0 ||
          (sim.prioridades != null && Object.keys(sim.prioridades).length > 0))
      ) {
        return sim;
      }
    }
    // Snapshots antigos (v1) ou v2 sem itens: deriva datas das linhas gravadas no concluído.
    return simularAPartirDasLinhasSnapshot(val.payload.linhas, val.payload.carradas);
  } catch {
    return null;
  }
}

/** Monta simulação sintética a partir das datas já presentes nas linhas do snapshot concluído. */
function simularAPartirDasLinhasSnapshot(
  linhas: Record<string, unknown>[],
  carradas: SequenciamentoCarradaAgregada[]
): SequenciamentoSimulacao | null {
  const baseline = computarBaselinesRepo(linhas);
  const keysAtuais = new Set(carradas.map((c) => carradaKeyRepo(c.cod, c.carrada)));
  const itens: SequenciamentoSimulacaoItem[] = [];
  for (const c of carradas) {
    const chave = carradaKeyRepo(c.cod, c.carrada);
    if (!keysAtuais.has(chave)) continue;
    const b = baseline.get(chave);
    if (!b?.dataProducao && !b?.dataEntrega) continue;
    itens.push({
      chave,
      cod: c.cod,
      carrada: c.carrada,
      ...(b.dataProducao ? { dataProducao: b.dataProducao } : {}),
      ...(b.dataEntrega ? { dataEntrega: b.dataEntrega } : {}),
    });
  }
  if (itens.length === 0) return null;
  return { ordem: [], itens };
}

function filtrarSimulacaoSeedConsultaAoVivo(
  linhas: Record<string, unknown>[],
  carradas: SequenciamentoCarradaAgregada[],
  simUltimo: SequenciamentoSimulacao
): SequenciamentoSimulacao | null {
  const baseline = computarBaselinesRepo(linhas);
  const keysAtuais = new Set(carradas.map((c) => carradaKeyRepo(c.cod, c.carrada)));
  const itens: SequenciamentoSimulacaoItem[] = [];
  for (const it of simUltimo.itens) {
    if (!it.chave || !keysAtuais.has(it.chave)) continue;
    const b = baseline.get(it.chave);
    const entry: SequenciamentoSimulacaoItem = {
      chave: it.chave,
      cod: it.cod,
      carrada: it.carrada,
    };
    let inclui = false;
    if (it.dataProducao && !b?.dataProducao) {
      entry.dataProducao = it.dataProducao;
      inclui = true;
    }
    if (it.dataEntrega && !b?.dataEntrega) {
      entry.dataEntrega = it.dataEntrega;
      inclui = true;
    }
    if (inclui) itens.push(entry);
  }
  const prioridades: Record<string, number> = {};
  if (simUltimo.prioridades) {
    for (const [k, v] of Object.entries(simUltimo.prioridades)) {
      if (!keysAtuais.has(k)) continue;
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) prioridades[k] = Math.floor(v);
    }
  }
  const ordem = simUltimo.ordem.filter((k) => keysAtuais.has(k));
  const temPrioridades = Object.keys(prioridades).length > 0;
  if (itens.length === 0 && !temPrioridades && ordem.length === 0) return null;
  return {
    ordem,
    itens,
    ...(temPrioridades ? { prioridades } : {}),
  };
}

/**
 * Consulta ao vivo com semeadura: carradas sem data no banco herdam datas do último snapshot concluído.
 */
export async function montarPayloadConsultaAoVivo(): Promise<{
  payload: SequenciamentoCarradasPayload;
  erroConexao?: boolean;
}> {
  const { payload: base, erroConexao } = await montarPayloadSequenciamento();
  const simUltimo = await obterSimulacaoUltimoSnapshotConcluido();
  if (!simUltimo) return { payload: base, erroConexao };
  const seed = filtrarSimulacaoSeedConsultaAoVivo(base.linhas, base.carradas, simUltimo);
  if (!seed) return { payload: base, erroConexao };
  return {
    payload: { ...base, version: 2, simulacao: seed },
    erroConexao,
  };
}

export async function gravarSnapshotSequenciamento(
  usuarioLogin: string,
  simulacao?: SequenciamentoSimulacao | null
): Promise<{
  id: number;
  cod: string;
  createdAt: Date;
  usuarioLogin: string;
  carradaCount: number;
  status: SequenciamentoSnapshotStatus;
}> {
  const { payload: base } = await montarPayloadSequenciamento();
  const payload: SequenciamentoCarradasPayload = simulacao
    ? { ...base, version: 2, simulacao }
    : base;
  const jsonStr = JSON.stringify(payload);
  if (jsonStr.length > SEQUENCIAMENTO_PAYLOAD_MAX_CHARS) {
    throw new Error('Snapshot muito grande para gravar. Reduza o volume de pedidos ou contate o suporte.');
  }
  const maxTentativas = 8;
  let lastErr: unknown;
  for (let tentativa = 0; tentativa < maxTentativas; tentativa++) {
    const cod = await gerarCodSnapshot();
    try {
      const row = await prisma.sequenciamentoCarradasSnapshot.create({
        data: {
          cod,
          usuarioLogin,
          carradaCount: payload.carradas.length,
          payload: jsonStr,
          // Novo fluxo: snapshot nasce como rascunho (editável com autosave até concluir).
          status: 'rascunho',
        },
      });
      return {
        id: row.id,
        cod: row.cod,
        createdAt: row.createdAt,
        usuarioLogin: row.usuarioLogin,
        carradaCount: row.carradaCount,
        status: 'rascunho',
      };
    } catch (err) {
      lastErr = err;
      if (isUniqueCodConstraintError(err) && tentativa < maxTentativas - 1) continue;
      throw err;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error('Não foi possível gerar um código único para o snapshot.');
}

/**
 * Autosave do rascunho: substitui a simulação (datas, ordem e motivos) no payload gravado.
 * Só permitido enquanto o snapshot estiver com status 'rascunho'.
 */
export async function atualizarSimulacaoSnapshot(
  id: number,
  simulacao: SequenciamentoSimulacao | null
): Promise<{ ok: true } | { ok: false; error: string; notFound?: boolean }> {
  const row = await prisma.sequenciamentoCarradasSnapshot.findUnique({ where: { id } });
  if (!row) return { ok: false, error: 'Snapshot não encontrado.', notFound: true };
  if (row.status !== 'rascunho') {
    return { ok: false, error: 'Snapshot não está em rascunho; edição bloqueada.' };
  }
  let base: Record<string, unknown>;
  try {
    base = JSON.parse(row.payload) as Record<string, unknown>;
  } catch {
    return { ok: false, error: 'Payload do snapshot ilegível.' };
  }
  const payload = { ...base, version: 2, simulacao: simulacao ?? null };
  const jsonStr = JSON.stringify(payload);
  if (jsonStr.length > SEQUENCIAMENTO_PAYLOAD_MAX_CHARS) {
    return { ok: false, error: 'Snapshot muito grande para gravar.' };
  }
  await prisma.sequenciamentoCarradasSnapshot.update({
    where: { id },
    data: { payload: jsonStr, updatedAt: new Date() },
  });
  return { ok: true };
}

/** Marca o snapshot como concluído (status final; somente leitura). */
export async function concluirSnapshotSequenciamento(
  id: number
): Promise<{ ok: true } | { ok: false; error: string; notFound?: boolean }> {
  const row = await prisma.sequenciamentoCarradasSnapshot.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!row) return { ok: false, error: 'Snapshot não encontrado.', notFound: true };
  if (row.status === 'concluido') return { ok: true };
  await prisma.sequenciamentoCarradasSnapshot.update({
    where: { id },
    data: { status: 'concluido', updatedAt: new Date() },
  });
  return { ok: true };
}

/** Remove snapshot em rascunho. Concluídos não podem ser excluídos. */
export async function removerSnapshotSequenciamento(
  id: number
): Promise<{ ok: true } | { ok: false; error: string; notFound?: boolean }> {
  const row = await prisma.sequenciamentoCarradasSnapshot.findUnique({
    where: { id },
    select: { id: true, status: true, cod: true },
  });
  if (!row) return { ok: false, error: 'Snapshot não encontrado.', notFound: true };
  if (row.status !== 'rascunho') {
    return { ok: false, error: 'Somente sequências em rascunho podem ser excluídas.' };
  }
  await prisma.sequenciamentoCarradasSnapshot.delete({ where: { id } });
  return { ok: true };
}

export async function listarSnapshotsSequenciamento(limit = 100): Promise<
  Array<{
    id: number;
    cod: string;
    usuarioLogin: string;
    createdAt: Date;
    carradaCount: number;
    status: string;
  }>
> {
  const lim = Math.min(Math.max(1, limit), 500);
  const rows = await prisma.sequenciamentoCarradasSnapshot.findMany({
    orderBy: { createdAt: 'desc' },
    take: lim,
    select: {
      id: true,
      cod: true,
      usuarioLogin: true,
      createdAt: true,
      carradaCount: true,
      status: true,
    },
  });
  return rows;
}

export async function obterSnapshotSequenciamento(id: number): Promise<{
  id: number;
  cod: string;
  usuarioLogin: string;
  createdAt: Date;
  carradaCount: number;
  status: string;
  payload: SequenciamentoCarradasPayload | null;
} | null> {
  const row = await prisma.sequenciamentoCarradasSnapshot.findUnique({ where: { id } });
  if (!row) return null;
  let payload: SequenciamentoCarradasPayload | null = null;
  try {
    const parsed = JSON.parse(row.payload) as unknown;
    const val = validarPayloadSequenciamento(parsed);
    if (val.ok) payload = val.payload;
  } catch {
    payload = null;
  }
  return {
    id: row.id,
    cod: row.cod,
    usuarioLogin: row.usuarioLogin,
    createdAt: row.createdAt,
    carradaCount: row.carradaCount,
    status: row.status,
    payload,
  };
}
