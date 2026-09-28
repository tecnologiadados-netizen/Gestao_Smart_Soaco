import { Input } from "@qualidade/components/ui/input";
import { Label } from "@qualidade/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qualidade/components/ui/select";
import {
  frasePeriodicidade,
  type UnidadePeriodicidade,
} from "@qualidade/lib/utils/periodicidade-calibracao";

const UNIDADE_LABEL: Record<UnidadePeriodicidade, string> = {
  dias: "Dias",
  meses: "Meses",
  anos: "Anos",
};

const selectTriggerClass =
  "h-10 w-full min-w-0 *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal";

interface PeriodicidadeCalibracaoFieldProps {
  idPrefix: string;
  quantidade: string;
  unidade: UnidadePeriodicidade;
  onQuantidadeChange: (value: string) => void;
  onUnidadeChange: (value: UnidadePeriodicidade) => void;
  disabled?: boolean;
}

export function PeriodicidadeCalibracaoField({
  idPrefix,
  quantidade,
  unidade,
  onQuantidadeChange,
  onUnidadeChange,
  disabled = false,
}: PeriodicidadeCalibracaoFieldProps) {
  const qtd = Number(quantidade);

  return (
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-unidade`}>Periodicidade de calibração *</Label>
      <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
        <Select
          value={unidade}
          onValueChange={(v) => {
            if (v === "dias" || v === "meses" || v === "anos") onUnidadeChange(v);
          }}
          disabled={disabled}
        >
          <SelectTrigger
            id={`${idPrefix}-unidade`}
            className={selectTriggerClass}
            disabled={disabled}
          >
            <SelectValue>{UNIDADE_LABEL[unidade]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dias">Dias</SelectItem>
            <SelectItem value="meses">Meses</SelectItem>
            <SelectItem value="anos">Anos</SelectItem>
          </SelectContent>
        </Select>
        <Input
          id={`${idPrefix}-quantidade`}
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          aria-label="Quantidade"
          value={quantidade}
          onChange={(e) => onQuantidadeChange(e.target.value)}
          readOnly={disabled}
          className={disabled ? "bg-muted/50" : undefined}
          required
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {frasePeriodicidade(qtd, unidade)}
      </p>
    </div>
  );
}
