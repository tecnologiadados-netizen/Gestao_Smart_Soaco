import { SgqAnexosTable } from "@qualidade/components/ui/sgq-anexos-table";
import { SgqArquivoAcoes } from "@qualidade/components/documentos/sgq-arquivo-imprimir-btn";
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
    <SgqArquivoAcoes
      arquivo={{ nome, dataUrl, storagePath }}
      variant="ghost"
      size="sm"
      className="h-8 gap-1.5 text-xs text-brand-blue"
      labeled
    />
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
