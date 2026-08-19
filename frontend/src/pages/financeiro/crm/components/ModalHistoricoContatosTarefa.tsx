import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Calculator, FileDown, Pencil, Plus, Trash2, X } from 'lucide-react';
import SingleSelectWithSearch, { type OptionItem } from '../../../../components/SingleSelectWithSearch';
import {
  createCrmInadimplenteTarefaContato,
  deleteCrmInadimplenteTarefaContato,
  fetchCrmInadimplenteTarefaContatos,
  updateCrmInadimplenteTarefaContato,
  type ClienteContatoErp,
  type ContatoTarefaInadimplente,
  type TarefaInadimplente,
} from '../../../../api/crmFinanceiro';
import {
  CATEGORIAS_TRATATIVA,
  filhosDaCategoria,
  montarTextoTratativa,
  parseTextoTratativa,
} from '../lib/tratativasCobranca';
import {
  CATEGORIA_NEGOCIAR_ID,
  FILHO_ACORDO_NEGOCIACAO_ID,
  TIPO_TRATATIVA_NEGOCIACAO,
  estadoDeMeta,
  estadoNegociacaoInicial,
  montarMetaNegociacao,
  parseMetaNegociacao,
  textoResumoNegociacao,
  tipoTratativaPorCategoria,
  validarNegociacao,
  type NegociacaoFormState,
} from '../lib/negociacaoCobranca';
import { downloadNegociacaoCobrancaPdf } from '../lib/exportNegociacaoCobrancaPdf';
import { isTituloPrescrito } from '../lib/titulo-prescrito';
import FormNegociacaoCobranca from './FormNegociacaoCobranca';
import CalculadoraJurosInadimplente from './CalculadoraJurosInadimplente';

function moneyBr(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function textoExibicaoContato(item: ContatoTarefaInadimplente): string {
  const metaNeg = parseMetaNegociacao(item.meta);
  return metaNeg ? textoResumoNegociacao(metaNeg, metaNeg.observacao ?? '') : item.texto;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR');
}

function telHref(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits ? `tel:+${digits.startsWith('55') ? digits : `55${digits}`}` : `tel:${value}`;
}

function LinksContato({ value, kind }: { value: string | null; kind: 'email' | 'tel' }) {
  if (!value) return <span>—</span>;
  const parts = value.split(' · ').map((p) => p.trim()).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => (
        <span key={`${kind}-${p}`}>
          {i > 0 ? ' · ' : null}
          <a
            href={kind === 'email' ? `mailto:${p}` : telHref(p)}
            className="text-sky-700 underline-offset-2 hover:underline dark:text-sky-300"
          >
            {p}
          </a>
        </span>
      ))}
    </>
  );
}

