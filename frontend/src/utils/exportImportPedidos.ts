/**
 * Exportação e importação de pedidos em XLSX.
 * Export: colunas conforme config (exceto Emissao, Data de entrega, Previsao na posição original);
 *         depois Igual?; Emissao, Data original, Previsão atual (última no histórico), Nova previsão (em branco); Motivo; Previsão Confiável.
 * Datas em formato dd/MM/yyyy (tipo data, sem hora).
 * Import: lê id_pedido (idChave), Nova previsão (valor a aplicar), Previsão atual (valor no sistema para validação), Motivo.
 */

import { Workbook, type Worksheet } from 'exceljs';
import * as XLSX from 'xlsx';
import type { Pedido } from '../api/pedidos';
import { parsePrevisaoConfiavel, previsaoConfiavelValorInvalido } from './previsaoConfiavel';

/** Valor de célula na exportação: `null` = célula vazia real no Excel (não string ""). */
export type ExportCellValue = string | number | Date | null;

function isExportBlank(val: unknown): boolean {
  if (val === null || val === undefined) return true;
  if (val === '') return true;
  if (typeof val === 'string' && val.trim() === '') return true;
  return false;
}

function exportCell<T extends string | number | Date>(val: T | '' | null | undefined): T | null {
  return isExportBlank(val) ? null : val;
}

function rowValueForTable(row: Record<string, ExportCellValue>, key: string): string | number | Date | null {
  const v = row[key];
  return isExportBlank(v) ? null : v;
}

/** Garante que strings vazias gravadas pela tabela viram células vazias no arquivo. */
function sanitizeEmptyCells(ws: Worksheet, lastRow: number, colCount: number): void {
  for (let r = 2; r <= lastRow; r++) {
    for (let c = 1; c <= colCount; c++) {
      const cell = ws.getCell(r, c);
      const v = cell.value;
      if (v != null && typeof v === 'object' && 'formula' in v) continue;
      if (v === '' || (typeof v === 'string' && v.trim() === '')) {
        cell.value = null;
      }
    }
  }
}

function getField(p: Pedido, keys: string[]): string | number | Date | unknown {
  for (const k of keys) {
    const v = p[k as keyof Pedido];
    if (v != null && String(v).length > 0) return v as string | number | Date;
  }
  return '';
}

const DATE_FORMAT_EXCEL = 'dd/mm/yyyy';
/** Largura das colunas de data no export (em caracteres). */
const DATE_COLUMN_WIDTH = 14;
/** Valor: formato Contábil padrão Excel (#,##0.00). No Brasil o Excel exibe com separador de milhar e 2 decimais. */
const NUM_FMT_VALOR_CONTABIL = '#,##0.00';
/** Quantidade (Qtde): formato geral — número sem decimais forçados — ex.: 0, 854. */
const NUM_FMT_QTDE_GERAL = 'General';

function toDate(value: string | Date): Date | '' {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN((d as Date).getTime())) return '';
  return d as Date;
}

/** Retorna Date à meia-noite local (sem hora) para uso interno. */
function dateOnly(value: Date | string | ''): Date | '' {
  if (value === '') return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (d instanceof Date && !Number.isNaN(d.getTime())) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  return '';
}

/** Número serial do Excel para a data (inteiro = só data, sem hora). 1 = 1900-01-01. Evita que a barra de fórmulas mostre hora. */
function toExcelDateSerial(value: Date | string | '' | null): number | null {
  const d = dateOnly(value);
  if (d === '') return null;
  const localMidnight = d instanceof Date ? d : new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const excelEpoch = new Date(1899, 11, 30);
  return Math.round((localMidnight.getTime() - excelEpoch.getTime()) / (24 * 60 * 60 * 1000));
}

