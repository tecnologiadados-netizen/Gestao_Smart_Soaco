/**
 * Compatibilidade: grupos que já tinham compras.ver / compras.editar
 * passam a ter compras.double_checkin explícito (acesso isolável depois).
 */
import { prisma } from './prisma.js';
import { PERMISSOES } from './permissoes.js';

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

export async function ensureDoubleCheckInPermissao(): Promise<void> {
  const grupos = await prisma.grupoUsuario.findMany({
    select: { id: true, nome: true, permissoes: true },
  });

  let atualizados = 0;
  for (const g of grupos) {
    const perms = parsePermissoes(g.permissoes);
    if (perms.includes(PERMISSOES.COMPRAS_DOUBLE_CHECKIN)) continue;
    const tinhaCompras =
      perms.includes(PERMISSOES.COMPRAS_VER) || perms.includes(PERMISSOES.COMPRAS_EDITAR);
    if (!tinhaCompras) continue;
    const next = [...perms, PERMISSOES.COMPRAS_DOUBLE_CHECKIN];
    await prisma.grupoUsuario.update({
      where: { id: g.id },
      data: { permissoes: JSON.stringify(next) },
    });
    atualizados += 1;
  }

  if (atualizados > 0) {
    console.log(
      `[startup] ensureDoubleCheckInPermissao: concedida a ${atualizados} grupo(s) com Compras.`
    );
  }
}
