import { jsPDF } from "jspdf";
import { CRITERIOS_AVALIACAO, NOTA_MAX } from "@qualidade/lib/avaliacao-fornecedor/criterios";
import type { AvaliacaoDetalheViewModel } from "@qualidade/lib/avaliacao-fornecedor/montar-detalhe-avaliacao";
import type { AvaliacaoFornecedor } from "@qualidade/types/avaliacao-fornecedor";

const MARGIN = 12;
const CONTENT_W = 186;
const PAGE_H = 297;

const C = {
  bg: [255, 255, 255] as const,
  header: [45, 53, 196] as const,
  yellow: [245, 197, 24] as const,
  fieldBorder: [59, 65, 212] as const,
  fieldBg: [248, 250, 252] as const,
  cardBg: [255, 255, 255] as const,
  border: [200, 205, 215] as const,
  text: [30, 35, 45] as const,
  muted: [100, 110, 125] as const,
  primary: [45, 53, 196] as const,
  starFill: [251, 176, 59] as const,
  starStroke: [212, 136, 10] as const,
  starEmpty: [243, 234, 216] as const,
  starEmptyStroke: [220, 201, 163] as const,
  badge: [59, 65, 212] as const,
  white: [255, 255, 255] as const,
};

export function nomeArquivoAvaliacaoFornecedorPdf(
  avaliacao: AvaliacaoFornecedor
): string {
  const doc =
    avaliacao.numeroDocumento?.replace(/[^\w.-]+/g, "_").trim() || "avaliacao";
  const fornecedor = avaliacao.fornecedorId
    .replace(/[^\w.-]+/g, "_")
    .slice(0, 24);
  return `Avaliacao_Fornecedor_${doc}_${fornecedor}.pdf`;
}

function setFill(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}

function setDraw(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}

function setText(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function verticesEstrela(cx: number, cy: number, raioExt: number): [number, number][] {
  const raioInt = raioExt * 0.42;
  const vertices: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const raio = i % 2 === 0 ? raioExt : raioInt;
    const angulo = -Math.PI / 2 + (i * Math.PI) / 5;
    vertices.push([cx + raio * Math.cos(angulo), cy + raio * Math.sin(angulo)]);
  }
  return vertices;
}

function desenharEstrela(
  doc: jsPDF,
  cx: number,
  cy: number,
  raio: number,
  preenchida: boolean
) {
  const vertices = verticesEstrela(cx, cy, raio);
  const segmentos: number[][] = [
    [vertices[0][0] - cx, vertices[0][1] - cy],
  ];
  for (let i = 1; i < vertices.length; i++) {
    segmentos.push([
      vertices[i][0] - vertices[i - 1][0],
      vertices[i][1] - vertices[i - 1][1],
    ]);
  }

  if (preenchida) {
    setFill(doc, C.starFill);
    setDraw(doc, C.starStroke);
  } else {
    setFill(doc, C.starEmpty);
    setDraw(doc, C.starEmptyStroke);
  }
  doc.setLineWidth(0.15);
  doc.lines(segmentos, cx, cy, [1, 1], "FD", true);
}

function desenharEstrelas(
  doc: jsPDF,
  x: number,
  y: number,
  nota: number,
  tamanho = 2.2,
  espaco = 5.2
) {
  const valor = Math.round(nota);
  for (let i = 0; i < NOTA_MAX; i++) {
    desenharEstrela(doc, x + i * espaco + tamanho, y + tamanho * 0.15, tamanho, i < valor);
  }
}

function quebrarTexto(doc: jsPDF, texto: string, larguraMax: number): string[] {
  return doc.splitTextToSize(texto, larguraMax) as string[];
}

class PdfLayout {
  y = MARGIN;

  constructor(private doc: jsPDF) {
    this.pintarPagina();
  }

  private pintarPagina() {
    setFill(this.doc, C.bg);
    this.doc.rect(0, 0, 210, PAGE_H, "F");
  }

  novaPaginaSeNecessario(altura: number) {
    if (this.y + altura > PAGE_H - MARGIN) {
      this.doc.addPage();
      this.pintarPagina();
      this.y = MARGIN;
    }
  }

  cabecalho(fornecedorNome: string) {
    const altura = 22;
    setFill(this.doc, C.header);
    this.doc.rect(MARGIN, this.y, CONTENT_W, altura, "F");
    setFill(this.doc, C.yellow);
    this.doc.rect(MARGIN, this.y + altura - 1.2, CONTENT_W, 1.2, "F");

    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(12);
    setText(this.doc, C.white);
    this.doc.text("Detalhe da avaliação", MARGIN + 4, this.y + 8);

    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8);
    const linhas = quebrarTexto(this.doc, fornecedorNome, CONTENT_W - 8);
    this.doc.text(linhas.slice(0, 2), MARGIN + 4, this.y + 14);

