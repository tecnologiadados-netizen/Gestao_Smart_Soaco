import { randomUUID } from 'crypto';
import { prisma } from '../../config/prisma.js';
import {
  DemandaErro,
  descreverMudancasCard,
  descreverMudancasSoHistorico,
  inserirAntes,
  lerChecklists,
  lerEmails,
  lerResponsaveis,
  matriculasResponsaveis,
  nomeObrigatorio,
  normalizarChecklists,
  normalizarCor,
  normalizarEmails,
  normalizarPrazo,
  normalizarPrioridade,
  type Checklist,
  type Responsavel,
} from '../lib/demandasInternas.js';
import { deleteRhFileIfExists, rhStoragePath, saveRhFile } from '../utils/rhUpload.js';
import {
  carregarSnapshotCardDemanda,
  registrarMudancasCardDemanda,
  type SnapshotCardDemanda,
} from '../../services/demandaCardAlertaEmailService.js';

/** Grava no histórico do card e avisa por e-mail; `soHistorico` não gera e-mail. */
async function registrarAlteracoes(
  cardId: string,
  descricoes: string[],
  por: string,
  soHistorico: string[] = [],
): Promise<void> {
  const todas = [...descricoes, ...soHistorico];
  if (!todas.length) return;
  try {
    await prisma.rhDemandaCardLog.createMany({
      data: todas.map((descricao) => ({ cardId, descricao, autor: por })),
    });
  } catch (err) {
    console.error('[demandas-internas] histórico do card:', err instanceof Error ? err.message : err);
  }
  await avisarMudancas(cardId, descricoes, por);
}

export type DemandaCardLog = {
  id: string;
  descricao: string;
  autor: string;
  autorNome: string;
  createdAt: string;
};

