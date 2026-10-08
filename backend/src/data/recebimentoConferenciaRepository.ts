/**
 * Recebimento — persistência local da conferência às cegas.
 */

import { prisma } from '../config/prisma.js';
import { PERMISSOES } from '../config/permissoes.js';
import { isGrupoMasterNome, isSuperLogin } from '../config/grupoMaster.js';
import {
  RECEBIMENTO_STATUS,
  type RecebimentoStatus,
} from './recebimentoNomusRepository.js';

function parsePermissoesJSON(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter((p): p is string => typeof p === 'string');
  } catch {
    return [];
  }
}

export type RecebimentoConferenciaLocal = {
  id: number;
  idDocumentoEstoque: number;
  numeroDocumento: string | null;
  status: RecebimentoStatus;
  conferenteUsuarioId: number | null;
  conferenteLogin: string | null;
  conferenteNome: string | null;
  atribuidoEm: Date | null;
  atribuidoPorUsuarioId: number | null;
  atribuidoPorLogin: string | null;
  finalizadoEm: Date | null;
  mesaUltimaAcao: string | null;
  mesaAcaoEm: Date | null;
  mesaAcaoPorUsuarioId: number | null;
  mesaAcaoPorLogin: string | null;
  idDocumentoDevolucaoNomus: number | null;
  numeroDocumentoDevolucao: string | null;
  numeroNfeDevolucao: string | null;
  devolucaoVinculadaEm: Date | null;
};

export type RecebimentoConferenteOpcao = {
  id: number;
  login: string;
  nome: string | null;
};

function asStatus(raw: string): RecebimentoStatus {
  const vals = Object.values(RECEBIMENTO_STATUS) as string[];
  if (vals.includes(raw)) return raw as RecebimentoStatus;
  return RECEBIMENTO_STATUS.AGUARDANDO_CONFERENTE;
}

function mapRow(row: {
  id: number;
  idDocumentoEstoque: number;
  numeroDocumento: string | null;
  status: string;
  conferenteUsuarioId: number | null;
  conferenteLogin: string | null;
  conferenteNome: string | null;
  atribuidoEm: Date | null;
  atribuidoPorUsuarioId: number | null;
  atribuidoPorLogin: string | null;
  finalizadoEm: Date | null;
  mesaUltimaAcao: string | null;
  mesaAcaoEm: Date | null;
  mesaAcaoPorUsuarioId: number | null;
  mesaAcaoPorLogin: string | null;
  idDocumentoDevolucaoNomus: number | null;
  numeroDocumentoDevolucao: string | null;
  numeroNfeDevolucao: string | null;
  devolucaoVinculadaEm: Date | null;
}): RecebimentoConferenciaLocal {
  return {
    id: row.id,
    idDocumentoEstoque: row.idDocumentoEstoque,
    numeroDocumento: row.numeroDocumento,
    status: asStatus(row.status),
    conferenteUsuarioId: row.conferenteUsuarioId,
    conferenteLogin: row.conferenteLogin,
    conferenteNome: row.conferenteNome,
    atribuidoEm: row.atribuidoEm,
    atribuidoPorUsuarioId: row.atribuidoPorUsuarioId,
    atribuidoPorLogin: row.atribuidoPorLogin,
    finalizadoEm: row.finalizadoEm,
    mesaUltimaAcao: row.mesaUltimaAcao,
    mesaAcaoEm: row.mesaAcaoEm,
    mesaAcaoPorUsuarioId: row.mesaAcaoPorUsuarioId,
    mesaAcaoPorLogin: row.mesaAcaoPorLogin,
    idDocumentoDevolucaoNomus: row.idDocumentoDevolucaoNomus,
    numeroDocumentoDevolucao: row.numeroDocumentoDevolucao,
    numeroNfeDevolucao: row.numeroNfeDevolucao,
    devolucaoVinculadaEm: row.devolucaoVinculadaEm,
  };
}

