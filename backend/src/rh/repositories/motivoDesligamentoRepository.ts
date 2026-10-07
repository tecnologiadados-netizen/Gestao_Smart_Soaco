import { prisma } from '../../config/prisma.js';
import { fetchSecullumMotivosDemissao } from '../services/secullumService.js';
import {
  MotivoDesligamentoErro,
  motivoPaiCompativel,
  normalizarMotivoPai,
} from '../lib/motivoDesligamento.js';
import { canViewRhConteudoSensivel } from '../lib/rh-permissions.js';
import type { RhGroupPermissions } from '../lib/rh-permissions.js';
import { formatIsoDate, parseIsoDate, s } from '../utils/rhHelpers.js';

export type MotivoDesligamentoFilhoItem = {
  id: string;
  descricao: string;
  ordem: number;
};

export type MotivoDesligamentoPai = {
  motivoPai: string;
  filhos: MotivoDesligamentoFilhoItem[];
};

function ordenarTexto(a: string, b: string): number {
  return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });
}

export async function listMotivosDesligamento(): Promise<MotivoDesligamentoPai[]> {
  const [secullum, filhos, pendencias] = await Promise.all([
    fetchSecullumMotivosDemissao().catch(() => [] as string[]),
    prisma.rhMotivoDesligamentoFilho.findMany({
      where: { ativo: true },
      orderBy: [{ ordem: 'asc' }, { descricao: 'asc' }],
    }),
    prisma.rhOrganicoAlteracaoPendente.findMany({
      where: { tipo: 'desligamento', resolvedAt: null },
      select: { valorAtual: true },
    }),
  ]);

  const grupos = new Map<string, MotivoDesligamentoPai>();

  const garantir = (label: string): MotivoDesligamentoPai | null => {
    const texto = s(label);
    const key = normalizarMotivoPai(texto);
    if (!key) return null;
    let grupo = grupos.get(key);
    if (!grupo) {
      grupo = { motivoPai: texto, filhos: [] };
      grupos.set(key, grupo);
    }
    return grupo;
  };

  for (const motivo of secullum) garantir(motivo);
  for (const pendencia of pendencias) garantir(pendencia.valorAtual);
  for (const filho of filhos) {
    const grupo = garantir(filho.motivoPai);
    if (!grupo) continue;
    grupo.filhos.push({
      id: filho.id,
      descricao: filho.descricao,
      ordem: filho.ordem,
    });
  }

  return [...grupos.values()]
    .map((grupo) => ({
      ...grupo,
      filhos: [...grupo.filhos].sort((a, b) => a.ordem - b.ordem || ordenarTexto(a.descricao, b.descricao)),
    }))
    .sort((a, b) => ordenarTexto(a.motivoPai, b.motivoPai));
}

export async function replaceMotivosDesligamentoFilhos(
  motivoPai: string,
  filhos: Array<{ descricao?: string | null }>,
) {
  const pai = s(motivoPai);
  if (!pai) throw new MotivoDesligamentoErro('Informe o motivo pai.');

  const descricoes: string[] = [];
  const vistos = new Set<string>();
  for (const filho of filhos) {
    const descricao = s(filho.descricao);
    if (!descricao) continue;
    const key = normalizarMotivoPai(descricao);
    if (vistos.has(key)) {
      throw new MotivoDesligamentoErro(`Motivo filho repetido: ${descricao}.`);
    }
    vistos.add(key);
    descricoes.push(descricao);
  }

  const keyPai = normalizarMotivoPai(pai);
  const existentes = await prisma.rhMotivoDesligamentoFilho.findMany({ select: { id: true, motivoPai: true } });
  const ids = existentes.filter((row) => normalizarMotivoPai(row.motivoPai) === keyPai).map((row) => row.id);

  if (ids.length === 0 && descricoes.length === 0) return { ok: true, total: 0 };

  const gravar = descricoes.map((descricao, ordem) =>
    prisma.rhMotivoDesligamentoFilho.create({
      data: { motivoPai: pai, descricao, ordem, ativo: true },
    }),
  );
  await prisma.$transaction([
    ...(ids.length > 0 ? [prisma.rhMotivoDesligamentoFilho.deleteMany({ where: { id: { in: ids } } })] : []),
    ...gravar,
  ]);

  return { ok: true, total: descricoes.length };
}