    this.y += altura + 5;
  }

  campoRotuloValor(
    x: number,
    y: number,
    largura: number,
    rotulo: string,
    valor: string
  ) {
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(7);
    setText(this.doc, C.muted);
    this.doc.text(rotulo, x, y);

    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(9);
    setText(this.doc, C.text);
    const linhas = quebrarTexto(this.doc, valor, largura);
    this.doc.text(linhas, x, y + 4);
    return 4 + linhas.length * 4;
  }

  cardNota(
    x: number,
    y: number,
    largura: number,
    altura: number,
    titulo: string,
    descricao: string | undefined,
    nota: number | null
  ) {
    setFill(this.doc, C.cardBg);
    setDraw(this.doc, C.border);
    this.doc.setLineWidth(0.2);
    this.doc.roundedRect(x, y, largura, altura, 2, 2, "FD");

    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(7);
    setText(this.doc, C.muted);
    this.doc.text(titulo, x + 3, y + 5);

    if (descricao) {
      this.doc.setFontSize(6);
      const descLinhas = quebrarTexto(this.doc, descricao, largura - 6);
      this.doc.text(descLinhas.slice(0, 2), x + 3, y + 9);
    }

    if (typeof nota === "number") {
      desenharEstrelas(this.doc, x + 3, y + 12, nota, 2.1, 5);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(12);
      setText(this.doc, C.primary);
      this.doc.text(`${nota.toFixed(1)}/${NOTA_MAX}`, x + largura - 3, y + 17, {
        align: "right",
      });
    } else {
      this.doc.setFontSize(9);
      setText(this.doc, C.muted);
      this.doc.text("—", x + 3, y + 17);
    }
  }

  badgeSim(x: number, y: number, texto: string) {
    const w = this.doc.getTextWidth(texto) + 6;
    setFill(this.doc, C.badge);
    this.doc.roundedRect(x, y - 3.5, w, 5, 1, 1, "F");
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(8);
    setText(this.doc, C.white);
    this.doc.text(texto, x + 3, y);
  }
}