/** Configuração das colunas conforme Colunas.xlsx: ordem e se exibir ou ocultar. */
const EXPORT_COLUMNS_CONFIG: { key: string; hidden: boolean }[] = [
  { key: 'idChave', hidden: true },
  { key: 'id', hidden: true },
  { key: 'Observacoes', hidden: false },
  { key: 'RM', hidden: true },
  { key: 'Tipo Pedido', hidden: true },
  { key: 'PD', hidden: false },
  { key: 'Previsao', hidden: false },
  { key: 'Analise', hidden: true },
  { key: 'Emissao', hidden: false },
  { key: 'Cliente', hidden: false },
  { key: 'Cod', hidden: false },
  { key: 'Descricao do produto', hidden: false },
  { key: 'Tipo de produto do item de pedido de venda', hidden: true },
  { key: 'Data de entrega', hidden: false },
  { key: 'Grupo de produto', hidden: true },
  { key: 'Subgrupo1', hidden: true },
  { key: 'Subgrupo2', hidden: true },
  { key: 'Setor de Producao', hidden: false },
  { key: 'Stauts', hidden: false },
  { key: 'Metodo de Entrega', hidden: true },
  { key: 'Requisicao de loja do grupo?', hidden: true },
  { key: 'UF', hidden: false },
  { key: 'Municipio de entrega', hidden: false },
  { key: 'Forma de Pagamento', hidden: true },
  { key: 'Condicao de pagamento do pedido de venda', hidden: true },
  { key: 'regra', hidden: true },
  { key: 'Qtde pedida', hidden: true },
  { key: 'Qtde atendida', hidden: true },
  { key: 'Pendente', hidden: true },
  { key: 'Qtde Romaneada', hidden: true },
  { key: 'Valor Unitario com desconto + IPI do item PD', hidden: true },
  { key: 'Valor Total com desconto + IPI do item PD', hidden: true },
  { key: 'Valor Pendente', hidden: false },
  { key: 'Valor Romaneado', hidden: true },
  { key: 'Valor Faturado Entrega Futura + IPI do item do Pedido', hidden: true },
  { key: 'Data base entrega futura', hidden: false },
  { key: 'Venda por qual empresa?', hidden: true },
  { key: 'Vendedor/Representante', hidden: true },
  { key: 'Valor Adiantamento', hidden: true },
  { key: 'Quantidade Pedidos', hidden: true },
  { key: 'Valor Pedido Total', hidden: true },
  { key: 'valorAdiantamentoRateio', hidden: true },
  { key: 'Entrada/A vista Ate 10d', hidden: true },
  { key: 'Valor a Vista Ate 10d', hidden: true },
  { key: 'Qtde Pendente Real', hidden: false },
  { key: 'Saldo a Faturar Real', hidden: false },
  { key: 'tipoF', hidden: true },
  { key: 'Status Pedido', hidden: true },
  { key: 'Card', hidden: false },
];

/** Colunas de data: formato dd/MM/yyyy (aplicado às colunas de data no export). */
const DATE_COLUMN_KEYS = new Set(['Emissao', 'Data de entrega', 'Previsao', 'Nova previsão', 'Data original', 'Previsão atual']);
/** Colunas de quantidade (Qtde): formato geral. Aplica a visíveis e ocultas. */
const QTDE_COLUMN_KEYS = new Set([
  'id', 'regra', 'Qtde pedida', 'Qtde atendida', 'Pendente', 'Qtde Romaneada', 'Quantidade Pedidos', 'Qtde Pendente Real',
]);
/** Colunas de valor: formato Contábil (milhar + 2 casas). Aplica a visíveis e ocultas. */
const VALOR_COLUMN_KEYS = new Set([
  'Valor Unitario com desconto + IPI do item PD',
  'Valor Total com desconto + IPI do item PD',
  'Valor Pendente',
  'Valor Romaneado',
  'Valor Faturado Entrega Futura + IPI do item do Pedido',
  'Valor Adiantamento',
  'Valor Pedido Total',
  'valorAdiantamentoRateio',
  'Valor a Vista Ate 10d',
  'Saldo a Faturar Real',
]);

/** Colunas removidas da posição original e recolocadas entre Igual? e Motivo (com renomeação). */
const COLUMNS_MOVED = new Set(['Emissao', 'Data de entrega', 'Previsao']);

/** Colunas para o arquivo "Exportar Grade" (apenas estas, na ordem indicada). */
export const GRADE_EXPORT_COLUMNS = [
  'idChave',
  'Observacoes',
  'RM',
  'PD',
  'Cliente',
  'Cod',
  'Descricao do produto',
  'Setor de Producao',
  'Stauts',
  'Requisicao de loja do grupo?',
  'UF',
  'Municipio de entrega',
  'Qtde Pendente Real',
  'tipoF',
  'Emissao',
  'Data original',
  'Previsão anterior',
  'Previsão atual',
  'Data base entrega futura',
  'Card',
] as const;

