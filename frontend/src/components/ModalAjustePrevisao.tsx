import { useState, useEffect, useRef } from 'react';
import { z } from 'zod';
import { listarPedidos, type Pedido } from '../api/pedidos';
import { listarMotivosSugestao, type MotivoSugestao } from '../api/motivosSugestao';
import ModalGerenciarMotivos from './ModalGerenciarMotivos';
import CampoLabelComAjuda, { AJUDA_CAMPO_OBSERVACAO } from './CampoLabelComAjuda';
import SequenciamentoDateField from './sequenciamento-carradas/SequenciamentoDateField';
import { useAuth } from '../contexts/AuthContext';
import { PERMISSOES } from '../config/permissoes';
import {
  isCarradaRota,
  isExcludedSqlRotaCategory,
  normalizePdLabelForCompare,
  normalizeRotaNameStr,
  rotaFromPedidoRow,
} from '../utils/rotaCarrada';

const ajusteSchema = z.object({
  previsao_nova: z.string().min(1, 'Informe a data'),
  motivo: z.string().min(1, 'Motivo é obrigatório').max(500),
  observacao: z.string().max(1000).optional(),
});

function validarPrevisaoNaoAnteriorProducao(previsaoIso: string, producaoIso: string): string | null {
  if (!previsaoIso || !producaoIso) return null;
  if (previsaoIso < producaoIso) {
    return 'A nova data de previsão não pode ser anterior à data de produção.';
  }
  return null;
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
  /** Retirada/requisição/etc.: a coluna do calendário usa a previsão de entrega. */
  producaoDerivadaPrevisao: boolean;
  /** Replica alterações de previsão aos demais itens do mesmo PD. */
  escopoTodosItensPd?: boolean;
  demaisItensPd?: Pedido[];
};

interface ModalAjustePrevisaoProps {
  pedido: Pedido | null;
  onClose: () => void;
  onSuccess: (atualizado: Pedido, meta?: AjustePrevisaoSuccessMeta) => void;
  onError: (msg: string) => void;
  calendario?: AjustePrevisaoContextoCalendario;
  /** Grava nova data de produção na simulação do sequenciamento (carradas normais). */
  onSalvarDataProducao?: (novaData: string) => void;
  /** Volta à etapa anterior (ex.: escolha de escopo no calendário). */
  onVoltar?: () => void;
}

type FlowStep = 'form' | 'multiplas_rotas' | 'carrada_confirm';

