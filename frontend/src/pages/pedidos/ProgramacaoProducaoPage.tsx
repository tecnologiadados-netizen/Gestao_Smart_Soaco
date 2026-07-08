import { useCallback, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  deleteProgramacaoProducao,
  fetchProgramacaoProducaoCatalogo,
  getProgramacaoProducao,
  listProgramacoesProducao,
  processarProgramacaoProducao,
  concluirProgramacaoProducao,
} from '../../api/programacaoProducao';
import { parseDadosProgramacao } from '../../components/programacao-producao/programacaoProducaoLinhaUtils';
import { aplicarCatalogoProgramacaoProducao } from '../../utils/programacaoProducaoCatalogoRuntime';
import { downloadProgramacaoProducaoPdf } from '../../utils/exportProgramacaoProducaoPdf';
import { imageUrlToDataUrl } from '../../utils/imageDataUrl';
import {
  linhasComInconsistenciaSeqQtde,
  ordenarLinhasParaPdf,
  validarConclusaoPerfiladeiraOps,
} from '../../utils/programacaoProducaoValidacoes';
import ConfirmProcessarInconsistenteModal from '../../components/programacao-producao/ConfirmProcessarInconsistenteModal';
import ModalPdfProgramacaoProducao from '../../components/programacao-producao/ModalPdfProgramacaoProducao';
import type { LinhaProgramacaoProducao } from '../../components/programacao-producao/types';
import ProgramacaoProducaoEditor from '../../components/programacao-producao/ProgramacaoProducaoEditor';
import ProgramacaoProducaoStatusBadge from '../../components/programacao-producao/ProgramacaoProducaoStatusBadge';
import { mensagemBloqueioInconsistenciaQtdePendente } from '../../api/inconsistenciaQtdePendente';
import type { ProgramacaoProducaoListItem } from '../../components/programacao-producao/types';
import {
  podeEditarProgramacaoProducao,
  podeVerProgramacaoProducao,
} from '../../utils/programacaoProducaoPermissoes';
import type { TipoImpressaoProgramacaoProducao } from '../../utils/programacaoProducaoRoteiros';

type TelaProgramacao = 'lista' | { modo: 'editar' | 'visualizar'; programacaoId?: string };

export type ProgramacaoAbrirState = {
  programacaoAbrir?: { modo: 'editar' | 'visualizar'; programacaoId?: string };
};

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('pt-BR');
}

function responsavelLabel(item: ProgramacaoProducaoListItem): string {
  if (item.criadoPorNome?.trim()) return item.criadoPorNome.trim();
  return item.criadoPorLogin;
}

const BTN_PRIMARY =
  'px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm transition shrink-0';

const BTN_SECONDARY =
  'px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600';

const BTN_DANGER =
  'px-3 py-1.5 rounded-lg border border-red-300 bg-white text-red-700 font-medium text-sm hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:bg-slate-700 dark:text-red-300 dark:hover:bg-red-950/40';

const BTN_MODAL = 'w-full flex items-center justify-center text-center';

