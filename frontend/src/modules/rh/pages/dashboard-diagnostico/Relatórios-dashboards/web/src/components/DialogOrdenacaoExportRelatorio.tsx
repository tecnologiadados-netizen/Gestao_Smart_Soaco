import { ArrowDownWideNarrow, ListOrdered, X } from 'lucide-react'
import type { OrdenacaoExportRelatorio } from '../lib/relatorioOrdenacao'

type Props = {
  titulo: string
  descricao: string
  onEscolher: (ordenacao: OrdenacaoExportRelatorio) => void
  onCancelar: () => void
}

export function DialogOrdenacaoExportRelatorio({ titulo, descricao, onEscolher, onCancelar }: Props) {
  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/45 p-4"
      onClick={onCancelar}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-ordenacao-export-titulo"
        className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="dialog-ordenacao-export-titulo" className="text-lg font-bold text-[#041E42]">
              {titulo}
            </h3>
            <p className="mt-1 text-sm text-brand-gray">{descricao}</p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-black/10 p-1.5 text-brand-gray hover:bg-page"
            onClick={onCancelar}
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            className="flex items-start gap-3 rounded-xl border border-[#041E42]/15 bg-[#F4F6FA] px-4 py-3 text-left transition hover:border-[#1E22AA]/30 hover:bg-[#041E42]/5"
            onClick={() => onEscolher('atual')}
          >
            <ListOrdered className="mt-0.5 h-5 w-5 shrink-0 text-[#1E22AA]" aria-hidden />
            <span>
              <span className="block text-sm font-semibold text-[#041E42]">Ordem atual do painel</span>
              <span className="mt-0.5 block text-xs text-brand-gray">
                Mesma sequência exibida na tabela antes da exportação.
              </span>
            </span>
          </button>
          <button
            type="button"
            className="flex items-start gap-3 rounded-xl border border-[#FFAD00]/40 bg-[#FFAD00]/10 px-4 py-3 text-left transition hover:border-[#FFAD00] hover:bg-[#FFAD00]/20"
            onClick={() => onEscolher('diasDesc')}
          >
            <ArrowDownWideNarrow className="mt-0.5 h-5 w-5 shrink-0 text-[#041E42]" aria-hidden />
            <span>
              <span className="block text-sm font-semibold text-[#041E42]">Por dias perdidos (maior → menor)</span>
              <span className="mt-0.5 block text-xs text-brand-gray">
                Reorganiza os blocos do relatório do maior para o menor total de dias.
              </span>
            </span>
          </button>
        </div>

        <button
          type="button"
          className="mt-4 w-full rounded-xl border border-black/10 bg-page py-2 text-sm font-semibold text-brand-ink hover:bg-white"
          onClick={onCancelar}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
