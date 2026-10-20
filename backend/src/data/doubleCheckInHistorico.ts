/**
 * Linha do tempo auditável de um documento do Double Check.
 * Só entra o que já está gravado. O desvínculo antigo não tem hora.
 */
import { prisma } from '../config/prisma.js';
import { getNomusPool, isNomusEnabled, nomusQueryWithRetry } from '../config/nomusDb.js';
import { formatSqlDateYmd } from './dfcDateUtils.js';
import { buscarCompradorPorItemPedido, carregarPrimeirasLeituras } from './doubleCheckInDivergenciaApontada.js';
import { listarDecisoesComparativo } from './doubleCheckInLocalRepository.js';
import { queryDoubleCheckInComparativoPc } from './doubleCheckInRepository.js';
import { textoComparativoCampo, type LinhaComparativoDia } from './gestaoEntradasClassificacao.js';
import type { CampoRelato, RelatoConferencia } from '../services/doubleCheckInConferenciaRelato.js';
import {
  RECEBIMENTO_STATUS_LABEL,
  type RecebimentoStatus,
} from './recebimentoNomusRepository.js';

export const AVISO_HISTORICO_DOUBLE_CHECK =
  'O histórico apresenta, em ordem: a criação do documento, as divergências identificadas entre a nota e o pedido de compra, eventual desvinculação e novo vínculo, as tratativas registradas e a situação atual. O Nomus não registra o horário de vínculos e desvinculações.';

/** A primeira leitura passou a ser gravada nesta data; antes dela só há o relato da conferência. */
const INICIO_REGISTRO_PRIMEIRA_LEITURA = '09/10/2026';

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
  numeroSolicitacaoOtimiza?: number | null;
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

/** Linha do comparativo NF × PC, no mesmo formato do Double Check. */
export type LinhaAtualHistorico = LinhaComparativoDia;

