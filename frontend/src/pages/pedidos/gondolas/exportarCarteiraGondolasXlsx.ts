import { Workbook } from 'exceljs';
import type { ItemCarteiraGondola } from '../../../api/gondolasPortaPaletes';

const COLUNAS: { titulo: string; largura: number; valor: (item: ItemCarteiraGondola) => string | number | Date | null }[] = [
  { titulo: 'Pedido', largura: 12, valor: (item) => item.pedido },
  { titulo: 'Cliente', largura: 40, valor: (item) => item.cliente },
  { titulo: 'Código', largura: 14, valor: (item) => item.codigo },
  {
    titulo: 'Ficha',
    largura: 12,
    valor: (item) => (item.origem === 'nomus' ? 'Nomus' : item.origem === 'planilha' ? 'Planilha' : 'Sem ficha'),
  },
  { titulo: 'Descrição', largura: 70, valor: (item) => item.descricao },
  { titulo: 'Setor', largura: 15, valor: (item) => item.setor },
  { titulo: 'Entrega', largura: 12, valor: (item) => dataEntrega(item.dataEntrega) },
  { titulo: 'Status', largura: 14, valor: (item) => item.status },
  { titulo: 'Pedida', largura: 11, valor: (item) => item.qtdePedida },
  { titulo: 'Pendente', largura: 11, valor: (item) => item.pendente },
  { titulo: 'Pendente real', largura: 14, valor: (item) => item.qtdePendenteReal },
];

const PRIMEIRA_NUMERICA = 9;

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

/** Exporta as linhas exibidas na grade da carteira, na ordem e com os filtros aplicados. */
export async function exportarCarteiraGondolasXlsx(itens: ItemCarteiraGondola[], setor: string): Promise<void> {
  const wb = new Workbook();
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
      celula.numFmt = Number.isInteger(celula.value) ? '#,##0' : '#,##0.00';
    }
  });

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
