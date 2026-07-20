import { randomUUID } from 'crypto';
import { prisma } from '../../config/prisma.js';
import {
  mapEnquadramentoRow,
  mapInconsistenciaRow,
  mapRegraRow,
  reconciliarInconsistenciasDb,
  type AusenciaAtivaRef,
} from '../lib/faltas-alerta-api.js';
import { s } from '../utils/rhHelpers.js';

export async function getFaltasAlertaRegras() {
  const rows = await prisma.rhFaltasAlertaRegras.findMany({ orderBy: { ordem: 'asc' } });
  return rows.map((r) =>
    mapRegraRow({
      id: r.id,
      titulo: r.titulo,
      descricao: r.descricao,
      base_legal: r.baseLegal,
      referencia_legal: r.referenciaLegal,
      limite_resumo: r.limiteResumo,
      ativa: r.ativa,
      ordem: r.ordem,
      severidade_padrao: r.severidadePadrao,
      updated_at: r.updatedAt,
      updated_by: r.updatedBy,
    }),
  );
}

export async function setFaltasAlertaRegraAtiva(regraId: string, ativa: boolean, updatedBy: string) {
  await prisma.rhFaltasAlertaRegras.update({
    where: { id: regraId },
    data: { ativa, updatedBy, updatedAt: new Date() },
  });
}

export async function getFaltasAlertaEnquadramentos() {
  const [enquadramentos, inconsistencias] = await Promise.all([
    prisma.rhFaltasAlertaEnquadramentos.findMany({ orderBy: { detectadaEm: 'desc' } }),
    prisma.rhFaltasAusenciaInconsistencias.findMany(),
  ]);
  const incMap = new Map(inconsistencias.map((i) => [i.id, mapInconsistenciaRow({
    id: i.id,
    falta_id: i.faltaId,
    enquadramento_id: i.enquadramentoId,
    regra_id: i.regraId,
    titulo: i.titulo,
    descricao: i.descricao,
    base_legal: i.baseLegal,
    severidade: i.severidade,
    status: i.status,
    matricula: i.matricula,
    nome_funcionario: i.nomeFuncionario,
    data_ausencia: i.dataAusencia,
    dias_acumulados: i.diasAcumulados,
    limite_dias: i.limiteDias,
    grupo_cid_id: i.grupoCidId,
    grupo_cid_titulo: i.grupoCidTitulo,
    detectada_em: i.detectadaEm,
    resolvida_em: i.resolvidaEm,
    resolucao_notas: i.resolucaoNotas,
    resolvido_por: i.resolvidoPor,
    lancado_por: i.lancadoPor,
  })]));

  return enquadramentos.map((e) =>
    mapEnquadramentoRow(
      {
        id: e.id,
        regra_id: e.regraId,
        falta_id: e.faltaId,
        inconsistencia_id: e.inconsistenciaId,
        matricula: e.matricula,
        nome_funcionario: e.nomeFuncionario,
        data_ausencia: e.dataAusencia,
        tipo: e.tipo,
        cid: e.cid,
        motivo: e.motivo,
        contexto: e.contextoJson
          ? (JSON.parse(e.contextoJson) as Record<string, unknown>)
          : undefined,
        lancado_por: e.lancadoPor,
        detectada_em: e.detectadaEm,
      },
      e.inconsistenciaId ? incMap.get(e.inconsistenciaId) : undefined,
    ),
  );
}

export async function getFaltasAlertaInconsistencias(faltasAtivas: AusenciaAtivaRef[] = []) {
  const incData = await prisma.rhFaltasAusenciaInconsistencias.findMany({
    orderBy: { detectadaEm: 'desc' },
  });

  let mapped = incData.map((r) =>
    mapInconsistenciaRow({
      id: r.id,
      falta_id: r.faltaId,
      enquadramento_id: r.enquadramentoId,
      regra_id: r.regraId,
      titulo: r.titulo,
      descricao: r.descricao,
      base_legal: r.baseLegal,
      severidade: r.severidade,
      status: r.status,
      matricula: r.matricula,
      nome_funcionario: r.nomeFuncionario,
      data_ausencia: r.dataAusencia,
      dias_acumulados: r.diasAcumulados,
      limite_dias: r.limiteDias,
      grupo_cid_id: r.grupoCidId,
      grupo_cid_titulo: r.grupoCidTitulo,
      detectada_em: r.detectadaEm,
      resolvida_em: r.resolvidaEm,
      resolucao_notas: r.resolucaoNotas,
      resolvido_por: r.resolvidoPor,
      lancado_por: r.lancadoPor,
    }),
  );

  if (faltasAtivas.length > 0) {
    const antes = mapped;
    const { next } = reconciliarInconsistenciasDb(mapped, faltasAtivas);
    const keepIds = new Set(next.map((n) => n.id));
    const toDelete = antes.filter((i) => !keepIds.has(i.id)).map((i) => i.id);

    for (const row of next) {
      const prev = antes.find((m) => m.id === row.id);
      if (prev && prev.faltaId !== row.faltaId) {
        await prisma.rhFaltasAusenciaInconsistencias.update({
          where: { id: row.id },
          data: { faltaId: row.faltaId },
        });
        await prisma.rhFaltasAlertaEnquadramentos.updateMany({
          where: { inconsistenciaId: row.id },
          data: { faltaId: row.faltaId },
        });
      }
    }

    if (toDelete.length > 0) {
      await prisma.rhFaltasAlertaEnquadramentos.deleteMany({
        where: { inconsistenciaId: { in: toDelete } },
      });
      await prisma.rhFaltasAusenciaInconsistencias.deleteMany({
        where: { id: { in: toDelete } },
      });
    }

    mapped = next;
  }

  return mapped;
}

