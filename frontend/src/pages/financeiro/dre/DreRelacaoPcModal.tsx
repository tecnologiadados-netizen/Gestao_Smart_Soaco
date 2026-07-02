import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import MultiSelectWithSearch from '../../../components/MultiSelectWithSearch';
import {
  fetchDreRelacaoPc,
  salvarDreRelacaoPcPathKey,
  type DreRelacaoPcContaApi,
  type DreRelacaoPcPayload,
} from '../../../api/financeiro';
import { criarMatcherTextoLivre, PLACEHOLDER_BUSCA_TEXTO_LIVRE } from '../../../utils/textoLivreBusca';

export type DreRelacaoPcModalProps = {
  aberto: boolean;
  onClose: () => void;
  onSalvo?: () => void;
};

const LABEL = 'block text-xs text-slate-500 dark:text-slate-400 mb-1';
const INPUT =
  'w-full rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent';

type RascunhoShop9 = {
  shop9OrdensAdicionais: number[];
  shop9OrdensExcluidos: number[];
};

function rascunhoShop9FromConta(conta: DreRelacaoPcContaApi): RascunhoShop9 {
  return {
    shop9OrdensAdicionais: [...conta.shop9OrdensAdicionais],
    shop9OrdensExcluidos: [...conta.shop9OrdensExcluidos],
  };
}

