import { useAuth } from '../contexts/AuthContext';
import { PERMISSOES } from '../config/permissoes';

/** Modelo para o usuário imprimir/assinar e anexar. */
export const TERMO_RESPONSABILIDADE_PDF_URL =
  '/modelos/Termo_Responsabilidade_Comunicacao.pdf';

/** Fonte editável (Word) — disponível para quem gerencia motivos. */
export const TERMO_RESPONSABILIDADE_DOCX_URL =
  '/modelos/Termo_Responsabilidade_Comunicacao.docx';

type Props = {
  onFileChange: (file: File | null) => void;
  anexoNome?: string | null;
  /** Texto de ajuda abaixo do input (default genérico). */
  ajuda?: string;
  className?: string;
  /** Quando false, exibe o campo como opcional (default: true). */
  obrigatorio?: boolean;
};

/**
 * Campo de anexo do PDF assinado + link para baixar o modelo.
 * O Word fica só para quem pode gerenciar motivos (edição do modelo).
 */
export default function CampoAnexoAssinaturaPdf({
  onFileChange,
  anexoNome,
  ajuda,
  className = '',
  obrigatorio = true,
}: Props) {
  const { hasPermission } = useAuth();
  const podeBaixarWord =
    hasPermission(PERMISSOES.PCP_MOTIVO_CRIAR) ||
    hasPermission(PERMISSOES.PCP_MOTIVO_EDITAR) ||
    hasPermission(PERMISSOES.PCP_MOTIVO_EXCLUIR) ||
    hasPermission(PERMISSOES.PCP_TOTAL);

  return (
    <div className={`space-y-1 ${className}`.trim()}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
          PDF assinado{' '}
          {obrigatorio ? (
            <span className="text-amber-600 dark:text-amber-400">(obrigatório)</span>
          ) : (
            <span className="text-slate-500 dark:text-slate-400">(opcional)</span>
          )}
        </label>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <a
            href={TERMO_RESPONSABILIDADE_PDF_URL}
            download="Termo_Responsabilidade_Comunicacao.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary-600 hover:underline dark:text-primary-400"
          >
            Baixar modelo (PDF)
          </a>
          {podeBaixarWord && (
            <a
              href={TERMO_RESPONSABILIDADE_DOCX_URL}
              download="Termo_Responsabilidade_Comunicacao.docx"
              className="text-slate-500 hover:underline dark:text-slate-400"
              title="Modelo editável para atualizar o termo"
            >
              Word (edição)
            </a>
          )}
        </div>
      </div>
      <input
        type="file"
        accept=".pdf,application/pdf"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          onFileChange(file);
          e.target.value = '';
        }}
        className="block w-full text-xs text-slate-700 dark:text-slate-200 file:mr-3 file:rounded-md file:border-0 file:bg-primary-600 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-primary-700"
      />
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {ajuda ??
          `Baixe o modelo, assine e anexe o PDF${anexoNome ? ` — ${anexoNome}` : ''}.`}
      </p>
    </div>
  );
}
