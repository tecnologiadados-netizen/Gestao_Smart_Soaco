import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { PERMISSOES, type CodigoPermissao } from '../../config/permissoes';
import CarregandoInformacoesOverlay from '../../components/CarregandoInformacoesOverlay';
import {
  atualizarVeiculo,
  criarVeiculo,
  excluirVeiculo,
  listarVeiculos,
  type Veiculo,
} from '../../api/logistica';
import { criarMatcherTextoLivre, PLACEHOLDER_BUSCA_TEXTO_LIVRE } from '../../utils/textoLivreBusca';

const BTN_PRIMARY =
  'px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm transition';
const BTN_SECONDARY =
  'px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium text-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600';
const INPUT =
  'w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-2 text-sm';

type FormState = {
  placa: string;
  modelo: string;
  alturaMm: string;
  larguraMm: string;
  profundidadeMm: string;
  capacidadePesoKg: string;
  taraKg: string;
  pbtKg: string;
  alturaEmpilhamentoMm: string;
  aberturas: string;
  fatorAproveitamento: string;
  ano: string;
  motoristaPadrao: string;
  ativo: boolean;
};

const FORM_VAZIO: FormState = {
  placa: '',
  modelo: '',
  alturaMm: '',
  larguraMm: '',
  profundidadeMm: '',
  capacidadePesoKg: '',
  taraKg: '',
  pbtKg: '',
  alturaEmpilhamentoMm: '',
  aberturas: '',
  fatorAproveitamento: '0.85',
  ano: '',
  motoristaPadrao: '',
  ativo: true,
};

function podeVer(hasPermission: (c: CodigoPermissao) => boolean) {
  return (
    hasPermission(PERMISSOES.LOGISTICA_VER) ||
    hasPermission(PERMISSOES.LOGISTICA_TOTAL) ||
    hasPermission(PERMISSOES.LOGISTICA_CUBAGEM_VER)
  );
}

function podeEditar(hasPermission: (c: CodigoPermissao) => boolean) {
  return (
    hasPermission(PERMISSOES.LOGISTICA_CUBAGEM_EDITAR) ||
    hasPermission(PERMISSOES.LOGISTICA_TOTAL)
  );
}

function rowToForm(row: Veiculo): FormState {
  return {
    placa: row.placa,
    modelo: row.modelo ?? '',
    alturaMm: row.alturaMm != null ? String(row.alturaMm) : '',
    larguraMm: row.larguraMm != null ? String(row.larguraMm) : '',
    profundidadeMm: row.profundidadeMm != null ? String(row.profundidadeMm) : '',
    capacidadePesoKg: row.capacidadePesoKg != null ? String(row.capacidadePesoKg) : '',
    taraKg: row.taraKg != null ? String(row.taraKg) : '',
    pbtKg: row.pbtKg != null ? String(row.pbtKg) : '',
    alturaEmpilhamentoMm: row.alturaEmpilhamentoMm != null ? String(row.alturaEmpilhamentoMm) : '',
    aberturas: row.aberturas ?? '',
    fatorAproveitamento: String(row.fatorAproveitamento ?? 0.85),
    ano: row.ano != null ? String(row.ano) : '',
    motoristaPadrao: row.motoristaPadrao ?? '',
    ativo: row.ativo,
  };
}

function formToBody(form: FormState) {
  const num = (s: string) => (s.trim() ? Number(s) : null);
  return {
    placa: form.placa,
    modelo: form.modelo || null,
    alturaMm: num(form.alturaMm),
    larguraMm: num(form.larguraMm),
    profundidadeMm: num(form.profundidadeMm),
    capacidadePesoKg: num(form.capacidadePesoKg),
    taraKg: num(form.taraKg),
    pbtKg: num(form.pbtKg),
    alturaEmpilhamentoMm: num(form.alturaEmpilhamentoMm),
    aberturas: form.aberturas || null,
    fatorAproveitamento: Number(form.fatorAproveitamento) || 0.85,
    ano: num(form.ano),
    motoristaPadrao: form.motoristaPadrao || null,
    ativo: form.ativo,
  };
}

function fmtDim(a: number | null, l: number | null, p: number | null) {
  if (a == null || l == null || p == null) return '—';
  return `${a} × ${l} × ${p} mm`;
}

