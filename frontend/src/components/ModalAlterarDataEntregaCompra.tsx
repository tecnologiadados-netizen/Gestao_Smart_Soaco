import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ModalGerenciarMotivosDataEntregaCompra from './ModalGerenciarMotivosDataEntregaCompra';
import {
  listarMotivosAlteracaoDataEntregaCompra,
  type MotivoAlteracaoDataEntregaCompra,
} from '../api/motivosAlteracaoDataEntregaCompra';
import { atualizarDataEntregaItemPedidoCompra } from '../api/integracao';
import { useRegisterModalEscape } from '../contexts/ModalStackContext';

export type ItemAlterarDataEntregaCompra = {
  idItemPedidoCompra: number;
  pedido: string;
  codigoProduto: string;
  descricaoProduto: string;
  /** YYYY-MM-DD ou vazio. */
  dataEntrega: string;
};

type Props = {
  item: ItemAlterarDataEntregaCompra | null;
  podeEditar: boolean;
  podeGerenciarMotivos?: boolean;
  zIndex?: number;
  /** Endpoint de gravação; padrão é o da Integração. */
  salvar?: typeof atualizarDataEntregaItemPedidoCompra;
  onClose: () => void;
  onSalvo: (idItemPedidoCompra: number, dataEntregaNova: string) => void;
};

const btnPrimaryClass =
  'px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm transition shrink-0';
const inputClass =
  'w-full rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent';
const labelClass = 'block text-xs text-slate-500 dark:text-slate-400 mb-1';

function formatDate(s: string): string {
  if (!s || !s.trim()) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim().slice(0, 10));
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return s;
}

export default function ModalAlterarDataEntregaCompra({
  item,
  podeEditar,
  podeGerenciarMotivos = podeEditar,
  zIndex = 50,
  salvar: salvarNoServidor = atualizarDataEntregaItemPedidoCompra,
  onClose,
  onSalvo,
}: Props) {
  const [dataEntrega, setDataEntrega] = useState('');
  const [motivo, setMotivo] = useState('');
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [motivos, setMotivos] = useState<MotivoAlteracaoDataEntregaCompra[]>([]);
  const [carregandoMotivos, setCarregandoMotivos] = useState(false);
  const [gerenciarMotivos, setGerenciarMotivos] = useState(false);
  const fecharTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const carregarMotivos = useCallback(() => {
    setCarregandoMotivos(true);
    listarMotivosAlteracaoDataEntregaCompra()
      .then(setMotivos)
      .catch(() => setMotivos([]))
      .finally(() => setCarregandoMotivos(false));
  }, []);

  useEffect(() => {
    if (!item) return;
    setDataEntrega(item.dataEntrega && item.dataEntrega.length >= 10 ? item.dataEntrega.slice(0, 10) : '');
    setMotivo('');
    setObservacao('');
    setErro(null);
    setSucesso(null);
    setGerenciarMotivos(false);
  }, [item]);

  useEffect(() => {
    if (item) carregarMotivos();
  }, [item, carregarMotivos]);

  useEffect(
    () => () => {
      if (fecharTimer.current) clearTimeout(fecharTimer.current);
    },
    []
  );

  const fechar = useCallback(() => {
    if (salvando) return;
    if (fecharTimer.current) clearTimeout(fecharTimer.current);
    onClose();
  }, [salvando, onClose]);

  useRegisterModalEscape({
    id: `alterar-data-entrega-compra:${item?.idItemPedidoCompra ?? 'idle'}`,
    onClose: fechar,
    zIndex,
    enabled: item != null && !gerenciarMotivos,
  });

  const salvar = async () => {
    if (!item || item.idItemPedidoCompra <= 0) return;
    const dataValida = dataEntrega.trim().slice(0, 10);
    if (!dataValida || !/^\d{4}-\d{2}-\d{2}$/.test(dataValida)) {
      setErro('Informe uma data válida (YYYY-MM-DD).');
      return;
    }
    const motivoTrim = motivo.trim();
    if (!motivoTrim) {
      setErro('Informe o motivo da alteração.');
      return;
    }
    if (motivoTrim.length > 500) {
      setErro('Motivo deve ter no máximo 500 caracteres.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const dataAnterior = item.dataEntrega && item.dataEntrega.length >= 10 ? item.dataEntrega.slice(0, 10) : dataValida;
      await salvarNoServidor(item.idItemPedidoCompra, {
        dataEntrega: dataValida,
        dataEntregaAnterior: dataAnterior,
        motivo: motivoTrim,
        observacao: observacao.trim() || null,
      });
      onSalvo(item.idItemPedidoCompra, dataValida);
      setSucesso('Alteração do pedido no Nomus realizada com sucesso. Histórico gravado.');
      fecharTimer.current = setTimeout(() => onClose(), 2000);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  if (!item) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4 bg-black/70"
      style={{ zIndex }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-alterar-data-title"
    >
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
        <h3 id="modal-alterar-data-title" className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">
          Alterar data de entrega
        </h3>
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1.5 mb-4">
          <p><span className="font-medium text-slate-700 dark:text-slate-300">Pedido</span><br />{item.pedido || '—'}</p>
          <p><span className="font-medium text-slate-700 dark:text-slate-300">Código do Produto</span><br />{item.codigoProduto || '—'}</p>
          <p><span className="font-medium text-slate-700 dark:text-slate-300">Descrição do Produto</span><br />{item.descricaoProduto || '—'}</p>
          <p><span className="font-medium text-slate-700 dark:text-slate-300">Data de Entrega Atual</span><br />{formatDate(item.dataEntrega)}</p>
        </div>
        <div className="mb-4">
          <label className={labelClass}>Nova data de entrega</label>
          <input
            type="date"
            value={dataEntrega}
            onChange={(e) => setDataEntrega(e.target.value)}
            className={inputClass}
            disabled={salvando || !podeEditar}
          />
        </div>
        <div className="mb-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <label className={labelClass}>Motivo da alteração da data de entrega</label>
            {podeGerenciarMotivos && (
              <button
                type="button"
                onClick={() => setGerenciarMotivos(true)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-600 transition-colors"
                title="Gerenciar motivos (incluir, excluir, editar)"
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
            className={inputClass}
            required
            disabled={salvando || !podeEditar}
          >
            <option value="">Selecione um motivo</option>
            {motivos.map((s) => (
              <option key={s.id} value={s.descricao}>
                {s.descricao}
              </option>
            ))}
          </select>
          {carregandoMotivos && (
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Carregando motivos...</p>
          )}
        </div>
        <div className="mb-4">
          <label className={labelClass}>Observação</label>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={2}
            placeholder="Opcional"
            className={`${inputClass} resize-none placeholder:text-slate-400 dark:placeholder:text-slate-500`}
            disabled={salvando || !podeEditar}
          />
        </div>
        {sucesso && (
          <div className="mb-4 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm">
            {sucesso}
          </div>
        )}
        {erro && <p className="text-sm text-amber-600 dark:text-amber-400 mb-3">{erro}</p>}
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={fechar}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            disabled={salvando}
          >
            Cancelar
          </button>
          {podeEditar && (
            <button type="button" onClick={salvar} className={btnPrimaryClass} disabled={salvando || sucesso != null}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          )}
        </div>
      </div>
      {gerenciarMotivos && podeGerenciarMotivos && (
        <ModalGerenciarMotivosDataEntregaCompra
          onClose={() => setGerenciarMotivos(false)}
          onError={(msg) => setErro(msg)}
          onAtualizado={carregarMotivos}
        />
      )}
    </div>,
    document.body
  );
}
