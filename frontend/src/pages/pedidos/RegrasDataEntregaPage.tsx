import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { PERMISSOES } from '../../config/permissoes';
import {
  criarVersaoRegraDataEntrega,
  obterRegrasDataEntrega,
  type RegraDataEntregaConfig,
  type RegraDataEntregaVersao,
} from '../../api/regrasDataEntrega';
import { formatDateTimeBr } from '../../components/sequenciamento-carradas/sequenciamentoCarradasUtils';

const BTN_PRIMARY =
  'inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_SECONDARY =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';
const INPUT =
  'w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-2 text-sm';
const LABEL = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1';

function hojeIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateBrFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR');
}

function configFromPadrao(padrao: RegraDataEntregaConfig): RegraDataEntregaConfig {
  return {
    carrada: { ...padrao.carrada },
  };
}

function configFromVersao(v: RegraDataEntregaVersao | null, padrao: RegraDataEntregaConfig): RegraDataEntregaConfig {
  if (!v?.payload?.carrada) return configFromPadrao(padrao);
  return {
    carrada: { ...v.payload.carrada },
  };
}

export default function RegrasDataEntregaPage() {
  const { hasPermission } = useAuth();
  const podeVer =
    hasPermission(PERMISSOES.PCP_REGRAS_ENTREGA_VER) ||
    hasPermission(PERMISSOES.PCP_REGRAS_ENTREGA_EDITAR) ||
    hasPermission(PERMISSOES.PCP_TOTAL);
  const podeEditar =
    hasPermission(PERMISSOES.PCP_REGRAS_ENTREGA_EDITAR) || hasPermission(PERMISSOES.PCP_TOTAL);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [gravando, setGravando] = useState(false);

  const [padraoSistema, setPadraoSistema] = useState<RegraDataEntregaConfig | null>(null);
  const [vigenteHoje, setVigenteHoje] = useState<RegraDataEntregaVersao | null>(null);
  const [versoes, setVersoes] = useState<RegraDataEntregaVersao[]>([]);

  const [form, setForm] = useState<RegraDataEntregaConfig | null>(null);
  const [vigenteApartirDe, setVigenteApartirDe] = useState(hojeIsoLocal());

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await obterRegrasDataEntrega();
      setPadraoSistema(r.padraoSistema);
      setVigenteHoje(r.vigenteHoje);
      setVersoes(r.versoes);
      const base = r.vigenteHoje ?? null;
      setForm(configFromVersao(base, r.padraoSistema));
      setVigenteApartirDe(hojeIsoLocal());
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (!podeVer) {
    return <Navigate to="/sem-acesso" replace />;
  }

  const atualizarCarrada = (patch: Partial<RegraDataEntregaConfig['carrada']>) => {
    setForm((prev) =>
      prev
        ? {
            carrada: { ...prev.carrada, ...patch },
          }
        : prev
    );
  };

  const handleRestaurarPadrao = () => {
    if (padraoSistema) setForm(configFromPadrao(padraoSistema));
  };

  const handleUsarVigente = () => {
    if (padraoSistema) setForm(configFromVersao(vigenteHoje, padraoSistema));
  };

  const handleGravar = async () => {
    if (!form || !podeEditar) return;
    setGravando(true);
    setFeedback(null);
    setErro(null);
    try {
      await criarVersaoRegraDataEntrega({
        payload: form,
        vigenteApartirDe,
      });
      setFeedback('Nova versão gravada. O status passa a valer para pedidos cuja emissão seja a partir da data de vigência informada.');
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setGravando(false);
    }
  };

  const c = form?.carrada;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Regras data de entrega</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Configure prazos para classificação <span className="font-medium">Atrasado / Em dia</span> no Gerenciador de
          Pedidos e no Painel Pedidos em aberto. Entrega, retirada e requisição seguem as regras atuais do ERP. Aqui você altera
          apenas <span className="font-medium">carradas</span> (e opcionalmente &quot;Inserir em Romaneio&quot;).
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
          Cada versão vale para pedidos cuja <strong>data de emissão</strong> seja igual ou posterior à vigência. Pedidos
          emitidos antes da primeira versão mantêm o prazo legado (emissão + 30 dias).
        </p>
      </div>

      {carregando && <p className="text-sm text-slate-500">Carregando...</p>}
      {erro && (
        <p className="text-sm text-red-600 dark:text-red-300" role="alert">
          {erro}
        </p>
      )}
      {feedback && (
        <p className="text-sm text-emerald-700 dark:text-emerald-300" role="status">
          {feedback}
        </p>
      )}

      {!carregando && form && c && (
        <>
          <div className="card-panel p-4 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Regra — Carradas</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Valor base: soma do pedido com IPI (<code className="text-xs">Valor Pedido Total</code>), independente de
              saldo a faturar ou qtde romaneada.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Valor de corte (R$)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className={INPUT}
                  disabled={!podeEditar}
                  value={c.valorCorte}
                  onChange={(e) => atualizarCarrada({ valorCorte: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className={LABEL}>Vigente a partir de</label>
                <input
                  type="date"
                  className={INPUT}
                  disabled={!podeEditar}
                  value={vigenteApartirDe}
                  onChange={(e) => setVigenteApartirDe(e.target.value)}
                />
              </div>
              <div>
                <label className={LABEL}>Dias se valor &lt; corte (ex.: 60)</label>
                <input
                  type="number"
                  min={1}
                  max={730}
                  className={INPUT}
                  disabled={!podeEditar}
                  value={c.diasAbaixoCorte}
                  onChange={(e) => atualizarCarrada({ diasAbaixoCorte: Number(e.target.value) })}
                />
                <p className="mt-1 text-xs text-slate-500">Data limite = emissão + estes dias</p>
              </div>
              <div>
                <label className={LABEL}>Dias se valor ≥ corte (ex.: 45)</label>
                <input
                  type="number"
                  min={1}
                  max={730}
                  className={INPUT}
                  disabled={!podeEditar}
                  value={c.diasIgualOuAcimaCorte}
                  onChange={(e) => atualizarCarrada({ diasIgualOuAcimaCorte: Number(e.target.value) })}
                />
                <p className="mt-1 text-xs text-slate-500">Data limite = emissão + estes dias</p>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                disabled={!podeEditar}
                checked={c.incluiInserirRomaneio}
                onChange={(e) => atualizarCarrada({ incluiInserirRomaneio: e.target.checked })}
              />
              Aplicar a mesma regra a &quot;Inserir em Romaneio&quot;
            </label>

            {podeEditar && (
              <div className="flex flex-wrap gap-2 pt-2">
                <button type="button" onClick={() => void handleGravar()} disabled={gravando} className={BTN_PRIMARY}>
                  {gravando ? 'Gravando...' : 'Gravar nova versão'}
                </button>
                <button type="button" onClick={handleUsarVigente} className={BTN_SECONDARY}>
                  Usar regra vigente hoje
                </button>
                <button type="button" onClick={handleRestaurarPadrao} className={BTN_SECONDARY}>
                  Restaurar padrão do sistema
                </button>
              </div>
            )}
          </div>

          <div className="card-panel p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">Versão vigente hoje</h2>
            {vigenteHoje ? (
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Desde <strong>{formatDateBrFromIso(vigenteHoje.vigenteApartirDe)}</strong> — corte R${' '}
                {vigenteHoje.payload.carrada.valorCorte.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ·{' '}
                {vigenteHoje.payload.carrada.diasAbaixoCorte}d (&lt;) /{' '}
                {vigenteHoje.payload.carrada.diasIgualOuAcimaCorte}d (≥)
              </p>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Nenhuma versão cadastrada — carradas usam o legado (emissão + 30 dias).
              </p>
            )}
          </div>

          <div className="card-panel p-4 shadow-sm overflow-auto">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">Histórico de versões</h2>
            {versoes.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma versão gravada ainda.</p>
            ) : (
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-600">
                    <th className="py-2 pr-2 font-semibold">Vigente desde</th>
                    <th className="py-2 pr-2 font-semibold">Corte (R$)</th>
                    <th className="py-2 pr-2 font-semibold">Dias &lt;</th>
                    <th className="py-2 pr-2 font-semibold">Dias ≥</th>
                    <th className="py-2 pr-2 font-semibold">Romaneio</th>
                    <th className="py-2 pr-2 font-semibold">Gravado em</th>
                    <th className="py-2 font-semibold">Por</th>
                  </tr>
                </thead>
                <tbody>
                  {versoes.map((v) => (
                    <tr key={v.id} className="border-b border-slate-100 dark:border-slate-700">
                      <td className="py-2 pr-2 whitespace-nowrap">{formatDateBrFromIso(v.vigenteApartirDe)}</td>
                      <td className="py-2 pr-2 tabular-nums">
                        {v.payload.carrada.valorCorte.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 pr-2 tabular-nums">{v.payload.carrada.diasAbaixoCorte}</td>
                      <td className="py-2 pr-2 tabular-nums">{v.payload.carrada.diasIgualOuAcimaCorte}</td>
                      <td className="py-2 pr-2">{v.payload.carrada.incluiInserirRomaneio ? 'Sim' : 'Não'}</td>
                      <td className="py-2 pr-2 whitespace-nowrap text-xs">{formatDateTimeBr(v.createdAt)}</td>
                      <td className="py-2 text-xs">{v.criadoPorNome || v.criadoPorLogin}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