export async function listarConferenciasPorStatus(
  status: RecebimentoStatus
): Promise<RecebimentoConferenciaLocal[]> {
  const rows = await prisma.recebimentoConferencia.findMany({
    where: { status },
    orderBy: { id: 'asc' },
  });
  return rows.map(mapRow);
}

/** Conferência ok: a Mesa trocou o tipo no Nomus. Fecha o documento e preserva a contagem no histórico. */
export async function concluirConferenciaPorMovimentacaoAlterada(
  conferenciaId: number
): Promise<RecebimentoConferenciaLocal> {
  const existente = await prisma.recebimentoConferencia.findUnique({
    where: { id: conferenciaId },
  });
  if (!existente) {
    throw new Error('Conferência não encontrada.');
  }
  const agora = new Date();
  const row = await prisma.recebimentoConferencia.update({
    where: { id: conferenciaId },
    data: {
      status: RECEBIMENTO_STATUS.FINALIZADO,
      finalizadoEm: existente.finalizadoEm ?? agora,
      mesaUltimaAcao: 'MOVIMENTACAO_ALTERADA',
      mesaAcaoEm: agora,
    },
  });
  return mapRow(row);
}

export async function listarConferenciasPorDocumentos(
  ids: number[]
): Promise<Map<number, RecebimentoConferenciaLocal>> {
  const map = new Map<number, RecebimentoConferenciaLocal>();
  if (ids.length === 0) return map;
  const rows = await prisma.recebimentoConferencia.findMany({
    where: { idDocumentoEstoque: { in: ids } },
  });
  for (const row of rows) {
    map.set(row.idDocumentoEstoque, mapRow(row));
  }
  return map;
}

export async function obterConferenciaPorDocumento(
  idDocumentoEstoque: number
): Promise<RecebimentoConferenciaLocal | null> {
  const row = await prisma.recebimentoConferencia.findUnique({
    where: { idDocumentoEstoque },
  });
  return row ? mapRow(row) : null;
}

function usuarioEhConferente(opts: {
  login: string;
  grupoNome: string | null;
  grupoAtivo: boolean | null;
  grupoPermissoes: string | null;
  usuarioPermissoes: string | null;
}): boolean {
  if (isSuperLogin(opts.login) || isGrupoMasterNome(opts.grupoNome)) return true;
  if (opts.grupoAtivo === false) return false;
  const union = new Set([
    ...parsePermissoesJSON(opts.grupoPermissoes),
    ...parsePermissoesJSON(opts.usuarioPermissoes),
  ]);
  return (
    union.has(PERMISSOES.RECEBIMENTO_CONFERENTE) || union.has(PERMISSOES.RECEBIMENTO_TOTAL)
  );
}

export async function listarConferentesRecebimento(): Promise<RecebimentoConferenteOpcao[]> {
  const usuarios = await prisma.usuario.findMany({
    where: { ativo: true },
    select: {
      id: true,
      login: true,
      nome: true,
      permissoes: true,
      grupo: { select: { nome: true, ativo: true, permissoes: true } },
    },
    orderBy: [{ nome: 'asc' }, { login: 'asc' }],
  });

  return usuarios
    .filter((u) =>
      usuarioEhConferente({
        login: u.login,
        grupoNome: u.grupo?.nome ?? null,
        grupoAtivo: u.grupo?.ativo ?? null,
        grupoPermissoes: u.grupo?.permissoes ?? null,
        usuarioPermissoes: u.permissoes,
      })
    )
    .map((u) => ({ id: u.id, login: u.login, nome: u.nome }));
}

