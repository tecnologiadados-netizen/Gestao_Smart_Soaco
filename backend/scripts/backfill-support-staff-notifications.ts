/**
 * Replica notificações de suporte gravadas só em logins legados (ex.: `master`) para toda a equipe elegível.
 * Uso: npx tsx scripts/backfill-support-staff-notifications.ts
 */
import { PrismaClient } from '@prisma/client';
import { PERMISSOES } from '../src/config/permissoes.js';
import { listLoginsNotificacaoSuporteStaff } from '../src/config/grupoMaster.js';
import { getPermissoesUsuario } from '../src/middleware/requirePermission.js';

const prisma = new PrismaClient();

async function canVerTodos(login: string): Promise<boolean> {
  const staff = await listLoginsNotificacaoSuporteStaff();
  if (staff.includes(login)) return true;
  const perms = await getPermissoesUsuario(login);
  return perms.includes(PERMISSOES.SUPORTE_CHAMADOS_VER_TODOS);
}

async function listStaffRecipients(): Promise<string[]> {
  const recipients = new Set(await listLoginsNotificacaoSuporteStaff());
  const users = await prisma.usuario.findMany({ where: { ativo: true }, select: { login: true } });
  for (const u of users) {
    const l = String(u.login ?? '').trim();
    if (l && (await canVerTodos(l))) recipients.add(l);
  }
  return [...recipients];
}

async function listLegacyStaffLogins(): Promise<string[]> {
  const grouped = await prisma.supportTicketNotification.groupBy({
    by: ['userLogin'],
    _count: { _all: true },
  });
  const staff = await listStaffRecipients();
  const legacy: string[] = [];
  for (const row of grouped) {
    const login = String(row.userLogin ?? '').trim();
    if (!login || staff.includes(login)) continue;
    legacy.push(login);
  }
  if (legacy.length === 0) legacy.push('master');
  return [...new Set(legacy)];
}

async function main() {
  const staff = await listStaffRecipients();
  const legacyLogins = await listLegacyStaffLogins();
  let created = 0;
  for (const legacyLogin of legacyLogins) {
    const legacyNotifs = await prisma.supportTicketNotification.findMany({ where: { userLogin: legacyLogin } });
    for (const n of legacyNotifs) {
      for (const userLogin of staff) {
        if (userLogin === legacyLogin) continue;
        const exists = await prisma.supportTicketNotification.findFirst({
          where: { userLogin, ticketId: n.ticketId, message: n.message },
        });
        if (!exists) {
          await prisma.supportTicketNotification.create({
            data: { userLogin, message: n.message, ticketId: n.ticketId, isRead: n.isRead },
          });
          created++;
        }
      }
    }
  }
  console.log('Equipe:', staff.join(', '));
  console.log('Origem (legado):', legacyLogins.join(', '));
  console.log('Notificações replicadas:', created);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
