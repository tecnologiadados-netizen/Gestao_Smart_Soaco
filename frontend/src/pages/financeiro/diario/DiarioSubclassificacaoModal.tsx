import { useEffect, useMemo, useState } from 'react';
import {
  cadastrarDiarioSubclassificacao,
  fetchDiarioSubclassificacaoNomes,
} from '../../../api/diarioFinanceiro';
import { criarMatcherTextoLivre } from '../../../utils/textoLivreBusca';

const INPUT =
  'h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-800 focus:border-transparent focus:ring-2 focus:ring-primary-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100';

export function DiarioSubclassificacaoModal({ onClose }: { onClose: () => void }) {
  const [nomes, setNomes] = useState<string[]>([]);
  const [nome, setNome] = useState('');
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      setNomes(await fetchDiarioSubclassificacaoNomes());
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const passa = useMemo(() => criarMatcherTextoLivre(busca), [busca]);
  const visiveis = nomes.filter((item) => passa(item));

  const cadastrar = async () => {
    if (salvando || !nome.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      await cadastrarDiarioSubclassificacao({ nome });
      setNome('');
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-slate-900/50" aria-label="Fechar" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="subclassificacao-titulo"
        className="relative z-[81] flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
      >
        <div className="px-5 pt-5 pb-3">
          <h2 id="subclassificacao-titulo" className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            SubClassificação
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Cadastre os agrupamentos. A relação com a classificação é feita em Ações → Relacionar classificação, a partir dos títulos marcados.
          </p>
        </div>
        <form
          className="flex flex-wrap items-end gap-2 px-5 pb-3"
          onSubmit={(e) => {
            e.preventDefault();
            void cadastrar();
          }}
        >
          <div className="min-w-[12rem] flex-1">
            <label className="mb-1 block text-[11px] text-slate-500" htmlFor="sub-nome">
              Nova subclassificação
            </label>
            <input
              id="sub-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className={INPUT}
              maxLength={80}
              placeholder="Ex.: IMPOSTO"
            />
          </div>
          <button
            type="submit"
            disabled={salvando || !nome.trim()}
            className="inline-flex h-8 items-center justify-center rounded-lg bg-primary-600 px-3 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {salvando ? 'Salvando…' : 'Cadastrar'}
          </button>
        </form>
        <div className="px-5 pb-2">
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar subclassificação"
            className={INPUT}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-5 pb-4">
          {erro ? <p className="mb-2 text-xs text-red-600 dark:text-red-400">{erro}</p> : null}
          {carregando ? (
            <p className="py-6 text-center text-xs text-slate-400">Carregando…</p>
          ) : visiveis.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">Nenhuma subclassificação cadastrada.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-xs dark:divide-slate-700">
              {visiveis.map((item) => (
                <li key={item} className="py-1.5 font-medium text-slate-800 dark:text-slate-100">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex justify-end px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
