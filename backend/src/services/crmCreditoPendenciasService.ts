/**
 * Aba CRM → Pendências de crédito: upsert a partir do alerta, ações e e-mail To/Cc.
 */

import type { PrismaClient } from '@prisma/client';
import { resolveAppBaseUrl } from '../config/appBaseUrl.js';
import {
  formatarNumeroPedidoExibicao,
  labelStatusItemPedidoCompleto,
  listarStatusPedidosCreditoPorIds,
  listarValoresPedidosCreditoPorIds,
} from '../data/financeiroCreditoPedidoQuery.js';
import { criarMatcherTextoLivre } from '../utils/textoLivreBusca.js';
import { buildSystemEmailHtml } from './emailHtmlTemplate.js';
import { sendSystemEmail } from './systemEmail.js';
import { envioNotificacoesHabilitado, logEnvioSuprimido } from '../config/envioNotificacoes.js';

/** Formato mínimo do alerta de crédito (evita import circular com o serviço de e-mail). */
export type AlertaCreditoParaPendencia = {
  clienteNome: string;
  pedidos: Array<{
    idPedido: number;
    numeroPedido: string;
    statusItem: number;
    statusLabel: string;
  }>;
  contasAtraso: Array<{
    codigo: number;
    dataVencimento: string | null;
    diasAtraso: number;
  }>;
  totalAtraso: number;
};

export const ACOES_PENDENCIA = [
  'CANCELADO',
  'PAUSADO',
  'REALOCAR_MATERIAL',
  'SEGUIR_PRODUCAO',
] as const;
export type AcaoPendenciaCredito = (typeof ACOES_PENDENCIA)[number];

export const LABEL_ACAO: Record<AcaoPendenciaCredito, string> = {
  CANCELADO: 'Pedido cancelado',
  PAUSADO: 'Pedido pausado',
  REALOCAR_MATERIAL: 'Realocar material',
  SEGUIR_PRODUCAO: 'Seguir com produção',
};

export function normalizarClienteChave(nome: string): string {
  return nome.trim().toLowerCase().replace(/\s+/g, ' ');
}

export type UsuarioDestinatarioPendencia = {
  id: number;
  login: string;
  nome: string | null;
  email: string | null;
  ativo: boolean;
};

function parseUsuarioIdsJson(raw: string | null | undefined): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return [
      ...new Set(
        parsed
          .map((v) => Number(v))
          .filter((n) => Number.isFinite(n) && n > 0)
          .map((n) => Math.trunc(n))
      ),
    ];
  } catch {
    return [];
  }
}

function normalizarListaUsuarioIds(input: unknown): number[] {
  if (!Array.isArray(input)) return [];
  return [
    ...new Set(
      input
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n) && n > 0)
        .map((n) => Math.trunc(n))
    ),
  ];
}

export async function listarUsuariosParaDestinatarioPendencia(
  prisma: PrismaClient
): Promise<UsuarioDestinatarioPendencia[]> {
  const rows = await prisma.usuario.findMany({
    where: { ativo: true },
    select: { id: true, login: true, nome: true, email: true, ativo: true },
    orderBy: [{ nome: 'asc' }, { login: 'asc' }],
  });
  return rows.map((u) => ({
    id: u.id,
    login: u.login,
    nome: u.nome,
    email: u.email ?? null,
    ativo: u.ativo,
  }));
}

async function carregarUsuariosPorIds(
  prisma: PrismaClient,
  ids: number[]
): Promise<UsuarioDestinatarioPendencia[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.usuario.findMany({
    where: { id: { in: ids } },
    select: { id: true, login: true, nome: true, email: true, ativo: true },
  });
  const map = new Map(rows.map((u) => [u.id, u]));
  return ids
    .map((id) => map.get(id))
    .filter((u): u is NonNullable<typeof u> => Boolean(u))
    .map((u) => ({
      id: u.id,
      login: u.login,
      nome: u.nome,
      email: u.email ?? null,
      ativo: u.ativo,
    }));
}

function emailsDeUsuarios(usuarios: UsuarioDestinatarioPendencia[]): string[] {
  return [
    ...new Set(
      usuarios
        .map((u) => (u.email ?? '').trim().toLowerCase())
        .filter((e) => e.includes('@'))
    ),
  ];
}

