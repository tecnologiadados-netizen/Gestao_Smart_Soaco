import { jsPDF } from 'jspdf';
import { imageUrlToDataUrl } from '../../utils/imageDataUrl';

const LOGO_URL = '/logo-soaco-email.png';

const COR = {
  tinta: [30, 41, 59] as [number, number, number],
  suave: [71, 85, 105] as [number, number, number],
  linha: [203, 213, 225] as [number, number, number],
  avisoFundo: [255, 247, 237] as [number, number, number],
  avisoBorda: [217, 119, 6] as [number, number, number],
  avisoTexto: [120, 53, 15] as [number, number, number],
  volumeFundo: [241, 245, 249] as [number, number, number],
  branco: [255, 255, 255] as [number, number, number],
};

/** A4 em pé. O canhoto ocupa só a metade de cima; a de baixo fica em branco para o corte. */
const FOLHA_ALTURA = 297;
const MEIA_FOLHA = FOLHA_ALTURA / 2;
const MARGEM = 12;

const nfInteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

export type DocumentoApoioVolumesInput = {
  numeroDocumento: string;
  numeroNfe: string;
  dataDocumento: string;
  fornecedor: string;
  qtdeVolumes: number;
  emitidoPor: string | null;
};

function linhas(doc: jsPDF, texto: string, largura: number): string[] {
  return doc.splitTextToSize(texto, largura) as string[];
}

function limitarLinhas(doc: jsPDF, texto: string, largura: number, maxLinhas: number): string[] {
  const partes = linhas(doc, texto, largura);
  if (partes.length <= maxLinhas) return partes;
  const cortadas = partes.slice(0, maxLinhas);
  const ultima = cortadas[maxLinhas - 1] ?? '';
  cortadas[maxLinhas - 1] = ultima.replace(/\s+\S*$/, '').replace(/[.,;:]+$/, '') + '…';
  return cortadas;
}

