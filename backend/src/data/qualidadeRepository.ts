import { prisma } from '../config/prisma.js';
import { PERMISSOES } from '../config/permissoes.js';
import { getPermissoesUsuario } from '../middleware/requirePermission.js';
import {
  notificarNovasTarefasWorkflow,
  type DocumentoMetaParaEmail,
  type NovaTarefaWorkflowInput,
} from '../services/sgq/sgqEmailNotificacaoService.js';
import {
  deleteQualidadeAnexoIfExists,
  readQualidadeAnexoAsDataUrl,
  saveQualidadeAnexo,
  type IncomingQualidadeAnexo,
} from '../utils/qualidadeUpload.js';

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function iso(d: Date) {
  return d.toISOString();
}

// ─── Seed catálogos ───────────────────────────────────────────────────────────

const SEED_SETORES = [
  { sigla: 'PROD', nome: 'Produção' },
  { sigla: 'QUAL', nome: 'Qualidade' },
  { sigla: 'MAN', nome: 'Manutenção' },
  { sigla: 'LAB', nome: 'Laboratório' },
];

const SEED_TIPOS = [
  { sigla: 'PO', nome: 'Procedimento Operacional' },
  { sigla: 'IT', nome: 'Instrução de Trabalho' },
  { sigla: 'FO', nome: 'Formulário' },
  { sigla: 'MAN', nome: 'Manual' },
  { sigla: 'RE', nome: 'Registro' },
];

export async function ensureSgqCatalogosSeed() {
  const setorCount = await prisma.sgqSetor.count();
  if (setorCount === 0) {
    await prisma.sgqSetor.createMany({
      data: SEED_SETORES.map((s) => ({ sigla: s.sigla, nome: s.nome, ativo: true })),
    });
  }
  const tipoCount = await prisma.sgqTipoDocumento.count();
  if (tipoCount === 0) {
    await prisma.sgqTipoDocumento.createMany({
      data: SEED_TIPOS.map((t) => ({ sigla: t.sigla, nome: t.nome, ativo: true })),
    });
  }
}

// ─── Mappers DB → frontend ───────────────────────────────────────────────────

function mapSetor(row: { uid: string; nome: string; sigla: string; ativo: boolean }) {
  return { id: row.uid, nome: row.nome, sigla: row.sigla, ativo: row.ativo };
}

function mapTipo(row: { uid: string; nome: string; sigla: string; ativo: boolean }) {
  return { id: row.uid, nome: row.nome, sigla: row.sigla, ativo: row.ativo };
}

