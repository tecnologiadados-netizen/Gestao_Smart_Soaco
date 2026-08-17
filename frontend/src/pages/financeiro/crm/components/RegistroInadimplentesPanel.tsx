import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { History, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  createCrmRegistroInadimplente,
  deleteCrmRegistroInadimplente,
  fetchCrmContasBancarias,
  fetchCrmEmpresas,
  fetchCrmPessoasLookup,
  fetchCrmRegistroInadimplentes,
  updateCrmRegistroInadimplente,
  type ContaBancariaOption,
  type EmpresaOption,
  type RegistroInadimplente,
  type RegistroInadimplenteInput,
} from '../../../../api/crmFinanceiro';
import GradeFiltroCabecalhoBtn from '../../../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../../../components/grade/GradeFiltroExcelPortal';
import SingleSelectWithSearch, {
  type OptionItem,
} from '../../../../components/SingleSelectWithSearch';
import { useGradeFiltrosExcel } from '../../../../hooks/useGradeFiltrosExcel';
import { useColumnResize } from '../hooks/useColumnResize';
import { EMPRESAS_PAINEL } from '../lib/empresaConfig';
import ModalHistoricoContatosInadimplente from './ModalHistoricoContatosInadimplente';

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

const COLUMN_IDS = [
  'vencimento',
  'pagamento',
  'empresa',
  'banco',
  'tipo',
  'cliente',
  'status',
  'serasa',
  'vendedor',
  'total',
  'nfPd',
  'parcela',
  'obs',
  'acoes',
] as const;

type ColumnId = (typeof COLUMN_IDS)[number];

const FILTERABLE_IDS = COLUMN_IDS.filter((id) => id !== 'acoes');

const COL_LABELS: Record<ColumnId, string> = {
  vencimento: 'Vencimento',
  pagamento: 'Pagamento',
  empresa: 'Empresa',
  banco: 'Banco',
  tipo: 'Tipo',
  cliente: 'Cliente',
  status: 'Status',
  serasa: 'Serasa',
  vendedor: 'Vendedor',
  total: 'Total',
  nfPd: 'NF / PD',
  parcela: 'Parcela',
  obs: 'Obs',
  acoes: 'Ações',
};

const DEFAULT_COLUMN_WIDTHS: Record<ColumnId, number> = {
  vencimento: 88,
  pagamento: 88,
  empresa: 120,
  banco: 100,
  tipo: 100,
  cliente: 160,
  status: 80,
  serasa: 64,
  vendedor: 110,
  total: 96,
  nfPd: 72,
  parcela: 64,
  obs: 200,
  acoes: 72,
};

const FLEX_WEIGHTS: Partial<Record<ColumnId, number>> = {
  cliente: 2,
  empresa: 1.2,
  obs: 2.5,
  banco: 1,
  vendedor: 1,
};

const PAGE_SIZE = 80;
const td = 'px-1.5 py-1 align-top';

