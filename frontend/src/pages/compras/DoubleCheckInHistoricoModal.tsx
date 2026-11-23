import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CRITERIOS_DIVERGENCIA_PADRAO,
  fetchDoubleCheckInComparativoPc,
  fetchDoubleCheckInHistorico,
  fetchDoubleCheckInPrimeiraLeitura,
  type CriteriosDivergenciaDoubleCheck,
  type DoubleCheckInCampoComparativo,
  type DoubleCheckInComparativoDecisao,
  type DoubleCheckInComparativoLinha,
  type DoubleCheckInHistorico,
  type DoubleCheckInHistoricoBloco,
  type DoubleCheckInJustificativaOpcao,
  type DoubleCheckInNota,
  type DoubleCheckInSolicitacaoOtimiza,
} from '../../api/compras';
import DoubleCheckInComparativoPcTab from './DoubleCheckInComparativoPcTab';

function fmtQuando(em: string | null): string {
  if (!em) return '';
  const data = new Date(em.includes('T') ? em : em.replace(' ', 'T'));
  if (Number.isNaN(data.getTime())) return em;
  return data.toLocaleString('pt-BR');
}

function regimeDaNota(nota: DoubleCheckInNota): 'nao_aplicada' | 'simples' | 'completa' {
  if (nota.regimeConferencia) return nota.regimeConferencia;
  const dataEntrada = String(nota.dataEntrada ?? '').slice(0, 10);
  if (dataEntrada < '2026-09-19') return 'nao_aplicada';
  if (dataEntrada < '2026-09-21') return 'simples';
  return 'completa';
}

const ORDINAIS = ['Primeira', 'Segunda', 'Terceira', 'Quarta', 'Quinta', 'Sexta', 'Sétima', 'Oitava', 'Nona', 'Décima'];

function tituloLeitura(ordem: number): string {
  return ORDINAIS[ordem - 1] ? `${ORDINAIS[ordem - 1]} leitura` : `Leitura ${ordem}`;
}

