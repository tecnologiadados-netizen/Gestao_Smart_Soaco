"use client";

import { Label } from "@/components/ui/label";
import {
  MultiSelectSearch,
  type MultiSelectOption,
} from "@/components/ui/multi-select-search";
import type { DocumentPermissoes } from "@/types/document";
import type { Department, User } from "@/types/user";

export type PermissoesFormValues = DocumentPermissoes;

export function defaultPermissoesValues(): PermissoesFormValues {
  return {
    avisoPublicacaoEmailIds: [],
    baixarArquivoIds: [],
    imprimirArquivoIds: [],
    copiasDistribuidasIds: [],
    consultarTodos: true,
    consultarIds: [],
  };
}

function usersToOptions(users: User[]): MultiSelectOption[] {
  return users
    .filter((user) => user.ativo)
    .map((user) => ({
      value: user.id,
      label: user.nome,
      description: user.email,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

function departmentsToOptions(departments: Department[]): MultiSelectOption[] {
  return departments
    .map((department) => ({
      value: department.id,
      label: department.nome,
      description: department.nome,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

interface Props {
  users: User[];
  departments: Department[];
  values: PermissoesFormValues;
  onChange: (values: PermissoesFormValues) => void;
}

function PermissaoCampo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(180px,240px)_1fr] sm:items-start sm:gap-4">
      <Label className="pt-2 text-sm font-medium leading-snug text-brand-navy">
        {label}
      </Label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function DocumentoPermissoesFieldset({
  users,
  departments,
  values,
  onChange,
}: Props) {
  const userOptions = usersToOptions(users);
  const processoOptions = departmentsToOptions(departments);

  function patch(partial: Partial<PermissoesFormValues>) {
    onChange({ ...values, ...partial });
  }

  return (
    <fieldset className="brand-fieldset space-y-5">
      <legend className="text-base">Permissões / Cópias distribuídas</legend>

      <PermissaoCampo label="Aviso de publicação por e-mail">
        <MultiSelectSearch
          options={userOptions}
          value={values.avisoPublicacaoEmailIds}
          onChange={(avisoPublicacaoEmailIds) =>
            patch({ avisoPublicacaoEmailIds })
          }
          placeholder="Selecione quem receberá o aviso"
          searchPlaceholder="Pesquisar usuário…"
        />
      </PermissaoCampo>

      <PermissaoCampo label="Quem pode baixar o arquivo">
        <MultiSelectSearch
          options={userOptions}
          value={values.baixarArquivoIds}
          onChange={(baixarArquivoIds) => patch({ baixarArquivoIds })}
          placeholder="Selecione quem pode baixar"
          searchPlaceholder="Pesquisar usuário…"
        />
      </PermissaoCampo>

      <PermissaoCampo label="Quem pode imprimir arquivo">
        <MultiSelectSearch
          options={userOptions}
          value={values.imprimirArquivoIds}
          onChange={(imprimirArquivoIds) => patch({ imprimirArquivoIds })}
          placeholder="Selecione quem pode imprimir"
          searchPlaceholder="Pesquisar usuário…"
        />
      </PermissaoCampo>

      <PermissaoCampo label="Cópias distribuídas">
        <MultiSelectSearch
          options={processoOptions}
          value={values.copiasDistribuidasIds}
          onChange={(copiasDistribuidasIds) => patch({ copiasDistribuidasIds })}
          placeholder="Selecione os setores das cópias"
          searchPlaceholder="Pesquisar setor…"
          emptyMessage={
            processoOptions.length === 0
              ? "Nenhum setor cadastrado."
              : "Nenhum setor encontrado."
          }
        />
        {values.copiasDistribuidasIds.length === 0 ? (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Nenhuma cópia distribuída selecionada.
          </p>
        ) : null}
      </PermissaoCampo>

      <PermissaoCampo label="Quem pode consultar">
        <div className="space-y-3">
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="size-4 rounded border-input accent-brand-blue"
              checked={values.consultarTodos}
              onChange={(event) =>
                patch({
                  consultarTodos: event.target.checked,
                  consultarIds: event.target.checked ? [] : values.consultarIds,
                })
              }
            />
            Todos
          </label>
          {!values.consultarTodos ? (
            <MultiSelectSearch
              options={userOptions}
              value={values.consultarIds}
              onChange={(consultarIds) => patch({ consultarIds })}
              placeholder="Selecione quem pode consultar"
              searchPlaceholder="Pesquisar usuário…"
            />
          ) : null}
        </div>
      </PermissaoCampo>
    </fieldset>
  );
}

export function formatPermissaoUsuarios(
  userIds: string[],
  users: User[],
  vazio = "Nenhum selecionado"
) {
  if (userIds.length === 0) return vazio;
  return userIds
    .map((id) => users.find((user) => user.id === id)?.nome ?? id)
    .join(", ");
}

export function formatPermissaoProcessos(
  processoIds: string[],
  departments: Department[],
  vazio = "Nenhum selecionado"
) {
  if (processoIds.length === 0) return vazio;
  return processoIds
    .map((id) => {
      const processo = departments.find((department) => department.id === id);
      return processo ? processo.nome : id;
    })
    .join(", ");
}
