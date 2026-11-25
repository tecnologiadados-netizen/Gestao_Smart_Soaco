import type { PreEntradaDetalhe } from '../../api/consultaEstoque';
import { fmtQtde } from './ModalConsultaEstoqueDetalhe';

type Props = {
  linhas: PreEntradaDetalhe[];
  qtdeGrade: number;
};

function celula(v: string | null | undefined): string {
  return v?.trim() || '—';
}

export default function TabelaDetalhePreEntrada({ linhas, qtdeGrade }: Props) {
  if (linhas.length === 0) {
    return <p className="text-slate-500">Sem documentos de pré-entrada para este produto.</p>;
  }

  const total = linhas.reduce((soma, linha) => soma + linha.qtde, 0);

  return (
    <div className="overflow-auto">
      <table className="w-full min-w-[880px] text-xs">
        <thead>
          <tr className="border-b bg-slate-50 dark:bg-slate-900/50">
            <th className="px-2 py-2 text-left">Solicitação</th>
            <th className="px-2 py-2 text-left">Pedido vinculado</th>
            <th className="px-2 py-2 text-left">Documento</th>
            <th className="px-2 py-2 text-left">NF</th>
            <th className="px-2 py-2 text-left">Fornecedor</th>
            <th className="px-2 py-2 text-left">Emissão</th>
            <th className="px-2 py-2 text-left">Situação</th>
            <th className="px-2 py-2 text-right">Quantidade</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => (
            <tr key={linha.idItem} className="border-b border-slate-100 dark:border-slate-700">
              <td className="px-2 py-2">{celula(linha.solicitacoes)}</td>
              <td className="px-2 py-2 font-medium text-slate-800 dark:text-slate-100">
                {celula(linha.pedidos)}
              </td>
              <td className="px-2 py-2 font-medium text-slate-800 dark:text-slate-100">
                {celula(linha.numeroDocumento)}
              </td>
              <td className="px-2 py-2">{celula(linha.numeroNfe)}</td>
              <td className="px-2 py-2">{celula(linha.fornecedor)}</td>
              <td className="px-2 py-2">{celula(linha.dataEmissao)}</td>
              <td className="px-2 py-2">{linha.situacao}</td>
              <td className="px-2 py-2 text-right tabular-nums">{fmtQtde(linha.qtde)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200 bg-slate-50 font-semibold dark:border-slate-600 dark:bg-slate-900">
            <td className="px-2 py-2" colSpan={7}>Total do detalhe</td>
            <td className="px-2 py-2 text-right tabular-nums">{fmtQtde(total)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="mt-2 text-xs text-slate-500">
        Quantidade na grade: {fmtQtde(qtdeGrade)}. A soma do detalhe usa a mesma regra.
      </p>
    </div>
  );
}
