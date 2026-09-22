/**
 * Retrato da conferência NF × PC: texto do WhatsApp e HTML permanente.
 * O payload gravado é este objeto — a página não depende do Nomus depois.
 */

import type { DoubleCheckInComparativoLinha } from '../data/doubleCheckInRepository.js';
import type {
  DoubleCheckInCampoComparativo,
  DoubleCheckInComparativoDecisaoRow,
} from '../data/doubleCheckInLocalRepository.js';

export type SinalDif = 'pos' | 'neg' | 'zero';

export type CampoRelato = {
  campo: DoubleCheckInCampoComparativo;
  titulo: string;
  nf: string;
  pc: string;
  diferenca: string | null;
  sinal: SinalDif | null;
  decisao: 'aceita' | 'recusa';
  justificativa: string;
  observacao: string | null;
  /** Bruto e desconto, só no HTML. */
  detalhe: string | null;
  /** Linha curta de desconto unitário no WhatsApp. */
  descontoWhatsApp: string | null;
};

export type ProdutoRelato = {
  codigo: string;
  pedido: string;
  campos: CampoRelato[];
};

export type RelatoConferencia = {
  numeroNfe: string;
  numeroDocumentoFiscal: string;
  nomeParceiro: string;
  conferidoPor: string;
  conferidoEm: string | null;
  totalProdutos: number;
  totalDivergencias: number;
  aceitas: number;
  recusadas: number;
  pagamentoComum: CampoRelato | null;
  produtos: ProdutoRelato[];
};

const TITULO: Record<DoubleCheckInCampoComparativo, string> = {
  valor_unitario: 'Preço líq.',
  qtde: 'Quantidade',
  ipi: 'IPI',
  condicao_pagamento: 'Pagamento',
};

function fmtBrl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtNum(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
}

function descUnit(total: number, qtde: number): number {
  if (!(total > 0)) return 0;
  if (!(qtde > 0)) return Math.round(total * 100) / 100;
  return Math.round((total / qtde + Number.EPSILON) * 100) / 100;
}

function diffDinheiro(nf: number, pc: number): { texto: string; sinal: SinalDif } {
  const d = Math.round((nf - pc) * 100) / 100;
  if (d === 0) return { texto: fmtBrl(0), sinal: 'zero' };
  const abs = fmtBrl(Math.abs(d));
  return d > 0 ? { texto: `+${abs}`, sinal: 'pos' } : { texto: `−${abs}`, sinal: 'neg' };
}

function diffQtde(nf: number, pc: number): { texto: string; sinal: SinalDif } {
  const d = Math.round((nf - pc) * 10000) / 10000;
  if (d === 0) return { texto: fmtNum(0), sinal: 'zero' };
  const abs = fmtNum(Math.abs(d));
  return d > 0 ? { texto: `+${abs}`, sinal: 'pos' } : { texto: `−${abs}`, sinal: 'neg' };
}

function nomeCondicao(nome: string | null): string {
  const n = (nome ?? '').trim().replace(/\.+$/, '');
  return n || '—';
}

function chaveDecisao(idItemDocumentoEstoque: number, idItemPedidoCompra: number, campo: string): string {
  return `${idItemDocumentoEstoque}:${idItemPedidoCompra}:${campo}`;
}

function camposDivergentes(linha: DoubleCheckInComparativoLinha): DoubleCheckInCampoComparativo[] {
  const out: DoubleCheckInCampoComparativo[] = [];
  if (linha.divergValorUnitario) out.push('valor_unitario');
  if (linha.divergQtde) out.push('qtde');
  if (linha.divergIpi) out.push('ipi');
  if (linha.divergCondicaoPagamento) out.push('condicao_pagamento');
  return out;
}

function detalhePreco(linha: DoubleCheckInComparativoLinha): { detalhe: string | null; descontoWhatsApp: string | null } {
  const dNf = descUnit(linha.descontoNF, linha.qtdeNF);
  const dPc = descUnit(linha.descontoPC, linha.qtdePC);
  const temDesc = dNf > 0 || dPc > 0;
  const brutoDifere =
    Math.round(linha.valorUnitarioBrutoNF * 100) !== Math.round(linha.valorUnitarioBrutoPC * 100);
  if (!temDesc && !brutoDifere) return { detalhe: null, descontoWhatsApp: null };
  const partes = [`Bruto NF ${fmtBrl(linha.valorUnitarioBrutoNF)} · PC ${fmtBrl(linha.valorUnitarioBrutoPC)}.`];
  if (temDesc) {
    partes.push(`Desconto unitário NF ${fmtBrl(dNf)} · PC ${fmtBrl(dPc)}.`);
  }
  return {
    detalhe: partes.join(' '),
    descontoWhatsApp: temDesc ? `desc. un. NF ${fmtBrl(dNf)} · PC ${fmtBrl(dPc)}` : null,
  };
}

