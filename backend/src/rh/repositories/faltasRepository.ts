import { prisma } from '../../config/prisma.js';
import { hasSectorAccess } from '../lib/rh-permissions.js';
import type { RhGroupPermissions } from '../lib/rh-permissions.js';
import { formatIsoDate, monthBounds, s } from '../utils/rhHelpers.js';
import {
  mapDbFaltaToReplaceRow,
  replaceFaltasAtestadosSafe,
  replaceSancoesDisciplinaresSafe,
  type FaltaAtestadoReplaceRow,
  type SancaoReplaceRow,
} from './replaceRepository.js';

function mapFaltaRow(r: {
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
}) {
  return {
    id: r.id,
    data: formatIsoDate(r.data),
    mesFalta: r.mesFalta ?? '',
    matricula: r.matricula,
    nomeFuncionario: r.nomeFuncionario,
    endereco: r.endereco ?? '',
    area: r.area ?? '',
    setor: r.setor ?? '',
    lider: r.lider ?? '',
    periodo: r.periodo ?? '',
    qntd: r.qntd ?? '',
    diasTurno: r.diasTurno ?? '',
    tipo: r.tipo ?? '',
    cid: r.cid ?? '',
    localAtendimento: r.localAtendimento ?? '',
    medicoResponsavel: r.medicoResponsavel ?? '',
    observacoes: r.observacoes ?? '',
    aprovado: r.aprovado ?? '',
    reprovado: r.reprovado ?? '',
  };
}

function mapSancaoRow(r: {
  id: string;
  matricula: string;
  nomeFuncionario: string;
  tipo: string | null;
  dataAplicacao: Date;
  mes: string | null;
  ano: string | null;
  observacoes: string | null;
}) {
  return {
    id: r.id,
    matricula: r.matricula,
    nomeFuncionario: r.nomeFuncionario,
    tipo: r.tipo ?? '',
    dataAplicacao: formatIsoDate(r.dataAplicacao),
    mes: r.mes ?? '',
    ano: r.ano ?? '',
    observacoes: r.observacoes ?? '',
  };
}

async function distinctMonthsFromData(field: 'data' | 'dataAplicacao') {
  const rows =
    field === 'data'
      ? await prisma.rhFaltasAtestados.findMany({ select: { data: true }, orderBy: { data: 'asc' } })
      : await prisma.rhSancoesDisciplinares.findMany({
          select: { dataAplicacao: true },
          orderBy: { dataAplicacao: 'asc' },
        });

  const set = new Set<string>();
  for (const row of rows) {
    const d = field === 'data' ? (row as { data: Date }).data : (row as { dataAplicacao: Date }).dataAplicacao;
    const iso = formatIsoDate(d);
    if (iso.length >= 7) set.add(iso.slice(0, 7));
  }
  return [...set].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
}

function filterByMonths<T extends { data?: Date; dataAplicacao?: Date }>(
  rows: T[],
  monthsParam: string | undefined,
  field: 'data' | 'dataAplicacao',
): T[] {
  if (!monthsParam) return rows;
  const parts = monthsParam.split(',').map((x) => x.trim()).filter(Boolean);
  const bounds = parts.map(monthBounds).filter((b): b is NonNullable<typeof b> => b != null);
  if (bounds.length === 0) return rows;
  return rows.filter((row) => {
    const d = field === 'data' ? row.data : row.dataAplicacao;
    if (!d) return false;
    return bounds.some((b) => d >= b.start && d <= b.end);
  });
}

function excludeMonths<T extends { data?: Date; dataAplicacao?: Date }>(
  rows: T[],
  omitMonths: string[],
  field: 'data' | 'dataAplicacao',
): T[] {
  if (omitMonths.length === 0) return rows;
  const omit = new Set(omitMonths);
  return rows.filter((row) => {
    const d = field === 'data' ? row.data : row.dataAplicacao;
    if (!d) return true;
    return !omit.has(formatIsoDate(d).slice(0, 7));
  });
}

