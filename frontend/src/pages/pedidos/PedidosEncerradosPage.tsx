import { useCallback, useEffect, useRef, useState } from 'react';
import CarregandoInformacoesOverlay from '../../components/CarregandoInformacoesOverlay';
import PedidosEncerradosGrade from '../../components/PedidosEncerradosGrade';
import SingleSelectWithSearch, { type OptionItem } from '../../components/SingleSelectWithSearch';
import {
  buscarPedidosEncerradosTypeahead,
  listarPedidosEncerrados,
  type Pedido,
  type PedidoEncerradoTypeaheadItem,
} from '../../api/pedidos';

const labelClass = 'text-sm font-medium text-slate-700 dark:text-slate-300';
const inputClass =
  'rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100';

function formatDateBr(iso: string): string {
  const s = iso.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return iso;
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

function toOptionItem(p: PedidoEncerradoTypeaheadItem): OptionItem {
  return {
    id: p.id,
    nome: p.nome,
    descricao: `Cliente: ${p.cliente ?? '—'} — Emissão: ${formatDateBr(p.dataEmissao)}`,
    uniqueKey: `pd-${p.id}`,
  };
}

export default function PedidosEncerradosPage() {
  const [pdSelecionado, setPdSelecionado] = useState<OptionItem | null>(null);
  const [pdOptions, setPdOptions] = useState<OptionItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [erroConexao, setErroConexao] = useState<string | null>(null);
  const [buscaRealizada, setBuscaRealizada] = useState(false);
  const consultaSeqRef = useRef(0);

  const carregarPedido = useCallback(async (nomePd: string) => {
    const seq = ++consultaSeqRef.current;
    setLoading(true);
    setErro(null);
    setErroConexao(null);
    setBuscaRealizada(true);

    try {
      const result = await listarPedidosEncerrados(nomePd);
      if (seq !== consultaSeqRef.current) return;
      if (result.erroConexao) {
        setErroConexao(result.erroConexao);
        setPedidos([]);
      } else {
        setPedidos(result.data);
      }
    } catch (e) {
      if (seq !== consultaSeqRef.current) return;
      setErro(e instanceof Error ? e.message : 'Erro ao consultar pedidos encerrados.');
      setPedidos([]);
    } finally {
      if (seq === consultaSeqRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!pdSelecionado?.nome) {
      consultaSeqRef.current += 1;
      setPedidos([]);
      setBuscaRealizada(false);
      setErro(null);
      setErroConexao(null);
      setLoading(false);
      return;
    }
    void carregarPedido(pdSelecionado.nome);
  }, [pdSelecionado, carregarPedido]);

  const handleSearchPd = useCallback((term: string) => {
    const t = term.trim();
    if (t.length < 2) {
      setSearchLoading(false);
      setPdOptions([]);
      return;
    }
    setSearchLoading(true);
    void buscarPedidosEncerradosTypeahead(t)
      .then((list) => setPdOptions(list.map(toOptionItem)))
      .catch(() => setPdOptions([]))
      .finally(() => setSearchLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 max-w-[1600px] mx-auto w-full">
      <div>
        <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Pedidos encerrados</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Consulta itens que não aparecem mais no Gerenciador (status ERP encerrado).
        </p>
      </div>

      <div className="w-full min-w-0 max-w-xl">
        <SingleSelectWithSearch
          label="Pedido (PD)"
          placeholder="Digite o número do pedido…"
          options={pdOptions}
          value={pdSelecionado}
          onChange={setPdSelecionado}
          onSearchChange={handleSearchPd}
          searchLoading={searchLoading}
          labelClass={labelClass}
          inputClass={inputClass}
          minWidth="100%"
          listMaxHeight="280px"
          clearable
        />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Digite ao menos 2 caracteres para buscar pedidos com itens encerrados no ERP.
        </p>
      </div>

      {erroConexao && (
        <p className="text-sm text-amber-600 dark:text-amber-400" role="alert">
          {erroConexao}
        </p>
      )}
      {erro && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {erro}
        </p>
      )}

      <PedidosEncerradosGrade
        pedidos={pedidos}
        loading={loading}
        buscaRealizada={buscaRealizada}
      />

      <CarregandoInformacoesOverlay show={loading} mensagem="Consultando pedidos encerrados…" />
    </div>
  );
}
