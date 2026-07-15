import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { listarMotivosSugestao, type MotivoSugestao } from '../../api/motivosSugestao';
import { formatDataCurta, formatQtdeInt, type PedidoAlterado } from './simulacaoCarradas';
import { useRegisterModalEscape } from '../../contexts/ModalStackContext';
import { criarMatcherTextoLivre } from '../../utils/textoLivreBusca';
import {
  agruparAlteradosPorPedido,
  grupoPedidoMotivoConcluido,
  itemMotivoConcluido,
  motivoComumIds,
} from './confirmacaoMotivosUtils';

type Props = {
  pedidosEntrega: PedidoAlterado[];
  /** Quantidade de carradas que terão apenas a Data de produção atualizada (sem mudança de previsão). */
  qtdCarradasSomenteProducao: number;
  salvando: boolean;
  erro: string | null;
  /** Motivos por id_pedido (estado vive na página para entrar no autosave do rascunho). */
  motivoPorId: Record<string, string>;
  onMotivoPorIdChange: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  onConfirmar: (motivoPorIdPedido: Record<string, string>) => void;
  onClose: () => void;
};

const TH = 'px-2 py-2 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap';
const TD = 'px-2 py-1.5 text-slate-700 dark:text-slate-200 align-middle';
const TR_ROW = 'border-b border-slate-100 dark:border-slate-700';
const TR_CONCLUIDA =
  'border-b border-slate-100 dark:border-slate-700 bg-emerald-50/80 dark:bg-emerald-950/40';
const TR_PENDENTE_ITEM = 'border-b border-slate-100 dark:border-slate-700 bg-amber-50/50 dark:bg-amber-950/20';
const TD_MESCLADA = 'px-2 py-1.5 align-middle text-center text-slate-700 dark:text-slate-200';

const RECENTES_STORAGE_KEY = 'seqCarradas:motivosRecentes';
const MAX_RECENTES = 5;

