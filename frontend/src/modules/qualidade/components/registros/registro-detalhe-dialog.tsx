import { useEffect, useState } from "react";
import { Pencil, X } from "lucide-react";
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
import { validarRcc } from "@qualidade/lib/registros/validacao-rcc";
import { validarRnc } from "@qualidade/lib/registros/validacao-rnc";
import { useRegistrosStore } from "@qualidade/lib/store/registros-store";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import { persistQualidadeRegistro } from "@qualidade/lib/qualidadePersistence";
import { formatarData, formatarDataHora } from "@qualidade/lib/utils/dates";
import {
  getRegistroCodigoDocumento,
  getRegistroDataOcorrencia,
} from "@qualidade/types/registro";
import {
  normalizarRncDados,
  sincronizarAcoesApartadasLegado,
  type RncDados,
} from "@qualidade/types/rnc";
import { normalizarRccDados, type RccDados } from "@qualidade/types/rcc";

interface RegistroDetalheDialogProps {
  registroId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Abre o diálogo já em modo de edição. */
  editarAoAbrir?: boolean;
}

export function RegistroDetalheDialog({
  registroId,
  open,
  onOpenChange,
  editarAoAbrir = false,
}: RegistroDetalheDialogProps) {
  const getRegistroById = useRegistrosStore((s) => s.getRegistroById);
  const atualizarRegistroRnc = useRegistrosStore((s) => s.atualizarRegistroRnc);
  const atualizarRegistroRcc = useRegistrosStore((s) => s.atualizarRegistroRcc);
  const users = useConfigStore((s) => s.users);

  const registro = registroId ? getRegistroById(registroId) : undefined;
  const responsavelSgq = users.find(
    (user) => user.id === registro?.responsavelId
  );

  const [editando, setEditando] = useState(false);
  const [rncDraft, setRncDraft] = useState<RncDados | null>(null);
  const [rccDraft, setRccDraft] = useState<RccDados | null>(null);
  const [errosRnc, setErrosRnc] = useState<
    Partial<Record<keyof RncDados, string>>
  >({});
  const [errosRcc, setErrosRcc] = useState<
    Partial<Record<keyof RccDados, string>>
  >({});
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const podeEditar = Boolean(registro);

  useEffect(() => {
    if (!open || !registro) return;
    setEditando(editarAoAbrir && podeEditar);
    setRncDraft(registro.rnc ? { ...registro.rnc } : null);
    setRccDraft(registro.rcc ? normalizarRccDados(registro.rcc) : null);
    setErrosRnc({});
    setErrosRcc({});
    setErro("");
    setSalvando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, registroId, editarAoAbrir]);

  if (!open || !registro) {
    return null;
  }

  const dataLabel =
    registro.tipo === "rcc" ? "Data da reclamação" : "Data ocorrência";

  function iniciarEdicao() {
    if (!registro) return;
    setRncDraft(registro.rnc ? { ...registro.rnc } : null);
    setRccDraft(registro.rcc ? normalizarRccDados(registro.rcc) : null);
    setErrosRnc({});
    setErrosRcc({});
    setErro("");
    setEditando(true);
  }

  function cancelarEdicao() {
    if (!registro) return;
    setEditando(false);
    setRncDraft(registro.rnc ? { ...registro.rnc } : null);
    setRccDraft(registro.rcc ? normalizarRccDados(registro.rcc) : null);
    setErrosRnc({});
    setErrosRcc({});
    setErro("");
  }

  async function handleSalvar() {
    if (!registro) return;

    if (registro.tipo === "rnc" && rncDraft) {
      const validacao = validarRnc(rncDraft);
      if (!validacao.valido) {
        setErrosRnc(validacao.erros);
        setErro("Corrija os campos obrigatórios antes de salvar.");
        return;
      }

      const rncFinal = sincronizarAcoesApartadasLegado(
        normalizarRncDados(rncDraft)
      );
      const ok = atualizarRegistroRnc({ id: registro.id, rnc: rncFinal });
      if (!ok) {
        setErro("Não foi possível atualizar este registro.");
        return;
      }
    } else if (registro.tipo === "rcc" && rccDraft) {
      const validacao = validarRcc(rccDraft);
      if (!validacao.valido) {
        setErrosRcc(validacao.erros);
        setErro("Corrija os campos obrigatórios antes de salvar.");
        return;
      }

      const ok = atualizarRegistroRcc({ id: registro.id, rcc: rccDraft });
      if (!ok) {
        setErro("Não foi possível atualizar este registro.");
        return;
      }
    } else {
      return;
    }

    const atualizado = getRegistroById(registro.id);
    if (!atualizado) {
      setErro("Não foi possível localizar o registro atualizado.");
      return;
    }

    setSalvando(true);
    setErro("");
    try {
      await persistQualidadeRegistro(atualizado);
      setEditando(false);
    } catch (err) {
      setErro(
        err instanceof Error
          ? err.message
          : "Falha ao salvar as alterações no servidor. Tente novamente."
      );
    } finally {
      setSalvando(false);
    }
  }

  const codigoDocumento = getRegistroCodigoDocumento(registro);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[min(90vh,100dvh)] w-full max-w-4xl flex-col gap-0 overflow-hidden p-0"
      >
        <div className="modal-header-bar flex shrink-0 items-center justify-between px-5 py-3.5">
          <div>
            <h2 className="text-base font-semibold text-white">
              {editando ? `Editar ${codigoDocumento}` : codigoDocumento}
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

          {registro.tipo === "rnc" && (editando ? rncDraft : registro.rnc) ? (
            <RncForm
              dados={editando ? (rncDraft as RncDados) : (registro.rnc as RncDados)}
              onChange={setRncDraft}
              erros={editando ? errosRnc : {}}
              disabled={!editando}
              modo={editando ? "criar" : "visualizar"}
              origemNomus={registro.origemNomus}
              codigoDocumentoPreview={codigoDocumento}
              usuarioCriacaoNome={registro.rnc?.usuarioCriacao ?? ""}
            />
          ) : null}

          {registro.tipo === "rcc" && (editando ? rccDraft : registro.rcc) ? (
            <RccForm
              dados={
                editando
                  ? (rccDraft as RccDados)
                  : normalizarRccDados(registro.rcc as RccDados)
              }
              onChange={setRccDraft}
              erros={editando ? errosRcc : {}}
              disabled={!editando}
              modo={editando ? "criar" : "visualizar"}
              origemNomus={registro.origemNomus}
              codigoDocumentoPreview={codigoDocumento}
              usuarioCriacaoNome={registro.rcc?.usuarioCriacao ?? ""}
            />
          ) : null}

          {erro ? (
            <p className="mt-4 text-sm text-destructive" role="alert">
              {erro}
            </p>
          ) : null}

          {registro.origemNomus && !editando ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Registro importado do histórico do ERP. O código do documento
              corresponde à referência original e não pode ser alterado.
            </p>
          ) : null}
        </div>

        <div className="sgq-form-footer justify-between gap-3">
          {editando ? (
            <>
              <span />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={cancelarEdicao}
                  disabled={salvando}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleSalvar()}
                  disabled={salvando}
                >
                  {salvando ? "Salvando..." : "Salvar alterações"}
                </Button>
              </div>
            </>
          ) : (
            <>
              {registro.tipo === "rcc" && registro.rcc ? (
                <RccRelatorioPdfButton registro={registro} variant="outline" />
              ) : registro.tipo === "rnc" && registro.rnc ? (
                <RncRelatorioPdfButton registro={registro} variant="outline" />
              ) : (
                <span />
              )}
              <div className="flex flex-wrap gap-2">
                {podeEditar ? (
                  <Button type="button" onClick={iniciarEdicao}>
                    <Pencil className="mr-2 size-4" />
                    Editar
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Fechar
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
