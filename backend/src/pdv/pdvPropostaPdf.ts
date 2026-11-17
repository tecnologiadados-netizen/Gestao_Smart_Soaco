/**
 * HTML imprimível da proposta (a REST Nomus não expõe geração de PDF).
 * O operador pode salvar como PDF pelo diálogo de impressão do navegador.
 */

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function brl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseNum(v: unknown): number {
  const s = String(v ?? '')
    .replace(/\s+por\s+.*/i, '')
    .trim();
  if (!s) return 0;
  if (s.includes(',') && s.includes('.')) return Number(s.replace(/\./g, '').replace(',', '.')) || 0;
  if (s.includes(',')) return Number(s.replace(',', '.')) || 0;
  return Number(s) || 0;
}

export type PdfVendaLocal = {
  id: number;
  empresa: string;
  clienteNome: string;
  observacao: string;
  total: number;
  itens: Array<{
    codigo: string;
    descricao: string;
    quantidade: number;
    valorUnitario: number;
    descontoPercentual: number;
  }>;
  pagamentos: Array<{ nomeForma: string; valor: number }>;
};

export function montarHtmlPropostaPdv(input: {
  venda: PdfVendaLocal;
  proposta: Record<string, unknown> | null;
}): string {
  const prop = input.proposta ?? {};
  const codigo = String(prop.proposta ?? `PDV-${input.venda.id}`);
  const cliente = String(prop.nomeCliente ?? input.venda.clienteNome ?? 'Consumidor');
  const contato = String(prop.nomeContato ?? '');
  const empresa = String(prop.nomeEmpresa ?? input.venda.empresa ?? '');
  const tipoMov = String(prop.nomeTipoMovimentacao ?? '');
  const vendedor = String(prop.nomeVendedor ?? '');
  const abertura = String(prop.dataHoraAbertura ?? '');
  const validade = String(prop.dataValidade ?? '');
  const observacao = String(prop.observacao ?? input.venda.observacao ?? '');
  const attrs = Array.isArray(prop.atributosProposta)
    ? (prop.atributosProposta as Array<Record<string, unknown>>)
    : [];

  const itensNomus = Array.isArray(prop.itensProposta)
    ? (prop.itensProposta as Array<Record<string, unknown>>)
    : [];
  const itens =
    itensNomus.length > 0
      ? itensNomus.map((row, i) => {
          const qtde = parseNum(row.qtde ?? row.quantidade) || 1;
          const unit = parseNum(row.precoUnitario ?? row.valorUnitario);
          const totalLinha = parseNum(row.valorTotal) || qtde * unit;
          return {
            item: String(row.item ?? String(i + 1).padStart(2, '0')),
            codigo: String(row.codigoProduto ?? ''),
            descricao: String(row.descricaoProduto ?? row.nomeProduto ?? ''),
            qtde,
            unit,
            total: totalLinha,
          };
        })
      : input.venda.itens.map((row, i) => {
          const totalLinha = row.quantidade * row.valorUnitario * (1 - (row.descontoPercentual || 0) / 100);
          return {
            item: String(i + 1).padStart(2, '0'),
            codigo: row.codigo,
            descricao: row.descricao,
            qtde: row.quantidade,
            unit: row.valorUnitario,
            total: totalLinha,
          };
        });

  const total = parseNum(prop.valorTotal) || input.venda.total || itens.reduce((s, i) => s + i.total, 0);

  const attrsHtml = attrs.length
    ? `<section><h2>Atributos</h2><dl>${attrs
        .map(
          (a) =>
            `<div><dt>${esc(a.nomeAtributo)}</dt><dd>${esc(a.valorAtributo)}</dd></div>`,
        )
        .join('')}</dl></section>`
    : '';

  const linhas = itens
    .map(
      (i) => `<tr>
      <td>${esc(i.item)}</td>
      <td>${esc(i.codigo)}</td>
      <td>${esc(i.descricao)}</td>
      <td class="num">${esc(i.qtde)}</td>
      <td class="num">${esc(brl(i.unit))}</td>
      <td class="num">${esc(brl(i.total))}</td>
    </tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Proposta ${esc(codigo)}</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: "Segoe UI", Arial, sans-serif; color: #111; margin: 24px; font-size: 13px; }
    h1 { margin: 0 0 4px; font-size: 22px; }
    h2 { margin: 18px 0 8px; font-size: 14px; text-transform: uppercase; letter-spacing: .04em; color: #333; }
    .muted { color: #555; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-top: 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border-bottom: 1px solid #ddd; padding: 8px 6px; text-align: left; vertical-align: top; }
    th { font-size: 11px; text-transform: uppercase; color: #444; }
    td.num, th.num { text-align: right; white-space: nowrap; }
    dl { display: grid; grid-template-columns: 220px 1fr; gap: 6px 12px; margin: 0; }
    dt { color: #555; } dd { margin: 0; font-weight: 600; }
    .total { margin-top: 16px; font-size: 18px; font-weight: 700; text-align: right; }
    .obs { white-space: pre-wrap; border: 1px solid #e5e5e5; padding: 10px; border-radius: 8px; }
    .actions { margin: 16px 0; }
    @media print { .actions { display: none; } body { margin: 12mm; } }
  </style>
</head>
<body>
  <div class="actions">
    <button onclick="window.print()">Imprimir / salvar PDF</button>
  </div>
  <header>
    <h1>Proposta comercial ${esc(codigo)}</h1>
    <div class="muted">${esc(empresa)} · PDV #${esc(input.venda.id)}</div>
  </header>
  <div class="grid">
    <div><strong>Cliente</strong><br>${esc(cliente)}${contato ? `<br><span class="muted">Contato: ${esc(contato)}</span>` : ''}</div>
    <div>
      ${abertura ? `<div><strong>Abertura</strong><br>${esc(abertura)}</div>` : ''}
      ${validade ? `<div style="margin-top:6px"><strong>Validade</strong><br>${esc(validade)}</div>` : ''}
      ${tipoMov ? `<div style="margin-top:6px"><strong>Tipo de movimentação</strong><br>${esc(tipoMov)}</div>` : ''}
      ${vendedor ? `<div style="margin-top:6px"><strong>Vendedor</strong><br>${esc(vendedor)}</div>` : ''}
    </div>
  </div>
  ${attrsHtml}
  <section>
    <h2>Itens</h2>
    <table>
      <thead>
        <tr>
          <th>Item</th><th>Código</th><th>Descrição</th>
          <th class="num">Qtde</th><th class="num">Unitário</th><th class="num">Total</th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>
    <div class="total">Total ${esc(brl(total))}</div>
  </section>
  ${
    observacao
      ? `<section><h2>Observação</h2><div class="obs">${esc(observacao)}</div></section>`
      : ''
  }
  <p class="muted" style="margin-top:24px">Documento gerado no PDV Só Aço. Layout oficial Jasper do Nomus pode ser adotado quando a API disponibilizar o PDF.</p>
  <script>window.addEventListener('load',()=>{ if(new URLSearchParams(location.search).get('print')==='1'){ setTimeout(()=>window.print(),250);} });</script>
</body>
</html>`;
}
