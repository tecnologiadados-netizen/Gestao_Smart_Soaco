import {
  FORMAS_PAGAMENTO_NEGOCIACAO,
  PERIODICIDADES_NEGOCIACAO,
  moneyBr,
  montarParcelasNegociacao,
  roundMoney,
  type FormaPagamentoNegociacao,
  type NegociacaoFormState,
  type PeriodicidadeNegociacao,
} from '../lib/negociacaoCobranca';
import ResumoPrincipalJurosNegociado from './ResumoPrincipalJurosNegociado';

function inputClass(): string {
  return 'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-950';
}

export default function FormNegociacaoCobranca({
  valorOriginal,
  dataContatoYmd,
  state,
  onChange,
}: {
  valorOriginal: number;
  dataContatoYmd: string;
  state: NegociacaoFormState;
  onChange: (next: NegociacaoFormState) => void;
}) {
  const restante = roundMoney(Math.max(0, state.valorNegociado - state.entradaValor));
  const parcelas = montarParcelasNegociacao(state, dataContatoYmd);

  function patch(p: Partial<NegociacaoFormState>) {
    onChange({ ...state, ...p });
  }

  const jurosAplicados = roundMoney(Math.max(0, state.valorNegociado - valorOriginal));

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        {state.percentualJuros > 0
          ? `Juros ${state.percentualJuros.toLocaleString('pt-BR')}% ao mês (÷ 30 dias) aplicados pela calculadora.`
          : 'Valor da conta do cliente. Use a calculadora (ícone) se precisar incluir juros.'}
      </p>
      <ResumoPrincipalJurosNegociado
        principal={valorOriginal}
        juros={jurosAplicados}
        novoValor={state.valorNegociado}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Entrada à vista</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={Number.isFinite(state.entradaValor) ? state.entradaValor : 0}
            onChange={(e) => patch({ entradaValor: Number(e.target.value) })}
            className={inputClass()}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Forma da entrada</span>
          <select
            value={state.entradaForma}
            onChange={(e) => patch({ entradaForma: e.target.value as FormaPagamentoNegociacao })}
            className={inputClass()}
          >
            {FORMAS_PAGAMENTO_NEGOCIACAO.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-xs text-slate-500">
        Restante: <span className="font-semibold text-slate-700 dark:text-slate-200">{moneyBr(restante)}</span>
      </p>
      {restante > 0.009 ? (
        <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-600">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Condição do restante</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Periodicidade *</span>
              <select
                value={state.periodicidade}
                onChange={(e) => patch({ periodicidade: e.target.value as PeriodicidadeNegociacao })}
                className={inputClass()}
              >
                {PERIODICIDADES_NEGOCIACAO.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Qtd. parcelas *</span>
              <input
                type="number"
                min={1}
                step={1}
                required
                value={state.quantidadeParcelas}
                onChange={(e) => patch({ quantidadeParcelas: Number(e.target.value) })}
                className={inputClass()}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Forma do restante *</span>
              <select
                value={state.restanteForma}
                onChange={(e) => patch({ restanteForma: e.target.value as FormaPagamentoNegociacao })}
                className={inputClass()}
              >
                {FORMAS_PAGAMENTO_NEGOCIACAO.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">1ª parcela *</span>
              <input
                type="date"
                required
                value={state.dataPrimeiraParcela}
                onChange={(e) => patch({ dataPrimeiraParcela: e.target.value })}
                className={inputClass()}
              />
            </label>
          </div>
        </div>
      ) : null}
      {parcelas.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-600">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-900">
              <tr>
                <th className="px-2 py-1.5 font-semibold">#</th>
                <th className="px-2 py-1.5 font-semibold">Tipo</th>
                <th className="px-2 py-1.5 font-semibold">Data</th>
                <th className="px-2 py-1.5 font-semibold">Forma</th>
                <th className="px-2 py-1.5 text-right font-semibold">Valor</th>
              </tr>
            </thead>
            <tbody>
              {parcelas.map((p) => (
                <tr key={`${p.tipo}-${p.n}`} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="px-2 py-1.5">{p.n}</td>
                  <td className="px-2 py-1.5">{p.tipo === 'entrada' ? 'Entrada' : 'Parcela'}</td>
                  <td className="px-2 py-1.5">{p.data.split('-').reverse().join('/')}</td>
                  <td className="px-2 py-1.5">{p.forma === 'pix' ? 'Pix' : 'Cartão'}</td>
                  <td className="px-2 py-1.5 text-right">{moneyBr(p.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <label className="block space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detalhe (opcional)</span>
        <textarea
          rows={2}
          value={state.detalhe}
          onChange={(e) => patch({ detalhe: e.target.value })}
          placeholder="Complemento livre (observação do acordo, etc.)"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
        />
      </label>
    </div>
  );
}
