const PDF_GAUGES_WIDTH_PX = 1120;

export interface SaudeCaptureResult {
  dataUrl: string;
  width: number;
  height: number;
}

function isTooltipNode(node: Node): boolean {
  return node instanceof Element && node.getAttribute('role') === 'tooltip';
}

export async function captureSaudeGaugesForPdf(
  elementId: string,
): Promise<SaudeCaptureResult | null> {
  if (typeof document === 'undefined') return null;

  const element = document.getElementById(elementId);
  if (!element) return null;

  const grid = element.querySelector('[data-saude-grid]') as HTMLElement | null;
  const previous = {
    width: element.style.width,
    minWidth: element.style.minWidth,
    gridClassName: grid?.className ?? '',
  };

  element.style.width = `${PDF_GAUGES_WIDTH_PX}px`;
  element.style.minWidth = `${PDF_GAUGES_WIDTH_PX}px`;
  if (grid) {
    grid.className = 'grid grid-cols-5 gap-3 [&>*]:min-w-0 [&>*]:flex-1';
  }

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  try {
    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(element, {
      scale: 2,
      backgroundColor: '#ffffff',
      width: PDF_GAUGES_WIDTH_PX,
      ignoreElements: (node) => isTooltipNode(node),
    });

    if (canvas.width <= 0 || canvas.height <= 0) return null;

    return {
      dataUrl: canvas.toDataURL('image/png'),
      width: canvas.width,
      height: canvas.height,
    };
  } catch (error) {
    console.error('Falha ao capturar gauges para PDF:', error);
    return null;
  } finally {
    element.style.width = previous.width;
    element.style.minWidth = previous.minWidth;
    if (grid) {
      grid.className = previous.gridClassName;
    }
  }
}
