import type { ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { formatNumber } from '../../utils/painelProducaoFormat';
import type { PainelProducaoPedidoDetalhe } from '../../api/painelProducao';

interface ProducaoPedidosKpiProps {
  producao: number;
  pedidosDetalhe: PainelProducaoPedidoDetalhe[];
  resetKey: string;
  icon: ReactNode;
}

export function ProducaoPedidosKpi({
  producao,
  pedidosDetalhe,
  resetKey,
  icon,
}: ProducaoPedidosKpiProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();

  useEffect(() => {
    setOpen(false);
  }, [resetKey]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div className="kpi-pedidos-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`kpi-card-modern kpi-card-production kpi-card-clickable${open ? ' is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={popoverId}
        aria-label="Produção em pedidos. Clique para ver detalhes."
      >
        <div className="kpi-card-body">
          <div className="kpi-icon">{icon}</div>
          <div className="kpi-label">Produção</div>
          <div className="kpi-value">{formatNumber(producao)}</div>
          <div className="kpi-sub">Pedidos</div>
          <span className="kpi-click-hint">Clique para ver pedidos</span>
        </div>
        <div className="kpi-accent" aria-hidden="true" />
      </button>
      {open && (
        <div
          id={popoverId}
          className="pedidos-detalhe-popover"
          role="dialog"
          aria-label="Pedidos contabilizados na produção"
        >
          <div className="pedidos-detalhe-header">
            <h3>Pedidos contabilizados</h3>
            <span className="pedidos-detalhe-count">
              {pedidosDetalhe.length} pedido{pedidosDetalhe.length !== 1 ? 's' : ''}
            </span>
          </div>
          {pedidosDetalhe.length > 0 ? (
            <ul className="pedidos-detalhe-list">
              {pedidosDetalhe.map((pedido) => (
                <li key={pedido.codigo_pedido} className="pedidos-detalhe-item">
                  <div className="pedidos-detalhe-pedido">
                    <span className="pedidos-detalhe-codigo">{pedido.codigo_pedido}</span>
                    <span className="pedidos-detalhe-cliente">{pedido.cliente}</span>
                  </div>
                  <ul className="pedidos-detalhe-itens">
                    {pedido.itens.map((item) => (
                      <li key={`${pedido.codigo_pedido}-${item.codigo}-${item.descricao}`}>
                        <span className="pedidos-detalhe-item-codigo">{item.codigo}</span>
                        <span className="pedidos-detalhe-item-desc">{item.descricao}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pedidos-detalhe-empty">Nenhum pedido encontrado para este período.</p>
          )}
        </div>
      )}
    </div>
  );
}
