import { useEffect, useState } from 'react';
import { getLogoSoAcoTransparentSrc, LOGO_SOACO_CLEAN_URL } from '../utils/imageDataUrl';

type LogoSoAcoProps = {
  className?: string;
  alt?: string;
};

/**
 * Logomarca oficial do manual (Só Aço + tagline), com fundo normalizado
 * para fundo preto — remove caixa cinza e microcortes da arte exportada.
 */
export default function LogoSoAco({ className = '', alt = 'Só Aço — Produzindo com excelência' }: LogoSoAcoProps) {
  const [src, setSrc] = useState(LOGO_SOACO_CLEAN_URL);

  useEffect(() => {
    let cancelled = false;
    void getLogoSoAcoTransparentSrc().then((processed) => {
      if (!cancelled) setSrc(processed);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <img
      src={src}
      alt={alt}
      className={`block border-0 outline-none bg-transparent object-contain ${className}`.trim()}
      style={{ border: 'none', outline: 'none', boxShadow: 'none' }}
      draggable={false}
      decoding="async"
    />
  );
}