export async function listDesligamentosComplementos(acesso?: {
  isMaster?: boolean;
  permissions?: RhGroupPermissions | null;
}) {
  const podeLerSensivel = canViewRhConteudoSensivel(acesso?.permissions ?? null, acesso?.isMaster === true);
  const rows = await prisma.rhDesligamentoComplemento.findMany({
    orderBy: [{ dataDemissao: 'desc' }, { updatedAt: 'desc' }],
  });
  return rows.map((row) => {
    const oculto = row.motivoSensivel && !podeLerSensivel;
    return {
      id: row.id,
      colaboradorMatricula: row.colaboradorMatricula,
      colaboradorNome: row.colaboradorNome,
      dataDemissao: row.dataDemissao,
      motivoPai: row.motivoPai,
      motivoFilhoId: row.motivoFilhoId,
      motivoFilho: row.motivoFilho,
      motivoSensivel: row.motivoSensivel,
      motivoOculto: oculto,
      motivoTexto: oculto ? '' : row.motivoTexto,
      registradoPor: row.registradoPor,
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

type UpsertDesligamentoInput = {
  colaboradorMatricula: string;
  colaboradorNome?: string;
  setor?: string;
  campoLabel?: string;
  valorAnterior?: string;
  valorAtual?: string;
  dataReferencia?: string | null;
};

export async function upsertPendenciaDesligamento(item: UpsertDesligamentoInput) {
  const matricula = s(item.colaboradorMatricula);
  if (!matricula) return null;

  const dataReferencia = parseIsoDate(item.dataReferencia);
  const iso = dataReferencia ? formatIsoDate(dataReferencia) : '';
  const existentes = await prisma.rhOrganicoAlteracaoPendente.findMany({
    where: { colaboradorMatricula: matricula, tipo: 'desligamento' },
  });
  const mesmo = existentes.find((row) => formatIsoDate(row.dataReferencia) === iso);
  const data = {
    colaboradorNome: s(item.colaboradorNome),
    setor: s(item.setor),
    campoLabel: s(item.campoLabel) || 'Desligamento',
    valorAnterior: s(item.valorAnterior),
    valorAtual: s(item.valorAtual) || 'Não informado no Secullum',
    dataReferencia,
  };

  if (mesmo) {
    if (mesmo.resolvedAt) return null;
    return prisma.rhOrganicoAlteracaoPendente.update({
      where: { id: mesmo.id },
      data,
    });
  }

  return prisma.rhOrganicoAlteracaoPendente.create({
    data: {
      colaboradorMatricula: matricula,
      tipo: 'desligamento',
      ...data,
    },
  });
}

type GravarComplementoInput = {
  colaboradorMatricula: string;
  colaboradorNome: string;
  dataDemissao: string;
  motivoPai: string;
  motivoFilhoId: string;
  motivoTexto: string;
  motivoSensivel: boolean;
  registradoPor: string;
};

async function validarFilhoDoMotivo(motivoFilhoId: string, motivoPai: string) {
  const filho = await prisma.rhMotivoDesligamentoFilho.findUnique({ where: { id: motivoFilhoId } });
  if (!filho || !filho.ativo) throw new MotivoDesligamentoErro('Complemento inválido.');
  if (!motivoPaiCompativel(filho.motivoPai, motivoPai)) {
    throw new MotivoDesligamentoErro('O complemento não pertence ao motivo da Secullum.');
  }
  return filho;
}

async function gravarComplementoDesligamento(input: GravarComplementoInput) {
  const matricula = s(input.colaboradorMatricula);
  if (!matricula) throw new MotivoDesligamentoErro('Informe a matrícula do colaborador.');
  const motivoTexto = s(input.motivoTexto);
  const motivoFilhoId = s(input.motivoFilhoId);
  const motivoPai = s(input.motivoPai);
  if (!motivoFilhoId) throw new MotivoDesligamentoErro('Selecione o complemento do desligamento.');
  if (!motivoTexto) throw new MotivoDesligamentoErro('Informe o motivo detalhado.');
  const dataDemissao = formatIsoDate(parseIsoDate(input.dataDemissao));
  if (!dataDemissao) throw new MotivoDesligamentoErro('Data de demissão não informada.');

  const filho = await validarFilhoDoMotivo(motivoFilhoId, motivoPai);
  const sensivel = input.motivoSensivel === true;
  const nome = s(input.colaboradorNome);
  const autor = s(input.registradoPor) || 'RH';
  const comentario = [
    'Desligamento complementado.',
    `Motivo Secullum: ${motivoPai || '—'}.`,
    `Complemento: ${filho.descricao}.`,
    sensivel ? 'Motivo detalhado registrado como sensível.' : `Motivo detalhado: ${motivoTexto}`,
  ].join(' ');

  await prisma.$transaction([
    prisma.rhDesligamentoComplemento.upsert({
      where: {
        colaboradorMatricula_dataDemissao: {
          colaboradorMatricula: matricula,
          dataDemissao,
        },
      },
      create: {
        colaboradorMatricula: matricula,
        colaboradorNome: nome,
        dataDemissao,
        motivoPai,
        motivoFilhoId: filho.id,
        motivoFilho: filho.descricao,
        motivoTexto,
        motivoSensivel: sensivel,
        registradoPor: autor,
      },
      update: {
        colaboradorNome: nome,
        motivoPai,
        motivoFilhoId: filho.id,
        motivoFilho: filho.descricao,
        motivoTexto,
        motivoSensivel: sensivel,
        registradoPor: autor,
      },
    }),
    prisma.rhOrganicoComentarios.create({
      data: {
        colaboradorNome: nome || '—',
        colaboradorMatricula: matricula,
        comentario,
        criadoPor: autor,
        tagCodigo: '10',
        visibilidade: 'public',
        tipo: 'log_alteracao',
        categoria: 'contrato',
        campoAlterado: 'Desligamento',
        valorAnterior: motivoPai || null,
        valorAtual: sensivel ? filho.descricao : `${filho.descricao} — ${motivoTexto}`,
      },
    }),
  ]);
}

export async function salvarDesligamentoComplemento(input: GravarComplementoInput) {
  await gravarComplementoDesligamento(input);
  const dataDemissao = formatIsoDate(parseIsoDate(input.dataDemissao));
  const matricula = s(input.colaboradorMatricula);
  const abertas = await prisma.rhOrganicoAlteracaoPendente.findMany({
    where: { colaboradorMatricula: matricula, tipo: 'desligamento', resolvedAt: null },
  });
  const pendencia = abertas.find((row) => formatIsoDate(row.dataReferencia) === dataDemissao);
  if (!pendencia) return { ok: true };
  await prisma.rhOrganicoAlteracaoPendente.update({
    where: { id: pendencia.id },
    data: {
      resolvedAt: new Date(),
      resolvedBy: s(input.registradoPor) || null,
      motivo: input.motivoSensivel ? 'Registrado como sensível.' : s(input.motivoTexto),
    },
  });
  return { ok: true };
}

export async function finalizarDesligamentoPendente(input: {
  id: string;
  resolvedBy: string;
  motivo: string;
  motivoFilhoId: string;
  motivoSensivel?: boolean;
}) {
  const row = await prisma.rhOrganicoAlteracaoPendente.findUnique({ where: { id: input.id } });
  if (!row) throw new MotivoDesligamentoErro('Pendência não encontrada.');
  if (row.resolvedAt) throw new MotivoDesligamentoErro('Esta pendência já foi finalizada.');
  if (row.tipo !== 'desligamento') throw new MotivoDesligamentoErro('Pendência não é de desligamento.');

  const matricula = s(row.colaboradorMatricula);
  if (!matricula) throw new MotivoDesligamentoErro('Pendência sem matrícula do colaborador.');

  await gravarComplementoDesligamento({
    colaboradorMatricula: matricula,
    colaboradorNome: s(row.colaboradorNome),
    dataDemissao: formatIsoDate(row.dataReferencia),
    motivoPai: s(row.valorAtual),
    motivoFilhoId: s(input.motivoFilhoId),
    motivoTexto: s(input.motivo),
    motivoSensivel: input.motivoSensivel === true,
    registradoPor: s(input.resolvedBy),
  });

  await prisma.rhOrganicoAlteracaoPendente.update({
    where: { id: row.id },
    data: {
      resolvedAt: new Date(),
      resolvedBy: s(input.resolvedBy) || null,
      motivo: input.motivoSensivel ? 'Registrado como sensível.' : s(input.motivo),
    },
  });
}
