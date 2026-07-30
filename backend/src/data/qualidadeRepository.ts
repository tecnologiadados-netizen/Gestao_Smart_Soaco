import { prisma } from '../config/prisma.js';
import { PERMISSOES } from '../config/permissoes.js';
import { getPermissoesUsuario } from '../middleware/requirePermission.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  notificarNovasTarefasWorkflow,
  notificarPublicacaoDocumentos,
  type DocumentoMetaParaEmail,
  type DocumentoPublicadoInput,
  type NovaTarefaWorkflowInput,
} from '../services/sgq/sgqEmailNotificacaoService.js';
import {
  deleteQualidadeAnexoIfExists,
  readQualidadeAnexoAsDataUrl,
  saveQualidadeAnexo,
  saveQualidadeAnexoIfChanged,
  type IncomingQualidadeAnexo,
} from '../utils/qualidadeUpload.js';

type AnexoStored = {
  nome: string;
  storagePath?: string;
  dataUrl?: string;
};

/**
 * Persiste anexos complementares em disco e grava só { nome, storagePath } no JSON.
 * Nunca apaga anexos existentes quando o payload vem vazio ou sem conteúdo utilizável.
 */
function persistAnexosToDisk(
  subdir: string,
  incoming: unknown,
  existingJson: string | null | undefined
): { json: string | null; touched: boolean } {
  if (incoming === undefined) {
    return { json: existingJson ?? null, touched: false };
  }

  const existing = parseJson<AnexoStored[]>(existingJson, []);
  if (!Array.isArray(incoming)) {
    return { json: existingJson ?? null, touched: false };
  }

  if (incoming.length === 0) {
    if (existing.length > 0) {
      console.warn(
        '[qualidade] ignorando lista de anexos vazia para não apagar existentes:',
        subdir
      );
      return { json: existingJson ?? null, touched: false };
    }
    return { json: null, touched: true };
  }

  const result: Array<{ nome: string; storagePath: string }> = [];
  for (const raw of incoming) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as AnexoStored;
    const nome = String(item.nome ?? '').trim();
    if (!nome) continue;

    const dataUrl = typeof item.dataUrl === 'string' ? item.dataUrl : '';
    const pathHint = typeof item.storagePath === 'string' ? item.storagePath : '';
    const prevByPath = existing.find((e) => e.storagePath && e.storagePath === pathHint);
    const prevByNome = existing.find((e) => e.nome === nome && e.storagePath);

    if (dataUrl.startsWith('data:')) {
      const file = extractBase64(dataUrl);
      if (file) {
        file.fileName = nome;
        try {
          const saved = saveQualidadeAnexoIfChanged(
            subdir,
            file,
            prevByPath?.storagePath ?? prevByNome?.storagePath ?? (pathHint || null)
          );
          result.push({ nome, storagePath: saved.storagePath });
          continue;
        } catch (err) {
          console.warn('[qualidade] anexo ignorado no sync:', subdir, nome, err);
        }
      }
    }

    if (prevByPath?.storagePath) {
      result.push({ nome, storagePath: prevByPath.storagePath });
      continue;
    }
    if (prevByNome?.storagePath) {
      result.push({ nome, storagePath: prevByNome.storagePath });
      continue;
    }
    if (pathHint.startsWith('/uploads/qualidade/')) {
      result.push({ nome, storagePath: pathHint });
    }
  }

  if (result.length === 0 && existing.length > 0) {
    return { json: existingJson ?? null, touched: false };
  }

  return { json: JSON.stringify(result), touched: true };
}

function mapAnexosFromJson(
  anexosJson: string | null | undefined,
  includeDataUrl = true
): Array<{
  nome: string;
  dataUrl: string;
  storagePath?: string;
}> {
  const anexos = parseJson<AnexoStored[]>(anexosJson, []);
  const mapped = anexos
    .map((a) => {
      const nome = String(a.nome ?? '').trim();
      if (!nome) return null;
      const storagePath = a.storagePath?.startsWith('/uploads/qualidade/')
        ? a.storagePath
        : undefined;
      // Bootstrap leve: só metadata + storagePath (uploads ~1GB — embutir base64 trava a UI).
      const dataUrl = includeDataUrl
        ? storagePath
          ? readQualidadeAnexoAsDataUrl(storagePath) ?? ''
          : a.dataUrl ?? ''
        : '';
      return {
        nome,
        dataUrl,
        ...(storagePath ? { storagePath } : {}),
      };
    })
    .filter((a): a is { nome: string; dataUrl: string; storagePath?: string } => a != null);
  return mapped;
}

