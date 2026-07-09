import { gerarPdfViaPython } from './pythonPdfRunner.js';
import { enfileirarPdfWord } from './wordPdfQueue.js';

export function gerarRncPdfBuffer(registro: unknown): Promise<Buffer> {
  return enfileirarPdfWord(() =>
    gerarPdfViaPython('scripts/sgq/rnc-pdf/generate_rnc_pdf.py', { registro }, 'rnc-pdf-')
  );
}

export function gerarRccPdfBuffer(
  registro: unknown,
  versao: 'cliente' | 'empresa'
): Promise<Buffer> {
  return enfileirarPdfWord(() =>
    gerarPdfViaPython(
      'scripts/sgq/rcc-pdf/generate_rcc_pdf.py',
      { versao, registro },
      'rcc-pdf-'
    )
  );
}
