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
  userSelectLabel,
} from "@qualidade/lib/utils/select-display";
import type { SgqAnexo } from "@qualidade/types/registro-anexo";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import {
  buildLocalizacaoOpcoes,
  filterEnderecamentosPorSetor,
} from "@qualidade/lib/enderecamentos-sync";
import type { EnderecamentoCategoria } from "@qualidade/types/enderecamento";
import { PessoaSearchField } from "@qualidade/components/registros/pessoa-search-field";

export interface ExternoRegistroFormValues {
  titulo: string;
  unidadeTodos: boolean;
  processoId: string;
  distEletronica: boolean;
  distFisica: boolean;
  localizacao: string;
  /** Usuário do Gestão Smart responsável pelo documento. */
  responsavelDocumentoId: string;
  /** Pessoa Nomus (funcionário) responsável pela posse, quando a guarda é física. */
  responsavelId: string;
  responsavelNome: string;
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
    responsavelDocumentoId: "",
    responsavelId,
    responsavelNome: "",
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

function toAnexoRows(
  items: Array<{ nome: string; dataUrl?: string; storagePath?: string }> | undefined
): SgqAnexo[] {
  if (!items?.length) return [];
  return items
    .filter((a) => a.nome?.trim() && (a.dataUrl?.trim() || a.storagePath?.trim()))
    .map((a, i) => ({
      id: `anexo-${i}-${a.nome}`,
      nome: a.nome,
      dataUrl: a.dataUrl ?? "",
      ...(a.storagePath ? { storagePath: a.storagePath } : {}),
    }));
}

/** Hidrata o formulário a partir de um documento externo/registro existente. */
export function externoRegistroValuesFromDocument(
  doc: Document,
  versaoAtual?: {
    arquivoNome?: string;
    arquivoDataUrl?: string;
    anexos?: Array<{ nome: string; dataUrl: string; storagePath?: string }>;
  },
  fallbackResponsavelId = ""
): ExternoRegistroFormValues {
  const reg = doc.externoRegistro;
  const anexosVersao = versaoAtual?.anexos?.length
    ? versaoAtual.anexos
    : reg?.anexos?.length
      ? reg.anexos
      : versaoAtual?.arquivoNome &&
          (versaoAtual?.arquivoDataUrl ||
            (versaoAtual as { arquivoStoragePath?: string }).arquivoStoragePath)
        ? [
            {
              nome: versaoAtual.arquivoNome,
              dataUrl: versaoAtual.arquivoDataUrl ?? "",
            },
          ]
        : [];

  return {
    titulo: doc.titulo ?? "",
    unidadeTodos: reg?.unidadeTodos ?? true,
    processoId: doc.setorId ?? "",
    distEletronica: reg?.distribuicaoEletronica ?? true,
    distFisica: reg?.distribuicaoFisica ?? false,
    localizacao: doc.localizacao ?? "",
    responsavelDocumentoId: fallbackResponsavelId,
    responsavelId: reg?.responsavelPosseId ?? "",
    responsavelNome: reg?.responsavelNome ?? "",
    definirValidade: Boolean(doc.validade?.ativa && doc.validade.dataValidade),
    validadeData: doc.validade?.dataValidade
      ? format(new Date(doc.validade.dataValidade), "yyyy-MM-dd")
      : defaultValidadeData(),
    avisarAntes: reg?.avisarAntesAtivo ?? false,
    avisarAntesDias: reg?.avisarAntesDias ?? 30,
    anexos: toAnexoRows(anexosVersao),
    observacao: reg?.observacao ?? "",
    associarDocumentos: reg?.associarDocumentos ?? false,
    documentosAssociadosIds: reg?.documentosAssociadosIds ?? [],
    avisoEmailIds: doc.permissoes?.avisoPublicacaoEmailIds ?? [],
    permissaoAcesso: reg?.permissaoAcesso ?? "",
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
  // Metadados leves: nunca embutir base64 em externoRegistro (binário fica na versão).
  const anexosMeta = values.anexos
    .filter((a) => a.nome.trim() && (a.dataUrl.trim() || a.storagePath?.trim()))
    .map((a) => ({
      nome: a.nome.trim(),
      dataUrl: "",
      ...(a.storagePath?.trim() ? { storagePath: a.storagePath.trim() } : {}),
    }));

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
    responsavelNome: values.responsavelNome.trim() || undefined,
    responsavelPosseId: values.distFisica
      ? values.responsavelId.trim() || undefined
      : undefined,
    anexos: anexosMeta.length > 0 ? anexosMeta : undefined,
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

  const categoriasLocalizacao = useMemo(() => {
    const categorias: EnderecamentoCategoria[] = [];
    if (values.distFisica) categorias.push("fisico");
    if (values.distEletronica) categorias.push("eletronico");
    return categorias;
  }, [values.distEletronica, values.distFisica]);

  const localizacaoOpcoes = useMemo(() => {
    const filtrados = filterEnderecamentosPorSetor(
      enderecamentos,
      values.processoId,
      categoriasLocalizacao
    );
    const atual = values.localizacao.trim();
    const atualValida = filtrados.some((item) => item.endereco.trim() === atual);
    return buildLocalizacaoOpcoes(
      filtrados,
      departments,
      atualValida ? atual : ""
    );
  }, [
    categoriasLocalizacao,
    departments,
    enderecamentos,
    values.localizacao,
    values.processoId,
  ]);

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
  const responsavelExibicao =
    values.responsavelNome.trim() ||
    userSelectLabel(users, values.responsavelId) ||
    "";

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
            <Label className="text-base">Documento referente ao setor *</Label>
            <Select
              value={values.processoId}
              onValueChange={(v) => {
                if (!v) return;
                const aindaValida = filterEnderecamentosPorSetor(
                  enderecamentos,
                  v,
                  categoriasLocalizacao
                ).some((item) => item.endereco.trim() === values.localizacao.trim());
                patch({
                  processoId: v,
                  ...(aindaValida ? {} : { localizacao: "" }),
                });
              }}
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
                    {d.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label className="text-base">A guarda é *</Label>
          <div className="flex flex-wrap gap-6">
            <label className="flex cursor-pointer items-center gap-3 text-base">
              <input
                type="checkbox"
                className="size-4 rounded border-input accent-brand-blue"
                checked={values.distFisica}
                onChange={(e) => {
                  const distFisica = e.target.checked;
                  const categorias: EnderecamentoCategoria[] = [];
                  if (distFisica) categorias.push("fisico");
                  if (values.distEletronica) categorias.push("eletronico");
                  const aindaValida = filterEnderecamentosPorSetor(
                    enderecamentos,
                    values.processoId,
                    categorias
                  ).some((item) => item.endereco.trim() === values.localizacao.trim());
                  patch({
                    distFisica,
                    ...(aindaValida ? {} : { localizacao: "" }),
                    ...(distFisica ? {} : { responsavelId: "", responsavelNome: "" }),
                  });
                }}
              />
              Física
            </label>
            <label className="flex cursor-pointer items-center gap-3 text-base">
              <input
                type="checkbox"
                className="size-4 rounded border-input accent-brand-blue"
                checked={values.distEletronica}
                onChange={(e) => {
                  const distEletronica = e.target.checked;
                  const categorias: EnderecamentoCategoria[] = [];
                  if (values.distFisica) categorias.push("fisico");
                  if (distEletronica) categorias.push("eletronico");
                  const aindaValida = filterEnderecamentosPorSetor(
                    enderecamentos,
                    values.processoId,
                    categorias
                  ).some((item) => item.endereco.trim() === values.localizacao.trim());
                  patch({
                    distEletronica,
                    ...(aindaValida ? {} : { localizacao: "" }),
                    ...(distEletronica
                      ? {}
                      : { responsavelDocumentoId: "" }),
                  });
                }}
              />
              Eletrônica
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-base">Localização do documento</Label>
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
                  {!values.processoId
                    ? "Selecione o setor"
                    : categoriasLocalizacao.length === 0
                      ? "Marque se a guarda é física, eletrônica ou as duas"
                      : "Nenhum endereço desta categoria para o setor"}
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

        {values.distEletronica ? (
          <div className="space-y-2">
            <Label
              className="text-base"
              htmlFor="doc-externo-responsavel-documento"
            >
              Responsável pelo documento *
            </Label>
            <Select
              value={values.responsavelDocumentoId || null}
              onValueChange={(v) => v && patch({ responsavelDocumentoId: v })}
            >
              <SelectTrigger
                id="doc-externo-responsavel-documento"
                className={selectTriggerClass}
              >
                <SelectValue placeholder="Selecione o usuário">
                  {userSelectLabel(users, values.responsavelDocumentoId) ??
                    null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className={selectContentClass}>
                {users
                  .filter((user) => user.ativo)
                  .map((user) => (
                    <SelectItem
                      key={user.id}
                      value={user.id}
                      className={selectItemClass}
                    >
                      {user.nome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {values.distFisica ? (
          <PessoaSearchField
            id="doc-externo-responsavel"
            label="Responsável pela posse do documento *"
            value={responsavelExibicao}
            apenasFuncionarios
            placeholder="Digite o nome do funcionário..."
            onValueChange={(nome) => {
              if (!nome.trim()) patch({ responsavelId: "", responsavelNome: "" });
            }}
            onPessoaSelect={(pessoa) =>
              patch({ responsavelId: pessoa.id, responsavelNome: pessoa.nome })
            }
          />
        ) : null}
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
          <Label className="text-base">Aviso de publicação por e-mail</Label>
          <MultiSelectSearch
            options={userOptions}
            value={values.avisoEmailIds}
            onChange={(avisoEmailIds) => patch({ avisoEmailIds })}
            placeholder="Selecione usuários"
            searchPlaceholder="Pesquisar usuário…"
          />
        </div>
      </fieldset>
    </div>
  );
}
