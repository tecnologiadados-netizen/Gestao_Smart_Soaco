import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import {
  isValidUuid,
  normalizeOrganicoStatus,
  parseIsoDate,
  parseValuesJson,
  s,
} from '../utils/rhHelpers.js';

type Tx = Prisma.TransactionClient;

export type ReplaceResult = { ok: true; inserted: number; snapshotId: string | null };

async function saveReplaceSnapshot(
  tx: Tx,
  input: {
    dataset: string;
    actor: string | null;
    action: string;
    rowCountBefore: number;
    snapshotJson: unknown;
    meta?: Record<string, unknown>;
  },
): Promise<string> {
  const row = await tx.rhReplaceSnapshots.create({
    data: {
      dataset: input.dataset,
      actor: input.actor,
      action: input.action,
      rowCountBefore: input.rowCountBefore,
      snapshotJson: JSON.stringify(input.snapshotJson ?? []),
      metaJson: JSON.stringify(input.meta ?? {}),
    },
  });
  return row.id;
}

export type OrganicoReplaceRow = {
  matricula?: string;
  nome?: string;
  cargo?: string;
  setor?: string;
  area?: string | null;
  lider?: string | null;
  dataAdmissao?: string | null;
  status?: string;
  values?: unknown[];
};

export async function replaceOrganicoSafe(
  rows: OrganicoReplaceRow[],
  actor: string | null,
  allowEmpty: boolean,
): Promise<ReplaceResult> {
  if (!Array.isArray(rows)) throw new Error('Payload inválido para Orgânico.');
  if (rows.length === 0 && !allowEmpty) {
    throw new Error('Operação bloqueada: payload vazio para Orgânico.');
  }

  return prisma.$transaction(async (tx) => {
    const before = await tx.rhOrganico.findMany({ orderBy: [{ nome: 'asc' }, { matricula: 'asc' }] });
    const snapshotId = await saveReplaceSnapshot(tx, {
      dataset: 'organico',
      actor,
      action: allowEmpty && rows.length === 0 ? 'clear' : 'replace',
      rowCountBefore: before.length,
      snapshotJson: before,
      meta: { requested_rows: rows.length },
    });

    await tx.rhOrganico.deleteMany();

    if (rows.length > 0) {
      await tx.rhOrganico.createMany({
        data: rows.map((r) => {
          const values = Array.isArray(r.values) ? r.values : [];
          return {
            matricula: s(r.matricula) || '—',
            nome: s(r.nome) || '—',
            cargo: s(r.cargo) || '—',
            setor: s(r.setor) || '—',
            area: s(r.area) || null,
            lider: s(r.lider) || null,
            dataAdmissao: parseIsoDate(r.dataAdmissao ?? null),
            status: normalizeOrganicoStatus(s(r.status) || 'Ativo'),
            valuesJson: JSON.stringify(values),
          };
        }),
      });
    }

    return { ok: true, inserted: rows.length, snapshotId };
  });
}

export type FaltaAtestadoReplaceRow = {
  id?: string;
  data?: string;
  mesFalta?: string;
  matricula?: string;
  nomeFuncionario?: string;
  endereco?: string;
  area?: string;
  setor?: string;
  lider?: string;
  periodo?: string;
  qntd?: string;
  diasTurno?: string;
  tipo?: string;
  cid?: string;
  localAtendimento?: string;
  medicoResponsavel?: string;
  observacoes?: string;
  aprovado?: string;
  reprovado?: string;
};

function mapFaltaRow(r: FaltaAtestadoReplaceRow) {
  const data = parseIsoDate(r.data);
  if (!data) return null;
  const idStr = s(r.id);
  return {
    ...(isValidUuid(idStr) ? { id: idStr } : {}),
    data,
    mesFalta: s(r.mesFalta) || null,
    matricula: s(r.matricula) || '—',
    nomeFuncionario: s(r.nomeFuncionario) || '—',
    endereco: s(r.endereco) || null,
    area: s(r.area) || null,
    setor: s(r.setor) || null,
    lider: s(r.lider) || null,
    periodo: s(r.periodo) || null,
    qntd: s(r.qntd) || null,
    diasTurno: s(r.diasTurno) || null,
    tipo: s(r.tipo) || null,
    cid: s(r.cid) || null,
    localAtendimento: s(r.localAtendimento) || null,
    medicoResponsavel: s(r.medicoResponsavel) || null,
    observacoes: s(r.observacoes) || null,
    aprovado: s(r.aprovado) || null,
    reprovado: s(r.reprovado) || null,
  };
}

