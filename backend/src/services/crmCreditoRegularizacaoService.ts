/**
 * Monitoramento pós-pausa: vigia títulos em atraso até o cliente regularizar
 * e dispara alerta para a analista de crédito.
 */

import type { PrismaClient } from '@prisma/client';
import { listarContasReceberPorPessoa } from '../data/crmFinanceiro/crmDashboardService.js';
import type { ContaFinanceira } from '../data/crmFinanceiro/types.js';
import { formatarNumeroPedidoExibicao } from '../data/financeiroCreditoPedidoQuery.js';
import { resolveAppBaseUrl } from '../config/appBaseUrl.js';
import { envioNotificacoesHabilitado, logEnvioSuprimido } from '../config/envioNotificacoes.js';
import { buildSystemEmailHtml } from './emailHtmlTemplate.js';
import { sendSystemEmail } from './systemEmail.js';
import {
  deepLinkPendenciasCrm,
  normalizarClienteChave,
} from './crmCreditoPendenciasService.js';

const CATEGORIA = 'financeiro_credito_cliente_regularizado';
const SITUACAO_MONITORANDO = 'MONITORANDO';
const SITUACAO_REGULARIZADO = 'REGULARIZADO';
const STATUS_PENDENTE = 'PENDENTE';
const STATUS_REGULARIZADO = 'REGULARIZADO';

export type TituloRegularizacaoDto = {
  id: number;
  codigoConta: number;
  dataVencimento: string | null;
  valorReferencia: number;
  nfeOrigem: string | null;
  descricao: string | null;
  diasAtrasoSnap: number | null;
  status: string;
  statusLabel: string;
  regularizadoEm: string | null;
};

export type MonitorRegularizacaoDto = {
  id: number;
  clienteNome: string;
  clienteChave: string;
  situacao: string;
  situacaoLabel: string;
  iniciadoEm: string;
  regularizadoEm: string | null;
  emailEnviadoEm: string | null;
  qtdTitulosPendentes: number;
  qtdTitulosRegularizados: number;
  qtdTitulosTotal: number;
  titulos: TituloRegularizacaoDto[];
};

