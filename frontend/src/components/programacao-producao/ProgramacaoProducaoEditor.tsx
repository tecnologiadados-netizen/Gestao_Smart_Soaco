import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {

  createProgramacaoProducao,

  fetchBobinasProgramacaoPorCodigos,

  fetchProgramacaoProducaoGrade,

  getProgramacaoProducao,

  updateProgramacaoProducao,

  processarProgramacaoProducao,

  concluirProgramacaoProducao,

} from '../../api/programacaoProducao';
import { mensagemBloqueioInconsistenciaQtdePendente } from '../../api/inconsistenciaQtdePendente';

import {

  mesclarDescricoesBobinas,

  syncBobinaAlternativaDisplay,

} from '../../utils/programacaoProducaoBobinaAlternativa';

import {

  hydrateEstoqueMpAlternativaLinha,

  hydrateEstoqueMpAlternativaLinhas,

  estoqueMpAlternativaHydrateKey,

} from '../../utils/programacaoProducaoEstoqueMpAlternativa';

import CarregandoInformacoesOverlay from '../CarregandoInformacoesOverlay';
import ResizableModalShell from '../ResizableModalShell';

import ProgramacaoProducaoGrade from './ProgramacaoProducaoGrade';
import ProgramacaoProducaoStatusBadge from './ProgramacaoProducaoStatusBadge';
import ConfirmProcessarInconsistenteModal from './ConfirmProcessarInconsistenteModal';
import {
  linhasComInconsistenciaSeqQtde,
  validarConclusaoPerfiladeiraOps,
} from '../../utils/programacaoProducaoValidacoes';

import {

  ProgramacaoProducaoModalHost,

  type ModalGradeTipo,

} from './ProgramacaoProducaoModals';

import type {
  DadosProgramacaoProducaoV1,
  LinhaProgramacaoProducao,
  ProgramacaoProducaoStatus,
} from './types';

import {

  dadosFromGradeRows,

  parseDadosProgramacao,

  validarDadosParaSave,

} from './programacaoProducaoLinhaUtils';



interface Props {

  programacaoId?: string;

  readOnly?: boolean;

  /** Status da lista (evita flash antes do GET); o editor confirma via API. */
  statusInicial?: ProgramacaoProducaoStatus;

  onSair: () => void;

  onSaved?: () => void;

}



const BTN_SECONDARY =

  'px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium text-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600';



const BTN_PRIMARY =

  'px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm transition';



const DADOS_VAZIOS: DadosProgramacaoProducaoV1 = {

  versao: 1,

  geradoEm: new Date().toISOString(),

  linhas: [],

};



function patchSomenteOpsNomus(patch: Partial<LinhaProgramacaoProducao>): boolean {
  const keys = Object.keys(patch) as (keyof LinhaProgramacaoProducao)[];
  return (
    keys.length > 0 &&
    keys.every((k) => k === 'ordens_producao_nomus' || k === 'ordem_producao_nomus')
  );
}