function moneyBr(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function sortDateBr(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return s.toLowerCase();
  const dd = m[1]!.padStart(2, '0');
  const mm = m[2]!.padStart(2, '0');
  let yyyy = m[3]!;
  if (yyyy.length === 2) yyyy = `20${yyyy}`;
  return `${yyyy}-${mm}-${dd}`;
}

function cellText(row: RegistroInadimplente, col: ColumnId): string {
  switch (col) {
    case 'vencimento':
      return row.vencimento?.trim() || '—';
    case 'pagamento':
      return row.pagamento?.trim() || '—';
    case 'empresa':
      return row.empresa?.trim() || '—';
    case 'banco':
      return row.banco?.trim() || '—';
    case 'tipo':
      return row.tipo?.trim() || '—';
    case 'cliente':
      return row.cliente?.trim() || '—';
    case 'status':
      return row.status?.trim() || '—';
    case 'serasa':
      return row.serasa?.trim() || '—';
    case 'vendedor':
      return row.vendedor?.trim() || '—';
    case 'total':
      return moneyBr(row.total);
    case 'nfPd':
      return row.nfPd?.trim() || '—';
    case 'parcela':
      return row.parcela?.trim() || '—';
    case 'obs':
      return (
        row.obs?.trim() ||
        ((row.contatosCount ?? 0) > 0 ? `${row.contatosCount} contato(s)` : '—')
      );
    case 'acoes':
      return '';
    default:
      return '—';
  }
}

function sortValue(row: RegistroInadimplente, col: ColumnId): string | number {
  if (col === 'total') return row.total ?? Number.NEGATIVE_INFINITY;
  if (col === 'vencimento' || col === 'pagamento') return sortDateBr(cellText(row, col));
  return cellText(row, col).toLowerCase();
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

const fieldLabelClass =
  'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

function optionFromTexto(texto: string): OptionItem | null {
  const nome = texto.trim();
  if (!nome) return null;
  return { id: -1, nome };
}

export default function RegistroInadimplentesPanel() {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<RegistroInadimplente[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RegistroInadimplente | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [historicoRegistro, setHistoricoRegistro] = useState<RegistroInadimplente | null>(null);
  const [empresasNomus, setEmpresasNomus] = useState<EmpresaOption[]>(EMPRESAS_PAINEL);
  const [bancosNomus, setBancosNomus] = useState<ContaBancariaOption[]>([]);
  const [bancosLoading, setBancosLoading] = useState(false);

  const { startResize, tableRef } = useColumnResize(COLUMN_IDS, DEFAULT_COLUMN_WIDTHS, {
    storageKey: 'crm-registro-inadimplentes-cols-v1',
    fillContainer: true,
    flexColumnWeights: FLEX_WEIGHTS,
    minWidthPx: 48,
  });

  const grade = useGradeFiltrosExcel<RegistroInadimplente>({
    rows,
    columnIds: [...FILTERABLE_IDS],
    getCellText: (r, c) => cellText(r, c as ColumnId),
    valueForSort: (r, c) => sortValue(r, c as ColumnId),
    defaultSortLevels: [{ id: 'vencimento', dir: 'desc' }],
    dateColumnIds: ['vencimento', 'pagamento'],
  });

  const totalPages = Math.max(1, Math.ceil(grade.rowsExibidas.length / PAGE_SIZE));

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return grade.rowsExibidas.slice(start, start + PAGE_SIZE);
  }, [grade.rowsExibidas, page]);

  useEffect(() => {
    setPage(1);
  }, [grade.rowsExibidas.length]);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const result = await fetchCrmRegistroInadimplentes({
        page: 1,
        pageSize: 5000,
      });
      setRows(result.data);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (!formOpen) return;
    let cancelled = false;
    void fetchCrmEmpresas()
      .then((emps) => {
        if (!cancelled) setEmpresasNomus(emps.length ? emps : EMPRESAS_PAINEL);
      })
      .catch(() => {
        if (!cancelled) setEmpresasNomus(EMPRESAS_PAINEL);
      });
    return () => {
      cancelled = true;
    };
  }, [formOpen]);

  useEffect(() => {
    if (!formOpen) return;
    let cancelled = false;
    setBancosLoading(true);
    void fetchCrmContasBancarias()
      .then((bancos) => {
        if (!cancelled) setBancosNomus(bancos);
      })
      .catch(() => {
        if (!cancelled) setBancosNomus([]);
      })
      .finally(() => {
        if (!cancelled) setBancosLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [formOpen]);

  const bancoOptions: OptionItem[] = useMemo(() => {
    const list = bancosNomus.map((b) => ({
      id: b.id,
      nome: b.nome,
    }));
    const atual = form.banco.trim();
    if (atual && !list.some((o) => o.nome.trim().toUpperCase() === atual.toUpperCase())) {
      list.unshift({ id: -1, nome: atual });
    }
    return list;
  }, [bancosNomus, form.banco]);

  const empresaOptions = useMemo(() => {
    const list = [...empresasNomus];
    const atual = form.empresa.trim();
    if (atual && !list.some((e) => e.nome.trim().toUpperCase() === atual.toUpperCase())) {
      list.unshift({ id: -1, nome: atual });
    }
    return list;
  }, [empresasNomus, form.empresa]);

  const buscarClientesNomus = useCallback(async (term: string): Promise<OptionItem[]> => {
    const rows = await fetchCrmPessoasLookup(term);
    return rows.map((p) => ({
      id: p.id,
      nome: p.nome,
      descricao: [p.razaoSocial, p.cnpjCpf].filter(Boolean).join(' · ') || null,
    }));
  }, []);

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

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {totalPages > 1 ? (
          <div className="flex gap-1">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-7 rounded-lg border border-slate-300 px-2 text-xs font-semibold disabled:opacity-40 dark:border-slate-600"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="h-7 rounded-lg border border-slate-300 px-2 text-xs font-semibold disabled:opacity-40 dark:border-slate-600"
            >
              Próxima
            </button>
          </div>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap items-center gap-2">
          {grade.temFiltrosOuOrdem ? (
            <button
              type="button"
              onClick={() => grade.limparFiltrosGrade()}
              className="inline-flex h-7 items-center rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              title="Limpar filtros e ordenação da grade"
            >
              Limpar filtros
            </button>
          ) : null}
          <button
            type="button"
            onClick={abrirNovo}
            className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-blue-700 px-2.5 text-xs font-semibold text-white shadow hover:bg-blue-800"
          >
            <Plus className="size-3.5" />
            Novo registro
          </button>
        </div>
      </div>

      {erro ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-800">
          {erro}
        </div>
      ) : null}

      <div className="table-crm-section">
        <div ref={grade.tableScrollRef} className="overflow-auto max-h-[calc(100vh-12rem)]">
          <table
            ref={tableRef}
            className="table-crm w-full border-collapse text-left text-xs leading-snug"
            style={{ tableLayout: 'fixed' }}
          >
            <colgroup>
              {COLUMN_IDS.map((id) => (
                <col key={id} style={{ width: DEFAULT_COLUMN_WIDTHS[id] }} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-20">
              <tr className="bg-blue-700 text-white dark:bg-blue-900">
                {COLUMN_IDS.map((colId) => (
                  <th
                    key={colId}
                    className="relative border-b border-blue-600/40 px-0 py-0 font-semibold"
                  >
                    <div className="flex min-h-[2.25rem] items-start justify-between gap-1 px-1.5 py-1">
                      <span className="min-w-0 flex-1 whitespace-normal break-words text-[10px] uppercase leading-tight tracking-wide">
                        {COL_LABELS[colId]}
                      </span>
                      {colId !== 'acoes' ? (
                        <GradeFiltroCabecalhoBtn
                          ativo={grade.colunaComFiltroAtivo(colId)}
                          onClick={(e) => grade.abrirFiltroExcel(colId, e)}
                          className="mt-0.5 shrink-0"
                        />
                      ) : null}
                    </div>
                    <span
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Redimensionar coluna ${COL_LABELS[colId]}`}
                      className="col-resize-handle"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        startResize(colId, event.clientX);
                      }}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={COLUMN_IDS.length} className="px-3 py-8 text-center text-slate-500">
                    Carregando...
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={COLUMN_IDS.length} className="px-3 py-8 text-center text-slate-500">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                paged.map((row, index) => (
                  <tr
                    key={row.id}
                    className={`border-t border-slate-100 dark:border-slate-800 ${
                      index % 2 === 0
                        ? 'bg-white dark:bg-slate-900'
                        : 'bg-slate-50/70 dark:bg-slate-800/40'
                    } hover:bg-sky-50/60 dark:hover:bg-slate-800/70`}
                  >
                    <td className={`${td} cell-nowrap`}>{cellText(row, 'vencimento')}</td>
                    <td className={`${td} cell-nowrap`}>{cellText(row, 'pagamento')}</td>
                    <td className={`${td} cell-wrap`}>{cellText(row, 'empresa')}</td>
                    <td className={`${td} cell-wrap`}>{cellText(row, 'banco')}</td>
                    <td className={`${td} cell-wrap`}>{cellText(row, 'tipo')}</td>
                    <td className={`${td} cell-wrap font-medium text-slate-900 dark:text-slate-100`}>
                      {row.cliente}
                    </td>
                    <td className={`${td} cell-wrap`}>{cellText(row, 'status')}</td>
                    <td className={`${td} cell-nowrap`}>{cellText(row, 'serasa')}</td>
                    <td className={`${td} cell-wrap`}>{cellText(row, 'vendedor')}</td>
                    <td className={`${td} cell-nowrap tabular-nums`}>{moneyBr(row.total)}</td>
                    <td className={`${td} cell-nowrap`}>{cellText(row, 'nfPd')}</td>
                    <td className={`${td} cell-nowrap`}>{cellText(row, 'parcela')}</td>
                    <td className={`${td} cell-wrap`}>
                      <button
                        type="button"
                        title="Ver histórico de contatos"
                        onClick={() => setHistoricoRegistro(row)}
                        className="group flex w-full min-w-0 items-start gap-1 rounded px-0.5 py-0.5 text-left text-slate-600 hover:bg-sky-50 dark:text-slate-300 dark:hover:bg-sky-950/30"
                      >
                        <History className="mt-0.5 size-3 shrink-0 text-sky-700 opacity-70 group-hover:opacity-100" />
                        <span className="min-w-0 whitespace-normal break-words">
                          {cellText(row, 'obs') === '—' ? 'Registrar…' : cellText(row, 'obs')}
                        </span>
                      </button>
                    </td>
                    <td className={`${td} cell-nowrap`}>
                      <div className="flex gap-0.5">
                        <button
                          type="button"
                          title="Editar"
                          onClick={() => abrirEditar(row)}
                          className="rounded p-1 text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Excluir"
                          onClick={() => void handleExcluir(row)}
                          className="rounded p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {grade.colunaFiltroAberta && grade.filtroAbertoRect ? (
          <GradeFiltroExcelPortal
            colunaAberta={grade.colunaFiltroAberta}
            rect={grade.filtroAbertoRect}
            dropdownRef={grade.filtroDropdownRef}
            excelFilterDrafts={grade.excelFilterDrafts}
            setExcelFilterDrafts={grade.setExcelFilterDrafts}
            valoresUnicosPorColuna={grade.valoresUnicosPorColuna}
            onSortAsc={(colId) => {
              grade.setSortState({ key: colId, direction: 'asc' });
              grade.setSortLevels([]);
              grade.fecharFiltroExcel();
            }}
            onSortDesc={(colId) => {
              grade.setSortState({ key: colId, direction: 'desc' });
              grade.setSortLevels([]);
              grade.fecharFiltroExcel();
            }}
            onAplicar={grade.aplicarFiltroExcel}
            onCancelar={grade.fecharFiltroExcel}
            showNumericFilters={grade.colunaFiltroAberta === 'total'}
            showDateRangeFilters={
              grade.colunaFiltroAberta === 'vencimento' || grade.colunaFiltroAberta === 'pagamento'
            }
          />
        ) : null}
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
                    <select
                      className={inputClass}
                      value={form.empresa}
                      onChange={(e) => setForm((f) => ({ ...f, empresa: e.target.value }))}
                    >
                      <option value="">Selecione (Nomus)…</option>
                      {empresaOptions.map((e) => (
                        <option key={`${e.id}-${e.nome}`} value={e.nome}>
                          {e.nome}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="sm:col-span-1">
                    <SingleSelectWithSearch
                      label="Banco"
                      placeholder={bancosLoading ? 'Carregando…' : 'Buscar conta bancária (Nomus)…'}
                      options={bancoOptions}
                      value={optionFromTexto(form.banco)}
                      onChange={(opt) => setForm((f) => ({ ...f, banco: opt?.nome ?? '' }))}
                      labelClass={fieldLabelClass}
                      inputClass={inputClass}
                      fillContainer
                      clearable
                      searchLoading={bancosLoading}
                      dropdownZIndex={11000}
                      listMaxHeight="220px"
                    />
                  </div>
                  <Field label="Tipo">
                    <input
                      className={inputClass}
                      value={form.tipo}
                      onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
                    />
                  </Field>
                  <div className="sm:col-span-1">
                    <SingleSelectWithSearch
                      label="Cliente *"
                      placeholder="Digite para buscar no Nomus…"
                      options={form.cliente.trim() ? [optionFromTexto(form.cliente)!] : []}
                      value={optionFromTexto(form.cliente)}
                      onChange={(opt) => setForm((f) => ({ ...f, cliente: opt?.nome ?? '' }))}
                      labelClass={fieldLabelClass}
                      inputClass={inputClass}
                      fillContainer
                      clearable
                      onSearchAsync={buscarClientesNomus}
                      minSearchChars={2}
                      dropdownZIndex={11000}
                      listMaxHeight="240px"
                    />
                  </div>
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
                    {editing ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
                        Os contatos de cobrança ficam no histórico estruturado. Use o botão da coluna{' '}
                        <strong>Obs</strong> na grade para ver e registrar novos contatos.
                      </div>
                    ) : (
                      <Field label="Primeiro contato (opcional)">
                        <textarea
                          className="min-h-[88px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-600/30 focus:ring-2 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                          value={form.obs}
                          onChange={(e) => setForm((f) => ({ ...f, obs: e.target.value }))}
                          placeholder="Justificativa do primeiro contato de cobrança…"
                        />
                      </Field>
                    )}
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

      <ModalHistoricoContatosInadimplente
        registro={historicoRegistro}
        open={historicoRegistro != null}
        onClose={() => setHistoricoRegistro(null)}
        onChanged={() => void carregar()}
      />
    </section>
  );
}
