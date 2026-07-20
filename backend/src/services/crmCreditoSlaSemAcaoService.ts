/**
 * Alerta de SLA: pendência de crédito sem ação após X horas → e-mail ao gestor.
 */
import type { PrismaClient } from '@prisma/client';
import { formatarNumeroPedidoExibicao } from '../data/financeiroCreditoPedidoQuery.js';
import {
  calcularSlaPendencia,
  deepLinkPendenciasCrm,
  obterEmailConfigPendencias,
} from './crmCreditoPendenciasService.js';
import { buildSystemEmailHtml } from './emailHtmlTemplate.js';
import { sendSystemEmail } from './systemEmail.js';
import { envioNotificacoesHabilitado, logEnvioSuprimido } from '../config/envioNotificacoes.js';

function formatarBRL(val: number): string {
  return val.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function emailsDeUsuarios(
  usuarios: Array<{ email: string | null }>
): string[] {
  return [
    ...new Set(
      usuarios
        .map((u) => (u.email ?? '').trim().toLowerCase())
        .filter((e) => e.includes('@'))
    ),
  ];
}

export type ResultadoSlaSemAcao = {
  ativos: number;
  elegiveis: number;
  enviados: number;
  falhas: number;
};

export async function processarAlertasSlaSemAcao(
  prisma: PrismaClient
): Promise<ResultadoSlaSemAcao> {
  const config = await obterEmailConfigPendencias(prisma);
  if (!config.alertaPrazoAtivo) {
    return { ativos: 0, elegiveis: 0, enviados: 0, falhas: 0 };
  }

  const gestorTo =
    config.destinatariosGestorTo.length > 0
      ? config.destinatariosGestorTo
      : config.destinatariosTo;
  const gestorCcBase =
    config.destinatariosGestorTo.length > 0 || config.destinatariosGestorCc.length > 0
      ? config.destinatariosGestorCc
      : config.destinatariosCc;

  const emailsTo = emailsDeUsuarios(gestorTo);
  const emailsCc = emailsDeUsuarios(gestorCcBase).filter((e) => !emailsTo.includes(e));

  if (emailsTo.length === 0) {
    console.warn(
      '[crmCreditoSla] Sem destinatário gestor com e-mail — configure na aba Pendências.'
    );
    return { ativos: 0, elegiveis: 0, enviados: 0, falhas: 0 };
  }

  const prazoHoras = config.prazoHorasSemAcao;
  const limite = new Date(Date.now() - prazoHoras * 3_600_000);

  const candidatas = await prisma.crmCreditoPendencia.findMany({
    where: {
      encerrada: false,
      acao: null,
      emailSlaEnviadoEm: null,
      alertaEm: { lte: limite },
    },
    orderBy: [{ alertaEm: 'asc' }, { clienteNome: 'asc' }],
  });

  const elegiveis = candidatas.filter((row) => {
    const sla = calcularSlaPendencia({
      alertaEm: row.alertaEm,
      acao: row.acao,
      encerrada: row.encerrada,
      prazoHorasSemAcao: prazoHoras,
    });
    return sla.slaEstourado;
  });

  if (elegiveis.length === 0) {
    return { ativos: 1, elegiveis: 0, enviados: 0, falhas: 0 };
  }

  const porCliente = new Map<string, typeof elegiveis>();
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
        const atraso =
          p.totalAtraso != null
            ? formatarBRL(p.totalAtraso)
            : '—';
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
              'Acesse CRM → Pendências de crédito, escolha a ação (cancelar, pausar, realocar ou seguir produção) e confirme.',
          },
        ],
      },
    ],
  });

  if (!envioNotificacoesHabilitado()) {
    logEnvioSuprimido('email', emailsTo.join(', '), subject);
    return { ativos: 1, elegiveis: elegiveis.length, enviados: 0, falhas: 0 };
  }

  try {
    await sendSystemEmail(prisma, {
      to: emailsTo,
      cc: emailsCc.length > 0 ? emailsCc : undefined,
      subject,
      html,
    });
  } catch (err) {
    console.error('[crmCreditoSla] Falha ao enviar e-mail:', err);
    return { ativos: 1, elegiveis: elegiveis.length, enviados: 0, falhas: 1 };
  }

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
      detalhe: `E-mail SLA (+${prazoHoras}h sem ação) → ${emailsTo.join(', ')}`,
      usuarioLogin: 'sistema',
    })),
  });

  return {
    ativos: 1,
    elegiveis: elegiveis.length,
    enviados: elegiveis.length,
    falhas: 0,
  };
}
