import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { DetalhePortaPallets } from '../../api/portaPalletsComercial';
import GradePortaPallets from './GradePortaPallets';
import {
  COLUNAS_CLIENTES_FUNIL,
  COLUNAS_CLIENTES_MES,
  COLUNAS_CONVERSAO,
  COLUNAS_PEDIDOS,
  COLUNAS_PEDIDOS_GERADOS,
  COLUNAS_PROPOSTAS,
} from './portaPalletsColunasGrade';

type Props = {
  aberto: boolean;
  titulo: string;
  subtitulo: string;
  loading: boolean;
  erro: string | null;
  detalhe: DetalhePortaPallets | null;
  onClose: () => void;
};

export default function ModalPortaPalletsDetalhe({
  aberto,
  titulo,
  subtitulo,
  loading,
  erro,
  detalhe,
  onClose,
}: Props) {
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aberto, onClose]);

  if (!aberto || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10040] flex items-center justify-center bg-black/70 p-3 sm:p-4 dark:bg-slate-950/60"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[min(92vh,820px)] w-full max-w-6xl min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="porta-pallets-detalhe-titulo"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <div className="min-w-0">
            <h2 id="porta-pallets-detalhe-titulo" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              {titulo}
            </h2>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{subtitulo}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden p-4">
          {loading && <p className="py-8 text-sm text-slate-500">Carregando origem…</p>}
          {!loading && erro && <p className="py-8 text-sm text-rose-700 dark:text-rose-300">{erro}</p>}
          {!loading && !erro && detalhe && detalhe.rows.length === 0 && (
            <p className="py-8 text-sm text-slate-500">Nenhum registro neste recorte.</p>
          )}
          {!loading && !erro && detalhe && detalhe.rows.length > 0 && <Tabela detalhe={detalhe} />}
        </div>
      </div>
    </div>,
    document.body
  );
}

function Tabela({ detalhe }: { detalhe: DetalhePortaPallets }) {
  switch (detalhe.indicador) {
    case 'propostas':
      return (
        <GradePortaPallets
          rows={detalhe.rows}
          colunas={COLUNAS_PROPOSTAS}
          rowKey={(r) => r.idItem}
          defaultSortLevels={[{ id: 'abertura', dir: 'asc' }]}
        />
      );
    case 'pedidos':
      return (
        <GradePortaPallets
          rows={detalhe.rows}
          colunas={COLUNAS_PEDIDOS}
          rowKey={(r) => r.idItem}
          defaultSortLevels={[{ id: 'emissao', dir: 'asc' }]}
        />
      );
    case 'pedidos_gerados':
      return (
        <GradePortaPallets
          rows={detalhe.rows}
          colunas={COLUNAS_PEDIDOS_GERADOS}
          rowKey={(r) => r.idPedido}
          defaultSortLevels={[{ id: 'emissao', dir: 'asc' }]}
        />
      );
    case 'clientes_total':
    case 'clientes_com_pedido':
    case 'clientes_novos':
    case 'novos_com_pedido':
      return (
        <GradePortaPallets
          rows={detalhe.rows}
          colunas={COLUNAS_CLIENTES_FUNIL}
          rowKey={(r) => r.idCliente}
          defaultSortLevels={[{ id: 'valor', dir: 'desc' }]}
        />
      );
    case 'clientes':
    case 'primeira':
      return (
        <GradePortaPallets
          rows={detalhe.rows}
          colunas={COLUNAS_CLIENTES_MES}
          rowKey={(r) => r.idCliente}
          defaultSortLevels={[{ id: 'valor', dir: 'desc' }]}
        />
      );
    case 'conversao':
    case 'tempo':
      return (
        <GradePortaPallets
          rows={detalhe.rows}
          colunas={COLUNAS_CONVERSAO}
          rowKey={(r) => r.idProposta}
          defaultSortLevels={[{ id: 'abertura', dir: 'asc' }]}
        />
      );
    default:
      return null;
  }
}
