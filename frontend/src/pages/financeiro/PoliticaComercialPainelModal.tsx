import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  fetchPoliticaComercialClientes,
  fetchPoliticaComercialPainel,
  putPoliticaComercialPainel,
  type PoliticaComercialClienteNomus,
  type PoliticaComercialEscopo,
  type PoliticaComercialPainel,
} from '../../api/painelComercial';

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-primary-600 focus:ring-2 focus:ring-primary-600/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:focus:border-primary-500 dark:focus:ring-primary-500/25';

type AbaPolitica = 'padrao' | 'outras';

const ESCOPO_LABEL: Record<PoliticaComercialEscopo, string> = {
  industria: 'Indústria',
  lojas: 'Lojas',
};

function parseDiasCsv(s: string): number[] {
  const xs = s
    .split(/[,;/+\s]+/)
    .map((x) => Math.round(Number(x.trim())))
    .filter((n) => Number.isFinite(n));
  return [...new Set(xs)].sort((a, b) => a - b);
}

function diasListToCsv(arr: number[]): string {
  return (arr ?? []).join(', ');
}

export type PoliticaComercialPainelModalProps = {
  open: boolean;
  escopo: PoliticaComercialEscopo;
  onClose: () => void;
  /** Chamado após salvar com sucesso (ex.: recarregar o painel). */
  onSaved?: () => void;
};

