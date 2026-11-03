import { Workbook, type Worksheet } from 'exceljs';
import type { ComponenteFicha, DetalheItemGondola, ItemCarteiraGondola, OrigemFicha } from '../../../api/gondolasPortaPaletes';

const COLUNAS: { titulo: string; largura: number; valor: (item: ItemCarteiraGondola) => string | number | Date | null }[] = [
  { titulo: 'Pedido', largura: 12, valor: (item) => item.pedido },
  { titulo: 'Cliente', largura: 40, valor: (item) => item.cliente },
  { titulo: 'Código', largura: 14, valor: (item) => item.codigo },
  { titulo: 'Ficha', largura: 12, valor: (item) => rotuloFicha(item.origem) },
  { titulo: 'Descrição', largura: 70, valor: (item) => item.descricao },
  { titulo: 'Setor', largura: 15, valor: (item) => item.setor },
  { titulo: 'Entrega', largura: 12, valor: (item) => dataEntrega(item.dataEntrega) },
  { titulo: 'Status', largura: 14, valor: (item) => item.status },
  { titulo: 'Pedida', largura: 11, valor: (item) => item.qtdePedida },
  { titulo: 'Pendente', largura: 11, valor: (item) => item.pendente },
  { titulo: 'Pendente real', largura: 14, valor: (item) => item.qtdePendenteReal },
];

const PRIMEIRA_NUMERICA = 9;

const COLUNAS_COMPONENTES: { titulo: string; largura: number }[] = [
  { titulo: 'Pedido', largura: 12 },
  { titulo: 'Cliente', largura: 34 },
  { titulo: 'Código', largura: 16 },
  { titulo: 'Descrição', largura: 70 },
  { titulo: 'Tipo', largura: 10 },
  { titulo: 'Ficha', largura: 11 },
  { titulo: 'Matéria prima', largura: 22 },
  { titulo: 'Medida 01', largura: 11 },
  { titulo: 'Medida 02', largura: 11 },
  { titulo: 'Modelo', largura: 14 },
  { titulo: 'Qtd na ficha', largura: 12 },
  { titulo: 'Qtd total', largura: 12 },
  { titulo: 'Em ordem', largura: 16 },
];

const QTD_FICHA = 11;
const QTD_TOTAL = 12;

function rotuloFicha(origem: OrigemFicha): string {
  return origem === 'nomus' ? 'Nomus' : origem === 'planilha' ? 'Planilha' : 'Sem ficha';
}

function dataEntrega(iso: string): Date | null {
  const [ano, mes, dia] = (iso ?? '').slice(0, 10).split('-').map(Number);
  if (!ano || !mes || !dia) return null;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function letraColuna(indice: number): string {
  let n = indice;
  let letra = '';
  do {
    letra = String.fromCharCode(65 + (n % 26)) + letra;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letra;
}

function formatoQuantidade(valor: unknown): string {
  return Number.isInteger(valor) ? '#,##0' : '#,##0.00';
}

function abaCarteira(wb: Workbook, itens: ItemCarteiraGondola[]) {
  const ws = wb.addWorksheet('Carteira', { views: [{ state: 'frozen', ySplit: 1 }] });
  const ultimaLinha = itens.length + 1;

  ws.addTable({
    name: 'CarteiraGondolas',
    ref: `A1:${letraColuna(COLUNAS.length - 1)}${ultimaLinha}`,
    headerRow: true,
    style: { theme: 'TableStyleMedium2', showRowStripes: true },
    columns: COLUNAS.map((coluna) => ({ name: coluna.titulo, filterButton: true })),
    rows: itens.map((item) => COLUNAS.map((coluna) => coluna.valor(item))),
  });

  COLUNAS.forEach((coluna, indice) => {
    const col = ws.getColumn(indice + 1);
    col.width = coluna.largura;
    if (coluna.titulo === 'Entrega') col.numFmt = 'dd/mm/yyyy';
    if (indice + 1 < PRIMEIRA_NUMERICA) return;
    for (let linha = 2; linha <= ultimaLinha; linha++) {
      const celula = ws.getCell(linha, indice + 1);
      celula.numFmt = formatoQuantidade(celula.value);
    }
  });
}

function linhaComponente(item: ItemCarteiraGondola, origem: OrigemFicha, componente: ComponenteFicha) {
  return [
    item.pedido,
    item.cliente,
    componente.codigo,
    componente.descricao || componente.codigo,
    componente.tipo || 'Peça',
    rotuloFicha(origem),
    componente.materiaPrima,
    componente.medida01,
    componente.medida02,
    componente.modelo ?? '',
    componente.quantidade,
    componente.quantidadeTotal,
    componente.ordemGerada ?? '',
  ];
}

/** Cada item da grade numa linha de produto e, logo abaixo, as peças da ficha agrupadas no nível 1 do Excel. */
function abaComponentes(wb: Workbook, itens: ItemCarteiraGondola[], detalhes: Map<number, DetalheItemGondola>) {
  const ws: Worksheet = wb.addWorksheet('Componentes', {
    views: [{ state: 'frozen', ySplit: 1 }],
    properties: { outlineProperties: { summaryBelow: false, summaryRight: true } },
  });

  const cabecalho = ws.addRow(COLUNAS_COMPONENTES.map((coluna) => coluna.titulo));
  cabecalho.eachCell((celula) => {
    celula.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF041E42' } };
  });

  for (const item of itens) {
    const detalhe = detalhes.get(item.idItem);
    const origem = detalhe?.origem ?? item.origem;
    const produto = ws.addRow([
      item.pedido,
      item.cliente,
      item.codigo,
      item.descricao,
      'Produto',
      rotuloFicha(origem),
      '',
      '',
      '',
      '',
      null,
      item.qtdePendenteReal,
      '',
    ]);
    produto.font = { bold: true };
    produto.eachCell({ includeEmpty: true }, (celula) => {
      celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };
    });
    produto.getCell(QTD_TOTAL).numFmt = formatoQuantidade(item.qtdePendenteReal);

    for (const componente of detalhe?.componentes ?? []) {
      const linha = ws.addRow(linhaComponente(item, origem, componente));
      linha.outlineLevel = 1;
      linha.getCell(4).alignment = { indent: 1 };
      linha.getCell(QTD_FICHA).numFmt = formatoQuantidade(componente.quantidade);
      linha.getCell(QTD_TOTAL).numFmt = formatoQuantidade(componente.quantidadeTotal);
    }
  }

  COLUNAS_COMPONENTES.forEach((coluna, indice) => {
    ws.getColumn(indice + 1).width = coluna.largura;
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUNAS_COMPONENTES.length } };
}

/**
 * Exporta as linhas exibidas na grade da carteira, na ordem e com os filtros aplicados.
 * A aba Componentes abre a ficha de cada item, a mesma do modal.
 */
export async function exportarCarteiraGondolasXlsx(
  itens: ItemCarteiraGondola[],
  detalhes: Map<number, DetalheItemGondola>,
  setor: string
): Promise<void> {
  const wb = new Workbook();
  abaCarteira(wb, itens);
  abaComponentes(wb, itens, detalhes);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const recorte = setor === 'Gôndolas' ? 'gondolas' : setor === 'Porta Paletes' ? 'porta-paletes' : 'gondolas-porta-paletes';
  link.href = url;
  link.download = `carteira-${recorte}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