export type EntradaHistoricoDoubleCheck = {
  documento: DocumentoHistoricoCabecalho;
  itens: ItemHistoricoVinculo[];
  snapshots: SnapshotHistorico[];
  /** Comparativo gravado na primeira leitura, um por vínculo. Leituras antigas não têm. */
  retratosPrimeiraLeitura?: LinhaComparativoDia[];
  linhasAtuais: LinhaAtualHistorico[];
  decisoes: DecisaoHistorico[];
  conferencia: ConferenciaHistorico | null;
  /** Valores apresentados na conferência (página do link). */
  relato?: RelatoConferencia | null;
  recebimento: RecebimentoHistorico | null;
  alerta: AlertaHistorico | null;
  /** Momento da leitura atual do Nomus. */
  lidoEm?: string;
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
  CANCELAR_CONFERENCIA: 'Conferência às cegas cancelada pela entrada',
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

function evento(
  partial: Omit<EventoHistoricoDoubleCheck, 'abreComparativo'> & { abreComparativo?: boolean }
): EventoHistoricoDoubleCheck {
  return { abreComparativo: false, ...partial };
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
  const detalheCriacao = doc.tipoMovimentacao ? `Tipo de movimentação: ${doc.tipoMovimentacao}.` : '';
  const criado: EventoHistoricoDoubleCheck | null = doc.dataCriacao
    ? evento({
        id: 'criado',
        em: doc.dataCriacao,
        precisao: 'instante',
        tom: 'neutro',
        titulo: 'Documento criado',
        detalhe: detalheCriacao || 'Criação do documento no Nomus.',
        ator: doc.nomeUsuarioCriacao,
        fonte: 'Nomus · criação do documento',
      })
    : doc.dataEntrada
      ? evento({
          id: 'criado',
          em: doc.dataEntrada,
          precisao: 'dia',
          tom: 'neutro',
          titulo: 'Documento criado',
          detalhe: detalheCriacao || 'O Nomus não guardou a hora da criação. Vale a data de entrada.',
          ator: doc.nomeUsuarioCriacao,
          fonte: 'Nomus · data de entrada',
        })
      : null;

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

  const desfeitos = new Map<string, SnapshotHistorico[]>();
  for (const snap of entrada.snapshots) {
    const vinculo = chaveVinculo(snap.idItemDocumentoEstoque, snap.idItemPedidoCompra);
    if (!vinculosAtuais.has(vinculo)) {
      const lista = desfeitos.get(vinculo) ?? [];
      lista.push(snap);
      desfeitos.set(vinculo, lista);
    }
  }

  const chavesPrimeiroVinculo = new Set(
    entrada.snapshots.map((snap) => chaveVinculo(snap.idItemDocumentoEstoque, snap.idItemPedidoCompra))
  );
  const itensLigados = entrada.itens.filter((item) => (item.idItemPedidoCompra ?? 0) > 0);
  // A primeira leitura só grava o vínculo que divergiu: novo vínculo só se afirma para o item desvinculado.
  const itensDesvinculados = new Set([...desfeitos.values()].map((snaps) => snaps[0]!.idItemDocumentoEstoque));
  const posteriores = itensLigados.filter(
    (item) =>
      itensDesvinculados.has(item.idItemDocumentoEstoque) &&
      !chavesPrimeiroVinculo.has(chaveVinculo(item.idItemDocumentoEstoque, item.idItemPedidoCompra ?? 0))
  );
  const textoPedido = (nome: string | null, id: number | null, comprador: string | null): string =>
    `${pedidoLabel(nome, id)} · ${comprador?.trim() || 'Sem comprador'}`;
  const resumoItens = (itens: ItemHistoricoVinculo[]): string =>
    [...new Set(itens.map((item) => textoPedido(item.nomePedidoCompra, item.idPedidoCompra, item.nomeComprador)))].join(
      '\n'
    );

  const temPrimeiraLeitura = entrada.snapshots.length > 0;
  const nomeProduto = (idItem: number | null, codigo?: string | null, descricao?: string | null): string => {
    const prod = idItem != null ? produtoPorItem.get(idItem) : undefined;
    return produtoLabel(prod?.codigo ?? codigo ?? null, prod?.descricao ?? descricao ?? null);
  };

  const iniciais = divergenciasIniciais(entrada, nomeProduto);
  const eventoIniciais = montarEventoIniciais(entrada, iniciais, itensLigados.length > 0);

  const pedidoComComprador = (snap: SnapshotHistorico) =>
    `${pedidoLabel(snap.nomePedidoCompra, snap.idPedidoCompra)} (comprador: ${snap.nomeComprador?.trim() || 'não informado'})`;
  const criadoAntesDoRegistro = Boolean(doc.dataCriacao && doc.dataCriacao.slice(0, 10) < '2026-10-09');

  let vinculo: EventoHistoricoDoubleCheck;
  if (temPrimeiraLeitura && desfeitos.size > 0) {
    const linhas = [...desfeitos.values()].map((snaps) => {
      const base = snaps[0]!;
      return `• O vínculo de ${nomeProduto(base.idItemDocumentoEstoque)} com o pedido ${pedidoComComprador(base)} foi desfeito após a primeira leitura.`;
    });
    vinculo = evento({
      id: 'desvinculo',
      em: null,
      precisao: 'sem_data',
      tom: 'atencao',
      titulo: 'Desvinculação do pedido',
      detalhe: `${linhas.join('\n')}\nO Nomus não registra o horário da desvinculação.`,
      ator: null,
      fonte: 'Vínculo atual do Nomus comparado com a primeira leitura',
      abreComparativo: true,
      origemComparativo: 'leitura',
    });
  } else if (temPrimeiraLeitura) {
    vinculo = evento({
      id: 'sem-desvinculo',
      em: null,
      precisao: 'sem_data',
      tom: 'neutro',
      titulo: 'Vínculo mantido',
      detalhe: `Não houve desvinculação. O vínculo identificado na primeira leitura permanece: ${resumoItens(itensLigados)}.`,
      ator: null,
      fonte: 'Vínculo atual do Nomus comparado com a primeira leitura',
      abreComparativo: true,
      origemComparativo: 'leitura',
    });
  } else if (itensLigados.length > 0) {
    vinculo = evento({
      id: 'vinculo-sem-leitura',
      em: null,
      precisao: 'sem_data',
      tom: 'neutro',
      titulo: 'Vínculo com o pedido',
      detalhe: `Vínculo atual: ${resumoItens(itensLigados)}.\nNão há registro da primeira leitura deste documento${criadoAntesDoRegistro ? ` (o registro teve início em ${INICIO_REGISTRO_PRIMEIRA_LEITURA})` : ''}. Por isso, não é possível afirmar se houve desvinculação.`,
      ator: null,
      fonte: 'Vínculo atual do Nomus',
      abreComparativo: entrada.linhasAtuais.length > 0,
      origemComparativo: 'atual',
    });
  } else {
    vinculo = evento({
      id: 'sem-vinculo',
      em: null,
      precisao: 'sem_data',
      tom: 'neutro',
      titulo: 'Sem vínculo com pedido',
      detalhe: 'Nenhum item do documento está vinculado a pedido de compra.',
      ator: null,
      fonte: 'Vínculo atual do Nomus',
    });
  }

  let novoVinculo: EventoHistoricoDoubleCheck | null = null;
  if (temPrimeiraLeitura && desfeitos.size > 0) {
    const linhas = [...itensDesvinculados].map((idItem) => {
      const novos = posteriores.filter((item) => item.idItemDocumentoEstoque === idItem);
      if (novos.length === 0) return `• ${nomeProduto(idItem)} não foi vinculado novamente a pedido de compra.`;
      const pedidos = [
        ...new Set(
          novos.map(
            (item) =>
              `${pedidoLabel(item.nomePedidoCompra, item.idPedidoCompra)} (comprador: ${item.nomeComprador?.trim() || 'não informado'})`
          )
        ),
      ].join(', ');
      return `• ${nomeProduto(idItem)} foi vinculado novamente ao pedido ${pedidos}.`;
    });
    novoVinculo = evento({
      id: posteriores.length > 0 ? 'novo-vinculo' : 'sem-novo-vinculo',
      em: null,
      precisao: 'sem_data',
      tom: posteriores.length > 0 ? 'info' : 'neutro',
      titulo: posteriores.length > 0 ? 'Novo vínculo com pedido' : 'Sem novo vínculo',
      detalhe: `${linhas.join('\n')}${posteriores.length > 0 ? '\nO Nomus não registra o horário do novo vínculo.' : ''}`,
      ator: null,
      fonte: 'Vínculo atual do Nomus comparado com a primeira leitura',
      abreComparativo: posteriores.length > 0 && entrada.linhasAtuais.length > 0,
      origemComparativo: 'atual',
    });
  }

  const passos: Array<{ em: string; texto: string }> = [];
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
    const acao = decisao.decisao === 'recusa' ? 'recusada' : 'aceita';
    const ciclo = decisao.vigente ? '' : ' Decisão anterior à reabertura; não está mais vigente.';
    const otimiza =
      decisao.decisao !== 'recusa' && decisao.numeroSolicitacaoOtimiza
        ? ` Solicitação Otimiza nº ${decisao.numeroSolicitacaoOtimiza}.`
        : '';
    passos.push({
      em: decisao.atualizadoEm,
      texto: `Divergência de ${labelCampo(decisao.campo)} em ${produtoLabel(prod?.codigo ?? null, prod?.descricao ?? null)} · ${pedido} ${acao} por ${decisao.usuarioLogin}. Justificativa: ${decisao.justificativaLabel || 'não informada'}.${otimiza}${ciclo}`,
    });
  }

  if (entrada.conferencia) {
    const conf = entrada.conferencia;
    passos.push({
      em: conf.conferidoEm,
      texto: `Documento conferido no Double Check por ${conf.usuarioLogin}.`,
    });
    if (conf.reabertoEm) {
      passos.push({
        em: conf.reabertoEm,
        texto: `Conferência reaberta por ${conf.reabertoPorLogin || 'usuário não identificado'}.`,
      });
    }
  }

  if (entrada.recebimento) {
    const rec = entrada.recebimento;
    const quem = rec.conferenteNome || rec.conferenteLogin;
    const situacao = labelStatusRecebimento(rec.status);
    if (rec.finalizadoEm) {
      passos.push({
        em: rec.finalizadoEm,
        texto: `${quem ? `${quem} concluiu a contagem física. ` : ''}Situação: ${situacao}.`,
      });
    } else if (rec.atribuidoEm && quem) {
      passos.push({
        em: rec.atribuidoEm,
        texto: `Contagem física com ${quem}. Situação: ${situacao}.`,
      });
    } else {
      passos.push({
        em: rec.createdAt,
        texto: `Contagem física aberta. Situação: ${situacao}.`,
      });
    }
    for (const ciclo of rec.ciclos) {
      passos.push({
        em: ciclo.arquivadoEm,
        texto: `Volta anterior de ${ciclo.conferenteNome || 'conferente'} voltou como ${labelStatusRecebimento(ciclo.statusRetorno)}.`,
      });
    }
    if (rec.mesaAcaoEm && rec.mesaUltimaAcao) {
      const justificativa = rec.mesaAceiteJustificativa?.trim();
      const acao = MESA_ACAO[rec.mesaUltimaAcao] ?? rec.mesaUltimaAcao;
      passos.push({
        em: rec.mesaAcaoEm,
        texto: `${rec.mesaAcaoPorLogin ? `${rec.mesaAcaoPorLogin}: ` : ''}${acao}${justificativa ? `. ${justificativa}` : ''}.`,
      });
    }
    if (rec.devolucaoVinculadaEm) {
      const docDev = [rec.numeroDocumentoDevolucao, rec.numeroNfeDevolucao ? `NF-e ${rec.numeroNfeDevolucao}` : null]
        .filter(Boolean)
        .join(' · ');
      passos.push({
        em: rec.devolucaoVinculadaEm,
        texto: docDev ? `Devolução vinculada: ${docDev}.` : 'Devolução vinculada.',
      });
    }
  }

  passos.sort((a, b) => a.em.localeCompare(b.em));
  const ultimo = passos[passos.length - 1];
  const andamento = ultimo
    ? evento({
        id: 'tratativas',
        em: ultimo.em,
        precisao: 'instante',
        tom: 'info',
        titulo: 'Tratativas registradas',
        detalhe: passos.map((passo) => `${fmtDataHora(passo.em)} · ${passo.texto}`).join('\n'),
        ator: null,
        fonte: 'Registros do documento',
      })
    : null;

  const situacao = montarEventoSituacaoAtual(entrada, iniciais, itensLigados.length > 0, nomeProduto);

  return [criado, eventoIniciais, vinculo, novoVinculo, andamento, situacao].filter(
    (item): item is EventoHistoricoDoubleCheck => item != null
  );
}

