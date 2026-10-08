import type {
  FaixaTicketPainel,
  PainelComercialPedido,
  StatusConformidadePainel,
} from '../api/painelComercial';

const FAIXAS: FaixaTicketPainel[] = ['ate_3000', 'entre_3001_10000', 'acima_10000'];

/** Recalcula indicadores do painel a partir dos pedidos já filtrados por equipe. */
export function resumirPainelComercial(pedidos: PainelComercialPedido[]) {
  const analisaveis = pedidos.filter((p) => p.status !== 'excluido_politica');
  const okC = analisaveis.filter((p) => p.status === 'ok').length;
  const alC = analisaveis.filter((p) => p.status === 'alerta').length;
  const ncC = analisaveis.filter((p) => p.status === 'nao_conforme').length;
  const nA = analisaveis.length;
  const somaT = pedidos.reduce((s, p) => s + (p.totalPedido || 0), 0);
  const somaTA = analisaveis.reduce((s, p) => s + (p.totalPedido || 0), 0);

  const porMesMap = new Map<
    string,
    { total: number; ok: number; alerta: number; naoConforme: number; excluido: number }
  >();
  for (const p of pedidos) {
    const mes = /^(\d{4}-\d{2})/.exec(String(p.emissao ?? ''))?.[1] ?? '—';
    const cur = porMesMap.get(mes) ?? { total: 0, ok: 0, alerta: 0, naoConforme: 0, excluido: 0 };
    cur.total++;
    if (p.status === 'excluido_politica') cur.excluido++;
    else if (p.status === 'ok') cur.ok++;
    else if (p.status === 'alerta') cur.alerta++;
    else cur.naoConforme++;
    porMesMap.set(mes, cur);
  }
  const porMes = [...porMesMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, v]) => ({ mes, ...v }));

  const faixaMap = new Map<FaixaTicketPainel, { pedidos: number; analisados: number; ok: number; label: string }>();
  for (const p of pedidos) {
    const cur = faixaMap.get(p.faixaTicket) ?? { pedidos: 0, analisados: 0, ok: 0, label: p.labelFaixa };
    cur.pedidos++;
    if (p.labelFaixa) cur.label = p.labelFaixa;
    if (p.status !== 'excluido_politica') {
      cur.analisados++;
      if (p.status === 'ok') cur.ok++;
    }
    faixaMap.set(p.faixaTicket, cur);
  }
  const porFaixa = FAIXAS.map((faixa) => {
    const v = faixaMap.get(faixa);
    return {
      faixa,
      label: v?.label || faixa,
      pedidos: v?.pedidos ?? 0,
      pctOk: v?.analisados ? Math.round((v.ok / v.analisados) * 1000) / 10 : 0,
    };
  });

  const prazos = pedidos
    .map((p) => p.prazoMedioDias)
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n));

  const contagem: Record<StatusConformidadePainel, number> = {
    ok: 0,
    alerta: 0,
    nao_conforme: 0,
    excluido_politica: 0,
  };
  for (const p of pedidos) {
    if (p.status in contagem) contagem[p.status] += 1;
  }

  return {
    totalPedidos: pedidos.length,
    pedidosAnalisados: nA,
    pedidosExcluidosPolitica: pedidos.length - nA,
    pctConformes: nA ? Math.round((okC / nA) * 1000) / 10 : 0,
    pctAlertas: nA ? Math.round((alC / nA) * 1000) / 10 : 0,
    pctNaoConformes: nA ? Math.round((ncC / nA) * 1000) / 10 : 0,
    ticketMedio: pedidos.length ? Math.round((somaT / pedidos.length) * 100) / 100 : 0,
    ticketMedioAnalisados: nA ? Math.round((somaTA / nA) * 100) / 100 : 0,
    prazoMedioVendasAPrazoDias:
      prazos.length > 0 ? Math.round((prazos.reduce((s, n) => s + n, 0) / prazos.length) * 10) / 10 : null,
    pedidosVendasAPrazoComPrazoCadastrado: prazos.length,
    porMes,
    porFaixa,
    contagem,
  };
}