/** Migra anexos antigos (base64 embutido no JSON) para arquivos em disco — sem apagar nada. */
async function migrateEmbeddedAnexosToDisk(): Promise<void> {
  const equipamentos = await prisma.sgqEquipamento.findMany({
    select: { id: true, uid: true, anexosJson: true },
  });
  for (const eq of equipamentos) {
    const parsed = parseJson<AnexoStored[]>(eq.anexosJson, []);
    if (!parsed.some((a) => a.dataUrl?.startsWith('data:') && !a.storagePath)) continue;
    const { json, touched } = persistAnexosToDisk(
      `equipamentos/${eq.uid}/anexos`,
      parsed,
      eq.anexosJson
    );
    if (touched && json !== eq.anexosJson) {
      await prisma.sgqEquipamento.update({
        where: { id: eq.id },
        data: { anexosJson: json },
      });
    }
  }

  const calibracoes = await prisma.sgqCalibracao.findMany({
    select: { id: true, uid: true, anexosJson: true },
  });
  for (const cal of calibracoes) {
    const parsed = parseJson<AnexoStored[]>(cal.anexosJson, []);
    if (!parsed.some((a) => a.dataUrl?.startsWith('data:') && !a.storagePath)) continue;
    const { json, touched } = persistAnexosToDisk(
      `calibracoes/${cal.uid}/anexos`,
      parsed,
      cal.anexosJson
    );
    if (touched && json !== cal.anexosJson) {
      await prisma.sgqCalibracao.update({
        where: { id: cal.id },
        data: { anexosJson: json },
      });
    }
  }
}

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
  { nome: 'Produção' },
  { nome: 'Qualidade' },
  { nome: 'Manutenção' },
  { nome: 'Laboratório' },
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
      data: SEED_SETORES.map((s) => ({ nome: s.nome, ativo: true })),
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

function mapSetor(row: { uid: string; nome: string; ativo: boolean }) {
  return { id: row.uid, nome: row.nome, ativo: row.ativo };
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
  statusAtualizadoEm?: string | null;
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
    statusAtualizadoEm: row.statusAtualizadoEm ?? undefined,
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
    anexosJson?: string | null;
  },
  includeDataUrl: boolean
) {
  const dataUrl =
    includeDataUrl && row.arquivoStoragePath
      ? readQualidadeAnexoAsDataUrl(row.arquivoStoragePath)
      : undefined;
  const anexos = mapAnexosFromJson(row.anexosJson, includeDataUrl);
  // Compat: se não há lista, o arquivo principal vira o único item.
  const anexosResolvidos =
    anexos.length > 0
      ? anexos
      : row.arquivoNome && (dataUrl || row.arquivoStoragePath)
        ? [
            {
              nome: row.arquivoNome,
              dataUrl: dataUrl ?? '',
              ...(row.arquivoStoragePath
                ? { storagePath: row.arquivoStoragePath }
                : {}),
            },
          ]
        : row.arquivoNome
          ? [{ nome: row.arquivoNome, dataUrl: '' }]
          : [];
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
    arquivoStoragePath: row.arquivoStoragePath ?? undefined,
    ...(anexosResolvidos.length ? { anexos: anexosResolvidos } : {}),
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

function mapEquipamento(
  row: {
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
  },
  includeDataUrl = true
) {
  const anexosMapped = mapAnexosFromJson(row.anexosJson, includeDataUrl);
  const anexos =
    anexosMapped.length > 0
      ? anexosMapped
      : row.laudoNome && row.laudoStoragePath
        ? [
            {
              nome: row.laudoNome,
              dataUrl: includeDataUrl
                ? readQualidadeAnexoAsDataUrl(row.laudoStoragePath) ?? ''
                : '',
              storagePath: row.laudoStoragePath,
            },
          ]
        : [];
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
    laudoDataUrl:
      includeDataUrl && row.laudoStoragePath
        ? readQualidadeAnexoAsDataUrl(row.laudoStoragePath) ?? undefined
        : undefined,
    laudoStoragePath: row.laudoStoragePath ?? undefined,
    ...(anexos.length ? { laudoAnexos: anexos, anexos } : {}),
    versaoLaudoAtual: row.versaoLaudoAtual ?? undefined,
    ativo: row.ativo,
  };
}

