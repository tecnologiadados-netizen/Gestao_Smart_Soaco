import { useState } from 'react';
import type { FiltrosPedidos, FiltrosOpcoes } from '../api/pedidos';
import MultiSelectFiltro from './MultiSelectFiltro';

interface HeatmapFiltrosProps {
  filtros: FiltrosPedidos;
  opcoes: FiltrosOpcoes | null;
  onChange: (f: FiltrosPedidos) => void;
  open: boolean;
}

const inputClass =
  'rounded border border-slate-300 bg-white text-slate-900 placeholder-slate-500 px-2.5 py-1.5 text-sm min-w-0 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400';

const labelClass = 'text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap';

const OPCOES_SIM_NAO = ['Sim', 'Não'];

function parseMulti(value: string | undefined): string[] {
  return (value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}

function joinMulti(arr: string[]): string | undefined {
  return arr.length ? arr.join(',') : undefined;
}

export default function HeatmapFiltros({ filtros, opcoes, onChange, open }: HeatmapFiltrosProps) {
  const [descInput, setDescInput] = useState('');

  const update = (key: keyof FiltrosPedidos, value: string | undefined) => {
    onChange({ ...filtros, [key]: value === '' ? undefined : value });
  };

  const observacoes = parseMulti(filtros.observacoes);
  const uf = parseMulti(filtros.uf);
  const formaPagamento = parseMulti(filtros.forma_pagamento);
  const municipioEntrega = parseMulti(filtros.municipio_entrega);
  const grupoProduto = parseMulti(filtros.grupo_produto);
  const pd = parseMulti(filtros.pd);
  const descricaoProduto = parseMulti(filtros.descricao_produto);
  const aVista = parseMulti(filtros.a_vista);
  const requisicaoLoja = parseMulti(filtros.requisicao_loja);

  const addMulti = (key: keyof FiltrosPedidos, current: string[], value: string) => {
    const v = value.trim();
    if (!v || current.map((x) => x.toLowerCase()).includes(v.toLowerCase())) return;
    update(key, joinMulti([...current, v]));
  };

  const removeMulti = (key: keyof FiltrosPedidos, current: string[], value: string) => {
    update(key, joinMulti(current.filter((x) => x !== value)));
  };

  const handleDescKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (descInput.trim()) {
        addMulti('descricao_produto', descricaoProduto, descInput.trim());
        setDescInput('');
      }
    }
  };

  if (!open) return null;

  return (
    <div className="rounded-xl bg-slate-100 border border-slate-200 shadow dark:bg-slate-800 dark:border-slate-700">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 px-4 py-3">
        <MultiSelectFiltro
          label="Observações"
          selected={observacoes}
          options={opcoes?.rotas ?? []}
          onAdd={(v) => addMulti('observacoes', observacoes, v)}
          onRemove={(v) => removeMulti('observacoes', observacoes, v)}
          placeholder="Selecione observações"
          minWidth="140px"
        />
        <MultiSelectFiltro
          label="UF"
          selected={uf}
          options={opcoes?.ufs ?? []}
          onAdd={(v) => addMulti('uf', uf, v)}
          onRemove={(v) => removeMulti('uf', uf, v)}
          placeholder="Selecione UF"
          minWidth="100px"
        />
        <MultiSelectFiltro
          label="Forma de Pagamento"
          selected={formaPagamento}
          options={opcoes?.formasPagamento ?? []}
          onAdd={(v) => addMulti('forma_pagamento', formaPagamento, v)}
          onRemove={(v) => removeMulti('forma_pagamento', formaPagamento, v)}
          placeholder="Selecione forma"
          minWidth="140px"
        />
        <MultiSelectFiltro
          label="Município de entrega"
          selected={municipioEntrega}
          options={opcoes?.municipios ?? []}
          onAdd={(v) => addMulti('municipio_entrega', municipioEntrega, v)}
          onRemove={(v) => removeMulti('municipio_entrega', municipioEntrega, v)}
          placeholder="Selecione município"
          minWidth="140px"
        />
        {/* Descrição do produto: múltiplos termos livres (chips + input, add com Enter ou vírgula) */}
        <div className="flex flex-wrap items-center gap-2">
          <label className={labelClass}>Descrição do produto</label>
          <div className="relative flex flex-wrap items-center gap-1.5 min-w-[160px] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500">
            {descricaoProduto.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1 rounded bg-primary-100 dark:bg-primary-900/40 text-primary-800 dark:text-primary-200 px-2 py-0.5 text-xs font-medium"
              >
                {item}
                <button
                  type="button"
                  onClick={() => removeMulti('descricao_produto', descricaoProduto, item)}
                  className="rounded hover:bg-primary-200 dark:hover:bg-primary-800 p-0.5"
                  aria-label={`Remover ${item}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </span>
            ))}
            <input
              type="text"
              className="flex-1 min-w-[80px] bg-transparent border-0 py-0.5 px-0 text-sm text-slate-900 dark:text-slate-200 placeholder-slate-500 dark:placeholder-slate-400 focus:ring-0 focus:outline-none"
              placeholder={descricaoProduto.length ? 'Adicionar termo…' : 'Digite e pressione Enter'}
              value={descInput}
              onChange={(e) => setDescInput(e.target.value)}
              onKeyDown={handleDescKeyDown}
              autoComplete="off"
            />
          </div>
        </div>
        <MultiSelectFiltro
          label="Grupo de produto"
          selected={grupoProduto}
          options={opcoes?.gruposProduto ?? []}
          onAdd={(v) => addMulti('grupo_produto', grupoProduto, v)}
          onRemove={(v) => removeMulti('grupo_produto', grupoProduto, v)}
          placeholder="Selecione grupo"
          minWidth="120px"
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className={labelClass}>Período</label>
          <input type="date" className={inputClass} value={filtros.data_ini ?? ''} onChange={(e) => update('data_ini', e.target.value)} />
          <span className="text-slate-500 dark:text-slate-400 text-sm">até</span>
          <input type="date" className={inputClass} value={filtros.data_fim ?? ''} onChange={(e) => update('data_fim', e.target.value)} />
        </div>
        <MultiSelectFiltro
          label="PD"
          selected={pd}
          options={opcoes?.pds ?? []}
          onAdd={(v) => addMulti('pd', pd, v)}
          onRemove={(v) => removeMulti('pd', pd, v)}
          placeholder="Digite ou selecione"
          minWidth="160px"
        />
        <MultiSelectFiltro
          label="A Vista?"
          selected={aVista}
          options={OPCOES_SIM_NAO}
          onAdd={(v) => addMulti('a_vista', aVista, v)}
          onRemove={(v) => removeMulti('a_vista', aVista, v)}
          placeholder="Sim / Não"
          minWidth="90px"
        />
        <MultiSelectFiltro
          label="Req. loja grupo?"
          selected={requisicaoLoja}
          options={OPCOES_SIM_NAO}
          onAdd={(v) => addMulti('requisicao_loja', requisicaoLoja, v)}
          onRemove={(v) => removeMulti('requisicao_loja', requisicaoLoja, v)}
          placeholder="Sim / Não"
          minWidth="90px"
        />
      </div>
    </div>
  );
}
