import {
  CLASSE_BADGE_VALOR_SECAO_CRM,
  formatValorSecaoIndicador,
} from "../lib/tituloSecaoIndicador";

interface Props {
  titulo: string;
  valorSecao?: number;
  subtitulo?: string;
  className?: string;
}

export default function CabecalhoSecaoCrm({
  titulo,
  valorSecao,
  subtitulo,
  className,
}: Props) {
  const exibirValor =
    valorSecao !== undefined && Number.isFinite(valorSecao);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-white">{titulo}</h3>
        {exibirValor && (
          <span className={CLASSE_BADGE_VALOR_SECAO_CRM}>
            {formatValorSecaoIndicador(valorSecao)}
          </span>
        )}
      </div>
      {subtitulo && (
        <p className="mt-0.5 text-xs text-white/80">{subtitulo}</p>
      )}
    </div>
  );
}
