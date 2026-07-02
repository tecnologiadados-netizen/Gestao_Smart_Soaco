/** Carrega uma imagem pública como data URL (ex.: logo para jsPDF). */
export async function imageUrlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('Falha ao converter imagem'));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao carregar imagem'));
    img.src = src;
  });
}

/**
 * Remove pixels claros (fundo branco da arte) para exibir sobre fundo escuro.
 * Mantém cores da marca; pixels quase brancos ficam transparentes.
 */
export async function imageUrlWithoutWhiteBackground(
  url: string,
  threshold = 238
): Promise<string | null> {
  try {
    const dataUrl = await imageUrlToDataUrl(url);
    if (!dataUrl) return null;
    const img = await loadImageElement(dataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = imageData;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const maxCh = Math.max(r, g, b);
      const minCh = Math.min(r, g, b);
      const sat = maxCh === 0 ? 0 : (maxCh - minCh) / maxCh;
      if (lum >= threshold && sat < 0.12) {
        data[i + 3] = 0;
      }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

function pixelMetrics(r: number, g: number, b: number): { lum: number; sat: number; spread: number } {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const maxCh = Math.max(r, g, b);
  const minCh = Math.min(r, g, b);
  const sat = maxCh === 0 ? 0 : (maxCh - minCh) / maxCh;
  return { lum, sat, spread: maxCh - minCh };
}

function isBrandYellow(r: number, g: number, b: number): boolean {
  return r > 130 && g > 70 && b < 150 && r - b > 55 && g - b > 25;
}

function isBrandWhite(r: number, g: number, b: number, lum: number, spread: number): boolean {
  return lum > 155 && spread < 35;
}

function alphaForLogoPixel(r: number, g: number, b: number): number {
  const { lum, sat, spread } = pixelMetrics(r, g, b);
  if (isBrandYellow(r, g, b) || isBrandWhite(r, g, b, lum, spread)) return 255;
  if (lum < 72 && spread < 55) return 0;
  if (r > b && r > g && lum < 125 && !isBrandYellow(r, g, b)) return 0;
  if (lum < 112 && sat < 0.38) return 0;
  if (lum > 48 && lum < 225 && sat < 0.18) return 0;
  if (lum < 135 && sat < 0.24) {
    const fade = Math.max(0, Math.min(1, (lum - 72) / 68));
    return Math.round(255 * fade);
  }
  return 255;
}

function smoothAlphaChannel(data: Uint8ClampedArray, width: number, height: number): void {
  const alpha = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) alpha[p] = data[i + 3] ?? 0;
  const out = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        out[p] = alpha[p]!;
        continue;
      }
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          sum += alpha[(y + dy) * width + (x + dx)]!;
        }
      }
      out[p] = Math.round(sum / 9);
    }
  }
  for (let i = 0, p = 0; i < data.length; i += 4, p++) data[i + 3] = out[p]!;
}

/**
 * Prepara logomarca do manual: remove fundo, halos e contorno preto pixelado do "SÓ".
 */
export async function prepareLogoSoAcoManual(url: string): Promise<string | null> {
  try {
    const dataUrl = await imageUrlToDataUrl(url);
    if (!dataUrl) return null;
    const img = await loadImageElement(dataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width, height } = imageData;
    for (let i = 0; i < data.length; i += 4) {
      const a = alphaForLogoPixel(data[i]!, data[i + 1]!, data[i + 2]!);
      data[i + 3] = a;
    }
    smoothAlphaChannel(data, width, height);
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

/** @deprecated Use prepareLogoSoAcoManual */
export async function imageUrlWithoutDarkBackground(url: string): Promise<string | null> {
  return prepareLogoSoAcoManual(url);
}

/** Arte raster original do manual. */
export const LOGO_SOACO_MANUAL_URL = '/logo-soaco-manual.png';

/** Versão limpa (fundo transparente, sem microcortes) — gerada por scripts/prepare-logo-soaco.ps1 */
export const LOGO_SOACO_CLEAN_URL = '/logo-soaco-clean.png';

const LOGO_CACHE_KEY = 'soaco_logo_transparent_v3';

/** Logomarca para exibição: prioriza PNG limpo pré-processado. */
export async function getLogoSoAcoTransparentSrc(): Promise<string> {
  try {
    const head = await fetch(LOGO_SOACO_CLEAN_URL, { method: 'HEAD', cache: 'no-store' });
    if (head.ok) return LOGO_SOACO_CLEAN_URL;
  } catch {
    /* fallback abaixo */
  }
  try {
    const cached = sessionStorage.getItem(LOGO_CACHE_KEY);
    if (cached) return cached;
  } catch {
    /* ignore */
  }
  const processed = await prepareLogoSoAcoManual(LOGO_SOACO_MANUAL_URL);
  const src = processed ?? LOGO_SOACO_MANUAL_URL;
  try {
    if (processed) sessionStorage.setItem(LOGO_CACHE_KEY, processed);
  } catch {
    /* ignore */
  }
  return src;
}
