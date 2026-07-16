/**
 * Alerta por e-mail: cliente com pedido aberto e contas a receber em atraso.
 */

import type { PrismaClient } from '@prisma/client';
import { listarContasReceberPorPessoa } from '../data/crmFinanceiro/crmDashboardService.js';
import {
  agruparPedidosAbertosPorCliente,
  formatarNumeroPedidoExibicao,
  listarPedidosAbertosCredito,
  type PedidoAbertoPorCliente,
} from '../data/financeiroCreditoPedidoQuery.js';
import type { ContaFinanceira } from '../data/crmFinanceiro/types.js';
import { resolveAppBaseUrl } from '../config/appBaseUrl.js';
import { buildSystemEmailHtml } from './emailHtmlTemplate.js';
import { sendSystemEmail } from './systemEmail.js';

const CATEGORIA = 'financeiro_credito_pedido_atraso';

/**
 * Carência: o cliente só entra no alerta quando o título mais antigo em atraso
 * atinge este número de dias (ex.: venceu hoje → alerta só daqui a 3 dias).
 */
const CARENCIA_DIAS_ATRASO = 3;

export type AlertaCreditoCliente = {
  clienteNome: string;
  pedidos: PedidoAbertoPorCliente['pedidos'];
  contasAtraso: ContaFinanceira[];
  totalAtraso: number;
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
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

function normalizarClienteChave(nome: string): string {
  return nome.trim().toLowerCase().replace(/\s+/g, ' ');
}

function chaveDisparoDiario(clienteNome: string, dataRef: string): string {
  return `${CATEGORIA}:${normalizarClienteChave(clienteNome)}:${dataRef}`;
}

function dataRefHoje(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

export async function listarAlertasCreditoPendentes(): Promise<AlertaCreditoCliente[]> {
  const pedidos = await listarPedidosAbertosCredito();
  const porCliente = agruparPedidosAbertosPorCliente(pedidos);
  const alertas: AlertaCreditoCliente[] = [];

  for (const grupo of porCliente) {
    const contasAtraso = await listarContasReceberPorPessoa('atraso', grupo.clienteNome);
    if (contasAtraso.length === 0) continue;
    const maiorAtrasoDias = Math.max(...contasAtraso.map((c) => c.diasAtraso));
    if (maiorAtrasoDias < CARENCIA_DIAS_ATRASO) continue;
    const totalAtraso = contasAtraso.reduce((acc, c) => acc + c.valor, 0);
    alertas.push({
      clienteNome: grupo.clienteNome,
      pedidos: grupo.pedidos,
      contasAtraso,
      totalAtraso,
    });
  }

  return alertas;
}

function montarTabelaContasHtml(contas: ContaFinanceira[]): string {
  const rows = contas
    .map(
      (c) => `
      <tr>
        <td style="padding:8px 10px;border:1px solid #dbe3ef;font-size:13px;">${c.codigo}</td>
        <td style="padding:8px 10px;border:1px solid #dbe3ef;font-size:13px;">${formatarDataBr(c.dataVencimento)}</td>
        <td style="padding:8px 10px;border:1px solid #dbe3ef;font-size:13px;text-align:right;">${formatarBRL(c.valor)}</td>
        <td style="padding:8px 10px;border:1px solid #dbe3ef;font-size:13px;">${c.diasAtraso > 0 ? `${c.diasAtraso} dia(s)` : '—'}</td>
        <td style="padding:8px 10px;border:1px solid #dbe3ef;font-size:13px;">${c.nfeOrigem ?? '—'}</td>
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
          <th style="padding:8px 10px;border:1px solid #dbe3ef;font-size:12px;text-align:right;">Valor</th>
          <th style="padding:8px 10px;border:1px solid #dbe3ef;font-size:12px;text-align:left;">Atraso</th>
          <th style="padding:8px 10px;border:1px solid #dbe3ef;font-size:12px;text-align:left;">NF-e origem</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

export function montarEmailAlertaCredito(alerta: AlertaCreditoCliente): {
  subject: string;
  html: string;
} {
  const pds = [
    ...new Set(alerta.pedidos.map((p) => formatarNumeroPedidoExibicao(p.numeroPedido))),
  ].join(', ');
  const subject = `[Gestão Smart] Crédito em risco — ${alerta.clienteNome}`;

  const pedidosLista = alerta.pedidos
    .map((p) => `${formatarNumeroPedidoExibicao(p.numeroPedido)} (${p.statusLabel})`)
    .join('; ');

  const html = buildSystemEmailHtml({
    badge: 'Financeiro',
    title: 'Pendência em atraso com pedido em aberto',
    subtitle: alerta.clienteNome,
    intro:
      'Um cliente com pedido de venda em aberto possui contas a receber em atraso. Avalie se a produção/atendimento deve ser pausada.',
    sections: [
      {
        heading: 'Resumo',
        rows: [
          { label: 'Cliente', value: alerta.clienteNome },
          { label: 'Total em atraso', value: formatarBRL(alerta.totalAtraso) },
          { label: 'Pedidos em aberto', value: pedidosLista || pds },
          { label: 'Títulos em atraso', value: String(alerta.contasAtraso.length) },
        ],
      },
      {
        heading: 'Contas a receber em atraso',
        html: montarTabelaContasHtml(alerta.contasAtraso),
      },
    ],
    cta: {
      label: 'Abrir CRM Financeiro',
      href: `${resolveAppBaseUrl()}/financeiro/crm`,
    },
    footerNote:
      `Este alerta é enviado no máximo uma vez por cliente por dia enquanto a condição persistir. O cliente entra no alerta após ${CARENCIA_DIAS_ATRASO} dias de atraso do título mais antigo.`,
  });

  return { subject, html };
}

export async function executarAlertasCreditoPedidoAtraso(
  prisma: PrismaClient,
  destinatarios: string[],
  options?: { ignorarDedup?: boolean; dataRef?: string }
): Promise<{ enviados: number; ignorados: number; erros: string[] }> {
  const emails = [...new Set(destinatarios.map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@')))];
  if (emails.length === 0) {
    return { enviados: 0, ignorados: 0, erros: ['Nenhum destinatário com e-mail válido.'] };
  }

  const alertas = await listarAlertasCreditoPendentes();
  const dataRef = options?.dataRef ?? dataRefHoje();
  let enviados = 0;
  let ignorados = 0;
  const erros: string[] = [];

  for (const alerta of alertas) {
    const chave = chaveDisparoDiario(alerta.clienteNome, dataRef);
    if (!options?.ignorarDedup && (await alreadySent(prisma, chave))) {
      ignorados++;
      continue;
    }

    const { subject, html } = montarEmailAlertaCredito(alerta);
    try {
      await sendSystemEmail(prisma, { to: emails, subject, html });
      if (!options?.ignorarDedup) {
        await logSent(prisma, chave, emails, subject);
      }
      enviados++;
    } catch (err) {
      erros.push(
        `${alerta.clienteNome}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return { enviados, ignorados, erros };
}

export async function previewAlertaCreditoPedidoAtraso(): Promise<{
  alertas: AlertaCreditoCliente[];
  previews: Array<{ clienteNome: string; subject: string; html: string }>;
}> {
  const alertas = await listarAlertasCreditoPendentes();
  const previews = alertas.map((a) => {
    const { subject, html } = montarEmailAlertaCredito(a);
    return { clienteNome: a.clienteNome, subject, html };
  });
  return { alertas, previews };
}
