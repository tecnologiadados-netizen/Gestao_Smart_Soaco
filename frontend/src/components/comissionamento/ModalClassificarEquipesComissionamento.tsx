import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  EQUIPE_LABEL,
  obterComissionamentoClassificacao,
  salvarComissionamentoClassificacao,
  type ClassificacaoEquipesMap,
  type EquipeComissionamento,
  type FiltrosComissionamento,
} from '../../api/comissionamento';
import { formatMoeda } from '../../components/painel-comercial/painelComercialUtils';

const EQUIPES_EDIT: Array<Exclude<EquipeComissionamento, 'sem_equipe'>> = [
  'televendas',
  'vendedores',
  'representantes',
];

type Props = {
  aberto: boolean;
  onClose: () => void;
  filtros: FiltrosComissionamento;
  onSalvo: () => void;
};

export default function ModalClassificarEquipesComissionamento({
  aberto,
  onClose,
  filtros,
  onSalvo,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [pessoas, setPessoas] = useState<Array<{ nome: string; equipe: EquipeComissionamento; valor: number }>>(
    []
  );
  const [mapa, setMapa] = useState<ClassificacaoEquipesMap>({});

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const data = await obterComissionamentoClassificacao(filtros);
      setPessoas(data.pessoas ?? []);
      setMapa(data.classificacao ?? {});
      if (data.erro) setErro(data.erro);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar classificação.');
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  useEffect(() => {
    if (!aberto) return;
    void carregar();
  }, [aberto, carregar]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase('pt-BR');
    if (!q) return pessoas;
    return pessoas.filter((p) => p.nome.toLocaleLowerCase('pt-BR').includes(q));
  }, [pessoas, busca]);

  const setEquipe = (nome: string, equipe: Exclude<EquipeComissionamento, 'sem_equipe'> | '') => {
    const key = nome.trim().toLocaleUpperCase('pt-BR');
    setMapa((prev) => {
      const next = { ...prev };
      if (!equipe) delete next[key];
      else next[key] = equipe;
      return next;
    });
  };

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      await salvarComissionamentoClassificacao(mapa);
      onSalvo();
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  if (!aberto) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-black/70">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-slate-800">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Classificar equipes</h2>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
              Classifique cada vendedor/representante em Televendas, Vendedores ou Representantes.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2 dark:border-slate-700">
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar pessoa…"
            className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
          <span className="text-xs text-slate-500">{filtradas.length} pessoa(s)</span>
        </div>

        {erro && (
          <div className="shrink-0 bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:bg-rose-900/30 dark:text-rose-200">
            {erro}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto">
          {loading ? (
            <p className="p-6 text-center text-sm text-slate-500">Carregando…</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-100 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-2 text-left">Vendedor / representante</th>
                  <th className="px-3 py-2 text-right">Venda no período</th>
                  <th className="px-3 py-2 text-left">Equipe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filtradas.map((p) => {
                  const key = p.nome.trim().toLocaleUpperCase('pt-BR');
                  const atual = mapa[key] ?? '';
                  return (
                    <tr key={p.nome}>
                      <td className="px-3 py-2 text-slate-800 dark:text-slate-100">{p.nome}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200">
                        {formatMoeda(p.valor)}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={atual}
                          onChange={(e) =>
                            setEquipe(
                              p.nome,
                              e.target.value as Exclude<EquipeComissionamento, 'sem_equipe'> | ''
                            )
                          }
                          className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                        >
                          <option value="">Sem equipe</option>
                          {EQUIPES_EDIT.map((eq) => (
                            <option key={eq} value={eq}>
                              {EQUIPE_LABEL[eq]}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-600">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={salvando}
            onClick={() => void salvar()}
            className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {salvando ? 'Salvando…' : 'Salvar classificação'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
