import { prisma } from '../../config/prisma.js';
import { hasSectorAccess } from '../lib/rh-permissions.js';
import { buildAllowedOrganicoKeys } from '../lib/rh-organico-access.js';
import { canViewOrganicoCommentClassification } from '../lib/rh-permissions.js';
import type { RhGroupPermissions } from '../lib/rh-permissions.js';
import { RH_ORGANICO_COMMENT_VISIBILITY_OPTIONS } from '../lib/rh-organico-comment-tags.js';
import { formatIsoDate, parseValuesJson, s } from '../utils/rhHelpers.js';
import { mapOrganicoFotoRow, normalizeOrganicoFotoPayload } from '../utils/organicoFotoBase64.js';

export async function getOrganicoList(isMaster: boolean, permissions: RhGroupPermissions | null) {
  const rows = await prisma.rhOrganico.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, valuesJson: true, setor: true },
  });

  return rows
    .map((r) => ({
      id: r.id,
      values: parseValuesJson(r.valuesJson),
    }))
    .filter((row) => isMaster || (permissions != null && hasSectorAccess(permissions, row.values[14] ?? '')));
}

function mapComentarioRow(row: {
  id: string;
  colaboradorNome: string;
  colaboradorMatricula: string | null;
  comentario: string;
  tipo: string;
  categoria: string;
  tagCodigo: string;
  visibilidade: string;
  campoAlterado: string | null;
  valorAnterior: string | null;
  valorAtual: string | null;
  criadoPor: string;
  createdAt: Date;
}) {
  return {
    id: row.id,
    colaboradorNome: row.colaboradorNome,
    colaboradorMatricula: row.colaboradorMatricula,
    comentario: row.comentario,
    tipo: row.tipo,
    categoria: row.categoria,
    tagCode: row.tagCodigo,
    visibility: row.visibilidade,
    campoAlterado: row.campoAlterado,
    valorAnterior: row.valorAnterior,
    valorAtual: row.valorAtual,
    createdBy: row.criadoPor,
    createdAt: row.createdAt.toISOString(),
  };
}

function normalizeKey(nome: string, matricula: string | null) {
  const mat = s(matricula);
  if (mat) return `mat:${mat}`;
  return `nome:${nome.trim().toLocaleUpperCase('pt-BR')}`;
}

export async function getOrganicoComentarios(input: {
  isMaster: boolean;
  permissions: RhGroupPermissions | null;
  nome?: string;
  matricula?: string;
  summary?: boolean;
}) {
  const allowedKeys =
    input.isMaster || !input.permissions
      ? null
      : await buildAllowedOrganicoKeys(false, input.permissions);

  const rows = await prisma.rhOrganicoComentarios.findMany({
    orderBy: { createdAt: 'desc' },
  });

  const filtered = rows.filter((row) => {
    if (allowedKeys) {
      const mat = s(row.colaboradorMatricula);
      const nome = s(row.colaboradorNome);
      const sectorOk =
        (mat && allowedKeys.matriculas.has(mat)) || (nome && allowedKeys.nomes.has(nome));
      if (!sectorOk) return false;
    }
    if (input.permissions && !canViewOrganicoCommentClassification(input.permissions, row.tagCodigo, row.visibilidade)) {
      return false;
    }
    if (input.summary) return true;
    if (input.matricula) return row.colaboradorMatricula === input.matricula;
    if (input.nome) return row.colaboradorNome === input.nome;
    return true;
  });

  if (input.summary) {
    const map = new Map<string, { colaboradorNome: string; colaboradorMatricula: string | null; total: number }>();
    for (const row of filtered) {
      const key = normalizeKey(row.colaboradorNome, row.colaboradorMatricula);
      const current = map.get(key);
      if (current) current.total += 1;
      else map.set(key, { colaboradorNome: row.colaboradorNome, colaboradorMatricula: row.colaboradorMatricula, total: 1 });
    }
    return Array.from(map.values());
  }

  return filtered.map(mapComentarioRow);
}

