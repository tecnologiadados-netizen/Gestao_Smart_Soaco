/**
 * Monta as linhas de comprador da gestão de entradas a partir do comparativo já lido.
 */
import { prisma } from '../config/prisma.js';
import type { DoubleCheckInComparativoLinha } from './doubleCheckInRepository.js';
import type { DecisaoGestaoEntrada, EscopoDivergenciaGestaoEntrada } from './gestaoEntradasClassificacao.js';
import {
  SEM_COMPRADOR,
  chaveAceiteComprador,
  chaveCampoComprador,
  montarLinhasComprador,
  resolverNaturezaAceita,
  type AceiteCompradorOrigem,
  type DocCompradorGestao,
  type LinhaCompradorGestao,
} from './gestaoEntradasComprador.js';
import { buscarCompradorPorItemPedido, type CompradorItemPedido } from './doubleCheckInDivergenciaApontada.js';
import { classificarNaturezaDivergencia, type NaturezaDivergencia } from '../services/doubleCheckInNatureza.js';
import type { RelatoConferencia } from '../services/doubleCheckInConferenciaRelato.js';

const CAMPOS_LINHA = [
  { campo: 'valor_unitario' as const, flag: 'divergValorUnitario' as const },
  { campo: 'qtde' as const, flag: 'divergQtde' as const },
  { campo: 'ipi' as const, flag: 'divergIpi' as const },
  { campo: 'condicao_pagamento' as const, flag: 'divergCondicaoPagamento' as const },
];

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function lerRelato(payloadJson: string): RelatoConferencia | null {
  try {
    const valor = JSON.parse(payloadJson) as RelatoConferencia;
    if (!valor || !Array.isArray(valor.produtos)) return null;
    return valor;
  } catch {
    return null;
  }
}

