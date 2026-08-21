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
import type { ProgramacaoProducaoRecurso, RecursoEscala, RecursoEscalaFaixa } from '../../components/programacao-producao/types';
import { patchCatalogoRecursosRuntime } from '../../utils/programacaoProducaoCatalogoRuntime';
import { usuarioRecursoLabel } from '../../utils/programacaoProducaoRoteiros';
import { DIAS_SEMANA_ESCALA, formatEscalaResumo } from '../../utils/recursoEscalaLabel';
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
  const [diasForm, setDiasForm] = useState<number[]>([1, 2, 3, 4, 5]);
  const [faixasForm, setFaixasForm] = useState<RecursoEscalaFaixa[]>([
    { inicio: '07:00', fim: '11:30' },
    { inicio: '13:00', fim: '17:15' },
  ]);
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
    setDiasForm([1, 2, 3, 4, 5]);
    setFaixasForm([
      { inicio: '07:00', fim: '11:30' },
      { inicio: '13:00', fim: '17:15' },
    ]);
    setModal('novo');
    setErro(null);
  };

  const abrirEditar = (r: ProgramacaoProducaoRecurso) => {
    setNomeForm(r.nome);
    setDiasForm(r.escala?.diasSemana?.length ? [...r.escala.diasSemana] : [1, 2, 3, 4, 5]);
    setFaixasForm(
      r.escala?.faixas?.length
        ? r.escala.faixas.map((f) => ({ inicio: f.inicio, fim: f.fim }))
        : [
            { inicio: '07:00', fim: '11:30' },
            { inicio: '13:00', fim: '17:15' },
          ]
    );
    setModal({ editar: r });
    setErro(null);
  };

  const escalaDoForm = (): RecursoEscala | null => {
    const faixas = faixasForm.filter((f) => f.inicio.trim() && f.fim.trim());
    if (!faixas.length || !diasForm.length) return null;
    return { diasSemana: [...diasForm], faixas };
  };

  const salvar = async () => {
    if (!canEdit) return;
    setSalvando(true);
    setErro(null);
    try {
      const escala = escalaDoForm();
      if (modal === 'novo') {
        await createProgramacaoProducaoRecurso(nomeForm, escala);
      } else if (modal && typeof modal === 'object' && 'editar' in modal) {
        await updateProgramacaoProducaoRecurso(modal.editar.cod, nomeForm, escala);
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
              <th className="text-left px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
                Escala de trabalho
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
                  colSpan={canEdit ? 5 : 4}
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
                  <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
                    {formatEscalaResumo(r.escala)}
                    {r.painelCamasi || r.cod === 'R001' ? (
                      <span className="ml-1.5 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800 dark:bg-sky-900/50 dark:text-sky-200">
                        Camasi
                      </span>
                    ) : null}
                  </td>
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
            className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-600 dark:bg-slate-800"
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
            <div className="mt-4">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Escala de trabalho
              </span>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                Faixas em que a máquina deve produzir. Intervalos entre faixas (ex.: almoço) não
                contam como parada real no painel Camasi.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {DIAS_SEMANA_ESCALA.map((d) => {
                  const on = diasForm.includes(d.valor);
                  return (
                    <button
                      key={d.valor}
                      type="button"
                      disabled={!canEdit || salvando}
                      onClick={() =>
                        setDiasForm((prev) =>
                          prev.includes(d.valor)
                            ? prev.filter((x) => x !== d.valor)
                            : [...prev, d.valor]
                        )
                      }
                      className={`rounded-md px-2 py-1 text-[11px] font-medium ${
                        on
                          ? 'bg-primary-600 text-white'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {d.curto}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 space-y-2">
                {faixasForm.map((f, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="time"
                      className={`${INPUT} py-1.5`}
                      value={f.inicio}
                      disabled={!canEdit || salvando}
                      onChange={(e) =>
                        setFaixasForm((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, inicio: e.target.value } : x))
                        )
                      }
                    />
                    <span className="text-xs text-slate-500">até</span>
                    <input
                      type="time"
                      className={`${INPUT} py-1.5`}
                      value={f.fim}
                      disabled={!canEdit || salvando}
                      onChange={(e) =>
                        setFaixasForm((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, fim: e.target.value } : x))
                        )
                      }
                    />
                    {faixasForm.length > 1 && canEdit && (
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline dark:text-red-400"
                        disabled={salvando}
                        onClick={() => setFaixasForm((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        Remover
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {canEdit && (
                <button
                  type="button"
                  className="mt-2 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
                  disabled={salvando}
                  onClick={() =>
                    setFaixasForm((prev) => [...prev, { inicio: '13:00', fim: '17:15' }])
                  }
                >
                  + Faixa
                </button>
              )}
            </div>
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
