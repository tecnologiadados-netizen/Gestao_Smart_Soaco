/**
 * Permissões próprias de gôndolas e porta-paletes. Uma vez só: o grupo Master recebe todas.
 * Os demais grupos ficam sem nenhuma até alguém marcar na tela de grupos.
 */
import { prisma } from './prisma.js';
import { PERMISSOES } from './permissoes.js';
import { GRUPO_MASTER_NOME } from './grupoMaster.js';

const MARCADOR = 'pcp.gondolas.backfill';

const TODAS_GONDOLAS = [
  PERMISSOES.PCP_GONDOLAS_VER,
  PERMISSOES.PCP_GONDOLAS_GERAR,
  PERMISSOES.PCP_GONDOLAS_EXCLUIR_ORDEM,
  PERMISSOES.PCP_GONDOLAS_EDITAR_MEDIDAS,
  PERMISSOES.PCP_GONDOLAS_IMPORTAR_PLANILHA,
  PERMISSOES.PCP_GONDOLAS_ESCOLHER_FICHA,
];

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

export async function ensureGondolasPermissao(): Promise<void> {
  const feito = await prisma.config.findUnique({ where: { key: MARCADOR } });
  if (feito) return;

  const master = await prisma.grupoUsuario.findUnique({
    where: { nome: GRUPO_MASTER_NOME },
    select: { id: true, permissoes: true },
  });
  if (master) {
    const perms = parsePermissoes(master.permissoes);
    const novas = TODAS_GONDOLAS.filter((p) => !perms.includes(p));
    if (novas.length > 0) {
      await prisma.grupoUsuario.update({
        where: { id: master.id },
        data: { permissoes: JSON.stringify([...perms, ...novas]) },
      });
      console.log('[startup] ensureGondolasPermissao: permissões de gôndolas concedidas ao grupo Master.');
    }
  }

  await prisma.config.create({ data: { key: MARCADOR, value: '1' } });
}
