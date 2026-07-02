import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { PERMISSOES, type CodigoPermissao } from '../../config/permissoes';
import CarregandoInformacoesOverlay from '../../components/CarregandoInformacoesOverlay';
import {
  listarProdutosCubagem,
  salvarProdutoCubagem,
  type ProdutoCubagemListItem,
  type VolumeCubagem,
} from '../../api/logistica';
import { PLACEHOLDER_BUSCA_TEXTO_LIVRE } from '../../utils/textoLivreBusca';

const BTN_PRIMARY =
  'px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm transition';
const BTN_SECONDARY =
  'px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium text-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600';
const INPUT =
  'w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-2 text-sm';

type FormState = {
  pesoKg: string;
  alturaMm: string;
  larguraMm: string;
  profundidadeMm: string;
  numVolumes: string;
  empilhavel: boolean;
  pesoMaxTopoKg: string;
  podeDeitar: boolean;
  podeVirar: boolean;
  esteLadoParaCima: boolean;
  fragilNaoSobrepor: boolean;
  volumes: VolumeCubagem[];
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

function criarVolumesVazios(qtd: number): VolumeCubagem[] {
  return Array.from({ length: qtd }, (_, i) => ({
    ordem: i + 1,
    descricao: `Volume ${i + 1}`,
    alturaMm: null,
    larguraMm: null,
    profundidadeMm: null,
    pesoKg: null,
  }));
}

function produtoToForm(p: ProdutoCubagemListItem): FormState {
  const c = p.cubagem;
  const numVolumes = c?.numVolumes ?? 1;
  return {
    pesoKg: c?.pesoKg != null ? String(c.pesoKg) : '',
    alturaMm: c?.alturaMm != null ? String(c.alturaMm) : '',
    larguraMm: c?.larguraMm != null ? String(c.larguraMm) : '',
    profundidadeMm: c?.profundidadeMm != null ? String(c.profundidadeMm) : '',
    numVolumes: String(numVolumes),
    empilhavel: c?.empilhavel ?? true,
    pesoMaxTopoKg: c?.pesoMaxTopoKg != null ? String(c.pesoMaxTopoKg) : '',
    podeDeitar: c?.podeDeitar ?? true,
    podeVirar: c?.podeVirar ?? true,
    esteLadoParaCima: c?.esteLadoParaCima ?? false,
    fragilNaoSobrepor: c?.fragilNaoSobrepor ?? false,
    volumes:
      numVolumes > 1 && c?.volumes?.length
        ? c.volumes.map((v) => ({ ...v }))
        : criarVolumesVazios(numVolumes),
  };
}

function fmtDim(a: number | null, l: number | null, p: number | null) {
  if (a == null || l == null || p == null) return '—';
  return `${a}×${l}×${p} mm`;
}

export default function ProdutosCubagemPage() {
  const { hasPermission } = useAuth();
  const canView = podeVer(hasPermission);
  const canEdit = podeEditar(hasPermission);

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [rows, setRows] = useState<ProdutoCubagemListItem[]>([]);
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'acabado' | 'intermediario'>('todos');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'dimensionado' | 'pendente'>('todos');
  const [modalProduto, setModalProduto] = useState<ProdutoCubagemListItem | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const data = await listarProdutosCubagem({
        busca: busca.trim() || undefined,
        tipo: filtroTipo,
        status: filtroStatus,
      });
      setRows(data);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar produtos.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [busca, filtroTipo, filtroStatus]);

  useEffect(() => {
    if (!canView) return;
    const t = window.setTimeout(() => void carregar(), 300);
    return () => window.clearTimeout(t);
  }, [canView, carregar]);

  const abrirModal = (p: ProdutoCubagemListItem) => {
    setModalProduto(p);
    setForm(produtoToForm(p));
    setErro(null);
  };

  const alterarNumVolumes = (raw: string) => {
    const n = Math.max(1, Math.min(20, Math.round(Number(raw) || 1)));
    setForm((f) => {
      if (!f) return f;
      const volumes =
        n > 1
          ? Array.from({ length: n }, (_, i) => {
              const existente = f.volumes[i];
              return (
                existente ?? {
                  ordem: i + 1,
                  descricao: `Volume ${i + 1}`,
                  alturaMm: null,
                  larguraMm: null,
                  profundidadeMm: null,
                  pesoKg: null,
                }
              );
            })
          : [];
      return { ...f, numVolumes: String(n), volumes };
    });
  };

  const salvar = async () => {
    if (!canEdit || !modalProduto || !form) return;
    setSalvando(true);
    setErro(null);
    try {
      const numVolumes = Math.max(1, Number(form.numVolumes) || 1);
      await salvarProdutoCubagem(modalProduto.idProduto, {
        pesoKg: form.pesoKg ? Number(form.pesoKg) : null,
        alturaMm: numVolumes <= 1 && form.alturaMm ? Number(form.alturaMm) : null,
        larguraMm: numVolumes <= 1 && form.larguraMm ? Number(form.larguraMm) : null,
        profundidadeMm: numVolumes <= 1 && form.profundidadeMm ? Number(form.profundidadeMm) : null,
        numVolumes,
        empilhavel: form.empilhavel,
        pesoMaxTopoKg: form.pesoMaxTopoKg ? Number(form.pesoMaxTopoKg) : null,
        podeDeitar: form.podeDeitar,
        podeVirar: form.podeVirar,
        esteLadoParaCima: form.esteLadoParaCima,
        fragilNaoSobrepor: form.fragilNaoSobrepor,
        volumes:
          numVolumes > 1
            ? form.volumes.map((v, idx) => ({
                ordem: idx + 1,
                descricao: v.descricao,
                alturaMm: v.alturaMm,
                larguraMm: v.larguraMm,
                profundidadeMm: v.profundidadeMm,
                pesoKg: v.pesoKg,
              }))
            : [],
      });
      setModalProduto(null);
      setForm(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar cubagem.');
    } finally {
      setSalvando(false);
    }
  };

  if (!canView) return <Navigate to="/sem-acesso" replace />;

  const numVolumes = form ? Math.max(1, Number(form.numVolumes) || 1) : 1;

  return (
    <div className="relative flex flex-col flex-1 min-h-0 p-3 max-w-[1600px] mx-auto w-full">
      <CarregandoInformacoesOverlay show={loading || salvando} mode="viewport" />

      <div className="mb-3 shrink-0">
        <p className="text-xs font-medium text-primary-600 dark:text-primary-400 uppercase tracking-wide">
          Logística · Cubagem
        </p>
        <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Dimensões de Produtos</h1>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Produtos acabados e intermediários ativos do ERP — extensão local de cubagem (mm / kg). Peso opcional.
        </p>
      </div>

      {erro && !modalProduto && (
        <p className="mb-2 text-sm text-red-600 dark:text-red-300 shrink-0" role="alert">{erro}</p>
      )}

      <div className="mb-2 flex flex-wrap gap-2 shrink-0">
        <input
          type="search"
          className={`${INPUT} max-w-md flex-1 min-w-[200px]`}
          placeholder={PLACEHOLDER_BUSCA_TEXTO_LIVRE}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <select className={`${INPUT} w-auto`} value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as typeof filtroTipo)}>
          <option value="todos">Todos os tipos</option>
          <option value="acabado">Acabado</option>
          <option value="intermediario">Intermediário</option>
        </select>
        <select className={`${INPUT} w-auto`} value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as typeof filtroStatus)}>
          <option value="todos">Todos os status</option>
          <option value="dimensionado">Dimensionado</option>
          <option value="pendente">Pendente</option>
        </select>
      </div>

      <div className="flex-1 min-h-0 card-panel shadow-sm overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-900">
            <tr>
              <th className="text-left px-3 py-2 font-semibold w-28">Código</th>
              <th className="text-left px-3 py-2 font-semibold">Descrição</th>
              <th className="text-left px-3 py-2 font-semibold w-36">Tipo</th>
              <th className="text-center px-3 py-2 font-semibold w-28">Status</th>
              <th className="text-left px-3 py-2 font-semibold w-36">Dimensões</th>
              <th className="text-right px-3 py-2 font-semibold w-20">Peso</th>
              <th className="text-center px-3 py-2 font-semibold w-16">Vol.</th>
              <th className="text-right px-3 py-2 font-semibold w-24">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                  {loading ? 'Carregando…' : 'Nenhum produto encontrado.'}
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const c = r.cubagem;
                const dim =
                  c && c.numVolumes > 1
                    ? `${c.numVolumes} volumes`
                    : fmtDim(c?.alturaMm ?? null, c?.larguraMm ?? null, c?.profundidadeMm ?? null);
                return (
                  <tr key={r.idProduto} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <td className="px-3 py-2 font-mono text-xs">{r.codigoProduto}</td>
                    <td className="px-3 py-2">{r.descricaoProduto}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400 text-xs">{r.tipoProduto}</td>
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
                    <td className="px-3 py-2 font-mono text-xs">{dim}</td>
                    <td className="px-3 py-2 text-right">{c?.pesoKg != null ? `${c.pesoKg} kg` : '—'}</td>
                    <td className="px-3 py-2 text-center">{c?.numVolumes ?? 1}</td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" className="text-primary-600 hover:underline text-xs dark:text-primary-400" onClick={() => abrirModal(r)}>
                        {canEdit ? 'Dimensionar' : 'Ver'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {modalProduto && form && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 overflow-y-auto" onClick={() => !salvando && (setModalProduto(null), setForm(null))}>
          <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-600 dark:bg-slate-800 my-4" onClick={(e) => e.stopPropagation()} role="dialog">
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Cubagem — {modalProduto.codigoProduto}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{modalProduto.descricaoProduto}</p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Peso unitário (kg)</span>
                <input className={`${INPUT} mt-1`} type="number" step="0.001" disabled={!canEdit} value={form.pesoKg} onChange={(e) => setForm((f) => f && { ...f, pesoKg: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Nº de volumes</span>
                <input className={`${INPUT} mt-1`} type="number" min={1} max={20} disabled={!canEdit} value={form.numVolumes} onChange={(e) => alterarNumVolumes(e.target.value)} />
              </label>

              {numVolumes <= 1 && (
                <>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Altura (mm)</span>
                    <input className={`${INPUT} mt-1`} type="number" disabled={!canEdit} value={form.alturaMm} onChange={(e) => setForm((f) => f && { ...f, alturaMm: e.target.value })} />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Largura (mm)</span>
                    <input className={`${INPUT} mt-1`} type="number" disabled={!canEdit} value={form.larguraMm} onChange={(e) => setForm((f) => f && { ...f, larguraMm: e.target.value })} />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Profundidade (mm)</span>
                    <input className={`${INPUT} mt-1`} type="number" disabled={!canEdit} value={form.profundidadeMm} onChange={(e) => setForm((f) => f && { ...f, profundidadeMm: e.target.value })} />
                  </label>
                </>
              )}

              <label className="block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Peso máx. suportado em cima (kg)</span>
                <input className={`${INPUT} mt-1`} type="number" step="0.001" disabled={!canEdit || !form.empilhavel} value={form.pesoMaxTopoKg} onChange={(e) => setForm((f) => f && { ...f, pesoMaxTopoKg: e.target.value })} />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" disabled={!canEdit} checked={form.empilhavel} onChange={(e) => setForm((f) => f && { ...f, empilhavel: e.target.checked })} />
                Empilhável
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" disabled={!canEdit} checked={form.podeDeitar} onChange={(e) => setForm((f) => f && { ...f, podeDeitar: e.target.checked })} />
                Pode deitar
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" disabled={!canEdit} checked={form.podeVirar} onChange={(e) => setForm((f) => f && { ...f, podeVirar: e.target.checked })} />
                Pode virar
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" disabled={!canEdit} checked={form.esteLadoParaCima} onChange={(e) => setForm((f) => f && { ...f, esteLadoParaCima: e.target.checked })} />
                Este lado para cima
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" disabled={!canEdit} checked={form.fragilNaoSobrepor} onChange={(e) => setForm((f) => f && { ...f, fragilNaoSobrepor: e.target.checked })} />
                Frágil / não sobrepor
              </label>
            </div>

            {numVolumes > 1 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Volumes individuais</h3>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {form.volumes.map((v, idx) => (
                    <div key={idx} className="rounded-lg border border-slate-200 dark:border-slate-600 p-3">
                      <p className="text-xs font-medium text-slate-500 mb-2">Volume {idx + 1}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <input className={INPUT} placeholder="Descrição" disabled={!canEdit} value={v.descricao ?? ''} onChange={(e) => setForm((f) => {
                          if (!f) return f;
                          const volumes = [...f.volumes];
                          volumes[idx] = { ...volumes[idx], descricao: e.target.value };
                          return { ...f, volumes };
                        })} />
                        <input className={INPUT} type="number" placeholder="Altura mm" disabled={!canEdit} value={v.alturaMm ?? ''} onChange={(e) => setForm((f) => {
                          if (!f) return f;
                          const volumes = [...f.volumes];
                          volumes[idx] = { ...volumes[idx], alturaMm: e.target.value ? Number(e.target.value) : null };
                          return { ...f, volumes };
                        })} />
                        <input className={INPUT} type="number" placeholder="Largura mm" disabled={!canEdit} value={v.larguraMm ?? ''} onChange={(e) => setForm((f) => {
                          if (!f) return f;
                          const volumes = [...f.volumes];
                          volumes[idx] = { ...volumes[idx], larguraMm: e.target.value ? Number(e.target.value) : null };
                          return { ...f, volumes };
                        })} />
                        <input className={INPUT} type="number" placeholder="Prof. mm" disabled={!canEdit} value={v.profundidadeMm ?? ''} onChange={(e) => setForm((f) => {
                          if (!f) return f;
                          const volumes = [...f.volumes];
                          volumes[idx] = { ...volumes[idx], profundidadeMm: e.target.value ? Number(e.target.value) : null };
                          return { ...f, volumes };
                        })} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {erro && <p className="mt-3 text-sm text-red-600 dark:text-red-300">{erro}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={BTN_SECONDARY} disabled={salvando} onClick={() => { setModalProduto(null); setForm(null); }}>Fechar</button>
              {canEdit && (
                <button type="button" className={BTN_PRIMARY} disabled={salvando} onClick={() => void salvar()}>{salvando ? 'Salvando…' : 'Salvar'}</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
