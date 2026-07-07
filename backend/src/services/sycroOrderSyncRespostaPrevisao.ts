import { prisma } from '../config/prisma.js';
import { isUserCommercialTeamByPermsJson } from './sycroOrderAguardaRespostaLabel.js';
import { invalidateSycroCardSinalizacaoCache } from './sycroOrderPedidoSinalizacao.js';

function normalizeLogin(login: string): string {
  return String(login ?? '').trim().toLowerCase();
}

function normalizePersonToken(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function normalizePdDigits(pd: string): string {
  const s = String(pd ?? '').trim();
  const digits = s.replace(/\D+/g, '');
  return digits || s;
}

function orderNumberMatchesPd(orderNumber: string, pd: string): boolean {
  const a = normalizePdDigits(orderNumber);
  const b = normalizePdDigits(pd);
  return a.length > 0 && a === b;
}

function usuarioCorrespondeLabel(args: {
  usuarioLogin: string;
  usuarioNome: string | null | undefined;
  label: string;
}): boolean {
  const labelRaw = args.label.trim();
  if (!labelRaw) return false;
  const login = normalizeLogin(args.usuarioLogin);
  const nome = normalizePersonToken(args.usuarioNome ?? '');
  const labelNorm = normalizePersonToken(labelRaw);

  if (nome && (labelNorm === nome || labelNorm.includes(nome))) return true;
  if (login && (labelNorm === login || labelNorm.includes(login))) return true;
  for (const seg of labelRaw.split(',')) {
    const t = normalizePersonToken(seg);
    if (nome && t === nome) return true;
    if (login && t === login) return true;
  }
  return false;
}

/** Usuário pode sanar pendência rotulada como PCP / josenildo / pessoa nomeada. */
function usuarioPodeResponderAguardaLabel(args: {
  usuarioLogin: string;
  usuarioNome: string | null | undefined;
  usuarioPermsJson: string | null | undefined;
  label: string;
}): boolean {
  const labelRaw = args.label.trim();
  if (!labelRaw) return false;
  const labelNorm = normalizePersonToken(labelRaw);
  const login = normalizeLogin(args.usuarioLogin);
  const ehComercial = isUserCommercialTeamByPermsJson(args.usuarioPermsJson);

  if (labelNorm === 'pcp') {
    if (login === 'pcp') return true;
    return !ehComercial;
  }
  if (labelNorm === 'josenildo') {
    if (login === 'josenildo') return true;
    return !ehComercial;
  }

  return usuarioCorrespondeLabel({
    usuarioLogin: args.usuarioLogin,
    usuarioNome: args.usuarioNome,
    label: labelRaw,
  });
}

/**
 * Quando o PCP (ou outro destinatário da pendência) altera a previsão no Gerenciador,
 * limpa `aguarda_resposta` nos cards Comunicação PD do mesmo PD.
 */
export async function responderSycroCardsPorAjusteGerenciador(args: {
  pd: string;
  usuarioLogin: string;
  novaPrevisaoIso: string;
}): Promise<{ cardsAtualizados: number }> {
  const pd = String(args.pd ?? '').trim();
  const usuarioLogin = String(args.usuarioLogin ?? '').trim();
  if (!pd || !usuarioLogin) return { cardsAtualizados: 0 };

  const usuario = await prisma.usuario.findFirst({
    where: { login: { equals: usuarioLogin } },
    select: { nome: true, permissoes: true, ativo: true },
  });
  if (!usuario?.ativo) return { cardsAtualizados: 0 };

  const orders = await prisma.sycroOrderOrder.findMany({
    where: { aguarda_resposta_pendente: 1, status: { not: 'FINISHED' } },
    select: {
      id: true,
      order_number: true,
      aguarda_resposta_de_label: true,
    },
  });

  const alvo = orders.filter((o) => orderNumberMatchesPd(o.order_number, pd));
  const novaIso = args.novaPrevisaoIso.trim().slice(0, 10);

  let cardsAtualizados = 0;
  for (const o of alvo) {
    const label = (o.aguarda_resposta_de_label ?? '').trim();
    if (!label) continue;
    if (
      !usuarioPodeResponderAguardaLabel({
        usuarioLogin,
        usuarioNome: usuario.nome,
        usuarioPermsJson: usuario.permissoes,
        label,
      })
    ) {
      continue;
    }
    await prisma.sycroOrderOrder.update({
      where: { id: o.id },
      data: {
        aguarda_resposta_pendente: 0,
        aguarda_resposta_de_label: null,
        aguarda_resposta_destino_time: null,
        ...(novaIso && /^\d{4}-\d{2}-\d{2}$/.test(novaIso) ? { current_promised_date: novaIso } : {}),
      },
    });
    cardsAtualizados += 1;
  }

  if (cardsAtualizados > 0) {
    invalidateSycroCardSinalizacaoCache();
  }

  return { cardsAtualizados };
}
