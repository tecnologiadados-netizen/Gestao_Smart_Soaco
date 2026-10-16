import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import {
  fetchGestaoEntradasDia,
  type GestaoEntradasDia,
  type GestaoEntradasDivergencia,
  type GestaoEntradasNotaDia,
} from '../../api/gestaoEntradas';

const STATUS_LABEL: Record<GestaoEntradasNotaDia['status'], string> = {
  aceita: 'Divergência aceita',
  recusa: 'Divergência recusada',
  limpa: 'Sem divergência',
  pendente: 'Pendente',
  nao_aplicada: 'Não aplicada',
};

const STATUS_CLASS: Record<GestaoEntradasNotaDia['status'], string> = {
  aceita: 'border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-100',
  recusa: 'border-rose-400 bg-rose-50 text-rose-800 dark:border-rose-500 dark:bg-rose-950/40 dark:text-rose-100',
  limpa: 'border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-100',
  pendente: 'border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300',
  nao_aplicada: 'border-slate-300 bg-slate-50 text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

function fmtQuando(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR');
}

const LABEL_CARD: Record<string, string> = {
  valor_unitario: 'Vl. unitário (líq.)',
  qtde: 'Quantidade',
  ipi: 'IPI',
  condicao_pagamento: 'Cond. pagamento',
};

const ORDEM_CAMPO = ['valor_unitario', 'qtde', 'ipi', 'condicao_pagamento'];

function labelCard(d: GestaoEntradasDivergencia): string {
  if (d.campo === 'ipi' && (`${d.valorNf}${d.valorPc}`.includes('%'))) return 'IPI %';
  return LABEL_CARD[d.campo] ?? d.campoLabel;
}

type GrupoItem = {
  chave: string;
  codigo: string | null;
  descricao: string | null;
  pedido: string | null;
  divergencias: GestaoEntradasDivergencia[];
};

function gruposDaNota(nota: GestaoEntradasNotaDia): GrupoItem[] {
  const map = new Map<string, GrupoItem>();
  for (const d of nota.divergencias) {
    const chave = `${d.codigoProduto ?? ''}|${d.descricaoProduto ?? ''}|${d.nomePedidoCompra ?? ''}`;
    const atual = map.get(chave);
    if (atual) {
      atual.divergencias.push(d);
      continue;
    }
    map.set(chave, {
      chave,
      codigo: d.codigoProduto,
      descricao: d.descricaoProduto,
      pedido: d.nomePedidoCompra,
      divergencias: [d],
    });
  }
  for (const grupo of map.values()) {
    grupo.divergencias.sort(
      (a, b) => ORDEM_CAMPO.indexOf(a.campo) - ORDEM_CAMPO.indexOf(b.campo)
    );
  }
  return [...map.values()];
}

function CardDivergencia({ d }: { d: GestaoEntradasDivergencia }) {
  const aceita = d.decisao === 'aceita';
  const recusada = d.decisao === 'recusa';
  return (
    <div className="rounded-lg border border-amber-400/80 bg-white px-2.5 py-2 dark:border-amber-600 dark:bg-slate-900/50">
      <div className="mb-1 flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {labelCard(d)}
          </span>
          <span
            className={
              d.natureza === 'real'
                ? 'rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                : 'rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
            }
          >
            {d.natureza === 'real' ? 'Real' : 'Benigna'}
          </span>
        </div>
        {aceita ? (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-label="Aceita" />
        ) : recusada ? (
          <XCircle className="h-3.5 w-3.5 shrink-0 text-rose-600" aria-label="Recusada" />
        ) : (
          <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300">Sem decisão</span>
        )}
      </div>
      <div className={`space-y-0.5 text-xs ${d.campo === 'condicao_pagamento' ? '' : 'tabular-nums'}`}>
        <div className="flex justify-between gap-2">
          <span className="shrink-0 text-slate-400">NF</span>
          <span className="min-w-0 text-right">
            <span className="block font-medium text-slate-800 break-words dark:text-slate-100">{d.valorNf || '—'}</span>
            {d.detalheNf ? (
              <span className="block text-[10px] font-normal text-slate-500 dark:text-slate-400">{d.detalheNf}</span>
            ) : null}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="shrink-0 text-slate-400">PC</span>
          <span className="min-w-0 text-right">
            <span className="block font-medium text-slate-800 break-words dark:text-slate-100">{d.valorPc || '—'}</span>
            {d.detalhePc ? (
              <span className="block text-[10px] font-normal text-slate-500 dark:text-slate-400">{d.detalhePc}</span>
            ) : null}
          </span>
        </div>
      </div>
      {d.natureza === 'benigna' && d.observacaoNatureza ? (
        <p className="mt-1.5 rounded-md bg-emerald-50 px-1.5 py-1 text-[10px] leading-snug text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
          {d.observacaoNatureza}
        </p>
      ) : null}
      <div className="mt-2 space-y-1.5">
        <p className="text-[10px] text-slate-500" title={d.justificativaLabel ?? ''}>
          {d.decisao === 'aceita'
            ? `Aceita: ${d.justificativaLabel ?? '—'}`
            : d.decisao === 'recusa'
              ? `Recusada: ${d.justificativaLabel ?? '—'}`
              : 'Divergente'}
        </p>
        {d.observacoes.length > 0 ? (
          <div className="space-y-1 rounded-md bg-slate-100/80 px-1.5 py-1 dark:bg-slate-800/80">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Observações ({d.observacoes.length})
            </div>
            <ul className="max-h-40 space-y-1.5 overflow-y-auto pr-0.5">
              {d.observacoes.map((o, idx) => (
                <li
                  key={`${o.criadoEm}-${idx}-${o.texto.slice(0, 12)}`}
                  className="border-t border-slate-200/70 pt-1 first:border-0 first:pt-0 dark:border-slate-700/70"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-[9px] text-slate-500 dark:text-slate-400">
                    <span className="font-medium">{o.usuarioLogin || '—'}</span>
                    <span>{o.criadoEm ? fmtQuando(o.criadoEm) : ''}</span>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-[10px] leading-snug text-slate-700 dark:text-slate-300">
                    {o.texto}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function TabelaDivergencias({ notas }: { notas: GestaoEntradasNotaDia[] }) {
  return (
    <div className="space-y-4">
      {notas.map((nota) => (
        <section key={nota.idDocumento} className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-slate-800 dark:text-slate-100">
                {nota.numeroDocumentoFiscal ?? `Documento ${nota.idDocumento}`}
              </p>
              <p className="text-xs text-slate-500">
                {nota.numeroNfe ? `NF ${nota.numeroNfe} · ` : ''}
                {nota.nomeParceiro ?? 'Parceiro não informado'}
              </p>
            </div>
            <span
              className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[nota.status]}`}
            >
              {STATUS_LABEL[nota.status]}
            </span>
          </div>
          {gruposDaNota(nota).map((grupo) => (
            <div
              key={grupo.chave}
              className="rounded-xl border border-amber-300 bg-amber-50/60 px-3 py-3 dark:border-amber-700 dark:bg-amber-950/30"
            >
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-slate-800 dark:text-slate-100">
                    {grupo.codigo ?? 'Item'}
                  </div>
                  <div className="line-clamp-2 text-xs text-slate-500">{grupo.descricao ?? '—'}</div>
                </div>
                <div className="text-right text-xs font-medium text-slate-700 dark:text-slate-200">
                  {grupo.pedido ?? 'PC —'}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {grupo.divergencias.map((d) => (
                  <CardDivergencia key={`${grupo.chave}-${d.campo}`} d={d} />
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
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
