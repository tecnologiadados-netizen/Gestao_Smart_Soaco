/**
 * Double CheckIn — parâmetros locais (limiar) + ensure tipo WhatsApp + dedup alerta.
 */

import { randomBytes } from 'node:crypto';
import { prisma } from '../config/prisma.js';
import {
  buscarTipoPorCode,
  listarUsuariosParaDestinatario,
  salvarDestinatarios,
  type GrupoDestinoInput,
  type UsuarioDestinatarioRow,
} from './whatsappNotificacaoRepository.js';

export const DOUBLE_CHECKIN_WA_CODE = 'compras_double_checkin';
/** Alerta ao confirmar conferência quando há divergência NF × Pedido de compra. */
export const DOUBLE_CHECKIN_NF_PC_WA_CODE = 'compras_double_checkin_nf_pc';
export const DOUBLE_CHECKIN_LIMIAR_KEY = 'double_checkin_limiar_pct';
export const DOUBLE_CHECKIN_LIMIAR_DEFAULT = 10;
/** A partir desta data (emissão NF) o sync pode enviar WhatsApp. Histórico anterior só é marcado. */
export const DOUBLE_CHECKIN_ALERTA_DESDE_KEY = 'double_checkin_alerta_desde';

export const DOUBLE_CHECKIN_CAMPOS = ['valor_unitario', 'qtde', 'ipi', 'condicao_pagamento'] as const;
export type DoubleCheckInCampoComparativo = (typeof DOUBLE_CHECKIN_CAMPOS)[number];

const JUSTIFICATIVA_SEED: { codigo: string; label: string; sortOrder: number }[] = [
  { codigo: 'diferenca_comercial', label: 'Diferença comercial negociada', sortOrder: 10 },
  { codigo: 'erro_cadastro_um', label: 'Erro de cadastro / conversão de UM', sortOrder: 20 },
  { codigo: 'tributacao_ipi', label: 'Frete / IPI / tributação', sortOrder: 30 },
  { codigo: 'qtde_parcial', label: 'Quantidade parcial / saldo de PC', sortOrder: 40 },
  { codigo: 'condicao_pagamento', label: 'Condição de pagamento divergente', sortOrder: 45 },
  { codigo: 'arredondamento', label: 'Ajuste de arredondamento', sortOrder: 50 },
  { codigo: 'outros', label: 'Outros', sortOrder: 90 },
];

function ymdHojeSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export async function ensureDoubleCheckInWhatsappTipo(): Promise<{ id: number; code: string }> {
  const existing = await prisma.whatsappNotificacaoTipo.findUnique({
    where: { code: DOUBLE_CHECKIN_WA_CODE },
    select: { id: true, code: true },
  });
  if (existing) return existing;

  const created = await prisma.whatsappNotificacaoTipo.create({
    data: {
      code: DOUBLE_CHECKIN_WA_CODE,
      label: 'Double CheckIn — variação de preço',
      descricao:
        'Enviada quando uma NF de entrada com emissão a partir da data de go-live tem item com variação de preço acima do limiar. Histórico anterior não gera WhatsApp.',
      ativo: true,
      sortOrder: 45,
      fonteMensagem: 'evento',
      modoDisparo: 'evento',
    },
    select: { id: true, code: true },
  });
  return created;
}

export async function ensureDoubleCheckInNfPcWhatsappTipo(): Promise<{ id: number; code: string }> {
  const existing = await prisma.whatsappNotificacaoTipo.findUnique({
    where: { code: DOUBLE_CHECKIN_NF_PC_WA_CODE },
    select: { id: true, code: true },
  });
  if (existing) return existing;

  const created = await prisma.whatsappNotificacaoTipo.create({
    data: {
      code: DOUBLE_CHECKIN_NF_PC_WA_CODE,
      label: 'Double CheckIn — NF × Pedido de compra',
      descricao:
        'Enviada ao confirmar a conferência da NF quando há divergência entre nota fiscal e pedido de compra (valor unitário, quantidade, IPI ou condição de pagamento). Configure destinatários nesta aba SMS.',
      ativo: true,
      sortOrder: 46,
      fonteMensagem: 'evento',
      modoDisparo: 'evento',
    },
    select: { id: true, code: true },
  });
  return created;
}

