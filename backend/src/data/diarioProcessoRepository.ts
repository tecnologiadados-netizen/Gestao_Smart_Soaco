/**
 * Processo do contas a pagar: um por dia de vencimento, gravado só neste projeto.
 */

import { prisma } from '../config/prisma.js';

export const STATUS_PROCESSO = ['rascunho', 'em_aprovacao', 'aprovado', 'em_correcao'] as const;
export type StatusProcessoDiario = (typeof STATUS_PROCESSO)[number];

const STATUS_TRAVADOS = new Set<StatusProcessoDiario>(['em_aprovacao', 'aprovado']);

const DIAS_SEMANA = ['Domingo', 'Segunda Feira', 'Terça Feira', 'Quarta Feira', 'Quinta Feira', 'Sexta Feira', 'Sábado'] as const;

export function descricaoPadraoContasPagar(ymd: string): string {
  const [ano, mes, dia] = ymd.split('-').map((parte) => Number(parte));
  if (!ano || !mes || !dia) return '';
  const data = new Date(ano, mes - 1, dia);
  if (Number.isNaN(data.getTime())) return '';
  const dd = String(dia).padStart(2, '0');
  const mm = String(mes).padStart(2, '0');
  return `Contas a Pagar - ${dd}/${mm} - ${DIAS_SEMANA[data.getDay()]}`;
}

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
  criadoEm: string;
  editavel: boolean;
  totalAprovado: number;
}

export interface DiarioProcessoHistoricoDto {
  id: number;
  acao: string;
  statusAnterior: string | null;
  statusNovo: string;
  usuario: string;
  detalhe: string | null;
  criadoEm: string;
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
  criadoEm: Date;
};

function iso(data: Date | null): string | null {
  return data ? data.toISOString() : null;
}

export function processoEditavel(status: string): boolean {
  return status === 'rascunho' || status === 'em_correcao';
}

function dto(row: Row, totalAprovado = 0): DiarioProcessoDto {
  const status = STATUS_PROCESSO.includes(row.status as StatusProcessoDiario)
    ? (row.status as StatusProcessoDiario)
    : 'rascunho';
  return {
    id: row.id,
    codigo: row.codigo,
    dataVencimento: row.dataVencimento,
    descricao: descricaoPadraoContasPagar(row.dataVencimento) || row.descricao,
    usuario: row.usuario,
    status,
    motivoDevolucao: row.motivoDevolucao,
    aprovadoPor: row.aprovadoPor,
    aprovadoEm: iso(row.aprovadoEm),
    enviadoEm: iso(row.enviadoEm),
    criadoEm: row.criadoEm.toISOString(),
    editavel: processoEditavel(status),
    totalAprovado: status === 'aprovado' ? totalAprovado : 0,
  };
}

export async function listarProcessosDiario(): Promise<DiarioProcessoDto[]> {
  const [rows, totais] = await Promise.all([
    prisma.diarioContasPagarProcesso.findMany({
      orderBy: [{ dataVencimento: 'desc' }, { codigo: 'desc' }],
    }),
    prisma.diarioContasPagarAprovacao.groupBy({
      by: ['processoId'],
      where: { banco: { not: '' } },
      _sum: { saldo: true },
    }),
  ]);
  const totalPorProcesso = new Map(totais.map((item) => [item.processoId, item._sum.saldo ?? 0]));
  return rows.map((row) => dto(row, totalPorProcesso.get(row.id) ?? 0));
}

export async function obterProcessoDiario(id: number): Promise<DiarioProcessoDto | null> {
  const [row, total] = await Promise.all([
    prisma.diarioContasPagarProcesso.findUnique({ where: { id } }),
    prisma.diarioContasPagarAprovacao.aggregate({
      where: { processoId: id, banco: { not: '' } },
      _sum: { saldo: true },
    }),
  ]);
  return row ? dto(row, total._sum.saldo ?? 0) : null;
}