export function gerarAvaliacaoFornecedorPdf(
  viewModel: AvaliacaoDetalheViewModel
): jsPDF {
  const { avaliacao } = viewModel;
  const doc = new jsPDF("p", "mm", "a4");
  const layout = new PdfLayout(doc);

  layout.cabecalho(avaliacao.fornecedorNome);

  const dadosInicioY = layout.y;
  layout.novaPaginaSeNecessario(50);
  const dadosX = MARGIN;
  const dadosPad = 4;
  const dadosLargura = CONTENT_W;
  const colW = (dadosLargura - dadosPad * 2) / 2 - 2;

  const campos: Array<[string, string, boolean]> = [
    ["Data referência", viewModel.dataReferenciaFormatada, false],
    ["Data avaliação", viewModel.dataAvaliacaoFormatada, false],
    ["Responsável", viewModel.avaliadorNome, false],
    ["Nº documento", avaliacao.numeroDocumento || "—", false],
    ["Fornecedor aprovado", viewModel.fornecedorAprovadoLabel ?? "—", true],
  ];
  if (avaliacao.rncNumero) {
    campos.push(["RNC Nº", avaliacao.rncNumero, false]);
  }

  const dadosAltura = Math.max(
    Math.ceil(campos.length / 2) * 14 + 4,
    28
  );

  setDraw(doc, C.fieldBorder);
  doc.setLineWidth(0.6);
  doc.line(dadosX, dadosInicioY + 2, dadosX, dadosInicioY + dadosAltura + 12);
  setDraw(doc, C.border);
  doc.setLineWidth(0.25);
  setFill(doc, C.fieldBg);
  doc.roundedRect(dadosX, dadosInicioY, dadosLargura, dadosAltura + 12, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setText(doc, C.fieldBorder);
  setFill(doc, C.fieldBg);
  const tituloDados = "Dados da avaliação";
  doc.rect(
    dadosX + dadosPad,
    dadosInicioY - 1,
    doc.getTextWidth(tituloDados) + 4,
    5,
    "F"
  );
  doc.text(tituloDados, dadosX + dadosPad + 2, dadosInicioY + 3);

  campos.forEach(([rotulo, valor, isBadge], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const cx = dadosX + dadosPad + col * (colW + 4);
    const cy = dadosInicioY + 8 + row * 14;
    if (isBadge && viewModel.fornecedorAprovadoLabel === "Sim") {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      setText(doc, C.muted);
      doc.text(rotulo, cx, cy);
      layout.badgeSim(cx, cy + 5, "Sim");
    } else if (!isBadge) {
      layout.campoRotuloValor(cx, cy, colW, rotulo, valor);
    } else {
      layout.campoRotuloValor(cx, cy, colW, rotulo, valor);
    }
  });

  layout.y = dadosInicioY + dadosAltura + 16;

  const cardsY = layout.y;
  const cardW = (CONTENT_W - 4) / 2;
  const cardH = 22;
  layout.novaPaginaSeNecessario(cardH + 4);
  layout.cardNota(
    MARGIN,
    cardsY,
    cardW,
    cardH,
    "Nota desta avaliação",
    viewModel.descricaoNotaDocumento,
    avaliacao.media
  );
  layout.cardNota(
    MARGIN + cardW + 4,
    cardsY,
    cardW,
    cardH,
    "Média do fornecedor (6 meses)",
    viewModel.descricaoMediaSeisMeses,
    viewModel.mediaSeisMeses.media
  );
  layout.y = cardsY + cardH + 6;

  const criteriosInicioY = layout.y;
  layout.novaPaginaSeNecessario(CRITERIOS_AVALIACAO.length * 12 + 14);
  const criteriosX = MARGIN;
  const criteriosPad = 4;
  const criteriosLargura = CONTENT_W;
  const itemH = 10;
  const criteriosAltura = 8 + CRITERIOS_AVALIACAO.length * (itemH + 2);

  setDraw(doc, C.fieldBorder);
  doc.setLineWidth(0.6);
  doc.line(
    criteriosX,
    criteriosInicioY + 2,
    criteriosX,
    criteriosInicioY + criteriosAltura + 6
  );
  setDraw(doc, C.border);
  doc.setLineWidth(0.25);
  setFill(doc, C.fieldBg);
  doc.roundedRect(
    criteriosX,
    criteriosInicioY,
    criteriosLargura,
    criteriosAltura + 6,
    2,
    2,
    "FD"
  );
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setText(doc, C.fieldBorder);
  setFill(doc, C.fieldBg);
  const tituloCriterios = "Notas por critério";
  doc.rect(
    criteriosX + criteriosPad,
    criteriosInicioY - 1,
    doc.getTextWidth(tituloCriterios) + 4,
    5,
    "F"
  );
  doc.text(tituloCriterios, criteriosX + criteriosPad + 2, criteriosInicioY + 3);

  CRITERIOS_AVALIACAO.forEach((criterio, index) => {
    const iy = criteriosInicioY + 8 + index * (itemH + 2);
    setFill(doc, C.cardBg);
    setDraw(doc, C.border);
    doc.setLineWidth(0.15);
    doc.roundedRect(
      criteriosX + criteriosPad,
      iy,
      criteriosLargura - criteriosPad * 2,
      itemH,
      1.5,
      1.5,
      "FD"
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setText(doc, C.text);
    doc.text(criterio.label, criteriosX + criteriosPad + 3, iy + 6.5);

    const nota = avaliacao.notas[criterio.id];
    if (typeof nota === "number") {
      desenharEstrelas(
        doc,
        criteriosX + criteriosLargura - criteriosPad - 28,
        iy + 2.5,
        nota,
        1.7,
        4.2
      );
      doc.setFontSize(7);
      setText(doc, C.muted);
      doc.text(
        `${nota}/${NOTA_MAX}`,
        criteriosX + criteriosLargura - criteriosPad - 3,
        iy + 8.5,
        { align: "right" }
      );
    } else {
      setText(doc, C.muted);
      doc.text("—", criteriosX + criteriosLargura - criteriosPad - 6, iy + 6.5, {
        align: "right",
      });
    }
  });

  layout.y = criteriosInicioY + criteriosAltura + 10;

  if (avaliacao.observacoes?.trim()) {
    layout.novaPaginaSeNecessario(20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setText(doc, C.muted);
    doc.text("Observações", MARGIN, layout.y);
    doc.setFontSize(8);
    setText(doc, C.text);
    const linhas = quebrarTexto(doc, avaliacao.observacoes, CONTENT_W);
    doc.text(linhas, MARGIN, layout.y + 5);
  }

  return doc;
}

export async function baixarAvaliacaoFornecedorPdf(
  viewModel: AvaliacaoDetalheViewModel
): Promise<void> {
  const doc = gerarAvaliacaoFornecedorPdf(viewModel);
  doc.save(nomeArquivoAvaliacaoFornecedorPdf(viewModel.avaliacao));
}
