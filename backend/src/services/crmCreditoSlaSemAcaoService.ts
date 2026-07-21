/**
 * Alerta de SLA: pendência de crédito sem ação após X horas → e-mail ao gestor.
 * Disparado via Integração → E-mail (builder financeiro_credito_sla_sem_acao).
 */
import type { PrismaClient } from '@prisma/client';
import { formatarNumeroPedidoExibicao } from '../data/financeiroCreditoPedidoQuery.js';
import { envioNotificacoesHabilitado, logEnvioSuprimido } from '../config/envioNotificacoes.js';
import {
  calcularSlaPendencia,
  deepLinkPendenciasCrm,
  obterEmailConfigPendencias,
} from './crmCreditoPendenciasService.js';
import { buildSystemEmailHtml } from './emailHtmlTemplate.js';
import { sendSystemEmail } from './systemEmail.js';

function formatarBRL(val: number): string {
  return val.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type PendenciaSla = Awaited<
  ReturnType<PrismaClient['crmCreditoPendencia']['findMany']>
>[number];

function montarEmailSla(input: {
  elegiveis: PendenciaSla[];
  prazoHoras: number;
}): { subject: string; html: string } {
  const { elegiveis, prazoHoras } = input;
  const porCliente = new Map<string, PendenciaSla[]>();
  for (const row of elegiveis) {
    const key = row.clienteChave || row.clienteNome;
    const lista = porCliente.get(key) ?? [];
    lista.push(row);
    porCliente.set(key, lista);
  }

  const linhasHtml: string[] = [];
  for (const [, pedidos] of porCliente) {
    const cliente = pedidos[0]!.clienteNome;
    const link = deepLinkPendenciasCrm(cliente, 'INADIMPLENTES');
    const itens = pedidos
      .map((p) => {
        const horas = calcularSlaPendencia({
          alertaEm: p.alertaEm,
          acao: null,
          encerrada: false,
          prazoHorasSemAcao: prazoHoras,
        }).horasDecorridas;
        const atraso = p.totalAtraso != null ? formatarBRL(p.totalAtraso) : '—';
        return `<li><strong>${formatarNumeroPedidoExibicao(p.numeroPedido)}</strong> — ${horas}h sem ação · atraso ${atraso} · Nomus: ${p.statusNomusLabel ?? '—'}</li>`;
      })
      .join('');
    linhasHtml.push(
      `<p style="margin:12px 0 4px"><strong>${cliente}</strong> · <a href="${link}">Abrir no CRM</a></p><ul style="margin:0 0 8px 18px;padding:0">${itens}</ul>`
    );
  }

  const subject = `[Gestão Smart] Pendências de crédito sem ação há +${prazoHoras}h (${elegiveis.length} pedido${elegiveis.length === 1 ? '' : 's'})`;
  const html = buildSystemEmailHtml({
    badge: 'Financeiro',
    title: 'Prazo de ação estourado',
    subtitle: `${elegiveis.length} pedido(s) aguardando ação há mais de ${prazoHoras} horas`,
    intro:
      'O alerta de crédito foi gerado e nenhuma ação foi registrada no prazo configurado. Segue a lista para o gestor tomar providências.',
    sections: [
      {
        heading: 'Pedidos sem ação',
        html: linhasHtml.join(''),
      },
      {
        heading: 'Configuração',
        rows: [
          { label: 'Prazo', value: `${prazoHoras} horas` },
          {
            label: 'Ação sugerida',
            value:
              'Acesse CRM → Pendências de crédito com PD em carteira, escolha a ação e confirme.',
          },
        ],
      },
    ],
  });

  return { subject, html };
}

async function listarPendenciasSlaElegiveis(
  prisma: PrismaClient,
  prazoHoras: number
): Promise<PendenciaSla[]> {
  const limite = new Date(Date.now() - Math.max(1, prazoHoras) * 3_600_000);
  const candidatas = await prisma.crmCreditoPendencia.findMany({
    where: {
      encerrada: false,
      acao: null,
      emailSlaEnviadoEm: null,
      alertaEm: { lte: limite },
    },
    orderBy: [{ alertaEm: 'asc' }, { clienteNome: 'asc' }],
  });

  return candidatas.filter((row) => {
    const sla = calcularSlaPendencia({
      alertaEm: row.alertaEm,
      acao: row.acao,
      encerrada: row.encerrada,
      prazoHorasSemAcao: prazoHoras,
    });
    return sla.slaEstourado;
  });
}

/**
 * Builder usado pelo cron de Integração → E-mail.
 * Destinatários e horários/dias vêm do tipo configurado lá.
 * O prazo em horas continua na aba CRM (config de e-mail da pendência).
 */
export async function executarAlertasSlaSemAcao(
  prisma: PrismaClient,
  destinatarios: string[],
  options?: { ignorarDedup?: boolean }
): Promise<{ enviados: number; ignorados: number; erros: string[] }> {
  const emails = [
    ...new Set(
      destinatarios.map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@'))
    ),
  ];
  if (emails.length === 0) {
    return { enviados: 0, ignorados: 0, erros: ['Nenhum destinatário com e-mail válido.'] };
  }

  const config = await obterEmailConfigPendencias(prisma);
  const prazoHoras = config.prazoHorasSemAcao;
  const elegiveis = await listarPendenciasSlaElegiveis(prisma, prazoHoras);

  if (elegiveis.length === 0) {
    return { enviados: 0, ignorados: 0, erros: [] };
  }

  const { subject, html } = montarEmailSla({ elegiveis, prazoHoras });

  if (!envioNotificacoesHabilitado()) {
    logEnvioSuprimido('email', emails.join(', '), subject);
    return { enviados: 0, ignorados: elegiveis.length, erros: [] };
  }

  try {
    await sendSystemEmail(prisma, { to: emails, subject, html });
  } catch (err) {
    return {
      enviados: 0,
      ignorados: 0,
      erros: [err instanceof Error ? err.message : String(err)],
    };
  }

  if (!options?.ignorarDedup) {
    const agora = new Date();
    await prisma.$transaction(
      elegiveis.map((row) =>
        prisma.crmCreditoPendencia.update({
          where: { id: row.id },
          data: { emailSlaEnviadoEm: agora },
        })
      )
    );
    await prisma.crmCreditoPendenciaEvento.createMany({
      data: elegiveis.map((row) => ({
        pendenciaId: row.id,
        tipo: 'EMAIL_SLA',
        detalhe: `E-mail SLA (+${prazoHoras}h sem ação) → ${emails.join(', ')}`,
        usuarioLogin: 'sistema',
      })),
    });
  }

  return { enviados: 1, ignorados: 0, erros: [] };
}

export async function previewAlertaSlaSemAcao(prisma: PrismaClient): Promise<{
  subject: string;
  html: string;
  resumo: string;
  quantidade: number;
}> {
  const config = await obterEmailConfigPendencias(prisma);
  const prazoHoras = config.prazoHorasSemAcao;
  const elegiveis = await listarPendenciasSlaElegiveis(prisma, prazoHoras);

  if (elegiveis.length === 0) {
    return {
      subject: '[Preview] Nenhum pedido com prazo de ação estourado',
      html: `<p>Não há pedidos sem ação há mais de ${prazoHoras}h no momento.</p>`,
      resumo: `Nenhum pedido elegível (prazo ${prazoHoras}h).`,
      quantidade: 0,
    };
  }

  const { subject, html } = montarEmailSla({ elegiveis, prazoHoras });
  return {
    subject,
    html,
    resumo: `${elegiveis.length} pedido(s) sem ação há +${prazoHoras}h.`,
    quantidade: elegiveis.length,
  };
}
