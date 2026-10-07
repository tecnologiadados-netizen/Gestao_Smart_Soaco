/**
 * Gestão entradas — classificação da nota conferida e agregação do painel.
 * Decisão em nota ainda não conferida não entra no ranking (conferência incompleta).
 */
import { contarPendentesComparativoLogica } from '../utils/doubleCheckInPendencias.js';
import {
  classificarNaturezaDivergencia,
  observacaoNaturezaDivergencia,
  type NaturezaDivergencia,
} from '../services/doubleCheckInNatureza.js';

/** Reais é o padrão do painel: divergência benigna não entra na conta. */
export type EscopoDivergenciaGestaoEntrada = 'reais' | 'geral';

export function normalizarEscopoDivergencia(v: unknown): EscopoDivergenciaGestaoEntrada {
  return v === 'geral' ? 'geral' : 'reais';
}

export const CAMPOS_DIVERGENCIA_ENTRADA = [
  { campo: 'valor_unitario', label: 'Valor unitário' },
  { campo: 'qtde', label: 'Quantidade' },
  { campo: 'ipi', label: 'IPI' },
  { campo: 'condicao_pagamento', label: 'Condição de pagamento' },
] as const;

export type CampoDivergenciaEntrada = (typeof CAMPOS_DIVERGENCIA_ENTRADA)[number]['campo'];

export type StatusNotaGestaoEntrada = 'pendente' | 'limpa' | 'aceita' | 'recusa';

export type DocGestaoEntrada = {
  idDocumento: number;
  dataEntrada: string;
  idTipoMovimentacao: number;
  nomeTipo: string;
  itens: number;
};

export type DecisaoGestaoEntrada = {
  idDocumentoEstoque: number;
  idItemDocumentoEstoque?: number;
  idItemPedidoCompra?: number;
  campo: string;
  decisao: string;
  justificativaCodigo: string;
  justificativaLabel: string;
};

export type GestaoEntradasSerieDia = {
  data: string;
  notas: number;
  itens: number;
  limpas: number;
  aceitas: number;
  recusas: number;
  pendentes: number;
};

export type GestaoEntradasPainel = {
  dataInicio: string;
  dataFim: string;
  escopo: EscopoDivergenciaGestaoEntrada;
  kpis: {
    qtdeNotas: number;
    qtdeItens: number;
    qtdeConferidas: number;
    qtdePendentes: number;
    qtdeLimpas: number;
    qtdeAceitas: number;
    qtdeRecusas: number;
    /** Limpas ÷ conferidas. Null se nenhuma nota do período foi conferida. */
    pctLimpas: number | null;
    qtdeDecisoesAceitas: number;
    qtdeDecisoesRecusas: number;
    mediaNotasPorDia: number | null;
  };
  serieDiaria: GestaoEntradasSerieDia[];
  porCampo: Array<{
    campo: string;
    label: string;
    qtde: number;
    aceitas: number;
    recusas: number;
    documentos: number;
  }>;
  porJustificativa: Array<{ codigo: string; label: string; qtde: number }>;
  porTipo: Array<{
    idTipoMovimentacao: number;
    nomeTipo: string;
    notas: number;
    itens: number;
    /** NFs conferidas que ainda divergem do pedido de compra. */
    divergencias: number;
  }>;
};

const LABEL_CAMPO = new Map<string, string>(
  CAMPOS_DIVERGENCIA_ENTRADA.map((c) => [c.campo, c.label])
);

export function classificarNotaGestaoEntrada(
  conferida: boolean,
  decisoes: Array<{ decisao: string }>,
  /** False quando a NF × PC já foi igualada no ERP depois da conferência. */
  divergenciaAtual = true
): StatusNotaGestaoEntrada {
  if (!conferida) return 'pendente';
  if (!divergenciaAtual) return 'limpa';
  if (decisoes.some((d) => d.decisao === 'recusa')) return 'recusa';
  if (decisoes.some((d) => d.decisao === 'aceita')) return 'aceita';
  return 'limpa';
}

function labelCampo(campo: string): string {
  return LABEL_CAMPO.get(campo) ?? campo;
}