export async function replaceFaltasAtestadosSafe(
  rows: FaltaAtestadoReplaceRow[],
  actor: string | null,
  allowEmpty: boolean,
): Promise<ReplaceResult> {
  if (!Array.isArray(rows)) throw new Error('Payload inválido para faltas/atestados.');
  if (rows.length === 0 && !allowEmpty) {
    throw new Error('Operação bloqueada: payload vazio para faltas/atestados.');
  }

  const mapped = rows.map(mapFaltaRow).filter((r): r is NonNullable<typeof r> => r != null);

  return prisma.$transaction(async (tx) => {
    const before = await tx.rhFaltasAtestados.findMany({
      orderBy: [{ data: 'asc' }, { nomeFuncionario: 'asc' }],
    });
    const snapshotId = await saveReplaceSnapshot(tx, {
      dataset: 'faltas_atestados',
      actor,
      action: allowEmpty && mapped.length === 0 ? 'clear' : 'replace',
      rowCountBefore: before.length,
      snapshotJson: before,
      meta: { requested_rows: mapped.length },
    });

    await tx.rhFaltasAtestados.deleteMany();
    if (mapped.length > 0) {
      await tx.rhFaltasAtestados.createMany({ data: mapped });
    }

    return { ok: true, inserted: mapped.length, snapshotId };
  });
}

export type SancaoReplaceRow = {
  matricula?: string;
  nomeFuncionario?: string;
  tipo?: string;
  dataAplicacao?: string;
  mes?: string;
  ano?: string;
  observacoes?: string;
};

