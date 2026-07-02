import { prisma } from './prisma.js';
import { PERMISSOES, TODAS_PERMISSOES, type CodigoPermissao } from './permissoes.js';

/** Nome fixo do grupo com acesso total ao sistema (equivalente ao usuário master legado). */
export const GRUPO_MASTER_NOME = 'Master';

const SUPER_LOGINS = new Set(['master', 'marquesfilho']);

export function isSuperLogin(login: string | null | undefined): boolean {
  return SUPER_LOGINS.has(String(login ?? '').trim().toLowerCase());
}

export function isGrupoMasterNome(nome: string | null | undefined): boolean {
  return String(nome ?? '').trim() === GRUPO_MASTER_NOME;
}

export function serializePermissoesMaster(): string {
  return JSON.stringify([...TODAS_PERMISSOES]);
}

/**
 * Indica se o usuário tem privilégios de master (login legado ou grupo Master).
 */
export async function usuarioTemAcessoMaster(login: string): Promise<boolean> {
  if (isSuperLogin(login)) return true;
  const usuario = await prisma.usuario.findUnique({
    where: { login },
    select: { ativo: true, grupo: { select: { nome: true, ativo: true } } },
  });
  if (!usuario || usuario.ativo === false) return false;
  if (!usuario.grupo || usuario.grupo.ativo === false) return false;
  return isGrupoMasterNome(usuario.grupo.nome);
}

export async function getGrupoMasterId(): Promise<number | null> {
  const g = await prisma.grupoUsuario.findUnique({
    where: { nome: GRUPO_MASTER_NOME },
    select: { id: true },
  });
  return g?.id ?? null;
}

export function podeGerenciarAtribuicaoGrupoMaster(perms: CodigoPermissao[]): boolean {
  return perms.some((p) =>
    [
      PERMISSOES.USUARIOS_GRUPO_MASTER_ATRIBUIR,
      PERMISSOES.USUARIOS_TOTAL,
      PERMISSOES.USUARIOS_GERENCIAR,
    ].includes(p)
  );
}

export function podeGerenciarRemocaoGrupoMaster(perms: CodigoPermissao[]): boolean {
  return perms.some((p) =>
    [
      PERMISSOES.USUARIOS_GRUPO_MASTER_REMOVER,
      PERMISSOES.USUARIOS_TOTAL,
      PERMISSOES.USUARIOS_GERENCIAR,
    ].includes(p)
  );
}

export function podeEditarGrupoMaster(perms: CodigoPermissao[]): boolean {
  return perms.some((p) =>
    [PERMISSOES.GRUPOS_MASTER_EDITAR, PERMISSOES.GRUPOS_TOTAL, PERMISSOES.USUARIOS_GERENCIAR, PERMISSOES.USUARIOS_TOTAL].includes(
      p
    )
  );
}

/**
 * Logins que recebem notificações de suporte como equipe (grupo Master + logins legados com acesso master).
 * Não usa login fixo `master` — cada usuário elegível recebe sua própria notificação.
 */
export async function listLoginsNotificacaoSuporteStaff(excludeLogin?: string): Promise<string[]> {
  const usuarios = await prisma.usuario.findMany({
    where: { ativo: true },
    select: { login: true },
    orderBy: { login: 'asc' },
  });
  const recipients: string[] = [];
  for (const u of usuarios) {
    const l = String(u.login ?? '').trim();
    if (!l || (excludeLogin && l === excludeLogin)) continue;
    if (await usuarioTemAcessoMaster(l)) recipients.push(l);
  }
  if (recipients.length === 0) {
    const grupoId = await getGrupoMasterId();
    if (grupoId) {
      const members = await prisma.usuario.findMany({
        where: { ativo: true, grupoId },
        select: { login: true },
      });
      for (const m of members) {
        const l = String(m.login ?? '').trim();
        if (l && (!excludeLogin || l !== excludeLogin)) recipients.push(l);
      }
    }
  }
  return [...new Set(recipients)];
}
