import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { Label } from "@qualidade/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qualidade/components/ui/select";
import { PessoaSearchField } from "@qualidade/components/registros/pessoa-search-field";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import {
  buildLocalizacaoOpcoes,
  filterEnderecamentosPorSetor,
  parseLocalizacoesDocumento,
  serializeLocalizacoesDocumento,
  type LocalizacaoGuarda,
} from "@qualidade/lib/enderecamentos-sync";
import {
  ENDERECAMENTO_CATEGORIA_LABEL,
  type EnderecamentoCategoria,
} from "@qualidade/types/enderecamento";

const selectTriggerClass =
  "h-10 w-full min-w-0 *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal";

const selectContentClass = "min-w-[var(--anchor-width)] w-max max-w-md";

const selectItemClass = "py-2.5 whitespace-normal text-base leading-snug";

const CATEGORIAS: EnderecamentoCategoria[] = ["fisico", "eletronico"];

interface DocumentoEnderecamentoFieldsetProps {
  value: string;
  onChange: (localizacao: string) => void;
  /** Quando informado, lista endereços do setor + endereços Gerais. */
  setorId?: string;
  responsavelId?: string;
  responsavelNome?: string;
  onResponsavelChange?: (id: string, nome: string) => void;
  onGuardaFisicaChange?: (marcada: boolean) => void;
}

