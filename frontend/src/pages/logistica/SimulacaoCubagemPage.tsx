import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { PERMISSOES, type CodigoPermissao } from '../../config/permissoes';
import CarregandoInformacoesOverlay from '../../components/CarregandoInformacoesOverlay';
import CubagemViz2D from '../../components/logistica/CubagemViz2D';
import {
  buscarItensPedidoCubagem,
  calcularSimulacaoCubagem,
  listarProdutosCubagem,
  listarVeiculos,
  type ItemPedidoCubagem,
  type ProdutoCubagemListItem,
  type ResultadoSimulacaoCubagem,
  type Veiculo,
} from '../../api/logistica';
import { criarMatcherTextoLivre, PLACEHOLDER_BUSCA_TEXTO_LIVRE } from '../../utils/textoLivreBusca';
import { exportCubagemPdf } from '../../utils/exportCubagemPdf';

type WizardStep = 'veiculo' | 'modo' | 'carga';
type ModoCarga = 'manual' | 'pedido';

type ItemCarga = {
  key: string;
  idProduto: number;
  codigo: string;
  descricao: string;
  quantidade: number;
  sequencia: number;
  idChave?: string;
  pd?: string;
  valorUnitario?: number;
};

const BTN_PRIMARY =
  'px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm transition disabled:opacity-50';
const BTN_SECONDARY =
  'px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium text-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600';
const INPUT =
  'w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-2 text-sm';

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

function pctCor(pct: number, excesso: boolean): string {
  if (excesso || pct > 100) return 'bg-red-500';
  if (pct >= 85) return 'bg-amber-500';
  return 'bg-emerald-500';
}

