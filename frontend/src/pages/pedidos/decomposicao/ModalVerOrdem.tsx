import { nomeGrupo, type OrdemProducao } from '../../../api/decomposicao';
import { imprimirOrdemProducao } from './imprimirOrdemProducao';

function fmt(valor: number | null): string {
  if (valor == null) return '—';
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

export default function ModalVerOrdem({ ordem, onClose }: { ordem: OrdemProducao; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {ordem.numero} · {nomeGrupo(ordem.grupo)}
          </p>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {ordem.codigoPai} — {ordem.nomePai}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Quantidade a produzir: <strong>{fmt(ordem.quantidade)}</strong>
            <span className="mx-2">·</span>
            {new Date(ordem.createdAt).toLocaleString('pt-BR')}
          </p>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-primary-600 text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">Produto filho</th>
                  <th className="px-4 py-3 font-semibold">Qtd no pai</th>
                  <th className="px-4 py-3 font-semibold">Qtd total</th>
                  <th className="px-4 py-3 font-semibold">Matéria-prima (PP)</th>
                  <th className="px-4 py-3 font-semibold">Qtde pedida</th>
                </tr>
              </thead>
              <tbody>
                {ordem.itens.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100 dark:border-slate-700">
                    <td className="px-4 py-2">
                      <div className="font-medium">{item.codigoNomus}</div>
                      <div className="text-xs text-slate-500">{item.descricao}</div>
                    </td>
                    <td className="px-4 py-2">{fmt(item.quantidadeNoPai)}</td>
                    <td className="px-4 py-2 font-semibold">{fmt(item.quantidadeTotal)}</td>
                    <td className="px-4 py-2">
                      {item.materiaPrimaCodigo
                        ? `${item.materiaPrimaCodigo}${item.materiaPrimaDescricao ? ` — ${item.materiaPrimaDescricao}` : ''}`
                        : '—'}
                    </td>
                    <td className="px-4 py-2">{fmt(item.qtdePedida)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ordem.observacao && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{ordem.observacao}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
            onClick={onClose}
          >
            Fechar
          </button>
          <button
            type="button"
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            onClick={() => imprimirOrdemProducao(ordem)}
          >
            Gerar PDF
          </button>
        </div>
      </div>
    </div>
  );
}
