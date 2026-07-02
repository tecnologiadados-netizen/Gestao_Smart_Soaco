import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import CarregandoInformacoesOverlay from '../../components/CarregandoInformacoesOverlay';
import {
  createProgramacaoProducaoRecurso,
  deleteProgramacaoProducaoRecurso,
  listProgramacaoProducaoRecursos,
  updateProgramacaoProducaoRecurso,
} from '../../api/programacaoProducao';
import type { ProgramacaoProducaoRecurso } from '../../components/programacao-producao/types';
import { patchCatalogoRecursosRuntime } from '../../utils/programacaoProducaoCatalogoRuntime';
import { usuarioRecursoLabel } from '../../utils/programacaoProducaoRoteiros';
import {
  podeEditarProgramacaoProducao,
  podeVerProgramacaoProducao,
} from '../../utils/programacaoProducaoPermissoes';
import { criarMatcherTextoLivre, PLACEHOLDER_BUSCA_TEXTO_LIVRE } from '../../utils/textoLivreBusca';

const BTN_PRIMARY =
  'px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm transition';
const BTN_SECONDARY =
  'px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium text-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600';
const INPUT =
  'w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-2 text-sm';

export default function ProgramacaoProducaoRecursosPage() {
  const { hasPermission } = useAuth();
  const canView = podeVerProgramacaoProducao(hasPermission);
  const canEdit = podeEditarProgramacaoProducao(hasPermission);

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [recursos, setRecursos] = useState<ProgramacaoProducaoRecurso[]>([]);
  const [filtro, setFiltro] = useState('');
  const [modal, setModal] = useState<'novo' | { editar: ProgramacaoProducaoRecurso } | null>(null);
  const [nomeForm, setNomeForm] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [confirmExcluir, setConfirmExcluir] = useState<ProgramacaoProducaoRecurso | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const lista = await listProgramacaoProducaoRecursos();
      setRecursos(lista);
      patchCatalogoRecursosRuntime(lista);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar recursos.');
      setRecursos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canView) return;
    void carregar();
  }, [canView, carregar]);

  const match = useMemo(() => criarMatcherTextoLivre(filtro), [filtro]);
  const filtrados = useMemo(
    () =>
      recursos.filter(
        (r) => match(r.cod) || match(r.nome) || match(usuarioRecursoLabel(r))
      ),
    [recursos, match]
  );

  const abrirNovo = () => {
    setNomeForm('');
    setModal('novo');
    setErro(null);
  };

  const abrirEditar = (r: ProgramacaoProducaoRecurso) => {
    setNomeForm(r.nome);
    setModal({ editar: r });
    setErro(null);
  };

  const salvar = async () => {
    if (!canEdit) return;
    setSalvando(true);
    setErro(null);
    try {
      if (modal === 'novo') {
        await createProgramacaoProducaoRecurso(nomeForm);
      } else if (modal && typeof modal === 'object' && 'editar' in modal) {
        await updateProgramacaoProducaoRecurso(modal.editar.cod, nomeForm);
      }
      setModal(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar recurso.');
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async () => {
    if (!confirmExcluir || !canEdit) return;
    setExcluindo(true);
    setErro(null);
    try {
      await deleteProgramacaoProducaoRecurso(confirmExcluir.cod);
      setConfirmExcluir(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao excluir recurso.');
    } finally {
      setExcluindo(false);
    }
  };

  if (!canView) {
    return <Navigate to="/sem-acesso" replace />;
  }

  return (
    <div className="relative flex flex-col flex-1 min-h-0 p-3 max-w-[1200px] mx-auto w-full">
      <CarregandoInformacoesOverlay show={loading || salvando || excluindo} mode="viewport" />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between shrink-0">
        <div>
          <p className="text-xs font-medium text-primary-600 dark:text-primary-400 uppercase tracking-wide">
            PCP · Programação
          </p>
          <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Recursos</h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Cadastro de recursos usados nos roteiros de produção.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/pedidos/programacao-producao" className={BTN_SECONDARY}>
            Voltar
          </Link>
          {canEdit && (
            <button type="button" className={BTN_PRIMARY} onClick={abrirNovo}>
              Novo recurso
            </button>
          )}
        </div>
      </div>

      {erro && !modal && !confirmExcluir && (
        <p className="mb-2 text-sm text-red-600 dark:text-red-300 shrink-0" role="alert">
          {erro}
        </p>
      )}

      <div className="mb-2 shrink-0">
        <input
          type="search"
          className={INPUT}
          placeholder={PLACEHOLDER_BUSCA_TEXTO_LIVRE}
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        />
      </div>

      <div className="flex-1 min-h-0 card-panel shadow-sm overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-900">
            <tr>
              <th className="text-left px-3 py-2 font-semibold text-slate-700 dark:text-slate-200 w-24">
                Cód
              </th>
              <th className="text-left px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
                Recurso
              </th>
              <th className="text-left px-3 py-2 font-semibold text-slate-700 dark:text-slate-200 w-40">
                Usuário
              </th>
              {canEdit && (
                <th className="text-right px-3 py-2 font-semibold text-slate-700 dark:text-slate-200 w-36">
                  Ações
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 ? (
              <tr>
                <td
                  colSpan={canEdit ? 4 : 3}
                  className="px-3 py-8 text-center text-slate-500 dark:text-slate-400"
                >
                  {loading ? 'Carregando…' : 'Nenhum recurso cadastrado.'}
                </td>
              </tr>
            ) : (
              filtrados.map((r) => (
                <tr
                  key={r.cod}
                  className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                >
                  <td className="px-3 py-2 font-mono text-xs">{r.cod}</td>
                  <td className="px-3 py-2">{r.nome}</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400 text-xs">
                    {usuarioRecursoLabel(r)}
                  </td>
                  {canEdit && (
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="text-primary-600 hover:underline text-xs mr-3 dark:text-primary-400"
                        onClick={() => abrirEditar(r)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="text-red-600 hover:underline text-xs dark:text-red-400"
                        onClick={() => setConfirmExcluir(r)}
                      >
                        Excluir
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
          onClick={() => !salvando && setModal(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-600 dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              {modal === 'novo' ? 'Novo recurso' : `Editar ${modal.editar.cod}`}
            </h2>
            <label className="block mt-3">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Nome do recurso</span>
              <input
                className={`${INPUT} mt-1`}
                value={nomeForm}
                disabled={!canEdit || salvando}
                onChange={(e) => setNomeForm(e.target.value)}
                autoFocus
              />
            </label>
            {erro && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-300" role="alert">
                {erro}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className={BTN_SECONDARY}
                disabled={salvando}
                onClick={() => setModal(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={BTN_PRIMARY}
                disabled={salvando || !nomeForm.trim()}
                onClick={() => void salvar()}
              >
                {salvando ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmExcluir && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
          onClick={() => !excluindo && setConfirmExcluir(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-600 dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
          >
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Excluir recurso?</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              O recurso <strong>{confirmExcluir.cod}</strong> — {confirmExcluir.nome} será removido
              permanentemente.
            </p>
            {erro && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-300" role="alert">
                {erro}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className={BTN_SECONDARY}
                disabled={excluindo}
                onClick={() => setConfirmExcluir(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-50"
                disabled={excluindo}
                onClick={() => void excluir()}
              >
                {excluindo ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