function toInputDate(isoOrBr: string | null | undefined): string {
  if (!isoOrBr) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  const br = isoOrBr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    const dd = br[1]!.padStart(2, '0');
    const mm = br[2]!.padStart(2, '0');
    let yyyy = Number(br[3]);
    if (yyyy < 100) yyyy += 2000;
    return `${yyyy}-${mm}-${dd}`;
  }
  const iso = isoOrBr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const d = new Date(isoOrBr);
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ModalHistoricoContatosTarefa({
  tarefa,
  open,
  onClose,
  onChanged,
}: {
  tarefa: TarefaInadimplente | null;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [contatos, setContatos] = useState<ContatoTarefaInadimplente[]>([]);
  const [clienteContato, setClienteContato] = useState<ClienteContatoErp>({
    email: null,
    telefone: null,
  });
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ContatoTarefaInadimplente | null>(null);
  const [dataContato, setDataContato] = useState(toInputDate(null));
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [filhoId, setFilhoId] = useState<number | null>(null);
  const [detalhe, setDetalhe] = useState('');
  const [negociacao, setNegociacao] = useState<NegociacaoFormState>(() => estadoNegociacaoInicial(0, toInputDate(null)));
  const [calcAberta, setCalcAberta] = useState(false);
  const [calcPercentual, setCalcPercentual] = useState(0);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [contatoExcluir, setContatoExcluir] = useState<ContatoTarefaInadimplente | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const tituloPrescrito = isTituloPrescrito(tarefa?.vencimento);
  const categoriaOptions: OptionItem[] = useMemo(
    () => CATEGORIAS_TRATATIVA.map((c) => ({ id: c.id, nome: c.nome })),
    [],
  );
  const filhoOptions: OptionItem[] = useMemo(
    () =>
      filhosDaCategoria(categoriaId, { tituloPrescrito, filhoAtualId: filhoId }).map((f) => ({
        id: f.id,
        nome: f.nome,
      })),
    [categoriaId, tituloPrescrito, filhoId],
  );
  const categoriaValue = categoriaOptions.find((o) => o.id === categoriaId) ?? null;
  const filhoValue = filhoOptions.find((o) => o.id === filhoId) ?? null;
  const filhoSelecionado = filhosDaCategoria(categoriaId).find((f) => f.id === filhoId);
  const detalheObrigatorio = filhoSelecionado?.nome === 'Outro';
  const isNegociacao = categoriaId === CATEGORIA_NEGOCIAR_ID;
  const valorTitulo = tarefa?.valor ?? 0;

  function resetFormulario(textoExistente?: string, meta?: unknown) {
    const dataBase = toInputDate(null);
    if (!textoExistente) {
      setCategoriaId(null);
      setFilhoId(null);
      setDetalhe('');
      setNegociacao(estadoNegociacaoInicial(valorTitulo, dataBase));
      return;
    }
    const parsed = parseTextoTratativa(textoExistente);
    const metaNeg = parseMetaNegociacao(meta);
    if (metaNeg || parsed.categoriaId === CATEGORIA_NEGOCIAR_ID) {
      setCategoriaId(CATEGORIA_NEGOCIAR_ID);
      setFilhoId(FILHO_ACORDO_NEGOCIACAO_ID);
      const estado = metaNeg
        ? estadoDeMeta(metaNeg, metaNeg.observacao ?? '', dataBase)
        : { ...estadoNegociacaoInicial(valorTitulo, dataBase), detalhe: parsed.detalhe };
      setNegociacao(estado);
      setDetalhe(estado.detalhe);
      setCalcPercentual(estado.percentualJuros);
      return;
    }
    setCategoriaId(parsed.categoriaId);
    setFilhoId(parsed.filhoId);
    setDetalhe(parsed.detalhe);
    setNegociacao(estadoNegociacaoInicial(valorTitulo, dataBase));
  }

  const carregar = useCallback(async () => {
    if (!tarefa?.id) return;
    setLoading(true);
    setErro('');
    try {
      const result = await fetchCrmInadimplenteTarefaContatos(tarefa.id);
      setContatos(result.data);
      setClienteContato(result.clienteContato);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar histórico.');
      setContatos([]);
      setClienteContato({ email: null, telefone: null });
    } finally {
      setLoading(false);
    }
  }, [tarefa?.id]);

  useEffect(() => {
    if (!open || !tarefa?.id) {
      setContatos([]);
      setClienteContato({ email: null, telefone: null });
      setFormOpen(false);
      setEditing(null);
      setCalcAberta(false);
      setContatoExcluir(null);
      setExcluindo(false);
      return;
    }
    void carregar();
  }, [open, tarefa?.id, carregar]);

  async function handleSalvar(e: FormEvent) {
    e.preventDefault();
    const cat = CATEGORIAS_TRATATIVA.find((c) => c.id === categoriaId);
    const filho = isNegociacao
      ? filhosDaCategoria(CATEGORIA_NEGOCIAR_ID).find((f) => f.id === FILHO_ACORDO_NEGOCIACAO_ID)
      : filhosDaCategoria(categoriaId).find((f) => f.id === filhoId);
    if (!tarefa?.id || !cat || !filho) {
      setErro('Selecione a categoria e a justificativa.');
      return;
    }
    if (!isNegociacao && filho.nome === 'Outro' && !detalhe.trim()) {
      setErro('Descreva o detalhe para a opção Outro.');
      return;
    }
    let texto = montarTextoTratativa(cat.nome, filho.nome, detalhe);
    let meta: unknown = null;
    const tipo = tipoTratativaPorCategoria(categoriaId);
    if (isNegociacao) {
      const erroNeg = validarNegociacao(negociacao);
      if (erroNeg) {
        setErro(erroNeg);
        return;
      }
      const metaNeg = montarMetaNegociacao(negociacao, valorTitulo, dataContato, tarefa.diasAtraso);
      meta = metaNeg;
      texto = textoResumoNegociacao(metaNeg, negociacao.detalhe);
    }
    setSaving(true);
    setErro('');
    try {
      const payload = {
        dataContato,
        texto,
        tipo,
        categoria: cat.nome,
        justificativa: filho.nome,
        meta,
      };
      if (editing) {
        await updateCrmInadimplenteTarefaContato(tarefa.id, editing.id, payload);
      } else {
        await createCrmInadimplenteTarefaContato(tarefa.id, payload);
      }
      setFormOpen(false);
      setEditing(null);
      setCalcAberta(false);
      await carregar();
      onChanged?.();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function exportarPdfNegociacao(meta: ReturnType<typeof parseMetaNegociacao>, dataRef: string | null) {
    if (!tarefa || !meta) {
      setErro('Esta tratativa ainda não tem acordo estruturado para gerar o PDF.');
      return;
    }
    setGerandoPdf(true);
    setErro('');
    try {
      await downloadNegociacaoCobrancaPdf({
        tarefa,
        meta,
        dataContato: dataRef,
      });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao gerar o PDF.');
    } finally {
      setGerandoPdf(false);
    }
  }

  async function exportarPdfDoFormulario() {
    const erroNeg = validarNegociacao(negociacao);
    if (erroNeg) {
      setErro(erroNeg);
      return;
    }
    const meta = montarMetaNegociacao(negociacao, valorTitulo, dataContato, tarefa?.diasAtraso ?? 0);
    await exportarPdfNegociacao(meta, dataContato);
  }

  function usarJurosNaNegociacao(valorTotal: number, percentual: number) {
    setCategoriaId(CATEGORIA_NEGOCIAR_ID);
    setFilhoId(FILHO_ACORDO_NEGOCIACAO_ID);
    setFormOpen(true);
    setNegociacao((prev) => ({
      ...estadoNegociacaoInicial(valorTitulo, dataContato),
      ...prev,
      percentualJuros: percentual,
      valorNegociado: valorTotal,
    }));
  }

  async function confirmarExclusao() {
    if (!tarefa?.id || !contatoExcluir) return;
    setExcluindo(true);
    setErro('');
    try {
      await deleteCrmInadimplenteTarefaContato(tarefa.id, contatoExcluir.id);
      setContatoExcluir(null);
      await carregar();
      onChanged?.();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao excluir.');
    } finally {
      setExcluindo(false);
    }
  }

  if (!open || !tarefa) return null;

  const modal = createPortal(
    <div
      className="fixed inset-0 z-[10050] overflow-y-auto overscroll-contain bg-black/75 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="mx-auto my-2 w-full max-w-4xl">
      <div
        className={`flex w-full flex-col rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800 ${
          formOpen && isNegociacao && calcAberta ? 'max-w-4xl' : 'mx-auto max-w-xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Tratativas de cobrança
            </h2>
            <div className="mt-1 space-y-0.5 text-sm text-slate-600 dark:text-slate-300">
              <span className="block">Cliente: {tarefa.clienteNome}</span>
              <span className="block">
                Empresa: {tarefa.empresaNome ?? '—'} · Conta {tarefa.codigoConta} ({tarefa.origem})
              </span>
              <span className="block">Valor: {moneyBr(tarefa.valor)}</span>
              <span className="block">
                E-mail: <LinksContato value={clienteContato.email} kind="email" />
              </span>
              <span className="block">
                Telefone: <LinksContato value={clienteContato.telefone} kind="tel" />
              </span>
            </div>
          </div>
          <div className="flex items-start gap-1">
            {formOpen && isNegociacao ? (
              <button
                type="button"
                onClick={() => setCalcAberta((v) => !v)}
                className={`rounded p-1 ${calcAberta ? 'text-sky-600 dark:text-sky-300' : 'text-slate-500'}`}
                aria-label="Calculadora de juros"
                title="Calculadora de juros"
              >
                <Calculator className="size-5" />
              </button>
            ) : null}
            <button type="button" onClick={onClose} className="rounded p-1 text-slate-500" aria-label="Fechar">
              <X className="size-5" />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2 dark:border-slate-700">
          <p className="text-xs text-slate-500">{contatos.length} tratativa(s)</p>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setDataContato(toInputDate(null));
              resetFormulario();
              setFormOpen(true);
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-700 px-3 text-xs font-semibold text-white hover:bg-blue-800"
          >
            <Plus className="size-3.5" />
            Nova tratativa
          </button>
        </div>
        {erro ? (
          <p className="mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {erro}
          </p>
        ) : null}
        {formOpen ? (
          <form
            onSubmit={handleSalvar}
            className="space-y-3 border-b border-slate-100 p-4 dark:border-slate-700"
          >
              <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Data do contato
                </span>
                <input
                  type="date"
                  required
                  value={dataContato}
                  onChange={(e) => setDataContato(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-950"
                />
              </label>
              <SingleSelectWithSearch
                label="Categoria *"
                placeholder="Pesquisar categoria…"
                options={categoriaOptions}
                value={categoriaValue}
                onChange={(opt) => {
                  const id = opt?.id ?? null;
                  setCategoriaId(id);
                  if (id === CATEGORIA_NEGOCIAR_ID) {
                    setFilhoId(FILHO_ACORDO_NEGOCIACAO_ID);
                    setNegociacao((prev) => ({
                      ...estadoNegociacaoInicial(valorTitulo, dataContato),
                      percentualJuros: prev.percentualJuros,
                      valorNegociado: prev.percentualJuros > 0 ? prev.valorNegociado : valorTitulo,
                      detalhe: prev.detalhe,
                    }));
                  } else {
                    setFilhoId(null);
                    setCalcAberta(false);
                  }
                }}
                labelClass="text-xs font-semibold uppercase tracking-wide text-slate-500"
                inputClass="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-950"
                fillContainer
                dropdownInFlow
                clearable
                dropdownZIndex={12000}
                listMaxHeight="180px"
              />
              {isNegociacao ? (
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                  <div className="min-w-0 flex-1">
                    <FormNegociacaoCobranca
                      valorOriginal={valorTitulo}
                      dataContatoYmd={dataContato}
                      state={negociacao}
                      onChange={setNegociacao}
                    />
                  </div>
                  {calcAberta ? (
                    <aside className="w-full shrink-0 lg:sticky lg:top-4 lg:w-80">
                      <CalculadoraJurosInadimplente
                        valorOriginal={valorTitulo}
                        percentual={calcPercentual}
                        diasAtraso={tarefa.diasAtraso}
                        onPercentualChange={setCalcPercentual}
                        onUsarNaNegociacao={usarJurosNaNegociacao}
                      />
                    </aside>
                  ) : null}
                </div>
              ) : (
                <>
              <SingleSelectWithSearch
                label="Justificativa *"
                placeholder={categoriaId ? 'Pesquisar justificativa…' : 'Selecione a categoria primeiro'}
                options={filhoOptions}
                value={filhoValue}
                onChange={(opt) => setFilhoId(opt?.id ?? null)}
                labelClass="text-xs font-semibold uppercase tracking-wide text-slate-500"
                inputClass="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-950"
                fillContainer
                dropdownInFlow
                clearable
                dropdownZIndex={12000}
                listMaxHeight="180px"
              />
              <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Detalhe {detalheObrigatorio ? '*' : '(opcional)'}
                </span>
                <textarea
                  rows={3}
                  required={detalheObrigatorio}
                  value={detalhe}
                  onChange={(e) => setDetalhe(e.target.value)}
                  placeholder={
                    detalheObrigatorio
                      ? 'Descreva a tratativa…'
                      : 'Complemento livre (valor combinado, data de retorno, etc.)'
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                />
              </label>
                </>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFormOpen(false);
                    setCalcAberta(false);
                  }}
                  className="h-9 rounded-lg border border-slate-300 px-3 text-sm font-semibold"
                >
                  Cancelar
                </button>
                {isNegociacao ? (
                  <button
                    type="button"
                    disabled={gerandoPdf}
                    onClick={() => void exportarPdfDoFormulario()}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-semibold disabled:opacity-60"
                  >
                    <FileDown className="size-3.5" />
                    {gerandoPdf ? 'Gerando PDF...' : 'PDF para o cliente'}
                  </button>
                ) : null}
                <button
                  type="submit"
                  disabled={saving}
                  className="h-9 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
          </form>
        ) : null}
        <div className="p-4">
          {loading ? <p className="py-6 text-center text-slate-500">Carregando...</p> : null}
          {!loading && contatos.length === 0 ? (
            <p className="py-6 text-center text-slate-500">Nenhuma tratativa ainda.</p>
          ) : null}
          <ul className="space-y-3">
            {contatos.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border-2 border-sky-300 bg-sky-50/40 p-3 text-sm dark:border-sky-600 dark:bg-sky-950/20"
              >
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>{formatDateTime(item.dataContato ?? item.createdAt)}</span>
                  <span>{item.criadoPorLogin ?? ''}</span>
                </div>
                <div className="mt-1 whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-slate-200">
                  {textoExibicaoContato(item)}
                </div>
                {item.tipo === TIPO_TRATATIVA_NEGOCIACAO ? (
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                    Acordo estruturado
                  </p>
                ) : null}
                <div className="mt-2 flex justify-end gap-1">
                  {item.tipo === TIPO_TRATATIVA_NEGOCIACAO ? (
                    <button
                      type="button"
                      disabled={gerandoPdf}
                      title="PDF para o cliente"
                      onClick={() =>
                        void exportarPdfNegociacao(
                          parseMetaNegociacao(item.meta),
                          item.dataContatoBr ?? item.dataContato,
                        )
                      }
                      className="rounded-md p-1.5 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      <FileDown className="size-3.5" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(item);
                      setDataContato(toInputDate(item.dataContatoBr ?? item.dataContato));
                      resetFormulario(item.texto, item.meta);
                      setFormOpen(true);
                    }}
                    className="rounded-md p-1.5 text-blue-700 hover:bg-blue-50"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setContatoExcluir(item)}
                    className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      </div>
    </div>,
    document.body,
  );

  const ehAcordo = contatoExcluir?.tipo === TIPO_TRATATIVA_NEGOCIACAO;

  return (
    <>
      {modal}
      {contatoExcluir
        ? createPortal(
            <div
              className="fixed inset-0 z-[10120] flex items-center justify-center bg-black/55 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="excluir-tratativa-titulo"
              onClick={() => {
                if (!excluindo) setContatoExcluir(null);
              }}
            >
              <div
                className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                onClick={(e) => e.stopPropagation()}
              >
                <h2
                  id="excluir-tratativa-titulo"
                  className="text-base font-semibold text-slate-800 dark:text-slate-100"
                >
                  Excluir tratativa
                </h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  Deseja realmente excluir esta tratativa?
                  {ehAcordo ? (
                    <>
                      {' '}
                      Esta ação também excluirá o acordo gerado por ela (parcelas e acompanhamento na
                      guia Acordos).
                    </>
                  ) : null}{' '}
                  Esta ação não pode ser desfeita.
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={excluindo}
                    onClick={() => setContatoExcluir(null)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={excluindo}
                    onClick={() => void confirmarExclusao()}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
                  >
                    {excluindo ? 'Excluindo…' : 'Excluir'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
