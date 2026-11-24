import { ChevronDown, MoreHorizontal } from "lucide-react";
import { Button } from "@qualidade/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@qualidade/components/ui/dropdown-menu";

interface RegistroAcoesMenuProps {
  onClonar?: () => void;
  onCancelar?: () => void;
  onExcluir?: () => void;
  clonando?: boolean;
  cloneDisabled?: boolean;
  /** `botao` no rodapé do detalhe; `icone` na grade. */
  variante?: "botao" | "icone";
}

/**
 * Mesmas decisões do detalhe de documentos: ações secundárias
 * (clonar e excluir) ficam em "Mais ações". Editar e cancelar
 * ficam fora, como ação principal do contexto.
 */
export function RegistroAcoesMenu({
  onClonar,
  onCancelar,
  onExcluir,
  clonando = false,
  cloneDisabled = false,
  variante = "botao",
}: RegistroAcoesMenuProps) {
  if (!onClonar && !onCancelar && !onExcluir) return null;
  const temAcaoAntesDeExcluir = Boolean(onClonar || onCancelar);

  const gatilho =
    variante === "icone" ? (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title="Mais ações"
        aria-label="Mais ações"
      />
    ) : (
      <Button type="button" variant="outline" className="gap-1.5" />
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={gatilho}>
        {variante === "icone" ? (
          <MoreHorizontal className="size-4" />
        ) : (
          <>
            Mais ações
            <ChevronDown className="size-4" aria-hidden />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side={variante === "icone" ? "bottom" : "top"}
        className="min-w-44"
      >
        {onClonar ? (
          <DropdownMenuItem
            disabled={clonando || cloneDisabled}
            onClick={onClonar}
          >
            {clonando ? "Clonando..." : "Clonar"}
          </DropdownMenuItem>
        ) : null}
        {onCancelar ? (
          <DropdownMenuItem onClick={onCancelar}>Cancelar</DropdownMenuItem>
        ) : null}
        {temAcaoAntesDeExcluir && onExcluir ? <DropdownMenuSeparator /> : null}
        {onExcluir ? (
          <DropdownMenuItem variant="destructive" onClick={onExcluir}>
            Excluir
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
