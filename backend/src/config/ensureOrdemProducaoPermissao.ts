/**
 * Quem já abria a ordem de produção pelo gerenciador ou por pedidos.ver
 * recebe a permissão própria uma vez. Depois disso o checkbox pode ser desmarcado.
 */
import { prisma } from './prisma.js';
import { PERMISSOES } from './permissoes.js';

const MARCADOR = 'pcp.ordem_producao.ver.backfill';
const MARCADOR_GERAR = 'pcp.ordem_producao.gerar.backfill';

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

function jaAbriaOrdem(perms: string[]): boolean {
  return (
    perms.includes(PERMISSOES.PCP_VER_TELA) ||
    perms.includes(PERMISSOES.PCP_TOTAL) ||
    perms.includes(PERMISSOES.PEDIDOS_VER)
  );
}

export async function ensureOrdemProducaoPermissao(): Promise<void> {
  const feito = await prisma.config.findUnique({ where: { key: MARCADOR } });
  if (!feito) {
    const grupos = await prisma.grupoUsuario.findMany({
      select: { id: true, permissoes: true },
    });

    let atualizados = 0;
    for (const grupo of grupos) {
      const perms = parsePermissoes(grupo.permissoes);
      if (perms.includes(PERMISSOES.PCP_ORDEM_PRODUCAO_VER) || !jaAbriaOrdem(perms)) continue;
      await prisma.grupoUsuario.update({
        where: { id: grupo.id },
        data: { permissoes: JSON.stringify([...perms, PERMISSOES.PCP_ORDEM_PRODUCAO_VER]) },
      });
      atualizados += 1;
    }

    await prisma.config.create({ data: { key: MARCADOR, value: '1' } });
    if (atualizados > 0) {
      console.log(
        `[startup] ensureOrdemProducaoPermissao: concedida a ${atualizados} grupo(s) que já abriam a tela.`
      );
    }
  }

  const gerarFeito = await prisma.config.findUnique({ where: { key: MARCADOR_GERAR } });
  if (gerarFeito) return;

  const gruposAtuais = await prisma.grupoUsuario.findMany({
    select: { id: true, permissoes: true },
  });
  let comGerar = 0;
  for (const grupo of gruposAtuais) {
    const perms = parsePermissoes(grupo.permissoes);
    if (!perms.includes(PERMISSOES.PCP_ORDEM_PRODUCAO_VER) || perms.includes(PERMISSOES.PCP_ORDEM_PRODUCAO_GERAR)) {
      continue;
    }
    await prisma.grupoUsuario.update({
      where: { id: grupo.id },
      data: { permissoes: JSON.stringify([...perms, PERMISSOES.PCP_ORDEM_PRODUCAO_GERAR]) },
    });
    comGerar += 1;
  }
  await prisma.config.create({ data: { key: MARCADOR_GERAR, value: '1' } });
  if (comGerar > 0) {
    console.log(
      `[startup] ensureOrdemProducaoPermissao: visualizar e gerar concedida a ${comGerar} grupo(s) que já visualizavam.`
    );
  }
}
