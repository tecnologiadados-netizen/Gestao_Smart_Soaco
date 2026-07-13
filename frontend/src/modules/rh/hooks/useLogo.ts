import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getConfig, setConfig, isApiConfigured } from "@rh/lib/api-client";
import { LOGO_KEY } from "@rh/lib/config";

const LOGO_QUERY_KEY = ["config", "logo"] as const;
const DEFAULT_FAVICON_HREF = "/favicon.svg";

/** Retorna a logo do localStorage (quando API não configurada). */
function getLogoFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LOGO_KEY);
}

/** Busca a logo: API quando configurada, senão localStorage. */
async function fetchLogo(): Promise<string | null> {
  if (isApiConfigured()) {
    try {
      const { value } = await getConfig("logo");
      return value ?? null;
    } catch {
      return getLogoFromStorage();
    }
  }
  return getLogoFromStorage();
}

function applyFaviconHref(href: string): void {
  if (typeof document === "undefined") return;
  const links = Array.from(document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']"));
  if (links.length === 0) {
    const link = document.createElement("link");
    link.rel = "icon";
    link.href = href;
    document.head.appendChild(link);
    return;
  }
  for (const link of links) {
    link.href = href;
  }
}

function buildSquareFaviconDataUrl(source: string, size = 64): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas 2D indisponível"));
        return;
      }

      ctx.clearRect(0, 0, size, size);
      const padding = Math.round(size * 0.1);
      const avail = size - padding * 2;
      const scale = Math.min(avail / img.width, avail / img.height);
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);
      const x = Math.round((size - width) / 2);
      const y = Math.round((size - height) / 2);
      ctx.drawImage(img, x, y, width, height);

      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Falha ao carregar imagem do favicon"));
    img.src = source;
  });
}

export function useLogo() {
  const queryClient = useQueryClient();
  const { data: logo = null, isLoading } = useQuery({
    queryKey: LOGO_QUERY_KEY,
    queryFn: fetchLogo,
    staleTime: 5 * 60 * 1000, // 5 min
  });

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!logo) {
        applyFaviconHref(DEFAULT_FAVICON_HREF);
        return;
      }
      try {
        const squared = await buildSquareFaviconDataUrl(logo);
        if (!cancelled) applyFaviconHref(squared);
      } catch {
        if (!cancelled) applyFaviconHref(logo);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [logo]);

  const setLogo = async (base64: string | null) => {
    if (base64) {
      if (isApiConfigured()) {
        await setConfig("logo", base64);
      }
      localStorage.setItem(LOGO_KEY, base64);
    } else {
      if (isApiConfigured()) {
        await setConfig("logo", "");
      }
      localStorage.removeItem(LOGO_KEY);
    }
    window.dispatchEvent(new CustomEvent("rh-logo-updated"));
    await queryClient.invalidateQueries({ queryKey: LOGO_QUERY_KEY });
  };

  return { logo, isLoading, setLogo };
}
