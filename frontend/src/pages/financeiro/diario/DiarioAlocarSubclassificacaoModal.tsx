import { useEffect, useState } from 'react';
import {
  alocarDiarioSubclassificacao,
  fetchDiarioSubclassificacaoNomes,
  fetchDiarioSubclassificacoes,
  type DiarioSubclassificacaoConflito,
} from '../../../api/diarioFinanceiro';

const INPUT =
  'h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-800 focus:border-transparent focus:ring-2 focus:ring-primary-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100';

function chaveClassificacao(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
    .toLocaleUpperCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim();
}

export function DiarioAlocarSubclassificacaoModal({
  classificacoes,
  onClose,
  onAlocado,
}: {
  classificacoes: string[];
  onClose: () => void;
  onAlocado: () => void;
}) {
  const [nomes, setNomes] = useState<string[]>([]);
  const [atualPorClassificacao, setAtualPorClassificacao] = useState<Map<string, string>>(() => new Map());
  const [nome, setNome] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [conflitos, setConflitos] = useState<DiarioSubclassificacaoConflito[] | null>(null);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    Promise.all([fetchDiarioSubclassificacaoNomes(), fetchDiarioSubclassificacoes()])
      .then(([listaNomes, itens]) => {
        if (!vivo) return;
        setNomes(listaNomes);
        const mapa = new Map<string, string>();
        for (const item of itens) mapa.set(chaveClassificacao(item.classificacao), item.nome);
        setAtualPorClassificacao(mapa);
      })
      .catch((e) => {
        if (vivo) setErro(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const gravar = async (confirmarTroca: boolean) => {
    if (salvando || !nome.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      const res = await alocarDiarioSubclassificacao({
        classificacoes,
        nome,
        confirmarTroca,
      });
      if (res.precisaConfirmar) {
        setConflitos(res.conflitos ?? []);
        return;
      }
      onAlocado();
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
        aria-labelledby="alocar-sub-titulo"
        className="relative z-[81] flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
      >
        <div className="px-5 pt-5 pb-3">
          <h2 id="alocar-sub-titulo" className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            Relacionar classificação
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Todos os títulos com estas classificações passam a usar a subclassificação escolhida, não só os marcados.
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-5 pb-3">
          <p className="mb-1 text-[11px] text-slate-500">Classificações dos títulos marcados</p>
          <ul className="mb-3 max-h-40 overflow-auto rounded-lg border border-slate-200 text-xs dark:border-slate-600">
            {classificacoes.map((item) => {
              const atual = atualPorClassificacao.get(chaveClassificacao(item));
              return (
                <li key={item} className="border-b border-slate-100 px-2.5 py-1.5 last:border-b-0 dark:border-slate-700">
                  <span className="text-slate-800 dark:text-slate-100">{item}</span>
                  {atual ? (
                    <span className="ml-2 text-slate-500">hoje: {atual}</span>
                  ) : (
                    <span className="ml-2 text-slate-400">sem subclassificação</span>
                  )}
                </li>
              );
            })}
          </ul>
          <label className="mb-1 block text-[11px] text-slate-500" htmlFor="alocar-sub-nome">
            SubClassificação
          </label>
          <select
            id="alocar-sub-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            disabled={salvando || carregando}
            className={INPUT}
          >
            <option value="">{carregando ? 'Carregando…' : 'Selecione'}</option>
            {nomes.map((opcao) => (
              <option key={opcao} value={opcao}>
                {opcao}
              </option>
            ))}
          </select>
          {erro ? <p className="mt-2 text-xs text-red-600 dark:text-red-400">{erro}</p> : null}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="inline-flex h-8 items-center rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void gravar(false)}
            disabled={salvando || carregando || !nome.trim()}
            className="inline-flex h-8 items-center rounded-lg bg-primary-600 px-3 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {salvando ? 'Salvando…' : 'Relacionar'}
          </button>
        </div>
      </div>

      {conflitos ? (
        <div className="absolute inset-0 z-[82] flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Fechar aviso" onClick={() => setConflitos(null)} />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="troca-sub-titulo"
            className="relative z-[83] w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-slate-800"
          >
            <h3 id="troca-sub-titulo" className="text-base font-semibold text-slate-900 dark:text-slate-50">
              Trocar subclassificação?
            </h3>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
              Estas classificações já estão alocadas. Confirmar a troca para {nome || 'a nova subclassificação'}?
            </p>
            <ul className="mt-3 max-h-40 overflow-auto text-xs text-slate-800 dark:text-slate-100">
              {conflitos.map((item) => (
                <li key={item.classificacao} className="py-0.5">
                  {item.classificacao} → hoje {item.atual}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConflitos(null)}
                disabled={salvando}
                className="inline-flex h-8 items-center rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void gravar(true)}
                disabled={salvando}
                className="inline-flex h-8 items-center rounded-lg bg-primary-600 px-3 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {salvando ? 'Trocando…' : 'Confirmar troca'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