function mapCalibracao(
  row: {
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
  },
  includeDataUrl = true
) {
  const anexosMapped = mapAnexosFromJson(row.anexosJson, includeDataUrl);
  const anexos =
    anexosMapped.length > 0
      ? anexosMapped
      : row.laudoNome && row.laudoStoragePath
        ? [
            {
              nome: row.laudoNome,
              dataUrl: includeDataUrl
                ? readQualidadeAnexoAsDataUrl(row.laudoStoragePath) ?? ''
                : '',
              storagePath: row.laudoStoragePath,
            },
          ]
        : [];
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
    laudoDataUrl:
      includeDataUrl && row.laudoStoragePath
        ? readQualidadeAnexoAsDataUrl(row.laudoStoragePath) ?? undefined
        : undefined,
    laudoStoragePath: row.laudoStoragePath ?? undefined,
    ...(anexos.length ? { anexos } : {}),
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
  createdAt: Date;
  metadadosJson: string | null;
}) {
  const meta = parseJson<Record<string, unknown>>(row.metadadosJson, {});
  const statusFromMeta =
    typeof meta.status === 'string' ? meta.status : undefined;
  return {
    id: row.uid,
    tipo: row.tipo,
    referenciaTipo: row.referenciaTipo,
    referenciaId: row.referenciaId,
    titulo: row.titulo,
    descricao: row.descricao ?? undefined,
    responsavelId: row.responsavelLogin,
    prazo: row.prazo ?? undefined,
    createdAt:
      typeof meta.createdAt === 'string' ? meta.createdAt : iso(row.createdAt),
    status: row.concluida
      ? 'concluida'
      : statusFromMeta === 'cancelada'
        ? 'cancelada'
        : 'pendente',
  };
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

export async function getQualidadeBootstrap() {
  await ensureSgqCatalogosSeed();
  await ensureSgqHistoricoSeed();
  // Anexos antigos em base64 no JSON → disco (não apaga; só reorganiza).
  await migrateEmbeddedAnexosToDisk();

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
    // Sem binários: uploads de qualidade passam de 1GB — embutir base64 no bootstrap
    // deixa a UI eternamente em "Carregando módulo Qualidade...".
    versions: versoes.map((v) => mapVersao(v, false)),
    revalidacoes: revalidacoes.map((r) => ({
      id: r.uid,
      documentId: r.documento.uid,
      data: r.data,
      observacoes: r.observacoes,
      evidenciaNome: r.evidenciaNome ?? undefined,
      evidenciaStoragePath: r.evidenciaStoragePath ?? undefined,
      evidenciaDataUrl: undefined,
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
    registros: registros
      .map(mapRegistro)
      .filter((r) => !isRegistroNomusRncRcc(r.tipo, Boolean(r.origemNomus))),
    equipment: equipamentos.map((e) => mapEquipamento(e, false)),
    calibrationRecords: calibracoes.map((c) => mapCalibracao(c, false)),
    verificationRecords: verificacoes.map(mapVerificacao),
    avaliacoes: avaliacoes.map(mapAvaliacao),
    tasks: tarefas.filter((t) => !t.concluida).map(mapTarefa),
    opcoesLista: opcoesPorChave,
  };
}

// ─── Sync helpers ────────────────────────────────────────────────────────────

/**
 * Sync de documentos é apenas upsert (aditivo).
 * NÃO apaga documentos/versões/alertas/revalidações ausentes do payload —
 * isso causava wipe quando outra aba/usuário sincronizava estado atrasado
 * (revisões sumiam / documento voltava à revisão 00 / arquivo sumia).
 * Exclusão real: apenas via deleteQualidadeDocumento (DELETE /documentos/:uid).
 */
function compareSgqRevision(a: string, b: string): number {
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true });
}

/** Ordem das etapas do workflow de documentos (avanço = rank maior). */
const SGQ_STATUS_RANK: Record<string, number> = {
  rascunho: 0,
  em_revisao: 1,
  em_aprovacao: 2,
  vigente: 3,
  obsoleto: 4,
};

function rankStatusSgq(status: string): number {
  return SGQ_STATUS_RANK[status] ?? 0;
}

/** Data da movimentação mais recente da versão (marca o avanço real do fluxo). */
function ultimaMovimentacaoData(movimentacoes: unknown): string {
  if (!Array.isArray(movimentacoes)) return '';
  return movimentacoes.reduce<string>((maior, mov) => {
    const data = String((mov as { data?: unknown } | null)?.data ?? '');
    return data > maior ? data : maior;
  }, '');
}

async function ultimaMovimentacaoDataServidor(
  docUid: string,
  versao: string
): Promise<string> {
  const row = await prisma.sgqDocumentoVersao.findFirst({
    where: { documento: { uid: docUid }, versao },
    select: { movimentacoesJson: true },
  });
  return ultimaMovimentacaoData(parseJson<unknown[]>(row?.movimentacoesJson, []));
}

/** Tarefas de etapa que deixam de fazer sentido quando o documento avança. */
const SGQ_TAREFAS_POR_STATUS: Record<string, string> = {
  rascunho: 'elaborar_documento',
  em_revisao: 'consenso_documento',
  em_aprovacao: 'aprovar_documento',
};

const SGQ_TAREFAS_ETAPA = Object.values(SGQ_TAREFAS_POR_STATUS);

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
  const trimmed = setorId.trim();
  if (!trimmed) return trimmed;
  const byUid = await prisma.sgqSetor.findUnique({ where: { uid: trimmed } });
  if (byUid) return byUid.uid;
  const byNome = await prisma.sgqSetor.findUnique({ where: { nome: trimmed } });
  if (byNome) return byNome.uid;
  return trimmed;
}

