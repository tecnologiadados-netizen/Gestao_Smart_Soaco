import { useCallback, useEffect, useRef } from 'react';
import type { SupportAttachmentInput } from '../../api/suporte';

const MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export async function fileToSupportAttachment(file: File): Promise<SupportAttachmentInput> {
  if (file.size > MAX_BYTES) throw new Error(`Arquivo ${file.name} excede 5MB.`);
  const allowed =
    IMAGE_TYPES.has(file.type) ||
    file.type === 'application/pdf' ||
    file.type === 'text/plain' ||
    file.type.includes('spreadsheet') ||
    file.type.includes('word') ||
    file.type === 'application/vnd.ms-excel' ||
    file.type === 'application/msword';
  if (!allowed) throw new Error(`Tipo não permitido: ${file.name}`);
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(new Error(`Falha ao ler ${file.name}.`));
    reader.readAsDataURL(file);
  });
  return {
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    contentBase64: base64,
    sizeBytes: file.size,
  };
}

function mergeFiles(prev: File[], incoming: File[]): File[] {
  const map = new Map<string, File>();
  for (const f of prev) map.set(`${f.name}-${f.size}-${f.lastModified}`, f);
  for (const f of incoming) map.set(`${f.name}-${f.size}-${f.lastModified}`, f);
  return [...map.values()];
}

type Props = {
  files: File[];
  onChange: (files: File[]) => void;
  label?: string;
  hint?: string;
  className?: string;
  /** Abre overlay de imagem ao clicar na miniatura. */
  onPreviewImage?: (url: string, title: string) => void;
};

/** Anexos com upload e colar imagem (Ctrl+V). */
export function SuporteAnexosComPaste({
  files,
  onChange,
  label = 'Anexos',
  hint,
  className = '',
  onPreviewImage,
}: Props) {
  const zoneRef = useRef<HTMLDivElement>(null);

  const addFiles = useCallback(
    (incoming: File[]) => {
      if (incoming.length === 0) return;
      onChange(mergeFiles(files, incoming));
    },
    [files, onChange]
  );

  const onPaste = useCallback(
    (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items?.length) return;
      const pasted: File[] = [];
      for (const item of items) {
        if (item.kind !== 'file') continue;
        const file = item.getAsFile();
        if (!file) continue;
        if (!file.type.startsWith('image/') && !IMAGE_TYPES.has(file.type)) continue;
        const name =
          file.name && file.name !== 'image.png'
            ? file.name
            : `print-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
        pasted.push(new File([file], name, { type: file.type || 'image/png' }));
      }
      if (pasted.length === 0) return;
      e.preventDefault();
      addFiles(pasted);
    },
    [addFiles]
  );

  useEffect(() => {
    const el = zoneRef.current;
    if (!el) return;
    el.addEventListener('paste', onPaste);
    return () => el.removeEventListener('paste', onPaste);
  }, [onPaste]);

  return (
    <div ref={zoneRef} className={className} tabIndex={0}>
      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</label>
      {hint && <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{hint}</p>}
      <input
        type="file"
        multiple
        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,text/plain"
        onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
        className="text-sm w-full"
      />
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
        Dica: clique aqui e use <kbd className="px-1 rounded bg-slate-200 dark:bg-slate-600">Ctrl+V</kbd> para colar um
        print da tela.
      </p>
      {files.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {files.map((f) => {
            const isImg = f.type.startsWith('image/');
            const url = isImg ? URL.createObjectURL(f) : null;
            return (
              <li
                key={`${f.name}-${f.size}-${f.lastModified}`}
                className="relative rounded border border-slate-200 dark:border-slate-600 overflow-hidden"
              >
                {url ? (
                  <button
                    type="button"
                    className="block cursor-zoom-in"
                    title="Ver imagem"
                    onClick={() => onPreviewImage?.(url, f.name)}
                  >
                    <img src={url} alt={f.name} className="h-16 w-16 object-cover" />
                  </button>
                ) : (
                  <span className="block px-2 py-1 text-xs max-w-[8rem] truncate">{f.name}</span>
                )}
                <button
                  type="button"
                  className="absolute top-0 right-0 bg-black/75 text-white text-[10px] px-1"
                  onClick={() => onChange(files.filter((x) => x !== f))}
                  aria-label="Remover"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