function formatarBRL(val: number): string {
  return val.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function instrucaoNomusParaAcao(acao: AcaoPendenciaCredito): string {
  switch (acao) {
    case 'CANCELADO':
      return 'Vá ao Nomus e cancele este pedido (itens). Depois volte e atualize a tabela para sincronizar o status.';
    case 'PAUSADO':
      return 'Vá ao Nomus e altere o(s) item(ns) do pedido para "Aguardando liberação". Depois volte e atualize a tabela.';
    case 'REALOCAR_MATERIAL':
      return 'Realoque o material conforme a necessidade. Depois, no Nomus, altere o(s) item(ns) do pedido de origem para "Aguardando liberação". Em seguida volte e confirme na tabela.';
    case 'SEGUIR_PRODUCAO':
      return 'Produção segue normalmente. Nenhuma alteração de status no Nomus é exigida para esta ação — o e-mail será enviado ao salvar.';
    default:
      return '';
  }
}

export function confirmacaoNomusOk(
  acao: string | null | undefined,
  statusNomus: number | null | undefined
): boolean | null {
  if (!acao || statusNomus == null) return null;
  if (acao === 'PAUSADO' || acao === 'REALOCAR_MATERIAL') return statusNomus === 1;
  if (acao === 'CANCELADO') return statusNomus === 6 || statusNomus >= 4;
  if (acao === 'SEGUIR_PRODUCAO') return true;
  return null;
}

/** Ações que exigem evidência de mudança de status no Nomus antes do e-mail. */
function acaoExigeConfirmacaoNomus(acao: AcaoPendenciaCredito): boolean {
  return acao === 'PAUSADO' || acao === 'CANCELADO' || acao === 'REALOCAR_MATERIAL';
}

function nomusConfirmadoParaAcao(
  acao: AcaoPendenciaCredito,
  statusNomus: number | null | undefined
): boolean {
  if (!acaoExigeConfirmacaoNomus(acao)) return true;
  return confirmacaoNomusOk(acao, statusNomus) === true;
}

function acaoEntraMonitorRegularizacao(acao: AcaoPendenciaCredito): boolean {
  return acao === 'PAUSADO' || acao === 'REALOCAR_MATERIAL' || acao === 'SEGUIR_PRODUCAO';
}

export type SituacaoFilaPendencia = 'INADIMPLENTES' | 'REGULARIZADOS' | 'FINALIZADOS';

export const LABEL_SITUACAO_FILA: Record<SituacaoFilaPendencia, string> = {
  INADIMPLENTES: 'Inadimplentes — aguardando ação',
  REGULARIZADOS: 'Regularizados — aguardando ação',
  FINALIZADOS: 'Finalizados',
};

/** Cria/atualiza uma linha por pedido aberto do alerta (não sobrescreve ação já salva). */
export async function upsertPendenciasFromAlerta(
  prisma: PrismaClient,
  alerta: AlertaCreditoParaPendencia
): Promise<number> {
  const agora = new Date();
  const clienteChave = normalizarClienteChave(alerta.clienteNome);
  const maiorAtrasoDias = Math.max(...alerta.contasAtraso.map((c) => c.diasAtraso), 0);
  const totalAtraso = alerta.totalAtraso;
  const qtdTitulos = alerta.contasAtraso.length;
  const contasAtrasoJson = JSON.stringify(
    alerta.contasAtraso.map((c) => ({
      codigoConta: c.codigo,
      dataVencimento: c.dataVencimento,
      status: 'PENDENTE',
      statusLabel: 'Em atraso',
    }))
  );

  const porPedido = new Map<
    number,
    { idPedido: number; numeroPedido: string; statusItem: number; statusLabel: string }
  >();
  for (const p of alerta.pedidos) {
    const prev = porPedido.get(p.idPedido);
    if (!prev || p.statusItem < prev.statusItem) {
      porPedido.set(p.idPedido, p);
    }
  }

  let count = 0;
  for (const p of porPedido.values()) {
    const existente = await prisma.crmCreditoPendencia.findUnique({
      where: { idPedido: p.idPedido },
    });

    if (existente) {
      // Não reabre linhas já finalizadas (canceladas / liberadas após regularização)
      if (existente.encerrada) {
        count++;
        continue;
      }
      await prisma.crmCreditoPendencia.update({
        where: { id: existente.id },
        data: {
          numeroPedido: p.numeroPedido,
          clienteNome: alerta.clienteNome,
          clienteChave,
          statusNomusSnapshot: p.statusItem,
          statusNomusLabel: p.statusLabel,
          qtdTitulosAtraso: qtdTitulos,
          totalAtraso,
          maiorAtrasoDias,
          contasAtrasoJson,
          // Mantém alertaEm original — base do prazo de execução (SLA).
        },
      });
      // Sem evento ALERTA reiterado — histórico só registra e-mails enviados e ações
    } else {
      await prisma.crmCreditoPendencia.create({
        data: {
          idPedido: p.idPedido,
          numeroPedido: p.numeroPedido,
          clienteNome: alerta.clienteNome,
          clienteChave,
          statusNomusSnapshot: p.statusItem,
          statusNomusLabel: p.statusLabel,
          qtdTitulosAtraso: qtdTitulos,
          totalAtraso,
          maiorAtrasoDias,
          contasAtrasoJson,
          alertaEm: agora,
        },
      });
    }
    count++;
  }
  return count;
}

export async function sincronizarPendenciasComAlertasAtuais(
  prisma: PrismaClient,
  alertas: AlertaCreditoParaPendencia[]
): Promise<number> {
  let total = 0;
  for (const alerta of alertas) {
    total += await upsertPendenciasFromAlerta(prisma, alerta);
  }
  await limparPendenciasForaDaCarencia(prisma, alertas);
  return total;
}

/**
 * Remove da grade linhas abertas sem ação confirmada no Nomus que:
 * - não estão mais nos alertas elegíveis (abaixo da carência / sem atraso), ou
 * - ainda têm snapshot de atraso abaixo da carência.
 * Mantém quem já confirmou ação (pausa/cancelamento/realocação) ou está encerrada.
 */
export async function limparPendenciasForaDaCarencia(
  prisma: PrismaClient,
  alertas: AlertaCreditoParaPendencia[]
): Promise<number> {
  const { CARENCIA_DIAS_ATRASO } = await import(
    './financeiroCreditoPedidoAtrasoEmailService.js'
  );

  const chavesElegiveis = new Set(
    alertas.map((a) => normalizarClienteChave(a.clienteNome)).filter(Boolean)
  );

  const abertas = await prisma.crmCreditoPendencia.findMany({
    where: { encerrada: false },
    select: {
      id: true,
      clienteChave: true,
      acao: true,
      statusNomusSnapshot: true,
      emailAcaoEnviadoEm: true,
      maiorAtrasoDias: true,
    },
  });

  let removidas = 0;
  for (const row of abertas) {
    const confirmada =
      Boolean(row.emailAcaoEnviadoEm) ||
      confirmacaoNomusOk(row.acao, row.statusNomusSnapshot) === true;
    if (confirmada) continue;

    const elegivel = chavesElegiveis.has(row.clienteChave);
    const abaixoCarencia =
      row.maiorAtrasoDias != null && row.maiorAtrasoDias < CARENCIA_DIAS_ATRASO;

    if (!elegivel || abaixoCarencia) {
      await prisma.crmCreditoPendencia.delete({ where: { id: row.id } });
      removidas++;
    }
  }
  return removidas;
}

export type PendenciaCreditoDto = {
  id: number;
  idPedido: number;
  numeroPedido: string;
  numeroPedidoExibicao: string;
  clienteNome: string;
  clienteChave: string;
  /** Valor total do pedido (Nomus). */
  valorPedido: number | null;
  statusNomus: number | null;
  statusNomusLabel: string | null;
  acao: string | null;
  acaoLabel: string | null;
  observacao: string | null;
  pedidoDestino: string | null;
  qtdTitulosAtraso: number | null;
  totalAtraso: number | null;
  maiorAtrasoDias: number | null;
  alertaEm: string;
  acaoEm: string | null;
  acaoPorLogin: string | null;
  acaoPorNome: string | null;
  encerrada: boolean;
  aguardandoConfirmacaoNomus: boolean;
  instrucaoNomus: string | null;
  /** E-mail de ação já disparado após confirmação Nomus. */
  emailAcaoEnviado: boolean;
  emailAcaoEnviadoEm: string | null;
  /** Prazo configurado (h) para ação após o alerta. */
  prazoHorasSemAcao: number;
  /** Horas desde o alerta até agora (ou até a ação). */
  horasDecorridas: number;
  /** Horas restantes até estourar o prazo; null se já houve ação / encerrado. */
  horasRestantes: number | null;
  /** Sem ação e prazo estourado. */
  slaEstourado: boolean;
  /** E-mail de SLA ao gestor já enviado. */
  emailSlaEnviado: boolean;
  emailSlaEnviadoEm: string | null;
  /** Situação do monitoramento de regularização (por cliente). */
  regularizacaoSituacao: string | null;
  regularizacaoSituacaoLabel: string | null;
  qtdTitulosMonitorPendentes: number | null;
  qtdTitulosMonitorTotal: number | null;
  /** Contas em acompanhamento (código, vencimento, status) — por cliente. */
  contasAcompanhamento: Array<{
    codigoConta: number;
    dataVencimento: string | null;
    status: string;
    statusLabel: string;
  }>;
  /** Fila operacional da aba. */
  situacaoFila: SituacaoFilaPendencia;
  situacaoFilaLabel: string;
  /** Pode confirmar liberação no Nomus (regularizado + status ainda pausado). */
  podeConfirmarLiberacao: boolean;
  /** E-mails de alerta de crédito já enviados sobre o cliente. */
  qtdEmailsAlerta: number;
  /** E-mails de ação (pós-confirmação Nomus) já enviados sobre pedidos do cliente. */
  qtdEmailsAcao: number;
  /** Total de e-mails (alerta + ação). */
  qtdEmailsTotal: number;
  qtdAcoesRegistradas: number;
};

function parseContasAtrasoSnapshot(
  raw: string | null | undefined
): PendenciaCreditoDto['contasAcompanhamento'] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const codigo = Number(row.codigoConta ?? row.codigo);
        if (!Number.isFinite(codigo) || codigo <= 0) return null;
        return {
          codigoConta: codigo,
          dataVencimento:
            typeof row.dataVencimento === 'string' ? row.dataVencimento : null,
          status: typeof row.status === 'string' ? row.status : 'PENDENTE',
          statusLabel:
            typeof row.statusLabel === 'string' ? row.statusLabel : 'Em atraso',
        };
      })
      .filter((x): x is PendenciaCreditoDto['contasAcompanhamento'][number] => Boolean(x));
  } catch {
    return [];
  }
}