export async function replaceSancoesDisciplinaresSafe(
  rows: SancaoReplaceRow[],
  actor: string | null,
  allowEmpty: boolean,
): Promise<ReplaceResult> {
  if (!Array.isArray(rows)) throw new Error('Payload inválido para sanções disciplinares.');
  if (rows.length === 0 && !allowEmpty) {
    throw new Error('Operação bloqueada: payload vazio para sanções disciplinares.');
  }

  const mapped = rows
    .map((r) => {
      const dataAplicacao = parseIsoDate(r.dataAplicacao);
      if (!dataAplicacao) return null;
      return {
        matricula: s(r.matricula) || '—',
        nomeFuncionario: s(r.nomeFuncionario) || '—',
        tipo: s(r.tipo) || null,
        dataAplicacao,
        mes: s(r.mes) || null,
        ano: s(r.ano) || null,
        observacoes: s(r.observacoes) || null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r != null);

  return prisma.$transaction(async (tx) => {
    const before = await tx.rhSancoesDisciplinares.findMany({
      orderBy: [{ dataAplicacao: 'asc' }, { nomeFuncionario: 'asc' }],
    });
    const snapshotId = await saveReplaceSnapshot(tx, {
      dataset: 'sancoes_disciplinares',
      actor,
      action: allowEmpty && mapped.length === 0 ? 'clear' : 'replace',
      rowCountBefore: before.length,
      snapshotJson: before,
      meta: { requested_rows: mapped.length },
    });

    await tx.rhSancoesDisciplinares.deleteMany();
    if (mapped.length > 0) {
      await tx.rhSancoesDisciplinares.createMany({ data: mapped });
    }

    return { ok: true, inserted: mapped.length, snapshotId };
  });
}

type TipoRegraInput = {
  tipo?: string;
  contabilizaIndicadores?: boolean;
  classificacaoIndicador?: string | null;
  exibirNoDetalhamento?: boolean;
};

function tipoRegraFor(
  tipo: string,
  tiposRegras: TipoRegraInput[],
): { contabilizaIndicadores: boolean; classificacaoIndicador: string | null; exibirNoDetalhamento: boolean } {
  const found = tiposRegras.find(
    (r) => s(r.tipo).toUpperCase() === tipo.toUpperCase(),
  );
  const contabiliza = found?.contabilizaIndicadores !== false;
  const classificacao = contabiliza
    ? found?.classificacaoIndicador === 'justificada' || found?.classificacaoIndicador === 'injustificada'
      ? found.classificacaoIndicador
      : null
    : null;
  return {
    contabilizaIndicadores: contabiliza,
    classificacaoIndicador: classificacao,
    exibirNoDetalhamento: found?.exibirNoDetalhamento !== false,
  };
}

export async function replaceFaltasCadastrosSafe(input: {
  periodos: string[];
  tipos: string[];
  cids: string[];
  tiposRegras?: TipoRegraInput[];
  tiposSancoes?: string[];
  categoriasDocumentos?: string[];
  replaceTiposSancoes?: boolean;
  replaceCategoriasDocumentos?: boolean;
  actor: string | null;
  allowEmpty: boolean;
}): Promise<ReplaceResult> {
  const periodos = input.periodos.map(s).filter(Boolean);
  const tipos = input.tipos.map(s).filter(Boolean);
  const cids = input.cids.map(s).filter(Boolean);
  const tiposRegras = Array.isArray(input.tiposRegras) ? input.tiposRegras : [];
  const tiposSancoes = (input.tiposSancoes ?? []).map(s).filter(Boolean);
  const categoriasDocumentos = (input.categoriasDocumentos ?? []).map(s).filter(Boolean);
  const replaceTiposSancoes = input.replaceTiposSancoes === true;
  const replaceCategoriasDocumentos = input.replaceCategoriasDocumentos === true;

  const inserted =
    periodos.length +
    tipos.length +
    cids.length +
    (replaceTiposSancoes ? tiposSancoes.length : 0) +
    (replaceCategoriasDocumentos ? categoriasDocumentos.length : 0);

  if (inserted === 0 && !input.allowEmpty) {
    throw new Error('Operação bloqueada: payload vazio para cadastros.');
  }

  return prisma.$transaction(async (tx) => {
    const [pBefore, tBefore, cBefore, sBefore, catBefore] = await Promise.all([
      tx.rhFaltasCadPeriodos.findMany({ orderBy: { ordem: 'asc' } }),
      tx.rhFaltasCadTipos.findMany({ orderBy: { ordem: 'asc' } }),
      tx.rhFaltasCadCids.findMany({ orderBy: { ordem: 'asc' } }),
      tx.rhFaltasCadTiposSancoes.findMany({ orderBy: { ordem: 'asc' } }),
      tx.rhFaltasCadCategoriasDocumentos.findMany({ orderBy: { ordem: 'asc' } }),
    ]);

    const snapshotId = await saveReplaceSnapshot(tx, {
      dataset: 'faltas_cadastros',
      actor: input.actor,
      action: input.allowEmpty && inserted === 0 ? 'clear' : 'replace',
      rowCountBefore: pBefore.length + tBefore.length + cBefore.length + sBefore.length + catBefore.length,
      snapshotJson: {
        periodos: pBefore,
        tipos: tBefore,
        cids: cBefore,
        tiposSancoes: sBefore,
        categoriasDocumentos: catBefore,
      },
      meta: { replace_tipos_sancoes: replaceTiposSancoes, replace_categorias_documentos: replaceCategoriasDocumentos },
    });

    await tx.rhFaltasCadPeriodos.deleteMany();
    await tx.rhFaltasCadTipos.deleteMany();
    await tx.rhFaltasCadCids.deleteMany();
    if (replaceTiposSancoes) await tx.rhFaltasCadTiposSancoes.deleteMany();
    if (replaceCategoriasDocumentos) await tx.rhFaltasCadCategoriasDocumentos.deleteMany();

    if (periodos.length > 0) {
      await tx.rhFaltasCadPeriodos.createMany({
        data: periodos.map((valor, i) => ({ ordem: i + 1, valor })),
      });
    }
    if (tipos.length > 0) {
      await tx.rhFaltasCadTipos.createMany({
        data: tipos.map((valor, i) => {
          const regra = tipoRegraFor(valor, tiposRegras);
          return { ordem: i + 1, valor, ...regra };
        }),
      });
    }
    if (cids.length > 0) {
      await tx.rhFaltasCadCids.createMany({
        data: cids.map((valor, i) => ({ ordem: i + 1, valor })),
      });
    }
    if (replaceTiposSancoes && tiposSancoes.length > 0) {
      await tx.rhFaltasCadTiposSancoes.createMany({
        data: tiposSancoes.map((valor, i) => ({ ordem: i + 1, valor })),
      });
    }
    if (replaceCategoriasDocumentos && categoriasDocumentos.length > 0) {
      await tx.rhFaltasCadCategoriasDocumentos.createMany({
        data: categoriasDocumentos.map((valor, i) => ({ ordem: i + 1, valor })),
      });
    }

    return { ok: true, inserted, snapshotId };
  });
}

export async function replacePontualidadePontoSafe(input: {
  rows: unknown[];
  dateRangeStart?: string | null;
  dateRangeEnd?: string | null;
  actor: string | null;
  allowEmpty: boolean;
}): Promise<{ ok: true; count: number; snapshotId: string | null }> {
  const rows = Array.isArray(input.rows) ? input.rows : [];
  if (rows.length === 0 && !input.allowEmpty) {
    throw new Error('Operação bloqueada: payload vazio para pontualidade.');
  }

  return prisma.$transaction(async (tx) => {
    const before = await tx.rhPontualidadePontoSnapshot.findUnique({ where: { id: 'default' } });
    const beforeCount = before ? JSON.parse(before.rowsJson || '[]').length : 0;
    const snapshotId = await saveReplaceSnapshot(tx, {
      dataset: 'pontualidade_ponto_snapshot',
      actor: input.actor,
      action: input.allowEmpty && rows.length === 0 ? 'clear' : 'replace',
      rowCountBefore: beforeCount,
      snapshotJson: before,
      meta: { requested_rows: rows.length },
    });

    await tx.rhPontualidadePontoSnapshot.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        rowsJson: JSON.stringify(rows),
        dateRangeStart: s(input.dateRangeStart) || null,
        dateRangeEnd: s(input.dateRangeEnd) || null,
      },
      update: {
        rowsJson: JSON.stringify(rows),
        dateRangeStart: s(input.dateRangeStart) || null,
        dateRangeEnd: s(input.dateRangeEnd) || null,
      },
    });

    return { ok: true, count: rows.length, snapshotId };
  });
}