export async function ensureDoubleCheckInJustificativaOpcoes(): Promise<void> {
  for (const seed of JUSTIFICATIVA_SEED) {
    await prisma.doubleCheckInJustificativaOpcao.upsert({
      where: { codigo: seed.codigo },
      create: {
        codigo: seed.codigo,
        label: seed.label,
        ativo: true,
        sortOrder: seed.sortOrder,
      },
      update: {
        label: seed.label,
        sortOrder: seed.sortOrder,
      },
    });
  }
}

export type DoubleCheckInJustificativaOpcaoRow = {
  id: number;
  codigo: string;
  label: string;
  ativo: boolean;
  sortOrder: number;
};

export async function listarJustificativaOpcoes(somenteAtivas = true): Promise<DoubleCheckInJustificativaOpcaoRow[]> {
  await ensureDoubleCheckInJustificativaOpcoes();
  const rows = await prisma.doubleCheckInJustificativaOpcao.findMany({
    where: somenteAtivas ? { ativo: true } : undefined,
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });
  return rows.map((r) => ({
    id: r.id,
    codigo: r.codigo,
    label: r.label,
    ativo: r.ativo,
    sortOrder: r.sortOrder,
  }));
}

export type DoubleCheckInComparativoDecisaoRow = {
  id: number;
  idDocumentoEstoque: number;
  idItemDocumentoEstoque: number;
  idItemPedidoCompra: number;
  campo: DoubleCheckInCampoComparativo;
  decisao: 'aceita' | 'recusa';
  justificativaOpcaoId: number;
  justificativaCodigo: string;
  justificativaLabel: string;
  observacao: string | null;
  usuarioId: number;
  usuarioLogin: string;
  atualizadoEm: string;
  historicoObservacoes: DoubleCheckInComparativoObsHistRow[];
};

export type DoubleCheckInComparativoObsHistRow = {
  id: number;
  idDocumentoEstoque: number;
  idItemDocumentoEstoque: number;
  idItemPedidoCompra: number;
  campo: DoubleCheckInCampoComparativo;
  texto: string;
  usuarioId: number;
  usuarioLogin: string;
  criadoEm: string;
};

function chaveObsHist(
  idItemDocumentoEstoque: number,
  idItemPedidoCompra: number,
  campo: string
): string {
  return `${idItemDocumentoEstoque}:${idItemPedidoCompra}:${campo}`;
}

function mapObsHist(r: {
  id: number;
  idDocumentoEstoque: number;
  idItemDocumentoEstoque: number;
  idItemPedidoCompra: number;
  campo: string;
  texto: string;
  usuarioId: number;
  usuarioLogin: string;
  criadoEm: Date;
}): DoubleCheckInComparativoObsHistRow {
  return {
    id: r.id,
    idDocumentoEstoque: r.idDocumentoEstoque,
    idItemDocumentoEstoque: r.idItemDocumentoEstoque,
    idItemPedidoCompra: r.idItemPedidoCompra,
    campo: r.campo as DoubleCheckInCampoComparativo,
    texto: r.texto,
    usuarioId: r.usuarioId,
    usuarioLogin: r.usuarioLogin,
    criadoEm: r.criadoEm.toISOString(),
  };
}