export default function ProgramacaoProducaoEditor({

  programacaoId,

  readOnly = false,

  statusInicial,

  onSair,

  onSaved,

}: Props) {

  const canEdit = !readOnly;



  const [uid, setUid] = useState<string | undefined>(programacaoId);

  /** Código da programação (campo `name` no backend, gerado automaticamente). */

  const [codigo, setCodigo] = useState('');

  const [registroStatus, setRegistroStatus] = useState<ProgramacaoProducaoStatus>(
    statusInicial ?? 'em_processamento'
  );

  useEffect(() => {
    if (statusInicial) setRegistroStatus(statusInicial);
  }, [statusInicial]);

  const [dados, setDados] = useState<DadosProgramacaoProducaoV1>(DADOS_VAZIOS);

  const [dirty, setDirty] = useState(false);

  const [loading, setLoading] = useState(true);

  const [loadingGrade, setLoadingGrade] = useState(false);

  const [saving, setSaving] = useState(false);

  const [statusMsg, setStatusMsg] = useState('');

  const [confirmSairAberto, setConfirmSairAberto] = useState(false);
  const [confirmSalvarAberto, setConfirmSalvarAberto] = useState(false);
  const [erroSalvarModal, setErroSalvarModal] = useState<string | null>(null);
  const [confirmProcessarInconsistente, setConfirmProcessarInconsistente] = useState<
    LinhaProgramacaoProducao[] | null
  >(null);
  const [modal, setModal] = useState<ModalGradeTipo | null>(null);

  const bobinasHydrateKeyRef = useRef('');

  const estoqueAltHydrateKeyRef = useRef('');



  const markDirty = useCallback(() => setDirty(true), []);



  /** Preenche descrição/id das bobinas vindas do catálogo via Nomus (sem marcar dirty). */
  useEffect(() => {
    if (loading) return;

    const cods = new Set<string>();
    for (const l of dados.linhas) {
      for (const b of l.bobinas_alternativas ?? []) {
        if (b.cod?.trim() && (!b.descricao?.trim() || b.idProduto == null)) {
          cods.add(b.cod.trim());
        }
      }
    }

    const key = [...cods].sort().join('|');
    if (!key || bobinasHydrateKeyRef.current === key) return;

    let cancelled = false;

    void fetchBobinasProgramacaoPorCodigos([...cods]).then(({ data, erro }) => {
      if (cancelled) return;
      if (!data.length) {
        if (!erro) bobinasHydrateKeyRef.current = key;
        return;
      }

      const porCod = new Map(
        data.map((d) => [d.codigo.trim(), { descricao: d.descricao, idProduto: d.id }] as const)
      );

      setDados((prev) => {
        let changed = false;
        const linhas = prev.linhas.map((l) => {
          if (!l.bobinas_alternativas?.length) return l;
          const merged = mesclarDescricoesBobinas(l.bobinas_alternativas, porCod);
          const next = syncBobinaAlternativaDisplay({ ...l, bobinas_alternativas: merged });
          const same =
            next.cod_bobina_alternativa === l.cod_bobina_alternativa &&
            next.descricao_bobina_alternativa === l.descricao_bobina_alternativa &&
            JSON.stringify(next.bobinas_alternativas) === JSON.stringify(l.bobinas_alternativas);
          if (!same) changed = true;
          return same ? l : next;
        });
        return changed ? { ...prev, linhas } : prev;
      });

      bobinasHydrateKeyRef.current = key;
    });

    return () => {
      cancelled = true;
    };
  }, [loading, dados.linhas]);

  /** Soma estoque MP alternativa (setores 19/20, todas as alters únicas). */
  useEffect(() => {
    if (loading) return;

    const key = dados.linhas
      .map((l) => `${l.idComponente}:${estoqueMpAlternativaHydrateKey(l)}`)
      .join('|');

    if (!key || estoqueAltHydrateKeyRef.current === key) return;

    const linhasSnapshot = dados.linhas;
    let cancelled = false;

    void hydrateEstoqueMpAlternativaLinhas(linhasSnapshot).then((hydrated) => {
      if (cancelled) return;

      const porId = new Map(hydrated.map((l) => [l.idComponente, l]));

      setDados((prev) => {
        let changed = false;
        const linhas = prev.linhas.map((l) => {
          const h = porId.get(l.idComponente);
          if (!h) return l;
          if (
            l.estoque_mp_alternativa === h.estoque_mp_alternativa &&
            l.estoque_mp_alternativa_erro === h.estoque_mp_alternativa_erro &&
            JSON.stringify(l.estoque_mp_alternativa_detalhe) ===
              JSON.stringify(h.estoque_mp_alternativa_detalhe)
          ) {
            return l;
          }
          changed = true;
          return {
            ...l,
            estoque_mp_alternativa: h.estoque_mp_alternativa,
            estoque_mp_alternativa_erro: h.estoque_mp_alternativa_erro,
            estoque_mp_alternativa_detalhe: h.estoque_mp_alternativa_detalhe,
          };
        });
        return changed ? { ...prev, linhas } : prev;
      });

      estoqueAltHydrateKeyRef.current = key;
    });

    return () => {
      cancelled = true;
    };
  }, [loading, dados.linhas]);



  const carregarGradeNomus = useCallback(async (): Promise<DadosProgramacaoProducaoV1 | null> => {

    setLoadingGrade(true);

    setStatusMsg('');

    try {

      const { data, erro } = await fetchProgramacaoProducaoGrade();

      if (erro && !data.length) {

        setStatusMsg(erro);

        return null;

      }

      if (erro) setStatusMsg(erro);

      return dadosFromGradeRows(data);

    } catch (e) {

      setStatusMsg(e instanceof Error ? e.message : 'Erro ao carregar grade do ERP.');

      return null;

    } finally {

      setLoadingGrade(false);

    }

  }, []);



  useEffect(() => {

    let cancelled = false;



    async function init() {

      setLoading(true);

      setStatusMsg('');



      if (!programacaoId) {

        const grade = await carregarGradeNomus();

        if (!cancelled && grade) {

          setDados(grade);

          setCodigo('');

          setDirty(false);

        }

        if (!cancelled) setLoading(false);

        return;

      }



      try {

        const saved = await getProgramacaoProducao(programacaoId);

        if (cancelled) return;

        setUid(saved.id);

        setCodigo(saved.name);

        setRegistroStatus(saved.status ?? 'em_processamento');

        const parsed = parseDadosProgramacao(saved.dados);

        if (parsed?.linhas.length) {

          setDados(parsed);

        }

        setDirty(false);

      } catch (e) {

        if (!cancelled) {

          setStatusMsg(e instanceof Error ? e.message : 'Erro ao carregar.');

        }

      } finally {

        if (!cancelled) setLoading(false);

      }

    }



    void init();

    return () => {

      cancelled = true;

    };

  }, [programacaoId, carregarGradeNomus]);



  const editarCamposGerais = canEdit && registroStatus === 'em_processamento';
  const exibirColunaOpNomus =
    registroStatus === 'processado' || registroStatus === 'concluido';
  /** Em processado: único campo editável; lista de OPs vem do Nomus (não do snapshot). */
  const editarOpNomus = canEdit && registroStatus === 'processado';
  const gradeModalReadOnly = readOnly || registroStatus !== 'em_processamento';
  const visualizarModais = registroStatus === 'concluido';

  const handleSave = useCallback(async (opts?: { erroNoModal?: boolean }): Promise<string | null> => {

    if (!canEdit || readOnly) return null;
    if (registroStatus !== 'em_processamento' && registroStatus !== 'processado') return null;

    const errVal = validarDadosParaSave(dados, {
      somenteOpsNomus: registroStatus === 'processado',
    });

    if (errVal) {
      if (opts?.erroNoModal) setErroSalvarModal(errVal);
      else setStatusMsg(errVal);
      return null;
    }

    if (!uid) {
      const msgBloqueio = await mensagemBloqueioInconsistenciaQtdePendente();
      if (msgBloqueio) {
        if (opts?.erroNoModal) setErroSalvarModal(msgBloqueio);
        else setStatusMsg(msgBloqueio);
        return null;
      }
    }

    setSaving(true);

    setStatusMsg('');

    const payload = {

      ...(uid && codigo.trim() ? { name: codigo.trim() } : {}),

      dados,

    };

    try {

      let savedId: string;

      if (uid) {

        const saved = await updateProgramacaoProducao(uid, payload);

        savedId = saved.id;

        setUid(saved.id);

        setCodigo(saved.name);

        setRegistroStatus(saved.status ?? registroStatus);

        const parsed = parseDadosProgramacao(saved.dados);

        if (parsed) setDados(parsed);

      } else {

        const saved = await createProgramacaoProducao(payload);

        savedId = saved.id;

        setUid(saved.id);

        setCodigo(saved.name);

        setRegistroStatus(saved.status ?? 'em_processamento');

        const parsed = parseDadosProgramacao(saved.dados);

        if (parsed) setDados(parsed);

      }

      setDirty(false);

      onSaved?.();

      return savedId;

    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao salvar.';
      if (opts?.erroNoModal) setErroSalvarModal(msg);
      else setStatusMsg(msg);
      return null;
    } finally {

      setSaving(false);

    }

  }, [canEdit, readOnly, registroStatus, dados, uid, codigo, onSaved]);

  const executarSalvarComAcao = useCallback(
    async (acao?: 'processar' | 'concluir', opts?: { erroNoModal?: boolean }) => {
      if (acao === 'processar') {
        const msgBloqueio = await mensagemBloqueioInconsistenciaQtdePendente();
        if (msgBloqueio) {
          if (opts?.erroNoModal) setErroSalvarModal(msgBloqueio);
          else setStatusMsg(msgBloqueio);
          return;
        }
      }
      const id = await handleSave(opts);
      if (!id) return;
      try {
        if (acao === 'processar') {
          await processarProgramacaoProducao(id);
          setRegistroStatus('processado');
        } else if (acao === 'concluir') {
          await concluirProgramacaoProducao(id);
          setRegistroStatus('concluido');
        }
        setConfirmSalvarAberto(false);
        setErroSalvarModal(null);
        onSaved?.();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erro ao atualizar status.';
        if (opts?.erroNoModal) setErroSalvarModal(msg);
        else setStatusMsg(msg);
      }
    },
    [handleSave, onSaved]
  );

  const abrirConfirmSalvar = useCallback(() => {
    if (!canEdit || readOnly) return;
    if (registroStatus !== 'em_processamento' && registroStatus !== 'processado') return;
    setErroSalvarModal(null);
    setConfirmSalvarAberto(true);
  }, [canEdit, readOnly, registroStatus]);

  const tentarSalvarEProcessar = useCallback(() => {
    setConfirmSalvarAberto(false);
    const inc = linhasComInconsistenciaSeqQtde(dados.linhas);
    if (inc.length > 0) {
      setConfirmProcessarInconsistente(inc);
      return;
    }
    void executarSalvarComAcao('processar');
  }, [dados.linhas, executarSalvarComAcao]);

  const tentarSalvarEConcluir = useCallback(() => {
    const err = validarConclusaoPerfiladeiraOps(dados.linhas);
    if (err) {
      setErroSalvarModal(err);
      return;
    }
    setErroSalvarModal(null);
    void executarSalvarComAcao('concluir', { erroNoModal: true });
  }, [dados.linhas, executarSalvarComAcao]);

  const alturaModalSalvar = useMemo(() => {
    const base = 172;
    if (!erroSalvarModal) return base;
    const extra = Math.min(120, Math.ceil(erroSalvarModal.length / 55) * 16);
    return base + extra + 36;
  }, [erroSalvarModal]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!canEdit) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        abrirConfirmSalvar();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canEdit, abrirConfirmSalvar]);



  const handleSairClick = () => {

    if (!canEdit) {

      onSair();

      return;

    }

    if (dirty) setConfirmSairAberto(true);

    else onSair();

  };



  const handleDadosChange = (next: DadosProgramacaoProducaoV1) => {

    setDados(next);

    markDirty();

  };



  const handleUpdateLinha = (idComponente: number, patch: Partial<LinhaProgramacaoProducao>) => {
    if (registroStatus === 'concluido') return;
    if (registroStatus === 'processado' && !patchSomenteOpsNomus(patch)) return;
    if (readOnly) return;

    const linhas = dados.linhas.map((l) =>

      l.idComponente === idComponente ? { ...l, ...patch } : l

    );

    handleDadosChange({ ...dados, linhas });

    if ('bobinas_alternativas' in patch) {

      estoqueAltHydrateKeyRef.current = '';

      const linha = linhas.find((l) => l.idComponente === idComponente);

      if (linha) {

        void hydrateEstoqueMpAlternativaLinha(linha).then((h) => {

          setDados((prev) => ({

            ...prev,

            linhas: prev.linhas.map((l) => (l.idComponente === idComponente ? h : l)),

          }));

        });

      }

    }

  };



  const overlayAtivo = loading || loadingGrade || saving;

  const overlayMsg = saving

    ? 'Salvando programação…'

    : loadingGrade

      ? 'Consultando Nomus (programação de produção)…'

      : loading

        ? 'Carregando programação gravada…'

        : 'Carregando informações...';



  const codigoLabel = codigo.trim() || 'Gerado ao salvar';



  return (

    <div className="relative flex flex-col flex-1 min-h-0 p-3 max-w-[1920px] mx-auto w-full">

      <CarregandoInformacoesOverlay show={overlayAtivo} mensagem={overlayMsg} mode="viewport" />



      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between shrink-0">

        <div className="flex flex-wrap items-center gap-2 min-w-0">

          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">

            Código

          </span>

          <span

            className="min-w-[10rem] rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm font-mono font-semibold text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"

            title="Código gerado automaticamente pelo sistema"

          >

            {codigoLabel}

            {!codigo.trim() && canEdit && (

              <span className="ml-1 text-xs font-normal text-slate-400">(novo)</span>

            )}

          </span>

          <ProgramacaoProducaoStatusBadge status={registroStatus} />

          {readOnly && (

            <span className="text-sm text-slate-500 dark:text-slate-400">(somente leitura)</span>

          )}

        </div>

        <div className="flex flex-wrap items-center gap-2">

          <button type="button" className={BTN_SECONDARY} onClick={handleSairClick}>

            Sair

          </button>

          {canEdit && (registroStatus === 'em_processamento' || registroStatus === 'processado') && (

            <button

              type="button"

              className={BTN_PRIMARY}

              disabled={saving}

              onClick={abrirConfirmSalvar}

            >

              Salvar

            </button>

          )}

        </div>

      </div>



      {statusMsg && !overlayAtivo && !confirmSalvarAberto && (

        <p className="mb-1 text-sm text-red-600 dark:text-red-300 shrink-0" role="alert">

          {statusMsg}

        </p>

      )}



      {!overlayAtivo && (

        <ProgramacaoProducaoGrade
          dados={dados}
          editarCamposGerais={editarCamposGerais}
          exibirColunaOpNomus={exibirColunaOpNomus}
          editarOpNomus={editarOpNomus}
          visualizarModais={visualizarModais}
          onChange={handleDadosChange}
          onOpenModal={setModal}
        />

      )}



      <ProgramacaoProducaoModalHost
        modal={modal}
        readOnly={gradeModalReadOnly}
        editarOpNomus={editarOpNomus}
        visualizarSomente={visualizarModais}
        linhaAtual={(id) => dados.linhas.find((l) => l.idComponente === id)}
        onClose={() => setModal(null)}
        onUpdateLinha={handleUpdateLinha}
      />



      {confirmSairAberto && (
        <ResizableModalShell
          onClose={() => setConfirmSairAberto(false)}
          defaultWidth={420}
          defaultHeight={220}
          zIndexClass="z-[110]"
          ariaLabelledBy="pp-confirm-sair-title"
        >
          <div className="p-5" onClick={(e) => e.stopPropagation()}>
            <h2
              id="pp-confirm-sair-title"
              className="text-base font-semibold text-slate-800 dark:text-slate-100"
            >
              Sair da programação?
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Deseja salvar as alterações antes de voltar à lista ou sair sem salvar?
            </p>

            <div className="mt-4 flex flex-wrap justify-end gap-2">

              <button type="button" onClick={() => setConfirmSairAberto(false)} className={BTN_SECONDARY}>

                Cancelar

              </button>

              <button

                type="button"

                onClick={() => {

                  setConfirmSairAberto(false);

                  onSair();

                }}

                className={BTN_SECONDARY}

              >

                Sair sem salvar

              </button>

              <button

                type="button"

                onClick={() => {

                  setConfirmSairAberto(false);

                  void handleSave().then((id) => {

                    if (id) onSair();

                  });

                }}

                disabled={saving}

                className={BTN_PRIMARY}

              >

                Salvar e sair

              </button>

            </div>

          </div>

        </ResizableModalShell>

      )}

      {confirmSalvarAberto && (
        <ResizableModalShell
          onClose={() => {
            setConfirmSalvarAberto(false);
            setErroSalvarModal(null);
          }}
          defaultWidth={460}
          defaultHeight={alturaModalSalvar}
          minHeight={160}
          maxHeight={420}
          zIndexClass="z-[110]"
          ariaLabelledBy="pp-confirm-salvar-title"
        >
          <div className="flex flex-col gap-3 p-4">
            <div>
              <h2
                id="pp-confirm-salvar-title"
                className="text-base font-semibold text-slate-800 dark:text-slate-100"
              >
                Salvar programação
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Como deseja prosseguir?
              </p>
            </div>
            {erroSalvarModal && (
              <p
                className="text-sm text-red-600 dark:text-red-300 rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900/50 dark:bg-red-950/40"
                role="alert"
              >
                {erroSalvarModal}
              </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className={BTN_SECONDARY}
                onClick={() => {
                  setConfirmSalvarAberto(false);
                  setErroSalvarModal(null);
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={BTN_SECONDARY}
                disabled={saving}
                onClick={() => {
                  setConfirmSalvarAberto(false);
                  void handleSave();
                }}
              >
                Apenas salvar
              </button>
              {registroStatus === 'em_processamento' ? (
                <button
                  type="button"
                  className={BTN_PRIMARY}
                  disabled={saving}
                  onClick={() => void tentarSalvarEProcessar()}
                >
                  Salvar e processar
                </button>
              ) : (
                <button
                  type="button"
                  className={`${BTN_PRIMARY} bg-emerald-600 hover:bg-emerald-700`}
                  disabled={saving}
                  onClick={() => void tentarSalvarEConcluir()}
                >
                  Salvar e concluir
                </button>
              )}
            </div>
          </div>
        </ResizableModalShell>
      )}

      {confirmProcessarInconsistente && confirmProcessarInconsistente.length > 0 && (
        <ConfirmProcessarInconsistenteModal
          linhas={confirmProcessarInconsistente}
          processando={saving}
          onVoltar={() => setConfirmProcessarInconsistente(null)}
          onProcessarMesmoAssim={() => {
            setConfirmProcessarInconsistente(null);
            void executarSalvarComAcao('processar');
          }}
        />
      )}

    </div>

  );

}


