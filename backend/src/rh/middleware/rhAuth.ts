import type { Request, Response, NextFunction } from 'express';
import type { JwtPayload } from '../../middleware/auth.js';
import { isSuperLogin, usuarioTemAcessoMaster } from '../../config/grupoMaster.js';
import { prisma } from '../../config/prisma.js';
import {
  canEditRoute,
  canViewRoute,
  granularPermissionFallback,
  hasSectorAccess,
  normalizeRhPermissions,
  type RhGroupPermissions,
} from '../lib/rh-permissions.js';
import { getGrupoPermissions } from '../services/rhPermissionsService.js';

type AccessMode = 'view' | 'edit';

export type RhAuthContext = {
  actor: string;
  isMaster: boolean;
  grupoId: number | null;
  permissions: RhGroupPermissions | null;
};

declare global {
  namespace Express {
    interface Request {
      rhAuth?: RhAuthContext;
    }
  }
}

type RhJwtUser = JwtPayload & {
  grupoId?: number;
  isMaster?: boolean;
};

async function resolveGrupoId(user: RhJwtUser): Promise<number | null> {
  if (user.grupoId != null) return user.grupoId;
  const row = await prisma.usuario.findUnique({
    where: { login: user.login },
    select: { grupoId: true },
  });
  return row?.grupoId ?? null;
}

async function resolveIsMaster(user: RhJwtUser): Promise<boolean> {
  if (user.isMaster === true) return true;
  if (isSuperLogin(user.login)) return true;
  return usuarioTemAcessoMaster(user.login);
}

async function getSessionPermissions(user: RhJwtUser): Promise<RhGroupPermissions | null> {
  if (await resolveIsMaster(user)) return null;

  const grupoId = await resolveGrupoId(user);
  if (!grupoId) {
    return normalizeRhPermissions(null);
  }

  return getGrupoPermissions(grupoId);
}

function canViewAccess(access: { view: boolean; edit: boolean } | null | undefined): boolean {
  return !!access && (access.view || access.edit);
}

function canEditAccess(access: { edit: boolean } | null | undefined): boolean {
  return !!access && access.edit === true;
}

/** Permissões efetivas do grupo (null = master com acesso total). */
export function resolveSessionPermissions(access: {
  isMaster: boolean;
  permissions: RhGroupPermissions | null;
}): RhGroupPermissions {
  return access.permissions ?? normalizeRhPermissions(null);
}

async function buildRhAuthContext(req: Request): Promise<RhAuthContext | null> {
  const user = req.user;
  if (!user?.login) return null;

  const isMaster = await resolveIsMaster(user);
  const grupoId = await resolveGrupoId(user);
  const permissions = isMaster ? null : await getSessionPermissions(user);

  return {
    actor: user.login,
    isMaster,
    grupoId,
    permissions,
  };
}

function attachRhAuth(req: Request, context: RhAuthContext): void {
  req.rhAuth = context;
}

function deny(res: Response, message: string, status = 403): void {
  res.status(status).json({ error: message });
}

async function ensureAuthenticated(req: Request, res: Response): Promise<RhAuthContext | null> {
  if (!req.user?.login) {
    deny(res, 'Não autorizado. Faça login.', 401);
    return null;
  }
  return buildRhAuthContext(req);
}

/** Apenas autentica e anexa req.rhAuth (sem checagem de rota). */
export function requireRhSession() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = await ensureAuthenticated(req, res);
      if (!context) return;
      attachRhAuth(req, context);
      next();
    } catch (err) {
      console.error('[requireRhSession]', (err as Error)?.message ?? err);
      if (!res.headersSent) {
        res.status(503).json({ error: 'Serviço temporariamente indisponível.' });
      }
    }
  };
}