export async function updateFaltasAlertaInconsistencia(input: {
  id: string;
  status?: string;
  resolucaoNotas?: string | null;
  resolvidoPor?: string | null;
}) {
  const data: Record<string, unknown> = {};
  if (input.status) data.status = input.status;
  if (input.resolucaoNotas !== undefined) data.resolucaoNotas = s(input.resolucaoNotas) || null;
  if (input.resolvidoPor !== undefined) data.resolvidoPor = s(input.resolvidoPor) || null;
  if (input.status === 'resolvida' || input.status === 'ignorada') {
    data.resolvidaEm = new Date();
  }
  await prisma.rhFaltasAusenciaInconsistencias.update({
    where: { id: input.id },
    data,
  });
}

export async function registrarFaltasAlertaAusencia(input: Record<string, unknown>) {
  const lancadoPor = s(input.lancadoPor) || null;
  const linha =
    input.linha && typeof input.linha === 'object' ? (input.linha as Record<string, unknown>) : null;
  const alertasRaw = Array.isArray(input.alertas) ? (input.alertas as Record<string, unknown>[]) : null;

  // Contrato do frontend (Lançar ausência): { linha, alertas[], lancadoPor }
  if (linha && alertasRaw) {
    const faltaId = s(linha.id);
    if (!faltaId) throw new Error('faltaId obrigatório no lançamento de alertas.');
    if (alertasRaw.length === 0) return { enquadramentos: [], inconsistencias: [] };

    const regraIds = [...new Set(alertasRaw.map((a) => s(a.regraId)).filter(Boolean))];
    const regrasExistentes = await prisma.rhFaltasAlertaRegras.findMany({
      where: { id: { in: regraIds } },
      select: { id: true },
    });
    const regrasOk = new Set(regrasExistentes.map((r) => r.id));
    const faltando = regraIds.filter((id) => !regrasOk.has(id));
    if (faltando.length > 0) {
      throw new Error(
        `Regra(s) de alerta não cadastrada(s) no banco: ${faltando.join(', ')}. Reinicie o backend ou rode o seed de regras RH.`,
      );
    }

    const detectadaEm = new Date();
    const enquadramentos: ReturnType<typeof mapEnquadramentoRow>[] = [];
    const inconsistencias: ReturnType<typeof mapInconsistenciaRow>[] = [];

    await prisma.$transaction(async (tx) => {
      for (const alerta of alertasRaw) {
        const regraId = s(alerta.regraId);
        if (!regraId) continue;

        const inconsistenciaId = randomUUID();
        const enquadramentoId = randomUUID();
        const ctx =
          alerta.contexto && typeof alerta.contexto === 'object'
            ? (alerta.contexto as Record<string, unknown>)
            : {};
        const dataAusenciaRaw = s(linha.data);
        const dataAusencia = dataAusenciaRaw ? new Date(dataAusenciaRaw.slice(0, 10)) : null;
        const matricula = s(linha.matricula);
        const nomeFuncionario = s(linha.nomeFuncionario);
        const tipo = s(linha.tipo);
        const cid = s(linha.cid) || null;
        const titulo = s(alerta.titulo) || 'Alerta de ausência';
        const descricao = s(alerta.motivo);
        const baseLegal = s(alerta.baseLegal) || 'operacional';
        const severidade = s(alerta.severidade) || 'media';

        await tx.rhFaltasAusenciaInconsistencias.create({
          data: {
            id: inconsistenciaId,
            faltaId,
            enquadramentoId,
            regraId,
            titulo,
            descricao,
            baseLegal,
            severidade,
            status: 'pendente',
            matricula,
            nomeFuncionario,
            dataAusencia,
            diasAcumulados: typeof ctx.diasAcumulados === 'number' ? ctx.diasAcumulados : null,
            limiteDias: typeof ctx.limiteDias === 'number' ? ctx.limiteDias : null,
            grupoCidId: typeof ctx.grupoCidId === 'string' ? ctx.grupoCidId : null,
            grupoCidTitulo: typeof ctx.grupoCidTitulo === 'string' ? ctx.grupoCidTitulo : null,
            detectadaEm,
            lancadoPor,
          },
        });

        await tx.rhFaltasAlertaEnquadramentos.create({
          data: {
            id: enquadramentoId,
            regraId,
            faltaId,
            inconsistenciaId,
            matricula,
            nomeFuncionario,
            dataAusencia,
            tipo,
            cid,
            motivo: descricao,
            contextoJson: Object.keys(ctx).length > 0 ? JSON.stringify(ctx) : null,
            lancadoPor: lancadoPor ?? '',
            detectadaEm,
          },
        });

        const incMapped = mapInconsistenciaRow({
          id: inconsistenciaId,
          falta_id: faltaId,
          enquadramento_id: enquadramentoId,
          regra_id: regraId,
          titulo,
          descricao,
          base_legal: baseLegal,
          severidade,
          status: 'pendente',
          matricula,
          nome_funcionario: nomeFuncionario,
          data_ausencia: dataAusencia,
          dias_acumulados: typeof ctx.diasAcumulados === 'number' ? ctx.diasAcumulados : null,
          limite_dias: typeof ctx.limiteDias === 'number' ? ctx.limiteDias : null,
          grupo_cid_id: typeof ctx.grupoCidId === 'string' ? ctx.grupoCidId : null,
          grupo_cid_titulo: typeof ctx.grupoCidTitulo === 'string' ? ctx.grupoCidTitulo : null,
          detectada_em: detectadaEm,
          lancado_por: lancadoPor,
        });
        inconsistencias.push(incMapped);
        enquadramentos.push(
          mapEnquadramentoRow(
            {
              id: enquadramentoId,
              regra_id: regraId,
              falta_id: faltaId,
              inconsistencia_id: inconsistenciaId,
              matricula,
              nome_funcionario: nomeFuncionario,
              data_ausencia: dataAusencia,
              tipo,
              cid,
              motivo: descricao,
              contexto: ctx,
              lancado_por: lancadoPor ?? '',
              detectada_em: detectadaEm,
            },
            incMapped,
          ),
        );
      }
    });

    return { enquadramentos, inconsistencias };
  }

  // Compatibilidade com payload único legado.
  const id = s(input.id) || undefined;
  const regraId = s(input.regraId);
  if (!regraId) throw new Error('regraId obrigatório.');
  const data = {
    faltaId: s(input.faltaId),
    enquadramentoId: s(input.enquadramentoId) || null,
    regraId,
    titulo: s(input.titulo),
    descricao: s(input.descricao),
    baseLegal: s(input.baseLegal),
    severidade: s(input.severidade) || 'media',
    status: s(input.status) || 'pendente',
    matricula: s(input.matricula),
    nomeFuncionario: s(input.nomeFuncionario),
    dataAusencia: input.dataAusencia ? new Date(String(input.dataAusencia)) : null,
    diasAcumulados: input.diasAcumulados == null ? null : Number(input.diasAcumulados),
    limiteDias: input.limiteDias == null ? null : Number(input.limiteDias),
    grupoCidId: s(input.grupoCidId) || null,
    grupoCidTitulo: s(input.grupoCidTitulo) || null,
    lancadoPor,
  };

  if (id) {
    await prisma.rhFaltasAusenciaInconsistencias.update({ where: { id }, data });
    return { id };
  }
  const row = await prisma.rhFaltasAusenciaInconsistencias.create({ data });
  return { id: row.id };
}

export async function removerFaltasAlertaPorFaltas(faltaIds: string[]) {
  const ids = faltaIds.map((id) => id.trim().toLowerCase()).filter(Boolean);
  if (ids.length === 0) return { removed: 0 };

  const incs = await prisma.rhFaltasAusenciaInconsistencias.findMany({
    where: { faltaId: { in: faltaIds } },
    select: { id: true },
  });
  const incIds = incs.map((i) => i.id);
  if (incIds.length > 0) {
    await prisma.rhFaltasAlertaEnquadramentos.deleteMany({
      where: { OR: [{ faltaId: { in: faltaIds } }, { inconsistenciaId: { in: incIds } }] },
    });
    await prisma.rhFaltasAusenciaInconsistencias.deleteMany({ where: { id: { in: incIds } } });
  } else {
    await prisma.rhFaltasAlertaEnquadramentos.deleteMany({ where: { faltaId: { in: faltaIds } } });
  }
  return { removed: incIds.length };
}
