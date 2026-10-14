import { useEffect, useState } from 'react';
import {
  detalharDecomposicao,
  nomeGrupo,
  obterDecomposicaoPai,
  type DecomposicaoDetalhe,
  type DecomposicaoPaiCadastro,
  type DecomposicaoPaiGrade,
} from '../../../api/decomposicao';

function fmt(valor: number | null): string {
  if (valor == null) return '—';
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

export default function ModalGerarOrdem({
  pai,
  salvando,
  erro,
  onClose,
  onConfirmar,
}: {
  pai: DecomposicaoPaiGrade;
  salvando: boolean;
  erro: string | null;
  onClose: () => void;
  onConfirmar: (body: { quantidade: number; observacao: string }) => void;
}) {
  const [cadastro, setCadastro] = useState<DecomposicaoPaiCadastro | null>(null);
  const [detalhe, setDetalhe] = useState<DecomposicaoDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErroCarga(null);
    void Promise.all([obterDecomposicaoPai(pai.id), detalharDecomposicao(pai.id)])
      .then(([cad, det]) => {
        if (!ativo) return;
        setCadastro(cad);
        setDetalhe(det.pai);
        if (!det.carteiraDisponivel) {
          setErroCarga(det.carteiraErro || 'A carteira não pôde ser lida. A quantidade sugerida pode ficar incompleta.');
        }
      })
      .catch((e: unknown) => {
        if (!ativo) return;
        setErroCarga(e instanceof Error ? e.message : 'Erro ao preparar a ordem.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [pai.id]);

  const qtd = detalhe?.sugestao != null && detalhe.sugestao > 0 ? detalhe.sugestao : 1;
  const linhas = (cadastro?.filhos ?? []).map((filho) => {
    const venda = detalhe?.filhos.find(
      (item) => item.codigoNomus.trim().toUpperCase() === filho.codigoNomus.trim().toUpperCase()
    );
    return {
      ...filho,
      saldo: venda?.pendente ?? null,
    };
  });

  const confirmar = () => {
    onConfirmar({ quantidade: qtd, observacao: '' });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{nomeGrupo(pai.grupo)}</p>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Gerar ordem de serviço</h2>
          <p className="mt-1 text-sm text-slate-500">
            {pai.codigo} — {pai.nome}. Na etapa seguinte você informa a quantidade a produzir, já sugerida pelo saldo
            em aberto dos filhos.
          </p>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          {(erro || erroCarga) && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {erro || erroCarga}
            </p>
          )}
          {!carregando && cadastro && cadastro.filhos.length === 0 && (cadastro.pecas ?? []).length === 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Este pai ainda não tem peças nem filhos. Abra Cadastros, entre em Vínculos e complete o detalhamento antes
              de gerar a ordem.
            </p>
          )}
          {carregando ? (
            <p className="text-sm text-slate-500">Preparando a ordem…</p>
          ) : (
            <>
              {(cadastro?.pecas.length ?? 0) > 0 && (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="bg-primary-600 text-white">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Componente / peça</th>
                        <th className="px-4 py-3 font-semibold">Qtd</th>
                        <th className="px-4 py-3 font-semibold">Qtd total</th>
                        <th className="px-4 py-3 font-semibold">L (mm)</th>
                        <th className="px-4 py-3 font-semibold">A (mm)</th>
                        <th className="px-4 py-3 font-semibold">Matéria-prima</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cadastro?.pecas.map((peca, index) => (
                        <tr key={`${index}-${peca.descricao}`} className="border-t border-slate-100 dark:border-slate-700">
                          <td className="px-4 py-2 font-medium">{peca.descricao}</td>
                          <td className="px-4 py-2">{peca.quantidade}</td>
                          <td className="px-4 py-2 font-semibold">
                            {Number.isFinite(qtd) && qtd > 0 ? fmt(peca.quantidade * qtd) : '—'}
                          </td>
                          <td className="px-4 py-2">{peca.medidaL || '—'}</td>
                          <td className="px-4 py-2">{peca.medidaA || '—'}</td>
                          <td className="px-4 py-2">{peca.materiaPrima || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {linhas.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-primary-600 text-white">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Produto filho</th>
                      <th className="px-4 py-3 font-semibold">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((linha) => {
                      const temSaldo = (linha.saldo ?? 0) > 0;
                      return (
                      <tr
                        key={linha.codigoNomus}
                        className={
                          temSaldo
                            ? 'border-t border-l-4 border-emerald-500/80 bg-emerald-500/10'
                            : 'border-t border-slate-100 dark:border-slate-700'
                        }
                      >
                        <td className="px-4 py-2">
                          <div className="font-medium">{linha.codigoNomus}</div>
                          <div className="text-xs text-slate-500">{linha.descricao}</div>
                        </td>
                        <td className="px-4 py-2">{fmt(linha.saldo ?? 0)}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
            onClick={onClose}
            disabled={salvando}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            onClick={confirmar}
            disabled={
              salvando || carregando || !cadastro || (cadastro.filhos.length === 0 && (cadastro.pecas ?? []).length === 0)
            }
          >
            {salvando ? 'Gerando…' : 'Gerar ordem'}
          </button>
        </div>
      </div>
    </div>
  );
}
