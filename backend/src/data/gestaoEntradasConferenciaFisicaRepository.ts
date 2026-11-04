/**
 * Gestão entradas — leitura local das voltas de conferência física.
 */

import { prisma } from '../config/prisma.js';
import { RECEBIMENTO_STATUS } from './recebimentoNomusRepository.js';
import {
  agregarConferenciaFisica,
  filtrarVoltasConferenciaFisica,
  limitePeriodoSaoPaulo,
  montarVoltasNoPeriodo,
  type ItemVoltaBruta,
  type PainelConferenciaFisica,
  type RecorteConferenciaFisica,
  type VoltaBruta,
  type VoltaConferenciaFisica,
} from './gestaoEntradasConferenciaFisica.js';

export type DetalheConferenciaFisica = {
  dataInicio: string;
  dataFim: string;
  recorte: RecorteConferenciaFisica['tipo'];
  voltas: VoltaConferenciaFisica[];
};

function conferidoDe(valor: unknown): boolean {
  return valor === true || valor === 1;
}

function itensDeJson(itensJson: string): ItemVoltaBruta[] {
  try {
    const parsed = JSON.parse(itensJson) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => {
      const linha = item && typeof item === 'object' ? (item as { conferido?: unknown; tentativas?: unknown; idItemDocumento?: unknown }) : {};
      const tentativas = Number(linha.tentativas);
      const idItem = Number(linha.idItemDocumento);
      return {
        conferido: conferidoDe(linha.conferido),
        tentativas: Number.isFinite(tentativas) ? tentativas : undefined,
        idItemDocumento: Number.isFinite(idItem) && idItem > 0 ? idItem : null,
      };
    });
  } catch {
    return [];
  }
}

async function carregarVoltas(dataInicio: string, dataFim: string): Promise<VoltaBruta[]> {
  const { inicio, fimExclusivo } = limitePeriodoSaoPaulo(dataInicio, dataFim);
  const rows = await prisma.recebimentoConferencia.findMany({
    where: {
      OR: [
        { atribuidoEm: { gte: inicio, lt: fimExclusivo } },
        { ciclos: { some: { atribuidoEm: { gte: inicio, lt: fimExclusivo } } } },
      ],
    },
    include: {
      itens: { select: { conferido: true, tentativas: true, idItemDocumento: true } },
      ciclos: {
        select: {
          id: true,
          atribuidoEm: true,
          finalizadoEm: true,
          conferenteNome: true,
          conferenteLogin: true,
          itensJson: true,
        },
      },
    },
  });

  const voltas: VoltaBruta[] = [];
  for (const row of rows) {
    voltas.push({
      idDocumentoEstoque: row.idDocumentoEstoque,
      numeroDocumento: row.numeroDocumento,
      conferenteNome: row.conferenteNome,
      conferenteLogin: row.conferenteLogin,
      atribuidoEm: row.atribuidoEm,
      finalizadoEm: row.finalizadoEm,
      cancelada: row.status === RECEBIMENTO_STATUS.CANCELADO,
      itens: row.itens.map((item) => ({
        conferido: item.conferido,
        tentativas: item.tentativas,
        idItemDocumento: item.idItemDocumento,
      })),
      origem: 'atual',
      cicloId: null,
    });
    for (const ciclo of row.ciclos) {
      voltas.push({
        idDocumentoEstoque: row.idDocumentoEstoque,
        numeroDocumento: row.numeroDocumento,
        conferenteNome: ciclo.conferenteNome,
        conferenteLogin: ciclo.conferenteLogin,
        atribuidoEm: ciclo.atribuidoEm,
        finalizadoEm: ciclo.finalizadoEm,
        cancelada: false,
        itens: itensDeJson(ciclo.itensJson),
        origem: 'ciclo',
        cicloId: ciclo.id,
      });
    }
  }
  return voltas;
}

export async function queryConferenciaFisicaPainel(params: {
  dataInicio: string;
  dataFim: string;
}): Promise<{ data?: PainelConferenciaFisica; erro?: string }> {
  try {
    const brutas = await carregarVoltas(params.dataInicio, params.dataFim);
    const voltas = montarVoltasNoPeriodo(brutas, params.dataInicio, params.dataFim);
    return { data: agregarConferenciaFisica(voltas, params.dataInicio, params.dataFim) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { erro: msg };
  }
}

export async function queryConferenciaFisicaDetalhe(params: {
  dataInicio: string;
  dataFim: string;
  recorte: RecorteConferenciaFisica;
}): Promise<{ data?: DetalheConferenciaFisica; erro?: string }> {
  try {
    const brutas = await carregarVoltas(params.dataInicio, params.dataFim);
    const voltas = filtrarVoltasConferenciaFisica(
      montarVoltasNoPeriodo(brutas, params.dataInicio, params.dataFim),
      params.recorte,
    );
    return {
      data: {
        dataInicio: params.dataInicio,
        dataFim: params.dataFim,
        recorte: params.recorte.tipo,
        voltas,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { erro: msg };
  }
}
