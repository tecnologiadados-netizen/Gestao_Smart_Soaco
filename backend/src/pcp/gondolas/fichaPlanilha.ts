import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import { componentesDaPlanilha, type LinhaPlanilha, type SetorGondola } from './regras.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_FILE = join(__dirname, 'fichaPlanilhaSeed.json');
const OVERRIDE_FILE = join(__dirname, '..', '..', '..', 'var', 'gondolas-porta-palete', 'ficha.json');

type ArquivoPlanilha = {
  gondolas: LinhaPlanilha[];
  portaPaletes: LinhaPlanilha[];
  atualizadoEm?: string;
};

export type ResumoPlanilha = {
  gondolas: number;
  portaPaletes: number;
  origem: 'importada' | 'inicial';
  atualizadoEm: string | null;
};

function vazio(): ArquivoPlanilha {
  return { gondolas: [], portaPaletes: [] };
}

function lerJson(caminho: string): ArquivoPlanilha | null {
  if (!existsSync(caminho)) return null;
  try {
    const bruto = JSON.parse(readFileSync(caminho, 'utf8')) as Partial<ArquivoPlanilha>;
    return {
      gondolas: Array.isArray(bruto.gondolas) ? bruto.gondolas : [],
      portaPaletes: Array.isArray(bruto.portaPaletes) ? bruto.portaPaletes : [],
      atualizadoEm: bruto.atualizadoEm,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[gondolas] planilha:', msg);
    return null;
  }
}

export function carregarPlanilha(): ArquivoPlanilha & { origem: ResumoPlanilha['origem'] } {
  const override = lerJson(OVERRIDE_FILE);
  if (override) return { ...override, origem: 'importada' };
  return { ...(lerJson(SEED_FILE) ?? vazio()), origem: 'inicial' };
}

export function resumoPlanilha(): ResumoPlanilha {
  const arquivo = carregarPlanilha();
  return {
    gondolas: arquivo.gondolas.length,
    portaPaletes: arquivo.portaPaletes.length,
    origem: arquivo.origem,
    atualizadoEm: arquivo.atualizadoEm ?? null,
  };
}

export function linhasDoSetor(setor: SetorGondola): LinhaPlanilha[] {
  const arquivo = carregarPlanilha();
  return setor === 'Porta Paletes' ? arquivo.portaPaletes : arquivo.gondolas;
}

export function componentesPlanilha(setor: SetorGondola, codigo: string, qtdeReal: number) {
  return componentesDaPlanilha(linhasDoSetor(setor), codigo, qtdeReal);
}

function texto(valor: unknown): string {
  return String(valor ?? '').trim();
}

function numeroPlanilha(valor: unknown): number {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
  const bruto = texto(valor).replace(/\s/g, '');
  if (!bruto) return 0;
  const normalizado = bruto.includes(',') ? bruto.replace(/\./g, '').replace(',', '.') : bruto;
  const n = Number(normalizado.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function valorColuna(row: Record<string, unknown>, nomes: string[]): unknown {
  const chaves = Object.keys(row);
  for (const nome of nomes) {
    const achou = chaves.find((chave) => chave.trim().toLowerCase() === nome.toLowerCase());
    if (achou) return row[achou];
  }
  return undefined;
}

export function lerPlanilhaXlsx(buffer: Buffer): LinhaPlanilha[] {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0] ?? ''];
  if (!ws) return [];
  const cru = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1 });
  let header = 0;
  const marcas = ['código', 'codigo', 'cod', 'cód', 'item', 'peça', 'peca'];
  for (let i = 0; i < Math.min(cru.length, 20); i += 1) {
    const row = cru[i] ?? [];
    if (row.some((cell) => marcas.some((marca) => String(cell ?? '').toLowerCase().includes(marca)))) {
      header = i;
      break;
    }
  }
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { range: header });
  return data
    .map((row) => ({
      codigo: texto(
        valorColuna(row, [
          'Código PA',
          'Código do produto',
          'Codigo Produto',
          'Codigo',
          'Cod',
          'Cód.',
          'Cód. Prod.',
          'Cód. Produto',
        ])
      ),
      descricaoPeca: texto(
        valorColuna(row, ['Descrição da peça', 'Descricao Peca', 'Peça', 'Peca', 'Desc. Peça'])
      ),
      quantidade: numeroPlanilha(valorColuna(row, ['Quantidade', 'Qtd', 'Qtde', 'Qtd.', 'Quant.']) ?? 1),
      materiaPrima: texto(
        valorColuna(row, [
          'Espessura/Matéria Prima',
          'Espessura/Materia Prima',
          'Matéria prima',
          'Materia Prima',
          'MP',
          'Material',
        ])
      ),
      medida01: texto(valorColuna(row, ['Medida 01 [mm]', 'Medida 01', 'Medida 1', 'Comp.'])),
      medida02: texto(valorColuna(row, ['Medida 02 [mm]', 'Medida 02', 'Medida 2', 'Larg.'])),
      pesoPeca: numeroPlanilha(
        valorColuna(row, ['Peso da peça', 'Peso Peca', 'Peso', 'Peso Unitário', 'Peso Unit'])
      ),
      codigoNomus: texto(valorColuna(row, ['Código Nomus', 'Codigo Nomus'])),
    }))
    .filter((linha) => linha.codigo);
}

export function salvarPlanilhaSetor(setor: SetorGondola, linhas: LinhaPlanilha[]): ResumoPlanilha {
  const atual = carregarPlanilha();
  const proximo: ArquivoPlanilha = {
    gondolas: setor === 'Gôndolas' ? linhas : atual.gondolas,
    portaPaletes: setor === 'Porta Paletes' ? linhas : atual.portaPaletes,
    atualizadoEm: new Date().toISOString(),
  };
  mkdirSync(dirname(OVERRIDE_FILE), { recursive: true });
  writeFileSync(OVERRIDE_FILE, JSON.stringify(proximo));
  return {
    gondolas: proximo.gondolas.length,
    portaPaletes: proximo.portaPaletes.length,
    origem: 'importada',
    atualizadoEm: proximo.atualizadoEm ?? null,
  };
}
