/**
 * Seed de cadastros default do módulo RH (regras de alerta, etc.).
 * Chamado no startup ou via script dedicado.
 */
import { prisma } from '../config/prisma.js';
import { normalizeRhPermissions } from './lib/rh-permissions.js';

const ALERTA_REGRAS = [
  ['prev-soma-60-grupo-cid', 'Soma de atestados no mesmo grupo de sintomas (CID)', 'previdenciario', 'Art. 75 Dec. 3.048/1999', '> 15 dias / 60 dias', 'alta', 1],
  ['pol-declaracao-3-dias', 'Declaração de comparecimento acumulada', 'politica_interna', 'Política interna', '> 3 dias / 12 meses', 'media', 2],
  ['clt-473-iv', 'Doação voluntária de sangue', 'clt', 'Art. 473, IV — CLT', '1 dia / 12 meses', 'media', 3],
  ['clt-473-i', 'Licença por óbito', 'clt', 'Art. 473, I — CLT', 'Máx. 2 dias', 'media', 4],
  ['clt-473-ii', 'Licença casamento', 'clt', 'Art. 473, II — CLT', 'Máx. 3 dias', 'media', 5],
  ['clt-473-iii', 'Licença paternidade', 'clt', 'Art. 473, III — CLT', 'Máx. 5 dias', 'media', 6],
  ['clt-473-v', 'Alistamento eleitoral', 'clt', 'Art. 473, V — CLT', 'Máx. 2 dias', 'baixa', 7],
  ['clt-473-xi', 'Consulta filho até 6 anos', 'clt', 'Art. 473, XI — CLT', '1 dia / 12 meses', 'media', 8],
  ['clt-473-xii', 'Exames preventivos câncer/HPV', 'clt', 'Art. 473, XII — CLT', 'Máx. 3 dias / 12 meses', 'media', 9],
  ['prev-15-dias-consecutivos', 'Atestado único superior a 15 dias', 'previdenciario', 'Art. 75 Dec. 3.048/1999', '> 15 dias', 'alta', 10],
  ['doc-declaracao-dia-integral', 'Declaração com período integral > 1 dia', 'politica_interna', 'CFM; política interna', 'Integral > 1 dia', 'media', 11],
  ['dup-mesmo-dia', 'Duas ausências no mesmo dia', 'operacional', 'Controle interno', '1 / dia', 'media', 12],
] as const;

export async function seedRhDefaults(): Promise<void> {
  for (const [id, titulo, baseLegal, referenciaLegal, limiteResumo, severidade, ordem] of ALERTA_REGRAS) {
    await prisma.rhFaltasAlertaRegras.upsert({
      where: { id },
      create: {
        id,
        titulo,
        descricao: titulo,
        baseLegal,
        referenciaLegal,
        limiteResumo,
        ativa: true,
        ordem,
        severidadePadrao: severidade,
      },
      update: {},
    });
  }

  const grupos = await prisma.grupoUsuario.findMany({ select: { id: true, nome: true } });
  const defaultPerms = normalizeRhPermissions({});
  for (const g of grupos) {
    const existing = await prisma.rhGrupoPermissao.findUnique({ where: { grupoId: g.id } });
    if (!existing) {
      await prisma.rhGrupoPermissao.create({
        data: {
          grupoId: g.id,
          permissions: JSON.stringify(defaultPerms),
        },
      });
    }
  }
}
