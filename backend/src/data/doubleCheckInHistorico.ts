/**
 * Linha do tempo auditável de um documento do Double Check.
 * Só entra o que já está gravado. O desvínculo antigo não tem hora.
 */
import { prisma } from '../config/prisma.js';
import { getNomusPool, isNomusEnabled, nomusQueryWithRetry } from '../config/nomusDb.js';
import { formatSqlDateYmd } from './dfcDateUtils.js';
import { buscarCompradorPorItemPedido } from './doubleCheckInDivergenciaApontada.js';
import { listarDecisoesComparativo } from './doubleCheckInLocalRepository.js';
import { queryDoubleCheckInComparativoPc } from './doubleCheckInRepository.js';
import {
  RECEBIMENTO_STATUS_LABEL,
  type RecebimentoStatus,
} from './recebimentoNomusRepository.js';

export const AVISO_HISTORICO_DOUBLE_CHECK =
  'A linha começa quando o documento é criado no Nomus. O primeiro vínculo com pedido é a primeira vez que o Double Check viu a nota ligada, ou o vínculo que existe agora quando essa leitura ainda não aconteceu. O Nomus não guarda a hora de cada vínculo. No fim, a linha diz se o mesmo pedido permaneceu ou se houve desvínculo e um vínculo posterior.';

export type PrecisaoHistorico = 'instante' | 'dia' | 'sem_data';
export type TomHistorico = 'neutro' | 'atencao' | 'ok' | 'info';

export type EventoHistoricoDoubleCheck = {
  id: string;
  em: string | null;
  precisao: PrecisaoHistorico;
  tom: TomHistorico;
  titulo: string;
  detalhe: string;
  ator: string | null;
  fonte: string;
  /** Abre o comparativo NF × pedido. `leitura` usa a primeira leitura, não o vínculo de agora. */
  abreComparativo: boolean;
  origemComparativo?: 'leitura' | 'atual';
  /** Linha curta, sem card. O vínculo ficou e nada mais mudou. */
  legenda?: boolean;
};

export type DocumentoHistoricoCabecalho = {
  idDocumento: number;
  numeroDocumentoFiscal: string | null;
  numeroNfe: string | null;
  dataEmissao: string | null;
  dataEntrada: string | null;
  nomeParceiro: string | null;
  idTipoMovimentacao: number;
  tipoMovimentacao: string | null;
  dataCriacao: string | null;
  nomeUsuarioCriacao: string | null;
};

export type HistoricoDoubleCheck = {
  documento: DocumentoHistoricoCabecalho;
  aviso: string;
  eventos: EventoHistoricoDoubleCheck[];
};

export type ItemHistoricoVinculo = {
  idItemDocumentoEstoque: number;
  codigoProduto: string | null;
  descricaoProduto: string | null;
  idItemPedidoCompra: number | null;
  idPedidoCompra: number | null;
  nomePedidoCompra: string | null;
  nomeComprador: string | null;
  qtdeNF: number;
  qtdePC: number | null;
  valorUnitarioNF: number;
  valorUnitarioPC: number | null;
};

export type SnapshotHistorico = {
  idItemDocumentoEstoque: number;
  idItemPedidoCompra: number;
  idPedidoCompra: number;
  nomePedidoCompra: string;
  nomeComprador: string;
  campo: string;
  natureza: string;
  apontadoEm: string;
};

export type DecisaoHistorico = {
  idItemDocumentoEstoque: number;
  idItemPedidoCompra: number;
  campo: string;
  decisao: string;
  justificativaLabel: string;
  usuarioLogin: string;
  atualizadoEm: string;
  vigente: boolean;
  observacoes: Array<{ texto: string; usuarioLogin: string; criadoEm: string }>;
};

export type ConferenciaHistorico = {
  conferidoEm: string;
  usuarioLogin: string;
  reabertoEm: string | null;
  reabertoPorLogin: string | null;
  totalDivergenciasReaisHistorica: number;
  totalDivergenciasBenignasHist: number;
};

export type RecebimentoCicloHistorico = {
  statusRetorno: string;
  conferenteNome: string | null;
  arquivadoEm: string;
};

export type RecebimentoHistorico = {
  status: string;
  createdAt: string;
  atribuidoEm: string | null;
  conferenteNome: string | null;
  conferenteLogin: string | null;
  iniciadoEm: string | null;
  finalizadoEm: string | null;
  mesaUltimaAcao: string | null;
  mesaAcaoEm: string | null;
  mesaAcaoPorLogin: string | null;
  mesaAceiteJustificativa: string | null;
  numeroDocumentoDevolucao: string | null;
  numeroNfeDevolucao: string | null;
  devolucaoVinculadaEm: string | null;
  ciclos: RecebimentoCicloHistorico[];
};

export type AlertaHistorico = {
  enviadoEm: string;
  resumo: string | null;
};

