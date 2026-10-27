/**
 * Materiais a chegar passou para Compras com permissões próprias. Uma vez só, cada
 * grupo recebe o que já fazia antes: quem abria a tela (PCP, Pedidos ou Compras) ganha
 * acesso à tela e à guia de datas; quem também editava Integração ganha alterar datas.
 * Depois disso, conceder ou retirar fica só na tela de grupos.
 */
import { prisma } from './prisma.js';
import { PERMISSOES } from './permissoes.js';

const MARCADOR = 'compras.materiais_chegar.backfill';

const ACESSO_ANTERIOR: string[] = [
  PERMISSOES.PCP_VER_TELA,
  PERMISSOES.PCP_TOTAL,
  PERMISSOES.PEDIDOS_VER,
  PERMISSOES.COMPRAS_VER,
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

export function permissoesMateriaisAChegarParaGrupo(perms: string[]): string[] {
  if (!ACESSO_ANTERIOR.some((p) => perms.includes(p))) return [];
  const novas: string[] = [PERMISSOES.COMPRAS_MATERIAIS_CHEGAR_VER, PERMISSOES.COMPRAS_MATERIAIS_CHEGAR_DATAS_VER];
  if (perms.includes(PERMISSOES.INTEGRACAO_EDITAR)) novas.push(PERMISSOES.COMPRAS_MATERIAIS_CHEGAR_DATAS_ALTERAR);
  return novas.filter((p) => !perms.includes(p));
}

export async function ensureMateriaisAChegarPermissao(): Promise<void> {
  const feito = await prisma.config.findUnique({ where: { key: MARCADOR } });
  if (feito) return;

  const grupos = await prisma.grupoUsuario.findMany({ select: { id: true, permissoes: true } });
  let atualizados = 0;
  for (const g of grupos) {
    const perms = parsePermissoes(g.permissoes);
    const novas = permissoesMateriaisAChegarParaGrupo(perms);
    if (novas.length === 0) continue;
    await prisma.grupoUsuario.update({
      where: { id: g.id },
      data: { permissoes: JSON.stringify([...perms, ...novas]) },
    });
    atualizados += 1;
  }

  await prisma.config.create({ data: { key: MARCADOR, value: '1' } });
  if (atualizados > 0) {
    console.log(`[startup] ensureMateriaisAChegarPermissao: permissões concedidas a ${atualizados} grupo(s).`);
  }
}
