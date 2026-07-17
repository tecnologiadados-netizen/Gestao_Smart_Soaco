import { useState, useEffect, useCallback, useRef } from 'react';
import { listarFornecedores, atualizarFornecedoresColeta, listarCondicoesPagamento, listarFormasPagamento } from '../../api/compras';
import type { FornecedorOpcao, FornecedorColetaItem, OpcaoNomus } from '../../api/compras';
import { criarMatcherTextoLivre } from '../../utils/textoLivreBusca';

const MAX_FORNECEDORES = 5;
const MAX_ITENS_LISTA_FORNECEDORES = 50;
const labelClass = 'text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap block mb-0.5';
const inputClass =
  'rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-2 py-1 text-sm min-w-0 w-full focus:ring-2 focus:ring-primary-500 focus:border-primary-500';
const btnPrimary = 'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium disabled:opacity-50 transition';
const btnSecondary = 'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 text-sm font-medium disabled:opacity-50 transition';
const selectCompactClass =
  'rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-1.5 py-1 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 w-12 shrink-0';

export interface ModalFornecedoresColetaProps {
  coletaId: number;
  coletaLabel: string;
  fornecedoresAtuais: FornecedorColetaItem[];
  onClose: () => void;
  onSalvo?: (fornecedores: FornecedorColetaItem[]) => void;
  /** Quando true, renderiza inline (sem overlay) para uso em abas. */
  inline?: boolean;
}

function emptyItem(f: FornecedorOpcao): FornecedorColetaItem {
  return {
    idPessoa: f.id,
    nome: f.nome,
    pedidoMinimo: '',
    condicaoPagamento: '',
    formaPagamento: '',
    valorFrete: '',
    valorFreteTipo: undefined,
    ipi: '',
    ipiTipo: undefined,
  };
}

