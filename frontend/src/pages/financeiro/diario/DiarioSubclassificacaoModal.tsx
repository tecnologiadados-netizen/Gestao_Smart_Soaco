import { useEffect, useMemo, useState } from 'react';
import {
  cadastrarDiarioSubclassificacao,
  fetchDiarioSubclassificacoes,
  type DiarioSubclassificacaoItem,
} from '../../../api/diarioFinanceiro';

const INPUT =
  'h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-800 focus:border-transparent focus:ring-2 focus:ring-primary-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100';

export function DiarioSubclassificacaoModal({
  sugestoes,
  classificacaoInicial,
  onClose,
}: {
  sugestoes: string[];
  classificacaoInicial: string;
  onClose: () => void;
}) {
  const [itens, setItens] = useState<DiarioSubclassificacaoItem[]>([]);
  const [classificacao, setClassificacao] = useState(classificacaoInicial);
  const [nome, setNome] = useState('');
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      setItens(await fetchDiarioSubclassificacoes());
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const nomes = useMemo(
    () => [...new Set(itens.map((item) => item.nome))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [itens],
  );
  const termo = busca.trim().toLocaleUpperCase('pt-BR');
  const visiveis = itens.filter((item) => {
    if (!termo) return true;
    return `${item.classificacao} ${item.nome}`.toLocaleUpperCase('pt-BR').includes(termo);
  });

  const cadastrar = async () => {
    if (salvando || !classificacao.trim() || !nome.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      await cadastrarDiarioSubclassificacao({ classificacao, nome });
      setClassificacao('');
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
        className="relative z-[81] flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
      >
        <div className="px-5 pt-5 pb-3">
          <h2 id="subclassificacao-titulo" className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            SubClassificação
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Cada classificação entra em um agrupamento. As da planilha já estão cadastradas. Um novo cadastro com o mesmo nome substitui o agrupamento.
          </p>
        </div>
        <form
          className="grid grid-cols-1 gap-2 px-5 pb-3 sm:grid-cols-[1fr_12rem_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            void cadastrar();
          }}
        >
          <div>
            <label className="mb-1 block text-[11px] text-slate-500" htmlFor="sub-classificacao">
              Classificação
            </label>
            <input
              id="sub-classificacao"
              list="sub-classificacoes-sugeridas"
              value={classificacao}
              onChange={(e) => setClassificacao(e.target.value)}
              className={INPUT}
              maxLength={180}
              placeholder="Nome da classificação"
            />
            <datalist id="sub-classificacoes-sugeridas">
              {sugestoes.map((opcao) => (
                <option key={opcao} value={opcao} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-slate-500" htmlFor="sub-nome">
              SubClassificação
            </label>
            <input
              id="sub-nome"
              list="sub-nomes-existentes"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className={INPUT}
              maxLength={80}
              placeholder="Agrupamento"
            />
            <datalist id="sub-nomes-existentes">
              {nomes.map((opcao) => (
                <option key={opcao} value={opcao} />
              ))}
            </datalist>
          </div>
          <button
            type="submit"
            disabled={salvando || !classificacao.trim() || !nome.trim()}
            className="mt-5 inline-flex h-8 items-center justify-center rounded-lg bg-primary-600 px-3 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {salvando ? 'Salvando…' : 'Cadastrar'}
          </button>
        </form>
        <div className="px-5 pb-2">
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar classificação ou agrupamento"
            className={INPUT}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-5 pb-4">
          {erro ? <p className="mb-2 text-xs text-red-600 dark:text-red-400">{erro}</p> : null}
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white text-left text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="py-1.5 pr-3 font-medium">Classificação</th>
                <th className="py-1.5 font-medium">SubClassificação</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr>
                  <td colSpan={2} className="py-6 text-center text-slate-400">Carregando…</td>
                </tr>
              ) : visiveis.length === 0 ? (
                <tr>
                  <td colSpan={2} className="py-6 text-center text-slate-400">Nenhum cadastro encontrado.</td>
                </tr>
              ) : visiveis.map((item) => (
                <tr key={item.classificacao} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="py-1.5 pr-3 text-slate-800 dark:text-slate-100">{item.classificacao}</td>
                  <td className="py-1.5 font-medium text-slate-800 dark:text-slate-100">{item.nome}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