function formatarBRL(val: number): string {
  return val.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatarDataBr(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.includes('-') ? iso.split('T')[0]! : iso;
  return d.toLocaleDateString('pt-BR');
}

function labelStatusTitulo(status: string): string {
  if (status === STATUS_REGULARIZADO) return 'Regularizado';
  return 'Em atraso';
}

function labelSituacaoMonitor(situacao: string): string {
  if (situacao === SITUACAO_REGULARIZADO) return 'Regularizado — análise necessária';
  return 'Em monitoramento';
}

function chaveDisparoMonitor(monitorId: number): string {
  return `${CATEGORIA}:monitor:${monitorId}`;
}

async function alreadySent(prisma: PrismaClient, chave: string): Promise<boolean> {
  const row = await prisma.emailDisparoLog.findUnique({ where: { chave } });
  return Boolean(row);
}

async function logSent(
  prisma: PrismaClient,
  chave: string,
  destinatarios: string[],
  assunto: string
): Promise<void> {
  await prisma.emailDisparoLog.create({
    data: {
      categoria: CATEGORIA,
      chave,
      destinatarios: JSON.stringify(destinatarios),
      assunto,
    },
  });
}

async function registrarEventoCliente(
  prisma: PrismaClient,
  clienteChave: string,
  tipo: string,
  detalhe: string,
  usuarioLogin?: string | null
): Promise<void> {
  const pendencias = await prisma.crmCreditoPendencia.findMany({
    where: { clienteChave, encerrada: false },
    select: { id: true },
    take: 5,
  });
  if (pendencias.length === 0) return;
  await prisma.crmCreditoPendenciaEvento.createMany({
    data: pendencias.map((p) => ({
      pendenciaId: p.id,
      tipo,
      detalhe,
      usuarioLogin: usuarioLogin ?? null,
    })),
  });
}

function toTituloDto(row: {
  id: number;
  codigoConta: number;
  dataVencimento: string | null;
  valorReferencia: number;
  nfeOrigem: string | null;
  descricao: string | null;
  diasAtrasoSnap: number | null;
  status: string;
  regularizadoEm: Date | null;
}): TituloRegularizacaoDto {
  return {
    id: row.id,
    codigoConta: row.codigoConta,
    dataVencimento: row.dataVencimento,
    valorReferencia: row.valorReferencia,
    nfeOrigem: row.nfeOrigem,
    descricao: row.descricao,
    diasAtrasoSnap: row.diasAtrasoSnap,
    status: row.status,
    statusLabel: labelStatusTitulo(row.status),
    regularizadoEm: row.regularizadoEm?.toISOString() ?? null,
  };
}

function toMonitorDto(row: {
  id: number;
  clienteNome: string;
  clienteChave: string;
  situacao: string;
  iniciadoEm: Date;
  regularizadoEm: Date | null;
  emailEnviadoEm: Date | null;
  titulos: Array<{
    id: number;
    codigoConta: number;
    dataVencimento: string | null;
    valorReferencia: number;
    nfeOrigem: string | null;
    descricao: string | null;
    diasAtrasoSnap: number | null;
    status: string;
    regularizadoEm: Date | null;
  }>;
}): MonitorRegularizacaoDto {
  const pendentes = row.titulos.filter((t) => t.status === STATUS_PENDENTE).length;
  const regularizados = row.titulos.filter((t) => t.status === STATUS_REGULARIZADO).length;
  return {
    id: row.id,
    clienteNome: row.clienteNome,
    clienteChave: row.clienteChave,
    situacao: row.situacao,
    situacaoLabel: labelSituacaoMonitor(row.situacao),
    iniciadoEm: row.iniciadoEm.toISOString(),
    regularizadoEm: row.regularizadoEm?.toISOString() ?? null,
    emailEnviadoEm: row.emailEnviadoEm?.toISOString() ?? null,
    qtdTitulosPendentes: pendentes,
    qtdTitulosRegularizados: regularizados,
    qtdTitulosTotal: row.titulos.length,
    titulos: row.titulos
      .map(toTituloDto)
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === STATUS_PENDENTE ? -1 : 1;
        return a.codigoConta - b.codigoConta;
      }),
  };
}

async function upsertTitulosPendentes(
  prisma: PrismaClient,
  monitorId: number,
  contas: ContaFinanceira[]
): Promise<void> {
  for (const c of contas) {
    await prisma.crmCreditoRegularizacaoTitulo.upsert({
      where: {
        monitorId_codigoConta: { monitorId, codigoConta: c.codigo },
      },
      create: {
        monitorId,
        codigoConta: c.codigo,
        dataVencimento: c.dataVencimento,
        valorReferencia: c.valor,
        nfeOrigem: c.nfeOrigem,
        descricao: c.descricao,
        diasAtrasoSnap: c.diasAtraso,
        status: STATUS_PENDENTE,
      },
      update: {
        dataVencimento: c.dataVencimento,
        valorReferencia: c.valor,
        nfeOrigem: c.nfeOrigem,
        descricao: c.descricao,
        diasAtrasoSnap: c.diasAtraso,
        status: STATUS_PENDENTE,
        regularizadoEm: null,
      },
    });
  }
}

/**
 * Inicia (ou reutiliza) o ciclo de monitoramento após PAUSADO confirmado no Nomus.
 */