export default function PoliticaComercialPainelModal({
  open,
  escopo,
  onClose,
  onSaved,
}: PoliticaComercialPainelModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [padrao, setPadrao] = useState<PoliticaComercialPainel | null>(null);
  const [aba, setAba] = useState<AbaPolitica>('padrao');

  const [lim1, setLim1] = useState('');
  const [lim2, setLim2] = useState('');
  const [csv1, setCsv1] = useState('');
  const [csv2, setCsv2] = useState('');
  const [csv3, setCsv3] = useState('');
  const [pctAlvo, setPctAlvo] = useState('');
  const [tolPp, setTolPp] = useState('');
  const [diasMin, setDiasMin] = useState('');
  const [diasMax, setDiasMax] = useState('');

  const [buscaCliente, setBuscaCliente] = useState('');
  const [clientes, setClientes] = useState<PoliticaComercialClienteNomus[]>([]);
  const [buscandoClientes, setBuscandoClientes] = useState(false);
  const [erroClientes, setErroClientes] = useState<string | null>(null);

  const loadId = useRef(0);
  const buscaId = useRef(0);

  const aplicarPoliticaNoForm = useCallback((p: PoliticaComercialPainel) => {
    setLim1(String(p.limiteFaixa1Reais));
    setLim2(String(p.limiteFaixa2Reais));
    setCsv1(diasListToCsv(p.diasParcelasFaixa1));
    setCsv2(diasListToCsv(p.diasParcelasFaixa2));
    setCsv3(diasListToCsv(p.diasParcelasFaixa3));
    setPctAlvo(String(Math.round(p.pctEntradaAlvo * 1000) / 10));
    setTolPp(String(Math.round(p.pctEntradaTolerancia * 1000) / 10));
    setDiasMin(String(p.diasCondicaoMin));
    setDiasMax(String(p.diasCondicaoMax));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    setAba('padrao');
    setBuscaCliente('');
    setClientes([]);
    setErroClientes(null);
    loadId.current += 1;
    const my = loadId.current;
    setLoading(true);
    setErro(null);
    void (async () => {
      const r = await fetchPoliticaComercialPainel(escopo);
      if (my !== loadId.current) return;
      setLoading(false);
      if (r.erro) {
        setErro(r.erro);
        return;
      }
      setPadrao(r.padraoSistema);
      aplicarPoliticaNoForm(r.politica);
    })();
  }, [open, escopo, aplicarPoliticaNoForm]);

  useEffect(() => {
    if (!open || aba !== 'outras') return;
    const termo = buscaCliente.trim();
    buscaId.current += 1;
    const my = buscaId.current;
    if (termo.length > 0 && termo.length < 2) {
      setClientes([]);
      setErroClientes(null);
      setBuscandoClientes(false);
      return;
    }
    setBuscandoClientes(true);
    setErroClientes(null);
    const t = window.setTimeout(() => {
      void (async () => {
        const r = await fetchPoliticaComercialClientes({ q: termo, limit: 50 });
        if (my !== buscaId.current) return;
        setBuscandoClientes(false);
        if (r.erro) {
          setErroClientes(r.erro);
          setClientes([]);
          return;
        }
        setClientes(r.clientes);
      })();
    }, 300);
    return () => window.clearTimeout(t);
  }, [open, aba, buscaCliente]);

  const restaurarPadrao = () => {
    if (padrao) aplicarPoliticaNoForm(padrao);
  };

  const montarPayload = (): PoliticaComercialPainel | null => {
    const limiteFaixa1Reais = Math.max(1, Math.round(Number(lim1.replace(',', '.')) || 0));
    const limiteFaixa2Reais = Math.max(limiteFaixa1Reais + 1, Math.round(Number(lim2.replace(',', '.')) || 0));
    const diasCondicaoMin = Math.round(Number(diasMin) || 0);
    const diasCondicaoMax = Math.round(Number(diasMax) || 0);
    const d1 = parseDiasCsv(csv1);
    const d2 = parseDiasCsv(csv2);
    const d3 = parseDiasCsv(csv3);
    const pa = (Number(String(pctAlvo).replace(',', '.')) || 0) / 100;
    const pt = (Number(String(tolPp).replace(',', '.')) || 0) / 100;
    return {
      limiteFaixa1Reais,
      limiteFaixa2Reais,
      diasParcelasFaixa1: d1,
      diasParcelasFaixa2: d2,
      diasParcelasFaixa3: d3,
      pctEntradaAlvo: pa,
      pctEntradaTolerancia: pt,
      diasCondicaoMin,
      diasCondicaoMax,
    };
  };

  const salvar = async () => {
    const payload = montarPayload();
    if (!payload) return;
    setSaving(true);
    setErro(null);
    const r = await putPoliticaComercialPainel(payload, escopo);
    setSaving(false);
    if (r.erro) {
      setErro(r.erro);
      return;
    }
    aplicarPoliticaNoForm(r.politica);
    onSaved?.();
    onClose();
  };

  if (!open) return null;

  const tabBtn = (id: AbaPolitica, label: string) => (
    <button
      type="button"
      role="tab"
      id={`politica-tab-${id}`}
      aria-selected={aba === id}
      tabIndex={aba === id ? 0 : -1}
      onClick={() => setAba(id)}
      className={`relative px-4 py-2.5 text-sm font-semibold transition-colors ${
        aba === id
          ? 'text-primary-700 dark:text-primary-300'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
      }`}
    >
      {label}
      {aba === id ? (
        <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-t bg-primary-600 dark:bg-primary-400" aria-hidden />
      ) : null}
    </button>
  );

  const body = (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="politica-comercial-titulo"
        className={`relative z-[81] flex w-full flex-col rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800 ${
          aba === 'outras' ? 'max-w-4xl' : 'max-w-2xl'
        }`}
      >
        <div className="shrink-0 px-6 pt-6 pb-0">
          <h2 id="politica-comercial-titulo" className="text-lg font-bold text-slate-900 dark:text-slate-50">
            Política comercial — {ESCOPO_LABEL[escopo]}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {escopo === 'industria'
              ? 'Aplicada aos pedidos com «Venda por qual empresa?» = Só Aço.'
              : 'Aplicada aos pedidos com «Venda por qual empresa?» = Só Móveis (e Só Refrigeração).'}
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Seções da política comercial"
          className="mt-3 flex shrink-0 gap-0 border-b border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-900/40 px-4"
        >
          {tabBtn('padrao', 'Padrão')}
          {tabBtn('outras', 'Outras')}
        </div>

        <div
          className="px-6 py-5"
          role="tabpanel"
          aria-labelledby={aba === 'padrao' ? 'politica-tab-padrao' : 'politica-tab-outras'}
        >
          {aba === 'padrao' ? (
            <>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Estes parâmetros alimentam a mesma lógica do painel: faixas de ticket (R$), pacotes de dias esperados
                por faixa, entrada em % do total com tolerância, e o intervalo de dias extraídos do nome da condição
                de pagamento no Nomus. O prazo do saldo é avaliado pela média dos dias (cadastro ≤ referência). Cartão
                e à vista seguem as regras já fixas no sistema.
              </p>

              {loading ? (
                <p className="mt-6 text-sm text-slate-500">Carregando…</p>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Limite faixa 1 (R$)</label>
                      <input
                        type="number"
                        min={1}
                        className={inputClass}
                        value={lim1}
                        onChange={(e) => setLim1(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Limite faixa 2 (R$)</label>
                      <input
                        type="number"
                        min={1}
                        className={inputClass}
                        value={lim2}
                        onChange={(e) => setLim2(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Prazo inicial (dias)</label>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        className={inputClass}
                        value={diasMin}
                        onChange={(e) => setDiasMin(e.target.value)}
                      />
                      <p className="mt-0.5 text-[10px] text-slate-500">Mínimo ao ler números da condição (ex.: 8).</p>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Prazo final (dias)</label>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        className={inputClass}
                        value={diasMax}
                        onChange={(e) => setDiasMax(e.target.value)}
                      />
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        Máximo ao ler números da condição (ex.: 365 para parcelas longas).
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                      Dias parcelas — até limite 1
                    </label>
                    <input
                      className={inputClass}
                      value={csv1}
                      onChange={(e) => setCsv1(e.target.value)}
                      placeholder="20, 30, 40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                      Dias parcelas — até limite 2
                    </label>
                    <input
                      className={inputClass}
                      value={csv2}
                      onChange={(e) => setCsv2(e.target.value)}
                      placeholder="30, 45, 60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                      Dias parcelas — acima do limite 2
                    </label>
                    <input
                      className={inputClass}
                      value={csv3}
                      onChange={(e) => setCsv3(e.target.value)}
                      placeholder="30, 45, 60, 75"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Entrada alvo (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        min={1}
                        max={99}
                        className={inputClass}
                        value={pctAlvo}
                        onChange={(e) => setPctAlvo(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Tolerância (p.p.)</label>
                      <input
                        type="number"
                        step="0.1"
                        min={0.1}
                        className={inputClass}
                        value={tolPp}
                        onChange={(e) => setTolPp(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {erro ? (
                <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100">
                  {erro}
                </div>
              ) : null}
            </>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Políticas por cliente</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Busque clientes no Nomus. Quando a pessoa pertencer a um grupo de pessoas, a coluna{' '}
                  <strong className="font-semibold text-slate-700 dark:text-slate-200">Grupo</strong> exibe o
                  agrupamento.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1" htmlFor="politica-busca-cliente">
                    Buscar cliente
                  </label>
                  <input
                    id="politica-busca-cliente"
                    type="search"
                    className={inputClass}
                    value={buscaCliente}
                    onChange={(e) => setBuscaCliente(e.target.value)}
                    placeholder="Nome, ID ou grupo (mín. 2 caracteres)…"
                    autoComplete="off"
                  />
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                  onClick={() => setBuscaCliente((v) => v.trim())}
                  disabled={buscandoClientes}
                >
                  {buscandoClientes ? 'Buscando…' : 'Buscar'}
                </button>
              </div>

              {erroClientes ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100">
                  {erroClientes}
                </div>
              ) : null}

              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-600">
                <div className="max-h-[360px] overflow-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="sticky top-0 bg-primary-600 text-white">
                      <tr>
                        <th className="px-3 py-2.5 font-semibold w-24">ID</th>
                        <th className="px-3 py-2.5 font-semibold">Nome</th>
                        <th className="px-3 py-2.5 font-semibold min-w-[160px]">Grupo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800/40">
                      {buscandoClientes && clientes.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-3 py-8 text-center text-slate-500">
                            Buscando…
                          </td>
                        </tr>
                      ) : clientes.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-3 py-8 text-center text-slate-500">
                            {buscaCliente.trim().length > 0 && buscaCliente.trim().length < 2
                              ? 'Digite ao menos 2 caracteres para buscar.'
                              : buscaCliente.trim()
                                ? 'Nenhum cliente encontrado.'
                                : 'Digite para buscar clientes no Nomus.'}
                          </td>
                        </tr>
                      ) : (
                        clientes.map((c) => (
                          <tr
                            key={c.id}
                            className="odd:bg-white even:bg-slate-50/80 dark:odd:bg-slate-900/20 dark:even:bg-slate-800/30 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                          >
                            <td className="px-3 py-2 tabular-nums text-slate-600 dark:text-slate-400">{c.id}</td>
                            <td className="px-3 py-2 text-slate-800 dark:text-slate-100" title={c.nome}>
                              {c.nome || '—'}
                            </td>
                            <td className="px-3 py-2 text-slate-700 dark:text-slate-300" title={c.grupo || undefined}>
                              {c.grupo ? (
                                <span className="inline-flex max-w-full truncate rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800 dark:bg-slate-700 dark:text-slate-100">
                                  {c.grupo}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {clientes.length > 0 ? (
                  <div className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-600 dark:text-slate-400">
                    {clientes.length} resultado{clientes.length !== 1 ? 's' : ''}
                    {buscandoClientes ? ' · atualizando…' : ''}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-600 px-6 py-4">
          {aba === 'padrao' ? (
            <button
              type="button"
              onClick={restaurarPadrao}
              disabled={loading || !padrao}
              className="mr-auto text-sm text-slate-600 underline-offset-2 hover:underline dark:text-slate-300 disabled:opacity-40"
            >
              Restaurar padrão do sistema
            </button>
          ) : (
            <span className="mr-auto" />
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200"
          >
            Cancelar
          </button>
          {aba === 'padrao' ? (
            <button
              type="button"
              onClick={() => void salvar()}
              disabled={loading || saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-semibold shadow-md"
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}
