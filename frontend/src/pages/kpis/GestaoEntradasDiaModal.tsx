import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  fetchGestaoEntradasDia,
  type GestaoEntradasDia,
  type GestaoEntradasNotaDia,
} from '../../api/gestaoEntradas';

const STATUS_LABEL: Record<GestaoEntradasNotaDia['status'], string> = {
  aceita: 'Divergência aceita',
  recusa: 'Divergência recusada',
  limpa: 'Sem divergência',
  pendente: 'Pendente',
};

const STATUS_CLASS: Record<GestaoEntradasNotaDia['status'], string> = {
  aceita: 'border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-100',
  recusa: 'border-rose-400 bg-rose-50 text-rose-800 dark:border-rose-500 dark:bg-rose-950/40 dark:text-rose-100',
  limpa: 'border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-100',
  pendente: 'border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

function fmtQuando(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR');
}

function decisaoLabel(decisao: 'aceita' | 'recusa' | null): string {
  if (decisao === 'aceita') return 'aceita';
  if (decisao === 'recusa') return 'recusada';
  return 'sem decisão';
}

function ValorLado({ valor, detalhe, pedido }: { valor?: string; detalhe?: string | null; pedido?: string | null }) {
  return (
    <div className="text-xs tabular-nums">
      <span className="font-medium text-slate-800 dark:text-slate-100">{valor || '—'}</span>
      {detalhe ? <span className="mt-0.5 block font-normal text-slate-500">{detalhe}</span> : null}
      {pedido ? <span className="mt-0.5 block font-normal text-slate-500">{pedido}</span> : null}
    </div>
  );
}

const TH =
  'sticky top-0 z-20 border-b border-slate-200 bg-slate-100 px-3 py-2 font-medium shadow-[0_1px_0_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-[#1c2030] dark:shadow-[0_1px_0_rgba(0,0,0,0.35)]';
const TH_ENTRADA =
  'sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-3 py-2 font-medium shadow-[0_1px_0_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-[#161822] dark:shadow-[0_1px_0_rgba(0,0,0,0.35)]';

function faixaLinha(indice: number): string {
  return indice % 2 === 0
    ? 'bg-white dark:bg-[#161822]'
    : 'bg-slate-100 dark:bg-[#232838]';
}

export function TabelaDivergencias({ notas }: { notas: GestaoEntradasNotaDia[] }) {
  const linhas = notas.flatMap((nota) =>
    nota.divergencias.map((d, i) => ({ nota, d, i, primeira: i === 0 }))
  );

  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/10">
      <table className="w-full min-w-[1280px] border-separate border-spacing-0 text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <tr>
            <th className={TH_ENTRADA}>Entrada</th>
            <th className={TH}>Campo</th>
            <th className={TH}>Natureza</th>
            <th className={TH}>Item</th>
            <th className={TH}>Na NF</th>
            <th className={TH}>No pedido</th>
            <th className={TH}>Motivo</th>
            <th className={TH}>Observação</th>
          </tr>
        </thead>
        <tbody className="[&_td]:border-b [&_td]:border-slate-200 dark:[&_td]:border-white/10">
          {linhas.map(({ nota, d, i, primeira }, indice) => {
            const faixa = faixaLinha(indice);
            return (
              <tr
                key={`${nota.idDocumento}-${d.campo}-${d.codigoProduto ?? ''}-${i}`}
                className="align-top"
              >
                {primeira ? (
                  <td className="bg-slate-50 px-3 py-2 dark:bg-[#161822]" rowSpan={nota.divergencias.length}>
                    <p className="font-medium text-slate-800 dark:text-slate-100">
                      {nota.numeroDocumentoFiscal ?? `Documento ${nota.idDocumento}`}
                    </p>
                    <p className="text-xs text-slate-500">
                      {nota.numeroNfe ? `NF ${nota.numeroNfe} · ` : ''}
                      {nota.nomeParceiro ?? 'Parceiro não informado'}
                    </p>
                    <span
                      className={`mt-1 inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[nota.status]}`}
                    >
                      {STATUS_LABEL[nota.status]}
                    </span>
                  </td>
                ) : null}
                <td className={`px-3 py-2 font-medium text-slate-800 dark:text-slate-100 ${faixa}`}>
                  {d.campoLabel}
                  <span className="mt-0.5 block text-xs font-normal text-slate-500">{decisaoLabel(d.decisao)}</span>
                </td>
                <td className={`px-3 py-2 ${faixa}`}>
                  <span
                    className={
                      d.natureza === 'real'
                        ? 'inline-flex rounded-full bg-rose-100 px-2 py-1 text-[11px] font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                        : 'inline-flex rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                    }
                  >
                    {d.natureza === 'real' ? 'Divergência real' : 'Divergência benigna'}
                  </span>
                </td>
                <td className={`px-3 py-2 text-xs text-slate-600 dark:text-slate-300 ${faixa}`}>
                  <span className="font-medium text-slate-800 dark:text-slate-100">{d.codigoProduto ?? 'Item'}</span>
                  {d.descricaoProduto ? <span className="mt-0.5 block">{d.descricaoProduto}</span> : null}
                </td>
                <td className={`px-3 py-2 ${faixa}`}>
                  <ValorLado valor={d.valorNf} detalhe={d.detalheNf} />
                </td>
                <td className={`px-3 py-2 ${faixa}`}>
                  <ValorLado valor={d.valorPc} detalhe={d.detalhePc} pedido={d.nomePedidoCompra} />
                </td>
                <td className={`px-3 py-2 text-xs text-slate-600 dark:text-slate-300 ${faixa}`}>
                  {d.justificativaLabel ?? '—'}
                </td>
                <td className={`px-3 py-2 text-xs text-slate-700 dark:text-slate-200 ${faixa}`}>
                  {d.observacoes.length > 0 ? (
                    <ul className="space-y-1">
                      {d.observacoes.map((o, j) => (
                        <li key={`${o.criadoEm}-${j}`}>
                          <span className="text-slate-500">
                            {o.usuarioLogin} · {fmtQuando(o.criadoEm)}
                          </span>
                          <span className="mt-0.5 block whitespace-pre-wrap">{o.texto}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-slate-400">Sem observação.</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function GestaoEntradasNotaDivergenciaModal({
  nota,
  escopo,
  onClose,
}: {
  nota: GestaoEntradasNotaDia;
  escopo: 'reais' | 'geral';
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const qtde = nota.divergencias.length;
  const leitura = escopo === 'reais' ? 'visão real' : 'visão geral';

  return createPortal(
    <div className="fixed inset-0 z-[19000] flex items-center justify-center p-4 sm:p-6" role="presentation">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Fechar" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ge-nota-div-titulo"
        className="relative flex h-[min(90vh,860px)] w-[min(96vw,1480px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-xl dark:border-white/10 dark:bg-[#161822]"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div>
            <h2 id="ge-nota-div-titulo" className="text-base font-semibold text-slate-800 dark:text-slate-100">
              {nota.numeroDocumentoFiscal ?? `Documento ${nota.idDocumento}`}
            </h2>
            <p className="text-xs text-slate-500">
              {nota.numeroNfe ? `NF ${nota.numeroNfe} · ` : ''}
              {nota.nomeParceiro ?? 'Parceiro não informado'}
              {` · ${qtde} ${qtde === 1 ? 'divergência' : 'divergências'} · ${leitura}`}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-white dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={onClose}
          >
            Fechar
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          <TabelaDivergencias notas={[nota]} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

export type FiltroRankingGestao =
  | { tipo: 'campo'; campo: string; label: string }
  | { tipo: 'motivo'; codigo: string; label: string };

function notasDoRanking(notas: GestaoEntradasNotaDia[], filtro: FiltroRankingGestao): GestaoEntradasNotaDia[] {
  return notas
    .filter((nota) => nota.status === 'aceita' || nota.status === 'recusa')
    .map((nota) => ({
      ...nota,
      divergencias: nota.divergencias.filter((d) => {
        if (d.decisao !== 'aceita' && d.decisao !== 'recusa') return false;
        if (filtro.tipo === 'campo') return d.campo === filtro.campo;
        return d.decisao === 'aceita' && (d.justificativaCodigo || 'sem_codigo') === filtro.codigo;
      }),
    }))
    .filter((nota) => nota.divergencias.length > 0);
}

export function GestaoEntradasRankingModal({
  filtro,
  dataInicio,
  dataFim,
  escopo,
  onClose,
}: {
  filtro: FiltroRankingGestao;
  dataInicio: string;
  dataFim: string;
  escopo: 'reais' | 'geral';
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [notas, setNotas] = useState<GestaoEntradasNotaDia[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    setErro(null);
    void fetchGestaoEntradasDia({ dataInicio, dataFim, escopo }).then((r) => {
      if (!ativo) return;
      if (r.erro || !r.data) {
        setErro(r.erro ?? 'Falha ao carregar as divergências.');
        setNotas([]);
      } else {
        setNotas(r.data.notas);
      }
      setLoading(false);
    });
    return () => {
      ativo = false;
    };
  }, [dataInicio, dataFim, escopo]);

  const linhas = useMemo(() => notasDoRanking(notas, filtro), [notas, filtro]);
  const qtde = linhas.reduce((total, nota) => total + nota.divergencias.length, 0);
  const leitura = escopo === 'reais' ? 'visão real' : 'visão geral';
  const recorte = filtro.tipo === 'campo' ? 'decisões deste campo' : 'aceites deste motivo';

  return createPortal(
    <div className="fixed inset-0 z-[17000] flex items-center justify-center p-4 sm:p-6" role="presentation">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Fechar" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ge-ranking-titulo"
        className="relative flex h-[min(90vh,860px)] w-[min(96vw,1480px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-xl dark:border-white/10 dark:bg-[#161822]"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div>
            <h2 id="ge-ranking-titulo" className="text-base font-semibold text-slate-800 dark:text-slate-100">
              {filtro.label}
            </h2>
            <p className="text-xs text-slate-500">
              {loading
                ? 'Carregando divergências…'
                : `${qtde} ${qtde === 1 ? 'divergência' : 'divergências'} · ${recorte} · ${leitura}`}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-white dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={onClose}
          >
            Fechar
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          {erro && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
              {erro}
            </p>
          )}
          {loading && <p className="py-10 text-center text-sm text-slate-500">Carregando…</p>}
          {!loading && !erro && linhas.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-500">Nenhuma divergência neste item.</p>
          )}
          {linhas.length > 0 && <TabelaDivergencias notas={linhas} />}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function GestaoEntradasDiaModal({
  titulo,
  dataInicio,
  dataFim,
  escopo,
  onClose,
}: {
  titulo: string;
  dataInicio: string;
  dataFim: string;
  escopo: 'reais' | 'geral';
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [dia, setDia] = useState<GestaoEntradasDia | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    setErro(null);
    void fetchGestaoEntradasDia({ dataInicio, dataFim, escopo }).then((r) => {
      if (!ativo) return;
      if (r.erro || !r.data) {
        setErro(r.erro ?? 'Falha ao carregar as entradas.');
        setDia(null);
      } else {
        setDia(r.data);
      }
      setLoading(false);
    });
    return () => {
      ativo = false;
    };
  }, [dataInicio, dataFim, escopo]);

  const notas = dia?.notas ?? [];
  const comDivergencia = notas.filter((n) => n.divergencias.length > 0);
  const demais = notas.filter((n) => n.divergencias.length === 0);

  return createPortal(
    <div className="fixed inset-0 z-[17000] flex items-center justify-center p-4 sm:p-6" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ge-dia-titulo"
        className="relative flex h-[min(90vh,980px)] w-[min(96vw,1680px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-xl dark:border-white/10 dark:bg-[#161822]"
      >
        <header className="z-30 flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-[#161822]">
          <div>
            <h2 id="ge-dia-titulo" className="text-base font-semibold text-slate-800 dark:text-slate-100">
              {titulo}
            </h2>
            <p className="text-xs text-slate-500">
              {loading
                ? 'Carregando entradas…'
                : `${notas.length} entradas · ${comDivergencia.length} com ${
                    escopo === 'reais' ? 'divergência real' : 'divergência'
                  } ainda na NF × PC${escopo === 'reais' ? ' · visão real' : ' · visão geral'}`}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-white dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={onClose}
          >
            Fechar
          </button>
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-auto px-4 py-3">
          {erro && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
              {erro}
            </p>
          )}
          {loading && <p className="py-10 text-center text-sm text-slate-500">Carregando…</p>}
          {!loading && !erro && notas.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-500">Nenhuma entrada nesse ponto.</p>
          )}
          {comDivergencia.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {escopo === 'reais' ? 'Com divergência real' : 'Com divergência'}
              </h3>
              <TabelaDivergencias notas={comDivergencia} />
            </section>
          )}
          {demais.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Demais entradas</h3>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
                {demais.map((n) => (
                  <article
                    key={n.idDocumento}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/5"
                  >
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {n.numeroDocumentoFiscal ?? `Documento ${n.idDocumento}`}
                      {n.numeroNfe ? <span className="font-normal text-slate-500"> · NF {n.numeroNfe}</span> : null}
                    </p>
                    <p className="truncate text-xs text-slate-500">{n.nomeParceiro ?? 'Parceiro não informado'}</p>
                    <span
                      className={`mt-1 inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[n.status]}`}
                    >
                      {STATUS_LABEL[n.status]}
                    </span>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