/** Cabeçalhos: config exceto Emissao/Data de entrega/Previsao; depois Igual?; Emissao, Data original, Previsão atual (última no histórico), Nova previsão (em branco); Motivo; Observação. */
export const HEADERS = [
  ...EXPORT_COLUMNS_CONFIG.map((c) => c.key).filter((k) => !COLUMNS_MOVED.has(k)),
  'Igual?',
  'Emissao',
  'Data original',
  'Previsão atual',
  'Nova previsão',
  'Motivo',
  'Previsão Confiável',
  'Observação',
];

const COL_IGUAL = HEADERS.indexOf('Igual?');
const COL_PREVISAO_ATUAL = HEADERS.indexOf('Previsão atual');
const COL_NOVA_PREVISAO = HEADERS.indexOf('Nova previsão');
const COL_MOTIVO = HEADERS.indexOf('Motivo');
const COL_PREVISAO_CONFIAVEL = HEADERS.indexOf('Previsão Confiável');

/** Converte valor para Date quando for coluna de data (para Excel aplicar dd/MM/yyyy). */
function toDateValue(key: string, val: unknown): Date | null {
  if (isExportBlank(val)) return null;
  if (typeof val === 'object' && val instanceof Date) return val;
  const d = typeof val === 'string' ? new Date(val) : val instanceof Date ? val : new Date(Number(val));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/** Normaliza número para exibição: inteiro sem decimais ou decimal com 2 casas (evita 854.00000...). */
function normalizeNumValue(key: string, val: unknown): string | number | Date | null {
  if (isExportBlank(val)) return null;
  if (typeof val === 'object' && val instanceof Date) return val;
  const n = Number(val);
  if (Number.isNaN(n)) return isExportBlank(val) ? null : String(val);
  if (QTDE_COLUMN_KEYS.has(key)) return Math.round(n);
  if (VALOR_COLUMN_KEYS.has(key) || /valor/i.test(key)) return Math.round(n * 100) / 100;
  return isExportBlank(val) ? null : String(val);
}

export function pedidosToSheetRows(pedidos: Pedido[]): Record<string, ExportCellValue>[] {
  return pedidos.map((p) => {
    const previsaoAtual = toDate(p.previsao_entrega_atualizada ?? p.previsao_entrega ?? '');
    const row: Record<string, ExportCellValue> = {};
    for (const { key } of EXPORT_COLUMNS_CONFIG) {
      if (key === 'idChave') {
        row[key] = exportCell(String(p.id_pedido ?? ''));
      } else if (key === 'Previsao') {
        row[key] = toExcelDateSerial(previsaoAtual);
      } else if (key === 'Analise') {
        row[key] = null;
      } else if (key === 'Card') {
        const card = String(p.Card ?? '').trim();
        row[key] = card === 'Card' || card === 'Disponível' ? card : null;
      } else if (DATE_COLUMN_KEYS.has(key)) {
        const val = p[key as keyof Pedido] ?? getField(p, [key]);
        const dateVal = toDateValue(key, val);
        row[key] = dateVal ? toExcelDateSerial(dateVal) : null;
      } else {
        const val = p[key as keyof Pedido] ?? getField(p, [key]);
        row[key] = normalizeNumValue(key, val);
      }
    }
    row['Igual?'] = null;
    const emissaoVal = toDateValue('Emissao', getField(p, ['Emissao']));
    row['Emissao'] = emissaoVal ? toExcelDateSerial(emissaoVal) : null;
    const dataEntregaVal = toDateValue('Data de entrega', p['Data de entrega' as keyof Pedido] ?? getField(p, ['Data de entrega']));
    row['Data original'] = dataEntregaVal ? toExcelDateSerial(dataEntregaVal) : null;
    row['Previsão atual'] = toExcelDateSerial(previsaoAtual);
    row['Nova previsão'] = null;
    row['Motivo'] = null;
    row['Previsão Confiável'] = 'SIM';
    row['Observação'] = null;
    return row;
  });
}

function colLetter(col: number): string {
  let s = '';
  let c = col;
  while (c >= 0) {
    s = String.fromCharCode((c % 26) + 65) + s;
    c = Math.floor(c / 26) - 1;
  }
  return s;
}

const GRADE_DATE_KEYS = new Set(['Emissao', 'Data original', 'Previsão anterior', 'Previsão atual']);

/** Converte pedidos em linhas apenas com as colunas da grade (Exportar Grade). */
export function pedidosToGradeRows(pedidos: Pedido[]): Record<string, ExportCellValue>[] {
  return pedidos.map((p) => {
    const previsaoAtual = toDate(p.previsao_entrega_atualizada ?? p.previsao_entrega ?? '');
    const previsaoAnterior = toDate(p.previsao_anterior ?? p.previsao_entrega ?? '');
    const dataOriginal = toDateValue('Data de entrega', p['Data de entrega' as keyof Pedido] ?? getField(p, ['Data de entrega']));
    const emissaoVal = p.Emissao ?? getField(p, ['Emissao']);
    const row: Record<string, ExportCellValue> = {};
    for (const key of GRADE_EXPORT_COLUMNS) {
      if (key === 'idChave') {
        row[key] = exportCell(String(p.id_pedido ?? ''));
      } else if (key === 'Data original') {
        row[key] = dataOriginal ? toExcelDateSerial(dataOriginal) : null;
      } else if (key === 'Previsão anterior') {
        row[key] = toExcelDateSerial(previsaoAnterior);
      } else if (key === 'Previsão atual') {
        row[key] = toExcelDateSerial(previsaoAtual);
      } else if (key === 'Emissao') {
        const dateVal = toDateValue('Emissao', emissaoVal);
        row[key] = dateVal ? toExcelDateSerial(dateVal) : null;
      } else if (GRADE_DATE_KEYS.has(key)) {
        const val = p[key as keyof Pedido] ?? getField(p, [key]);
        const dateVal = toDateValue(key, val);
        row[key] = dateVal ? toExcelDateSerial(dateVal) : null;
      } else if (key === 'Card') {
        const card = String(p.Card ?? '').trim();
        row[key] = card === 'Card' || card === 'Disponível' ? card : null;
      } else {
        const val = p[key as keyof Pedido] ?? getField(p, [key]);
        row[key] = normalizeNumValue(key, val);
      }
    }
    return row;
  });
}

/** Exporta pedidos para XLSX apenas com as colunas da grade (Exportar Grade). */
export async function downloadPedidosGradeXlsx(
  pedidos: Pedido[],
  filename = 'pedidos_grade.xlsx'
): Promise<void> {
  const rows = pedidosToGradeRows(pedidos);
  const wb = new Workbook();
  const ws = wb.addWorksheet('Pedidos', { views: [{ state: 'frozen', ySplit: 1 }] });

  const tableRows: (string | number | Date | null)[][] = rows.map((r) =>
    GRADE_EXPORT_COLUMNS.map((h) => rowValueForTable(r, h))
  );

  const lastRow = tableRows.length + 1;
  const ref = `A1:${colLetter(GRADE_EXPORT_COLUMNS.length - 1)}${lastRow}`;

  ws.addTable({
    name: 'TabelaPedidosGrade',
    ref,
    headerRow: true,
    style: { theme: 'TableStyleMedium2', showRowStripes: true },
    columns: [...GRADE_EXPORT_COLUMNS].map((name) => ({ name, filterButton: true })),
    rows: tableRows,
  });

  for (let colIdx = 0; colIdx < GRADE_EXPORT_COLUMNS.length; colIdx++) {
    const key = GRADE_EXPORT_COLUMNS[colIdx];
    const colNum = colIdx + 1;
    if (GRADE_DATE_KEYS.has(key)) {
      ws.getColumn(colNum).width = DATE_COLUMN_WIDTH;
      for (let r = 2; r <= lastRow; r++) {
        ws.getCell(r, colNum).numFmt = DATE_FORMAT_EXCEL;
      }
    } else if (key === 'Qtde Pendente Real') {
      for (let r = 2; r <= lastRow; r++) {
        ws.getCell(r, colNum).numFmt = NUM_FMT_QTDE_GERAL;
      }
    }
  }

  sanitizeEmptyCells(ws, lastRow, GRADE_EXPORT_COLUMNS.length);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type DownloadPedidosXlsxOptions = {
  /** Remove as colunas finais Motivo e Observação (ex.: modelo de cenário simulado MRP). */
  omitMotivoObservacao?: boolean;
};

/** Exporta pedidos para XLSX: colunas conforme config (ocultar/exibir), Igual? com fórmula, Motivo com lista. */
export async function downloadPedidosXlsx(
  pedidos: Pedido[],
  filename = 'pedidos.xlsx',
  motivosLista: string[] = [],
  options?: DownloadPedidosXlsxOptions
): Promise<void> {
  const headers =
    options?.omitMotivoObservacao === true
      ? HEADERS.filter((h) => h !== 'Motivo' && h !== 'Previsão Confiável' && h !== 'Observação')
      : [...HEADERS];
  const colIgualIdx = headers.indexOf('Igual?');
  const colNovaPrevisaoIdx = headers.indexOf('Nova previsão');
  const colPrevisaoAtualIdx = headers.indexOf('Previsão atual');
  const colMotivoIdx = headers.indexOf('Motivo');
  const colPrevisaoConfiavelIdx = headers.indexOf('Previsão Confiável');

  const rows = pedidosToSheetRows(pedidos);
  const wb = new Workbook();
  const wsPedidos = wb.addWorksheet('Pedidos', { views: [{ state: 'frozen', ySplit: 1 }] });

  const tableRows: (string | number | Date | null)[][] = rows.map((r) =>
    headers.map((h) => rowValueForTable(r, h))
  );

  const lastRow = tableRows.length + 1;
  const ref = `A1:${colLetter(headers.length - 1)}${lastRow}`;

  wsPedidos.addTable({
    name: 'TabelaPedidos',
    ref,
    headerRow: true,
    style: { theme: 'TableStyleMedium2', showRowStripes: true },
    columns: headers.map((name) => ({ name, filterButton: true })),
    rows: tableRows,
  });

  // Ocultar colunas conforme config (por nome do cabeçalho)
  for (let colIdx = 0; colIdx < headers.length; colIdx++) {
    const key = headers[colIdx];
    const configEntry = EXPORT_COLUMNS_CONFIG.find((c) => c.key === key);
    if (configEntry?.hidden) {
      wsPedidos.getColumn(colIdx + 1).hidden = true;
    }
  }

  // Fórmula Igual?: Nova previsão = Previsão atual
  const colNovaPrevisaoLet = colLetter(colNovaPrevisaoIdx);
  const colPrevisaoAtualLet = colLetter(colPrevisaoAtualIdx);
  for (let r = 2; r <= lastRow; r++) {
    wsPedidos.getCell(r, colIgualIdx + 1).value = {
      formula: `${colNovaPrevisaoLet}${r}=${colPrevisaoAtualLet}${r}`,
    };
  }

  // Formato por célula: data dd/MM/yyyy (sem hora), Valor contábil, Qtde geral; largura 14 para colunas de data
  const isValorColumn = (k: string) =>
    VALOR_COLUMN_KEYS.has(k) || /valor/i.test(k);
  for (let colIdx = 0; colIdx < headers.length; colIdx++) {
    const key = headers[colIdx];
    const colNum = colIdx + 1;
    let numFmt: string | undefined;
    if (DATE_COLUMN_KEYS.has(key)) {
      numFmt = DATE_FORMAT_EXCEL;
      wsPedidos.getColumn(colNum).width = DATE_COLUMN_WIDTH;
    } else if (QTDE_COLUMN_KEYS.has(key)) {
      numFmt = NUM_FMT_QTDE_GERAL;
    } else if (isValorColumn(key)) {
      numFmt = NUM_FMT_VALOR_CONTABIL;
    }
    if (numFmt) {
      for (let r = 2; r <= lastRow; r++) {
        wsPedidos.getCell(r, colNum).numFmt = numFmt;
      }
    }
  }

  if (motivosLista.length > 0 && colMotivoIdx >= 0) {
    const wsMotivos = wb.addWorksheet('Motivos');
    motivosLista.forEach((m, i) => {
      wsMotivos.getCell(i + 1, 1).value = m;
    });
    const listRef = `Motivos!$A$1:$A$${motivosLista.length}`;
    for (let r = 2; r <= lastRow; r++) {
      const cell = wsPedidos.getCell(r, colMotivoIdx + 1);
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [listRef],
      };
    }
  }

  if (colPrevisaoConfiavelIdx >= 0) {
    for (let r = 2; r <= lastRow; r++) {
      const cell = wsPedidos.getCell(r, colPrevisaoConfiavelIdx + 1);
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"SIM,NÃO"'],
      };
    }
  }

  sanitizeEmptyCells(wsPedidos, lastRow, headers.length);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export interface LinhaImportacao {
  id_pedido: string;
  /** Código do produto (coluna Cod do export). */
  cod?: string;
  /** Qtde pendente informada no arquivo (Qtde Pendente Real / Pendente). */
  qtde_pendente?: number;
  /** Número do pedido (PD) quando presente no arquivo — usado para bloquear importação se pedido está no Sycro. */
  pd?: string;
  nova_previsao: string;
  motivo: string;
  /** Observação do ajuste (coluna Observação). Armazenada na tabela de previsão e exibida no histórico. */
  observacao?: string;
  /** Previsão atual (coluna do arquivo = valor no sistema). Usado para validação. */
  previsao_atual: string;
  /** Rota/Carrada (coluna Observacoes do arquivo) para validar mesma data por carrada. */
  rota: string;
  /** Coluna Igual? (Nova previsão = Previsão atual). Importação não aceita linhas com Igual? = verdadeiro. */
  igual?: boolean;
  /** Coluna Previsão Confiável (SIM/NÃO). Quando false, não exibe no histórico Comunicação Interna. */
  previsao_confiavel?: boolean;
}

/** Lê coluna do Excel por nome exato ou prefixo (cabeçalhos truncados pelo Excel). */
function valorColunaExcel(row: Record<string, unknown>, nomesExatos: string[], prefixos: string[]): unknown {
  for (const nome of nomesExatos) {
    if (row[nome] != null && row[nome] !== '') return row[nome];
  }
  const prefixosNorm = prefixos.map((p) => p.trim().toLowerCase());
  for (const key of Object.keys(row)) {
    const k = key.trim().toLowerCase();
    if (prefixosNorm.some((p) => k === p || k.startsWith(p))) {
      const v = row[key];
      if (v != null && v !== '') return v;
    }
  }
  return undefined;
}

function normalizarDataExcel(val: unknown): string {
  if (val == null || val === '') return '';
  if (typeof val === 'number') {
    const date = new Date((val - 25569) * 86400 * 1000);
    if (Number.isNaN(date.getTime())) return '';
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(val).trim();
  const ddmm = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  return ddmm ? `${ddmm[3]}-${ddmm[2].padStart(2, '0')}-${ddmm[1].padStart(2, '0')}` : s;
}

/** Lê um arquivo XLSX e retorna linhas com id_pedido, nova_previsao, motivo, previsao_atual. */
export function parsePedidosXlsxForImport(file: File): Promise<LinhaImportacao[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error('Arquivo vazio'));
          return;
        }
        const wb = XLSX.read(data, { type: 'binary' });
        // Tenta sempre usar a aba "Pedidos" (como no arquivo de exportação).
        // Se não encontrar, cai para a primeira aba disponível.
        const sheetNames = wb.SheetNames;
        if (!sheetNames || sheetNames.length === 0) {
          reject(new Error('Upload bloqueado. Arquivo sem abas válidas. Certifique-se de usar o arquivo exportado pelo sistema.'));
          return;
        }
        const pedidosSheetName =
          sheetNames.find((name) => name.toLowerCase() === 'pedidos') ??
          sheetNames[0];
        const ws = wb.Sheets[pedidosSheetName];
        if (!ws) {
          reject(new Error('Upload bloqueado. Não foi possível localizar a aba "Pedidos" no arquivo. Use o arquivo exportado pelo sistema.'));
          return;
        }
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
        const linhas: LinhaImportacao[] = [];
        const linhasPrevisaoConfiavelInvalida: number[] = [];
        let rowIndex = 0;
        for (const row of json) {
          rowIndex += 1;
          const id = row['id_pedido'] ?? row['idChave'] ?? '';
          const pdRaw = row['PD'] ?? row['pd'] ?? '';
          const pdStr: string = typeof pdRaw === 'string' ? pdRaw.trim() : String(pdRaw ?? '').trim();
          const codRaw = row['Cod'] ?? row['cod'] ?? '';
          const codStr = typeof codRaw === 'string' ? codRaw.trim() : String(codRaw ?? '').trim();
          const qtdePendRaw =
            row['Qtde Pendente Real'] ??
            row['Qtde pendente real'] ??
            row['Pendente'] ??
            row['pendente'] ??
            '';
          let qtde_pendente: number | undefined;
          if (qtdePendRaw !== '' && qtdePendRaw != null) {
            const n = typeof qtdePendRaw === 'number' ? qtdePendRaw : Number(String(qtdePendRaw).replace(',', '.'));
            if (Number.isFinite(n)) qtde_pendente = n;
          }
          const novaRaw =
            valorColunaExcel(row, ['Nova previsão', 'Nova previsao', 'nova_previsao'], ['nova previs']) ??
            row['Previsão atual'];
          const atualRaw =
            valorColunaExcel(
              row,
              ['Previsão atual', 'Previsao atual', 'Previsão atua'],
              ['previsão atual', 'previsao atual', 'previsão atua']
            ) ??
            valorColunaExcel(row, ['Previsão anterior', 'Previsao anterior'], ['previsão anterior', 'previsao anterior']) ??
            row['Previsão'] ??
            row['Previsao'] ??
            '';
          const motivoRaw = valorColunaExcel(row, ['Motivo', 'motivo'], ['motivo']) ?? '';
          const motivoStr: string = typeof motivoRaw === 'string' ? motivoRaw.trim() : String(motivoRaw ?? '').trim();
          const observacaoRaw =
            valorColunaExcel(row, ['Observação', 'Observacao', 'observacao'], ['observa']) ?? '';
          const observacaoStr: string =
            typeof observacaoRaw === 'string' ? observacaoRaw.trim() : String(observacaoRaw ?? '').trim();
          const rotaRaw =
            valorColunaExcel(row, ['Observacoes', 'Observações', 'Rota', 'rota'], ['observac', 'rota']) ?? '';
          const rotaStr: string = typeof rotaRaw === 'string' ? rotaRaw.trim() : String(rotaRaw ?? '').trim();
          const igualRaw = row['Igual?'] ?? row['Igual'] ?? '';
          const igual = (() => {
            if (typeof igualRaw === 'boolean') return igualRaw;
            const s = String(igualRaw).trim().toUpperCase();
            if (s === 'TRUE' || s === 'VERDADEIRO' || s === 'SIM' || s === '1' || s === 'S') return true;
            return false;
          })();
          const previsaoConfiavelRaw =
            valorColunaExcel(
              row,
              ['Previsão Confiável', 'Previsao Confiavel', 'Previsão confiável', 'previsao_confiavel'],
              ['previsão confi', 'previsao confi']
            ) ?? '';
          if (previsaoConfiavelValorInvalido(previsaoConfiavelRaw)) {
            linhasPrevisaoConfiavelInvalida.push(rowIndex);
          }
          const previsao_confiavel = parsePrevisaoConfiavel(previsaoConfiavelRaw, true);
          if (String(id).trim()) {
            const nova = normalizarDataExcel(novaRaw);
            const previsao_atual = normalizarDataExcel(atualRaw);
            linhas.push({
              id_pedido: String(id).trim(),
              pd: pdStr || undefined,
              cod: codStr || undefined,
              qtde_pendente,
              nova_previsao: nova,
              motivo: motivoStr,
              observacao: observacaoStr || undefined,
              previsao_atual,
              rota: rotaStr,
              igual,
              previsao_confiavel,
            });
          }
        }
        if (linhasPrevisaoConfiavelInvalida.length > 0) {
          reject(
            new Error(
              `Upload bloqueado. A coluna "Previsão Confiável" deve ser SIM ou NÃO (linhas: ${linhasPrevisaoConfiavelInvalida.join(', ')}).`
            )
          );
          return;
        }
        resolve(linhas);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo'));
    reader.readAsBinaryString(file);
  });
}
