import { Calculator } from 'lucide-react';
import { calcularJurosMora, moneyBr, moneyBrAte4 } from '../lib/negociacaoCobranca';
import ResumoPrincipalJurosNegociado from './ResumoPrincipalJurosNegociado';

export default function CalculadoraJurosInadimplente({
  valorOriginal,
  percentual,
  diasAtraso,
  onPercentualChange,
  onUsarNaNegociacao,
}: {
  valorOriginal: number;
  percentual: number;
  diasAtraso: number;
  onPercentualChange: (pct: number) => void;
  onUsarNaNegociacao: (valorTotal: number, percentual: number) => void;
}) {
  const calc = calcularJurosMora(valorOriginal, percentual, diasAtraso);

  return (
    <div
      className="w-full max-w-sm shrink-0 rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
        <Calculator className="size-5 text-sky-600 dark:text-sky-300" />
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Calculadora de juros</h3>
      </div>
      <div className="space-y-3 p-4 text-sm">
        <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500">Valor do título</p>
          <p className="text-base font-semibold text-slate-800 dark:text-slate-100">{moneyBr(valorOriginal)}</p>
        </div>
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Juros % ao mês</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={Number.isFinite(percentual) ? percentual : 0}
            onChange={(e) => onPercentualChange(Number(e.target.value))}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-950"
          />
        </label>
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Memorial de cálculo
          </p>
          <dl className="mb-3 space-y-1.5 rounded-lg border border-slate-200 px-3 py-2 text-slate-600 dark:border-slate-600 dark:text-slate-300">
            <div className="flex justify-between gap-2">
              <dt>Dias em atraso</dt>
              <dd className="font-medium tabular-nums">{calc.diasAtraso.toLocaleString('pt-BR')}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Juros por dia</dt>
              <dd className="font-medium tabular-nums">{moneyBrAte4(calc.jurosPorDia)}</dd>
            </div>
          </dl>
          <ResumoPrincipalJurosNegociado
            principal={valorOriginal}
            juros={calc.valorJuros}
            novoValor={calc.valorTotal}
          />
        </div>
        <button
          type="button"
          onClick={() => onUsarNaNegociacao(calc.valorTotal, calc.percentualJuros)}
          className="h-9 w-full rounded-lg bg-blue-700 text-xs font-semibold text-white hover:bg-blue-800"
        >
          Usar na negociação
        </button>
      </div>
    </div>
  );
}
