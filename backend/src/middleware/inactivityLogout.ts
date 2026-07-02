import type { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';

const ACTIVITY_DB_INTERVAL_MS = 30_000;

type ActivityEntry = {
  userId: number;
  ultimaAtividadeMs: number;
  logoutMinutos: number | null;
  lastDbWriteMs: number;
};

const activityCache = new Map<string, ActivityEntry>();

export function seedUserActivity(
  login: string,
  userId: number,
  logoutMinutos: number | null,
  atMs = Date.now()
): void {
  activityCache.set(login, {
    userId,
    ultimaAtividadeMs: atMs,
    logoutMinutos,
    lastDbWriteMs: atMs,
  });
}

export function clearUserActivityCache(login: string | undefined): void {
  if (!login) return;
  activityCache.delete(login);
}

async function persistActivityIfNeeded(userId: number, login: string, entry: ActivityEntry, nowMs: number): Promise<void> {
  if (nowMs - entry.lastDbWriteMs < ACTIVITY_DB_INTERVAL_MS) return;
  entry.lastDbWriteMs = nowMs;
  await prisma.usuario.update({
    where: { id: userId },
    data: { ultimaAtividadeEm: new Date(nowMs) },
  });
}

async function loadActivityEntry(login: string, fallbackActivityMs: number): Promise<ActivityEntry | null> {
  const cached = activityCache.get(login);
  if (cached) return cached;

  const usuario = await prisma.usuario.findUnique({
    where: { login },
    select: {
      id: true,
      ultimaAtividadeEm: true,
      grupo: { select: { logoutInatividadeMinutos: true } },
    },
  });
  if (!usuario) return null;

  const entry: ActivityEntry = {
    userId: usuario.id,
    ultimaAtividadeMs: usuario.ultimaAtividadeEm?.getTime() ?? fallbackActivityMs,
    logoutMinutos: usuario.grupo?.logoutInatividadeMinutos ?? null,
    lastDbWriteMs: 0,
  };
  activityCache.set(login, entry);
  return entry;
}

/**
 * Bloqueia requisições autenticadas quando o tempo de inatividade do grupo foi excedido.
 * Retorna true se a resposta 401 já foi enviada.
 */
export async function enforceInactivityLogout(req: Request, res: Response): Promise<boolean> {
  const login = req.user?.login;
  if (!login) return false;

  const fallbackActivityMs = req.user?.iat ? req.user.iat * 1000 : Date.now();

  let entry: ActivityEntry | null;
  try {
    entry = await loadActivityEntry(login, fallbackActivityMs);
  } catch (err) {
    console.error('[auth] Falha ao verificar inatividade:', (err as Error)?.message ?? err);
    return false;
  }
  if (!entry) return false;

  const nowMs = Date.now();
  const minutos = entry.logoutMinutos;

  if (minutos != null && minutos >= 1) {
    const limiteMs = minutos * 60 * 1000;
    if (nowMs - entry.ultimaAtividadeMs > limiteMs) {
      clearUserActivityCache(login);
      res.clearCookie('token', { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 0 });
      res.status(401).json({ error: 'Sessão encerrada por inatividade. Faça login novamente.' });
      return true;
    }

    // Atualiza última atividade com throttle (evita write a cada request e polling em background).
    if (nowMs - entry.ultimaAtividadeMs >= ACTIVITY_DB_INTERVAL_MS) {
      entry.ultimaAtividadeMs = nowMs;
      activityCache.set(login, entry);
      if (entry.userId > 0) {
        try {
          await persistActivityIfNeeded(entry.userId, login, entry, nowMs);
        } catch (err) {
          console.error('[auth] Falha ao atualizar última atividade:', (err as Error)?.message ?? err);
        }
      }
    }
  }

  return false;
}