function mapDecisao(
  r: {
    id: number;
    idDocumentoEstoque: number;
    idItemDocumentoEstoque: number;
    idItemPedidoCompra: number;
    campo: string;
    decisao: string;
    justificativaOpcaoId: number;
    observacao: string | null;
    usuarioId: number;
    usuarioLogin: string;
    atualizadoEm: Date;
    justificativaOpcao: { codigo: string; label: string };
  },
  historicoObservacoes: DoubleCheckInComparativoObsHistRow[] = []
): DoubleCheckInComparativoDecisaoRow {
  return {
    id: r.id,
    idDocumentoEstoque: r.idDocumentoEstoque,
    idItemDocumentoEstoque: r.idItemDocumentoEstoque,
    idItemPedidoCompra: r.idItemPedidoCompra,
    campo: r.campo as DoubleCheckInCampoComparativo,
    decisao: r.decisao === 'recusa' ? 'recusa' : 'aceita',
    justificativaOpcaoId: r.justificativaOpcaoId,
    justificativaCodigo: r.justificativaOpcao.codigo,
    justificativaLabel: r.justificativaOpcao.label,
    observacao: r.observacao,
    usuarioId: r.usuarioId,
    usuarioLogin: r.usuarioLogin,
    atualizadoEm: r.atualizadoEm.toISOString(),
    historicoObservacoes,
  };
}

async function listarObsHistPorDocumento(
  idDocumentoEstoque: number
): Promise<Map<string, DoubleCheckInComparativoObsHistRow[]>> {
  const rows = await prisma.doubleCheckInComparativoObsHist.findMany({
    where: { idDocumentoEstoque },
    orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }],
  });
  const map = new Map<string, DoubleCheckInComparativoObsHistRow[]>();
  for (const r of rows) {
    const key = chaveObsHist(r.idItemDocumentoEstoque, r.idItemPedidoCompra, r.campo);
    const list = map.get(key) ?? [];
    list.push(mapObsHist(r));
    map.set(key, list);
  }
  return map;
}

/**
 * Acrescenta observação ao histórico se o texto for novo (≠ última entrada).
 * Também atualiza o campo `observacao` da decisão (última observação).
 */
async function appendObsHistorSeNovo(params: {
  idDocumentoEstoque: number;
  idItemDocumentoEstoque: number;
  idItemPedidoCompra: number;
  campo: DoubleCheckInCampoComparativo;
  texto: string | null | undefined;
  usuarioId: number;
  usuarioLogin: string;
}): Promise<DoubleCheckInComparativoObsHistRow | null> {
  const texto = String(params.texto ?? '').trim();
  if (!texto) return null;

  const last = await prisma.doubleCheckInComparativoObsHist.findFirst({
    where: {
      idDocumentoEstoque: params.idDocumentoEstoque,
      idItemDocumentoEstoque: params.idItemDocumentoEstoque,
      idItemPedidoCompra: params.idItemPedidoCompra,
      campo: params.campo,
    },
    orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
  });
  if (last && last.texto.trim() === texto) {
    return mapObsHist(last);
  }

  const created = await prisma.doubleCheckInComparativoObsHist.create({
    data: {
      idDocumentoEstoque: params.idDocumentoEstoque,
      idItemDocumentoEstoque: params.idItemDocumentoEstoque,
      idItemPedidoCompra: params.idItemPedidoCompra,
      campo: params.campo,
      texto,
      usuarioId: params.usuarioId,
      usuarioLogin: params.usuarioLogin,
    },
  });

  await prisma.doubleCheckInComparativoDecisao.updateMany({
    where: {
      idDocumentoEstoque: params.idDocumentoEstoque,
      idItemDocumentoEstoque: params.idItemDocumentoEstoque,
      idItemPedidoCompra: params.idItemPedidoCompra,
      campo: params.campo,
    },
    data: { observacao: texto },
  });

  return mapObsHist(created);
}

export async function listarDecisoesComparativo(
  idDocumentoEstoque: number
): Promise<DoubleCheckInComparativoDecisaoRow[]> {
  const [rows, histMap] = await Promise.all([
    prisma.doubleCheckInComparativoDecisao.findMany({
      where: { idDocumentoEstoque },
      include: { justificativaOpcao: { select: { codigo: true, label: true } } },
    }),
    listarObsHistPorDocumento(idDocumentoEstoque),
  ]);
  return rows.map((r) =>
    mapDecisao(
      r,
      histMap.get(chaveObsHist(r.idItemDocumentoEstoque, r.idItemPedidoCompra, r.campo)) ?? []
    )
  );
}