export function montarPainelGestaoEntradas(params: {
  dataInicio: string;
  dataFim: string;
  escopo?: EscopoDivergenciaGestaoEntrada;
  docs: DocGestaoEntrada[];
  idsConferidos: ReadonlySet<number>;
  /** Documentos em que a NF ainda diverge do pedido de compra. */
  idsComDivergenciaAtual: ReadonlySet<number>;
  decisoes: DecisaoGestaoEntrada[];
}): GestaoEntradasPainel {
  const decisoesPorDoc = new Map<number, DecisaoGestaoEntrada[]>();
  for (const d of params.decisoes) {
    const list = decisoesPorDoc.get(d.idDocumentoEstoque) ?? [];
    list.push(d);
    decisoesPorDoc.set(d.idDocumentoEstoque, list);
  }

  const serieMap = new Map<string, GestaoEntradasSerieDia>();
  const tipoMap = new Map<
    number,
    { nomeTipo: string; notas: number; itens: number; divergencias: number }
  >();
  const campoMap = new Map<string, { aceitas: number; recusas: number; documentos: Set<number> }>();
  for (const c of CAMPOS_DIVERGENCIA_ENTRADA) {
    campoMap.set(c.campo, { aceitas: 0, recusas: 0, documentos: new Set() });
  }
  const justMap = new Map<string, { label: string; qtde: number }>();

  let qtdeLimpas = 0;
  let qtdeAceitas = 0;
  let qtdeRecusas = 0;
  let qtdePendentes = 0;
  let qtdeItens = 0;
  let qtdeDecisoesAceitas = 0;
  let qtdeDecisoesRecusas = 0;

  for (const doc of params.docs) {
    qtdeItens += doc.itens;
    const conferida = params.idsConferidos.has(doc.idDocumento);
    const divergenciaAtual = params.idsComDivergenciaAtual.has(doc.idDocumento);
    const decisoesDoc =
      conferida && divergenciaAtual ? (decisoesPorDoc.get(doc.idDocumento) ?? []) : [];
    const status = classificarNotaGestaoEntrada(conferida, decisoesDoc, divergenciaAtual);

    if (status === 'limpa') qtdeLimpas += 1;
    else if (status === 'aceita') qtdeAceitas += 1;
    else if (status === 'recusa') qtdeRecusas += 1;
    else qtdePendentes += 1;

    const dia = serieMap.get(doc.dataEntrada) ?? {
      data: doc.dataEntrada,
      notas: 0,
      itens: 0,
      limpas: 0,
      aceitas: 0,
      recusas: 0,
      pendentes: 0,
    };
    dia.notas += 1;
    dia.itens += doc.itens;
    if (status === 'limpa') dia.limpas += 1;
    else if (status === 'aceita') dia.aceitas += 1;
    else if (status === 'recusa') dia.recusas += 1;
    else dia.pendentes += 1;
    serieMap.set(doc.dataEntrada, dia);

    const tipo = tipoMap.get(doc.idTipoMovimentacao) ?? {
      nomeTipo: doc.nomeTipo,
      notas: 0,
      itens: 0,
      divergencias: 0,
    };
    tipo.notas += 1;
    tipo.itens += doc.itens;
    if (conferida && divergenciaAtual) tipo.divergencias += 1;
    if (!tipo.nomeTipo && doc.nomeTipo) tipo.nomeTipo = doc.nomeTipo;
    tipoMap.set(doc.idTipoMovimentacao, tipo);

    if (!conferida) continue;
    for (const dec of decisoesDoc) {
      if (dec.decisao !== 'aceita' && dec.decisao !== 'recusa') continue;
      const campo = campoMap.get(dec.campo) ?? { aceitas: 0, recusas: 0, documentos: new Set<number>() };
      campo.documentos.add(doc.idDocumento);
      if (dec.decisao === 'aceita') {
        campo.aceitas += 1;
        qtdeDecisoesAceitas += 1;
        const codigo = dec.justificativaCodigo || 'sem_codigo';
        const just = justMap.get(codigo) ?? {
          label: dec.justificativaLabel || codigo,
          qtde: 0,
        };
        just.qtde += 1;
        if (dec.justificativaLabel) just.label = dec.justificativaLabel;
        justMap.set(codigo, just);
      } else {
        campo.recusas += 1;
        qtdeDecisoesRecusas += 1;
      }
      campoMap.set(dec.campo, campo);
    }
  }

  const qtdeNotas = params.docs.length;
  const qtdeConferidas = qtdeLimpas + qtdeAceitas + qtdeRecusas;
  const diasComMovimento = serieMap.size;

  const porCampo = [...campoMap.entries()]
    .map(([campo, v]) => ({
      campo,
      label: labelCampo(campo),
      qtde: v.aceitas + v.recusas,
      aceitas: v.aceitas,
      recusas: v.recusas,
      documentos: v.documentos.size,
    }))
    .sort((a, b) => b.qtde - a.qtde || a.label.localeCompare(b.label, 'pt-BR'));

  const porJustificativa = [...justMap.entries()]
    .map(([codigo, v]) => ({ codigo, label: v.label, qtde: v.qtde }))
    .sort((a, b) => b.qtde - a.qtde || a.label.localeCompare(b.label, 'pt-BR'));

  const porTipo = [...tipoMap.entries()]
    .map(([idTipoMovimentacao, v]) => ({
      idTipoMovimentacao,
      nomeTipo: v.nomeTipo || `Tipo ${idTipoMovimentacao}`,
      notas: v.notas,
      itens: v.itens,
      divergencias: v.divergencias,
    }))
    .sort((a, b) => b.notas - a.notas || a.nomeTipo.localeCompare(b.nomeTipo, 'pt-BR'));

  const serieDiaria = [...serieMap.values()].sort((a, b) => a.data.localeCompare(b.data));

  return {
    dataInicio: params.dataInicio,
    dataFim: params.dataFim,
    escopo: params.escopo ?? 'reais',
    kpis: {
      qtdeNotas,
      qtdeItens,
      qtdeConferidas,
      qtdePendentes,
      qtdeLimpas,
      qtdeAceitas,
      qtdeRecusas,
      pctLimpas: qtdeConferidas > 0 ? (qtdeLimpas / qtdeConferidas) * 100 : null,
      qtdeDecisoesAceitas,
      qtdeDecisoesRecusas,
      mediaNotasPorDia: diasComMovimento > 0 ? qtdeNotas / diasComMovimento : null,
    },
    serieDiaria,
    porCampo,
    porJustificativa,
    porTipo,
  };
}