function lerMotivosRecentes(): string[] {
  try {
    const raw = localStorage.getItem(RECENTES_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function registrarMotivoRecente(motivo: string): string[] {
  const atual = lerMotivosRecentes().filter((m) => m !== motivo);
  const next = [motivo, ...atual].slice(0, MAX_RECENTES);
  try {
    localStorage.setItem(RECENTES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage indisponível: segue sem persistir
  }
  return next;
}

/**
 * Seletor de motivo com busca e recentes no topo.
 * Dropdown em portal (position fixed) para não ser cortado pelo overflow do modal.
 */
function MotivoPicker({
  value,
  onSelect,
  motivos,
  recentes,
  compact = false,
  disabled = false,
}: {
  value: string;
  onSelect: (motivo: string) => void;
  motivos: MotivoSugestao[];
  recentes: string[];
  compact?: boolean;
  disabled?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(`motivo-picker-${Math.random().toString(36).slice(2)}`);

  const fechar = useCallback(() => {
    setAberto(false);
    setBusca('');
  }, []);

  // ESC fecha só o dropdown (fica acima do modal na pilha).
  useRegisterModalEscape({ id: idRef.current, onClose: fechar, zIndex: 500, enabled: aberto });

  const abrir = () => {
    if (disabled) return;
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setRect({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 260) });
    setAberto(true);
  };

  useEffect(() => {
    if (!aberto) return;
    const handle = (e: Event) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (dropRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      fechar();
    };
    document.addEventListener('mousedown', handle, true);
    return () => document.removeEventListener('mousedown', handle, true);
  }, [aberto, fechar]);

  const listaFiltrada = useMemo(() => {
    const match = criarMatcherTextoLivre(busca);
    const todas = motivos.map((m) => m.descricao);
    const filtradas = busca.trim() ? todas.filter((d) => match(d)) : todas;
    const recSet = new Set(recentes);
    const rec = recentes.filter((r) => filtradas.includes(r));
    const resto = filtradas.filter((d) => !recSet.has(d));
    return { rec, resto };
  }, [motivos, recentes, busca]);

  const escolher = (motivo: string) => {
    onSelect(motivo);
    fechar();
  };

  const dropdown =
    aberto && rect
      ? createPortal(
          <div
            ref={dropRef}
            style={{
              position: 'fixed',
              top: Math.min(rect.top, window.innerHeight - 320),
              left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
              width: rect.width,
              zIndex: 13001,
            }}
            className="max-h-80 overflow-hidden rounded-lg border border-slate-300 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800"
          >
            <div className="border-b border-slate-200 p-2 dark:border-slate-600">
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar motivo… (% = curinga)"
                autoFocus
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
            <div className="max-h-64 overflow-auto p-1">
              {value && (
                <button
                  type="button"
                  onClick={() => escolher('')}
                  className="block w-full rounded px-2 py-1.5 text-left text-xs italic text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                >
                  Limpar motivo
                </button>
              )}
              {listaFiltrada.rec.length > 0 && (
                <>
                  <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Recentes
                  </p>
                  {listaFiltrada.rec.map((d) => (
                    <button
                      key={`rec-${d}`}
                      type="button"
                      onClick={() => escolher(d)}
                      className={`block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-700 ${
                        d === value ? 'bg-primary-50 font-medium text-primary-800 dark:bg-primary-900/30 dark:text-primary-200' : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                  <div className="my-1 border-t border-slate-200 dark:border-slate-600" />
                </>
              )}
              {listaFiltrada.resto.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => escolher(d)}
                  className={`block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-700 ${
                    d === value ? 'bg-primary-50 font-medium text-primary-800 dark:bg-primary-900/30 dark:text-primary-200' : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {d}
                </button>
              ))}
              {listaFiltrada.rec.length === 0 && listaFiltrada.resto.length === 0 && (
                <p className="px-2 py-2 text-xs text-slate-500 dark:text-slate-400">Nenhum motivo encontrado.</p>
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={aberto ? fechar : abrir}
        disabled={disabled}
        className={`flex w-full min-w-[11rem] items-center justify-between gap-1 rounded-md border px-2 text-left text-xs disabled:cursor-not-allowed disabled:opacity-60 ${
          compact ? 'py-1' : 'py-1.5'
        } ${
          value
            ? 'border-slate-300 bg-white text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100'
            : 'border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-500/60 dark:bg-amber-900/20 dark:text-amber-200'
        }`}
        title={value || 'Selecionar motivo'}
      >
        <span className="truncate">{value || 'Selecione um motivo…'}</span>
        <span aria-hidden className="shrink-0 text-slate-400">
          ▾
        </span>
      </button>
      {dropdown}
    </>
  );
}

type GrupoCarrada = {
  rota: string;
  itens: PedidoAlterado[];
  previsoesAnteriores: string[];
  previsoesNovas: string[];
  qtdeTotal: number;
};

export default function ConfirmacaoSimulacaoModal({
  pedidosEntrega,
  qtdCarradasSomenteProducao,
  salvando,
  erro,
  motivoPorId,
  onMotivoPorIdChange,
  onConfirmar,
  onClose,
}: Props) {
  const [motivos, setMotivos] = useState<MotivoSugestao[]>([]);
  const [recentes, setRecentes] = useState<string[]>(() => lerMotivosRecentes());
  const [expandido, setExpandido] = useState<Set<string>>(new Set());
  const [validacao, setValidacao] = useState<string | null>(null);

  useRegisterModalEscape({ id: 'seq-carradas-confirmacao', onClose, zIndex: 135, enabled: !salvando });

  useEffect(() => {
    let ativo = true;
    listarMotivosSugestao()
      .then((lista) => {
        if (ativo) setMotivos(lista);
      })
      .catch(() => {
        if (ativo) setMotivos([]);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const grupos = useMemo<GrupoCarrada[]>(() => {
    const map = new Map<string, PedidoAlterado[]>();
    for (const p of pedidosEntrega) {
      const list = map.get(p.rota) ?? [];
      list.push(p);
      map.set(p.rota, list);
    }
    return [...map.entries()].map(([rota, itens]) => ({
      rota,
      itens,
      previsoesAnteriores: [...new Set(itens.map((i) => i.previsaoAnterior).filter(Boolean))],
      previsoesNovas: [...new Set(itens.map((i) => i.previsaoNova).filter(Boolean))],
      qtdeTotal: itens.reduce((s, i) => s + i.qtdePendenteReal, 0),
    }));
  }, [pedidosEntrega]);

  const selecionarMotivo = useCallback(
    (ids: string[], motivo: string) => {
      onMotivoPorIdChange((prev) => {
        const next = { ...prev };
        for (const id of ids) {
          if (motivo) next[id] = motivo;
          else delete next[id];
        }
        return next;
      });
      if (motivo) setRecentes(registrarMotivoRecente(motivo));
    },
    [onMotivoPorIdChange]
  );

  const pendentes = useMemo(
    () => pedidosEntrega.filter((p) => !motivoPorId[p.idPedido]?.trim()),
    [pedidosEntrega, motivoPorId]
  );
  const gruposPendentes = useMemo(
    () => new Set(pendentes.map((p) => p.rota)),
    [pendentes]
  );

  const aplicarNasPendentes = (motivo: string) => {
    if (!motivo) return;
    selecionarMotivo(pendentes.map((p) => p.idPedido), motivo);
  };

  const toggleExpandido = (rota: string) =>
    setExpandido((prev) => {
      const next = new Set(prev);
      if (next.has(rota)) next.delete(rota);
      else next.add(rota);
      return next;
    });

  const confirmar = () => {
    if (pedidosEntrega.length > 0 && pendentes.length > 0) {
      setValidacao(
        `Selecione um motivo para todas as carradas (${gruposPendentes.size} carrada(s) / ${pendentes.length} pedido(s) sem motivo).`
      );
      return;
    }
    setValidacao(null);
    onConfirmar(motivoPorId);
  };

  const motivoComumDoGrupo = (grupo: GrupoCarrada): string =>
    motivoComumIds(
      grupo.itens.map((i) => i.idPedido),
      motivoPorId
    );

  const formatLista = (datas: string[]): string => {
    if (datas.length === 0) return '—';
    if (datas.length === 1) return formatDataCurta(datas[0]!);
    return `${formatDataCurta(datas[0]!)} +${datas.length - 1}`;
  };

  return (
    <div
      className="fixed inset-0 z-[135] flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onClick={salvando ? undefined : onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-6xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmacao-simulacao-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <div>
            <h2 id="confirmacao-simulacao-titulo" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Registrar motivos e confirmar
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Escolha o motivo por carrada, por pedido (replicado para todos os itens do PD) ou por item.
              Expanda a carrada para ajustar exceções. Itens com motivo ficam destacados em verde.
              {qtdCarradasSomenteProducao > 0 &&
                ` Além disso, ${qtdCarradasSomenteProducao} carrada(s) terão apenas a Data de produção atualizada.`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Fechar
          </button>
        </div>

        {pedidosEntrega.length > 0 && (
          <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-2 dark:border-slate-600">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                pendentes.length === 0
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
              }`}
            >
              {pendentes.length === 0
                ? 'Todos os motivos preenchidos'
                : `${gruposPendentes.size} carrada(s) sem motivo`}
            </span>
            {pendentes.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600 dark:text-slate-300">
                  Aplicar às carradas sem motivo:
                </span>
                <div className="w-64">
                  <MotivoPicker
                    value=""
                    onSelect={aplicarNasPendentes}
                    motivos={motivos}
                    recentes={recentes}
                    compact
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {pedidosEntrega.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Nenhuma alteração de previsão exige motivo.
              {qtdCarradasSomenteProducao > 0
                ? ' As datas de produção informadas serão gravadas ao confirmar.'
                : ' Não há alterações para aplicar.'}
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/50">
                  <th className={`${TH} w-8`} />
                  <th className={`${TH} text-left`}>Carrada / Pedido / Item</th>
                  <th className={`${TH} text-right`}>Qtde Pendente Real</th>
                  <th className={`${TH} text-left`}>Previsão anterior</th>
                  <th className={`${TH} text-left`}>Nova previsão</th>
                  <th className={`${TH} text-left`}>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map((grupo) => {
                  const aberto = expandido.has(grupo.rota);
                  const pendente = gruposPendentes.has(grupo.rota);
                  const motivoComum = motivoComumDoGrupo(grupo);
                  return (
                    <GrupoCarradaRows
                      key={grupo.rota}
                      grupo={grupo}
                      aberto={aberto}
                      pendente={pendente}
                      motivoComum={motivoComum}
                      motivos={motivos}
                      recentes={recentes}
                      motivoPorId={motivoPorId}
                      formatLista={formatLista}
                      onToggle={() => toggleExpandido(grupo.rota)}
                      onSelecionarMotivo={selecionarMotivo}
                    />
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-600">
          {(validacao || erro) && (
            <p className="text-sm text-red-600 dark:text-red-300" role="alert">
              {validacao ?? erro}
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmar}
              disabled={salvando}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {salvando ? 'Aplicando...' : 'Confirmar e aplicar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function classeLinhaItemMotivo(idPedido: string, motivoPorId: Record<string, string>): string {
  return itemMotivoConcluido(idPedido, motivoPorId) ? TR_CONCLUIDA : TR_PENDENTE_ITEM;
}

function GrupoCarradaRows({
  grupo,
  aberto,
  pendente,
  motivoComum,
  motivos,
  recentes,
  motivoPorId,
  formatLista,
  onToggle,
  onSelecionarMotivo,
}: {
  grupo: GrupoCarrada;
  aberto: boolean;
  pendente: boolean;
  motivoComum: string;
  motivos: MotivoSugestao[];
  recentes: string[];
  motivoPorId: Record<string, string>;
  formatLista: (datas: string[]) => string;
  onToggle: () => void;
  onSelecionarMotivo: (ids: string[], motivo: string) => void;
}) {
  const gruposPedido = useMemo(() => agruparAlteradosPorPedido(grupo.itens), [grupo.itens]);

  return (
    <>
      <tr
        className={`${TR_ROW} ${
          pendente
            ? 'bg-amber-50/70 dark:bg-amber-900/10'
            : 'bg-emerald-50/60 dark:bg-emerald-950/25'
        }`}
      >
        <td className="px-2 py-1.5 text-center align-middle">
          <button
            type="button"
            onClick={onToggle}
            className="rounded px-1 text-xs text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-600"
            title={aberto ? 'Recolher pedidos e itens' : 'Expandir pedidos e itens'}
            aria-expanded={aberto}
          >
            {aberto ? '▾' : '▸'}
          </button>
        </td>
        <td className="px-2 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
          {grupo.rota}
          <span className="ml-2 font-normal text-slate-500 dark:text-slate-400">
            ({grupo.itens.length} pedido(s))
          </span>
        </td>
        <td className="px-2 py-1.5 text-right text-xs tabular-nums text-slate-600 dark:text-slate-300">
          {formatQtdeInt(grupo.qtdeTotal)}
        </td>
        <td className="px-2 py-1.5 text-xs whitespace-nowrap text-slate-600 dark:text-slate-300">
          {formatLista(grupo.previsoesAnteriores)}
        </td>
        <td className="px-2 py-1.5 text-xs whitespace-nowrap font-medium text-primary-700 dark:text-primary-300">
          {formatLista(grupo.previsoesNovas)}
        </td>
        <td className="px-2 py-1.5">
          <MotivoPicker
            value={motivoComum}
            onSelect={(m) => onSelecionarMotivo(grupo.itens.map((i) => i.idPedido), m)}
            motivos={motivos}
            recentes={recentes}
            compact
          />
        </td>
      </tr>
      {aberto &&
        gruposPedido.flatMap((grupoPd) => {
          const idsPedido = grupoPd.itens.map((i) => i.idPedido);
          const motivoComumPedido = motivoComumIds(idsPedido, motivoPorId);
          const pedidoConcluido = grupoPedidoMotivoConcluido(grupoPd.itens, motivoPorId);
          const rowSpan = grupoPd.itens.length;

          return grupoPd.itens.map((it, itemIdx) => {
            const isFirst = itemIdx === 0;
            return (
              <tr key={it.idPedido} className={classeLinhaItemMotivo(it.idPedido, motivoPorId)}>
                <td className="px-2 py-1.5" />
                {isFirst ? (
                  <td rowSpan={rowSpan} className={TD_MESCLADA}>
                    <div className="flex flex-col items-center justify-center gap-1">
                      <span className="text-xs font-semibold">{grupoPd.pd}</span>
                      <span
                        className="max-w-[140px] truncate text-[11px] text-slate-500 dark:text-slate-400"
                        title={grupoPd.cliente}
                      >
                        {grupoPd.cliente || '—'}
                      </span>
                      <div className="w-full min-w-[11rem]">
                        <MotivoPicker
                          value={motivoComumPedido}
                          onSelect={(m) => onSelecionarMotivo(idsPedido, m)}
                          motivos={motivos}
                          recentes={recentes}
                          compact
                        />
                      </div>
                      {pedidoConcluido ? (
                        <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                          Concluído
                        </span>
                      ) : null}
                    </div>
                  </td>
                ) : null}
                <td className={TD}>
                  <div className="flex flex-col">
                    <span className="font-mono text-xs">{it.cod || '—'}</span>
                    <span
                      className="line-clamp-2 text-[11px] text-slate-500 dark:text-slate-400"
                      title={it.descricao}
                    >
                      {it.descricao || '—'}
                    </span>
                    {itemMotivoConcluido(it.idPedido, motivoPorId) ? (
                      <span className="mt-0.5 inline-block w-fit rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                        Concluído
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className={`${TD} text-right tabular-nums`}>{formatQtdeInt(it.qtdePendenteReal)}</td>
                <td className={`${TD} whitespace-nowrap`}>{formatDataCurta(it.previsaoAnterior)}</td>
                <td className={`${TD} whitespace-nowrap font-medium text-primary-700 dark:text-primary-300`}>
                  {formatDataCurta(it.previsaoNova)}
                </td>
                <td className={TD}>
                  <MotivoPicker
                    value={motivoPorId[it.idPedido] ?? ''}
                    onSelect={(m) => onSelecionarMotivo([it.idPedido], m)}
                    motivos={motivos}
                    recentes={recentes}
                    compact
                  />
                </td>
              </tr>
            );
          });
        })}
    </>
  );
}