export async function montarDocumentoApoioVolumesPdf(
  input: DocumentoApoioVolumesInput,
  logoBase64?: string | null,
): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logo = logoBase64 === undefined ? await imageUrlToDataUrl(LOGO_URL) : logoBase64;
  const largura = doc.internal.pageSize.getWidth();
  const util = largura - MARGEM * 2;
  let y = 10;

  doc.setProperties({
    title: `Documento de apoio — ${input.numeroDocumento}`,
    subject:
      'Canhoto interno. Espelha apenas a quantidade de volumes escrita na nota fiscal. Não representa volumes recebidos fisicamente.',
    creator: 'Gestão Smart',
  });

  const logoW = 34;
  const logoH = 11;
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', MARGEM, y, logoW, logoH);
    } catch {
      /* segue sem logo */
    }
  }

  const textoX = logo ? MARGEM + logoW + 4 : MARGEM;
  doc.setTextColor(...COR.tinta);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Documento de apoio', textoX, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...COR.suave);
  doc.text('Canhoto interno do almoxarifado', textoX, y + 9.5);

  const selo = 'NÃO FORMAL';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const seloW = doc.getTextWidth(selo) + 6;
  const seloX = largura - MARGEM - seloW;
  doc.setFillColor(...COR.avisoFundo);
  doc.setDrawColor(...COR.avisoBorda);
  doc.setLineWidth(0.3);
  doc.roundedRect(seloX, y + 1.2, seloW, 6.2, 1, 1, 'FD');
  doc.setTextColor(...COR.avisoTexto);
  doc.text(selo, seloX + 3, y + 5.4);

  y = 24;
  doc.setDrawColor(...COR.linha);
  doc.setLineWidth(0.2);
  doc.line(MARGEM, y, largura - MARGEM, y);
  y += 5;

  const aviso =
    'A empresa não usa este papel para representar os volumes que chegaram fisicamente. O número em destaque só espelha a quantidade de volumes da nota fiscal, para o conferente consultar — ele não recebe a nota em papel.';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const avisoLargura = util - 8;
  const avisoLinhas = linhas(doc, aviso, avisoLargura);
  const avisoAltura = 8 + avisoLinhas.length * 3.55 + 3;
  doc.setFillColor(...COR.avisoFundo);
  doc.setDrawColor(...COR.avisoBorda);
  doc.setLineWidth(0.35);
  doc.roundedRect(MARGEM, y, util, avisoAltura, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COR.avisoTexto);
  doc.text('Leia antes de usar — isto não é a nota fiscal', MARGEM + 4, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(avisoLinhas, MARGEM + 4, y + 9.2);
  y += avisoAltura + 4;

  const volumeAltura = 28;
  doc.setFillColor(...COR.volumeFundo);
  doc.setDrawColor(...COR.linha);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGEM, y, util, volumeAltura, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COR.suave);
  doc.text('VOLUMES ESCRITOS NA NOTA FISCAL', largura / 2, y + 6, { align: 'center' });
  doc.setFontSize(26);
  doc.setTextColor(...COR.tinta);
  doc.text(nfInteiro.format(input.qtdeVolumes), largura / 2, y + 17, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...COR.suave);
  doc.text(
    'Espelho do que veio na nota. Não é a quantidade de volumes recebido.',
    largura / 2,
    y + 23.5,
    { align: 'center' },
  );
  y += volumeAltura + 4;

  const campos: Array<[string, string]> = [
    ['Documento', input.numeroDocumento],
    ['NF-e', input.numeroNfe],
    ['Data', input.dataDocumento],
    ['Fornecedor', input.fornecedor],
  ];
  const colW = util / 4;
  doc.setFontSize(7);
  campos.forEach(([rotulo], indice) => {
    const x = MARGEM + indice * colW;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COR.suave);
    doc.text(rotulo.toUpperCase(), x, y);
  });
  y += 4.2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COR.tinta);
  let maiorAltura = 4;
  campos.forEach(([, valor], indice) => {
    const x = MARGEM + indice * colW;
    const partes = limitarLinhas(doc, valor || '—', colW - 3, 2);
    doc.text(partes, x, y);
    maiorAltura = Math.max(maiorAltura, partes.length * 4);
  });
  y += maiorAltura + 3;
  doc.setDrawColor(...COR.linha);
  doc.setLineWidth(0.15);
  doc.line(MARGEM, y, largura - MARGEM, y);
  y += 4;
  doc.setFontSize(7.5);
  doc.setTextColor(...COR.suave);
  const quando = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const quem = input.emitidoPor ? ` por ${input.emitidoPor}` : '';
  doc.text(`Gerado em ${quando}${quem}. Uso interno do almoxarifado.`, MARGEM, y);

  const corteY = MEIA_FOLHA;
  doc.setDrawColor(...COR.suave);
  doc.setLineWidth(0.25);
  doc.setLineDashPattern([1.4, 1.3], 0);
  doc.line(MARGEM, corteY, largura - MARGEM, corteY);
  doc.setLineDashPattern([], 0);
  const corte = 'corte — meia folha';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  const corteW = doc.getTextWidth(corte) + 4;
  const corteX = (largura - corteW) / 2;
  doc.setFillColor(...COR.branco);
  doc.rect(corteX, corteY - 2.2, corteW, 4.4, 'F');
  doc.setTextColor(...COR.suave);
  doc.text(corte, largura / 2, corteY + 1.1, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(
    'A metade de baixo fica em branco de propósito. Recorte no tracejado e entregue só o canhoto ao conferente.',
    largura / 2,
    corteY + 6,
    { align: 'center' },
  );

  return doc;
}

function nomeArquivo(numeroDocumento: string): string {
  const slug = numeroDocumento
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .toLowerCase();
  return `documento-apoio-volumes-${slug || 'nota'}.pdf`;
}

/** Abre o PDF para impressão. Se o navegador bloquear a janela, baixa o arquivo. */
export async function imprimirDocumentoApoioVolumes(
  input: DocumentoApoioVolumesInput,
): Promise<'aberto' | 'baixado'> {
  const doc = await montarDocumentoApoioVolumesPdf(input);
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const janela = window.open(url, '_blank', 'noopener,noreferrer');
  if (!janela) {
    doc.save(nomeArquivo(input.numeroDocumento));
    URL.revokeObjectURL(url);
    return 'baixado';
  }
  window.setTimeout(() => {
    try {
      janela.focus();
      janela.print();
    } catch {
      /* o usuário imprime pela janela do PDF */
    }
  }, 700);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'aberto';
}
