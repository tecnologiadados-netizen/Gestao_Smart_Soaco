import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { z } from 'zod';
import { ajustarDataProducaoLote, listarPedidos, type DataProducaoLoteItem, type Pedido } from '../api/pedidos';
import { dataProducaoRealPedido } from '../utils/dataProducaoGerenciador';
import { listarMotivosSugestao, type MotivoSugestao } from '../api/motivosSugestao';
import CampoLabelComAjuda, { AJUDA_CAMPO_OBSERVACAO } from './CampoLabelComAjuda';
import SequenciamentoDateField from './sequenciamento-carradas/SequenciamentoDateField';
import { montarItensDataProducaoCalendario, rotaPayloadAjusteDoCalendario } from './sequenciamento-carradas/ajustePrevisaoCalendario';
import {
  isCarradaRota,
  isExcludedSqlRotaCategory,
  normalizePdLabelForCompare,
  normalizeRotaNameStr,
  rotaFromPedidoRow,
} from '../utils/rotaCarrada';
import { validarDatasReprogramacao } from '../utils/canalReprogramacaoDatas';
import { formatDataCurta } from './sequenciamento-carradas/simulacaoCarradas';
import { lerPdfAssinatura, type AnexoAssinaturaPayload } from '../utils/lerPdfAssinatura';
import CampoAnexoAssinaturaPdf from './CampoAnexoAssinaturaPdf';
import TogglePrevisaoConfiavel, { type PrevisaoConfiavelTri } from './TogglePrevisaoConfiavel';
import CopiarTextoBtn, { numeroPedidoLimpo } from './CopiarTextoBtn';
import { useModalFlutuante } from '../hooks/useModalFlutuante';

const ajusteSchema = z.object({
  previsao_nova: z.string().min(1, 'Informe a data'),
  motivo: z.string().min(1, 'Motivo é obrigatório').max(500),
  observacao: z.string().max(1000).optional(),
});

/**
 * Data de produção atual do formulário: no calendário vem do contexto da coluna; no Gerenciador,
 * do valor real gravado no pedido (vazio quando a grade só exibe a previsão como fallback).
 */
function resolverDataProducaoInicial(
  pedido: Pedido | null,
  calendario?: AjustePrevisaoContextoCalendario
): string {
  if (calendario) return calendario.dataProducaoAtual?.slice(0, 10) ?? '';
  return pedido ? dataProducaoRealPedido(pedido) : '';
}

function validarDatasCompletas(
  previsaoIso: string,
  producaoIso: string,
  /** true quando o usuário está gravando uma nova produção (não a já existente). */
  producaoEhAlteracao: boolean
): string | null {
  return validarDatasReprogramacao({
    previsaoIso: previsaoIso || null,
    producaoIso: producaoIso || null,
    exigirNaoAnteriorHoje: true,
    exigirProducaoNaoAnteriorHoje: producaoEhAlteracao,
  });
}

/** Após salvar com replicação na mesma carrada, lista do Gerenciador para essa rota (atualiza todas as linhas visíveis de uma vez). */
export type AjustePrevisaoSuccessMeta = {
  atualizadosMesmaCarrada?: Pedido[];
  /** Itens adicionais do mesmo PD ajustados no fluxo do calendário. */
  todosItensPdAtualizados?: Pedido[];
};

/** Contexto extra ao abrir o modal pelo Calendário de produção. */
export type AjustePrevisaoContextoCalendario = {
  dataProducaoAtual: string;
  /**
   * Legado: quando true, alterar só a “produção” também dispara fluxo de previsão.
   * No calendário em rascunho abre sempre false — produção e previsão são independentes no Map sim.
   */
  producaoDerivadaPrevisao: boolean;
  /** Replica alterações de previsão aos demais itens do mesmo PD. */
  escopoTodosItensPd?: boolean;
  demaisItensPd?: Pedido[];
};

export type AjustePrevisaoSimulacaoMeta = {
  motivo: string;
  observacao?: string;
  previsao_confiavel: boolean;
};

interface ModalAjustePrevisaoProps {
  pedido: Pedido | null;
  onClose: () => void;
  onSuccess: (atualizado: Pedido, meta?: AjustePrevisaoSuccessMeta) => void;
  onError: (msg: string) => void;
  calendario?: AjustePrevisaoContextoCalendario;
  /**
   * Itens adicionais a receber o mesmo ajuste (Reprogramar no Gerenciador).
   * No calendário, preferir `calendario.demaisItensPd` + `escopoTodosItensPd`.
   */
  demaisItens?: Pedido[];
  /**
   * Atualiza a data de produção na simulação do sequenciamento (UI do calendário).
   * Com `persistirNoGerenciador` (default), o modal também grava via `data-producao-lote`.
   */
  onSalvarDataProducao?: (novaData: string) => void;
  /**
   * Atualiza a previsão/entrega só na simulação (rascunho do sequenciamento).
   * Usado quando `persistirNoGerenciador={false}`.
   */
  onSalvarPrevisaoSimulacao?: (novaData: string, meta: AjustePrevisaoSimulacaoMeta) => void;
  /**
   * Default true (Gerenciador / Comunicação PD). False no calendário em rascunho:
   * só atualiza a simulação; Gerenciador só na conclusão do sequenciamento.
   */
  persistirNoGerenciador?: boolean;
  /** Volta à etapa anterior (ex.: escolha de escopo no calendário). */
  onVoltar?: () => void;
  /**
   * `flutuanteCalendario`: centralizado, arrastável e redimensionável (calendário visível atrás).
   * Default `modal`: centralizado com fundo escurecido.
   */
  varianteLayout?: 'modal' | 'flutuanteCalendario';
}

type FlowStep = 'form' | 'multiplas_rotas' | 'carrada_confirm';

