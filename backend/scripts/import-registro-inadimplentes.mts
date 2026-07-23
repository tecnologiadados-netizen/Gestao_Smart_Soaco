/**
 * Importa a planilha VENCIDOS ATUALIZADA para crm_registro_inadimplente.
 * Uso: node --import tsx scripts/import-registro-inadimplentes.mts [caminho.xlsx]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import {
  importRegistroInadimplentesBulk,
  countRegistroInadimplentes,
  type RegistroInadimplenteInput,
} from '../src/services/crmRegistroInadimplentesService.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, '..');
const defaultXlsx = path.join(backendRoot, '..', 'VENCIDOS ATUALIZADA (7).xlsx');

function excelDateToBr(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    const dd = String(parsed.d).padStart(2, '0');
    const mm = String(parsed.m).padStart(2, '0');
    const yyyy = String(parsed.y);
    return `${dd}/${mm}/${yyyy}`;
  }
  const s = String(value).trim();
  return s || null;
}

function parseTotal(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = String(value)
    .replace(/R\$/gi, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function pick(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] != null && String(row[key]).trim() !== '') return row[key];
  }
  for (const [k, v] of Object.entries(row)) {
    const kt = k.trim().toUpperCase();
    if (keys.some((want) => want.trim().toUpperCase() === kt)) {
      if (v != null && String(v).trim() !== '') return v;
    }
  }
  return null;
}

function rowToInput(row: Record<string, unknown>): RegistroInadimplenteInput | null {
  const cliente = pick(row, 'CLIENTE');
  if (!cliente || !String(cliente).trim()) return null;
  return {
    vencimento: excelDateToBr(pick(row, 'VENCIMENTO')),
    pagamento: excelDateToBr(pick(row, 'PAGAMENTO')),
    empresa: pick(row, 'EMPRESA') != null ? String(pick(row, 'EMPRESA')).trim() : null,
    banco: pick(row, 'BANCO') != null ? String(pick(row, 'BANCO')).trim() : null,
    tipo: pick(row, 'TIPO') != null ? String(pick(row, 'TIPO')).trim() : null,
    cliente: String(cliente).trim(),
    status: pick(row, 'STATUS') != null ? String(pick(row, 'STATUS')).trim() : null,
    serasa: pick(row, 'SERASA?', 'SERASA') != null ? String(pick(row, 'SERASA?', 'SERASA')).trim() : null,
    vendedor: pick(row, 'VENDEDOR') != null ? String(pick(row, 'VENDEDOR')).trim() : null,
    total: parseTotal(pick(row, 'TOTAL', 'TOTAL ')),
    nfPd: pick(row, 'NF / PD', 'NF/PD') != null ? String(pick(row, 'NF / PD', 'NF/PD')).trim() : null,
    parcela: pick(row, 'PARCELA') != null ? String(pick(row, 'PARCELA')).trim() : null,
    obs: pick(row, 'OBS') != null ? String(pick(row, 'OBS')).trim() : null,
  };
}

async function main() {
  const xlsxPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultXlsx;
  if (!fs.existsSync(xlsxPath)) {
    throw new Error(`Arquivo não encontrado: ${xlsxPath}`);
  }

  const existing = await countRegistroInadimplentes();
  console.log(`Registros atuais: ${existing}`);
  console.log(`Lendo: ${xlsxPath}`);

  const wb = XLSX.readFile(xlsxPath, { cellDates: false });
  const sheetName = wb.SheetNames.includes('Planilha2') ? 'Planilha2' : wb.SheetNames[0];
  const rowsRaw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], {
    defval: '',
    raw: true,
  });

  const inputs = rowsRaw
    .map((r) => rowToInput(r))
    .filter((r): r is RegistroInadimplenteInput => r != null);

  console.log(`Linhas válidas na planilha: ${inputs.length}`);

  const result = await importRegistroInadimplentesBulk(inputs, {
    clearExistingImport: true,
    login: 'import-xlsx',
  });

  const total = await countRegistroInadimplentes();
  console.log(`Importados: ${result.inserted}. Total na tabela: ${total}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
