/**
 * 3º alerta de crédito: e-mail compilado do dia (inadimplentes, regularizados e finalizados),
 * com códigos dos PDs e ações confirmadas no Nomus.
 */

import type { PrismaClient } from '@prisma/client';
import { formatarNumeroPedidoExibicao } from '../data/financeiroCreditoPedidoQuery.js';
import { envioNotificacoesHabilitado, logEnvioSuprimido } from '../config/envioNotificacoes.js';
import { buildSystemEmailHtml } from './emailHtmlTemplate.js';
import { sendSystemEmail } from './systemEmail.js';
import {
  confirmacaoNomusOk,
  deepLinkPendenciasCrm,
  LABEL_ACAO,
  type AcaoPendenciaCredito,
} from './crmCreditoPendenciasService.js';
import { listarResumoMonitoresPorChaves } from './crmCreditoRegularizacaoService.js';

const CATEGORIA = 'financeiro_credito_resumo_diario';

type PendenciaRow = {
  id: number;
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
  acaoEm: Date | null;
  acaoPorNome: string | null;
  acaoPorLogin: string | null;
  emailAcaoEnviadoEm: Date | null;
  encerrada: boolean;
  updatedAt: Date;
};

type LinhaClienteResumo = {
  clienteNome: string;
  clienteChave: string;
  pedidos: string[];
  totalAtraso: number | null;
  maiorAtrasoDias: number | null;
  qtdTitulosAtraso: number | null;
  acoesConfirmadas: string[];
  aguardandoAcao: boolean;
  situacaoLabel: string;
};

type AcaoConfirmadaDia = {
  clienteNome: string;
  numeroPedidoExibicao: string;
  acaoLabel: string;
  pedidoDestino: string | null;
  por: string;
  quando: string;
};

export type ResumoDiarioCreditoPayload = {
  dataRef: string;
  inadimplentes: LinhaClienteResumo[];
  regularizados: LinhaClienteResumo[];
  finalizadosHoje: LinhaClienteResumo[];
  acoesConfirmadasHoje: AcaoConfirmadaDia[];
};

