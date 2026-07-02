import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DfcEndividamentoBancarioResponse } from '../../../api/financeiro';
import { labelEmpresaDfc } from './dfcEmpresas';
import { PLACEHOLDER_BUSCA_TEXTO_LIVRE, criarMatcherTextoLivre } from '../../../utils/textoLivreBusca';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

type Props = {
  aberto: boolean;
  onClose: () => void;
  dataInicio: string;
  dataFim: string;
  dados: DfcEndividamentoBancarioResponse;
};

function fmtDataBr(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function pct(v: number, total: number): string {
  if (total <= 0) return '0,0%';
  return `${((v / total) * 100).toFixed(1).replace('.', ',')}%`;
}

function Donut({
  vencido,
  aVencer,
}: {
  vencido: number;
  aVencer: number;
}) {
  const total = Math.max(0, vencido + aVencer);
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const rOut = 74;
  const rIn = 46;
  const segs = [
    { chave: 'Vencido', valor: Math.max(0, vencido), cor: '#ef4444' },
    { chave: 'A vencer', valor: Math.max(0, aVencer), cor: '#3b82f6' },
  ];
  let acc = 0;
  const arcos = segs.map((s) => {
    const fatia = total > 0 ? s.valor / total : 0;
    const ini = acc;
    acc += fatia;
    const fim = acc;
    const large = fatia > 0.5 ? 1 : 0;
    const a0 = ini * 2 * Math.PI - Math.PI / 2;
    const a1 = fim * 2 * Math.PI - Math.PI / 2;
    const x0 = cx + rOut * Math.cos(a0);
    const y0 = cy + rOut * Math.sin(a0);
    const x1 = cx + rOut * Math.cos(a1);
    const y1 = cy + rOut * Math.sin(a1);
    const xi0 = cx + rIn * Math.cos(a1);
    const yi0 = cy + rIn * Math.sin(a1);
    const xi1 = cx + rIn * Math.cos(a0);
    const yi1 = cy + rIn * Math.sin(a0);
    return {
      s,
      d:
        fatia <= 0
          ? ''
          : `M ${x0} ${y0} A ${rOut} ${rOut} 0 ${large} 1 ${x1} ${y1} L ${xi0} ${yi0} A ${rIn} ${rIn} 0 ${large} 0 ${xi1} ${yi1} Z`,
    };
  });

  return (
    <div className="relative w-[180px] h-[180px] shrink-0">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {arcos.map((a) =>
          a.d ? (
            <path key={a.s.chave} d={a.d} fill={a.s.cor}>
              <title>
                {a.s.chave}: {brl.format(a.s.valor)} ({pct(a.s.valor, total)})
              </title>
            </path>
          ) : null,
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        <span className="text-[11px] text-slate-500">Total</span>
        <span className="text-xs font-bold text-slate-900 tabular-nums">{brl.format(total)}</span>
      </div>
    </div>
  );
}

function RankingCard({
  titulo,
  linhas,
  total,
}: {
  titulo: string;
  linhas: Array<{ chave: string; valor: number }>;
  total: number;
}) {
  const top = linhas.slice(0, 8);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800 mb-3">{titulo}</h3>
      <div className="space-y-2">
        {top.map((r, i) => (
          <div key={`${r.chave}-${i}`}>
            <div className="flex items-center justify-between gap-2 text-xs mb-1">
              <span className="text-slate-700 truncate" title={r.chave}>
                {r.chave}
              </span>
              <span className="tabular-nums text-slate-800 font-semibold">{brl.format(r.valor)}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500"
                style={{ width: `${Math.max(4, total > 0 ? (r.valor / total) * 100 : 0)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DfcEndividamentoBancarioModal({
  aberto,
  onClose,
  dataInicio,
  dataFim,
  dados,
}: Props) {
  const [busca, setBusca] = useState('');
  const linhasTabela = useMemo(() => {
    const q = busca.trim();
    if (!q) return dados.linhas;
    const match = criarMatcherTextoLivre(q);
    return dados.linhas.filter((l) => {
      const hay = [l.nome ?? '', l.descricaoLancamento ?? '', labelEmpresaDfc(l.idEmpresa)].join(' ');
      return match(hay);
    });
  }, [busca, dados.linhas]);

  const porEmpresaChart = useMemo(
    () =>
      dados.porEmpresa.map((x) => ({
        chave: labelEmpresaDfc(x.idEmpresa),
        valor: x.valor,
      })),
    [dados.porEmpresa],
  );

  if (!aberto || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10060] flex items-center justify-center p-4 bg-black/70"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative w-full max-w-[min(96vw,1320px)] max-h-[95vh] min-h-0 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dfc-endividamento-title"
      >
        <div className="bg-white border-b border-slate-200 px-5 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="dfc-endividamento-title" className="text-xl font-bold text-slate-900">
              Endividamento Bancário
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {fmtDataBr(dataInicio)} a {fmtDataBr(dataFim)} · Principal/Juros de Empréstimos + Dívida Bancária
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fechar"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total em aberto</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{brl.format(dados.total)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Vencido</p>
              <p className="mt-1 text-2xl font-bold text-red-600 tabular-nums">{brl.format(dados.vencido)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">A vencer</p>
              <p className="mt-1 text-2xl font-bold text-primary-600 tabular-nums">{brl.format(dados.aVencer)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Títulos</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{dados.linhas.length}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Composição (vencido vs a vencer)</h3>
              <div className="flex items-center gap-4">
                <Donut vencido={dados.vencido} aVencer={dados.aVencer} />
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                    <span className="text-slate-700">Vencido</span>
                    <span className="font-semibold text-slate-900 tabular-nums">
                      {brl.format(dados.vencido)} ({pct(dados.vencido, dados.total)})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                    <span className="text-slate-700">A vencer</span>
                    <span className="font-semibold text-slate-900 tabular-nums">
                      {brl.format(dados.aVencer)} ({pct(dados.aVencer, dados.total)})
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <RankingCard titulo="Top fornecedores" linhas={dados.porFornecedor} total={dados.total} />
            <RankingCard titulo="Por empresa" linhas={porEmpresaChart} total={dados.total} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <RankingCard titulo="Por conta de endividamento" linhas={dados.porConta.map((x) => ({ chave: x.conta, valor: x.valor }))} total={dados.total} />
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="text-sm font-semibold text-slate-800">Detalhamento de títulos</h3>
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder={PLACEHOLDER_BUSCA_TEXTO_LIVRE}
                  className="w-56 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                />
              </div>
              <div className="max-h-[280px] overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wide text-slate-500 border-b border-slate-200">
                      <th className="py-2 text-left font-semibold">Fornecedor</th>
                      <th className="py-2 text-left font-semibold">Empresa</th>
                      <th className="py-2 text-left font-semibold">Situação</th>
                      <th className="py-2 text-right font-semibold">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhasTabela.slice(0, 200).map((l) => (
                      <tr key={`${l.id}-${l.idEmpresa}-${l.idContaFinanceiro ?? 0}`} className="border-b border-slate-100">
                        <td className="py-2 pr-2 text-slate-700">{l.nome ?? '(sem favorecido)'}</td>
                        <td className="py-2 pr-2 text-slate-600">{labelEmpresaDfc(l.idEmpresa)}</td>
                        <td className="py-2 pr-2">
                          <span className={l.situacao === 'vencido' ? 'text-red-600 font-medium' : 'text-primary-600 font-medium'}>
                            {l.situacao === 'vencido' ? 'Vencido' : 'A vencer'}
                          </span>
                        </td>
                        <td className="py-2 text-right tabular-nums font-semibold text-slate-900">{brl.format(l.saldoBaixar)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