export function requireRhAccess(targetUrl: string, mode: AccessMode = 'edit') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = await ensureAuthenticated(req, res);
      if (!context) return;

      let allowed = context.isMaster;
      if (!allowed && context.permissions) {
        allowed =
          mode === 'edit'
            ? canEditRoute(context.permissions, targetUrl)
            : canViewRoute(context.permissions, targetUrl);
        if (!allowed) {
          allowed = granularPermissionFallback(context.permissions, targetUrl, mode);
        }
      }

      if (!allowed) {
        deny(res, 'Sem permissão para executar esta operação.');
        return;
      }

      attachRhAuth(req, context);
      next();
    } catch (err) {
      console.error('[requireRhAccess]', (err as Error)?.message ?? err);
      if (!res.headersSent) {
        res.status(503).json({ error: 'Serviço temporariamente indisponível.' });
      }
    }
  };
}

/** Gravar ausências (lançar/editar/excluir): alinhado ao front `canEditFaltasAusencias`. */
export function requireRhAusenciasWrite() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = await ensureAuthenticated(req, res);
      if (!context) return;

      if (context.isMaster) {
        attachRhAuth(req, context);
        next();
        return;
      }

      const permissions = context.permissions;
      if (!permissions) {
        deny(res, 'Sem permissão para gravar ausências.');
        return;
      }

      const a = permissions.faltas.ausencias;
      if (!(a.create || a.edit || a.delete)) {
        deny(res, 'Sem permissão para gravar ausências.');
        return;
      }

      attachRhAuth(req, context);
      next();
    } catch (err) {
      console.error('[requireRhAusenciasWrite]', (err as Error)?.message ?? err);
      if (!res.headersSent) {
        res.status(503).json({ error: 'Serviço temporariamente indisponível.' });
      }
    }
  };
}

/** Gravar sanções: alinhado ao front `canEditFaltasSancoes`. */
export function requireRhSancoesWrite() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = await ensureAuthenticated(req, res);
      if (!context) return;

      if (context.isMaster) {
        attachRhAuth(req, context);
        next();
        return;
      }

      const permissions = context.permissions;
      if (!permissions) {
        deny(res, 'Sem permissão para gravar sanções disciplinares.');
        return;
      }

      const s = permissions.faltas.sancoes;
      if (!(s.create || s.edit || s.delete)) {
        deny(res, 'Sem permissão para gravar sanções disciplinares.');
        return;
      }

      attachRhAuth(req, context);
      next();
    } catch (err) {
      console.error('[requireRhSancoesWrite]', (err as Error)?.message ?? err);
      if (!res.headersSent) {
        res.status(503).json({ error: 'Serviço temporariamente indisponível.' });
      }
    }
  };
}

export function requireRhFeaturePermission<
  T extends 'comentarios' | 'fotos' | 'documentos' | 'ausencias' | 'sancoes' | 'cadastros',
>(
  feature: T,
  action: T extends 'cadastros' ? AccessMode : 'view' | 'create' | 'edit' | 'delete' | 'download',
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = await ensureAuthenticated(req, res);
      if (!context) return;

      if (context.isMaster) {
        attachRhAuth(req, context);
        next();
        return;
      }

      const permissions = context.permissions;
      if (!permissions) {
        deny(res, 'Sem permissão para executar esta operação.');
        return;
      }

      let allowed = false;
      switch (feature) {
        case 'comentarios':
          allowed =
            action === 'view'
              ? canViewAccess(permissions.organico.comentarios)
              : canEditAccess(permissions.organico.comentarios);
          break;
        case 'fotos':
          allowed =
            action === 'view' ? canViewAccess(permissions.organico.fotos) : canEditAccess(permissions.organico.fotos);
          break;
        case 'documentos':
          if (action === 'download') {
            allowed = permissions.organico.documentos.download || permissions.organico.documentos.view;
          } else {
            allowed = permissions.organico.documentos[action as 'view' | 'create' | 'edit' | 'delete'] === true;
          }
          break;
        case 'ausencias':
          allowed = permissions.faltas.ausencias[action as 'view' | 'create' | 'edit' | 'delete'] === true;
          break;
        case 'sancoes':
          allowed = permissions.faltas.sancoes[action as 'view' | 'create' | 'edit' | 'delete'] === true;
          break;
        case 'cadastros':
          allowed = permissions.faltas.cadastros[action as AccessMode] === true;
          break;
      }

      if (!allowed) {
        deny(res, 'Sem permissão para executar esta operação.');
        return;
      }

      attachRhAuth(req, context);
      next();
    } catch (err) {
      console.error('[requireRhFeaturePermission]', (err as Error)?.message ?? err);
      if (!res.headersSent) {
        res.status(503).json({ error: 'Serviço temporariamente indisponível.' });
      }
    }
  };
}