type NomeProduto = (idItem: number | null, codigo?: string | null, descricao?: string | null) => string;

/** Divergência registrada antes da leitura atual: na primeira leitura, no relato da conferência ou na decisão. */
type DivergenciaRegistrada = {
  idItemDocumentoEstoque: number | null;
  idItemPedidoCompra: number | null;
  codigoProduto: string | null;
  produto: string;
  pedido: string;
  campo: string;
  valores: string | null;
  benigna: boolean;
};

type OrigemIniciais = 'primeira_leitura' | 'relato' | 'decisao' | 'nenhuma';

const FLAG_CAMPO: Array<{ campo: string; flag: 'divergValorUnitario' | 'divergQtde' | 'divergIpi' | 'divergCondicaoPagamento' }> = [
  { campo: 'valor_unitario', flag: 'divergValorUnitario' },
  { campo: 'qtde', flag: 'divergQtde' },
  { campo: 'ipi', flag: 'divergIpi' },
  { campo: 'condicao_pagamento', flag: 'divergCondicaoPagamento' },
];

function textoValores(nf: string, pc: string, detalheNf?: string | null, detalhePc?: string | null): string {
  return `nota ${nf}${detalheNf ? ` (${detalheNf})` : ''} | pedido ${pc}${detalhePc ? ` (${detalhePc})` : ''}`;
}