export async function deliberarConferente(params: {
  idDocumentoEstoque: number;
  numeroDocumento: string | null;
  conferente: RecebimentoConferenteOpcao;
  atribuidoPor: { id: number; login: string };
  mesaAcao?: string;
  /** Reenvio da Mesa: apaga só os itens com divergência e mantém os já conferidos. */
  preservarItensConferidos?: boolean;
}): Promise<RecebimentoConferenciaLocal> {
  const existente = await prisma.recebimentoConferencia.findUnique({
    where: { idDocumentoEstoque: params.idDocumentoEstoque },
  });
  if (existente && asStatus(existente.status) === RECEBIMENTO_STATUS.FINALIZADO) {
    throw new Error('Esta conferência já foi finalizada. Reabra antes de deliberar novamente.');
  }

  const agora = new Date();
  const row = await prisma.$transaction(async (tx) => {
    if (existente?.finalizadoEm) {
      const itens = await tx.recebimentoConferenciaItem.findMany({
        where: { conferenciaId: existente.id },
        orderBy: { id: 'asc' },
      });
      if (itens.length > 0) {
        await tx.recebimentoConferenciaCiclo.create({
          data: {
            conferenciaId: existente.id,
            statusRetorno: existente.status,
            conferenteUsuarioId: existente.conferenteUsuarioId,
            conferenteLogin: existente.conferenteLogin,
            conferenteNome: existente.conferenteNome,
            atribuidoEm: existente.atribuidoEm,
            finalizadoEm: existente.finalizadoEm,
            itensJson: JSON.stringify(itens.map(mapItem)),
          },
        });
      }
    }

    const atualizado = await tx.recebimentoConferencia.upsert({
      where: { idDocumentoEstoque: params.idDocumentoEstoque },
      create: {
        idDocumentoEstoque: params.idDocumentoEstoque,
        numeroDocumento: params.numeroDocumento,
        status: RECEBIMENTO_STATUS.EM_CONFERENCIA,
        conferenteUsuarioId: params.conferente.id,
        conferenteLogin: params.conferente.login,
        conferenteNome: params.conferente.nome,
        atribuidoEm: agora,
        atribuidoPorUsuarioId: params.atribuidoPor.id,
        atribuidoPorLogin: params.atribuidoPor.login,
        mesaUltimaAcao: params.mesaAcao ?? null,
        mesaAcaoEm: params.mesaAcao ? agora : null,
        mesaAcaoPorUsuarioId: params.mesaAcao ? params.atribuidoPor.id : null,
        mesaAcaoPorLogin: params.mesaAcao ? params.atribuidoPor.login : null,
      },
      update: {
        numeroDocumento: params.numeroDocumento,
        status: RECEBIMENTO_STATUS.EM_CONFERENCIA,
        conferenteUsuarioId: params.conferente.id,
        conferenteLogin: params.conferente.login,
        conferenteNome: params.conferente.nome,
        atribuidoEm: agora,
        atribuidoPorUsuarioId: params.atribuidoPor.id,
        atribuidoPorLogin: params.atribuidoPor.login,
        iniciadoEm: null,
        finalizadoEm: null,
        mesaUltimaAcao: params.mesaAcao ?? null,
        mesaAcaoEm: params.mesaAcao ? agora : null,
        mesaAcaoPorUsuarioId: params.mesaAcao ? params.atribuidoPor.id : null,
        mesaAcaoPorLogin: params.mesaAcao ? params.atribuidoPor.login : null,
        idDocumentoDevolucaoNomus: null,
        numeroDocumentoDevolucao: null,
        numeroNfeDevolucao: null,
        devolucaoVinculadaEm: null,
      },
    });
    if (existente) {
      await tx.recebimentoConferenciaItem.deleteMany({
        where: params.preservarItensConferidos
          ? { conferenciaId: atualizado.id, conferido: false }
          : { conferenciaId: atualizado.id },
      });
    }
    return atualizado;
  });
  return mapRow(row);
}

export async function listarPendenciasConferente(
  conferenteUsuarioId: number
): Promise<RecebimentoConferenciaLocal[]> {
  const rows = await prisma.recebimentoConferencia.findMany({
    where: {
      conferenteUsuarioId,
      status: RECEBIMENTO_STATUS.EM_CONFERENCIA,
    },
    orderBy: [{ atribuidoEm: 'desc' }, { id: 'desc' }],
  });
  return rows.map(mapRow);
}