const FLAGS_CAMPO_ATUAL = [
  { campo: 'valor_unitario', flag: 'divergValorUnitario' },
  { campo: 'qtde', flag: 'divergQtde' },
  { campo: 'ipi', flag: 'divergIpi' },
  { campo: 'condicao_pagamento', flag: 'divergCondicaoPagamento' },
] as const;

export type ObsDivergenciaEntrada = {
  texto: string;
  usuarioLogin: string;
  criadoEm: string;
};

export type DivergenciaAtualEntrada = {
  codigoProduto: string | null;
  descricaoProduto: string | null;
  nomePedidoCompra: string | null;
  campo: string;
  campoLabel: string;
  natureza: NaturezaDivergencia;
  /** Valor exibido na NF, no mesmo formato do Double Check. */
  valorNf: string;
  /** Valor exibido no pedido de compra. */
  valorPc: string;
  detalheNf: string | null;
  detalhePc: string | null;
  decisao: 'aceita' | 'recusa' | null;
  justificativaCodigo: string | null;
  justificativaLabel: string | null;
  observacaoNatureza: string | null;
  observacoes: ObsDivergenciaEntrada[];
};

export type LinhaComparativoDia = {
  idItemDocumentoEstoque: number;
  idItemPedidoCompra: number;
  codigoProduto: string | null;
  descricaoProduto: string | null;
  nomePedidoCompra?: string | null;
  qtdeNF?: number;
  umNF?: string | null;
  qtdePC?: number;
  umPC?: string | null;
  valorUnitarioBrutoNF?: number;
  valorUnitarioBrutoPC?: number;
  descontoNF?: number;
  descontoPC?: number;
  valorUnitarioNF?: number;
  valorUnitarioPC?: number;
  valorIpiNF?: number;
  valorIpiPC?: number;
  condicaoPagamentoNF?: string | null;
  regraPagamentoNF?: string | null;
  condicaoPagamentoPC?: string | null;
  regraPagamentoPC?: string | null;
  prazosLabelNF?: string | null;
  prazosLabelPC?: string | null;
  dataBaseParcelasNF?: string | null;
  dataBaseParcelasPC?: string | null;
  parcelasNF?: Array<{
    dias: number | null;
    dataBase?: string | null;
    dataVencimento?: string | null;
  }>;
  parcelasPC?: Array<{
    dias: number | null;
    dataBase?: string | null;
    dataVencimento?: string | null;
  }>;
  prazosDiasNF?: number[];
  prazosDiasPC?: number[];
  divergValorUnitario: boolean;
  divergQtde: boolean;
  divergIpi: boolean;
  divergCondicaoPagamento: boolean;
};

export type DecisaoDiaGestaoEntrada = {
  idItemDocumentoEstoque: number;
  idItemPedidoCompra: number;
  campo: string;
  decisao: string;
  justificativaLabel: string;
  justificativaCodigo?: string;
  observacao: string | null;
  usuarioLogin: string;
  atualizadoEm: string;
  historico: ObsDivergenciaEntrada[];
};

