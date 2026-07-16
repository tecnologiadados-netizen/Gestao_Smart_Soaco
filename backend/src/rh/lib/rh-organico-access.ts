import { prisma } from '../../config/prisma.js';
import { hasSectorAccess, type RhGroupPermissions } from './rh-permissions.js';

type OrganicoSectorRow = {
  matricula: string;
  nome: string;
  setor: string;
  valuesJson: string | null;
};

function parseValuesJson(raw: string | null | undefined): unknown[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setorFromRow(row: Pick<OrganicoSectorRow, 'setor' | 'valuesJson'>): string | null {
  const direct = String(row.setor ?? '').trim();
  if (direct) return direct;
  const values = parseValuesJson(row.valuesJson);
  return String(values[14] ?? '').trim() || null;
}

export async function resolveOrganicoSector(
  input: { matricula?: string | null; nome?: string | null },
): Promise<string | null> {
  const matricula = String(input.matricula ?? '').trim();
  const nome = String(input.nome ?? '').trim();
  if (!matricula && !nome) return null;

  const row = await prisma.rhOrganico.findFirst({
    where: matricula ? { matricula } : { nome },
    select: { setor: true, valuesJson: true },
  });
  if (!row) return null;
  return setorFromRow(row);
}

export async function assertOrganicoSectorAllowed(
  isMaster: boolean,
  permissions: RhGroupPermissions,
  input: { matricula?: string | null; nome?: string | null },
): Promise<boolean> {
  if (isMaster) return true;
  const setor = await resolveOrganicoSector(input);
  return hasSectorAccess(permissions, setor);
}

export async function buildAllowedOrganicoKeys(
  isMaster: boolean,
  permissions: RhGroupPermissions,
): Promise<null | { matriculas: Set<string>; nomes: Set<string> }> {
  if (isMaster || permissions.organico.allowedSectors.length === 0) {
    return null;
  }

  const rows = await prisma.rhOrganico.findMany({
    select: { matricula: true, nome: true, setor: true, valuesJson: true },
  });

  const matriculas = new Set<string>();
  const nomes = new Set<string>();
  for (const row of rows) {
    const setor = setorFromRow(row) ?? '';
    if (!hasSectorAccess(permissions, setor)) continue;
    const values = parseValuesJson(row.valuesJson);
    const matricula = String(row.matricula ?? values[0] ?? '').trim();
    const nome = String(row.nome ?? values[1] ?? '').trim();
    if (matricula) matriculas.add(matricula);
    if (nome) nomes.add(nome);
  }
  return { matriculas, nomes };
}