export const RECEBIMENTO_TENTATIVAS_MAX = 3;

export function qtdeFisicaConfere(informada: number, esperada: number): boolean {
  if (!Number.isFinite(informada) || !Number.isFinite(esperada)) return false;
  return Math.abs(Number(informada.toFixed(4)) - Number(esperada.toFixed(4))) < 0.00005;
}

export type RecebimentoContagemLinha = {
  id: number;
  codigoInformado: string;
  qtdeInformada: number;
  idItemDocumento: number | null;
  idProduto: number | null;
  descricaoProduto: string | null;
  unidadeMedida: string | null;
  tentativas: number;
  conferido: boolean;
};

function mapItem(row: {
  id: number;
  codigoInformado: string;
  qtdeInformada: number;
  idItemDocumento: number | null;
  idProduto: number | null;
  descricaoProduto: string | null;
  unidadeMedida: string | null;
  tentativas: number;
  conferido: boolean;
}): RecebimentoContagemLinha {
  return {
    id: row.id,
    codigoInformado: row.codigoInformado,
    qtdeInformada: row.qtdeInformada,
    idItemDocumento: row.idItemDocumento,
    idProduto: row.idProduto,
    descricaoProduto: row.descricaoProduto,
    unidadeMedida: row.unidadeMedida,
    tentativas: row.tentativas,
    conferido: row.conferido,
  };
}

export async function listarItensContagem(conferenciaId: number): Promise<RecebimentoContagemLinha[]> {
  const rows = await prisma.recebimentoConferenciaItem.findMany({
    where: { conferenciaId },
    orderBy: { id: 'asc' },
  });
  return rows.map(mapItem);
}

export type RecebimentoCicloArquivado = {
  status: RecebimentoStatus;
  conferenteUsuarioId: number | null;
  conferenteLogin: string | null;
  conferenteNome: string | null;
  atribuidoEm: Date | null;
  finalizadoEm: Date | null;
  itens: RecebimentoContagemLinha[];
};

function mapCicloArquivado(ciclo: {
  statusRetorno: string;
  conferenteUsuarioId: number | null;
  conferenteLogin: string | null;
  conferenteNome: string | null;
  atribuidoEm: Date | null;
  finalizadoEm: Date | null;
  itensJson: string;
}): RecebimentoCicloArquivado {
  let itens: RecebimentoContagemLinha[] = [];
  try {
    const parsed = JSON.parse(ciclo.itensJson) as unknown;
    if (Array.isArray(parsed)) itens = parsed as RecebimentoContagemLinha[];
  } catch {
    itens = [];
  }
  return {
    status: asStatus(ciclo.statusRetorno),
    conferenteUsuarioId: ciclo.conferenteUsuarioId,
    conferenteLogin: ciclo.conferenteLogin,
    conferenteNome: ciclo.conferenteNome,
    atribuidoEm: ciclo.atribuidoEm,
    finalizadoEm: ciclo.finalizadoEm,
    itens,
  };
}

export async function listarCiclosConferencia(
  conferenciaId: number
): Promise<RecebimentoCicloArquivado[]> {
  const ciclos = await prisma.recebimentoConferenciaCiclo.findMany({
    where: { conferenciaId },
    orderBy: [{ finalizadoEm: 'asc' }, { id: 'asc' }],
  });
  return ciclos.map(mapCicloArquivado);
}

export async function obterUltimoCicloConferencia(
  conferenciaId: number
): Promise<RecebimentoCicloArquivado | null> {
  const ciclos = await listarCiclosConferencia(conferenciaId);
  return ciclos.length > 0 ? ciclos[ciclos.length - 1] : null;
}

