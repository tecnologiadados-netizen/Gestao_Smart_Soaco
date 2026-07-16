import { Paperclip } from "lucide-react";
import { useToast } from "@rh/hooks/use-toast";
import { openAusenciaLaunchAttachment, type AusenciaLaunchAttachment } from "@rh/lib/launch-document-access";

type Props = {
  attachment: AusenciaLaunchAttachment;
};

export function FaltaAusenciaAttachmentActions({ attachment }: Props) {
  const { toast } = useToast();

  const handleOpen = async () => {
    try {
      await openAusenciaLaunchAttachment(attachment);
    } catch (error) {
      toast({
        title: "Não foi possível abrir",
        description: error instanceof Error ? error.message : "Documento indisponível.",
        variant: "destructive",
      });
    }
  };

  return (
    <button
      type="button"
      title={`Visualizar anexo: ${attachment.title}`}
      aria-label={`Visualizar anexo ${attachment.title}`}
      onClick={() => void handleOpen()}
      className="shrink-0 p-1.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted/80"
    >
      <Paperclip className="w-3.5 h-3.5" />
    </button>
  );
}
