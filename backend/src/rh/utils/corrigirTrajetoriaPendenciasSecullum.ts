/**
 * Correção única (marcada em `rh_config`): pendências CTPS/cargo da Secullum justificadas entre
 * ago e out/2026 não geraram o evento na trajetória e, até 06/10/2026, o motivo digitado era descartado.
 *
 * - Cria o evento na trajetória (pendências duplicadas da mesma transição/dia apontam para o mesmo evento).
 * - Motivo preservado: evento já sai como "justificativa registrada".
 * - Motivo perdido: reabre a pendência para o RH justificar de novo (evento fica "aguardando motivo").
 */
import { prisma } from '../../config/prisma.js';
import {
  chaveTransicaoPendencia,
  dataEventoLocal,
  eventoTrajetoriaSecullum,
  isTipoPendenciaTrajetoria,
  ORIGEM_SECULLUM_AGUARDANDO,
  ORIGEM_SECULLUM_JUSTIFICADA,
} from '../lib/organicoTrajetoriaSecullum.js';
import { resolverMatriculaOrganicoPorNome } from '../repositories/organicoRepository.js';
import { formatIsoDate, s } from './rhHelpers.js';

const MARCADOR = 'correcao_trajetoria_pendencias_secullum_v1';

export async function corrigirTrajetoriaPendenciasSecullum(): Promise<{
  eventos: number;
  reabertas: number;
  semMatricula: number;
} | null> {
  const feito = await prisma.rhConfig.findUnique({ where: { key: MARCADOR } });
  if (feito) return null;

  const pendencias = await prisma.rhOrganicoAlteracaoPendente.findMany({
    where: { tipo: { in: ['ctps', 'cargo'] }, organicoTrajetoriaId: null, resolvedAt: { not: null } },
    orderBy: { detectedAt: 'asc' },
  });
  const alvo = pendencias.filter((p) => !s(p.motivo).startsWith('Encerrado automaticamente'));

  const grupos = new Map<string, typeof alvo>();
  for (const p of alvo) {
    const dataEvento = p.dataReferencia ?? dataEventoLocal(p.detectedAt);
    const key = [s(p.colaboradorNome).toLocaleUpperCase('pt-BR'), chaveTransicaoPendencia(p), formatIsoDate(dataEvento)].join('#');
    const lista = grupos.get(key) ?? [];
    lista.push(p);
    grupos.set(key, lista);
  }

  let eventos = 0;
  let reabertas = 0;
  let semMatricula = 0;
  for (const lista of grupos.values()) {
    const principal = lista.find((p) => s(p.motivo)) ?? lista[0];
    const tipo = principal.tipo;
    if (!isTipoPendenciaTrajetoria(tipo)) continue;
    const matricula =
      s(principal.colaboradorMatricula) || (await resolverMatriculaOrganicoPorNome(principal.colaboradorNome));
    if (!matricula) {
      semMatricula += 1;
      console.warn(`[startup] Trajetória Secullum: sem matrícula para ${principal.colaboradorNome} (${principal.tipo}).`);
      continue;
    }
    const motivo = s(principal.motivo) || null;
    const dataEvento = principal.dataReferencia ?? dataEventoLocal(principal.detectedAt);

    await prisma.$transaction(async (tx) => {
      const evento = await tx.rhOrganicoTrajetoria.create({
        data: {
          colaboradorMatricula: matricula,
          colaboradorNome: s(principal.colaboradorNome),
          dataEvento,
          ...eventoTrajetoriaSecullum(tipo, principal.valorAnterior, principal.valorAtual),
          motivo,
          origemArquivo: motivo ? ORIGEM_SECULLUM_JUSTIFICADA : ORIGEM_SECULLUM_AGUARDANDO,
          importadoPor: s(principal.resolvedBy) || 'sistema',
        },
      });
      for (const p of lista) {
        const reabrir = !motivo && p.id === principal.id;
        await tx.rhOrganicoAlteracaoPendente.update({
          where: { id: p.id },
          data: {
            organicoTrajetoriaId: evento.id,
            colaboradorMatricula: matricula,
            ...(reabrir ? { resolvedAt: null, resolvedBy: null } : {}),
          },
        });
      }
    });
    eventos += 1;
    if (!motivo) reabertas += 1;
  }

  const resumo = { eventos, reabertas, semMatricula };
  await prisma.rhConfig.create({
    data: { key: MARCADOR, value: JSON.stringify({ ...resumo, executadoEm: new Date().toISOString() }) },
  });
  console.log(
    `[startup] Trajetória Secullum: ${eventos} evento(s) criado(s), ${reabertas} pendência(s) reaberta(s) para justificar` +
      (semMatricula > 0 ? `, ${semMatricula} sem matrícula.` : '.'),
  );
  return resumo;
}