export async function registrarAcaoMesa(params: {
  conferenciaId: number;
  acao: string;
  status: RecebimentoStatus;
  usuario: { id: number; login: string };
  devolucao?: {
    idDocumento: number;
    numeroDocumentoFiscal: string | null;
    numeroNfe: string | null;
  } | null;
}): Promise<RecebimentoConferenciaLocal> {
  const agora = new Date();
  const row = await prisma.recebimentoConferencia.update({
    where: { id: params.conferenciaId },
    data: {
      status: params.status,
      mesaUltimaAcao: params.acao,
      mesaAcaoEm: agora,
      mesaAcaoPorUsuarioId: params.usuario.id,
      mesaAcaoPorLogin: params.usuario.login,
      idDocumentoDevolucaoNomus: params.devolucao?.idDocumento ?? null,
      numeroDocumentoDevolucao: params.devolucao?.numeroDocumentoFiscal ?? null,
      numeroNfeDevolucao: params.devolucao?.numeroNfe ?? null,
      devolucaoVinculadaEm: params.devolucao ? agora : null,
    },
  });
  return mapRow(row);
}

export async function vincularDocumentoDevolucao(params: {
  conferenciaId: number;
  idDocumento: number;
  numeroDocumentoFiscal: string | null;
  numeroNfe: string | null;
}): Promise<RecebimentoConferenciaLocal> {
  const agora = new Date();
  const row = await prisma.recebimentoConferencia.update({
    where: { id: params.conferenciaId },
    data: {
      status: RECEBIMENTO_STATUS.DEVOLUCAO_VINCULADA,
      idDocumentoDevolucaoNomus: params.idDocumento,
      numeroDocumentoDevolucao: params.numeroDocumentoFiscal,
      numeroNfeDevolucao: params.numeroNfe,
      devolucaoVinculadaEm: agora,
    },
  });
  return mapRow(row);
}

export async function registrarTentativaContagem(params: {
  conferenciaId: number;
  idItemDocumento: number;
  codigoInformado: string;
  qtdeInformada: number;
  idProduto: number | null;
  descricaoProduto: string | null;
  unidadeMedida: string | null;
  acertou: boolean;
}): Promise<{ tentativas: number; conferido: boolean; esgotado: boolean }> {
  const existente = await prisma.recebimentoConferenciaItem.findFirst({
    where: { conferenciaId: params.conferenciaId, idItemDocumento: params.idItemDocumento },
  });
  if (existente?.conferido) {
    throw new Error('Este item já foi conferido.');
  }
  if ((existente?.tentativas ?? 0) >= RECEBIMENTO_TENTATIVAS_MAX) {
    throw new Error('As 3 tentativas deste item já foram usadas.');
  }

  const tentativas = (existente?.tentativas ?? 0) + 1;
  const conferido = params.acertou;
  const data = {
    codigoInformado: params.codigoInformado,
    qtdeInformada: params.qtdeInformada,
    idProduto: params.idProduto,
    descricaoProduto: params.descricaoProduto,
    unidadeMedida: params.unidadeMedida,
    tentativas,
    conferido,
  };

  if (existente) {
    await prisma.recebimentoConferenciaItem.update({ where: { id: existente.id }, data });
  } else {
    await prisma.recebimentoConferenciaItem.create({
      data: {
        conferenciaId: params.conferenciaId,
        idItemDocumento: params.idItemDocumento,
        ...data,
      },
    });
  }

  await prisma.recebimentoConferencia.updateMany({
    where: { id: params.conferenciaId, iniciadoEm: null },
    data: { iniciadoEm: new Date() },
  });

  return {
    tentativas,
    conferido,
    esgotado: !conferido && tentativas >= RECEBIMENTO_TENTATIVAS_MAX,
  };
}

export async function devolverConferenciaParaMesa(
  conferenciaId: number,
  status: RecebimentoStatus = RECEBIMENTO_STATUS.CONFERIDO
): Promise<RecebimentoConferenciaLocal> {
  const row = await prisma.recebimentoConferencia.update({
    where: { id: conferenciaId },
    data: {
      status,
      finalizadoEm: new Date(),
    },
  });
  return mapRow(row);
}