export async function getFaltasAtestados(input: {
  isMaster: boolean;
  permissions: RhGroupPermissions;
  distinctMonths?: boolean;
  months?: string;
  omitMonths?: string;
  matricula?: string;
  desde?: string;
  ate?: string;
}) {
  if (input.distinctMonths) {
    return { months: await distinctMonthsFromData('data') };
  }

  let rows = await prisma.rhFaltasAtestados.findMany({ orderBy: { data: 'desc' } });

  if (input.matricula && input.desde && input.ate) {
    const desde = new Date(`${input.desde}T00:00:00.000Z`);
    const ate = new Date(`${input.ate}T23:59:59.999Z`);
    const mNorm = input.matricula.replace(/^0+/, '').toUpperCase();
    rows = rows.filter(
      (r) =>
        r.data >= desde &&
        r.data <= ate &&
        r.matricula.replace(/^0+/, '').toUpperCase() === mNorm,
    );
  } else if (input.omitMonths && !input.months) {
    const omitYm = input.omitMonths
      .split(',')
      .map((x) => x.trim())
      .filter((x) => /^\d{4}-\d{2}$/.test(x));
    rows = excludeMonths(rows, omitYm, 'data');
  } else {
    rows = filterByMonths(rows, input.months, 'data');
  }

  return rows
    .filter((row) => input.isMaster || hasSectorAccess(input.permissions, row.setor))
    .map(mapFaltaRow);
}

export async function replaceFaltasAtestadosWithSectorMerge(input: {
  rows: FaltaAtestadoReplaceRow[];
  allowEmpty: boolean;
  actor: string;
  isMaster: boolean;
  permissions: RhGroupPermissions | null;
}) {
  let rpcPayload = input.rows;

  if (!input.isMaster && input.permissions) {
    const dbRows = await prisma.rhFaltasAtestados.findMany();
    const preserved = dbRows
      .filter((r) => !hasSectorAccess(input.permissions!, r.setor))
      .map(mapDbFaltaToReplaceRow);
    rpcPayload = [...preserved, ...input.rows];
  }

  return replaceFaltasAtestadosSafe(rpcPayload, input.actor, input.allowEmpty);
}

export async function getSancoesDisciplinares(input: {
  distinctMonths?: boolean;
  months?: string;
  omitMonths?: string;
}) {
  if (input.distinctMonths) {
    return { months: await distinctMonthsFromData('dataAplicacao') };
  }

  let rows = await prisma.rhSancoesDisciplinares.findMany({ orderBy: { dataAplicacao: 'desc' } });

  if (input.omitMonths && !input.months) {
    const omitYm = input.omitMonths
      .split(',')
      .map((x) => x.trim())
      .filter((x) => /^\d{4}-\d{2}$/.test(x));
    rows = excludeMonths(rows, omitYm, 'dataAplicacao');
  } else {
    rows = filterByMonths(rows, input.months, 'dataAplicacao');
  }

  return rows.map(mapSancaoRow);
}

export async function replaceSancoes(rows: SancaoReplaceRow[], actor: string, allowEmpty: boolean) {
  return replaceSancoesDisciplinaresSafe(rows, actor, allowEmpty);
}

function mapCadItem(r: {
  id: string;
  ordem: number;
  valor: string;
  contabilizaIndicadores?: boolean;
  classificacaoIndicador?: string | null;
  exibirNoDetalhamento?: boolean;
}) {
  return {
    id: r.id,
    ordem: r.ordem,
    valor: r.valor,
    contabilizaIndicadores: r.contabilizaIndicadores,
    classificacaoIndicador: r.classificacaoIndicador ?? null,
    exibirNoDetalhamento: r.exibirNoDetalhamento,
  };
}

export async function getFaltasCadastros() {
  const [periodos, tipos, cids, tiposSancoes, categoriasDocumentos] = await Promise.all([
    prisma.rhFaltasCadPeriodos.findMany({ orderBy: { ordem: 'asc' } }),
    prisma.rhFaltasCadTipos.findMany({ orderBy: { ordem: 'asc' } }),
    prisma.rhFaltasCadCids.findMany({ orderBy: { ordem: 'asc' } }),
    prisma.rhFaltasCadTiposSancoes.findMany({ orderBy: { ordem: 'asc' } }),
    prisma.rhFaltasCadCategoriasDocumentos.findMany({ orderBy: { ordem: 'asc' } }),
  ]);

  return {
    periodos: periodos.map(mapCadItem),
    tipos: tipos.map(mapCadItem),
    cids: cids.map(mapCadItem),
    tiposSancoes: tiposSancoes.map(mapCadItem),
    categoriasDocumentos: categoriasDocumentos.map(mapCadItem),
  };
}

export async function getPontualidadePonto() {
  const row = await prisma.rhPontualidadePontoSnapshot.findUnique({ where: { id: 'default' } });
  const rows = row ? JSON.parse(row.rowsJson || '[]') : [];
  return {
    rows: Array.isArray(rows) ? rows : [],
    dateRangeStart: row?.dateRangeStart ?? '',
    dateRangeEnd: row?.dateRangeEnd ?? '',
    updatedAt: row?.updatedAt?.toISOString() ?? null,
  };
}

export { replaceFaltasCadastrosSafe, replacePontualidadePontoSafe } from './replaceRepository.js';
