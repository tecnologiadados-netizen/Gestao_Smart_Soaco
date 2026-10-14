import { nomeGrupo, type DecomposicaoDetalhe } from '../../../api/decomposicao';

function fmt(valor: number | null): string {
  if (valor == null) return '—';
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

export default function ModalDetalheDecomposicao({
  detalhe,
  carregando,
  erro,
  onClose,
}: {
  detalhe: DecomposicaoDetalhe | null;
  carregando: boolean;
  erro: string | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {detalhe ? nomeGrupo(detalhe.grupo) : 'Detalhe da carteira'}
          </p>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {detalhe ? `${detalhe.codigo} — ${detalhe.nome}` : 'Carregando…'}
          </h2>
          {detalhe && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Quantidade do pai (total vendido dos filhos): <strong>{fmt(detalhe.sugestao)}</strong>
              <span className="mx-2 text-slate-300">·</span>
              Pendente: <strong>{fmt(detalhe.pendente)}</strong>
            </p>
          )}
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {carregando && <p className="text-sm text-slate-500">Consultando a carteira…</p>}
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          {detalhe && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-primary-600 text-white">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Filho</th>
                    <th className="px-4 py-3 font-semibold">Qtd no pai</th>
                    <th className="px-4 py-3 font-semibold">Qtde pedida</th>
                    <th className="px-4 py-3 font-semibold">Pendente</th>
                  </tr>
                </thead>
                <tbody>
                  {detalhe.filhos.map((filho) => (
                    <tr key={filho.id} className="border-t border-slate-100 dark:border-slate-700">
                      <td className="px-4 py-2">
                        <div className="font-medium text-slate-800 dark:text-slate-100">{filho.codigoNomus}</div>
                        <div className="text-xs text-slate-500">{filho.descricao}</div>
                      </td>
                      <td className="px-4 py-2">{filho.quantidade}</td>
                      <td className="px-4 py-2">{fmt(filho.qtdePedida)}</td>
                      <td className="px-4 py-2">{fmt(filho.pendente)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50 font-semibold dark:border-slate-600 dark:bg-slate-900">
                    <td className="px-4 py-2" colSpan={2}>
                      Total vendido dos filhos
                    </td>
                    <td className="px-4 py-2">{fmt(detalhe.qtdePedida)}</td>
                    <td className="px-4 py-2">{fmt(detalhe.pendente)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-200 px-5 py-4 dark:border-slate-700">
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