export function calcularSlaPendencia(input: {
  alertaEm: Date;
  acao: string | null | undefined;
  encerrada: boolean;
  prazoHorasSemAcao: number;
  agora?: Date;
}): {
  horasDecorridas: number;
  horasRestantes: number | null;
  slaEstourado: boolean;
} {
  const agora = input.agora ?? new Date();
  const ms = Math.max(0, agora.getTime() - input.alertaEm.getTime());
  const horasDecorridas = Math.floor(ms / 3_600_000);
  if (input.acao || input.encerrada) {
    return { horasDecorridas, horasRestantes: null, slaEstourado: false };
  }
  const prazoMs = Math.max(1, input.prazoHorasSemAcao) * 3_600_000;
  const restanteMs = prazoMs - ms;
  const horasRestantes = Math.max(0, Math.ceil(restanteMs / 3_600_000));
  return {
    horasDecorridas,
    horasRestantes,
    slaEstourado: restanteMs <= 0,
  };
}

function toDto(
  row: {
    id: number;
    idPedido: number;
    numeroPedido: string;
    clienteNome: string;
    clienteChave: string;
    statusNomusSnapshot: number | null;
    statusNomusLabel: string | null;
    acao: string | null;
    observacao: string | null;
    pedidoDestino: string | null;
    qtdTitulosAtraso: number | null;
    totalAtraso: number | null;
    maiorAtrasoDias: number | null;
    contasAtrasoJson?: string | null;
    valorPedido?: number | null;
    alertaEm: Date;
    acaoEm: Date | null;
    acaoPorLogin: string | null;
    acaoPorNome: string | null;
    emailAcaoEnviadoEm?: Date | null;
    emailSlaEnviadoEm?: Date | null;
    encerrada: boolean;
  },
  prazoHorasSemAcao = 48
): PendenciaCreditoDto {
  const conf = confirmacaoNomusOk(row.acao, row.statusNomusSnapshot);
  const emailAcaoEnviado = Boolean(row.emailAcaoEnviadoEm);
  const aguardando =
    Boolean(row.acao) &&
    ACOES_PENDENCIA.includes(row.acao as AcaoPendenciaCredito) &&
    acaoExigeConfirmacaoNomus(row.acao as AcaoPendenciaCredito) &&
    conf !== true &&
    !emailAcaoEnviado;
  const sla = calcularSlaPendencia({
    alertaEm: row.alertaEm,
    acao: row.acao,
    encerrada: row.encerrada,
    prazoHorasSemAcao,
  });
  return {
    id: row.id,
    idPedido: row.idPedido,
    numeroPedido: row.numeroPedido,
    numeroPedidoExibicao: formatarNumeroPedidoExibicao(row.numeroPedido),
    clienteNome: row.clienteNome,
    clienteChave: row.clienteChave,
    valorPedido:
      row.valorPedido != null && Number.isFinite(Number(row.valorPedido))
        ? Number(row.valorPedido)
        : null,
    statusNomus: row.statusNomusSnapshot,
    statusNomusLabel: row.statusNomusLabel,
    acao: row.acao,
    acaoLabel: row.acao && row.acao in LABEL_ACAO ? LABEL_ACAO[row.acao as AcaoPendenciaCredito] : row.acao,
    observacao: row.observacao,
    pedidoDestino: row.pedidoDestino,
    qtdTitulosAtraso: row.qtdTitulosAtraso,
    totalAtraso: row.totalAtraso,
    maiorAtrasoDias: row.maiorAtrasoDias,
    alertaEm: row.alertaEm.toISOString(),
    acaoEm: row.acaoEm?.toISOString() ?? null,
    acaoPorLogin: row.acaoPorLogin,
    acaoPorNome: row.acaoPorNome,
    encerrada: row.encerrada,
    aguardandoConfirmacaoNomus: aguardando,
    instrucaoNomus:
      row.acao && ACOES_PENDENCIA.includes(row.acao as AcaoPendenciaCredito)
        ? instrucaoNomusParaAcao(row.acao as AcaoPendenciaCredito)
        : null,
    emailAcaoEnviado,
    emailAcaoEnviadoEm: row.emailAcaoEnviadoEm?.toISOString() ?? null,
    prazoHorasSemAcao,
    horasDecorridas: sla.horasDecorridas,
    horasRestantes: sla.horasRestantes,
    slaEstourado: sla.slaEstourado,
    emailSlaEnviado: Boolean(row.emailSlaEnviadoEm),
    emailSlaEnviadoEm: row.emailSlaEnviadoEm?.toISOString() ?? null,
    regularizacaoSituacao: null,
    regularizacaoSituacaoLabel: null,
    qtdTitulosMonitorPendentes: null,
    qtdTitulosMonitorTotal: null,
    contasAcompanhamento: parseContasAtrasoSnapshot(row.contasAtrasoJson),
    situacaoFila: row.encerrada ? 'FINALIZADOS' : 'INADIMPLENTES',
    situacaoFilaLabel: row.encerrada
      ? LABEL_SITUACAO_FILA.FINALIZADOS
      : LABEL_SITUACAO_FILA.INADIMPLENTES,
    podeConfirmarLiberacao: false,
    qtdEmailsAlerta: 0,
    qtdEmailsAcao: 0,
    qtdEmailsTotal: 0,
    qtdAcoesRegistradas: 0,
  };
}

async function enriquecerContadoresCliente(
  prisma: PrismaClient,
  itens: PendenciaCreditoDto[]
): Promise<PendenciaCreditoDto[]> {
  if (itens.length === 0) return itens;

  const chaves = [...new Set(itens.map((i) => i.clienteChave).filter(Boolean))];
  if (chaves.length === 0) return itens;

  const contagem = new Map<string, { alerta: number; acaoEmail: number; acoes: number }>();
  for (const chave of chaves) {
    contagem.set(chave, { alerta: 0, acaoEmail: 0, acoes: 0 });
  }

  const [logsAlerta, pendenciasChave] = await Promise.all([
    prisma.emailDisparoLog.findMany({
      where: {
        categoria: 'financeiro_credito_pedido_atraso',
        OR: chaves.map((chave) => ({
          chave: { startsWith: `financeiro_credito_pedido_atraso:${chave}:` },
        })),
      },
      select: { chave: true },
    }),
    prisma.crmCreditoPendencia.findMany({
      where: { clienteChave: { in: chaves } },
      select: { id: true, clienteChave: true },
    }),
  ]);

  for (const log of logsAlerta) {
    const chave = chaves.find((c) =>
      log.chave.startsWith(`financeiro_credito_pedido_atraso:${c}:`)
    );
    if (!chave) continue;
    const c = contagem.get(chave)!;
    c.alerta += 1;
  }

  const idParaChave = new Map(pendenciasChave.map((p) => [p.id, p.clienteChave]));
  const todosIds = pendenciasChave.map((p) => p.id);
  if (todosIds.length > 0) {
    const eventos = await prisma.crmCreditoPendenciaEvento.groupBy({
      by: ['pendenciaId', 'tipo'],
      where: {
        pendenciaId: { in: todosIds },
        tipo: { in: ['EMAIL', 'ACAO'] },
      },
      _count: { _all: true },
    });
    for (const ev of eventos) {
      const chave = idParaChave.get(ev.pendenciaId);
      if (!chave) continue;
      const c = contagem.get(chave);
      if (!c) continue;
      if (ev.tipo === 'EMAIL') c.acaoEmail += ev._count._all;
      if (ev.tipo === 'ACAO') c.acoes += ev._count._all;
    }
  }

  return itens.map((item) => {
    const c = contagem.get(item.clienteChave) ?? { alerta: 0, acaoEmail: 0, acoes: 0 };
    return {
      ...item,
      qtdEmailsAlerta: c.alerta,
      qtdEmailsAcao: c.acaoEmail,
      qtdEmailsTotal: c.alerta + c.acaoEmail,
      qtdAcoesRegistradas: c.acoes,
    };
  });
}