export type LinhaAtualHistorico = {
  idItemDocumentoEstoque: number;
  idItemPedidoCompra: number;
  nomePedidoCompra: string | null;
  codigoProduto: string | null;
  descricaoProduto: string | null;
  qtdeNF: number;
  qtdePC: number;
  valorUnitarioNF: number;
  valorUnitarioPC: number;
  valorIpiNF: number;
  valorIpiPC: number;
  condicaoPagamentoNF: string | null;
  condicaoPagamentoPC: string | null;
  divergValorUnitario: boolean;
  divergQtde: boolean;
  divergIpi: boolean;
  divergCondicaoPagamento: boolean;
};

export type EntradaHistoricoDoubleCheck = {
  documento: DocumentoHistoricoCabecalho;
  itens: ItemHistoricoVinculo[];
  snapshots: SnapshotHistorico[];
  linhasAtuais: LinhaAtualHistorico[];
  decisoes: DecisaoHistorico[];
  conferencia: ConferenciaHistorico | null;
  recebimento: RecebimentoHistorico | null;
  alerta: AlertaHistorico | null;
};

const LABEL_CAMPO: Record<string, string> = {
  valor_unitario: 'Valor unitário',
  qtde: 'Quantidade',
  ipi: 'IPI',
  condicao_pagamento: 'Condição de pagamento',
};

const MESA_ACAO: Record<string, string> = {
  MOVIMENTACAO_ALTERADA: 'Mesa alterou o tipo de movimentação',
  TRATAMENTO_COMPRAS: 'Mesa devolveu para o Compras tratar',
  REENVIAR_CONFERENCIA: 'Mesa enviou para conferência de novo',
  DEVOLVER_MATERIAL: 'Mesa pediu devolução do material',
  ACEITAR_COMO_ESTA: 'Mesa aceitou a quantidade como está',
};

function labelCampo(campo: string): string {
  return LABEL_CAMPO[campo] ?? campo;
}

function labelStatusRecebimento(status: string): string {
  return RECEBIMENTO_STATUS_LABEL[status as RecebimentoStatus] ?? status;
}

function produtoLabel(codigo: string | null, descricao: string | null): string {
  const cod = (codigo ?? '').trim();
  const desc = (descricao ?? '').trim();
  if (cod && desc) return `${cod} — ${desc}`;
  return cod || desc || 'Item';
}

function pedidoLabel(nome: string | null, id: number | null): string {
  const n = (nome ?? '').trim();
  if (n) return n;
  return id != null && id > 0 ? `PC ${id}` : 'pedido';
}

function chaveVinculo(idItemDocumento: number, idItemPedido: number): string {
  return `${idItemDocumento}:${idItemPedido}`;
}

function chaveCampo(idItemDocumento: number, idItemPedido: number, campo: string): string {
  return `${chaveVinculo(idItemDocumento, idItemPedido)}:${campo}`;
}

function aindaDiverge(linha: LinhaAtualHistorico, campo: string): boolean {
  if (campo === 'valor_unitario') return linha.divergValorUnitario;
  if (campo === 'qtde') return linha.divergQtde;
  if (campo === 'ipi') return linha.divergIpi;
  if (campo === 'condicao_pagamento') return linha.divergCondicaoPagamento;
  return false;
}

function evento(
  partial: Omit<EventoHistoricoDoubleCheck, 'abreComparativo'> & { abreComparativo?: boolean }
): EventoHistoricoDoubleCheck {
  return { abreComparativo: false, ...partial };
}

function fmtDia(ymd: string | null): string | null {
  if (!ymd) return null;
  const [ano, mes, dia] = ymd.slice(0, 10).split('-');
  if (!ano || !mes || !dia) return ymd;
  return `${dia}/${mes}/${ano}`;
}

function diaSaoPaulo(iso: string): string | null {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(data);
}

function fmtDataHora(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return data.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function isoDeData(v: unknown): string | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
  const s = String(v ?? '').trim();
  if (!s) return null;
  const data = new Date(s);
  return Number.isNaN(data.getTime()) ? null : data.toISOString();
}

