import { prisma } from '../config/prisma.js';
import { isCamasiEnabled, queryCamasi } from '../config/camasiFirebirdDb.js';
import {
  nomeJustificativaReservado,
  normalizarNomeJustificativa,
} from '../utils/camasiJustificativa.js';

export type CamasiJustificativaOpcao = {
  nome: string;
  origem: 'camasi' | 'gs';
};

function strField(row: Record<string, unknown>, ...keys: string[]): string | null {
  const map = new Map(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
  for (const k of keys) {
    const v = map.get(k.toLowerCase());
    if (v == null || v === '') continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return null;
}

function ativoCampo(row: Record<string, unknown>): boolean {
  const map = new Map(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
  const v = map.get('ativo');
  if (v == null) return true;
  if (typeof v === 'boolean') return v;
  const n = Number(v);
  if (Number.isFinite(n)) return n !== 0;
  const s = String(v).trim().toUpperCase();
  return s === 'S' || s === 'SIM' || s === 'TRUE' || s === '1';
}

export async function listarMotivosParadaCamasi(): Promise<string[]> {
  if (!isCamasiEnabled()) return [];
  try {
    const raw = await queryCamasi<Record<string, unknown>>(
      `SELECT ID, NOME, ATIVO FROM MOTIVO_PARADA ORDER BY NOME`
    );
    const out: string[] = [];
    const seen = new Set<string>();
    for (const r of raw) {
      if (!ativoCampo(r)) continue;
      const nome = strField(r, 'NOME');
      if (!nome || nomeJustificativaReservado(nome)) continue;
      const key = normalizarNomeJustificativa(nome);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(nome.trim());
    }
    return out;
  } catch (err) {
    console.warn(
      '[camasiJustificativa] catálogo MOTIVO_PARADA indisponível:',
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

export async function listarOpcoesJustificativaCamasi(): Promise<CamasiJustificativaOpcao[]> {
  const [camasi, gs] = await Promise.all([
    listarMotivosParadaCamasi(),
    prisma.camasiJustificativa.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
      select: { nome: true },
    }),
  ]);
  const seen = new Set<string>();
  const out: CamasiJustificativaOpcao[] = [];
  for (const nome of camasi) {
    const key = normalizarNomeJustificativa(nome);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ nome, origem: 'camasi' });
  }
  for (const row of gs) {
    const key = normalizarNomeJustificativa(row.nome);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ nome: row.nome, origem: 'gs' });
  }
  out.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return out;
}

export async function garantirJustificativaGs(nome: string): Promise<string> {
  const trimmed = nome.replace(/\s+/g, ' ').trim();
  if (!trimmed) throw new Error('Informe a justificativa.');
  if (nomeJustificativaReservado(trimmed)) {
    throw new Error('Essa justificativa é reservada do painel e não pode ser cadastrada.');
  }
  const camasi = await listarMotivosParadaCamasi();
  const hitCamasi = camasi.find(
    (n) => normalizarNomeJustificativa(n) === normalizarNomeJustificativa(trimmed)
  );
  if (hitCamasi) return hitCamasi;

  const existentes = await prisma.camasiJustificativa.findMany({ select: { id: true, nome: true } });
  const hitGs = existentes.find(
    (r) => normalizarNomeJustificativa(r.nome) === normalizarNomeJustificativa(trimmed)
  );
  if (hitGs) return hitGs.nome;

  const criado = await prisma.camasiJustificativa.create({
    data: { nome: trimmed, ativo: true },
  });
  return criado.nome;
}

export async function listarParadasJustificadasNoPeriodo(
  dataIni: string,
  dataFim: string
): Promise<{ data: string; inicioParado: string; fimParado: string; observacaoOrigem: string; nome: string }[]> {
  const rows = await prisma.camasiParadaJustificada.findMany({
    where: { data: { gte: dataIni, lte: dataFim } },
  });
  return rows.map((r) => ({
    data: r.data,
    inicioParado: r.inicioParado,
    fimParado: r.fimParado,
    observacaoOrigem: r.observacaoOrigem,
    nome: r.nome,
  }));
}

export async function salvarParadaJustificada(input: {
  data: string;
  inicioParado: string;
  fimParado: string;
  observacaoOrigem: string;
  nome: string;
  usuarioLogin?: string | null;
}): Promise<{ nome: string }> {
  const nome = await garantirJustificativaGs(input.nome);
  const observacaoOrigem = input.observacaoOrigem ?? '';
  await prisma.camasiParadaJustificada.upsert({
    where: {
      data_inicioParado_fimParado_observacaoOrigem: {
        data: input.data,
        inicioParado: input.inicioParado,
        fimParado: input.fimParado,
        observacaoOrigem,
      },
    },
    create: {
      data: input.data,
      inicioParado: input.inicioParado,
      fimParado: input.fimParado,
      observacaoOrigem,
      nome,
      usuarioLogin: input.usuarioLogin ?? null,
    },
    update: {
      nome,
      usuarioLogin: input.usuarioLogin ?? null,
    },
  });
  return { nome };
}
