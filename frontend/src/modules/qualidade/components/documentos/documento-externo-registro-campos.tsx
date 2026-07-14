import { useMemo } from "react";
import { format } from "date-fns";
import { Input } from "@qualidade/components/ui/input";
import { Label } from "@qualidade/components/ui/label";
import { Textarea } from "@qualidade/components/ui/textarea";
import { SgqAnexosTable } from "@qualidade/components/ui/sgq-anexos-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qualidade/components/ui/select";
import {
  MultiSelectSearch,
  type MultiSelectOption,
} from "@qualidade/components/ui/multi-select-search";
import type {
  Document,
  DocumentExternoRegistro,
  DocumentPermissoes,
  DocumentValidade,
  PermissaoAcessoDocumento,
} from "@qualidade/types/document";
import type { Department, User } from "@qualidade/types/user";
import {
  departmentSelectLabel,
  permissaoAcessoSelectLabel,
  userSelectLabel,
} from "@qualidade/lib/utils/select-display";
import type { SgqAnexo } from "@qualidade/types/registro-anexo";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import { buildLocalizacaoOpcoes } from "@qualidade/lib/enderecamentos-sync";

export interface ExternoRegistroFormValues {
  titulo: string;
  unidadeTodos: boolean;
  processoId: string;
  distEletronica: boolean;
  distFisica: boolean;
  localizacao: string;
  responsavelId: string;
  definirValidade: boolean;
  validadeData: string;
  avisarAntes: boolean;
  avisarAntesDias: number;
  anexos: SgqAnexo[];
  observacao: string;
  associarDocumentos: boolean;
  documentosAssociadosIds: string[];
  avisoEmailIds: string[];
  permissaoAcesso: PermissaoAcessoDocumento | "";
}

const selectTriggerClass =
  "h-10 w-full min-w-0 *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal";

const selectContentClass = "min-w-[var(--anchor-width)] w-max max-w-md";

const selectItemClass = "py-2.5 whitespace-normal text-base leading-snug";

function defaultValidadeData(): string {
  return format(new Date(Date.now() + 365 * 86400000), "yyyy-MM-dd");
}

export function defaultExternoRegistroValues(
  responsavelId = ""
): ExternoRegistroFormValues {
  return {
    titulo: "",
    unidadeTodos: true,
    processoId: "",
    distEletronica: true,
    distFisica: false,
    localizacao: "",
    responsavelId,
    definirValidade: false,
    validadeData: defaultValidadeData(),
    avisarAntes: false,
    avisarAntesDias: 30,
    anexos: [],
    observacao: "",
    associarDocumentos: false,
    documentosAssociadosIds: [],
    avisoEmailIds: [],
    permissaoAcesso: "",
  };
}

function fromDateInputValue(value: string): string {
  return new Date(`${value}T12:00:00`).toISOString();
}

export function buildValidadeFromExternoRegistro(
  values: ExternoRegistroFormValues
): DocumentValidade | undefined {
  if (!values.definirValidade || !values.validadeData) return undefined;
  return {
    ativa: true,
    modo: "data",
    periodoDias: 365,
    dataValidade: fromDateInputValue(values.validadeData),
  };
}

export function buildExternoRegistroMeta(
  values: ExternoRegistroFormValues
): DocumentExternoRegistro {
  const anexosPreenchidos = values.anexos
    .filter((a) => a.nome.trim() && a.dataUrl.trim())
    .map((a) => ({ nome: a.nome.trim(), dataUrl: a.dataUrl.trim() }));

  return {
    unidadeTodos: values.unidadeTodos,
    distribuicaoEletronica: values.distEletronica,
    distribuicaoFisica: values.distFisica,
    avisarAntesAtivo: values.avisarAntes,
    avisarAntesDias: values.avisarAntesDias,
    observacao: values.observacao.trim() || undefined,
    associarDocumentos: values.associarDocumentos,
    documentosAssociadosIds: values.documentosAssociadosIds,
    permissaoAcesso: (values.permissaoAcesso ||
      "todos") as PermissaoAcessoDocumento,
    anexos: anexosPreenchidos.length > 0 ? anexosPreenchidos : undefined,
  };
}

export function buildPermissoesFromExternoRegistro(
  values: ExternoRegistroFormValues
): DocumentPermissoes {
  const consultarTodos = values.permissaoAcesso === "todos";
  return {
    avisoPublicacaoEmailIds: values.avisoEmailIds,
    baixarArquivoIds: [],
    imprimirArquivoIds: [],
    copiasDistribuidasIds: [],
    consultarTodos,
    consultarIds: consultarTodos ? [] : values.avisoEmailIds,
  };
}

