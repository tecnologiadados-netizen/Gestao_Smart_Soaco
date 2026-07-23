import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import {
  createCrmRegistroInadimplente,
  deleteCrmRegistroInadimplente,
  fetchCrmRegistroInadimplentes,
  updateCrmRegistroInadimplente,
  type RegistroInadimplente,
  type RegistroInadimplenteInput,
} from '../../../../api/crmFinanceiro';

type FormState = {
  vencimento: string;
  pagamento: string;
  empresa: string;
  banco: string;
  tipo: string;
  cliente: string;
  status: string;
  serasa: string;
  vendedor: string;
  total: string;
  nfPd: string;
  parcela: string;
  obs: string;
};

const EMPTY_FORM: FormState = {
  vencimento: '',
  pagamento: '',
  empresa: '',
  banco: '',
  tipo: '',
  cliente: '',
  status: '',
  serasa: '',
  vendedor: '',
  total: '',
  nfPd: '',
  parcela: '',
  obs: '',
};

function moneyBr(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function toInput(form: FormState): RegistroInadimplenteInput {
  const totalRaw = form.total.replace(/\./g, '').replace(',', '.').trim();
  const total = totalRaw === '' ? null : Number(totalRaw);
  return {
    vencimento: form.vencimento.trim() || null,
    pagamento: form.pagamento.trim() || null,
    empresa: form.empresa.trim() || null,
    banco: form.banco.trim() || null,
    tipo: form.tipo.trim() || null,
    cliente: form.cliente.trim(),
    status: form.status.trim() || null,
    serasa: form.serasa.trim() || null,
    vendedor: form.vendedor.trim() || null,
    total: total != null && Number.isFinite(total) ? total : null,
    nfPd: form.nfPd.trim() || null,
    parcela: form.parcela.trim() || null,
    obs: form.obs.trim() || null,
  };
}

function fromRow(row: RegistroInadimplente): FormState {
  return {
    vencimento: row.vencimento ?? '',
    pagamento: row.pagamento ?? '',
    empresa: row.empresa ?? '',
    banco: row.banco ?? '',
    tipo: row.tipo ?? '',
    cliente: row.cliente ?? '',
    status: row.status ?? '',
    serasa: row.serasa ?? '',
    vendedor: row.vendedor ?? '',
    total: row.total != null ? String(row.total).replace('.', ',') : '',
    nfPd: row.nfPd ?? '',
    parcela: row.parcela ?? '',
    obs: row.obs ?? '',
  };
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
        {required ? ' *' : ''}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none ring-blue-600/30 focus:ring-2 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100';

export default function RegistroInadimplentesPanel() {
  const [q, setQ] = useState('');
  const [qApplied, setQApplied] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [rows, setRows] = useState<RegistroInadimplente[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RegistroInadimplente | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const result = await fetchCrmRegistroInadimplentes({
        q: qApplied,
        page,
        pageSize,
      });
      setRows(result.data);
      setTotal(result.total);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, qApplied]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function abrirNovo() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function abrirEditar(row: RegistroInadimplente) {
    setEditing(row);
    setForm(fromRow(row));
    setFormOpen(true);
  }

  async function handleSalvar(e: FormEvent) {
    e.preventDefault();
    if (!form.cliente.trim()) {
      setErro('Cliente é obrigatório.');
      return;
    }
    setSaving(true);
    setErro('');
    try {
      const payload = toInput(form);
      if (editing) {
        await updateCrmRegistroInadimplente(editing.id, payload);
      } else {
        await createCrmRegistroInadimplente(payload);
      }
      setFormOpen(false);
      setEditing(null);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleExcluir(row: RegistroInadimplente) {
    if (!window.confirm(`Excluir o registro de ${row.cliente}?`)) return;
    setErro('');
    try {
      await deleteCrmRegistroInadimplente(row.id);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao excluir.');
    }
  }

  const resumo = useMemo(() => {
    const somaPagina = rows.reduce((acc, r) => acc + (r.total ?? 0), 0);
    return { somaPagina };
  }, [rows]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Registro de Inadimplentes
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Histórico importado da planilha de vencidos e novos cadastros manuais.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void carregar()}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
          >
            <RefreshCw className="size-4" />
            Atualizar
          </button>
          <button
            type="button"
            onClick={abrirNovo}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white shadow hover:bg-blue-800"
          >
            <Plus className="size-4" />
            Novo registro
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(1);
                setQApplied(q.trim());
              }
            }}
            placeholder="Buscar cliente, empresa, status, NF/PD… (use % como curinga)"
            className={`${inputClass} pl-9`}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setPage(1);
            setQApplied(q.trim());
          }}
          className="h-10 rounded-lg bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-900 dark:bg-slate-200 dark:text-slate-900"
        >
          Filtrar
        </button>
      </div>

      {erro ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {erro}
        </div>
      ) : null}

      <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <table className="min-w-[1400px] w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">
            <tr>
              {[
                'Vencimento',
                'Pagamento',
                'Empresa',
                'Banco',
                'Tipo',
                'Cliente',
                'Status',
                'Serasa',
                'Vendedor',
                'Total',
                'NF / PD',
                'Parcela',
                'Obs',
                'Ações',
              ].map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={14} className="px-3 py-8 text-center text-slate-500">
                  Carregando...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={14} className="px-3 py-8 text-center text-slate-500">
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-slate-100 align-top hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-800/40"
                >
                  <td className="whitespace-nowrap px-3 py-2">{row.vencimento || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2">{row.pagamento || '—'}</td>
                  <td className="max-w-[160px] px-3 py-2">{row.empresa || '—'}</td>
                  <td className="max-w-[140px] px-3 py-2">{row.banco || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2">{row.tipo || '—'}</td>
                  <td className="min-w-[180px] px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                    {row.cliente}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{row.status || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2">{row.serasa || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2">{row.vendedor || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">{moneyBr(row.total)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{row.nfPd || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2">{row.parcela || '—'}</td>
                  <td className="max-w-[220px] px-3 py-2 text-slate-600 dark:text-slate-300">
                    {row.obs || '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        title="Editar"
                        onClick={() => abrirEditar(row)}
                        className="rounded-md p-1.5 text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        title="Excluir"
                        onClick={() => void handleExcluir(row)}
                        className="rounded-md p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-300">
        <p>
          {total.toLocaleString('pt-BR')} registro(s) · página {page}/{totalPages}
          {resumo.somaPagina > 0
            ? ` · total da página ${moneyBr(resumo.somaPagina)}`
            : ''}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="h-9 rounded-lg border border-slate-300 px-3 disabled:opacity-40 dark:border-slate-600"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="h-9 rounded-lg border border-slate-300 px-3 disabled:opacity-40 dark:border-slate-600"
          >
            Próxima
          </button>
        </div>
      </div>

      {formOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[10050] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
            onClick={() => !saving && setFormOpen(false)}
            role="presentation"
          >
            <div
              className="max-h-[min(92vh,900px)] w-full max-w-3xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-5 py-3.5 text-white dark:border-slate-700">
                <h3 className="text-base font-semibold">
                  {editing ? 'Editar registro' : 'Novo registro de inadimplente'}
                </h3>
                <button
                  type="button"
                  onClick={() => !saving && setFormOpen(false)}
                  className="rounded p-1.5 hover:bg-white/15"
                  aria-label="Fechar"
                >
                  <X className="size-5" />
                </button>
              </div>
              <form onSubmit={handleSalvar} className="flex max-h-[calc(92vh-64px)] flex-col">
                <div className="grid gap-4 overflow-y-auto p-5 sm:grid-cols-2">
                  <Field label="Vencimento">
                    <input
                      className={inputClass}
                      placeholder="DD/MM/AAAA"
                      value={form.vencimento}
                      onChange={(e) => setForm((f) => ({ ...f, vencimento: e.target.value }))}
                    />
                  </Field>
                  <Field label="Pagamento">
                    <input
                      className={inputClass}
                      placeholder="DD/MM/AAAA"
                      value={form.pagamento}
                      onChange={(e) => setForm((f) => ({ ...f, pagamento: e.target.value }))}
                    />
                  </Field>
                  <Field label="Empresa">
                    <input
                      className={inputClass}
                      value={form.empresa}
                      onChange={(e) => setForm((f) => ({ ...f, empresa: e.target.value }))}
                    />
                  </Field>
                  <Field label="Banco">
                    <input
                      className={inputClass}
                      value={form.banco}
                      onChange={(e) => setForm((f) => ({ ...f, banco: e.target.value }))}
                    />
                  </Field>
                  <Field label="Tipo">
                    <input
                      className={inputClass}
                      value={form.tipo}
                      onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
                    />
                  </Field>
                  <Field label="Cliente" required>
                    <input
                      className={inputClass}
                      required
                      value={form.cliente}
                      onChange={(e) => setForm((f) => ({ ...f, cliente: e.target.value }))}
                    />
                  </Field>
                  <Field label="Status">
                    <input
                      className={inputClass}
                      value={form.status}
                      onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    />
                  </Field>
                  <Field label="Serasa">
                    <input
                      className={inputClass}
                      value={form.serasa}
                      onChange={(e) => setForm((f) => ({ ...f, serasa: e.target.value }))}
                    />
                  </Field>
                  <Field label="Vendedor">
                    <input
                      className={inputClass}
                      value={form.vendedor}
                      onChange={(e) => setForm((f) => ({ ...f, vendedor: e.target.value }))}
                    />
                  </Field>
                  <Field label="Total">
                    <input
                      className={inputClass}
                      placeholder="0,00"
                      value={form.total}
                      onChange={(e) => setForm((f) => ({ ...f, total: e.target.value }))}
                    />
                  </Field>
                  <Field label="NF / PD">
                    <input
                      className={inputClass}
                      value={form.nfPd}
                      onChange={(e) => setForm((f) => ({ ...f, nfPd: e.target.value }))}
                    />
                  </Field>
                  <Field label="Parcela">
                    <input
                      className={inputClass}
                      value={form.parcela}
                      onChange={(e) => setForm((f) => ({ ...f, parcela: e.target.value }))}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Obs">
                      <textarea
                        className="min-h-[88px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-600/30 focus:ring-2 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                        value={form.obs}
                        onChange={(e) => setForm((f) => ({ ...f, obs: e.target.value }))}
                      />
                    </Field>
                  </div>
                </div>
                <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setFormOpen(false)}
                    className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold dark:border-slate-600"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="h-10 rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                  >
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </section>
  );
}
