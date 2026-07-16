import { Input } from "@qualidade/components/ui/input";
import { Label } from "@qualidade/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qualidade/components/ui/select";
import { RNC_SIM_NAO, rncFieldLabels } from "@qualidade/lib/registros/constants";
import {
  criarPorquesVazios,
  type RncDados,
} from "@qualidade/types/rnc";

interface RncPlanoAcaoPorquesProps {
  dados: RncDados;
  onChange: (dados: RncDados) => void;
  disabled?: boolean;
}

const ROTULOS_PORQUE = [
  "1° porquê",
  "2° porquê",
  "3° porquê",
  "4° porquê",
  "5° porquê",
] as const;

export function RncPlanoAcaoPorques({
  dados,
  onChange,
  disabled = false,
}: RncPlanoAcaoPorquesProps) {
  const somenteLeitura = disabled;
  const porques = dados.porques ?? criarPorquesVazios();

  function patch(partial: Partial<RncDados>) {
    onChange({ ...dados, ...partial });
  }

  function definirPlanoAcao(valor: string) {
    const registrar = valor === "Sim";
    patch({
      registrarPlanoAcao: registrar,
      porques: registrar ? porques : criarPorquesVazios(),
    });
  }

  function atualizarPorque(indice: number, valor: string) {
    const proximos = [...porques];
    proximos[indice] = valor;
    patch({ porques: proximos });
  }

  return (
    <div className="space-y-4 sm:col-span-2">
      <div className="space-y-2">
        <Label>{rncFieldLabels.registrarPlanoAcao}</Label>
        <Select
          value={dados.registrarPlanoAcao ? "Sim" : "Não"}
          onValueChange={definirPlanoAcao}
          disabled={somenteLeitura}
        >
          <SelectTrigger className="w-full max-w-xs">
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {RNC_SIM_NAO.map((opcao) => (
              <SelectItem key={opcao} value={opcao}>
                {opcao}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {dados.registrarPlanoAcao ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {ROTULOS_PORQUE.map((rotulo, indice) => (
            <div key={rotulo} className="space-y-2">
              <Label htmlFor={`rnc-porque-${indice + 1}`}>{rotulo}</Label>
              <Input
                id={`rnc-porque-${indice + 1}`}
                value={porques[indice] ?? ""}
                onChange={(e) => atualizarPorque(indice, e.target.value)}
                disabled={somenteLeitura}
                placeholder={rotulo}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