export async function addOrganicoComentario(input: {
  colaboradorNome: string;
  colaboradorMatricula: string | null;
  createdBy: string;
  entries: Array<{
    comentario: string;
    tipo: string;
    categoria: string;
    tagCode: string;
    visibility: string;
    campoAlterado?: string | null;
    valorAnterior?: string | null;
    valorAtual?: string | null;
  }>;
}) {
  const allowedTypes = new Set(['comentario', 'log_alteracao']);
  const allowedCategories = new Set([
    'geral',
    'cargo_trabalho',
    'beneficios',
    'remuneracao',
    'dados_bancarios',
    'contrato',
  ]);
  const allowedVisibilities = new Set(RH_ORGANICO_COMMENT_VISIBILITY_OPTIONS.map((item) => item.id));

  const data = input.entries.map((entry) => {
    if (!s(entry.comentario)) throw new Error('Comentário é obrigatório.');
    if (!allowedTypes.has(entry.tipo)) throw new Error('Tipo de atividade inválido.');
    if (!allowedCategories.has(entry.categoria)) throw new Error('Categoria de atividade inválida.');
    if (!allowedVisibilities.has(entry.visibility as (typeof RH_ORGANICO_COMMENT_VISIBILITY_OPTIONS)[number]['id'])) {
      throw new Error('Visibilidade de comentário inválida.');
    }
    return {
      colaboradorNome: input.colaboradorNome,
      colaboradorMatricula: input.colaboradorMatricula,
      comentario: entry.comentario,
      criadoPor: input.createdBy,
      tipo: entry.tipo,
      categoria: entry.categoria,
      tagCodigo: entry.tagCode,
      visibilidade: entry.visibility,
      campoAlterado: s(entry.campoAlterado) || null,
      valorAnterior: s(entry.valorAnterior) || null,
      valorAtual: s(entry.valorAtual) || null,
    };
  });

  const created = [];
  for (const item of data) {
    created.push(await prisma.rhOrganicoComentarios.create({ data: item }));
  }
  return created.map(mapComentarioRow);
}

export async function deleteOrganicoComentario(id: string) {
  await prisma.rhOrganicoComentarios.delete({ where: { id } });
}

function matriculaLookupVariants(matricula: string): string[] {
  const trimmed = s(matricula);
  if (!trimmed) return [];
  const variants = new Set<string>([trimmed]);
  const withoutLeadingZeros = trimmed.replace(/^0+/, '');
  if (withoutLeadingZeros) variants.add(withoutLeadingZeros);
  if (/^\d+$/.test(trimmed)) variants.add(trimmed.padStart(4, '0'));
  return [...variants];
}

async function findOrganicoFotoRow(input: { matricula?: string; nome?: string }) {
  const matricula = s(input.matricula);
  const nome = s(input.nome);
  if (matricula) {
    for (const variant of matriculaLookupVariants(matricula)) {
      const row = await prisma.rhOrganicoFotos.findUnique({ where: { colaboradorMatricula: variant } });
      if (row) return row;
    }
  }
  if (nome) {
    return prisma.rhOrganicoFotos.findFirst({ where: { colaboradorNome: nome } });
  }
  return null;
}

export async function listOrganicoFotosResumo(input: {
  isMaster: boolean;
  permissions: RhGroupPermissions | null;
}) {
  const allowedKeys =
    input.isMaster || !input.permissions
      ? null
      : await buildAllowedOrganicoKeys(false, input.permissions);

  const rows = await prisma.rhOrganicoFotos.findMany({
    select: { colaboradorMatricula: true, colaboradorNome: true },
    orderBy: { colaboradorMatricula: 'asc' },
  });

  return rows
    .filter((row) => {
      if (!allowedKeys) return true;
      const matricula = s(row.colaboradorMatricula);
      const nome = s(row.colaboradorNome);
      return (
        (matricula && allowedKeys.matriculas.has(matricula)) ||
        (nome && allowedKeys.nomes.has(nome))
      );
    })
    .map((row) => ({
      colaboradorMatricula: row.colaboradorMatricula,
      colaboradorNome: row.colaboradorNome,
    }));
}

export async function getOrganicoFoto(input: { matricula?: string; nome?: string }) {
  const row = await findOrganicoFotoRow(input);
  if (!row) return null;
  return mapOrganicoFotoRow(row);
}

