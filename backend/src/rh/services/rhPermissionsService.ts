import { prisma } from '../../config/prisma.js';
import { normalizeRhPermissions, type RhGroupPermissions } from '../lib/rh-permissions.js';

export async function getGrupoPermissions(grupoId: number): Promise<RhGroupPermissions> {
  const row = await prisma.rhGrupoPermissao.findUnique({
    where: { grupoId },
    select: { permissions: true },
  });

  if (!row?.permissions?.trim()) {
    return normalizeRhPermissions(null);
  }

  try {
    return normalizeRhPermissions(JSON.parse(row.permissions));
  } catch {
    return normalizeRhPermissions(null);
  }
}

export async function setGrupoPermissions(grupoId: number, perms: RhGroupPermissions): Promise<void> {
  const normalized = normalizeRhPermissions(perms);
  const permissions = JSON.stringify(normalized);

  await prisma.rhGrupoPermissao.upsert({
    where: { grupoId },
    create: { grupoId, permissions },
    update: { permissions },
  });
}