function valoresDaLinha(linha: LinhaComparativoDia, campo: string): string {
  const t = textoComparativoCampo(linha, campo);
  return textoValores(t.nf, t.pc, t.detalheNf, t.detalhePc);
}

function linhaDivergencia(d: DivergenciaRegistrada): string {
  const natureza = d.benigna ? ' · divergência benigna' : '';
  return `• ${d.produto} · ${d.pedido} · ${labelCampo(d.campo)}: ${d.valores ?? 'valores não registrados nesta leitura'}${natureza}`;
}

function normalizar(valor: string | null | undefined): string {
  return (valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '').toLowerCase();
}

function divergenciasDoRelato(entrada: EntradaHistoricoDoubleCheck, nomeProduto: NomeProduto): DivergenciaRegistrada[] {
  const relato = entrada.relato;
  if (!relato) return [];
  const campos = [
    ...relato.produtos.flatMap((produto) =>
      produto.campos.map((campo) => ({ campo, codigo: produto.codigo as string | null, pedido: produto.pedido }))
    ),
    ...(relato.pagamentoComum
      ? [{ campo: relato.pagamentoComum, codigo: null, pedido: relato.produtos[0]?.pedido ?? null }]
      : []),
  ];
  return campos.map(({ campo, codigo, pedido }: { campo: CampoRelato; codigo: string | null; pedido: string | null }) => {
    const item = codigo ? entrada.itens.find((i) => normalizar(i.codigoProduto) === normalizar(codigo)) : undefined;
    return {
      idItemDocumentoEstoque: item?.idItemDocumentoEstoque ?? null,
      idItemPedidoCompra: null,
      codigoProduto: codigo,
      produto: codigo == null ? 'Condição de pagamento da nota' : nomeProduto(item?.idItemDocumentoEstoque ?? null, codigo),
      pedido: pedido?.trim() || 'pedido',
      campo: campo.campo,
      valores: textoValores(campo.nf, campo.pc),
      benigna: campo.natureza === 'benigna',
    };
  });
}