function formatarBRL(val: number | null | undefined): string {
  if (val == null) return '—';
  return val.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function dataRefHoje(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function inicioDoDiaLocal(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function chaveDisparoDiario(dataRef: string): string {
  return `${CATEGORIA}:${dataRef}`;
}

function acaoConfirmadaNomus(row: PendenciaRow): boolean {
  if (!row.acao) return false;
  if (row.emailAcaoEnviadoEm) return true;
  return confirmacaoNomusOk(row.acao, row.statusNomusSnapshot) === true;
}

function labelAcao(acao: string | null): string {
  if (!acao) return 'Aguardando ação';
  if (acao in LABEL_ACAO) return LABEL_ACAO[acao as AcaoPendenciaCredito];
  return acao;
}

function ehMesmoDia(dt: Date | null | undefined, inicioDia: Date): boolean {
  if (!dt) return false;
  return dt.getTime() >= inicioDia.getTime();
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

function agruparPorCliente(
  rows: PendenciaRow[],
  situacaoLabel: string
): LinhaClienteResumo[] {
  const map = new Map<string, LinhaClienteResumo>();
  for (const row of rows) {
    const key = row.clienteChave || row.clienteNome;
    let g = map.get(key);
    if (!g) {
      g = {
        clienteNome: row.clienteNome,
        clienteChave: row.clienteChave,
        pedidos: [],
        totalAtraso: row.totalAtraso,
        maiorAtrasoDias: row.maiorAtrasoDias,
        qtdTitulosAtraso: row.qtdTitulosAtraso,
        acoesConfirmadas: [],
        aguardandoAcao: true,
        situacaoLabel,
      };
      map.set(key, g);
    }
    const pd = formatarNumeroPedidoExibicao(row.numeroPedido);
    if (!g.pedidos.includes(pd)) g.pedidos.push(pd);

    if (acaoConfirmadaNomus(row)) {
      g.aguardandoAcao = false;
      const trecho = `${pd}: ${labelAcao(row.acao)}${
        row.pedidoDestino ? ` → ${row.pedidoDestino}` : ''
      }`;
      if (!g.acoesConfirmadas.includes(trecho)) g.acoesConfirmadas.push(trecho);
    } else if (row.acao) {
      g.aguardandoAcao = false;
      const trecho = `${pd}: ${labelAcao(row.acao)} (rascunho — aguarda Nomus)`;
      if (!g.acoesConfirmadas.includes(trecho)) g.acoesConfirmadas.push(trecho);
    }

    if (row.totalAtraso != null && (g.totalAtraso == null || row.totalAtraso > g.totalAtraso)) {
      g.totalAtraso = row.totalAtraso;
    }
    if (
      row.maiorAtrasoDias != null &&
      (g.maiorAtrasoDias == null || row.maiorAtrasoDias > g.maiorAtrasoDias)
    ) {
      g.maiorAtrasoDias = row.maiorAtrasoDias;
    }
    if (row.qtdTitulosAtraso != null) {
      g.qtdTitulosAtraso = Math.max(g.qtdTitulosAtraso ?? 0, row.qtdTitulosAtraso);
    }
  }

  return [...map.values()].sort((a, b) =>
    a.clienteNome.localeCompare(b.clienteNome, 'pt-BR')
  );
}

export async function montarResumoDiarioCredito(
  prisma: PrismaClient,
  options?: { dataRef?: Date }
): Promise<ResumoDiarioCreditoPayload> {
  const agora = options?.dataRef ?? new Date();
  const dataRef = dataRefHoje(agora);
  const inicioDia = inicioDoDiaLocal(agora);

  try {
    const { reconciliarMonitoresRegularizacao } = await import(
      './crmCreditoRegularizacaoService.js'
    );
    await reconciliarMonitoresRegularizacao(prisma);
  } catch (err) {
    console.warn('Resumo diário: reconciliar monitores (parcial):', err);
  }

  const rows = (await prisma.crmCreditoPendencia.findMany({
    orderBy: [{ clienteNome: 'asc' }, { numeroPedido: 'asc' }],
  })) as PendenciaRow[];

  const chaves = [...new Set(rows.map((r) => r.clienteChave).filter(Boolean))];
  const monitores = await listarResumoMonitoresPorChaves(prisma, chaves);

  const inad: PendenciaRow[] = [];
  const reg: PendenciaRow[] = [];
  const finHoje: PendenciaRow[] = [];

  for (const row of rows) {
    if (row.encerrada) {
      const finalizouHoje =
        ehMesmoDia(row.acaoEm, inicioDia) || ehMesmoDia(row.updatedAt, inicioDia);
      if (finalizouHoje) finHoje.push(row);
      continue;
    }
    const m = monitores.get(row.clienteChave);
    if (m?.situacao === 'REGULARIZADO') reg.push(row);
    else inad.push(row);
  }

  const acoesConfirmadasHoje: AcaoConfirmadaDia[] = [];
  for (const row of rows) {
    if (!acaoConfirmadaNomus(row)) continue;
    const quando =
      row.emailAcaoEnviadoEm && ehMesmoDia(row.emailAcaoEnviadoEm, inicioDia)
        ? row.emailAcaoEnviadoEm
        : row.acaoEm && ehMesmoDia(row.acaoEm, inicioDia)
          ? row.acaoEm
          : null;
    if (!quando) continue;
    acoesConfirmadasHoje.push({
      clienteNome: row.clienteNome,
      numeroPedidoExibicao: formatarNumeroPedidoExibicao(row.numeroPedido),
      acaoLabel: labelAcao(row.acao),
      pedidoDestino: row.pedidoDestino,
      por: row.acaoPorNome || row.acaoPorLogin || '—',
      quando: quando.toLocaleString('pt-BR'),
    });
  }

  return {
    dataRef,
    inadimplentes: agruparPorCliente(inad, 'Inadimplente'),
    regularizados: agruparPorCliente(reg, 'Regularizado — aguardando liberação'),
    finalizadosHoje: agruparPorCliente(finHoje, 'Finalizado'),
    acoesConfirmadasHoje,
  };
}

function montarTabelaClientesHtml(linhas: LinhaClienteResumo[], comAtraso: boolean): string {
  if (linhas.length === 0) {
    return `<p style="margin:8px 0;color:#64748b;font-size:13px;">Nenhum registro nesta seção.</p>`;
  }
  const headAtraso = comAtraso
    ? `<th style="padding:8px 10px;border:1px solid #dbe3ef;font-size:12px;text-align:right;">Atraso</th>
       <th style="padding:8px 10px;border:1px solid #dbe3ef;font-size:12px;text-align:left;">Títulos</th>`
    : '';
  const rows = linhas
    .map((l) => {
      const acaoTxt =
        l.acoesConfirmadas.length > 0
          ? l.acoesConfirmadas.map(escapeHtml).join('<br/>')
          : l.aguardandoAcao
            ? 'Aguardando ação'
            : '—';
      const atrasoCells = comAtraso
        ? `<td style="padding:8px 10px;border:1px solid #dbe3ef;font-size:13px;text-align:right;">${formatarBRL(l.totalAtraso)}${
            l.maiorAtrasoDias != null ? `<br/><span style="color:#64748b;font-size:12px;">${l.maiorAtrasoDias}d</span>` : ''
          }</td>
           <td style="padding:8px 10px;border:1px solid #dbe3ef;font-size:13px;">${l.qtdTitulosAtraso ?? '—'}</td>`
        : '';
      return `
      <tr>
        <td style="padding:8px 10px;border:1px solid #dbe3ef;font-size:13px;">${escapeHtml(l.clienteNome)}</td>
        <td style="padding:8px 10px;border:1px solid #dbe3ef;font-size:13px;">${escapeHtml(l.pedidos.join(', '))}</td>
        ${atrasoCells}
        <td style="padding:8px 10px;border:1px solid #dbe3ef;font-size:13px;">${acaoTxt}</td>
      </tr>`;
    })
    .join('');

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
      style="border-collapse:collapse;margin-top:8px;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:8px 10px;border:1px solid #dbe3ef;font-size:12px;text-align:left;">Cliente</th>
          <th style="padding:8px 10px;border:1px solid #dbe3ef;font-size:12px;text-align:left;">Pedidos (PD)</th>
          ${headAtraso}
          <th style="padding:8px 10px;border:1px solid #dbe3ef;font-size:12px;text-align:left;">Ação</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function montarTabelaAcoesConfirmadasHtml(acoes: AcaoConfirmadaDia[]): string {
  if (acoes.length === 0) {
    return `<p style="margin:8px 0;color:#64748b;font-size:13px;">Nenhuma ação confirmada no Nomus hoje.</p>`;
  }
  const rows = acoes
    .map(
      (a) => `
      <tr>
        <td style="padding:8px 10px;border:1px solid #dbe3ef;font-size:13px;">${escapeHtml(a.clienteNome)}</td>
        <td style="padding:8px 10px;border:1px solid #dbe3ef;font-size:13px;">${escapeHtml(a.numeroPedidoExibicao)}</td>
        <td style="padding:8px 10px;border:1px solid #dbe3ef;font-size:13px;">${escapeHtml(a.acaoLabel)}${
          a.pedidoDestino ? `<br/><span style="color:#64748b;font-size:12px;">Destino: ${escapeHtml(a.pedidoDestino)}</span>` : ''
        }</td>
        <td style="padding:8px 10px;border:1px solid #dbe3ef;font-size:13px;">${escapeHtml(a.por)}</td>
        <td style="padding:8px 10px;border:1px solid #dbe3ef;font-size:13px;">${escapeHtml(a.quando)}</td>
      </tr>`
    )
    .join('');

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
      style="border-collapse:collapse;margin-top:8px;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:8px 10px;border:1px solid #dbe3ef;font-size:12px;text-align:left;">Cliente</th>
          <th style="padding:8px 10px;border:1px solid #dbe3ef;font-size:12px;text-align:left;">Pedido</th>
          <th style="padding:8px 10px;border:1px solid #dbe3ef;font-size:12px;text-align:left;">Ação confirmada</th>
          <th style="padding:8px 10px;border:1px solid #dbe3ef;font-size:12px;text-align:left;">Por</th>
          <th style="padding:8px 10px;border:1px solid #dbe3ef;font-size:12px;text-align:left;">Quando</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

export function resumoDiarioTemConteudo(payload: ResumoDiarioCreditoPayload): boolean {
  return (
    payload.inadimplentes.length > 0 ||
    payload.regularizados.length > 0 ||
    payload.finalizadosHoje.length > 0 ||
    payload.acoesConfirmadasHoje.length > 0
  );
}

export function montarEmailResumoDiarioCredito(payload: ResumoDiarioCreditoPayload): {
  subject: string;
  html: string;
} {
  const dataBr = (() => {
    const [y, m, d] = payload.dataRef.split('-');
    return `${d}/${m}/${y}`;
  })();

  const subject = `[Gestão Smart] Resumo diário de crédito — ${dataBr}`;
  const html = buildSystemEmailHtml({
    badge: 'Financeiro',
    title: 'Resumo diário — Pendências de crédito',
    subtitle: dataBr,
    intro:
      'Compilado do dia com clientes inadimplentes, regularizados aguardando liberação, finalizados hoje e ações confirmadas no Nomus.',
    sections: [
      {
        heading: 'Totais',
        rows: [
          {
            label: 'Inadimplentes',
            value: `${payload.inadimplentes.length} cliente(s)`,
          },
          {
            label: 'Regularizados (aguardando liberação)',
            value: `${payload.regularizados.length} cliente(s)`,
          },
          {
            label: 'Finalizados hoje',
            value: `${payload.finalizadosHoje.length} cliente(s)`,
          },
          {
            label: 'Ações confirmadas hoje',
            value: `${payload.acoesConfirmadasHoje.length}`,
          },
        ],
      },
      {
        heading: 'Inadimplentes',
        html: montarTabelaClientesHtml(payload.inadimplentes, true),
      },
      {
        heading: 'Regularizados — aguardando liberação',
        html: montarTabelaClientesHtml(payload.regularizados, false),
      },
      {
        heading: 'Finalizados hoje',
        html: montarTabelaClientesHtml(payload.finalizadosHoje, false),
      },
      {
        heading: 'Ações confirmadas no Nomus (hoje)',
        html: montarTabelaAcoesConfirmadasHtml(payload.acoesConfirmadasHoje),
      },
    ],
    cta: {
      label: 'Abrir Pendências no CRM',
      href: deepLinkPendenciasCrm(),
    },
    footerNote:
      'Este resumo é enviado uma vez por dia útil. Ações em rascunho (ainda sem confirmação no Nomus) aparecem marcadas como rascunho; só entram na seção de confirmadas após o status no Nomus.',
  });

  return { subject, html };
}

export async function executarResumoDiarioCredito(
  prisma: PrismaClient,
  destinatarios: string[],
  options?: { ignorarDedup?: boolean; dataRef?: Date }
): Promise<{ enviados: number; ignorados: number; erros: string[] }> {
  const emails = [
    ...new Set(
      destinatarios.map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@'))
    ),
  ];
  if (emails.length === 0) {
    return { enviados: 0, ignorados: 0, erros: ['Nenhum destinatário com e-mail válido.'] };
  }

  const payload = await montarResumoDiarioCredito(prisma, { dataRef: options?.dataRef });
  if (!resumoDiarioTemConteudo(payload)) {
    return {
      enviados: 0,
      ignorados: 1,
      erros: [],
    };
  }

  const chave = chaveDisparoDiario(payload.dataRef);
  if (!options?.ignorarDedup && (await alreadySent(prisma, chave))) {
    return { enviados: 0, ignorados: 1, erros: [] };
  }

  const { subject, html } = montarEmailResumoDiarioCredito(payload);

  try {
    if (!envioNotificacoesHabilitado()) {
      logEnvioSuprimido('email', emails.join(', '), subject);
      return { enviados: 0, ignorados: 1, erros: [] };
    }

    await sendSystemEmail(prisma, { to: emails, subject, html });
    if (!options?.ignorarDedup) {
      await logSent(prisma, chave, emails, subject);
    }
    return { enviados: 1, ignorados: 0, erros: [] };
  } catch (err) {
    return {
      enviados: 0,
      ignorados: 0,
      erros: [err instanceof Error ? err.message : String(err)],
    };
  }
}

export async function previewResumoDiarioCredito(prisma: PrismaClient): Promise<{
  quantidade: number;
  subject: string;
  html: string;
  resumo: string;
}> {
  const payload = await montarResumoDiarioCredito(prisma);
  if (!resumoDiarioTemConteudo(payload)) {
    return {
      quantidade: 0,
      subject: '[Preview] Resumo diário de crédito — vazio',
      html: '<p>Não há inadimplentes, regularizados, finalizados de hoje nem ações confirmadas para compilar.</p>',
      resumo: 'Nada a enviar no resumo diário.',
    };
  }
  const { subject, html } = montarEmailResumoDiarioCredito(payload);
  const quantidade =
    payload.inadimplentes.length +
    payload.regularizados.length +
    payload.finalizadosHoje.length;
  const resumo = `${payload.inadimplentes.length} inadimplente(s), ${payload.regularizados.length} regularizado(s), ${payload.finalizadosHoje.length} finalizado(s) hoje, ${payload.acoesConfirmadasHoje.length} ação(ões) confirmada(s).`;
  return { quantidade, subject, html, resumo };
}