function montarCampo(
  linha: DoubleCheckInComparativoLinha,
  campo: DoubleCheckInCampoComparativo,
  dec: DoubleCheckInComparativoDecisaoRow
): CampoRelato {
  const base = {
    campo,
    titulo: TITULO[campo],
    decisao: dec.decisao,
    justificativa: dec.justificativaLabel,
    observacao: dec.observacao?.trim() ? dec.observacao.trim() : null,
    detalhe: null as string | null,
    descontoWhatsApp: null as string | null,
  };
  if (campo === 'valor_unitario') {
    const dif = diffDinheiro(linha.valorUnitarioNF, linha.valorUnitarioPC);
    const extra = detalhePreco(linha);
    return {
      ...base,
      nf: fmtBrl(linha.valorUnitarioNF),
      pc: fmtBrl(linha.valorUnitarioPC),
      diferenca: dif.texto,
      sinal: dif.sinal,
      detalhe: extra.detalhe,
      descontoWhatsApp: extra.descontoWhatsApp,
    };
  }
  if (campo === 'qtde') {
    const dif = diffQtde(linha.qtdeNF, linha.qtdePC);
    const um = linha.umNF || linha.umPC ? ` ${linha.umNF ?? linha.umPC}` : '';
    return {
      ...base,
      nf: `${fmtNum(linha.qtdeNF)}${linha.umNF ? ` ${linha.umNF}` : um}`,
      pc: `${fmtNum(linha.qtdePC)}${linha.umPC ? ` ${linha.umPC}` : um}`,
      diferenca: dif.texto,
      sinal: dif.sinal,
    };
  }
  if (campo === 'ipi') {
    const dif = diffDinheiro(linha.valorIpiNF, linha.valorIpiPC);
    return {
      ...base,
      nf: fmtBrl(linha.valorIpiNF),
      pc: fmtBrl(linha.valorIpiPC),
      diferenca: dif.texto,
      sinal: dif.sinal,
    };
  }
  return {
    ...base,
    nf: nomeCondicao(linha.condicaoPagamentoNF),
    pc: nomeCondicao(linha.condicaoPagamentoPC),
    diferenca: null,
    sinal: null,
  };
}

function mesmaAssinatura(a: CampoRelato, b: CampoRelato): boolean {
  return (
    a.nf === b.nf &&
    a.pc === b.pc &&
    a.decisao === b.decisao &&
    a.justificativa === b.justificativa &&
    a.observacao === b.observacao
  );
}

