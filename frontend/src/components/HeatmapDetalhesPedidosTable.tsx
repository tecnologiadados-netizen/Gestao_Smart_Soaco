import { useCallback, useMemo, useState } from 'react';
import type { TooltipDetalheRow } from '../api/pedidos';
import { labelPedidoMapa, itensProdutoLinhaPedido } from '../utils/mapaMunicipioPedido';
import CopiarTextoBtn, { numeroPedidoLimpo } from './CopiarTextoBtn';
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

/** Rota "Inserir em Romaneio" = sem rota definida (espelha backend). */
function isInserirEmRomaneio(rota: string): boolean {
  const r = (rota || '').trim();
  return r.includes('Inserir em Romaneio') || r === '4 - Inserir em Romaneio';
}

type SortCol =
  | 'rm'
  | 'rota'
  | 'dataEmissao'
  | 'dataProducao'
  | 'pedido'
  | 'municipio'
  | 'aVista'
  | 'valorPendente'
  | 'default';
type SortDir = 'asc' | 'desc';

/** Ordenação padrão: Inserir em Romaneio primeiro, depois RM ascendente. */
function compareDefault(a: TooltipDetalheRow, b: TooltipDetalheRow): number {
  const aSem = isInserirEmRomaneio(a.rota ?? '') ? 0 : 1;
  const bSem = isInserirEmRomaneio(b.rota ?? '') ? 0 : 1;
  if (aSem !== bSem) return aSem - bSem;
  const rmA = String(a.rm ?? '').trim();
  const rmB = String(b.rm ?? '').trim();
  return rmA.localeCompare(rmB, undefined, { numeric: true });
}

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
  const [sortBy, setSortBy] = useState<SortCol>('default');
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
    setSortBy((prev) => {
      if (prev === col) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return col;
      }
      setSortDir('asc');
      return col;
    });
  }, []);

  const detalhes = useMemo(() => {
    if (detalhesPorPedido.length === 0) return [];
    return [...detalhesPorPedido].sort((a, b) => {
      if (sortBy === 'default') return compareDefault(a, b);
      let cmp = 0;
      if (sortBy === 'valorPendente') {
        cmp = (a.valorPendente ?? 0) - (b.valorPendente ?? 0);
      } else if (sortBy === 'dataEmissao' || sortBy === 'dataProducao') {
        const da = String((a as TooltipDetalheRow)[sortBy] ?? '');
        const db = String((b as TooltipDetalheRow)[sortBy] ?? '');
        cmp = da.localeCompare(db, undefined, { numeric: true });
      } else {
        const getStr = (row: TooltipDetalheRow, col: SortCol): string => {
          switch (col) {
            case 'rm':
              return row.rm ?? '';
            case 'rota':
              return row.rota ?? '';
            case 'pedido':
              return row.pedido ?? '';
            case 'municipio':
              return row.municipio ?? '';
            case 'aVista':
              return row.aVista ?? '';
            default:
              return '';
          }
        };
        const va = getStr(a, sortBy).toLowerCase();
        const vb = getStr(b, sortBy).toLowerCase();
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

  const sortMark = (col: SortCol) =>
    sortBy === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  return (
    <div className="min-w-[480px] max-w-[90vw] w-max" style={{ maxWidth: 'min(800px, 90vw)' }}>
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
                RM{sortMark('rm')}
              </th>
              <th className={thClass} onClick={() => toggleSort('rota')} role="button" title="Ordenar por Rotas">
                ROTAS{sortMark('rota')}
              </th>
              <th
                className={thClass}
                onClick={() => toggleSort('dataEmissao')}
                role="button"
                title="Ordenar por Data Emissão"
              >
                DATA EMISSÃO{sortMark('dataEmissao')}
              </th>
              <th
                className={thClass}
                onClick={() => toggleSort('dataProducao')}
                role="button"
                title="Ordenar por Data de Produção"
              >
                DATA PRODUÇÃO{sortMark('dataProducao')}
              </th>
              <th className={thClass} onClick={() => toggleSort('pedido')} role="button" title="Ordenar por PD">
                PD{sortMark('pedido')}
              </th>
              <th
                className={thClass}
                onClick={() => toggleSort('municipio')}
                role="button"
                title="Ordenar por Município"
              >
                MUNICIPIO{sortMark('municipio')}
              </th>
              <th className={thClass} onClick={() => toggleSort('aVista')} role="button" title="Ordenar por A Vista">
                A VISTA{sortMark('aVista')}
              </th>
              <th className={thRightClass} onClick={() => toggleSort('valorPendente')} role="button" title="Ordenar por Venda">
                VENDA{sortMark('valorPendente')}
              </th>
            </tr>
          </thead>
          <tbody className="text-slate-700 bg-white">
            {detalhes.map((row, idx) => {
              const pdNum = numeroPedidoLimpo(row.pedido);
              return (
                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-1 px-2">{row.rm || '—'}</td>
                  <td className="py-1 px-2 max-w-[200px] truncate" title={row.rota || ''}>
                    {row.rota || '—'}
                  </td>
                  <td className="py-1 px-2">{formatDataExibicao(row.dataEmissao ?? '')}</td>
                  <td className="py-1 px-2">{formatDataExibicao(row.dataProducao ?? '')}</td>
                  <td className="py-1 px-2">
                    {row.pedido ? (
                      <span className="inline-flex items-center gap-0.5">
                        <button
                          type="button"
                          className="font-medium text-primary-700 underline-offset-2 hover:underline dark:text-primary-300"
                          title="Ver itens do pedido"
                          onClick={(e) => abrirItensPedido(row, e)}
                        >
                          {labelPedidoMapa(row.pedido)}
                        </button>
                        <CopiarTextoBtn texto={pdNum} title="Copiar número do pedido" />
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-1 px-2">{row.municipio || '—'}</td>
                  <td className="py-1 px-2">{row.aVista || '—'}</td>
                  <td className="py-1 px-2 pl-4 text-right">{formatarValor(row.valorPendente ?? 0)}</td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-amber-200 bg-amber-50/70 font-semibold text-slate-800">
              <td className="py-1.5 px-2" colSpan={7}>
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
