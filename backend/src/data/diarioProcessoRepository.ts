/**
 * Processo do contas a pagar: um por dia de vencimento, gravado só neste projeto.
 */

import { prisma } from '../config/prisma.js';

export const STATUS_PROCESSO = ['rascunho', 'em_aprovacao', 'aprovado', 'em_correcao'] as const;
export type StatusProcessoDiario = (typeof STATUS_PROCESSO)[number];

const STATUS_TRAVADOS = new Set<StatusProcessoDiario>(['em_aprovacao', 'aprovado']);

export interface DiarioProcessoDto {
  id: number;
  codigo: number;
  dataVencimento: string;
  descricao: string;
  usuario: string;
  status: StatusProcessoDiario;
  motivoDevolucao: string | null;
  aprovadoPor: string | null;
  aprovadoEm: string | null;
  enviadoEm: string | null;
  editavel: boolean;
}

type Row = {
  id: number;
  codigo: number;
  dataVencimento: string;
  descricao: string;
  usuario: string;
  status: string;
  motivoDevolucao: string | null;
  aprovadoPor: string | null;
  aprovadoEm: Date | null;
  enviadoEm: Date | null;
};

function iso(data: Date | null): string | null {
  return data ? data.toISOString() : null;
}

export function processoEditavel(status: string): boolean {
  return status === 'rascunho' || status === 'em_correcao';
}

function dto(row: Row): DiarioProcessoDto {
  const status = STATUS_PROCESSO.includes(row.status as StatusProcessoDiario)
    ? (row.status as StatusProcessoDiario)
    : 'rascunho';
  return {
    id: row.id,
    codigo: row.codigo,
    dataVencimento: row.dataVencimento,
    descricao: row.descricao,
    usuario: row.usuario,
    status,
    motivoDevolucao: row.motivoDevolucao,
    aprovadoPor: row.aprovadoPor,
    aprovadoEm: iso(row.aprovadoEm),
    enviadoEm: iso(row.enviadoEm),
    editavel: processoEditavel(status),
  };
}

export async function listarProcessosDiario(): Promise<DiarioProcessoDto[]> {
  const rows = await prisma.diarioContasPagarProcesso.findMany({
    orderBy: [{ dataVencimento: 'desc' }, { codigo: 'desc' }],
  });
  return rows.map(dto);
}

export async function obterProcessoDiario(id: number): Promise<DiarioProcessoDto | null> {
  const row = await prisma.diarioContasPagarProcesso.findUnique({ where: { id } });
  return row ? dto(row) : null;
}

export async function iniciarProcessoDiario(input: {
  dataVencimento: string;
  descricao: string;
  usuario: string;
}): Promise<{ processo: DiarioProcessoDto; existente: boolean }> {
  const descricao = input.descricao.trim();
  if (!descricao) throw new Error('Informe a descrição.');
  if (descricao.length > 200) throw new Error('A descrição pode ter no máximo 200 caracteres.');

  try {
    const criado = await prisma.$transaction(async (tx) => {
      const ja = await tx.diarioContasPagarProcesso.findUnique({
        where: { dataVencimento: input.dataVencimento },
      });
      if (ja) return { row: ja, existente: true as const };
      const ultimo = await tx.diarioContasPagarProcesso.findFirst({
        orderBy: { codigo: 'desc' },
        select: { codigo: true },
      });
      const row = await tx.diarioContasPagarProcesso.create({
        data: {
          codigo: (ultimo?.codigo ?? 0) + 1,
          dataVencimento: input.dataVencimento,
          descricao,
          usuario: input.usuario,
          status: 'rascunho',
        },
      });
      return { row, existente: false as const };
    });
    return { processo: dto(criado.row), existente: criado.existente };
  } catch (err) {
    const ja = await prisma.diarioContasPagarProcesso.findUnique({
      where: { dataVencimento: input.dataVencimento },
    });
    if (ja) return { processo: dto(ja), existente: true };
    throw err;
  }
}

export async function atualizarDescricaoProcessoDiario(id: number, descricaoBruta: string): Promise<DiarioProcessoDto> {
  const descricao = descricaoBruta.trim();
  if (!descricao) throw new Error('Informe a descrição.');
  if (descricao.length > 200) throw new Error('A descrição pode ter no máximo 200 caracteres.');
  const atual = await prisma.diarioContasPagarProcesso.findUnique({ where: { id } });
  if (!atual) throw new Error('Processo não encontrado.');
  if (!processoEditavel(atual.status)) {
    throw new Error('Este contas a pagar não pode ser alterado neste status.');
  }
  const salvo = await prisma.diarioContasPagarProcesso.update({
    where: { id },
    data: { descricao },
  });
  return dto(salvo);
}

export async function enviarProcessoDiarioAprovacao(id: number): Promise<DiarioProcessoDto> {
  const atual = await prisma.diarioContasPagarProcesso.findUnique({ where: { id } });
  if (!atual) throw new Error('Processo não encontrado.');
  if (!processoEditavel(atual.status)) {
    throw new Error('Só um rascunho ou uma correção pode ser enviado para aprovação.');
  }
  const salvo = await prisma.diarioContasPagarProcesso.update({
    where: { id },
    data: { status: 'em_aprovacao', enviadoEm: new Date(), motivoDevolucao: null },
  });
  return dto(salvo);
}

export async function aprovarProcessoDiario(id: number, usuario: string): Promise<DiarioProcessoDto> {
  const atual = await prisma.diarioContasPagarProcesso.findUnique({ where: { id } });
  if (!atual) throw new Error('Processo não encontrado.');
  if (atual.status !== 'em_aprovacao') {
    throw new Error('Só um contas a pagar em aprovação pode ser aprovado.');
  }
  const salvo = await prisma.diarioContasPagarProcesso.update({
    where: { id },
    data: { status: 'aprovado', aprovadoPor: usuario, aprovadoEm: new Date() },
  });
  return dto(salvo);
}

export async function devolverProcessoDiario(id: number, motivoBruto: string): Promise<DiarioProcessoDto> {
  const atual = await prisma.diarioContasPagarProcesso.findUnique({ where: { id } });
  if (!atual) throw new Error('Processo não encontrado.');
  if (atual.status !== 'em_aprovacao' && atual.status !== 'aprovado') {
    throw new Error('Só um contas a pagar em aprovação ou aprovado pode voltar para correção.');
  }
  const motivo = motivoBruto.trim();
  const salvo = await prisma.diarioContasPagarProcesso.update({
    where: { id },
    data: {
      status: 'em_correcao',
      motivoDevolucao: motivo || null,
      aprovadoPor: null,
      aprovadoEm: null,
    },
  });
  return dto(salvo);
}

export async function assertDatasDiarioEditaveis(datas: string[]): Promise<void> {
  const unicas = [...new Set(datas.map((d) => d.trim()).filter(Boolean))];
  if (unicas.length === 0) return;
  const travados = await prisma.diarioContasPagarProcesso.findMany({
    where: { dataVencimento: { in: unicas }, status: { in: [...STATUS_TRAVADOS] } },
    select: { dataVencimento: true, status: true },
  });
  if (travados.length === 0) return;
  const dia = travados[0].dataVencimento.split('-').reverse().join('/');
  throw new Error(
    travados[0].status === 'aprovado'
      ? `O contas a pagar de ${dia} está aprovado e não pode ser alterado.`
      : `O contas a pagar de ${dia} está em aprovação e não pode ser alterado.`,
  );
}