function statusNomusLiberado(statusNomus: number | null | undefined): boolean {
  return statusNomus != null && statusNomus >= 2 && statusNomus <= 5;
}

function classificarSituacaoFila(
  encerrada: boolean,
  regularizacaoSituacao: string | null | undefined
): SituacaoFilaPendencia {
  if (encerrada) return 'FINALIZADOS';
  if (regularizacaoSituacao === 'REGULARIZADO') return 'REGULARIZADOS';
  return 'INADIMPLENTES';
}

async function encerrarPendenciaSeElegivel(
  prisma: PrismaClient,
  row: {
    id: number;
    encerrada: boolean;
    acao: string | null;
    statusNomusSnapshot: number | null;
    clienteChave: string;
  },
  regularizacaoSituacao: string | null | undefined
): Promise<boolean> {
  if (row.encerrada) return false;

  if (row.acao === 'CANCELADO' && confirmacaoNomusOk('CANCELADO', row.statusNomusSnapshot)) {
    await prisma.crmCreditoPendencia.update({
      where: { id: row.id },
      data: { encerrada: true },
    });
    await prisma.crmCreditoPendenciaEvento.create({
      data: {
        pendenciaId: row.id,
        tipo: 'FINALIZADO',
        detalhe: 'Pedido cancelado confirmado no Nomus — movido para Finalizados',
      },
    });
    return true;
  }

  if (
    regularizacaoSituacao === 'REGULARIZADO' &&
    statusNomusLiberado(row.statusNomusSnapshot)
  ) {
    await prisma.crmCreditoPendencia.update({
      where: { id: row.id },
      data: { encerrada: true },
    });
    await prisma.crmCreditoPendenciaEvento.create({
      data: {
        pendenciaId: row.id,
        tipo: 'FINALIZADO',
        detalhe: 'Cliente regularizado e pedido liberado no Nomus — Finalizados',
      },
    });
    return true;
  }

  return false;
}

export async function listarPendenciasCredito(
  prisma: PrismaClient,
  options?: {
    cliente?: string | null;
    apenasAbertas?: boolean;
    syncNomus?: boolean;
    situacaoFila?: SituacaoFilaPendencia | null;
  }
): Promise<{
  itens: PendenciaCreditoDto[];
  contagens: Record<SituacaoFilaPendencia, number>;
}> {
  const situacaoFiltro = options?.situacaoFila ?? 'INADIMPLENTES';
  const clienteFiltro = options?.cliente?.trim() ?? '';
  const syncNomus = options?.syncNomus !== false;

  // Carrega abertas + finalizadas para classificar e contar; filtra depois
  const rows = await prisma.crmCreditoPendencia.findMany({
    orderBy: [{ alertaEm: 'desc' }, { clienteNome: 'asc' }, { numeroPedido: 'asc' }],
  });
  const emailCfg = await obterEmailConfigPendencias(prisma);
  const prazoHoras = emailCfg.prazoHorasSemAcao;

  if (syncNomus && rows.length > 0) {
    const statuses = await listarStatusPedidosCreditoPorIds(rows.map((r) => r.idPedido));
    const map = new Map(statuses.map((s) => [s.idPedido, s]));
    const updates: Promise<unknown>[] = [];
    for (const row of rows) {
      const st = map.get(row.idPedido);
      if (!st) continue;
      const valorMudou =
        row.valorPedido == null || Math.abs(Number(row.valorPedido) - st.valorPedido) > 0.009;
      if (
        st.statusItem !== row.statusNomusSnapshot ||
        st.statusLabel !== row.statusNomusLabel ||
        st.numeroPedido !== row.numeroPedido ||
        valorMudou
      ) {
        updates.push(
          prisma.crmCreditoPendencia.update({
            where: { id: row.id },
            data: {
              statusNomusSnapshot: st.statusItem,
              statusNomusLabel: st.statusLabel,
              numeroPedido: st.numeroPedido || row.numeroPedido,
              valorPedido: st.valorPedido,
            },
          })
        );
        row.statusNomusSnapshot = st.statusItem;
        row.statusNomusLabel = st.statusLabel;
        if (st.numeroPedido) row.numeroPedido = st.numeroPedido;
        row.valorPedido = st.valorPedido;
      }
    }
    if (updates.length > 0) await Promise.all(updates);
  } else if (rows.length > 0) {
    // Abertura rápida: só completa valor quando ainda não há snapshot.
    const semValor = rows.filter((r) => r.valorPedido == null);
    if (semValor.length > 0) {
      try {
        const valores = await listarValoresPedidosCreditoPorIds(semValor.map((r) => r.idPedido));
        const map = new Map(valores.map((v) => [v.idPedido, v.valorPedido]));
        const updates: Promise<unknown>[] = [];
        for (const row of semValor) {
          const valor = map.get(row.idPedido);
          if (valor == null) continue;
          row.valorPedido = valor;
          updates.push(
            prisma.crmCreditoPendencia.update({
              where: { id: row.id },
              data: { valorPedido: valor },
            })
          );
        }
        if (updates.length > 0) await Promise.all(updates);
      } catch (err) {
        console.warn('Valor pedido pendências (parcial):', err);
      }
    }
  }

  type MonitorResumo = Awaited<
    ReturnType<
      typeof import('./crmCreditoRegularizacaoService.js').listarResumoMonitoresPorChaves
    >
  > extends Map<string, infer V>
    ? V
    : never;
  let monitores = new Map<string, MonitorResumo>();

  try {
    const { reconciliarMonitoresRegularizacao, listarResumoMonitoresPorChaves } =
      await import('./crmCreditoRegularizacaoService.js');
    // Reconciliação Nomus só no sync pesado (Atualizar); listagem usa snapshot local.
    if (syncNomus) {
      await reconciliarMonitoresRegularizacao(prisma);
    }
    const chaves = [...new Set(rows.map((r) => r.clienteChave).filter(Boolean))];
    monitores = await listarResumoMonitoresPorChaves(prisma, chaves);
  } catch (err) {
    console.warn('Reconciliar monitores (parcial):', err);
  }

  if (syncNomus) {
    await Promise.all(
      rows.map(async (row) => {
        const m = monitores.get(row.clienteChave);
        const encerrou = await encerrarPendenciaSeElegivel(
          prisma,
          row,
          m?.situacao ?? null
        );
        if (encerrou) row.encerrada = true;
      })
    );
  }

  let result = rows.map((r) => toDto(r, prazoHoras));
  if (clienteFiltro) {
    const match = criarMatcherTextoLivre(clienteFiltro);
    result = result.filter(
      (r) => match(r.clienteNome) || match(r.numeroPedido) || match(r.numeroPedidoExibicao)
    );
  }

  result = await enriquecerContadoresCliente(prisma, result);

  // Contas: monitor (Prisma) tem prioridade; senão snapshot JSON da pendência (sem Nomus).
  result = result.map((item) => {
    const m = monitores.get(item.clienteChave);
    const situacaoFila = classificarSituacaoFila(item.encerrada, m?.situacao);
    const podeConfirmarLiberacao =
      situacaoFila === 'REGULARIZADOS' && !statusNomusLiberado(item.statusNomus);

    if (m) {
      return {
        ...item,
        regularizacaoSituacao: m.situacao,
        regularizacaoSituacaoLabel: m.situacaoLabel,
        qtdTitulosMonitorPendentes: m.qtdTitulosPendentes,
        qtdTitulosMonitorTotal: m.qtdTitulosTotal,
        contasAcompanhamento: m.titulos.map((t) => ({
          codigoConta: t.codigoConta,
          dataVencimento: t.dataVencimento,
          status: t.status,
          statusLabel: t.statusLabel,
        })),
        situacaoFila,
        situacaoFilaLabel: LABEL_SITUACAO_FILA[situacaoFila],
        podeConfirmarLiberacao,
      };
    }
    return {
      ...item,
      situacaoFila,
      situacaoFilaLabel: LABEL_SITUACAO_FILA[situacaoFila],
      podeConfirmarLiberacao,
    };
  });

  const contagens: Record<SituacaoFilaPendencia, number> = {
    INADIMPLENTES: 0,
    REGULARIZADOS: 0,
    FINALIZADOS: 0,
  };
  for (const item of result) {
    contagens[item.situacaoFila] += 1;
  }

  const filtrados = result.filter((r) => r.situacaoFila === situacaoFiltro);

  return { itens: filtrados, contagens };
}

