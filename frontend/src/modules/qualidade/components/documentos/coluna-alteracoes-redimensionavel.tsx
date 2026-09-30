import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

const LARGURA_INICIAL = 320;
const LARGURA_MINIMA = 180;
const LARGURA_MAXIMA = 960;

export function useLarguraColunaAlteracoes() {
  const [largura, setLargura] = useState(LARGURA_INICIAL);
  const larguraRef = useRef(largura);
  larguraRef.current = largura;

  function iniciarAjuste(event: ReactPointerEvent<HTMLSpanElement>) {
    event.preventDefault();
    event.stopPropagation();
    const inicioX = event.clientX;
    const inicio = larguraRef.current;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function mover(ev: PointerEvent) {
      const proxima = Math.min(
        LARGURA_MAXIMA,
        Math.max(LARGURA_MINIMA, Math.round(inicio + ev.clientX - inicioX))
      );
      setLargura((atual) => (atual === proxima ? atual : proxima));
    }

    function soltar() {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
    }

    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  }

  return { largura, iniciarAjuste };
}

export function AlcaLarguraColuna({
  onPointerDown,
}: {
  onPointerDown: (event: ReactPointerEvent<HTMLSpanElement>) => void;
}) {
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label="Ajustar largura da coluna"
      title="Arraste para ajustar a largura"
      className="absolute top-0 right-0 z-10 flex h-full w-2 cursor-col-resize touch-none items-center justify-center"
      onPointerDown={onPointerDown}
    >
      <span className="h-1/2 w-px rounded-full bg-border" />
    </span>
  );
}