/** Programação de produção — lista + editor na mesma rota (padrão Fluxos Decisórios). */
export default function ProgramacaoProducaoPage() {
  const { hasPermission } = useAuth();
  const canView = podeVerProgramacaoProducao(hasPermission);
  const canEdit = podeEditarProgramacaoProducao(hasPermission);
  const location = useLocation();
  const navigate = useNavigate();

  const [tela, setTela] = useState<TelaProgramacao>('lista');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [lista, setLista] = useState<ProgramacaoProducaoListItem[]>([]);
  const [listaVersao, setListaVersao] = useState(0);
  const [confirmExcluir, setConfirmExcluir] = useState<ProgramacaoProducaoListItem | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);
  const [acaoEmAndamento, setAcaoEmAndamento] = useState<string | null>(null);
  const [confirmProcessarLista, setConfirmProcessarLista] = useState<{
    id: string;
    linhas: LinhaProgramacaoProducao[];
  } | null>(null);
  const [modalPdf, setModalPdf] = useState<ProgramacaoProducaoListItem | null>(null);
  const [erroModalPdf, setErroModalPdf] = useState<string | null>(null);
  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const rows = await listProgramacoesProducao();
      setLista(
        rows.map((r) => ({
          ...r,
          linhaCount: r.linhaCount ?? 0,
          status: r.status ?? 'em_processamento',
          processadoAt: r.processadoAt ?? null,
          usuarioLoginProcessado: r.usuarioLoginProcessado ?? null,
          concluidoAt: r.concluidoAt ?? null,
          usuarioLoginConcluido: r.usuarioLoginConcluido ?? null,
        }))
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar programações.');
      setLista([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canView) return;
    void fetchProgramacaoProducaoCatalogo()
      .then((data) => aplicarCatalogoProgramacaoProducao(data))
      .catch(() => {
        /* mantém catálogo embutido no bundle */
      });
  }, [canView]);

  useEffect(() => {
    if (tela !== 'lista') return;
    void carregar();
  }, [tela, listaVersao, carregar]);

  useEffect(() => {
    const abrir = (location.state as ProgramacaoAbrirState | null)?.programacaoAbrir;
    if (!abrir) return;
    if (abrir.modo === 'visualizar' && abrir.programacaoId) {
      setTela({ modo: 'visualizar', programacaoId: abrir.programacaoId });
    } else if (abrir.modo === 'editar') {
      if (abrir.programacaoId && canEdit) setTela({ modo: 'editar', programacaoId: abrir.programacaoId });
      else if (!abrir.programacaoId && canEdit) setTela({ modo: 'editar' });
      else if (abrir.programacaoId) setTela({ modo: 'visualizar', programacaoId: abrir.programacaoId });
    }
    navigate('/pedidos/programacao-producao', { replace: true, state: null });
  }, [location.state, navigate, canEdit]);

  const voltarLista = useCallback(() => {
    setTela('lista');
    setListaVersao((v) => v + 1);
  }, []);

  const processarProgramacaoApi = useCallback(async (id: string) => {
    await processarProgramacaoProducao(id);
    setListaVersao((v) => v + 1);
  }, []);

  const processarProgramacao = useCallback(
    async (id: string) => {
      setAcaoEmAndamento(id);
      setErro(null);
      try {
        const msgBloqueio = await mensagemBloqueioInconsistenciaQtdePendente();
        if (msgBloqueio) {
          setErro(msgBloqueio);
          return;
        }
        const saved = await getProgramacaoProducao(id);
        const parsed = parseDadosProgramacao(saved.dados);
        if (!parsed) throw new Error('Dados da programação inválidos.');
        const inc = linhasComInconsistenciaSeqQtde(parsed.linhas);
        if (inc.length > 0) {
          setConfirmProcessarLista({ id, linhas: inc });
          return;
        }
        await processarProgramacaoApi(id);
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao processar.');
      } finally {
        setAcaoEmAndamento(null);
      }
    },
    [processarProgramacaoApi]
  );

  const concluirProgramacao = useCallback(async (id: string) => {
    setAcaoEmAndamento(id);
    setErro(null);
    try {
      const saved = await getProgramacaoProducao(id);
      const parsed = parseDadosProgramacao(saved.dados);
      if (!parsed) throw new Error('Dados da programação inválidos.');
      const errVal = validarConclusaoPerfiladeiraOps(parsed.linhas);
      if (errVal) {
        setErro(errVal);
        return;
      }
      await concluirProgramacaoProducao(id);
      setListaVersao((v) => v + 1);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao concluir.');
    } finally {
      setAcaoEmAndamento(null);
    }
  }, []);

  const gerarPdfProgramacao = useCallback(
    async (item: ProgramacaoProducaoListItem, tipoImpressao: TipoImpressaoProgramacaoProducao) => {
      setAcaoEmAndamento(item.id);
      setErroModalPdf(null);
      setErro(null);
      try {
        const saved = await getProgramacaoProducao(item.id);
        const parsed = parseDadosProgramacao(saved.dados);
        const linhasPdf = ordenarLinhasParaPdf(parsed?.linhas ?? []);
        if (!linhasPdf.length) {
          throw new Error('Não há linhas com sequência definida para gerar o PDF.');
        }
        const logoBase64 = await imageUrlToDataUrl('/logo-soaco.png');
        await downloadProgramacaoProducaoPdf({
          codigoProgramacao: saved.name || item.name,
          dataCriacao: item.createdAt,
          responsavel: responsavelLabel(item),
          linhas: linhasPdf,
          tipoImpressao,
          logoBase64,
        });
        setModalPdf(null);
        setErroModalPdf(null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erro ao gerar PDF.';
        setErroModalPdf(msg);
      } finally {
        setAcaoEmAndamento(null);
      }
    },
    [],
  );

  const abrirNovo = () => setTela({ modo: 'editar' });
  const abrirEditar = (programacaoId: string) => setTela({ modo: 'editar', programacaoId });
  const abrirVisualizar = (programacaoId: string) => setTela({ modo: 'visualizar', programacaoId });

  const aoClicarProgramacao = (item: ProgramacaoProducaoListItem) => {
    if (item.status === 'concluido') {
      abrirVisualizar(item.id);
      return;
    }
    if (canEdit && (item.status === 'em_processamento' || item.status === 'processado')) {
      abrirEditar(item.id);
      return;
    }
    abrirVisualizar(item.id);
  };

  const confirmarExclusao = async () => {
    if (!confirmExcluir) return;
    setExcluindo(true);
    setErroExclusao(null);
    try {
      await deleteProgramacaoProducao(confirmExcluir.id);
      setConfirmExcluir(null);
      if (tela !== 'lista') voltarLista();
      else setListaVersao((v) => v + 1);
    } catch (e) {
      setErroExclusao(e instanceof Error ? e.message : 'Erro ao excluir programação.');
    } finally {
      setExcluindo(false);
    }
  };

  if (!canView) {
    return <Navigate to="/sem-acesso" replace />;
  }

  if (tela !== 'lista') {
    const programacaoId = tela.programacaoId;
    const itemLista = programacaoId ? lista.find((x) => x.id === programacaoId) : undefined;
    const readOnly =
      tela.modo === 'visualizar' ||
      !canEdit ||
      itemLista?.status === 'concluido';
    return (
      <>
        <ProgramacaoProducaoEditor
          key={`${tela.modo}-${programacaoId ?? 'novo'}`}
          programacaoId={programacaoId}
          readOnly={readOnly}
          statusInicial={itemLista?.status}
          onSair={voltarLista}
          onSaved={() => setListaVersao((v) => v + 1)}
        />
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
              aria-labelledby="pp-excluir-title-editor"
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                id="pp-excluir-title-editor"
                className="text-base font-semibold text-slate-800 dark:text-slate-100"
              >
                Excluir programação de produção?
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                A programação{' '}
                <span className="font-medium text-slate-800 dark:text-slate-200">{confirmExcluir.name}</span>{' '}
                será removida permanentemente.
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
      </>
    );
  }

  return (
    <div className="relative flex flex-col flex-1 min-h-0 p-3 max-w-[1920px] mx-auto w-full">
      <div className="mb-2 flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between shrink-0">
        <div className="min-w-0">
          <p className="text-xs font-medium text-primary-600 dark:text-primary-400 uppercase tracking-wide leading-none mb-0.5">
            PCP
          </p>
          <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100 leading-tight">
            Programação de produção
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Registros de programações de produção.
          </p>
        </div>
        {canEdit && (
          <button type="button" onClick={abrirNovo} className={BTN_PRIMARY}>
            Nova programação
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
              Nenhuma programação de produção salva ainda.
            </p>
            {canEdit && (
              <button type="button" onClick={abrirNovo} className={`${BTN_PRIMARY} mt-4`}>
                Criar a primeira programação
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/50">
                  <th className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200">Código</th>
                  <th className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200">Data de criação</th>
                  <th className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200">Responsável</th>
                  <th className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200">Última alteração</th>
                  <th className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 text-center">Linhas</th>
                  <th className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200">Status</th>
                  <th className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200">Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((item) => (
                  <tr
                    key={item.id}
                    tabIndex={0}
                    className="border-b border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
                    title={
                      canEdit
                        ? 'Clique para abrir esta programação'
                        : 'Clique para visualizar esta programação'
                    }
                    onClick={() => aoClicarProgramacao(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        aoClicarProgramacao(item);
                      }
                    }}
                  >
                    <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-100">{item.name}</td>
                    <td className="py-2 px-3 whitespace-nowrap text-slate-800 dark:text-slate-200">
                      {formatDateTime(item.createdAt)}
                    </td>
                    <td className="py-2 px-3 text-slate-800 dark:text-slate-200">{responsavelLabel(item)}</td>
                    <td className="py-2 px-3 whitespace-nowrap text-slate-800 dark:text-slate-200">
                      {formatDateTime(item.updatedAt)}
                    </td>
                    <td className="py-2 px-3 text-center text-slate-800 dark:text-slate-200 tabular-nums">
                      {item.linhaCount}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <ProgramacaoProducaoStatusBadge status={item.status ?? 'em_processamento'} />
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-1">
                        {canEdit && item.status === 'em_processamento' && (
                          <button
                            type="button"
                            disabled={acaoEmAndamento !== null}
                            onClick={(e) => {
                              e.stopPropagation();
                              void processarProgramacao(item.id);
                            }}
                            className="px-2 py-1 rounded-lg border border-blue-400 bg-blue-600 text-white font-medium text-xs hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-600"
                            title="Marcar como processada"
                          >
                            {acaoEmAndamento === item.id ? '…' : 'Processar'}
                          </button>
                        )}
                        {canEdit && item.status === 'processado' && (
                          <button
                            type="button"
                            disabled={acaoEmAndamento !== null}
                            onClick={(e) => {
                              e.stopPropagation();
                              void concluirProgramacao(item.id);
                            }}
                            className="px-2 py-1 rounded-lg border border-emerald-500 bg-emerald-600 text-white font-medium text-xs hover:bg-emerald-700 disabled:opacity-50"
                            title="Concluir programação (somente leitura)"
                          >
                            {acaoEmAndamento === item.id ? '…' : 'Concluir'}
                          </button>
                        )}
                        {item.status === 'concluido' && (
                          <button
                            type="button"
                            disabled={acaoEmAndamento !== null}
                            onClick={(e) => {
                              e.stopPropagation();
                              setErroModalPdf(null);
                              setModalPdf(item);
                            }}
                            className="px-2 py-1 rounded-lg border border-slate-400 bg-white text-slate-800 font-medium text-xs hover:bg-slate-50 disabled:opacity-50 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                            title="Gerar PDF da programação"
                          >
                            {acaoEmAndamento === item.id ? '…' : 'PDF'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalPdf && (
        <ModalPdfProgramacaoProducao
          codigoProgramacao={modalPdf.name}
          gerando={acaoEmAndamento === modalPdf.id}
          erro={erroModalPdf}
          onClose={() => {
            if (acaoEmAndamento !== null) return;
            setModalPdf(null);
            setErroModalPdf(null);
          }}
          onConfirm={(tipo) => void gerarPdfProgramacao(modalPdf, tipo)}
        />
      )}

      {confirmProcessarLista && (
        <ConfirmProcessarInconsistenteModal
          linhas={confirmProcessarLista.linhas}
          processando={acaoEmAndamento === confirmProcessarLista.id}
          onVoltar={() => setConfirmProcessarLista(null)}
          onProcessarMesmoAssim={() => {
            const id = confirmProcessarLista.id;
            setConfirmProcessarLista(null);
            setAcaoEmAndamento(id);
            void processarProgramacaoApi(id)
              .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao processar.'))
              .finally(() => setAcaoEmAndamento(null));
          }}
        />
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
            aria-labelledby="pp-excluir-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="pp-excluir-title" className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Excluir programação de produção?
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              A programação{' '}
              <span className="font-medium text-slate-800 dark:text-slate-200">{confirmExcluir.name}</span> será
              removida permanentemente. Esta ação não pode ser desfeita.
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

/** Redireciona rotas legadas para a lista (uma única aba), preservando id e modo. */
export function ProgramacaoProducaoLegacyRedirect() {
  const { id } = useParams();
  const { pathname } = useLocation();
  const modo: 'editar' | 'visualizar' = pathname.includes('/visualizar') ? 'visualizar' : 'editar';
  const state: ProgramacaoAbrirState | undefined =
    id || pathname.includes('/novo')
      ? { programacaoAbrir: { modo, programacaoId: id } }
      : undefined;
  return <Navigate to="/pedidos/programacao-producao" replace state={state} />;
}
