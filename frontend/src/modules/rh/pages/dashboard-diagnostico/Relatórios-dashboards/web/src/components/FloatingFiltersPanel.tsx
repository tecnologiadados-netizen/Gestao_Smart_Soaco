import { Check, ChevronDown, Filter, RotateCcw, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { textIncludesSearch } from '../lib/normalizeSearchText'

type Props = {
  from: string
  to: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
  areaOptions: string[]
  setorOptions: string[]
  liderOptions: string[]
  areaFilter: string
  setorFilter: string
  liderFilter: string
  colaboradoresAtivosOptions: { matricula: string; nome: string }[]
  colaboradoresAtivosSelecionados: string[]
  onAreaChange: (v: string) => void
  onSetorChange: (v: string) => void
  onLiderChange: (v: string) => void
  onColaboradoresAtivosSelecionadosChange: (next: string[]) => void
  onClearFilters: () => void
}

function SelectInline({
  id,
  label,
  placeholderTodas,
  options,
  value,
  onChange,
}: {
  id: string
  label: string
  placeholderTodas: string
  options: string[]
  value: string
  onChange: (v: string) => void
}) {
  if (!options.length) {
    return (
      <div className="min-w-[8rem]">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-brand-gray">{label}</span>
        <p className="text-xs text-brand-gray">—</p>
      </div>
    )
  }
  return (
    <div className="min-w-0 flex-1 basis-[10.5rem] sm:basis-[12rem]">
      <label htmlFor={id} className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-brand-gray">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-w-0 cursor-pointer appearance-none rounded-lg border border-black/10 bg-page py-2 pl-2.5 pr-8 text-sm font-medium text-brand-ink outline-none transition hover:border-black/15 focus:border-brand-blue/40 focus:ring-2 focus:ring-brand-blue/20"
        >
          <option value="">{placeholderTodas}</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-gray"
          aria-hidden
        />
      </div>
    </div>
  )
}

export function FloatingFiltersPanel(props: Props) {
  const {
    from,
    to,
    onFromChange,
    onToChange,
    areaOptions,
    setorOptions,
    liderOptions,
    areaFilter,
    setorFilter,
    liderFilter,
    colaboradoresAtivosOptions,
    colaboradoresAtivosSelecionados,
    onAreaChange,
    onSetorChange,
    onLiderChange,
    onColaboradoresAtivosSelecionadosChange,
    onClearFilters,
  } = props
  const [openColaboradorPicker, setOpenColaboradorPicker] = useState(false)
  const [buscaColaborador, setBuscaColaborador] = useState('')
  const colaboradoresFiltrados = useMemo(() => {
    if (!buscaColaborador.trim()) return colaboradoresAtivosOptions
    return colaboradoresAtivosOptions.filter(
      (c) => textIncludesSearch(c.nome, buscaColaborador) || textIncludesSearch(c.matricula, buscaColaborador),
    )
  }, [buscaColaborador, colaboradoresAtivosOptions])

  return (
    <section
      aria-label="Filtros do painel"
      className="w-full shrink-0 border-b border-black/8 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
    >
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 px-6 py-3 sm:gap-x-5 sm:px-8 sm:py-4 lg:px-10">
        <div className="flex shrink-0 items-center gap-2 text-navy">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy/8">
            <Filter className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
          <span className="text-sm font-bold">Filtros</span>
        </div>

        <div className="flex min-w-0 flex-wrap items-end gap-3 sm:gap-4">
          <div className="w-[9.5rem] shrink-0 sm:w-[10.5rem]">
            <label htmlFor="filtro-de" className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-brand-gray">
              De
            </label>
            <input
              id="filtro-de"
              type="date"
              value={from}
              onChange={(e) => onFromChange(e.target.value)}
              className="w-full rounded-lg border border-black/10 bg-page px-2 py-2 text-sm text-brand-ink outline-none ring-navy/20 focus:ring-2"
            />
          </div>
          <div className="w-[9.5rem] shrink-0 sm:w-[10.5rem]">
            <label htmlFor="filtro-ate" className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-brand-gray">
              Até
            </label>
            <input
              id="filtro-ate"
              type="date"
              value={to}
              onChange={(e) => onToChange(e.target.value)}
              className="w-full rounded-lg border border-black/10 bg-page px-2 py-2 text-sm text-brand-ink outline-none ring-navy/20 focus:ring-2"
            />
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3 sm:min-w-[60%] sm:gap-4 lg:gap-5">
          <SelectInline
            id="filtro-area"
            label="Área"
            placeholderTodas="Todas as áreas"
            options={areaOptions}
            value={areaFilter}
            onChange={onAreaChange}
          />
          <SelectInline
            id="filtro-setor"
            label="Setor"
            placeholderTodas="Todos os setores"
            options={setorOptions}
            value={setorFilter}
            onChange={onSetorChange}
          />
          <SelectInline
            id="filtro-lider"
            label="Líder"
            placeholderTodas="Todos os líderes"
            options={liderOptions}
            value={liderFilter}
            onChange={onLiderChange}
          />
          <div className="relative min-w-0 flex-1 basis-[18rem]">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-brand-gray">
              Colaboradores ativos
            </label>
            <button
              type="button"
              onClick={() => setOpenColaboradorPicker((v) => !v)}
              className="inline-flex w-full items-center justify-between gap-2 rounded-lg border border-black/10 bg-page px-2.5 py-2 text-left text-sm font-medium text-brand-ink outline-none transition hover:border-black/15 focus:border-brand-blue/40 focus:ring-2 focus:ring-brand-blue/20"
            >
              <span className="truncate">
                {colaboradoresAtivosSelecionados.length > 0
                  ? `${colaboradoresAtivosSelecionados.length} selecionado(s)`
                  : 'Todos os colaboradores ativos'}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-brand-gray" aria-hidden />
            </button>
            {openColaboradorPicker ? (
              <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[60] max-h-[340px] overflow-hidden rounded-xl border border-black/10 bg-white p-3 shadow-lg ring-1 ring-black/5">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-gray" aria-hidden />
                  <input
                    value={buscaColaborador}
                    onChange={(e) => setBuscaColaborador(e.target.value)}
                    className="w-full rounded-lg border border-black/10 bg-page py-2 pl-9 pr-8 text-sm text-brand-ink outline-none ring-navy placeholder:text-brand-gray/80 focus:border-navy/20 focus:ring-2"
                    placeholder="Pesquisar por nome ou matrícula..."
                  />
                  {buscaColaborador ? (
                    <button
                      type="button"
                      onClick={() => setBuscaColaborador('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-brand-gray hover:bg-black/5 hover:text-brand-ink"
                      aria-label="Limpar busca de colaborador"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  ) : null}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onColaboradoresAtivosSelecionadosChange([])}
                    className="text-xs font-semibold text-brand-blue hover:underline"
                  >
                    Limpar seleção
                  </button>
                </div>
                <ul className="mt-2 max-h-[230px] overflow-y-auto rounded-lg border border-black/5 bg-page/40 p-1">
                  {colaboradoresFiltrados.length === 0 ? (
                    <li className="px-2 py-2 text-xs text-brand-gray">Nenhum colaborador encontrado.</li>
                  ) : (
                    colaboradoresFiltrados.map((c) => {
                      const checked = colaboradoresAtivosSelecionados.includes(c.matricula)
                      return (
                        <li key={`${c.matricula}-${c.nome}`}>
                          <button
                            type="button"
                            onClick={() => {
                              if (checked) {
                                onColaboradoresAtivosSelecionadosChange(
                                  colaboradoresAtivosSelecionados.filter((m) => m !== c.matricula),
                                )
                              } else {
                                onColaboradoresAtivosSelecionadosChange([
                                  ...colaboradoresAtivosSelecionados,
                                  c.matricula,
                                ])
                              }
                            }}
                            className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition ${
                              checked ? 'bg-brand-blue/10 text-brand-ink' : 'hover:bg-black/[0.03] text-brand-ink'
                            }`}
                          >
                            <span className={`inline-flex h-4 w-4 items-center justify-center rounded border ${checked ? 'border-brand-blue bg-brand-blue text-white' : 'border-black/20 bg-white text-transparent'}`}>
                              <Check className="h-3 w-3" aria-hidden />
                            </span>
                            <span className="truncate">{c.nome}</span>
                            <span className="ml-auto shrink-0 text-xs text-brand-gray">{c.matricula}</span>
                          </button>
                        </li>
                      )
                    })
                  )}
                </ul>
              </div>
            ) : null}
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-end pb-0.5">
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-page px-3 py-2 text-xs font-semibold text-brand-ink transition hover:bg-white"
          >
            <RotateCcw className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Limpar dimensões
          </button>
        </div>
      </div>
    </section>
  )
}
