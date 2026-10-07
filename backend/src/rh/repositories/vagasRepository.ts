import { randomUUID } from 'crypto';
import { prisma } from '../../config/prisma.js';
import { deleteRhFileIfExists, rhStoragePath, saveRhFile } from '../utils/rhUpload.js';
import {
  VagaErro,
  lerLinksSalvos,
  nomeObrigatorio,
  normalizarCor,
  normalizarLinks,
  normalizarPrazo,
  normalizarStatusCadastro,
  normalizarTransicao,
  type LinkDivulgacao,
  type StatusVaga,
} from '../lib/vagas.js';

export type VagaHistorico = {
  id: string;
  tipo: 'status' | 'prazo';
  status: StatusVaga;
  prazo: string | null;
  detalhe: string;
  createdBy: string | null;
  createdAt: string;
};

export type Vaga = {
  id: string;
  titulo: string;
  status: StatusVaga;
  prazo: string | null;
  observacao: string;
  links: LinkDivulgacao[];
  cor: string;
  anexo: { nome: string; storagePath: string } | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  historico: VagaHistorico[];
};

function mapear(vaga: {
  id: string;
  titulo: string;
  status: string;
  prazo: string | null;
  observacao: string;
  linksDivulgacao: string;
  cor: string;
  anexoNome: string | null;
  anexoPath: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  historico: Array<{
    id: string;
    tipo: string;
    status: string;
    prazo: string | null;
    detalhe: string;
    createdBy: string | null;
    createdAt: Date;
  }>;
}): Vaga {
  return {
    id: vaga.id,
    titulo: vaga.titulo,
    status: vaga.status as StatusVaga,
    prazo: vaga.prazo,
    observacao: vaga.observacao,
    links: lerLinksSalvos(vaga.linksDivulgacao),
    cor: vaga.cor || 'branco',
    anexo: vaga.anexoPath ? { nome: vaga.anexoNome || 'post.pdf', storagePath: vaga.anexoPath } : null,
    createdBy: vaga.createdBy,
    createdAt: vaga.createdAt.toISOString(),
    updatedAt: vaga.updatedAt.toISOString(),
    historico: [...vaga.historico]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((item) => ({
        id: item.id,
        tipo: item.tipo === 'prazo' ? 'prazo' : 'status',
        status: item.status as StatusVaga,
        prazo: item.prazo,
        detalhe: item.detalhe,
        createdBy: item.createdBy,
        createdAt: item.createdAt.toISOString(),
      })),
  };
}

const incluir = { historico: true } as const;

export async function listarVagas(): Promise<Vaga[]> {
  const vagas = await prisma.rhVaga.findMany({ include: incluir, orderBy: { updatedAt: 'desc' } });
  return vagas.map(mapear);
}

export async function buscarVaga(id: string): Promise<Vaga | null> {
  const vaga = await prisma.rhVaga.findUnique({ where: { id }, include: incluir });
  return vaga ? mapear(vaga) : null;
}

export async function criarVaga(entrada: {
  titulo: unknown;
  status: unknown;
  prazo: unknown;
  observacao: unknown;
  links: unknown;
  cor: unknown;
  createdBy: string;
}): Promise<Vaga> {
  const titulo = nomeObrigatorio(entrada.titulo, 'o nome da vaga');
  const status = normalizarStatusCadastro(entrada.status);
  const prazo = normalizarPrazo(entrada.prazo);
  const observacao = typeof entrada.observacao === 'string' ? entrada.observacao.trim().slice(0, 2000) : '';
  const links = normalizarLinks(entrada.links);
  if (links.length > 0 && status !== 'em_divulgacao') {
    throw new VagaErro('Os links de divulgação entram quando a vaga está em divulgação.');
  }
  const vaga = await prisma.rhVaga.create({
    data: {
      titulo,
      status,
      prazo,
      observacao,
      linksDivulgacao: JSON.stringify(links),
      cor: normalizarCor(entrada.cor),
      createdBy: entrada.createdBy,
      historico: {
        create: {
          tipo: 'status',
          status,
          prazo,
          detalhe: observacao,
          createdBy: entrada.createdBy,
        },
      },
    },
    include: incluir,
  });
  return mapear(vaga);
}

