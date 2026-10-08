import GradeFiltroCabecalhoBtn from '../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../components/grade/GradeFiltroExcelPortal';
import type { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import { EQUIPE_LABEL } from '../../api/comissionamento';
import { formatEmissaoPainelBr, type PainelComercialPedido, type StatusConformidadePainel } from '../../api/painelComercial';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const pctFmt = (n: number) =>
  `${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

export const COLUNAS_GRADE_PAINEL = [
  { id: 'pd', label: 'PD' },
  { id: 'cliente', label: 'Cliente' },
  { id: 'vendedor', label: 'Vendedor/Representante' },
  { id: 'equipe', label: 'Equipe' },
  { id: 'tipoCliente', label: 'Tipo cliente' },
  { id: 'emissao', label: 'Emissão' },
  { id: 'valorTotal', label: 'Valor Total', align: 'right' as const },
  { id: 'valorDesconto', label: 'Valor Desconto', align: 'right' as const },
  { id: 'totalPedido', label: 'Valor Total com Desconto', align: 'right' as const },
  { id: 'entrada', label: 'Entrada', align: 'right' as const },
  { id: 'pctEntrada', label: '% Ent.', align: 'right' as const },
  { id: 'pctDesconto', label: '% Desc.', align: 'right' as const },
  { id: 'forma', label: 'Forma' },
  { id: 'condicao', label: 'Condição de Pagamento' },
  { id: 'prazos', label: 'Prazos (cadastro → esperado)' },
  { id: 'observacao', label: 'Observação do pedido' },
  { id: 'status', label: 'Status' },
] as const;

const NUMERICAS = new Set([
  'valorTotal',
  'valorDesconto',
  'totalPedido',
  'entrada',
  'pctEntrada',
  'pctDesconto',
]);
const DATAS = new Set(['emissao']);

export type GradePainelApi = ReturnType<typeof useGradeFiltrosExcel<PainelComercialPedido>>;

function labelStatus(s: StatusConformidadePainel): string {
  switch (s) {
    case 'ok':
      return 'Conforme';
    case 'alerta':
      return 'Alerta';
    case 'nao_conforme':
      return 'Não conforme';
    default:
      return 'Excluído (cartão)';
  }
}

function pctDesconto(p: PainelComercialPedido): number {
  if (!(p.valorTotal > 0)) return 0;
  return (p.valorDesconto / p.valorTotal) * 100;
}

export function textoCelulaPainel(p: PainelComercialPedido, colId: string): string {
  switch (colId) {
    case 'pd':
      return p.pd || '—';
    case 'cliente':
      return p.cliente || '—';
    case 'vendedor':
      return p.vendedorRepresentante || '—';
    case 'equipe':
      return EQUIPE_LABEL[p.equipe ?? 'sem_equipe'];
    case 'tipoCliente':
      return p.tipoCliente === 'recorrente'
        ? 'Recorrente'
        : p.tipoCliente === 'reativado'
          ? 'Reativado'
          : 'Novo';
    case 'emissao':
      return formatEmissaoPainelBr(p.emissao);
    case 'valorTotal':
      return brl.format(p.valorTotal ?? 0);
    case 'valorDesconto':
      return brl.format(p.valorDesconto ?? 0);
    case 'totalPedido':
      return brl.format(p.totalPedido ?? 0);
    case 'entrada':
      return brl.format(p.somaEntrada ?? 0);
    case 'pctEntrada':
      return pctFmt((p.pctEntrada ?? 0) * 100);
    case 'pctDesconto':
      return pctFmt(pctDesconto(p));
    case 'forma':
      return p.formaPagamento || '—';
    case 'condicao':
      return p.condicaoPagamento || '—';
    case 'prazos':
      return `${p.periodicidadeLabel || '—'} → ${p.diasEsperados || '—'}`;
    case 'observacao':
      return p.observacaoPedido || '—';
    case 'status':
      return labelStatus(p.status);
    default:
      return '';
  }
}

export function valorOrdenacaoPainel(p: PainelComercialPedido, colId: string): string | number {
  switch (colId) {
    case 'emissao':
      return p.emissao || '';
    case 'valorTotal':
      return p.valorTotal ?? 0;
    case 'valorDesconto':
      return p.valorDesconto ?? 0;
    case 'totalPedido':
      return p.totalPedido ?? 0;
    case 'entrada':
      return p.somaEntrada ?? 0;
    case 'pctEntrada':
      return (p.pctEntrada ?? 0) * 100;
    case 'pctDesconto':
      return pctDesconto(p);
    default:
      return textoCelulaPainel(p, colId);
  }
}

export function PainelCabecalhoTh({
  colId,
  label,
  grade,
  align = 'left',
  className = '',
}: {
  colId: string;
  label: string;
  grade: GradePainelApi;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  return (
    <th className={`px-0 py-0 font-semibold whitespace-nowrap ${className}`.trim()}>
      <div
        className={`flex min-h-[2.5rem] items-center gap-1 px-2 py-1.5 ${
          align === 'right' ? 'flex-row-reverse justify-end' : align === 'center' ? 'justify-center' : 'justify-between'
        }`}
      >
        <span className={`min-w-0 ${align === 'right' ? 'text-right' : ''}`}>{label}</span>
        <GradeFiltroCabecalhoBtn
          ativo={grade.colunaComFiltroAtivo(colId)}
          onClick={(e) => grade.abrirFiltroExcel(colId, e)}
          className="shrink-0"
        />
      </div>
    </th>
  );
}

export function PainelGradeFiltroPortal({ grade }: { grade: GradePainelApi }) {
  if (!grade.colunaFiltroAberta || !grade.filtroAbertoRect) return null;
  const colId = grade.colunaFiltroAberta;
  const numerica = NUMERICAS.has(colId);
  return (
    <GradeFiltroExcelPortal
      colunaAberta={colId}
      rect={grade.filtroAbertoRect}
      dropdownRef={grade.filtroDropdownRef}
      excelFilterDrafts={grade.excelFilterDrafts}
      setExcelFilterDrafts={grade.setExcelFilterDrafts}
      valoresUnicosPorColuna={grade.valoresUnicosPorColuna}
      onSortAsc={(id) => {
        grade.setSortState({ key: id, direction: 'asc' });
        grade.setSortLevels([]);
        grade.fecharFiltroExcel();
      }}
      onSortDesc={(id) => {
        grade.setSortState({ key: id, direction: 'desc' });
        grade.setSortLevels([]);
        grade.fecharFiltroExcel();
      }}
      onAplicar={grade.aplicarFiltroExcel}
      onCancelar={grade.fecharFiltroExcel}
      showNumericFilters={numerica}
      showDateRangeFilters={DATAS.has(colId)}
      sortAscLabel={numerica || DATAS.has(colId) ? 'Menor → Maior' : undefined}
      sortDescLabel={numerica || DATAS.has(colId) ? 'Maior → Menor' : undefined}
    />
  );
}
