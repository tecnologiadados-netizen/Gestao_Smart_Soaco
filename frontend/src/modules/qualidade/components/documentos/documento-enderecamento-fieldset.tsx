import { useMemo } from "react";
import { Label } from "@qualidade/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qualidade/components/ui/select";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import {
  buildLocalizacaoOpcoes,
  filterEnderecamentosPorSetor,
} from "@qualidade/lib/enderecamentos-sync";

const selectTriggerClass =
  "h-10 w-full min-w-0 *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal";

const selectContentClass = "min-w-[var(--anchor-width)] w-max max-w-md";

const selectItemClass = "py-2.5 whitespace-normal text-base leading-snug";

interface DocumentoEnderecamentoFieldsetProps {
  value: string;
  onChange: (localizacao: string) => void;
  /** Quando informado, lista endereços do setor + endereços Gerais. */
  setorId?: string;
  label?: string;
}

export function DocumentoEnderecamentoFieldset({
  value,
  onChange,
  setorId = "",
  label = "Localização",
}: DocumentoEnderecamentoFieldsetProps) {
  const enderecamentos = useConfigStore((s) => s.enderecamentos);
  const departments = useConfigStore((s) => s.departments);

  const enderecamentosVisiveis = useMemo(
    () => filterEnderecamentosPorSetor(enderecamentos, setorId),
    [enderecamentos, setorId]
  );

  const localizacaoOpcoes = useMemo(
    () => buildLocalizacaoOpcoes(enderecamentosVisiveis, departments, value),
    [departments, enderecamentosVisiveis, value]
  );

  const localizacaoLabel =
    localizacaoOpcoes.find((opcao) => opcao.value === value)?.label ??
    (value.trim() || null);

  return (
    <fieldset className="brand-fieldset space-y-4">
      <legend className="text-base">Endereçamento</legend>

      <div className="space-y-2">
        <Label className="text-base">{label}</Label>
        <Select value={value} onValueChange={(v) => v && onChange(v)}>
          <SelectTrigger className={selectTriggerClass}>
            <SelectValue placeholder="Selecione onde o documento está armazenado">
              {localizacaoLabel}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className={selectContentClass}>
            {localizacaoOpcoes.length === 0 ? (
              <SelectItem value="__vazio__" disabled className={selectItemClass}>
                {setorId
                  ? "Nenhum endereço cadastrado para este setor"
                  : "Cadastre endereços em Configurações → Endereçamento"}
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
        <p className="text-xs text-muted-foreground">
          {setorId
            ? "Endereços do setor selecionado e endereços Gerais (válidos para todos)."
            : "Selecione o setor para filtrar os endereços disponíveis."}
        </p>
      </div>
    </fieldset>
  );
}
