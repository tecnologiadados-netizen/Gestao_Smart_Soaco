import { prisma } from '../../config/prisma.js';
import { fetchSecullumMotivosDemissao } from '../services/secullumService.js';
import {
  MotivoDesligamentoErro,
  motivoPaiCompativel,
  normalizarMotivoPai,
} from '../lib/motivoDesligamento.js';
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

export async function listDesligamentosComplementos() {
  const rows = await prisma.rhDesligamentoComplemento.findMany({
    orderBy: [{ dataDemissao: 'desc' }, { updatedAt: 'desc' }],
  });
  return rows.map((row) => ({
    id: row.id,
    colaboradorMatricula: row.colaboradorMatricula,
    colaboradorNome: row.colaboradorNome,
    dataDemissao: row.dataDemissao,
    motivoPai: row.motivoPai,
    motivoFilhoId: row.motivoFilhoId,
    motivoFilho: row.motivoFilho,
    motivoTexto: row.motivoTexto,
    registradoPor: row.registradoPor,
    updatedAt: row.updatedAt.toISOString(),
  }));
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

export async function finalizarDesligamentoPendente(input: {
  id: string;
  resolvedBy: string;
  motivo: string;
  motivoFilhoId: string;
}) {
  const row = await prisma.rhOrganicoAlteracaoPendente.findUnique({ where: { id: input.id } });
  if (!row) throw new MotivoDesligamentoErro('Pendência não encontrada.');
  if (row.resolvedAt) throw new MotivoDesligamentoErro('Esta pendência já foi finalizada.');
  if (row.tipo !== 'desligamento') throw new MotivoDesligamentoErro('Pendência não é de desligamento.');

  const motivo = s(input.motivo);
  const motivoFilhoId = s(input.motivoFilhoId);
  if (!motivoFilhoId) throw new MotivoDesligamentoErro('Selecione o motivo detalhado.');
  if (!motivo) throw new MotivoDesligamentoErro('Informe o complemento do desligamento.');

  const filho = await prisma.rhMotivoDesligamentoFilho.findUnique({ where: { id: motivoFilhoId } });
  if (!filho || !filho.ativo) throw new MotivoDesligamentoErro('Motivo detalhado inválido.');
  if (!motivoPaiCompativel(filho.motivoPai, row.valorAtual)) {
    throw new MotivoDesligamentoErro('O motivo detalhado não pertence ao motivo da Secullum.');
  }

  const dataDemissao = formatIsoDate(row.dataReferencia);
  const matricula = s(row.colaboradorMatricula);
  if (!matricula) throw new MotivoDesligamentoErro('Pendência sem matrícula do colaborador.');

  const comentario = [
    'Desligamento complementado.',
    `Motivo Secullum: ${s(row.valorAtual) || '—'}.`,
    `Motivo detalhado: ${filho.descricao}.`,
    `Complemento: ${motivo}`,
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
        colaboradorNome: s(row.colaboradorNome),
        dataDemissao,
        motivoPai: s(row.valorAtual),
        motivoFilhoId: filho.id,
        motivoFilho: filho.descricao,
        motivoTexto: motivo,
        registradoPor: s(input.resolvedBy) || null,
      },
      update: {
        colaboradorNome: s(row.colaboradorNome),
        motivoPai: s(row.valorAtual),
        motivoFilhoId: filho.id,
        motivoFilho: filho.descricao,
        motivoTexto: motivo,
        registradoPor: s(input.resolvedBy) || null,
      },
    }),
    prisma.rhOrganicoAlteracaoPendente.update({
      where: { id: row.id },
      data: {
        resolvedAt: new Date(),
        resolvedBy: s(input.resolvedBy) || null,
        motivo,
      },
    }),
    prisma.rhOrganicoComentarios.create({
      data: {
        colaboradorNome: s(row.colaboradorNome) || '—',
        colaboradorMatricula: matricula,
        comentario,
        criadoPor: s(input.resolvedBy) || 'RH',
        tagCodigo: '10',
        visibilidade: 'public',
        tipo: 'log_alteracao',
        categoria: 'contrato',
        campoAlterado: 'Desligamento',
        valorAnterior: s(row.valorAtual) || null,
        valorAtual: `${filho.descricao} — ${motivo}`,
      },
    }),
  ]);
}