export async function iniciarMonitorRegularizacaoAposPausa(
  prisma: PrismaClient,
  input: {
    clienteNome: string;
    clienteChave?: string;
    usuarioLogin?: string | null;
    usuarioNome?: string | null;
  }
): Promise<MonitorRegularizacaoDto | null> {
  const clienteNome = input.clienteNome.trim();
  if (!clienteNome) return null;
  const clienteChave = input.clienteChave?.trim() || normalizarClienteChave(clienteNome);
  const agora = new Date();

  const contasAtraso = await listarContasReceberPorPessoa('atraso', clienteNome);

  let monitor = await prisma.crmCreditoRegularizacaoMonitor.findFirst({
    where: { clienteChave, situacao: SITUACAO_MONITORANDO },
    include: { titulos: true },
    orderBy: { iniciadoEm: 'desc' },
  });

  if (!monitor) {
    monitor = await prisma.crmCreditoRegularizacaoMonitor.create({
      data: {
        clienteNome,
        clienteChave,
        situacao: SITUACAO_MONITORANDO,
        iniciadoEm: agora,
        iniciadoPorLogin: input.usuarioLogin ?? null,
        iniciadoPorNome: input.usuarioNome ?? null,
      },
      include: { titulos: true },
    });

    await registrarEventoCliente(
      prisma,
      clienteChave,
      'MONITOR',
      `Monitoramento de regularização iniciado (${contasAtraso.length} título(s) em atraso)`,
      input.usuarioLogin
    );
  }

  if (contasAtraso.length > 0) {
    await upsertTitulosPendentes(prisma, monitor.id, contasAtraso);
  }

  const atualizado = await prisma.crmCreditoRegularizacaoMonitor.findUniqueOrThrow({
    where: { id: monitor.id },
    include: { titulos: true },
  });
  return toMonitorDto(atualizado);
}

/**
 * Reconcilia monitores ativos: marca títulos pagos, detecta regularização completa.
 * Também inicia monitor para pausas já confirmadas que ainda não têm ciclo ativo.
 */
export async function reconciliarMonitoresRegularizacao(
  prisma: PrismaClient
): Promise<{
  monitorados: number;
  regularizados: number;
  titulosAtualizados: number;
}> {
  // Bootstrap: pausas / realocações confirmadas sem monitor ativo
  const pausados = await prisma.crmCreditoPendencia.findMany({
    where: {
      encerrada: false,
      acao: { in: ['PAUSADO', 'REALOCAR_MATERIAL', 'SEGUIR_PRODUCAO'] },
      statusNomusSnapshot: 1,
    },
    select: {
      clienteNome: true,
      clienteChave: true,
      acaoPorLogin: true,
      acaoPorNome: true,
    },
  });
  const chavesVistas = new Set<string>();
  for (const p of pausados) {
    if (!p.clienteChave || chavesVistas.has(p.clienteChave)) continue;
    chavesVistas.add(p.clienteChave);
    const ativo = await prisma.crmCreditoRegularizacaoMonitor.findFirst({
      where: { clienteChave: p.clienteChave, situacao: SITUACAO_MONITORANDO },
      select: { id: true },
    });
    if (ativo) continue;
    await iniciarMonitorRegularizacaoAposPausa(prisma, {
      clienteNome: p.clienteNome,
      clienteChave: p.clienteChave,
      usuarioLogin: p.acaoPorLogin,
      usuarioNome: p.acaoPorNome,
    });
  }

  const monitores = await prisma.crmCreditoRegularizacaoMonitor.findMany({
    where: { situacao: SITUACAO_MONITORANDO },
    include: { titulos: true },
  });

  let regularizados = 0;
  let titulosAtualizados = 0;
  const agora = new Date();
  const CONCORRENCIA = 6;
  let cursor = 0;

  async function processarMonitor(
    monitor: (typeof monitores)[number]
  ): Promise<{ regularizado: boolean; titulosAtualizados: number }> {
    let localTitulos = 0;
    const contasAtraso = await listarContasReceberPorPessoa('atraso', monitor.clienteNome);
    const codigosAtuais = new Set(contasAtraso.map((c) => c.codigo));

    if (contasAtraso.length > 0) {
      const antes = monitor.titulos.length;
      await upsertTitulosPendentes(prisma, monitor.id, contasAtraso);
      const depois = await prisma.crmCreditoRegularizacaoTitulo.count({
        where: { monitorId: monitor.id },
      });
      if (depois > antes) localTitulos += depois - antes;
    }

    const pendentes = monitor.titulos.filter((t) => t.status === STATUS_PENDENTE);
    for (const tit of pendentes) {
      if (codigosAtuais.has(tit.codigoConta)) continue;
      await prisma.crmCreditoRegularizacaoTitulo.update({
        where: { id: tit.id },
        data: { status: STATUS_REGULARIZADO, regularizadoEm: agora },
      });
      localTitulos++;
      await registrarEventoCliente(
        prisma,
        monitor.clienteChave,
        'TITULO_REG',
        `Título ${tit.codigoConta} regularizado`
      );
    }

    if (contasAtraso.length === 0) {
      await prisma.crmCreditoRegularizacaoTitulo.updateMany({
        where: { monitorId: monitor.id, status: STATUS_PENDENTE },
        data: { status: STATUS_REGULARIZADO, regularizadoEm: agora },
      });

      await prisma.crmCreditoRegularizacaoMonitor.update({
        where: { id: monitor.id },
        data: {
          situacao: SITUACAO_REGULARIZADO,
          regularizadoEm: agora,
        },
      });

      await registrarEventoCliente(
        prisma,
        monitor.clienteChave,
        'REGULARIZADO',
        'Cliente regularizou títulos em atraso — aguardando análise de crédito'
      );
      return { regularizado: true, titulosAtualizados: localTitulos };
    }

    return { regularizado: false, titulosAtualizados: localTitulos };
  }

  async function worker() {
    while (cursor < monitores.length) {
      const idx = cursor++;
      const res = await processarMonitor(monitores[idx]);
      if (res.regularizado) regularizados++;
      titulosAtualizados += res.titulosAtualizados;
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCORRENCIA, Math.max(monitores.length, 1)) }, () =>
      worker()
    )
  );

  return {
    monitorados: monitores.length,
    regularizados,
    titulosAtualizados,
  };
}