export default function SimulacaoCubagemPage() {
  const { hasPermission } = useAuth();
  const editar = podeEditar(hasPermission);

  const [step, setStep] = useState<WizardStep>('veiculo');
  const [modo, setModo] = useState<ModoCarga>('manual');
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [veiculoSel, setVeiculoSel] = useState<Veiculo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [produtos, setProdutos] = useState<ProdutoCubagemListItem[]>([]);
  const [buscaProduto, setBuscaProduto] = useState('');
  const [qtyManual, setQtyManual] = useState('1');
  const [produtoSel, setProdutoSel] = useState<ProdutoCubagemListItem | null>(null);

  const [pdBusca, setPdBusca] = useState('');
  const [itensPedido, setItensPedido] = useState<ItemPedidoCubagem[]>([]);
  const [selPedido, setSelPedido] = useState<Record<string, boolean>>({});
  const [qtyPedido, setQtyPedido] = useState<Record<string, string>>({});
  const [buscandoPedido, setBuscandoPedido] = useState(false);

  const [itensCarga, setItensCarga] = useState<ItemCarga[]>([]);
  const [resultado, setResultado] = useState<ResultadoSimulacaoCubagem | null>(null);
  const [calculando, setCalculando] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const matchProduto = useMemo(() => criarMatcherTextoLivre(buscaProduto), [buscaProduto]);
  const produtosFiltrados = useMemo(
    () =>
      produtos
        .filter((p) => matchProduto(p.codigoProduto) || matchProduto(p.descricaoProduto))
        .slice(0, 30),
    [produtos, matchProduto]
  );

  useEffect(() => {
    let cancel = false;
    (async () => {
      setCarregando(true);
      try {
        const [v, p] = await Promise.all([
          listarVeiculos(true),
          listarProdutosCubagem({ status: 'dimensionado' }),
        ]);
        if (!cancel) {
          setVeiculos(v);
          setProdutos(p);
        }
      } catch (e) {
        if (!cancel) setErro(e instanceof Error ? e.message : 'Erro ao carregar dados.');
      } finally {
        if (!cancel) setCarregando(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const recalcular = useCallback(async () => {
    if (!veiculoSel || itensCarga.length === 0) {
      setResultado(null);
      return;
    }
    setCalculando(true);
    try {
      const r = await calcularSimulacaoCubagem({
        veiculoId: veiculoSel.id,
        itens: itensCarga.map((i) => ({
          idProduto: i.idProduto,
          quantidade: i.quantidade,
          idChave: i.idChave,
          pd: i.pd,
          sequencia: i.sequencia,
          valorUnitario: i.valorUnitario,
        })),
      });
      setResultado(r);
      setErro(null);
    } catch (e) {
      setResultado(null);
      setErro(e instanceof Error ? e.message : 'Erro ao calcular simulação.');
    } finally {
      setCalculando(false);
    }
  }, [veiculoSel, itensCarga]);

  useEffect(() => {
    if (step !== 'carga') return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void recalcular();
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [step, recalcular]);

  const adicionarManual = () => {
    if (!produtoSel || !editar) return;
    const qty = Math.max(1, Math.round(Number(qtyManual) || 1));
    const key = `m-${produtoSel.idProduto}-${Date.now()}`;
    const seq = itensCarga.length + 1;
    setItensCarga((prev) => [
      ...prev,
      {
        key,
        idProduto: produtoSel.idProduto,
        codigo: produtoSel.codigoProduto,
        descricao: produtoSel.descricaoProduto,
        quantidade: qty,
        sequencia: seq,
      },
    ]);
    setProdutoSel(null);
    setBuscaProduto('');
    setQtyManual('1');
  };

  const buscarPedido = async () => {
    if (!pdBusca.trim()) return;
    setBuscandoPedido(true);
    setErro(null);
    try {
      const itens = await buscarItensPedidoCubagem(pdBusca.trim());
      setItensPedido(itens);
      const sel: Record<string, boolean> = {};
      const qty: Record<string, string> = {};
      for (const it of itens) {
        sel[it.idChave] = false;
        qty[it.idChave] = String(it.qtdePendenteReal);
      }
      setSelPedido(sel);
      setQtyPedido(qty);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao buscar pedido.');
      setItensPedido([]);
    } finally {
      setBuscandoPedido(false);
    }
  };

  const incluirSelecionadosPedido = () => {
    if (!editar) return;
    const novos: ItemCarga[] = [];
    let seq = itensCarga.length;
    for (const it of itensPedido) {
      if (!selPedido[it.idChave] || it.statusCubagem !== 'dimensionado') continue;
      const max = it.qtdePendenteReal;
      const qty = Math.min(max, Math.max(1, Math.round(Number(qtyPedido[it.idChave]) || 1)));
      seq++;
      novos.push({
        key: `p-${it.idChave}-${Date.now()}`,
        idProduto: it.idProduto,
        codigo: it.codigo,
        descricao: it.descricao,
        quantidade: qty,
        sequencia: seq,
        idChave: it.idChave,
        pd: it.pd,
        valorUnitario: it.valorUnitario,
      });
    }
    if (novos.length > 0) setItensCarga((prev) => [...prev, ...novos]);
  };

  const removerItem = (key: string) => {
    if (!editar) return;
    setItensCarga((prev) => prev.filter((i) => i.key !== key));
  };

  const atualizarSequencia = (key: string, seq: number) => {
    if (!editar) return;
    setItensCarga((prev) =>
      prev.map((i) => (i.key === key ? { ...i, sequencia: Math.max(1, seq) } : i))
    );
  };

  const exportarPdf = () => {
    if (!veiculoSel || !resultado) return;
    exportCubagemPdf(veiculoSel, itensCarga, resultado);
  };

  if (!podeVer(hasPermission)) {
    return <Navigate to="/sem-acesso" replace />;
  }

  if (carregando) {
    return <CarregandoInformacoesOverlay mensagem="Carregando simulação de cubagem…" />;
  }

  // Wizard: veículo
  if (step === 'veiculo') {
    const dimensionados = veiculos.filter((v) => v.status === 'dimensionado');
    const pendentes = veiculos.filter((v) => v.status === 'pendente');
    return (
      <div className="flex flex-col flex-1 min-h-0 p-6 max-w-lg mx-auto w-full">
        <p className="text-xs font-medium text-primary-600 dark:text-primary-400 uppercase tracking-wide mb-1">
          Logística · Cubagem
        </p>
        <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-4">
          Simulação — Escolher veículo
        </h1>
        {erro && <p className="text-sm text-red-600 mb-3">{erro}</p>}
        <label className="block text-sm text-slate-600 dark:text-slate-300 mb-2">Placa</label>
        <select
          className={INPUT}
          value={veiculoSel?.id ?? ''}
          onChange={(e) => {
            const v = veiculos.find((x) => x.id === Number(e.target.value));
            setVeiculoSel(v ?? null);
          }}
        >
          <option value="">Selecione…</option>
          {dimensionados.map((v) => (
            <option key={v.id} value={v.id}>
              {v.placa} — {v.modelo ?? 'Sem modelo'} ({v.alturaMm}×{v.larguraMm}×{v.profundidadeMm} mm)
            </option>
          ))}
        </select>
        {pendentes.length > 0 && (
          <p className="text-xs text-slate-500 mt-2">
            {pendentes.length} veículo(s) pendente(s) de dimensão — indisponíveis para simulação.
          </p>
        )}
        <button
          type="button"
          className={`${BTN_PRIMARY} mt-6 self-start`}
          disabled={!veiculoSel}
          onClick={() => setStep('modo')}
        >
          Continuar
        </button>
      </div>
    );
  }

  // Wizard: modo
  if (step === 'modo') {
    return (
      <div className="flex flex-col flex-1 min-h-0 p-6 max-w-lg mx-auto w-full">
        <p className="text-xs font-medium text-primary-600 dark:text-primary-400 uppercase tracking-wide mb-1">
          Veículo: {veiculoSel?.placa}
        </p>
        <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-4">
          Modo de montagem da carga
        </h1>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            className={`${BTN_SECONDARY} text-left p-4 ${modo === 'manual' ? 'ring-2 ring-primary-500' : ''}`}
            onClick={() => setModo('manual')}
          >
            <span className="font-medium">Manual</span>
            <p className="text-xs text-slate-500 mt-1">Selecione produtos e quantidades livremente.</p>
          </button>
          <button
            type="button"
            className={`${BTN_SECONDARY} text-left p-4 ${modo === 'pedido' ? 'ring-2 ring-primary-500' : ''}`}
            onClick={() => setModo('pedido')}
          >
            <span className="font-medium">Por pedido</span>
            <p className="text-xs text-slate-500 mt-1">
              Busque um PD e inclua itens com saldo a faturar.
            </p>
          </button>
        </div>
        <div className="flex gap-2 mt-6">
          <button type="button" className={BTN_SECONDARY} onClick={() => setStep('veiculo')}>
            Voltar
          </button>
          <button type="button" className={BTN_PRIMARY} onClick={() => setStep('carga')}>
            Iniciar simulação
          </button>
        </div>
      </div>
    );
  }

  // Tela principal
  const ind = resultado?.indicadores;
  const excessoVol = resultado?.excessos.volume ?? false;
  const excessoPeso = resultado?.excessos.peso ?? false;

  return (
    <div className="flex flex-col flex-1 min-h-0 p-4 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-primary-600 dark:text-primary-400 uppercase tracking-wide">
            Simulação de Cubagem
          </p>
          <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {veiculoSel?.placa} — {veiculoSel?.modelo ?? 'Veículo'} ·{' '}
            {modo === 'manual' ? 'Manual' : 'Por pedido'}
          </h1>
        </div>
        <div className="flex gap-2">
          <button type="button" className={BTN_SECONDARY} onClick={() => setStep('veiculo')}>
            Trocar veículo
          </button>
          {editar && (
            <button
              type="button"
              className={BTN_PRIMARY}
              disabled={!resultado || itensCarga.length === 0}
              onClick={exportarPdf}
            >
              Exportar PDF
            </button>
          )}
        </div>
      </div>

      {erro && (
        <div className="text-sm text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-300 px-3 py-2 rounded-lg">
          {erro}
        </div>
      )}

      {resultado?.avisos.map((a, i) => (
        <div
          key={i}
          className="text-xs text-amber-800 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-200 px-3 py-1.5 rounded"
        >
          {a.mensagem}
        </div>
      ))}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
        {/* Painel esquerdo — montar carga */}
        <div className="lg:col-span-3 flex flex-col gap-3 min-h-0 overflow-auto border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-white dark:bg-slate-800/50">
          <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200">Montar carga</h2>

          {modo === 'manual' ? (
            <>
              <input
                className={INPUT}
                placeholder={PLACEHOLDER_BUSCA_TEXTO_LIVRE}
                value={buscaProduto}
                onChange={(e) => setBuscaProduto(e.target.value)}
                disabled={!editar}
              />
              {buscaProduto && (
                <ul className="max-h-36 overflow-auto text-sm border border-slate-200 dark:border-slate-600 rounded-lg">
                  {produtosFiltrados.map((p) => (
                    <li key={p.idProduto}>
                      <button
                        type="button"
                        className={`w-full text-left px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 ${
                          produtoSel?.idProduto === p.idProduto ? 'bg-primary-50 dark:bg-primary-900/30' : ''
                        }`}
                        onClick={() => setProdutoSel(p)}
                      >
                        <span className="font-medium">{p.codigoProduto}</span>
                        <span className="text-xs text-slate-500 block truncate">{p.descricaoProduto}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <input
                  className={INPUT}
                  type="number"
                  min={1}
                  value={qtyManual}
                  onChange={(e) => setQtyManual(e.target.value)}
                  disabled={!editar}
                />
                <button
                  type="button"
                  className={BTN_PRIMARY}
                  disabled={!editar || !produtoSel}
                  onClick={adicionarManual}
                >
                  Adicionar
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex gap-2">
                <input
                  className={INPUT}
                  placeholder="Nº do PD"
                  value={pdBusca}
                  onChange={(e) => setPdBusca(e.target.value)}
                  disabled={!editar}
                />
                <button
                  type="button"
                  className={BTN_SECONDARY}
                  disabled={!editar || buscandoPedido}
                  onClick={() => void buscarPedido()}
                >
                  {buscandoPedido ? '…' : 'Buscar'}
                </button>
              </div>
              {itensPedido.length > 0 && (
                <>
                  <div className="max-h-48 overflow-auto text-xs space-y-1">
                    {itensPedido.map((it) => (
                      <label
                        key={it.idChave}
                        className={`flex items-start gap-2 p-1.5 rounded ${
                          it.statusCubagem === 'pendente' ? 'opacity-50' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={!editar || it.statusCubagem === 'pendente'}
                          checked={!!selPedido[it.idChave]}
                          onChange={(e) =>
                            setSelPedido((s) => ({ ...s, [it.idChave]: e.target.checked }))
                          }
                        />
                        <span className="flex-1 min-w-0">
                          <span className="font-medium">{it.codigo}</span>
                          <span className="text-slate-500"> · saldo {it.qtdePendenteReal}</span>
                          {it.statusCubagem === 'pendente' && (
                            <span className="text-red-600 block">Sem dimensão</span>
                          )}
                        </span>
                        <input
                          className="w-14 rounded border px-1 py-0.5 text-right"
                          type="number"
                          min={1}
                          max={it.qtdePendenteReal}
                          disabled={!editar || it.statusCubagem === 'pendente'}
                          value={qtyPedido[it.idChave] ?? ''}
                          onChange={(e) =>
                            setQtyPedido((q) => ({ ...q, [it.idChave]: e.target.value }))
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    className={BTN_PRIMARY}
                    disabled={!editar}
                    onClick={incluirSelecionadosPedido}
                  >
                    Incluir selecionados
                  </button>
                </>
              )}
            </>
          )}
        </div>

        {/* Painel centro — indicadores + 2D */}
        <div className="lg:col-span-5 flex flex-col gap-3 min-h-0 overflow-auto border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-white dark:bg-slate-800/50">
          <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Indicadores {calculando && <span className="text-xs text-slate-400">(calculando…)</span>}
          </h2>

          {ind ? (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="col-span-2">
                <div className="flex justify-between text-xs mb-1">
                  <span>Volume {excessoVol && <span className="text-red-600 font-medium">EXCEDIDO</span>}</span>
                  <span>{ind.pctVolume.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${pctCor(ind.pctVolume, excessoVol)}`}
                    style={{ width: `${Math.min(100, ind.pctVolume)}%` }}
                  />
                </div>
              </div>
              <div className="col-span-2">
                <div className="flex justify-between text-xs mb-1">
                  <span>
                    Peso{' '}
                    {!ind.pesoDisponivel && (
                      <span className="text-slate-400">(não cadastrado)</span>
                    )}
                    {excessoPeso && <span className="text-red-600 font-medium"> EXCEDIDO</span>}
                  </span>
                  {ind.pctPeso != null && <span>{ind.pctPeso.toFixed(1)}%</span>}
                </div>
                {ind.pesoDisponivel ? (
                  <div className="h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${pctCor(ind.pctPeso ?? 0, excessoPeso)}`}
                      style={{ width: `${Math.min(100, ind.pctPeso ?? 0)}%` }}
                    />
                  </div>
                ) : (
                  <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full" />
                )}
              </div>
              <div className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded">
                <p className="text-xs text-slate-500">Volumes</p>
                <p className="font-semibold">{ind.numVolumes}</p>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded">
                <p className="text-xs text-slate-500">Itens</p>
                <p className="font-semibold">{ind.numItens}</p>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded col-span-2">
                <p className="text-xs text-slate-500">Valor total</p>
                <p className="font-semibold">
                  {ind.valorTotal > 0
                    ? ind.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                    : '—'}
                </p>
              </div>
              {ind.limitante && (
                <p className="col-span-2 text-xs text-slate-600 dark:text-slate-300">
                  Restrição mais crítica: <strong>{ind.limitante}</strong>
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Adicione itens para ver indicadores.</p>
          )}

          <CubagemViz2D
            layout2D={resultado?.layout2D ?? null}
            veiculoLabel={
              veiculoSel
                ? `${veiculoSel.alturaMm}×${veiculoSel.larguraMm}×${veiculoSel.profundidadeMm} mm`
                : undefined
            }
          />
        </div>

        {/* Painel direito — lista */}
        <div className="lg:col-span-4 flex flex-col min-h-0 overflow-auto border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-white dark:bg-slate-800/50">
          <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
            Itens na carga ({itensCarga.length})
          </h2>
          {itensCarga.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum item adicionado.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b dark:border-slate-600">
                  <th className="py-1 pr-1 w-8">Seq</th>
                  <th className="py-1">Código</th>
                  <th className="py-1 w-10">Qt</th>
                  <th className="py-1 w-8" />
                </tr>
              </thead>
              <tbody>
                {[...itensCarga]
                  .sort((a, b) => a.sequencia - b.sequencia)
                  .map((item) => (
                    <tr key={item.key} className="border-b border-slate-100 dark:border-slate-700">
                      <td className="py-1">
                        <input
                          type="number"
                          min={1}
                          className="w-8 rounded border px-0.5 text-center dark:bg-slate-700"
                          value={item.sequencia}
                          disabled={!editar}
                          onChange={(e) =>
                            atualizarSequencia(item.key, Number(e.target.value))
                          }
                        />
                      </td>
                      <td className="py-1">
                        <span className="font-medium">{item.codigo}</span>
                        {item.pd && (
                          <span className="text-slate-400 block">PD {item.pd}</span>
                        )}
                      </td>
                      <td className="py-1">{item.quantidade}</td>
                      <td className="py-1">
                        {editar && (
                          <button
                            type="button"
                            className="text-red-600 hover:underline"
                            onClick={() => removerItem(item.key)}
                          >
                            ×
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
