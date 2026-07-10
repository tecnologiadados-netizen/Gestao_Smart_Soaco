/**
 * Configuração de tipos e destinatários de notificação por e-mail (Integração → E-mail).
 */

import { prisma } from '../config/prisma.js';
import { validarCronExpressaoAgendamento } from '../utils/smsCronHorarios.js';

export type EmailNotificacaoTipoRow = {
  id: number;
  code: string;
  label: string;
  descricao: string | null;
  ativo: boolean;
  sortOrder: number;
  fonteMensagem: string;
  modoDisparo: string;
  cronExpressao: string | null;
  builderCode: string | null;
  destinatarioIds: number[];
};

export type EmailNotificacaoTipoSaveItem = {
  id?: number;
  code: string;
  label: string;
  descricao?: string | null;
  ativo: boolean;
  sortOrder: number;
  fonteMensagem: string;
  modoDisparo: string;
  cronExpressao?: string | null;
  builderCode?: string | null;
};

export type UsuarioDestinatarioEmailRow = {
  id: number;
  login: string;
  nome: string | null;
  email: string | null;
  ativo: boolean;
};

const CODE_RE = /^[a-z0-9_]+$/;

export function validarCodeEmail(code: string): string | null {
  const c = code.trim().toLowerCase();
  if (!c) return 'Código é obrigatório.';
  if (!CODE_RE.test(c)) return 'Código deve conter apenas letras minúsculas, números e underscore.';
  return null;
}

function mapTipo(
  t: {
    id: number;
    code: string;
    label: string;
    descricao: string | null;
    ativo: boolean;
    sortOrder: number;
    fonteMensagem: string;
    modoDisparo: string;
    cronExpressao: string | null;
    builderCode: string | null;
    destinatarios: { usuarioId: number }[];
  }
): EmailNotificacaoTipoRow {
  return {
    id: t.id,
    code: t.code,
    label: t.label,
    descricao: t.descricao,
    ativo: t.ativo,
    sortOrder: t.sortOrder,
    fonteMensagem: t.fonteMensagem,
    modoDisparo: t.modoDisparo,
    cronExpressao: t.cronExpressao,
    builderCode: t.builderCode,
    destinatarioIds: t.destinatarios.map((d) => d.usuarioId),
  };
}

export async function listarTiposEmailComDestinatarios(): Promise<EmailNotificacaoTipoRow[]> {
  const rows = await prisma.emailNotificacaoTipo.findMany({
    include: { destinatarios: { select: { usuarioId: true } } },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });
  return rows.map(mapTipo);
}

export async function buscarTipoEmailPorCode(code: string) {
  return prisma.emailNotificacaoTipo.findUnique({
    where: { code },
    include: {
      destinatarios: {
        include: {
          usuario: {
            select: { id: true, login: true, nome: true, email: true, ativo: true },
          },
        },
      },
    },
  });
}

export async function buscarTipoEmailPorId(id: number) {
  return prisma.emailNotificacaoTipo.findUnique({
    where: { id },
    include: {
      destinatarios: {
        include: {
          usuario: {
            select: { id: true, login: true, nome: true, email: true, ativo: true },
          },
        },
      },
    },
  });
}

export async function listarTiposEmailCronAtivos() {
  return prisma.emailNotificacaoTipo.findMany({
    where: { ativo: true, modoDisparo: 'cron' },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });
}

export async function salvarCatalogoTiposEmail(
  items: EmailNotificacaoTipoSaveItem[]
): Promise<EmailNotificacaoTipoRow[]> {
  for (const item of items) {
    const errCode = validarCodeEmail(item.code);
    if (errCode) throw new Error(errCode);
    if (!item.label.trim()) throw new Error('Nome é obrigatório.');
    if (item.fonteMensagem === 'codigo' && !item.builderCode?.trim()) {
      throw new Error(`Builder é obrigatório para "${item.label}".`);
    }
    if (item.modoDisparo === 'cron') {
      const errCron = validarCronExpressaoAgendamento(item.cronExpressao);
      if (errCron) throw new Error(`${errCron} (${item.label})`);
    }
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.emailNotificacaoTipo.findMany({ select: { id: true, code: true } });
    const incomingIds = new Set(items.filter((i) => i.id && i.id > 0).map((i) => i.id!));
    const toDelete = existing.filter((e) => !incomingIds.has(e.id));
    for (const del of toDelete) {
      await tx.emailNotificacaoTipo.delete({ where: { id: del.id } });
    }

    for (const item of items) {
      const code = item.code.trim().toLowerCase();
      const data = {
        code,
        label: item.label.trim(),
        descricao: item.descricao?.trim() || null,
        ativo: item.ativo,
        sortOrder: item.sortOrder,
        fonteMensagem: item.fonteMensagem,
        modoDisparo: item.modoDisparo,
        cronExpressao: item.modoDisparo === 'cron' ? item.cronExpressao?.trim() || null : null,
        builderCode: item.fonteMensagem === 'codigo' ? item.builderCode?.trim() || null : null,
      };

      if (item.id && item.id > 0) {
        const found = existing.find((e) => e.id === item.id);
        if (found && found.code !== code) {
          const dup = await tx.emailNotificacaoTipo.findUnique({ where: { code } });
          if (dup && dup.id !== item.id) throw new Error(`Código "${code}" já existe.`);
        }
        await tx.emailNotificacaoTipo.update({ where: { id: item.id }, data });
      } else {
        const dup = await tx.emailNotificacaoTipo.findUnique({ where: { code } });
        if (dup) throw new Error(`Código "${code}" já existe.`);
        await tx.emailNotificacaoTipo.create({ data });
      }
    }
  });

  return listarTiposEmailComDestinatarios();
}

export async function salvarDestinatariosEmail(
  tipoId: number,
  usuarioIds: number[]
): Promise<EmailNotificacaoTipoRow[]> {
  const tipo = await prisma.emailNotificacaoTipo.findUnique({ where: { id: tipoId } });
  if (!tipo) throw new Error('Tipo não encontrado.');

  const uniqueIds = [...new Set(usuarioIds.filter((id) => id > 0))];
  if (uniqueIds.length > 0) {
    const count = await prisma.usuario.count({ where: { id: { in: uniqueIds }, ativo: true } });
    if (count !== uniqueIds.length) throw new Error('Um ou mais usuários são inválidos ou inativos.');
  }

  await prisma.$transaction([
    prisma.emailNotificacaoDestinatario.deleteMany({ where: { tipoId } }),
    ...(uniqueIds.length > 0
      ? [
          prisma.emailNotificacaoDestinatario.createMany({
            data: uniqueIds.map((usuarioId) => ({ tipoId, usuarioId })),
          }),
        ]
      : []),
  ]);

  return listarTiposEmailComDestinatarios();
}

export async function listarUsuariosParaDestinatarioEmail(): Promise<UsuarioDestinatarioEmailRow[]> {
  const rows = await prisma.usuario.findMany({
    where: { ativo: true },
    select: { id: true, login: true, nome: true, email: true, ativo: true },
    orderBy: { login: 'asc' },
  });
  return rows.map((u) => ({
    id: u.id,
    login: u.login,
    nome: u.nome,
    email: u.email ?? null,
    ativo: u.ativo,
  }));
}
