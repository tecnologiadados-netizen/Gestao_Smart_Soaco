import { moneyBr, roundMoney } from '../lib/negociacaoCobranca';

export default function ResumoPrincipalJurosNegociado({
  principal,
  juros,
  novoValor,
}: {
  principal: number;
  juros: number;
  novoValor: number;
}) {
  return (
    <dl className="space-y-2 rounded-lg border border-slate-200 px-3 py-2.5 dark:border-slate-600">
      <div className="flex justify-between gap-2 text-sm text-slate-600 dark:text-slate-300">
        <dt>Principal</dt>
        <dd className="font-medium tabular-nums">{moneyBr(roundMoney(principal))}</dd>
      </div>
      <div className="flex justify-between gap-2 text-sm text-slate-600 dark:text-slate-300">
        <dt>Juros</dt>
        <dd className="font-medium tabular-nums">{moneyBr(roundMoney(juros))}</dd>
      </div>
      <div className="flex justify-between gap-2 border-t border-slate-200 pt-2 text-sm text-slate-800 dark:border-slate-600 dark:text-slate-100">
        <dt className="font-semibold">Novo valor negociado</dt>
        <dd className="font-semibold tabular-nums">{moneyBr(roundMoney(novoValor))}</dd>
      </div>
    </dl>
  );
}
