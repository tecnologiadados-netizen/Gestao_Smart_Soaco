import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  createCrmRegistroInadimplenteContato,
  deleteCrmRegistroInadimplenteContato,
  fetchCrmRegistroInadimplenteContatos,
  updateCrmRegistroInadimplenteContato,
  type ContatoInadimplente,
  type RegistroInadimplente,
} from '../../../../api/crmFinanceiro';

function moneyBr(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR');
}

function toInputDate(isoOrBr: string | null | undefined): string {
  if (!isoOrBr) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
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

function tituloContato(item: ContatoInadimplente): string {
  if (item.dataContatoBr) return `Contato em ${item.dataContatoBr}`;
  return 'Contato de cobrança';
}

export interface ModalHistoricoContatosInadimplenteProps {
  registro: RegistroInadimplente | null;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

export default function ModalHistoricoContatosInadimplente({
  registro,
  open,
  onClose,
  onChanged,
}: ModalHistoricoContatosInadimplenteProps) {
  const [contatos, setContatos] = useState<ContatoInadimplente[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ContatoInadimplente | null>(null);
  const [dataContato, setDataContato] = useState(toInputDate(null));
  const [texto, setTexto] = useState('');

  const carregar = useCallback(async () => {
    if (!registro?.id) return;
    setLoading(true);
    setErro('');
    try {
      const data = await fetchCrmRegistroInadimplenteContatos(registro.id);
      setContatos(data);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar histórico.');
      setContatos([]);
    } finally {
      setLoading(false);
    }
  }, [registro?.id]);

  useEffect(() => {
    if (!open || !registro?.id) {
      setContatos([]);
      setErro('');
      setFormOpen(false);
      setEditing(null);
      return;
    }
    void carregar();
  }, [open, registro?.id, carregar]);

  function abrirNovo() {
    setEditing(null);
    setDataContato(toInputDate(null));
    setTexto('');
    setFormOpen(true);
  }

  function abrirEditar(item: ContatoInadimplente) {
    setEditing(item);
    setDataContato(toInputDate(item.dataContatoBr ?? item.dataContato));
    setTexto(item.texto);
    setFormOpen(true);
  }

  async function handleSalvar(e: FormEvent) {
    e.preventDefault();
    if (!registro?.id) return;
    if (!texto.trim()) {
      setErro('Informe a justificativa do contato.');
      return;
    }
    setSaving(true);
    setErro('');
    try {
      const payload = { dataContato, texto: texto.trim() };
      if (editing) {
        await updateCrmRegistroInadimplenteContato(registro.id, editing.id, payload);
      } else {
        await createCrmRegistroInadimplenteContato(registro.id, payload);
      }
      setFormOpen(false);
      setEditing(null);
      await carregar();
      onChanged?.();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao salvar contato.');
    } finally {
      setSaving(false);
    }
  }

  async function handleExcluir(item: ContatoInadimplente) {
    if (!registro?.id) return;
    if (!window.confirm('Excluir este contato do histórico?')) return;
    setErro('');
    try {
      await deleteCrmRegistroInadimplenteContato(registro.id, item.id);
      await carregar();
      onChanged?.();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao excluir contato.');
    }
  }

  if (!open || !registro) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/75 p-4"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-historico-contatos-title"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-600">
          <div>
            <h2
              id="modal-historico-contatos-title"
              className="text-lg font-semibold text-slate-800 dark:text-slate-100"
            >
              Histórico de contatos
            </h2>
            <div className="mt-1 space-y-0.5 text-sm font-normal text-slate-600 dark:text-slate-300">
              <span className="block">Cliente: {registro.cliente}</span>
              {registro.nfPd ? <span className="block">NF / PD: {registro.nfPd}</span> : null}
              {registro.parcela ? <span className="block">Parcela: {registro.parcela}</span> : null}
              {registro.vendedor ? <span className="block">Vendedor: {registro.vendedor}</span> : null}
              {registro.total != null ? (
                <span className="block">Total: {moneyBr(registro.total)}</span>
              ) : null}
              {registro.serasa ? <span className="block">Serasa: {registro.serasa}</span> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-slate-200"
            aria-label="Fechar"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2 dark:border-slate-700">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {contatos.length} contato(s) registrado(s)
          </p>
          <button
            type="button"
            onClick={abrirNovo}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-700 px-3 text-xs font-semibold text-white hover:bg-blue-800"
          >
            <Plus className="size-3.5" />
            Novo contato
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {erro ? (
            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
              {erro}
            </p>
          ) : null}

          {formOpen ? (
            <form
              onSubmit={handleSalvar}
              className="mb-4 space-y-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-800 dark:bg-blue-950/30"
            >
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {editing ? 'Editar contato' : 'Novo contato'}
              </p>
              <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Data do contato
                </span>
                <input
                  type="date"
                  required
                  value={dataContato}
                  onChange={(e) => setDataContato(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-blue-600/30 focus:ring-2 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Justificativa
                </span>
                <textarea
                  required
                  rows={3}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Ex.: Cliente informou previsão de pagamento para amanhã."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-blue-600/30 focus:ring-2 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setFormOpen(false);
                    setEditing(null);
                  }}
                  className="h-9 rounded-lg border border-slate-300 px-3 text-sm font-semibold dark:border-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-9 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          ) : null}

          {loading ? (
            <p className="py-6 text-center text-slate-500 dark:text-slate-400">Carregando...</p>
          ) : null}

          {!loading && contatos.length === 0 ? (
            <p className="py-6 text-center text-slate-500 dark:text-slate-400">
              Nenhum contato registrado. Clique em &quot;Novo contato&quot; para iniciar o histórico.
            </p>
          ) : null}

          {!loading && contatos.length > 0 ? (
            <ul className="space-y-3">
              {contatos.map((item) => {
                const isLegado = item.origem === 'legado';
                return (
                  <li
                    key={item.id}
                    className={`rounded-lg border-2 p-3 text-sm ${
                      isLegado
                        ? 'border-slate-300 bg-slate-50 dark:border-slate-500 dark:bg-slate-800/50'
                        : 'border-sky-300 bg-sky-50/40 dark:border-sky-600 dark:bg-sky-950/20'
                    }`}
                  >
                    <div className="flex justify-between gap-2 text-slate-600 dark:text-slate-300">
                      <span>{formatDateTime(item.dataContato ?? item.createdAt)}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide border ${
                            isLegado
                              ? 'border-slate-400 text-slate-600 dark:border-slate-500 dark:text-slate-300'
                              : 'border-sky-500 text-sky-800 dark:border-sky-400 dark:text-sky-200'
                          }`}
                        >
                          {isLegado ? 'Legado' : 'Cobrança'}
                        </span>
                        {item.criadoPorLogin ? (
                          <span className="text-slate-500 dark:text-slate-400">
                            {item.criadoPorLogin}
                          </span>
                        ) : null}
                      </span>
                    </div>
                    <div className="mt-1 font-semibold text-slate-800 dark:text-slate-100">
                      {tituloContato(item)}
                    </div>
                    <div className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
                      {item.texto}
                    </div>
                    <div className="mt-2 flex justify-end gap-1">
                      <button
                        type="button"
                        title="Editar"
                        onClick={() => abrirEditar(item)}
                        className="rounded-md p-1.5 text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Excluir"
                        onClick={() => void handleExcluir(item)}
                        className="rounded-md p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
