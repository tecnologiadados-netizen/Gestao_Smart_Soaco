const TITLE = 'Sem data de produção — posicionado pela previsão atual';

export default function IndicadorDataPorPrevisao({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center leading-none ${className}`}
      title={TITLE}
      aria-label={TITLE}
      role="img"
    >
      ⚠️
    </span>
  );
}