function chaveCampo(idItemNf: number, idItemPc: number, campo: string): string {
  return `${idItemNf}:${idItemPc}:${campo}`;
}

const nfBrl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const nfQtde = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });

function num(v: number | undefined): number {
  return Number.isFinite(v) ? Number(v) : 0;
}

function descontoUnitario(descontoTotal: number, qtde: number): number {
  if (!(descontoTotal > 0)) return 0;
  if (!(qtde > 0)) return descontoTotal;
  return Math.round((descontoTotal / qtde + Number.EPSILON) * 100) / 100;
}

function fmtUnitario(
  liquido: number,
  bruto: number,
  descontoTotal: number,
  qtde: number
): { principal: string; detalhe: string | null } {
  if (descontoTotal > 0) {
    const descUn = descontoUnitario(descontoTotal, qtde);
    return {
      principal: `${nfBrl.format(liquido)} líq.`,
      detalhe: `bruto ${nfBrl.format(bruto)} · −desc. un. ${nfBrl.format(descUn)}`,
    };
  }
  return { principal: nfBrl.format(liquido), detalhe: null };
}

function fmtCondicao(
  nome: string | null | undefined,
  regra: string | null | undefined,
  prazosLabel: string | null | undefined
): { principal: string; detalhe: string | null } {
  const n = (nome ?? '').trim() || '—';
  const r = (regra ?? '').trim();
  const principal = r ? `${n} · ${r}` : n;
  const prazos = (prazosLabel ?? '').trim();
  return { principal, detalhe: prazos ? `prazos ${prazos}d` : null };
}

/** Mesma leitura do comparativo NF × PC do Double Check, só do campo que diverge. */
export function textoComparativoCampo(
  linha: LinhaComparativoDia,
  campo: string
): { nf: string; pc: string; detalheNf: string | null; detalhePc: string | null } {
  if (campo === 'qtde') {
    const umNf = (linha.umNF ?? '').trim();
    const umPc = (linha.umPC ?? '').trim();
    return {
      nf: `${nfQtde.format(num(linha.qtdeNF))}${umNf ? ` ${umNf}` : ''}`,
      pc: `${nfQtde.format(num(linha.qtdePC))}${umPc ? ` ${umPc}` : ''}`,
      detalheNf: null,
      detalhePc: null,
    };
  }
  if (campo === 'ipi') {
    return {
      nf: nfBrl.format(num(linha.valorIpiNF)),
      pc: nfBrl.format(num(linha.valorIpiPC)),
      detalheNf: null,
      detalhePc: null,
    };
  }
  if (campo === 'condicao_pagamento') {
    const nf = fmtCondicao(linha.condicaoPagamentoNF, linha.regraPagamentoNF, linha.prazosLabelNF);
    const pc = fmtCondicao(linha.condicaoPagamentoPC, linha.regraPagamentoPC, linha.prazosLabelPC);
    return { nf: nf.principal, pc: pc.principal, detalheNf: nf.detalhe, detalhePc: pc.detalhe };
  }
  const nf = fmtUnitario(
    num(linha.valorUnitarioNF),
    num(linha.valorUnitarioBrutoNF),
    num(linha.descontoNF),
    num(linha.qtdeNF)
  );
  const pc = fmtUnitario(
    num(linha.valorUnitarioPC),
    num(linha.valorUnitarioBrutoPC),
    num(linha.descontoPC),
    num(linha.qtdePC)
  );
  return { nf: nf.principal, pc: pc.principal, detalheNf: nf.detalhe, detalhePc: pc.detalhe };
}

function observacoesDaDecisao(dec: DecisaoDiaGestaoEntrada): ObsDivergenciaEntrada[] {
  const hist = dec.historico.filter((h) => h.texto.trim());
  if (hist.length > 0) return hist;
  const texto = dec.observacao?.trim();
  if (!texto) return [];
  return [{ texto, usuarioLogin: dec.usuarioLogin, criadoEm: dec.atualizadoEm }];
}