export default function VeiculosPage() {
  const { hasPermission } = useAuth();
  const canView = podeVer(hasPermission);
  const canEdit = podeEditar(hasPermission);

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [rows, setRows] = useState<Veiculo[]>([]);
  const [filtro, setFiltro] = useState('');
  const [modal, setModal] = useState<'novo' | { editar: Veiculo } | null>(null);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [confirmExcluir, setConfirmExcluir] = useState<Veiculo | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      setRows(await listarVeiculos());
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar veículos.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canView) return;
    void carregar();
  }, [canView, carregar]);

  const match = useMemo(() => criarMatcherTextoLivre(filtro), [filtro]);
  const filtrados = useMemo(
    () =>
      rows.filter(
        (r) =>
          match(r.placa) ||
          match(r.modelo ?? '') ||
          match(r.motoristaPadrao ?? '')
      ),
    [rows, match]
  );

  const salvar = async () => {
    if (!canEdit) return;
    setSalvando(true);
    setErro(null);
    try {
      const body = formToBody(form);
      if (modal === 'novo') {
        await criarVeiculo(body);
      } else if (modal && typeof modal === 'object' && 'editar' in modal) {
        await atualizarVeiculo(modal.editar.id, body);
      }
      setModal(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async () => {
    if (!confirmExcluir || !canEdit) return;
    setExcluindo(true);
    setErro(null);
    try {
      await excluirVeiculo(confirmExcluir.id);
      setConfirmExcluir(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao excluir.');
    } finally {
      setExcluindo(false);
    }
  };

  if (!canView) return <Navigate to="/sem-acesso" replace />;

  return (
    <div className="relative flex flex-col flex-1 min-h-0 p-3 max-w-[1600px] mx-auto w-full">
      <CarregandoInformacoesOverlay show={loading || salvando || excluindo} mode="viewport" />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between shrink-0">
        <div>
          <p className="text-xs font-medium text-primary-600 dark:text-primary-400 uppercase tracking-wide">
            Logística · Cubagem
          </p>
          <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Veículos</h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Cada caminhão com sua carroceria — placa, modelo e dimensões úteis internas (mm).
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            className={BTN_PRIMARY}
            onClick={() => {
              setForm(FORM_VAZIO);
              setModal('novo');
              setErro(null);
            }}
          >
            Novo veículo
          </button>
        )}
      </div>

      {erro && !modal && !confirmExcluir && (
        <p className="mb-2 text-sm text-red-600 dark:text-red-300 shrink-0" role="alert">{erro}</p>
      )}

      <div className="mb-2 shrink-0">
        <input type="search" className={INPUT} placeholder={PLACEHOLDER_BUSCA_TEXTO_LIVRE} value={filtro} onChange={(e) => setFiltro(e.target.value)} />
      </div>

      <div className="flex-1 min-h-0 card-panel shadow-sm overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-900">
            <tr>
              <th className="text-left px-3 py-2 font-semibold w-24">Placa</th>
              <th className="text-left px-3 py-2 font-semibold">Modelo</th>
              <th className="text-center px-3 py-2 font-semibold w-28">Status</th>
              <th className="text-left px-3 py-2 font-semibold">Dimensões (A×L×P)</th>
              <th className="text-right px-3 py-2 font-semibold w-24">Peso útil</th>
              <th className="text-center px-3 py-2 font-semibold w-16">Ativo</th>
              {canEdit && <th className="text-right px-3 py-2 font-semibold w-32">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 7 : 6} className="px-3 py-8 text-center text-slate-500">
                  {loading ? 'Carregando…' : 'Nenhum veículo cadastrado.'}
                </td>
              </tr>
            ) : (
              filtrados.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <td className="px-3 py-2 font-mono font-medium">{r.placa}</td>
                  <td className="px-3 py-2">{r.modelo ?? '—'}</td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        r.status === 'dimensionado'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                      }`}
                    >
                      {r.status === 'dimensionado' ? 'Dimensionado' : 'Pendente'}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {fmtDim(r.alturaMm, r.larguraMm, r.profundidadeMm)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.capacidadePesoKg != null ? `${r.capacidadePesoKg} kg` : '—'}
                  </td>
                  <td className="px-3 py-2 text-center">{r.ativo ? 'Sim' : 'Não'}</td>
                  {canEdit && (
                    <td className="px-3 py-2 text-right">
                      <button type="button" className="text-primary-600 hover:underline text-xs mr-3 dark:text-primary-400" onClick={() => { setForm(rowToForm(r)); setModal({ editar: r }); setErro(null); }}>
                        Editar
                      </button>
                      <button type="button" className="text-red-600 hover:underline text-xs dark:text-red-400" onClick={() => setConfirmExcluir(r)}>
                        Excluir
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 overflow-y-auto" onClick={() => !salvando && setModal(null)}>
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-600 dark:bg-slate-800 my-4" onClick={(e) => e.stopPropagation()} role="dialog">
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              {modal === 'novo' ? 'Novo veículo' : `Editar — ${modal.editar.placa}`}
            </h2>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Placa *</span>
                <input className={`${INPUT} mt-1`} value={form.placa} disabled={modal !== 'novo'} onChange={(e) => setForm((f) => ({ ...f, placa: e.target.value.toUpperCase() }))} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Modelo</span>
                <input className={`${INPUT} mt-1`} value={form.modelo} onChange={(e) => setForm((f) => ({ ...f, modelo: e.target.value }))} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Altura útil (mm)</span>
                <input className={`${INPUT} mt-1`} type="number" value={form.alturaMm} onChange={(e) => setForm((f) => ({ ...f, alturaMm: e.target.value }))} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Largura útil (mm)</span>
                <input className={`${INPUT} mt-1`} type="number" value={form.larguraMm} onChange={(e) => setForm((f) => ({ ...f, larguraMm: e.target.value }))} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Profundidade útil (mm)</span>
                <input className={`${INPUT} mt-1`} type="number" value={form.profundidadeMm} onChange={(e) => setForm((f) => ({ ...f, profundidadeMm: e.target.value }))} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Altura empilhamento (mm)</span>
                <input className={`${INPUT} mt-1`} type="number" value={form.alturaEmpilhamentoMm} onChange={(e) => setForm((f) => ({ ...f, alturaEmpilhamentoMm: e.target.value }))} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Capacidade peso (kg)</span>
                <input className={`${INPUT} mt-1`} type="number" value={form.capacidadePesoKg} onChange={(e) => setForm((f) => ({ ...f, capacidadePesoKg: e.target.value }))} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Tara (kg)</span>
                <input className={`${INPUT} mt-1`} type="number" value={form.taraKg} onChange={(e) => setForm((f) => ({ ...f, taraKg: e.target.value }))} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">PBT (kg)</span>
                <input className={`${INPUT} mt-1`} type="number" value={form.pbtKg} onChange={(e) => setForm((f) => ({ ...f, pbtKg: e.target.value }))} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Fator aproveitamento</span>
                <input className={`${INPUT} mt-1`} type="number" step="0.01" min="0" max="1" value={form.fatorAproveitamento} onChange={(e) => setForm((f) => ({ ...f, fatorAproveitamento: e.target.value }))} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Ano</span>
                <input className={`${INPUT} mt-1`} type="number" value={form.ano} onChange={(e) => setForm((f) => ({ ...f, ano: e.target.value }))} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Motorista padrão</span>
                <input className={`${INPUT} mt-1`} value={form.motoristaPadrao} onChange={(e) => setForm((f) => ({ ...f, motoristaPadrao: e.target.value }))} />
              </label>
              <label className="sm:col-span-2 block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Observações de abertura</span>
                <textarea className={`${INPUT} mt-1`} rows={2} placeholder="traseira, lateral/sider…" value={form.aberturas} onChange={(e) => setForm((f) => ({ ...f, aberturas: e.target.value }))} />
              </label>
              <label className="flex items-center gap-2 sm:col-span-2">
                <input type="checkbox" checked={form.ativo} onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))} />
                <span className="text-sm text-slate-700 dark:text-slate-300">Ativo</span>
              </label>
            </div>
            {erro && <p className="mt-3 text-sm text-red-600 dark:text-red-300">{erro}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={BTN_SECONDARY} disabled={salvando} onClick={() => setModal(null)}>Cancelar</button>
              <button type="button" className={BTN_PRIMARY} disabled={salvando || !canEdit} onClick={() => void salvar()}>{salvando ? 'Salvando…' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      {confirmExcluir && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onClick={() => !excluindo && setConfirmExcluir(null)}>
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-600 dark:bg-slate-800" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-slate-700 dark:text-slate-200">Excluir o veículo <strong>{confirmExcluir.placa}</strong>?</p>
            {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={BTN_SECONDARY} disabled={excluindo} onClick={() => setConfirmExcluir(null)}>Cancelar</button>
              <button type="button" className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm" disabled={excluindo} onClick={() => void excluir()}>{excluindo ? 'Excluindo…' : 'Excluir'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