export function mapDbFaltaToReplaceRow(row: {
  id: string;
  data: Date;
  mesFalta: string | null;
  matricula: string;
  nomeFuncionario: string;
  endereco: string | null;
  area: string | null;
  setor: string | null;
  lider: string | null;
  periodo: string | null;
  qntd: string | null;
  diasTurno: string | null;
  tipo: string | null;
  cid: string | null;
  localAtendimento: string | null;
  medicoResponsavel: string | null;
  observacoes: string | null;
  aprovado: string | null;
  reprovado: string | null;
}): FaltaAtestadoReplaceRow {
  return {
    id: row.id,
    data: row.data.toISOString().slice(0, 10),
    mesFalta: row.mesFalta ?? '',
    matricula: row.matricula,
    nomeFuncionario: row.nomeFuncionario,
    endereco: row.endereco ?? '',
    area: row.area ?? '',
    setor: row.setor ?? '',
    lider: row.lider ?? '',
    periodo: row.periodo ?? '',
    qntd: row.qntd ?? '',
    diasTurno: row.diasTurno ?? '',
    tipo: row.tipo ?? '',
    cid: row.cid ?? '',
    localAtendimento: row.localAtendimento ?? '',
    medicoResponsavel: row.medicoResponsavel ?? '',
    observacoes: row.observacoes ?? '',
    aprovado: row.aprovado ?? '',
    reprovado: row.reprovado ?? '',
  };
}

export { parseValuesJson };
