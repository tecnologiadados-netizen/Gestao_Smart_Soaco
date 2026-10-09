/**
 * Gestão entradas — divergência por comprador do pedido.
 * Apontada: primeira leitura do vínculo NF × PC (retrabalho se o vínculo some).
 * Aceita: divergência aceita na conferência, mesmo que o ERP seja corrigido depois.
 */
import { CAMPOS_DIVERGENCIA_ENTRADA } from './gestaoEntradasClassificacao.js';
import type { EscopoDivergenciaGestaoEntrada } from './gestaoEntradasClassificacao.js';
import type { NaturezaDivergencia } from '../services/doubleCheckInNatureza.js';
import type { RelatoConferencia } from '../services/doubleCheckInConferenciaRelato.js';

export const SEM_COMPRADOR = 'Sem comprador';

export type MundoCompradorGestao = 'apontada' | 'aceita';

export type SituacaoCompradorGestao = 'ainda_divergente' | 'vinculo_ajustado' | 'aceita';

export type DocCompradorGestao = {
  idDocumento: number;
  dataEntrada: string;
  numeroDocumentoFiscal?: string | null;
  numeroNfe?: string | null;
  nomeParceiro?: string | null;
};

export type SnapshotDivergenciaApontada = {
  idDocumentoEstoque: number;
  idItemDocumentoEstoque: number;
  idItemPedidoCompra: number;
  idPedidoCompra: number;
  nomePedidoCompra: string;
  nomeComprador: string;
  campo: string;
  natureza: string;
};

export type AceiteCompradorOrigem = {
  idDocumentoEstoque: number;
  idItemDocumentoEstoque: number;
  idItemPedidoCompra: number;
  idPedidoCompra: number;
  nomePedidoCompra: string;
  nomeComprador: string;
  campo: string;
  natureza: NaturezaDivergencia;
};

export type LinhaCompradorGestao = {
  mundo: MundoCompradorGestao;
  nomeComprador: string;
  idDocumento: number;
  dataEntrada: string;
  numeroDocumentoFiscal: string | null;
  numeroNfe: string | null;
  nomeParceiro: string | null;
  idPedidoCompra: number;
  nomePedidoCompra: string;
  campos: string[];
  situacao: SituacaoCompradorGestao;
};

export type RankingCompradorGestao = {
  nomeComprador: string;
  documentos: number;
  pedidos: number;
  /** Notas em que todo o vínculo apontado desse comprador deixou de divergir. */
  ajustados: number;
};

const LABEL_CAMPO = new Map<string, string>(CAMPOS_DIVERGENCIA_ENTRADA.map((c) => [c.campo, c.label]));
const ORDEM_CAMPO = new Map<string, number>(CAMPOS_DIVERGENCIA_ENTRADA.map((c, i) => [c.campo, i]));

export function chaveCampoComprador(idItemNf: number, idItemPc: number, campo: string): string {
  return `${idItemNf}:${idItemPc}:${campo}`;
}

export function chaveAceiteComprador(
  idDocumento: number,
  idItemNf: number,
  idItemPc: number,
  campo: string
): string {
  return `${idDocumento}:${chaveCampoComprador(idItemNf, idItemPc, campo)}`;
}

