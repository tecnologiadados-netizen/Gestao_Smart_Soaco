import { X } from "lucide-react";
import { Badge } from "@qualidade/components/ui/badge";
import { Button } from "@qualidade/components/ui/button";
import { Dialog, DialogContent } from "@qualidade/components/ui/dialog";
import { CodigoDocumentoBadge } from "@qualidade/components/registros/codigo-documento-cell";
import { RccRelatorioPdfButton } from "@qualidade/components/registros/rcc-relatorio-pdf-button";
import { RncRelatorioPdfButton } from "@qualidade/components/registros/rnc-relatorio-pdf-button";
import { RccForm } from "@qualidade/components/registros/rcc-form";
import { RncForm } from "@qualidade/components/registros/rnc-form";
import {
  registroStatusLabels,
  registroTipoDescricoes,
  registroTipoLabels,
} from "@qualidade/lib/registros/constants";
import { useRegistrosStore } from "@qualidade/lib/store/registros-store";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import { formatarData, formatarDataHora } from "@qualidade/lib/utils/dates";
import {
  getRegistroCodigoDocumento,
  getRegistroDataOcorrencia,
} from "@qualidade/types/registro";
import { normalizarRccDados } from "@qualidade/types/rcc";

interface RegistroDetalheDialogProps {
  registroId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RegistroDetalheDialog({
  registroId,
  open,
  onOpenChange,
}: RegistroDetalheDialogProps) {
  const getRegistroById = useRegistrosStore((s) => s.getRegistroById);
  const users = useConfigStore((s) => s.users);

  const registro = registroId ? getRegistroById(registroId) : undefined;
  const responsavelSgq = users.find(
    (user) => user.id === registro?.responsavelId
  );

  if (!open || !registro) {
    return null;
  }

  const dataLabel =
    registro.tipo === "rcc" ? "Data da reclamação" : "Data ocorrência";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[min(90vh,100dvh)] w-full max-w-4xl flex-col gap-0 overflow-hidden p-0"
      >
        <div className="modal-header-bar flex shrink-0 items-center justify-between px-5 py-3.5">
          <div>
            <h2 className="text-base font-semibold text-white">
              {getRegistroCodigoDocumento(registro)}
            </h2>
            <p className="mt-0.5 text-xs text-white/80">
              {registroTipoLabels[registro.tipo]} ·{" "}
              {registroTipoDescricoes[registro.tipo]}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded p-1.5 hover:bg-white/20"
            aria-label="Fechar"
          >
            <X className="size-5 text-white" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{registroTipoLabels[registro.tipo]}</Badge>
            <Badge>{registroStatusLabels[registro.status]}</Badge>
            <CodigoDocumentoBadge registro={registro} />
          </div>

          <dl className="mb-6 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">{dataLabel}</dt>
              <dd className="font-medium">
                {formatarData(getRegistroDataOcorrencia(registro))}
              </dd>
            </div>
            {responsavelSgq && !registro.origemNomus ? (
              <div>
                <dt className="text-xs text-muted-foreground">
                  Registrado por (SGQ)
                </dt>
                <dd className="font-medium">{responsavelSgq.nome}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs text-muted-foreground">Criado em</dt>
              <dd className="font-medium">
                {formatarDataHora(registro.createdAt)}
              </dd>
            </div>
          </dl>

          {registro.tipo === "rnc" && registro.rnc ? (
            <RncForm
              dados={registro.rnc}
              onChange={() => {}}
              disabled
              modo="visualizar"
              origemNomus={registro.origemNomus}
            />
          ) : null}

          {registro.tipo === "rcc" && registro.rcc ? (
            <RccForm
              dados={normalizarRccDados(registro.rcc)}
              onChange={() => {}}
              disabled
              modo="visualizar"
              origemNomus={registro.origemNomus}
            />
          ) : null}

          {registro.origemNomus ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Registro importado do histórico do ERP. O código do documento
              corresponde à referência original para consulta.
            </p>
          ) : null}
        </div>

        <div className="sgq-form-footer justify-between gap-3">
          {registro.tipo === "rcc" && registro.rcc ? (
            <RccRelatorioPdfButton registro={registro} variant="outline" />
          ) : registro.tipo === "rnc" && registro.rnc ? (
            <RncRelatorioPdfButton registro={registro} variant="outline" />
          ) : (
            <span />
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
