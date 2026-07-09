import { useCallback, useMemo, useState } from 'react';
import type { TooltipDetalheRow } from '../api/pedidos';
import { labelPedidoMapa, itensProdutoLinhaPedido } from '../utils/mapaMunicipioPedido';
import HeatmapPedidoItensModal from './HeatmapPedidoItensModal';

function formatarValor(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor);
}

function formatDataExibicao(iso: string): string {
  if (!iso || iso.length < 10) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : '—';
}

type SortCol = 'rm' | 'rota' | 'dataEmissao' | 'pedido' | 'municipio' | 'aVista' | 'valorPendente';
type SortDir = 'asc' | 'desc';

export default function HeatmapDetalhesPedidosTable({
  titulo,
  subtitulo,
  detalhesBruto,
  maxAlturaPx = 320,
}: {
  titulo: string;
  subtitulo?: string;
  detalhesBruto: TooltipDetalheRow[];
  maxAlturaPx?: number;
}) {
  const [sortBy, setSortBy] = useState<SortCol>('dataEmissao');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [linhaPedidoModal, setLinhaPedidoModal] = useState<TooltipDetalheRow | null>(null);

  const abrirItensPedido = useCallback((row: TooltipDetalheRow, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLinhaPedidoModal(row);
  }, []);

  /** Uma linha por (pedido + rota): mesmo pedido em duas rotas vira duas linhas, com somatório do valor por rota. */
  const detalhesPorPedido = useMemo(() => {
    if (detalhesBruto.length === 0) return [];
    const byPedidoRota = new Map<string, TooltipDetalheRow & { valorPendente: number }>();
    for (const row of detalhesBruto) {
      const pedido = String(row.pedido ?? '').trim() || `_${row.codigo ?? ''}_${row.produto ?? ''}`;
      const rota = (row.rota ?? '').trim();
      const rm = (row.rm ?? '').trim();
      const key = `${pedido}|${rota}|${rm}`;
      const existing = byPedidoRota.get(key);
      if (existing) {
        existing.valorPendente += row.valorPendente ?? 0;
      } else {
        byPedidoRota.set(key, { ...row, valorPendente: row.valorPendente ?? 0 });
      }
    }
    return [...byPedidoRota.values()];
  }, [detalhesBruto]);

  const toggleSort = useCallback((col: SortCol) => {
    setSortBy(col);
    setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
  }, []);

  const detalhes = useMemo(() => {
    if (detalhesPorPedido.length === 0) return [];
    return [...detalhesPorPedido].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'valorPendente') {
        cmp = (a.valorPendente ?? 0) - (b.valorPendente ?? 0);
      } else if (sortBy === 'dataEmissao') {
        const da = (a as TooltipDetalheRow).dataEmissao ?? '';
        const db = (b as TooltipDetalheRow).dataEmissao ?? '';
        cmp = da.localeCompare(db, undefined, { numeric: true });
      } else {
        const va = String((a as Record<string, unknown>)[sortBy] ?? '').toLowerCase();
        const vb = String((b as Record<string, unknown>)[sortBy] ?? '').toLowerCase();
        cmp = va.localeCompare(vb, undefined, { numeric: true });
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [detalhesPorPedido, sortBy, sortDir]);

  const totalVenda = useMemo(
    () => detalhes.reduce((s, r) => s + (r.valorPendente ?? 0), 0),
    [detalhes]
  );

  const thClass =
    'text-left py-1.5 px-2 border-b border-amber-200 font-semibold cursor-pointer select-none hover:bg-amber-100 bg-amber-50/90 text-slate-800';
  const thRightClass =
    'text-right py-1.5 px-2 border-b border-amber-200 font-semibold pl-4 cursor-pointer select-none hover:bg-amber-100 bg-amber-50/90 text-slate-800';

  return (
    <div className="min-w-[480px] max-w-[90vw] w-max" style={{ maxWidth: 'min(720px, 90vw)' }}>
      <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 rounded-t-lg">
        <div className="font-semibold text-slate-800 text-sm">{titulo}</div>
        {subtitulo ? <div className="text-xs text-slate-500 mt-0.5 font-mono">{subtitulo}</div> : null}
        <div className="text-xs text-slate-600 mt-0.5">Total VENDA: {formatarValor(totalVenda)}</div>
      </div>
      <div className="overflow-auto overscroll-contain" style={{ maxHeight: maxAlturaPx }}>
        <table className="text-xs border-collapse whitespace-nowrap w-full">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className={thClass} onClick={() => toggleSort('rm')} role="button" title="Ordenar por RM">
                RM {sortBy === 'rm' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th className={thClass} onClick={() => toggleSort('rota')} role="button" title="Ordenar por Rotas">
                ROTAS {sortBy === 'rota' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className={thClass}
                onClick={() => toggleSort('dataEmissao')}
                role="button"
                title="Ordenar por Data Emissão"
              >
                DATA EMISSÃO {sortBy === 'dataEmissao' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th className={thClass} onClick={() => toggleSort('pedido')} role="button" title="Ordenar por PD">
                PD {sortBy === 'pedido' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className={thClass}
                onClick={() => toggleSort('municipio')}
                role="button"
                title="Ordenar por Município"
              >
                MUNICIPIO {sortBy === 'municipio' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th className={thClass} onClick={() => toggleSort('aVista')} role="button" title="Ordenar por A Vista">
                A VISTA {sortBy === 'aVista' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th className={thRightClass} onClick={() => toggleSort('valorPendente')} role="button" title="Ordenar por Venda">
                VENDA {sortBy === 'valorPendente' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
            </tr>
          </thead>
          <tbody className="text-slate-700 bg-white">
            {detalhes.map((row, idx) => (
              <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-1 px-2">{row.rm || '—'}</td>
                <td className="py-1 px-2 max-w-[200px] truncate" title={row.rota || ''}>
                  {row.rota || '—'}
                </td>
                <td className="py-1 px-2">{formatDataExibicao(row.dataEmissao ?? '')}</td>
                <td className="py-1 px-2">
                  {row.pedido ? (
                    <button
                      type="button"
                      className="font-medium text-primary-700 underline-offset-2 hover:underline dark:text-primary-300"
                      title="Ver itens do pedido"
                      onClick={(e) => abrirItensPedido(row, e)}
                    >
                      {labelPedidoMapa(row.pedido)}
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="py-1 px-2">{row.municipio || '—'}</td>
                <td className="py-1 px-2">{row.aVista || '—'}</td>
                <td className="py-1 px-2 pl-4 text-right">{formatarValor(row.valorPendente ?? 0)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-amber-200 bg-amber-50/70 font-semibold text-slate-800">
              <td className="py-1.5 px-2" colSpan={6}>
                Total
              </td>
              <td className="py-1.5 px-2 pl-4 text-right">{formatarValor(totalVenda)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {linhaPedidoModal && (
        <HeatmapPedidoItensModal
          open
          linha={linhaPedidoModal}
          municipioLabel={titulo}
          itens={itensProdutoLinhaPedido(linhaPedidoModal, detalhesBruto)}
          onClose={() => setLinhaPedidoModal(null)}
        />
      )}
    </div>
  );
}