export function DocumentoEnderecamentoFieldset({
  value,
  onChange,
  setorId = "",
  responsavelId = "",
  responsavelNome = "",
  onResponsavelChange,
  onGuardaFisicaChange,
}: DocumentoEnderecamentoFieldsetProps) {
  const enderecamentos = useConfigStore((s) => s.enderecamentos);
  const departments = useConfigStore((s) => s.departments);

  const [guardaFisica, setGuardaFisica] = useState(false);
  const [guardaEletronica, setGuardaEletronica] = useState(false);
  const [itens, setItens] = useState<LocalizacaoGuarda[]>([]);
  const emitidoRef = useRef<string | null>(null);

  useEffect(() => {
    if (emitidoRef.current === value) return;
    emitidoRef.current = value;
    const parsed = parseLocalizacoesDocumento(value);
    const fisica = parsed.some((item) => item.categoria === "fisico");
    setGuardaFisica(fisica);
    onGuardaFisicaChange?.(fisica);
    setGuardaEletronica(parsed.some((item) => item.categoria === "eletronico"));
    setItens(parsed);
  }, [value]);

  function emitir(proximos: LocalizacaoGuarda[]) {
    const next = serializeLocalizacoesDocumento(proximos);
    emitidoRef.current = next;
    setItens(proximos);
    onChange(next);
  }

  function guardaMarcada(categoria: EnderecamentoCategoria): boolean {
    return categoria === "fisico" ? guardaFisica : guardaEletronica;
  }

  function alternarGuarda(categoria: EnderecamentoCategoria, marcado: boolean) {
    if (categoria === "fisico") {
      setGuardaFisica(marcado);
      onGuardaFisicaChange?.(marcado);
      if (!marcado) onResponsavelChange?.("", "");
    } else setGuardaEletronica(marcado);
    if (!marcado) {
      emitir(itens.filter((item) => item.categoria !== categoria));
    }
  }

  function incluir(categoria: EnderecamentoCategoria, endereco: string) {
    const texto = endereco.trim();
    if (!texto) return;
    if (itens.some((item) => item.categoria === categoria && item.endereco === texto)) {
      return;
    }
    emitir([...itens, { categoria, endereco: texto }]);
  }

  function remover(categoria: EnderecamentoCategoria, endereco: string) {
    emitir(
      itens.filter(
        (item) => !(item.categoria === categoria && item.endereco === endereco)
      )
    );
  }

  const opcoesPorCategoria = useMemo(() => {
    const montar = (categoria: EnderecamentoCategoria) =>
      buildLocalizacaoOpcoes(
        filterEnderecamentosPorSetor(enderecamentos, setorId, [categoria]),
        departments
      );
    return {
      fisico: montar("fisico"),
      eletronico: montar("eletronico"),
    };
  }, [departments, enderecamentos, setorId]);

  const categoriasAtivas = CATEGORIAS.filter(guardaMarcada);

  return (
    <fieldset className="brand-fieldset space-y-4">
      <legend className="text-base">Endereçamento</legend>

      <div className="space-y-2">
        <Label className="text-base">A guarda é</Label>
        <div className="flex flex-wrap gap-6">
          <label className="flex cursor-pointer items-center gap-3 text-base">
            <input
              type="checkbox"
              className="size-4 rounded border-input accent-brand-blue"
              checked={guardaFisica}
              onChange={(e) => alternarGuarda("fisico", e.target.checked)}
            />
            Física
          </label>
          <label className="flex cursor-pointer items-center gap-3 text-base">
            <input
              type="checkbox"
              className="size-4 rounded border-input accent-brand-blue"
              checked={guardaEletronica}
              onChange={(e) => alternarGuarda("eletronico", e.target.checked)}
            />
            Eletrônica
          </label>
        </div>
      </div>

      {categoriasAtivas.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Marque se a guarda é física, eletrônica ou as duas.
        </p>
      ) : (
        <div className="space-y-4">
          {categoriasAtivas.map((categoria) => {
            const escolhidos = itens.filter((item) => item.categoria === categoria);
            const escolhidosSet = new Set(escolhidos.map((item) => item.endereco));
            const opcoes = opcoesPorCategoria[categoria].filter(
              (opcao) => !escolhidosSet.has(opcao.value)
            );
            const titulo =
              categoriasAtivas.length > 1
                ? `Localização do documento (${ENDERECAMENTO_CATEGORIA_LABEL[categoria].toLowerCase()})`
                : "Localização do documento";
            return (
              <div key={categoria} className="space-y-2">
                <Label className="text-base">{titulo}</Label>
                <Select
                  key={`${categoria}-${escolhidos.length}`}
                  onValueChange={(endereco) => {
                    if (endereco && endereco !== "__vazio__") incluir(categoria, endereco);
                  }}
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder="Selecione um endereço para incluir na lista" />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    {opcoes.length === 0 ? (
                      <SelectItem value="__vazio__" disabled className={selectItemClass}>
                        {escolhidos.length > 0
                          ? "Todos os endereços desta categoria já foram incluídos"
                          : setorId
                            ? "Nenhum endereço desta categoria para o setor"
                            : "Selecione o setor para filtrar os endereços"}
                      </SelectItem>
                    ) : (
                      opcoes.map((opcao) => (
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
                {escolhidos.length > 0 ? (
                  <ul className="space-y-1">
                    {escolhidos.map((item) => {
                      const label =
                        opcoesPorCategoria[categoria].find(
                          (opcao) => opcao.value === item.endereco
                        )?.label ?? item.endereco;
                      return (
                        <li
                          key={`${categoria}-${item.endereco}`}
                          className="flex items-center justify-between gap-2 rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-sm"
                        >
                          <span className="min-w-0 truncate">{label}</span>
                          <button
                            type="button"
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => remover(categoria, item.endereco)}
                            aria-label={`Remover ${label}`}
                          >
                            <X className="size-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            );
          })}
          {guardaFisica && onResponsavelChange ? (
            <PessoaSearchField
              id="responsavel-posse-documento"
              label="Responsável pela posse do documento *"
              value={responsavelNome || responsavelId}
              apenasFuncionarios
              placeholder="Digite o nome do funcionário..."
              onValueChange={(nome) => {
                if (!nome.trim()) onResponsavelChange("", "");
              }}
              onPessoaSelect={(pessoa) => onResponsavelChange(pessoa.id, pessoa.nome)}
            />
          ) : null}
          <p className="text-xs text-muted-foreground">
            {setorId
              ? "Cada categoria tem um campo. O endereço escolhido entra na lista abaixo dele."
              : "Selecione o setor para filtrar os endereços disponíveis."}
          </p>
        </div>
      )}
    </fieldset>
  );
}