function mapDocumento(row: {
  uid: string;
  codigo: string;
  titulo: string;
  tipoUid: string;
  setorUid: string;
  status: string;
  versaoAtual: string;
  origem: string;
  localizacao: string | null;
  permissoesJson: string | null;
  publicacaoJson: string | null;
  validadeJson: string | null;
  externoRegistroJson: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.uid,
    codigo: row.codigo,
    titulo: row.titulo,
    tipoId: row.tipoUid,
    setorId: row.setorUid,
    status: row.status,
    versaoAtual: row.versaoAtual,
    origem: row.origem,
    localizacao: row.localizacao ?? undefined,
    permissoes: parseJson(row.permissoesJson, undefined),
    publicacao: parseJson(row.publicacaoJson, undefined),
    validade: parseJson(row.validadeJson, undefined),
    externoRegistro: parseJson(row.externoRegistroJson, undefined),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function mapVersao(
  row: {
    uid: string;
    documento: { uid: string };
    versao: string;
    elaboradorLogin: string | null;
    consensoLogin: string | null;
    revisorLogin: string | null;
    aprovadorLogin: string | null;
    prazosJson: string | null;
    dataElaboracao: string | null;
    dataRevisao: string | null;
    dataAprovacao: string | null;
    observacoes: string | null;
    justificativaRevisao: string | null;
    alteracoesRevisao: string | null;
    observacoesElaboracao: string | null;
    observacoesConsenso: string | null;
    observacoesAprovacao: string | null;
    movimentacoesJson: string | null;
    requerSubstituicaoConsenso: boolean;
    arquivoNome: string | null;
    arquivoStoragePath: string | null;
    arquivoMimeType: string | null;
    arquivoAtualizadoEm: string | null;
  },
  includeDataUrl: boolean
) {
  const dataUrl =
    includeDataUrl && row.arquivoStoragePath
      ? readQualidadeAnexoAsDataUrl(row.arquivoStoragePath)
      : undefined;
  return {
    id: row.uid,
    documentId: row.documento.uid,
    versao: row.versao,
    elaboradorId: row.elaboradorLogin ?? '',
    consensoId: row.consensoLogin ?? undefined,
    revisorId: row.revisorLogin ?? undefined,
    aprovadorId: row.aprovadorLogin ?? undefined,
    prazos: parseJson(row.prazosJson, undefined),
    dataElaboracao: row.dataElaboracao ?? '',
    dataRevisao: row.dataRevisao ?? undefined,
    dataAprovacao: row.dataAprovacao ?? undefined,
    observacoes: row.observacoes ?? undefined,
    justificativaRevisao: row.justificativaRevisao ?? undefined,
    alteracoesRevisao: row.alteracoesRevisao ?? undefined,
    observacoesElaboracao: row.observacoesElaboracao ?? undefined,
    observacoesConsenso: row.observacoesConsenso ?? undefined,
    observacoesAprovacao: row.observacoesAprovacao ?? undefined,
    movimentacoes: parseJson(row.movimentacoesJson, undefined),
    requerSubstituicaoConsenso: row.requerSubstituicaoConsenso,
    arquivoNome: row.arquivoNome ?? undefined,
    arquivoDataUrl: dataUrl ?? undefined,
    arquivoAtualizadoEm: row.arquivoAtualizadoEm ?? undefined,
  };
}

function mapRegistro(row: {
  uid: string;
  tipo: string;
  numero: string;
  status: string;
  codigoDocumento: string | null;
  responsavelLogin: string | null;
  origemImport: boolean;
  dadosJson: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  const dados = parseJson<Record<string, unknown>>(row.dadosJson, {});
  return {
    id: row.uid,
    tipo: row.tipo,
    numero: row.numero,
    status: row.status,
    codigoDocumento: row.codigoDocumento ?? '',
    origemNomus: row.origemImport,
    responsavelId: row.responsavelLogin ?? '',
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    ...(row.tipo === 'rnc' ? { rnc: dados } : { rcc: dados }),
  };
}

function mapEquipamento(row: {
  uid: string;
  codigo: string;
  descricao: string;
  local: string;
  setorUid: string;
  responsavelLogin: string;
  fornecedor: string | null;
  tipoCalibracao: string;
  frequenciaCalibracaoDias: number;
  frequenciaVerificacaoDias: number;
  ultimaCalibracao: string | null;
  ultimaVerificacao: string | null;
  proximaCalibracao: string | null;
  laudoNome: string | null;
  laudoStoragePath: string | null;
  versaoLaudoAtual: string | null;
  anexosJson: string | null;
  ativo: boolean;
}) {
  const anexos = parseJson<Array<{ nome: string; dataUrl?: string; storagePath?: string }>>(
    row.anexosJson,
    []
  );
  return {
    id: row.uid,
    codigo: row.codigo,
    descricao: row.descricao,
    local: row.local,
    setorId: row.setorUid,
    responsavelId: row.responsavelLogin,
    fornecedor: row.fornecedor ?? undefined,
    tipoCalibracao: row.tipoCalibracao,
    frequenciaCalibracaoDias: row.frequenciaCalibracaoDias,
    frequenciaVerificacaoDias: row.frequenciaVerificacaoDias,
    ultimaCalibracao: row.ultimaCalibracao ?? undefined,
    ultimaVerificacao: row.ultimaVerificacao ?? undefined,
    proximaCalibracao: row.proximaCalibracao ?? undefined,
    laudoNome: row.laudoNome ?? undefined,
    laudoDataUrl: row.laudoStoragePath
      ? readQualidadeAnexoAsDataUrl(row.laudoStoragePath) ?? undefined
      : undefined,
    laudoAnexos: anexos.map((a) => ({
      nome: a.nome,
      dataUrl: a.storagePath ? readQualidadeAnexoAsDataUrl(a.storagePath) ?? '' : a.dataUrl ?? '',
    })),
    versaoLaudoAtual: row.versaoLaudoAtual ?? undefined,
    ativo: row.ativo,
  };
}

function mapCalibracao(row: {
  uid: string;
  equipamento: { uid: string };
  versao: string;
  data: string;
  tipo: string;
  resultado: string;
  responsavelLogin: string;
  laboratorio: string | null;
  laudoNome: string | null;
  laudoStoragePath: string | null;
  anexosJson: string | null;
  observacoes: string | null;
}) {
  const anexos = parseJson<Array<{ nome: string; storagePath?: string; dataUrl?: string }>>(
    row.anexosJson,
    []
  );
  return {
    id: row.uid,
    equipmentId: row.equipamento.uid,
    versao: row.versao,
    data: row.data,
    tipo: row.tipo,
    resultado: row.resultado,
    responsavelId: row.responsavelLogin,
    laboratorio: row.laboratorio ?? undefined,
    laudoNome: row.laudoNome ?? undefined,
    laudoDataUrl: row.laudoStoragePath
      ? readQualidadeAnexoAsDataUrl(row.laudoStoragePath) ?? undefined
      : undefined,
    anexos: anexos.map((a) => ({
      nome: a.nome,
      dataUrl: a.storagePath ? readQualidadeAnexoAsDataUrl(a.storagePath) ?? '' : a.dataUrl ?? '',
    })),
    observacoes: row.observacoes ?? undefined,
  };
}

function mapVerificacao(row: {
  uid: string;
  equipamento: { uid: string };
  data: string;
  resultado: string;
  responsavelLogin: string;
  observacoes: string | null;
}) {
  return {
    id: row.uid,
    equipmentId: row.equipamento.uid,
    data: row.data,
    resultado: row.resultado,
    responsavelId: row.responsavelLogin,
    observacoes: row.observacoes ?? undefined,
  };
}

function mapAvaliacao(row: {
  uid: string;
  fornecedorId: string;
  fornecedorNome: string;
  avaliadorLogin: string;
  dataReferencia: string | null;
  dataAvaliacao: string | null;
  numeroDocumento: string | null;
  fornecedorAprovado: boolean | null;
  rncNumero: string | null;
  notasJson: string;
  media: number;
  observacoes: string | null;
  origemImport: boolean;
}) {
  return {
    id: row.uid,
    fornecedorId: row.fornecedorId,
    fornecedorNome: row.fornecedorNome,
    avaliadorId: row.avaliadorLogin,
    dataReferencia: row.dataReferencia ?? undefined,
    dataAvaliacao: row.dataAvaliacao ?? undefined,
    numeroDocumento: row.numeroDocumento ?? undefined,
    fornecedorAprovado: row.fornecedorAprovado ?? undefined,
    rncNumero: row.rncNumero ?? undefined,
    notas: parseJson(row.notasJson, {}),
    media: row.media,
    observacoes: row.observacoes ?? undefined,
    origemImport: row.origemImport,
  };
}

function mapTarefa(row: {
  uid: string;
  tipo: string;
  referenciaTipo: string;
  referenciaId: string;
  titulo: string;
  descricao: string | null;
  responsavelLogin: string;
  prazo: string | null;
  concluida: boolean;
  metadadosJson: string | null;
}) {
  const meta = parseJson<Record<string, unknown>>(row.metadadosJson, {});
  return {
    id: row.uid,
    tipo: row.tipo,
    referenciaTipo: row.referenciaTipo,
    referenciaId: row.referenciaId,
    titulo: row.titulo,
    descricao: row.descricao ?? undefined,
    responsavelId: row.responsavelLogin,
    prazo: row.prazo ?? undefined,
    concluida: row.concluida,
    ...meta,
  };
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

export async function getQualidadeBootstrap() {
  await ensureSgqCatalogosSeed();

  const [
    setores,
    tipos,
    documentos,
    versoes,
    revalidacoes,
    alertas,
    registros,
    equipamentos,
    calibracoes,
    verificacoes,
    avaliacoes,
    tarefas,
    opcoes,
  ] = await Promise.all([
    prisma.sgqSetor.findMany({ orderBy: { nome: 'asc' } }),
    prisma.sgqTipoDocumento.findMany({ orderBy: { sigla: 'asc' } }),
    prisma.sgqDocumento.findMany({ orderBy: { codigo: 'asc' } }),
    prisma.sgqDocumentoVersao.findMany({ include: { documento: true } }),
    prisma.sgqDocumentoRevalidacao.findMany({ include: { documento: true } }),
    prisma.sgqDocumentoAlerta.findMany({ include: { documento: true } }),
    prisma.sgqRegistro.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.sgqEquipamento.findMany({ orderBy: { codigo: 'asc' } }),
    prisma.sgqCalibracao.findMany({ include: { equipamento: true } }),
    prisma.sgqVerificacao.findMany({ include: { equipamento: true } }),
    prisma.sgqAvaliacaoFornecedor.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.sgqTarefa.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.sgqOpcaoLista.findMany({ where: { ativo: true }, orderBy: [{ chave: 'asc' }, { sortOrder: 'asc' }] }),
  ]);

  const opcoesPorChave: Record<string, string[]> = {};
  for (const o of opcoes) {
    if (!opcoesPorChave[o.chave]) opcoesPorChave[o.chave] = [];
    opcoesPorChave[o.chave].push(o.valor);
  }

  return {
    departments: setores.map(mapSetor),
    documentTypes: tipos.map(mapTipo),
    documents: documentos.map(mapDocumento),
    versions: versoes.map((v) => mapVersao(v, true)),
    revalidacoes: revalidacoes.map((r) => ({
      id: r.uid,
      documentId: r.documento.uid,
      data: r.data,
      observacoes: r.observacoes,
      evidenciaNome: r.evidenciaNome ?? undefined,
      evidenciaDataUrl: r.evidenciaStoragePath
        ? readQualidadeAnexoAsDataUrl(r.evidenciaStoragePath) ?? undefined
        : undefined,
      novaDataValidade: r.novaDataValidade,
      usuarioId: r.usuarioLogin,
    })),
    validadeAlertas: alertas.map((a) => ({
      id: a.uid,
      documentId: a.documento.uid,
      marcoDias: a.marcoDias,
      severidade: a.severidade,
      mensagem: a.mensagem,
      lida: a.lida,
      createdAt: iso(a.createdAt),
    })),
    registros: registros.map(mapRegistro),
    equipment: equipamentos.map(mapEquipamento),
    calibrationRecords: calibracoes.map(mapCalibracao),
    verificationRecords: verificacoes.map(mapVerificacao),
    avaliacoes: avaliacoes.map(mapAvaliacao),
    tasks: tarefas.filter((t) => !t.concluida).map(mapTarefa),
    opcoesLista: opcoesPorChave,
  };
}

// ─── Sync helpers ────────────────────────────────────────────────────────────

async function purgeSgqDocumentsRemovedFromPayload(
  payloadDocumentUids: string[],
  payloadVersionUids: string[],
  payloadAlertaUids: string[],
  payloadRevalidacaoUids: string[]
): Promise<void> {
  const docUids = [...new Set(payloadDocumentUids.filter(Boolean))];
  const versionUids = [...new Set(payloadVersionUids.filter(Boolean))];
  const alertaUids = [...new Set(payloadAlertaUids.filter(Boolean))];
  const revalidacaoUids = [...new Set(payloadRevalidacaoUids.filter(Boolean))];

  if (docUids.length > 0 && versionUids.length > 0) {
    const orphanVersoes = await prisma.sgqDocumentoVersao.findMany({
      where: {
        documento: { uid: { in: docUids } },
        uid: { notIn: versionUids },
      },
      select: { uid: true, arquivoStoragePath: true },
    });
    for (const v of orphanVersoes) {
      deleteQualidadeAnexoIfExists(v.arquivoStoragePath);
    }
    if (orphanVersoes.length > 0) {
      await prisma.sgqDocumentoVersao.deleteMany({
        where: { uid: { in: orphanVersoes.map((v) => v.uid) } },
      });
    }
  }

  if (docUids.length > 0 && alertaUids.length > 0) {
    await prisma.sgqDocumentoAlerta.deleteMany({
      where: {
        documento: { uid: { in: docUids } },
        uid: { notIn: alertaUids },
      },
    });
  }

  if (docUids.length > 0 && revalidacaoUids.length > 0) {
    const orphanRevs = await prisma.sgqDocumentoRevalidacao.findMany({
      where: {
        documento: { uid: { in: docUids } },
        uid: { notIn: revalidacaoUids },
      },
      select: { uid: true, evidenciaStoragePath: true },
    });
    for (const r of orphanRevs) {
      deleteQualidadeAnexoIfExists(r.evidenciaStoragePath);
    }
    if (orphanRevs.length > 0) {
      await prisma.sgqDocumentoRevalidacao.deleteMany({
        where: { uid: { in: orphanRevs.map((r) => r.uid) } },
      });
    }
  }

  const removedDocs = await prisma.sgqDocumento.findMany({
    where: docUids.length > 0 ? { uid: { notIn: docUids } } : {},
    select: {
      uid: true,
      versoes: { select: { arquivoStoragePath: true } },
      revalidacoes: { select: { evidenciaStoragePath: true } },
    },
  });

  if (removedDocs.length === 0) return;

  const removedUids = removedDocs.map((d) => d.uid);
  for (const doc of removedDocs) {
    for (const v of doc.versoes) {
      deleteQualidadeAnexoIfExists(v.arquivoStoragePath);
    }
    for (const r of doc.revalidacoes) {
      deleteQualidadeAnexoIfExists(r.evidenciaStoragePath);
    }
  }

  await prisma.sgqTarefa.deleteMany({
    where: { referenciaTipo: 'documento', referenciaId: { in: removedUids } },
  });

  await prisma.sgqDocumento.deleteMany({
    where: { uid: { in: removedUids } },
  });
}

export async function deleteQualidadeDocumento(uid: string): Promise<boolean> {
  const doc = await prisma.sgqDocumento.findUnique({
    where: { uid },
    select: {
      uid: true,
      versoes: { select: { arquivoStoragePath: true } },
      revalidacoes: { select: { evidenciaStoragePath: true } },
    },
  });
  if (!doc) return false;

  for (const v of doc.versoes) {
    deleteQualidadeAnexoIfExists(v.arquivoStoragePath);
  }
  for (const r of doc.revalidacoes) {
    deleteQualidadeAnexoIfExists(r.evidenciaStoragePath);
  }

  await prisma.sgqTarefa.deleteMany({
    where: { referenciaTipo: 'documento', referenciaId: uid },
  });
  await prisma.sgqDocumento.delete({ where: { uid } });
  return true;
}

async function resolveSetorUid(setorId: string) {
  const byUid = await prisma.sgqSetor.findUnique({ where: { uid: setorId } });
  if (byUid) return byUid.uid;
  return setorId;
}

async function resolveTipoUid(tipoId: string) {
  const byUid = await prisma.sgqTipoDocumento.findUnique({ where: { uid: tipoId } });
  if (byUid) return byUid.uid;
  return tipoId;
}

function extractBase64(dataUrl: string | undefined): IncomingQualidadeAnexo | null {
  if (!dataUrl?.startsWith('data:')) return null;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    fileName: 'anexo',
    mimeType: match[1],
    contentBase64: match[2],
  };
}

export async function syncQualidadeConfig(payload: {
  departments: Array<{ id?: string; nome: string; sigla: string }>;
  documentTypes: Array<{ id?: string; nome: string; sigla: string }>;
}) {
  await ensureSgqCatalogosSeed();

  for (const dep of payload.departments) {
    const sigla = dep.sigla.trim().toUpperCase();
    const nome = dep.nome.trim();
    if (!sigla || !nome) continue;
    if (dep.id) {
      await prisma.sgqSetor.upsert({
        where: { uid: dep.id },
        create: { uid: dep.id, sigla, nome, ativo: true },
        update: { sigla, nome },
      });
    } else {
      await prisma.sgqSetor.upsert({
        where: { sigla },
        create: { sigla, nome, ativo: true },
        update: { nome },
      });
    }
  }

  for (const tipo of payload.documentTypes) {
    const sigla = tipo.sigla.trim().toUpperCase();
    const nome = tipo.nome.trim();
    if (!sigla || !nome) continue;
    if (tipo.id) {
      await prisma.sgqTipoDocumento.upsert({
        where: { uid: tipo.id },
        create: { uid: tipo.id, sigla, nome, ativo: true },
        update: { sigla, nome },
      });
    } else {
      await prisma.sgqTipoDocumento.upsert({
        where: { sigla },
        create: { sigla, nome, ativo: true },
        update: { nome },
      });
    }
  }
}

export async function syncQualidadeRegistros(
  registros: Array<Record<string, unknown>>,
  criadoPorLogin: string
) {
  for (const reg of registros) {
    const uid = String(reg.id ?? '');
    const tipo = String(reg.tipo ?? '');
    const numero = String(reg.numero ?? '');
    if (!uid || !tipo || !numero) continue;

    const dados =
      tipo === 'rnc'
        ? (reg.rnc as Record<string, unknown>)
        : (reg.rcc as Record<string, unknown>);

    await prisma.sgqRegistro.upsert({
      where: { uid },
      create: {
        uid,
        tipo,
        numero,
        status: String(reg.status ?? 'aberto'),
        codigoDocumento: String(reg.codigoDocumento ?? ''),
        responsavelLogin: String(reg.responsavelId ?? reg.responsavelLogin ?? ''),
        origemImport: Boolean(reg.origemNomus ?? reg.origemImport),
        dadosJson: JSON.stringify(dados ?? {}),
        criadoPorLogin,
      },
      update: {
        status: String(reg.status ?? 'aberto'),
        codigoDocumento: String(reg.codigoDocumento ?? ''),
        responsavelLogin: String(reg.responsavelId ?? reg.responsavelLogin ?? ''),
        dadosJson: JSON.stringify(dados ?? {}),
      },
    });
  }
}

export async function syncQualidadeDocuments(payload: {
  documents: Array<Record<string, unknown>>;
  versions: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
  validadeAlertas: Array<Record<string, unknown>>;
  revalidacoes: Array<Record<string, unknown>>;
  criadoPorLogin: string;
}) {
  const { documents, versions, tasks, validadeAlertas, revalidacoes, criadoPorLogin } = payload;
  const docUidToId = new Map<string, number>();
  const docMetaByUid = new Map<string, DocumentoMetaParaEmail>();

  for (const doc of documents) {
    const uid = String(doc.id ?? '');
    const codigo = String(doc.codigo ?? '');
    if (!uid || !codigo) continue;

    const tipoUid = await resolveTipoUid(String(doc.tipoId ?? ''));
    const setorUid = await resolveSetorUid(String(doc.setorId ?? ''));

    const saved = await prisma.sgqDocumento.upsert({
      where: { uid },
      create: {
        uid,
        codigo,
        titulo: String(doc.titulo ?? ''),
        origem: String(doc.origem ?? 'interno'),
        status: String(doc.status ?? 'rascunho'),
        tipoUid,
        setorUid,
        versaoAtual: String(doc.versaoAtual ?? '01'),
        localizacao: doc.localizacao ? String(doc.localizacao) : null,
        permissoesJson: doc.permissoes ? JSON.stringify(doc.permissoes) : null,
        publicacaoJson: doc.publicacao ? JSON.stringify(doc.publicacao) : null,
        validadeJson: doc.validade ? JSON.stringify(doc.validade) : null,
        externoRegistroJson: doc.externoRegistro ? JSON.stringify(doc.externoRegistro) : null,
        criadoPorLogin,
      },
      update: {
        codigo,
        titulo: String(doc.titulo ?? ''),
        status: String(doc.status ?? 'rascunho'),
        tipoUid,
        setorUid,
        versaoAtual: String(doc.versaoAtual ?? '01'),
        localizacao: doc.localizacao ? String(doc.localizacao) : null,
        permissoesJson: doc.permissoes ? JSON.stringify(doc.permissoes) : null,
        publicacaoJson: doc.publicacao ? JSON.stringify(doc.publicacao) : null,
        validadeJson: doc.validade ? JSON.stringify(doc.validade) : null,
        externoRegistroJson: doc.externoRegistro ? JSON.stringify(doc.externoRegistro) : null,
      },
    });
    docUidToId.set(uid, saved.id);
    docMetaByUid.set(uid, {
      codigo,
      titulo: String(doc.titulo ?? ''),
      permissoes: (doc.permissoes as DocumentoMetaParaEmail['permissoes']) ?? null,
      publicacao: (doc.publicacao as DocumentoMetaParaEmail['publicacao']) ?? null,
    });
  }

  for (const ver of versions) {
    const uid = String(ver.id ?? '');
    const documentId = String(ver.documentId ?? '');
    const docPk = docUidToId.get(documentId);
    if (!uid || !docPk) continue;

    let arquivoStoragePath: string | null = null;
    let arquivoMimeType: string | null = null;
    const arquivoNome = ver.arquivoNome ? String(ver.arquivoNome) : null;
    const incoming = extractBase64(ver.arquivoDataUrl as string | undefined);
    if (incoming && arquivoNome) {
      incoming.fileName = arquivoNome;
      const saved = saveQualidadeAnexo(`documentos/${documentId}`, incoming);
      arquivoStoragePath = saved.storagePath;
      arquivoMimeType = saved.mimeType;
    }

    const existing = await prisma.sgqDocumentoVersao.findUnique({ where: { uid } });
    if (existing?.arquivoStoragePath && arquivoStoragePath && existing.arquivoStoragePath !== arquivoStoragePath) {
      deleteQualidadeAnexoIfExists(existing.arquivoStoragePath);
    }

    await prisma.sgqDocumentoVersao.upsert({
      where: { uid },
      create: {
        uid,
        documentoId: docPk,
        versao: String(ver.versao ?? '01'),
        elaboradorLogin: String(ver.elaboradorId ?? ''),
        consensoLogin: ver.consensoId ? String(ver.consensoId) : null,
        revisorLogin: ver.revisorId ? String(ver.revisorId) : null,
        aprovadorLogin: ver.aprovadorId ? String(ver.aprovadorId) : null,
        prazosJson: ver.prazos ? JSON.stringify(ver.prazos) : null,
        dataElaboracao: ver.dataElaboracao ? String(ver.dataElaboracao) : null,
        dataRevisao: ver.dataRevisao ? String(ver.dataRevisao) : null,
        dataAprovacao: ver.dataAprovacao ? String(ver.dataAprovacao) : null,
        observacoes: ver.observacoes ? String(ver.observacoes) : null,
        justificativaRevisao: ver.justificativaRevisao ? String(ver.justificativaRevisao) : null,
        alteracoesRevisao: ver.alteracoesRevisao ? String(ver.alteracoesRevisao) : null,
        observacoesElaboracao: ver.observacoesElaboracao ? String(ver.observacoesElaboracao) : null,
        observacoesConsenso: ver.observacoesConsenso ? String(ver.observacoesConsenso) : null,
        observacoesAprovacao: ver.observacoesAprovacao ? String(ver.observacoesAprovacao) : null,
        movimentacoesJson: ver.movimentacoes ? JSON.stringify(ver.movimentacoes) : null,
        requerSubstituicaoConsenso: Boolean(ver.requerSubstituicaoConsenso),
        arquivoNome,
        arquivoStoragePath: arquivoStoragePath ?? existing?.arquivoStoragePath ?? null,
        arquivoMimeType: arquivoMimeType ?? existing?.arquivoMimeType ?? null,
        arquivoAtualizadoEm: ver.arquivoAtualizadoEm ? String(ver.arquivoAtualizadoEm) : null,
      },
      update: {
        versao: String(ver.versao ?? '01'),
        elaboradorLogin: String(ver.elaboradorId ?? ''),
        consensoLogin: ver.consensoId ? String(ver.consensoId) : null,
        revisorLogin: ver.revisorId ? String(ver.revisorId) : null,
        aprovadorLogin: ver.aprovadorId ? String(ver.aprovadorId) : null,
        prazosJson: ver.prazos ? JSON.stringify(ver.prazos) : null,
        dataElaboracao: ver.dataElaboracao ? String(ver.dataElaboracao) : null,
        dataRevisao: ver.dataRevisao ? String(ver.dataRevisao) : null,
        dataAprovacao: ver.dataAprovacao ? String(ver.dataAprovacao) : null,
        observacoes: ver.observacoes ? String(ver.observacoes) : null,
        justificativaRevisao: ver.justificativaRevisao ? String(ver.justificativaRevisao) : null,
        alteracoesRevisao: ver.alteracoesRevisao ? String(ver.alteracoesRevisao) : null,
        observacoesElaboracao: ver.observacoesElaboracao ? String(ver.observacoesElaboracao) : null,
        observacoesConsenso: ver.observacoesConsenso ? String(ver.observacoesConsenso) : null,
        observacoesAprovacao: ver.observacoesAprovacao ? String(ver.observacoesAprovacao) : null,
        movimentacoesJson: ver.movimentacoes ? JSON.stringify(ver.movimentacoes) : null,
        requerSubstituicaoConsenso: Boolean(ver.requerSubstituicaoConsenso),
        arquivoNome,
        ...(arquivoStoragePath
          ? { arquivoStoragePath, arquivoMimeType }
          : {}),
        arquivoAtualizadoEm: ver.arquivoAtualizadoEm ? String(ver.arquivoAtualizadoEm) : null,
      },
    });
  }

  const pendingBefore = new Set(
    (
      await prisma.sgqTarefa.findMany({
        where: { concluida: false },
        select: { uid: true },
      })
    ).map((t) => t.uid)
  );

  const novasTarefas: NovaTarefaWorkflowInput[] = [];

  await prisma.sgqTarefa.deleteMany({ where: { concluida: false } });
  for (const task of tasks) {
    const uid = String(task.id ?? '');
    if (!uid) continue;

    const concluida = Boolean(task.concluida);
    if (!concluida && !pendingBefore.has(uid)) {
      novasTarefas.push({
        uid,
        tipo: String(task.tipo ?? ''),
        titulo: String(task.titulo ?? ''),
        descricao: task.descricao ? String(task.descricao) : null,
        responsavelLogin: String(task.responsavelId ?? ''),
        prazo: task.prazo ? String(task.prazo) : null,
        referenciaId: String(task.referenciaId ?? ''),
      });
    }

    await prisma.sgqTarefa.upsert({
      where: { uid },
      create: {
        uid,
        tipo: String(task.tipo ?? ''),
        referenciaTipo: String(task.referenciaTipo ?? ''),
        referenciaId: String(task.referenciaId ?? ''),
        titulo: String(task.titulo ?? ''),
        descricao: task.descricao ? String(task.descricao) : null,
        responsavelLogin: String(task.responsavelId ?? ''),
        prazo: task.prazo ? String(task.prazo) : null,
        concluida,
        metadadosJson: JSON.stringify(task),
      },
      update: {
        tipo: String(task.tipo ?? ''),
        referenciaTipo: String(task.referenciaTipo ?? ''),
        referenciaId: String(task.referenciaId ?? ''),
        titulo: String(task.titulo ?? ''),
        descricao: task.descricao ? String(task.descricao) : null,
        responsavelLogin: String(task.responsavelId ?? ''),
        prazo: task.prazo ? String(task.prazo) : null,
        concluida,
        metadadosJson: JSON.stringify(task),
      },
    });
  }

  if (novasTarefas.length > 0) {
    try {
      const enviados = await notificarNovasTarefasWorkflow(prisma, novasTarefas, docMetaByUid);
      if (enviados > 0) {
        console.info(`[sgq-email] ${enviados} notificação(ões) de tarefa nova enviada(s).`);
      }
    } catch (err) {
      console.error('[sgq-email] Erro ao notificar tarefas novas (sync continuou):', err);
    }
  }

  for (const alerta of validadeAlertas) {
    const uid = String(alerta.id ?? '');
    const documentId = String(alerta.documentId ?? '');
    const docPk = docUidToId.get(documentId);
    if (!uid || !docPk) continue;
    await prisma.sgqDocumentoAlerta.upsert({
      where: { uid },
      create: {
        uid,
        documentoId: docPk,
        marcoDias: Number(alerta.marcoDias ?? 0),
        severidade: String(alerta.severidade ?? 'info'),
        mensagem: String(alerta.mensagem ?? ''),
        lida: Boolean(alerta.lida),
      },
      update: {
        marcoDias: Number(alerta.marcoDias ?? 0),
        severidade: String(alerta.severidade ?? 'info'),
        mensagem: String(alerta.mensagem ?? ''),
        lida: Boolean(alerta.lida),
      },
    });
  }

  for (const rev of revalidacoes) {
    const uid = String(rev.id ?? '');
    const documentId = String(rev.documentId ?? '');
    const docPk = docUidToId.get(documentId);
    if (!uid || !docPk) continue;

    let evidenciaStoragePath: string | null = null;
    const evidenciaNome = rev.evidenciaNome ? String(rev.evidenciaNome) : null;
    const incoming = extractBase64(rev.evidenciaDataUrl as string | undefined);
    if (incoming && evidenciaNome) {
      incoming.fileName = evidenciaNome;
      const saved = saveQualidadeAnexo(`revalidacoes/${documentId}`, incoming);
      evidenciaStoragePath = saved.storagePath;
    }

    await prisma.sgqDocumentoRevalidacao.upsert({
      where: { uid },
      create: {
        uid,
        documentoId: docPk,
        data: String(rev.data ?? ''),
        observacoes: String(rev.observacoes ?? ''),
        evidenciaNome,
        evidenciaStoragePath,
        novaDataValidade: String(rev.novaDataValidade ?? ''),
        usuarioLogin: String(rev.usuarioId ?? criadoPorLogin),
      },
      update: {
        data: String(rev.data ?? ''),
        observacoes: String(rev.observacoes ?? ''),
        evidenciaNome,
        ...(evidenciaStoragePath ? { evidenciaStoragePath } : {}),
        novaDataValidade: String(rev.novaDataValidade ?? ''),
        usuarioLogin: String(rev.usuarioId ?? criadoPorLogin),
      },
    });
  }

  await purgeSgqDocumentsRemovedFromPayload(
    documents.map((d) => String(d.id ?? '')),
    versions.map((v) => String(v.id ?? '')),
    validadeAlertas.map((a) => String(a.id ?? '')),
    revalidacoes.map((r) => String(r.id ?? ''))
  );
}

export async function syncQualidadeCalibrations(payload: {
  equipment: Array<Record<string, unknown>>;
  calibrationRecords: Array<Record<string, unknown>>;
  verificationRecords: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
}) {
  const eqUidToId = new Map<string, number>();

  for (const eq of payload.equipment) {
    const uid = String(eq.id ?? '');
    const codigo = String(eq.codigo ?? '');
    if (!uid || !codigo) continue;

    let laudoStoragePath: string | null = null;
    const laudoNome = eq.laudoNome ? String(eq.laudoNome) : null;
    const laudoIncoming = extractBase64(eq.laudoDataUrl as string | undefined);
    if (laudoIncoming && laudoNome) {
      laudoIncoming.fileName = laudoNome;
      laudoStoragePath = saveQualidadeAnexo(`equipamentos/${uid}`, laudoIncoming).storagePath;
    }

    const setorUid = await resolveSetorUid(String(eq.setorId ?? ''));

    const saved = await prisma.sgqEquipamento.upsert({
      where: { uid },
      create: {
        uid,
        codigo,
        descricao: String(eq.descricao ?? ''),
        local: String(eq.local ?? ''),
        setorUid,
        responsavelLogin: String(eq.responsavelId ?? ''),
        fornecedor: eq.fornecedor ? String(eq.fornecedor) : null,
        tipoCalibracao: String(eq.tipoCalibracao ?? 'interna'),
        frequenciaCalibracaoDias: Number(eq.frequenciaCalibracaoDias ?? 365),
        frequenciaVerificacaoDias: Number(eq.frequenciaVerificacaoDias ?? 30),
        ultimaCalibracao: eq.ultimaCalibracao ? String(eq.ultimaCalibracao) : null,
        ultimaVerificacao: eq.ultimaVerificacao ? String(eq.ultimaVerificacao) : null,
        proximaCalibracao: eq.proximaCalibracao ? String(eq.proximaCalibracao) : null,
        laudoNome,
        laudoStoragePath,
        versaoLaudoAtual: eq.versaoLaudoAtual ? String(eq.versaoLaudoAtual) : null,
        anexosJson: eq.laudoAnexos ? JSON.stringify(eq.laudoAnexos) : null,
        ativo: eq.ativo !== false,
      },
      update: {
        codigo,
        descricao: String(eq.descricao ?? ''),
        local: String(eq.local ?? ''),
        setorUid,
        responsavelLogin: String(eq.responsavelId ?? ''),
        fornecedor: eq.fornecedor ? String(eq.fornecedor) : null,
        tipoCalibracao: String(eq.tipoCalibracao ?? 'interna'),
        frequenciaCalibracaoDias: Number(eq.frequenciaCalibracaoDias ?? 365),
        frequenciaVerificacaoDias: Number(eq.frequenciaVerificacaoDias ?? 30),
        ultimaCalibracao: eq.ultimaCalibracao ? String(eq.ultimaCalibracao) : null,
        ultimaVerificacao: eq.ultimaVerificacao ? String(eq.ultimaVerificacao) : null,
        proximaCalibracao: eq.proximaCalibracao ? String(eq.proximaCalibracao) : null,
        laudoNome,
        ...(laudoStoragePath ? { laudoStoragePath } : {}),
        versaoLaudoAtual: eq.versaoLaudoAtual ? String(eq.versaoLaudoAtual) : null,
        anexosJson: eq.laudoAnexos ? JSON.stringify(eq.laudoAnexos) : null,
        ativo: eq.ativo !== false,
      },
    });
    eqUidToId.set(uid, saved.id);
  }

  for (const cal of payload.calibrationRecords) {
    const uid = String(cal.id ?? '');
    const equipmentId = String(cal.equipmentId ?? '');
    const eqPk = eqUidToId.get(equipmentId);
    if (!uid || !eqPk) continue;

    let laudoStoragePath: string | null = null;
    const laudoNome = cal.laudoNome ? String(cal.laudoNome) : null;
    const incoming = extractBase64(cal.laudoDataUrl as string | undefined);
    if (incoming && laudoNome) {
      incoming.fileName = laudoNome;
      laudoStoragePath = saveQualidadeAnexo(`calibracoes/${uid}`, incoming).storagePath;
    }

    await prisma.sgqCalibracao.upsert({
      where: { uid },
      create: {
        uid,
        equipamentoId: eqPk,
        versao: String(cal.versao ?? '01'),
        data: String(cal.data ?? ''),
        tipo: String(cal.tipo ?? 'interna'),
        resultado: String(cal.resultado ?? 'aprovado'),
        responsavelLogin: String(cal.responsavelId ?? ''),
        laboratorio: cal.laboratorio ? String(cal.laboratorio) : null,
        laudoNome,
        laudoStoragePath,
        anexosJson: cal.anexos ? JSON.stringify(cal.anexos) : null,
        observacoes: cal.observacoes ? String(cal.observacoes) : null,
      },
      update: {
        versao: String(cal.versao ?? '01'),
        data: String(cal.data ?? ''),
        tipo: String(cal.tipo ?? 'interna'),
        resultado: String(cal.resultado ?? 'aprovado'),
        responsavelLogin: String(cal.responsavelId ?? ''),
        laboratorio: cal.laboratorio ? String(cal.laboratorio) : null,
        laudoNome,
        ...(laudoStoragePath ? { laudoStoragePath } : {}),
        anexosJson: cal.anexos ? JSON.stringify(cal.anexos) : null,
        observacoes: cal.observacoes ? String(cal.observacoes) : null,
      },
    });
  }

  for (const ver of payload.verificationRecords) {
    const uid = String(ver.id ?? '');
    const equipmentId = String(ver.equipmentId ?? '');
    const eqPk = eqUidToId.get(equipmentId);
    if (!uid || !eqPk) continue;

    await prisma.sgqVerificacao.upsert({
      where: { uid },
      create: {
        uid,
        equipamentoId: eqPk,
        data: String(ver.data ?? ''),
        resultado: String(ver.resultado ?? 'aprovado'),
        responsavelLogin: String(ver.responsavelId ?? ''),
        observacoes: ver.observacoes ? String(ver.observacoes) : null,
      },
      update: {
        data: String(ver.data ?? ''),
        resultado: String(ver.resultado ?? 'aprovado'),
        responsavelLogin: String(ver.responsavelId ?? ''),
        observacoes: ver.observacoes ? String(ver.observacoes) : null,
      },
    });
  }

  for (const task of payload.tasks) {
    const uid = String(task.id ?? '');
    if (!uid) continue;
    await prisma.sgqTarefa.upsert({
      where: { uid },
      create: {
        uid,
        tipo: String(task.tipo ?? ''),
        referenciaTipo: String(task.referenciaTipo ?? 'equipamento'),
        referenciaId: String(task.referenciaId ?? ''),
        titulo: String(task.titulo ?? ''),
        descricao: task.descricao ? String(task.descricao) : null,
        responsavelLogin: String(task.responsavelId ?? ''),
        prazo: task.prazo ? String(task.prazo) : null,
        concluida: Boolean(task.concluida),
        metadadosJson: JSON.stringify(task),
      },
      update: {
        tipo: String(task.tipo ?? ''),
        referenciaTipo: String(task.referenciaTipo ?? 'equipamento'),
        referenciaId: String(task.referenciaId ?? ''),
        titulo: String(task.titulo ?? ''),
        descricao: task.descricao ? String(task.descricao) : null,
        responsavelLogin: String(task.responsavelId ?? ''),
        prazo: task.prazo ? String(task.prazo) : null,
        concluida: Boolean(task.concluida),
        metadadosJson: JSON.stringify(task),
      },
    });
  }
}

export async function syncQualidadeAvaliacoes(avaliacoes: Array<Record<string, unknown>>) {
  for (const av of avaliacoes) {
    const uid = String(av.id ?? '');
    if (!uid) continue;
    await prisma.sgqAvaliacaoFornecedor.upsert({
      where: { uid },
      create: {
        uid,
        fornecedorId: String(av.fornecedorId ?? ''),
        fornecedorNome: String(av.fornecedorNome ?? ''),
        avaliadorLogin: String(av.avaliadorId ?? ''),
        dataReferencia: av.dataReferencia ? String(av.dataReferencia) : null,
        dataAvaliacao: av.dataAvaliacao ? String(av.dataAvaliacao) : null,
        numeroDocumento: av.numeroDocumento ? String(av.numeroDocumento) : null,
        fornecedorAprovado:
          av.fornecedorAprovado === undefined ? null : Boolean(av.fornecedorAprovado),
        rncNumero: av.rncNumero ? String(av.rncNumero) : null,
        notasJson: JSON.stringify(av.notas ?? {}),
        media: Number(av.media ?? 0),
        observacoes: av.observacoes ? String(av.observacoes) : null,
        origemImport: Boolean(av.origemImport),
      },
      update: {
        fornecedorId: String(av.fornecedorId ?? ''),
        fornecedorNome: String(av.fornecedorNome ?? ''),
        avaliadorLogin: String(av.avaliadorId ?? ''),
        dataReferencia: av.dataReferencia ? String(av.dataReferencia) : null,
        dataAvaliacao: av.dataAvaliacao ? String(av.dataAvaliacao) : null,
        numeroDocumento: av.numeroDocumento ? String(av.numeroDocumento) : null,
        fornecedorAprovado:
          av.fornecedorAprovado === undefined ? null : Boolean(av.fornecedorAprovado),
        rncNumero: av.rncNumero ? String(av.rncNumero) : null,
        notasJson: JSON.stringify(av.notas ?? {}),
        media: Number(av.media ?? 0),
        observacoes: av.observacoes ? String(av.observacoes) : null,
      },
    });
  }
}

export async function syncQualidadeOpcoesLista(opcoes: Record<string, string[]>) {
  for (const [chave, valores] of Object.entries(opcoes)) {
    let order = 0;
    for (const valor of valores) {
      const v = valor.trim();
      if (!v) continue;
      await prisma.sgqOpcaoLista.upsert({
        where: { chave_valor: { chave, valor: v } },
        create: { chave, valor: v, sortOrder: order++, ativo: true },
        update: { sortOrder: order++, ativo: true },
      });
    }
  }
}

export async function importRegistrosFromJson(
  registros: Array<Record<string, unknown>>,
  criadoPorLogin: string
) {
  let inseridos = 0;
  let ignorados = 0;
  for (const reg of registros) {
    const numero = String(reg.numero ?? '');
    if (!numero) continue;
    const exists = await prisma.sgqRegistro.findUnique({ where: { numero } });
    if (exists) {
      ignorados++;
      continue;
    }
    const tipo = String(reg.tipo ?? '');
    const dados =
      tipo === 'rnc'
        ? (reg.rnc as Record<string, unknown>)
        : (reg.rcc as Record<string, unknown>);
    await prisma.sgqRegistro.create({
      data: {
        uid: String(reg.id ?? `import-${numero}`),
        tipo,
        numero,
        status: String(reg.status ?? 'encerrado'),
        codigoDocumento: String(reg.codigoDocumento ?? ''),
        responsavelLogin: String(reg.responsavelId ?? ''),
        origemImport: true,
        dadosJson: JSON.stringify(dados ?? {}),
        criadoPorLogin,
      },
    });
    inseridos++;
  }
  return { inseridos, ignorados };
}

export async function listQualidadeResponsaveis() {
  const users = await prisma.usuario.findMany({
    where: { ativo: true },
    select: { login: true, nome: true, email: true },
    orderBy: { nome: 'asc' },
  });

  const result: Array<{ id: string; nome: string; email: string; ativo: boolean }> = [];
  for (const u of users) {
    const perms = await getPermissoesUsuario(u.login);
    if (!perms.includes(PERMISSOES.QUALIDADE_VER)) continue;
    result.push({
      id: u.login,
      nome: u.nome ?? u.login,
      email: u.email ?? '',
      ativo: true,
    });
  }
  return result;
}
