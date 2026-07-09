"use client";

import { addDays, format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  DocumentPublicacao,
  DocumentValidade,
  ValidadeModo,
} from "@/types/document";
import { validadeModoSelectLabel } from "@/lib/utils/select-display";

export interface PublicacaoFormValues {
  solicitarRevisaoAposPublicacao: boolean;
  avisarPorEmail: boolean;
  validadeAtiva: boolean;
  validadeModo: ValidadeModo;
  validadePeriodoDias: number;
  validadeDataEspecifica: string;
}

export function defaultValidadeDataInput(dias = 365): string {
  return format(addDays(new Date(), dias), "yyyy-MM-dd");
}

export function defaultPublicacaoValues(): PublicacaoFormValues {
  return {
    solicitarRevisaoAposPublicacao: false,
    avisarPorEmail: true,
    validadeAtiva: false,
    validadeModo: "periodo",
    validadePeriodoDias: 365,
    validadeDataEspecifica: defaultValidadeDataInput(),
  };
}

function toDateInputValue(iso: string): string {
  return format(new Date(iso), "yyyy-MM-dd");
}

function fromDateInputValue(value: string): string {
  return new Date(`${value}T12:00:00`).toISOString();
}

export function publicacaoFromDocument(
  publicacao?: DocumentPublicacao,
  validade?: DocumentValidade
): PublicacaoFormValues {
  const modo = validade?.modo ?? (validade?.dataValidade ? "data" : "periodo");
  return {
    solicitarRevisaoAposPublicacao:
      publicacao?.solicitarRevisaoAposPublicacao ?? false,
    avisarPorEmail: publicacao?.avisarPorEmail ?? true,
    validadeAtiva: validade?.ativa ?? false,
    validadeModo: modo,
    validadePeriodoDias: validade?.periodoDias ?? 365,
    validadeDataEspecifica: validade?.dataValidade
      ? toDateInputValue(validade.dataValidade)
      : defaultValidadeDataInput(validade?.periodoDias ?? 365),
  };
}

export function toDocumentPublicacao(
  values: PublicacaoFormValues
): DocumentPublicacao {
  return {
    solicitarRevisaoAposPublicacao: values.solicitarRevisaoAposPublicacao,
    avisarPorEmail: values.avisarPorEmail,
  };
}

export function toDocumentValidade(
  values: PublicacaoFormValues
): DocumentValidade | undefined {
  if (!values.validadeAtiva) return undefined;

  if (values.validadeModo === "data") {
    return {
      ativa: true,
      modo: "data",
      periodoDias: values.validadePeriodoDias,
      dataValidade: fromDateInputValue(values.validadeDataEspecifica),
    };
  }

  return {
    ativa: true,
    modo: "periodo",
    periodoDias: values.validadePeriodoDias,
  };
}

interface Props {
  values: PublicacaoFormValues;
  onChange: (values: PublicacaoFormValues) => void;
}

export function DocumentoPublicacaoFieldset({ values, onChange }: Props) {
  function patch(partial: Partial<PublicacaoFormValues>) {
    onChange({ ...values, ...partial });
  }

  function handleModoChange(modo: ValidadeModo) {
    patch({
      validadeModo: modo,
      validadeDataEspecifica:
        modo === "data" && !values.validadeDataEspecifica
          ? defaultValidadeDataInput(values.validadePeriodoDias)
          : values.validadeDataEspecifica,
    });
  }

  return (
    <fieldset className="brand-fieldset space-y-3">
      <legend className="text-base">Publicação</legend>
      <label className="flex cursor-pointer items-center gap-3 text-base">
        <input
          type="checkbox"
          className="size-4 rounded border-input accent-brand-blue"
          checked={values.solicitarRevisaoAposPublicacao}
          onChange={(e) =>
            patch({ solicitarRevisaoAposPublicacao: e.target.checked })
          }
        />
        Solicitar revisão após publicação
      </label>
      <label className="flex cursor-pointer items-center gap-3 text-base">
        <input
          type="checkbox"
          className="size-4 rounded border-input accent-brand-blue"
          checked={values.avisarPorEmail}
          onChange={(e) => patch({ avisarPorEmail: e.target.checked })}
        />
        Avisar por e-mail
      </label>
      <label className="flex cursor-pointer items-center gap-3 text-base">
        <input
          type="checkbox"
          className="size-4 rounded border-input accent-brand-blue"
          checked={values.validadeAtiva}
          onChange={(e) => patch({ validadeAtiva: e.target.checked })}
        />
        Existe validade específica?
      </label>
      {values.validadeAtiva ? (
        <div className="space-y-4 rounded-lg border border-brand-blue-muted/50 bg-brand-blue-light/15 p-4">
          <div className="space-y-2">
            <Label className="text-base">Forma de validade *</Label>
            <Select
              value={values.validadeModo}
              onValueChange={(v) => v && handleModoChange(v as ValidadeModo)}
            >
              <SelectTrigger className="h-10 max-w-sm text-base">
                <SelectValue placeholder="Selecione a forma de validade">
                  {validadeModoSelectLabel(values.validadeModo) ?? null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="periodo">Por período (dias)</SelectItem>
                <SelectItem value="data">Data específica</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {values.validadeModo === "periodo" ? (
            <div className="space-y-2">
              <Label className="text-base" htmlFor="validade-periodo-dias">
                Validade (dias) *
              </Label>
              <Input
                id="validade-periodo-dias"
                type="number"
                min={1}
                max={3650}
                className="h-10 max-w-[160px] text-base"
                value={values.validadePeriodoDias}
                onChange={(e) =>
                  patch({
                    validadePeriodoDias: Math.max(
                      1,
                      Number.parseInt(e.target.value, 10) || 1
                    ),
                  })
                }
                required
              />
              <p className="text-xs text-muted-foreground">
                A data de vencimento será calculada na publicação e poderá ser
                ajustada a cada revalidação.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-base" htmlFor="validade-data-especifica">
                Data de vencimento *
              </Label>
              <Input
                id="validade-data-especifica"
                type="date"
                className="h-10 max-w-xs text-base"
                value={values.validadeDataEspecifica}
                min={format(new Date(), "yyyy-MM-dd")}
                onChange={(e) =>
                  patch({ validadeDataEspecifica: e.target.value })
                }
                required
              />
              <p className="text-xs text-muted-foreground">
                Informe a data exata de vencimento. Poderá ser ajustada a cada
                revalidação.
              </p>
            </div>
          )}
        </div>
      ) : null}
    </fieldset>
  );
}
