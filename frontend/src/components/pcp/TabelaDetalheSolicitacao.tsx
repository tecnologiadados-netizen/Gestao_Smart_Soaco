import type { ScDetalhe } from '../../api/consultaEstoque';
import { fmtQtde } from './ModalConsultaEstoqueDetalhe';

type Props = {
  linhas: ScDetalhe[];
};

export default function TabelaDetalheSolicitacao({ linhas }: Props) {
  const visiveis = linhas.filter((s) => s.saldo > 0);
  if (visiveis.length === 0) {
    return <p className="text-slate-500">Sem solicitações abertas.</p>;
  }
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b bg-slate-50 dark:bg-slate-900/50">
          <th className="py-2 text-left">SC</th>
          <th className="py-2 text-left">Usuário</th>
          <th className="py-2 text-left">Emissão</th>
          <th className="py-2 text-left">Necessidade</th>
          <th className="py-2 text-right">Saldo</th>
        </tr>
      </thead>
      <tbody>
        {visiveis.map((s) => (
          <tr key={s.codigo} className="border-b border-slate-100 dark:border-slate-700">
            <td className="py-1.5 font-mono">{s.codigo}</td>
            <td className="py-1.5">{s.usuario}</td>
            <td className="py-1.5">{s.dataEmissao ?? '—'}</td>
            <td className="py-1.5">{s.dataNecessidade ?? '—'}</td>
            <td className="py-1.5 text-right tabular-nums">{fmtQtde(s.saldo)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
