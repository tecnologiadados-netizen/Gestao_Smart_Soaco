import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

export type ResizableModalSize = {
  width: number;
  height: number;
};

type Props = {
  onClose: () => void;
  children: ReactNode;
  title?: string;
  subtitle?: string;
  footer?: ReactNode;
  /** Largura inicial em px */
  defaultWidth?: number;
  /** Altura inicial em px */
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  zIndexClass?: string;
  ariaLabelledBy?: string;
};

const MIN_W = 320;
const MIN_H = 200;

export default function ResizableModalShell({
  onClose,
  children,
  title,
  subtitle,
  footer,
  defaultWidth = 520,
  defaultHeight = 420,
  minWidth = MIN_W,
  minHeight = MIN_H,
  maxWidth,
  maxHeight,
  zIndexClass = 'z-[70]',
  ariaLabelledBy,
}: Props) {
  const titleId = ariaLabelledBy ?? (title ? 'resizable-modal-title' : undefined);
  const [size, setSize] = useState<ResizableModalSize>({
    width: defaultWidth,
    height: defaultHeight,
  });
  const resizeRef = useRef<{
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);

  const clampSize = useCallback(
    (w: number, h: number): ResizableModalSize => {
      const maxW = maxWidth ?? Math.min(window.innerWidth * 0.95, 1400);
      const maxH = maxHeight ?? Math.min(window.innerHeight * 0.92, 900);
      return {
        width: Math.min(maxW, Math.max(minWidth, w)),
        height: Math.min(maxH, Math.max(minHeight, h)),
      };
    },
    [minWidth, minHeight, maxWidth, maxHeight]
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const r = resizeRef.current;
      if (!r) return;
      const dw = e.clientX - r.startX;
      const dh = e.clientY - r.startY;
      setSize(clampSize(r.startW + dw, r.startH + dh));
    };
    const onUp = () => {
      resizeRef.current = null;
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [clampSize]);

  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: size.width,
      startH: size.height,
    };
  };

  return (
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-center justify-center bg-black/70 p-4`}
      role="presentation"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col rounded-xl border border-soaco-gray/30 bg-white shadow-soaco-lg dark:border-accent-500/20 dark:bg-soaco-graphite"
        style={{ width: size.width, height: size.height }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || subtitle) && (
          <div className="shrink-0 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
            <div className="flex items-start justify-between gap-2 pr-4">
              <div className="min-w-0">
                {title ? (
                  <h3
                    id={titleId}
                    className="text-sm font-semibold text-slate-800 dark:text-slate-100"
                  >
                    {title}
                  </h3>
                ) : null}
                {subtitle ? (
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                    {subtitle}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="absolute right-3 top-3 shrink-0 rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">{children}</div>
        {footer ? (
          <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-600">
            {footer}
          </div>
        ) : null}
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Redimensionar modal"
          className="absolute bottom-0 right-0 z-10 h-4 w-4 cursor-se-resize"
          onMouseDown={onResizeStart}
        >
          <svg
            className="h-full w-full text-slate-400 dark:text-slate-500"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden
          >
            <path d="M14 14L8 14L14 8Z" />
          </svg>
        </div>
      </div>
    </div>
  );
}
