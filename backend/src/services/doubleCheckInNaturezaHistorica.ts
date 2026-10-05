import { prisma } from '../config/prisma.js';
import {
  queryLinhasComparativoPorDocumentos,
  type DoubleCheckInComparativoLinha,
} from '../data/doubleCheckInRepository.js';
import { JUSTIFICATIVA_SEED } from '../data/doubleCheckInJustificativas.js';
import type { DoubleCheckInCampoComparativo } from '../data/doubleCheckInLocalRepository.js';
import type { CampoRelato, RelatoConferencia } from './doubleCheckInConferenciaRelato.js';
import {
  classificarNaturezaDivergencia,
  justificativaIndicaDivergenciaBenigna,
  type NaturezaDivergencia,
} from './doubleCheckInNatureza.js';

function normalizarLabel(valor: string | null | undefined): string {
  return (valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

const CODIGO_POR_LABEL = new Map(
  JUSTIFICATIVA_SEED.map((item) => [normalizarLabel(item.label), item.codigo])
);

export function parseNumeroPtBr(valor: string | null | undefined): number | null {
  const texto = (valor ?? '').replace(/−/g, '-').trim();
  if (!texto || texto === '—') return null;
  const negativo = texto.includes('-');
  const match = texto.match(/[\d.]+(?:,\d+)?/);
  if (!match) return null;
  const numero = Number(match[0].replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(numero) ? (negativo ? -numero : numero) : null;
}

function codigoJustificativa(campo: CampoRelato): string | null {
  const gravado = campo.justificativaCodigo?.trim();
  if (gravado) return gravado;
  return CODIGO_POR_LABEL.get(normalizarLabel(campo.justificativa)) ?? null;
}

function classificarCampoRelato(campo: CampoRelato): NaturezaDivergencia {
  const linha: {
    valorUnitarioNF?: number;
    valorUnitarioPC?: number;
    valorIpiNF?: number;
    valorIpiPC?: number;
    qtdeNF?: number;
    qtdePC?: number;
    prazosDiasNF?: number[];
    prazosDiasPC?: number[];
  } = {};

  if (campo.campo === 'valor_unitario') {
    linha.valorUnitarioNF = parseNumeroPtBr(campo.nf) ?? 1;
    linha.valorUnitarioPC = parseNumeroPtBr(campo.pc) ?? 0;
  } else if (campo.campo === 'ipi') {
    linha.valorIpiNF = parseNumeroPtBr(campo.nf) ?? 1;
    linha.valorIpiPC = parseNumeroPtBr(campo.pc) ?? 0;
  } else if (campo.campo === 'qtde') {
    linha.qtdeNF = parseNumeroPtBr(campo.nf) ?? 0;
    linha.qtdePC = parseNumeroPtBr(campo.pc) ?? 0;
  } else {
    const prazos = campo.tabelaPrazos?.linhas ?? [];
    linha.prazosDiasNF = prazos
      .map((item) => item.diasNF)
      .filter((dias): dias is number => Number.isFinite(dias));
    linha.prazosDiasPC = prazos
      .map((item) => item.diasPC)
      .filter((dias): dias is number => Number.isFinite(dias));
  }

  return classificarNaturezaDivergencia({
    linha,
    campo: campo.campo,
    justificativaCodigo: codigoJustificativa(campo),
  });
}

export function reclassificarRelatoHistorico(relato: RelatoConferencia): RelatoConferencia {
  const reclassificarCampo = (campo: CampoRelato): CampoRelato => ({
    ...campo,
    natureza: classificarCampoRelato(campo),
    justificativaCodigo: codigoJustificativa(campo) ?? undefined,
  });
  const pagamentoComum = relato.pagamentoComum
    ? reclassificarCampo(relato.pagamentoComum)
    : null;
  const produtos = relato.produtos.map((produto) => ({
    ...produto,
    campos: produto.campos.map(reclassificarCampo),
  }));
  const campos = [
    ...(pagamentoComum ? [pagamentoComum] : []),
    ...produtos.flatMap((produto) => produto.campos),
  ];
  const totalDivergenciasReais = campos.filter((campo) => campo.natureza === 'real').length;
  const totalDivergenciasBenignas = campos.length - totalDivergenciasReais;
  return {
    ...relato,
    schemaVersion: 2,
    pagamentoComum,
    produtos,
    totalDivergencias: campos.length,
    totalDivergenciasReais,
    totalDivergenciasBenignas,
  };
}

function chaveDecisao(
  idItemDocumentoEstoque: number,
  idItemPedidoCompra: number,
  campo: string
): string {
  return `${idItemDocumentoEstoque}:${idItemPedidoCompra}:${campo}`;
}

function campoAindaDiverge(
  linha: DoubleCheckInComparativoLinha,
  campo: DoubleCheckInCampoComparativo
): boolean {
  if (campo === 'valor_unitario') return linha.divergValorUnitario;
  if (campo === 'qtde') return linha.divergQtde;
  if (campo === 'ipi') return linha.divergIpi;
  return linha.divergCondicaoPagamento;
}

export type ResultadoBackfillNaturezaHistorica = {
  totalConferidas: number;
  porSnapshot: number;
  porDecisoesAtuais: number;
  porDecisoesHeuristica: number;
  semDecisoes: number;
  comDivergenciaReal: number;
  falhas: Array<{ idDocumentoEstoque: number; erro: string }>;
};

export async function executarBackfillNaturezaHistorica(params?: {
  dryRun?: boolean;
}): Promise<ResultadoBackfillNaturezaHistorica> {
  const dryRun = Boolean(params?.dryRun);
  const conferidas = await prisma.doubleCheckInConferido.findMany({
    orderBy: { idDocumentoEstoque: 'asc' },
  });
  const ids = conferidas.map((item) => item.idDocumentoEstoque);
  const idsSet = new Set(ids);
  const [paginas, decisoes, linhasResp] = await Promise.all([
    prisma.doubleCheckInConferenciaPagina.findMany(),
    prisma.doubleCheckInComparativoDecisao.findMany({
      include: { justificativaOpcao: { select: { codigo: true } } },
    }),
    queryLinhasComparativoPorDocumentos(ids),
  ]);
  const paginaPorDoc = new Map(
    paginas
      .filter((pagina) => idsSet.has(pagina.idDocumentoEstoque))
      .map((pagina) => [pagina.idDocumentoEstoque, pagina])
  );
  const decisoesPorDoc = new Map<number, typeof decisoes>();
  for (const decisao of decisoes) {
    if (!idsSet.has(decisao.idDocumentoEstoque)) continue;
    const lista = decisoesPorDoc.get(decisao.idDocumentoEstoque) ?? [];
    lista.push(decisao);
    decisoesPorDoc.set(decisao.idDocumentoEstoque, lista);
  }

  const resultado: ResultadoBackfillNaturezaHistorica = {
    totalConferidas: conferidas.length,
    porSnapshot: 0,
    porDecisoesAtuais: 0,
    porDecisoesHeuristica: 0,
    semDecisoes: 0,
    comDivergenciaReal: 0,
    falhas: [],
  };

  for (const conferida of conferidas) {
    const idDocumentoEstoque = conferida.idDocumentoEstoque;
    try {
      const pagina = paginaPorDoc.get(idDocumentoEstoque);
      let totalReais = 0;
      let totalBenignas = 0;
      let fonte = 'sem_decisoes';

      if (pagina) {
        const relato = reclassificarRelatoHistorico(
          JSON.parse(pagina.payloadJson) as RelatoConferencia
        );
        totalReais = relato.totalDivergenciasReais;
        totalBenignas = relato.totalDivergenciasBenignas;
        fonte = 'snapshot';
        resultado.porSnapshot += 1;
        if (!dryRun) {
          await prisma.doubleCheckInConferenciaPagina.update({
            where: { id: pagina.id },
            data: { payloadJson: JSON.stringify(relato) },
          });
        }
      } else {
        const decisoesDoc = decisoesPorDoc.get(idDocumentoEstoque) ?? [];
        if (decisoesDoc.length === 0) {
          resultado.semDecisoes += 1;
        } else {
          const linhas = linhasResp.linhasPorDocumento.get(idDocumentoEstoque) ?? [];
          const linhasMap = new Map(
            linhas.map((linha) => [
              `${linha.idItemDocumentoEstoque}:${linha.idItemPedidoCompra}`,
              linha,
            ])
          );
          let usouAtual = false;
          const naturezas = new Map<string, NaturezaDivergencia>();
          for (const decisao of decisoesDoc) {
            const campo = decisao.campo as DoubleCheckInCampoComparativo;
            const linha = linhasMap.get(
              `${decisao.idItemDocumentoEstoque}:${decisao.idItemPedidoCompra}`
            );
            let natureza: NaturezaDivergencia;
            if (linha && campoAindaDiverge(linha, campo)) {
              natureza = classificarNaturezaDivergencia({
                linha,
                campo,
                justificativaCodigo: decisao.justificativaOpcao.codigo,
              });
              usouAtual = true;
            } else {
              natureza = justificativaIndicaDivergenciaBenigna(
                decisao.justificativaOpcao.codigo
              )
                ? 'benigna'
                : 'real';
            }
            const chave =
              campo === 'condicao_pagamento'
                ? `${campo}:${decisao.justificativaOpcao.codigo}:${decisao.decisao}`
                : chaveDecisao(
                    decisao.idItemDocumentoEstoque,
                    decisao.idItemPedidoCompra,
                    campo
                  );
            naturezas.set(chave, natureza);
          }
          totalReais = [...naturezas.values()].filter((item) => item === 'real').length;
          totalBenignas = naturezas.size - totalReais;
          fonte = usouAtual ? 'decisoes_estado_atual' : 'decisoes_heuristica';
          if (usouAtual) resultado.porDecisoesAtuais += 1;
          else resultado.porDecisoesHeuristica += 1;
        }
      }

      if (totalReais > 0) resultado.comDivergenciaReal += 1;
      if (!dryRun) {
        await prisma.doubleCheckInConferido.update({
          where: { idDocumentoEstoque },
          data: {
            temDivergenciaRealHistorica: totalReais > 0,
            totalDivergenciasReaisHistorica: totalReais,
            totalDivergenciasBenignasHist: totalBenignas,
            naturezaClassificacaoFonte: fonte,
            naturezaClassificadaEm: new Date(),
          },
        });
      }
    } catch (err) {
      resultado.falhas.push({
        idDocumentoEstoque,
        erro: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return resultado;
}
