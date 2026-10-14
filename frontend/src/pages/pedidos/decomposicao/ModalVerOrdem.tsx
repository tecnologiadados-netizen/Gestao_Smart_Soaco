import { useEffect, useState } from 'react';
import {
  atualizarQuantidadeOrdem,
  listarAlocacoesOrdem,
  nomeGrupo,
  type AlocacaoPedido,
  type OrdemProducao,
} from '../../../api/decomposicao';
import { imprimirOrdemProducao } from './imprimirOrdemProducao';

function fmt(valor: number | null): string {
  if (valor == null) return '—';
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

export default function ModalVerOrdem({
  ordem,
  onClose,
  onAtualizada,
}: {
  ordem: OrdemProducao;
  onClose: () => void;
  onAtualizada: (ordem: OrdemProducao) => void;
}) {
  const [alocacoes, setAlocacoes] = useState<AlocacaoPedido[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [quantidade, setQuantidade] = useState('');
  const [imprimindo, setImprimindo] = useState(false);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    void listarAlocacoesOrdem(ordem.id)
      .then((data) => {
        if (!ativo) return;
        setAlocacoes(data.alocacoes);
        setQuantidade(String(data.saldo));
      })
      .catch((e: unknown) => {
        if (!ativo) return;
        setAlocacoes([]);
        setQuantidade(String(ordem.quantidade));
        setErro(e instanceof Error ? e.message : 'Erro ao ler os pedidos.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [ordem.id]);

  const saldo = alocacoes.reduce((soma, item) => soma + item.saldo, 0);

  const imprimir = async () => {
    const qtd = Number(String(quantidade).replace(',', '.'));
    if (!Number.isFinite(qtd) || qtd <= 0) {
      setErro('Informe a quantidade a produzir.');
      return;
    }
    setImprimindo(true);
    setErro(null);
    try {
      const atual = qtd === ordem.quantidade ? ordem : await atualizarQuantidadeOrdem(ordem.id, qtd);
      if (atual !== ordem) onAtualizada(atual);
      await imprimirOrdemProducao(atual);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao imprimir a ordem.');
    } finally {
      setImprimindo(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-slate-800"
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
            Pedidos em aberto dos produtos filhos. A sugestão soma só o saldo de Liberado e Atendido parcialmente.
          </p>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          {erro && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{erro}</p>
          )}

          <div className="max-w-xs">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Quantidade a produzir
            </label>
            <input
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              disabled={carregando || imprimindo}
            />
            <p className="mt-1 text-xs text-slate-500">
              Sugestão preenchida: {carregando ? '…' : fmt(saldo)}. Se necessário, altere antes de imprimir.
            </p>
          </div>

          {carregando ? (
            <p className="text-sm text-slate-500">Consultando os pedidos no NOMUS…</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="bg-primary-600 text-white">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Pedido</th>
                    <th className="px-4 py-3 font-semibold">Cliente</th>
                    <th className="px-4 py-3 font-semibold">Produto filho</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Qtde pedida</th>
                    <th className="px-4 py-3 font-semibold">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {alocacoes.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                        Nenhum pedido em aberto para os filhos vinculados.
                      </td>
                    </tr>
                  )}
                  {alocacoes.map((item) => (
                    <tr key={item.idItem} className="border-t border-slate-100 dark:border-slate-700">
                      <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-100">{item.numeroPedido}</td>
                      <td className="px-4 py-2">{item.cliente || '—'}</td>
                      <td className="px-4 py-2">
                        <div className="font-medium">{item.codigoFilho}</div>
                        <div className="text-xs text-slate-500">{item.descricaoFilho}</div>
                      </td>
                      <td className="px-4 py-2">{item.statusNome}</td>
                      <td className="px-4 py-2">{fmt(item.qtdePedida)}</td>
                      <td className="px-4 py-2 font-semibold">{fmt(item.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
                {alocacoes.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50 font-semibold dark:border-slate-600 dark:bg-slate-900">
                      <td className="px-4 py-2" colSpan={5}>
                        Saldo em aberto
                      </td>
                      <td className="px-4 py-2">{fmt(saldo)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
            onClick={onClose}
            disabled={imprimindo}
          >
            Fechar
          </button>
          <button
            type="button"
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            onClick={() => void imprimir()}
            disabled={carregando || imprimindo}
          >
            {imprimindo ? 'Imprimindo…' : 'Imprimir'}
          </button>
        </div>
      </div>
    </div>
  );
}