/** Divergências que ainda existem na NF × PC, com a decisão e as observações daquele campo. */
export function montarDivergenciasAtuais(params: {
  linhas: LinhaComparativoDia[];
  decisoes: DecisaoDiaGestaoEntrada[];
}): DivergenciaAtualEntrada[] {
  const porCampo = new Map<string, DecisaoDiaGestaoEntrada>();
  for (const d of params.decisoes) {
    porCampo.set(chaveCampo(d.idItemDocumentoEstoque, d.idItemPedidoCompra, d.campo), d);
  }
  const out: DivergenciaAtualEntrada[] = [];
  for (const linha of params.linhas) {
    for (const spec of FLAGS_CAMPO_ATUAL) {
      if (!linha[spec.flag]) continue;
      const dec = porCampo.get(
        chaveCampo(linha.idItemDocumentoEstoque, linha.idItemPedidoCompra, spec.campo)
      );
      const decisao = dec?.decisao === 'aceita' || dec?.decisao === 'recusa' ? dec.decisao : null;
      const comparacao = textoComparativoCampo(linha, spec.campo);
      out.push({
        codigoProduto: linha.codigoProduto,
        descricaoProduto: linha.descricaoProduto,
        nomePedidoCompra: linha.nomePedidoCompra ?? null,
        campo: spec.campo,
        campoLabel: labelCampo(spec.campo),
        natureza: classificarNaturezaDivergencia({
          linha,
          campo: spec.campo,
          justificativaCodigo: dec?.justificativaCodigo,
        }),
        valorNf: comparacao.nf,
        valorPc: comparacao.pc,
        detalheNf: comparacao.detalheNf,
        detalhePc: comparacao.detalhePc,
        decisao,
        justificativaCodigo: dec?.justificativaCodigo ?? null,
        justificativaLabel: dec?.justificativaLabel ?? null,
        observacaoNatureza: observacaoNaturezaDivergencia({
          linha,
          campo: spec.campo,
        }),
        observacoes: dec ? observacoesDaDecisao(dec) : [],
      });
    }
  }
  return out;
}

export type DocumentoNoEscopo = {
  divergencias: DivergenciaAtualEntrada[];
  temDivergencia: boolean;
  pendentes: number;
  /** Item × pedido × campo que ainda diverge dentro do escopo. */
  chaves: Set<string>;
};

type LinhaComPedido = LinhaComparativoDia & { idPedidoCompra?: number | null };

function linhaDentroDoEscopo(
  linha: LinhaComPedido,
  decisoesPorCampo: Map<string, DecisaoDiaGestaoEntrada>,
  escopo: EscopoDivergenciaGestaoEntrada
): LinhaComPedido {
  if (escopo === 'geral') return linha;
  const proxima: LinhaComPedido = { ...linha };
  for (const spec of FLAGS_CAMPO_ATUAL) {
    if (!linha[spec.flag]) continue;
    const dec = decisoesPorCampo.get(
      chaveCampo(linha.idItemDocumentoEstoque, linha.idItemPedidoCompra, spec.campo)
    );
    const natureza = classificarNaturezaDivergencia({
      linha,
      campo: spec.campo,
      justificativaCodigo: dec?.justificativaCodigo,
    });
    if (natureza !== 'real') proxima[spec.flag] = false;
  }
  return proxima;
}

/**
 * Visão real descarta divergência benigna antes de status, ranking e pendência.
 * Visão geral mantém valor, quantidade, IPI e pagamento.
 */
export function prepararDocumentoNoEscopo(params: {
  linhas: LinhaComPedido[];
  decisoes: DecisaoDiaGestaoEntrada[];
  escopo: EscopoDivergenciaGestaoEntrada;
}): DocumentoNoEscopo {
  const decisoesPorCampo = new Map<string, DecisaoDiaGestaoEntrada>();
  for (const d of params.decisoes) {
    decisoesPorCampo.set(chaveCampo(d.idItemDocumentoEstoque, d.idItemPedidoCompra, d.campo), d);
  }
  const linhas = params.linhas.map((linha) =>
    linhaDentroDoEscopo(linha, decisoesPorCampo, params.escopo)
  );
  const divergencias = montarDivergenciasAtuais({ linhas, decisoes: params.decisoes });
  const chaves = new Set<string>();
  for (const linha of linhas) {
    for (const spec of FLAGS_CAMPO_ATUAL) {
      if (!linha[spec.flag]) continue;
      chaves.add(chaveCampo(linha.idItemDocumentoEstoque, linha.idItemPedidoCompra, spec.campo));
    }
  }
  const pendentes = contarPendentesComparativoLogica(
    linhas.map((linha) => ({
      idItemDocumentoEstoque: linha.idItemDocumentoEstoque,
      idItemPedidoCompra: linha.idItemPedidoCompra,
      idPedidoCompra: linha.idPedidoCompra ?? null,
      divergValorUnitario: linha.divergValorUnitario,
      divergQtde: linha.divergQtde,
      divergIpi: linha.divergIpi,
      divergCondicaoPagamento: linha.divergCondicaoPagamento,
    })),
    params.decisoes
  );
  return {
    divergencias,
    temDivergencia: divergencias.length > 0,
    pendentes,
    chaves,
  };
}