export async function listarLogsCard(cardId: string): Promise<DemandaCardLog[]> {
  await exigirCard(cardId);
  const logs = await prisma.rhDemandaCardLog.findMany({
    where: { cardId },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  const logins = [...new Set(logs.map((log) => log.autor))];
  const usuarios = await prisma.usuario.findMany({
    where: { login: { in: logins } },
    select: { login: true, nome: true },
  });
  const nomes = new Map(usuarios.map((u) => [u.login, u.nome?.trim() || u.login]));
  return logs.map((log) => ({
    id: log.id,
    descricao: log.descricao,
    autor: log.autor,
    autorNome: nomes.get(log.autor) ?? log.autor,
    createdAt: log.createdAt.toISOString(),
  }));
}

async function avisarMudancas(cardId: string, descricoes: string[], por: string): Promise<void> {
  if (!descricoes.length) return;
  try {
    const snapshot = await carregarSnapshotCardDemanda(cardId);
    if (snapshot) registrarMudancasCardDemanda(snapshot, descricoes, por);
  } catch (err) {
    console.error('[demandas-internas] aviso por e-mail:', err instanceof Error ? err.message : err);
  }
}

/** Antes de apagar cards (card, lista ou quadro), guarda quem precisa ser avisado. */
async function avisarExclusao(
  where: { id?: string; listaId?: string; quadroId?: string },
  descricao: string,
  por: string,
): Promise<void> {
  try {
    const cards = await prisma.rhDemandaCard.findMany({
      where: { ...where, emailsNotificacao: { not: '[]' } },
      include: { lista: { include: { quadro: true } } },
    });
    for (const card of cards) {
      const snapshot: SnapshotCardDemanda = {
        cardId: card.id,
        quadroId: card.quadroId,
        titulo: card.titulo,
        quadroNome: card.lista.quadro.nome,
        listaNome: card.lista.nome,
        prazo: card.prazo || null,
        concluido: card.concluido,
        prioridade: card.prioridade || null,
        responsaveis: lerResponsaveis(card.responsaveis).map((r) => r.nome),
        emails: lerEmails(card.emailsNotificacao),
        excluido: true,
      };
      registrarMudancasCardDemanda(snapshot, [descricao], por);
    }
  } catch (err) {
    console.error('[demandas-internas] aviso de exclusão por e-mail:', err instanceof Error ? err.message : err);
  }
}

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
  emailsNotificacao: string[];
  prioridade: string | null;
  responsaveis: Responsavel[];
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
  emailsNotificacao: string;
  prioridade: string | null;
  responsaveis: string;
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
    emailsNotificacao: lerEmails(card.emailsNotificacao),
    prioridade: card.prioridade || null,
    responsaveis: lerResponsaveis(card.responsaveis),
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

export async function excluirQuadro(id: string, por = 'sistema'): Promise<DemandasArvore> {
  const atual = await prisma.rhDemandaQuadro.findUnique({ where: { id } });
  if (!atual) throw new DemandaErro('Quadro não encontrado.', 404);
  await avisarExclusao({ quadroId: id }, `Card excluído junto com o quadro “${atual.nome}”.`, por);
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

export async function excluirLista(id: string, por = 'sistema'): Promise<DemandasArvore> {
  const lista = await exigirLista(id);
  await avisarExclusao({ listaId: id }, `Card excluído junto com a lista “${lista.nome}”.`, por);
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
  const criado = await prisma.rhDemandaCard.create({
    data: {
      listaId,
      quadroId: lista.quadroId,
      titulo,
      cor,
      ordem: (ultimo._max.ordem ?? -1) + 1,
      createdBy,
    },
  });
  await registrarAlteracoes(criado.id, [], createdBy, [`Card criado na lista “${lista.nome}”.`]);
  return listarDemandas();
}

export type ColaboradorResponsavel = { matricula: string; nome: string; setor: string; cargo: string };

/** Colaboradores do orgânico que podem ser responsáveis (não desligados). */
export async function listarColaboradoresResponsaveis(): Promise<ColaboradorResponsavel[]> {
  const rows = await prisma.rhOrganico.findMany({
    where: { status: { not: 'Desligado' }, matricula: { not: '' }, nome: { not: '' } },
    select: { matricula: true, nome: true, setor: true, cargo: true },
    orderBy: { nome: 'asc' },
  });
  const vistos = new Set<string>();
  return rows
    .map((row) => ({
      matricula: row.matricula.trim(),
      nome: row.nome.trim(),
      setor: row.setor.trim(),
      cargo: row.cargo.trim(),
    }))
    .filter((row) => row.matricula && row.nome && !vistos.has(row.matricula) && vistos.add(row.matricula));
}

/** Nome sempre do orgânico; quem já estava no card e foi desligado continua com o nome gravado. */
async function resolverResponsaveis(matriculas: string[], atuais: Responsavel[]): Promise<Responsavel[]> {
  if (!matriculas.length) return [];
  const colaboradores = await prisma.rhOrganico.findMany({
    where: { matricula: { in: matriculas } },
    select: { matricula: true, nome: true, status: true },
  });
  return matriculas.map((matricula) => {
    const doOrganico =
      colaboradores.find((c) => c.matricula === matricula && c.status !== 'Desligado') ??
      colaboradores.find((c) => c.matricula === matricula);
    const jaNoCard = atuais.find((r) => r.matricula === matricula);
    if (doOrganico && (doOrganico.status !== 'Desligado' || jaNoCard)) {
      return { matricula, nome: doOrganico.nome.trim() };
    }
    if (jaNoCard) return jaNoCard;
    throw new DemandaErro(`Colaborador ${matricula} não encontrado no orgânico.`);
  });
}

export async function atualizarCard(
  id: string,
  patch: {
    titulo?: unknown;
    observacao?: unknown;
    concluido?: unknown;
    checklists?: unknown;
    cor?: unknown;
    prazo?: unknown;
    emailsNotificacao?: unknown;
    prioridade?: unknown;
    responsaveis?: unknown;
  },
  por = 'sistema',
): Promise<DemandasArvore> {
  const antes = await exigirCard(id);
  const data: {
    titulo?: string;
    observacao?: string;
    concluido?: boolean;
    checklists?: string;
    cor?: string;
    prazo?: string | null;
    emailsNotificacao?: string;
    prioridade?: string | null;
    responsaveis?: string;
  } = {};
  if (patch.prioridade !== undefined) data.prioridade = normalizarPrioridade(patch.prioridade);
  if (patch.responsaveis !== undefined) {
    data.responsaveis = JSON.stringify(
      await resolverResponsaveis(matriculasResponsaveis(patch.responsaveis), lerResponsaveis(antes.responsaveis)),
    );
  }
  if (patch.titulo !== undefined) data.titulo = nomeObrigatorio(patch.titulo, 'o título do card', 200);
  if (patch.observacao !== undefined) data.observacao = String(patch.observacao ?? '').slice(0, 8000);
  if (patch.concluido !== undefined) data.concluido = patch.concluido === true;
  if (patch.cor !== undefined) data.cor = normalizarCor(patch.cor);
  if (patch.prazo !== undefined) data.prazo = normalizarPrazo(patch.prazo);
  if (patch.checklists !== undefined) data.checklists = JSON.stringify(normalizarChecklists(patch.checklists));
  if (patch.emailsNotificacao !== undefined) data.emailsNotificacao = JSON.stringify(normalizarEmails(patch.emailsNotificacao));
  if (Object.keys(data).length) {
    const depois = await prisma.rhDemandaCard.update({ where: { id }, data });
    const estado = (card: typeof antes) => ({
      titulo: card.titulo,
      observacao: card.observacao,
      concluido: card.concluido,
      prazo: card.prazo || null,
      checklists: lerChecklists(card.checklists),
      prioridade: card.prioridade || null,
      responsaveis: lerResponsaveis(card.responsaveis),
    });
    await registrarAlteracoes(
      id,
      descreverMudancasCard(estado(antes), estado(depois)),
      por,
      descreverMudancasSoHistorico(
        { cor: antes.cor, emails: lerEmails(antes.emailsNotificacao) },
        { cor: depois.cor, emails: lerEmails(depois.emailsNotificacao) },
      ),
    );
  }
  return listarDemandas();
}

export async function moverCard(id: string, listaId: string, antesDeId: string | null, por = 'sistema'): Promise<DemandasArvore> {
  const card = await exigirCard(id);
  const lista = await exigirLista(listaId);
  if (antesDeId === id) return listarDemandas();
  if (card.listaId !== listaId) {
    const origem = await prisma.rhDemandaLista.findUnique({ where: { id: card.listaId }, include: { quadro: true } });
    const destinoQuadro = await prisma.rhDemandaQuadro.findUnique({ where: { id: lista.quadroId } });
    const mesmoQuadro = origem?.quadroId === lista.quadroId;
    const descricao = mesmoQuadro
      ? `Movido de “${origem?.nome ?? '—'}” para “${lista.nome}”.`
      : `Movido do quadro “${origem?.quadro.nome ?? '—'}” (lista “${origem?.nome ?? '—'}”) para o quadro “${destinoQuadro?.nome ?? '—'}” (lista “${lista.nome}”).`;
    const resultado = await moverCardEntreListas(card, lista, antesDeId);
    await registrarAlteracoes(id, [descricao], por);
    return resultado;
  }
  return moverCardEntreListas(card, lista, antesDeId);
}

async function moverCardEntreListas(
  card: { id: string; listaId: string },
  lista: { id: string; quadroId: string },
  antesDeId: string | null,
): Promise<DemandasArvore> {
  const id = card.id;
  const listaId = lista.id;

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

export async function excluirCard(id: string, por = 'sistema'): Promise<DemandasArvore> {
  await exigirCard(id);
  await avisarExclusao({ id }, 'Card excluído.', por);
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
  por = 'sistema',
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
  await registrarAlteracoes(cardId, [`Print anexado: ${nome}`], por);
  return listarDemandas();
}

export async function excluirAnexo(id: string, por = 'sistema'): Promise<DemandasArvore> {
  const anexo = await prisma.rhDemandaAnexo.findUnique({ where: { id } });
  if (!anexo) throw new DemandaErro('Print não encontrado.', 404);
  deleteRhFileIfExists(anexo.storagePath);
  await prisma.rhDemandaAnexo.delete({ where: { id } });
  await registrarAlteracoes(anexo.cardId, [`Print removido: ${anexo.nome}`], por);
  return listarDemandas();
}
