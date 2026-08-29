import type { DfcAgendamentoDetalheLinha } from '../../../api/financeiro';
import {
  DFC_PRIORIDADE_LABEL_CURTO,
  type DfcPrioridade,
} from '../../../api/dfcPrioridade';
import { labelEmpresaDfc } from './dfcEmpresas';

export type DfcDetalheColId =
  | 'id'
  | 'empresa'
  | 'descricao'
  | 'nome'
  | 'plano'
  | 'dataVencimento'
  | 'dataBaixa'
  | 'dataCompetencia'
  | 'valor'
  | 'prioridade';

export const DFC_DETALHE_COL_LABELS: Record<DfcDetalheColId, string> = {
  id: 'Código',
  empresa: 'Empresa',
  descricao: 'Descrição',
  nome: 'Fornecedor',
  plano: 'Plano de contas',
  dataVencimento: 'Data Vencimento',
  dataBaixa: 'Data Baixa',
  dataCompetencia: 'Data Competência',
  valor: 'Valor',
  prioridade: 'Prioridade',
};

export const DFC_DETALHE_NUMERIC = new Set<DfcDetalheColId>(['id', 'valor']);
export const DFC_DETALHE_DATAS = new Set<DfcDetalheColId>([
  'dataVencimento',
  'dataBaixa',
  'dataCompetencia',
]);

const nfValor = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function fmtDataBrDetalhe(ymd: string | null | undefined): string {
  if (!ymd) return '—';
  const p = ymd.slice(0, 10);
  const [y, m, d] = p.split('-');
  if (y && m && d) return `${d}/${m}/${y}`;
  return ymd;
}

export type DfcDetalheGradeColunasOpts = {
  incluirDescricao?: boolean;
  incluirPlano?: boolean;
  incluirCompetencia?: boolean;
  incluirDataBaixa?: boolean;
  incluirPrioridade?: boolean;
};

export function montarColunasGradeDfcDetalhe(opts: DfcDetalheGradeColunasOpts): DfcDetalheColId[] {
  const cols: DfcDetalheColId[] = ['id', 'empresa'];
  if (opts.incluirDescricao !== false) cols.push('descricao');
  if (opts.incluirPlano) cols.push('plano');
  cols.push('nome', 'dataVencimento');
  if (opts.incluirCompetencia) cols.push('dataCompetencia');
  if (opts.incluirDataBaixa !== false) cols.push('dataBaixa');
  cols.push('valor');
  if (opts.incluirPrioridade !== false) cols.push('prioridade');
  return cols;
}

export type PrioridadeEfetivaDetalheFn = (
  row: DfcAgendamentoDetalheLinha,
) => DfcPrioridade | null;

export function prioridadeTextoGrade(row: DfcAgendamentoDetalheLinha, eff: DfcPrioridade | null): string {
  if (eff == null) return '— Sem prioridade';
  return `${eff} — ${DFC_PRIORIDADE_LABEL_CURTO[eff]}`;
}

export function criarGetCellTextDfcDetalhe(
  prioridadeEfetiva: PrioridadeEfetivaDetalheFn,
): (row: DfcAgendamentoDetalheLinha, colId: string) => string {
  return (row, colId) => {
    switch (colId as DfcDetalheColId) {
      case 'id':
        return String(row.id);
      case 'empresa':
        return row.empresa?.trim() || labelEmpresaDfc(row.idEmpresa);
      case 'descricao':
        return row.descricaoLancamento?.trim() || '—';
      case 'nome':
        return row.nome?.trim() || '—';
      case 'plano':
        return row.planoContas?.trim() || '—';
      case 'dataVencimento':
        return fmtDataBrDetalhe(row.dataVencimento);
      case 'dataBaixa':
        return fmtDataBrDetalhe(row.dataBaixa);
      case 'dataCompetencia':
        return fmtDataBrDetalhe(row.dataCompetencia);
      case 'valor':
        return nfValor.format(row.valorBaixado);
      case 'prioridade':
        return prioridadeTextoGrade(row, prioridadeEfetiva(row));
      default:
        return '';
    }
  };
}

export function criarValueForSortDfcDetalhe(
  prioridadeEfetiva: PrioridadeEfetivaDetalheFn,
): (row: DfcAgendamentoDetalheLinha, colId: string) => string | number {
  return (row, colId) => {
    switch (colId as DfcDetalheColId) {
      case 'id':
        return row.id;
      case 'valor':
        return row.valorBaixado;
      case 'dataVencimento':
        return row.dataVencimento?.slice(0, 10) ?? '';
      case 'dataBaixa':
        return row.dataBaixa?.slice(0, 10) ?? '';
      case 'dataCompetencia':
        return row.dataCompetencia?.slice(0, 10) ?? '';
      case 'prioridade':
        return prioridadeEfetiva(row) ?? 99;
      default:
        return criarGetCellTextDfcDetalhe(prioridadeEfetiva)(row, colId);
    }
  };
}

export function rotuloColunaGradeDfc(colId: DfcDetalheColId, rotuloDataBaixa?: string): string {
  if (colId === 'dataBaixa' && rotuloDataBaixa) return rotuloDataBaixa;
  return DFC_DETALHE_COL_LABELS[colId];
}
