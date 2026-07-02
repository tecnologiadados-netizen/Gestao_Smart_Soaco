import { useCallback, useLayoutEffect, useRef, useState } from "react";

interface ResizeOptions {
  /** Largura mínima em pixels durante o arraste */
  minWidthPx?: number;
  /** Chave opcional para persistir larguras no sessionStorage */
  storageKey?: string;
  /** Expande colunas flexíveis para ocupar a largura do container */
  fillContainer?: boolean;
  /** Peso de expansão por coluna (somente ids listados recebem espaço extra) */
  flexColumnWeights?: Partial<Record<string, number>>;
}

function loadStoredWidths<T extends string>(
  storageKey: string | undefined,
  defaultWidths: Record<T, number>,
): Record<T, number> {
  if (!storageKey || typeof window === "undefined") return defaultWidths;

  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return defaultWidths;
    const parsed = JSON.parse(raw) as Record<T, number>;
    const valid = Object.keys(defaultWidths).every(
      (key) => typeof parsed[key as T] === "number" && parsed[key as T] >= 48,
    );
    return valid ? parsed : defaultWidths;
  } catch {
    return defaultWidths;
  }
}

function sumWidths<T extends string>(
  columnIds: readonly T[],
  widths: Record<T, number>,
): number {
  return columnIds.reduce((sum, id) => sum + widths[id], 0);
}