export async function upsertDecisaoComparativo(params: {
  idDocumentoEstoque: number;
  idItemDocumentoEstoque: number;
  idItemPedidoCompra: number;
  campo: DoubleCheckInCampoComparativo;
  decisao: 'aceita' | 'recusa';
  justificativaOpcaoId: number;
  observacao: string | null;
  usuarioId: number;
  usuarioLogin: string;
}): Promise<DoubleCheckInComparativoDecisaoRow> {
  if (!DOUBLE_CHECKIN_CAMPOS.includes(params.campo)) {
    throw new Error(`Campo inválido: ${params.campo}`);
  }
  if (params.decisao !== 'aceita' && params.decisao !== 'recusa') {
    throw new Error('Decisão deve ser aceita ou recusa.');
  }
  const opcao = await prisma.doubleCheckInJustificativaOpcao.findUnique({
    where: { id: params.justificativaOpcaoId },
  });
  if (!opcao || !opcao.ativo) {
    throw new Error('Justificativa inválida ou inativa.');
  }
  if (opcao.codigo === 'outros' && !String(params.observacao ?? '').trim()) {
    throw new Error('Informe a observação quando a justificativa for "Outros".');
  }

  const obsTrim = params.observacao?.trim() || null;
  const row = await prisma.doubleCheckInComparativoDecisao.upsert({
    where: {
      idDocumentoEstoque_idItemDocumentoEstoque_idItemPedidoCompra_campo: {
        idDocumentoEstoque: params.idDocumentoEstoque,
        idItemDocumentoEstoque: params.idItemDocumentoEstoque,
        idItemPedidoCompra: params.idItemPedidoCompra,
        campo: params.campo,
      },
    },
    create: {
      idDocumentoEstoque: params.idDocumentoEstoque,
      idItemDocumentoEstoque: params.idItemDocumentoEstoque,
      idItemPedidoCompra: params.idItemPedidoCompra,
      campo: params.campo,
      decisao: params.decisao,
      justificativaOpcaoId: params.justificativaOpcaoId,
      observacao: obsTrim,
      usuarioId: params.usuarioId,
      usuarioLogin: params.usuarioLogin,
    },
    update: {
      decisao: params.decisao,
      justificativaOpcaoId: params.justificativaOpcaoId,
      observacao: obsTrim,
      usuarioId: params.usuarioId,
      usuarioLogin: params.usuarioLogin,
    },
    include: { justificativaOpcao: { select: { codigo: true, label: true } } },
  });

  if (obsTrim) {
    await appendObsHistSeNovo({
      idDocumentoEstoque: params.idDocumentoEstoque,
      idItemDocumentoEstoque: params.idItemDocumentoEstoque,
      idItemPedidoCompra: params.idItemPedidoCompra,
      campo: params.campo,
      texto: obsTrim,
      usuarioId: params.usuarioId,
      usuarioLogin: params.usuarioLogin,
    });
  }

  const histMap = await listarObsHistPorDocumento(params.idDocumentoEstoque);
  return mapDecisao(
    row,
    histMap.get(
      chaveObsHist(row.idItemDocumentoEstoque, row.idItemPedidoCompra, row.campo)
    ) ?? []
  );
}

/**
 * Acrescenta observação ao histórico após a NF já conferida (decisão não muda).
 */
