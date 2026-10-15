import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  fetchDoubleCheckInComparativoPc,
  fetchDoubleCheckInHistorico,
  fetchDoubleCheckInPrimeiraLeitura,
  type DoubleCheckInComparativoDecisao,
  type DoubleCheckInComparativoLinha,
  type DoubleCheckInHistorico,
  type DoubleCheckInHistoricoEvento,
  type DoubleCheckInJustificativaOpcao,
  type DoubleCheckInNota,
  type DoubleCheckInSolicitacaoOtimiza,
} from '../../api/compras';
import DoubleCheckInComparativoPcTab from './DoubleCheckInComparativoPcTab';

function fmtQuando(evento: DoubleCheckInHistoricoEvento): string {
  if (!evento.em || evento.precisao === 'sem_data') return 'Sem horário registrado';
  if (evento.precisao === 'dia') {
    const [ano, mes, dia] = evento.em.slice(0, 10).split('-');
    if (!ano || !mes || !dia) return evento.em;
    return `${dia}/${mes}/${ano}`;
  }
  const data = new Date(evento.em);
  if (Number.isNaN(data.getTime())) return evento.em;
  return data.toLocaleString('pt-BR');
}

function corTom(tom: DoubleCheckInHistoricoEvento['tom']): string {
  if (tom === 'atencao') return 'bg-amber-500';
  if (tom === 'ok') return 'bg-emerald-500';
  if (tom === 'info') return 'bg-sky-500';
  return 'bg-slate-400';
}

function regimeDaNota(nota: DoubleCheckInNota): 'nao_aplicada' | 'simples' | 'completa' {
  if (nota.regimeConferencia) return nota.regimeConferencia;
  const dataEntrada = String(nota.dataEntrada ?? '').slice(0, 10);
  if (dataEntrada < '2026-09-19') return 'nao_aplicada';
  if (dataEntrada < '2026-09-21') return 'simples';
  return 'completa';
}