export async function listarHistoricoProcessoDiario(
  processoId: number,
): Promise<DiarioProcessoHistoricoDto[]> {
  const itens = await prisma.diarioContasPagarProcessoHistorico.findMany({
    where: { processoId },
    orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }],
  });
  return itens.map((item) => ({
    id: item.id,
    acao: item.acao,
    statusAnterior: item.statusAnterior,
    statusNovo: item.statusNovo,
    usuario: item.usuario,
    detalhe: item.detalhe,
    criadoEm: item.criadoEm.toISOString(),
  }));
}

export async function iniciarProcessoDiario(input: {
  dataVencimento: string;
  descricao: string;
  usuario: string;
}): Promise<{ processo: DiarioProcessoDto; existente: boolean }> {
  const descricao = descricaoPadraoContasPagar(input.dataVencimento);
  if (!descricao) throw new Error('Informe a data de vencimento.');

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
      await tx.diarioContasPagarProcessoHistorico.create({
        data: {
          processoId: row.id,
          acao: 'Processo iniciado',
          statusNovo: 'rascunho',
          usuario: input.usuario,
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

export async function atualizarDescricaoProcessoDiario(id: number): Promise<DiarioProcessoDto> {
  const atual = await prisma.diarioContasPagarProcesso.findUnique({ where: { id } });
  if (!atual) throw new Error('Processo não encontrado.');
  const descricao = descricaoPadraoContasPagar(atual.dataVencimento);
  if (!descricao) throw new Error('Informe a data de vencimento.');
  if (!processoEditavel(atual.status)) {
    throw new Error('Este contas a pagar não pode ser alterado neste status.');
  }
  const salvo = await prisma.diarioContasPagarProcesso.update({
    where: { id },
    data: { descricao },
  });
  return dto(salvo);
}

export async function enviarProcessoDiarioAprovacao(id: number, usuario: string): Promise<DiarioProcessoDto> {
  const atual = await prisma.diarioContasPagarProcesso.findUnique({ where: { id } });
  if (!atual) throw new Error('Processo não encontrado.');
  if (!processoEditavel(atual.status)) {
    throw new Error('Só um rascunho ou uma correção pode ser enviado para aprovação.');
  }
  const salvo = await prisma.$transaction(async (tx) => {
    const alterado = await tx.diarioContasPagarProcesso.updateMany({
      where: { id, status: { in: ['rascunho', 'em_correcao'] } },
      data: { status: 'em_aprovacao', enviadoEm: new Date(), motivoDevolucao: null },
    });
    if (alterado.count !== 1) {
      throw new Error('O status deste contas a pagar mudou. Atualize a tela e tente novamente.');
    }
    await tx.diarioContasPagarProcessoHistorico.create({
      data: {
        processoId: id,
        acao: 'Enviado para aprovação',
        statusAnterior: atual.status,
        statusNovo: 'em_aprovacao',
        usuario,
      },
    });
    const processo = await tx.diarioContasPagarProcesso.findUnique({ where: { id } });
    if (!processo) throw new Error('Processo não encontrado.');
    return processo;
  });
  return dto(salvo);
}

export type DiarioAprovacaoItem = {
  origem: 'Nomus' | 'Shop9';
  codigo: number;
  banco: string;
  fornecedor: string | null;
  empresa: string | null;
  descricao: string | null;
  vencimento: string | null;
  saldo: number;
};

export type DiarioAprovacaoResultadoItem = {
  origem: 'Nomus' | 'Shop9';
  codigo: number;
  banco: string;
  status: 'Aprovado' | 'Reprogramado';
};

export async function listarResultadoAprovacaoProcesso(
  processoId: number,
): Promise<DiarioAprovacaoResultadoItem[]> {
  const itens = await prisma.diarioContasPagarAprovacao.findMany({
    where: { processoId },
    select: { origem: true, codigo: true, banco: true },
    orderBy: { id: 'asc' },
  });
  return itens.flatMap((item) =>
    item.origem === 'Nomus' || item.origem === 'Shop9'
      ? [{
          origem: item.origem,
          codigo: item.codigo,
          banco: item.banco,
          status: item.banco.trim() ? 'Aprovado' as const : 'Reprogramado' as const,
        }]
      : [],
  );
}

export async function aprovarProcessoDiario(
  id: number,
  usuario: string,
  itens: DiarioAprovacaoItem[],
): Promise<DiarioProcessoDto> {
  const atual = await prisma.diarioContasPagarProcesso.findUnique({ where: { id } });
  if (!atual) throw new Error('Processo não encontrado.');
  if (atual.status !== 'em_aprovacao') {
    throw new Error('Só um contas a pagar em aprovação pode ser aprovado.');
  }
  if (itens.length === 0) throw new Error('Selecione ao menos uma conta para aprovar.');
  const aprovadoEm = new Date();
  const salvo = await prisma.$transaction(async (tx) => {
    const alterado = await tx.diarioContasPagarProcesso.updateMany({
      where: { id, status: 'em_aprovacao' },
      data: { status: 'aprovado', aprovadoPor: usuario, aprovadoEm },
    });
    if (alterado.count !== 1) {
      throw new Error('O status deste contas a pagar mudou. Atualize a tela e tente novamente.');
    }
    await tx.diarioContasPagarAprovacao.deleteMany({ where: { processoId: id } });
    await tx.diarioContasPagarAprovacao.createMany({
      data: itens.map((item) => ({
        processoId: id,
        origem: item.origem,
        codigo: item.codigo,
        banco: item.banco,
        fornecedor: item.fornecedor,
        empresa: item.empresa,
        descricao: item.descricao,
        vencimento: item.vencimento,
        saldo: item.saldo,
        aprovadoPor: usuario,
        aprovadoEm,
      })),
    });
    const aprovados = itens.filter((item) => item.banco).length;
    const reprogramados = itens.length - aprovados;
    const total = itens.reduce((soma, item) => soma + (item.banco ? item.saldo : 0), 0);
    await tx.diarioContasPagarProcessoHistorico.create({
      data: {
        processoId: id,
        acao: 'Processo aprovado',
        statusAnterior: 'em_aprovacao',
        statusNovo: 'aprovado',
        usuario,
        detalhe: `${aprovados} aprovado(s), ${reprogramados} reprogramado(s), total ${total.toFixed(2)}`,
      },
    });
    const processo = await tx.diarioContasPagarProcesso.findUnique({ where: { id } });
    if (!processo) throw new Error('Processo não encontrado.');
    return processo;
  });
  return dto(
    salvo,
    itens.reduce((total, item) => total + (item.banco ? item.saldo : 0), 0),
  );
}

export async function devolverProcessoDiario(
  id: number,
  motivoBruto: string,
  usuario: string,
): Promise<DiarioProcessoDto> {
  const atual = await prisma.diarioContasPagarProcesso.findUnique({ where: { id } });
  if (!atual) throw new Error('Processo não encontrado.');
  if (atual.status !== 'em_aprovacao' && atual.status !== 'aprovado') {
    throw new Error('Só um contas a pagar em aprovação ou aprovado pode voltar para correção.');
  }
  const motivo = motivoBruto.trim();
  const salvo = await prisma.$transaction(async (tx) => {
    const alterado = await tx.diarioContasPagarProcesso.updateMany({
      where: { id, status: { in: ['em_aprovacao', 'aprovado'] } },
      data: {
        status: 'em_correcao',
        motivoDevolucao: motivo || null,
        aprovadoPor: null,
        aprovadoEm: null,
      },
    });
    if (alterado.count !== 1) {
      throw new Error('O status deste contas a pagar mudou. Atualize a tela e tente novamente.');
    }
    await tx.diarioContasPagarProcessoHistorico.create({
      data: {
        processoId: id,
        acao: 'Devolvido para correção',
        statusAnterior: atual.status,
        statusNovo: 'em_correcao',
        usuario,
        detalhe: motivo || null,
      },
    });
    const processo = await tx.diarioContasPagarProcesso.findUnique({ where: { id } });
    if (!processo) throw new Error('Processo não encontrado.');
    return processo;
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
