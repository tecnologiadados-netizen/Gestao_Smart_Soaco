import { EMPRESAS_PAINEL, getEmpresaPainelNome } from "../lib/empresaConfig";

interface Props {
  empresaSelecionada: number | null;
  onSelect: (empresaId: number | null, nome: string | null) => void;
}

export default function FiltroEmpresa({ empresaSelecionada, onSelect }: Props) {
  return (
    <div className="w-full max-w-xl">
      <label
        htmlFor="filtro-empresa"
        className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
      >
        Filtrar por empresa
      </label>
      <select
        id="filtro-empresa"
        value={empresaSelecionada ?? ""}
        onChange={(e) => {
          const value = e.target.value;
          if (!value) {
            onSelect(null, null);
            return;
          }
          const id = Number.parseInt(value, 10);
          onSelect(id, getEmpresaPainelNome(id));
        }}
        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm uppercase shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      >
        <option value="">TODOS</option>
        {EMPRESAS_PAINEL.map((empresa) => (
          <option key={empresa.id} value={empresa.id} className="uppercase">
            {empresa.nome}
          </option>
        ))}
      </select>
    </div>
  );
}
