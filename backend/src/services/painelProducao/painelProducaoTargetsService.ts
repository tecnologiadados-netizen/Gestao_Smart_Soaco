import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../../config/prisma.js';
import { clearPainelProducaoCaches } from './painelProducaoCache.js';
import { canonicalizeSetorPainel, SETOR_MOVEIS_MELAMINICO } from './painelProducaoConstants.js';
import { copiarFaixasParaMes } from './painelProducaoFaixasService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, '../../../data/painel-producao-target.csv');

function mesKey(mesAno: Date): string {
  const y = mesAno.getFullYear();
  const m = String(mesAno.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

function mesLabelYyyyMm(key: string): string {
  return key.slice(0, 7);
}

function parseYyyyMm(mes: string): Date {
  const parts = mes.split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
}

function nextMonth(mesAno: Date): Date {
  if (mesAno.getMonth() === 11) return new Date(mesAno.getFullYear() + 1, 0, 1);
  return new Date(mesAno.getFullYear(), mesAno.getMonth() + 1, 1);
}

/** Remove grafias duplicadas (ex.: melaminico / melamínico) no cadastro. */
export async function unificarSetoresMelaminicoDuplicados(): Promise<void> {
  const alias = 'Móveis em melaminico';
  const canon = SETOR_MOVEIS_MELAMINICO;
  const aliases = await prisma.painelProducaoMeta.findMany({ where: { setor: alias } });
  if (aliases.length === 0) return;

  for (const row of aliases) {
    const existente = await prisma.painelProducaoMeta.findUnique({
      where: { setor_mesAno: { setor: canon, mesAno: row.mesAno } },
    });
    if (existente) {
      await prisma.painelProducaoMeta.delete({ where: { id: row.id } });
    } else {
      await prisma.painelProducaoMeta.update({
        where: { id: row.id },
        data: { setor: canon },
      });
    }
  }
  clearPainelProducaoCaches();
}

async function listSetoresCadastro(): Promise<string[]> {
  const rows = await prisma.painelProducaoMeta.findMany({
    select: { setor: true },
    distinct: ['setor'],
    orderBy: { setor: 'asc' },
  });
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    const setor = canonicalizeSetorPainel(r.setor);
    if (!setor || seen.has(setor)) continue;
    seen.add(setor);
    out.push(setor);
  }
  return out.sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

async function initPainelMesesFromTargets(): Promise<void> {
  const count = await prisma.painelProducaoMes.count();
  if (count > 0) return;

  const rows = await prisma.painelProducaoMeta.findMany({
    select: { mesAno: true },
    distinct: ['mesAno'],
    orderBy: { mesAno: 'asc' },
  });

  for (const row of rows) {
    const key = row.mesAno.slice(0, 10);
    if (key.length < 7) continue;
    const mesAno = key.length === 7 ? mesKey(parseYyyyMm(key.slice(0, 7))) : key;
    await prisma.painelProducaoMes.upsert({
      where: { mesAno },
      create: { mesAno, origem: 'import' },
      update: {},
    });
  }
}

async function registrarMesZerado(mesAno: Date, origem: string): Promise<boolean> {
  const key = mesKey(mesAno);
  const exists = await prisma.painelProducaoMes.findUnique({ where: { mesAno: key } });
  if (exists) return false;

  await prisma.painelProducaoMes.create({ data: { mesAno: key, origem } });

  const setores = await listSetoresCadastro();
  for (const setor of setores) {
    // Valores e flag de penalização: repete o último cadastro do setor.
    const metaAnterior = await prisma.painelProducaoMeta.findFirst({
      where: { setor, mesAno: { lt: key } },
      orderBy: { mesAno: 'desc' },
      select: {
        valorBronze: true,
        valorPrata: true,
        valorAco: true,
        considerarPenalizacoes: true,
      },
    });
    await prisma.painelProducaoMeta.upsert({
      where: { setor_mesAno: { setor, mesAno: key } },
      create: {
        setor,
        mesAno: key,
        target: 0,
        semMeta: false,
        valorBronze: metaAnterior?.valorBronze ?? null,
        valorPrata: metaAnterior?.valorPrata ?? null,
        valorAco: metaAnterior?.valorAco ?? null,
        considerarPenalizacoes: metaAnterior?.considerarPenalizacoes ?? true,
      },
      update: {},
    });
  }
  await copiarFaixasParaMes(key);
  return true;
}

export async function ensureCurrentMonth(): Promise<string | null> {
  await unificarSetoresMelaminicoDuplicados();
  const hoje = new Date();
  const mesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  await initPainelMesesFromTargets();
  const created = await registrarMesZerado(mesAtual, 'auto');
  const y = mesAtual.getFullYear();
  const m = String(mesAtual.getMonth() + 1).padStart(2, '0');
  return created ? `${y}-${m}` : null;
}

export async function advanceNextMonth(): Promise<{ mes: string; origem: string }> {
  await initPainelMesesFromTargets();

  const ultimoRow = await prisma.painelProducaoMes.findFirst({
    orderBy: { mesAno: 'desc' },
  });

  let proximo: Date;
  if (ultimoRow) {
    proximo = nextMonth(parseYyyyMm(ultimoRow.mesAno.slice(0, 7)));
  } else {
    const hoje = new Date();
    proximo = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  }

  const created = await registrarMesZerado(proximo, 'manual');
  if (!created) {
    const y = proximo.getFullYear();
    const m = String(proximo.getMonth() + 1).padStart(2, '0');
    throw new Error(`O mês ${y}-${m} já está cadastrado.`);
  }

  clearPainelProducaoCaches();
  const y = proximo.getFullYear();
  const m = String(proximo.getMonth() + 1).padStart(2, '0');
  return { mes: `${y}-${m}`, origem: 'manual' };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export async function initPainelProducaoMetas(): Promise<void> {
  const count = await prisma.painelProducaoMeta.count();
  if (count === 0 && fs.existsSync(CSV_PATH)) {
    const raw = fs.readFileSync(CSV_PATH, 'utf-8').replace(/^\uFEFF/, '');
    const lines = raw.split(/\r?\n/).filter((l) => l.trim());
    const header = parseCsvLine(lines[0] ?? '');
    const setorIdx = header.findIndex((h) => h.toLowerCase().includes('setor'));
    const mesIdx = header.findIndex((h) => h.toLowerCase().includes('mes'));
    const targetIdx = header.findIndex((h) => h.toLowerCase().includes('target'));

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const setor = canonicalizeSetorPainel(cols[setorIdx]?.trim() ?? '');
      const mesRaw = cols[mesIdx]?.trim();
      const targetRaw = cols[targetIdx]?.trim();
      if (!setor || !mesRaw || !targetRaw) continue;

      const dt = new Date(mesRaw.replace('Z', ''));
      const mesAno = mesKey(dt);
      await prisma.painelProducaoMeta.upsert({
        where: { setor_mesAno: { setor, mesAno } },
        create: { setor, mesAno, target: Number(targetRaw), semMeta: false },
        update: {},
      });
    }
  }

  await unificarSetoresMelaminicoDuplicados();
  await initPainelMesesFromTargets();

  const mesesDistintos = await prisma.painelProducaoMeta.findMany({
    select: { mesAno: true },
    distinct: ['mesAno'],
  });
  for (const row of mesesDistintos) {
    const key = mesKey(parseYyyyMm(row.mesAno.slice(0, 7)));
    await prisma.painelProducaoMes.upsert({
      where: { mesAno: key },
      create: { mesAno: key, origem: 'import' },
      update: {},
    });
  }

  await ensureCurrentMonth();
}

export async function listTargets(setor?: string, mes?: string) {
  const setorCanon = setor ? canonicalizeSetorPainel(setor) : undefined;
  const rows = await prisma.painelProducaoMeta.findMany({
    where: {
      ...(setorCanon ? { setor: setorCanon } : {}),
      ...(mes ? { mesAno: { startsWith: mes } } : {}),
    },
    orderBy: [{ mesAno: 'desc' }, { setor: 'asc' }],
  });
  return rows.map((r) => ({
    id: r.id,
    setor: canonicalizeSetorPainel(r.setor),
    mes_ano: r.mesAno,
    target: r.target,
    sem_meta: r.semMeta,
    meta_bronze: r.metaBronze,
    meta_prata: r.metaPrata,
    meta_aco: r.metaAco,
    valor_bronze: r.valorBronze,
    valor_prata: r.valorPrata,
    valor_aco: r.valorAco,
    considerar_penalizacoes: r.considerarPenalizacoes,
  }));
}

export async function getTargetInfo(setor: string, mesAno: Date): Promise<{ target: number; sem_meta: boolean }> {
  const key = mesKey(mesAno);
  const setorCanon = canonicalizeSetorPainel(setor);
  const row = await prisma.painelProducaoMeta.findUnique({
    where: { setor_mesAno: { setor: setorCanon, mesAno: key } },
  });
  if (!row) return { target: 0, sem_meta: false };
  return { target: row.target, sem_meta: row.semMeta };
}

export type NivelMeta = 'Bronze' | 'Prata' | 'Aço';

export type MetaNiveis = {
  metas: Record<NivelMeta, number | null>;
  valores: Record<NivelMeta, number | null>;
};

export async function getMetaNiveis(setor: string, mes: string): Promise<MetaNiveis> {
  const key = mesKey(parseYyyyMm(mes));
  const setorCanon = canonicalizeSetorPainel(setor);
  const row = await prisma.painelProducaoMeta.findUnique({
    where: { setor_mesAno: { setor: setorCanon, mesAno: key } },
  });
  return {
    metas: {
      Bronze: row?.metaBronze ?? null,
      Prata: row?.metaPrata ?? null,
      Aço: row?.metaAco ?? null,
    },
    valores: {
      Bronze: row?.valorBronze ?? null,
      Prata: row?.valorPrata ?? null,
      Aço: row?.valorAco ?? null,
    },
  };
}

export async function getTarget(setor: string, mesAno: Date): Promise<number> {
  const info = await getTargetInfo(setor, mesAno);
  if (info.sem_meta) return 0;
  return info.target;
}

export async function isSemMeta(setor: string, mesAno: Date): Promise<boolean> {
  const info = await getTargetInfo(setor, mesAno);
  return info.sem_meta;
}

export type TargetNiveisInput = {
  meta_bronze?: number | null;
  meta_prata?: number | null;
  meta_aco?: number | null;
  valor_bronze?: number | null;
  valor_prata?: number | null;
  valor_aco?: number | null;
};

export async function upsertTarget(
  setor: string,
  mesAno: Date,
  value: number,
  semMeta: boolean,
  niveis: TargetNiveisInput = {},
) {
  const key = mesKey(mesAno);
  const setorCanon = canonicalizeSetorPainel(setor);
  const dados = {
    metaBronze: niveis.meta_bronze ?? null,
    metaPrata: niveis.meta_prata ?? null,
    metaAco: niveis.meta_aco ?? null,
    valorBronze: niveis.valor_bronze ?? null,
    valorPrata: niveis.valor_prata ?? null,
    valorAco: niveis.valor_aco ?? null,
  };
  const row = await prisma.painelProducaoMeta.upsert({
    where: { setor_mesAno: { setor: setorCanon, mesAno: key } },
    create: { setor: setorCanon, mesAno: key, target: value, semMeta, ...dados },
    update: { target: value, semMeta, ...dados },
  });
  clearPainelProducaoCaches();
  return {
    id: row.id,
    setor: row.setor,
    mes_ano: row.mesAno,
    target: row.target,
    sem_meta: row.semMeta,
    meta_bronze: row.metaBronze,
    meta_prata: row.metaPrata,
    meta_aco: row.metaAco,
    valor_bronze: row.valorBronze,
    valor_prata: row.valorPrata,
    valor_aco: row.valorAco,
    considerar_penalizacoes: row.considerarPenalizacoes,
  };
}

export async function listSetoresMeta(): Promise<string[]> {
  return listSetoresCadastro();
}

export async function listMesesMeta(): Promise<string[]> {
  const rows = await prisma.painelProducaoMes.findMany({ orderBy: { mesAno: 'desc' } });
  if (rows.length > 0) {
    return rows.map((r) => mesLabelYyyyMm(r.mesAno));
  }
  const fallback = await prisma.painelProducaoMeta.findMany({
    select: { mesAno: true },
    distinct: ['mesAno'],
    orderBy: { mesAno: 'desc' },
  });
  return fallback.map((r) => r.mesAno.slice(0, 7));
}

export async function getConsiderarPenalizacoes(mes: string, setor: string): Promise<boolean> {
  const key = mesKey(parseYyyyMm(mes));
  const setorCanon = canonicalizeSetorPainel(setor);
  const row = await prisma.painelProducaoMeta.findUnique({
    where: { setor_mesAno: { setor: setorCanon, mesAno: key } },
    select: { considerarPenalizacoes: true },
  });
  return row?.considerarPenalizacoes ?? true;
}

export async function setConsiderarPenalizacoesSetor(
  mes: string,
  setor: string,
  considerar: boolean,
): Promise<{
  mes: string;
  setor: string;
  considerar_penalizacoes: boolean;
}> {
  const key = mesKey(parseYyyyMm(mes));
  const setorCanon = canonicalizeSetorPainel(setor);
  const existente = await prisma.painelProducaoMeta.findUnique({
    where: { setor_mesAno: { setor: setorCanon, mesAno: key } },
  });
  if (existente) {
    await prisma.painelProducaoMeta.update({
      where: { setor_mesAno: { setor: setorCanon, mesAno: key } },
      data: { considerarPenalizacoes: considerar },
    });
  } else {
    await prisma.painelProducaoMeta.create({
      data: {
        setor: setorCanon,
        mesAno: key,
        target: 0,
        semMeta: false,
        considerarPenalizacoes: considerar,
      },
    });
  }
  clearPainelProducaoCaches();
  return {
    mes: mesLabelYyyyMm(key),
    setor: setorCanon,
    considerar_penalizacoes: considerar,
  };
}
