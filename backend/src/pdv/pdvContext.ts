import type { Request } from 'express';
import { prisma } from '../config/prisma.js';
import { getPermissoesUsuario } from '../middleware/requirePermission.js';
import { PERMISSOES } from '../config/permissoes.js';

export type PdvContexto = {
  usuarioId: number;
  login: string;
  nome: string;
  idEmpresa: number | null;
  podeConfigurar: boolean;
};

export async function contextoPdv(req: Request): Promise<PdvContexto> {
  const login = req.user?.login;
  if (!login) throw Object.assign(new Error('Não autorizado.'), { status: 401 });
  const usuario = await prisma.usuario.findUnique({
    where: { login },
    select: { id: true, nome: true, login: true, pdvEmpresa: { select: { idEmpresa: true } } },
  });
  if (!usuario) throw Object.assign(new Error('Usuário não encontrado.'), { status: 401 });
  const perms = await getPermissoesUsuario(login);
  return {
    usuarioId: usuario.id,
    login: usuario.login,
    nome: usuario.nome?.trim() || usuario.login,
    idEmpresa: usuario.pdvEmpresa?.idEmpresa ?? null,
    podeConfigurar: perms.includes(PERMISSOES.PDV_CONFIGURAR),
  };
}

export function exigirEmpresa(ctx: PdvContexto): number {
  if (!ctx.idEmpresa) {
    throw Object.assign(
      new Error('Seu usuário não está vinculado a uma empresa. Peça a configuração do PDV.'),
      { status: 409 },
    );
  }
  return ctx.idEmpresa;
}
