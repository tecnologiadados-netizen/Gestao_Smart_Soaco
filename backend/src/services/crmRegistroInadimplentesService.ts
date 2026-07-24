import { prisma } from '../config/prisma.js';
import { criarMatcherTextoLivre } from '../utils/textoLivreBusca.js';
import {
  formatDataContatoBr,
  montarObsFromContatos,
  parseObsInadimplente,
} from '../utils/parseObsInadimplente.js';

export type RegistroInadimplenteInput = {
  vencimento?: string | null;
  pagamento?: string | null;
  empresa?: string | null;
  banco?: string | null;
  tipo?: string | null;
  cliente: string;
  status?: string | null;
  serasa?: string | null;
  vendedor?: string | null;
  total?: number | null;
  nfPd?: string | null;
  parcela?: string | null;
  obs?: string | null;
};

export type RegistroInadimplenteDto = {
  id: number;
  vencimento: string | null;
  pagamento: string | null;
  empresa: string | null;
  banco: string | null;
  tipo: string | null;
  cliente: string;
  status: string | null;
  serasa: string | null;
  vendedor: string | null;
  total: number | null;
  nfPd: string | null;
  parcela: string | null;
  obs: string | null;
  origemImport: boolean;
  criadoPorLogin: string | null;
  createdAt: string;
  updatedAt: string;
  contatosCount: number;
};