function divergenciasIniciais(
  entrada: EntradaHistoricoDoubleCheck,
  nomeProduto: NomeProduto
): { origem: OrigemIniciais; em: string | null; itens: DivergenciaRegistrada[] } {
  const doRelato = divergenciasDoRelato(entrada, nomeProduto);
  const primeiraEm = [...entrada.snapshots].sort((a, b) => a.apontadoEm.localeCompare(b.apontadoEm))[0]?.apontadoEm;
  const conferidoEm = entrada.conferencia?.conferidoEm ?? null;
  // Conferência anterior à primeira leitura gravada: o relato é o registro mais antigo.
  const relatoPrimeiro = doRelato.length > 0 && Boolean(primeiraEm && conferidoEm && conferidoEm < primeiraEm);
  if (doRelato.length > 0 && (entrada.snapshots.length === 0 || relatoPrimeiro)) {
    return { origem: 'relato', em: conferidoEm, itens: doRelato };
  }

  if (entrada.snapshots.length > 0) {
    const codigoPorItem = new Map(entrada.itens.map((i) => [i.idItemDocumentoEstoque, i.codigoProduto] as const));
    const valorNoRelato = (codigo: string | null, pedido: string, campo: string): string | null =>
      doRelato.find(
        (d) =>
          d.campo === campo &&
          normalizar(d.pedido) === normalizar(pedido) &&
          (campo === 'condicao_pagamento' || normalizar(d.codigoProduto) === normalizar(codigo))
      )?.valores ?? null;
    const retratos = new Map(
      (entrada.retratosPrimeiraLeitura ?? []).map(
        (linha) => [chaveVinculo(linha.idItemDocumentoEstoque, linha.idItemPedidoCompra), linha] as const
      )
    );
    const vistos = new Set<string>();
    const itens: DivergenciaRegistrada[] = [];
    const ordenados = [...entrada.snapshots].sort((a, b) => a.apontadoEm.localeCompare(b.apontadoEm));
    for (const snap of ordenados) {
      const chave = `${chaveVinculo(snap.idItemDocumentoEstoque, snap.idItemPedidoCompra)}:${snap.campo}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      const retrato = retratos.get(chaveVinculo(snap.idItemDocumentoEstoque, snap.idItemPedidoCompra));
      const codigo = retrato?.codigoProduto ?? codigoPorItem.get(snap.idItemDocumentoEstoque) ?? null;
      const pedido = pedidoLabel(snap.nomePedidoCompra, snap.idPedidoCompra);
      itens.push({
        idItemDocumentoEstoque: snap.idItemDocumentoEstoque,
        idItemPedidoCompra: snap.idItemPedidoCompra,
        codigoProduto: codigo,
        produto: nomeProduto(snap.idItemDocumentoEstoque, retrato?.codigoProduto, retrato?.descricaoProduto),
        pedido,
        campo: snap.campo,
        valores: retrato ? valoresDaLinha(retrato, snap.campo) : valorNoRelato(codigo, pedido, snap.campo),
        benigna: snap.natureza === 'benigna',
      });
    }
    return { origem: 'primeira_leitura', em: ordenados[0]!.apontadoEm, itens };
  }

  if (entrada.decisoes.length > 0) {
    const vistos = new Set<string>();
    const itens: DivergenciaRegistrada[] = [];
    for (const d of entrada.decisoes) {
      const chave = `${chaveVinculo(d.idItemDocumentoEstoque, d.idItemPedidoCompra)}:${d.campo}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      const linha = entrada.linhasAtuais.find(
        (l) => l.idItemDocumentoEstoque === d.idItemDocumentoEstoque && l.idItemPedidoCompra === d.idItemPedidoCompra
      );
      itens.push({
        idItemDocumentoEstoque: d.idItemDocumentoEstoque,
        idItemPedidoCompra: d.idItemPedidoCompra,
        codigoProduto: linha?.codigoProduto ?? null,
        produto: nomeProduto(d.idItemDocumentoEstoque, linha?.codigoProduto, linha?.descricaoProduto),
        pedido: pedidoLabel(linha?.nomePedidoCompra ?? null, null),
        campo: d.campo,
        valores: null,
        benigna: false,
      });
    }
    return { origem: 'decisao', em: entrada.conferencia?.conferidoEm ?? null, itens };
  }

  return { origem: 'nenhuma', em: null, itens: [] };
}