/** Decisão acumulada ao longo dos steps do fluxo. */
type PendingDecision = {
  data: {
    previsao_nova: string;
    motivo: string;
    observacao?: string;
    previsao_confiavel: boolean;
    anexo_assinatura?: AnexoAssinaturaPayload | null;
  };
  /** Override por rota (padrão: Observacoes da linha). null só quando a linha não tem rota. */
  rotaOverride: string | null;
  /** Usuário escolheu explicitamente aplicar em todas as rotas em que o item aparece. */
  forcarBase?: boolean;
  /** Outras rotas em que o mesmo (PD, item) aparece, além da rota atual. */
  outrasRotasDoItem: string[];
  /** Se a rota atual é "ROTA …" com 2+ PDs distintos (precisa perguntar replicate_carrada). */
  precisaConfirmarCarrada: boolean;
  /** Resultado da pergunta "replicate_carrada" (preenchido após o step). */
  replicateCarrada: boolean | null;
};

export default function ModalAjustePrevisao({
  pedido,
  onClose,
  onSuccess,
  onError,
  calendario,
  demaisItens,
  onSalvarDataProducao,
  onSalvarPrevisaoSimulacao,
  persistirNoGerenciador = true,
  onVoltar,
  varianteLayout = 'modal',
}: ModalAjustePrevisaoProps) {
  const isFlutuante = varianteLayout === 'flutuanteCalendario';
  const flutuante = useModalFlutuante({
    enabled: isFlutuante,
    open: !!pedido,
    defaultSize: { w: 512, h: 640 },
    minSize: { w: 360, h: 400 },
    resetKey: String(pedido?.id_pedido ?? ''),
  });
  const [previsao_nova, setPrevisaoNova] = useState(() => {
    if (calendario) return '';
    if (!pedido?.previsao_entrega_atualizada) return '';
    return String(pedido.previsao_entrega_atualizada).slice(0, 10);
  });
  const [data_producao_nova, setDataProducaoNova] = useState(() =>
    calendario ? '' : resolverDataProducaoInicial(pedido, calendario)
  );
  const [motivo, setMotivo] = useState('');
  const [observacao, setObservacao] = useState('');
  const [previsaoConfiavel, setPrevisaoConfiavel] = useState<PrevisaoConfiavelTri>(null);
  const [anexoAssinatura, setAnexoAssinatura] = useState<AnexoAssinaturaPayload | null>(null);
  const [anexoNome, setAnexoNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    previsao_nova?: string;
    data_producao_nova?: string;
    motivo?: string;
    previsao_confiavel?: string;
  }>({});
  const [sugestoes, setSugestoes] = useState<MotivoSugestao[]>([]);
  const [loadingSugestoes, setLoadingSugestoes] = useState(false);
  const [flowStep, setFlowStep] = useState<FlowStep>('form');
  const [carradaRotaNome, setCarradaRotaNome] = useState('');
  const [carradaCheckLoading, setCarradaCheckLoading] = useState(false);
  const [feedbackSucesso, setFeedbackSucesso] = useState(false);
  const pendingRef = useRef<PendingDecision | null>(null);
  const pendingProducaoRef = useRef<string | null>(null);
  const sucessoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const carregarSugestoes = () => {
    setLoadingSugestoes(true);
    listarMotivosSugestao()
      .then(setSugestoes)
      .catch(() => {})
      .finally(() => setLoadingSugestoes(false));
  };

  useEffect(() => {
    carregarSugestoes();
  }, []);

  useEffect(() => {
    return () => {
      if (sucessoTimerRef.current) clearTimeout(sucessoTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!pedido) return;
    setFlowStep('form');
    setCarradaRotaNome('');
    pendingRef.current = null;
    pendingProducaoRef.current = null;
    setFeedbackSucesso(false);
    if (sucessoTimerRef.current) {
      clearTimeout(sucessoTimerRef.current);
      sucessoTimerRef.current = null;
    }
    if (calendario) {
      setPrevisaoNova('');
      setDataProducaoNova('');
    } else {
      setPrevisaoNova(
        pedido.previsao_entrega_atualizada ? String(pedido.previsao_entrega_atualizada).slice(0, 10) : ''
      );
      setDataProducaoNova(resolverDataProducaoInicial(pedido, calendario));
    }
    setMotivo('');
    setObservacao('');
    setPrevisaoConfiavel(null);
    setAnexoAssinatura(null);
    setAnexoNome('');
    setErrors({});
  }, [pedido?.id_pedido, calendario?.dataProducaoAtual, !!calendario]);

  if (!pedido) return null;

  const pd = (pedido as Record<string, unknown>)['PD'] ?? pedido.id_pedido;
  const cod = (pedido as Record<string, unknown>)['Cod'] ?? pedido.produto ?? '—';

  const previsaoAtualStr = pedido?.previsao_entrega_atualizada
    ? String(pedido.previsao_entrega_atualizada).slice(0, 10)
    : '';

  const producaoAtualStr = resolverDataProducaoInicial(pedido, calendario);

  const previsaoNovaForm = previsao_nova.trim().slice(0, 10);
  const producaoNovaForm = data_producao_nova.trim().slice(0, 10);
  /**
   * No calendário, campo “nova” preenchido = intenção de gravar aquela data (inclui confirmar a
   * atual copiando o mesmo valor). Vazio = não alterar aquele campo.
   */
  const producaoMudouForm = calendario
    ? !!producaoNovaForm
    : producaoNovaForm !== producaoAtualStr;
  /** Previsão só “muda de verdade” quando a nova data difere da atual (motivo/confiável). */
  const previsaoDataAlteradaForm = calendario
    ? !!previsaoNovaForm && previsaoNovaForm !== previsaoAtualStr
    : !previsaoAtualStr || previsaoNovaForm !== previsaoAtualStr;
  /**
   * Motivo e observação: só quando a data de previsão realmente muda (atual ≠ nova).
   * Confirmar a mesma previsão ou só alterar Confiável no rascunho não exige motivo.
   */
  const previsaoSeraAjustada =
    previsaoDataAlteradaForm ||
    (!!calendario && calendario.producaoDerivadaPrevisao && producaoMudouForm);
  const camposPrevisaoAtivos = previsaoSeraAjustada;

  const motivoSelecionado = sugestoes.find((s) => s.descricao === motivo);
  const exigeAnexo = previsaoSeraAjustada && motivoSelecionado?.abonada === false;
  const mostrarCampoAnexo = previsaoSeraAjustada && persistirNoGerenciador && Boolean(motivo.trim());

  /** Evita deixar motivo/observação preenchidos e desabilitados quando a previsão volta ao valor atual. */
  const limparCamposAjustePrevisaoSeInativos = (previsaoIso: string, producaoIso: string) => {
    const previsaoDataMudou = calendario
      ? !!previsaoIso && previsaoIso !== previsaoAtualStr
      : !previsaoAtualStr || previsaoIso !== previsaoAtualStr;
    const producaoMuda = calendario
      ? !!producaoIso
      : producaoIso !== producaoAtualStr;
    if (previsaoDataMudou || (!!calendario && calendario.producaoDerivadaPrevisao && producaoMuda)) {
      return;
    }
    setMotivo('');
    setObservacao('');
    setAnexoAssinatura(null);
    setAnexoNome('');
    setErrors((prev) => {
      if (!prev.motivo && !prev.previsao_confiavel) return prev;
      const next = { ...prev };
      delete next.motivo;
      return next;
    });
  };

  const limparAnexoAssinatura = () => {
    setAnexoAssinatura(null);
    setAnexoNome('');
  };

  /** Copia a data atual para o campo “nova” correspondente; a gravação fica no Salvar. */
  const replicarDataAtualParaNova = (campo: 'producao' | 'previsao') => {
    if (!calendario) return;
    if (campo === 'producao') {
      if (!producaoAtualStr) return;
      setDataProducaoNova(producaoAtualStr);
      const previsaoForm = previsao_nova.trim().slice(0, 10);
      const deveElevar = !!previsaoForm && previsaoForm < producaoAtualStr;
      const previsaoAjustada = deveElevar ? producaoAtualStr : previsaoForm;
      if (previsaoAjustada !== previsaoForm) setPrevisaoNova(previsaoAjustada);
      limparCamposAjustePrevisaoSeInativos(previsaoAjustada, producaoAtualStr);
      setErrors((prev) => {
        if (!prev.data_producao_nova) return prev;
        const next = { ...prev };
        delete next.data_producao_nova;
        return next;
      });
      return;
    }
    if (!previsaoAtualStr) return;
    setPrevisaoNova(previsaoAtualStr);
    limparCamposAjustePrevisaoSeInativos(previsaoAtualStr, data_producao_nova.trim().slice(0, 10));
    setErrors((prev) => {
      if (!prev.previsao_nova && !prev.previsao_confiavel) return prev;
      const next = { ...prev };
      delete next.previsao_nova;
      return next;
    });
  };

  const onChangeMotivo = (valor: string) => {
    setMotivo(valor);
  };

  const onChangeAnexoPdf = async (file: File | null) => {
    if (!file) {
      limparAnexoAssinatura();
      return;
    }
    try {
      const payload = await lerPdfAssinatura(file);
      setAnexoAssinatura(payload);
      setAnexoNome(payload.fileName);
      setErrors((prev) => {
        if (!prev.motivo) return prev;
        const next = { ...prev };
        delete next.motivo;
        return next;
      });
    } catch (err) {
      limparAnexoAssinatura();
      const msg = err instanceof Error ? err.message : 'Não foi possível ler o PDF.';
      setErrors((prev) => ({ ...prev, motivo: msg }));
      onError(msg);
    }
  };

  const fecharOuVoltar = () => {
    if (feedbackSucesso) return;
    if (onVoltar) onVoltar();
    else onClose();
  };

  const demaisItensCalendario = (): Pedido[] => {
    if (calendario?.escopoTodosItensPd) return calendario.demaisItensPd ?? [];
    return demaisItens ?? [];
  };

  /** Exibe "Gravado com sucesso" e só então fecha / volta ao modal anterior. */
  const concluirComSucesso = (atualizado: Pedido, meta?: AjustePrevisaoSuccessMeta) => {
    setFeedbackSucesso(true);
    setLoading(false);
    if (sucessoTimerRef.current) clearTimeout(sucessoTimerRef.current);
    sucessoTimerRef.current = setTimeout(() => {
      sucessoTimerRef.current = null;
      onSuccess(atualizado, meta);
      onClose();
    }, 1100);
  };

  /**
   * Persiste a data de produção no Gerenciador como override da rota da linha (mesma hierarquia da
   * grade) e atualiza a simulação do calendário quando houver.
   * `rotasTodasDoItem` preenchido: grava também o base e um override por rota do item.
   * Com `persistirNoGerenciador={false}` só atualiza a simulação.
   */
  const persistirDataProducao = async (novaData: string, rotasTodasDoItem: string[] = []) => {
    if (!persistirNoGerenciador) {
      onSalvarDataProducao?.(novaData);
      return;
    }
    const itens = montarItensDataProducaoCalendario(pedido, novaData, demaisItensCalendario());
    if (itens.length === 0) {
      throw new Error('Não foi possível montar o lote de data de produção (pedido sem id).');
    }
    if (rotasTodasDoItem.length > 0) {
      const extras: DataProducaoLoteItem[] = [{ id_pedido: pedido.id_pedido, data_producao: novaData }];
      for (const rota of rotasTodasDoItem) {
        extras.push({ id_pedido: pedido.id_pedido, data_producao: novaData, rota });
      }
      itens.push(...extras);
    }
    const r = await ajustarDataProducaoLote(itens);
    if (r.erros?.length) {
      throw new Error(r.erros[0]?.erro ?? 'Erro ao gravar data de produção no Gerenciador.');
    }
    onSalvarDataProducao?.(novaData);
  };

  /** Aplica produção/previsão só no Map sim (rascunho) e fecha o modal. */
  const salvarSomenteSimulacao = (opts: {
    producao?: string;
    previsao?: string;
    motivo?: string;
    observacao?: string;
    previsao_confiavel?: boolean;
  }) => {
    if (opts.producao) onSalvarDataProducao?.(opts.producao);
    const temConfiavel = opts.previsao_confiavel === true || opts.previsao_confiavel === false;
    if (opts.previsao || temConfiavel) {
      // Sem mudança de previsão, ainda propaga Confiável/motivo para o rascunho.
      onSalvarPrevisaoSimulacao?.(opts.previsao ?? previsaoAtualStr ?? opts.producao ?? '', {
        motivo: opts.motivo ?? '',
        observacao: opts.observacao,
        previsao_confiavel: temConfiavel ? opts.previsao_confiavel! : opts.previsao_confiavel !== false,
      });
    }
    concluirComSucesso({
      ...pedido,
      ...(opts.producao ? { data_producao: opts.producao } : {}),
      ...(opts.previsao ? { previsao_entrega_atualizada: opts.previsao } : {}),
      ...(temConfiavel ? { previsao_atual_confiavel: opts.previsao_confiavel } : {}),
    } as Pedido);
  };

  const aplicarDataProducaoPendente = async (decision: PendingDecision) => {
    const nova = pendingProducaoRef.current;
    if (!nova) return;
    pendingProducaoRef.current = null;
    await persistirDataProducao(nova, decision.forcarBase === true ? decision.outrasRotasDoItem : []);
  };

  /** Executa a gravação respeitando a decisão acumulada. */
  const runSave = async (decision: PendingDecision) => {
    if (!pedido) return;
    setLoading(true);
    try {
      const replicateCarrada = decision.replicateCarrada === true;
      const rotaPayloadPrincipal = rotaPayloadAjusteDoCalendario(pedido, decision.rotaOverride, {
        modoCalendario: !!calendario,
        forcarBase: decision.forcarBase === true,
      });
      const { ajustarPrevisao } = await import('../api/pedidos');
      let atualizado = await ajustarPrevisao(pedido.id_pedido, {
        previsao_nova: decision.data.previsao_nova,
        motivo: decision.data.motivo,
        observacao: decision.data.observacao || null,
        replicate_carrada: replicateCarrada ? true : undefined,
        rota: rotaPayloadPrincipal,
        todas_rotas: decision.forcarBase === true ? true : undefined,
        previsao_confiavel: decision.data.previsao_confiavel,
        anexo_assinatura: decision.data.anexo_assinatura ?? undefined,
      });
      let meta: AjustePrevisaoSuccessMeta | undefined;
      if (replicateCarrada) {
        const rotaAtual = rotaFromPedidoRow(pedido as Record<string, unknown>).trim();
        if (rotaAtual) {
          try {
            const res = await listarPedidos({ observacoes: rotaAtual, limit: 500, page: 1 });
            meta = { atualizadosMesmaCarrada: Array.isArray(res.data) ? res.data : [] };
          } catch {
            // Ajuste já persistiu; sem a lista a grade só atualiza a linha do item escolhido até o próximo carregamento.
          }
        }
      }
      const producaoPendente = pendingProducaoRef.current;
      await aplicarDataProducaoPendente(decision);
      if (producaoPendente) {
        atualizado = { ...atualizado, data_producao: producaoPendente } as Pedido;
      }
      const demaisItens = demaisItensCalendario();
      const outrosAtualizados: Pedido[] = [];
      if (demaisItens.length > 0) {
        for (const item of demaisItens) {
          const rotaItem = rotaFromPedidoRow(item as Record<string, unknown>).trim();
          const rotaPayload =
            rotaPayloadPrincipal != null
              ? rotaPayloadAjusteDoCalendario(item, rotaItem || rotaPayloadPrincipal, {
                  modoCalendario: true,
                  forcarBase: decision.forcarBase === true,
                })
              : undefined;
          let upd = await ajustarPrevisao(item.id_pedido, {
            previsao_nova: decision.data.previsao_nova,
            motivo: decision.data.motivo,
            observacao: decision.data.observacao || null,
            rota: rotaPayload,
            previsao_confiavel: decision.data.previsao_confiavel,
            anexo_assinatura: decision.data.anexo_assinatura ?? undefined,
          });
          if (producaoPendente) {
            upd = { ...upd, data_producao: producaoPendente } as Pedido;
          }
          outrosAtualizados.push(upd);
        }
      }
      const metaFinal: AjustePrevisaoSuccessMeta = {
        ...meta,
        todosItensPdAtualizados:
          outrosAtualizados.length > 0 ? [atualizado, ...outrosAtualizados] : meta?.todosItensPdAtualizados,
      };
      concluirComSucesso(atualizado, metaFinal);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao ajustar previsão.');
      setLoading(false);
    }
  };

  /** Avança a máquina de estados para o próximo step pendente (ou grava se já não há mais). */
  const advanceFlow = async (decision: PendingDecision) => {
    if (decision.outrasRotasDoItem.length > 0 && decision.rotaOverride === null && !pendingRef.current?.rotaOverride) {
      // Step 1 ainda não foi resolvido (rotaOverride é "indefinida" inicialmente; usamos null como base).
      // Como `rotaOverride` é base por default, precisamos uma forma de detectar "ainda não decidiu".
      // Solução: o caller já decidiu antes de chamar, então este branch nunca é atingido a partir daqui.
    }
    if (decision.precisaConfirmarCarrada && decision.replicateCarrada === null) {
      pendingRef.current = decision;
      setFlowStep('carrada_confirm');
      return;
    }
    pendingRef.current = null;
    await runSave(decision);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (flowStep !== 'form') return;

    const previsaoNovaNorm = previsao_nova.trim().slice(0, 10);
    const producaoNovaNorm = data_producao_nova.trim().slice(0, 10);
    /** Produção: no calendário, campo preenchido = aplicar (mesmo valor = confirmar atual). */
    const producaoMudou = calendario
      ? !!producaoNovaNorm
      : producaoNovaNorm !== producaoAtualStr;
    /** Previsão: só conta alteração real de data (atual ≠ nova). */
    const previsaoMudou = calendario
      ? !!previsaoNovaNorm && previsaoNovaNorm !== previsaoAtualStr
      : !previsaoAtualStr || previsaoNovaNorm !== previsaoAtualStr;

    /** Grava só a data de produção e fecha (nenhum ajuste de previsão envolvido). */
    const salvarSomenteProducao = async (rotasTodasDoItem: string[] = []) => {
      if (!producaoNovaNorm) {
        setErrors({ data_producao_nova: 'Informe a data' });
        onError('Informe a nova data de produção.');
        return;
      }
      if (!persistirNoGerenciador) {
        if (previsaoConfiavel === true || previsaoConfiavel === false) {
          // Confirmar produção + Confiável, sem mudança de previsão → sem motivo.
          salvarSomenteSimulacao({
            producao: producaoNovaNorm,
            previsao_confiavel: previsaoConfiavel,
          });
          return;
        }
        salvarSomenteSimulacao({ producao: producaoNovaNorm });
        return;
      }
      setLoading(true);
      try {
        await persistirDataProducao(producaoNovaNorm, rotasTodasDoItem);
        concluirComSucesso({
          ...pedido,
          data_producao: producaoNovaNorm,
        } as Pedido);
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Erro ao gravar data de produção.');
        setLoading(false);
      }
    };

    if (calendario) {
      const soConfiavelRascunho =
        !persistirNoGerenciador &&
        !producaoMudou &&
        !previsaoMudou &&
        (previsaoConfiavel === true || previsaoConfiavel === false);

      if (!producaoMudou && !previsaoMudou && !soConfiavelRascunho) {
        onError('Nenhuma data foi alterada.');
        return;
      }

      if (soConfiavelRascunho) {
        // Só Confiável (previsão atual = nova) → sem motivo.
        salvarSomenteSimulacao({
          previsao_confiavel: previsaoConfiavel,
        });
        return;
      }

      const producaoRef = producaoNovaNorm || producaoAtualStr;
      const previsaoRef =
        calendario.producaoDerivadaPrevisao && producaoMudou && !previsaoMudou
          ? producaoNovaNorm
          : previsaoNovaNorm;
      const ordemErro = validarDatasCompletas(
        previsaoMudou || (calendario.producaoDerivadaPrevisao && producaoMudou) ? previsaoRef : '',
        producaoMudou ? producaoNovaNorm : previsaoMudou ? producaoRef : '',
        producaoMudou
      );
      if (ordemErro) {
        setErrors({ previsao_nova: ordemErro, data_producao_nova: ordemErro });
        onError(ordemErro);
        return;
      }

      // Somente produção (ou previsão só elevada para acompanhar produção):
      // grava no Gerenciador na hora (override por Observacoes) + atualiza o sim.
      const previsaoApenasClamp =
        previsaoMudou &&
        !!producaoNovaNorm &&
        previsaoNovaNorm === producaoNovaNorm &&
        (!!previsaoAtualStr ? previsaoAtualStr < producaoNovaNorm : true);

      if (
        producaoMudou &&
        !calendario.producaoDerivadaPrevisao &&
        (!previsaoMudou || previsaoApenasClamp)
      ) {
        await salvarSomenteProducao();
        return;
      }
    } else {
      if (!previsaoMudou && !producaoMudou) {
        setErrors({ previsao_nova: 'A data não foi alterada.' });
        onError('Nenhuma data foi alterada. Informe uma nova previsão ou uma nova data de produção para salvar.');
        return;
      }

      const ordemErro = validarDatasCompletas(
        previsaoMudou ? previsaoNovaNorm : '',
        producaoMudou ? producaoNovaNorm : producaoNovaNorm || producaoAtualStr,
        producaoMudou
      );
      if (ordemErro) {
        setErrors({ previsao_nova: ordemErro, data_producao_nova: ordemErro });
        onError(ordemErro);
        return;
      }

      // Só a data de produção mudou: motivo, confiabilidade e observação não se aplicam.
      if (!previsaoMudou) {
        await salvarSomenteProducao();
        return;
      }
    }

    const precisaAjustePrevisao =
      previsaoMudou || (!!calendario && calendario.producaoDerivadaPrevisao && producaoMudou);

    const previsaoEfetiva =
      calendario?.producaoDerivadaPrevisao && producaoMudou && !previsaoMudou
        ? producaoNovaNorm
        : previsaoNovaNorm;

    if (!precisaAjustePrevisao) {
      if (producaoMudou && producaoNovaNorm) {
        await salvarSomenteProducao();
      }
      return;
    }

    if (previsaoAtualStr && previsaoEfetiva === previsaoAtualStr) {
      setErrors({ previsao_nova: 'A data não foi alterada.' });
      onError('A data não foi alterada. Informe uma data diferente da previsão atual para salvar.');
      return;
    }

    const parsed = ajusteSchema.safeParse({ previsao_nova: previsaoEfetiva, motivo, observacao });
    if (!parsed.success || previsaoConfiavel === null) {
      const fieldErrors: Record<string, string> = {};
      if (!parsed.success) {
        const flat = parsed.error.flatten().fieldErrors;
        if (flat?.previsao_nova?.[0]) fieldErrors.previsao_nova = flat.previsao_nova[0];
        if (flat?.motivo?.[0]) fieldErrors.motivo = flat.motivo[0];
      }
      if (previsaoConfiavel === null) {
        fieldErrors.previsao_confiavel = 'Escolha Sim ou Não em Previsão confiável.';
        onError('Escolha Sim ou Não em Previsão confiável.');
      }
      setErrors(fieldErrors);
      return;
    }
    const dataComConfiavel = {
      ...parsed.data,
      previsao_confiavel: previsaoConfiavel,
      anexo_assinatura: anexoAssinatura,
    };
    setErrors({});

    // Simulação (calendário rascunho): não exige PDF.
    // Produção e previsão são independentes: se o usuário informou produção, grava no sim
    // mesmo quando o item estava só com fallback Prev. (senão o calendário não reposiciona).
    if (!persistirNoGerenciador) {
      const producaoSim = producaoMudou && producaoNovaNorm ? producaoNovaNorm : undefined;
      salvarSomenteSimulacao({
        producao: producaoSim,
        previsao: previsaoEfetiva,
        motivo: dataComConfiavel.motivo,
        observacao: dataComConfiavel.observacao,
        previsao_confiavel: dataComConfiavel.previsao_confiavel,
      });
      return;
    }

    if (precisaAjustePrevisao && persistirNoGerenciador && exigeAnexo && !anexoAssinatura) {
      const msg = 'Anexe o PDF assinado da justificativa não abonada.';
      setErrors({ motivo: msg });
      onError(msg);
      return;
    }

    if (producaoMudou && producaoNovaNorm) {
      pendingProducaoRef.current = producaoNovaNorm;
    } else {
      pendingProducaoRef.current = null;
    }

    const rotaAtual = rotaFromPedidoRow(pedido as Record<string, unknown>);
    const rotaAtualNorm = normalizeRotaNameStr(rotaAtual);
    const pdAtual = normalizePdLabelForCompare(String((pedido as Record<string, unknown>)['PD'] ?? '').trim());
    const codAtual = String((pedido as Record<string, unknown>)['Cod'] ?? pedido.produto ?? '').trim();

    setCarradaCheckLoading(true);
    let outrasRotasDoItem: string[] = [];
    let precisaConfirmarCarrada = false;

    try {
      // Verificação 1: (PD, item) em 2+ rotas distintas?
      if (pdAtual && codAtual) {
        try {
          const resPd = await listarPedidos({ pd: pdAtual, limit: 500, page: 1 });
          if (resPd.erroConexao) {
            onError(`Não foi possível consultar o Gerenciador de Pedidos: ${resPd.erroConexao}`);
            return;
          }
          const rows = resPd.data ?? [];
          const rotasUnicas = new Map<string, string>(); // normalizada -> original
          for (const r of rows) {
            const rRec = r as Record<string, unknown>;
            const pdR = normalizePdLabelForCompare(String(rRec['PD'] ?? '').trim());
            const codR = String(rRec['Cod'] ?? '').trim();
            if (pdR !== pdAtual || codR !== codAtual) continue;
            const rotaR = rotaFromPedidoRow(rRec).trim();
            if (!rotaR) continue;
            // Considera só rotas "carrada" não excluídas (mesma regra do backend).
            if (!isCarradaRota(rotaR) || isExcludedSqlRotaCategory(rotaR)) continue;
            const norm = normalizeRotaNameStr(rotaR);
            if (!rotasUnicas.has(norm)) rotasUnicas.set(norm, rotaR);
          }
          for (const [norm, original] of rotasUnicas) {
            if (norm !== rotaAtualNorm) outrasRotasDoItem.push(original);
          }
        } catch {
          // se falhar essa consulta, segue o fluxo legado (sem step de múltiplas rotas)
          outrasRotasDoItem = [];
        }
      }

      // Verificação 2: rota atual é "ROTA …" com 2+ PDs distintos?
      if (isCarradaRota(rotaAtual) && !isExcludedSqlRotaCategory(rotaAtual)) {
        try {
          const resRota = await listarPedidos({ observacoes: rotaAtual.trim(), limit: 500, page: 1 });
          if (!resRota.erroConexao) {
            const rows = resRota.data ?? [];
            const pds = new Set(
              rows
                .map((r) => normalizePdLabelForCompare(String((r as Record<string, unknown>)['PD'] ?? '').trim()))
                .filter(Boolean)
            );
            precisaConfirmarCarrada = pds.size > 1;
          }
        } catch {
          precisaConfirmarCarrada = false;
        }
      }
    } finally {
      setCarradaCheckLoading(false);
    }

    const decision: PendingDecision = {
      data: dataComConfiavel,
      // Override na Observacoes da linha: a grade resolve override da rota antes do ajuste base,
      // então gravar base deixaria a nova data invisível sempre que a linha já tivesse override.
      rotaOverride: rotaAtual.trim() ? rotaAtual.trim() : null,
      forcarBase: false,
      outrasRotasDoItem,
      precisaConfirmarCarrada,
      replicateCarrada: precisaConfirmarCarrada ? null : false,
    };

    if (outrasRotasDoItem.length > 0) {
      pendingRef.current = decision;
      setCarradaRotaNome(rotaAtual);
      setFlowStep('multiplas_rotas');
      return;
    }
    if (precisaConfirmarCarrada) {
      pendingRef.current = decision;
      setCarradaRotaNome(rotaAtual);
      setFlowStep('carrada_confirm');
      return;
    }
    await runSave(decision);
  };

  // ---------- step "multiplas_rotas" ----------
  const handleMultiplasRotasTodas = async () => {
    const pending = pendingRef.current;
    if (!pending) return;
    const decision: PendingDecision = { ...pending, rotaOverride: null, forcarBase: true };
    setFlowStep('form');
    await advanceFlow(decision);
  };

  const handleMultiplasRotasSomenteEsta = async () => {
    const pending = pendingRef.current;
    if (!pending) return;
    const rotaAtual = rotaFromPedidoRow(pedido as Record<string, unknown>).trim();
    const decision: PendingDecision = {
      ...pending,
      rotaOverride: rotaAtual || null,
      forcarBase: false,
    };
    setFlowStep('form');
    await advanceFlow(decision);
  };

  // ---------- step "carrada_confirm" ----------
  const handleCarradaConfirmSim = async () => {
    const pending = pendingRef.current;
    if (!pending) return;
    const decision: PendingDecision = { ...pending, replicateCarrada: true };
    setFlowStep('form');
    pendingRef.current = null;
    await runSave(decision);
  };

  const handleCarradaConfirmNao = async () => {
    const pending = pendingRef.current;
    if (!pending) return;
    const decision: PendingDecision = { ...pending, replicateCarrada: false };
    setFlowStep('form');
    pendingRef.current = null;
    await runSave(decision);
  };

  return createPortal(
    <div
      className={
        isFlutuante
          ? 'pointer-events-none fixed inset-0 z-[14150]'
          : 'fixed inset-0 z-[145] flex items-center justify-center bg-black/75 p-4'
      }
      onClick={isFlutuante || feedbackSucesso ? undefined : fecharOuVoltar}
    >
      <div
        className={
          isFlutuante
            ? `pointer-events-auto relative flex flex-col overflow-auto rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-600 dark:bg-slate-800 ${
                flutuante.dragging ? 'select-none' : ''
              }`
            : `relative w-full rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-600 dark:bg-slate-800 ${
                calendario ? 'max-w-lg' : 'max-w-md'
              }`
        }
        style={flutuante.panelStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {feedbackSucesso ? (
          <div className="flex flex-col items-center justify-center py-8 text-center" role="status">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Gravado com sucesso</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Retornando…</p>
          </div>
        ) : (
          <>
        <h3
          className={`mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100 ${
            isFlutuante
              ? `cursor-grab touch-none ${flutuante.dragging ? 'cursor-grabbing' : ''}`
              : ''
          }`}
          title={isFlutuante ? 'Arraste para mover o modal' : undefined}
          onPointerDown={isFlutuante ? flutuante.onDragPointerDown : undefined}
          onPointerMove={isFlutuante ? flutuante.onDragPointerMove : undefined}
          onPointerUp={isFlutuante ? flutuante.onDragPointerEnd : undefined}
          onPointerCancel={isFlutuante ? flutuante.onDragPointerEnd : undefined}
        >
          {calendario ? 'Reprogramar datas do pedido' : 'Ajustar previsão de entrega'}
        </h3>
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1 mb-4">
          <p className="inline-flex items-center gap-1">
            <span className="font-medium text-slate-700 dark:text-slate-300">Pedido</span> {String(pd)}
            <CopiarTextoBtn texto={numeroPedidoLimpo(String(pd))} title="Copiar número do pedido" />
          </p>
          <p>
            <span className="font-medium text-slate-700 dark:text-slate-300">Produto</span>{' '}
            {calendario?.escopoTodosItensPd || (demaisItens && demaisItens.length > 0)
              ? `TODOS (${1 + (calendario?.escopoTodosItensPd ? calendario.demaisItensPd?.length ?? 0 : demaisItens?.length ?? 0)} itens)`
              : (
                <span className="inline-flex items-center gap-1">
                  {String(cod)}
                  <CopiarTextoBtn texto={String(cod)} title="Copiar código do produto" />
                </span>
              )}
          </p>
          <p><span className="font-medium text-slate-700 dark:text-slate-300">Cliente</span> {pedido.cliente}</p>
        </div>
        <form onSubmit={handleSubmit}>
          {calendario ? (
            <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Data de produção atual
                </label>
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm tabular-nums text-slate-800 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-100">
                  {producaoAtualStr ? formatDataCurta(producaoAtualStr) : '—'}
                </p>
                {producaoAtualStr ? (
                  <button
                    type="button"
                    onClick={() => replicarDataAtualParaNova('producao')}
                    className="mt-1.5 text-xs font-medium text-primary-700 hover:underline dark:text-primary-300"
                  >
                    Confirmar esta data
                  </button>
                ) : null}
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Nova data de produção
                </label>
                <SequenciamentoDateField
                  fullWidth
                  value={data_producao_nova}
                  onChange={(nova) => {
                    setDataProducaoNova(nova);
                    const previsaoForm = previsao_nova.trim().slice(0, 10);
                    const deveElevar = !!nova && !!previsaoForm && previsaoForm < nova;
                    const previsaoAjustada = deveElevar ? nova : previsaoForm;
                    if (previsaoAjustada !== previsaoForm) setPrevisaoNova(previsaoAjustada);
                    limparCamposAjustePrevisaoSeInativos(previsaoAjustada, nova);
                  }}
                  className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-700"
                />
                {errors.data_producao_nova && (
                  <p className="text-amber-400 text-xs mt-1">{errors.data_producao_nova}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Previsão atual
                </label>
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm tabular-nums text-slate-800 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-100">
                  {previsaoAtualStr ? formatDataCurta(previsaoAtualStr) : '—'}
                </p>
                {previsaoAtualStr ? (
                  <button
                    type="button"
                    onClick={() => replicarDataAtualParaNova('previsao')}
                    className="mt-1.5 text-xs font-medium text-primary-700 hover:underline dark:text-primary-300"
                  >
                    Confirmar esta data
                  </button>
                ) : null}
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Nova data de previsão
                </label>
                <SequenciamentoDateField
                  fullWidth
                  value={previsao_nova}
                  onChange={(nova) => {
                    setPrevisaoNova(nova);
                    limparCamposAjustePrevisaoSeInativos(nova, data_producao_nova.trim().slice(0, 10));
                  }}
                  className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-700"
                />
                {errors.previsao_nova && (
                  <p className="text-amber-400 text-xs mt-1">{errors.previsao_nova}</p>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Nova data de produção</label>
                <SequenciamentoDateField
                  fullWidth
                  value={data_producao_nova}
                  onChange={(nova) => {
                    setDataProducaoNova(nova);
                    const previsaoForm = previsao_nova.trim().slice(0, 10);
                    const previsaoAjustada =
                      nova && (!previsaoForm || previsaoForm < nova) ? nova : previsaoForm;
                    if (previsaoAjustada !== previsaoForm) setPrevisaoNova(previsaoAjustada);
                    limparCamposAjustePrevisaoSeInativos(previsaoAjustada, nova);
                  }}
                  className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-700"
                />
                {errors.data_producao_nova && (
                  <p className="text-amber-400 text-xs mt-1">{errors.data_producao_nova}</p>
                )}
              </div>
              <div className="mb-4">
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Nova data de previsão</label>
                <SequenciamentoDateField
                  fullWidth
                  value={previsao_nova}
                  onChange={(nova) => {
                    setPrevisaoNova(nova);
                    limparCamposAjustePrevisaoSeInativos(nova, data_producao_nova.trim().slice(0, 10));
                  }}
                  className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-700"
                />
                {errors.previsao_nova && (
                  <p className="text-amber-400 text-xs mt-1">{errors.previsao_nova}</p>
                )}
              </div>
            </>
          )}
          <div className="mb-4">
            <div className="mb-1">
              <label className="block text-xs text-slate-400">Motivo</label>
            </div>
            <select
              value={motivo}
              onChange={(e) => onChangeMotivo(e.target.value)}
              className="w-full rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 px-3 py-2 focus:ring-2 focus:ring-primary-600 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              required={previsaoSeraAjustada}
              disabled={!camposPrevisaoAtivos}
            >
              <option value="">Selecione um motivo</option>
              {sugestoes.map((s) => (
                <option key={s.id} value={s.descricao}>
                  {s.descricao}
                </option>
              ))}
            </select>
            {errors.motivo && <p className="text-amber-400 text-xs mt-1">{errors.motivo}</p>}
            {loadingSugestoes && (
              <p className="text-slate-500 text-xs mt-1">Carregando motivos...</p>
            )}
            {!camposPrevisaoAtivos && (
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                Motivo e observação só valem quando a nova previsão difere da atual. “Confirmar esta
                data” só copia para o campo nova; use Salvar para gravar.
              </p>
            )}
            {mostrarCampoAnexo && (
              <CampoAnexoAssinaturaPdf
                className="mt-3"
                anexoNome={anexoNome}
                obrigatorio={exigeAnexo}
                onFileChange={(file) => void onChangeAnexoPdf(file)}
                ajuda={
                  exigeAnexo
                    ? `Justificativa não abonada: baixe o modelo, assine e anexe o PDF${anexoNome ? ` — ${anexoNome}` : ''}.`
                    : `Opcional: anexe o PDF assinado para auditoria no histórico${anexoNome ? ` — ${anexoNome}` : ''}.`
                }
              />
            )}
          </div>
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Previsão confiável
            </label>
            <TogglePrevisaoConfiavel
              value={previsaoConfiavel}
              onChange={setPrevisaoConfiavel}
              showHelp={false}
            />
            {errors.previsao_confiavel && (
              <p className="text-amber-400 text-xs mt-1">{errors.previsao_confiavel}</p>
            )}
          </div>
          <div className="mb-4">
            <CampoLabelComAjuda label="Observação" ajuda={AJUDA_CAMPO_OBSERVACAO} className="text-xs text-slate-500 dark:text-slate-400" />
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              placeholder="Opcional"
              disabled={!camposPrevisaoAtivos}
              className="w-full rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 px-3 py-2 focus:ring-2 focus:ring-primary-600 focus:border-transparent resize-none placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={fecharOuVoltar}
              className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-800 dark:text-slate-100 text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={
                loading ||
                carradaCheckLoading ||
                (previsaoSeraAjustada && previsaoConfiavel === null)
              }
              className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium"
            >
              {carradaCheckLoading ? 'Verificando rota...' : loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>

        {flowStep === 'multiplas_rotas' && pendingRef.current && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-black/70 p-4">
            <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-4 shadow-xl">
              <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Item presente em várias rotas</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                Este item (PD <strong>{String(pd)}</strong> · Cód <strong>{String(cod)}</strong>) aparece em outras carradas além de <strong>{carradaRotaNome || 'esta rota'}</strong>:
              </p>
              <ul className="mb-3 max-h-32 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 space-y-1">
                {pendingRef.current.outrasRotasDoItem.map((r) => (
                  <li key={r}>• {r}</li>
                ))}
              </ul>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Onde aplicar a nova previsão?
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => void handleMultiplasRotasSomenteEsta()}
                  disabled={loading}
                  className="w-full px-4 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium text-left"
                >
                  <span className="block font-semibold">Apenas nesta rota</span>
                  <span className="block text-xs text-primary-100 font-normal mt-0.5">
                    {carradaRotaNome || 'rota atual'} — as outras mantêm a previsão atual
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleMultiplasRotasTodas()}
                  disabled={loading}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 text-left"
                >
                  <span className="block font-semibold">Em todas as rotas em que este item aparece</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                    A data fica igual em todas as carradas (comportamento anterior).
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    pendingRef.current = null;
                    setFlowStep('form');
                  }}
                  disabled={loading}
                  className="w-full px-4 py-2 rounded-lg text-slate-500 dark:text-slate-400 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {flowStep === 'carrada_confirm' && pendingRef.current && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-black/70 p-4">
            <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-4 shadow-xl">
              <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Replicação na mesma carrada</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                A rota <strong>{carradaRotaNome}</strong> possui outros pedidos. Quando você informar a nova data deste item, essa mesma data {pendingRef.current.rotaOverride ? 'pode ser replicada como override desta mesma rota para os outros pedidos' : 'pode ser replicada para todos os pedidos desta ROTA'} (mesmo motivo e observação). Deseja continuar?
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => void handleCarradaConfirmNao()}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium"
                >
                  Não
                </button>
                <button
                  type="button"
                  onClick={() => void handleCarradaConfirmSim()}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium"
                >
                  Sim
                </button>
              </div>
            </div>
          </div>
        )}
          </>
        )}
        {isFlutuante ? (
          <button
            type="button"
            aria-label="Redimensionar modal"
            title="Arraste para redimensionar"
            data-no-drag
            className="absolute bottom-0 right-0 z-20 h-5 w-5 cursor-se-resize touch-none rounded-br-xl border-l border-t border-slate-300/80 bg-slate-200/90 hover:bg-slate-300 dark:border-slate-500 dark:bg-slate-600/90 dark:hover:bg-slate-500"
            onPointerDown={flutuante.onResizePointerDown}
            onPointerMove={flutuante.onResizePointerMove}
            onPointerUp={flutuante.onResizePointerEnd}
            onPointerCancel={flutuante.onResizePointerEnd}
          >
            <span className="sr-only">Redimensionar</span>
            <svg
              className="pointer-events-none absolute bottom-0.5 right-0.5 h-3 w-3 text-slate-500 dark:text-slate-300"
              viewBox="0 0 12 12"
              aria-hidden
            >
              <path fill="currentColor" d="M12 12H8V10h2V8h2v4zM10 8H8V6h2V4h2v4zM6 6H4V4h2V2h2v4z" />
            </svg>
          </button>
        ) : null}
      </div>

    </div>,
    document.body
  );
}
