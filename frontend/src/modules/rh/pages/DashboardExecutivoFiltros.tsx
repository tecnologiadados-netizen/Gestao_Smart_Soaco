import { Button } from "@rh/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rh/components/ui/select";
import {
  DASHBOARD_EMPRESA_TODAS,
  inicioDoDia,
  parseIsoLocal,
  toIsoLocal,
  type DashboardPeriodo,
} from "@rh/lib/dashboard-periodo";
import { rhFieldInput, rhFieldLabel } from "@rh/lib/form-field-styles";

export function DashboardExecutivoFiltros({
  empresas,
  empresa,
  onEmpresaChange,
  onLimpar,
  limparDesabilitado,
}: {
  empresas: string[];
  empresa: string;
  onEmpresaChange: (empresa: string) => void;
  onLimpar: () => void;
  limparDesabilitado: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-level-1 sm:flex-row sm:items-end">
      <div className="min-w-0 sm:w-[280px]">
        <span className={rhFieldLabel}>Empresa</span>
        <Select value={empresa} onValueChange={onEmpresaChange}>
          <SelectTrigger className="h-9 rounded-lg border-dashed border-muted-foreground/35 bg-background shadow-none" aria-label="Empresa do painel">
            <SelectValue placeholder="Empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DASHBOARD_EMPRESA_TODAS}>Todas</SelectItem>
            {empresas.map((nome) => (
              <SelectItem key={nome} value={nome}>
                {nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="button" variant="outline" className="h-9" disabled={limparDesabilitado} onClick={onLimpar}>
        Limpar filtros
      </Button>
    </div>
  );
}

/** Intervalo de datas de um gráfico do executivo. Datas futuras ficam bloqueadas. */
export function DashboardPeriodoDatas({
  idPrefix,
  periodo,
  onPeriodoChange,
}: {
  idPrefix: string;
  periodo: DashboardPeriodo;
  onPeriodoChange: (periodo: DashboardPeriodo) => void;
}) {
  const hoje = toIsoLocal(inicioDoDia(new Date()));
  const inicio = toIsoLocal(periodo.inicio);
  const fim = toIsoLocal(periodo.fim);

  const aplicar = (proximoInicio: string, proximoFim: string) => {
    const a = parseIsoLocal(proximoInicio);
    const b = parseIsoLocal(proximoFim);
    if (!a || !b) return;
    const limite = inicioDoDia(new Date());
    let de = a > limite ? limite : a;
    let ate = b > limite ? limite : b;
    if (ate < de) [de, ate] = [ate, de];
    onPeriodoChange({ inicio: de, fim: ate });
  };

  return (
    <div className="flex flex-nowrap items-end gap-3">
      <div className="min-w-0 w-[160px]">
        <label className={rhFieldLabel} htmlFor={`${idPrefix}-inicio`}>
          Data inicial
        </label>
        <input
          id={`${idPrefix}-inicio`}
          type="date"
          className={rhFieldInput}
          value={inicio}
          max={hoje}
          onChange={(e) => aplicar(e.target.value, fim)}
        />
      </div>
      <div className="min-w-0 w-[160px]">
        <label className={rhFieldLabel} htmlFor={`${idPrefix}-fim`}>
          Data final
        </label>
        <input
          id={`${idPrefix}-fim`}
          type="date"
          className={rhFieldInput}
          value={fim}
          min={inicio}
          max={hoje}
          onChange={(e) => aplicar(inicio, e.target.value)}
        />
      </div>
    </div>
  );
}