export async function setOrganicoFoto(input: {
  matricula: string;
  nome: string;
  fotoBase64: string;
  mimeType?: string | null;
  updatedBy: string;
}) {
  const normalized = normalizeOrganicoFotoPayload(input.fotoBase64, input.mimeType);
  const row = await prisma.rhOrganicoFotos.upsert({
    where: { colaboradorMatricula: input.matricula },
    create: {
      colaboradorMatricula: input.matricula,
      colaboradorNome: input.nome,
      fotoBase64: normalized.payload,
      mimeType: normalized.mimeType ?? input.mimeType ?? null,
      updatedBy: input.updatedBy,
    },
    update: {
      colaboradorNome: input.nome,
      fotoBase64: normalized.payload,
      mimeType: normalized.mimeType ?? input.mimeType ?? null,
      updatedBy: input.updatedBy,
    },
  });
  return {
    colaboradorMatricula: row.colaboradorMatricula,
    colaboradorNome: row.colaboradorNome,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function deleteOrganicoFoto(matricula: string) {
  await prisma.rhOrganicoFotos.deleteMany({ where: { colaboradorMatricula: matricula } });
}

export async function getOrganicoTrajetoria(matricula: string) {
  const rows = await prisma.rhOrganicoTrajetoria.findMany({
    where: { colaboradorMatricula: matricula },
    orderBy: [{ dataEvento: 'desc' }, { createdAt: 'desc' }],
  });
  return rows.map((r) => ({
    id: r.id,
    colaboradorMatricula: r.colaboradorMatricula,
    colaboradorNome: r.colaboradorNome,
    dataEvento: formatIsoDate(r.dataEvento),
    tipoEvento: r.tipoEvento,
    titulo: r.titulo,
    descricao: r.descricao,
    motivo: r.motivo,
    origemArquivo: r.origemArquivo,
    importadoPor: r.importadoPor,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function importOrganicoTrajetoria(
  rows: Array<{
    colaboradorMatricula: string;
    colaboradorNome?: string;
    dataEvento: string;
    tipoEvento: string;
    titulo: string;
    descricao: string;
    motivo?: string | null;
    origemArquivo?: string | null;
    importadoPor?: string | null;
  }>,
) {
  const data = rows
    .map((r) => {
      const dataEvento = new Date(r.dataEvento);
      if (isNaN(dataEvento.getTime())) return null;
      return {
        colaboradorMatricula: s(r.colaboradorMatricula),
        colaboradorNome: s(r.colaboradorNome),
        dataEvento,
        tipoEvento: s(r.tipoEvento),
        titulo: s(r.titulo),
        descricao: s(r.descricao),
        motivo: s(r.motivo) || null,
        origemArquivo: s(r.origemArquivo) || null,
        importadoPor: s(r.importadoPor) || null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r != null && !!r.colaboradorMatricula);

  if (data.length === 0) return { inserted: 0 };
  await prisma.rhOrganicoTrajetoria.createMany({ data });
  return { inserted: data.length };
}

export async function deleteOrganicoTrajetoria(id: string) {
  await prisma.rhOrganicoTrajetoria.delete({ where: { id } });
}

export async function getOrganicoAlteracoesPendentes(setor?: string) {
  const rows = await prisma.rhOrganicoAlteracaoPendente.findMany({
    where: {
      resolvedAt: null,
      ...(setor ? { setor } : {}),
    },
    orderBy: { detectedAt: 'desc' },
  });
  return rows.map((r) => ({
    id: r.id,
    colaboradorMatricula: r.colaboradorMatricula,
    colaboradorNome: r.colaboradorNome,
    setor: r.setor,
    tipo: r.tipo,
    campoLabel: r.campoLabel,
    valorAnterior: r.valorAnterior,
    valorAtual: r.valorAtual,
    motivo: r.motivo,
    detectedAt: r.detectedAt.toISOString(),
    dataReferencia: r.dataReferencia ? formatIsoDate(r.dataReferencia) : null,
    organicoTrajetoriaId: r.organicoTrajetoriaId,
  }));
}

export async function upsertOrganicoAlteracoesPendentes(
  items: Array<{
    id?: string;
    colaboradorMatricula: string;
    colaboradorNome?: string;
    setor?: string;
    tipo: string;
    campoLabel?: string;
    valorAnterior?: string;
    valorAtual?: string;
    motivo?: string | null;
    dataReferencia?: string | null;
    organicoTrajetoriaId?: string | null;
  }>,
) {
  const results = [];
  for (const item of items) {
    const data = {
      colaboradorMatricula: s(item.colaboradorMatricula),
      colaboradorNome: s(item.colaboradorNome),
      setor: s(item.setor),
      tipo: s(item.tipo),
      campoLabel: s(item.campoLabel),
      valorAnterior: s(item.valorAnterior),
      valorAtual: s(item.valorAtual),
      motivo: s(item.motivo) || null,
      dataReferencia: item.dataReferencia ? new Date(item.dataReferencia) : null,
      organicoTrajetoriaId: s(item.organicoTrajetoriaId) || null,
    };
    if (item.id) {
      results.push(
        await prisma.rhOrganicoAlteracaoPendente.update({
          where: { id: item.id },
          data,
        }),
      );
    } else {
      results.push(await prisma.rhOrganicoAlteracaoPendente.create({ data }));
    }
  }
  return results.length;
}

export async function resolveOrganicoAlteracaoPendente(id: string, resolvedBy: string) {
  await prisma.rhOrganicoAlteracaoPendente.update({
    where: { id },
    data: { resolvedAt: new Date(), resolvedBy },
  });
}

export async function deleteOrganicoAlteracaoPendente(id: string) {
  await prisma.rhOrganicoAlteracaoPendente.delete({ where: { id } });
}

export async function getOrganicoRepresentantes() {
  const rows = await prisma.rhOrganicoRepresentantes.findMany({ orderBy: { nomeRazaoSocial: 'asc' } });
  return rows.map((r) => ({
    representanteKey: r.representanteKey,
    nomeRazaoSocial: r.nomeRazaoSocial,
    nomeFantasia: r.nomeFantasia,
    fotoBase64: r.fotoBase64,
    fotoMimeType: r.fotoMimeType,
    cpf: r.cpf,
    admissao: r.admissao,
    tempoEmpresa: r.tempoEmpresa,
    cargo: r.cargo,
    area: r.area,
    setor: r.setor,
    nascimento: r.nascimento,
    idade: r.idade,
    grauInstrucao: r.grauInstrucao,
    vinculo: r.vinculo,
    telefone: r.telefone,
    telefoneEmergencial: r.telefoneEmergencial,
    agencia: r.agencia,
    conta: r.conta,
    banco: r.banco,
    chavePix: r.chavePix,
    casoNaoTenhaPix: r.casoNaoTenhaPix,
    updatedBy: r.updatedBy,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function syncOrganicoRepresentantes(
  rows: Array<{ representanteKey: string; nomeRazaoSocial?: string; [key: string]: unknown }>,
) {
  let upserted = 0;
  for (const row of rows) {
    const key = s(row.representanteKey);
    if (!key) continue;
    const nomeRazaoSocial = s(row.nomeRazaoSocial) || key;
    const nomeFantasia = s(row.nomeFantasia) || null;
    await prisma.rhOrganicoRepresentantes.upsert({
      where: { representanteKey: key },
      create: {
        representanteKey: key,
        nomeRazaoSocial,
        nomeFantasia,
        cpf: s(row.cpf) || null,
        cargo: s(row.cargo) || null,
        area: s(row.area) || null,
        setor: s(row.setor) || null,
      },
      // Sync apenas registra a existência do representante e atualiza os nomes.
      // NÃO sobrescreve os campos editados manualmente (cpf, cargo, dados bancários, etc.),
      // que são gravados via setOrganicoRepresentante.
      update: {
        nomeRazaoSocial,
        ...(nomeFantasia ? { nomeFantasia } : {}),
      },
    });
    upserted += 1;
  }
  return { upserted };
}

export async function setOrganicoRepresentante(input: Record<string, unknown>) {
  const key = s(input.representanteKey);
  if (!key) throw new Error('representanteKey obrigatório.');
  const row = await prisma.rhOrganicoRepresentantes.upsert({
    where: { representanteKey: key },
    create: {
      representanteKey: key,
      nomeRazaoSocial: s(input.nomeRazaoSocial) || key,
      nomeFantasia: s(input.nomeFantasia) || null,
      fotoBase64: s(input.fotoBase64) || null,
      fotoMimeType: s(input.fotoMimeType) || null,
      cpf: s(input.cpf) || null,
      admissao: s(input.admissao) || null,
      tempoEmpresa: s(input.tempoEmpresa) || null,
      cargo: s(input.cargo) || null,
      area: s(input.area) || null,
      setor: s(input.setor) || null,
      nascimento: s(input.nascimento) || null,
      idade: s(input.idade) || null,
      grauInstrucao: s(input.grauInstrucao) || null,
      vinculo: s(input.vinculo) || null,
      telefone: s(input.telefone) || null,
      telefoneEmergencial: s(input.telefoneEmergencial) || null,
      agencia: s(input.agencia) || null,
      conta: s(input.conta) || null,
      banco: s(input.banco) || null,
      chavePix: s(input.chavePix) || null,
      casoNaoTenhaPix: s(input.casoNaoTenhaPix) || null,
      updatedBy: s(input.updatedBy) || null,
    },
    update: {
      nomeRazaoSocial: s(input.nomeRazaoSocial) || key,
      nomeFantasia: s(input.nomeFantasia) || null,
      fotoBase64: s(input.fotoBase64) || null,
      fotoMimeType: s(input.fotoMimeType) || null,
      cpf: s(input.cpf) || null,
      admissao: s(input.admissao) || null,
      tempoEmpresa: s(input.tempoEmpresa) || null,
      cargo: s(input.cargo) || null,
      area: s(input.area) || null,
      setor: s(input.setor) || null,
      nascimento: s(input.nascimento) || null,
      idade: s(input.idade) || null,
      grauInstrucao: s(input.grauInstrucao) || null,
      vinculo: s(input.vinculo) || null,
      telefone: s(input.telefone) || null,
      telefoneEmergencial: s(input.telefoneEmergencial) || null,
      agencia: s(input.agencia) || null,
      conta: s(input.conta) || null,
      banco: s(input.banco) || null,
      chavePix: s(input.chavePix) || null,
      casoNaoTenhaPix: s(input.casoNaoTenhaPix) || null,
      updatedBy: s(input.updatedBy) || null,
    },
  });
  return { representanteKey: row.representanteKey };
}

export async function createOrganicoArchiveFolder(input: {
  matricula?: string;
  parentGlobalId?: string | null;
  parentLocalId?: string | null;
  name: string;
  createdBy: string;
}) {
  const name = s(input.name);
  if (!name) throw new Error('Nome da pasta é obrigatório.');

  if (input.matricula) {
    const row = await prisma.rhOrganicoArchiveFolderLocal.create({
      data: {
        matricula: input.matricula,
        parentGlobalId: s(input.parentGlobalId) || null,
        parentLocalId: s(input.parentLocalId) || null,
        name,
        createdBy: input.createdBy,
      },
    });
    return { id: row.id, scope: 'local' as const };
  }

  const row = await prisma.rhOrganicoArchiveFolderGlobal.create({
    data: {
      parentId: s(input.parentGlobalId) || null,
      name,
      createdBy: input.createdBy,
    },
  });
  return { id: row.id, scope: 'global' as const };
}

export async function renameOrganicoArchiveFolder(input: {
  scope: 'global' | 'local';
  id: string;
  name: string;
}) {
  const name = s(input.name);
  if (!name) throw new Error('Nome da pasta é obrigatório.');
  if (input.scope === 'local') {
    await prisma.rhOrganicoArchiveFolderLocal.update({ where: { id: input.id }, data: { name } });
  } else {
    await prisma.rhOrganicoArchiveFolderGlobal.update({ where: { id: input.id }, data: { name } });
  }
}

export async function hideOrganicoArchiveFolder(matricula: string, globalFolderId: string, hiddenBy: string) {
  await prisma.rhOrganicoArchiveFolderHidden.upsert({
    where: { matricula_globalFolderId: { matricula, globalFolderId } },
    create: { matricula, globalFolderId, hiddenBy },
    update: { hiddenAt: new Date(), hiddenBy },
  });
}
