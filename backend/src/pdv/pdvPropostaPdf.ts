/**
 * HTML imprimível da proposta no layout oficial FOR-SA-0144 (modelo CP).
 * O operador salva/imprime pelo diálogo do navegador (?print=1).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let logoDataUriCache: string | null = null;

function logoDataUri(): string {
  if (logoDataUriCache) return logoDataUriCache;
  const candidatos = [
    path.join(__dirname, '../../public/pdv-proposta-logo.png'),
    path.join(process.cwd(), 'public/pdv-proposta-logo.png'),
    path.join(process.cwd(), 'backend/public/pdv-proposta-logo.png'),
  ];
  for (const p of candidatos) {
    try {
      if (!fs.existsSync(p)) continue;
      const b64 = fs.readFileSync(p).toString('base64');
      logoDataUriCache = `data:image/png;base64,${b64}`;
      return logoDataUriCache;
    } catch {
      /* tenta próximo */
    }
  }
  logoDataUriCache = '';
  return logoDataUriCache;
}

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

function numBr(n: number, casas = 2): string {
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

function parseNum(v: unknown): number {
  const s = String(v ?? '')
    .replace(/\s+por\s+.*/i, '')
    .trim();
  if (!s) return 0;
  // 1.234.567,89
  if (s.includes(',') && s.includes('.')) return Number(s.replace(/\./g, '').replace(',', '.')) || 0;
  // 1234,89
  if (s.includes(',')) return Number(s.replace(',', '.')) || 0;
  // 1.234.567 (milhar BR sem decimal)
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, '')) || 0;
  return Number(s) || 0;
}

function soData(v: unknown): string {
  const s = String(v ?? '').trim();
  if (!s) return '';
  const m = s.match(/(\d{2}\/\d{2}\/\d{4})/);
  return m ? m[1] : s;
}

const TEXTO_PADRAO_RODAPE = `PRAZO PARA ENTREGA EM ATÉ 60 DIAS, OU QUANDO FORMAR CARGA PARA A REGIÃO. PEDIDOS DE MODALIDADE RETIRADA NO MOMENTO QUE O MESMO ESTIVER DISPONÍVEL, SERÁ FATURADO AUTOMATICAMENTE E OS BOLETOS SERÃO EMITIDOS PARA COBRANÇA.
AO DAR ACEITE NESTA PROPOSTA VOCÊ CONCORDA EM USARMOS A IMAGEM DE SUA EMPRESA EM NOSSAS REDES SOCIAIS E DEMAIS CONTEÚDOS PARA CAMPANHAS DE MARKETING.
PROPOSTA VALIDA PARA A DATA DA EMISSÃO`;

export type PdfClienteProposta = {
  nome: string;
  nomeFantasia: string;
  contato: string;
  cnpjCpf: string;
  ie: string;
  email: string;
  telefone: string;
  endereco: string;
  numero: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
};

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

export type PdfPropostaExtra = {
  dataEmissao?: string;
  dataValidade?: string;
  formaPagamento?: string;
  condicaoPagamento?: string;
  observacao?: string;
};

/** Cabeçalho da proposta a partir do cadastro de empresa (Nomus). */
export type PdfCabecalhoEmpresa = {
  razaoSocial: string;
  enderecoLinha: string;
  cidadeLinha: string;
  telefoneLinha: string;
  documentoLinha: string;
  siteLinha: string;
};