interface Props {
  values: ExternoRegistroFormValues;
  onChange: (values: ExternoRegistroFormValues) => void;
  users: User[];
  departments: Department[];
  documents: Document[];
  showTitulo?: boolean;
  showProcesso?: boolean;
  showValidade?: boolean;
}

export function DocumentoExternoRegistroCampos({
  values,
  onChange,
  users,
  departments,
  documents,
  showTitulo = true,
  showProcesso = true,
  showValidade = true,
}: Props) {
  const enderecamentos = useConfigStore((s) => s.enderecamentos);

  function patch(partial: Partial<ExternoRegistroFormValues>) {
    onChange({ ...values, ...partial });
  }

  const localizacaoOpcoes = useMemo(
    () => buildLocalizacaoOpcoes(enderecamentos, departments, values.localizacao),
    [departments, enderecamentos, values.localizacao]
  );

  const localizacaoLabel =
    localizacaoOpcoes.find((opcao) => opcao.value === values.localizacao)?.label ??
    (values.localizacao.trim() || null);

  const userOptions: MultiSelectOption[] = users
    .filter((u) => u.ativo)
    .map((u) => ({ value: u.id, label: u.nome, description: u.email }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

  const documentoOptions: MultiSelectOption[] = documents
    .map((d) => ({
      value: d.id,
      label: `${d.codigo} — ${d.titulo}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

  const processoNome = departmentSelectLabel(departments, values.processoId, "sigla-nome");
  const responsavelNome = userSelectLabel(users, values.responsavelId);
  const permissaoAcessoNome = permissaoAcessoSelectLabel(values.permissaoAcesso);

  return (
    <div className="space-y-6">
      <fieldset className="brand-fieldset space-y-4">
        <legend className="text-base">Identificação</legend>

        {showTitulo ? (
          <div className="space-y-2">
            <Label className="text-base">Título *</Label>
            <Input
              value={values.titulo}
              onChange={(e) => patch({ titulo: e.target.value })}
              className="h-10 text-base"
              required
            />
          </div>
        ) : null}

        {showProcesso ? (
          <div className="space-y-2">
            <Label className="text-base">Setor *</Label>
            <Select
              value={values.processoId}
              onValueChange={(v) => v && patch({ processoId: v })}
            >
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue placeholder="Selecione">
                  {processoNome ?? null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className={selectContentClass}>
                {departments.map((d) => (
                  <SelectItem
                    key={d.id}
                    value={d.id}
                    className={selectItemClass}
                  >
                    {d.sigla} — {d.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label className="text-base">Distribuição *</Label>
          <div className="flex flex-wrap gap-6">
            <label className="flex cursor-pointer items-center gap-3 text-base">
              <input
                type="checkbox"
                className="size-4 rounded border-input accent-brand-blue"
                checked={values.distEletronica}
                onChange={(e) => patch({ distEletronica: e.target.checked })}
              />
              Eletrônica
            </label>
            <label className="flex cursor-pointer items-center gap-3 text-base">
              <input
                type="checkbox"
                className="size-4 rounded border-input accent-brand-blue"
                checked={values.distFisica}
                onChange={(e) => patch({ distFisica: e.target.checked })}
              />
              Física
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-base">Localização *</Label>
          <Select
            value={values.localizacao}
            onValueChange={(v) => v && patch({ localizacao: v })}
          >
            <SelectTrigger className={selectTriggerClass}>
              <SelectValue placeholder="Selecione onde o documento está armazenado">
                {localizacaoLabel}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className={selectContentClass}>
              {localizacaoOpcoes.length === 0 ? (
                <SelectItem value="__vazio__" disabled className={selectItemClass}>
                  Cadastre endereços em Configurações → Endereçamento
                </SelectItem>
              ) : (
                localizacaoOpcoes.map((opcao) => (
                  <SelectItem
                    key={opcao.value}
                    value={opcao.value}
                    className={selectItemClass}
                  >
                    {opcao.label}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-base">Responsável *</Label>
          <Select
            value={values.responsavelId}
            onValueChange={(v) => v && patch({ responsavelId: v })}
          >
            <SelectTrigger className={selectTriggerClass}>
              <SelectValue placeholder="Selecione">
                {responsavelNome ?? null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className={selectContentClass}>
              {users
                .filter((u) => u.ativo)
                .map((u) => (
                  <SelectItem
                    key={u.id}
                    value={u.id}
                    className={selectItemClass}
                  >
                    {u.nome}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </fieldset>

      {showValidade ? (
        <fieldset className="brand-fieldset space-y-4">
          <legend className="text-base">Validade e alertas</legend>
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex cursor-pointer items-center gap-3 text-base">
              <input
                type="checkbox"
                className="size-4 rounded border-input accent-brand-blue"
                checked={values.definirValidade}
                onChange={(e) => patch({ definirValidade: e.target.checked })}
              />
              Definir validade
            </label>
            {values.definirValidade ? (
              <Input
                type="date"
                className="h-10 max-w-xs text-base"
                value={values.validadeData}
                min={format(new Date(), "yyyy-MM-dd")}
                onChange={(e) => patch({ validadeData: e.target.value })}
                required
              />
            ) : null}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex cursor-pointer items-center gap-3 text-base">
              <input
                type="checkbox"
                className="size-4 rounded border-input accent-brand-blue"
                checked={values.avisarAntes}
                onChange={(e) => patch({ avisarAntes: e.target.checked })}
              />
              Avisar antes
            </label>
            {values.avisarAntes ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={365}
                  className="h-10 w-20 text-base"
                  value={values.avisarAntesDias}
                  onChange={(e) =>
                    patch({
                      avisarAntesDias: Math.max(
                        1,
                        Number.parseInt(e.target.value, 10) || 1
                      ),
                    })
                  }
                />
                <span className="text-sm text-muted-foreground">dia(s)</span>
              </div>
            ) : null}
          </div>
        </fieldset>
      ) : null}

      <fieldset className="brand-fieldset space-y-4">
        <legend className="text-base">Anexo e complementos</legend>

        <SgqAnexosTable
          label="Anexos"
          anexos={values.anexos}
          onChange={(anexos) => patch({ anexos })}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png"
          emptyMessage='Nenhum anexo adicionado. Clique em "Adicionar anexo" para incluir um arquivo.'
          addButtonLabel="Adicionar anexo"
        />

        <div className="space-y-2">
          <Label className="text-base">Observação</Label>
          <Textarea
            value={values.observacao}
            onChange={(e) => patch({ observacao: e.target.value })}
            rows={3}
            className="text-base"
            placeholder="Observações sobre o documento..."
          />
        </div>

        <label className="flex cursor-pointer items-center gap-3 text-base">
          <input
            type="checkbox"
            className="size-4 rounded border-input accent-brand-blue"
            checked={values.associarDocumentos}
            onChange={(e) => patch({ associarDocumentos: e.target.checked })}
          />
          Associar a outros documentos
        </label>
        {values.associarDocumentos ? (
          <div className="pl-7">
            <MultiSelectSearch
              options={documentoOptions}
              value={values.documentosAssociadosIds}
              onChange={(documentosAssociadosIds) =>
                patch({ documentosAssociadosIds })
              }
              placeholder="Selecione documentos"
              searchPlaceholder="Pesquisar documento…"
              emptyMessage="Nenhum documento encontrado."
            />
          </div>
        ) : null}
      </fieldset>

      <fieldset className="brand-fieldset space-y-4">
        <legend className="text-base">Notificações e permissões</legend>
        <div className="space-y-2">
          <Label className="text-base">Avisar por e-mail</Label>
          <MultiSelectSearch
            options={userOptions}
            value={values.avisoEmailIds}
            onChange={(avisoEmailIds) => patch({ avisoEmailIds })}
            placeholder="Selecione usuários"
            searchPlaceholder="Pesquisar usuário…"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-base">Permissão de acesso</Label>
          <Select
            value={values.permissaoAcesso || undefined}
            onValueChange={(v) =>
              v && patch({ permissaoAcesso: v as PermissaoAcessoDocumento })
            }
          >
            <SelectTrigger className={selectTriggerClass}>
              <SelectValue placeholder="Selecione">
                {permissaoAcessoNome ?? null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className={selectContentClass}>
              <SelectItem value="todos" className={selectItemClass}>
                Todos
              </SelectItem>
              <SelectItem value="restrito" className={selectItemClass}>
                Restrito
              </SelectItem>
              <SelectItem value="responsavel" className={selectItemClass}>
                Apenas responsável
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </fieldset>
    </div>
  );
}
