import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getOrganicoFoto } from "@rh/lib/api-client";
import { organicoFotoToDataUrl } from "@rh/lib/organico-foto-data-url";

const FOTO_STALE_MS = 5 * 60 * 1000;

/**
 * Carrega a foto do colaborador só quando o card entra na área visível (ou perto),
 * reutilizando o cache do React Query com a mesma chave do modal de identificação.
 */
export function useOrganicoCardFoto(input: {
  matricula: string;
  nome: string;
  /** Há registro em `organico_fotos` (resumo leve da API). */
  fotoDisponivel: boolean;
  /** Permissão + API configurada. */
  podeBuscar: boolean;
}) {
  const { matricula, nome, fotoDisponivel, podeBuscar } = input;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if (!fotoDisponivel || !podeBuscar || !matricula) return;
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisivel(true);
      },
      { root: null, rootMargin: "160px", threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [fotoDisponivel, podeBuscar, matricula]);

  const query = useQuery({
    queryKey: ["organico-foto", matricula],
    queryFn: () => getOrganicoFoto({ matricula, nome }),
    enabled: Boolean(matricula && fotoDisponivel && podeBuscar && visivel),
    staleTime: FOTO_STALE_MS,
    gcTime: 15 * 60 * 1000,
  });

  const fotoSrc =
    query.data?.fotoBase64 != null && String(query.data.fotoBase64).trim() !== ""
      ? organicoFotoToDataUrl(query.data.fotoBase64, query.data.mimeType ?? null)
      : null;

  return { rootRef, fotoSrc, isLoading: query.isLoading };
}
