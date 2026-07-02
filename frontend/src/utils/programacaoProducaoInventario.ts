import * as XLSX from 'xlsx';
import type { EstoqueEmProcesso, LinhaProgramacaoProducao } from '../components/programacao-producao/types';
import { ESTOQUE_PROCESSO_VAZIO } from '../components/programacao-producao/programacaoProducaoCalculos';
import { normalizarCodComponente } from './programacaoProducaoDescricaoSimplificada';

export const INVENTARIO_HEADERS = [
  'cód',
  'descrição simp',
  'Perfiladeira',
  'Corte e dobra',
  'solda',
  'pintura',
  'montagem',
] as const;

export type InventarioPlanilhaRow = {
  cod: string;
  descricaoSimp: string | null;
  estoque: EstoqueEmProcesso;
};

function normHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');
}

function parseNumCell(v: unknown): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, v);
  const s = String(v).trim().replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function mapHeaderIndex(headers: string[]): Record<string, number> | null {
  const idx: Record<string, number> = {};
  headers.forEach((h, i) => {
    const n = normHeader(h);
    if (n === 'cod' || n === 'codigo' || n === 'cod componente') idx.cod = i;
    else if (n.includes('descricao') && n.includes('simp')) idx.desc = i;
    else if (n === 'perfiladeira') idx.perfiladeira = i;
    else if (n.includes('corte') && n.includes('dobra')) idx.corteDobra = i;
    else if (n === 'solda') idx.solda = i;
    else if (n === 'pintura') idx.pintura = i;
    else if (n === 'montagem') idx.montagem = i;
  });
  if (idx.cod == null || idx.perfiladeira == null) return null;
  return idx;
}

export function downloadInventarioModelo(linhas: LinhaProgramacaoProducao[]): void {
  const rows = linhas.map((l) => {
    const ep = l.estoque_em_processo ?? ESTOQUE_PROCESSO_VAZIO;
    return [
      l.cod_componente,
      l.descricao_simplificada?.trim() ?? '',
      ep.perfiladeira,
      ep.corteDobra,
      ep.solda,
      ep.pintura,
      ep.montagem,
    ];
  });
  const ws = XLSX.utils.aoa_to_sheet([[...INVENTARIO_HEADERS], ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
  const ts = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `programacao_producao_inventario_${ts}.xlsx`);
}

export function parseInventarioXlsx(buffer: ArrayBuffer): {
  rows: InventarioPlanilhaRow[];
  erro?: string;
} {
  try {
    const wb = XLSX.read(buffer, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return { rows: [], erro: 'Planilha vazia.' };
    const ws = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }) as unknown[][];
    if (!aoa.length) return { rows: [], erro: 'Nenhuma linha na planilha.' };

    const headerRow = (aoa[0] ?? []).map((c) => String(c ?? ''));
    const colMap = mapHeaderIndex(headerRow);
    if (!colMap) {
      return {
        rows: [],
        erro: 'Cabeçalho inválido. Use as colunas do modelo: cód, descrição simp, Perfiladeira, etc.',
      };
    }

    const out: InventarioPlanilhaRow[] = [];
    for (let r = 1; r < aoa.length; r++) {
      const row = aoa[r] ?? [];
      const codRaw = String(row[colMap.cod!] ?? '').trim();
      if (!codRaw) continue;
      out.push({
        cod: codRaw,
        descricaoSimp:
          colMap.desc != null ? String(row[colMap.desc] ?? '').trim() || null : null,
        estoque: {
          perfiladeira: parseNumCell(row[colMap.perfiladeira!]),
          corteDobra: colMap.corteDobra != null ? parseNumCell(row[colMap.corteDobra]) : 0,
          solda: colMap.solda != null ? parseNumCell(row[colMap.solda]) : 0,
          pintura: colMap.pintura != null ? parseNumCell(row[colMap.pintura]) : 0,
          montagem: colMap.montagem != null ? parseNumCell(row[colMap.montagem]) : 0,
        },
      });
    }
    if (!out.length) return { rows: [], erro: 'Nenhuma linha com código preenchido.' };
    return { rows: out };
  } catch {
    return { rows: [], erro: 'Não foi possível ler o arquivo. Use .xlsx válido.' };
  }
}

/** Aplica inventário: só linhas presentes na planilha; componentes ausentes mantêm valores atuais. */
export function aplicarInventarioNasLinhas(
  linhas: LinhaProgramacaoProducao[],
  inventario: InventarioPlanilhaRow[]
): LinhaProgramacaoProducao[] {
  const porCod = new Map<string, InventarioPlanilhaRow>();
  for (const row of inventario) {
    porCod.set(normalizarCodComponente(row.cod), row);
  }
  return linhas.map((l) => {
    const inv = porCod.get(normalizarCodComponente(l.cod_componente));
    if (!inv) return l;
    return {
      ...l,
      estoque_em_processo: { ...inv.estoque },
    };
  });
}
