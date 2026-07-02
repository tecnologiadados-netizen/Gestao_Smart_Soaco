import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DfcDespesaPagamentoEmAbertoLinha } from '../../../api/financeiro';
import { labelEmpresaDfc } from './dfcEmpresas';
import {
  agregar,
  brl,
  diasAtraso,
  exportarCsvVencidos,
  fmtDataBr,
  labelCategoria,
  pctDoTotal,
  type DrillDownPayload,
} from './dfcVencidoPagarShared';
import { PLACEHOLDER_BUSCA_TEXTO_LIVRE, textoPassaBuscaLivre } from '../../../utils/textoLivreBusca';

type Props = {
  payload: DrillDownPayload | null;
  onClose: () => void;
};

export default function DfcVencidoPagarDetalheModal({ payload, onClose }: Props) {
  const [busca, setBusca] = useState('');

  useEffect(() => {
    setBusca('');
  }, [payload?.titulo, payload?.linhas.length]);

  const linhas = payload?.linhas ?? [];
  const total = useMemo(() => linhas.reduce((s, r) => s + r.saldoBaixar, 0), [linhas]);
  const qtd = linhas.length;
  const mediaDias = useMemo(() => {
    if (qtd === 0) return 0;
    return linhas.reduce((s, r) => s + diasAtraso(r.dataVencimento), 0) / qtd;
  }, [linhas, qtd]);

  const porFornecedor = useMemo(
    () => agregar(linhas, (r) => r.nome?.trim() || '(sem favorecido)').slice(0, 5),
    [linhas],
  );

  const filtradas = useMemo(() => {
    if (!busca.trim()) return linhas;
    return linhas.filter((r) => {
      const hay = [
        String(r.id),
        r.nome,
        labelCategoria(r),
        labelEmpresaDfc(r.idEmpresa),
        fmtDataBr(r.dataVencimento),
      ]
        .filter(Boolean)
        .join(' ');
      return textoPassaBuscaLivre(busca, hay);
    });
  }, [linhas, busca]);

  if (!payload || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10060] flex items-center justify-center p-3 sm:p-4 bg-black/75"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex w-full max-w-[min(96vw,1000px)] max-h-[min(90vh,800px)] min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl font-sans"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900">{payload.titulo}</h3>
            {payload.subtitulo ? (
              <p className="mt-0.5 text-sm text-slate-500">{payload.subtitulo}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fechar detalhe"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Total</p>
              <p className="mt-1 text-lg font-bold text-slate-900 tabular-nums">{brl.format(total)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Títulos</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{qtd}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Atraso médio</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{mediaDias.toFixed(0)} dias</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Top fornecedor</p>
              <p className="mt-1 text-sm font-bold text-slate-900 truncate" title={porFornecedor[0]?.chave}>
                {porFornecedor[0]?.chave ?? '—'}
              </p>
              <p className="text-xs text-slate-500 tabular-nums">
                {porFornecedor[0] ? brl.format(porFornecedor[0].valor) : '—'}
              </p>
            </div>
          </div>

          {porFornecedor.length > 0 ? (
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold text-slate-600 mb-2">Distribuição por fornecedor (top 5)</p>
              <div className="space-y-2">
                {porFornecedor.map((f) => (
                  <div key={f.chave} className="flex items-center gap-2 text-xs">
                    <span className="flex-1 truncate text-slate-700" title={f.chave}>
                      {f.chave}
                    </span>
                    <span className="tabular-nums text-slate-500">{pctDoTotal(f.valor, total)}</span>
                    <span className="tabular-nums font-medium text-slate-800 w-28 text-right">{brl.format(f.valor)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={PLACEHOLDER_BUSCA_TEXTO_LIVRE}
              className="flex-1 min-w-[200px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() =>
                exportarCsvVencidos(
                  filtradas,
                  `vencido-pagar-detalhe-${Date.now()}.csv`,
                )
              }
              className="inline-flex items-center gap-2 rounded-lg border border-primary-600 px-3 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Exportar
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <div className="max-h-[min(45vh,400px)] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Cód.</th>
                    <th className="px-3 py-2">Vencimento</th>
                    <th className="px-3 py-2">Atraso</th>
                    <th className="px-3 py-2">Empresa</th>
                    <th className="px-3 py-2">Categoria</th>
                    <th className="px-3 py-2">Fornecedor</th>
                    <th className="px-3 py-2 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 tabular-nums">{r.id}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{fmtDataBr(r.dataVencimento)}</td>
                      <td className="px-3 py-2 tabular-nums">{diasAtraso(r.dataVencimento)}d</td>
                      <td className="px-3 py-2">{labelEmpresaDfc(r.idEmpresa)}</td>
                      <td className="px-3 py-2 max-w-[180px] truncate" title={labelCategoria(r)}>
                        {labelCategoria(r)}
                      </td>
                      <td className="px-3 py-2 max-w-[160px] truncate" title={r.nome ?? ''}>
                        {r.nome ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-orange-700">
                        {brl.format(r.saldoBaixar)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtradas.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-500">Nenhum título neste recorte.</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
