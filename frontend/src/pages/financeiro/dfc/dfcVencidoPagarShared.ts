import type { DfcDespesaPagamentoEmAbertoLinha } from '../../../api/financeiro';
import { labelEmpresaDfc } from './dfcEmpresas';
import { listarOpcoesPlanoContasDfc } from './dfcPlanoContasOpcoes';

export const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const OPCOES_PLANO = listarOpcoesPlanoContasDfc();
export const PLANO_LABEL: Record<number, string> = Object.fromEntries(
  OPCOES_PLANO.map((o) => [o.idNum, o.label]),
);

export type Agrupado = { chave: string; valor: number; qtd: number };

export const CORES_CATEGORIA = [
  '#3B82F6',
  '#F97316',
  '#14B8A6',
  '#A855F7',
  '#EC4899',
  '#EAB308',
  '#1E40AF',
  '#22C55E',
  '#6366F1',
  '#B91C1C',
];

export const FAIXAS_ATRASO = [
  { label: 'Até 30 dias', min: 1, max: 30, cor: '#22C55E', barClass: 'bg-emerald-500' },
  { label: '31 a 60 dias', min: 31, max: 60, cor: '#EAB308', barClass: 'bg-yellow-400' },
  { label: '61 a 90 dias', min: 61, max: 90, cor: '#F97316', barClass: 'bg-orange-500' },
  { label: '91 a 120 dias', min: 91, max: 99999, cor: '#EF4444', barClass: 'bg-red-500' },
] as const;

export function fmtDataBr(ymd: string | null | undefined): string {
  if (!ymd) return '—';
  const p = ymd.slice(0, 10);
  const [y, m, d] = p.split('-');
  if (y && m && d) return `${d}/${m}/${y}`;
  return ymd;
}

export function hojeYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function diasAtraso(dataVenc: string | null): number {
  if (!dataVenc) return 0;
  const hoje = hojeYmd();
  const v = dataVenc.slice(0, 10);
  if (v >= hoje) return 0;
  const a = new Date(`${hoje}T12:00:00`).getTime();
  const b = new Date(`${v}T12:00:00`).getTime();
  return Math.max(0, Math.floor((a - b) / 86400000));
}

export function pctDoTotal(valor: number, total: number): string {
  if (total <= 0) return '—';
  return `${((valor / total) * 100).toFixed(1).replace('.', ',')}%`;
}

export function labelCategoria(r: DfcDespesaPagamentoEmAbertoLinha): string {
  const id = r.idContaFinanceiro;
  if (id != null && PLANO_LABEL[id]) return PLANO_LABEL[id];
  return r.descricaoLancamento?.trim() || `Conta #${id ?? '?'}`;
}

export function agregar(
  linhas: DfcDespesaPagamentoEmAbertoLinha[],
  chaveFn: (r: DfcDespesaPagamentoEmAbertoLinha) => string,
): Agrupado[] {
  const map = new Map<string, { valor: number; qtd: number }>();
  for (const r of linhas) {
    const chave = chaveFn(r) || '(sem identificação)';
    const cur = map.get(chave) ?? { valor: 0, qtd: 0 };
    cur.valor += r.saldoBaixar;
    cur.qtd += 1;
    map.set(chave, cur);
  }
  return [...map.entries()]
    .map(([chave, v]) => ({ chave, valor: v.valor, qtd: v.qtd }))
    .sort((a, b) => b.valor - a.valor);
}

export function filtrarFaixa(
  linhas: DfcDespesaPagamentoEmAbertoLinha[],
  min: number,
  max: number,
): DfcDespesaPagamentoEmAbertoLinha[] {
  return linhas.filter((r) => {
    const d = diasAtraso(r.dataVencimento);
    return d >= min && d <= max;
  });
}

export function exportarCsvVencidos(
  linhas: DfcDespesaPagamentoEmAbertoLinha[],
  nomeArquivo: string,
): void {
  const header = [
    'Codigo',
    'Vencimento',
    'AtrasoDias',
    'Empresa',
    'Categoria',
    'Fornecedor',
    'Saldo',
  ];
  const rows = linhas.map((r) => [
    r.id,
    fmtDataBr(r.dataVencimento),
    diasAtraso(r.dataVencimento),
    labelEmpresaDfc(r.idEmpresa),
    labelCategoria(r),
    r.nome ?? '',
    r.saldoBaixar.toFixed(2).replace('.', ','),
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
    .join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}

export type DrillDownPayload = {
  titulo: string;
  subtitulo?: string;
  linhas: DfcDespesaPagamentoEmAbertoLinha[];
};
