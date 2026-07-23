import { prisma } from '../config/prisma.js';
import { criarMatcherTextoLivre } from '../utils/textoLivreBusca.js';

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

export async function listRegistroInadimplentes(opts?: {
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ data: RegistroInadimplenteDto[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, Number(opts?.page) || 1);
  const pageSize = Math.min(200, Math.max(10, Number(opts?.pageSize) || 50));
  const q = (opts?.q ?? '').trim();

  const orderBy = [{ vencimento: 'desc' as const }, { id: 'desc' as const }];

  if (!q) {
    const [total, rows] = await Promise.all([
      prisma.crmRegistroInadimplente.count(),
      prisma.crmRegistroInadimplente.findMany({
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
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
  const all = await prisma.crmRegistroInadimplente.findMany({ orderBy });
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
      match(r.serasa ?? '')
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
  const row = await prisma.crmRegistroInadimplente.create({
    data: {
      ...data,
      origemImport: false,
      criadoPorLogin: login?.trim() || null,
    },
  });
  return mapRow(row);
}

export async function updateRegistroInadimplente(
  id: number,
  input: RegistroInadimplenteInput
): Promise<RegistroInadimplenteDto | null> {
  const existing = await prisma.crmRegistroInadimplente.findUnique({ where: { id } });
  if (!existing) return null;
  const data = normalizeInput(input);
  const row = await prisma.crmRegistroInadimplente.update({
    where: { id },
    data,
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
  const chunkSize = 200;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const data = chunk
      .map((raw) => {
        try {
          const n = normalizeInput(raw);
          return {
            ...n,
            origemImport: true,
            criadoPorLogin: login,
          };
        } catch {
          return null;
        }
      })
      .filter((r): r is NonNullable<typeof r> => r != null);

    if (!data.length) continue;
    const result = await prisma.crmRegistroInadimplente.createMany({ data });
    inserted += result.count;
  }

  return { inserted };
}