export function montarHtmlPropostaPdv(input: {
  venda: PdfVendaLocal;
  proposta: Record<string, unknown> | null;
  cliente?: PdfClienteProposta | null;
  extra?: PdfPropostaExtra | null;
  cabecalho?: PdfCabecalhoEmpresa | null;
}): string {
  const prop = input.proposta ?? {};
  const cli = input.cliente;
  const extra = input.extra ?? {};
  const cab = input.cabecalho;

  const codigo = String(prop.proposta ?? `PDV-${input.venda.id}`);
  const clienteNome = String(cli?.nome || prop.nomeCliente || input.venda.clienteNome || 'Consumidor');
  const nomeFantasia = String(cli?.nomeFantasia || clienteNome);
  const contato = String(cli?.contato || prop.nomeContato || '');
  const vendedor = String(prop.nomeVendedor ?? '');
  const emissao = soData(extra.dataEmissao || prop.dataHoraAbertura || prop.dataEmissao);
  const validade = soData(extra.dataValidade || prop.dataValidade);
  const observacaoExtra = String(extra.observacao || prop.observacao || input.venda.observacao || '').trim();

  const formaPagamento =
    String(extra.formaPagamento || '').trim() ||
    input.venda.pagamentos.map((p) => p.nomeForma).filter(Boolean).join(', ') ||
    '';
  const condicaoPagamento = String(extra.condicaoPagamento || '').trim();

  const itensNomus = Array.isArray(prop.itensProposta)
    ? (prop.itensProposta as Array<Record<string, unknown>>)
    : [];
  const itens =
    itensNomus.length > 0
      ? itensNomus.map((row) => {
          const qtde = parseNum(row.qtde ?? row.quantidade) || 1;
          const unit = parseNum(row.precoUnitario ?? row.valorUnitario);
          const pct = parseNum(row.percentualDesconto ?? row.descontoPercentual);
          const bruto = qtde * unit;
          const descR = parseNum(row.valorDesconto) || (bruto * pct) / 100;
          const totalLinha = parseNum(row.valorTotalComDesconto ?? row.valorTotal) || bruto - descR;
          return {
            codigo: String(row.codigoProduto ?? ''),
            descricao: String(row.descricaoProduto ?? row.nomeProduto ?? ''),
            qtde,
            unit,
            pct,
            descR,
            total: totalLinha,
          };
        })
      : input.venda.itens.map((row) => {
          const bruto = row.quantidade * row.valorUnitario;
          const pct = row.descontoPercentual || 0;
          const descR = (bruto * pct) / 100;
          return {
            codigo: row.codigo,
            descricao: row.descricao,
            qtde: row.quantidade,
            unit: row.valorUnitario,
            pct,
            descR,
            total: bruto - descR,
          };
        });

  const vTotal = itens.reduce((s, i) => s + i.qtde * i.unit, 0);
  const vDesc = itens.reduce((s, i) => s + i.descR, 0);
  const somaItens = itens.reduce((s, i) => s + i.total, 0);
  // Prefere soma das linhas / total da venda local — valorTotal da REST às vezes vem como "3.437" (milhar BR).
  const vLiq = somaItens || input.venda.total || parseNum(prop.valorTotal);

  const razao =
    cab?.razaoSocial ||
    String(prop.nomeEmpresa || input.venda.empresa || 'Empresa').trim().toUpperCase();
  const linhaEndereco = cab?.enderecoLinha || '';
  const linhaCidade = cab?.cidadeLinha || '';
  const linhaTelefone = cab?.telefoneLinha || '';
  const linhaDoc = cab?.documentoLinha || '';
  const linhaSite = cab?.siteLinha || '';

  const linhas = itens
    .map(
      (i) => `<tr>
      <td class="cod">${esc(i.codigo)}</td>
      <td class="desc">${esc(i.descricao)}</td>
      <td class="num">${esc(numBr(i.qtde, i.qtde % 1 ? 3 : 0))}</td>
      <td class="num">${esc(brl(i.unit))}</td>
      <td class="num">${esc(numBr(i.pct))}</td>
      <td class="num">${esc(brl(i.descR))}</td>
      <td class="num">${esc(brl(i.total))}</td>
    </tr>`,
    )
    .join('');

  const cel = (label: string, value: string) =>
    `<td class="lbl">${esc(label)}</td><td class="val">${esc(value)}</td>`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Proposta ${esc(codigo)}</title>
  <style>
    @page { size: A4; margin: 8mm 8mm 10mm; }
    * { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #111;
      margin: 0;
      font-size: 10.5px;
      line-height: 1.25;
    }
    .sheet { width: 100%; max-width: 190mm; margin: 0 auto; }
    .actions { margin: 8px 0 12px; }
    .actions button {
      background: #1a2b4c; color: #fff; border: 0; padding: 8px 14px;
      border-radius: 4px; cursor: pointer; font-size: 13px;
    }
    .top {
      display: grid;
      grid-template-columns: 150px 1fr 110px;
      gap: 8px;
      align-items: start;
      border-bottom: 1.5px solid #1a2b4c;
      padding-bottom: 6px;
      margin-bottom: 6px;
    }
    .logo { width: 150px; height: auto; display: block; }
    .empresa { text-align: center; padding-top: 2px; }
    .empresa .razao {
      font-size: 15px; font-weight: 700; color: #1a2b4c; letter-spacing: .02em;
      margin: 0 0 3px;
    }
    .empresa .linha { margin: 0; font-size: 9.5px; color: #222; }
    .form-meta {
      text-align: right; font-size: 9px; color: #333; line-height: 1.35;
      border: 1px solid #bbb; padding: 4px 6px; border-radius: 2px;
    }
    table.box {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
      table-layout: fixed;
    }
    table.box td {
      border: 1px solid #9aa3ad;
      padding: 3px 5px;
      vertical-align: top;
      word-wrap: break-word;
    }
    table.box .lbl {
      width: 78px;
      background: #f3f5f8;
      color: #333;
      font-weight: 700;
      font-size: 9.5px;
      white-space: nowrap;
    }
    table.box .val { font-size: 10.5px; }
    .sec-title {
      margin: 8px 0 2px;
      font-size: 11px;
      font-weight: 700;
      color: #1a2b4c;
      text-transform: uppercase;
      letter-spacing: .03em;
    }
    table.itens { width: 100%; border-collapse: collapse; margin-top: 2px; }
    table.itens th, table.itens td {
      border: 1px solid #9aa3ad;
      padding: 4px 5px;
      vertical-align: top;
    }
    table.itens th {
      background: #1a2b4c;
      color: #fff;
      font-size: 9.5px;
      font-weight: 700;
      text-align: left;
    }
    table.itens th.num, table.itens td.num { text-align: right; white-space: nowrap; }
    table.itens td.cod { width: 72px; white-space: nowrap; }
    table.itens td.desc { width: auto; }
    .totais {
      margin-top: 4px;
      display: flex;
      justify-content: flex-end;
    }
    .totais table { border-collapse: collapse; min-width: 280px; }
    .totais td {
      border: 1px solid #9aa3ad;
      padding: 4px 8px;
      font-size: 11px;
    }
    .totais td.k { background: #f3f5f8; font-weight: 700; }
    .totais td.v { text-align: right; font-weight: 700; white-space: nowrap; }
    .totais tr.destaque td { background: #e8eef8; font-size: 12px; }
    .pagto {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 8px;
    }
    .pagto .campo {
      border: 1px solid #9aa3ad;
      min-height: 34px;
      padding: 4px 6px;
    }
    .pagto .campo .t { font-size: 9.5px; font-weight: 700; color: #333; }
    .obs-box {
      border: 1px solid #9aa3ad;
      min-height: 48px;
      padding: 5px 6px;
      margin-top: 6px;
      white-space: pre-wrap;
    }
    .obs-box .t { font-size: 9.5px; font-weight: 700; color: #333; margin-bottom: 2px; }
    .rodape-legal {
      margin-top: 8px;
      font-size: 9px;
      text-transform: uppercase;
      white-space: pre-wrap;
      color: #222;
      border-top: 1px solid #ccc;
      padding-top: 6px;
    }
    .assinaturas {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px 18px;
      margin-top: 18px;
    }
    .ass {
      border: 1px solid #9aa3ad;
      min-height: 58px;
      padding: 5px 6px;
      position: relative;
    }
    .ass .t { font-size: 9.5px; font-weight: 700; color: #333; }
    .ass .nome {
      margin-top: 18px;
      text-align: center;
      font-size: 11px;
      font-weight: 700;
    }
    .ass .linha {
      margin-top: 28px;
      border-top: 1px solid #444;
      height: 0;
    }
    @media print {
      .actions { display: none !important; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="actions">
      <button type="button" onclick="window.print()">Imprimir / salvar PDF</button>
    </div>

    <div class="top">
      ${logoDataUri() ? `<img class="logo" src="${logoDataUri()}" alt="Logo" />` : '<div class="logo"></div>'}
      <div class="empresa">
        <p class="razao">${esc(razao)}</p>
        ${linhaEndereco ? `<p class="linha">${esc(linhaEndereco)}</p>` : ''}
        ${linhaCidade ? `<p class="linha">${esc(linhaCidade)}</p>` : ''}
        ${linhaTelefone ? `<p class="linha">${esc(linhaTelefone)}</p>` : ''}
        ${linhaDoc ? `<p class="linha">${esc(linhaDoc)}</p>` : ''}
        ${linhaSite ? `<p class="linha">${esc(linhaSite)}</p>` : ''}
      </div>
      <div class="form-meta">
        <div><strong>FOR-SA-0144</strong></div>
        <div>Rev.02</div>
        <div>Data da rev.</div>
        <div>23/07/2021</div>
      </div>
    </div>

    <table class="box">
      <colgroup>
        <col style="width:78px" /><col style="width:22%" />
        <col style="width:78px" /><col style="width:18%" />
        <col style="width:90px" /><col />
      </colgroup>
      <tr>
        ${cel('Cliente :', clienteNome)}
        ${cel('Nº da Proposta :', codigo)}
        ${cel('Data de emissão:', emissao)}
      </tr>
      <tr>
        ${cel('Nome fantasia:', nomeFantasia)}
        ${cel('Contato:', contato)}
        ${cel('Data de validade:', validade)}
      </tr>
      <tr>
        ${cel('Endereço:', cli?.endereco || '')}
        ${cel('Nº', cli?.numero || '')}
        ${cel('Bairro:', cli?.bairro || '')}
      </tr>
      <tr>
        ${cel('CNPJ/CPF:', cli?.cnpjCpf || '')}
        ${cel('Munícipio:', cli?.municipio || '')}
        ${cel('Estado:', cli?.uf || '')}
      </tr>
      <tr>
        ${cel('E-mail:', cli?.email || '')}
        ${cel('Telefone:', cli?.telefone || '')}
        ${cel('Cep:', cli?.cep || '')}
      </tr>
      <tr>
        ${cel('Insc. estadual', cli?.ie || '')}
        <td class="lbl" colspan="2"></td>
        <td class="val" colspan="2"></td>
      </tr>
    </table>

    <div class="sec-title">Dados de entrega</div>
    <table class="box">
      <colgroup>
        <col style="width:78px" /><col style="width:34%" />
        <col style="width:48px" /><col style="width:12%" />
        <col style="width:48px" /><col />
      </colgroup>
      <tr>
        ${cel('Endereço:', cli?.endereco || '')}
        ${cel('Nº', cli?.numero || '')}
        ${cel('Cep:', cli?.cep || '')}
      </tr>
      <tr>
        ${cel('Bairro:', cli?.bairro || '')}
        ${cel('Munícipio:', cli?.municipio || '')}
        ${cel('Estado:', cli?.uf || '')}
      </tr>
    </table>

    <table class="itens">
      <thead>
        <tr>
          <th>Código</th>
          <th>Descrição do produto</th>
          <th class="num">Qtde</th>
          <th class="num">V. Un.</th>
          <th class="num">% Desc.</th>
          <th class="num">Desc. R$</th>
          <th class="num">Total c/ desc</th>
        </tr>
      </thead>
      <tbody>${linhas || `<tr><td colspan="7" style="text-align:center;color:#666">Sem itens</td></tr>`}</tbody>
    </table>

    <div class="totais">
      <table>
        <tr><td class="k">V. Total Desc.:</td><td class="v">${esc(brl(vDesc))}</td></tr>
        <tr><td class="k">V. Total.:</td><td class="v">${esc(brl(vTotal))}</td></tr>
        <tr class="destaque"><td class="k">V. Total C/ DESC.:</td><td class="v">${esc(brl(vLiq))}</td></tr>
      </table>
    </div>

    <div class="pagto">
      <div class="campo"><div class="t">Forma de pagamento:</div>${esc(formaPagamento)}</div>
      <div class="campo"><div class="t">Condições de Pagamento:</div>${esc(condicaoPagamento)}</div>
    </div>

    <div class="obs-box">
      <div class="t">Observações :</div>
      ${esc(observacaoExtra)}
    </div>

    <div class="rodape-legal">${esc(TEXTO_PADRAO_RODAPE)}</div>

    <div class="assinaturas">
      <div class="ass">
        <div class="t">Vendedor/Representante</div>
        <div class="nome">${esc(vendedor)}</div>
      </div>
      <div class="ass">
        <div class="t">Assinatura do cliente</div>
        <div class="linha"></div>
      </div>
      <div class="ass">
        <div class="t">Data de autorização</div>
        <div class="linha"></div>
      </div>
      <div class="ass">
        <div class="t">Autorização</div>
        <div class="linha"></div>
      </div>
    </div>
  </div>
  <script>
    window.addEventListener('load', () => {
      if (new URLSearchParams(location.search).get('print') === '1') {
        setTimeout(() => window.print(), 280);
      }
    });
  </script>
</body>
</html>`;
}
