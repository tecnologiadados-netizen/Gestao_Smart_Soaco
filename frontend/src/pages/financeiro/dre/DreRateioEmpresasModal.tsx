import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import DreRateioOrigemModal from './DreRateioOrigemModal';
import {
  DRE_RATEIO_PRO_LABORE_LINHAS,
  chaveOrigemRateio,
  configRateioValida,
  criarRegraRateio,
  labelOrigemRateio,
  normalizarPercentuaisRateio,
  parsePercentualRateioInput,
  percentuaisPadrao,
  percentuaisRateioValidos,
  regraProLaborePadrao,
  somaPercentuaisRateio,
  type DreRateioConfig,
  type DreRateioOrigem,
  type DreRateioRegra,
} from './dreRateioEmpresas';

export type DreRateioModalProps = {
  aberto: boolean;
  config: DreRateioConfig;
  onClose: () => void;
  onSalvar: (config: DreRateioConfig) => void;
};

/** @deprecated use DreRateioModalProps */
export type DreRateioProLaboreModalProps = DreRateioModalProps;

const nfPct = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function pctParaInput(v: number): string {
  return nfPct.format(v);
}

function inputsFromRegra(regra: DreRateioRegra): Record<number, string> {
  return Object.fromEntries(
    DRE_RATEIO_PRO_LABORE_LINHAS.map((l) => [l.id, pctParaInput(regra.percentuais[l.id] ?? 0)]),
  );
}