export function useColumnResize<T extends string>(
  columnIds: readonly T[],
  defaultWidths: Record<T, number>,
  options: ResizeOptions = {},
) {
  const {
    minWidthPx = 48,
    storageKey,
    fillContainer = false,
    flexColumnWeights = {},
  } = options;

  const [widths, setWidths] = useState<Record<T, number>>(() =>
    loadStoredWidths(storageKey, defaultWidths),
  );
  const widthsRef = useRef(widths);
  widthsRef.current = widths;

  const tableRef = useRef<HTMLTableElement>(null);

  const resizingRef = useRef<{
    leftIndex: number;
    rightIndex: number;
    startX: number;
    startLeftPx: number;
    startRightPx: number;
    leftCol: HTMLTableColElement;
    rightCol: HTMLTableColElement;
    leftId: T;
    rightId: T;
    lastLeftPx: number;
    lastRightPx: number;
  } | null>(null);

  const rafRef = useRef<number | null>(null);
  const pendingClientXRef = useRef<number | null>(null);

  const applyWidthsToDom = useCallback(
    (nextWidths: Record<T, number>) => {
      const table = tableRef.current;
      if (!table) return;

      const cols = table.querySelectorAll("colgroup col");
      columnIds.forEach((id, index) => {
        const col = cols[index] as HTMLTableColElement | undefined;
        if (!col) return;
        col.style.width = `${nextWidths[id]}px`;
      });

      table.style.minWidth = `${sumWidths(columnIds, nextWidths)}px`;
    },
    [columnIds],
  );

  useLayoutEffect(() => {
    if (resizingRef.current) return;
    applyWidthsToDom(widths);
  }, [widths, applyWidthsToDom]);

  useLayoutEffect(() => {
    if (!fillContainer) return;

    const table = tableRef.current;
    const wrapper = table?.parentElement;
    if (!table || !wrapper) return;

    const expandToContainer = () => {
      if (resizingRef.current) return;

      const available = wrapper.clientWidth;
      if (available <= 0) return;

      const current = sumWidths(columnIds, widthsRef.current);
      const extra = available - current;
      if (extra <= 12) return;

      const flexIds = columnIds.filter(
        (id) => (flexColumnWeights[id] ?? 0) > 0,
      );
      const next = { ...widthsRef.current };

      if (flexIds.length === 0) {
        columnIds.forEach((id) => {
          next[id] = Math.round(next[id] + (extra * next[id]) / current);
        });
      } else {
        const totalWeight = flexIds.reduce(
          (sum, id) => sum + (flexColumnWeights[id] ?? 0),
          0,
        );
        flexIds.forEach((id) => {
          const weight = flexColumnWeights[id] ?? 0;
          next[id] = Math.round(next[id] + (extra * weight) / totalWeight);
        });
      }

      applyWidthsToDom(next);
    };

    expandToContainer();
    const observer = new ResizeObserver(expandToContainer);
    observer.observe(wrapper);

    return () => observer.disconnect();
  }, [applyWidthsToDom, columnIds, fillContainer, flexColumnWeights]);

  const applyDrag = useCallback(
    (clientX: number) => {
      const active = resizingRef.current;
      if (!active) return;

      const deltaPx = clientX - active.startX;
      let leftPx = active.startLeftPx + deltaPx;
      let rightPx = active.startRightPx - deltaPx;

      if (leftPx < minWidthPx) {
        rightPx -= minWidthPx - leftPx;
        leftPx = minWidthPx;
      }
      if (rightPx < minWidthPx) {
        leftPx -= minWidthPx - rightPx;
        rightPx = minWidthPx;
      }

      leftPx = Math.max(minWidthPx, leftPx);
      rightPx = Math.max(minWidthPx, rightPx);

      active.lastLeftPx = leftPx;
      active.lastRightPx = rightPx;

      active.leftCol.style.width = `${leftPx}px`;
      active.rightCol.style.width = `${rightPx}px`;
    },
    [minWidthPx],
  );

  const scheduleDrag = useCallback(
    (clientX: number) => {
      pendingClientXRef.current = clientX;
      if (rafRef.current != null) return;

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const x = pendingClientXRef.current;
        pendingClientXRef.current = null;
        if (x == null) return;
        applyDrag(x);
      });
    },
    [applyDrag],
  );

  const persistWidths = useCallback(
    (next: Record<T, number>) => {
      widthsRef.current = next;
      setWidths(next);
      applyWidthsToDom(next);

      if (storageKey) {
        try {
          sessionStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          /* quota / private mode */
        }
      }
    },
    [applyWidthsToDom, storageKey],
  );

  const startResize = useCallback(
    (id: T, clientX: number) => {
      const table = tableRef.current;
      if (!table) return;

      const leftIndex = columnIds.indexOf(id);
      const rightIndex = leftIndex + 1;
      const rightId = columnIds[rightIndex];
      if (!rightId) return;

      const cols = Array.from(
        table.querySelectorAll("colgroup col"),
      ) as HTMLTableColElement[];

      const leftCol = cols[leftIndex];
      const rightCol = cols[rightIndex];
      if (!leftCol || !rightCol) return;

      const startLeftPx = leftCol.getBoundingClientRect().width;
      const startRightPx = rightCol.getBoundingClientRect().width;

      resizingRef.current = {
        leftIndex,
        rightIndex,
        startX: clientX,
        startLeftPx,
        startRightPx,
        lastLeftPx: startLeftPx,
        lastRightPx: startRightPx,
        leftCol,
        rightCol,
        leftId: id,
        rightId,
      };

      table.classList.add("is-col-resizing");

      const onMouseMove = (event: MouseEvent) => {
        scheduleDrag(event.clientX);
      };

      let ended = false;
      const endResize = () => {
        if (ended) return;
        ended = true;

        if (rafRef.current != null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }

        if (pendingClientXRef.current != null) {
          applyDrag(pendingClientXRef.current);
          pendingClientXRef.current = null;
        }

        const active = resizingRef.current;
        if (active) {
          const next = { ...widthsRef.current };
          next[active.leftId] = active.lastLeftPx;
          next[active.rightId] = active.lastRightPx;
          persistWidths(next);
        }

        table.classList.remove("is-col-resizing");
        document.body.classList.remove("table-col-resizing");
        document.body.style.userSelect = "";
        document.body.style.cursor = "";

        resizingRef.current = null;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", endResize);
        window.removeEventListener("mouseup", endResize);
      };

      document.body.classList.add("table-col-resizing");
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", endResize);
      window.addEventListener("mouseup", endResize);
    },
    [applyDrag, columnIds, persistWidths, scheduleDrag],
  );

  return { startResize, tableRef };
}
