import type { ComponenteFicha, DetalheItemGondola } from '../../../api/gondolasPortaPaletes';
import { getLogoSoAcoTransparentSrc, imageUrlToDataUrl } from '../../../utils/imageDataUrl';

type LinhaOrdem = {
  pedido: string;
  cliente: string;
  descricao: string;
  materiaPrima: string;
  medida: string;
  modelo: string;
  observacao: string;
  quantidadeTotal: number;
};

function esc(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function num(valor: number): string {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

function medida(componente: ComponenteFicha): string {
  const a = componente.medida01.trim();
  const b = componente.medida02.trim();
  if (a && b) return `${a} x ${b}`;
  return a || b || '—';
}

function linhasDoDetalhe(detalhe: DetalheItemGondola): LinhaOrdem[] {
  const base = {
    pedido: detalhe.item.pedido,
    cliente: detalhe.item.cliente,
  };
  if (detalhe.componentes.length === 0) {
    return [
      {
        ...base,
        descricao: detalhe.item.descricao || 'Sem componentes na ficha',
        materiaPrima: '',
        medida: '—',
        modelo: '',
        observacao: '',
        quantidadeTotal: detalhe.item.qtdePendenteReal,
      },
    ];
  }
  return detalhe.componentes.map((componente) => ({
    ...base,
    descricao: componente.descricao || componente.codigo || '—',
    materiaPrima: componente.materiaPrima,
    medida: medida(componente),
    modelo: (componente.modelo ?? '').trim(),
    observacao: (componente.observacao ?? '').trim(),
    quantidadeTotal: componente.quantidadeTotal,
  }));
}

function chaveConsolidada(linha: LinhaOrdem): string {
  return [linha.descricao, linha.materiaPrima, linha.medida].join('|');
}

/** Soma a mesma peça numa linha só. No pedido mantém a ordem da ficha e junta as observações. */
function somarPecasIguais(linhas: LinhaOrdem[]): LinhaOrdem[] {
  const mapa = new Map<string, LinhaOrdem>();
  for (const linha of linhas) {
    const chave = chaveConsolidada(linha);
    const atual = mapa.get(chave);
    if (!atual) {
      mapa.set(chave, { ...linha });
      continue;
    }
    atual.quantidadeTotal += linha.quantidadeTotal;
    if (atual.modelo !== linha.modelo) atual.modelo = '';
    if (linha.observacao && !atual.observacao.split('; ').includes(linha.observacao)) {
      atual.observacao = atual.observacao ? `${atual.observacao}; ${linha.observacao}` : linha.observacao;
    }
  }
  return [...mapa.values()];
}

export type LinhaDetalheOrdem = Omit<LinhaOrdem, 'cliente'>;

/** Linhas do detalhamento por pedido, somadas como nas páginas de pedido do PDF. */
export function linhasDetalhamentoPorPedido(detalhes: DetalheItemGondola[]): LinhaDetalheOrdem[] {
  const linhas = detalhes.flatMap(linhasDoDetalhe);
  const pedidos = [...new Set(linhas.map((linha) => linha.pedido))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return pedidos.flatMap((pedido) =>
    somarPecasIguais(linhas.filter((linha) => linha.pedido === pedido)).map(({ cliente: _cliente, ...linha }) => linha)
  );
}

function consolidar(linhas: LinhaOrdem[]): LinhaOrdem[] {
  return somarPecasIguais(linhas.map((linha) => ({ ...linha, pedido: 'Consolidado', cliente: '', observacao: '' }))).sort(
    (a, b) =>
      a.descricao.localeCompare(b.descricao, 'pt-BR') || a.materiaPrima.localeCompare(b.materiaPrima, 'pt-BR')
  );
}

type MetaOrdem = { data: string; hora: string; numero: string; tipo: string };

function cabecalho(pedidos: string[], cliente: string, meta: MetaOrdem, logo: string | null): string {
  const temCliente = cliente.trim() !== '';
  const { data, hora } = meta;
  return `
    <section class="print-header">
      <div class="print-header-main">
        <div class="brand-block">
          ${logo ? `<img src="${logo}" alt="Só Aço" class="brand-logo" />` : '<strong class="brand-fallback">SÓ AÇO</strong>'}
          <div>
            <h1 class="doc-title">ORDEM DE PRODUÇÃO</h1>
            <p class="doc-subtitle">Gestão Smart — Só Aço</p>
          </div>
        </div>
        <div class="doc-meta">
          ${meta.numero ? `<p class="doc-numero">${esc(meta.numero)}</p>` : ''}
          ${meta.tipo ? `<p><strong>Tipo:</strong> ${esc(meta.tipo)}</p>` : ''}
          <p><strong>Data:</strong> ${esc(data)}</p>
          <p><strong>Hora:</strong> ${esc(hora)}</p>
        </div>
      </div>
      <div class="doc-info-grid">
        <div class="info-card${temCliente ? '' : ' full-width'}">
          <p class="info-label">Pedidos na ordem</p>
          <p class="info-value">${esc(pedidos.join(', ') || '—')}</p>
        </div>
        ${
          temCliente
            ? `<div class="info-card">
          <p class="info-label">Cliente</p>
          <p class="info-value">${esc(cliente)}</p>
        </div>`
            : ''
        }
      </div>
    </section>`;
}

function folha(
  titulo: string,
  linhas: LinhaOrdem[],
  pedidosCabecalho: string[],
  cliente: string,
  meta: MetaOrdem,
  logo: string | null,
  quebra: boolean
): string {
  const total = linhas.reduce((soma, linha) => soma + linha.quantidadeTotal, 0);
  const corpo = linhas
    .map(
      (linha) => `
      <tr>
        <td class="cell-strong">${esc(linha.pedido)}</td>
        <td>${esc(linha.descricao)}</td>
        <td>${esc(linha.modelo || '—')}</td>
        <td>${esc(linha.materiaPrima || '—')}</td>
        <td>${esc(linha.medida)}</td>
        <td>${esc(linha.observacao || '—')}</td>
        <td class="text-right font-mono">${num(linha.quantidadeTotal)}</td>
      </tr>`
    )
    .join('');
  return `
    <div class="pagina${quebra ? ' quebra' : ''}">
    <table class="folha">
      <thead>
        <tr class="meta">
          <td colspan="7">
            ${cabecalho(pedidosCabecalho, cliente, meta, logo)}
            <h2 class="section-title">${esc(titulo)}</h2>
          </td>
        </tr>
        <tr class="cols">
          <th>Pedido</th>
          <th>Descrição da peça</th>
          <th>Modelo</th>
          <th>Matéria prima</th>
          <th>Medida</th>
          <th>Observações</th>
          <th class="text-right">Qtd total</th>
        </tr>
      </thead>
      <tbody>
        ${corpo}
        <tr class="total-row">
          <td colspan="6" class="text-right">TOTAL</td>
          <td class="text-right font-mono">${num(total)}</td>
        </tr>
      </tbody>
    </table>
    </div>`;
}

async function logoParaImpressao(): Promise<string | null> {
  const src = await getLogoSoAcoTransparentSrc();
  if (src.startsWith('data:')) return src;
  return imageUrlToDataUrl(src);
}

const ROTULO_TIPO: Record<string, string> = { PI: 'Apenas PI', PP: 'Apenas PP', PLANILHA: 'Peças da planilha' };

export async function imprimirOrdemGondolas(
  detalhes: DetalheItemGondola[],
  opcoes: { numero?: string; emitidaEm?: string; tipo?: string } = {}
): Promise<void> {
  const linhas = detalhes.flatMap(linhasDoDetalhe);
  const emissao = opcoes.emitidaEm ? new Date(opcoes.emitidaEm) : new Date();
  const meta: MetaOrdem = {
    data: emissao.toLocaleDateString('pt-BR'),
    hora: emissao.toLocaleTimeString('pt-BR'),
    numero: opcoes.numero ?? '',
    tipo: opcoes.tipo ? (ROTULO_TIPO[opcoes.tipo] ?? opcoes.tipo) : '',
  };
  const pedidos = [...new Set(linhas.map((linha) => linha.pedido))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const logo = await logoParaImpressao();

  const resumo = folha('Resumo consolidado', consolidar(linhas), pedidos, '', meta, logo, false);
  const porPedido = pedidos
    .map((pedido) => {
      const doPedido = linhas.filter((linha) => linha.pedido === pedido);
      const cliente = doPedido[0]?.cliente || '—';
      return folha(
        `Detalhamento — pedido ${pedido}`,
        somarPecasIguais(doPedido),
        [pedido],
        cliente,
        meta,
        logo,
        true
      );
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Ordem de produção — Gôndolas e porta-paletes</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #0f172a;
      font-family: "Segoe UI", Arial, sans-serif;
      font-size: 11px;
      line-height: 1.35;
    }
    .folha {
      width: 100%;
      border-collapse: collapse;
      margin: 0;
    }
    .pagina { display: block; }
    .folha thead { display: table-header-group; }
    .folha tr.meta td {
      border: none;
      padding: 0 0 8px;
      background: #fff;
      vertical-align: top;
    }
    .print-header {
      border-bottom: 1.5px solid #0f172a;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .print-header-main {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }
    .brand-block { display: flex; gap: 10px; align-items: center; }
    .brand-logo { width: 130px; height: auto; object-fit: contain; }
    .brand-fallback { font-size: 16px; letter-spacing: 0.4px; }
    .doc-title { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: 0.3px; }
    .doc-subtitle { margin: 2px 0 0; color: #334155; font-size: 11px; font-weight: 600; }
    .doc-meta { text-align: right; font-size: 10px; color: #334155; line-height: 1.4; }
    .doc-meta p { margin: 0; }
    .doc-meta .doc-numero { font-size: 13px; font-weight: 700; color: #0f172a; }
    .doc-info-grid {
      margin-top: 10px;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .info-card {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      border-radius: 4px;
      background: #f8fafc;
    }
    .info-card.full-width { grid-column: 1 / -1; }
    .info-label {
      margin: 0 0 2px;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #475569;
      font-weight: 700;
    }
    .info-value { margin: 0; font-size: 11px; font-weight: 600; color: #0f172a; }
    .section-title {
      margin: 0;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 4px;
    }
    .folha th, .folha td {
      border: 1px solid #cbd5e1;
      padding: 6px 7px;
      vertical-align: middle;
      font-size: 10.5px;
      text-align: left;
    }
    .folha thead tr.cols th {
      background: #f1f5f9;
      color: #0f172a;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .folha tbody tr:nth-child(even) { background: #fcfdff; }
    .cell-strong { font-weight: 700; white-space: nowrap; }
    .folha td:nth-child(5),
    .folha th:last-child,
    .folha td:last-child { white-space: nowrap; }
    .total-row td { font-weight: 700; background: #f8fafc; }
    .font-mono { font-family: ui-monospace, monospace; }
    .text-right { text-align: right; }
    @media print {
      @page { size: A4 portrait; margin: 10mm; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .folha thead { display: table-header-group; }
      .folha tbody tr { break-inside: avoid; page-break-inside: avoid; }
      .quebra { break-before: page; page-break-before: always; }
    }
  </style>
</head>
<body>
  ${resumo}
  ${porPedido}
</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.title = 'Impressão da ordem de produção';
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = '1100px';
  iframe.style.height = '1400px';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const janela = iframe.contentWindow;
  const doc = janela?.document;
  if (!janela || !doc) {
    iframe.remove();
    throw new Error('Não foi possível abrir a impressão.');
  }

  const limpar = () => {
    janela.removeEventListener('afterprint', limpar);
    iframe.remove();
  };
  janela.addEventListener('afterprint', limpar);
  doc.open();
  doc.write(html);
  doc.close();

  const esperarImagens = () =>
    Promise.all(
      Array.from(doc.images).map(
        (img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.addEventListener('load', () => resolve(), { once: true });
                img.addEventListener('error', () => resolve(), { once: true });
              })
      )
    );

  void esperarImagens().then(() => {
    janela.focus();
    janela.print();
  });
}
