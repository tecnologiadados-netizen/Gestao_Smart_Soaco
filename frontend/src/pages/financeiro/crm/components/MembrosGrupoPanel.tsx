import { formatCurrency } from "../lib/formatters";
import type { GrupoFiltradoInfo } from "../lib/types";

interface Props {
  grupo: GrupoFiltradoInfo;
  onSelecionarPessoa: (nome: string) => void;
}

export default function MembrosGrupoPanel({ grupo, onSelecionarPessoa }: Props) {
  if (grupo.membros.length === 0) return null;

  const totalPendente = grupo.membros.reduce((acc, m) => acc + m.totalPendente, 0);

  return (
    <section className="w-full min-w-0 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 shadow-sm dark:border-indigo-900 dark:bg-indigo-950/30">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
            Empresas do grupo
          </h3>
          <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80">
            Visão consolidada de <span className="font-medium">{grupo.nome}</span>
            {" · "}
            {grupo.membros.length} empresa(s) · Pendente total:{" "}
            {formatCurrency(totalPendente)}
          </p>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-indigo-200 bg-white dark:border-indigo-900 dark:bg-slate-900">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-indigo-100 text-xs uppercase tracking-wide text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
            <tr>
              <th className="px-3 py-2 font-semibold">Pessoa</th>
              <th className="px-3 py-2 font-semibold">Razão social</th>
              <th className="px-3 py-2 font-semibold">CNPJ/CPF</th>
              <th className="px-3 py-2 text-right font-semibold">Pendente</th>
            </tr>
          </thead>
          <tbody>
            {grupo.membros.map((m) => (
              <tr
                key={m.nome}
                className="border-t border-indigo-100 dark:border-indigo-900/50"
              >
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => onSelecionarPessoa(m.nome)}
                    className="font-medium text-indigo-700 underline-offset-2 hover:underline dark:text-indigo-300"
                    title="Analisar só esta empresa"
                  >
                    {m.nome}
                  </button>
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                  {m.razaoSocial ?? "—"}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                  {m.cnpjCpf ?? "—"}
                </td>
                <td className="px-3 py-2 text-right font-medium text-slate-800 dark:text-slate-100">
                  {formatCurrency(m.totalPendente)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-indigo-700/70 dark:text-indigo-300/70">
        Clique em uma pessoa para abrir a análise individual. Nas tabelas abaixo,
        cada título continua identificando a pessoa.
      </p>
    </section>
  );
}