export async function obterMonitorRegularizacaoCliente(
  prisma: PrismaClient,
  clienteNomeOuChave: string
): Promise<MonitorRegularizacaoDto | null> {
  const raw = clienteNomeOuChave.trim();
  if (!raw) return null;
  const chave = normalizarClienteChave(raw);

  const ativo = await prisma.crmCreditoRegularizacaoMonitor.findFirst({
    where: {
      OR: [{ clienteChave: chave }, { clienteNome: raw }],
      situacao: SITUACAO_MONITORANDO,
    },
    include: { titulos: true },
    orderBy: { iniciadoEm: 'desc' },
  });
  if (ativo) return toMonitorDto(ativo);

  const ultimo = await prisma.crmCreditoRegularizacaoMonitor.findFirst({
    where: {
      OR: [{ clienteChave: chave }, { clienteNome: raw }],
    },
    include: { titulos: true },
    orderBy: { iniciadoEm: 'desc' },
  });
  return ultimo ? toMonitorDto(ultimo) : null;
}

export async function listarResumoMonitoresPorChaves(
  prisma: PrismaClient,
  clienteChaves: string[]
): Promise<Map<string, MonitorRegularizacaoDto>> {
  const map = new Map<string, MonitorRegularizacaoDto>();
  if (clienteChaves.length === 0) return map;

  const unicos = [...new Set(clienteChaves.filter(Boolean))];
  const monitores = await prisma.crmCreditoRegularizacaoMonitor.findMany({
    where: { clienteChave: { in: unicos } },
    include: { titulos: true },
    orderBy: { iniciadoEm: 'desc' },
  });

  for (const m of monitores) {
    if (map.has(m.clienteChave)) continue;
    // Prefer active monitoring
    const ativo = monitores.find(
      (x) => x.clienteChave === m.clienteChave && x.situacao === SITUACAO_MONITORANDO
    );
    map.set(m.clienteChave, toMonitorDto(ativo ?? m));
  }
  return map;
}

