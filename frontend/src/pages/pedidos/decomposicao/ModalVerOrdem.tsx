import { useEffect, useRef, useState } from 'react';
import {
  atualizarQuantidadeOrdem,
  listarAlocacoesOrdem,
  marcarAlocacaoNaProximaOrdem,
  nomeGrupo,
  obterDecomposicaoPai,
  preverAlocacoesPai,
  type AlocacaoPedido,
  type AnotacaoPecaOrdem,
  type DecomposicaoPaiCadastro,
  type OrdemProducao,
} from '../../../api/decomposicao';
import { imprimirOrdemProducao } from './imprimirOrdemProducao';

export type RascunhoOrdem = {
  paiId: number;
  grupo: string;
  codigo: string;
  nome: string;
  pecas: AnotacaoPecaOrdem[];
};

function fmt(valor: number | null): string {
  if (valor == null) return '—';
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

export default function ModalVerOrdem({
  ordem,
  rascunho = null,
  salvando = false,
  podeGerar = true,
  onClose,
  onAtualizada,
  onSalvar,
  onSalvarRascunho,
}: {
  ordem: OrdemProducao | null;
  rascunho?: RascunhoOrdem | null;
  salvando?: boolean;
  podeGerar?: boolean;
  onClose: () => void;
  onAtualizada: (ordem: OrdemProducao) => void;
  onSalvar: () => void;
  onSalvarRascunho?: (body: {
    paiId: number;
    quantidade: number;
    observacao: string;
    numero: string;
    pecas: AnotacaoPecaOrdem[];
    alocacoes: AlocacaoPedido[];
  }) => Promise<void>;
}) {
  const numeroRascunho = useRef(`OP-${Date.now().toString(36).toUpperCase()}`);
  const [cadastro, setCadastro] = useState<DecomposicaoPaiCadastro | null>(null);
  const [alocacoes, setAlocacoes] = useState<AlocacaoPedido[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [impressa, setImpressa] = useState(false);
  const [quantidade, setQuantidade] = useState('');
  const [imprimindo, setImprimindo] = useState(false);
  const codigoPai = rascunho?.codigo ?? ordem?.codigoPai ?? '';
  const nomePai = rascunho?.nome ?? ordem?.nomePai ?? '';
  const grupo = rascunho?.grupo ?? ordem?.grupo ?? '';
  const numero = rascunho ? numeroRascunho.current : ordem?.numero ?? '';

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    if (rascunho) {
      void Promise.all([preverAlocacoesPai(rascunho.paiId), obterDecomposicaoPai(rascunho.paiId)])
        .then(([data, pai]) => {
          if (!ativo) return;
          setCadastro(pai);
          setAlocacoes(data.alocacoes);
          setQuantidade(String(data.saldo > 0 ? data.saldo : 1));
        })
        .catch((e: unknown) => {
          if (!ativo) return;
          setAlocacoes([]);
          setQuantidade('1');
          setErro(e instanceof Error ? e.message : 'Erro ao ler os pedidos.');
        })
        .finally(() => {
          if (ativo) setCarregando(false);
        });
      return () => {
        ativo = false;
      };
    }
    if (!ordem) {
      setCarregando(false);
      return () => {
        ativo = false;
      };
    }
    void listarAlocacoesOrdem(ordem.id)
      .then((data) => {
        if (!ativo) return;
        setAlocacoes(data.alocacoes);
        setQuantidade(podeGerar ? String(data.saldo) : String(ordem.quantidade));
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
  }, [ordem?.id, ordem?.quantidade, rascunho, podeGerar]);

  const saldo = alocacoes.reduce((soma, item) => soma + item.saldo, 0);

  const alternarProxima = async (item: AlocacaoPedido, marcada: boolean) => {
    if (!podeGerar) return;
    setAlocacoes((atual) =>
      atual.map((linha) => (linha.idItem === item.idItem ? { ...linha, apareceNaProxima: marcada } : linha))
    );
    if (rascunho || !ordem) return;
    try {
      await marcarAlocacaoNaProximaOrdem(ordem.id, item.idItem, marcada);
    } catch (e) {
      setAlocacoes((atual) =>
        atual.map((linha) => (linha.idItem === item.idItem ? { ...linha, apareceNaProxima: !marcada } : linha))
      );
      setErro(e instanceof Error ? e.message : 'Não foi possível gravar a opção da próxima ordem.');
    }
  };

  const imprimir = async () => {
    const qtd = Number(String(quantidade).replace(',', '.'));
    if (!Number.isFinite(qtd) || qtd <= 0) {
      setErro('Informe a quantidade a produzir.');
      return;
    }
    if (rascunho) {
      if (!cadastro) {
        setErro('O produto pai ainda não foi carregado.');
        return;
      }
      const paraImprimir: OrdemProducao = {
        id: 0,
        numero,
        paiId: rascunho.paiId,
        grupo: rascunho.grupo,
        codigoPai: rascunho.codigo,
        nomePai: rascunho.nome,
        quantidade: qtd,
        observacao: null,
        criadoPorLogin: null,
        createdAt: new Date().toISOString(),
        itens: [],
        pecas: cadastro.pecas.map((peca, index) => ({
          id: index,
          descricao: peca.descricao,
          quantidadeNoPai: peca.quantidade,
          quantidadeTotal: peca.quantidade * qtd,
          medidaL: peca.medidaL,
          medidaA: peca.medidaA,
          materiaPrima: peca.materiaPrima,
          medidaCorte: rascunho.pecas[index]?.medidaCorte ?? '',
          observacao: rascunho.pecas[index]?.observacao ?? '',
          imprimir: rascunho.pecas[index]?.imprimir !== false,
        })),
      };
      setImprimindo(true);
      setErro(null);
      try {
        await imprimirOrdemProducao(paraImprimir);
        setImpressa(true);
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao imprimir a ordem.');
      } finally {
        setImprimindo(false);
      }
      return;
    }
    if (!ordem) return;
    if (!podeGerar) {
      setImprimindo(true);
      setErro(null);
      try {
        await imprimirOrdemProducao(ordem);
        setImpressa(true);
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao imprimir a ordem.');
      } finally {
        setImprimindo(false);
      }
      return;
    }
    setImprimindo(true);
    setErro(null);
    try {
      const atual = qtd === ordem.quantidade ? ordem : await atualizarQuantidadeOrdem(ordem.id, qtd);
      if (atual !== ordem) onAtualizada(atual);
      await imprimirOrdemProducao(atual);
      setImpressa(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao imprimir a ordem.');
    } finally {
      setImprimindo(false);
    }
  };

  const fechar = () => {
    if (rascunho && !window.confirm('A ordem ainda não foi salva. Deseja sair sem gravar?')) return;
    onClose();
  };

  const salvar = async () => {
    if (!rascunho) {
      onSalvar();
      return;
    }
    const qtd = Number(String(quantidade).replace(',', '.'));
    if (!Number.isFinite(qtd) || qtd <= 0) {
      setErro('Informe a quantidade a produzir.');
      return;
    }
    if (!onSalvarRascunho) return;
    setErro(null);
    try {
      await onSalvarRascunho({
        paiId: rascunho.paiId,
        quantidade: qtd,
        observacao: '',
        numero,
        pecas: rascunho.pecas,
        alocacoes,
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar a ordem.');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={fechar}>
      <div
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {numero} · {nomeGrupo(grupo)}
            {rascunho ? ' · ainda não salva' : ''}
          </p>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {codigoPai} — {nomePai}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {rascunho
              ? 'A ordem só entra no histórico depois da impressão e do botão Salvar. A caixa Próxima ordem vem desmarcada.'
              : 'Pedidos em aberto dos produtos filhos. A caixa Próxima ordem vem desmarcada: assim o item não entra na ordem seguinte deste pai. Marque só o que deve aparecer de novo.'}
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
              disabled={!podeGerar || carregando || imprimindo}
            />
            <p className="mt-1 text-xs text-slate-500">
              {podeGerar
                ? `Sugestão preenchida: ${carregando ? '…' : fmt(saldo)}. Se necessário, altere antes de imprimir.`
                : 'A quantidade fica travada. Gerar ou alterar a ordem exige a permissão visualizar e gerar.'}
            </p>
          </div>

          {carregando ? (
            <p className="text-sm text-slate-500">Consultando os pedidos no NOMUS…</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-primary-600 text-white">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Pedido</th>
                    <th className="px-4 py-3 font-semibold">Cliente</th>
                    <th className="px-4 py-3 font-semibold">Produto filho</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Qtde pedida</th>
                    <th className="px-4 py-3 font-semibold">Saldo</th>
                    <th className="px-4 py-3 font-semibold">Próxima ordem</th>
                  </tr>
                </thead>
                <tbody>
                  {alocacoes.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                        Nenhum pedido em aberto para entrar nesta ordem.
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
                      <td className="px-4 py-2">
                        <label className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-primary-600"
                            checked={item.apareceNaProxima === true}
                            disabled={!podeGerar || imprimindo}
                            onChange={(e) => void alternarProxima(item, e.target.checked)}
                          />
                          <span className="text-xs">Aparece na próxima</span>
                        </label>
                      </td>
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
                      <td className="px-4 py-2" />
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
            onClick={fechar}
            disabled={imprimindo || salvando}
          >
            Fechar
          </button>
          {impressa && (
            <button
              type="button"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              onClick={() => void salvar()}
              disabled={salvando}
            >
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          )}
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