export async function atualizarVaga(
  id: string,
  patch: { titulo?: unknown; observacao?: unknown; prazo?: unknown; status?: unknown; detalhe?: unknown; links?: unknown; cor?: unknown },
  createdBy: string,
): Promise<Vaga> {
  const atual = await prisma.rhVaga.findUnique({ where: { id } });
  if (!atual) throw new VagaErro('Vaga não encontrada.', 404);
  const data: { titulo?: string; observacao?: string; prazo?: string | null; status?: string; linksDivulgacao?: string; cor?: string } = {};
  const eventos: Array<{ tipo: string; status: string; prazo: string | null; detalhe: string }> = [];
  if (patch.titulo !== undefined) data.titulo = nomeObrigatorio(patch.titulo, 'o nome da vaga');
  if (patch.observacao !== undefined) {
    data.observacao = typeof patch.observacao === 'string' ? patch.observacao.trim().slice(0, 2000) : '';
  }
  const detalhe = typeof patch.detalhe === 'string' ? patch.detalhe.trim().slice(0, 500) : '';
  let prazo = atual.prazo;
  if (patch.prazo !== undefined) {
    prazo = normalizarPrazo(patch.prazo);
    if (prazo !== atual.prazo) {
      data.prazo = prazo;
      eventos.push({ tipo: 'prazo', status: atual.status, prazo, detalhe });
    }
  }
  if (patch.status !== undefined) {
    const status = normalizarTransicao(atual.status, patch.status);
    if (status !== atual.status) {
      data.status = status;
      eventos.push({ tipo: 'status', status, prazo, detalhe });
    }
  }
  if (patch.links !== undefined) {
    const links = normalizarLinks(patch.links);
    const statusFinal = data.status ?? atual.status;
    if (links.length > 0 && statusFinal === 'aberta_sem_divulgacao') {
      throw new VagaErro('Os links de divulgação entram quando a vaga está em divulgação.');
    }
    const salvos = lerLinksSalvos(atual.linksDivulgacao);
    const iguais =
      salvos.length === links.length &&
      salvos.every((item, indice) => item.id === links[indice]?.id && item.url === links[indice]?.url && item.descricao === links[indice]?.descricao);
    if (!iguais) data.linksDivulgacao = JSON.stringify(links);
  }
  if (patch.cor !== undefined) {
    const cor = normalizarCor(patch.cor);
    if (cor !== (atual.cor || 'branco')) data.cor = cor;
  }
  if (Object.keys(data).length === 0) {
    const mesma = await prisma.rhVaga.findUnique({ where: { id }, include: incluir });
    if (!mesma) throw new VagaErro('Vaga não encontrada.', 404);
    return mapear(mesma);
  }
  const vaga = await prisma.rhVaga.update({
    where: { id },
    data: {
      ...data,
      historico: eventos.length
        ? { create: eventos.map((evento) => ({ ...evento, createdBy })) }
        : undefined,
    },
    include: incluir,
  });
  return mapear(vaga);
}

export async function excluirVaga(id: string): Promise<void> {
  const atual = await prisma.rhVaga.findUnique({ where: { id } });
  if (!atual) throw new VagaErro('Vaga não encontrada.', 404);
  if (atual.anexoPath) deleteRhFileIfExists(atual.anexoPath);
  await prisma.rhVaga.delete({ where: { id } });
}

function mimeDePdf(mime: string, nome: string): void {
  const arquivo = nome.toLowerCase();
  const tipo = mime.toLowerCase();
  if (tipo === 'application/pdf' || arquivo.endsWith('.pdf')) return;
  throw new VagaErro('Envie o post da vaga em PDF.');
}

export async function anexarPdf(
  id: string,
  arquivo: { buffer: Buffer; mimetype: string; originalname: string },
): Promise<Vaga> {
  const atual = await prisma.rhVaga.findUnique({ where: { id } });
  if (!atual) throw new VagaErro('Vaga não encontrada.', 404);
  if (!arquivo.buffer?.length) throw new VagaErro('O PDF está vazio.');
  mimeDePdf(arquivo.mimetype, arquivo.originalname);
  const nome = nomeObrigatorio(arquivo.originalname || 'post.pdf', 'o nome do arquivo');
  const storagePath = saveRhFile(rhStoragePath('vagas', randomUUID(), nome), arquivo.buffer);
  try {
    const vaga = await prisma.rhVaga.update({
      where: { id },
      data: { anexoNome: nome, anexoPath: storagePath },
      include: incluir,
    });
    if (atual.anexoPath && atual.anexoPath !== storagePath) deleteRhFileIfExists(atual.anexoPath);
    return mapear(vaga);
  } catch (err) {
    deleteRhFileIfExists(storagePath);
    throw err;
  }
}

export async function removerPdf(id: string): Promise<Vaga> {
  const atual = await prisma.rhVaga.findUnique({ where: { id } });
  if (!atual) throw new VagaErro('Vaga não encontrada.', 404);
  if (atual.anexoPath) deleteRhFileIfExists(atual.anexoPath);
  const vaga = await prisma.rhVaga.update({
    where: { id },
    data: { anexoNome: null, anexoPath: null },
    include: incluir,
  });
  return mapear(vaga);
}
