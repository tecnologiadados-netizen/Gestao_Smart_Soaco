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
  'A linha mostra quando o documento foi criado, se houve desvínculo de pedido e o que aconteceu daí até a situação atual. O Nomus não guarda a hora de cada vínculo.';

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
    [...new Set(itens.map((item) => textoPedido(item.nomePedidoCompra, item.idPedidoCompra, item.nomeComprador)))].join(
      '\n'
    );

  const linhasVinculo: string[] = [];
  let tomVinculo: TomHistorico = 'neutro';
  let abreVinculo = false;
  let origemVinculo: 'leitura' | 'atual' | undefined;

  if (desfeitos.size > 0) {
    tomVinculo = 'atencao';
    abreVinculo = true;
    origemVinculo = 'leitura';
    for (const snaps of desfeitos.values()) {
      const base = snaps[0]!;
      linhasVinculo.push(
        `Houve desvínculo de ${pedidoLabel(base.nomePedidoCompra, base.idPedidoCompra)} · ${base.nomeComprador?.trim() || 'Sem comprador'}. A hora não ficou registrada.`
      );
    }
  } else if (itensLigados.length > 0) {
    linhasVinculo.push(`Não houve desvínculo. Pedido atual: ${resumoItens(itensLigados)}.`);
    abreVinculo = entrada.linhasAtuais.length > 0 || entrada.snapshots.length > 0;
    origemVinculo = entrada.snapshots.length > 0 ? 'leitura' : 'atual';
  } else {
    linhasVinculo.push('Não houve desvínculo. Nenhum item está ligado a um pedido.');
  }

  if (posteriores.length > 0) {
    tomVinculo = 'info';
    abreVinculo = true;
    origemVinculo = origemVinculo ?? 'atual';
    linhasVinculo.push(
      `Depois foi ligado a ${resumoItens(posteriores)}. A hora desse vínculo não ficou registrada.`
    );
  }

  if (entrada.snapshots.length > 0) {
    const primeira = [...entrada.snapshots].sort((a, b) => a.apontadoEm.localeCompare(b.apontadoEm))[0]!;
    const qtde = entrada.snapshots.length;
    linhasVinculo.push(
      `Primeira leitura em ${fmtDataHora(primeira.apontadoEm)}: ${qtde} ${qtde === 1 ? 'divergência' : 'divergências'}.`
    );
  }

  const vinculo = evento({
    id: desfeitos.size > 0 ? 'desvinculo' : 'sem-desvinculo',
    em: null,
    precisao: 'sem_data',
    tom: tomVinculo,
    titulo: desfeitos.size > 0 ? 'Desvínculo do pedido' : 'Sem desvínculo',
    detalhe: linhasVinculo.join('\n'),
    ator: null,
    fonte: 'Vínculo do Nomus comparado com a primeira leitura',
    abreComparativo: abreVinculo,
    origemComparativo: origemVinculo,
  });

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
    const acao = decisao.decisao === 'recusa' ? 'recusou' : 'aceitou';
    const ciclo = decisao.vigente ? '' : ' Decisão de antes da reabertura, já não vale.';
    const otimiza =
      decisao.decisao !== 'recusa' && decisao.numeroSolicitacaoOtimiza
        ? ` Solicitação Otimiza nº ${decisao.numeroSolicitacaoOtimiza}.`
        : '';
    passos.push({
      em: decisao.atualizadoEm,
      texto: `${decisao.usuarioLogin} ${acao} ${labelCampo(decisao.campo)} de ${produtoLabel(prod?.codigo ?? null, prod?.descricao ?? null)} · ${pedido}. Motivo: ${decisao.justificativaLabel || '—'}.${otimiza}${ciclo}`,
    });
  }

  if (entrada.conferencia) {
    const conf = entrada.conferencia;
    passos.push({
      em: conf.conferidoEm,
      texto: `${conf.usuarioLogin} conferiu o documento no Double Check.`,
    });
    if (conf.reabertoEm) {
      passos.push({
        em: conf.reabertoEm,
        texto: `${conf.reabertoPorLogin || 'Alguém'} reabriu a conferência.`,
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
        id: 'ate-agora',
        em: ultimo.em,
        precisao: 'instante',
        tom: 'info',
        titulo: 'Até o momento',
        detalhe: passos.map((passo) => `${fmtDataHora(passo.em)} · ${passo.texto}`).join('\n'),
        ator: null,
        fonte: 'Registros do documento',
      })
    : null;

  return [criado, vinculo, andamento].filter((item): item is EventoHistoricoDoubleCheck => item != null);

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
