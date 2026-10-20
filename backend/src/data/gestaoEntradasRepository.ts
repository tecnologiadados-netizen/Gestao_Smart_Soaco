/**
 * Gestão entradas — notas do período no Nomus cruzadas com conferência e decisão locais.
 */

import { prisma } from '../config/prisma.js';
import { getNomusPool, isNomusEnabled, nomusQueryWithRetry } from '../config/nomusDb.js';
import { formatSqlDateYmd } from './dfcDateUtils.js';
import {
  DOUBLE_CHECKIN_TIPOS_MOV,
  queryLinhasComparativoPorDocumentos,
  type DoubleCheckInComparativoLinha,
} from './doubleCheckInRepository.js';
import {
  DOUBLE_CHECKIN_CONFERENCIA_NF_PC_DESDE,
  regimeConferenciaPorDataEntrada,
} from '../services/doubleCheckInConferenciaPeriodo.js';
import {
  CAMPOS_DIVERGENCIA_ENTRADA,
  classificarNotaGestaoEntrada,
  montarPainelGestaoEntradas,
  normalizarEscopoDivergencia,
  prepararDocumentoNoEscopo,
  type DecisaoDiaGestaoEntrada,
  type DecisaoGestaoEntrada,
  type DivergenciaAtualEntrada,
  type DocGestaoEntrada,
  type EscopoDivergenciaGestaoEntrada,
  type GestaoEntradasPainel,
  type StatusNotaGestaoEntrada,
} from './gestaoEntradasClassificacao.js';
import {
  carregarPrimeirasLeituras,
  registrarDivergenciasApontadas,
  type PrimeiraLeituraDocumento,
} from './doubleCheckInDivergenciaApontada.js';
import { linhasCompradorGestao } from './gestaoEntradasCompradorConsulta.js';
import type { CampoRelato, RelatoConferencia } from '../services/doubleCheckInConferenciaRelato.js';
import {
  agregarRankingComprador,
  filtrarLinhasComprador,
  type DocCompradorGestao,
  type LinhaCompradorGestao,
  type MundoCompradorGestao,
  type RankingCompradorGestao,
} from './gestaoEntradasComprador.js';

const TIPOS_IN = DOUBLE_CHECKIN_TIPOS_MOV.join(', ');

const SQL_DOCS = `
SELECT
  de.id AS idDocumento,
  DATE(de.dataEntrada) AS dataEntrada,
  tp.id AS idTipoMovimentacao,
  tp.nome AS nomeTipo,
  COUNT(ide.id) AS itens
FROM itemdocumentoestoque ide
INNER JOIN documentoestoque de ON de.id = ide.idDocumentoEstoque
INNER JOIN tipomovimentacao tp ON tp.id = de.idTipoMovimentacao
WHERE DATE(de.dataEntrada) BETWEEN ? AND ?
  AND ide.discriminador = 'ItemDocumentoEntrada'
  AND de.idTipoMovimentacao IN (${TIPOS_IN})
GROUP BY de.id, DATE(de.dataEntrada), tp.id, tp.nome
`.trim();

function toInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function strOrEmpty(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function carregarLocais(ids: number[]): Promise<{
  idsConferidos: Set<number>;
  decisoes: DecisaoGestaoEntrada[];
}> {
  const idsConferidos = new Set<number>();
  const decisoes: DecisaoGestaoEntrada[] = [];
  if (ids.length === 0) return { idsConferidos, decisoes };

  for (const parte of chunk(ids, 800)) {
    const [conferidos, rows] = await Promise.all([
      prisma.doubleCheckInConferido.findMany({
        where: {
          idDocumentoEstoque: { in: parte },
          conferidoEm: { gte: DOUBLE_CHECKIN_CONFERENCIA_NF_PC_DESDE },
          reabertoEm: null,
        },
        select: { idDocumentoEstoque: true },
      }),
      prisma.doubleCheckInComparativoDecisao.findMany({
        where: { idDocumentoEstoque: { in: parte } },
        select: {
          idDocumentoEstoque: true,
          idItemDocumentoEstoque: true,
          idItemPedidoCompra: true,
          campo: true,
          decisao: true,
          justificativaOpcao: { select: { codigo: true, label: true } },
        },
      }),
    ]);
    for (const c of conferidos) idsConferidos.add(c.idDocumentoEstoque);
    for (const r of rows) {
      decisoes.push({
        idDocumentoEstoque: r.idDocumentoEstoque,
        idItemDocumentoEstoque: r.idItemDocumentoEstoque,
        idItemPedidoCompra: r.idItemPedidoCompra,
        campo: r.campo,
        decisao: r.decisao,
        justificativaCodigo: r.justificativaOpcao.codigo,
        justificativaLabel: r.justificativaOpcao.label,
      });
    }
  }

  return { idsConferidos, decisoes };
}

function chaveDecisaoEscopo(d: {
  idItemDocumentoEstoque?: number;
  idItemPedidoCompra?: number;
  campo: string;
}): string {
  return `${d.idItemDocumentoEstoque}:${d.idItemPedidoCompra}:${d.campo}`;
}

function decisoesDoDocumento(
  decisoes: DecisaoGestaoEntrada[],
  idDocumento: number
): DecisaoDiaGestaoEntrada[] {
  return decisoes
    .filter((item) => item.idDocumentoEstoque === idDocumento)
    .filter(
      (
        item
      ): item is DecisaoGestaoEntrada & {
        idItemDocumentoEstoque: number;
        idItemPedidoCompra: number;
      } =>
        Number.isFinite(item.idItemDocumentoEstoque) && Number.isFinite(item.idItemPedidoCompra)
    )
    .map((item) => ({
      idItemDocumentoEstoque: item.idItemDocumentoEstoque,
      idItemPedidoCompra: item.idItemPedidoCompra,
      campo: item.campo,
      decisao: item.decisao,
      justificativaCodigo: item.justificativaCodigo,
      justificativaLabel: item.justificativaLabel,
      observacao: null,
      usuarioLogin: '',
      atualizadoEm: '',
      historico: [],
    }));
}

export type GestaoEntradasPainelResponse = GestaoEntradasPainel & {
  compradoresApontados: RankingCompradorGestao[];
  compradoresAceitos: RankingCompradorGestao[];
};

export async function queryGestaoEntradasPainel(params: {
  dataInicio: string;
  dataFim: string;
  escopo?: EscopoDivergenciaGestaoEntrada;
}): Promise<{ data?: GestaoEntradasPainelResponse; erro?: string }> {
  if (!isNomusEnabled()) return { erro: 'NOMUS_DB_URL não configurado' };
  const pool = getNomusPool();
  if (!pool) return { erro: 'NOMUS_DB_URL não configurado' };

  try {
    const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, SQL_DOCS, [
      params.dataInicio,
      params.dataFim,
    ]);
    const list = Array.isArray(rows) ? rows : [];
    const docs: DocGestaoEntrada[] = [];
    for (const r of list) {
      const idDocumento = toInt(r.idDocumento ?? r['idDocumento']);
      const dataEntrada = formatSqlDateYmd(r.dataEntrada ?? r['dataEntrada']);
      if (idDocumento <= 0 || !dataEntrada) continue;
      docs.push({
        idDocumento,
        dataEntrada,
        idTipoMovimentacao: toInt(r.idTipoMovimentacao ?? r['idTipoMovimentacao']),
        nomeTipo: strOrEmpty(r.nomeTipo ?? r['nomeTipo']),
        itens: toInt(r.itens ?? r['itens']),
      });
    }

    const escopo = normalizarEscopoDivergencia(params.escopo);
    const { idsConferidos, decisoes } = await carregarLocais(docs.map((d) => d.idDocumento));
    const { linhasPorDocumento, erro: erroLinhas } = await queryLinhasComparativoPorDocumentos(
      docs.map((d) => d.idDocumento)
    );
    if (erroLinhas) return { erro: erroLinhas };
    const dataEntradaPorDocumento = new Map(
      docs.map((doc) => [doc.idDocumento, doc.dataEntrada] as const)
    );
    const idsComDivergenciaAtual = new Set<number>();
    const chavesPorDocumento = new Map<number, Set<string>>();
    const linhasCompletas = new Map(linhasPorDocumento);
    for (const [id, linhas] of linhasPorDocumento ?? []) {
      if (regimeConferenciaPorDataEntrada(dataEntradaPorDocumento.get(id)) !== 'completa') {
        linhasCompletas.delete(id);
        continue;
      }
      const avaliado = prepararDocumentoNoEscopo({
        linhas,
        decisoes: decisoesDoDocumento(decisoes, id),
        escopo,
      });
      chavesPorDocumento.set(id, avaliado.chaves);
      if (avaliado.temDivergencia) idsComDivergenciaAtual.add(id);
      if (idsConferidos.has(id) && avaliado.pendentes > 0) idsConferidos.delete(id);
    }
    await registrarDivergenciasApontadas(linhasCompletas);
    const docsComprador: DocCompradorGestao[] = docs
      .filter((doc) => regimeConferenciaPorDataEntrada(doc.dataEntrada) === 'completa')
      .map((doc) => ({ idDocumento: doc.idDocumento, dataEntrada: doc.dataEntrada }));
    const linhasComprador = await linhasCompradorGestao({
      escopo,
      docs: docsComprador,
      decisoes,
      linhasPorDocumento: linhasCompletas,
      chavesAtuais: chavesPorDocumento,
      idsDivergeAgora: idsComDivergenciaAtual,
      idsConferidasDivergentes: new Set([...idsConferidos].filter((id) => idsComDivergenciaAtual.has(id))),
    });
    const decisoesNoEscopo =
      escopo === 'geral'
        ? decisoes
        : decisoes.filter((d) => chavesPorDocumento.get(d.idDocumentoEstoque)?.has(chaveDecisaoEscopo(d)));
    const painel = montarPainelGestaoEntradas({
      dataInicio: params.dataInicio,
      dataFim: params.dataFim,
      escopo,
      docs,
      idsConferidos,
      idsComDivergenciaAtual,
      decisoes: decisoesNoEscopo,
    });
    return {
      data: {
        ...painel,
        compradoresApontados: agregarRankingComprador(
          linhasComprador.filter((linha) => linha.mundo === 'apontada')
        ),
        compradoresAceitos: agregarRankingComprador(
          linhasComprador.filter((linha) => linha.mundo === 'aceita')
        ),
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[gestaoEntradasRepository] queryGestaoEntradasPainel:', msg);
    return { erro: msg };
  }
}

export type GestaoEntradasCompradorDetalhe = {
  mundo: MundoCompradorGestao;
  nomeComprador: string;
  documentos: number;
  pedidos: number;
  ajustados: number;
  linhas: LinhaCompradorGestao[];
  /** Mesma evidência da tabela do dia: uma linha por divergência do comprador. */
  notas: NotaDiaGestaoEntrada[];
};

const LABEL_POR_CAMPO = new Map(CAMPOS_DIVERGENCIA_ENTRADA.map((c) => [c.campo, c.label]));

function normalizarPedidoComprador(valor: string | null | undefined): string {
  return (valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .toLocaleLowerCase('pt-BR');
}

function lerRelatoComprador(payloadJson: string): RelatoConferencia | null {
  try {
    const valor = JSON.parse(payloadJson) as RelatoConferencia;
    if (!valor || !Array.isArray(valor.produtos)) return null;
    return valor;
  } catch {
    return null;
  }
}

function divergenciaDoCampoRelato(
  campo: CampoRelato,
  codigo: string | null,
  pedido: string | null
): DivergenciaAtualEntrada {
  return {
    codigoProduto: codigo,
    descricaoProduto: null,
    nomePedidoCompra: pedido,
    campo: campo.campo,
    campoLabel: LABEL_POR_CAMPO.get(campo.campo) ?? campo.titulo,
    natureza: campo.natureza,
    valorNf: campo.nf,
    valorPc: campo.pc,
    detalheNf: campo.detalhe,
    detalhePc: null,
    decisao: campo.decisao,
    justificativaCodigo: campo.justificativaCodigo ?? null,
    justificativaLabel: campo.justificativa || null,
    observacaoNatureza: null,
    observacoes: campo.observacao?.trim()
      ? [{ texto: campo.observacao.trim(), usuarioLogin: '', criadoEm: '' }]
      : [],
  };
}

function completarAceitasPeloRelato(params: {
  relato: RelatoConferencia | null;
  doDoc: LinhaCompradorGestao[];
  atuais: DivergenciaAtualEntrada[];
}): DivergenciaAtualEntrada[] {
  if (!params.relato) return params.atuais;
  const presentes = new Set(
    params.atuais.map(
      (d) => `${normalizarPedidoComprador(d.nomePedidoCompra)}|${d.campo}|${normalizarPedidoComprador(d.codigoProduto)}`
    )
  );
  const extras: DivergenciaAtualEntrada[] = [];
  const pedidos = new Set(params.doDoc.map((linha) => normalizarPedidoComprador(linha.nomePedidoCompra)));
  const labels = new Set(params.doDoc.flatMap((linha) => linha.campos));

  const aceitar = (item: DivergenciaAtualEntrada) => {
    if (!labels.has(item.campoLabel) || item.decisao !== 'aceita') return;
    const chave = `${normalizarPedidoComprador(item.nomePedidoCompra)}|${item.campo}|${normalizarPedidoComprador(item.codigoProduto)}`;
    if (presentes.has(chave)) return;
    presentes.add(chave);
    extras.push(item);
  };

  for (const produto of params.relato.produtos) {
    if (!pedidos.has(normalizarPedidoComprador(produto.pedido))) continue;
    for (const campo of produto.campos) {
      aceitar(divergenciaDoCampoRelato(campo, produto.codigo, produto.pedido));
    }
  }
  if (
    params.relato.pagamentoComum &&
    labels.has(LABEL_POR_CAMPO.get('condicao_pagamento') ?? '') &&
    !params.atuais.some((d) => d.campo === 'condicao_pagamento')
  ) {
    const pedido = params.doDoc[0]?.nomePedidoCompra ?? null;
    aceitar(divergenciaDoCampoRelato(params.relato.pagamentoComum, null, pedido));
  }
  return extras.length > 0 ? [...params.atuais, ...extras] : params.atuais;
}

const VALOR_NAO_GRAVADO = 'Não gravado';

/** Pagamento é da nota inteira: um card por pedido, não por item. */
function chaveCard(pedido: string | null, campo: string, codigo: string | null): string {
  const item = campo === 'condicao_pagamento' ? '' : normalizarPedidoComprador(codigo);
  return `${normalizarPedidoComprador(pedido)}|${campo}|${item}`;
}

function mesclarCards(
  base: DivergenciaAtualEntrada[],
  extras: DivergenciaAtualEntrada[]
): DivergenciaAtualEntrada[] {
  const presentes = new Set(base.map((d) => chaveCard(d.nomePedidoCompra, d.campo, d.codigoProduto)));
  const out = [...base];
  for (const d of extras) {
    const chave = chaveCard(d.nomePedidoCompra, d.campo, d.codigoProduto);
    if (presentes.has(chave)) continue;
    presentes.add(chave);
    out.push(d);
  }
  return out;
}

/** Nota regularizada sem retrato nem relato: o card mostra item, pedido, decisão e motivo, sem valores. */
function completarRegularizadaSemRetrato(params: {
  doDoc: LinhaCompradorGestao[];
  linhasAtuais: DoubleCheckInComparativoLinha[];
  primeiraLeitura: PrimeiraLeituraDocumento | undefined;
  decisoes: DecisaoDiaGestaoEntrada[];
  escopo: EscopoDivergenciaGestaoEntrada;
  atuais: DivergenciaAtualEntrada[];
}): DivergenciaAtualEntrada[] {
  const presentes = new Set(params.atuais.map((d) => chaveCard(d.nomePedidoCompra, d.campo, d.codigoProduto)));
  const linhaPorVinculo = new Map(
    params.linhasAtuais.map((l) => [`${l.idItemDocumentoEstoque}:${l.idItemPedidoCompra}`, l] as const)
  );
  const decisaoPorCampo = new Map<string, DecisaoDiaGestaoEntrada>(
    params.decisoes.map((d) => [`${d.idItemDocumentoEstoque}:${d.idItemPedidoCompra}:${d.campo}`, d])
  );
  const eventos = new Map<
    string,
    { idItemDocumentoEstoque: number; idItemPedidoCompra: number; nomePedidoCompra: string | null; campo: string; natureza: 'real' | 'benigna' }
  >();
  for (const c of params.primeiraLeitura?.campos ?? []) {
    if (params.escopo === 'reais' && c.natureza !== 'real') continue;
    eventos.set(`${c.idItemDocumentoEstoque}:${c.idItemPedidoCompra}:${c.campo}`, c);
  }
  for (const d of params.decisoes) {
    const chave = `${d.idItemDocumentoEstoque}:${d.idItemPedidoCompra}:${d.campo}`;
    if (d.decisao !== 'aceita' || eventos.has(chave)) continue;
    eventos.set(chave, {
      idItemDocumentoEstoque: d.idItemDocumentoEstoque,
      idItemPedidoCompra: d.idItemPedidoCompra,
      nomePedidoCompra: null,
      campo: d.campo,
      natureza: 'real',
    });
  }

  const extras: DivergenciaAtualEntrada[] = [];
  for (const [chave, ev] of eventos) {
    const linha = linhaPorVinculo.get(`${ev.idItemDocumentoEstoque}:${ev.idItemPedidoCompra}`);
    const pedido = linha?.nomePedidoCompra ?? ev.nomePedidoCompra;
    const label = (LABEL_POR_CAMPO as ReadonlyMap<string, string>).get(ev.campo) ?? ev.campo;
    const doComprador = params.doDoc.some(
      (l) => normalizarPedidoComprador(l.nomePedidoCompra) === normalizarPedidoComprador(pedido) && l.campos.includes(label)
    );
    if (!doComprador) continue;
    const pagamento = ev.campo === 'condicao_pagamento';
    const codigo = pagamento ? null : (linha?.codigoProduto ?? null);
    if (presentes.has(chaveCard(pedido, ev.campo, codigo))) continue;
    presentes.add(chaveCard(pedido, ev.campo, codigo));
    const decisao = decisaoPorCampo.get(chave);
    extras.push({
      codigoProduto: codigo,
      descricaoProduto: pagamento ? null : (linha?.descricaoProduto ?? null),
      nomePedidoCompra: pedido,
      campo: ev.campo,
      campoLabel: label,
      natureza: ev.natureza,
      valorNf: VALOR_NAO_GRAVADO,
      valorPc: VALOR_NAO_GRAVADO,
      detalheNf: 'A primeira leitura não guardou o comparativo. Hoje a nota não diverge do pedido nesta leitura.',
      detalhePc: null,
      decisao: decisao?.decisao === 'aceita' || decisao?.decisao === 'recusa' ? decisao.decisao : null,
      justificativaCodigo: decisao?.justificativaCodigo ?? null,
      justificativaLabel: decisao?.justificativaLabel || null,
      observacaoNatureza: null,
      observacoes: decisao?.historico ?? [],
    });
  }
  return extras.length > 0 ? [...params.atuais, ...extras] : params.atuais;
}

function notasDoComprador(params: {
  mundo: MundoCompradorGestao;
  linhas: LinhaCompradorGestao[];
  docs: DocCompradorGestao[];
  linhasPorDocumento: Map<number, DoubleCheckInComparativoLinha[]>;
  decisoesDia: Map<number, DecisaoDiaGestaoEntrada[]>;
  relatos: Map<number, RelatoConferencia | null>;
  primeirasLeituras: Map<number, PrimeiraLeituraDocumento>;
  escopo: EscopoDivergenciaGestaoEntrada;
}): NotaDiaGestaoEntrada[] {
  const docs = new Map(params.docs.map((doc) => [doc.idDocumento, doc]));
  const ordem: number[] = [];
  for (const linha of params.linhas) {
    if (!ordem.includes(linha.idDocumento)) ordem.push(linha.idDocumento);
  }
  const regularizada = params.mundo === 'apontada';
  const notas: NotaDiaGestaoEntrada[] = [];
  for (const idDocumento of ordem) {
    const doc = docs.get(idDocumento);
    if (!doc) continue;
    const doDoc = params.linhas.filter((linha) => linha.idDocumento === idDocumento);
    // A nota regularizada não diverge mais no Nomus: o comparativo vem da primeira leitura gravada.
    const avaliado = prepararDocumentoNoEscopo({
      linhas: regularizada
        ? (params.primeirasLeituras.get(idDocumento)?.retratos ?? [])
        : (params.linhasPorDocumento.get(idDocumento) ?? []),
      decisoes: params.decisoesDia.get(idDocumento) ?? [],
      escopo: regularizada ? 'geral' : params.escopo,
    });
    let divergencias = avaliado.divergencias.filter((d) => {
      const pedido = normalizarPedidoComprador(d.nomePedidoCompra);
      const casa = doDoc.some(
        (linha) =>
          normalizarPedidoComprador(linha.nomePedidoCompra) === pedido && linha.campos.includes(d.campoLabel)
      );
      if (!casa) return false;
      return regularizada || d.decisao === 'aceita';
    });
    if (regularizada) {
      const doRelato = completarAceitasPeloRelato({
        relato: params.relatos.get(idDocumento) ?? null,
        doDoc,
        atuais: [],
      });
      divergencias = completarRegularizadaSemRetrato({
        doDoc,
        linhasAtuais: params.linhasPorDocumento.get(idDocumento) ?? [],
        primeiraLeitura: params.primeirasLeituras.get(idDocumento),
        decisoes: params.decisoesDia.get(idDocumento) ?? [],
        escopo: params.escopo,
        atuais: mesclarCards(doRelato, divergencias),
      });
    } else {
      divergencias = completarAceitasPeloRelato({
        relato: params.relatos.get(idDocumento) ?? null,
        doDoc,
        atuais: divergencias,
      });
    }
    if (divergencias.length === 0) continue;
    const status: StatusNotaGestaoEntrada = regularizada ? 'limpa' : 'aceita';
    notas.push({
      idDocumento,
      dataEntrada: doc.dataEntrada,
      idTipoMovimentacao: 0,
      numeroDocumentoFiscal: doc.numeroDocumentoFiscal ?? null,
      numeroNfe: doc.numeroNfe ?? null,
      nomeParceiro: doc.nomeParceiro ?? null,
      itens: divergencias.length,
      status,
      divergeAtual: !regularizada,
      divergencias,
    });
  }
  return notas;
}

export async function queryGestaoEntradasComprador(params: {
  dataInicio: string;
  dataFim: string;
  escopo?: EscopoDivergenciaGestaoEntrada;
  mundo: MundoCompradorGestao;
  comprador: string;
}): Promise<{ data?: GestaoEntradasCompradorDetalhe; erro?: string }> {
  if (!isNomusEnabled()) return { erro: 'NOMUS_DB_URL não configurado' };
  const pool = getNomusPool();
  if (!pool) return { erro: 'NOMUS_DB_URL não configurado' };
  const comprador = params.comprador.trim();
  if (!comprador) return { erro: 'Informe o comprador.' };

  try {
    const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, SQL_DOCS_DIA, [
      params.dataInicio,
      params.dataFim,
    ]);
    const list = Array.isArray(rows) ? rows : [];
    const docs: DocCompradorGestao[] = [];
    for (const r of list) {
      const idDocumento = toInt(r.idDocumento);
      const dataEntrada = formatSqlDateYmd(r.dataEntrada);
      if (idDocumento <= 0 || !dataEntrada) continue;
      if (regimeConferenciaPorDataEntrada(dataEntrada) !== 'completa') continue;
      docs.push({
        idDocumento,
        dataEntrada,
        numeroDocumentoFiscal: strOrEmpty(r.numeroDocumentoFiscal) || null,
        numeroNfe: strOrEmpty(r.numeroNfe) || null,
        nomeParceiro: strOrEmpty(r.nomeParceiro) || null,
      });
    }
    const ids = docs.map((doc) => doc.idDocumento);
    const [{ idsConferidos, decisoes }, linhasResp] = await Promise.all([
      carregarLocais(ids),
      queryLinhasComparativoPorDocumentos(ids),
    ]);
    if (linhasResp.erro) return { erro: linhasResp.erro };

    const escopo = normalizarEscopoDivergencia(params.escopo);
    const linhasCompletas = new Map(linhasResp.linhasPorDocumento);
    const chavesPorDocumento = new Map<number, Set<string>>();
    const idsDivergeAgora = new Set<number>();
    for (const doc of docs) {
      const linhas = linhasCompletas.get(doc.idDocumento) ?? [];
      const avaliado = prepararDocumentoNoEscopo({
        linhas,
        decisoes: decisoesDoDocumento(decisoes, doc.idDocumento),
        escopo,
      });
      chavesPorDocumento.set(doc.idDocumento, avaliado.chaves);
      if (avaliado.temDivergencia) idsDivergeAgora.add(doc.idDocumento);
      if (idsConferidos.has(doc.idDocumento) && avaliado.pendentes > 0) idsConferidos.delete(doc.idDocumento);
    }
    await registrarDivergenciasApontadas(linhasCompletas);
    const linhas = filtrarLinhasComprador(
      await linhasCompradorGestao({
        escopo,
        docs,
        decisoes,
        linhasPorDocumento: linhasCompletas,
        chavesAtuais: chavesPorDocumento,
        idsDivergeAgora,
        idsConferidasDivergentes: new Set([...idsConferidos].filter((id) => idsDivergeAgora.has(id))),
      }),
      params.mundo,
      comprador
    );
    const idsNotas = [...new Set(linhas.map((linha) => linha.idDocumento))];
    const [decisoesDia, paginas, primeirasLeituras] = await Promise.all([
      carregarDecisoesDia(idsNotas),
      idsNotas.length > 0
        ? prisma.doubleCheckInConferenciaPagina.findMany({
            where: { idDocumentoEstoque: { in: idsNotas } },
            select: { idDocumentoEstoque: true, payloadJson: true },
          })
        : Promise.resolve([]),
      params.mundo === 'apontada'
        ? carregarPrimeirasLeituras(idsNotas)
        : Promise.resolve(new Map<number, PrimeiraLeituraDocumento>()),
    ]);
    const relatos = new Map<number, RelatoConferencia | null>();
    for (const pagina of paginas) {
      relatos.set(pagina.idDocumentoEstoque, lerRelatoComprador(pagina.payloadJson));
    }
    const ranking = agregarRankingComprador(linhas)[0];
    return {
      data: {
        mundo: params.mundo,
        nomeComprador: comprador,
        documentos: ranking?.documentos ?? 0,
        pedidos: ranking?.pedidos ?? 0,
        ajustados: ranking?.ajustados ?? 0,
        linhas,
        notas: notasDoComprador({
          mundo: params.mundo,
          linhas,
          docs,
          linhasPorDocumento: linhasCompletas,
          decisoesDia,
          relatos,
          primeirasLeituras,
          escopo,
        }),
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[gestaoEntradasRepository] queryGestaoEntradasComprador:', msg);
    return { erro: msg };
  }
}

export type NotaDiaGestaoEntrada = {
  idDocumento: number;
  dataEntrada: string;
  idTipoMovimentacao: number;
  numeroDocumentoFiscal: string | null;
  numeroNfe: string | null;
  nomeParceiro: string | null;
  itens: number;
  status: StatusNotaGestaoEntrada;
  /** Conferida e com divergência ainda presente na leitura. É o numerador da fatia “Divergências”. */
  divergeAtual: boolean;
  divergencias: DivergenciaAtualEntrada[];
};

const SQL_DOCS_DIA = `
SELECT
  de.id AS idDocumento,
  DATE(de.dataEntrada) AS dataEntrada,
  de.idTipoMovimentacao AS idTipoMovimentacao,
  de.numeroDocumentoFiscal AS numeroDocumentoFiscal,
  MAX(nfe.numero) AS numeroNfe,
  pe.nome AS nomeParceiro,
  COUNT(DISTINCT ide.id) AS itens
FROM itemdocumentoestoque ide
INNER JOIN documentoestoque de ON de.id = ide.idDocumentoEstoque
LEFT JOIN pessoa pe ON pe.id = de.idParceiro
LEFT JOIN nfe ON nfe.idDocumentoEstoque = de.id
WHERE DATE(de.dataEntrada) BETWEEN ? AND ?
  AND ide.discriminador = 'ItemDocumentoEntrada'
  AND de.idTipoMovimentacao IN (${TIPOS_IN})
GROUP BY de.id, DATE(de.dataEntrada), de.idTipoMovimentacao, de.numeroDocumentoFiscal, pe.nome
ORDER BY DATE(de.dataEntrada) DESC, de.numeroDocumentoFiscal ASC, de.id ASC
`.trim();

const ORDEM_STATUS: Record<StatusNotaGestaoEntrada, number> = {
  aceita: 0,
  recusa: 1,
  limpa: 2,
  pendente: 3,
  nao_aplicada: 4,
};

export async function queryGestaoEntradasDia(params: {
  dataInicio: string;
  dataFim: string;
  escopo?: EscopoDivergenciaGestaoEntrada;
}): Promise<{
  data?: {
    dataInicio: string;
    dataFim: string;
    escopo: EscopoDivergenciaGestaoEntrada;
    notas: NotaDiaGestaoEntrada[];
  };
  erro?: string;
}> {
  if (!isNomusEnabled()) return { erro: 'NOMUS_DB_URL não configurado' };
  const pool = getNomusPool();
  if (!pool) return { erro: 'NOMUS_DB_URL não configurado' };

  try {
    const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, SQL_DOCS_DIA, [
      params.dataInicio,
      params.dataFim,
    ]);
    const list = Array.isArray(rows) ? rows : [];
    const docs = list
      .map((r) => ({
        idDocumento: toInt(r.idDocumento ?? r['idDocumento']),
        dataEntrada: formatSqlDateYmd(r.dataEntrada ?? r['dataEntrada']),
        idTipoMovimentacao: toInt(r.idTipoMovimentacao ?? r['idTipoMovimentacao']),
        numeroDocumentoFiscal: strOrEmpty(r.numeroDocumentoFiscal) || null,
        numeroNfe: strOrEmpty(r.numeroNfe) || null,
        nomeParceiro: strOrEmpty(r.nomeParceiro) || null,
        itens: toInt(r.itens),
      }))
      .filter((d) => d.idDocumento > 0 && d.dataEntrada);
    const ids = docs.map((d) => d.idDocumento);
    const [{ idsConferidos }, linhasResp, decisoes] = await Promise.all([
      carregarLocais(ids),
      queryLinhasComparativoPorDocumentos(ids),
      carregarDecisoesDia(ids),
    ]);
    if (linhasResp.erro) return { erro: linhasResp.erro };
    const escopo = normalizarEscopoDivergencia(params.escopo);

    const notas: NotaDiaGestaoEntrada[] = docs.map((doc) => {
      const linhas = linhasResp.linhasPorDocumento.get(doc.idDocumento) ?? [];
      const decisoesDoc = decisoes.get(doc.idDocumento) ?? [];
      const regime = regimeConferenciaPorDataEntrada(doc.dataEntrada);
      const regimeCompleto = regime === 'completa';
      const avaliado = regimeCompleto
        ? prepararDocumentoNoEscopo({ linhas, decisoes: decisoesDoc, escopo })
        : { divergencias: [], temDivergencia: false, pendentes: 0, chaves: new Set<string>() };
      const conferida = idsConferidos.has(doc.idDocumento) && avaliado.pendentes === 0;
      const status =
        regime === 'nao_aplicada'
          ? 'nao_aplicada'
          : classificarNotaGestaoEntrada(
              conferida,
              avaliado.divergencias
                .filter((d) => d.decisao === 'aceita' || d.decisao === 'recusa')
                .map((d) => ({ decisao: d.decisao as string })),
              avaliado.temDivergencia
            );
      return {
        ...doc,
        status,
        divergeAtual: conferida && avaliado.temDivergencia,
        divergencias: avaliado.temDivergencia ? avaliado.divergencias : [],
      };
    });
    notas.sort(
      (a, b) =>
        ORDEM_STATUS[a.status] - ORDEM_STATUS[b.status] ||
        (a.numeroDocumentoFiscal ?? '').localeCompare(b.numeroDocumentoFiscal ?? '', 'pt-BR')
    );
    return { data: { dataInicio: params.dataInicio, dataFim: params.dataFim, escopo, notas } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[gestaoEntradasRepository] queryGestaoEntradasDia:', msg);
    return { erro: msg };
  }
}

async function carregarDecisoesDia(ids: number[]): Promise<Map<number, DecisaoDiaGestaoEntrada[]>> {
  const map = new Map<number, DecisaoDiaGestaoEntrada[]>();
  if (ids.length === 0) return map;
  for (const parte of chunk(ids, 800)) {
    const [rows, hist] = await Promise.all([
      prisma.doubleCheckInComparativoDecisao.findMany({
        where: { idDocumentoEstoque: { in: parte } },
        include: { justificativaOpcao: { select: { codigo: true, label: true } } },
      }),
      prisma.doubleCheckInComparativoObsHist.findMany({
        where: { idDocumentoEstoque: { in: parte } },
        orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }],
      }),
    ]);
    const histPorChave = new Map<string, DecisaoDiaGestaoEntrada['historico']>();
    for (const h of hist) {
      const key = `${h.idDocumentoEstoque}:${h.idItemDocumentoEstoque}:${h.idItemPedidoCompra}:${h.campo}`;
      const list = histPorChave.get(key) ?? [];
      list.push({
        texto: h.texto,
        usuarioLogin: h.usuarioLogin,
        criadoEm: h.criadoEm.toISOString(),
      });
      histPorChave.set(key, list);
    }
    for (const r of rows) {
      const key = `${r.idDocumentoEstoque}:${r.idItemDocumentoEstoque}:${r.idItemPedidoCompra}:${r.campo}`;
      const item: DecisaoDiaGestaoEntrada = {
        idItemDocumentoEstoque: r.idItemDocumentoEstoque,
        idItemPedidoCompra: r.idItemPedidoCompra,
        campo: r.campo,
        decisao: r.decisao,
        justificativaCodigo: r.justificativaOpcao.codigo,
        justificativaLabel: r.justificativaOpcao.label,
        observacao: r.observacao,
        usuarioLogin: r.usuarioLogin,
        atualizadoEm: r.atualizadoEm.toISOString(),
        historico: histPorChave.get(key) ?? [],
      };
      const list = map.get(r.idDocumentoEstoque) ?? [];
      list.push(item);
      map.set(r.idDocumentoEstoque, list);
    }
  }
  return map;
}
