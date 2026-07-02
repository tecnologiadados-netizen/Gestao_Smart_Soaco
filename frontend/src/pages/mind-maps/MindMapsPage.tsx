import { useCallback, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { deleteMindMap, duplicateMindMap, listMindMaps } from '../../api/mindMaps';
import MindMapEditor from '../../components/mind-map/MindMapEditor';
import type { MindMapListItem } from '../../components/mind-map/types';
import { podeEditarFluxos, podeVerFluxos } from '../../utils/fluxosPermissoes';

type TelaFluxo = 'lista' | { modo: 'editar' | 'visualizar'; mapId?: string };

export type FluxoAbrirState = {
  fluxoAbrir?: { modo: 'editar' | 'visualizar'; mapId?: string };
};

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('pt-BR');
}

function responsavelLabel(item: MindMapListItem): string {
  if (item.criadoPorNome?.trim()) return item.criadoPorNome.trim();
  return item.criadoPorLogin;
}

const BTN_PRIMARY =
  'px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm transition shrink-0';

const BTN_SECONDARY =
  'px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600';

const BTN_DANGER =
  'px-3 py-1.5 rounded-lg border border-red-300 bg-white text-red-700 font-medium text-sm hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:bg-slate-700 dark:text-red-300 dark:hover:bg-red-950/40';

/** Botões do modal de ação — texto centralizado e largura total. */
const BTN_MODAL = 'w-full flex items-center justify-center text-center';

