import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import DoubleCheckInComparativoPcTab from './DoubleCheckInComparativoPcTab';
import { getApiBase } from '../../api/client';
import {
  CRITERIOS_DIVERGENCIA_PADRAO,
  type DoubleCheckInComparativoLinha,
} from '../../api/compras';

type Cabecalho = {
  numeroDocumentoFiscal: string | null;
  numeroNfe: string | null;
  dataEntrada: string | null;
  dataEmissao: string | null;
  nomeParceiro: string | null;
};

function fmtDataBr(ymd: string | null): string {
  if (!ymd) return '—';
  const [y, m, d] = ymd.slice(0, 10).split('-');
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

export default function EspelhoDivergenciaPublicaPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [cabecalho, setCabecalho] = useState<Cabecalho | null>(null);
  const [linhas, setLinhas] = useState<DoubleCheckInComparativoLinha[]>([]);
  const [semVinculo, setSemVinculo] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setErro(null);
    const base = getApiBase();
    fetch(`${base}/api/public/double-checkin/espelho/${encodeURIComponent(token ?? '')}`, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as {
          cabecalho?: Cabecalho;
          linhas?: DoubleCheckInComparativoLinha[];
          semVinculo?: boolean;
          error?: string;
        };
        if (!res.ok) throw new Error(body.error ?? 'Link não encontrado.');
        setCabecalho(body.cabecalho ?? null);
        setLinhas(Array.isArray(body.linhas) ? body.linhas : []);
        setSemVinculo(body.semVinculo === true);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setErro(e instanceof Error ? e.message : 'Não foi possível abrir a evidência.');
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6">
        <header className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Double Check NFe · evidência
          </p>
          <h1 className="mt-1 text-xl font-semibold">
            Doc {cabecalho?.numeroDocumentoFiscal ?? '—'} · NF-e {cabecalho?.numeroNfe ?? '—'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Entrada {fmtDataBr(cabecalho?.dataEntrada ?? null)} · Emissão{' '}
            {fmtDataBr(cabecalho?.dataEmissao ?? null)} · {cabecalho?.nomeParceiro ?? '—'}
          </p>
        </header>
        {erro ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
            {erro}
          </p>
        ) : (
          <div className="flex-1 space-y-3 overflow-auto rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            {semVinculo ? (
              <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                Este documento está sem vínculo com pedido de compra. Os cards abaixo são o espelho da
                primeira leitura. Role para ver as demais divergências.
              </p>
            ) : null}
            <DoubleCheckInComparativoPcTab
              idDocumento={0}
              conferido={false}
              somenteLeitura
              evidencia
              linhas={linhas}
              decisoes={[]}
              justificativas={[]}
              solicitacoesOtimiza={[]}
              criterios={CRITERIOS_DIVERGENCIA_PADRAO}
              loading={loading}
              erro={null}
              onDecisoesChange={() => undefined}
              onSolicitacoesChange={() => undefined}
            />
          </div>
        )}
      </main>
    </div>
  );
}