export async function linhasCompradorGestao(params: {
  escopo: EscopoDivergenciaGestaoEntrada;
  docs: DocCompradorGestao[];
  decisoes: DecisaoGestaoEntrada[];
  linhasPorDocumento: Map<number, DoubleCheckInComparativoLinha[]>;
  chavesAtuais: ReadonlyMap<number, ReadonlySet<string>>;
}): Promise<LinhaCompradorGestao[]> {
  const ids = params.docs.map((doc) => doc.idDocumento);
  if (ids.length === 0) return [];

  const decisoesPorCampo = new Map<string, DecisaoGestaoEntrada>();
  const chavesAceitas = new Set<string>();
  const aceitas: DecisaoGestaoEntrada[] = [];
  for (const decisao of params.decisoes) {
    if (decisao.idItemDocumentoEstoque == null || decisao.idItemPedidoCompra == null) continue;
    const chaveDoc = chaveAceiteComprador(
      decisao.idDocumentoEstoque,
      decisao.idItemDocumentoEstoque,
      decisao.idItemPedidoCompra,
      decisao.campo
    );
    decisoesPorCampo.set(
      `${decisao.idDocumentoEstoque}:${chaveCampoComprador(decisao.idItemDocumentoEstoque, decisao.idItemPedidoCompra, decisao.campo)}`,
      decisao
    );
    if (decisao.decisao === 'aceita') {
      chavesAceitas.add(chaveDoc);
      aceitas.push(decisao);
    }
  }

  const naturezaAtual = new Map<string, NaturezaDivergencia>();
  for (const [idDocumento, linhas] of params.linhasPorDocumento) {
    for (const linha of linhas) {
      for (const spec of CAMPOS_LINHA) {
        if (!linha[spec.flag]) continue;
        const chave = `${idDocumento}:${chaveCampoComprador(linha.idItemDocumentoEstoque, linha.idItemPedidoCompra, spec.campo)}`;
        const decisao = decisoesPorCampo.get(chave);
        naturezaAtual.set(
          chave,
          classificarNaturezaDivergencia({
            linha,
            campo: spec.campo,
            justificativaCodigo: decisao?.justificativaCodigo,
          })
        );
      }
    }
  }

  const idsAceiteSemLinha = [
    ...new Set(
      aceitas
        .filter((decisao) => {
          if (decisao.idItemDocumentoEstoque == null || decisao.idItemPedidoCompra == null) return false;
          const chave = `${decisao.idDocumentoEstoque}:${chaveCampoComprador(decisao.idItemDocumentoEstoque, decisao.idItemPedidoCompra, decisao.campo)}`;
          return !naturezaAtual.has(chave);
        })
        .map((decisao) => decisao.idDocumentoEstoque)
    ),
  ];

  const relatos = new Map<number, RelatoConferencia | null>();
  const realHistorica = new Set<number>();
  for (const parte of chunk(idsAceiteSemLinha, 800)) {
    if (parte.length === 0) continue;
    const [paginas, conferidos] = await Promise.all([
      prisma.doubleCheckInConferenciaPagina.findMany({
        where: { idDocumentoEstoque: { in: parte } },
        select: { idDocumentoEstoque: true, payloadJson: true },
      }),
      prisma.doubleCheckInConferido.findMany({
        where: { idDocumentoEstoque: { in: parte }, temDivergenciaRealHistorica: true },
        select: { idDocumentoEstoque: true },
      }),
    ]);
    for (const pagina of paginas) relatos.set(pagina.idDocumentoEstoque, lerRelato(pagina.payloadJson));
    for (const conferido of conferidos) realHistorica.add(conferido.idDocumentoEstoque);
  }

  let compradores = new Map<number, CompradorItemPedido>();
  try {
    compradores = await buscarCompradorPorItemPedido(
      aceitas
        .map((decisao) => decisao.idItemPedidoCompra)
        .filter((id): id is number => id != null)
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[gestaoEntradasComprador] comprador:', msg);
  }

  const pedidoNaLinha = new Map<string, { idPedidoCompra: number; nomePedidoCompra: string }>();
  for (const [idDocumento, linhas] of params.linhasPorDocumento) {
    for (const linha of linhas) {
      if (linha.idPedidoCompra == null || linha.idPedidoCompra <= 0) continue;
      pedidoNaLinha.set(`${idDocumento}:${linha.idItemPedidoCompra}`, {
        idPedidoCompra: linha.idPedidoCompra,
        nomePedidoCompra: linha.nomePedidoCompra?.trim() || `PC ${linha.idPedidoCompra}`,
      });
    }
  }

  const aceites: AceiteCompradorOrigem[] = [];
  for (const decisao of aceitas) {
    if (decisao.idItemDocumentoEstoque == null || decisao.idItemPedidoCompra == null) continue;
    const comprador = compradores.get(decisao.idItemPedidoCompra);
    const pedidoLinha = pedidoNaLinha.get(`${decisao.idDocumentoEstoque}:${decisao.idItemPedidoCompra}`);
    const nomePedido = comprador?.nomePedidoCompra || pedidoLinha?.nomePedidoCompra || `Item ${decisao.idItemPedidoCompra}`;
    const chave = `${decisao.idDocumentoEstoque}:${chaveCampoComprador(decisao.idItemDocumentoEstoque, decisao.idItemPedidoCompra, decisao.campo)}`;
    aceites.push({
      idDocumentoEstoque: decisao.idDocumentoEstoque,
      idItemDocumentoEstoque: decisao.idItemDocumentoEstoque,
      idItemPedidoCompra: decisao.idItemPedidoCompra,
      idPedidoCompra: comprador?.idPedidoCompra ?? pedidoLinha?.idPedidoCompra ?? decisao.idItemPedidoCompra,
      nomePedidoCompra: nomePedido,
      nomeComprador: comprador?.nomeComprador ?? SEM_COMPRADOR,
      campo: decisao.campo,
      natureza: resolverNaturezaAceita({
        campo: decisao.campo,
        nomePedido,
        naturezaAtual: naturezaAtual.get(chave) ?? null,
        relato: relatos.get(decisao.idDocumentoEstoque) ?? null,
        divergenciaRealHistorica: realHistorica.has(decisao.idDocumentoEstoque),
      }),
    });
  }

  const snapshots = [];
  for (const parte of chunk(ids, 800)) {
    if (parte.length === 0) continue;
    const rows = await prisma.doubleCheckInDivergenciaApontada.findMany({
      where: { idDocumentoEstoque: { in: parte } },
    });
    snapshots.push(...rows);
  }

  return montarLinhasComprador({
    escopo: params.escopo,
    docs: params.docs,
    snapshots,
    aceites,
    chavesAtuais: params.chavesAtuais,
    chavesAceitas,
  });
}
