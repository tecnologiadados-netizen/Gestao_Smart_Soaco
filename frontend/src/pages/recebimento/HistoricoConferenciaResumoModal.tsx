import { useEffect, useState, type MutableRefObject, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import CarregandoInformacoesOverlay from '../../components/CarregandoInformacoesOverlay';
import {
  fetchRecebimentoDigitacaoHistoricoDocumento,
  type RecebimentoHistoricoConferencia,
  type RecebimentoHistoricoEnvio,
  type RecebimentoHistoricoEnvioDetalhe,
  type RecebimentoStatusCodigo,
} from '../../api/recebimento';

const btnSecondary =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50';

const nfNum = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });

const ACAO_MESA_LABEL: Record<string, string> = {
  MOVIMENTACAO_ALTERADA: 'Movimentação alterada no Nomus',
  TRATAMENTO_COMPRAS: 'Retornou para Compras tratar',
  REENVIAR_CONFERENCIA: 'Reenviada para conferência',
  DEVOLVER_MATERIAL: 'Devolver material',
  ACEITAR_COMO_ESTA: 'Aceita como está',
  CANCELAR_CONFERENCIA: 'Conferência cancelada',
};

export function fmtDataBr(ymd: string | null): string {
  if (!ymd) return '—';
  const [y, m, d] = ymd.slice(0, 10).split('-');
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

export function fmtDateTimeBr(iso: string | null): string {
  if (!iso) return '—';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export function conferenteLabel(nome: string | null, login: string | null): string {
  if (nome && login) return `${nome} (${login})`;
  return nome || login || '—';
}

function dataDocYmd(d: {
  dataEntrada?: string | null;
  dataEmissao?: string | null;
}): string | null {
  return d.dataEntrada ?? d.dataEmissao ?? null;
}

export function badgeStatus(status: RecebimentoStatusCodigo, label: string) {
  const cls =
    status === 'EM_CONFERENCIA'
      ? 'border-sky-400 bg-sky-50 text-sky-800 dark:border-sky-500 dark:bg-sky-950/40 dark:text-sky-200'
      : status === 'DIVERGENCIA'
        ? 'border-rose-400 bg-rose-50 text-rose-800 dark:border-rose-500 dark:bg-rose-950/40 dark:text-rose-200'
        : status === 'CANCELADO'
          ? 'border-slate-400 bg-slate-100 text-slate-700 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-200'
          : status === 'FINALIZADO' || status === 'DEVOLUCAO_VINCULADA'
            ? 'border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-200'
            : 'border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-200';
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function tituloVolta(indice: number, total: number): string {
  if (total <= 1) return 'Devolução à Mesa';
  return `${indice + 1}ª devolução à Mesa`;
}

function acaoMesaLabel(acao: string | null): string {
  if (!acao) return '—';
  return ACAO_MESA_LABEL[acao] ?? acao;
}

function HistoricoVolta({ volta, titulo }: { volta: RecebimentoHistoricoConferencia; titulo: string }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-600">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-3 py-2 dark:bg-slate-900/60">
        <div>
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{titulo}</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {conferenteLabel(volta.conferenteNome, volta.conferenteLogin)}
            {volta.atribuidoEm ? ` · Enviado para conferência ${fmtDateTimeBr(volta.atribuidoEm)}` : ''}
            {volta.retornadoEm ? ` · Devolvido à Mesa ${fmtDateTimeBr(volta.retornadoEm)}` : ''}
          </p>
        </div>
        {badgeStatus(volta.status, volta.statusLabel)}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100/70 text-left text-xs uppercase text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="px-3 py-2">Material</th>
              <th className="px-3 py-2 text-right">Qtde NF</th>
              <th className="px-3 py-2 text-right">Última qtde física</th>
              <th className="px-3 py-2 text-center">Tentativas</th>
              <th className="px-3 py-2 text-center">Resultado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {volta.itens.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-5 text-center text-slate-500">
                  Nenhuma contagem registrada.
                </td>
              </tr>
            ) : (
              volta.itens.map((item, index) => (
                <tr key={item.idItem ?? `${item.codigoProduto ?? 'item'}-${index}`}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800 dark:text-slate-100">
                      {item.codigoProduto ?? '—'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {item.descricaoProduto ?? '—'}
                      {item.unidadeMedida ? ` · ${item.unidadeMedida}` : ''}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {item.qtdeDocumento == null ? '—' : nfNum.format(item.qtdeDocumento)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{nfNum.format(item.qtdeInformada)}</td>
                  <td className="px-3 py-2 text-center tabular-nums">{item.tentativas}</td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${
                        item.conferido
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-600 dark:bg-rose-950/40 dark:text-rose-300'
                      }`}
                    >
                      {item.conferido ? 'Conferido' : 'Divergência'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{rotulo}</dt>
      <dd className="mt-0.5 text-sm text-slate-800 dark:text-slate-100">{valor}</dd>
    </div>
  );
}

function GrupoCampos({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{titulo}</h4>
      <dl className="grid gap-3 rounded-xl border border-slate-200 px-4 py-3 sm:grid-cols-2 lg:grid-cols-3 dark:border-slate-600">
        {children}
      </dl>
    </section>
  );
}

export default function HistoricoConferenciaResumoModal({
  idDocumento,
  resumoInicial,
  cacheRef,
  carregar = fetchRecebimentoDigitacaoHistoricoDocumento,
  onClose,
}: {
  idDocumento: number;
  resumoInicial?: Partial<
    Pick<
      RecebimentoHistoricoEnvio,
      'numeroDocumentoFiscal' | 'numeroNfe' | 'dataEntrada' | 'dataEmissao' | 'nomeParceiro' | 'status' | 'statusLabel'
    >
  > | null;
  cacheRef?: MutableRefObject<Map<number, RecebimentoHistoricoEnvioDetalhe>>;
  carregar?: (idDocumento: number) => Promise<RecebimentoHistoricoEnvioDetalhe>;
  onClose: () => void;
}) {
  const [detalhe, setDetalhe] = useState<RecebimentoHistoricoEnvioDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setErro(null);
    const cached = cacheRef?.current.get(idDocumento);
    if (cached) {
      setDetalhe(cached);
      setLoading(false);
      return;
    }
    setDetalhe(null);
    setLoading(true);
    void carregar(idDocumento)
      .then((data) => {
        if (!ativo) return;
        cacheRef?.current.set(idDocumento, data);
        setDetalhe(data);
        if (data.erro) setErro(data.erro);
      })
      .catch((e: unknown) => {
        if (!ativo) return;
        setDetalhe(null);
        setErro(e instanceof Error ? e.message : 'Não foi possível carregar a conferência.');
      })
      .finally(() => {
        if (ativo) setLoading(false);
      });
    return () => {
      ativo = false;
    };
  }, [cacheRef, carregar, idDocumento]);

  const cabecalho = detalhe ?? resumoInicial ?? null;
  const voltas = detalhe ? [...detalhe.historicosConferencia].reverse() : [];
  const numero = cabecalho?.numeroDocumentoFiscal ?? idDocumento;

  return createPortal(
    <div
      className="fixed inset-0 z-[20000] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-600">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Histórico {numero}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              NF-e {cabecalho?.numeroNfe ?? '—'}
              {cabecalho && (cabecalho.dataEntrada || cabecalho.dataEmissao || cabecalho.nomeParceiro)
                ? ` · ${fmtDataBr(dataDocYmd(cabecalho))} · ${cabecalho.nomeParceiro ?? '—'}`
                : ''}
            </p>
            {cabecalho?.status && cabecalho.statusLabel && (
              <div className="mt-2">{badgeStatus(cabecalho.status, cabecalho.statusLabel)}</div>
            )}
          </div>
          <button type="button" className={btnSecondary} onClick={onClose}>
            Fechar
          </button>
        </div>
        <div className="relative min-h-[12rem] flex-1 space-y-4 overflow-auto p-4">
          <CarregandoInformacoesOverlay show={loading} mode="contained" />
          {erro && (
            <p className="text-sm text-rose-600" role="alert">
              {erro}
            </p>
          )}
          {detalhe && (
            <>
              <div className="space-y-4">
                <GrupoCampos titulo="Envio para conferência">
                  <Campo rotulo="Enviado por" valor={detalhe.atribuidoPorLogin ?? '—'} />
                  <Campo rotulo="Enviado em" valor={fmtDateTimeBr(detalhe.atribuidoEm)} />
                  <Campo
                    rotulo="Conferente"
                    valor={conferenteLabel(detalhe.conferenteAtualNome, detalhe.conferenteAtualLogin)}
                  />
                </GrupoCampos>
                <GrupoCampos titulo="Devolução à Mesa">
                  <Campo
                    rotulo="Devolvido por"
                    valor={conferenteLabel(detalhe.conferenteNome, detalhe.conferenteLogin)}
                  />
                  <Campo
                    rotulo={detalhe.status === 'CANCELADO' ? 'Cancelado em' : 'Devolvido em'}
                    valor={fmtDateTimeBr(detalhe.enviadoEm)}
                  />
                </GrupoCampos>
                <GrupoCampos titulo="Mesa">
                  <Campo rotulo="Tipo de movimentação" valor={detalhe.tipoMovimentacao ?? '—'} />
                  <Campo rotulo="Ação da Mesa" valor={acaoMesaLabel(detalhe.mesaUltimaAcao)} />
                  <Campo rotulo="Ação da Mesa em" valor={fmtDateTimeBr(detalhe.mesaAcaoEm)} />
                  <Campo rotulo="Ação da Mesa por" valor={detalhe.mesaAcaoPorLogin ?? '—'} />
                </GrupoCampos>
              </div>
              {detalhe.emNovaConferencia && (
                <p className="rounded-lg border border-sky-300 bg-sky-50 p-3 text-sm text-sky-800 dark:border-sky-700 dark:bg-sky-950/30 dark:text-sky-200">
                  Este documento está em uma nova conferência. As voltas abaixo são as que já foram enviadas à Mesa.
                </p>
              )}
              {detalhe.cancelamentoMotivo && (
                <div className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-100">
                  <p className="font-semibold">Conferência cancelada</p>
                  <p className="mt-1 whitespace-pre-wrap">{detalhe.cancelamentoMotivo}</p>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {fmtDateTimeBr(detalhe.mesaAcaoEm)}
                    {detalhe.mesaAcaoPorLogin ? ` · ${detalhe.mesaAcaoPorLogin}` : ''}
                  </p>
                </div>
              )}
              {detalhe.mesaAceiteJustificativa && (
                <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-100">
                  <p className="font-semibold">Aceito como está</p>
                  <p className="mt-1 whitespace-pre-wrap">{detalhe.mesaAceiteJustificativa}</p>
                </div>
              )}
              {detalhe.devolucao && (
                <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
                  <p className="font-semibold">Documento de devolução</p>
                  <p className="mt-1">
                    Documento {detalhe.devolucao.numeroDocumentoFiscal ?? detalhe.devolucao.idDocumento}
                    {detalhe.devolucao.numeroNfe ? ` · NF-e ${detalhe.devolucao.numeroNfe}` : ''}
                    {detalhe.devolucao.vinculadaEm ? ` · ${fmtDateTimeBr(detalhe.devolucao.vinculadaEm)}` : ''}
                  </p>
                </div>
              )}
              <div className="space-y-4">
                {voltas.map((volta, indice) => (
                  <HistoricoVolta
                    key={`${volta.retornadoEm ?? 'volta'}-${indice}`}
                    volta={volta}
                    titulo={
                      volta.status === 'CANCELADO'
                        ? 'Conferência cancelada'
                        : tituloVolta(voltas.length - 1 - indice, voltas.length)
                    }
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
