import { prisma } from '../config/prisma.js';
import { listarPedidos } from './pedidosRepository.js';

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
};

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
  const count = await prisma.sequenciamentoCarradasSnapshot.count();
  return `PSC${String(count + 1).padStart(4, '0')}`;
}

export function validarPayloadSequenciamento(raw: unknown): { ok: true; payload: SequenciamentoCarradasPayloadV1 } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Payload inválido.' };
  const p = raw as Record<string, unknown>;
  if (p.version !== 1) return { ok: false, error: 'Versão de payload não suportada.' };
  if (!Array.isArray(p.carradas)) return { ok: false, error: 'Payload sem carradas.' };
  if (!Array.isArray(p.linhas)) return { ok: false, error: 'Payload sem linhas.' };
  return { ok: true, payload: p as unknown as SequenciamentoCarradasPayloadV1 };
}

export async function montarPayloadSequenciamento(): Promise<{
  payload: SequenciamentoCarradasPayloadV1;
  erroConexao?: boolean;
}> {
  const { data: pedidos, erroConexao } = await listarPedidos({});
  const linhas = pedidos.map((p) => serializeRow(p as PedidoRow));
  const carradas = agregarCarradas(pedidos as PedidoRow[]);
  return {
    payload: {
      version: 1,
      geradoEm: new Date().toISOString(),
      carradas,
      linhas,
    },
    erroConexao,
  };
}

export async function gravarSnapshotSequenciamento(usuarioLogin: string): Promise<{
  id: number;
  cod: string;
  createdAt: Date;
  usuarioLogin: string;
  carradaCount: number;
}> {
  const { payload } = await montarPayloadSequenciamento();
  const jsonStr = JSON.stringify(payload);
  if (jsonStr.length > SEQUENCIAMENTO_PAYLOAD_MAX_CHARS) {
    throw new Error('Snapshot muito grande para gravar. Reduza o volume de pedidos ou contate o suporte.');
  }
  const cod = await gerarCodSnapshot();
  const row = await prisma.sequenciamentoCarradasSnapshot.create({
    data: {
      cod,
      usuarioLogin,
      carradaCount: payload.carradas.length,
      payload: jsonStr,
    },
  });
  return {
    id: row.id,
    cod: row.cod,
    createdAt: row.createdAt,
    usuarioLogin: row.usuarioLogin,
    carradaCount: row.carradaCount,
  };
}

export async function listarSnapshotsSequenciamento(limit = 100): Promise<
  Array<{
    id: number;
    cod: string;
    usuarioLogin: string;
    createdAt: Date;
    carradaCount: number;
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
  payload: SequenciamentoCarradasPayloadV1 | null;
} | null> {
  const row = await prisma.sequenciamentoCarradasSnapshot.findUnique({ where: { id } });
  if (!row) return null;
  let payload: SequenciamentoCarradasPayloadV1 | null = null;
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
    payload,
  };
}