export default function DreRateioModal({
  aberto,
  config,
  onClose,
  onSalvar,
}: DreRateioModalProps) {
  const [rascunho, setRascunho] = useState<DreRateioConfig>(config);
  const [regraSelId, setRegraSelId] = useState<string | null>(config.regras[0]?.id ?? null);
  const [inputs, setInputs] = useState<Record<number, string>>({});
  const [modalOrigemAberto, setModalOrigemAberto] = useState(false);
  const [regraEditandoId, setRegraEditandoId] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setRascunho(config);
    const primeira = config.regras[0];
    setRegraSelId(primeira?.id ?? null);
    setInputs(primeira ? inputsFromRegra(primeira) : {});
    setModalOrigemAberto(false);
    setRegraEditandoId(null);
  }, [aberto, config]);

  const regraSel = useMemo(
    () => rascunho.regras.find((r) => r.id === regraSelId) ?? rascunho.regras[0] ?? null,
    [rascunho.regras, regraSelId],
  );

  useEffect(() => {
    if (!regraSel) return;
    setInputs(inputsFromRegra(regraSel));
  }, [regraSel?.id]);

  const soma = useMemo(
    () => (regraSel ? somaPercentuaisRateio(regraSel.percentuais) : 0),
    [regraSel],
  );
  const somaOk = regraSel ? percentuaisRateioValidos(regraSel.percentuais) : false;
  const configOk = configRateioValida(rascunho);

  const atualizarRegra = (id: string, patch: Partial<DreRateioRegra>) => {
    setRascunho((prev) => ({
      regras: prev.regras.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  };

  const commitInput = (idEmpresa: number, texto: string) => {
    if (!regraSel) return false;
    const parsed = parsePercentualRateioInput(texto);
    if (parsed == null) return false;
    atualizarRegra(regraSel.id, {
      percentuais: { ...regraSel.percentuais, [idEmpresa]: parsed },
    });
    setInputs((prev) => ({ ...prev, [idEmpresa]: pctParaInput(parsed) }));
    return true;
  };

  const handleBlur = (idEmpresa: number) => {
    if (!regraSel) return;
    const texto = inputs[idEmpresa] ?? '';
    if (!commitInput(idEmpresa, texto)) {
      setInputs((prev) => ({ ...prev, [idEmpresa]: pctParaInput(regraSel.percentuais[idEmpresa] ?? 0) }));
    }
  };

  const handleSalvar = () => {
    const regras = rascunho.regras.map((r) => ({
      ...r,
      percentuais: normalizarPercentuaisRateio(r.percentuais),
    }));
    if (!configRateioValida({ regras })) return;
    onSalvar({ regras });
    onClose();
  };

  const handleRestaurarTudo = () => {
    const padrao = { regras: [regraProLaborePadrao()] };
    setRascunho(padrao);
    const primeira = padrao.regras[0]!;
    setRegraSelId(primeira.id);
    setInputs(inputsFromRegra(primeira));
  };

  const handleRestaurarRegra = () => {
    if (!regraSel) return;
    const pct = normalizarPercentuaisRateio(percentuaisPadrao());
    atualizarRegra(regraSel.id, { percentuais: pct });
    setInputs(inputsFromRegra({ ...regraSel, percentuais: pct }));
  };

  const handleAdicionarOrigem = (origem: DreRateioOrigem) => {
    const chave = chaveOrigemRateio(origem);
    const existente = rascunho.regras.find((r) => chaveOrigemRateio(r.origem) === chave);
    if (existente) {
      setRegraSelId(existente.id);
      return;
    }
    const nova = criarRegraRateio(origem);
    setRascunho((prev) => ({ regras: [...prev.regras, nova] }));
    setRegraSelId(nova.id);
    setInputs(inputsFromRegra(nova));
  };

  const handleConfirmarOrigem = (origem: DreRateioOrigem) => {
    const chave = chaveOrigemRateio(origem);
    if (regraEditandoId) {
      const duplicata = rascunho.regras.find(
        (r) => r.id !== regraEditandoId && chaveOrigemRateio(r.origem) === chave,
      );
      if (duplicata) {
        setRegraSelId(duplicata.id);
        return;
      }
      atualizarRegra(regraEditandoId, { origem });
      setRegraSelId(regraEditandoId);
      return;
    }
    handleAdicionarOrigem(origem);
  };

  const handleAbrirAdicionarOrigem = () => {
    setRegraEditandoId(null);
    setModalOrigemAberto(true);
  };

  const handleAbrirEditarOrigem = (regra: DreRateioRegra) => {
    setRegraSelId(regra.id);
    setRegraEditandoId(regra.id);
    setModalOrigemAberto(true);
  };

  const fecharModalOrigem = () => {
    setModalOrigemAberto(false);
    setRegraEditandoId(null);
  };

  const origemEditando = useMemo(
    () => rascunho.regras.find((r) => r.id === regraEditandoId)?.origem ?? null,
    [rascunho.regras, regraEditandoId],
  );

  const handleRemoverRegra = (id: string) => {
    setRascunho((prev) => {
      const regras = prev.regras.filter((r) => r.id !== id);
      const next = { regras: regras.length > 0 ? regras : [regraProLaborePadrao()] };
      if (regraSelId === id) {
        const prox = next.regras[0]!;
        setRegraSelId(prox.id);
        setInputs(inputsFromRegra(prox));
      }
      return next;
    });
  };

  if (!aberto || typeof document === 'undefined') return null;

  return (
    <>
      {createPortal(
        <div
          className="fixed inset-0 z-[10050] flex items-center justify-center p-3 sm:p-6 bg-black/70 dark:bg-slate-950/60"
          onClick={onClose}
          role="presentation"
        >
          <div
            className="relative flex w-full max-w-4xl min-h-[min(80vh,680px)] max-h-[min(96vh,900px)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dre-rateio-titulo"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-600">
              <div className="min-w-0 pr-2">
                <h2 id="dre-rateio-titulo" className="text-xl font-semibold text-slate-800 dark:text-slate-100">
                  Rateio
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Várias origens na DRE — cada uma com percentuais próprios por empresa (soma 100%).
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden flex flex-col lg:flex-row">
              <div className="shrink-0 lg:shrink lg:w-[42%] lg:min-w-[280px] border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-600 flex flex-col min-h-0">
                <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 bg-slate-50/80 dark:bg-slate-900/30">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Origens ({rascunho.regras.length})
                  </p>
                  <button
                    type="button"
                    onClick={handleAbrirAdicionarOrigem}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border border-primary-500 text-primary-700 dark:text-primary-300 bg-white dark:bg-slate-800 hover:bg-primary-50 dark:hover:bg-primary-950/30 transition"
                  >
                    + Adicionar
                  </button>
                </div>
                <ul className="min-h-0 flex-1 overflow-auto divide-y divide-slate-100 dark:divide-slate-700">
                  {rascunho.regras.map((regra) => {
                    const ativa = regra.id === regraSel?.id;
                    const ok = percentuaisRateioValidos(regra.percentuais);
                    return (
                      <li key={regra.id}>
                        <div
                          className={`flex items-start gap-2 px-4 py-3 transition ${
                            ativa
                              ? 'bg-primary-50 dark:bg-primary-950/30'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setRegraSelId(regra.id)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <p
                              className={`text-sm leading-snug break-words ${
                                ativa
                                  ? 'font-medium text-primary-900 dark:text-primary-100'
                                  : 'text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              {labelOrigemRateio(regra.origem)}
                            </p>
                            <p
                              className={`mt-0.5 text-xs tabular-nums ${
                                ok
                                  ? 'text-emerald-700 dark:text-emerald-300'
                                  : 'text-amber-700 dark:text-amber-300'
                              }`}
                            >
                              {nfPct.format(somaPercentuaisRateio(regra.percentuais))}%
                            </p>
                          </button>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleAbrirEditarOrigem(regra)}
                              className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                              title="Editar origem"
                              aria-label="Editar origem"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden
                              >
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoverRegra(regra.id)}
                              className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                              title="Remover origem"
                              aria-label="Remover origem"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="min-h-0 flex-1 flex flex-col overflow-hidden">
                {regraSel ? (
                  <>
                    <div className="shrink-0 px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Percentuais desta origem
                      </p>
                      <p className="mt-0.5 text-sm text-slate-800 dark:text-slate-200 break-words">
                        {labelOrigemRateio(regraSel.origem)}
                      </p>
                    </div>
                    <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            <th className="pb-2 pr-3">Empresa</th>
                            <th className="pb-2 text-right w-36">Percentual (%)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {DRE_RATEIO_PRO_LABORE_LINHAS.map((linha) => (
                            <tr
                              key={linha.id}
                              className="border-t border-slate-100 dark:border-slate-700 odd:bg-white even:bg-slate-50/80 dark:odd:bg-slate-800/40 dark:even:bg-slate-900/30"
                            >
                              <td className="py-2.5 pr-3 text-slate-800 dark:text-slate-200">{linha.label}</td>
                              <td className="py-2.5 text-right">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={inputs[linha.id] ?? ''}
                                  onChange={(e) =>
                                    setInputs((prev) => ({ ...prev, [linha.id]: e.target.value }))
                                  }
                                  onBlur={() => handleBlur(linha.id)}
                                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-right tabular-nums text-sm text-slate-800 dark:text-slate-100"
                                  aria-label={`Percentual ${linha.label}`}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      <div
                        className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
                          somaOk
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200'
                            : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200'
                        }`}
                      >
                        Total: <span className="font-semibold tabular-nums">{nfPct.format(soma)}%</span>
                        {!somaOk ? <span className="ml-1">— ajuste para 100,00%</span> : null}
                      </div>
                    </div>
                    <div className="shrink-0 px-4 py-2 border-t border-slate-100 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={handleRestaurarRegra}
                        className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                      >
                        Restaurar padrão desta origem (70 / 15 / 5 / 10)
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-1 items-center justify-center p-6 text-sm text-slate-500 dark:text-slate-400">
                    Adicione uma origem para configurar o rateio.
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/40">
              <button
                type="button"
                onClick={handleRestaurarTudo}
                className="px-3 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                Restaurar tudo
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSalvar}
                  disabled={!configOk}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition shadow-sm"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      <DreRateioOrigemModal
        aberto={modalOrigemAberto}
        onClose={fecharModalOrigem}
        onConfirmar={handleConfirmarOrigem}
        origemInicial={origemEditando}
        modo={regraEditandoId ? 'editar' : 'adicionar'}
      />
    </>
  );
}

/** @deprecated use DreRateioModal */
export { DreRateioModal as DreRateioProLaboreModal };