function TagShop9({
  label,
  origem,
  onRemover,
}: {
  label: string;
  origem: 'automatico' | 'manual';
  onRemover?: () => void;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${
        origem === 'automatico'
          ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
          : 'bg-primary-50 text-primary-900 dark:bg-primary-950/50 dark:text-primary-100'
      }`}
    >
      <span className="truncate max-w-[320px]" title={label}>
        {label}
      </span>
      <span className="text-[10px] uppercase opacity-60">{origem === 'automatico' ? 'auto' : 'manual'}</span>
      {onRemover ? (
        <button
          type="button"
          onClick={onRemover}
          className="ml-0.5 rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
          title="Remover vínculo"
        >
          ×
        </button>
      ) : null}
    </span>
  );
}

export default function DreRelacaoPcModal({ aberto, onClose, onSalvo }: DreRelacaoPcModalProps) {
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [payload, setPayload] = useState<DreRelacaoPcPayload | null>(null);
  const [busca, setBusca] = useState('');
  const [pathKeySel, setPathKeySel] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<RascunhoShop9 | null>(null);

  const parseCsvIds = (value: string): number[] =>
    [...new Set(value.split(',').map((s) => Math.trunc(Number(s.trim()))).filter((n) => n > 0))].sort(
      (a, b) => a - b,
    );

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    const res = await fetchDreRelacaoPc();
    if (res.erro) setErro(res.erro);
    setPayload(res);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!aberto) return;
    void carregar();
    setBusca('');
    setPathKeySel(null);
    setRascunho(null);
  }, [aberto, carregar]);

  const matchBusca = useMemo(() => criarMatcherTextoLivre(busca), [busca]);

  const contasFiltradas = useMemo(() => {
    const list = payload?.contas ?? [];
    if (!busca.trim()) return list;
    return list.filter((c) => matchBusca(`${c.codigo} ${c.nome}`));
  }, [payload?.contas, busca, matchBusca]);

  const contaSel = useMemo(
    () => payload?.contas.find((c) => c.pathKey === pathKeySel) ?? null,
    [payload?.contas, pathKeySel],
  );

  useEffect(() => {
    if (!contaSel) {
      setRascunho(null);
      return;
    }
    setRascunho(rascunhoShop9FromConta(contaSel));
  }, [contaSel]);

  const shop9Opcoes = useMemo(() => (payload?.catalogoShop9 ?? []).map((p) => String(p.ordem)), [payload?.catalogoShop9]);

  const shop9Label = useMemo(
    () => Object.fromEntries((payload?.catalogoShop9 ?? []).map((p) => [String(p.ordem), `${p.ordem} — ${p.nome}`])),
    [payload?.catalogoShop9],
  );

  const vinculosShop9Efetivos = useMemo(() => {
    if (!contaSel || !rascunho) return [];
    const out: { ordem: number; nome: string; origem: 'automatico' | 'manual' }[] = [];
    const ordensVistas = new Set<number>();

    for (const v of contaSel.shop9) {
      if (v.origem === 'automatico' && rascunho.shop9OrdensExcluidos.includes(v.ordem)) continue;
      if (rascunho.shop9OrdensAdicionais.includes(v.ordem)) continue;
      if (ordensVistas.has(v.ordem)) continue;
      ordensVistas.add(v.ordem);
      out.push(v);
    }
    for (const ordem of rascunho.shop9OrdensAdicionais) {
      if (ordensVistas.has(ordem)) continue;
      ordensVistas.add(ordem);
      out.push({
        ordem,
        nome: payload?.catalogoShop9.find((p) => p.ordem === ordem)?.nome ?? `(ordem ${ordem})`,
        origem: 'manual',
      });
    }
    return out.sort((a, b) => a.ordem - b.ordem);
  }, [contaSel, rascunho, payload?.catalogoShop9]);

  const removerShop9 = (ordem: number, origem: 'automatico' | 'manual') => {
    setRascunho((prev) => {
      if (!prev) return prev;
      if (origem === 'manual') {
        return {
          ...prev,
          shop9OrdensAdicionais: prev.shop9OrdensAdicionais.filter((x) => x !== ordem),
        };
      }
      if (prev.shop9OrdensExcluidos.includes(ordem)) return prev;
      return {
        ...prev,
        shop9OrdensExcluidos: [...prev.shop9OrdensExcluidos, ordem].sort((a, b) => a - b),
      };
    });
  };

  const handleSalvar = async () => {
    if (!contaSel || !rascunho) return;
    setSalvando(true);
    setErro(null);
    const res = await salvarDreRelacaoPcPathKey({
      pathKey: contaSel.pathKey,
      shop9OrdensAdicionais: rascunho.shop9OrdensAdicionais,
      shop9OrdensExcluidos: rascunho.shop9OrdensExcluidos,
    });
    setSalvando(false);
    if (res.erro) {
      setErro(res.erro);
      return;
    }
    await carregar();
    if (res.conta) {
      setPathKeySel(res.conta.pathKey);
      setRascunho(rascunhoShop9FromConta(res.conta));
    }
    onSalvo?.();
  };

  if (!aberto || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-black/70 dark:bg-slate-950/60"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex w-full max-w-6xl max-h-[min(92vh,860px)] min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dre-relacao-pc-titulo"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-600">
          <div>
            <h2 id="dre-relacao-pc-titulo" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Relação PC — Shop9 × DRE
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              A estrutura DRE vem do plano Nomus. Aqui você identifica qual conta Shop9 alimenta a mesma linha e
              complementa o vínculo quando necessário.
            </p>
            {payload ? (
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                Nomus: {payload.fonteNomus === 'live' ? 'banco ao vivo' : 'JSON local'}
                {' · '}
                Shop9: {payload.fonteShop9 === 'live' ? 'banco ao vivo' : 'indisponível'}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        {erro ? (
          <p className="mx-5 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            {erro}
          </p>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col gap-0 md:flex-row">
          <div className="flex min-h-0 w-full flex-col border-b border-slate-200 md:w-[42%] md:border-b-0 md:border-r dark:border-slate-600">
            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-600">
              <label className={LABEL}>Buscar conta DRE</label>
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder={PLACEHOLDER_BUSCA_TEXTO_LIVRE}
                className={INPUT}
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {loading ? (
                <p className="p-4 text-sm text-slate-500">Carregando…</p>
              ) : (
                <ul className="space-y-1">
                  {contasFiltradas.map((c) => {
                    const sel = c.pathKey === pathKeySel;
                    const semShop9 = c.shop9.length === 0;
                    return (
                      <li key={c.pathKey}>
                        <button
                          type="button"
                          onClick={() => setPathKeySel(c.pathKey)}
                          className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                            sel
                              ? 'bg-primary-50 text-primary-900 dark:bg-primary-950/40 dark:text-primary-100'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{c.codigo}</span>
                          <span className="ml-2 font-medium">{c.nome}</span>
                          <span
                            className={`ml-2 text-[11px] ${semShop9 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}
                          >
                            Shop9: {c.shop9.length}
                            {semShop9 ? ' · sem vínculo' : ''}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto p-4">
            {!contaSel || !rascunho ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Selecione uma conta DRE à esquerda.</p>
            ) : (
              <>
                <div className="mb-4">
                  <p className="font-mono text-xs text-slate-500">{contaSel.codigo}</p>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{contaSel.nome}</h3>
                </div>

                <section className="mb-5 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-600 dark:bg-slate-900/40">
                  <h4 className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Nomus — base da linha DRE
                  </h4>
                  <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                    Conta(s) do plano financeiro Nomus que compõem esta linha (somente consulta).
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {contaSel.nomus.length === 0 ? (
                      <span className="text-xs text-slate-400">Nenhuma conta Nomus mapeada para esta linha</span>
                    ) : (
                      contaSel.nomus.map((v) => (
                        <span
                          key={v.id}
                          className="inline-flex max-w-full truncate rounded-md bg-white px-2 py-0.5 text-xs text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600"
                          title={`${v.id} — ${v.nome}`}
                        >
                          {v.id} — {v.nome}
                        </span>
                      ))
                    )}
                  </div>
                </section>

                <section className="mb-5">
                  <h4 className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Shop9 — alimentação desta linha
                  </h4>
                  <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                    Plano de contas Shop9 que já mapeia para esta conta DRE. Se não houver, vincule manualmente abaixo.
                  </p>
                  {payload?.fonteShop9 !== 'live' ? (
                    <p className="mb-2 text-xs text-amber-700 dark:text-amber-300">
                      Catálogo Shop9 indisponível — configure SHOP9_DB_* para listar planos ao vivo.
                    </p>
                  ) : null}
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {vinculosShop9Efetivos.length === 0 ? (
                      <span className="rounded-md border border-dashed border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
                        Nenhuma conta Shop9 vinculada — use o campo abaixo para complementar
                      </span>
                    ) : (
                      vinculosShop9Efetivos.map((v) => (
                        <TagShop9
                          key={v.ordem}
                          label={`${v.ordem} — ${v.nome}`}
                          origem={v.origem}
                          onRemover={() => removerShop9(v.ordem, v.origem)}
                        />
                      ))
                    )}
                  </div>
                  <MultiSelectWithSearch
                    label="Vincular plano Shop9"
                    placeholder="Buscar ordem ou nome…"
                    options={shop9Opcoes}
                    labelByValue={shop9Label}
                    value={rascunho.shop9OrdensAdicionais.join(',')}
                    onChange={(value) => {
                      const ordens = parseCsvIds(value);
                      setRascunho((prev) =>
                        prev
                          ? {
                              ...prev,
                              shop9OrdensAdicionais: ordens,
                              shop9OrdensExcluidos: prev.shop9OrdensExcluidos.filter((o) => !ordens.includes(o)),
                            }
                          : prev,
                      );
                    }}
                    labelClass={LABEL}
                    inputClass={INPUT}
                    fillContainer
                    dropdownZIndex={10100}
                    minSearchChars={1}
                    disabled={payload?.fonteShop9 !== 'live'}
                  />
                </section>

                <div className="mt-auto flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-600">
                  <button
                    type="button"
                    onClick={() => contaSel && setRascunho(rascunhoShop9FromConta(contaSel))}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Desfazer
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSalvar()}
                    disabled={salvando}
                    className="rounded-lg bg-primary-600 px-5 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                  >
                    {salvando ? 'Salvando…' : 'Salvar vínculo Shop9'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
