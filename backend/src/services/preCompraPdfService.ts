import { gerarPdfViaPython } from './pythonPdfRunner.js';
import { enfileirarPdfWord } from './wordPdfQueue.js';

export function gerarPdfPreCompra(data: Record<string, unknown>): Promise<Buffer> {
  return enfileirarPdfWord(() =>
    gerarPdfViaPython('scripts/sgq/pre-compra-pdf/generate_pre_compra_pdf.py', data, 'pre-compra-pdf-')
  );
}
