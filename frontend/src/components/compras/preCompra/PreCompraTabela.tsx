import type { PreCompraCotacaoItem } from '../../../api/preCompra';

interface Props {
  items: PreCompraCotacaoItem[];
  onEmitirPdf: (cotacao: string) => void;
  generatingCotacao?: string | null;
}

interface CotacaoGroup {
  cotacao: string;
  items: PreCompraCotacaoItem[];
}

function formatDate(value: string) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('pt-BR');
}

function formatMoney(value: number | string | null | undefined) {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatQty(value: number | string | null | undefined) {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function groupByCotacao(items: PreCompraCotacaoItem[]): CotacaoGroup[] {
  const groups: CotacaoGroup[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.cotacao === item.cotacao) {
      last.items.push(item);
    } else {
      groups.push({ cotacao: item.cotacao, items: [item] });
    }
  }
  return groups;
}

function PdfActionButton({
  loading,
  onClick,
}: {
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/70"
      onClick={onClick}
      disabled={loading}
      title="Emitir PDF"
    >
      {loading ? (
        <>
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
          Gerando…
        </>
      ) : (
        <>
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2 5 5h-5V4zM8 13h8v2H8v-2zm0 4h5v2H8v-2z" />
          </svg>
          PDF
        </>
      )}
    </button>
  );
}

export default function PreCompraTabela({ items, onEmitirPdf, generatingCotacao = null }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-8 text-center text-slate-500 dark:text-slate-400">
        Nenhuma cotação encontrada.
      </div>
    );
  }

  const groups = groupByCotacao(items);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-600">
      <table className="min-w-full text-sm text-slate-800 dark:text-slate-100">
        <thead className="bg-slate-100 dark:bg-slate-800 text-xs uppercase text-slate-600 dark:text-slate-400">
          <tr>
            <th className="px-3 py-2 text-left whitespace-nowrap">Cotação</th>
            <th className="px-3 py-2 text-left whitespace-nowrap">Data emissão</th>
            <th className="px-3 py-2 text-left whitespace-nowrap">Comprador</th>
            <th className="px-3 py-2 text-left whitespace-nowrap">Status</th>
            <th className="px-3 py-2 text-left whitespace-nowrap">Fornecedor</th>
            <th className="px-3 py-2 text-left whitespace-nowrap">Cód. produto</th>
            <th className="px-3 py-2 text-left whitespace-nowrap min-w-[160px]">Descrição</th>
            <th className="px-3 py-2 text-right whitespace-nowrap">Qtde</th>
            <th className="px-3 py-2 text-left whitespace-nowrap">U.M</th>
            <th className="px-3 py-2 text-right whitespace-nowrap">Preço unit.</th>
            <th className="px-3 py-2 text-right whitespace-nowrap">Total</th>
            <th className="px-3 py-2 text-left whitespace-nowrap">Solicitação</th>
            <th className="px-3 py-2 text-left whitespace-nowrap">Data necessidade</th>
            <th className="px-3 py-2 text-left whitespace-nowrap">N° da coleta</th>
            <th className="px-3 py-2 text-center whitespace-nowrap">Ações</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group, groupIdx) => {
            const rowSpan = group.items.length;
            const groupClass = groupIdx % 2 === 0 ? 'bg-white dark:bg-slate-900/30' : 'bg-slate-50/80 dark:bg-slate-800/20';
            const isGenerating = generatingCotacao === group.cotacao;
            const header = group.items[0];

            return group.items.map((item, itemIdx) => {
              const isFirst = itemIdx === 0;

              return (
                <tr
                  key={`${item.cotacao}-${item.fornecedor_id}-${item.codigo_produto}-${itemIdx}`}
                  className={`border-t border-slate-100 dark:border-slate-700/50 ${groupClass}`}
                >
                  {isFirst && (
                    <>
                      <td rowSpan={rowSpan} className="px-3 py-2 align-top font-medium whitespace-nowrap">
                        {header.cotacao}
                      </td>
                      <td rowSpan={rowSpan} className="px-3 py-2 align-top whitespace-nowrap">
                        {formatDate(header.data_emissao)}
                      </td>
                      <td rowSpan={rowSpan} className="px-3 py-2 align-top">
                        {header.comprador}
                      </td>
                      <td rowSpan={rowSpan} className="px-3 py-2 align-top">
                        <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                          {header.status_label}
                        </span>
                      </td>
                    </>
                  )}

                  <td className="px-3 py-2">{item.fornecedor}</td>
                  <td className="px-3 py-2">
                    <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-700">
                      {item.codigo_produto}
                    </code>
                  </td>
                  <td className="px-3 py-2 max-w-[240px] truncate" title={item.descricao_produto}>
                    {item.descricao_produto}
                  </td>
                  <td className="px-3 py-2 text-right">{formatQty(item.qtde)}</td>
                  <td className="px-3 py-2">{item.unidade}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{formatMoney(item.preco_unitario)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap font-medium">
                    {formatMoney(item.valor_total)}
                  </td>
                  <td className="px-3 py-2">{item.solicitacao_id}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(item.data_necessidade)}</td>

                  {isFirst && (
                    <>
                      <td rowSpan={rowSpan} className="px-3 py-2 align-top whitespace-nowrap">
                        {header.numeros_coleta && header.numeros_coleta.length > 0 ? (
                          <span className="inline-flex flex-wrap gap-1">
                            {header.numeros_coleta.map((n) => (
                              <span
                                key={n}
                                className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                              >
                                {n}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">—</span>
                        )}
                      </td>
                      <td rowSpan={rowSpan} className="px-3 py-2 align-top text-center">
                        <PdfActionButton loading={isGenerating} onClick={() => onEmitirPdf(group.cotacao)} />
                      </td>
                    </>
                  )}
                </tr>
              );
            });
          })}
        </tbody>
      </table>
      <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700">
        {groups.length} cotação(ões) nesta página
      </div>
    </div>
  );
}
