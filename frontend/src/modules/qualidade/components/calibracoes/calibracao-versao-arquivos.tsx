import { Download, ExternalLink } from "lucide-react";
import { Button } from "@qualidade/components/ui/button";
import { SgqAnexosTable } from "@qualidade/components/ui/sgq-anexos-table";
import {
  downloadQualidadeArquivo,
  openQualidadeArquivo,
} from "@qualidade/lib/documents/file-actions";
import type { EquipmentAnexo } from "@qualidade/types/calibration";

function ArquivoActions({
  dataUrl,
  storagePath,
  nome,
}: {
  dataUrl?: string;
  storagePath?: string;
  nome: string;
}) {
  return (
    <div className="flex gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 text-xs text-brand-blue"
        onClick={() => {
          void openQualidadeArquivo({ nome, dataUrl, storagePath }, "view");
        }}
      >
        <ExternalLink className="size-3.5" />
        Visualizar
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={() => {
          void downloadQualidadeArquivo({ nome, dataUrl, storagePath });
        }}
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

  const rows = anexos.map((anexo, index) => ({
    id: `anexo-${index}-${anexo.nome}`,
    nome: anexo.nome,
    dataUrl: anexo.dataUrl,
    ...(anexo.storagePath ? { storagePath: anexo.storagePath } : {}),
  }));

  return (
    <div className="mt-3 border-t border-border/60 pt-3">
      <SgqAnexosTable
        label={`Anexos (${anexos.length})`}
        anexos={rows}
        onChange={() => {}}
        disabled
        readOnlyEmptyMessage="Nenhum anexo."
      />
    </div>
  );
}

export { ArquivoActions as CalibracaoArquivoActions };