export async function adicionarObservacaoComparativoPosConferido(params: {
  idDocumentoEstoque: number;
  idItemDocumentoEstoque: number;
  idItemPedidoCompra: number;
  campo: DoubleCheckInCampoComparativo;
  texto: string;
  usuarioId: number;
  usuarioLogin: string;
}): Promise<{
  entrada: DoubleCheckInComparativoObsHistRow;
  decisao: DoubleCheckInComparativoDecisaoRow;
}> {
  if (!DOUBLE_CHECKIN_CAMPOS.includes(params.campo)) {
    throw new Error(`Campo inválido: ${params.campo}`);
  }
  const texto = String(params.texto ?? '').trim();
  if (!texto) {
    throw new Error('Informe a observação.');
  }

  const conferido = await prisma.doubleCheckInConferido.findUnique({
    where: { idDocumentoEstoque: params.idDocumentoEstoque },
  });
  if (!conferido) {
    throw new Error('Só é possível acrescentar observações após a NF ser conferida.');
  }

  const decisaoExistente = await prisma.doubleCheckInComparativoDecisao.findUnique({
    where: {
      idDocumentoEstoque_idItemDocumentoEstoque_idItemPedidoCompra_campo: {
        idDocumentoEstoque: params.idDocumentoEstoque,
        idItemDocumentoEstoque: params.idItemDocumentoEstoque,
        idItemPedidoCompra: params.idItemPedidoCompra,
        campo: params.campo,
      },
    },
    include: { justificativaOpcao: { select: { codigo: true, label: true } } },
  });
  if (!decisaoExistente) {
    throw new Error('Não há decisão registrada para esta divergência.');
  }

  const ultima = await prisma.doubleCheckInComparativoObsHist.findFirst({
    where: {
      idDocumentoEstoque: params.idDocumentoEstoque,
      idItemDocumentoEstoque: params.idItemDocumentoEstoque,
      idItemPedidoCompra: params.idItemPedidoCompra,
      campo: params.campo,
    },
    orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
  });
  if (ultima && ultima.texto.trim() === texto) {
    throw new Error('Observação idêntica à última já registrada.');
  }

  const entrada = await appendObsHistSeNovo({
    ...params,
    texto,
  });
  if (!entrada) {
    throw new Error('Informe a observação.');
  }

  const histMap = await listarObsHistPorDocumento(params.idDocumentoEstoque);
  const decisaoAtualizada = await prisma.doubleCheckInComparativoDecisao.findUniqueOrThrow({
    where: { id: decisaoExistente.id },
    include: { justificativaOpcao: { select: { codigo: true, label: true } } },
  });

  return {
    entrada,
    decisao: mapDecisao(
      decisaoAtualizada,
      histMap.get(
        chaveObsHist(
          decisaoAtualizada.idItemDocumentoEstoque,
          decisaoAtualizada.idItemPedidoCompra,
          decisaoAtualizada.campo
        )
      ) ?? []
    ),
  };
}

export async function getDoubleCheckInLimiarPct(): Promise<number> {
  const row = await prisma.config.findUnique({ where: { key: DOUBLE_CHECKIN_LIMIAR_KEY } });
  const n = Number(row?.value ?? DOUBLE_CHECKIN_LIMIAR_DEFAULT);
  if (!Number.isFinite(n) || n <= 0) return DOUBLE_CHECKIN_LIMIAR_DEFAULT;
  return Math.min(100, Math.max(0.1, n));
}

export async function setDoubleCheckInLimiarPct(limiarPct: number): Promise<number> {
  const n = Number(limiarPct);
  if (!Number.isFinite(n) || n <= 0 || n > 100) {
    throw new Error('Limiar deve ser um número entre 0,1 e 100.');
  }
  const value = String(Math.round(n * 100) / 100);
  await prisma.config.upsert({
    where: { key: DOUBLE_CHECKIN_LIMIAR_KEY },
    create: { key: DOUBLE_CHECKIN_LIMIAR_KEY, value },
    update: { value },
  });
  return Number(value);
}

/**
 * Data (YYYY-MM-DD) a partir da qual alertas WhatsApp são permitidos.
 * Na primeira leitura, grava o dia corrente (SP) — go-live sem flood histórico.
 */