function ComparativoHistoricoModal({
  nota,
  modo,
  onClose,
}: {
  nota: DoubleCheckInNota;
  modo: 'leitura' | 'atual';
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [origem, setOrigem] = useState<'retrato' | 'nao_gravada' | null>(null);
  const [linhas, setLinhas] = useState<DoubleCheckInComparativoLinha[]>([]);
  const [decisoes, setDecisoes] = useState<DoubleCheckInComparativoDecisao[]>([]);
  const [justificativas, setJustificativas] = useState<DoubleCheckInJustificativaOpcao[]>([]);
  const [solicitacoesOtimiza, setSolicitacoesOtimiza] = useState<DoubleCheckInSolicitacaoOtimiza[]>([]);

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
    setAviso(null);
    setOrigem(null);
    const pedido =
      modo === 'leitura'
        ? fetchDoubleCheckInPrimeiraLeitura(nota.idDocumento).then((r) => ({
            linhas: r.linhas,
            decisoes: [] as DoubleCheckInComparativoDecisao[],
            justificativas: [] as DoubleCheckInJustificativaOpcao[],
            solicitacoesOtimiza: [] as DoubleCheckInSolicitacaoOtimiza[],
            aviso: r.aviso,
            origem: r.origem,
            erro: r.erro ?? null,
          }))
        : fetchDoubleCheckInComparativoPc(nota.idDocumento).then((r) => ({
            linhas: r.linhas,
            decisoes: r.decisoes,
            justificativas: r.justificativas,
            solicitacoesOtimiza: r.solicitacoesOtimiza,
            aviso: null as string | null,
            origem: null as 'retrato' | 'nao_gravada' | null,
            erro: r.erro ?? null,
          }));
    void pedido.then((r) => {
      if (!ativo) return;
      setLinhas(r.linhas);
      setDecisoes(r.decisoes);
      setJustificativas(r.justificativas);
      setSolicitacoesOtimiza(r.solicitacoesOtimiza);
      setAviso(r.aviso);
      setOrigem(r.origem);
      setErro(r.erro);
      setLoading(false);
    });
    return () => {
      ativo = false;
    };
  }, [modo, nota.idDocumento]);

  const regime = regimeDaNota(nota);
  const titulo = modo === 'leitura' ? 'Divergências da primeira leitura' : 'NF × Pedido de compra';

  return createPortal(
    <div className="fixed inset-0 z-[18000] flex items-center justify-center p-4 sm:p-6" role="presentation">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Fechar comparativo" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dci-historico-comparativo-titulo"
        className="relative flex h-[min(92vh,900px)] w-[min(98vw,1480px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-xl dark:border-white/10 dark:bg-[#161822]"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div>
            <h2 id="dci-historico-comparativo-titulo" className="text-base font-semibold text-slate-800 dark:text-slate-100">
              {titulo}
            </h2>
            <p className="text-xs text-slate-500">
              {nota.numeroDocumentoFiscal || `Documento ${nota.idDocumento}`}
              {nota.nomeParceiro ? ` · ${nota.nomeParceiro}` : ''}
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
          {aviso && origem === 'nao_gravada' ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-relaxed text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              {aviso}
            </p>
          ) : (
            <>
              {aviso ? (
                <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                  {aviso}
                </p>
              ) : null}
              {regime === 'simples' ? (
                <p className="mb-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
                  Entrada de 19/09 a 20/09/2026: comparativo somente para consulta.
                </p>
              ) : null}
              <DoubleCheckInComparativoPcTab
                idDocumento={nota.idDocumento}
                conferido={Boolean(nota.conferido)}
                somenteLeitura
                linhas={linhas}
                decisoes={decisoes}
                justificativas={justificativas}
                solicitacoesOtimiza={solicitacoesOtimiza}
                loading={loading}
                erro={erro}
                onDecisoesChange={setDecisoes}
                onSolicitacoesChange={setSolicitacoesOtimiza}
              />
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function DoubleCheckInHistoricoModal({
  nota,
  onClose,
}: {
  nota: DoubleCheckInNota;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [historico, setHistorico] = useState<DoubleCheckInHistorico | null>(null);
  const [comparativoModo, setComparativoModo] = useState<'leitura' | 'atual' | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (comparativoModo) return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [comparativoModo, onClose]);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    setErro(null);
    void fetchDoubleCheckInHistorico(nota.idDocumento).then((r) => {
      if (!ativo) return;
      if (r.erro || !r.data) {
        setErro(r.erro ?? 'Falha ao carregar o histórico.');
        setHistorico(null);
      } else {
        setHistorico(r.data);
      }
      setLoading(false);
    });
    return () => {
      ativo = false;
    };
  }, [nota.idDocumento]);

  const titulo = nota.numeroDocumentoFiscal || `Documento ${nota.idDocumento}`;

  return createPortal(
    <div className="fixed inset-0 z-[17000] flex items-center justify-center p-4 sm:p-6" role="presentation">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Fechar" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dci-historico-titulo"
        className="relative flex h-[min(90vh,860px)] w-[min(96vw,760px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-xl dark:border-white/10 dark:bg-[#161822]"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div>
            <h2 id="dci-historico-titulo" className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Histórico · {titulo}
            </h2>
            <p className="text-xs text-slate-500">
              {nota.nomeParceiro ?? 'Sem fornecedor'}
              {nota.numeroNfe ? ` · NF-e ${nota.numeroNfe}` : ''}
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
          {loading && <p className="py-10 text-center text-sm text-slate-500">Carregando histórico…</p>}
          {!loading && !erro && historico && (
            <>
              <p className="mb-4 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
                {historico.aviso}
              </p>
              <ol className="space-y-0">
                {historico.eventos.map((evento, index) => (
                  <li key={evento.id} className="grid grid-cols-[1.25rem_1fr] gap-3">
                    <div className="flex flex-col items-center">
                      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${corTom(evento.tom)}`} />
                      {index < historico.eventos.length - 1 && (
                        <span className="w-px flex-1 bg-slate-200 dark:bg-slate-700" />
                      )}
                    </div>
                    {evento.legenda ? (
                      <p className="mb-4 pt-0.5 text-sm text-slate-500 dark:text-slate-400">{evento.titulo}</p>
                    ) : (
                    <article className="mb-4 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/30">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{evento.titulo}</h3>
                        <time className="text-xs tabular-nums text-slate-500">{fmtQuando(evento)}</time>
                      </div>
                      {evento.detalhe ? (
                        <p className="mt-1 whitespace-pre-line text-sm text-slate-700 dark:text-slate-200">{evento.detalhe}</p>
                      ) : null}
                      {evento.abreComparativo ? (
                        <button
                          type="button"
                          className="mt-2 text-xs font-semibold text-primary-700 hover:underline dark:text-primary-300"
                          onClick={() => setComparativoModo(evento.origemComparativo === 'leitura' ? 'leitura' : 'atual')}
                        >
                          {evento.origemComparativo === 'leitura' ? 'Ver divergências da leitura' : 'Ver NF × pedido'}
                        </button>
                      ) : null}
                      {evento.fonte ? (
                        <p className="mt-2 text-[11px] text-slate-400">
                          {evento.ator ? `${evento.ator} · ` : ''}
                          {evento.fonte}
                        </p>
                      ) : null}
                    </article>
                    )}
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </div>
      {comparativoModo ? (
        <ComparativoHistoricoModal
          nota={nota}
          modo={comparativoModo}
          onClose={() => setComparativoModo(null)}
        />
      ) : null}
    </div>,
    document.body
  );
}
