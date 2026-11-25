import { describe, expect, it } from 'vitest';
import { validarArquivoFormularioDivergencia } from './doubleCheckInFormularioUpload.js';

const PDF_MINIMO = Buffer.from('%PDF-1.4 formulario').toString('base64');

describe('formulário de divergência', () => {
  it('aceita PDF dentro do limite', () => {
    const arquivo = validarArquivoFormularioDivergencia({
      fileName: 'Formulário divergência.pdf',
      contentBase64: PDF_MINIMO,
    });
    expect(arquivo.mimeType).toBe('application/pdf');
    expect(arquivo.ext).toBe('.pdf');
    expect(arquivo.originalName).toContain('diverg');
  });

  it('recusa extensão fora da lista', () => {
    expect(() =>
      validarArquivoFormularioDivergencia({
        fileName: 'script.exe',
        contentBase64: PDF_MINIMO,
      })
    ).toThrow(/PDF, imagem/);
  });

  it('recusa arquivo vazio', () => {
    expect(() =>
      validarArquivoFormularioDivergencia({
        fileName: 'formulario.pdf',
        contentBase64: '',
      })
    ).toThrow(/vazio/);
  });
});
