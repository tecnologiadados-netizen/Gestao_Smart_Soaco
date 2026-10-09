/**
 * Importa a coluna Observação de uma planilha do Diário.
 * Uso: npx tsx scripts/import-diario-anotacoes.ts "C:\caminho\arquivo.xlsx" [--dry-run]
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import '../src/load-dotenv.js';
import { casarPlanilhaComTitulos, importarAnotacoesDiario, lerMatrizPlanilha } from '../src/data/diarioAnotacao.js';
import { queryDiarioContasPagar } from '../src/data/diarioContasPagarRepository.js';

const require = createRequire(import.meta.url);
const ExcelJS = require('../../frontend/node_modules/exceljs') as typeof import('exceljs');

function textoCelula(valor: unknown): string {
  if (valor == null) return '';
  if (valor instanceof Date) {
    const ano = valor.getUTCFullYear();
    const mes = String(valor.getUTCMonth() + 1).padStart(2, '0');
    const dia = String(valor.getUTCDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }
  if (typeof valor === 'number') return String(valor);
  if (typeof valor === 'object') {
    const obj = valor as { richText?: Array<{ text?: string }>; text?: unknown; result?: unknown };
    if (Array.isArray(obj.richText)) return obj.richText.map((parte) => parte.text ?? '').join('').trim();
    if (obj.text != null && typeof obj.text !== 'object') return String(obj.text).trim();
    if (obj.result != null && typeof obj.result !== 'object') return String(obj.result).trim();
  }
  return String(valor).trim();
}

async function matrizDoArquivo(caminho: string): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(readFileSync(caminho));
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('A planilha não tem aba.');
  const matriz: string[][] = [];
  const limite = Math.min(ws.rowCount, 5000);
  for (let r = 1; r <= limite; r++) {
    const row = ws.getRow(r);
    const cells: string[] = [];
    const total = Math.max(row.cellCount, 13);
    for (let c = 1; c <= total; c++) cells.push(textoCelula(row.getCell(c).value));
    if (cells.some((c) => c.trim())) matriz.push(cells);
  }
  return matriz;
}

const caminho = process.argv.find((arg) => arg.toLowerCase().endsWith('.xlsx'));
const dryRun = process.argv.includes('--dry-run');
if (!caminho) {
  console.error('Informe o caminho do .xlsx.');
  process.exit(1);
}

const matriz = await matrizDoArquivo(caminho);
if (dryRun) {
  const planilha = lerMatrizPlanilha(matriz);
  const datas = planilha.map((l) => l.vencimento).sort();
  const diario = await queryDiarioContasPagar({ dataInicio: datas[0], dataFim: datas[datas.length - 1] });
  const casamento = casarPlanilhaComTitulos(planilha, diario.linhas);
  console.log(
    JSON.stringify(
      {
        lidas: planilha.length,
        titulos: diario.linhas.length,
        erroNomus: diario.erroNomus ?? null,
        erroShop9: diario.erroShop9 ?? null,
        gravados: casamento.gravados,
        semCorrespondencia: casamento.semCorrespondencia,
        ambiguos: casamento.ambiguos,
        amostrasSem: casamento.amostrasSem,
      },
      null,
      2,
    ),
  );
} else {
  const resultado = await importarAnotacoesDiario({ matriz, usuario: 'importacao-planilha' });
  console.log(JSON.stringify(resultado, null, 2));
}
process.exit(0);