export function requireRhConfigAccess(mode: AccessMode = 'edit') {
  return requireRhAccess('/configuracoes', mode);
}

export function requireRhMaster() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = await ensureAuthenticated(req, res);
      if (!context) return;

      if (!context.isMaster) {
        deny(res, 'Apenas o usuário master pode executar esta operação.');
        return;
      }

      attachRhAuth(req, context);
      next();
    } catch (err) {
      console.error('[requireRhMaster]', (err as Error)?.message ?? err);
      if (!res.headersSent) {
        res.status(503).json({ error: 'Serviço temporariamente indisponível.' });
      }
    }
  };
}

/** Visualizar regras de alertas e inconsistências. */
export function requireRhRegrasAlertasView() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = await ensureAuthenticated(req, res);
      if (!context) return;

      if (context.isMaster) {
        attachRhAuth(req, context);
        next();
        return;
      }

      const permissions = context.permissions;
      if (!permissions) {
        deny(res, 'Sem permissão para visualizar regras de alertas.');
        return;
      }

      const p = permissions.faltas.regrasAlertas;
      if (!(p.view || p.edit)) {
        deny(res, 'Sem permissão para visualizar regras de alertas.');
        return;
      }

      attachRhAuth(req, context);
      next();
    } catch (err) {
      console.error('[requireRhRegrasAlertasView]', (err as Error)?.message ?? err);
      if (!res.headersSent) {
        res.status(503).json({ error: 'Serviço temporariamente indisponível.' });
      }
    }
  };
}

/** Ativar/desativar regras e resolver inconsistências. */
export function requireRhRegrasAlertasEdit() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = await ensureAuthenticated(req, res);
      if (!context) return;

      if (context.isMaster) {
        attachRhAuth(req, context);
        next();
        return;
      }

      const permissions = context.permissions;
      if (!permissions?.faltas.regrasAlertas.edit) {
        deny(res, 'Sem permissão para gerenciar regras de alertas.');
        return;
      }

      attachRhAuth(req, context);
      next();
    } catch (err) {
      console.error('[requireRhRegrasAlertasEdit]', (err as Error)?.message ?? err);
      if (!res.headersSent) {
        res.status(503).json({ error: 'Serviço temporariamente indisponível.' });
      }
    }
  };
}

export function requireRhSectorAccess(
  resolveSetor: (req: Request) => string | null | undefined,
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = await ensureAuthenticated(req, res);
      if (!context) return;

      if (context.isMaster) {
        attachRhAuth(req, context);
        next();
        return;
      }

      const permissions = context.permissions;
      if (!permissions) {
        deny(res, 'Sem acesso ao setor informado.');
        return;
      }

      const setor = resolveSetor(req);
      if (!hasSectorAccess(permissions, setor)) {
        deny(res, 'Sem acesso ao setor informado.');
        return;
      }

      attachRhAuth(req, context);
      next();
    } catch (err) {
      console.error('[requireRhSectorAccess]', (err as Error)?.message ?? err);
      if (!res.headersSent) {
        res.status(503).json({ error: 'Serviço temporariamente indisponível.' });
      }
    }
  };
}