function fmtQuando(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function montarRelatoConferencia(params: {
  meta: {
    numeroNfe: string | null;
    numeroDocumentoFiscal: string | null;
    nomeParceiro: string | null;
  };
  conferidoPor: string;
  conferidoEm?: string | null;
  linhas: DoubleCheckInComparativoLinha[];
  decisoes: DoubleCheckInComparativoDecisaoRow[];
}): RelatoConferencia | null {
  const map = new Map(
    params.decisoes.map((d) => [chaveDecisao(d.idItemDocumentoEstoque, d.idItemPedidoCompra, d.campo), d])
  );
  const produtos: ProdutoRelato[] = [];
  let aceitas = 0;
  let recusadas = 0;

  for (const linha of params.linhas) {
    const campos: CampoRelato[] = [];
    for (const campo of camposDivergentes(linha)) {
      const dec = map.get(chaveDecisao(linha.idItemDocumentoEstoque, linha.idItemPedidoCompra, campo));
      if (!dec) continue;
      const item = montarCampo(linha, campo, dec);
      campos.push(item);
      if (item.decisao === 'aceita') aceitas += 1;
      else recusadas += 1;
    }
    if (campos.length === 0) continue;
    const codigo =
      linha.codigoProduto?.trim() ||
      (linha.idProduto != null ? String(linha.idProduto) : 'Produto');
    const pedido =
      linha.nomePedidoCompra?.trim() ||
      (linha.idPedidoCompra != null ? `PC ${linha.idPedidoCompra}` : 'PC');
    produtos.push({ codigo, pedido, campos });
  }

  if (produtos.length === 0) return null;

  const totalDivergencias = aceitas + recusadas;
  let pagamentoComum: CampoRelato | null = null;
  const pagamentos = produtos
    .map((p) => p.campos.find((c) => c.campo === 'condicao_pagamento'))
    .filter((c): c is CampoRelato => Boolean(c));
  if (pagamentos.length === produtos.length && pagamentos.every((p) => mesmaAssinatura(p, pagamentos[0]!))) {
    pagamentoComum = pagamentos[0]!;
    for (const produto of produtos) {
      produto.campos = produto.campos.filter((c) => c.campo !== 'condicao_pagamento');
    }
  }

  return {
    numeroNfe: (params.meta.numeroNfe ?? '').trim() || '—',
    numeroDocumentoFiscal: (params.meta.numeroDocumentoFiscal ?? '').trim() || '—',
    nomeParceiro: (params.meta.nomeParceiro ?? '').trim() || '—',
    conferidoPor: params.conferidoPor.trim() || '—',
    conferidoEm: fmtQuando(params.conferidoEm ?? null),
    totalProdutos: produtos.length,
    totalDivergencias,
    aceitas,
    recusadas,
    pagamentoComum,
    produtos: produtos.filter((p) => p.campos.length > 0 || pagamentoComum),
  };
}

function wa(s: string): string {
  return s.replace(/[*_~`]/g, '');
}

function linhaDecisao(campo: CampoRelato): string {
  const marca = campo.decisao === 'aceita' ? '✅ Aceita' : '❌ Recusada';
  return `${marca} · ${wa(campo.justificativa)}`;
}

function blocoCampoWhatsApp(campo: CampoRelato, mostrarTitulo: boolean): string[] {
  const linhas: string[] = [];
  if (mostrarTitulo) linhas.push(wa(campo.titulo));
  linhas.push(`NF ${wa(campo.nf)}  →  PC ${wa(campo.pc)}`);
  if (campo.diferenca) linhas.push(`dif. ${campo.diferenca}`);
  linhas.push(linhaDecisao(campo));
  if (campo.descontoWhatsApp) linhas.push(campo.descontoWhatsApp);
  if (campo.observacao) linhas.push(wa(campo.observacao));
  return linhas;
}

function resumoDecisoes(relato: RelatoConferencia): string {
  if (relato.recusadas === 0) return 'Todas *aceitas*';
  if (relato.aceitas === 0) return 'Todas *recusadas*';
  return `*${relato.aceitas} aceitas* · *${relato.recusadas} recusadas*`;
}

/** Texto do WhatsApp, sem a introdução do robô (ela é prefixada no envio). */
export function montarMensagemConferenciaWhatsApp(relato: RelatoConferencia, url: string | null): string {
  const cabecalho = [
    '*Conferência NF × Pedido*',
    `NF *${wa(relato.numeroNfe)}* · Doc ${wa(relato.numeroDocumentoFiscal)}`,
    wa(relato.nomeParceiro),
    `${wa(relato.conferidoPor)} · ${relato.totalProdutos} produto${relato.totalProdutos === 1 ? '' : 's'} · ${relato.totalDivergencias} divergência${relato.totalDivergencias === 1 ? '' : 's'}`,
    resumoDecisoes(relato),
  ];

  const meio: string[] = [];
  if (relato.pagamentoComum) {
    meio.push(
      '',
      '*Pagamento — vale para todos*',
      `NF: ${wa(relato.pagamentoComum.nf)}`,
      `PC: ${wa(relato.pagamentoComum.pc)}`,
      linhaDecisao(relato.pagamentoComum)
    );
    if (relato.pagamentoComum.observacao) meio.push(wa(relato.pagamentoComum.observacao));
  }

  const restantes = relato.produtos.flatMap((p) => p.campos);
  const soPreco = restantes.length > 0 && restantes.every((c) => c.campo === 'valor_unitario');
  if (soPreco) meio.push('', '*Preços*');

  const blocosProduto: string[][] = [];
  for (const produto of relato.produtos) {
    if (produto.campos.length === 0) continue;
    const linhas = ['', `*${wa(produto.codigo)}* · ${wa(produto.pedido)}`];
    produto.campos.forEach((campo, i) => {
      if (i > 0) linhas.push('');
      const mostrarTitulo = produto.campos.length > 1 || campo.campo !== 'valor_unitario';
      linhas.push(...blocoCampoWhatsApp(campo, mostrarTitulo));
    });
    blocosProduto.push(linhas);
  }

  const rodape = url ? ['', 'Abrir tabela completa:', url] : [];
  let usados = blocosProduto;
  let aviso = '';
  const montar = (lista: string[][], extra: string) =>
    [...cabecalho, ...meio, ...lista.flat(), ...(extra ? ['', extra] : []), ...rodape].join('\n');

  let texto = montar(usados, aviso);
  while (texto.length > 3200 && usados.length > 1) {
    const ocultos = blocosProduto.length - (usados.length - 1);
    usados = usados.slice(0, -1);
    aviso = `… e mais ${ocultos} produto(s) na tabela.`;
    texto = montar(usados, aviso);
  }
  return texto;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function htmlDecisao(campo: CampoRelato): string {
  const cls = campo.decisao === 'aceita' ? 'ok' : 'no';
  const verbo = campo.decisao === 'aceita' ? 'Aceita' : 'Recusada';
  const obs = campo.observacao ? `<div class="obs">${esc(campo.observacao)}</div>` : '';
  return `<div class="${cls}">${verbo} · ${esc(campo.justificativa)}</div>${obs}`;
}

function htmlTabela(campos: CampoRelato[]): string {
  const rows = campos
    .map((c) => {
      const dif =
        c.diferenca == null
          ? '<td>—</td>'
          : `<td class="${c.sinal === 'neg' ? 'neg' : c.sinal === 'pos' ? 'pos' : ''}">${esc(c.diferenca)}</td>`;
      const detalhe = c.detalhe
        ? `<tr class="detalhe"><td colspan="4"><details><summary>Bruto e desconto</summary><p>${esc(c.detalhe)}</p></details></td></tr>`
        : '';
      return `<tr><td>${esc(c.titulo)}</td><td>${esc(c.nf)}</td><td>${esc(c.pc)}</td>${dif}</tr>${detalhe}<tr class="decisao"><td colspan="4">${htmlDecisao(c)}</td></tr>`;
    })
    .join('');
  return `<table><thead><tr><th></th><th>NF</th><th>PC</th><th>Dif.</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function chipResumo(relato: RelatoConferencia): string {
  if (relato.recusadas === 0) return 'todas aceitas';
  if (relato.aceitas === 0) return 'todas recusadas';
  return `${relato.aceitas} aceitas · ${relato.recusadas} recusadas`;
}

export function renderConferenciaHtml(relato: RelatoConferencia): string {
  const quando = relato.conferidoEm ? `<p class="quando">Conferido em ${esc(relato.conferidoEm)}</p>` : '';
  const pagamento = relato.pagamentoComum
    ? `<section class="bloco"><h2>Pagamento — vale para todos</h2><div class="par"><b>NF</b><span>${esc(relato.pagamentoComum.nf)}</span><b>PC</b><span>${esc(relato.pagamentoComum.pc)}</span></div>${htmlDecisao(relato.pagamentoComum)}</section>`
    : '';
  const produtos = relato.produtos
    .filter((p) => p.campos.length > 0)
    .map(
      (p) =>
        `<section class="produto"><h3>${esc(p.codigo)} <span>· ${esc(p.pedido)}</span></h3>${htmlTabela(p.campos)}</section>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Conferência NF ${esc(relato.numeroNfe)}</title>
  <style>
    :root {
      --navy: #041E42;
      --blue: #1E22AA;
      --gold: #FFAD00;
      --gray: #808080;
      --graphite: #2E2D2C;
      --white: #FFFFFF;
      --surface: #f4f5f8;
      --line: rgb(128 128 128 / 0.3);
      --ok: #067647;
      --no: #b42318;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Segoe UI", system-ui, sans-serif; background: var(--surface); color: var(--navy); line-height: 1.35; }
    .topo { background: var(--navy); color: var(--white); border-bottom: 4px solid var(--gold); }
    .topo-inner { max-width: 560px; margin: 0 auto; padding: 18px 16px 16px; display: flex; align-items: center; gap: 16px; }
    .topo img { height: 64px; width: auto; display: block; }
    .topo h1 { margin: 0; font-size: 20px; font-weight: 700; }
    .topo p { margin: 4px 0 0; color: var(--gold); font-size: 13px; font-weight: 600; }
    .quando { margin: 6px 0 0; color: rgb(255 255 255 / 0.75); font-size: 12px; font-weight: 500; }
    .wrap { max-width: 560px; margin: 0 auto; padding: 16px 14px 40px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
    .meta div, .bloco, .produto { background: var(--white); border: 1px solid var(--line); border-radius: 12px; }
    .meta div { padding: 10px 12px; }
    .meta span { display: block; color: var(--blue); font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
    .meta strong { font-size: 15px; font-weight: 700; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
    .chip { background: var(--navy); color: var(--white); border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 650; }
    .bloco, .produto { padding: 12px 14px; margin-bottom: 10px; }
    .bloco { border-left: 4px solid var(--gold); }
    .produto { border-top: 3px solid var(--blue); }
    h2 { font-size: 12px; margin: 0 0 8px; letter-spacing: .04em; text-transform: uppercase; color: var(--blue); }
    .par { display: grid; grid-template-columns: 72px 1fr; gap: 4px 8px; font-size: 15px; }
    .par b { color: var(--gray); font-weight: 650; }
    .ok { color: var(--ok); font-weight: 700; font-size: 14px; margin-top: 8px; }
    .no { color: var(--no); font-weight: 700; font-size: 14px; margin-top: 8px; }
    .obs { color: var(--graphite); font-size: 13px; margin-top: 4px; }
    .produto h3 { margin: 0 0 8px; font-size: 16px; }
    .produto h3 span { color: var(--gray); font-weight: 600; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { text-align: right; color: var(--white); background: var(--navy); font-weight: 650; font-size: 11px; letter-spacing: .04em; text-transform: uppercase; padding: 6px 8px; }
    th:first-child { text-align: left; border-radius: 6px 0 0 0; }
    th:last-child { border-radius: 0 6px 0 0; }
    td { padding: 8px; border-bottom: 1px solid var(--line); text-align: right; font-variant-numeric: tabular-nums; color: var(--graphite); }
    td:first-child { text-align: left; font-weight: 700; color: var(--navy); }
    tr.decisao td, tr.detalhe td { text-align: left; font-weight: 500; border-bottom: none; padding-top: 0; }
    .neg { color: var(--no); font-weight: 700; }
    .pos { color: var(--blue); font-weight: 700; }
    details summary { cursor: pointer; color: var(--blue); font-weight: 650; font-size: 13px; }
    details p { margin: 6px 0 0; color: var(--graphite); font-size: 13px; font-weight: 500; }
    .rodape { color: var(--gray); font-size: 12px; margin-top: 16px; }
  </style>
</head>
<body>
  <header class="topo">
    <div class="topo-inner">
      <img src="/logo-soaco-clean.png" alt="Só Aço — Produzindo com excelência" />
      <div>
        <h1>Conferência NF × Pedido</h1>
        <p>Double CheckIn</p>
        ${quando}
      </div>
    </div>
  </header>
  <main class="wrap">
    <section class="meta">
      <div><span>NF</span><strong>${esc(relato.numeroNfe)}</strong></div>
      <div><span>Documento</span><strong>${esc(relato.numeroDocumentoFiscal)}</strong></div>
      <div><span>Parceiro</span><strong>${esc(relato.nomeParceiro)}</strong></div>
      <div><span>Conferido por</span><strong>${esc(relato.conferidoPor)}</strong></div>
    </section>
    <div class="chips">
      <span class="chip">${relato.totalProdutos} produto${relato.totalProdutos === 1 ? '' : 's'}</span>
      <span class="chip">${relato.totalDivergencias} divergência${relato.totalDivergencias === 1 ? '' : 's'}</span>
      <span class="chip">${esc(chipResumo(relato))}</span>
    </div>
    ${pagamento}
    ${produtos}
    <p class="rodape">Diferença = preço líquido da NF menos o do pedido.</p>
  </main>
</body>
</html>`;
}

export function renderConferenciaNaoEncontradaHtml(): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Conferência não encontrada</title>
  <style>
    body { margin: 0; font-family: "Segoe UI", system-ui, sans-serif; background: #f4f5f8; color: #041E42; }
    main { max-width: 420px; margin: 48px auto; padding: 0 16px; }
    h1 { font-size: 20px; }
    p { color: #808080; }
  </style>
</head>
<body>
  <main>
    <h1>Conferência não encontrada</h1>
    <p>Este link não corresponde a uma conferência gravada.</p>
  </main>
</body>
</html>`;
}
