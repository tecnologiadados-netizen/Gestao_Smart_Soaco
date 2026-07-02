/**
 * Configuração de tipos e destinatários de notificação WhatsApp (Integração → SMS).
 */

import { prisma } from '../config/prisma.js';
import { validarCronExpressaoAgendamento } from '../utils/smsCronHorarios.js';

export type WhatsappNotificacaoTipoRow = {
  id: number;
  code: string;
  label: string;
  descricao: string | null;
  ativo: boolean;
  sortOrder: number;
  fonteMensagem: string;
  modoDisparo: string;
  cronExpressao: string | null;
  sqlNomus: string | null;
  templateMensagem: string | null;
  builderCode: string | null;
  destinatarioIds: number[];
};

export type WhatsappNotificacaoTipoSaveItem = {
  id?: number;
  code: string;
  label: string;
  descricao?: string | null;
  ativo: boolean;
  sortOrder: number;
  fonteMensagem: string;
  modoDisparo: string;
  cronExpressao?: string | null;
  sqlNomus?: string | null;
  templateMensagem?: string | null;
  builderCode?: string | null;
};

export type UsuarioDestinatarioRow = {
  id: number;
  login: string;
  nome: string | null;
  telefone: string | null;
  ativo: boolean;
};

const CODE_RE = /^[a-z0-9_]+$/;

export function validarCode(code: string): string | null {
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
    sqlNomus: string | null;
    templateMensagem: string | null;
    builderCode: string | null;
    destinatarios: { usuarioId: number }[];
  }
): WhatsappNotificacaoTipoRow {
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
    sqlNomus: t.sqlNomus,
    templateMensagem: t.templateMensagem,
    builderCode: t.builderCode,
    destinatarioIds: t.destinatarios.map((d) => d.usuarioId),
  };
}

export async function listarTiposComDestinatarios(): Promise<WhatsappNotificacaoTipoRow[]> {
  const rows = await prisma.whatsappNotificacaoTipo.findMany({
    include: { destinatarios: { select: { usuarioId: true } } },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });
  return rows.map(mapTipo);
}

export async function buscarTipoPorCode(code: string) {
  return prisma.whatsappNotificacaoTipo.findUnique({
    where: { code },
    include: {
      destinatarios: {
        include: {
          usuario: { select: { id: true, login: true, nome: true, telefone: true, ativo: true } },
        },
      },
    },
  });
}

export async function buscarTipoPorId(id: number) {
  return prisma.whatsappNotificacaoTipo.findUnique({
    where: { id },
    include: {
      destinatarios: {
        include: {
          usuario: { select: { id: true, login: true, nome: true, telefone: true, ativo: true } },
        },
      },
    },
  });
}

export async function listarTiposCronAtivos() {
  return prisma.whatsappNotificacaoTipo.findMany({
    where: { ativo: true, modoDisparo: 'cron' },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });
}

export async function salvarCatalogoTipos(items: WhatsappNotificacaoTipoSaveItem[]): Promise<WhatsappNotificacaoTipoRow[]> {
  for (const item of items) {
    const errCode = validarCode(item.code);
    if (errCode) throw new Error(errCode);
    if (!item.label.trim()) throw new Error('Nome é obrigatório.');
    if (item.fonteMensagem === 'sql_template') {
      if (!item.sqlNomus?.trim()) throw new Error(`SQL Nomus é obrigatório para "${item.label}".`);
      if (!item.templateMensagem?.trim()) throw new Error(`Template é obrigatório para "${item.label}".`);
    }
    if (item.modoDisparo === 'cron') {
      const errCron = validarCronExpressaoAgendamento(item.cronExpressao);
      if (errCron) throw new Error(`${errCron} (${item.label})`);
    }
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.whatsappNotificacaoTipo.findMany({ select: { id: true, code: true } });
    const incomingIds = new Set(items.filter((i) => i.id && i.id > 0).map((i) => i.id!));
    const toDelete = existing.filter((e) => !incomingIds.has(e.id));
    for (const del of toDelete) {
      await tx.whatsappNotificacaoTipo.delete({ where: { id: del.id } });
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
        sqlNomus: item.fonteMensagem === 'sql_template' ? item.sqlNomus?.trim() || null : null,
        templateMensagem: item.fonteMensagem === 'sql_template' ? item.templateMensagem?.trim() || null : null,
        builderCode: item.fonteMensagem === 'codigo' ? item.builderCode?.trim() || null : null,
      };

      if (item.id && item.id > 0) {
        const found = existing.find((e) => e.id === item.id);
        if (found && found.code !== code) {
          const dup = await tx.whatsappNotificacaoTipo.findUnique({ where: { code } });
          if (dup && dup.id !== item.id) throw new Error(`Código "${code}" já existe.`);
        }
        await tx.whatsappNotificacaoTipo.update({ where: { id: item.id }, data });
      } else {
        const dup = await tx.whatsappNotificacaoTipo.findUnique({ where: { code } });
        if (dup) throw new Error(`Código "${code}" já existe.`);
        await tx.whatsappNotificacaoTipo.create({ data });
      }
    }
  });

  return listarTiposComDestinatarios();
}

export async function salvarDestinatarios(tipoId: number, usuarioIds: number[]): Promise<WhatsappNotificacaoTipoRow[]> {
  const tipo = await prisma.whatsappNotificacaoTipo.findUnique({ where: { id: tipoId } });
  if (!tipo) throw new Error('Tipo não encontrado.');

  const uniqueIds = [...new Set(usuarioIds.filter((id) => id > 0))];
  if (uniqueIds.length > 0) {
    const count = await prisma.usuario.count({ where: { id: { in: uniqueIds }, ativo: true } });
    if (count !== uniqueIds.length) throw new Error('Um ou mais usuários são inválidos ou inativos.');
  }

  await prisma.$transaction([
    prisma.whatsappNotificacaoDestinatario.deleteMany({ where: { tipoId } }),
    ...(uniqueIds.length > 0
      ? [
          prisma.whatsappNotificacaoDestinatario.createMany({
            data: uniqueIds.map((usuarioId) => ({ tipoId, usuarioId })),
          }),
        ]
      : []),
  ]);

  return listarTiposComDestinatarios();
}

export async function listarUsuariosParaDestinatario(): Promise<UsuarioDestinatarioRow[]> {
  const rows = await prisma.usuario.findMany({
    where: { ativo: true },
    select: { id: true, login: true, nome: true, telefone: true, ativo: true },
    orderBy: { login: 'asc' },
  });
  return rows.map((u) => ({
    id: u.id,
    login: u.login,
    nome: u.nome,
    telefone: u.telefone ?? null,
    ativo: u.ativo,
  }));
}
