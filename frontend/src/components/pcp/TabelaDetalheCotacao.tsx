import type { CotacaoDetalhe } from '../../api/consultaEstoque';
import { fmtQtde } from './ModalConsultaEstoqueDetalhe';

type Props = {
  linhas: CotacaoDetalhe[];
};

export default function TabelaDetalheCotacao({ linhas }: Props) {
  if (linhas.length === 0) {
    return <p className="text-slate-500">Sem cotações nos status 1–3.</p>;
  }
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b bg-slate-50 dark:bg-slate-900/50">
          <th className="py-2 text-left">Cotação</th>
          <th className="py-2 text-left">Emissão</th>
          <th className="py-2 text-left">Comprador</th>
          <th className="py-2 text-left">SC</th>
          <th className="py-2 text-right">Qtde</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((c, i) => (
          <tr key={`${c.cotacao}-${i}`} className="border-b border-slate-100 dark:border-slate-700">
            <td className="py-1.5 font-mono">{c.cotacao}</td>
            <td className="py-1.5">{c.dataEmissao ?? '—'}</td>
            <td className="py-1.5">{c.comprador}</td>
            <td className="py-1.5 font-mono">{c.scCodigos || '—'}</td>
            <td className="py-1.5 text-right tabular-nums">{fmtQtde(c.qtde)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
