import { useState } from 'react';
import { getRelatorioAlteracoes, type RegistroAlteracao, type FiltrosRelatorioAlteracoes } from '../api/relatorios';
import { MensagemSemRegistrosInline } from '../components/MensagemSemRegistros';

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function RelatoriosPage() {
  const [dataIni, setDataIni] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [cliente, setCliente] = useState('');
  const [idPedido, setIdPedido] = useState('');
  const [registros, setRegistros] = useState<RegistroAlteracao[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGerar = async () => {
    setError(null);
    setRegistros(null);
    const filtros: FiltrosRelatorioAlteracoes = {};
    if (dataIni.trim()) filtros.data_ini = dataIni.trim();
    if (dataFim.trim()) filtros.data_fim = dataFim.trim();
    if (cliente.trim()) filtros.cliente = cliente.trim();
    if (idPedido.trim()) filtros.id_pedido = idPedido.trim();
    setLoading(true);
    try {
      const res = await getRelatorioAlteracoes(filtros);
      setRegistros(res.registros);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar relatório.');
    } finally {
      setLoading(false);
    }
  };

  const handleImprimir = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50 p-6 shadow-sm no-print">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">
          Relatório de alterações de previsão
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Defina os parâmetros abaixo e clique em &quot;Gerar relatório&quot;. Você pode filtrar por período, cliente e/ou número do pedido.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Data inicial
            </label>
            <input
              type="date"
              value={dataIni}
              onChange={(e) => setDataIni(e.target.value)}
              className="w-full rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Data final
            </label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Cliente
            </label>
            <input
              type="text"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Nome ou parte do nome"
              className="w-full rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Pedido (ID)
            </label>
            <input
              type="text"
              value={idPedido}
              onChange={(e) => setIdPedido(e.target.value)}
              placeholder="Ex.: 12345"
              className="w-full rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
            />
          </div>
        </div>
        {error && (
          <p className="text-amber-600 dark:text-amber-400 text-sm mb-4">{error}</p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleGerar}
            disabled={loading}
            className="rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white px-5 py-2.5 text-sm font-medium"
          >
            {loading ? 'Gerando...' : 'Gerar relatório'}
          </button>
          {registros !== null && registros.length > 0 && (
            <button
              type="button"
              onClick={handleImprimir}
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-5 py-2.5 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-600"
            >
              Imprimir / PDF
            </button>
          )}
        </div>
      </div>

      {registros !== null && (
        <div className="relatorio-impressao rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50 shadow-lg overflow-hidden print:shadow-none print:border print:rounded">
          {/* Cabeçalho do relatório */}
          <header className="bg-slate-800 text-white px-6 py-5 print:bg-slate-800 print:text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold tracking-tight">Gestão Smart 2.0</h1>
                <p className="text-slate-300 text-sm mt-0.5">Relatório de alterações de previsão de entrega</p>
              </div>
              <div className="text-right text-sm text-slate-300">
                Gerado em {formatDateTime(new Date().toISOString())}
              </div>
            </div>
          </header>

          {/* Resumo dos filtros */}
          <div className="px-6 py-3 bg-slate-100 dark:bg-slate-700/50 text-sm text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-600">
            <strong>Filtros aplicados:</strong>
            {dataIni && ` Período a partir de ${formatDate(dataIni)}.`}
            {dataFim && ` Até ${formatDate(dataFim)}.`}
            {cliente && ` Cliente: "${cliente}".`}
            {idPedido && ` Pedido: ${idPedido}.`}
            {!dataIni && !dataFim && !cliente && !idPedido && ' Nenhum filtro (todos os registros).'}
          </div>

          {/* Tabela */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-700 text-white">
                  <th className="text-left py-3 px-4 font-semibold">Data / Hora</th>
                  <th className="text-left py-3 px-4 font-semibold">Pedido</th>
                  <th className="text-left py-3 px-4 font-semibold">Cliente</th>
                  <th className="text-left py-3 px-4 font-semibold">Nova previsão</th>
                  <th className="text-left py-3 px-4 font-semibold">Motivo</th>
                  <th className="text-left py-3 px-4 font-semibold">Observação</th>
                  <th className="text-left py-3 px-4 font-semibold">Usuário</th>
                </tr>
              </thead>
              <tbody>
                {registros.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 px-4 text-center">
                      <MensagemSemRegistrosInline />
                    </td>
                  </tr>
                ) : (
                  registros.map((r, i) => (
                    <tr
                      key={r.id}
                      className={`border-b border-slate-200 dark:border-slate-600 ${
                        i % 2 === 0 ? 'bg-white dark:bg-slate-800/50' : 'bg-slate-50 dark:bg-slate-700/30'
                      }`}
                    >
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                        {formatDateTime(r.data_ajuste)}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-100">
                        {r.id_pedido}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-200">
                        {r.cliente || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                        {formatDate(r.previsao_nova)}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-200">
                        {r.motivo}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-xs truncate" title={r.observacao ?? ''}>
                        {r.observacao || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-200">
                        {r.usuario}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Rodapé do relatório */}
          <footer className="px-6 py-4 bg-slate-100 dark:bg-slate-700/50 border-t border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-400 flex justify-between items-center">
            <span>
              <strong>Total de registros:</strong> {registros.length}
            </span>
            <span>
              Gestão Smart 2.0 — Relatório de alterações — Página impressa em {formatDateTime(new Date().toISOString())}
            </span>
          </footer>
        </div>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .relatorio-impressao,
          .relatorio-impressao * { visibility: visible; }
          .relatorio-impressao {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            box-shadow: none !important;
            border: 1px solid #ccc !important;
          }
          .no-print { display: none !important; }
          /* Evita que uma linha da tabela seja cortada entre páginas */
          .relatorio-impressao tbody tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          /* Repete o cabeçalho da tabela em cada nova página */
          .relatorio-impressao thead {
            display: table-header-group;
          }
        }
      `}</style>
    </div>
  );
}
