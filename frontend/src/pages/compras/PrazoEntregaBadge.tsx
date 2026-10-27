/** Prazo da entrega do item de pedido de compra: sem data, atrasada ou vencendo. */
export function rotuloPrazoEntrega(dias: number | null): string {
  if (dias == null) return 'Sem data';
  if (dias < 0) return `Atrasada há ${-dias} ${dias === -1 ? 'dia' : 'dias'}`;
  if (dias === 0) return 'Vence hoje';
  return `Vence em ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
}

export function classePrazoEntrega(dias: number | null): string {
  if (dias == null || dias < 0) {
    return 'border-red-300 bg-red-50 text-red-800 dark:border-red-500/60 dark:bg-red-500/15 dark:text-red-200';
  }
  return 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/60 dark:bg-amber-500/15 dark:text-amber-100';
}

export default function PrazoEntregaBadge({ dias }: { dias: number | null }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${classePrazoEntrega(dias)}`}
    >
      {rotuloPrazoEntrega(dias)}
    </span>
  );
}