export type HistoricoPendenciaEventoDto = {
  id: number;
  tipo: string;
  tipoLabel: string;
  detalhe: string | null;
  usuarioLogin: string | null;
  createdAt: string;
  pendenciaId: number;
  numeroPedido: string;
  numeroPedidoExibicao: string;
  acao: string | null;
  acaoLabel: string | null;
  observacao: string | null;
};

export async function listarHistoricoClientePendencias(
  prisma: PrismaClient,
  clienteNomeOuChave: string
): Promise<{
  clienteNome: string;
  clienteChave: string;
  eventos: HistoricoPendenciaEventoDto[];
}> {
  const raw = clienteNomeOuChave.trim();
  if (!raw) {
    return { clienteNome: '', clienteChave: '', eventos: [] };
  }
  const chave = normalizarClienteChave(raw);

  const pendencias = await prisma.crmCreditoPendencia.findMany({
    where: {
      OR: [{ clienteChave: chave }, { clienteNome: raw }],
    },
    select: {
      id: true,
      numeroPedido: true,
      clienteNome: true,
      clienteChave: true,
      acao: true,
      observacao: true,
    },
    orderBy: { numeroPedido: 'asc' },
  });

  if (pendencias.length === 0) {
    return { clienteNome: raw, clienteChave: chave, eventos: [] };
  }

  const clienteNome = pendencias[0].clienteNome;
  const clienteChave = pendencias[0].clienteChave;
  const byId = new Map(pendencias.map((p) => [p.id, p]));

  const eventos = await prisma.crmCreditoPendenciaEvento.findMany({
    where: {
      pendenciaId: { in: pendencias.map((p) => p.id) },
      OR: [
        { tipo: { in: ['EMAIL', 'LIBERACAO', 'FINALIZADO', 'EMAIL_SLA', 'ACAO'] } },
        {
          tipo: 'ACAO',
          NOT: { detalhe: { contains: 'rascunho' } },
        },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const tipoLabel: Record<string, string> = {
    ACAO: 'Ação registrada',
    EMAIL: 'E-mail de ação',
    EMAIL_ALERTA: 'E-mail de alerta',
    EMAIL_REGULARIZADO: 'E-mail de regularização',
    EMAIL_SLA: 'E-mail SLA (prazo sem ação)',
    LIBERACAO: 'Liberação confirmada',
    FINALIZADO: 'Finalizado',
  };

  const eventosDto: HistoricoPendenciaEventoDto[] = [];

  for (const ev of eventos) {
    const pend = byId.get(ev.pendenciaId);
    if (!pend) continue;
    eventosDto.push({
      id: ev.id,
      tipo: ev.tipo,
      tipoLabel: tipoLabel[ev.tipo] ?? ev.tipo,
      detalhe: ev.detalhe,
      usuarioLogin: ev.usuarioLogin,
      createdAt: ev.createdAt.toISOString(),
      pendenciaId: ev.pendenciaId,
      numeroPedido: pend.numeroPedido,
      numeroPedidoExibicao: formatarNumeroPedidoExibicao(pend.numeroPedido),
      acao: pend.acao,
      acaoLabel:
        pend.acao && pend.acao in LABEL_ACAO
          ? LABEL_ACAO[pend.acao as AcaoPendenciaCredito]
          : pend.acao,
      observacao: pend.observacao,
    });
  }

  // E-mails de alerta realmente enviados (log de disparo diário)
  const prefixAlerta = `financeiro_credito_pedido_atraso:${clienteChave}:`;
  const emailsAlerta = await prisma.emailDisparoLog.findMany({
    where: {
      categoria: 'financeiro_credito_pedido_atraso',
      chave: { startsWith: prefixAlerta },
    },
    orderBy: { enviadoEm: 'desc' },
    take: 100,
  });

  for (const log of emailsAlerta) {
    let destinatarios = '';
    try {
      const parsed = JSON.parse(log.destinatarios) as unknown;
      if (Array.isArray(parsed)) destinatarios = parsed.join(', ');
      else destinatarios = String(log.destinatarios);
    } catch {
      destinatarios = log.destinatarios;
    }
    eventosDto.push({
      id: Number.parseInt(String(log.id).replace(/\D/g, '').slice(-9), 10) || log.enviadoEm.getTime(),
      tipo: 'EMAIL_ALERTA',
      tipoLabel: tipoLabel.EMAIL_ALERTA,
      detalhe: `${log.assunto}${destinatarios ? ` · Para: ${destinatarios}` : ''}`,
      usuarioLogin: null,
      createdAt: log.enviadoEm.toISOString(),
      pendenciaId: pendencias[0].id,
      numeroPedido: '',
      numeroPedidoExibicao: '',
      acao: null,
      acaoLabel: null,
      observacao: null,
    });
  }

  // E-mails de regularização enviados (por monitor do cliente)
  const monitores = await prisma.crmCreditoRegularizacaoMonitor.findMany({
    where: { clienteChave },
    select: { id: true },
  });
  if (monitores.length > 0) {
    const chavesReg = monitores.map((m) => `financeiro_credito_cliente_regularizado:monitor:${m.id}`);
    const emailsReg = await prisma.emailDisparoLog.findMany({
      where: {
        categoria: 'financeiro_credito_cliente_regularizado',
        chave: { in: chavesReg },
      },
      orderBy: { enviadoEm: 'desc' },
      take: 50,
    });
    for (const log of emailsReg) {
      let destinatarios = '';
      try {
        const parsed = JSON.parse(log.destinatarios) as unknown;
        if (Array.isArray(parsed)) destinatarios = parsed.join(', ');
        else destinatarios = String(log.destinatarios);
      } catch {
        destinatarios = log.destinatarios;
      }
      eventosDto.push({
        id:
          Number.parseInt(String(log.id).replace(/\D/g, '').slice(-9), 10) ||
          log.enviadoEm.getTime(),
        tipo: 'EMAIL_REGULARIZADO',
        tipoLabel: tipoLabel.EMAIL_REGULARIZADO,
        detalhe: `${log.assunto}${destinatarios ? ` · Para: ${destinatarios}` : ''}`,
        usuarioLogin: null,
        createdAt: log.enviadoEm.toISOString(),
        pendenciaId: pendencias[0].id,
        numeroPedido: '',
        numeroPedidoExibicao: '',
        acao: null,
        acaoLabel: null,
        observacao: null,
      });
    }
  }

  eventosDto.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return { clienteNome, clienteChave, eventos: eventosDto.slice(0, 200) };
}

export async function obterEmailConfigPendencias(prisma: PrismaClient): Promise<{
  usuarioIdsTo: number[];
  usuarioIdsCc: number[];
  destinatariosTo: UsuarioDestinatarioPendencia[];
  destinatariosCc: UsuarioDestinatarioPendencia[];
  prazoHorasSemAcao: number;
  alertaPrazoAtivo: boolean;
  usuarioIdsGestorTo: number[];
  usuarioIdsGestorCc: number[];
  destinatariosGestorTo: UsuarioDestinatarioPendencia[];
  destinatariosGestorCc: UsuarioDestinatarioPendencia[];
  updatedAt: string | null;
  updatedByLogin: string | null;
}> {
  let row = await prisma.crmCreditoPendenciaEmailConfig.findUnique({ where: { id: 1 } });
  if (!row) {
    row = await prisma.crmCreditoPendenciaEmailConfig.create({
      data: { id: 1, destinatariosTo: '[]', destinatariosCc: '[]' },
    });
  }
  const usuarioIdsTo = parseUsuarioIdsJson(row.destinatariosTo);
  const usuarioIdsCc = parseUsuarioIdsJson(row.destinatariosCc).filter(
    (id) => !usuarioIdsTo.includes(id)
  );
  const usuarioIdsGestorTo = parseUsuarioIdsJson(row.destinatariosGestorTo);
  const usuarioIdsGestorCc = parseUsuarioIdsJson(row.destinatariosGestorCc).filter(
    (id) => !usuarioIdsGestorTo.includes(id)
  );
  const [destinatariosTo, destinatariosCc, destinatariosGestorTo, destinatariosGestorCc] =
    await Promise.all([
      carregarUsuariosPorIds(prisma, usuarioIdsTo),
      carregarUsuariosPorIds(prisma, usuarioIdsCc),
      carregarUsuariosPorIds(prisma, usuarioIdsGestorTo),
      carregarUsuariosPorIds(prisma, usuarioIdsGestorCc),
    ]);
  return {
    usuarioIdsTo,
    usuarioIdsCc,
    destinatariosTo,
    destinatariosCc,
    prazoHorasSemAcao: Math.max(1, Number(row.prazoHorasSemAcao) || 48),
    alertaPrazoAtivo: row.alertaPrazoAtivo !== false,
    usuarioIdsGestorTo,
    usuarioIdsGestorCc,
    destinatariosGestorTo,
    destinatariosGestorCc,
    updatedAt: row.updatedAt.toISOString(),
    updatedByLogin: row.updatedByLogin,
  };
}

export async function salvarEmailConfigPendencias(
  prisma: PrismaClient,
  input: {
    usuarioIdsTo?: unknown;
    usuarioIdsCc?: unknown;
    prazoHorasSemAcao?: unknown;
    alertaPrazoAtivo?: unknown;
    usuarioIdsGestorTo?: unknown;
    usuarioIdsGestorCc?: unknown;
  },
  usuarioLogin: string | null
): Promise<{
  usuarioIdsTo: number[];
  usuarioIdsCc: number[];
  destinatariosTo: UsuarioDestinatarioPendencia[];
  destinatariosCc: UsuarioDestinatarioPendencia[];
  prazoHorasSemAcao: number;
  alertaPrazoAtivo: boolean;
  usuarioIdsGestorTo: number[];
  usuarioIdsGestorCc: number[];
  destinatariosGestorTo: UsuarioDestinatarioPendencia[];
  destinatariosGestorCc: UsuarioDestinatarioPendencia[];
}> {
  const to = normalizarListaUsuarioIds(input.usuarioIdsTo);
  const cc = normalizarListaUsuarioIds(input.usuarioIdsCc).filter((id) => !to.includes(id));
  const gestorTo = normalizarListaUsuarioIds(input.usuarioIdsGestorTo);
  const gestorCc = normalizarListaUsuarioIds(input.usuarioIdsGestorCc).filter(
    (id) => !gestorTo.includes(id)
  );

  const prazoRaw = Number(input.prazoHorasSemAcao);
  const prazoHorasSemAcao = Number.isFinite(prazoRaw)
    ? Math.min(720, Math.max(1, Math.round(prazoRaw)))
    : 48;
  const alertaPrazoAtivo =
    input.alertaPrazoAtivo === undefined || input.alertaPrazoAtivo === null
      ? true
      : Boolean(input.alertaPrazoAtivo);

  const existentes = await prisma.usuario.findMany({
    where: { id: { in: [...to, ...cc, ...gestorTo, ...gestorCc] }, ativo: true },
    select: { id: true },
  });
  const idsValidos = new Set(existentes.map((u) => u.id));
  const toOk = to.filter((id) => idsValidos.has(id));
  const ccOk = cc.filter((id) => idsValidos.has(id));
  const gestorToOk = gestorTo.filter((id) => idsValidos.has(id));
  const gestorCcOk = gestorCc.filter((id) => idsValidos.has(id));

  await prisma.crmCreditoPendenciaEmailConfig.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      destinatariosTo: JSON.stringify(toOk),
      destinatariosCc: JSON.stringify(ccOk),
      prazoHorasSemAcao,
      alertaPrazoAtivo,
      destinatariosGestorTo: JSON.stringify(gestorToOk),
      destinatariosGestorCc: JSON.stringify(gestorCcOk),
      updatedByLogin: usuarioLogin,
    },
    update: {
      destinatariosTo: JSON.stringify(toOk),
      destinatariosCc: JSON.stringify(ccOk),
      prazoHorasSemAcao,
      alertaPrazoAtivo,
      destinatariosGestorTo: JSON.stringify(gestorToOk),
      destinatariosGestorCc: JSON.stringify(gestorCcOk),
      updatedByLogin: usuarioLogin,
    },
  });

  const [destinatariosTo, destinatariosCc, destinatariosGestorTo, destinatariosGestorCc] =
    await Promise.all([
      carregarUsuariosPorIds(prisma, toOk),
      carregarUsuariosPorIds(prisma, ccOk),
      carregarUsuariosPorIds(prisma, gestorToOk),
      carregarUsuariosPorIds(prisma, gestorCcOk),
    ]);
  return {
    usuarioIdsTo: toOk,
    usuarioIdsCc: ccOk,
    destinatariosTo,
    destinatariosCc,
    prazoHorasSemAcao,
    alertaPrazoAtivo,
    usuarioIdsGestorTo: gestorToOk,
    usuarioIdsGestorCc: gestorCcOk,
    destinatariosGestorTo,
    destinatariosGestorCc,
  };
}

async function enviarEmailAcaoPendencia(
  prisma: PrismaClient,
  pendencia: PendenciaCreditoDto,
  acao: AcaoPendenciaCredito
): Promise<{ enviadosTo: string[]; enviadosCc: string[]; enviado: boolean }> {
  const config = await obterEmailConfigPendencias(prisma);
  const emailsTo = emailsDeUsuarios(config.destinatariosTo);
  const emailsCc = emailsDeUsuarios(config.destinatariosCc).filter(
    (e) => !emailsTo.includes(e)
  );

  if (emailsTo.length === 0) {
    throw new Error(
      'Configure pelo menos um destinatário (To) com e-mail cadastrado antes de confirmar a ação.'
    );
  }

  const subject = `[Gestão Smart] Ação de crédito — ${LABEL_ACAO[acao]} — ${pendencia.numeroPedidoExibicao}`;
  const qtdTitulos = pendencia.qtdTitulosAtraso ?? 0;
  const html = buildSystemEmailHtml({
    badge: 'Financeiro',
    title: 'Ação de crédito realizada',
    subtitle: pendencia.clienteNome,
    intro:
      'Informamos que uma ação de crédito foi realizada mediante deliberação. Segue o detalhamento abaixo.',
    sections: [
      {
        heading: 'Resumo',
        rows: [
          { label: 'Cliente', value: pendencia.clienteNome },
          { label: 'Pedido', value: pendencia.numeroPedidoExibicao },
          { label: 'Ação', value: LABEL_ACAO[acao] },
          ...(acao === 'REALOCAR_MATERIAL' && pendencia.pedidoDestino
            ? [{ label: 'Pedido destino', value: pendencia.pedidoDestino }]
            : []),
          {
            label: 'Observação',
            value: pendencia.observacao?.trim() || '—',
          },
          {
            label: 'Registrado por',
            value: pendencia.acaoPorNome || pendencia.acaoPorLogin || '—',
          },
          {
            label: 'Status Nomus',
            value: pendencia.statusNomusLabel ?? '—',
          },
          {
            label: 'Pendência financeira',
            value:
              qtdTitulos > 0
                ? `${qtdTitulos} título${qtdTitulos === 1 ? '' : 's'} em atraso`
                : 'Nenhum título em atraso',
          },
        ],
      },
    ],
  });

  if (!envioNotificacoesHabilitado()) {
    logEnvioSuprimido('email', emailsTo.join(', '), subject);
    return { enviadosTo: emailsTo, enviadosCc: emailsCc, enviado: false };
  }

  await sendSystemEmail(prisma, {
    to: emailsTo,
    cc: emailsCc.length > 0 ? emailsCc : undefined,
    subject,
    html,
  });

  return { enviadosTo: emailsTo, enviadosCc: emailsCc, enviado: true };
}

export type SalvarAcaoPendenciaResultado = {
  pendencia: PendenciaCreditoDto;
  instrucaoNomus: string | null;
  email: { to: string[]; cc: string[] } | null;
  emailEnviado: boolean;
  aguardandoConfirmacaoNomus: boolean;
  mensagem: string;
};

export async function salvarAcaoPendenciaCredito(
  prisma: PrismaClient,
  input: {
    id: number;
    acao: AcaoPendenciaCredito;
    observacao?: string | null;
    pedidoDestino?: string | null;
    usuarioLogin: string | null;
    usuarioNome: string | null;
  }
): Promise<SalvarAcaoPendenciaResultado> {
  if (!ACOES_PENDENCIA.includes(input.acao)) {
    throw new Error('Ação inválida.');
  }

  const row = await prisma.crmCreditoPendencia.findUnique({ where: { id: input.id } });
  if (!row) throw new Error('Pendência não encontrada.');
  if (row.encerrada) throw new Error('Esta pendência já está encerrada.');

  // Verificação rápida do status atual no Nomus (usuário pode ter antecipado)
  const statuses = await listarStatusPedidosCreditoPorIds([row.idPedido]);
  const st = statuses[0];
  const statusNomus = st?.statusItem ?? row.statusNomusSnapshot;
  const statusLabel = st?.statusLabel ?? row.statusNomusLabel;
  const numeroPedido = st?.numeroPedido || row.numeroPedido;

  const agora = new Date();
  const pedidoDestino = String(input.pedidoDestino ?? '').trim() || null;
  const observacao = String(input.observacao ?? '').trim() || null;

  const conteudoMudou =
    row.acao !== input.acao ||
    (row.observacao ?? null) !== observacao ||
    (row.pedidoDestino ?? null) !== pedidoDestino;

  // Se mudou a ação/obs após um e-mail já enviado, reinicia o ciclo
  const resetarEmail = Boolean(row.emailAcaoEnviadoEm) && conteudoMudou;

  const updated = await prisma.crmCreditoPendencia.update({
    where: { id: input.id },
    data: {
      acao: input.acao,
      observacao,
      pedidoDestino,
      acaoEm: agora,
      acaoPorLogin: input.usuarioLogin,
      acaoPorNome: input.usuarioNome,
      statusNomusSnapshot: statusNomus,
      statusNomusLabel: statusLabel,
      numeroPedido,
      ...(resetarEmail ? { emailAcaoEnviadoEm: null } : {}),
    },
  });

  // Rascunho não gera evento de histórico — só ações confirmadas no Nomus
  let dto = toDto(updated);
  const instrucao = instrucaoNomusParaAcao(input.acao);
  const confirmado = nomusConfirmadoParaAcao(input.acao, statusNomus);

  if (!confirmado) {
    const [pendencia] = await enriquecerContadoresCliente(prisma, [dto]);
    return {
      pendencia,
      instrucaoNomus: instrucao,
      email: null,
      emailEnviado: false,
      aguardandoConfirmacaoNomus: true,
      mensagem:
        `${instrucao} A ação ficou em rascunho. Quando o status estiver atualizado no Nomus, volte e clique em Salvar ação novamente — só então o e-mail será enviado.`,
    };
  }

  // Ação confirmada no Nomus → registra no histórico
  if (conteudoMudou || !row.acao || resetarEmail || !row.emailAcaoEnviadoEm) {
    await prisma.crmCreditoPendenciaEvento.create({
      data: {
        pendenciaId: updated.id,
        tipo: 'ACAO',
        detalhe: `${LABEL_ACAO[input.acao]}${pedidoDestino ? ` → ${pedidoDestino}` : ''}${observacao ? ` | ${observacao}` : ''}`,
        usuarioLogin: input.usuarioLogin,
      },
    });
  }

  // Já confirmado no Nomus — dispara e-mail se ainda não foi
  if (updated.emailAcaoEnviadoEm && !resetarEmail) {
    if (input.acao === 'CANCELADO' && !updated.encerrada) {
      const encerrada = await prisma.crmCreditoPendencia.update({
        where: { id: updated.id },
        data: { encerrada: true },
      });
      dto = toDto(encerrada);
      await prisma.crmCreditoPendenciaEvento.create({
        data: {
          pendenciaId: updated.id,
          tipo: 'FINALIZADO',
          detalhe: 'Cancelamento confirmado no Nomus — movido para Finalizados',
          usuarioLogin: input.usuarioLogin,
        },
      });
    }
    if (acaoEntraMonitorRegularizacao(input.acao)) {
      try {
        const { iniciarMonitorRegularizacaoAposPausa } = await import(
          './crmCreditoRegularizacaoService.js'
        );
        await iniciarMonitorRegularizacaoAposPausa(prisma, {
          clienteNome: dto.clienteNome,
          clienteChave: dto.clienteChave,
          usuarioLogin: input.usuarioLogin,
          usuarioNome: input.usuarioNome,
        });
      } catch (err) {
        console.warn('Iniciar monitor regularização (parcial):', err);
      }
    }
    const [pendencia] = await enriquecerContadoresCliente(prisma, [dto]);
    return {
      pendencia,
      instrucaoNomus: null,
      email: null,
      emailEnviado: false,
      aguardandoConfirmacaoNomus: false,
      mensagem:
        input.acao === 'CANCELADO'
          ? 'Status Nomus já confirmado. Pedido movido para Finalizados. O e-mail desta ação já havia sido enviado.'
          : 'Status Nomus já confirmado. O e-mail desta ação já havia sido enviado.',
    };
  }

  const email = await enviarEmailAcaoPendencia(prisma, dto, input.acao);

  // PAUSADO / REALOCAR confirmados → monitor de regularização financeira
  if (acaoEntraMonitorRegularizacao(input.acao)) {
    try {
      const { iniciarMonitorRegularizacaoAposPausa } = await import(
        './crmCreditoRegularizacaoService.js'
      );
      await iniciarMonitorRegularizacaoAposPausa(prisma, {
        clienteNome: dto.clienteNome,
        clienteChave: dto.clienteChave,
        usuarioLogin: input.usuarioLogin,
        usuarioNome: input.usuarioNome,
      });
    } catch (err) {
      console.warn('Iniciar monitor regularização (parcial):', err);
    }
  }

  // CANCELADO confirmado → Finalizados
  let encerradaAgora = false;
  if (input.acao === 'CANCELADO') {
    const encerrada = await prisma.crmCreditoPendencia.update({
      where: { id: updated.id },
      data: {
        encerrada: true,
        ...(email.enviado ? { emailAcaoEnviadoEm: agora } : {}),
      },
    });
    dto = toDto(encerrada);
    encerradaAgora = true;
    await prisma.crmCreditoPendenciaEvento.create({
      data: {
        pendenciaId: updated.id,
        tipo: 'FINALIZADO',
        detalhe: 'Cancelamento confirmado no Nomus — movido para Finalizados',
        usuarioLogin: input.usuarioLogin,
      },
    });
  }

  if (email.enviado) {
    if (!encerradaAgora) {
      const comEmail = await prisma.crmCreditoPendencia.update({
        where: { id: updated.id },
        data: { emailAcaoEnviadoEm: agora },
      });
      dto = toDto(comEmail);
    }

    await prisma.crmCreditoPendenciaEvento.create({
      data: {
        pendenciaId: updated.id,
        tipo: 'EMAIL',
        detalhe: `Enviado para To: ${email.enviadosTo.join(', ')}${email.enviadosCc.length ? ` | Cc: ${email.enviadosCc.join(', ')}` : ''}`,
        usuarioLogin: input.usuarioLogin,
      },
    });

    const [pendencia] = await enriquecerContadoresCliente(prisma, [dto]);
    return {
      pendencia,
      instrucaoNomus: null,
      email: { to: email.enviadosTo, cc: email.enviadosCc },
      emailEnviado: true,
      aguardandoConfirmacaoNomus: false,
      mensagem: encerradaAgora
        ? `Cancelamento confirmado. Pedido movido para Finalizados. E-mail enviado para: ${email.enviadosTo.join(', ')}.`
        : `Status Nomus confirmado. E-mail enviado para: ${email.enviadosTo.join(', ')}.`,
    };
  }

  // Dry-run (localhost sem NOTIFICACOES_ENVIO_HABILITADO)
  const [pendencia] = await enriquecerContadoresCliente(prisma, [dto]);
  return {
    pendencia,
    instrucaoNomus: null,
    email: { to: email.enviadosTo, cc: email.enviadosCc },
    emailEnviado: false,
    aguardandoConfirmacaoNomus: false,
    mensagem: encerradaAgora
      ? 'Cancelamento confirmado e movido para Finalizados, mas o envio real de e-mail está desabilitado neste ambiente (NOTIFICACOES_ENVIO_HABILITADO).'
      : 'Status Nomus confirmado, mas o envio real de e-mail está desabilitado neste ambiente (NOTIFICACOES_ENVIO_HABILITADO). Em produção o e-mail seria enviado agora.',
  };
}

/**
 * Confirma liberação no Nomus após regularização financeira → Finalizados.
 */
export async function confirmarLiberacaoPendenciaCredito(
  prisma: PrismaClient,
  input: {
    id: number;
    usuarioLogin: string | null;
    usuarioNome: string | null;
  }
): Promise<{
  pendencia: PendenciaCreditoDto;
  aguardandoConfirmacaoNomus: boolean;
  mensagem: string;
  instrucaoNomus: string | null;
}> {
  const row = await prisma.crmCreditoPendencia.findUnique({ where: { id: input.id } });
  if (!row) throw new Error('Pendência não encontrada.');
  if (row.encerrada) throw new Error('Esta pendência já está encerrada.');

  const { obterMonitorRegularizacaoCliente } = await import(
    './crmCreditoRegularizacaoService.js'
  );
  const monitor = await obterMonitorRegularizacaoCliente(prisma, row.clienteChave);
  if (monitor?.situacao !== 'REGULARIZADO') {
    throw new Error(
      'Só é possível confirmar liberação quando o cliente já está regularizado financeiramente.'
    );
  }

  const statuses = await listarStatusPedidosCreditoPorIds([row.idPedido]);
  const st = statuses[0];
  const statusNomus = st?.statusItem ?? row.statusNomusSnapshot;
  const statusLabel = st?.statusLabel ?? row.statusNomusLabel;
  const numeroPedido = st?.numeroPedido || row.numeroPedido;

  await prisma.crmCreditoPendencia.update({
    where: { id: row.id },
    data: {
      statusNomusSnapshot: statusNomus,
      statusNomusLabel: statusLabel,
      numeroPedido,
    },
  });

  if (!statusNomusLiberado(statusNomus)) {
    const atualizado = await prisma.crmCreditoPendencia.findUniqueOrThrow({
      where: { id: row.id },
    });
    const [pendencia] = await enriquecerContadoresCliente(prisma, [toDto(atualizado)]);
    return {
      pendencia: {
        ...pendencia,
        situacaoFila: 'REGULARIZADOS',
        situacaoFilaLabel: LABEL_SITUACAO_FILA.REGULARIZADOS,
        podeConfirmarLiberacao: true,
        regularizacaoSituacao: monitor.situacao,
        regularizacaoSituacaoLabel: monitor.situacaoLabel,
      },
      aguardandoConfirmacaoNomus: true,
      instrucaoNomus:
        'Vá ao Nomus e libere o pedido (status Liberado). Depois volte e confirme a liberação aqui.',
      mensagem:
        'Status ainda não está Liberado no Nomus. Altere o pedido para Liberado e confirme novamente.',
    };
  }

  const encerrada = await prisma.crmCreditoPendencia.update({
    where: { id: row.id },
    data: {
      encerrada: true,
      statusNomusSnapshot: statusNomus,
      statusNomusLabel: statusLabel,
      numeroPedido,
      acaoEm: new Date(),
      acaoPorLogin: input.usuarioLogin,
      acaoPorNome: input.usuarioNome,
    },
  });

  await prisma.crmCreditoPendenciaEvento.create({
    data: {
      pendenciaId: row.id,
      tipo: 'LIBERACAO',
      detalhe: `Liberação confirmada no Nomus (${statusLabel ?? statusNomus}) — Finalizados`,
      usuarioLogin: input.usuarioLogin,
    },
  });

  const [pendencia] = await enriquecerContadoresCliente(prisma, [toDto(encerrada)]);
  return {
    pendencia: {
      ...pendencia,
      situacaoFila: 'FINALIZADOS',
      situacaoFilaLabel: LABEL_SITUACAO_FILA.FINALIZADOS,
      podeConfirmarLiberacao: false,
      regularizacaoSituacao: monitor.situacao,
      regularizacaoSituacaoLabel: monitor.situacaoLabel,
    },
    aguardandoConfirmacaoNomus: false,
    instrucaoNomus: null,
    mensagem: 'Liberação confirmada. Pedido movido para Finalizados.',
  };
}

export function deepLinkPendenciasCrm(
  clienteNome?: string,
  situacao?: SituacaoFilaPendencia
): string {
  const base = `${resolveAppBaseUrl()}/financeiro/crm?guia=pendencias`;
  const params = new URLSearchParams();
  if (clienteNome?.trim()) params.set('cliente', clienteNome.trim());
  if (situacao) params.set('situacao', situacao);
  const qs = params.toString();
  return qs ? `${base}&${qs}` : base;
}

/** Garante snapshot de label completo ao sync. */
export function ensureStatusLabel(statusItem: number): string {
  return labelStatusItemPedidoCompleto(statusItem);
}
