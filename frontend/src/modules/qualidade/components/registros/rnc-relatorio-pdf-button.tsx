import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@qualidade/components/ui/button";
import { baixarRncRelatorioPdf } from "@qualidade/lib/registros/rnc-relatorio-pdf";
import type { Registro } from "@qualidade/types/registro";

interface RncRelatorioPdfButtonProps {
  registro: Registro;
  variant?: "default" | "outline";
  size?: "default" | "sm";
}

export function RncRelatorioPdfButton({
  registro,
  variant = "default",
  size = "default",
}: RncRelatorioPdfButtonProps) {
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");

  async function handleGerarPdf() {
    setGerando(true);
    setErro("");
    try {
      await baixarRncRelatorioPdf(registro);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o PDF."
      );
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={gerando}
        onClick={() => void handleGerarPdf()}
      >
        {gerando ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <FileDown className="size-4" />
        )}
        Gerar relatório PDF
      </Button>
      {erro ? (
        <p className="text-xs text-destructive" role="alert">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
