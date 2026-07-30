/**
 * Loader padrão do sistema: um ponto cai, se abre em arco, fecha o anel,
 * reabre no topo e despenca. O traço herda `currentColor`.
 *
 * São dois arcos espelhados porque o tracejado de um `circle` não dá a volta
 * no path fechado — sozinho ele nunca fecharia o anel. Cada arco cresce a
 * partir do fundo para um lado; juntos se encontram no topo.
 */
export type LoaderCirculoProps = {
  /** Diâmetro em pixels. */
  tamanho?: number;
  className?: string;
};

export default function LoaderCirculo({ tamanho = 48, className = '' }: LoaderCirculoProps) {
  const arco = (espelhado: boolean) => (
    <circle
      className="loader-circulo-traco"
      cx="28"
      cy="28"
      r="20"
      pathLength="100"
      fill="none"
      stroke="currentColor"
      strokeWidth="5"
      strokeLinecap="round"
      transform={espelhado ? 'scale(-1,1) translate(-56,0)' : undefined}
    />
  );

  return (
    <span
      className={`loader-circulo ${className}`.trim()}
      style={{ width: tamanho, height: tamanho }}
      aria-hidden
    >
      <svg viewBox="0 0 56 56" width={tamanho} height={tamanho}>
        {arco(false)}
        {arco(true)}
      </svg>
    </span>
  );
}
