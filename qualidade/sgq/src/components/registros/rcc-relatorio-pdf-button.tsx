"use client";

import { useState } from "react";
import { Building2, FileDown, Loader2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  baixarRccRelatorioPdf,
  type RccPdfVersao,
} from "@/lib/registros/rcc-relatorio-pdf";
import type { Registro } from "@/types/registro";

interface RccRelatorioPdfButtonProps {
  registro: Registro;
  variant?: "default" | "outline";
  size?: "default" | "sm";
}

export function RccRelatorioPdfButton({
  registro,
  variant = "default",
  size = "default",
}: RccRelatorioPdfButtonProps) {
  const [dialogAberto, setDialogAberto] = useState(false);
  const [gerandoVersao, setGerandoVersao] = useState<RccPdfVersao | null>(null);
  const [erro, setErro] = useState("");

  async function handleGerarPdf(versao: RccPdfVersao) {
    setGerandoVersao(versao);
    setErro("");
    try {
      await baixarRccRelatorioPdf(registro, versao);
      setDialogAberto(false);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o PDF."
      );
    } finally {
      setGerandoVersao(null);
    }
  }

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <Button
          type="button"
          variant={variant}
          size={size}
          onClick={() => {
            setErro("");
            setDialogAberto(true);
          }}
        >
          <FileDown className="size-4" />
          Gerar relatório PDF
        </Button>
        {erro && !dialogAberto ? (
          <p className="text-xs text-destructive" role="alert">
            {erro}
          </p>
        ) : null}
      </div>

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-md text-center">
          <DialogHeader className="items-center text-center">
            <DialogTitle>Gerar relatório PDF</DialogTitle>
            <DialogDescription>
              Escolha qual versão do formulário RCC deseja gerar.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            <Button
              type="button"
              size="lg"
              className="h-auto min-h-14 justify-center gap-3 px-4 py-4"
              disabled={gerandoVersao !== null}
              onClick={() => void handleGerarPdf("cliente")}
            >
              {gerandoVersao === "cliente" ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <UserRound className="size-5" />
              )}
              <span>PDF — Versão Cliente</span>
            </Button>

            <Button
              type="button"
              size="lg"
              variant="outline"
              className="h-auto min-h-14 justify-center gap-3 px-4 py-4"
              disabled={gerandoVersao !== null}
              onClick={() => void handleGerarPdf("empresa")}
            >
              {gerandoVersao === "empresa" ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Building2 className="size-5" />
              )}
              <span>PDF — Versão Empresa</span>
            </Button>
          </div>

          {erro ? (
            <p className="text-sm text-destructive" role="alert">
              {erro}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