function montarTabelaTitulosHtml(
  titulos: Array<{
    codigoConta: number;
    dataVencimento: string | null;
    valorReferencia: number;
    nfeOrigem: string | null;
    status: string;
  }>
): string {
  const rows = titulos
    .map(
      (t) => `
      <tr>
        <td style="padding:8px 10px;border:1px solid #dbe3ef;font-size:13px;">${t.codigoConta}</td>
        <td style="padding:8px 10px;border:1px solid #dbe3ef;font-size:13px;">${formatarDataBr(t.dataVencimento)}</td>
        <td style="padding:8px 10px;border:1px solid #dbe3ef;font-size:13px;text-align:right;">${formatarBRL(t.valorReferencia)}</td>
        <td style="padding:8px 10px;border:1px solid #dbe3ef;font-size:13px;">${t.nfeOrigem ?? '—'}</td>
        <td style="padding:8px 10px;border:1px solid #dbe3ef;font-size:13px;">${labelStatusTitulo(t.status)}</td>
      </tr>`
    )
    .join('');

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
      style="border-collapse:collapse;margin-top:8px;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:8px 10px;border:1px solid #dbe3ef;font-size:12px;text-align:left;">Código</th>
          <th style="padding:8px 10px;border:1px solid #dbe3ef;font-size:12px;text-align:left;">Vencimento</th>
          <th style="padding:8px 10px;border:1px solid #dbe3ef;font-size:12px;text-align:right;">Valor ref.</th>
          <th style="padding:8px 10px;border:1px solid #dbe3ef;font-size:12px;text-align:left;">NF-e</th>
          <th style="padding:8px 10px;border:1px solid #dbe3ef;font-size:12px;text-align:left;">Status</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="5" style="padding:8px 10px;border:1px solid #dbe3ef;">Nenhum título no snapshot</td></tr>`}</tbody>
    </table>`;
}

export async function montarEmailClienteRegularizado(
  prisma: PrismaClient,
  monitorId: number
): Promise<{ subject: string; html: string; clienteNome: string } | null> {
  const monitor = await prisma.crmCreditoRegularizacaoMonitor.findUnique({
    where: { id: monitorId },
    include: { titulos: true },
  });
  if (!monitor) return null;

  const pedidos = await prisma.crmCreditoPendencia.findMany({
    where: {
      clienteChave: monitor.clienteChave,
      encerrada: false,
      acao: { in: ['PAUSADO', 'REALOCAR_MATERIAL', 'SEGUIR_PRODUCAO'] },
    },
    select: { numeroPedido: true, statusNomusLabel: true, acao: true },
    orderBy: { numeroPedido: 'asc' },
  });

  const pedidosLista =
    pedidos
      .map(
        (p) =>
          `${formatarNumeroPedidoExibicao(p.numeroPedido)}${p.statusNomusLabel ? ` (${p.statusNomusLabel})` : ''}${p.acao === 'REALOCAR_MATERIAL' ? ' [realocar]' : ''}${p.acao === 'SEGUIR_PRODUCAO' ? ' [seguir produção]' : ''}`
      )
      .join('; ') || '—';

  const subject = `[Gestão Smart] Cliente regularizado — ${monitor.clienteNome}`;
  const html = buildSystemEmailHtml({
    badge: 'Financeiro',
    title: 'Cliente regularizou pendências financeiras',
    subtitle: monitor.clienteNome,
    intro:
      'O cliente zerou os títulos em atraso após a pausa/realocação do(s) pedido(s). Avalie a situação e, se adequado, libere o pedido no Nomus.',
    sections: [
      {
        heading: 'Resumo',
        rows: [
          { label: 'Cliente', value: monitor.clienteNome },
          { label: 'Pedidos em acompanhamento', value: pedidosLista },
          {
            label: 'Títulos no ciclo',
            value: String(monitor.titulos.length),
          },
          {
            label: 'Regularizado em',
            value: monitor.regularizadoEm
              ? new Date(monitor.regularizadoEm).toLocaleString('pt-BR')
              : '—',
          },
        ],
      },
      {
        heading: 'Títulos acompanhados',
        html: montarTabelaTitulosHtml(monitor.titulos),
      },
    ],
    cta: {
      label: 'Abrir Pendências no CRM',
      href: deepLinkPendenciasCrm(monitor.clienteNome, 'REGULARIZADOS'),
    },
    footerNote:
      'Este alerta é enviado uma vez por ciclo de monitoramento. Após a análise, ajuste o status do pedido no Nomus se a liberação for procedente.',
  });

  return { subject, html, clienteNome: monitor.clienteNome };
}

