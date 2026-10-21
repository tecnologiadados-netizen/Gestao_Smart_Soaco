import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import type { DetalheItemGondola } from './detalheItem.js';
import { chavePeca, classificarSetor, type SetorGondola } from './regras.js';

export type TipoOrdemGondola = 'PI' | 'PP' | 'PLANILHA';

export type OrdemGondola = {
  id: number;
  numero: string;
  setor: SetorGondola;
  tipo: TipoOrdemGondola;
  criadoPorLogin: string | null;
  createdAt: string;
  detalhes: DetalheItemGondola[];
};

type LinhaOrdem = {
  id: number | bigint;
  numero: string;
  setor: string;
  tipo: string;
  criadoPorLogin: string | null;
  createdAt: string;
  snapshot: string;
};

function lerSnapshot(snapshot: string): DetalheItemGondola[] {
  try {
    const dados = JSON.parse(snapshot) as unknown;
    return Array.isArray(dados) ? (dados as DetalheItemGondola[]) : [];
  } catch {
    return [];
  }
}

function paraOrdem(linha: LinhaOrdem): OrdemGondola {
  return {
    id: Number(linha.id),
    numero: linha.numero,
    setor: classificarSetor(linha.setor) ?? 'Gôndolas',
    tipo: (['PI', 'PP', 'PLANILHA'].includes(linha.tipo) ? linha.tipo : 'PLANILHA') as TipoOrdemGondola,
    criadoPorLogin: linha.criadoPorLogin,
    createdAt: linha.createdAt,
    detalhes: lerSnapshot(linha.snapshot),
  };
}

/** Peças de cada item que já saíram em ordem: idItem → chave da peça → número da ordem. */
export async function pecasGeradas(idItens: number[]): Promise<Map<number, Map<string, string>>> {
  const ids = [...new Set(idItens.filter((id) => Number.isFinite(id) && id > 0))];
  const mapa = new Map<number, Map<string, string>>();
  if (ids.length === 0) return mapa;
  const rows = await prisma.$queryRaw<{ idItem: number | bigint; chavePeca: string; numero: string }[]>(
    Prisma.sql`SELECT p.id_item AS idItem, p.chave_peca AS chavePeca, o.numero AS numero
      FROM gondola_ordem_peca p
      INNER JOIN gondola_ordem o ON o.id = p.ordem_id
      WHERE p.id_item IN (${Prisma.join(ids)})`
  );
  for (const row of rows) {
    const idItem = Number(row.idItem);
    const doItem = mapa.get(idItem) ?? new Map<string, string>();
    doItem.set(row.chavePeca, row.numero);
    mapa.set(idItem, doItem);
  }
  return mapa;
}

export async function itensConcluidos(): Promise<Set<number>> {
  const rows = await prisma.$queryRaw<{ idItem: number | bigint }[]>(
    Prisma.sql`SELECT id_item AS idItem FROM gondola_item_concluido`
  );
  return new Set(rows.map((row) => Number(row.idItem)));
}

export async function marcarItemConcluido(idItem: number, ordemId: number): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO gondola_item_concluido (id_item, ordem_id, concluido_em)
    VALUES (${idItem}, ${ordemId}, ${new Date().toISOString()})
    ON CONFLICT(id_item) DO UPDATE SET ordem_id = excluded.ordem_id, concluido_em = excluded.concluido_em
  `;
}

export async function listarOrdensGondola(): Promise<OrdemGondola[]> {
  const rows = await prisma.$queryRaw<LinhaOrdem[]>(
    Prisma.sql`SELECT id, numero, setor, tipo, criado_por_login AS criadoPorLogin, created_at AS createdAt, snapshot
      FROM gondola_ordem ORDER BY created_at DESC, id DESC`
  );
  return rows.map(paraOrdem);
}

function gerarNumero(): string {
  return `OG-${Date.now().toString(36).toUpperCase()}`;
}

export async function criarOrdemGondola(entrada: {
  setor: SetorGondola;
  tipo: TipoOrdemGondola;
  detalhes: DetalheItemGondola[];
  login: string | null;
}): Promise<OrdemGondola> {
  const detalhes = entrada.detalhes
    .map((detalhe) => ({
      ...detalhe,
      componentes: detalhe.componentes.map(({ ordemGerada: _ordem, ...componente }) => componente),
    }))
    .filter((detalhe) => detalhe.item?.idItem > 0 && detalhe.componentes.length > 0);
  if (detalhes.length === 0) throw new Error('Marque ao menos uma peça.');

  const pecas = detalhes.flatMap((detalhe) =>
    [...new Set(detalhe.componentes.map((componente) => chavePeca(componente)))].map((chave) => ({
      idItem: detalhe.item.idItem,
      pedido: detalhe.item.pedido,
      chave,
    }))
  );

  const jaGeradas = await pecasGeradas(pecas.map((peca) => peca.idItem));
  const conflito = pecas.find((peca) => jaGeradas.get(peca.idItem)?.has(peca.chave));
  if (conflito) {
    const numero = jaGeradas.get(conflito.idItem)?.get(conflito.chave);
    throw new Error(`Uma peça do ${conflito.pedido} já saiu na ordem ${numero}. Atualize a tela e gere de novo.`);
  }

  const numero = gerarNumero();
  const createdAt = new Date().toISOString();
  const snapshot = JSON.stringify(detalhes);

  const id = await prisma.$transaction(async (tx) => {
    const inserida = await tx.$queryRaw<{ id: number | bigint }[]>`
      INSERT INTO gondola_ordem (numero, setor, tipo, criado_por_login, snapshot, created_at)
      VALUES (${numero}, ${entrada.setor}, ${entrada.tipo}, ${entrada.login}, ${snapshot}, ${createdAt})
      RETURNING id
    `;
    const ordemId = Number(inserida[0]?.id);
    if (!Number.isFinite(ordemId) || ordemId <= 0) throw new Error('Não foi possível gravar a ordem.');
    for (const peca of pecas) {
      await tx.$executeRaw`
        INSERT INTO gondola_ordem_peca (ordem_id, id_item, pedido, chave_peca)
        VALUES (${ordemId}, ${peca.idItem}, ${peca.pedido}, ${peca.chave})
      `;
    }
    return ordemId;
  });

  return {
    id,
    numero,
    setor: entrada.setor,
    tipo: entrada.tipo,
    criadoPorLogin: entrada.login,
    createdAt,
    detalhes,
  };
}

export async function excluirOrdemGondola(id: number): Promise<boolean> {
  const existe = await prisma.$queryRaw<{ id: number | bigint }[]>`SELECT id FROM gondola_ordem WHERE id = ${id}`;
  if (existe.length === 0) return false;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      DELETE FROM gondola_item_concluido
      WHERE id_item IN (SELECT id_item FROM gondola_ordem_peca WHERE ordem_id = ${id}) OR ordem_id = ${id}
    `;
    await tx.$executeRaw`DELETE FROM gondola_ordem_peca WHERE ordem_id = ${id}`;
    await tx.$executeRaw`DELETE FROM gondola_ordem WHERE id = ${id}`;
  });
  return true;
}
