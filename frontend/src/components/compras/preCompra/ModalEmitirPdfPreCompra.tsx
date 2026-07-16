import { useEffect, useState } from 'react';
import {
  downloadPreCompraPdf,
  fetchPreCompraContatos,
  fetchPreCompraFornecedores,
  type PreCompraContato,
  type PreCompraFornecedor,
} from '../../../api/preCompra';

interface Props {
  cotacao: string | null;
  onClose: () => void;
  onGeneratingChange?: (cotacao: string | null) => void;
}

type Step = 'fornecedor' | 'contato' | 'gerando';

export default function ModalEmitirPdfPreCompra({ cotacao, onClose, onGeneratingChange }: Props) {
  const [step, setStep] = useState<Step>('fornecedor');
  const [fornecedores, setFornecedores] = useState<PreCompraFornecedor[]>([]);
  const [contatos, setContatos] = useState<PreCompraContato[]>([]);
  const [fornecedorId, setFornecedorId] = useState<number | null>(null);
  const [fornecedorNome, setFornecedorNome] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!cotacao) return;
    setLoading(true);
    setError('');
    setStep('fornecedor');
    setFornecedorId(null);
    setFornecedorNome(null);
    onGeneratingChange?.(null);

    fetchPreCompraFornecedores(cotacao)
      .then(async ({ fornecedores: list, vencedorId }) => {
        setFornecedores(list);
        const autoId =
          vencedorId != null && list.some((f) => f.id === vencedorId)
            ? vencedorId
            : list.length === 1
              ? list[0].id
              : null;
        if (autoId != null) {
          await loadContatos(cotacao, autoId, list);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar fornecedores'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cotacao]);

  async function loadContatos(cot: string, fornId: number, listFornecedores?: PreCompraFornecedor[]) {
    setLoading(true);
    setError('');
    try {
      const { contatos: list, contatoId, contatoTextoLivre } = await fetchPreCompraContatos(cot, fornId);
      setContatos(list);
      setFornecedorId(fornId);
      const nome =
        (listFornecedores ?? fornecedores).find((f) => f.id === fornId)?.nome ?? fornecedorNome;
      setFornecedorNome(nome ?? null);

      // Contato já definido na coleta de preços do Nomus → gera direto.
      if (contatoId != null) {
        await gerarPdf(cot, fornId, contatoId);
        return;
      }
      if (contatoTextoLivre) {
        await gerarPdf(cot, fornId, null);
        return;
      }
      if (list.length === 1) {
        await gerarPdf(cot, fornId, list[0].id);
        return;
      }
      if (list.length > 1) {
        setStep('contato');
        return;
      }
      setError('Nenhum contato encontrado para este fornecedor.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar contatos');
    } finally {
      setLoading(false);
    }
  }

  async function gerarPdf(cot: string, fornId: number, contId: number | null) {
    setStep('gerando');
    onGeneratingChange?.(cot);
    setError('');
    try {
      await downloadPreCompraPdf(cot, fornId, contId);
      onGeneratingChange?.(null);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar PDF');
      onGeneratingChange?.(null);
      setStep(contatos.length > 1 ? 'contato' : 'fornecedor');
    }
  }

  if (!cotacao) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-xl dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            Emitir PDF — {cotacao}
          </h2>
          <button
            type="button"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none disabled:opacity-40"
            onClick={onClose}
            disabled={step === 'gerando'}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <div className="p-4">
          {loading && step !== 'gerando' && (
            <div className="space-y-2 animate-pulse">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
            </div>
          )}

          {error && (
            <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          {!loading && step === 'fornecedor' && fornecedores.length > 1 && (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
                Selecione o fornecedor para gerar o formulário:
              </p>
              <ul className="space-y-2 max-h-64 overflow-auto">
                {fornecedores.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700/50"
                      onClick={() => loadContatos(cotacao, f.id)}
                    >
                      <strong className="block text-sm text-slate-800 dark:text-slate-100">{f.nome}</strong>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{f.cnpj}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {!loading && step === 'contato' && contatos.length > 1 && (
            <>
              {fornecedorNome && (
                <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                  Fornecedor: <strong className="text-slate-700 dark:text-slate-200">{fornecedorNome}</strong>
                </p>
              )}
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
                Selecione o contato do fornecedor:
              </p>
              <ul className="space-y-2 max-h-64 overflow-auto">
                {contatos.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700/50"
                      onClick={() => {
                        if (fornecedorId) gerarPdf(cotacao, fornecedorId, c.id);
                      }}
                    >
                      {c.nome}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {step === 'gerando' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700 dark:border-slate-600 dark:border-t-slate-200" />
              <p className="text-sm text-slate-600 dark:text-slate-300">Gerando PDF…</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                Aguarde — o Word está convertendo o documento.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