/** Fluxos Decisórios — lista + editor na mesma rota `/mind-maps` (sem novas abas). */
export default function MindMapsPage() {
  const { hasPermission } = useAuth();
  const canView = podeVerFluxos(hasPermission);
  const canEdit = podeEditarFluxos(hasPermission);
  const location = useLocation();
  const navigate = useNavigate();

  const [tela, setTela] = useState<TelaFluxo>('lista');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [lista, setLista] = useState<MindMapListItem[]>([]);
  const [listaVersao, setListaVersao] = useState(0);
  const [acaoItem, setAcaoItem] = useState<MindMapListItem | null>(null);
  const [confirmExcluir, setConfirmExcluir] = useState<MindMapListItem | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);
  const [duplicando, setDuplicando] = useState(false);
  const [erroDuplicar, setErroDuplicar] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      setLista(await listMindMaps());
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar fluxos.');
      setLista([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tela !== 'lista') return;
    void carregar();
  }, [tela, listaVersao, carregar]);

  /** Abre fluxo a partir de rotas legadas (`/mind-maps/:id/visualizar`, etc.). */
  useEffect(() => {
    const abrir = (location.state as FluxoAbrirState | null)?.fluxoAbrir;
    if (!abrir) return;
    if (abrir.modo === 'visualizar' && abrir.mapId) {
      setTela({ modo: 'visualizar', mapId: abrir.mapId });
    } else if (abrir.modo === 'editar') {
      if (abrir.mapId && canEdit) setTela({ modo: 'editar', mapId: abrir.mapId });
      else if (!abrir.mapId && canEdit) setTela({ modo: 'editar' });
      else if (abrir.mapId) setTela({ modo: 'visualizar', mapId: abrir.mapId });
    }
    navigate('/mind-maps', { replace: true, state: null });
  }, [location.state, navigate, canEdit]);

  const voltarLista = useCallback(() => {
    setTela('lista');
    setListaVersao((v) => v + 1);
  }, []);

  const abrirNovo = () => setTela({ modo: 'editar' });
  const abrirEditar = (mapId: string) => setTela({ modo: 'editar', mapId });
  const abrirVisualizar = (mapId: string) => setTela({ modo: 'visualizar', mapId });

  const aoClicarFluxo = (item: MindMapListItem) => {
    if (!canEdit) {
      abrirVisualizar(item.id);
      return;
    }
    setErroDuplicar(null);
    setAcaoItem(item);
  };

  const solicitarExclusao = () => {
    if (!acaoItem) return;
    setConfirmExcluir(acaoItem);
    setAcaoItem(null);
    setErroExclusao(null);
  };

  const duplicarFluxo = async () => {
    if (!acaoItem) return;
    setDuplicando(true);
    setErroDuplicar(null);
    try {
      await duplicateMindMap(acaoItem.id);
      setAcaoItem(null);
      setListaVersao((v) => v + 1);
    } catch (e) {
      setErroDuplicar(e instanceof Error ? e.message : 'Erro ao duplicar fluxo.');
    } finally {
      setDuplicando(false);
    }
  };

  const confirmarExclusao = async () => {
    if (!confirmExcluir) return;
    setExcluindo(true);
    setErroExclusao(null);
    try {
      await deleteMindMap(confirmExcluir.id);
      setConfirmExcluir(null);
      setListaVersao((v) => v + 1);
    } catch (e) {
      setErroExclusao(e instanceof Error ? e.message : 'Erro ao excluir fluxo.');
    } finally {
      setExcluindo(false);
    }
  };

  if (!canView) {
    return <Navigate to="/sem-acesso" replace />;
  }

  if (tela !== 'lista') {
    const mapId = tela.mapId;
    const readOnly = tela.modo === 'visualizar' || !canEdit;
    return (
      <MindMapEditor
        key={`${tela.modo}-${mapId ?? 'novo'}`}
        mapId={mapId}
        readOnly={readOnly}
        onSair={voltarLista}
        onSaved={() => setListaVersao((v) => v + 1)}
      />
    );
  }

  return (
    <div className="relative flex flex-col flex-1 min-h-0 p-3 max-w-[1920px] mx-auto w-full">
      <div className="mb-2 flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between shrink-0">
        <div className="min-w-0">
          <p className="text-xs font-medium text-primary-600 dark:text-primary-400 uppercase tracking-wide leading-none mb-0.5">
            Ferramentas
          </p>
          <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100 leading-tight">
            Fluxos Decisórios
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Fluxos decisórios da organização.
          </p>
        </div>
        {canEdit && (
          <button type="button" onClick={abrirNovo} className={BTN_PRIMARY}>
            Novo fluxo decisório
          </button>
        )}
      </div>

      {erro && !loading && (
        <p className="mb-2 text-sm text-red-600 dark:text-red-300 shrink-0">{erro}</p>
      )}

      <div className="relative flex-1 min-h-0 card-panel shadow-sm overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <p className="text-sm text-slate-500 dark:text-slate-400">Carregando informações…</p>
          </div>
        ) : lista.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Nenhum fluxo decisório salvo ainda.
            </p>
            {canEdit && (
              <button type="button" onClick={abrirNovo} className={`${BTN_PRIMARY} mt-4`}>
                Criar o primeiro fluxo
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/50">
                  <th className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200">Nome</th>
                  <th className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200">Data de criação</th>
                  <th className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200">Responsável</th>
                  <th className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200">Última alteração</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((item) => (
                  <tr
                    key={item.id}
                    tabIndex={0}
                    className="border-b border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
                    title={canEdit ? 'Clique para abrir este fluxo' : 'Clique para visualizar este fluxo'}
                    onClick={() => aoClicarFluxo(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        aoClicarFluxo(item);
                      }
                    }}
                  >
                    <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-100">
                      {item.name}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap text-slate-800 dark:text-slate-200">
                      {formatDateTime(item.createdAt)}
                    </td>
                    <td className="py-2 px-3 text-slate-800 dark:text-slate-200">
                      {responsavelLabel(item)}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap text-slate-800 dark:text-slate-200">
                      {formatDateTime(item.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {acaoItem && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
          role="presentation"
          onClick={() => setAcaoItem(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-600 dark:bg-slate-800"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{acaoItem.name}</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">O que deseja fazer?</p>
            {erroDuplicar && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-300" role="alert">
                {erroDuplicar}
              </p>
            )}
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                className={`${BTN_SECONDARY} ${BTN_MODAL}`}
                onClick={() => {
                  abrirVisualizar(acaoItem.id);
                  setAcaoItem(null);
                }}
              >
                Visualizar
              </button>
              {canEdit && (
                <>
                  <button
                    type="button"
                    className={`${BTN_PRIMARY} ${BTN_MODAL}`}
                    onClick={() => {
                      abrirEditar(acaoItem.id);
                      setAcaoItem(null);
                    }}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className={`${BTN_SECONDARY} ${BTN_MODAL}`}
                    disabled={duplicando}
                    onClick={() => void duplicarFluxo()}
                  >
                    {duplicando ? 'Duplicando…' : 'Duplicar'}
                  </button>
                  <button
                    type="button"
                    className={`${BTN_DANGER} ${BTN_MODAL}`}
                    onClick={solicitarExclusao}
                  >
                    Excluir
                  </button>
                </>
              )}
              <button
                type="button"
                className={`${BTN_SECONDARY} ${BTN_MODAL}`}
                onClick={() => setAcaoItem(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmExcluir && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
          role="presentation"
          onClick={() => !excluindo && setConfirmExcluir(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-600 dark:bg-slate-800"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="mind-map-excluir-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="mind-map-excluir-title" className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Excluir fluxo decisório?
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              O fluxo <span className="font-medium text-slate-800 dark:text-slate-200">{confirmExcluir.name}</span>{' '}
              será removido permanentemente. Esta ação não pode ser desfeita.
            </p>
            {erroExclusao && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-300" role="alert">
                {erroExclusao}
              </p>
            )}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
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
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium text-sm transition disabled:opacity-50"
                disabled={excluindo}
                onClick={() => void confirmarExclusao()}
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

/** Redireciona rotas antigas para a lista (uma única aba), preservando id e modo. */
export function MindMapsLegacyRedirect() {
  const { id } = useParams();
  const { pathname } = useLocation();
  const modo: 'editar' | 'visualizar' = pathname.includes('/visualizar') ? 'visualizar' : 'editar';
  const state: FluxoAbrirState | undefined =
    id || pathname.includes('/novo')
      ? { fluxoAbrir: { modo, mapId: id } }
      : undefined;
  return <Navigate to="/mind-maps" replace state={state} />;
}
