import { Download, ExternalLink } from "lucide-react";
import { Button } from "@qualidade/components/ui/button";
import {
  downloadDocumentFile,
  openDocumentFileViewer,
} from "@qualidade/lib/documents/file-actions";
import type { EquipmentAnexo } from "@qualidade/types/calibration";

function ArquivoActions({ dataUrl, nome }: { dataUrl: string; nome: string }) {
  return (
    <div className="flex gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 text-xs text-brand-blue"
        onClick={() => openDocumentFileViewer(dataUrl, nome, "view")}
      >
        <ExternalLink className="size-3.5" />
        Visualizar
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={() => downloadDocumentFile(dataUrl, nome)}
      >
        <Download className="size-3.5" />
        Baixar
      </Button>
    </div>
  );
}

export function CalibracaoVersaoAnexosList({
  anexos,
}: {
  anexos: EquipmentAnexo[];
}) {
  if (!anexos.length) return null;

  return (
    <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
      <p className="text-xs font-medium text-muted-foreground">
        Anexos ({anexos.length})
      </p>
      <ul className="space-y-2">
        {anexos.map((anexo) => (
          <li
            key={`${anexo.nome}-${anexo.dataUrl.slice(0, 24)}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 bg-background/60 px-3 py-2"
          >
            <span className="min-w-0 flex-1 truncate text-sm">{anexo.nome}</span>
            <ArquivoActions dataUrl={anexo.dataUrl} nome={anexo.nome} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export { ArquivoActions as CalibracaoArquivoActions };
