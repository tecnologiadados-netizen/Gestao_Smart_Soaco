import { useMemo, useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@qualidade/components/ui/dialog";
import { Button } from "@qualidade/components/ui/button";
import { AvaliacaoFornecedorDetalheConteudo } from "@qualidade/components/avaliacao-fornecedor/avaliacao-fornecedor-detalhe-conteudo";
import { baixarAvaliacaoFornecedorPdf } from "@qualidade/lib/avaliacao-fornecedor/gerar-avaliacao-fornecedor-pdf";
import { montarDetalheAvaliacao } from "@qualidade/lib/avaliacao-fornecedor/montar-detalhe-avaliacao";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import { useAvaliacaoFornecedorStore } from "@qualidade/lib/store/avaliacao-fornecedor-store";
import type { AvaliacaoFornecedor } from "@qualidade/types/avaliacao-fornecedor";

interface AvaliacaoDetalheDialogProps {
  avaliacao: AvaliacaoFornecedor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AvaliacaoDetalheDialog({
  avaliacao,
  open,
  onOpenChange,
}: AvaliacaoDetalheDialogProps) {
  const users = useConfigStore((s) => s.users);
  const avaliacoes = useAvaliacaoFornecedorStore((s) => s.avaliacoes);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [erroPdf, setErroPdf] = useState("");

  const viewModel = useMemo(() => {
    if (!avaliacao) return null;
    return montarDetalheAvaliacao(avaliacao, avaliacoes, users);
  }, [avaliacao, avaliacoes, users]);

  if (!avaliacao || !viewModel) return null;

  async function handleEmitirPdf() {
    setGerandoPdf(true);
    setErroPdf("");
    try {
      await baixarAvaliacaoFornecedorPdf(viewModel);
    } catch (error) {
      setErroPdf(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o PDF."
      );
    } finally {
      setGerandoPdf(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[min(92vh,100dvh)] max-w-lg gap-0 overflow-hidden p-0">
          <div className="max-h-[min(92vh,100dvh)] overflow-y-auto">
            <AvaliacaoFornecedorDetalheConteudo viewModel={viewModel} />
          </div>

          <div className="sgq-form-footer justify-between gap-3">
            <div className="min-w-0 flex-1">
              {erroPdf ? (
                <p className="text-xs text-destructive" role="alert">
                  {erroPdf}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="default"
                disabled={gerandoPdf}
                onClick={() => void handleEmitirPdf()}
              >
                {gerandoPdf ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileDown className="size-4" />
                )}
                Emitir PDF
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
  );
}