/** Decisão acumulada ao longo dos steps do fluxo. */
type PendingDecision = {
  data: { previsao_nova: string; motivo: string; observacao?: string; previsao_confiavel: boolean };
  /** Override por rota. null = ajuste base (vale em todas as rotas do PD/item). */
  rotaOverride: string | null;
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
  onSalvarDataProducao,
  onVoltar,
}: ModalAjustePrevisaoProps) {
  const [previsao_nova, setPrevisaoNova] = useState(() => {
    if (!pedido?.previsao_entrega_atualizada) return '';
    return String(pedido.previsao_entrega_atualizada).slice(0, 10);
  });
  const [data_producao_nova, setDataProducaoNova] = useState(() => calendario?.dataProducaoAtual?.slice(0, 10) ?? '');
  const [motivo, setMotivo] = useState('');
  const [observacao, setObservacao] = useState('');
  const [previsaoConfiavel, setPrevisaoConfiavel] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ previsao_nova?: string; data_producao_nova?: string; motivo?: string }>({});
  const [sugestoes, setSugestoes] = useState<MotivoSugestao[]>([]);
  const [loadingSugestoes, setLoadingSugestoes] = useState(false);
  const [abrirGerenciar, setAbrirGerenciar] = useState(false);
  const [flowStep, setFlowStep] = useState<FlowStep>('form');
  const [carradaRotaNome, setCarradaRotaNome] = useState('');
  const [carradaCheckLoading, setCarradaCheckLoading] = useState(false);
  const pendingRef = useRef<PendingDecision | null>(null);
  const pendingProducaoRef = useRef<string | null>(null);
  const { hasPermission } = useAuth();
  const podeGerenciarMotivos =
    hasPermission(PERMISSOES.PCP_MOTIVO_CRIAR) ||
    hasPermission(PERMISSOES.PCP_MOTIVO_EDITAR) ||
    hasPermission(PERMISSOES.PCP_MOTIVO_EXCLUIR) ||
    hasPermission(PERMISSOES.PCP_TOTAL);

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
    if (!pedido) return;
    setFlowStep('form');
    setCarradaRotaNome('');
    pendingRef.current = null;
    pendingProducaoRef.current = null;
    setPrevisaoNova(
      pedido.previsao_entrega_atualizada ? String(pedido.previsao_entrega_atualizada).slice(0, 10) : ''
    );
    setDataProducaoNova(calendario?.dataProducaoAtual?.slice(0, 10) ?? '');
    setMotivo('');
    setObservacao('');
    setPrevisaoConfiavel(true);
    setErrors({});
  }, [pedido?.id_pedido, calendario?.dataProducaoAtual]);

  if (!pedido) return null;

  const pd = (pedido as Record<string, unknown>)['PD'] ?? pedido.id_pedido;
  const cod = (pedido as Record<string, unknown>)['Cod'] ?? pedido.produto ?? '—';

  const previsaoAtualStr = pedido?.previsao_entrega_atualizada
    ? String(pedido.previsao_entrega_atualizada).slice(0, 10)
    : '';

  const producaoAtualStr = calendario?.dataProducaoAtual?.slice(0, 10) ?? '';

  const previsaoNovaForm = previsao_nova.trim().slice(0, 10);
  const producaoNovaForm = data_producao_nova.trim().slice(0, 10);
  const previsaoMudouForm = !previsaoAtualStr || previsaoNovaForm !== previsaoAtualStr;
  const producaoMudouForm = !!calendario && producaoNovaForm !== producaoAtualStr;
  const motivoObrigatorio =
    !calendario || previsaoMudouForm || (calendario.producaoDerivadaPrevisao && producaoMudouForm);

  const aplicarDataProducaoPendente = () => {
    const nova = pendingProducaoRef.current;
    if (nova) {
      onSalvarDataProducao?.(nova);
      pendingProducaoRef.current = null;
    }
  };

  /** Executa a gravação respeitando a decisão acumulada. */
  const runSave = async (decision: PendingDecision) => {
    if (!pedido) return;
    setLoading(true);
    try {
      const replicateCarrada = decision.replicateCarrada === true;
      const { ajustarPrevisao } = await import('../api/pedidos');
      const atualizado = await ajustarPrevisao(pedido.id_pedido, {
        previsao_nova: decision.data.previsao_nova,
        motivo: decision.data.motivo,
        observacao: decision.data.observacao || null,
        replicate_carrada: replicateCarrada ? true : undefined,
        rota: decision.rotaOverride ?? undefined,
        previsao_confiavel: decision.data.previsao_confiavel,
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
      aplicarDataProducaoPendente();
      const demaisItens = calendario?.escopoTodosItensPd ? calendario.demaisItensPd ?? [] : [];
      const outrosAtualizados: Pedido[] = [];
      if (demaisItens.length > 0) {
        for (const item of demaisItens) {
          const rotaItem = rotaFromPedidoRow(item as Record<string, unknown>).trim();
          const rotaPayload =
            decision.rotaOverride != null && decision.rotaOverride !== ''
              ? rotaItem || decision.rotaOverride
              : decision.rotaOverride ?? undefined;
          const upd = await ajustarPrevisao(item.id_pedido, {
            previsao_nova: decision.data.previsao_nova,
            motivo: decision.data.motivo,
            observacao: decision.data.observacao || null,
            rota: rotaPayload,
            previsao_confiavel: decision.data.previsao_confiavel,
          });
          outrosAtualizados.push(upd);
        }
      }
      const metaFinal: AjustePrevisaoSuccessMeta = {
        ...meta,
        todosItensPdAtualizados:
          outrosAtualizados.length > 0 ? [atualizado, ...outrosAtualizados] : meta?.todosItensPdAtualizados,
      };
      onSuccess(atualizado, metaFinal);
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao ajustar previsão.');
    } finally {
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
    const previsaoMudou = !previsaoAtualStr || previsaoNovaNorm !== previsaoAtualStr;
    const producaoMudou = !!calendario && producaoNovaNorm !== producaoAtualStr;

    if (calendario) {
      if (!producaoMudou && !previsaoMudou) {
        onError('Nenhuma data foi alterada.');
        return;
      }

      const producaoRef = producaoNovaNorm || producaoAtualStr;
      const previsaoRef =
        calendario.producaoDerivadaPrevisao && producaoMudou && !previsaoMudou
          ? producaoNovaNorm
          : previsaoNovaNorm;
      const ordemErro = validarPrevisaoNaoAnteriorProducao(previsaoRef, producaoRef);
      if (ordemErro) {
        setErrors({ previsao_nova: ordemErro, data_producao_nova: ordemErro });
        onError(ordemErro);
        return;
      }

      // Somente produção (ou previsão só elevada para acompanhar produção): simulação, sem API.
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
        if (!producaoNovaNorm) {
          setErrors({ data_producao_nova: 'Informe a data' });
          onError('Informe a nova data de produção.');
          return;
        }
        onSalvarDataProducao?.(producaoNovaNorm);
        onSuccess(pedido);
        onClose();
        return;
      }
    } else if (previsaoAtualStr && previsaoNovaNorm === previsaoAtualStr) {
      setErrors({ previsao_nova: 'A data não foi alterada.' });
      onError('A data não foi alterada. Informe uma data diferente da previsão atual para salvar.');
      return;
    }

    const dataProducaoPedido = String((pedido as Record<string, unknown>).data_producao ?? '').slice(0, 10);
    if (!calendario) {
      const ordemErro = validarPrevisaoNaoAnteriorProducao(previsaoNovaNorm, dataProducaoPedido);
      if (ordemErro) {
        setErrors({ previsao_nova: ordemErro });
        onError(ordemErro);
        return;
      }
    }

    const precisaAjustePrevisao =
      !calendario ||
      previsaoMudou ||
      (producaoMudou && calendario.producaoDerivadaPrevisao);

    const previsaoEfetiva =
      calendario?.producaoDerivadaPrevisao && producaoMudou && !previsaoMudou
        ? producaoNovaNorm
        : previsaoNovaNorm;

    if (!precisaAjustePrevisao) {
      if (producaoMudou && producaoNovaNorm) {
        onSalvarDataProducao?.(producaoNovaNorm);
        onSuccess(pedido);
        onClose();
      }
      return;
    }

    if (previsaoAtualStr && previsaoEfetiva === previsaoAtualStr) {
      setErrors({ previsao_nova: 'A data não foi alterada.' });
      onError('A data não foi alterada. Informe uma data diferente da previsão atual para salvar.');
      return;
    }

    const parsed = ajusteSchema.safeParse({ previsao_nova: previsaoEfetiva, motivo, observacao });
    const dataComConfiavel = parsed.success
      ? { ...parsed.data, previsao_confiavel: previsaoConfiavel }
      : null;
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      const flat = parsed.error.flatten().fieldErrors;
      if (flat?.previsao_nova?.[0]) fieldErrors.previsao_nova = flat.previsao_nova[0];
      if (flat?.motivo?.[0]) fieldErrors.motivo = flat.motivo[0];
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    if (producaoMudou && !calendario?.producaoDerivadaPrevisao && producaoNovaNorm) {
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
      data: dataComConfiavel!,
      rotaOverride: null,
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
    const decision: PendingDecision = { ...pending, rotaOverride: null };
    setFlowStep('form');
    await advanceFlow(decision);
  };

  const handleMultiplasRotasSomenteEsta = async () => {
    const pending = pendingRef.current;
    if (!pending) return;
    const rotaAtual = rotaFromPedidoRow(pedido as Record<string, unknown>).trim();
    const decision: PendingDecision = { ...pending, rotaOverride: rotaAtual || null };
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75" onClick={onClose}>
      <div
        className="relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
          {calendario ? 'Reprogramar datas do pedido' : 'Ajustar previsão de entrega'}
        </h3>
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1 mb-4">
          <p><span className="font-medium text-slate-700 dark:text-slate-300">Pedido</span> {String(pd)}</p>
          <p>
            <span className="font-medium text-slate-700 dark:text-slate-300">Produto</span>{' '}
            {calendario?.escopoTodosItensPd ? 'TODOS' : String(cod)}
          </p>
          <p><span className="font-medium text-slate-700 dark:text-slate-300">Cliente</span> {pedido.cliente}</p>
        </div>
        <form onSubmit={handleSubmit}>
          {calendario && (
            <div className="mb-4">
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Nova data de produção</label>
              <SequenciamentoDateField
                fullWidth
                value={data_producao_nova}
                onChange={(nova) => {
                  setDataProducaoNova(nova);
                  const previsaoForm = previsao_nova.trim().slice(0, 10);
                  if (nova && (!previsaoForm || previsaoForm < nova)) {
                    setPrevisaoNova(nova);
                  }
                }}
                className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-700"
              />
              {errors.data_producao_nova && (
                <p className="text-amber-400 text-xs mt-1">{errors.data_producao_nova}</p>
              )}
            </div>
          )}
          <div className="mb-4">
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Nova data de previsão</label>
            <SequenciamentoDateField
              fullWidth
              value={previsao_nova}
              onChange={setPrevisaoNova}
              className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-700"
            />
            {errors.previsao_nova && (
              <p className="text-amber-400 text-xs mt-1">{errors.previsao_nova}</p>
            )}
          </div>
          <div className="mb-4">
            <div className="flex items-center justify-between gap-2 mb-1">
              <label className="block text-xs text-slate-400">Motivo</label>
              {podeGerenciarMotivos && (
                <button
                  type="button"
                  onClick={() => setAbrirGerenciar(true)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-600 transition-colors"
                  title="Gerenciar motivos"
                  aria-label="Gerenciar motivos"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>
              )}
            </div>
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 px-3 py-2 focus:ring-2 focus:ring-primary-600 focus:border-transparent"
              required={motivoObrigatorio}
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
          </div>
          <div className="mb-4">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={previsaoConfiavel}
                onChange={(e) => setPrevisaoConfiavel(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-600"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                <span className="font-medium">Previsão confiável</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                  Desmarque se a data é provisória. Nesse caso, não aparece no histórico da Comunicação Interna.
                </span>
              </span>
            </label>
          </div>
          <div className="mb-4">
            <CampoLabelComAjuda label="Observação" ajuda={AJUDA_CAMPO_OBSERVACAO} className="text-xs text-slate-500 dark:text-slate-400" />
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              placeholder="Opcional"
              className="w-full rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 px-3 py-2 focus:ring-2 focus:ring-primary-600 focus:border-transparent resize-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-800 dark:text-slate-100 text-sm font-medium"
            >
              Cancelar
            </button>
            {onVoltar && (
              <button
                type="button"
                onClick={onVoltar}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm font-medium"
              >
                Voltar
              </button>
            )}
            <button
              type="submit"
              disabled={loading || carradaCheckLoading}
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
      </div>

            {abrirGerenciar && podeGerenciarMotivos && (
        <ModalGerenciarMotivos
          onClose={() => setAbrirGerenciar(false)}
          onError={onError}
          onAtualizado={carregarSugestoes}
        />
      )}
    </div>
  );
}