export type ContatoInadimplenteDto = {
  id: number;
  registroId: number;
  dataContato: string | null;
  dataContatoBr: string | null;
  texto: string;
  origem: string;
  criadoPorLogin: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContatoInadimplenteInput = {
  dataContato?: string | null;
  texto: string;
};

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function mapRow(row: {
  id: number;
  vencimento: string | null;
  pagamento: string | null;
  empresa: string | null;
  banco: string | null;
  tipo: string | null;
  cliente: string;
  status: string | null;
  serasa: string | null;
  vendedor: string | null;
  total: number | null;
  nfPd: string | null;
  parcela: string | null;
  obs: string | null;
  origemImport: boolean;
  criadoPorLogin: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { contatos: number };
}): RegistroInadimplenteDto {
  return {
    id: row.id,
    vencimento: row.vencimento,
    pagamento: row.pagamento,
    empresa: row.empresa,
    banco: row.banco,
    tipo: row.tipo,
    cliente: row.cliente,
    status: row.status,
    serasa: row.serasa,
    vendedor: row.vendedor,
    total: row.total,
    nfPd: row.nfPd,
    parcela: row.parcela,
    obs: row.obs,
    origemImport: row.origemImport,
    criadoPorLogin: row.criadoPorLogin,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    contatosCount: row._count?.contatos ?? 0,
  };
}

function mapContato(row: {
  id: number;
  registroId: number;
  dataContato: Date | null;
  texto: string;
  origem: string;
  criadoPorLogin: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ContatoInadimplenteDto {
  return {
    id: row.id,
    registroId: row.registroId,
    dataContato: row.dataContato ? row.dataContato.toISOString() : null,
    dataContatoBr: formatDataContatoBr(row.dataContato),
    texto: row.texto,
    origem: row.origem,
    criadoPorLogin: row.criadoPorLogin,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function normalizeInput(input: RegistroInadimplenteInput): RegistroInadimplenteInput {
  const cliente = strOrNull(input.cliente);
  if (!cliente) {
    throw new Error('Cliente é obrigatório.');
  }
  return {
    vencimento: strOrNull(input.vencimento),
    pagamento: strOrNull(input.pagamento),
    empresa: strOrNull(input.empresa),
    banco: strOrNull(input.banco),
    tipo: strOrNull(input.tipo),
    cliente,
    status: strOrNull(input.status),
    serasa: strOrNull(input.serasa),
    vendedor: strOrNull(input.vendedor),
    total:
      input.total == null || input.total === ('' as unknown)
        ? null
        : Number.isFinite(Number(input.total))
          ? Number(input.total)
          : null,
    nfPd: strOrNull(input.nfPd),
    parcela: strOrNull(input.parcela),
    obs: strOrNull(input.obs),
  };
}

/** Aceita ISO, AAAA-MM-DD ou DD/MM/AAAA. */
function parseDataContatoInput(raw: string | null | undefined): Date | null {
  const s = strOrNull(raw);
  if (!s) return null;

  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    const dd = Number(br[1]);
    const mm = Number(br[2]);
    let yyyy = Number(br[3]);
    if (yyyy < 100) yyyy += 2000;
    const d = new Date(yyyy, mm - 1, dd, 12, 0, 0, 0);
    if (
      Number.isNaN(d.getTime()) ||
      d.getFullYear() !== yyyy ||
      d.getMonth() !== mm - 1 ||
      d.getDate() !== dd
    ) {
      throw new Error('Data do contato inválida.');
    }
    return d;
  }

  const isoDay = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDay) {
    const yyyy = Number(isoDay[1]);
    const mm = Number(isoDay[2]);
    const dd = Number(isoDay[3]);
    const d = new Date(yyyy, mm - 1, dd, 12, 0, 0, 0);
    if (Number.isNaN(d.getTime())) throw new Error('Data do contato inválida.');
    return d;
  }

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error('Data do contato inválida.');
  return d;
}

function normalizeContatoInput(input: ContatoInadimplenteInput): {
  dataContato: Date | null;
  texto: string;
} {
  const texto = strOrNull(input.texto);
  if (!texto) throw new Error('Texto do contato é obrigatório.');
  return {
    dataContato: parseDataContatoInput(input.dataContato),
    texto,
  };
}

async function syncObsDenormalizado(registroId: number): Promise<void> {
  const contatos = await prisma.crmRegistroInadimplenteContato.findMany({
    where: { registroId },
    select: { dataContato: true, texto: true, id: true },
    orderBy: [{ dataContato: 'asc' }, { id: 'asc' }],
  });
  const obs = montarObsFromContatos(contatos);
  await prisma.crmRegistroInadimplente.update({
    where: { id: registroId },
    data: { obs },
  });
}

/**
 * Se o registro ainda não tem contatos e possui OBS legado, materializa os contatos.
 */
export async function ensureContatosFromObs(registroId: number): Promise<number> {
  const registro = await prisma.crmRegistroInadimplente.findUnique({
    where: { id: registroId },
    include: { _count: { select: { contatos: true } } },
  });
  if (!registro) return 0;
  if (registro._count.contatos > 0) return 0;
  const parsed = parseObsInadimplente(registro.obs);
  if (!parsed.length) return 0;

  await prisma.crmRegistroInadimplenteContato.createMany({
    data: parsed.map((p) => ({
      registroId,
      dataContato: p.dataContato,
      texto: p.texto,
      origem: 'legado',
      criadoPorLogin: registro.criadoPorLogin,
    })),
  });
  return parsed.length;
}

/**
 * Reparte contatos "legado" que foram gravados juntos num único card
 * (parser antigo). Só age quando não há contatos manuais, para não duplicar.
 */
export async function repararContatosLegadoAgrupados(registroId: number): Promise<number> {
  const registro = await prisma.crmRegistroInadimplente.findUnique({
    where: { id: registroId },
    include: { contatos: true },
  });
  if (!registro?.obs?.trim()) return 0;

  const manuais = registro.contatos.filter((c) => c.origem === 'manual');
  if (manuais.length > 0) return 0;

  const parsed = parseObsInadimplente(registro.obs);
  if (parsed.length <= 1) return 0;
  if (registro.contatos.length >= parsed.length) return 0;

  await prisma.crmRegistroInadimplenteContato.deleteMany({ where: { registroId } });
  await prisma.crmRegistroInadimplenteContato.createMany({
    data: parsed.map((p) => ({
      registroId,
      dataContato: p.dataContato,
      texto: p.texto,
      origem: 'legado',
      criadoPorLogin: registro.criadoPorLogin,
    })),
  });
  return parsed.length;
}

export async function listRegistroInadimplentes(opts?: {
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ data: RegistroInadimplenteDto[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, Number(opts?.page) || 1);
  const pageSize = Math.min(5000, Math.max(10, Number(opts?.pageSize) || 50));
  const q = (opts?.q ?? '').trim();

  const orderBy = [{ vencimento: 'desc' as const }, { id: 'desc' as const }];
  const includeCount = { _count: { select: { contatos: true } } };

  if (!q) {
    const [total, rows] = await Promise.all([
      prisma.crmRegistroInadimplente.count(),
      prisma.crmRegistroInadimplente.findMany({
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: includeCount,
      }),
    ]);
    return {
      data: rows.map(mapRow),
      total,
      page,
      pageSize,
    };
  }

  const match = criarMatcherTextoLivre(q);
  const all = await prisma.crmRegistroInadimplente.findMany({
    orderBy,
    include: {
      ...includeCount,
      contatos: { select: { texto: true } },
    },
  });
  const filtered = all.filter(
    (r) =>
      match(r.cliente) ||
      match(r.empresa ?? '') ||
      match(r.banco ?? '') ||
      match(r.tipo ?? '') ||
      match(r.status ?? '') ||
      match(r.vendedor ?? '') ||
      match(r.nfPd ?? '') ||
      match(r.obs ?? '') ||
      match(r.serasa ?? '') ||
      r.contatos.some((c) => match(c.texto))
  );
  const total = filtered.length;
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);

  return {
    data: rows.map(mapRow),
    total,
    page,
    pageSize,
  };
}

export async function createRegistroInadimplente(
  input: RegistroInadimplenteInput,
  login?: string | null
): Promise<RegistroInadimplenteDto> {
  const data = normalizeInput(input);
  const obsInicial = data.obs;
  const row = await prisma.crmRegistroInadimplente.create({
    data: {
      ...data,
      origemImport: false,
      criadoPorLogin: login?.trim() || null,
    },
    include: { _count: { select: { contatos: true } } },
  });

  if (obsInicial) {
    const parsed = parseObsInadimplente(obsInicial);
    if (parsed.length) {
      await prisma.crmRegistroInadimplenteContato.createMany({
        data: parsed.map((p) => ({
          registroId: row.id,
          dataContato: p.dataContato ?? new Date(),
          texto: p.texto,
          origem: 'manual',
          criadoPorLogin: login?.trim() || null,
        })),
      });
      await syncObsDenormalizado(row.id);
    }
  }

  const refreshed = await prisma.crmRegistroInadimplente.findUnique({
    where: { id: row.id },
    include: { _count: { select: { contatos: true } } },
  });
  return mapRow(refreshed ?? row);
}

export async function updateRegistroInadimplente(
  id: number,
  input: RegistroInadimplenteInput
): Promise<RegistroInadimplenteDto | null> {
  const existing = await prisma.crmRegistroInadimplente.findUnique({
    where: { id },
    include: { _count: { select: { contatos: true } } },
  });
  if (!existing) return null;
  const data = normalizeInput(input);
  // Obs estruturado vive nos contatos; não sobrescreve o denormalizado pelo formulário.
  const { obs: _obsIgnored, ...rest } = data;
  void _obsIgnored;
  const row = await prisma.crmRegistroInadimplente.update({
    where: { id },
    data: rest,
    include: { _count: { select: { contatos: true } } },
  });
  return mapRow(row);
}

export async function deleteRegistroInadimplente(id: number): Promise<boolean> {
  const existing = await prisma.crmRegistroInadimplente.findUnique({ where: { id } });
  if (!existing) return false;
  await prisma.crmRegistroInadimplente.delete({ where: { id } });
  return true;
}

export async function countRegistroInadimplentes(): Promise<number> {
  return prisma.crmRegistroInadimplente.count();
}

export async function importRegistroInadimplentesBulk(
  rows: RegistroInadimplenteInput[],
  opts?: { clearExistingImport?: boolean; login?: string | null }
): Promise<{ inserted: number }> {
  if (opts?.clearExistingImport) {
    await prisma.crmRegistroInadimplente.deleteMany({ where: { origemImport: true } });
  }

  const login = opts?.login?.trim() || null;
  let inserted = 0;

  for (const raw of rows) {
    try {
      const n = normalizeInput(raw);
      const row = await prisma.crmRegistroInadimplente.create({
        data: {
          ...n,
          origemImport: true,
          criadoPorLogin: login,
        },
      });
      inserted += 1;
      if (n.obs) {
        const parsed = parseObsInadimplente(n.obs);
        if (parsed.length) {
          await prisma.crmRegistroInadimplenteContato.createMany({
            data: parsed.map((p) => ({
              registroId: row.id,
              dataContato: p.dataContato,
              texto: p.texto,
              origem: 'legado',
              criadoPorLogin: login,
            })),
          });
        }
      }
    } catch {
      // ignora linha inválida
    }
  }

  return { inserted };
}

export async function listContatosRegistro(
  registroId: number
): Promise<ContatoInadimplenteDto[] | null> {
  const existing = await prisma.crmRegistroInadimplente.findUnique({ where: { id: registroId } });
  if (!existing) return null;
  await ensureContatosFromObs(registroId);
  await repararContatosLegadoAgrupados(registroId);
  const rows = await prisma.crmRegistroInadimplenteContato.findMany({
    where: { registroId },
    orderBy: [{ dataContato: 'desc' }, { id: 'desc' }],
  });
  return rows.map(mapContato);
}

export async function createContatoRegistro(
  registroId: number,
  input: ContatoInadimplenteInput,
  login?: string | null
): Promise<ContatoInadimplenteDto | null> {
  const existing = await prisma.crmRegistroInadimplente.findUnique({ where: { id: registroId } });
  if (!existing) return null;
  await ensureContatosFromObs(registroId);

  const data = normalizeContatoInput(input);
  const row = await prisma.crmRegistroInadimplenteContato.create({
    data: {
      registroId,
      dataContato: data.dataContato ?? new Date(),
      texto: data.texto,
      origem: 'manual',
      criadoPorLogin: login?.trim() || null,
    },
  });
  await syncObsDenormalizado(registroId);
  return mapContato(row);
}

export async function updateContatoRegistro(
  registroId: number,
  contatoId: number,
  input: ContatoInadimplenteInput
): Promise<ContatoInadimplenteDto | null> {
  const existing = await prisma.crmRegistroInadimplenteContato.findFirst({
    where: { id: contatoId, registroId },
  });
  if (!existing) return null;
  const data = normalizeContatoInput(input);
  const row = await prisma.crmRegistroInadimplenteContato.update({
    where: { id: contatoId },
    data: {
      dataContato: data.dataContato ?? existing.dataContato,
      texto: data.texto,
    },
  });
  await syncObsDenormalizado(registroId);
  return mapContato(row);
}

export async function deleteContatoRegistro(
  registroId: number,
  contatoId: number
): Promise<boolean> {
  const existing = await prisma.crmRegistroInadimplenteContato.findFirst({
    where: { id: contatoId, registroId },
  });
  if (!existing) return false;
  await prisma.crmRegistroInadimplenteContato.delete({ where: { id: contatoId } });
  await syncObsDenormalizado(registroId);
  return true;
}