export async function getOrCreateDoubleCheckInAlertaDesdeYmd(): Promise<string> {
  const row = await prisma.config.findUnique({ where: { key: DOUBLE_CHECKIN_ALERTA_DESDE_KEY } });
  const existing = String(row?.value ?? '').trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(existing)) return existing;

  const value = ymdHojeSaoPaulo();
  await prisma.config.upsert({
    where: { key: DOUBLE_CHECKIN_ALERTA_DESDE_KEY },
    create: { key: DOUBLE_CHECKIN_ALERTA_DESDE_KEY, value },
    update: { value },
  });
  return value;
}

export async function getDoubleCheckInDestinatarios(): Promise<{
  tipoId: number;
  usuarioIds: number[];
  grupos: { jid: string; nome: string | null }[];
  usuarios: UsuarioDestinatarioRow[];
}> {
  const tipo = await ensureDoubleCheckInWhatsappTipo();
  const full = await buscarTipoPorCode(DOUBLE_CHECKIN_WA_CODE);
  const usuarios = await listarUsuariosParaDestinatario();
  return {
    tipoId: tipo.id,
    usuarioIds: (full?.destinatarios ?? []).map((d) => d.usuarioId),
    grupos: (full?.grupos ?? []).map((g) => ({ jid: g.jid, nome: g.nome })),
    usuarios,
  };
}

export async function setDoubleCheckInDestinatarios(
  usuarioIds: number[],
  grupos: GrupoDestinoInput[] = []
): Promise<{
  tipoId: number;
  usuarioIds: number[];
  grupos: { jid: string; nome: string | null }[];
}> {
  const tipo = await ensureDoubleCheckInWhatsappTipo();
  const tipos = await salvarDestinatarios(tipo.id, usuarioIds, grupos);
  const row = tipos.find((t) => t.code === DOUBLE_CHECKIN_WA_CODE) ?? tipos.find((t) => t.id === tipo.id);
  return {
    tipoId: tipo.id,
    usuarioIds: row?.destinatarioIds ?? [],
    grupos: row?.grupos ?? [],
  };
}

export async function listarDocumentosJaAlertados(ids: number[]): Promise<Set<number>> {
  if (ids.length === 0) return new Set();
  const rows = await prisma.doubleCheckInAlertaEnviado.findMany({
    where: { idDocumentoEstoque: { in: ids } },
    select: { idDocumentoEstoque: true },
  });
  return new Set(rows.map((r) => r.idDocumentoEstoque));
}

export async function marcarAlertaEnviado(
  idDocumentoEstoque: number,
  resumo: string
): Promise<void> {
  await prisma.doubleCheckInAlertaEnviado.upsert({
    where: { idDocumentoEstoque },
    create: { idDocumentoEstoque, resumo: resumo.slice(0, 2000) },
    update: { resumo: resumo.slice(0, 2000), enviadoEm: new Date() },
  });
}

export type DoubleCheckInConferidoInfo = {
  idDocumentoEstoque: number;
  conferidoEm: string;
  usuarioId: number;
  usuarioLogin: string;
};

export async function listarDocumentosConferidos(
  ids: number[]
): Promise<Map<number, DoubleCheckInConferidoInfo>> {
  const map = new Map<number, DoubleCheckInConferidoInfo>();
  if (ids.length === 0) return map;
  const rows = await prisma.doubleCheckInConferido.findMany({
    where: { idDocumentoEstoque: { in: ids } },
  });
  for (const r of rows) {
    map.set(r.idDocumentoEstoque, {
      idDocumentoEstoque: r.idDocumentoEstoque,
      conferidoEm: r.conferidoEm.toISOString(),
      usuarioId: r.usuarioId,
      usuarioLogin: r.usuarioLogin,
    });
  }
  return map;
}

/** Todos os documentos já conferidos (para cruzar com período Nomus no dashboard). */
export async function listarTodosDocumentosConferidos(): Promise<
  Map<number, DoubleCheckInConferidoInfo>
