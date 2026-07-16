import { prisma } from '../../config/prisma.js';
import { normalizeRhPermissions } from '../lib/rh-permissions.js';
import { setGrupoPermissions } from '../services/rhPermissionsService.js';
import { s } from '../utils/rhHelpers.js';

function readFaltasPermissionAccess(
  raw: unknown,
  field: 'tiposRegras' | 'regrasAlertas',
): { view: boolean; edit: boolean } | null {
  if (!raw || typeof raw !== 'object') return null;
  const root = raw as Record<string, unknown>;
  const faltas = root.faltas;
  if (!faltas || typeof faltas !== 'object') return null;
  const target = (faltas as Record<string, unknown>)[field];
  if (!target || typeof target !== 'object') return null;
  const src = target as Record<string, unknown>;
  return { view: src.view === true, edit: src.edit === true };
}

function applyExplicitFaltasPermissions(permissions: ReturnType<typeof normalizeRhPermissions>, raw: unknown) {
  const explicitTiposRegras = readFaltasPermissionAccess(raw, 'tiposRegras');
  if (explicitTiposRegras) permissions.faltas.tiposRegras = explicitTiposRegras;
  const explicitRegrasAlertas = readFaltasPermissionAccess(raw, 'regrasAlertas');
  if (explicitRegrasAlertas) permissions.faltas.regrasAlertas = explicitRegrasAlertas;
  return permissions;
}

function mapGrupo(row: {
  id: number;
  nome: string;
  descricao: string | null;
  createdAt: Date;
  updatedAt: Date;
  rhGrupoPermissao: { permissions: string; updatedAt: Date } | null;
}) {
  let permissions = normalizeRhPermissions(null);
  if (row.rhGrupoPermissao?.permissions?.trim()) {
    try {
      permissions = normalizeRhPermissions(JSON.parse(row.rhGrupoPermissao.permissions));
    } catch {
      permissions = normalizeRhPermissions(null);
    }
  }
  return {
    id: String(row.id),
    grupoId: row.id,
    name: row.nome,
    description: row.descricao ?? '',
    permissions,
    createdAt: row.createdAt.toISOString(),
    updatedAt: (row.rhGrupoPermissao?.updatedAt ?? row.updatedAt).toISOString(),
  };
}

export async function listRhUserGroups() {
  const rows = await prisma.grupoUsuario.findMany({
    where: { ativo: true },
    include: { rhGrupoPermissao: true },
    orderBy: { nome: 'asc' },
  });
  return rows.map(mapGrupo);
}

export async function createRhUserGroup(input: {
  name: string;
  description?: string;
  permissions?: unknown;
}) {
  const name = s(input.name);
  if (!name) throw new Error('Nome do grupo é obrigatório.');

  const existing = await prisma.grupoUsuario.findUnique({ where: { nome: name } });
  if (existing) throw new Error('Grupo já existe.');

  const permissions = applyExplicitFaltasPermissions(
    normalizeRhPermissions(input.permissions),
    input.permissions,
  );

  const grupo = await prisma.grupoUsuario.create({
    data: {
      nome: name,
      descricao: s(input.description) || null,
      permissoes: '[]',
    },
  });

  await setGrupoPermissions(grupo.id, permissions);

  const full = await prisma.grupoUsuario.findUnique({
    where: { id: grupo.id },
    include: { rhGrupoPermissao: true },
  });
  return mapGrupo(full!);
}

export async function updateRhUserGroup(input: {
  id: string;
  name?: string;
  description?: string;
  permissions?: unknown;
}) {
  const grupoId = Number(input.id);
  if (!Number.isFinite(grupoId)) throw new Error('id obrigatório.');

  const grupo = await prisma.grupoUsuario.findUnique({ where: { id: grupoId } });
  if (!grupo) throw new Error('Grupo não encontrado.');

  if (typeof input.name === 'string') {
    const name = input.name.trim();
    if (!name) throw new Error('Nome do grupo é obrigatório.');
    const conflict = await prisma.grupoUsuario.findFirst({
      where: { nome: name, NOT: { id: grupoId } },
    });
    if (conflict) throw new Error('Grupo já existe.');
    await prisma.grupoUsuario.update({ where: { id: grupoId }, data: { nome: name } });
  }

  if (typeof input.description === 'string') {
    await prisma.grupoUsuario.update({
      where: { id: grupoId },
      data: { descricao: input.description.trim() || null },
    });
  }

  if (input.permissions !== undefined) {
    const permissions = applyExplicitFaltasPermissions(
      normalizeRhPermissions(input.permissions),
      input.permissions,
    );
    await setGrupoPermissions(grupoId, permissions);
  }

  const full = await prisma.grupoUsuario.findUnique({
    where: { id: grupoId },
    include: { rhGrupoPermissao: true },
  });
  return mapGrupo(full!);
}

export async function deleteRhUserGroup(id: string) {
  const grupoId = Number(id);
  if (!Number.isFinite(grupoId)) throw new Error('id obrigatório.');

  const users = await prisma.usuario.count({ where: { grupoId } });
  if (users > 0) throw new Error('Não é possível excluir grupo com usuários vinculados.');

  await prisma.rhGrupoPermissao.deleteMany({ where: { grupoId } });
  await prisma.grupoUsuario.delete({ where: { id: grupoId } });
}
