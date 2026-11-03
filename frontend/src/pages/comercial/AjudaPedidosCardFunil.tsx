import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle } from 'lucide-react';
import type { ConciliacaoPedidos } from '../../api/portaPalletsComercial';
import { formatNumero } from '../../components/painel-comercial/painelComercialUtils';

function plural(n: number, um: string, varios: string): string {
  return `${formatNumero(n)} ${n === 1 ? um : varios}`;
}

/** Botão ? do card Valor vendido: explica por que os pedidos do card e do funil diferem. */
export default function AjudaPedidosCardFunil({ conciliacao }: { conciliacao: ConciliacaoPedidos }) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const aberto = pos != null;
  const ref = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const alternar = () => {
    if (aberto) {
      setPos(null);
      return;
    }
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
  };

  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (ref.current?.contains(alvo) || popRef.current?.contains(alvo)) return;
      setPos(null);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPos(null);
    };
    const fecharAoMover = () => setPos(null);
    document.addEventListener('mousedown', fechar);
    window.addEventListener('keydown', esc);
    window.addEventListener('resize', fecharAoMover);
    window.addEventListener('scroll', fecharAoMover, true);
    return () => {
      document.removeEventListener('mousedown', fechar);
      window.removeEventListener('keydown', esc);
      window.removeEventListener('resize', fecharAoMover);
      window.removeEventListener('scroll', fecharAoMover, true);
    };
  }, [aberto]);

  const c = conciliacao;
  const diferenca = c.pedidosCard - c.pedidosFunil;
  const aMais = [
    c.propostaAnterior > 0 ? plural(c.propostaAnterior, 'pedido de proposta aberta antes do recorte', 'pedidos de propostas abertas antes do recorte') : null,
    c.semProposta > 0 ? plural(c.semProposta, 'pedido sem proposta', 'pedidos sem proposta') : null,
  ].filter(Boolean) as string[];
  const aMenos = [
    c.geradosForaDaVenda > 0
      ? plural(c.geradosForaDaVenda, 'pedido gerado que não entra na venda (ex.: item cancelado)', 'pedidos gerados que não entram na venda (ex.: item cancelado)')
      : null,
    c.geradosForaDoPeriodo > 0
      ? plural(c.geradosForaDoPeriodo, 'pedido gerado emitido depois do recorte', 'pedidos gerados emitidos depois do recorte')
      : null,
  ].filter(Boolean) as string[];

  return (
    <div
      ref={ref}
      className="relative"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        ref={btnRef}
        type="button"
        onClick={alternar}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-slate-100"
        title="Por que o card tem pedidos diferentes do funil?"
        aria-label="Por que o card tem pedidos diferentes do funil?"
        aria-expanded={aberto}
      >
        <HelpCircle className="h-4 w-4" strokeWidth={2.2} />
      </button>
      {pos && typeof document !== 'undefined'
        ? createPortal(
        <div
          ref={popRef}
          role="dialog"
          style={{ top: pos.top, right: pos.right }}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-[10030] w-80 max-w-[calc(100vw-1rem)] cursor-default rounded-xl border border-slate-200 bg-white p-3 text-left text-xs text-slate-700 shadow-2xl dark:border-white/10 dark:bg-[#12141c] dark:text-slate-200"
        >
          <p className="font-semibold text-slate-900 dark:text-white">Card {formatNumero(c.pedidosCard)} · funil {formatNumero(c.pedidosFunil)}</p>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            O card soma todos os pedidos emitidos no recorte. O funil conta só os pedidos gerados pelas propostas abertas no
            recorte.
          </p>
          {diferenca === 0 && aMais.length === 0 && aMenos.length === 0 ? (
            <p className="mt-2">Neste recorte os dois são iguais.</p>
          ) : (
            <>
              {aMais.length > 0 ? (
                <div className="mt-2">
                  <p className="font-semibold">No card e fora do funil</p>
                  <ul className="mt-0.5 list-disc pl-4">
                    {aMais.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {aMenos.length > 0 ? (
                <div className="mt-2">
                  <p className="font-semibold">No funil e fora do card</p>
                  <ul className="mt-0.5 list-disc pl-4">
                    {aMenos.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </div>,
            document.body
          )
        : null}
    </div>
  );
}
