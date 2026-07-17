import { useEffect, useRef, useState } from "react";
import { fetchCrmPessoas } from "../../../../api/crmFinanceiro";
import { formatCurrency } from "../lib/formatters";
import type { PessoaOption } from "../lib/types";

interface Props {
  pessoaSelecionada: string | null;
  empresaId: number | null;
  onSelect: (pessoa: string | null) => void;
}

export default function FiltroPessoa({
  pessoaSelecionada,
  empresaId,
  onSelect,
}: Props) {
  const [busca, setBusca] = useState("");
  const [opcoes, setOpcoes] = useState<PessoaOption[]>([]);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setCarregando(true);
      try {
        const data = await fetchCrmPessoas({
          q: busca || undefined,
          empresaId,
        });
        setOpcoes(data);
      } catch {
        /* abort ou erro de rede */
      } finally {
        setCarregando(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [busca, empresaId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Filtrar por pessoa / cliente
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={pessoaSelecionada ?? busca}
            onChange={(e) => {
              setBusca(e.target.value);
              if (pessoaSelecionada) onSelect(null);
              setAberto(true);
            }}
            onFocus={() => setAberto(true)}
            placeholder="Digite nome, razão social ou CNPJ/CPF..."
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-blue-900/50"
          />
          {carregando && (
            <span className="absolute right-3 top-3 text-xs text-slate-400">
              ...
            </span>
          )}
          {aberto && !pessoaSelecionada && opcoes.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-900">
              {opcoes.map((opcao) => (
                <li key={opcao.nome}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(opcao.nome);
                      setBusca("");
                      setAberto(false);
                    }}
                    className="flex w-full flex-col px-4 py-2.5 text-left hover:bg-blue-50 dark:hover:bg-slate-800"
                  >
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {opcao.nome}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {opcao.razaoSocial ?? "—"} · Pendente:{" "}
                      {formatCurrency(opcao.totalPendente)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {pessoaSelecionada && (
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              setBusca("");
            }}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Limpar
          </button>
        )}
      </div>
    </div>
  );
}
