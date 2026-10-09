import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getOrganicoFoto, normalizeMatriculaFolha } from "@rh/lib/api-client";
import { organicoFotoToDataUrl } from "@rh/lib/organico-foto-data-url";

const FOTO_STALE_MS = 30 * 60 * 1000;

/** Guarda a matrícula como veio e sem zeros à esquerda, para o card achar a foto. */
export function registrarMatriculasComFoto(matriculas: Iterable<string>): Set<string> {
  const set = new Set<string>();
  for (const raw of matriculas) {
    const matricula = String(raw ?? "").trim();
    if (!matricula) continue;
    set.add(matricula);
    const normalizada = normalizeMatriculaFolha(matricula);
    if (normalizada && normalizada !== "0") set.add(normalizada);
  }
  return set;
}

export function matriculaTemFoto(matriculas: Set<string>, matricula: string): boolean {
  const bruta = String(matricula ?? "").trim();
  if (!bruta) return false;
  if (matriculas.has(bruta)) return true;
  const normalizada = normalizeMatriculaFolha(bruta);
  return Boolean(normalizada && normalizada !== "0" && matriculas.has(normalizada));
}

function scrollPai(el: HTMLElement): Element | null {
  let node: HTMLElement | null = el.parentElement;
  while (node && node !== document.body) {
    const style = getComputedStyle(node);
    const overflow = `${style.overflow}${style.overflowY}${style.overflowX}`;
    if (/(auto|scroll)/.test(overflow)) return node;
    node = node.parentElement;
  }
  return null;
}

function chaveFoto(matricula: string): string {
  const bruta = matricula.trim();
  const normalizada = normalizeMatriculaFolha(bruta);
  return normalizada && normalizada !== "0" ? normalizada : bruta;
}

/**
 * Carrega a foto do colaborador.
 * Na grade, espera o card entrar na área rolável. No modal, `imediata` busca na hora.
 */
export function useOrganicoCardFoto(input: {
  matricula: string;
  nome: string;
  /** Há registro em `organico_fotos` (resumo leve da API). */
  fotoDisponivel: boolean;
  /** Permissão + API configurada. */
  podeBuscar: boolean;
  /** Modal: não espera o card entrar na tela. */
  imediata?: boolean;
}) {
  const { matricula, nome, fotoDisponivel, podeBuscar, imediata = false } = input;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [visivel, setVisivel] = useState(imediata);

  useEffect(() => {
    if (imediata) {
      setVisivel(true);
      return;
    }
    if (!fotoDisponivel || !podeBuscar || !matricula) return;
    let cancelado = false;
    let observer: IntersectionObserver | null = null;
    let quadro = 0;
    let tentativas = 0;

    const observar = () => {
      if (cancelado) return;
      const el = rootRef.current;
      if (!el) {
        tentativas += 1;
        if (tentativas > 30) return;
        quadro = requestAnimationFrame(observar);
        return;
      }
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) setVisivel(true);
        },
        { root: scrollPai(el), rootMargin: "240px", threshold: 0.01 },
      );
      observer.observe(el);
    };
    observar();

    return () => {
      cancelado = true;
      if (quadro) cancelAnimationFrame(quadro);
      observer?.disconnect();
    };
  }, [fotoDisponivel, podeBuscar, matricula, imediata]);

  const query = useQuery({
    queryKey: ["organico-foto", chaveFoto(matricula)],
    queryFn: () => getOrganicoFoto({ matricula, nome }),
    enabled: Boolean(matricula && fotoDisponivel && podeBuscar && (imediata || visivel)),
    staleTime: FOTO_STALE_MS,
    gcTime: 30 * 60 * 1000,
  });

  const fotoSrc =
    query.data?.fotoBase64 != null && String(query.data.fotoBase64).trim() !== ""
      ? organicoFotoToDataUrl(query.data.fotoBase64, query.data.mimeType ?? null)
      : null;

  return { rootRef, fotoSrc, isLoading: query.isLoading || query.isFetching };
}
