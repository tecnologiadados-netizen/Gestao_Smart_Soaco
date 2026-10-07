import { randomUUID } from 'crypto';
import { prisma } from '../../config/prisma.js';
import {
  DemandaErro,
  inserirAntes,
  lerChecklists,
  nomeObrigatorio,
  normalizarChecklists,
  normalizarCor,
  normalizarPrazo,
  type Checklist,
} from '../lib/demandasInternas.js';
import { deleteRhFileIfExists, rhStoragePath, saveRhFile } from '../utils/rhUpload.js';

const LISTAS_INICIAIS = ['A fazer', 'Em andamento', 'Concluído'] as const;
const MIMES_PRINT = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export type DemandaAnexo = {
  id: string;
  nome: string;
  mimeType: string;
  storagePath: string;
};

export type DemandaCard = {
  id: string;
  quadroId: string;
  listaId: string;
  titulo: string;
  observacao: string;
  concluido: boolean;
  cor: string;
  prazo: string | null;
  ordem: number;
  checklists: Checklist[];
  anexos: DemandaAnexo[];
};

export type DemandaLista = {
  id: string;
  quadroId: string;
  nome: string;
  ordem: number;
  cards: DemandaCard[];
};

export type DemandaQuadro = {
  id: string;
  nome: string;
  ordem: number;
  listas: DemandaLista[];
};

export type DemandasArvore = { quadros: DemandaQuadro[] };

type CardRow = {
  id: string;
  listaId: string;
  titulo: string;
  observacao: string;
  concluido: boolean;
  cor: string;
  prazo: string | null;
  ordem: number;
  checklists: string;
  anexos: DemandaAnexo[];
};

function mapearCard(card: CardRow, quadroId: string): DemandaCard {
  return {
    id: card.id,
    quadroId,
    listaId: card.listaId,
    titulo: card.titulo,
    observacao: card.observacao,
    concluido: card.concluido,
    cor: card.cor || 'branco',
    prazo: card.prazo || null,
    ordem: card.ordem,
    checklists: lerChecklists(card.checklists),
    anexos: card.anexos.map((anexo) => ({
      id: anexo.id,
      nome: anexo.nome,
      mimeType: anexo.mimeType,
      storagePath: anexo.storagePath,
    })),
  };
}

export async function listarDemandas(): Promise<DemandasArvore> {
  const quadros = await prisma.rhDemandaQuadro.findMany({
    orderBy: [{ ordem: 'asc' }, { createdAt: 'asc' }],
    include: {
      listas: {
        orderBy: { ordem: 'asc' },
        include: {
          cards: {
            orderBy: [{ ordem: 'asc' }, { createdAt: 'asc' }],
            include: { anexos: { orderBy: { createdAt: 'asc' } } },
          },
        },
      },
    },
  });
  return {
    quadros: quadros.map((quadro) => ({
      id: quadro.id,
      nome: quadro.nome,
      ordem: quadro.ordem,
      listas: quadro.listas.map((lista) => ({
        id: lista.id,
        quadroId: quadro.id,
        nome: lista.nome,
        ordem: lista.ordem,
        cards: lista.cards.map((card) => mapearCard(card, quadro.id)),
      })),
    })),
  };
}

async function exigirLista(listaId: string) {
  const lista = await prisma.rhDemandaLista.findUnique({ where: { id: listaId } });
  if (!lista) throw new DemandaErro('Lista não encontrada.', 404);
  return lista;
}

async function exigirCard(cardId: string) {
  const card = await prisma.rhDemandaCard.findUnique({ where: { id: cardId } });
  if (!card) throw new DemandaErro('Card não encontrado.', 404);
  return card;
}

async function apagarArquivos(where: { cardId?: string; card?: { listaId?: string; lista?: { quadroId: string } } }) {
  const anexos = await prisma.rhDemandaAnexo.findMany({ where, select: { storagePath: true } });
  for (const anexo of anexos) deleteRhFileIfExists(anexo.storagePath);
}

async function reindexCards(listaId: string, quadroId: string, ids: string[]) {
  if (!ids.length) return;
  await prisma.$transaction(
    ids.map((id, ordem) =>
      prisma.rhDemandaCard.update({
        where: { id },
        data: { listaId, quadroId, ordem },
      }),
    ),
  );
}