> {
  const map = new Map<number, DoubleCheckInConferidoInfo>();
  const rows = await prisma.doubleCheckInConferido.findMany();
  for (const r of rows) {
    map.set(r.idDocumentoEstoque, {
      idDocumentoEstoque: r.idDocumentoEstoque,
      conferidoEm: r.conferidoEm.toISOString(),
      usuarioId: r.usuarioId,
      usuarioLogin: r.usuarioLogin,
    });
  }
  return map;
}

/** IDs com outlier já detectado na sync (resumo ≠ sem-outlier / baseline). */
export async function listarIdsComAtencaoDetectada(): Promise<Set<number>> {
  const rows = await prisma.doubleCheckInAlertaEnviado.findMany({
    select: { idDocumentoEstoque: true, resumo: true },
  });
  const set = new Set<number>();
  for (const r of rows) {
    const resumo = String(r.resumo ?? '').trim();
    if (!resumo) continue;
    if (resumo === 'sem-outlier') continue;
    if (resumo.startsWith('baseline-')) continue;
    set.add(r.idDocumentoEstoque);
  }
  return set;
}

export async function getDocumentoConferido(
  idDocumentoEstoque: number
): Promise<DoubleCheckInConferidoInfo | null> {
  const r = await prisma.doubleCheckInConferido.findUnique({
    where: { idDocumentoEstoque },
  });
  if (!r) return null;
  return {
    idDocumentoEstoque: r.idDocumentoEstoque,
    conferidoEm: r.conferidoEm.toISOString(),
    usuarioId: r.usuarioId,
    usuarioLogin: r.usuarioLogin,
  };
}

export async function marcarDocumentoConferido(params: {
  idDocumentoEstoque: number;
  usuarioId: number;
  usuarioLogin: string;
}): Promise<DoubleCheckInConferidoInfo> {
  const existing = await prisma.doubleCheckInConferido.findUnique({
    where: { idDocumentoEstoque: params.idDocumentoEstoque },
  });
  if (existing) {
    return {
      idDocumentoEstoque: existing.idDocumentoEstoque,
      conferidoEm: existing.conferidoEm.toISOString(),
      usuarioId: existing.usuarioId,
      usuarioLogin: existing.usuarioLogin,
    };
  }
  const created = await prisma.doubleCheckInConferido.create({
    data: {
      idDocumentoEstoque: params.idDocumentoEstoque,
      usuarioId: params.usuarioId,
      usuarioLogin: params.usuarioLogin,
    },
  });
  return {
    idDocumentoEstoque: created.idDocumentoEstoque,
    conferidoEm: created.conferidoEm.toISOString(),
    usuarioId: created.usuarioId,
    usuarioLogin: created.usuarioLogin,
  };
}

function novoTokenPagina(): string {
  return randomBytes(12).toString('base64url');
}

/** Grava o retrato da conferência. Se a NF já tem página, devolve o mesmo token. */
export async function salvarConferenciaPagina(
  idDocumentoEstoque: number,
  payloadJson: string
): Promise<string> {
  const existente = await prisma.doubleCheckInConferenciaPagina.findUnique({
    where: { idDocumentoEstoque },
    select: { token: true },
  });
  if (existente) return existente.token;

  for (let tentativa = 0; tentativa < 5; tentativa++) {
    try {
      const created = await prisma.doubleCheckInConferenciaPagina.create({
        data: { token: novoTokenPagina(), idDocumentoEstoque, payloadJson },
        select: { token: true },
      });
      return created.token;
    } catch {
      const deNovo = await prisma.doubleCheckInConferenciaPagina.findUnique({
        where: { idDocumentoEstoque },
        select: { token: true },
      });
      if (deNovo) return deNovo.token;
    }
  }
  throw new Error('Não foi possível gravar a página da conferência.');
}

export async function buscarConferenciaPaginaPorToken(
  token: string
): Promise<{ payloadJson: string } | null> {
  return prisma.doubleCheckInConferenciaPagina.findUnique({
    where: { token },
    select: { payloadJson: true },
  });
}
