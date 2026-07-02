import type { ReactNode } from 'react';

type ModalAbaBackdropProps = {
  onClose: () => void;
  children: ReactNode;
  /** z-index Tailwind (padrão acima da grade, abaixo do menu global). */
  zIndexClass?: string;
  className?: string;
};

/**
 * Backdrop de modal limitado à aba atual (`absolute` no pai `relative`).
 * Não bloqueia menu superior nem outras abas — ao contrário de `fixed inset-0` no body.
 */
export default function ModalAbaBackdrop({
  onClose,
  children,
  zIndexClass = 'z-[14000]',
  className = '',
}: ModalAbaBackdropProps) {
  return (
    <div
      className={`absolute inset-0 ${zIndexClass} flex items-center justify-center bg-black/70 p-4 ${className}`.trim()}
      role="presentation"
      onClick={onClose}
    >
      {children}
    </div>
  );
}