export default function ModalFornecedoresColeta({
  coletaId,
  coletaLabel,
  fornecedoresAtuais,
  onClose,
  onSalvo,
  inline = false,
}: ModalFornecedoresColetaProps) {
  const [opcoes, setOpcoes] = useState<FornecedorOpcao[]>([]);
  const [condicoesPagamento, setCondicoesPagamento] = useState<OpcaoNomus[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<OpcaoNomus[]>([]);
  const [itens, setItens] = useState<FornecedorColetaItem[]>(() =>
    Array.isArray(fornecedoresAtuais) && fornecedoresAtuais.length > 0
      ? fornecedoresAtuais.map((f) => ({
          idPessoa: f.idPessoa,
          nome: f.nome ?? '',
          pedidoMinimo: f.pedidoMinimo ?? '',
          condicaoPagamento: f.condicaoPagamento ?? '',
          formaPagamento: f.formaPagamento ?? '',
          valorFrete: f.valorFrete ?? '',
          valorFreteTipo: f.valorFreteTipo,
          ipi: f.ipi ?? '',
          ipiTipo: f.ipiTipo,
        }))
      : []
  );
  const [searchFornecedor, setSearchFornecedor] = useState('');
  const [dropdownFornecedorOpen, setDropdownFornecedorOpen] = useState(false);
  const dropdownFornecedorRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownFornecedorRef.current && !dropdownFornecedorRef.current.contains(e.target as Node)) {
        setDropdownFornecedorOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [resForn, resCond, resForm] = await Promise.all([
        listarFornecedores(),
        listarCondicoesPagamento(),
        listarFormasPagamento(),
      ]);
      setOpcoes(Array.isArray(resForn.data) ? resForn.data : []);
      setCondicoesPagamento(Array.isArray(resCond.data) ? resCond.data : []);
      setFormasPagamento(Array.isArray(resForm.data) ? resForm.data : []);
      if (resForn.error) setErro(resForn.error);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar fornecedores.');
      setOpcoes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const adicionarFornecedor = (f: FornecedorOpcao) => {
    if (itens.some((i) => i.idPessoa === f.id) || itens.length >= MAX_FORNECEDORES) return;
    setItens((prev) => [...prev, emptyItem(f)]);
    setSearchFornecedor('');
    setDropdownFornecedorOpen(false);
  };

  const remover = (idPessoa: number) => {
    setItens((prev) => prev.filter((i) => i.idPessoa !== idPessoa));
  };

  const atualizarCampo = (
    idPessoa: number,
    campo: keyof FornecedorColetaItem,
    valor: string | undefined
  ) => {
    setItens((prev) =>
      prev.map((i) => (i.idPessoa === idPessoa ? { ...i, [campo]: valor } : i))
    );
  };

  const handleSalvar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      // Nesta tela só permitimos % para frete e IPI; ao salvar forçamos tipo '%'
      const itensParaSalvar = itens.map((i) => ({
        ...i,
        valorFreteTipo: (i.valorFrete != null && String(i.valorFrete).trim() !== '') ? '%' as const : undefined,
        ipiTipo: (i.ipi != null && String(i.ipi).trim() !== '') ? '%' as const : undefined,
      }));
      const result = await atualizarFornecedoresColeta(coletaId, itensParaSalvar);
      if (result.ok) {
        onSalvo?.(itensParaSalvar);
        onClose();
      } else {
        setErro(result.error ?? 'Erro ao salvar.');
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const opcoesDisponiveis = opcoes.filter((o) => !itens.some((i) => i.idPessoa === o.id));
  const matchFornecedor = criarMatcherTextoLivre(searchFornecedor);
  const opcoesFiltradas = searchFornecedor.trim()
    ? opcoesDisponiveis.filter((o) =>
        matchFornecedor([o.nome, o.nomeRazaoSocial, o.cnpjCpf].filter(Boolean).join(' '))
      )
    : opcoesDisponiveis;
  const opcoesParaLista = opcoesFiltradas.slice(0, MAX_ITENS_LISTA_FORNECEDORES);

  const conteudo = (
    <div
      className={inline ? 'h-full min-h-0 flex flex-col bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col'}
      onClick={inline ? undefined : (e) => e.stopPropagation()}
    >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-600 shrink-0">
          <h2 id="modal-fornecedores-coleta-title" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Fornecedores da cotação — {coletaLabel}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 dark:hover:text-slate-200"
            aria-label="Fechar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-600 shrink-0 bg-slate-50 dark:bg-slate-800/70">
          <p className={labelClass}>
            Adicione até {MAX_FORNECEDORES} fornecedores e preencha as informações. ({itens.length}/{MAX_FORNECEDORES})
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-1" ref={dropdownFornecedorRef}>
            <div className="relative flex-1 min-w-0 max-w-md">
              <input
                type="text"
                value={searchFornecedor}
                onChange={(e) => {
                  setSearchFornecedor(e.target.value);
                  setDropdownFornecedorOpen(true);
                }}
                onFocus={() => setDropdownFornecedorOpen(true)}
                placeholder="Buscar fornecedor… (% refina)"
                className={inputClass}
                disabled={opcoesDisponiveis.length === 0 || itens.length >= MAX_FORNECEDORES}
                autoComplete="off"
              />
              {dropdownFornecedorOpen && opcoesDisponiveis.length > 0 && (
                <div
                  className="absolute left-0 right-0 top-full mt-0.5 z-20 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg max-h-60 overflow-auto"
                  role="listbox"
                >
                  {opcoesParaLista.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-slate-500 dark:text-slate-400 text-center">
                      Nenhum fornecedor encontrado para &quot;{searchFornecedor}&quot;
                    </div>
                  ) : (
                    opcoesParaLista.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        role="option"
                        onClick={() => adicionarFornecedor(o)}
                        className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-primary-50 dark:hover:bg-primary-900/30 border-b border-slate-100 dark:border-slate-700 last:border-b-0"
                      >
                        {o.nome}
                      </button>
                    ))
                  )}
                  {opcoesFiltradas.length > MAX_ITENS_LISTA_FORNECEDORES && (
                    <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
                      Mostrando {MAX_ITENS_LISTA_FORNECEDORES} de {opcoesFiltradas.length}. Refine a busca.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-4 py-3">
          {erro && (
            <div className="mb-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
              {erro}
            </div>
          )}
          {loading && (
            <div className="flex items-center justify-center py-8 text-slate-500 dark:text-slate-400">
              Carregando fornecedores...
            </div>
          )}
          {!loading && opcoes.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum fornecedor disponível no sistema.</p>
          )}
          {!loading && itens.length > 0 && (
            <div className="space-y-4">
              {itens.map((item) => (
                <div
                  key={item.idPessoa}
                  className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-800 dark:text-slate-100 text-sm">{item.nome}</span>
                    <button
                      type="button"
                      onClick={() => remover(item.idPessoa)}
                      className="px-2 py-1 rounded border border-red-400 bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100 dark:border-red-500 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
                      aria-label="Remover fornecedor"
                    >
                      Remover
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className={labelClass}>Pedido Mínimo</label>
                      <input
                        type="text"
                        value={item.pedidoMinimo ?? ''}
                        onChange={(e) => atualizarCampo(item.idPessoa, 'pedidoMinimo', e.target.value)}
                        className={inputClass}
                        placeholder="Ex: 1000,00"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Condição de Pagamento</label>
                      <select
                        value={item.condicaoPagamento ?? ''}
                        onChange={(e) => atualizarCampo(item.idPessoa, 'condicaoPagamento', e.target.value)}
                        className={inputClass}
                      >
                        <option value="">Selecione...</option>
                        {condicoesPagamento.map((opt) => (
                          <option key={opt.id} value={opt.nome}>
                            {opt.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Forma de Pagamento</label>
                      <select
                        value={item.formaPagamento ?? ''}
                        onChange={(e) => atualizarCampo(item.idPessoa, 'formaPagamento', e.target.value)}
                        className={inputClass}
                      >
                        <option value="">Selecione...</option>
                        {formasPagamento.map((opt) => (
                          <option key={opt.id} value={opt.nome}>
                            {opt.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Valor Frete (%)</label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={item.valorFrete ?? ''}
                          onChange={(e) => {
                            atualizarCampo(item.idPessoa, 'valorFrete', e.target.value);
                            atualizarCampo(item.idPessoa, 'valorFreteTipo', '%');
                          }}
                          className={`${inputClass} flex-1 min-w-[100px]`}
                          placeholder="Valor em %"
                        />
                        <span className="text-slate-600 dark:text-slate-300 text-sm shrink-0 w-8">%</span>
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>IPI (%)</label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={item.ipi ?? ''}
                          onChange={(e) => {
                            atualizarCampo(item.idPessoa, 'ipi', e.target.value);
                            atualizarCampo(item.idPessoa, 'ipiTipo', '%');
                          }}
                          className={`${inputClass} flex-1 min-w-[100px]`}
                          placeholder="Valor em %"
                        />
                        <span className="text-slate-600 dark:text-slate-300 text-sm shrink-0 w-8">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-slate-200 dark:border-slate-600 shrink-0 bg-slate-50 dark:bg-slate-700/30 rounded-b-xl">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSalvar}
            disabled={salvando}
            className={btnPrimary}
          >
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
  );

  if (inline) return conteudo;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-fornecedores-coleta-title"
    >
      {conteudo}
    </div>
  );
}
