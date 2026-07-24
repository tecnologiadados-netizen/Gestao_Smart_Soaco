import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Pedido } from '../../../api/pedidos';
import ModalHistoricoPedido from '../../../components/ModalHistoricoPedido';
import {
  compareStr,
  nextSortDir,
  SortableTh,
  type SortDir,
} from '../dfc/dfcDetalheTabelaUtils';
import { formatarReais } from '../dashboard/dashboardFormat';
import { PLACEHOLDER_BUSCA_TEXTO_LIVRE, criarMatcherTextoLivre } from '../../../utils/textoLivreBusca';
import type { CarteiraDetalhePedido } from './carteiraAggregates';

type SortKey = Exclude<keyof CarteiraDetalhePedido, 'idPedido'>;

type Props = {
  aberto: boolean;
  titulo: string;
  subtitulo?: string;
  pedidos: CarteiraDetalhePedido[];
  onClose: () => void;
};

function fmtDate(iso: string | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso ?? '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function ClockIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

export default function CarteiraDetalheModal({
  aberto,
  titulo,
  subtitulo,
  pedidos,
  onClose,
}: Props) {
  const [busca, setBusca] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('saldoAReceber');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [historicoPedido, setHistoricoPedido] = useState<Pedido | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setBusca('');
    setSortKey('saldoAReceber');
    setSortDir('desc');
    setHistoricoPedido(null);
  }, [aberto, titulo]);

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (historicoPedido) {
        setHistoricoPedido(null);
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aberto, onClose, historicoPedido]);

  const filtrados = useMemo(() => {
    const match = criarMatcherTextoLivre(busca);
    const base = !busca.trim()
      ? pedidos
      : pedidos.filter(
          (p) =>
            match(p.pedido) ||
            match(p.cliente) ||
            match(fmtDate(p.emissao)) ||
            match(fmtDate(p.previsaoAtual))
        );
    const arr = [...base];
    arr.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      let cmp = 0;
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
      else cmp = compareStr(String(va ?? ''), String(vb ?? ''));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [pedidos, busca, sortKey, sortDir]);

  const totais = useMemo(() => {
    let faturar = 0;
    let receber = 0;
    let romaneado = 0;
    for (const p of filtrados) {
      faturar += p.saldoAFaturar;
      receber += p.saldoAReceber;
      romaneado += p.saldoRomaneado;
    }
    return { faturar, receber, romaneado };
  }, [filtrados]);

  function onSort(key: string) {
    const k = key as SortKey;
    setSortDir(nextSortDir(sortKey, k, sortDir));
    setSortKey(k);
  }

  function abrirHistorico(p: CarteiraDetalhePedido) {
    if (!p.idPedido) return;
    const prev = p.previsaoAtual ?? '';
    setHistoricoPedido({
      id_pedido: String(p.idPedido),
      cliente: p.cliente,
      produto: '',
      qtd: 0,
      previsao_entrega: prev,
      previsao_entrega_atualizada: prev,
      PD: p.pedido,
      Cliente: p.cliente,
    });
  }

  if (!aberto || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[10050] flex items-center justify-center p-3 sm:p-4 bg-black/70"
        onClick={() => {
          if (historicoPedido) return;
          onClose();
        }}
        role="presentation"
      >
        <div
          className="relative flex w-full max-w-[min(96vw,1120px)] max-h-[min(92vh,880px)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-900"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="carteira-detalhe-titulo"
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <div className="min-w-0">
              <h2
                id="carteira-detalhe-titulo"
                className="text-lg font-semibold text-slate-800 dark:text-slate-100"
              >
                {titulo}
              </h2>
              {subtitulo ? (
                <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{subtitulo}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Fechar
            </button>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={PLACEHOLDER_BUSCA_TEXTO_LIVRE}
              className="min-w-[180px] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
            <span className="text-xs text-slate-500 tabular-nums">
              {filtrados.length.toLocaleString('pt-BR')} pedido(s)
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            {filtrados.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">
                Nenhum pedido neste recorte.
              </p>
            ) : (
              <table className="w-full table-fixed border-collapse text-xs">
                <colgroup>
                  <col className="w-[9%]" />
                  <col className="w-[22%]" />
                  <col className="w-[9%]" />
                  <col className="w-[9%]" />
                  <col className="w-[14%]" />
                  <col className="w-[14%]" />
                  <col className="w-[14%]" />
                  <col className="w-[5%]" />
                </colgroup>
                <thead className="sticky top-0 z-[1]">
                  <tr className="bg-primary-600 text-left text-white shadow-sm">
                    <SortableTh
                      label="Pedido"
                      sortKey="pedido"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={onSort}
                    />
                    <SortableTh
                      label="Cliente"
                      sortKey="cliente"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={onSort}
                    />
                    <SortableTh
                      label="Emissão"
                      sortKey="emissao"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={onSort}
                    />
                    <SortableTh
                      label="Prev. Atual"
                      sortKey="previsaoAtual"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={onSort}
                    />
                    <SortableTh
                      label="Saldo a Faturar"
                      sortKey="saldoAFaturar"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={onSort}
                      align="right"
                    />
                    <SortableTh
                      label="Saldo a Receber"
                      sortKey="saldoAReceber"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={onSort}
                      align="right"
                    />
                    <SortableTh
                      label="Saldo Romaneado"
                      sortKey="saldoRomaneado"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={onSort}
                      align="right"
                    />
                    <th className="px-1 py-2 text-center font-semibold" title="Histórico de previsão">
                      <span className="sr-only">Histórico</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((p) => (
                    <tr
                      key={`${p.idPedido}-${p.pedido}`}
                      className="border-t border-slate-100 odd:bg-white even:bg-slate-50/90 dark:border-slate-800 dark:odd:bg-slate-900 dark:even:bg-slate-800/40"
                    >
                      <td className="truncate px-2 py-1.5 font-medium text-slate-800 dark:text-slate-100" title={p.pedido}>
                        {p.pedido}
                      </td>
                      <td className="truncate px-2 py-1.5 text-slate-700 dark:text-slate-200" title={p.cliente}>
                        {p.cliente}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-slate-700 dark:text-slate-200">
                        {fmtDate(p.emissao)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-slate-700 dark:text-slate-200">
                        {fmtDate(p.previsaoAtual)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-800 dark:text-slate-100">
                        {formatarReais(p.saldoAFaturar)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-800 dark:text-slate-100">
                        {formatarReais(p.saldoAReceber)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-800 dark:text-slate-100">
                        {formatarReais(p.saldoRomaneado)}
                      </td>
                      <td className="px-1 py-1 text-center">
                        <button
                          type="button"
                          onClick={() => abrirHistorico(p)}
                          disabled={!p.idPedido}
                          className="inline-flex rounded p-1.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                          title="Histórico de previsão de entrega"
                          aria-label={`Histórico de previsão de ${p.pedido}`}
                        >
                          <ClockIcon />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-primary-700 bg-primary-600 px-4 py-2.5 text-sm text-white">
            <span className="font-medium">Total ({filtrados.length.toLocaleString('pt-BR')})</span>
            <div className="flex flex-wrap gap-4 tabular-nums">
              <span>Faturar: {formatarReais(totais.faturar)}</span>
              <span>Receber: {formatarReais(totais.receber)}</span>
              <span>Romaneado: {formatarReais(totais.romaneado)}</span>
            </div>
          </div>
        </div>
      </div>

      <ModalHistoricoPedido
        pedido={historicoPedido}
        open={historicoPedido != null}
        onClose={() => setHistoricoPedido(null)}
        overlayClassName="z-[10070]"
      />
    </>,
    document.body
  );
}
