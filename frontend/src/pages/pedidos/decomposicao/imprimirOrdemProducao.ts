import { nomeGrupo, type OrdemProducao, type OrdemProducaoPeca } from '../../../api/decomposicao';
import { getLogoSoAcoTransparentSrc, imageUrlToDataUrl } from '../../../utils/imageDataUrl';

function esc(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function num(valor: number | null): string {
  if (valor == null) return '—';
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

function textoOuTraco(valor: string): string {
  const limpo = valor.trim();
  return esc(limpo || '-');
}

function corpoDetalhado(ordem: OrdemProducao, pecas: OrdemProducaoPeca[]): string {
  const linhas = pecas
    .map(
      (peca) => `
      <tr style="font-size: 12px; font-weight: 900; text-transform: uppercase;">
        <td style="padding: 10px; border: 1.5px solid #000; text-align: left;">${esc(peca.descricao)}</td>
        <td style="padding: 10px; border: 1.5px solid #000; text-align: center; font-size: 14px; background: #fffbeb; color: #002855;">${num(peca.quantidadeTotal)}</td>
        <td style="padding: 10px; border: 1.5px solid #000; text-align: center; color: #c2410c;">${textoOuTraco(peca.medidaL)}</td>
        <td style="padding: 10px; border: 1.5px solid #000; text-align: center; color: #c2410c;">${textoOuTraco(peca.medidaA)}</td>
        <td style="padding: 10px; border: 1.5px solid #000; text-align: left;">${textoOuTraco(peca.materiaPrima)}</td>
        <td style="padding: 10px; border: 1.5px solid #000; text-align: center; font-weight: 900; color: #002855;">${textoOuTraco(peca.medidaCorte ?? '')}</td>
        <td style="padding: 10px; border: 1.5px solid #000; text-align: left; font-size: 11px; color: #475569; font-weight: normal;">${textoOuTraco(peca.observacao ?? '')}</td>
      </tr>`
    )
    .join('');
  const totalPecas = pecas.reduce((soma, peca) => soma + (Number(peca.quantidadeTotal) || 0), 0);

  return `
    <div style="margin-top: 15px;">
      <table style="width: 100%; border-collapse: collapse; border: 2px solid #002855; margin-bottom: 15px;">
        <thead>
          <tr style="background: #002855; color: #fff; font-size: 11px; text-transform: uppercase;">
            <th style="padding: 10px 14px; text-align: left; width: 140px; border-right: 1px solid rgba(255,255,255,0.2);">Código produto</th>
            <th style="padding: 10px 14px; text-align: left;">Descrição do produto</th>
            <th style="padding: 10px 14px; text-align: center; width: 180px; border-left: 1px solid rgba(255,255,255,0.2); background: #FFB800; color: #002855; font-weight: 950;">Quantidade a produzir</th>
          </tr>
        </thead>
        <tbody>
          <tr style="font-size: 16px; font-weight: 900; text-transform: uppercase; background: #f8fafc;">
            <td style="padding: 14px; color: #002855; font-size: 14px; font-weight: 950; border-right: 1px solid #cbd5e1;">${esc(ordem.codigoPai)}</td>
            <td style="padding: 14px; color: #002855;">${esc(ordem.nomePai)}</td>
            <td style="padding: 14px; text-align: center; color: #002855; font-size: 18px; font-weight: 950; background: #fffbeb; border-left: 1px solid #cbd5e1;">
              ${num(ordem.quantidade)} UNIDADES
            </td>
          </tr>
        </tbody>
      </table>

      <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000;">
        <thead>
          <tr style="background: #FFB800; color: #000; font-size: 13px; text-align: center;">
            <th colspan="7" style="padding: 10px; border: 1.5px solid #000; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">
              Detalhamento técnico de peças cadastradas (quantidade multiplicada para ${num(ordem.quantidade)} unidades)
            </th>
          </tr>
          <tr style="background: #000; color: #fff; font-size: 10px; text-transform: uppercase;">
            <th style="padding: 8px; border: 1.5px solid #000; text-align: left;">Componente / peça</th>
            <th style="padding: 8px; border: 1.5px solid #000; width: 80px; text-align: center;">Qtd total</th>
            <th style="padding: 8px; border: 1.5px solid #000; width: 75px; text-align: center;">L (mm)</th>
            <th style="padding: 8px; border: 1.5px solid #000; width: 75px; text-align: center;">A (mm)</th>
            <th style="padding: 8px; border: 1.5px solid #000; text-align: left;">Matéria prima</th>
            <th style="padding: 8px; border: 1.5px solid #000; width: 140px; text-align: center;">Medida de corte</th>
            <th style="padding: 8px; border: 1.5px solid #000; text-align: left;">Observação</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
        <tfoot>
          <tr style="background: #f1f5f9; font-size: 11px; font-weight: 900; text-transform: uppercase;">
            <td style="padding: 8px 10px; border: 1.5px solid #000;">Total de peças a cortar/produzir:</td>
            <td style="padding: 8px 10px; border: 1.5px solid #000; text-align: center; background: #FFB800; color: #002855; font-size: 13px;">
              ${num(totalPecas)} peças
            </td>
            <td colspan="5" style="padding: 8px 10px; border: 1.5px solid #000; color: #64748b; font-size: 10px;">
              ${pecas.length} componentes nesta ordem
            </td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}

function corpoSimples(ordem: OrdemProducao): string {
  return `
    <div style="margin-top: 15px;">
      <table style="width: 100%; border-collapse: collapse; border: 2px solid #001a35;">
        <thead>
          <tr style="background: #FFB800; color: #000; font-size: 12px; font-weight: 900; text-transform: uppercase; text-align: center;">
            <th colspan="2" style="padding: 10px; border-bottom: 2px solid #001a35;">Identificação do produto</th>
          </tr>
          <tr style="background: #001a35; color: #fff; font-size: 10px; font-weight: 900; text-transform: uppercase;">
            <th style="padding: 12px; text-align: left; border: 1.5px solid #001a35;">Descrição do item a ser produzido</th>
            <th style="padding: 12px; text-align: center; border: 1.5px solid #001a35; width: 150px;">Quantidade</th>
          </tr>
        </thead>
        <tbody>
          <tr style="font-size: 18px; font-weight: 950; text-transform: uppercase; color: #001a35;">
            <td style="padding: 25px 12px; border: 1.5px solid #001a35; vertical-align: middle;">
              <span style="font-size: 12px; color: #64748b; display: block; margin-bottom: 4px;">Cód: ${esc(ordem.codigoPai)}</span>
              ${esc(ordem.nomePai)}
            </td>
            <td style="padding: 25px 12px; border: 1.5px solid #001a35; text-align: center; background: #f8fafc; vertical-align: middle;">
              ${num(ordem.quantidade)} UNIDADES
            </td>
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

export async function imprimirOrdemProducao(ordem: OrdemProducao): Promise<void> {
  const logo = await logoParaImpressao();
  const pecas = (ordem.pecas ?? []).filter((peca) => peca.imprimir !== false);
  const corpo = pecas.length > 0 ? corpoDetalhado(ordem, pecas) : corpoSimples(ordem);
  const emissao = new Date(ordem.createdAt).toLocaleDateString('pt-BR');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>SÓ AÇO - Ordem ${esc(ordem.numero)}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 0; margin: 0; color: #001a35; line-height: 1.2; background: #fff; }
    .header { background: #001a35; color: white; padding: 15px 30px; display: flex; justify-content: space-between; align-items: center; border-bottom: 5px solid #FFB800; }
    .logo-section { display: flex; align-items: center; gap: 15px; }
    .logo-img { height: 46px; width: auto; display: block; background: transparent; }
    .logo-text { font-size: 28px; font-weight: 900; font-style: italic; letter-spacing: -1px; }
    .logo-sa { color: #FFB800; }
    .header-title { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; border-left: 2px solid rgba(255,255,255,0.2); padding-left: 15px; }
    .id-box { background: #FFB800; color: #000; padding: 8px 25px; border-radius: 6px; font-weight: 950; font-size: 18px; }
    .id-label { font-size: 10px; font-weight: 900; color: #FFB800; margin-right: 10px; }
    .content { padding: 25px 30px; }
    .info-bar { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 15px; background: #f1f5f9; padding: 12px 20px; border-radius: 10px; border: 1px solid #e2e8f0; margin-bottom: 10px; }
    .info-item .label { font-size: 8px; font-weight: 900; color: #64748b; text-transform: uppercase; margin-bottom: 3px; }
    .info-item .value { font-size: 13px; font-weight: 900; color: #001a35; text-transform: uppercase; }
    .notes-section { margin-top: 25px; border: 1.5px dashed #cbd5e1; border-radius: 12px; padding: 15px; background: #f8fafc; }
    .notes-label { font-size: 9px; font-weight: 900; color: #002855; text-transform: uppercase; margin-bottom: 6px; }
    .notes-text { font-size: 11px; color: #475569; font-weight: 500; }
    .signature-container { margin-top: 50px; display: flex; justify-content: space-between; padding: 0 20px; }
    .sig-block { width: 45%; text-align: center; }
    .sig-line { border-top: 2px solid #000; margin-bottom: 8px; }
    .sig-label { font-size: 10px; font-weight: 900; text-transform: uppercase; color: #002855; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-section">
      ${
        logo
          ? `<img class="logo-img" src="${logo}" alt="Só Aço" />`
          : `<div class="logo-text"><span class="logo-sa">SÓ</span> AÇO</div>`
      }
      <div class="header-title">Ordem de serviço industrial</div>
    </div>
    <div style="display: flex; align-items: center;">
      <span class="id-label">ID da ordem:</span>
      <div class="id-box">${esc(ordem.numero)}</div>
    </div>
  </div>
  <div class="content">
    <div class="info-bar">
      <div class="info-item">
        <div class="label">Setor responsável</div>
        <div class="value">${esc(nomeGrupo(ordem.grupo))}</div>
      </div>
      <div class="info-item">
        <div class="label">Código produto</div>
        <div class="value">${esc(ordem.codigoPai)}</div>
      </div>
      <div class="info-item">
        <div class="label">Qtd a produzir</div>
        <div class="value">${num(ordem.quantidade)} unidades</div>
      </div>
      <div class="info-item">
        <div class="label">Data emissão</div>
        <div class="value">${esc(emissao)}</div>
      </div>
    </div>
    ${corpo}
    <div class="notes-section">
      <div class="notes-label">Instruções e observações técnicas</div>
      <div class="notes-text">${esc(ordem.observacao || 'Sem observações adicionais para esta ordem.')}</div>
    </div>
    <div class="signature-container">
      <div class="sig-block"><div class="sig-line"></div><div class="sig-label">Produção / encarregado</div></div>
      <div class="sig-block"><div class="sig-line"></div><div class="sig-label">Qualidade / conferência</div></div>
    </div>
  </div>
</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.title = 'Impressão da ordem de serviço';
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
    return;
  }

  const limpar = () => {
    janela.removeEventListener('afterprint', limpar);
    iframe.remove();
  };
  janela.addEventListener('afterprint', limpar);

  doc.open();
  doc.write(html);
  doc.close();

  janela.requestAnimationFrame(() => {
    janela.focus();
    janela.print();
  });
}