function montarEventoIniciais(
  entrada: EntradaHistoricoDoubleCheck,
  iniciais: ReturnType<typeof divergenciasIniciais>,
  temVinculo: boolean
): EventoHistoricoDoubleCheck | null {
  const lista = iniciais.itens.map(linhaDivergencia).join('\n');
  const qtde = iniciais.itens.length;
  const verbo = (participio: string) =>
    qtde === 1 ? `foi ${participio} 1 divergência` : `foram ${participio}s ${qtde} divergências`;
  if (iniciais.origem === 'primeira_leitura') {
    const conferidoEm = entrada.conferencia?.conferidoEm ?? null;
    const aposConferencia =
      conferidoEm && iniciais.em && conferidoEm < iniciais.em
        ? `\nEsta leitura foi gravada após a conferência de ${fmtDataHora(conferidoEm)}, quando o registro da primeira leitura passou a existir.`
        : '';
    return evento({
      id: 'divergencias-iniciais',
      em: iniciais.em,
      precisao: 'instante',
      tom: 'atencao',
      titulo: 'Divergências identificadas no vínculo com o pedido',
      detalhe: `Na primeira leitura do Double Check, ${verbo('identificada')} entre a nota e o pedido de compra:\n${lista}${aposConferencia}`,
      ator: null,
      fonte: 'Registro local · primeira leitura do Double Check',
      abreComparativo: true,
      origemComparativo: 'leitura',
    });
  }
  if (iniciais.origem === 'relato' || iniciais.origem === 'decisao') {
    const nota =
      iniciais.origem === 'relato'
        ? entrada.snapshots.length > 0
          ? 'A conferência ocorreu antes da primeira leitura gravada. Constam os valores apresentados no momento da conferência.'
          : 'A primeira leitura deste documento não foi registrada. Constam os valores apresentados no momento da conferência.'
        : 'A primeira leitura deste documento não foi registrada e os valores não foram preservados. Constam os campos decididos na conferência.';
    return evento({
      id: 'divergencias-iniciais',
      em: iniciais.em,
      precisao: iniciais.em ? 'instante' : 'sem_data',
      tom: 'atencao',
      titulo: 'Divergências registradas na conferência',
      detalhe: `${nota}\nNa conferência, ${verbo('registrada')} entre a nota e o pedido de compra:\n${lista}`,
      ator: entrada.conferencia?.usuarioLogin ?? null,
      fonte: iniciais.origem === 'relato' ? 'Registro local · relato da conferência' : 'Registro local · decisões da conferência',
    });
  }
  if (!temVinculo) return null;
  const divergeAgora = entrada.linhasAtuais.some((linha) => FLAG_CAMPO.some((f) => linha[f.flag]));
  return evento({
    id: 'divergencias-iniciais',
    em: null,
    precisao: 'sem_data',
    tom: divergeAgora ? 'atencao' : 'ok',
    titulo: divergeAgora ? 'Divergências identificadas no vínculo com o pedido' : 'Sem divergências registradas',
    detalhe: divergeAgora
      ? 'Não há registro de leitura anterior. As divergências constam na situação atual.'
      : 'Não há registro de divergência entre a nota e o pedido de compra.',
    ator: null,
    fonte: 'Registro local',
  });
}

