import { useEffect, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

const TOKENS = [
  "--popover",
  "--popover-foreground",
  "--border",
  "--muted",
  "--muted-foreground",
  "--foreground",
  "--primary",
  "--card",
] as const;

function tokensDoCampo(origem: HTMLElement): CSSProperties {
  const estilo = getComputedStyle(origem);
  const copiados: Record<string, string> = {};
  for (const nome of TOKENS) {
    const valor = estilo.getPropertyValue(nome).trim();
    if (valor) copiados[nome] = valor;
  }
  return copiados;
}

/** Lista de sugestão fora do fluxo da tabela, para não ser cortada pelo overflow da grade. */
export function ListaSugestaoFlutuante({
  aberto,
  ancoraRef,
  id,
  children,
  cabecalho,
}: {
  aberto: boolean;
  ancoraRef: RefObject<HTMLElement | null>;
  id?: string;
  children: ReactNode;
  cabecalho?: ReactNode;
}) {
  const [caixa, setCaixa] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    tokens: CSSProperties;
  } | null>(null);

  useEffect(() => {
    if (!aberto) return;

    function posicionar() {
      const ancora = ancoraRef.current;
      if (!ancora) return;
      const retangulo = ancora.getBoundingClientRect();
      const margem = 8;
      const espacoAbaixo = window.innerHeight - retangulo.bottom - margem;
      const espacoAcima = retangulo.top - margem;
      const abrirAcima = espacoAbaixo < 160 && espacoAcima > espacoAbaixo;
      const maxHeight = Math.max(
        120,
        Math.min(224, abrirAcima ? espacoAcima : espacoAbaixo)
      );
      const top = abrirAcima
        ? Math.max(margem, retangulo.top - margem - maxHeight)
        : retangulo.bottom + 4;

      setCaixa({
        top,
        left: retangulo.left,
        width: retangulo.width,
        maxHeight,
        tokens: tokensDoCampo(ancora),
      });
    }

    posicionar();
    window.addEventListener("resize", posicionar);
    window.addEventListener("scroll", posicionar, true);
    return () => {
      window.removeEventListener("resize", posicionar);
      window.removeEventListener("scroll", posicionar, true);
    };
  }, [aberto, ancoraRef]);

  if (!aberto || !caixa || typeof document === "undefined") return null;

  const estilo = {
    position: "fixed" as const,
    top: caixa.top,
    left: caixa.left,
    width: caixa.width,
    maxHeight: caixa.maxHeight,
    zIndex: 200,
    ...caixa.tokens,
  };

  if (cabecalho) {
    return createPortal(
      <div
        data-lista-sugestao=""
        style={estilo}
        className="qualidade-portal flex flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {cabecalho}
        <ul id={id} role="listbox" className="min-h-0 flex-1 overflow-auto py-1">
          {children}
        </ul>
      </div>,
      document.body
    );
  }

  return createPortal(
    <ul
      id={id}
      role="listbox"
      data-lista-sugestao=""
      style={estilo}
      className="qualidade-portal overflow-auto rounded-lg border border-border bg-popover py-1 text-popover-foreground shadow-lg"
      onMouseDown={(event) => event.stopPropagation()}
    >
      {children}
    </ul>,
    document.body
  );
}
