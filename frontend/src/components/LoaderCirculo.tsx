import { useId } from 'react';

/**
 * Loader padrão do sistema: um ponto cai, se abre em arco, fecha o anel,
 * reabre no topo e despenca. As telas de DFC/DRE mantêm o loader de barras.
 *
 * São dois arcos espelhados porque o tracejado de um `circle` não dá a volta
 * no path fechado — sozinho ele nunca fecharia o anel. Cada arco cresce a
 * partir do fundo para um lado; juntos se encontram no topo.
 */
export type LoaderCirculoProps = {
  /** Diâmetro em pixels. */
  tamanho?: number;
  /** Gradiente do traço. Sem isso o traço herda `currentColor`. */
  cores?: [string, string];
  className?: string;
};

export default function LoaderCirculo({
  tamanho = 56,
  cores,
  className = '',
}: LoaderCirculoProps) {
  // useId gera ':' , inválido dentro de url(#...) em parte dos navegadores.
  const gradienteId = `loader-circulo-${useId().replace(/:/g, '')}`;
  const traco = cores ? `url(#${gradienteId})` : 'currentColor';

  const arco = (espelhado: boolean) => (
    <circle
      className="loader-circulo-traco"
      cx="28"
      cy="28"
      r="20"
      pathLength="100"
      fill="none"
      stroke={traco}
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
        {cores ? (
          <defs>
            {/* Vertical de propósito: um gradiente horizontal ficaria invertido no arco espelhado. */}
            <linearGradient id={gradienteId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cores[0]} />
              <stop offset="100%" stopColor={cores[1]} />
            </linearGradient>
          </defs>
        ) : null}
        {arco(false)}
        {arco(true)}
      </svg>
    </span>
  );
}