function normalizarPedido(valor: string | null | undefined): string {
  return (valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

function labelCampo(campo: string): string {
  return LABEL_CAMPO.get(campo) ?? campo;
}

function naturezaNoRelato(
  relato: RelatoConferencia | null,
  campo: string,
  nomePedido: string
): NaturezaDivergencia | null {
  if (!relato) return null;
  if (
    campo === 'condicao_pagamento' &&
    relato.pagamentoComum?.decisao === 'aceita' &&
    relato.pagamentoComum.campo === campo
  ) {
    return relato.pagamentoComum.natureza;
  }

  const pedido = normalizarPedido(nomePedido);
  if (pedido) {
    for (const produto of relato.produtos ?? []) {
      if (normalizarPedido(produto.pedido) !== pedido) continue;
      const achado = produto.campos.find((item) => item.campo === campo && item.decisao === 'aceita');
      if (achado) return achado.natureza;
    }
  }

  const naturezas = new Set<NaturezaDivergencia>();
  if (relato.pagamentoComum?.campo === campo && relato.pagamentoComum.decisao === 'aceita') {
    naturezas.add(relato.pagamentoComum.natureza);
  }
  for (const produto of relato.produtos ?? []) {
    for (const item of produto.campos) {
      if (item.campo === campo && item.decisao === 'aceita') naturezas.add(item.natureza);
    }
  }
  if (naturezas.size === 1) return [...naturezas][0]!;
  return null;
}

/** Natureza do aceite: o vínculo que ainda diverge, senão o retrato da conferência. */
export function resolverNaturezaAceita(params: {
  campo: string;
  nomePedido: string;
  naturezaAtual: NaturezaDivergencia | null;
  relato: RelatoConferencia | null;
  divergenciaRealHistorica: boolean;
}): NaturezaDivergencia {
  if (params.naturezaAtual) return params.naturezaAtual;
  const doRelato = naturezaNoRelato(params.relato, params.campo, params.nomePedido);
  if (doRelato) return doRelato;
  return params.divergenciaRealHistorica ? 'real' : 'benigna';
}

type GrupoCampo = {
  mundo: MundoCompradorGestao;
  nomeComprador: string;
  doc: DocCompradorGestao;
  idPedidoCompra: number;
  nomePedidoCompra: string;
  campos: Array<{ campo: string; ainda: boolean }>;
};

function ordenarCampos(campos: Array<{ campo: string; ainda: boolean }>): string[] {
  return [...campos]
    .sort((a, b) => (ORDEM_CAMPO.get(a.campo) ?? 99) - (ORDEM_CAMPO.get(b.campo) ?? 99) || a.campo.localeCompare(b.campo))
    .map((item) => labelCampo(item.campo));
}

export function montarLinhasComprador(params: {
  escopo: EscopoDivergenciaGestaoEntrada;
  docs: DocCompradorGestao[];
  snapshots: SnapshotDivergenciaApontada[];
  aceites: AceiteCompradorOrigem[];
  /** Item × pedido × campo que ainda diverge na leitura do painel. */
  chavesAtuais: ReadonlyMap<number, ReadonlySet<string>>;
  /** Documento × item × pedido × campo com decisão aceita. */
  chavesAceitas: ReadonlySet<string>;
}): LinhaCompradorGestao[] {
  const docs = new Map(params.docs.map((doc) => [doc.idDocumento, doc]));
  const grupos = new Map<string, GrupoCampo>();

  const garantir = (
    mundo: MundoCompradorGestao,
    nomeComprador: string,
    doc: DocCompradorGestao,
    idPedidoCompra: number,
    nomePedidoCompra: string
  ): GrupoCampo => {
    const key = `${mundo}|${nomeComprador}|${doc.idDocumento}|${idPedidoCompra}`;
    const atual = grupos.get(key);
    if (atual) {
      if (!atual.nomePedidoCompra && nomePedidoCompra) atual.nomePedidoCompra = nomePedidoCompra;
      return atual;
    }
    const criado: GrupoCampo = {
      mundo,
      nomeComprador: nomeComprador.trim() || SEM_COMPRADOR,
      doc,
      idPedidoCompra,
      nomePedidoCompra: nomePedidoCompra.trim() || `PC ${idPedidoCompra}`,
      campos: [],
    };
    grupos.set(key, criado);
    return criado;
  };

  for (const snap of params.snapshots) {
    const doc = docs.get(snap.idDocumentoEstoque);
    if (!doc) continue;
    if (params.escopo === 'reais' && snap.natureza !== 'real') continue;
    if (
      params.chavesAceitas.has(
        chaveAceiteComprador(
          snap.idDocumentoEstoque,
          snap.idItemDocumentoEstoque,
          snap.idItemPedidoCompra,
          snap.campo
        )
      )
    ) {
      continue;
    }
    const grupo = garantir(
      'apontada',
      snap.nomeComprador,
      doc,
      snap.idPedidoCompra,
      snap.nomePedidoCompra
    );
    const ainda = params.chavesAtuais
      .get(snap.idDocumentoEstoque)
      ?.has(chaveCampoComprador(snap.idItemDocumentoEstoque, snap.idItemPedidoCompra, snap.campo));
    if (!grupo.campos.some((item) => item.campo === snap.campo)) {
      grupo.campos.push({ campo: snap.campo, ainda: Boolean(ainda) });
    }
  }

  for (const aceite of params.aceites) {
    const doc = docs.get(aceite.idDocumentoEstoque);
    if (!doc) continue;
    if (params.escopo === 'reais' && aceite.natureza !== 'real') continue;
    const grupo = garantir(
      'aceita',
      aceite.nomeComprador,
      doc,
      aceite.idPedidoCompra,
      aceite.nomePedidoCompra
    );
    if (!grupo.campos.some((item) => item.campo === aceite.campo)) {
      grupo.campos.push({ campo: aceite.campo, ainda: false });
    }
  }

  const linhas: LinhaCompradorGestao[] = [];
  for (const grupo of grupos.values()) {
    if (grupo.campos.length === 0) continue;
    const situacao: SituacaoCompradorGestao =
      grupo.mundo === 'aceita'
        ? 'aceita'
        : grupo.campos.some((item) => item.ainda)
          ? 'ainda_divergente'
          : 'vinculo_ajustado';
    linhas.push({
      mundo: grupo.mundo,
      nomeComprador: grupo.nomeComprador,
      idDocumento: grupo.doc.idDocumento,
      dataEntrada: grupo.doc.dataEntrada,
      numeroDocumentoFiscal: grupo.doc.numeroDocumentoFiscal ?? null,
      numeroNfe: grupo.doc.numeroNfe ?? null,
      nomeParceiro: grupo.doc.nomeParceiro ?? null,
      idPedidoCompra: grupo.idPedidoCompra,
      nomePedidoCompra: grupo.nomePedidoCompra,
      campos: ordenarCampos(grupo.campos),
      situacao,
    });
  }

  linhas.sort(
    (a, b) =>
      b.dataEntrada.localeCompare(a.dataEntrada) ||
      (a.numeroDocumentoFiscal ?? '').localeCompare(b.numeroDocumentoFiscal ?? '', 'pt-BR') ||
      a.nomePedidoCompra.localeCompare(b.nomePedidoCompra, 'pt-BR') ||
      a.idDocumento - b.idDocumento
  );
  return linhas;
}

export function agregarRankingComprador(linhas: LinhaCompradorGestao[]): RankingCompradorGestao[] {
  const map = new Map<
    string,
    { documentos: Set<number>; pedidos: Set<number>; situacaoPorDoc: Map<number, Set<SituacaoCompradorGestao>> }
  >();
  for (const linha of linhas) {
    const atual = map.get(linha.nomeComprador) ?? {
      documentos: new Set<number>(),
      pedidos: new Set<number>(),
      situacaoPorDoc: new Map<number, Set<SituacaoCompradorGestao>>(),
    };
    atual.documentos.add(linha.idDocumento);
    atual.pedidos.add(linha.idPedidoCompra);
    const situacoes = atual.situacaoPorDoc.get(linha.idDocumento) ?? new Set<SituacaoCompradorGestao>();
    situacoes.add(linha.situacao);
    atual.situacaoPorDoc.set(linha.idDocumento, situacoes);
    map.set(linha.nomeComprador, atual);
  }

  return [...map.entries()]
    .map(([nomeComprador, atual]) => {
      let ajustados = 0;
      for (const situacoes of atual.situacaoPorDoc.values()) {
        if (situacoes.size === 1 && situacoes.has('vinculo_ajustado')) ajustados += 1;
      }
      return {
        nomeComprador,
        documentos: atual.documentos.size,
        pedidos: atual.pedidos.size,
        ajustados,
      };
    })
    .sort(
      (a, b) =>
        b.documentos - a.documentos ||
        b.pedidos - a.pedidos ||
        a.nomeComprador.localeCompare(b.nomeComprador, 'pt-BR')
    );
}

export function filtrarLinhasComprador(
  linhas: LinhaCompradorGestao[],
  mundo: MundoCompradorGestao,
  nomeComprador: string
): LinhaCompradorGestao[] {
  const nome = nomeComprador.trim();
  return linhas.filter((linha) => linha.mundo === mundo && linha.nomeComprador === nome);
}