async function resolveTipoUid(tipoId: string) {
  const trimmed = tipoId.trim();
  if (!trimmed) return trimmed;
  const byUid = await prisma.sgqTipoDocumento.findUnique({ where: { uid: trimmed } });
  if (byUid) return byUid.uid;
  const legacySigla =
    trimmed === "tipo-man"
      ? "MAN"
      : trimmed === "tipo-re"
        ? "RE"
        : trimmed.startsWith("tipo-")
          ? trimmed.slice(5).toUpperCase()
          : trimmed.toUpperCase();
  const bySigla = await prisma.sgqTipoDocumento.findUnique({
    where: { sigla: legacySigla },
  });
  if (bySigla) return bySigla.uid;
  return trimmed;
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
  departments: Array<{ id?: string; nome: string }>;
  documentTypes: Array<{ id?: string; nome: string; sigla: string }>;
}) {
  await ensureSgqCatalogosSeed();

  for (const dep of payload.departments) {
    const nome = dep.nome.trim();
    if (!nome) continue;
    if (dep.id) {
      await prisma.sgqSetor.upsert({
        where: { uid: dep.id },
        create: { uid: dep.id, nome, ativo: true },
        update: { nome },
      });
    } else {
      await prisma.sgqSetor.upsert({
        where: { nome },
        create: { nome, ativo: true },
        update: {},
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

function isRegistroNomusRncRcc(tipo: string, origemImport: boolean): boolean {
  return origemImport && (tipo === 'rnc' || tipo === 'rcc');
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

    const origemImport = Boolean(reg.origemNomus ?? reg.origemImport);
    if (isRegistroNomusRncRcc(tipo, origemImport)) continue;

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
        origemImport,
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

export async function deleteQualidadeRegistro(uid: string): Promise<boolean> {
  const registro = await prisma.sgqRegistro.findUnique({
    where: { uid },
    select: { uid: true },
  });
  if (!registro) return false;

  await prisma.sgqRegistro.delete({ where: { uid } });
  return true;
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
  const statusFinalByUid = new Map<string, string>();

  const existingDocs = await prisma.sgqDocumento.findMany({
    select: { uid: true, status: true, versaoAtual: true, statusAtualizadoEm: true },
  });
  const existingByUid = new Map(existingDocs.map((d) => [d.uid, d]));
  const publicacoesParaNotificar: DocumentoPublicadoInput[] = [];

  // Documentos cujo snapshot chegou atrasado: versões e tarefas deles são ignoradas.
  const staleDocUids = new Set<string>();
  const versionsByDocUid = new Map<string, Array<Record<string, unknown>>>();
  for (const ver of versions) {
    const docUid = String(ver.documentId ?? '');
    if (!docUid) continue;
    const lista = versionsByDocUid.get(docUid);
    if (lista) lista.push(ver);
    else versionsByDocUid.set(docUid, [ver]);
  }

  for (const doc of documents) {
    const uid = String(doc.id ?? '');
    const codigo = String(doc.codigo ?? '');
    if (!uid || !codigo) continue;

    const status = String(doc.status ?? 'rascunho');
    const versaoPayload = String(doc.versaoAtual ?? '01');
    const prev = existingByUid.get(uid);
    // Não regredir versaoAtual se o servidor já tem revisão mais nova (sync stale).
    const versaoRegredida =
      Boolean(prev) && compareSgqRevision(prev!.versaoAtual, versaoPayload) > 0;
    const versaoAtual = versaoRegredida ? prev!.versaoAtual : versaoPayload;
    // Evita stale com rascunho/00 derrubar documento vigente já em revisão maior.
    let statusFinal =
      versaoRegredida && prev!.status === 'vigente' && status === 'rascunho'
        ? 'vigente'
        : status;

    if (versaoRegredida) staleDocUids.add(uid);

    // Toda mudança de etapa na mesma revisão precisa vir de um snapshot mais novo
    // que o gravado. Sem isso qualquer aba com estado antigo desfazia a transição
    // — inclusive devolvendo ao consenso um documento que acabara de ser reprovado.
    const statusAtualizadoEm = doc.statusAtualizadoEm
      ? String(doc.statusAtualizadoEm)
      : '';
    const etapaMudou =
      Boolean(prev) &&
      !versaoRegredida &&
      compareSgqRevision(prev!.versaoAtual, versaoPayload) === 0 &&
      status !== prev!.status;

    if (etapaMudou) {
      const carimboServidor = prev!.statusAtualizadoEm ?? '';
      // Sem carimbo dos dois lados (dados anteriores a esta coluna) cai no critério
      // antigo: retrocesso só passa com movimentação de reprovação mais recente.
      const desatualizado =
        statusAtualizadoEm || carimboServidor
          ? statusAtualizadoEm <= carimboServidor
          : rankStatusSgq(status) < rankStatusSgq(prev!.status) &&
            ultimaMovimentacaoData(
              (versionsByDocUid.get(uid) ?? []).find(
                (v) => String(v.versao ?? '') === versaoAtual
              )?.movimentacoes
            ) <= (await ultimaMovimentacaoDataServidor(uid, versaoAtual));

      if (desatualizado) {
        console.warn(
          `[qualidade-sync] ${codigo}: ignorando mudança ${prev!.status} -> ${status} (snapshot desatualizado de ${criadoPorLogin}).`
        );
        statusFinal = prev!.status;
        staleDocUids.add(uid);
      }
    }

    // Snapshot recusado não pode avançar o relógio, senão o próximo envio válido
    // seria descartado por parecer mais antigo.
    const carimboFinal = staleDocUids.has(uid)
      ? prev?.statusAtualizadoEm ?? null
      : statusAtualizadoEm || prev?.statusAtualizadoEm || null;
    const permissoes = (doc.permissoes as DocumentoPublicadoInput['permissoes']) ?? null;
    const publicacao = (doc.publicacao as DocumentoPublicadoInput['publicacao']) ?? null;

    const eventoPublicacao =
      statusFinal === 'vigente' &&
      (!prev ||
        prev.status !== 'vigente' ||
        prev.versaoAtual !== versaoAtual);

    if (eventoPublicacao && (permissoes?.avisoPublicacaoEmailIds?.length ?? 0) > 0) {
      publicacoesParaNotificar.push({
        uid,
        codigo,
        titulo: String(doc.titulo ?? ''),
        origem: String(doc.origem ?? 'interno'),
        versaoAtual,
        permissoes,
        publicacao,
      });
    }

    const tipoUid = await resolveTipoUid(String(doc.tipoId ?? ''));
    const setorUid = await resolveSetorUid(String(doc.setorId ?? ''));

    // Sanitiza externoRegistro: nunca persistir base64 no JSON do documento.
    const externoRegistroSanitizado = (() => {
      if (!doc.externoRegistro || typeof doc.externoRegistro !== 'object') {
        return doc.externoRegistro ? JSON.stringify(doc.externoRegistro) : null;
      }
      const er = { ...(doc.externoRegistro as Record<string, unknown>) };
      if (Array.isArray(er.anexos)) {
        er.anexos = (er.anexos as Array<Record<string, unknown>>)
          .map((a) => {
            const nome = String(a.nome ?? '').trim();
            if (!nome) return null;
            const storagePath =
              typeof a.storagePath === 'string' && a.storagePath.startsWith('/uploads/qualidade/')
                ? a.storagePath
                : undefined;
            return storagePath ? { nome, storagePath } : { nome };
          })
          .filter(Boolean);
      }
      return JSON.stringify(er);
    })();

    const saved = await prisma.sgqDocumento.upsert({
      where: { uid },
      create: {
        uid,
        codigo,
        titulo: String(doc.titulo ?? ''),
        origem: String(doc.origem ?? 'interno'),
        status: statusFinal,
        tipoUid,
        setorUid,
        versaoAtual,
        localizacao: doc.localizacao ? String(doc.localizacao) : null,
        permissoesJson: doc.permissoes ? JSON.stringify(doc.permissoes) : null,
        publicacaoJson: doc.publicacao ? JSON.stringify(doc.publicacao) : null,
        validadeJson: doc.validade ? JSON.stringify(doc.validade) : null,
        externoRegistroJson: externoRegistroSanitizado,
        criadoPorLogin,
        statusAtualizadoEm: carimboFinal,
      },
      update: {
        codigo,
        titulo: String(doc.titulo ?? ''),
        status: statusFinal,
        statusAtualizadoEm: carimboFinal,
        tipoUid,
        setorUid,
        versaoAtual,
        localizacao: doc.localizacao ? String(doc.localizacao) : null,
        permissoesJson: doc.permissoes ? JSON.stringify(doc.permissoes) : null,
        publicacaoJson: doc.publicacao ? JSON.stringify(doc.publicacao) : null,
        validadeJson: doc.validade ? JSON.stringify(doc.validade) : null,
        externoRegistroJson: externoRegistroSanitizado,
      },
    });
    docUidToId.set(uid, saved.id);
    statusFinalByUid.set(uid, statusFinal);
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
    if (staleDocUids.has(documentId)) continue;

    let arquivoStoragePath: string | null = null;
    let arquivoMimeType: string | null = null;
    const arquivoNome = ver.arquivoNome ? String(ver.arquivoNome) : null;
    const existing = await prisma.sgqDocumentoVersao.findUnique({ where: { uid } });

    // Prefer arquivoDataUrl; se vazio, usa o primeiro anexo com base64 (evita depender de cópia duplicada).
    let principalDataUrl =
      typeof ver.arquivoDataUrl === 'string' ? ver.arquivoDataUrl : '';
    if (!principalDataUrl.startsWith('data:') && Array.isArray(ver.anexos)) {
      const firstWithData = (ver.anexos as AnexoStored[]).find((a) =>
        String(a?.dataUrl ?? '').startsWith('data:')
      );
      if (firstWithData?.dataUrl) principalDataUrl = String(firstWithData.dataUrl);
    }

    const incoming = extractBase64(principalDataUrl);
    const nomePrincipal =
      arquivoNome ||
      (Array.isArray(ver.anexos) && (ver.anexos as AnexoStored[])[0]?.nome
        ? String((ver.anexos as AnexoStored[])[0].nome)
        : null);

    if (incoming && nomePrincipal) {
      incoming.fileName = nomePrincipal;
      const saved = saveQualidadeAnexoIfChanged(
        `documentos/${documentId}`,
        incoming,
        existing?.arquivoStoragePath
      );
      arquivoStoragePath = saved.storagePath;
      arquivoMimeType = saved.mimeType;
    } else if (Array.isArray(ver.anexos)) {
      const pathHint = (ver.anexos as AnexoStored[]).find(
        (a) =>
          typeof a.storagePath === 'string' &&
          a.storagePath.startsWith('/uploads/qualidade/')
      )?.storagePath;
      if (pathHint) {
        arquivoStoragePath = pathHint;
      }
    }

    if (existing?.arquivoStoragePath && arquivoStoragePath && existing.arquivoStoragePath !== arquivoStoragePath) {
      deleteQualidadeAnexoIfExists(existing.arquivoStoragePath);
    }

    let anexosIncoming: unknown = ver.anexos;
    if (anexosIncoming === undefined) {
      const docRow = await prisma.sgqDocumento.findUnique({
        where: { id: docPk },
        select: { externoRegistroJson: true },
      });
      const ext = parseJson<{ anexos?: unknown[] }>(docRow?.externoRegistroJson, {});
      if (Array.isArray(ext.anexos) && ext.anexos.length > 0 && !existing?.anexosJson) {
        anexosIncoming = ext.anexos;
      }
    }
    if (anexosIncoming === undefined && nomePrincipal) {
      anexosIncoming = [
        {
          nome: nomePrincipal,
          dataUrl: principalDataUrl,
          storagePath: arquivoStoragePath ?? existing?.arquivoStoragePath ?? undefined,
        },
      ];
    }

    const anexosPersist = persistAnexosToDisk(
      `documentos/${documentId}/versoes/${uid}/anexos`,
      anexosIncoming,
      existing?.anexosJson
    );

    // Se anexos gravaram path e o principal ainda não tem, reutiliza o primeiro.
    if (!arquivoStoragePath && anexosPersist.json) {
      const list = parseJson<Array<{ storagePath?: string }>>(anexosPersist.json, []);
      const firstPath = list.find((a) => a.storagePath?.startsWith('/uploads/qualidade/'))
        ?.storagePath;
      if (firstPath) arquivoStoragePath = firstPath;
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
        arquivoNome: nomePrincipal,
        arquivoStoragePath: arquivoStoragePath ?? existing?.arquivoStoragePath ?? null,
        arquivoMimeType: arquivoMimeType ?? existing?.arquivoMimeType ?? null,
        arquivoAtualizadoEm: ver.arquivoAtualizadoEm ? String(ver.arquivoAtualizadoEm) : null,
        anexosJson: anexosPersist.json,
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
        ...(nomePrincipal ? { arquivoNome: nomePrincipal } : {}),
        ...(arquivoStoragePath
          ? { arquivoStoragePath, arquivoMimeType }
          : {}),
        arquivoAtualizadoEm: ver.arquivoAtualizadoEm ? String(ver.arquivoAtualizadoEm) : null,
        ...(anexosPersist.touched ? { anexosJson: anexosPersist.json } : {}),
      },
    });
  }

  const pendingBefore = new Set(
    (
      await prisma.sgqTarefa.findMany({
        where: { concluida: false, referenciaTipo: 'documento' },
        select: { uid: true },
      })
    ).map((t) => t.uid)
  );

  const novasTarefas: NovaTarefaWorkflowInput[] = [];

  // Upsert aditivo — NÃO apagar pendências ausentes do payload (multi-aba).
  for (const task of tasks) {
    const uid = String(task.id ?? '');
    if (!uid) continue;

    const referenciaTipo = String(task.referenciaTipo ?? 'documento');
    if (referenciaTipo !== 'documento') continue;
    if (staleDocUids.has(String(task.referenciaId ?? ''))) continue;

    const status = String(task.status ?? '');
    const concluida =
      Boolean(task.concluida) || status === 'concluida' || status === 'cancelada';
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
        referenciaTipo,
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
        referenciaTipo,
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

  // Ao avançar de etapa, a pendência anterior deixa de existir para o usuário —
  // fechá-la aqui evita pendência fantasma e alerta de prazo de etapa já cumprida.
  for (const [docUid, statusAtual] of statusFinalByUid) {
    const tipoEsperado = SGQ_TAREFAS_POR_STATUS[statusAtual];
    const tiposObsoletos = SGQ_TAREFAS_ETAPA.filter((tipo) => tipo !== tipoEsperado);
    await prisma.sgqTarefa.updateMany({
      where: {
        referenciaTipo: 'documento',
        referenciaId: docUid,
        concluida: false,
        tipo: { in: tiposObsoletos },
      },
      data: { concluida: true },
    });
  }

  const tarefasParaNotificar = novasTarefas.filter((tarefa) => {
    if (!SGQ_TAREFAS_ETAPA.includes(tarefa.tipo)) return true;
    const statusDoc = statusFinalByUid.get(tarefa.referenciaId);
    if (!statusDoc) return true;
    return SGQ_TAREFAS_POR_STATUS[statusDoc] === tarefa.tipo;
  });

  if (tarefasParaNotificar.length > 0) {
    try {
      const enviados = await notificarNovasTarefasWorkflow(
        prisma,
        tarefasParaNotificar,
        docMetaByUid
      );
      if (enviados > 0) {
        console.info(`[sgq-email] ${enviados} notificação(ões) de tarefa nova enviada(s).`);
      }
    } catch (err) {
      console.error('[sgq-email] Erro ao notificar tarefas novas (sync continuou):', err);
    }
  }

  if (publicacoesParaNotificar.length > 0) {
    try {
      const enviados = await notificarPublicacaoDocumentos(prisma, publicacoesParaNotificar);
      if (enviados > 0) {
        console.info(`[sgq-email] ${enviados} notificação(ões) de publicação enviada(s).`);
      }
    } catch (err) {
      console.error('[sgq-email] Erro ao notificar publicação (sync continuou):', err);
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

  // Sync aditivo: sem purge por ausência no payload (ver comentário acima).
}

export async function syncQualidadeCalibrations(payload: {
  equipment: Array<Record<string, unknown>>;
  calibrationRecords: Array<Record<string, unknown>>;
  verificationRecords: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
}) {
  await migrateEmbeddedAnexosToDisk();

  const eqUidToId = new Map<string, number>();

  // Sync aditivo: NÃO apagar calibrações/verificações/tarefas ausentes do payload
  // (estado stale multi-aba apagava histórico). Exclusão: deleteQualidadeEquipamento.

  for (const eq of payload.equipment) {
    const uid = String(eq.id ?? '');
    const codigo = String(eq.codigo ?? '');
    if (!uid || !codigo) continue;

    const existing = await prisma.sgqEquipamento.findUnique({
      where: { uid },
      select: { laudoStoragePath: true, anexosJson: true },
    });

    let laudoStoragePath: string | null = null;
    const laudoNome = eq.laudoNome ? String(eq.laudoNome) : null;
    const laudoIncoming = extractBase64(eq.laudoDataUrl as string | undefined);
    if (laudoIncoming && laudoNome) {
      laudoIncoming.fileName = laudoNome;
      try {
        laudoStoragePath = saveQualidadeAnexoIfChanged(
          `equipamentos/${uid}`,
          laudoIncoming,
          existing?.laudoStoragePath
        ).storagePath;
      } catch (err) {
        console.warn('[qualidade] laudo do equipamento ignorado no sync:', uid, err);
      }
    }

    const anexosIncoming =
      eq.laudoAnexos !== undefined ? eq.laudoAnexos : eq.anexos;
    const anexosPersist = persistAnexosToDisk(
      `equipamentos/${uid}/anexos`,
      anexosIncoming,
      existing?.anexosJson
    );

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
        anexosJson: anexosPersist.json,
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
        // Preserva laudo existente quando o sync não traz arquivo novo / nome vazio.
        ...(laudoNome ? { laudoNome } : {}),
        ...(laudoStoragePath ? { laudoStoragePath } : {}),
        ...(eq.versaoLaudoAtual
          ? { versaoLaudoAtual: String(eq.versaoLaudoAtual) }
          : {}),
        ...(anexosPersist.touched ? { anexosJson: anexosPersist.json } : {}),
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

    const existingCal = await prisma.sgqCalibracao.findUnique({
      where: { uid },
      select: { laudoStoragePath: true, anexosJson: true },
    });

    let laudoStoragePath: string | null = null;
    const laudoNome = cal.laudoNome ? String(cal.laudoNome) : null;
    const incoming = extractBase64(cal.laudoDataUrl as string | undefined);
    if (incoming && laudoNome) {
      incoming.fileName = laudoNome;
      try {
        laudoStoragePath = saveQualidadeAnexoIfChanged(
          `calibracoes/${uid}`,
          incoming,
          existingCal?.laudoStoragePath
        ).storagePath;
      } catch (err) {
        console.warn('[qualidade] laudo de calibração ignorado no sync:', uid, err);
      }
    }

    const anexosPersist = persistAnexosToDisk(
      `calibracoes/${uid}/anexos`,
      cal.anexos,
      existingCal?.anexosJson
    );

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
        anexosJson: anexosPersist.json,
        observacoes: cal.observacoes ? String(cal.observacoes) : null,
      },
      update: {
        versao: String(cal.versao ?? '01'),
        data: String(cal.data ?? ''),
        tipo: String(cal.tipo ?? 'interna'),
        resultado: String(cal.resultado ?? 'aprovado'),
        responsavelLogin: String(cal.responsavelId ?? ''),
        laboratorio: cal.laboratorio ? String(cal.laboratorio) : null,
        ...(laudoNome ? { laudoNome } : {}),
        ...(laudoStoragePath ? { laudoStoragePath } : {}),
        ...(anexosPersist.touched ? { anexosJson: anexosPersist.json } : {}),
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
    const referenciaTipo = String(task.referenciaTipo ?? 'equipamento');
    if (referenciaTipo !== 'equipamento') continue;
    await prisma.sgqTarefa.upsert({
      where: { uid },
      create: {
        uid,
        tipo: String(task.tipo ?? ''),
        referenciaTipo,
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
        referenciaTipo,
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

export async function deleteQualidadeEquipamento(uid: string): Promise<boolean> {
  const eq = await prisma.sgqEquipamento.findUnique({
    where: { uid },
    select: {
      uid: true,
      laudoStoragePath: true,
      calibracoes: { select: { laudoStoragePath: true } },
    },
  });
  if (!eq) return false;

  deleteQualidadeAnexoIfExists(eq.laudoStoragePath);
  for (const cal of eq.calibracoes) {
    deleteQualidadeAnexoIfExists(cal.laudoStoragePath);
  }

  await prisma.sgqTarefa.deleteMany({
    where: { referenciaTipo: 'equipamento', referenciaId: uid },
  });
  await prisma.sgqEquipamento.delete({ where: { uid } });
  return true;
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
    const normalizados = valores.map((valor) => valor.trim()).filter(Boolean);
    const manter = new Set(normalizados);

    const existentes = await prisma.sgqOpcaoLista.findMany({
      where: { chave, ativo: true },
    });
    for (const row of existentes) {
      if (!manter.has(row.valor)) {
        await prisma.sgqOpcaoLista.update({
          where: { id: row.id },
          data: { ativo: false },
        });
      }
    }

    let order = 0;
    for (const valor of normalizados) {
      await prisma.sgqOpcaoLista.upsert({
        where: { chave_valor: { chave, valor } },
        create: { chave, valor, sortOrder: order++, ativo: true },
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

const sgqHistoricoMockDataDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'frontend',
  'src',
  'modules',
  'qualidade',
  'lib',
  'mock-data'
);

function readSgqHistoricoJson<T>(fileName: string): T[] {
  const filePath = path.join(sgqHistoricoMockDataDir, fileName);
  if (!fs.existsSync(filePath)) {
    console.warn(`[sgq-historico] Arquivo não encontrado: ${filePath}`);
    return [];
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error(`[sgq-historico] Falha ao ler ${fileName}:`, err);
    return [];
  }
}

/** Remove histórico Nomus de RNC/RCC e importa avaliações de fornecedor quando necessário. */
async function purgeNomusRncRccHistorico(): Promise<void> {
  const { count } = await prisma.sgqRegistro.deleteMany({
    where: {
      origemImport: true,
      tipo: { in: ['rnc', 'rcc'] },
    },
  });
  if (count > 0) {
    console.info(`[sgq-historico] Removidos ${count} registros RNC/RCC do Nomus`);
  }
}

/** Importa avaliações de fornecedor do histórico Nomus quando ainda não há registros importados. */
export async function ensureSgqHistoricoSeed(criadoPorLogin = 'sistema'): Promise<void> {
  await purgeNomusRncRccHistorico();

  const avaliacoesImportadas = await prisma.sgqAvaliacaoFornecedor.count({
    where: { origemImport: true },
  });

  if (avaliacoesImportadas === 0) {
    const avaliacoes = readSgqHistoricoJson<Record<string, unknown>>(
      'avaliacoes-fornecedor-historico.json'
    );
    if (avaliacoes.length > 0) {
      await syncQualidadeAvaliacoes(
        avaliacoes.map((av) => ({ ...av, origemImport: true }))
      );
      console.info(`[sgq-historico] Avaliações de fornecedor: ${avaliacoes.length} importadas`);
    }
  }
}