export function montarEventosHistorico(entrada: EntradaHistoricoDoubleCheck): EventoHistoricoDoubleCheck[] {
  const doc = entrada.documento;
  const dated: EventoHistoricoDoubleCheck[] = [];
  const depoisLeitura: EventoHistoricoDoubleCheck[] = [];
  const logoAposCriacao: EventoHistoricoDoubleCheck[] = [];

  const diaCriacao = doc.dataCriacao ? diaSaoPaulo(doc.dataCriacao) : null;
  const entradaNoMesmoDia = Boolean(doc.dataEntrada && diaCriacao && doc.dataEntrada.slice(0, 10) === diaCriacao);
  const detalheCriacao = [
    doc.tipoMovimentacao ? `Tipo de movimentação: ${doc.tipoMovimentacao}.` : null,
    [doc.numeroNfe ? `NF-e ${doc.numeroNfe}` : null, doc.numeroDocumentoFiscal, doc.nomeParceiro]
      .filter(Boolean)
      .join(' · ') || null,
    doc.dataEmissao ? `Nota emitida em ${fmtDia(doc.dataEmissao)}.` : null,
    doc.dataCriacao ? `Criação do documento em ${fmtDataHora(doc.dataCriacao)}.` : null,
    doc.dataEntrada && !entradaNoMesmoDia ? `Entrada no estoque em ${fmtDia(doc.dataEntrada)}.` : null,
  ]
    .filter((parte): parte is string => Boolean(parte))
    .join('\n');
  if (doc.dataCriacao) {
    dated.push(
      evento({
        id: 'criado',
        em: doc.dataCriacao,
        precisao: 'instante',
        tom: 'neutro',
        titulo: 'Documento criado',
        detalhe: detalheCriacao || 'Criação do documento no Nomus.',
        ator: doc.nomeUsuarioCriacao,
        fonte: 'Nomus · criação do documento',
      })
    );
  } else if (doc.dataEntrada) {
    dated.push(
      evento({
        id: 'criado',
        em: doc.dataEntrada,
        precisao: 'dia',
        tom: 'neutro',
        titulo: 'Documento criado',
        detalhe: detalheCriacao || 'O Nomus não guardou a hora da criação. Vale a data de entrada.',
        ator: doc.nomeUsuarioCriacao,
        fonte: 'Nomus · data de entrada',
      })
    );
  }

  const produtoPorItem = new Map<number, { codigo: string | null; descricao: string | null }>();
  for (const item of entrada.itens) {
    produtoPorItem.set(item.idItemDocumentoEstoque, {
      codigo: item.codigoProduto,
      descricao: item.descricaoProduto,
    });
  }
  const linhaPorVinculo = new Map<string, LinhaAtualHistorico>();
  for (const linha of entrada.linhasAtuais) {
    linhaPorVinculo.set(chaveVinculo(linha.idItemDocumentoEstoque, linha.idItemPedidoCompra), linha);
    if (!produtoPorItem.has(linha.idItemDocumentoEstoque)) {
      produtoPorItem.set(linha.idItemDocumentoEstoque, {
        codigo: linha.codigoProduto,
        descricao: linha.descricaoProduto,
      });
    }
  }

  const vinculosAtuais = new Set<string>();
  for (const item of entrada.itens) {
    if (item.idItemPedidoCompra != null && item.idItemPedidoCompra > 0) {
      vinculosAtuais.add(chaveVinculo(item.idItemDocumentoEstoque, item.idItemPedidoCompra));
    }
  }
  for (const linha of entrada.linhasAtuais) vinculosAtuais.add(chaveVinculo(linha.idItemDocumentoEstoque, linha.idItemPedidoCompra));

  const aceitas = new Set(
    entrada.decisoes
      .filter((d) => d.decisao === 'aceita' && d.vigente)
      .map((d) => chaveCampo(d.idItemDocumentoEstoque, d.idItemPedidoCompra, d.campo))
  );

  const gruposLeitura = new Map<string, SnapshotHistorico[]>();
  for (const snap of entrada.snapshots) {
    const chave = snap.apontadoEm.slice(0, 19);
    const lista = gruposLeitura.get(chave) ?? [];
    lista.push(snap);
    gruposLeitura.set(chave, lista);
  }

  let leituraSeq = 0;
  for (const [quando, snaps] of [...gruposLeitura.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    leituraSeq += 1;
    const pedidos = [...new Set(snaps.map((snap) => `${pedidoLabel(snap.nomePedidoCompra, snap.idPedidoCompra)} · ${snap.nomeComprador?.trim() || 'Sem comprador'}`))];
    const qtde = snaps.length;
    dated.push(
      evento({
        id: `leitura-${leituraSeq}`,
        em: snaps[0]?.apontadoEm ?? quando,
        precisao: 'instante',
        tom: 'atencao',
        titulo: leituraSeq === 1 ? 'Vinculado ao pedido' : 'Nova leitura do mesmo vínculo',
        detalhe: `${pedidos.join('\n')}\n${qtde} ${qtde === 1 ? 'divergência na primeira leitura' : 'divergências na primeira leitura'}.`,
        ator: null,
        fonte: 'Registro local · primeira leitura do Double Check',
        abreComparativo: true,
        origemComparativo: 'leitura',
      })
    );
  }

  const desfeitos = new Map<string, SnapshotHistorico[]>();
  const ajustados: string[] = [];
  for (const snap of entrada.snapshots) {
    const vinculo = chaveVinculo(snap.idItemDocumentoEstoque, snap.idItemPedidoCompra);
    if (!vinculosAtuais.has(vinculo)) {
      const lista = desfeitos.get(vinculo) ?? [];
      lista.push(snap);
      desfeitos.set(vinculo, lista);
      continue;
    }
    if (aceitas.has(chaveCampo(snap.idItemDocumentoEstoque, snap.idItemPedidoCompra, snap.campo))) continue;
    const linha = linhaPorVinculo.get(vinculo);
    if (linha && !aindaDiverge(linha, snap.campo)) {
      const prod = produtoPorItem.get(snap.idItemDocumentoEstoque);
      ajustados.push(
        `${produtoLabel(prod?.codigo ?? null, prod?.descricao ?? null)} · ${pedidoLabel(snap.nomePedidoCompra, snap.idPedidoCompra)} · ${labelCampo(snap.campo)} deixou de divergir, sem aceite`
      );
    }
  }

  let desfeitoSeq = 0;
  for (const snaps of desfeitos.values()) {
    desfeitoSeq += 1;
    const base = snaps[0]!;
    depoisLeitura.push(
      evento({
        id: `desfeito-${desfeitoSeq}`,
        em: null,
        precisao: 'sem_data',
        tom: 'atencao',
        titulo: 'Desvinculado do pedido',
        detalhe: `${pedidoLabel(base.nomePedidoCompra, base.idPedidoCompra)} · ${base.nomeComprador || 'Sem comprador'}. A hora do desvínculo não ficou registrada.`,
        ator: null,
        fonte: 'Retrato local comparado com o vínculo atual do Nomus',
        abreComparativo: true,
        origemComparativo: 'leitura',
      })
    );
  }

  if (ajustados.length > 0) {
    depoisLeitura.push(
      evento({
        id: 'ajustado',
        em: null,
        precisao: 'sem_data',
        tom: 'info',
        titulo: 'Diferença sumiu sem aceite',
        detalhe: `${ajustados.length} ${ajustados.length === 1 ? 'campo deixou' : 'campos deixaram'} de divergir, sem aceite. A hora do ajuste não ficou registrada.`,
        ator: null,
        fonte: 'Retrato local comparado com a leitura atual',
        abreComparativo: true,
      })
    );
  }

  const chavesPrimeiroVinculo = new Set(
    entrada.snapshots.map((snap) => chaveVinculo(snap.idItemDocumentoEstoque, snap.idItemPedidoCompra))
  );
  const itensLigados = entrada.itens.filter((item) => (item.idItemPedidoCompra ?? 0) > 0);
  const posteriores =
    entrada.snapshots.length > 0
      ? itensLigados.filter(
          (item) =>
            !chavesPrimeiroVinculo.has(chaveVinculo(item.idItemDocumentoEstoque, item.idItemPedidoCompra ?? 0))
        )
      : [];
  const textoPedido = (nome: string | null, id: number | null, comprador: string | null): string =>
    `${pedidoLabel(nome, id)} · ${comprador?.trim() || 'Sem comprador'}`;
  const resumoItens = (itens: ItemHistoricoVinculo[]): string =>
    [...new Set(itens.map((item) => textoPedido(item.nomePedidoCompra, item.idPedidoCompra, item.nomeComprador)))].join('\n');
  const qtdeDivergenciasAgora = entrada.linhasAtuais.reduce((total, linha) => {
    return (
      total +
      Number(linha.divergValorUnitario) +
      Number(linha.divergQtde) +
      Number(linha.divergIpi) +
      Number(linha.divergCondicaoPagamento)
    );
  }, 0);
  const fraseDivergenciaAtual =
    qtdeDivergenciasAgora === 0
      ? 'Nenhuma divergência na leitura atual.'
      : `${qtdeDivergenciasAgora} ${qtdeDivergenciasAgora === 1 ? 'divergência na leitura atual' : 'divergências na leitura atual'}.`;

  if (posteriores.length > 0) {
    depoisLeitura.push(
      evento({
        id: 'posterior',
        em: null,
        precisao: 'sem_data',
        tom: 'info',
        titulo: 'Vinculado depois a outro pedido',
        detalhe: `${resumoItens(posteriores)}\nEste pedido não estava no primeiro vínculo. A hora desse novo vínculo não ficou registrada.`,
        ator: null,
        fonte: 'Vínculo atual do Nomus comparado com o primeiro vínculo lido',
        abreComparativo: true,
      })
    );
  }

  const vinculoPermaneceu =
    entrada.snapshots.length > 0 && desfeitos.size === 0 && posteriores.length === 0 && itensLigados.length > 0;
  const houveAndamentoDepois =
    entrada.decisoes.length > 0 || ajustados.length > 0 || Boolean(entrada.conferencia);
  if (vinculoPermaneceu && !houveAndamentoDepois) {
    depoisLeitura.push(
      evento({
        id: 'permanece-igual',
        em: null,
        precisao: 'sem_data',
        tom: 'ok',
        titulo: 'Documento permanece igual',
        detalhe: '',
        ator: null,
        fonte: '',
        legenda: true,
      })
    );
  }

  if (entrada.snapshots.length === 0 && itensLigados.length > 0) {
    logoAposCriacao.push(
      evento({
        id: 'vinculo-atual',
        em: null,
        precisao: 'sem_data',
        tom: 'info',
        titulo: 'Vinculado ao pedido',
        detalhe: `${resumoItens(itensLigados)}\nNão há leitura anterior deste vínculo. A hora em que ele foi feito não ficou registrada.\n${fraseDivergenciaAtual}`,
        ator: null,
        fonte: 'Vínculo atual do Nomus',
        abreComparativo: true,
      })
    );
  }

  if (itensLigados.length === 0 && entrada.snapshots.length === 0) {
    depoisLeitura.push(
      evento({
        id: 'sem-vinculo',
        em: null,
        precisao: 'sem_data',
        tom: 'neutro',
        titulo: 'Nenhum vínculo com pedido',
        detalhe: 'O documento foi criado e nenhum item está ligado a pedido. Também não ficou registrado um vínculo anterior.',
        ator: null,
        fonte: 'Vínculo atual do Nomus',
      })
    );
  }

  for (const decisao of entrada.decisoes) {
    const prod = produtoPorItem.get(decisao.idItemDocumentoEstoque);
    const linha = linhaPorVinculo.get(chaveVinculo(decisao.idItemDocumentoEstoque, decisao.idItemPedidoCompra));
    const snapPedido = entrada.snapshots.find(
      (snap) =>
        snap.idItemDocumentoEstoque === decisao.idItemDocumentoEstoque &&
        snap.idItemPedidoCompra === decisao.idItemPedidoCompra
    );
    const pedido = pedidoLabel(
      linha?.nomePedidoCompra ?? snapPedido?.nomePedidoCompra ?? null,
      snapPedido?.idPedidoCompra ?? null
    );
    const acao = decisao.decisao === 'recusa' ? 'recusou' : 'aceitou';
    const ciclo = decisao.vigente ? '' : ' Esta gravação é de antes da reabertura e deixou de valer.';
    dated.push(
      evento({
        id: `decisao-${decisao.idItemDocumentoEstoque}-${decisao.idItemPedidoCompra}-${decisao.campo}`,
        em: decisao.atualizadoEm,
        precisao: 'instante',
        tom: decisao.decisao === 'recusa' ? 'atencao' : 'ok',
        titulo: decisao.decisao === 'recusa' ? 'Divergência recusada' : 'Divergência aceita',
        detalhe: `${decisao.usuarioLogin} ${acao} ${labelCampo(decisao.campo)} de ${produtoLabel(prod?.codigo ?? null, prod?.descricao ?? null)} · ${pedido}. Motivo: ${decisao.justificativaLabel || '—'}.${ciclo}`,
        ator: decisao.usuarioLogin,
        fonte: 'Registro local · decisão da conferência',
      })
    );
    for (const obs of decisao.observacoes) {
      dated.push(
        evento({
          id: `obs-${decisao.idItemDocumentoEstoque}-${decisao.idItemPedidoCompra}-${decisao.campo}-${obs.criadoEm}`,
          em: obs.criadoEm,
          precisao: 'instante',
          tom: 'info',
          titulo: 'Observação',
          detalhe: `${labelCampo(decisao.campo)} · ${produtoLabel(prod?.codigo ?? null, prod?.descricao ?? null)}\n${obs.texto}`,
          ator: obs.usuarioLogin,
          fonte: 'Registro local · observação',
        })
      );
    }
  }

  if (entrada.conferencia) {
    const conf = entrada.conferencia;
    const reais = conf.totalDivergenciasReaisHistorica;
    const benignas = conf.totalDivergenciasBenignasHist;
    dated.push(
      evento({
        id: 'conferido',
        em: conf.conferidoEm,
        precisao: 'instante',
        tom: 'ok',
        titulo: 'Documento conferido',
        detalhe: `Na hora da conferência havia ${reais} ${reais === 1 ? 'divergência real' : 'divergências reais'} e ${benignas} ${benignas === 1 ? 'benigna' : 'benignas'}.`,
        ator: conf.usuarioLogin,
        fonte: 'Registro local · conferência',
      })
    );
    if (conf.reabertoEm) {
      dated.push(
        evento({
          id: 'reaberto',
          em: conf.reabertoEm,
          precisao: 'instante',
          tom: 'info',
          titulo: 'Conferência reaberta',
          detalhe: 'As decisões anteriores deixaram de valer. Cada divergência atual precisa ser aceita ou recusada de novo.',
          ator: conf.reabertoPorLogin,
          fonte: 'Registro local · reabertura',
        })
      );
    }
  }

  if (entrada.recebimento) {
    const rec = entrada.recebimento;
    dated.push(
      evento({
        id: 'recebimento-criado',
        em: rec.createdAt,
        precisao: 'instante',
        tom: 'info',
        titulo: 'Entrou na conferência às cegas',
        detalhe: `Situação gravada na abertura: ${labelStatusRecebimento(rec.status)}.`,
        ator: null,
        fonte: 'Recebimento · conferência às cegas',
      })
    );
    if (rec.atribuidoEm) {
      dated.push(
        evento({
          id: 'recebimento-atribuido',
          em: rec.atribuidoEm,
          precisao: 'instante',
          tom: 'info',
          titulo: 'Conferente definido',
          detalhe: rec.conferenteNome || rec.conferenteLogin || 'Conferente atribuído.',
          ator: rec.conferenteLogin,
          fonte: 'Recebimento · atribuição',
        })
      );
    }
    if (rec.iniciadoEm) {
      dated.push(
        evento({
          id: 'recebimento-inicio',
          em: rec.iniciadoEm,
          precisao: 'instante',
          tom: 'info',
          titulo: 'Conferência às cegas iniciada',
          detalhe: 'O conferente começou a contar os itens.',
          ator: rec.conferenteLogin,
          fonte: 'Recebimento · início',
        })
      );
    }
    if (rec.finalizadoEm) {
      dated.push(
        evento({
          id: 'recebimento-fim',
          em: rec.finalizadoEm,
          precisao: 'instante',
          tom: 'ok',
          titulo: 'Conferência às cegas finalizada',
          detalhe: `Situação atual do recebimento: ${labelStatusRecebimento(rec.status)}.`,
          ator: rec.conferenteNome || rec.conferenteLogin,
          fonte: 'Recebimento · finalização',
        })
      );
    }
    for (const [i, ciclo] of rec.ciclos.entries()) {
      dated.push(
        evento({
          id: `recebimento-ciclo-${i}`,
          em: ciclo.arquivadoEm,
          precisao: 'instante',
          tom: 'info',
          titulo: 'Ciclo da conferência às cegas arquivado',
          detalhe: `Voltou para a mesa como ${labelStatusRecebimento(ciclo.statusRetorno)}.`,
          ator: ciclo.conferenteNome,
          fonte: 'Recebimento · ciclo arquivado',
        })
      );
    }
    if (rec.mesaAcaoEm && rec.mesaUltimaAcao) {
      const justificativa = rec.mesaAceiteJustificativa?.trim();
      dated.push(
        evento({
          id: 'recebimento-mesa',
          em: rec.mesaAcaoEm,
          precisao: 'instante',
          tom: 'info',
          titulo: MESA_ACAO[rec.mesaUltimaAcao] ?? `Ação da mesa: ${rec.mesaUltimaAcao}`,
          detalhe: justificativa || 'Ação registrada pela mesa.',
          ator: rec.mesaAcaoPorLogin,
          fonte: 'Recebimento · mesa',
        })
      );
    }
    if (rec.devolucaoVinculadaEm) {
      dated.push(
        evento({
          id: 'recebimento-devolucao',
          em: rec.devolucaoVinculadaEm,
          precisao: 'instante',
          tom: 'info',
          titulo: 'Devolução vinculada',
          detalhe: [rec.numeroDocumentoDevolucao, rec.numeroNfeDevolucao ? `NF-e ${rec.numeroNfeDevolucao}` : null]
            .filter(Boolean)
            .join(' · ') || 'Documento de devolução vinculado.',
          ator: null,
          fonte: 'Recebimento · devolução',
        })
      );
    }
  }

  dated.sort((a, b) => (a.em ?? '').localeCompare(b.em ?? '') || a.id.localeCompare(b.id));
  const eventos = [...dated];
  const idxCriado = eventos.findIndex((item) => item.id === 'criado');
  if (logoAposCriacao.length > 0) {
    eventos.splice(idxCriado >= 0 ? idxCriado + 1 : 0, 0, ...logoAposCriacao);
  }
  eventos.push(...depoisLeitura);
  return eventos;
}

function toInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

const SQL_DOCUMENTO = `
SELECT
  de.id AS idDocumento,
  de.numeroDocumentoFiscal AS numeroDocumentoFiscal,
  nfe.numero AS numeroNfe,
  DATE(de.dataEmissao) AS dataEmissao,
  DATE(de.dataEntrada) AS dataEntrada,
  de.dataCriacao AS dataCriacao,
  pe.nome AS nomeParceiro,
  u.nome AS nomeUsuarioCriacao,
  tm.id AS idTipoMovimentacao,
  tm.nome AS tipoMovimentacao
FROM documentoestoque de
LEFT JOIN tipomovimentacao tm ON tm.id = de.idTipoMovimentacao
LEFT JOIN pessoa pe ON pe.id = de.idParceiro
LEFT JOIN usuario u ON u.id = de.idUsuario
LEFT JOIN nfe ON nfe.idDocumentoEstoque = de.id
WHERE de.id = ?
LIMIT 1
`.trim();

const SQL_ITENS = `
SELECT
  ide.id AS idItemDocumentoEstoque,
  p.nome AS codigoProduto,
  p.descricao AS descricaoProduto,
  ideipc.idItemPedidoCompra AS idItemPedidoCompra,
  pc.id AS idPedidoCompra,
  pc.nome AS nomePedidoCompra,
  ide.qtde AS qtdeNF,
  ipc.qtde AS qtdePC,
  ide.valorUnitario AS valorUnitarioNF,
  ipc.precoUnitario AS valorUnitarioPC
FROM itemdocumentoestoque ide
LEFT JOIN produto p ON p.id = ide.idProduto
LEFT JOIN itemdocumentoestoque_itempedidocompra ideipc ON ideipc.idItemDocumentoEstoque = ide.id
LEFT JOIN itempedidocompra ipc ON ipc.id = ideipc.idItemPedidoCompra
LEFT JOIN pedidocompra pc ON pc.id = ipc.idPedidoCompra
WHERE ide.idDocumentoEstoque = ?
  AND ide.discriminador = 'ItemDocumentoEntrada'
ORDER BY ide.id ASC, ideipc.idItemPedidoCompra ASC
`.trim();

function alertaUtil(resumo: string | null): boolean {
  const texto = (resumo ?? '').trim();
  if (!texto) return false;
  if (texto === 'sem-outlier') return false;
  if (texto.startsWith('baseline-')) return false;
  return true;
}

export async function carregarHistoricoDoubleCheck(
  idDocumento: number
): Promise<{ data: HistoricoDoubleCheck | null; erro?: string }> {
  if (!isNomusEnabled()) return { data: null, erro: 'NOMUS_DB_URL não configurado' };
  const pool = getNomusPool();
  if (!pool) return { data: null, erro: 'NOMUS_DB_URL não configurado' };

  try {
    const [docRows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, SQL_DOCUMENTO, [idDocumento]);
    const docRow = Array.isArray(docRows) ? docRows[0] : undefined;
    if (!docRow) return { data: null };

    const [itemRows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, SQL_ITENS, [idDocumento]);
    const itensBrutos = (Array.isArray(itemRows) ? itemRows : []).map((row) => ({
      idItemDocumentoEstoque: toInt(row.idItemDocumentoEstoque),
      codigoProduto: strOrNull(row.codigoProduto),
      descricaoProduto: strOrNull(row.descricaoProduto),
      idItemPedidoCompra: row.idItemPedidoCompra == null ? null : toInt(row.idItemPedidoCompra) || null,
      idPedidoCompra: row.idPedidoCompra == null ? null : toInt(row.idPedidoCompra) || null,
      nomePedidoCompra: strOrNull(row.nomePedidoCompra),
      qtdeNF: toNum(row.qtdeNF),
      qtdePC: row.qtdePC == null ? null : toNum(row.qtdePC),
      valorUnitarioNF: toNum(row.valorUnitarioNF),
      valorUnitarioPC: row.valorUnitarioPC == null ? null : toNum(row.valorUnitarioPC),
    }));

    const [snapshotsRaw, decisoesRaw, conferenciaRaw, alertaRaw, recebimentoRaw, comparativo] = await Promise.all([
      prisma.doubleCheckInDivergenciaApontada.findMany({
        where: { idDocumentoEstoque: idDocumento },
        orderBy: { apontadoEm: 'asc' },
      }),
      listarDecisoesComparativo(idDocumento),
      prisma.doubleCheckInConferido.findUnique({ where: { idDocumentoEstoque: idDocumento } }),
      prisma.doubleCheckInAlertaEnviado.findUnique({ where: { idDocumentoEstoque: idDocumento } }),
      prisma.recebimentoConferencia.findUnique({
        where: { idDocumentoEstoque: idDocumento },
        include: { ciclos: { orderBy: { arquivadoEm: 'asc' } } },
      }),
      queryDoubleCheckInComparativoPc({ idDocumento }),
    ]);

    const idsItemPedido = [
      ...itensBrutos.map((item) => item.idItemPedidoCompra ?? 0),
      ...snapshotsRaw.map((snap) => snap.idItemPedidoCompra),
    ];
    const compradores = await buscarCompradorPorItemPedido(idsItemPedido);

    const documento: DocumentoHistoricoCabecalho = {
      idDocumento,
      numeroDocumentoFiscal: strOrNull(docRow.numeroDocumentoFiscal),
      numeroNfe: strOrNull(docRow.numeroNfe),
      dataEmissao: formatSqlDateYmd(docRow.dataEmissao),
      dataEntrada: formatSqlDateYmd(docRow.dataEntrada),
      nomeParceiro: strOrNull(docRow.nomeParceiro),
      idTipoMovimentacao: toInt(docRow.idTipoMovimentacao),
      tipoMovimentacao: strOrNull(docRow.tipoMovimentacao),
      dataCriacao: isoDeData(docRow.dataCriacao),
      nomeUsuarioCriacao: strOrNull(docRow.nomeUsuarioCriacao),
    };
    const itens: ItemHistoricoVinculo[] = itensBrutos.map((item) => ({
      ...item,
      nomeComprador:
        item.idItemPedidoCompra != null
          ? (compradores.get(item.idItemPedidoCompra)?.nomeComprador ?? null)
          : null,
    }));
    const snapshots: SnapshotHistorico[] = snapshotsRaw.map((snap) => ({
      idItemDocumentoEstoque: snap.idItemDocumentoEstoque,
      idItemPedidoCompra: snap.idItemPedidoCompra,
      idPedidoCompra: snap.idPedidoCompra,
      nomePedidoCompra: snap.nomePedidoCompra,
      nomeComprador: snap.nomeComprador,
      campo: snap.campo,
      natureza: snap.natureza,
      apontadoEm: snap.apontadoEm.toISOString(),
    }));
    const linhasAtuais: LinhaAtualHistorico[] = (comparativo.linhas ?? []).map((linha) => ({
      idItemDocumentoEstoque: linha.idItemDocumentoEstoque,
      idItemPedidoCompra: linha.idItemPedidoCompra,
      nomePedidoCompra: linha.nomePedidoCompra,
      codigoProduto: linha.codigoProduto,
      descricaoProduto: linha.descricaoProduto,
      qtdeNF: linha.qtdeNF,
      qtdePC: linha.qtdePC,
      valorUnitarioNF: linha.valorUnitarioNF,
      valorUnitarioPC: linha.valorUnitarioPC,
      valorIpiNF: linha.valorIpiNF,
      valorIpiPC: linha.valorIpiPC,
      condicaoPagamentoNF: linha.condicaoPagamentoNF,
      condicaoPagamentoPC: linha.condicaoPagamentoPC,
      divergValorUnitario: linha.divergValorUnitario,
      divergQtde: linha.divergQtde,
      divergIpi: linha.divergIpi,
      divergCondicaoPagamento: linha.divergCondicaoPagamento,
    }));
    const decisoes: DecisaoHistorico[] = decisoesRaw.map((decisao) => ({
      idItemDocumentoEstoque: decisao.idItemDocumentoEstoque,
      idItemPedidoCompra: decisao.idItemPedidoCompra,
      campo: decisao.campo,
      decisao: decisao.decisao,
      justificativaLabel: decisao.justificativaLabel,
      usuarioLogin: decisao.usuarioLogin,
      atualizadoEm: decisao.atualizadoEm,
      vigente: decisao.vigente,
      observacoes: decisao.historicoObservacoes.map((obs) => ({
        texto: obs.texto,
        usuarioLogin: obs.usuarioLogin,
        criadoEm: obs.criadoEm,
      })),
    }));
    const conferencia: ConferenciaHistorico | null = conferenciaRaw
      ? {
          conferidoEm: conferenciaRaw.conferidoEm.toISOString(),
          usuarioLogin: conferenciaRaw.usuarioLogin,
          reabertoEm: conferenciaRaw.reabertoEm?.toISOString() ?? null,
          reabertoPorLogin: conferenciaRaw.reabertoPorLogin,
          totalDivergenciasReaisHistorica: conferenciaRaw.totalDivergenciasReaisHistorica,
          totalDivergenciasBenignasHist: conferenciaRaw.totalDivergenciasBenignasHist,
        }
      : null;
    const recebimento: RecebimentoHistorico | null = recebimentoRaw
      ? {
          status: recebimentoRaw.status,
          createdAt: recebimentoRaw.createdAt.toISOString(),
          atribuidoEm: recebimentoRaw.atribuidoEm?.toISOString() ?? null,
          conferenteNome: recebimentoRaw.conferenteNome,
          conferenteLogin: recebimentoRaw.conferenteLogin,
          iniciadoEm: recebimentoRaw.iniciadoEm?.toISOString() ?? null,
          finalizadoEm: recebimentoRaw.finalizadoEm?.toISOString() ?? null,
          mesaUltimaAcao: recebimentoRaw.mesaUltimaAcao,
          mesaAcaoEm: recebimentoRaw.mesaAcaoEm?.toISOString() ?? null,
          mesaAcaoPorLogin: recebimentoRaw.mesaAcaoPorLogin,
          mesaAceiteJustificativa: recebimentoRaw.mesaAceiteJustificativa,
          numeroDocumentoDevolucao: recebimentoRaw.numeroDocumentoDevolucao,
          numeroNfeDevolucao: recebimentoRaw.numeroNfeDevolucao,
          devolucaoVinculadaEm: recebimentoRaw.devolucaoVinculadaEm?.toISOString() ?? null,
          ciclos: recebimentoRaw.ciclos.map((ciclo) => ({
            statusRetorno: ciclo.statusRetorno,
            conferenteNome: ciclo.conferenteNome,
            arquivadoEm: ciclo.arquivadoEm.toISOString(),
          })),
        }
      : null;
    const alerta: AlertaHistorico | null =
      alertaRaw && alertaUtil(alertaRaw.resumo)
        ? { enviadoEm: alertaRaw.enviadoEm.toISOString(), resumo: alertaRaw.resumo }
        : null;

    const aviso = comparativo.erro
      ? `${AVISO_HISTORICO_DOUBLE_CHECK} A leitura atual do comparativo falhou: ${comparativo.erro}`
      : AVISO_HISTORICO_DOUBLE_CHECK;

    return {
      data: {
        documento,
        aviso,
        eventos: montarEventosHistorico({
          documento,
          itens,
          snapshots,
          linhasAtuais,
          decisoes,
          conferencia,
          recebimento,
          alerta,
        }),
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[doubleCheckInHistorico]', msg);
    return { data: null, erro: msg };
  }
}
