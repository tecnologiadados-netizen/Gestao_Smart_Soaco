/**
 * Solicitações de compra saiu de "Ver Compras" e passou a ter permissão própria.
 * Uma vez só, quem já abria Compras recebe o acesso à tela. Depois disso,
 * conceder ou retirar fica só na tela de grupos.
 */
import { prisma } from './prisma.js';
import { PERMISSOES } from './permissoes.js';

const MARCADOR = 'compras.solicitacoes.backfill';

function parsePermissoes(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter((p): p is string => typeof p === 'string');
  } catch {
    return [];
  }
}

export function permissoesSolicitacoesCompraParaGrupo(perms: string[]): string[] {
  if (!perms.includes(PERMISSOES.COMPRAS_VER)) return [];
  if (perms.includes(PERMISSOES.COMPRAS_SOLICITACOES_VER)) return [];
  return [PERMISSOES.COMPRAS_SOLICITACOES_VER];
}

export async function ensureSolicitacoesCompraPermissao(): Promise<void> {
  const feito = await prisma.config.findUnique({ where: { key: MARCADOR } });
  if (feito) return;

  const grupos = await prisma.grupoUsuario.findMany({ select: { id: true, permissoes: true } });
  let atualizados = 0;
  for (const g of grupos) {
    const perms = parsePermissoes(g.permissoes);
    const novas = permissoesSolicitacoesCompraParaGrupo(perms);
    if (novas.length === 0) continue;
    await prisma.grupoUsuario.update({
      where: { id: g.id },
      data: { permissoes: JSON.stringify([...perms, ...novas]) },
    });
    atualizados += 1;
  }

  await prisma.config.create({ data: { key: MARCADOR, value: '1' } });
  if (atualizados > 0) {
    console.log(`[startup] ensureSolicitacoesCompraPermissao: permissão concedida a ${atualizados} grupo(s).`);
  }
}