/**
 * Envia e-mails para monitores REGULARIZADO ainda sem e-mail enviado.
 */
export async function executarAlertasClienteRegularizado(
  prisma: PrismaClient,
  destinatarios: string[],
  options?: { ignorarDedup?: boolean }
): Promise<{ enviados: number; ignorados: number; erros: string[] }> {
  // Sempre reconcilia antes de enviar
  await reconciliarMonitoresRegularizacao(prisma);

  const emails = [
    ...new Set(
      destinatarios.map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@'))
    ),
  ];
  if (emails.length === 0) {
    return { enviados: 0, ignorados: 0, erros: ['Nenhum destinatário com e-mail válido.'] };
  }

  const pendentes = await prisma.crmCreditoRegularizacaoMonitor.findMany({
    where: {
      situacao: SITUACAO_REGULARIZADO,
      emailEnviadoEm: null,
    },
    orderBy: { regularizadoEm: 'asc' },
  });

  let enviados = 0;
  let ignorados = 0;
  const erros: string[] = [];
  const agora = new Date();

  for (const monitor of pendentes) {
    const chave = chaveDisparoMonitor(monitor.id);
    if (!options?.ignorarDedup && (await alreadySent(prisma, chave))) {
      // Já logado — marca emailEnviadoEm para não reprocessar
      await prisma.crmCreditoRegularizacaoMonitor.update({
        where: { id: monitor.id },
        data: { emailEnviadoEm: agora },
      });
      ignorados++;
      continue;
    }

    const montado = await montarEmailClienteRegularizado(prisma, monitor.id);
    if (!montado) {
      erros.push(`Monitor #${monitor.id}: não encontrado ao montar e-mail`);
      continue;
    }

    try {
      if (!envioNotificacoesHabilitado()) {
        logEnvioSuprimido('email', emails.join(', '), montado.subject);
        // Em dry-run não marca como enviado, para poder reenviar em produção
        ignorados++;
        continue;
      }

      await sendSystemEmail(prisma, {
        to: emails,
        subject: montado.subject,
        html: montado.html,
      });

      if (!options?.ignorarDedup) {
        await logSent(prisma, chave, emails, montado.subject);
      }

      await prisma.crmCreditoRegularizacaoMonitor.update({
        where: { id: monitor.id },
        data: { emailEnviadoEm: agora },
      });

      await registrarEventoCliente(
        prisma,
        monitor.clienteChave,
        'EMAIL',
        `Alerta de regularização enviado para: ${emails.join(', ')}`
      );

      enviados++;
    } catch (err) {
      erros.push(
        `${monitor.clienteNome}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return { enviados, ignorados, erros };
}

export async function previewAlertaClienteRegularizado(prisma: PrismaClient): Promise<{
  quantidade: number;
  previews: Array<{ clienteNome: string; subject: string; html: string }>;
}> {
  await reconciliarMonitoresRegularizacao(prisma);

  const monitores = await prisma.crmCreditoRegularizacaoMonitor.findMany({
    where: {
      OR: [
        { situacao: SITUACAO_REGULARIZADO, emailEnviadoEm: null },
        { situacao: SITUACAO_REGULARIZADO },
      ],
    },
    orderBy: { regularizadoEm: 'desc' },
    take: 10,
  });

  // Prefer unsent; fallback to latest regularized for preview
  const semEmail = monitores.filter((m) => !m.emailEnviadoEm);
  const lista = (semEmail.length > 0 ? semEmail : monitores).slice(0, 5);

  const previews: Array<{ clienteNome: string; subject: string; html: string }> = [];
  for (const m of lista) {
    const montado = await montarEmailClienteRegularizado(prisma, m.id);
    if (montado) {
      previews.push({
        clienteNome: montado.clienteNome,
        subject: montado.subject,
        html: montado.html,
      });
    }
  }

  return { quantidade: lista.length, previews };
}
