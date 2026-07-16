import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TooltipDetalheRow } from '../api/pedidos';
import { formatDataCurta } from './sequenciamento-carradas/simulacaoCarradas';
import IndicadorDataPorPrevisao from './sequenciamento-carradas/IndicadorDataPorPrevisao';
import { labelPedidoMapa } from '../utils/mapaMunicipioPedido';
import { formatQtdeParaInput } from '../utils/heatmapAjusteCargaGradeUi';
import { useRegisterModalEscape } from '../contexts/ModalStackContext';
import ModalConsultaEstoqueEmbed from './pcp/ModalConsultaEstoqueEmbed';
import GradeCelulaModalBtn from './pcp/GradeCelulaModalBtn';

function formatarValor(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor);
}

function formatDataColuna(value: string | undefined): string {
  const iso = String(value ?? '').trim().slice(0, 10);
  if (!iso) return '—';
  return formatDataCurta(iso);
}

function formatQtde(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  return formatQtdeParaInput(n);
}

/** Formata data ISO (YYYY-MM-DD) para dd/MM/yyyy sem mudar o dia por fuso. */
function formatDataEmissao(value: string | undefined): string | null {
  const s = String(value ?? '').trim();
  if (!s) return null;
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('pt-BR');
}

/** Acima do HeatmapPedidoItensModal (z 14000). */
const Z_CONSULTA_ESTOQUE = 14100;

export default function HeatmapPedidoItensModal({
  open,
  linha,
  municipioLabel,
  itens,
  onClose,
}: {
  open: boolean;
  linha: TooltipDetalheRow;
  municipioLabel: string;
  itens: TooltipDetalheRow[];
  onClose: () => void;
}) {
  const [consultaCodigo, setConsultaCodigo] = useState<string | null>(null);

  const ordenados = useMemo(
    () =>
      [...itens].sort((a, b) =>
        (a.produto ?? '').localeCompare(b.produto ?? '', 'pt-BR', { sensitivity: 'base' })
      ),
    [itens]
  );

  const totalQtde = useMemo(
    () => ordenados.reduce((s, r) => s + (r.qtdePendenteReal ?? 0), 0),
    [ordenados]
  );
  const totalValor = useMemo(
    () => ordenados.reduce((s, r) => s + (r.valorPendente ?? 0), 0),
    [ordenados]
  );

  useRegisterModalEscape({
    id: `heatmap-pedido-itens`,
    onClose,
    zIndex: 14000,
    enabled: open && !consultaCodigo,
  });

  if (!open) return null;

  const titulo = labelPedidoMapa(linha.pedido);
  const dataEmissaoFmt = formatDataEmissao(linha.dataEmissao);
  const clienteLabel = String(linha.cliente ?? '').trim();
  const meta = [linha.rota, linha.rm ? `RM ${linha.rm}` : ''].filter(Boolean).join(' · ');

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[14000] flex items-center justify-center bg-black/70 p-4"
        role="presentation"
        onClick={onClose}
      >
        <div
          className="flex max-h-[min(85vh,560px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800"
          role="dialog"
          aria-modal
          aria-labelledby="heatmap-pedido-itens-titulo"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="shrink-0 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3
                  id="heatmap-pedido-itens-titulo"
                  className="text-sm font-semibold text-slate-800 dark:text-slate-100"
                >
                  {titulo}
                  {dataEmissaoFmt ? (
                    <span className="ml-2 font-normal text-slate-500 dark:text-slate-400">
                      · {dataEmissaoFmt}
                    </span>
                  ) : null}
                </h3>
                {clienteLabel ? (
                  <p className="mt-0.5 text-xs font-medium text-slate-700 dark:text-slate-200">
                    {clienteLabel}
                  </p>
                ) : null}
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{municipioLabel}</p>
                {meta && (
                  <p
                    className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400"
                    title={meta}
                  >
                    {meta}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-700"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto overscroll-contain px-4 py-3">
            {ordenados.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                Nenhum item encontrado para este pedido.
              </p>
            ) : (
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left dark:border-slate-600 dark:bg-slate-900/50">
                    <th className="whitespace-nowrap py-2 pr-2 font-semibold text-slate-700 dark:text-slate-200">
                      Data de produção
                    </th>
                    <th className="whitespace-nowrap py-2 pr-2 font-semibold text-slate-700 dark:text-slate-200">
                      Previsão atual
                    </th>
                    <th className="py-2 pr-2 font-semibold text-slate-700 dark:text-slate-200">Cód.</th>
                    <th className="py-2 pr-2 font-semibold text-slate-700 dark:text-slate-200">
                      Descrição
                    </th>
                    <th className="py-2 pr-2 text-right font-semibold text-slate-700 dark:text-slate-200">
                      Qtde
                    </th>
                    <th className="py-2 text-right font-semibold text-slate-700 dark:text-slate-200">
                      Valor
                    </th>
                  </tr>
                </thead>
                <tbody className="text-slate-700 dark:text-slate-200">
                  {ordenados.map((row, i) => (
                    <tr key={`${row.codigo}-${i}`} className="border-b border-slate-100 dark:border-slate-700">
                      <td className="whitespace-nowrap py-1.5 pr-2 tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          {formatDataColuna(
                            row.producaoPorPrevisao
                              ? row.dataCalendario ?? row.previsaoAtual
                              : row.dataProducao
                          )}
                          {row.producaoPorPrevisao ? <IndicadorDataPorPrevisao /> : null}
                        </span>
                      </td>
                      <td className="whitespace-nowrap py-1.5 pr-2 tabular-nums">
                        {formatDataColuna(row.previsaoAtual)}
                      </td>
                      <td className="py-1.5 pr-2 font-mono">
                        {row.codigo ? (
                          <GradeCelulaModalBtn
                            onClick={() => setConsultaCodigo(row.codigo)}
                            title={`Consultar estoque de ${row.codigo}`}
                            align="left"
                          >
                            {row.codigo}
                          </GradeCelulaModalBtn>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="max-w-[220px] py-1.5 pr-2 break-words">{row.produto || '—'}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {formatQtde(row.qtdePendenteReal ?? 0)}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {formatarValor(row.valorPendente ?? 0)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-amber-200 bg-amber-50/80 font-semibold dark:border-amber-800 dark:bg-amber-900/30">
                    <td className="py-2 pr-2" colSpan={4}>
                      Total
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">{formatQtde(totalQtde)}</td>
                    <td className="py-2 text-right tabular-nums">{formatarValor(totalValor)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          <div className="flex shrink-0 justify-end border-t border-slate-200 px-4 py-3 dark:border-slate-600">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-500 dark:text-slate-200"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
      {consultaCodigo ? (
        <ModalConsultaEstoqueEmbed
          codigo={consultaCodigo}
          onClose={() => setConsultaCodigo(null)}
          zIndexBase={Z_CONSULTA_ESTOQUE}
        />
      ) : null}
    </>,
    document.body
  );
}