export async function criarQuadro(nomeBruto: unknown, createdBy: string): Promise<DemandasArvore> {
  const nome = nomeObrigatorio(nomeBruto, 'o nome do quadro');
  const total = await prisma.rhDemandaQuadro.count();
  await prisma.$transaction(async (tx) => {
    const quadro = await tx.rhDemandaQuadro.create({
      data: { nome, ordem: total, createdBy },
    });
    await tx.rhDemandaLista.createMany({
      data: LISTAS_INICIAIS.map((nomeLista, ordem) => ({
        quadroId: quadro.id,
        nome: nomeLista,
        ordem,
      })),
    });
  });
  return listarDemandas();
}

export async function renomearQuadro(id: string, nomeBruto: unknown): Promise<DemandasArvore> {
  const atual = await prisma.rhDemandaQuadro.findUnique({ where: { id } });
  if (!atual) throw new DemandaErro('Quadro não encontrado.', 404);
  await prisma.rhDemandaQuadro.update({
    where: { id },
    data: { nome: nomeObrigatorio(nomeBruto, 'o nome do quadro') },
  });
  return listarDemandas();
}

export async function excluirQuadro(id: string): Promise<DemandasArvore> {
  const atual = await prisma.rhDemandaQuadro.findUnique({ where: { id } });
  if (!atual) throw new DemandaErro('Quadro não encontrado.', 404);
  await apagarArquivos({ card: { lista: { quadroId: id } } });
  await prisma.rhDemandaQuadro.delete({ where: { id } });
  return listarDemandas();
}

export async function criarLista(quadroId: string, nomeBruto: unknown): Promise<DemandasArvore> {
  const quadro = await prisma.rhDemandaQuadro.findUnique({ where: { id: quadroId } });
  if (!quadro) throw new DemandaErro('Quadro não encontrado.', 404);
  const nome = nomeObrigatorio(nomeBruto, 'o nome da lista');
  const ultima = await prisma.rhDemandaLista.aggregate({
    where: { quadroId },
    _max: { ordem: true },
  });
  await prisma.rhDemandaLista.create({
    data: { quadroId, nome, ordem: (ultima._max.ordem ?? -1) + 1 },
  });
  return listarDemandas();
}

export async function renomearLista(id: string, nomeBruto: unknown): Promise<DemandasArvore> {
  await exigirLista(id);
  await prisma.rhDemandaLista.update({
    where: { id },
    data: { nome: nomeObrigatorio(nomeBruto, 'o nome da lista') },
  });
  return listarDemandas();
}

export async function moverLista(id: string, antesDeId: string | null): Promise<DemandasArvore> {
  const lista = await exigirLista(id);
  const listas = await prisma.rhDemandaLista.findMany({
    where: { quadroId: lista.quadroId },
    orderBy: { ordem: 'asc' },
    select: { id: true },
  });
  const ids = inserirAntes(
    listas.map((item) => item.id),
    id,
    antesDeId,
  );
  await prisma.$transaction(ids.map((listaId, ordem) => prisma.rhDemandaLista.update({ where: { id: listaId }, data: { ordem } })));
  return listarDemandas();
}

export async function excluirLista(id: string): Promise<DemandasArvore> {
  await exigirLista(id);
  await apagarArquivos({ card: { listaId: id } });
  await prisma.rhDemandaLista.delete({ where: { id } });
  return listarDemandas();
}

export async function criarCard(listaId: string, tituloBruto: unknown, createdBy: string, corBruta: unknown = 'branco'): Promise<DemandasArvore> {
  const lista = await exigirLista(listaId);
  const titulo = nomeObrigatorio(tituloBruto, 'o título do card', 200);
  const cor = normalizarCor(corBruta);
  const ultimo = await prisma.rhDemandaCard.aggregate({
    where: { listaId },
    _max: { ordem: true },
  });
  await prisma.rhDemandaCard.create({
    data: {
      listaId,
      quadroId: lista.quadroId,
      titulo,
      cor,
      ordem: (ultimo._max.ordem ?? -1) + 1,
      createdBy,
    },
  });
  return listarDemandas();
}