function montarEventoSituacaoAtual(
  entrada: EntradaHistoricoDoubleCheck,
  iniciais: ReturnType<typeof divergenciasIniciais>,
  temVinculo: boolean,
  nomeProduto: NomeProduto
): EventoHistoricoDoubleCheck | null {
  if (!temVinculo && entrada.linhasAtuais.length === 0 && iniciais.itens.length === 0) return null;
  const partes: string[] = [];

  const atuais: string[] = [];
  for (const linha of entrada.linhasAtuais) {
    for (const { campo, flag } of FLAG_CAMPO) {
      if (!linha[flag]) continue;
      atuais.push(
        `• ${nomeProduto(linha.idItemDocumentoEstoque, linha.codigoProduto, linha.descricaoProduto)} · ${pedidoLabel(linha.nomePedidoCompra ?? null, null)} · ${labelCampo(campo)}: ${valoresDaLinha(linha, campo)}`
      );
    }
  }
  if (entrada.linhasAtuais.length === 0) {
    partes.push('Na leitura atual, nenhum item do documento está vinculado a pedido de compra.');
  } else if (atuais.length > 0) {
    partes.push(
      `A nota diverge do pedido de compra em ${atuais.length} ${atuais.length === 1 ? 'campo' : 'campos'}:`,
      ...atuais
    );
  } else {
    partes.push('A nota está conforme o pedido de compra em todos os campos comparados.');
  }

  const linhaAtualDe = (d: DivergenciaRegistrada): LinhaComparativoDia | undefined => {
    if (d.idItemDocumentoEstoque != null && d.idItemPedidoCompra != null) {
      return entrada.linhasAtuais.find(
        (l) => l.idItemDocumentoEstoque === d.idItemDocumentoEstoque && l.idItemPedidoCompra === d.idItemPedidoCompra
      );
    }
    return entrada.linhasAtuais.find(
      (l) =>
        normalizar(l.nomePedidoCompra) === normalizar(d.pedido) &&
        (d.codigoProduto == null || normalizar(l.codigoProduto) === normalizar(d.codigoProduto))
    );
  };
  const regularizadas: string[] = [];
  for (const d of iniciais.itens) {
    if (d.benigna) continue;
    const linha = linhaAtualDe(d);
    const flag = FLAG_CAMPO.find((f) => f.campo === d.campo)?.flag;
    if (!linha || !flag || linha[flag]) continue;
    regularizadas.push(
      `• ${d.produto} · ${d.pedido} · ${labelCampo(d.campo)}: registrado ${d.valores ?? 'sem valores preservados'}; atual ${valoresDaLinha(linha, d.campo)}`
    );
  }
  if (regularizadas.length > 0) {
    partes.push('Divergências regularizadas no Nomus desde o registro inicial:', ...regularizadas);
  }

  const conf = entrada.conferencia;
  if (conf?.reabertoEm) {
    partes.push(`Conferência reaberta em ${fmtDataHora(conf.reabertoEm)}; o documento aguarda nova conferência.`);
  } else if (conf) {
    partes.push(`Conferência realizada por ${conf.usuarioLogin} em ${fmtDataHora(conf.conferidoEm)}.`);
  } else {
    partes.push('O documento ainda não foi conferido no Double Check.');
  }

  return evento({
    id: 'situacao-atual',
    em: entrada.lidoEm ?? null,
    precisao: entrada.lidoEm ? 'instante' : 'sem_data',
    tom: atuais.length > 0 ? 'atencao' : 'ok',
    titulo: 'Situação atual',
    detalhe: partes.join('\n'),
    ator: null,
    fonte: 'Leitura atual do Nomus',
    abreComparativo: entrada.linhasAtuais.length > 0,
    origemComparativo: 'atual',
  });
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

function lerRelatoConferencia(payloadJson: string | null): RelatoConferencia | null {
  if (!payloadJson) return null;
  try {
    const valor = JSON.parse(payloadJson) as RelatoConferencia;
    return valor && Array.isArray(valor.produtos) ? valor : null;
  } catch {
    return null;
  }
}

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

    const [
      snapshotsRaw,
      decisoesRaw,
      conferenciaRaw,
      alertaRaw,
      recebimentoRaw,
      comparativo,
      primeirasLeituras,
      paginaConferencia,
    ] = await Promise.all([
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
      carregarPrimeirasLeituras([idDocumento]),
      prisma.doubleCheckInConferenciaPagina.findUnique({
        where: { idDocumentoEstoque: idDocumento },
        select: { payloadJson: true },
      }),
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
    const linhasAtuais: LinhaAtualHistorico[] = comparativo.linhas ?? [];
    const relato = lerRelatoConferencia(paginaConferencia?.payloadJson ?? null);
    const decisoes: DecisaoHistorico[] = decisoesRaw.map((decisao) => ({
      idItemDocumentoEstoque: decisao.idItemDocumentoEstoque,
      idItemPedidoCompra: decisao.idItemPedidoCompra,
      campo: decisao.campo,
      decisao: decisao.decisao,
      justificativaLabel: decisao.justificativaLabel,
      numeroSolicitacaoOtimiza: decisao.numeroSolicitacaoOtimiza,
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
          retratosPrimeiraLeitura: primeirasLeituras.get(idDocumento)?.retratos ?? [],
          linhasAtuais,
          decisoes,
          conferencia,
          relato,
          recebimento,
          alerta,
          lidoEm: new Date().toISOString(),
        }),
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[doubleCheckInHistorico]', msg);
    return { data: null, erro: msg };
  }
}
