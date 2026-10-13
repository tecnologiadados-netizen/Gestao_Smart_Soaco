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
  const [quantidade, setQuantidade] = useState('');
  const [observacao, setObservacao] = useState('');
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErroCarga(null);
    void Promise.all([obterDecomposicaoPai(pai.id), detalharDecomposicao(pai.id)])
      .then(([cad, det]) => {
        if (!ativo) return;
        setCadastro(cad);
        setDetalhe(det.pai);
        const sugerida = det.pai.sugestao != null && det.pai.sugestao > 0 ? det.pai.sugestao : 1;
        setQuantidade(String(sugerida));
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

  const qtd = Number(String(quantidade).replace(',', '.'));
  const linhas = (cadastro?.filhos ?? []).map((filho) => {
    const venda = detalhe?.filhos.find(
      (item) => item.codigoNomus.trim().toUpperCase() === filho.codigoNomus.trim().toUpperCase()
    );
    return {
      ...filho,
      qtdePedida: venda?.qtdePedida ?? null,
      total: Number.isFinite(qtd) && qtd > 0 ? filho.quantidade * qtd : null,
    };
  });

  const confirmar = () => {
    setErroLocal(null);
    if (!Number.isFinite(qtd) || qtd <= 0) {
      setErroLocal('Informe a quantidade a produzir.');
      return;
    }
    onConfirmar({ quantidade: qtd, observacao: observacao.trim() });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{nomeGrupo(pai.grupo)}</p>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Gerar ordem</h2>
          <p className="mt-1 text-sm text-slate-500">
            {pai.codigo} — {pai.nome}. A quantidade sugerida é o total vendido dos filhos.
          </p>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          {(erro || erroLocal || erroCarga) && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {erroLocal || erro || erroCarga}
            </p>
          )}
          {!carregando && cadastro && cadastro.filhos.length === 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Este pai ainda não tem filhos. Abra Cadastros, entre em Vínculos e vincule os produtos do NOMUS antes de
              gerar a ordem.
            </p>
          )}
          {carregando ? (
            <p className="text-sm text-slate-500">Preparando a ordem…</p>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Quantidade a produzir
                  </label>
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700"
                    value={quantidade}
                    onChange={(e) => setQuantidade(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Observação
                  </label>
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700"
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-primary-600 text-white">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Produto filho</th>
                      <th className="px-4 py-3 font-semibold">Qtd no pai</th>
                      <th className="px-4 py-3 font-semibold">Qtd total</th>
                      <th className="px-4 py-3 font-semibold">Matéria-prima (PP)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((linha) => (
                      <tr key={linha.codigoNomus} className="border-t border-slate-100 dark:border-slate-700">
                        <td className="px-4 py-2">
                          <div className="font-medium">{linha.codigoNomus}</div>
                          <div className="text-xs text-slate-500">{linha.descricao}</div>
                        </td>
                        <td className="px-4 py-2">{linha.quantidade}</td>
                        <td className="px-4 py-2 font-semibold">{fmt(linha.total)}</td>
                        <td className="px-4 py-2">
                          {linha.materiaPrimaCodigo
                            ? `${linha.materiaPrimaCodigo}${linha.materiaPrimaDescricao ? ` — ${linha.materiaPrimaDescricao}` : ''}`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
            disabled={salvando || carregando || !cadastro || cadastro.filhos.length === 0}
          >
            {salvando ? 'Gerando…' : 'Gerar ordem'}
          </button>
        </div>
      </div>
    </div>
  );
}