function ComparativoHistoricoModal({
  nota,
  modo,
  tituloLeituraModal,
  linhasIniciais,
  onClose,
}: {
  nota: DoubleCheckInNota;
  modo: 'leitura' | 'atual';
  tituloLeituraModal?: string;
  linhasIniciais?: DoubleCheckInComparativoLinha[];
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
  const [criterios, setCriterios] = useState<CriteriosDivergenciaDoubleCheck>(CRITERIOS_DIVERGENCIA_PADRAO);
  const [camposLancados, setCamposLancados] = useState<DoubleCheckInCampoComparativo[]>([]);

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
    if (linhasIniciais) {
      setLinhas(linhasIniciais);
      setDecisoes([]);
      setJustificativas([]);
      setSolicitacoesOtimiza([]);
      setCriterios(CRITERIOS_DIVERGENCIA_PADRAO);
      setCamposLancados([]);
      setAviso(null);
      setOrigem(null);
      setErro(null);
      setLoading(false);
      return;
    }
    const pedido =
      modo === 'leitura'
        ? fetchDoubleCheckInPrimeiraLeitura(nota.idDocumento).then((r) => ({
            linhas: r.linhas,
            decisoes: [] as DoubleCheckInComparativoDecisao[],
            justificativas: [] as DoubleCheckInJustificativaOpcao[],
            solicitacoesOtimiza: [] as DoubleCheckInSolicitacaoOtimiza[],
            criterios: CRITERIOS_DIVERGENCIA_PADRAO,
            camposLancados: [] as DoubleCheckInCampoComparativo[],
            aviso: r.aviso,
            origem: r.origem,
            erro: r.erro ?? null,
          }))
        : fetchDoubleCheckInComparativoPc(nota.idDocumento).then((r) => ({
            linhas: r.linhas,
            decisoes: r.decisoes,
            justificativas: r.justificativas,
            solicitacoesOtimiza: r.solicitacoesOtimiza,
            criterios: r.semVinculo ? CRITERIOS_DIVERGENCIA_PADRAO : r.criterios,
            camposLancados: r.camposLancados,
            aviso: r.semVinculo
              ? 'Este documento está sem vínculo com pedido de compra. Os cards são o espelho da primeira leitura.'
              : (null as string | null),
            origem: null as 'retrato' | 'nao_gravada' | null,
            erro: r.erro ?? null,
          }));
    void pedido.then((r) => {
      if (!ativo) return;
      setLinhas(r.linhas);
      setDecisoes(r.decisoes);
      setJustificativas(r.justificativas);
      setSolicitacoesOtimiza(r.solicitacoesOtimiza);
      setCriterios(r.criterios);
      setCamposLancados(r.camposLancados);
      setAviso(r.aviso);
      setOrigem(r.origem);
      setErro(r.erro);
      setLoading(false);
    });
    return () => {
      ativo = false;
    };
  }, [linhasIniciais, modo, nota.idDocumento]);

  const regime = regimeDaNota(nota);
  const titulo =
    tituloLeituraModal ??
    (modo === 'leitura' ? 'Comparativo da primeira leitura' : 'Comparativo atual · NF × pedido de compra');

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
                criterios={criterios}
                camposLancados={camposLancados}
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
  const [leituraAberta, setLeituraAberta] = useState<Extract<DoubleCheckInHistoricoBloco, { tipo: 'leitura' }> | null>(
    null
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (leituraAberta) return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [leituraAberta, onClose]);

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
        className="relative flex h-[min(92vh,920px)] w-[min(98vw,1100px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-xl dark:border-white/10 dark:bg-[#161822]"
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
          {!loading && !erro && historico && (historico.blocos ?? []).length === 0 && (
            <p className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
              Ainda não há espelho gravado. Ele passa a existir quando o documento é lido com vínculo ao pedido de compra.
            </p>
          )}
          {!loading && !erro && historico && (historico.blocos ?? []).length > 0 && (
            <div className="space-y-4">
              {(historico.blocos ?? []).map((bloco) =>
                bloco.tipo === 'marco' ? (
                  <p key={bloco.id} className="px-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                    {bloco.titulo}
                  </p>
                ) : (
                  <section
                    key={`leitura-${bloco.ordem}`}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/30"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
                      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {tituloLeitura(bloco.ordem)}
                      </h3>
                      {bloco.gravadoEm ? (
                        <time className="text-xs tabular-nums text-slate-500">
                          {fmtQuando(bloco.gravadoEm)}
                        </time>
                      ) : null}
                    </div>
                    <div className="relative max-h-72 overflow-hidden">
                      <div className="pointer-events-none">
                        <DoubleCheckInComparativoPcTab
                          idDocumento={nota.idDocumento}
                          conferido
                          somenteLeitura
                          linhas={bloco.linhas}
                          decisoes={[]}
                          justificativas={[]}
                          solicitacoesOtimiza={[]}
                          criterios={CRITERIOS_DIVERGENCIA_PADRAO}
                          camposLancados={[]}
                          loading={false}
                          erro={null}
                          onDecisoesChange={() => undefined}
                          onSolicitacoesChange={() => undefined}
                        />
                      </div>
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white dark:from-[#161822]" />
                    </div>
                    <div className="border-t border-slate-200 px-3 py-2 dark:border-slate-700">
                      <button
                        type="button"
                        className="text-xs font-semibold text-primary-700 hover:underline dark:text-primary-300"
                        onClick={() => setLeituraAberta(bloco)}
                      >
                        Ver completo
                      </button>
                    </div>
                  </section>
                )
              )}
            </div>
          )}
        </div>
      </div>
      {leituraAberta ? (
        <ComparativoHistoricoModal
          nota={nota}
          modo="leitura"
          tituloLeituraModal={tituloLeitura(leituraAberta.ordem)}
          linhasIniciais={leituraAberta.linhas}
          onClose={() => setLeituraAberta(null)}
        />
      ) : null}
    </div>,
    document.body
  );
}