export async function atualizarCard(
  id: string,
  patch: { titulo?: unknown; observacao?: unknown; concluido?: unknown; checklists?: unknown; cor?: unknown; prazo?: unknown },
): Promise<DemandasArvore> {
  await exigirCard(id);
  const data: {
    titulo?: string;
    observacao?: string;
    concluido?: boolean;
    checklists?: string;
    cor?: string;
    prazo?: string | null;
  } = {};
  if (patch.titulo !== undefined) data.titulo = nomeObrigatorio(patch.titulo, 'o título do card', 200);
  if (patch.observacao !== undefined) data.observacao = String(patch.observacao ?? '').slice(0, 8000);
  if (patch.concluido !== undefined) data.concluido = patch.concluido === true;
  if (patch.cor !== undefined) data.cor = normalizarCor(patch.cor);
  if (patch.prazo !== undefined) data.prazo = normalizarPrazo(patch.prazo);
  if (patch.checklists !== undefined) data.checklists = JSON.stringify(normalizarChecklists(patch.checklists));
  if (Object.keys(data).length) {
    await prisma.rhDemandaCard.update({ where: { id }, data });
  }
  return listarDemandas();
}

export async function moverCard(id: string, listaId: string, antesDeId: string | null): Promise<DemandasArvore> {
  const card = await exigirCard(id);
  const lista = await exigirLista(listaId);
  if (antesDeId === id) return listarDemandas();

  const origem = await prisma.rhDemandaCard.findMany({
    where: { listaId: card.listaId },
    orderBy: [{ ordem: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  });
  if (card.listaId === listaId) {
    await reindexCards(listaId, lista.quadroId, inserirAntes(origem.map((item) => item.id), id, antesDeId));
    return listarDemandas();
  }

  const destino = await prisma.rhDemandaCard.findMany({
    where: { listaId },
    orderBy: [{ ordem: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  });
  const idsOrigem = origem.map((item) => item.id).filter((item) => item !== id);
  const idsDestino = inserirAntes(
    destino.map((item) => item.id),
    id,
    antesDeId,
  );
  await prisma.$transaction([
    ...idsOrigem.map((cardId, ordem) => prisma.rhDemandaCard.update({ where: { id: cardId }, data: { ordem } })),
    ...idsDestino.map((cardId, ordem) =>
      prisma.rhDemandaCard.update({
        where: { id: cardId },
        data: { listaId, quadroId: lista.quadroId, ordem },
      }),
    ),
  ]);
  return listarDemandas();
}

export async function excluirCard(id: string): Promise<DemandasArvore> {
  await exigirCard(id);
  await apagarArquivos({ cardId: id });
  await prisma.rhDemandaCard.delete({ where: { id } });
  return listarDemandas();
}

export function mimeDePrint(mime: string, nome: string): string {
  const normalizado = mime.toLowerCase();
  if (MIMES_PRINT.has(normalizado)) return normalizado;
  const arquivo = nome.toLowerCase();
  if (arquivo.endsWith('.png')) return 'image/png';
  if (arquivo.endsWith('.jpg') || arquivo.endsWith('.jpeg')) return 'image/jpeg';
  if (arquivo.endsWith('.webp')) return 'image/webp';
  if (arquivo.endsWith('.gif')) return 'image/gif';
  throw new DemandaErro('Envie um print em PNG, JPG, WEBP ou GIF.');
}

export async function anexarPrint(
  cardId: string,
  arquivo: { buffer: Buffer; mimetype: string; originalname: string },
): Promise<DemandasArvore> {
  await exigirCard(cardId);
  if (!arquivo.buffer?.length) throw new DemandaErro('O arquivo do print está vazio.');
  const mimeType = mimeDePrint(arquivo.mimetype, arquivo.originalname);
  const id = randomUUID();
  const nome = nomeObrigatorio(arquivo.originalname || 'print', 'o nome do arquivo', 180);
  const storagePath = saveRhFile(rhStoragePath('demandas', id, nome), arquivo.buffer);
  try {
    await prisma.rhDemandaAnexo.create({
      data: { id, cardId, nome, mimeType, storagePath },
    });
  } catch (err) {
    deleteRhFileIfExists(storagePath);
    throw err;
  }
  return listarDemandas();
}

export async function excluirAnexo(id: string): Promise<DemandasArvore> {
  const anexo = await prisma.rhDemandaAnexo.findUnique({ where: { id } });
  if (!anexo) throw new DemandaErro('Print não encontrado.', 404);
  deleteRhFileIfExists(anexo.storagePath);
  await prisma.rhDemandaAnexo.delete({ where: { id } });
  return listarDemandas();
}
