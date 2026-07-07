import { useEffect, useMemo, useState } from 'react';
import { listarMotivosSugestao, type MotivoSugestao } from '../../api/motivosSugestao';
import { formatDataCurta, formatQtdeInt, type PedidoAlterado } from './simulacaoCarradas';

type Props = {
  pedidosEntrega: PedidoAlterado[];
  /** Quantidade de carradas que terão apenas a Data de produção atualizada (sem mudança de previsão). */
  qtdCarradasSomenteProducao: number;
  salvando: boolean;
  erro: string | null;
  onConfirmar: (motivoPorIdPedido: Record<string, string>) => void;
  onClose: () => void;
};

const TH = 'px-2 py-2 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap';
const TD = 'px-2 py-1.5 text-slate-700 dark:text-slate-200 align-top';
const SELECT_CLASS =
  'w-full min-w-[11rem] rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100';

export default function ConfirmacaoSimulacaoModal({
  pedidosEntrega,
  qtdCarradasSomenteProducao,
  salvando,
  erro,
  onConfirmar,
  onClose,
}: Props) {
  const [motivos, setMotivos] = useState<MotivoSugestao[]>([]);
  const [motivoPorId, setMotivoPorId] = useState<Record<string, string>>({});
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [motivoEmMassa, setMotivoEmMassa] = useState('');
  const [validacao, setValidacao] = useState<string | null>(null);

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

  const gruposPorCarrada = useMemo(() => {
    const map = new Map<string, PedidoAlterado[]>();
    for (const p of pedidosEntrega) {
      const list = map.get(p.rota) ?? [];
      list.push(p);
      map.set(p.rota, list);
    }
    return [...map.entries()].map(([rota, itens]) => ({ rota, itens }));
  }, [pedidosEntrega]);

  const setMotivo = (id: string, motivo: string) =>
    setMotivoPorId((prev) => ({ ...prev, [id]: motivo }));

  const setMotivoGrupo = (itens: PedidoAlterado[], motivo: string) =>
    setMotivoPorId((prev) => {
      const next = { ...prev };
      for (const it of itens) next[it.idPedido] = motivo;
      return next;
    });

  const toggleSel = (id: string) =>
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const aplicarEmMassa = () => {
    if (!motivoEmMassa || selecionados.size === 0) return;
    setMotivoPorId((prev) => {
      const next = { ...prev };
      for (const id of selecionados) next[id] = motivoEmMassa;
      return next;
    });
  };

  const confirmar = () => {
    if (pedidosEntrega.length > 0) {
      const semMotivo = pedidosEntrega.filter((p) => !(motivoPorId[p.idPedido]?.trim()));
      if (semMotivo.length > 0) {
        setValidacao(`Selecione um motivo para todos os pedidos (${semMotivo.length} sem motivo).`);
        return;
      }
    }
    setValidacao(null);
    onConfirmar(motivoPorId);
  };

  const todosSelecionados = pedidosEntrega.length > 0 && pedidosEntrega.every((p) => selecionados.has(p.idPedido));

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
              Confirmar alterações da simulação
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              As alterações de Data de entrega abaixo exigem um motivo e serão aplicadas à previsão dos
              pedidos (replicadas para toda a carrada).
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
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-600">
            <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={todosSelecionados}
                onChange={(e) =>
                  setSelecionados(e.target.checked ? new Set(pedidosEntrega.map((p) => p.idPedido)) : new Set())
                }
              />
              Selecionar todos
            </label>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-600 dark:text-slate-300">Aplicar motivo aos selecionados:</span>
            <select
              value={motivoEmMassa}
              onChange={(e) => setMotivoEmMassa(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">Selecione um motivo…</option>
              {motivos.map((m) => (
                <option key={m.id} value={m.descricao}>
                  {m.descricao}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={aplicarEmMassa}
              disabled={!motivoEmMassa || selecionados.size === 0}
              className="rounded-lg bg-primary-600 px-3 py-1 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              Aplicar ({selecionados.size})
            </button>
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
                  <th className={`${TH} text-left`}>Rota</th>
                  <th className={`${TH} text-left`}>Pedido</th>
                  <th className={`${TH} text-left`}>Cliente</th>
                  <th className={`${TH} text-left`}>Cód</th>
                  <th className={`${TH} text-left`}>Descrição</th>
                  <th className={`${TH} text-right`}>Qtde Pendente Real</th>
                  <th className={`${TH} text-left`}>Previsão anterior</th>
                  <th className={`${TH} text-left`}>Nova previsão</th>
                  <th className={`${TH} text-left`}>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {gruposPorCarrada.map((grupo) => (
                  <GrupoCarrada
                    key={grupo.rota}
                    rota={grupo.rota}
                    itens={grupo.itens}
                    motivos={motivos}
                    motivoPorId={motivoPorId}
                    selecionados={selecionados}
                    onToggleSel={toggleSel}
                    onSetMotivo={setMotivo}
                    onSetMotivoGrupo={setMotivoGrupo}
                  />
                ))}
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

function GrupoCarrada({
  rota,
  itens,
  motivos,
  motivoPorId,
  selecionados,
  onToggleSel,
  onSetMotivo,
  onSetMotivoGrupo,
}: {
  rota: string;
  itens: PedidoAlterado[];
  motivos: MotivoSugestao[];
  motivoPorId: Record<string, string>;
  selecionados: Set<string>;
  onToggleSel: (id: string) => void;
  onSetMotivo: (id: string, motivo: string) => void;
  onSetMotivoGrupo: (itens: PedidoAlterado[], motivo: string) => void;
}) {
  const motivoComum = itens.every((it) => motivoPorId[it.idPedido] === motivoPorId[itens[0]!.idPedido])
    ? motivoPorId[itens[0]!.idPedido] ?? ''
    : '';
  return (
    <>
      <tr className="border-b border-slate-200 bg-slate-100/70 dark:border-slate-600 dark:bg-slate-700/40">
        <td className="px-2 py-1.5" />
        <td className="px-2 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200" colSpan={6}>
          {rota} <span className="font-normal text-slate-400">({itens.length} pedido(s))</span>
        </td>
        <td className="px-2 py-1.5 text-right text-[11px] text-slate-500 dark:text-slate-400" colSpan={2}>
          Motivo para toda a carrada:
        </td>
        <td className="px-2 py-1.5">
          <select
            value={motivoComum}
            onChange={(e) => onSetMotivoGrupo(itens, e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">Selecione…</option>
            {motivos.map((m) => (
              <option key={m.id} value={m.descricao}>
                {m.descricao}
              </option>
            ))}
          </select>
        </td>
      </tr>
      {itens.map((it) => (
        <tr key={it.idPedido} className="border-b border-slate-100 dark:border-slate-700">
          <td className="px-2 py-1.5 text-center align-top">
            <input
              type="checkbox"
              checked={selecionados.has(it.idPedido)}
              onChange={() => onToggleSel(it.idPedido)}
            />
          </td>
          <td className={TD}>{it.rota}</td>
          <td className={TD}>{it.pd}</td>
          <td className={`${TD} max-w-[12rem]`}>
            <span className="line-clamp-2 block" title={it.cliente}>
              {it.cliente || '—'}
            </span>
          </td>
          <td className={TD}>{it.cod || '—'}</td>
          <td className={`${TD} max-w-[16rem]`}>
            <span className="line-clamp-2 block" title={it.descricao}>
              {it.descricao || '—'}
            </span>
          </td>
          <td className={`${TD} text-right tabular-nums`}>{formatQtdeInt(it.qtdePendenteReal)}</td>
          <td className={`${TD} whitespace-nowrap`}>{formatDataCurta(it.previsaoAnterior)}</td>
          <td className={`${TD} whitespace-nowrap font-medium text-primary-700 dark:text-primary-300`}>
            {formatDataCurta(it.previsaoNova)}
          </td>
          <td className={TD}>
            <select
              value={motivoPorId[it.idPedido] ?? ''}
              onChange={(e) => onSetMotivo(it.idPedido, e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">Selecione…</option>
              {motivos.map((m) => (
                <option key={m.id} value={m.descricao}>
                  {m.descricao}
                </option>
              ))}
            </select>
          </td>
        </tr>
      ))}
    </>
  );
}
